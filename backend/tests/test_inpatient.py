"""Hospitalisation — modèles et services (S6, ADR 0019).

Ce que ce fichier verrouille, dans l'ordre des décisions de l'ADR :

1. **Le séjour héberge, la consultation soigne** — la consultation pivot
   est obligatoire, ouverte du premier au dernier jour, et c'est elle qui
   porte la surveillance (``VitalSigns`` INCHANGÉ) et la facturation.
2. **Le lit est une ressource exclusive garantie par la BASE** — contrainte
   partielle, plus une course à threads réels (l'exclusivité doit tenir
   sans la discipline de service).
3. **Un patient peut être admis SANS lit** — refuser une admission faute de
   lit libre reviendrait à refuser un patient présent.
4. **Machine à états fermée**, transitions sérialisées, terminal définitif.
5. **N journées = N actes**, jamais une quantité ; le staff déclenche.
6. **Le gel commercial n'atteint jamais l'hospitalisation** (sonde
   structurelle propre au module, en plus de la sonde S5 fail-closed).
7. **L'audit ne porte jamais le motif d'admission** (même classe qu'un
   diagnostic) ni le motif d'annulation.
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connections, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.common.models import ActCategory, AppendOnlyError
from apps.inpatient import services
from apps.inpatient.models import (
    Bed,
    BedAssignment,
    Room,
    Stay,
    StayDayBilling,
)
from apps.medical.models import ActPerformed, Encounter, VitalSigns
from apps.medical.services import record_vital_signs
from apps.patients.services import merge_profiles

from .api_helpers import (
    Role,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import (
    make_bed,
    make_center,
    make_encounter,
    make_patient,
    make_room,
    make_staff,
    make_stay,
    make_tariff,
    make_user,
)

pytestmark = pytest.mark.django_db

Status = Stay.Status
Priority = Stay.Priority


# ---------------------------------------------------------------------------
# Scénario partagé
# ---------------------------------------------------------------------------


class Ward:
    """Un centre avec sa chambre, ses deux lits, son médecin et un patient."""

    def __init__(self, patient=None):
        self.center, self.director = make_center_with_director()
        self.doctor_user = make_staff_user(self.center, role=Role.DOCTOR)
        self.practitioner = self.doctor_user.staff_memberships.get(
            center=self.center
        )
        self.room = make_room(center=self.center, name="Chambre 1")
        self.bed_a = make_bed(room=self.room, name="Lit A")
        self.bed_b = make_bed(room=self.room, name="Lit B")
        self.patient = patient or make_patient(created_by_center=self.center)
        self._tariffs = {}

    def admit(self, patient=None, bed=None, **kwargs):
        kwargs.setdefault("reason", "Poussée hypertensive — surveillance 48 h")
        return services.admit_patient(
            actor=self.doctor_user, center=self.center,
            practitioner=self.practitioner, patient=patient or self.patient,
            bed=bed, **kwargs,
        )

    def admit_days_ago(self, days, **kwargs):
        """Admission datée — indispensable depuis le correctif du plafond :
        un séjour ouvre autant de journées facturables qu'il a touché de
        dates civiles, donc facturer N journées suppose un séjour d'au
        moins N dates."""
        return self.admit(
            admitted_at=timezone.now() - timedelta(days=days), **kwargs
        )

    def day_tariff(self, code="HOSP01"):
        """Un tarif de nature générique ``hospitalisation`` — la SEULE que
        la facturation des journées accepte depuis le correctif (sans quoi
        le compteur de journées, dérivé de la catégorie figée, ignorerait
        ses propres actes et rouvrirait le plafond).

        Mémoïsé par code : un centre n'a qu'une ligne « journée » dans sa
        grille (code unique par centre), et les tests l'appellent plusieurs
        fois dans un même scénario.
        """
        cached = self._tariffs.get(code)
        if cached is not None:
            return cached
        tariff = make_tariff(
            self.center, code=code, label="Journée d'hospitalisation",
            price_kmf="12000",
        )
        tariff.generic_category = ActCategory.HOSPITALISATION
        tariff.save()
        self._tariffs[code] = tariff
        return tariff


@pytest.fixture
def ward():
    return Ward()


_keys = iter(f"lot-{index:04d}" for index in range(1, 10_000))


def a_key():
    """Une clé d'idempotence neuve — ce que le client fabrique à chaque
    nouveau geste (et conserve tant que le geste n'a pas abouti)."""
    return next(_keys)


# ---------------------------------------------------------------------------
# 1 — Le séjour héberge, la consultation soigne (décision 1)
# ---------------------------------------------------------------------------


class TestThePivotEncounter:
    def test_admission_opens_an_open_pivot_encounter(self, ward):
        stay = ward.admit()
        assert stay.status == Status.IN_PROGRESS
        assert stay.encounter.status == Encounter.Status.IN_PROGRESS
        assert stay.encounter.patient_id == ward.patient.pk
        assert stay.encounter.center_id == ward.center.pk
        # Le motif d'admission vit sur la consultation, JAMAIS sur le séjour
        # (il est clinique et déjà segmenté par rôle — R-API-1).
        assert stay.encounter.reason.startswith("Poussée hypertensive")
        assert not hasattr(stay, "reason")

    def test_the_pivot_carries_the_surveillance_unchanged(self, ward):
        """La conséquence heureuse de la décision 1 : les relevés répétés
        d'un hospitalisé sont des ``VitalSigns`` ordinaires sur le pivot —
        aucune migration, aucune contrainte XOR, aucune table dédiée."""
        stay = ward.admit()
        for systolic in (178, 162, 148):
            record_vital_signs(
                actor=ward.doctor_user, encounter=stay.encounter,
                measured_by=ward.practitioner,
                systolic_bp=systolic, diastolic_bp=95,
            )
        assert VitalSigns.objects.filter(encounter=stay.encounter).count() == 3
        # …et le carnet TRANSVERSAL du patient les voit, ce qui est le point
        # de rupture n° 1 que la décision 1 évite (``encounter__patient``).
        assert VitalSigns.objects.for_patient(ward.patient).count() == 3

    def test_a_stay_cannot_pivot_on_another_patients_encounter(self, ward):
        foreign = make_encounter(center=ward.center)
        stay = Stay(
            patient=ward.patient, center=ward.center, encounter=foreign,
            admitted_at=timezone.now(), admitted_by=ward.doctor_user,
        )
        with pytest.raises(ValidationError, match="ne concerne pas ce patient"):
            stay.save()

    def test_a_stay_cannot_pivot_on_another_centers_encounter(self, ward):
        other = make_center(name="Clinique voisine")
        foreign = make_encounter(patient=ward.patient, center=other)
        stay = Stay(
            patient=ward.patient, center=ward.center, encounter=foreign,
            admitted_at=timezone.now(), admitted_by=ward.doctor_user,
        )
        with pytest.raises(
            ValidationError, match="n'appartient pas à ce centre"
        ):
            stay.save()

    def test_discharge_closes_the_pivot(self, ward):
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.refresh_from_db()
        assert stay.status == Status.DISCHARGED
        assert stay.discharged_at is not None
        stay.encounter.refresh_from_db()
        assert stay.encounter.status == Encounter.Status.COMPLETED

    def test_discharge_tolerates_an_already_closed_pivot(self, ward):
        """Un pivot déjà fermé ne doit JAMAIS coincer un vrai patient dans
        un lit — défense en profondeur conservée.

        **Mise à jour revue guardian S6** : la porte de devant est
        désormais fermée (``close_encounter`` refuse le pivot d'un séjour en
        cours — sinon la surveillance de l'hospitalisé devenait impossible,
        voir ``test_adversarial_s6.py``). La tolérance de la sortie garde
        pourtant tout son sens : elle couvre les données écrites AVANT ce
        correctif et toute fermeture arrivée par un autre chemin. On pose
        donc l'état directement en base, comme une ligne héritée.
        """
        stay = ward.admit()
        Encounter.objects.filter(pk=stay.encounter_id).update(
            status=Encounter.Status.COMPLETED
        )
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.refresh_from_db()
        assert stay.status == Status.DISCHARGED


# ---------------------------------------------------------------------------
# 2 — Le lit, ressource exclusive garantie par la base (décision 2)
# ---------------------------------------------------------------------------


class TestBedExclusivity:
    def test_two_patients_cannot_share_a_bed(self, ward):
        ward.admit(bed=ward.bed_a)
        second = make_patient(
            first_name="Ahmed", last_name="Bacar", created_by_center=ward.center
        )
        with pytest.raises(ValidationError, match="déjà occupé"):
            ward.admit(patient=second, bed=ward.bed_a)

    def test_the_database_itself_refuses_a_second_open_assignment(self, ward):
        """La contrainte partielle est la GARANTIE : même en contournant le
        service, la base refuse. C'est ce qui rend l'invariant vrai sans
        discipline de service."""
        stay = ward.admit(bed=ward.bed_a)
        other = make_stay(center=ward.center)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                BedAssignment.objects.create(
                    stay=other, bed=ward.bed_a,
                    assigned_at=timezone.now(), assigned_by=ward.doctor_user,
                )
        assert BedAssignment.objects.filter(
            bed=ward.bed_a, released_at__isnull=True
        ).count() == 1
        assert stay.current_bed == ward.bed_a

    def test_a_patient_is_never_in_two_beds(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                BedAssignment.objects.create(
                    stay=stay, bed=ward.bed_b,
                    assigned_at=timezone.now(), assigned_by=ward.doctor_user,
                )

    def test_a_released_bed_can_receive_the_next_patient(self, ward):
        first = ward.admit(bed=ward.bed_a)
        services.discharge_stay(actor=ward.doctor_user, stay=first)
        second = make_patient(created_by_center=ward.center)
        stay = ward.admit(patient=second, bed=ward.bed_a)
        assert stay.current_bed == ward.bed_a
        assert BedAssignment.objects.filter(bed=ward.bed_a).count() == 2

    def test_a_transfer_stacks_history_instead_of_rewriting_it(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_b)
        assignments = list(
            BedAssignment.objects.filter(stay=stay).order_by("assigned_at", "id")
        )
        assert len(assignments) == 2
        assert assignments[0].bed_id == ward.bed_a.pk
        assert assignments[0].released_at is not None
        assert assignments[1].bed_id == ward.bed_b.pk
        assert assignments[1].released_at is None
        assert stay.current_bed == ward.bed_b

    def test_a_released_assignment_never_reopens(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        services.release_bed(actor=ward.doctor_user, stay=stay)
        assignment = BedAssignment.objects.get(stay=stay)
        assignment.released_at = None
        with pytest.raises(ValidationError, match="définitive"):
            assignment.save()

    def test_an_assignment_row_is_never_re_pointed(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        assignment = BedAssignment.objects.get(stay=stay)
        assignment.bed = ward.bed_b
        with pytest.raises(ValidationError, match="ne se réécrit pas"):
            assignment.save()

    def test_a_bed_of_another_center_is_refused(self, ward):
        foreign_bed = make_bed(center=make_center(name="Clinique voisine"))
        stay = ward.admit()
        with pytest.raises(
            ValidationError, match="n'appartient pas à ce centre"
        ):
            services.assign_bed(
                actor=ward.doctor_user, stay=stay, bed=foreign_bed
            )

    def test_an_inactive_bed_is_refused(self, ward):
        Bed.objects.filter(pk=ward.bed_b.pk).update(is_active=False)
        ward.bed_b.refresh_from_db()
        stay = ward.admit()
        with pytest.raises(ValidationError, match="n'est pas disponible"):
            services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_b)

    def test_assigning_the_same_bed_twice_is_refused_explicitly(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        with pytest.raises(ValidationError, match="occupe déjà ce lit"):
            services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_a)

    def test_releasing_a_bedless_stay_is_refused(self, ward):
        stay = ward.admit()
        with pytest.raises(ValidationError, match="n'occupe aucun lit"):
            services.release_bed(actor=ward.doctor_user, stay=stay)

    def test_free_beds_queryset_mirrors_the_assignments(self, ward):
        assert set(Bed.objects.for_center(ward.center).available()) == {
            ward.bed_a, ward.bed_b
        }
        stay = ward.admit(bed=ward.bed_a)
        assert set(Bed.objects.for_center(ward.center).available()) == {
            ward.bed_b
        }
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        assert set(Bed.objects.for_center(ward.center).available()) == {
            ward.bed_a, ward.bed_b
        }


class TestBedExclusivityUnderRealThreads:
    """La course, à threads réels — comme la caisse (ADR 0015).

    Deux admissions simultanées visent le MÊME lit. L'invariant ne doit pas
    dépendre de l'ordonnancement : une seule gagne, l'autre reçoit un refus
    métier propre (jamais une IntegrityError qui empoisonnerait sa
    transaction), et le lit porte exactement UNE occupation ouverte.
    """

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_admissions_on_the_same_bed(self):
        ward = Ward()
        first = make_patient(
            first_name="Anfia", last_name="Saïd", created_by_center=ward.center
        )
        second = make_patient(
            first_name="Ahmed", last_name="Bacar", created_by_center=ward.center
        )
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def admit(patient):
            def runner():
                try:
                    barrier.wait()
                    outcomes.append(("ok", ward.admit(patient=patient,
                                                      bed=ward.bed_a).pk))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                finally:
                    connections.close_all()

            return runner

        threads = [
            threading.Thread(target=admit(first)),
            threading.Thread(target=admit(second)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        (refusal,) = [message for kind, message in outcomes if kind == "refused"]
        # Refus MÉTIER propre (français), jamais une IntegrityError brute :
        # le verrou de ligne sur le lit sérialise les deux candidats, la
        # contrainte partielle n'est que le dernier rempart.
        assert "déjà occupé" in refusal
        assert BedAssignment.objects.filter(
            bed=ward.bed_a, released_at__isnull=True
        ).count() == 1
        # Le perdant a demandé CE lit : son admission est atomiquement
        # annulée (on ne l'admet pas en douce ailleurs que là où le service
        # l'a demandé). Un seul séjour existe.
        assert Stay.objects.filter(center=ward.center).count() == 1
        # …et il est immédiatement ré-admissible SANS lit — c'est la
        # décision 2 : on ne refuse jamais un patient présent, on refuse un
        # lit occupé.
        admitted = set(Stay.objects.values_list("patient_id", flat=True))
        loser = first if first.pk not in admitted else second
        bedless = ward.admit(patient=loser)
        assert bedless.status == Status.IN_PROGRESS
        assert bedless.current_bed is None

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_transfers_into_the_same_free_bed(self):
        ward = Ward()
        free = make_bed(room=ward.room, name="Lit C")
        stay_one = ward.admit(bed=ward.bed_a)
        stay_two = ward.admit(
            patient=make_patient(created_by_center=ward.center), bed=ward.bed_b
        )
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def move(stay):
            def runner():
                try:
                    barrier.wait()
                    services.assign_bed(
                        actor=ward.doctor_user, stay=stay, bed=free
                    )
                    outcomes.append(("ok", stay.pk))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                finally:
                    connections.close_all()

            return runner

        threads = [
            threading.Thread(target=move(stay_one)),
            threading.Thread(target=move(stay_two)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert BedAssignment.objects.filter(
            bed=free, released_at__isnull=True
        ).count() == 1
        # Le perdant n'a pas perdu SON lit au passage (le transfert est
        # atomique : on ne libère que si on peut occuper).
        occupied = {
            assignment.stay_id
            for assignment in BedAssignment.objects.filter(
                released_at__isnull=True
            )
        }
        assert occupied == {stay_one.pk, stay_two.pk}


# ---------------------------------------------------------------------------
# 3 — Admis sans lit : la réalité comorienne est représentable
# ---------------------------------------------------------------------------


class TestAdmissionWithoutABed:
    def test_a_patient_is_admitted_even_when_no_bed_is_free(self, ward):
        make_stay(center=ward.center, bed=ward.bed_a)
        make_stay(center=ward.center, bed=ward.bed_b)
        assert not Bed.objects.for_center(ward.center).available().exists()

        stay = ward.admit()
        assert stay.status == Status.IN_PROGRESS
        assert stay.current_bed is None

    def test_a_bed_can_be_given_later(self, ward):
        stay = ward.admit()
        services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_a)
        assert stay.current_bed == ward.bed_a

    def test_no_bed_field_exists_on_the_stay_model(self):
        """Garde structurelle : le lit courant se LIT par l'assignation
        ouverte. Un champ ``bed`` sur le séjour réintroduirait deux vérités
        (et la seconde ne porterait pas la contrainte d'exclusivité)."""
        assert "bed" not in {field.name for field in Stay._meta.get_fields()}


# ---------------------------------------------------------------------------
# 4 — Machine à états (décision 3)
# ---------------------------------------------------------------------------


class TestStateMachine:
    def test_transitions_are_a_closed_map(self):
        assert services.STAY_TRANSITIONS == {
            Status.IN_PROGRESS: frozenset({Status.DISCHARGED, Status.CANCELLED}),
            Status.DISCHARGED: frozenset(),
            Status.CANCELLED: frozenset(),
        }

    def test_a_discharged_stay_is_terminal(self, ward):
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        with pytest.raises(ValidationError, match="Transition impossible"):
            services.discharge_stay(actor=ward.doctor_user, stay=stay)
        with pytest.raises(ValidationError, match="Transition impossible"):
            services.cancel_stay(
                actor=ward.doctor_user, stay=stay, reason="Erreur"
            )

    def test_a_cancelled_stay_is_terminal(self, ward):
        stay = ward.admit()
        services.cancel_stay(
            actor=ward.doctor_user, stay=stay, reason="Mauvais patient."
        )
        with pytest.raises(ValidationError, match="Transition impossible"):
            services.discharge_stay(actor=ward.doctor_user, stay=stay)

    def test_a_terminal_stay_never_returns_to_en_cours_even_by_orm(self, ward):
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.refresh_from_db()
        stay.status = Status.IN_PROGRESS
        stay.discharged_at = None
        with pytest.raises(ValidationError, match="ne peut plus changer"):
            stay.save()

    def test_discharge_releases_the_bed(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        assert not BedAssignment.objects.filter(
            bed=ward.bed_a, released_at__isnull=True
        ).exists()

    def test_cancel_requires_a_reason(self, ward):
        stay = ward.admit()
        with pytest.raises(ValidationError, match="motif d'annulation"):
            services.cancel_stay(actor=ward.doctor_user, stay=stay, reason="  ")

    def test_cancel_is_refused_once_an_act_sits_on_the_pivot(self, ward):
        """« Aucune journée facturée » : une admission qui a déjà produit du
        soin facturable n'était pas une erreur de saisie."""
        stay = ward.admit()
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=1,
            idempotency_key=a_key(),
        )
        with pytest.raises(ValidationError, match="porte déjà des actes"):
            services.cancel_stay(
                actor=ward.doctor_user, stay=stay, reason="Erreur de saisie."
            )

    def test_discharge_in_the_future_is_refused(self, ward):
        stay = ward.admit()
        with pytest.raises(ValidationError, match="dans le futur"):
            services.discharge_stay(
                actor=ward.doctor_user, stay=stay,
                discharged_at=timezone.now() + timedelta(days=2),
            )

    def test_discharge_before_admission_is_refused(self, ward):
        stay = ward.admit()
        with pytest.raises(ValidationError, match="précéder l'admission"):
            services.discharge_stay(
                actor=ward.doctor_user, stay=stay,
                discharged_at=stay.admitted_at - timedelta(hours=1),
            )

    def test_admission_in_the_future_is_refused(self, ward):
        with pytest.raises(ValidationError, match="dans le futur"):
            ward.admit(admitted_at=timezone.now() + timedelta(hours=2))

    def test_admission_older_than_a_year_is_refused(self, ward):
        with pytest.raises(ValidationError, match="plus d'un an"):
            ward.admit(admitted_at=timezone.now() - timedelta(days=400))

    def test_a_patient_is_never_hospitalised_twice_at_once(self, ward):
        ward.admit()
        with pytest.raises(ValidationError, match="déjà hospitalisé"):
            ward.admit()

    def test_a_closed_stay_refuses_a_bed(self, ward):
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        with pytest.raises(ValidationError, match="clos"):
            services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_a)


# ---------------------------------------------------------------------------
# 5 — Médecins assignés : invariant de périmètre structurel
# ---------------------------------------------------------------------------


class TestAttendingPhysicians:
    def test_several_attendings_are_assignable_and_replaceable(self, ward):
        nurse = make_staff_user(ward.center, role=Role.NURSE)
        nurse_membership = nurse.staff_memberships.get(center=ward.center)
        stay = ward.admit(attending=[ward.practitioner])
        assert list(stay.attending.all()) == [ward.practitioner]
        services.set_attending(
            actor=ward.doctor_user, stay=stay,
            attending=[ward.practitioner, nurse_membership],
        )
        assert set(stay.attending.all()) == {ward.practitioner, nurse_membership}
        services.set_attending(actor=ward.doctor_user, stay=stay, attending=[])
        assert not stay.attending.exists()

    def test_a_foreign_membership_is_refused_by_the_service(self, ward):
        foreign = make_staff(center=make_center(name="Clinique voisine"))
        with pytest.raises(
            ValidationError, match="n'appartient pas à ce centre"
        ):
            ward.admit(attending=[foreign])

    def test_the_invariant_is_STRUCTURAL_not_only_in_the_service(self, ward):
        """Un ``ManyToManyField`` ne passe jamais par ``Stay.save()`` : la
        garde vit dans le receveur ``m2m_changed``, ce qui couvre ``add()``,
        ``set()``, l'admin et le shell — l'équivalent structurel exact de
        l'invariant praticien-du-centre d'``Appointment.save()``."""
        foreign = make_staff(center=make_center(name="Clinique voisine"))
        stay = ward.admit()
        # ``add()`` s'exécute dans un ``atomic(savepoint=False)`` : lever
        # depuis le signal marque la transaction englobante — on l'isole
        # dans son propre savepoint, comme pour une IntegrityError.
        with pytest.raises(
            ValidationError, match="n'appartient pas à ce centre"
        ):
            with transaction.atomic():
                stay.attending.add(foreign)
        assert not stay.attending.exists()

    def test_a_closed_stay_refuses_a_reassignment(self, ward):
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        with pytest.raises(ValidationError, match="clos"):
            services.set_attending(
                actor=ward.doctor_user, stay=stay,
                attending=[ward.practitioner],
            )


# ---------------------------------------------------------------------------
# 6 — Facturation : N journées = N actes (décision 4)
# ---------------------------------------------------------------------------


class TestBillingTheDays:
    def test_n_days_produce_n_acts_on_the_pivot(self, ward):
        stay = ward.admit_days_ago(4)
        tariff = ward.day_tariff()
        billing = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=4,
            idempotency_key=a_key(),
        )
        # Le geste est désormais RÉIFIÉ : un lot qui sait quels actes il a
        # posés (c'est lui qui porte la clé d'idempotence).
        assert billing.days == 4
        assert billing.acts.count() == 4
        rows = ActPerformed.objects.filter(encounter=stay.encounter)
        assert rows.count() == 4
        # Chaque acte porte le SNAPSHOT du tarif (ADR 0005) — jamais une
        # quantité (qui casserait recompute_total, unpaid_invoices_qs et
        # stats/finances).
        assert {row.price_kmf_snapshot for row in rows} == {Decimal("12000.00")}
        assert {row.generic_category for row in rows} == {
            ActCategory.HOSPITALISATION
        }
        assert services.billed_days(stay) == 4

    def test_no_quantity_field_exists_on_an_invoice_line(self):
        """Garde structurelle de la décision 4 : la tentation d'une ligne
        × N doit rester impossible à satisfaire par accident."""
        from apps.trustbridge.models import InvoiceLine

        names = {field.name for field in InvoiceLine._meta.get_fields()}
        assert "quantity" not in names

    def test_the_existing_invoicing_takes_over_unchanged(self, ward):
        """La chaîne complète : journées → facture → total. Aucun second
        moteur de facturation, aucune ligne de ``create_invoice`` touchée."""
        from apps.trustbridge import services as tb

        stay = ward.admit_days_ago(3)
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=3,
            idempotency_key=a_key(),
        )
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        invoice = tb.create_invoice(
            actor=ward.director, center=ward.center, encounter=stay.encounter
        )
        assert invoice.lines.count() == 3
        assert invoice.total_kmf == Decimal("36000.00")

    def test_billing_after_the_discharge_is_allowed(self, ward):
        """``_require_open_encounter`` ne s'applique PAS aux actes : les
        journées se facturent normalement APRÈS la sortie, qui a clôturé le
        pivot."""
        stay = ward.admit_days_ago(2)
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.encounter.refresh_from_db()
        assert stay.encounter.status == Encounter.Status.COMPLETED
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=2,
            idempotency_key=a_key(),
        )
        assert ActPerformed.objects.filter(encounter=stay.encounter).count() == 2

    def test_a_cancelled_stay_is_never_billed(self, ward):
        stay = ward.admit()
        services.cancel_stay(
            actor=ward.doctor_user, stay=stay, reason="Doublon de saisie."
        )
        with pytest.raises(ValidationError, match="annulé"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=1, idempotency_key=a_key(),
            )

    def test_a_foreign_tariff_is_refused(self, ward):
        stay = ward.admit()
        foreign = make_tariff(make_center(name="Clinique voisine"))
        with pytest.raises(ValidationError, match="grille de ce centre"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=foreign, days=1,
                idempotency_key=a_key(),
            )

    def test_an_inactive_tariff_is_refused(self, ward):
        stay = ward.admit()
        tariff = ward.day_tariff()
        tariff.is_active = False
        tariff.save()
        with pytest.raises(ValidationError, match="n'est plus actif"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=tariff, days=1,
                idempotency_key=a_key(),
            )

    def test_a_tariff_of_another_generic_category_is_refused(self, ward):
        """Le compteur de journées est DÉRIVÉ de la catégorie figée
        (addendum ADR 0019 n° 9) : une « journée » facturée sous
        ``consultation`` serait invisible du compteur et rouvrirait le
        plafond à chaque geste. Le tarif doit dire ce qu'il est."""
        stay = ward.admit()
        ordinary = make_tariff(ward.center, code="CS900")
        assert ordinary.generic_category == ActCategory.AUTRE
        with pytest.raises(ValidationError, match="hospitalisation"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ordinary, days=1,
                idempotency_key=a_key(),
            )
        assert services.billed_days(stay) == 0

    @pytest.mark.parametrize("days", [0, -3, services.MAX_BILLABLE_DAYS + 1])
    def test_implausible_day_counts_are_refused(self, ward, days):
        stay = ward.admit()
        with pytest.raises(ValidationError):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=days, idempotency_key=a_key(),
            )

    def test_nothing_is_billed_automatically_at_the_discharge(self, ward):
        """« Le staff déclenche » : une facturation automatique
        transformerait une erreur de date en créance réelle."""
        stay = ward.admit(bed=ward.bed_a)
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        assert not ActPerformed.objects.filter(encounter=stay.encounter).exists()
        assert services.billed_days(stay) == 0


# ---------------------------------------------------------------------------
# 6 bis — Idempotence de la facturation (correctif PO du 15/08/2026)
# ---------------------------------------------------------------------------


class TestBillingIsIdempotent:
    """Le jeton fourni par le client, patron ``CashPayment`` (ADR 0015).

    Ce que le correctif ferme : ``create_invoice`` sans ``act_ids`` facture
    TOUS les actes de la consultation pivot — un POST rejoué (double-clic,
    délai réseau) devenait donc une créance doublée, réclamée pour de vrai
    à un patient.
    """

    def test_the_key_is_mandatory(self, ward):
        stay = ward.admit()
        for missing in (None, "", "   "):
            with pytest.raises(ValidationError, match="clé d'idempotence"):
                services.bill_stay_days(
                    actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                    days=1, idempotency_key=missing,
                )
        assert services.billed_days(stay) == 0

    def test_a_key_longer_than_the_column_is_refused_cleanly(self, ward):
        stay = ward.admit()
        with pytest.raises(ValidationError, match="64 caractères"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=1, idempotency_key="x" * 65,
            )

    def test_replaying_the_same_key_returns_the_same_gesture(self, ward):
        stay = ward.admit_days_ago(5)
        tariff = ward.day_tariff()
        first = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=3,
            idempotency_key="lot-du-jour",
        )
        replay = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=3,
            idempotency_key="lot-du-jour",
        )
        assert replay.pk == first.pk
        assert replay.was_replayed is True
        assert not getattr(first, "was_replayed", False)
        # RIEN de nouveau : ni acte, ni lot, ni entrée d'audit.
        assert services.billed_days(stay) == 3
        assert StayDayBilling.objects.filter(stay=stay).count() == 1
        assert (
            AuditLog.objects.filter(action=AuditAction.STAY_DAYS_BILLED).count()
            == 1
        )

    def test_the_gesture_knows_exactly_which_acts_it_posted(self, ward):
        """Le critère qui a fait choisir le LOT plutôt qu'un champ sur les
        actes : « ces N actes ont-ils déjà été posés par cet appel ? » doit
        avoir une réponse sans ambiguïté."""
        stay = ward.admit_days_ago(3)
        tariff = ward.day_tariff()
        first = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key=a_key(),
        )
        second = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=1,
            idempotency_key=a_key(),
        )
        assert first.acts.count() == 2
        assert second.acts.count() == 1
        assert set(first.acts.values_list("pk", flat=True)).isdisjoint(
            second.acts.values_list("pk", flat=True)
        )
        assert services.billed_days(stay) == 3

    @pytest.mark.parametrize(
        "changed", ["days", "tariff", "stay"], ids=["journées", "tarif", "séjour"]
    )
    def test_the_same_key_with_other_parameters_is_an_explicit_400(
        self, ward, changed
    ):
        """Correctif guardian S1 de la caisse, repris ici : un rejeu qui
        décrit AUTRE CHOSE est un bug du client. Répondre en silence le
        résultat précédent effacerait des livres la seconde intention."""
        stay = ward.admit_days_ago(5)
        tariff = ward.day_tariff()
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key="clé-partagée",
        )
        kwargs = {"stay": stay, "tariff": tariff, "days": 2}
        if changed == "days":
            kwargs["days"] = 3
        elif changed == "tariff":
            kwargs["tariff"] = ward.day_tariff(code="HOSP02")
        else:
            kwargs["stay"] = ward.admit_days_ago(
                5, patient=make_patient(created_by_center=ward.center)
            )
        with pytest.raises(ValidationError, match="clé d'idempotence"):
            services.bill_stay_days(
                actor=ward.director, idempotency_key="clé-partagée", **kwargs
            )
        assert StayDayBilling.objects.filter(center=ward.center).count() == 1

    def test_the_same_key_in_two_centers_is_independent(self):
        """L'unicité est PAR CENTRE : deux tenants ne se marchent jamais
        dessus par une contrainte partagée."""
        first, second = Ward(), Ward()
        for ward in (first, second):
            services.bill_stay_days(
                actor=ward.director, stay=ward.admit(),
                tariff=ward.day_tariff(), days=1,
                idempotency_key="facturation-du-lundi",
            )
        assert StayDayBilling.objects.count() == 2

    def test_the_uniqueness_is_guaranteed_by_the_DATABASE(self, ward):
        """Pas seulement applicative : un INSERT brut qui contournerait le
        service se heurte quand même à la contrainte."""
        stay = ward.admit()
        tariff = ward.day_tariff()
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=1,
            idempotency_key="ligne-unique",
        )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                StayDayBilling.objects.create(
                    stay=stay, center=ward.center, tariff=tariff, days=1,
                    idempotency_key="ligne-unique", billed_by=ward.director,
                )

    def test_a_billing_gesture_is_append_only(self, ward):
        stay = ward.admit()
        billing = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=1,
            idempotency_key=a_key(),
        )
        billing.days = 9
        with pytest.raises(AppendOnlyError):
            billing.save()
        with pytest.raises(AppendOnlyError):
            billing.delete()

    def test_the_model_replays_its_invariants_outside_the_service(self, ward):
        """Règle d'ingénierie du projet : les invariants vivent AUSSI dans
        ``save()`` — le service n'est pas la seule porte."""
        stay = ward.admit()
        other = Ward()
        with pytest.raises(ValidationError, match="centre ne correspond pas"):
            StayDayBilling(
                stay=stay, center=other.center, tariff=other.day_tariff(),
                days=1, idempotency_key=a_key(), billed_by=ward.director,
            ).save()
        with pytest.raises(ValidationError, match="grille de ce centre"):
            StayDayBilling(
                stay=stay, center=ward.center, tariff=other.day_tariff(),
                days=1, idempotency_key=a_key(), billed_by=ward.director,
            ).save()
        with pytest.raises(ValidationError, match="clé d'idempotence"):
            StayDayBilling(
                stay=stay, center=ward.center, tariff=ward.day_tariff(),
                days=1, idempotency_key="   ", billed_by=ward.director,
            ).save()


# ---------------------------------------------------------------------------
# 6 ter — Le plafond : jamais plus de journées que le séjour n'a duré
# ---------------------------------------------------------------------------


class TestTheBillableDaysCap:
    """**Règle produit** : toute journée CIVILE entamée sous le toit du
    centre est facturable, et pas une de plus (heure des Comores).

    Un séjour en cours court jusqu'à maintenant ; un séjour sorti s'arrête
    à sa date de sortie, définitivement. Le plafond est CUMULÉ : les
    journées déjà facturées comptent.
    """

    def test_a_stay_of_the_day_opens_exactly_one_day(self, ward):
        """Quatre heures d'hospitalisation se facturent — elles ne sont pas
        gratuites — mais une seule journée."""
        stay = ward.admit()
        assert services.billable_days_cap(stay) == 1
        with pytest.raises(ValidationError, match="ouvre 1 journée"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=2, idempotency_key=a_key(),
            )
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(code="H2"),
            days=1, idempotency_key=a_key(),
        )
        assert services.billed_days(stay) == 1

    def test_an_ongoing_stay_runs_until_now(self, ward):
        stay = ward.admit_days_ago(3)
        assert services.billable_days_cap(stay) == 4  # J-3, J-2, J-1, aujourd'hui

    def test_a_discharged_stay_stops_at_its_discharge(self, ward):
        stay = ward.admit_days_ago(5)
        services.discharge_stay(
            actor=ward.doctor_user, stay=stay,
            discharged_at=timezone.now() - timedelta(days=3),
        )
        stay.refresh_from_db()
        assert services.billable_days_cap(stay) == 3
        with pytest.raises(ValidationError, match="ouvre 3 journée"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=4, idempotency_key=a_key(),
            )

    def test_the_cap_is_CUMULATIVE(self, ward):
        """Le cœur de la faille : rien ne reliait le cumul à la durée."""
        stay = ward.admit_days_ago(2)  # 3 journées ouvertes
        tariff = ward.day_tariff()
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key=a_key(),
        )
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=1,
            idempotency_key=a_key(),
        )
        assert services.billed_days(stay) == 3
        with pytest.raises(ValidationError) as excinfo:
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=tariff, days=1,
                idempotency_key=a_key(),
            )
        message = str(excinfo.value)
        # Le refus DIT le plafond et ce qui a déjà été facturé (art. 12.4
        # de l'esprit maison : un refus qui n'explique pas est un mur).
        assert "3 journée(s) facturable(s)" in message
        assert "dont 3 déjà facturée(s)" in message
        assert "vous en demandez 1" in message
        assert services.billed_days(stay) == 3

    def test_the_exact_cap_is_allowed(self, ward):
        stay = ward.admit_days_ago(9)  # 10 journées civiles
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=10,
            idempotency_key=a_key(),
        )
        assert services.billed_days(stay) == 10

    def test_the_replay_of_the_gesture_that_REACHED_the_cap_still_answers(
        self, ward
    ):
        """Leçon de la caisse (« facture déjà réglée » ne doit jamais
        masquer le rejeu de son propre reçu) : le rejeu se résout AVANT le
        plafond, sinon le geste qui a atteint le plafond ne serait plus
        rejouable — exactement le cas où le client a perdu la réponse."""
        stay = ward.admit_days_ago(1)  # 2 journées
        tariff = ward.day_tariff()
        first = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key="au-plafond",
        )
        replay = services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key="au-plafond",
        )
        assert replay.pk == first.pk and replay.was_replayed is True
        assert services.billed_days(stay) == 2

    def test_a_stay_billed_before_the_correctif_is_not_rewritten(self, ward):
        """Honnêteté sur l'existant : le plafond borne les gestes À VENIR,
        il ne supprime rien. Un séjour déjà sur-facturé garde ses actes (la
        correction est une annulation de facture, pas une réécriture
        silencieuse de l'historique) — mais il ne peut plus rien ajouter."""
        stay = ward.admit()
        tariff = ward.day_tariff()
        for _ in range(4):  # ce que l'ancien code laissait passer
            ActPerformed.objects.create(
                encounter_id=stay.encounter_id, tariff_item=tariff
            )
        assert services.billed_days(stay) == 4
        with pytest.raises(ValidationError, match="déjà facturée"):
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=tariff, days=1,
                idempotency_key=a_key(),
            )


# ---------------------------------------------------------------------------
# 7 — Audit : références et codes seuls (invariant 4)
# ---------------------------------------------------------------------------


def _payload_blob(action):
    entries = AuditLog.objects.filter(action=action)
    assert entries.exists(), action
    return " ".join(str(entry.payload) for entry in entries)


class TestAuditPayloads:
    def test_every_gesture_writes_its_entry(self, ward):
        stay = ward.admit_days_ago(2, bed=ward.bed_a)
        services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_b)
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=ward.day_tariff(), days=2,
            idempotency_key=a_key(),
        )
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        actions = set(AuditLog.objects.values_list("action", flat=True))
        assert AuditAction.STAY_ADMITTED in actions
        assert AuditAction.BED_ASSIGNED in actions
        assert AuditAction.BED_RELEASED in actions
        assert AuditAction.STAY_DAYS_BILLED in actions
        assert AuditAction.STAY_DISCHARGED in actions

    def test_the_admission_motive_is_never_journalised(self, ward):
        """Le motif d'admission est de la même classe qu'un diagnostic :
        il ne doit apparaître dans AUCUN payload d'audit."""
        secret = "Séropositivité VIH — bilan"
        ward.admit(reason=secret, diagnosis="Charge virale élevée")
        blob = " ".join(
            str(entry.payload) for entry in AuditLog.objects.all()
        )
        assert secret not in blob
        assert "Charge virale" not in blob

    def test_the_cancellation_motive_is_never_journalised(self, ward):
        stay = ward.admit()
        motive = "Confusion avec Mme Ahamada, chambre voisine"
        services.cancel_stay(actor=ward.doctor_user, stay=stay, reason=motive)
        assert motive not in _payload_blob(AuditAction.STAY_CANCELLED)
        # …mais il reste lisible sur la ligne, pour ceux qui décident.
        stay.refresh_from_db()
        assert stay.cancel_reason == motive

    def test_room_and_bed_names_never_reach_a_payload(self):
        center, director = make_center_with_director()
        room = services.create_room(
            actor=director, center=center, name="Isolement tuberculose"
        )
        services.create_bed(actor=director, room=room, name="Lit contumace")
        blob = " ".join(str(entry.payload) for entry in AuditLog.objects.all())
        assert "Isolement" not in blob
        assert "contumace" not in blob

    def test_every_stay_entry_carries_its_center(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        for action in (
            AuditAction.STAY_ADMITTED, AuditAction.BED_ASSIGNED,
            AuditAction.BED_RELEASED, AuditAction.STAY_DISCHARGED,
        ):
            entry = AuditLog.objects.filter(action=action).first()
            assert entry is not None and entry.center_id == ward.center.pk


# ---------------------------------------------------------------------------
# 8 — Configuration des chambres et des lits
# ---------------------------------------------------------------------------


class TestRoomsAndBeds:
    def test_duplicate_names_are_refused(self):
        center, director = make_center_with_director()
        services.create_room(actor=director, center=center, name="Chambre 1")
        with pytest.raises(ValidationError, match="porte déjà ce nom"):
            services.create_room(actor=director, center=center, name="Chambre 1")

    def test_the_same_room_name_may_exist_in_two_centers(self):
        first, first_director = make_center_with_director()
        second, second_director = make_center_with_director(name="Clinique 2")
        services.create_room(actor=first_director, center=first, name="Chambre 1")
        services.create_room(
            actor=second_director, center=second, name="Chambre 1"
        )
        assert Room.objects.filter(name="Chambre 1").count() == 2

    def test_a_blank_name_is_refused(self):
        center, director = make_center_with_director()
        with pytest.raises(ValidationError, match="obligatoire"):
            services.create_room(actor=director, center=center, name="   ")

    def test_bed_names_are_unique_per_room_only(self):
        center, director = make_center_with_director()
        one = services.create_room(actor=director, center=center, name="C1")
        two = services.create_room(actor=director, center=center, name="C2")
        services.create_bed(actor=director, room=one, name="Lit A")
        services.create_bed(actor=director, room=two, name="Lit A")
        with pytest.raises(ValidationError, match="porte déjà ce nom"):
            services.create_bed(actor=director, room=one, name="Lit A")


# ---------------------------------------------------------------------------
# 9 — Cloisonnement multi-tenant
# ---------------------------------------------------------------------------


class TestTenantIsolation:
    def test_querysets_never_cross_centers(self):
        mine = Ward()
        theirs = Ward()
        make_stay(center=theirs.center, bed=theirs.bed_a)
        stay = mine.admit(bed=mine.bed_a)

        assert list(Stay.objects.for_center(mine.center)) == [stay]
        assert set(Room.objects.for_center(mine.center)) == {mine.room}
        assert set(Bed.objects.for_center(mine.center)) == {
            mine.bed_a, mine.bed_b
        }
        assert [room.pk for room in services.occupancy_rows(mine.center)] == [
            mine.room.pk
        ]

    def test_the_patient_read_is_transversal(self):
        patient = make_patient()
        first = Ward(patient=patient)
        second = Ward(patient=patient)
        stay_one = first.admit(bed=first.bed_a)
        services.discharge_stay(actor=first.doctor_user, stay=stay_one)
        stay_two = second.admit(bed=second.bed_a)

        assert set(Stay.objects.for_patient(patient)) == {stay_one, stay_two}


# ---------------------------------------------------------------------------
# 10 — Fusion de doublons (invariant 5)
# ---------------------------------------------------------------------------


class TestMergeReanchorsStays:
    def test_the_stay_follows_the_canonical_profile(self):
        ward = Ward()
        duplicate = make_patient(
            first_name="Anfia", last_name="Said", created_by_center=ward.center
        )
        target = make_claimed_patient(
            first_name="Anfia", last_name="Saïd",
            created_by_center=ward.center,
        )
        stay = ward.admit(patient=duplicate, bed=ward.bed_a)

        merge_profiles(
            source=duplicate, target=target, actor=ward.director,
            center=ward.center,
        )
        stay.refresh_from_db()
        assert stay.patient_id == target.pk
        # …et l'invariant structurel tient : le pivot a suivi lui aussi.
        assert stay.encounter.patient_id == target.pk
        assert list(Stay.objects.for_patient(target)) == [stay]
        assert not Stay.objects.for_patient(duplicate).exists()
        # Le lit reste au CENTRE, rattaché au séjour.
        assert stay.current_bed == ward.bed_a

    def test_the_merge_audit_counts_the_moved_stays(self):
        ward = Ward()
        duplicate = make_patient(created_by_center=ward.center)
        target = make_patient(created_by_center=ward.center)
        ward.admit(patient=duplicate)
        merge_profiles(
            source=duplicate, target=target, actor=ward.director,
            center=ward.center,
        )
        entry = AuditLog.objects.filter(
            action=AuditAction.PATIENT_MERGED
        ).latest("id")
        assert entry.payload["stays_moved"] == 1


# ---------------------------------------------------------------------------
# 11 — Le gel commercial n'atteint JAMAIS l'hospitalisation (décision 6)
# ---------------------------------------------------------------------------


class TestTheFreezeNeverReachesTheWard:
    def test_no_module_of_the_app_imports_the_freeze_guard(self):
        """Sonde propre au module, en plus de la sonde fail-closed S5 (qui
        verrouille la liste des importeurs par égalité stricte). Elle dit
        ICI, dans le fichier du sprint, pourquoi la garde est absente."""
        import ast
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1] / "apps" / "inpatient"
        offenders = []
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                ):
                    offenders.append(path.name)
        assert not offenders, (
            "Un lit est le prérequis physique d'une admission : geler sa "
            f"configuration reviendrait à empêcher d'hospitaliser ({offenders})."
        )

    @pytest.mark.parametrize(
        "status", ["suspendu", "resilie"]
    )
    def test_a_frozen_tenant_still_admits_transfers_and_discharges(self, status):
        from .factories import make_subscription

        ward = Ward()
        make_subscription(
            center=ward.center, status=status, status_reason="Impayé."
        )
        stay = ward.admit(bed=ward.bed_a)
        services.assign_bed(actor=ward.doctor_user, stay=stay, bed=ward.bed_b)
        services.create_room(
            actor=ward.director, center=ward.center, name="Chambre 2"
        )
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.refresh_from_db()
        assert stay.status == Status.DISCHARGED


# ---------------------------------------------------------------------------
# 12 — Occupation instantanée
# ---------------------------------------------------------------------------


class TestOccupancy:
    def test_the_board_reports_free_and_occupied_beds(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        (room,) = list(services.occupancy_rows(ward.center))
        beds = {bed.name: bed for bed in room.beds.all()}
        assert set(beds) == {"Lit A", "Lit B"}
        assert [a.stay_id for a in beds["Lit A"].open_rows] == [stay.pk]
        assert beds["Lit B"].open_rows == []

    def test_it_does_not_live_in_the_piloting_stats(self):
        """Décision 6 : l'occupation sert à ADMETTRE. ``stats_views`` est du
        pilotage — gelable et aux ``assertNumQueries`` verrouillés."""
        import pathlib

        source = (
            pathlib.Path(__file__).resolve().parents[1]
            / "apps" / "centers" / "stats_views.py"
        ).read_text(encoding="utf-8")
        assert "inpatient" not in source
        assert "occupancy" not in source.lower()
