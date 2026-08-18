"""S6 « Hospitalisation » — passe adversariale (revue guardian, ADR 0019).

Ce fichier n'est pas la suite d'implémentation : il attaque le lot livré.
Chaque sonde a été vérifiée DÉTECTRICE (le défaut réintroduit, la sonde
tombe). Les axes, dans l'ordre des invariants de l'ADR :

1. **La consultation pivot** — le point le plus fragile de la décision 1 :
   le séjour délègue TOUTE sa production clinique à un `Encounter` qu'une
   autre route sait clôturer. Une clôture en vol rendait la surveillance
   d'un hospitalisé DÉFINITIVEMENT impossible, sans un mot (faille ÉLEVÉE,
   corrigée).
2. **Un seul séjour en cours** — la garde de service était transversale
   (elle disait à un centre B qu'un patient est hospitalisé ailleurs, et
   lui interdisait de l'admettre) et non sérialisée (deux admissions
   concurrentes passaient toutes les deux). Faille MOYENNE, corrigée.
3. **L'exclusivité du lit** sous courses réelles non couvertes par la suite
   d'implémentation : transferts croisés (échange de lits), transfert ×
   sortie, chambre désactivée.
4. **La segmentation R-API-1** attaquée par le cumul de casquettes entre
   centres et par les payloads de RÉPONSE des écritures.
5. **Le verrou tuteur**, fermé STRUCTURELLEMENT : la liste des modules qui
   importent ``apps.inpatient`` est close (patron de la sonde S5 du gel).
6. **L'argent** : rejeu de la facturation, course facturation × annulation.
7. **Robustesse** : filtres hostiles, listes d'ids démesurées.
"""

import ast
import pathlib
import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connections
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.common.models import ActCategory
from apps.inpatient import services
from apps.inpatient.models import Bed, BedAssignment, Stay
from apps.inpatient.serializers import StayAdminSerializer, StayPatientSerializer
from apps.medical.models import ActPerformed, Encounter, VitalSigns
from apps.medical.services import close_encounter, record_vital_signs
from apps.patients.services import merge_profiles

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_bed,
    make_patient,
    make_room,
    make_staff,
    make_subscription,
    make_tariff,
)

pytestmark = pytest.mark.django_db

Status = Stay.Status


# ---------------------------------------------------------------------------
# Scène partagée
# ---------------------------------------------------------------------------


class Ward:
    """Un service : un centre, une chambre, deux lits, un médecin, un patient."""

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
        """Admission datée : depuis le correctif du 15/08/2026, un séjour
        n'ouvre que les journées CIVILES qu'il a réellement touchées."""
        return self.admit(
            admitted_at=timezone.now() - timedelta(days=days), **kwargs
        )

    def day_tariff(self, suffix=""):
        code = f"HOSP{self.center.pk}{suffix}"
        cached = self._tariffs.get(code)
        if cached is not None:
            return cached
        tariff = make_tariff(
            self.center, code=code,
            label="Journée d'hospitalisation", price_kmf="12000",
        )
        tariff.generic_category = ActCategory.HOSPITALISATION
        tariff.save()
        self._tariffs[code] = tariff
        return tariff


@pytest.fixture
def ward():
    return Ward()


# ---------------------------------------------------------------------------
# AXE 1 — LA CONSULTATION PIVOT (faille ÉLEVÉE corrigée)
# ---------------------------------------------------------------------------


class TestThePivotCannotBeClosedUnderTheStay:
    """Le scénario le plus dangereux du lot, et il était ouvert.

    La décision 1 fait reposer TOUTE la production clinique d'un séjour sur
    un `Encounter` « ouvert du premier au dernier jour ». Mais
    `POST /centers/{c}/encounters/{pk}/close/` (S1, rôles cliniques) ne
    savait rien des séjours : un clinicien qui faisait le ménage dans sa
    liste de consultations fermait le pivot d'un patient encore couché.

    Effet : `_require_open_encounter` refusait ENSUITE toute mesure de
    surveillance, toute ordonnance et toute entrée de carnet pour ce
    patient — définitivement (aucune route ne rouvre une consultation), et
    sans qu'aucun écran ne dise pourquoi. La sortie, elle, « tolère un
    pivot déjà fermé » : rien ne signalait jamais l'accident.

    Correctif : `close_encounter` refuse le pivot d'un séjour EN COURS.
    """

    def test_the_service_refuses_to_close_the_pivot_of_a_live_stay(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        with pytest.raises(ValidationError, match="hospitalisé"):
            close_encounter(actor=ward.doctor_user, encounter=stay.encounter)
        stay.encounter.refresh_from_db()
        assert stay.encounter.status == Encounter.Status.IN_PROGRESS

    def test_the_api_route_refuses_it_too(self, ward):
        stay = ward.admit(bed=ward.bed_a)
        response = client_for(ward.doctor_user).post(
            f"/api/v1/centers/{ward.center.pk}/encounters/"
            f"{stay.encounter_id}/close/",
            {}, format="json",
        )
        assert response.status_code == 400
        assert "hospitalisé" in str(response.data)

    def test_the_surveillance_of_an_inpatient_stays_possible(self, ward):
        """La conséquence concrète : l'infirmière de 6 h du matin peut
        toujours relever une tension — c'est LA raison d'être de la
        décision 1."""
        stay = ward.admit(bed=ward.bed_a)
        client_for(ward.doctor_user).post(
            f"/api/v1/centers/{ward.center.pk}/encounters/"
            f"{stay.encounter_id}/close/",
            {}, format="json",
        )
        # Relu EN BASE, comme le ferait la requête suivante de l'infirmière.
        encounter = Encounter.objects.get(pk=stay.encounter_id)
        assert encounter.status == Encounter.Status.IN_PROGRESS
        reading = record_vital_signs(
            actor=ward.doctor_user, encounter=encounter,
            measured_by=ward.practitioner, systolic_bp=128, diastolic_bp=82,
        )
        assert VitalSigns.objects.filter(pk=reading.pk).exists()

    def test_the_discharge_still_closes_the_pivot(self, ward):
        """Non-régression : la garde ne casse pas le chemin interne — la
        sortie pose l'état terminal AVANT de clôturer."""
        stay = ward.admit(bed=ward.bed_a)
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        stay.encounter.refresh_from_db()
        assert stay.encounter.status == Encounter.Status.COMPLETED

    def test_the_cancellation_still_closes_the_pivot(self, ward):
        stay = ward.admit()
        services.cancel_stay(
            actor=ward.doctor_user, stay=stay, reason="Erreur de saisie"
        )
        stay.encounter.refresh_from_db()
        assert stay.encounter.status == Encounter.Status.COMPLETED

    def test_a_consultation_without_a_stay_closes_as_before(self, ward):
        """Contraste : la route S1 n'est pas devenue plus stricte pour tout
        le monde — une consultation ordinaire se clôture toujours."""
        from apps.medical.services import create_encounter

        encounter = create_encounter(
            actor=ward.doctor_user, center=ward.center,
            practitioner=ward.practitioner, patient=ward.patient,
            reason="Consultation simple",
        )
        close_encounter(actor=ward.doctor_user, encounter=encounter)
        encounter.refresh_from_db()
        assert encounter.status == Encounter.Status.COMPLETED

    def test_the_pivot_of_a_DISCHARGED_stay_is_no_longer_protected(self, ward):
        """La garde vise le séjour EN COURS : une fois le patient sorti, la
        consultation redevient une consultation ordinaire (déjà close ici —
        le refus est celui de S1, pas celui de S6)."""
        stay = ward.admit()
        services.discharge_stay(actor=ward.doctor_user, stay=stay)
        encounter = Encounter.objects.get(pk=stay.encounter_id)
        with pytest.raises(ValidationError, match="déjà terminée"):
            close_encounter(actor=ward.doctor_user, encounter=encounter)


# ---------------------------------------------------------------------------
# AXE 2 — « UN SEUL SÉJOUR EN COURS » (faille MOYENNE corrigée)
# ---------------------------------------------------------------------------


class TestTheSingleOngoingStayGuard:
    """La garde de l'addendum n° 5 était transversale ET non sérialisée.

    Deux défauts d'un seul tenant :

    - **fuite inter-tenant + blocage du soin** : `Stay.objects.for_patient()`
      ignore le centre. Le centre B qui recevait un patient transféré depuis
      le centre A se voyait répondre « Ce patient est déjà hospitalisé » —
      une information CLINIQUE sur l'activité d'un autre tenant (ADR 0002 :
      le staff de B ne lit pas les consultations de A), doublée d'une
      impasse : B ne peut ni voir ni clore le séjour de A. Le produit
      renvoyait le service au papier.
    - **TOCTOU** : le `exists()` n'était protégé par aucun verrou, donc deux
      admissions concurrentes du même patient passaient toutes les deux.

    Correctif : garde bornée au CENTRE + verrou de ligne sur le patient
    (hiérarchie patient → lit → séjour, disjointe de celle de l'argent).
    """

    def test_another_center_never_learns_that_the_patient_is_hospitalised(self):
        """Le transfert inter-hôpitaux, par l'API : le centre receveur doit
        pouvoir admettre — et surtout ne rien apprendre de l'épisode voisin.

        Avant le correctif, la réponse était un 400 « Ce patient est déjà
        hospitalisé : terminez le séjour en cours » : une donnée clinique
        d'un AUTRE tenant (que ce staff ne peut ni lire ni clore), et une
        impasse — le patient présent restait inadmissible.
        """
        receiving = Ward()
        patient = receiving.patient
        elsewhere = Ward(patient=patient)
        elsewhere.admit(bed=elsewhere.bed_a)

        response = client_for(receiving.doctor_user).post(
            f"/api/v1/centers/{receiving.center.pk}/inpatient/stays/",
            {
                "patient": patient.pk,
                "reason": "Transfert depuis un autre établissement",
                "bed": receiving.bed_a.pk,
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert "hospitalisé" not in str(response.data)
        assert Stay.objects.filter(
            patient=patient, status=Status.IN_PROGRESS
        ).count() == 2

    def test_the_same_center_still_refuses_a_second_live_stay(self, ward):
        ward.admit()
        with pytest.raises(ValidationError, match="déjà hospitalisé"):
            ward.admit()

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_admissions_of_the_same_patient(self):
        """Course réelle : sans verrou, les deux admissions passaient et le
        patient occupait deux lits — l'exclusivité du lit tient (contrainte
        DB), mais le tableau d'occupation comptait deux fois la personne."""
        ward = Ward()
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def runner(bed):
            def run():
                try:
                    barrier.wait()
                    outcomes.append(("ok", ward.admit(bed=bed).pk))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                finally:
                    connections.close_all()

            return run

        threads = [
            threading.Thread(target=runner(ward.bed_a)),
            threading.Thread(target=runner(ward.bed_b)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert Stay.objects.filter(
            patient=ward.patient, status=Status.IN_PROGRESS
        ).count() == 1
        assert BedAssignment.objects.filter(released_at__isnull=True).count() == 1


# ---------------------------------------------------------------------------
# AXE 3 — L'EXCLUSIVITÉ DU LIT : les courses non couvertes
# ---------------------------------------------------------------------------


class TestBedExclusivityHardCases:
    @pytest.mark.django_db(transaction=True)
    def test_two_crossed_transfers_never_leave_a_deadlock_or_a_shared_bed(self):
        """L'ÉCHANGE de lits : deux patients veulent chacun le lit de
        l'autre, au même instant.

        C'est le patron classique du verrou mortel (chacun tient ce que
        l'autre veut). Ici il est écarté par construction : le contrôle
        « lit occupé » précède la libération, donc aucun candidat n'atteint
        l'INSERT en tenant une ligne que l'autre attend. Résultat exigé :
        aucune exception technique, aucun lit partagé, aucun patient
        déshabillé de son lit au passage.
        """
        ward = Ward()
        stay_one = ward.admit(bed=ward.bed_a)
        stay_two = ward.admit(
            patient=make_patient(created_by_center=ward.center), bed=ward.bed_b
        )
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def runner(stay, bed):
            def run():
                try:
                    barrier.wait()
                    services.assign_bed(
                        actor=ward.doctor_user, stay=stay, bed=bed
                    )
                    outcomes.append(("ok", stay.pk))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                    outcomes.append(("technique", f"{type(exc).__name__}: {exc}"))
                finally:
                    connections.close_all()

            return run

        threads = [
            threading.Thread(target=runner(stay_one, ward.bed_b)),
            threading.Thread(target=runner(stay_two, ward.bed_a)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert [kind for kind, _ in outcomes if kind == "technique"] == []
        # Chaque lit porte au plus UNE occupation ouverte, chaque séjour est
        # dans exactement un lit.
        open_rows = BedAssignment.objects.filter(released_at__isnull=True)
        assert open_rows.count() == 2
        assert len({row.bed_id for row in open_rows}) == 2
        assert {row.stay_id for row in open_rows} == {stay_one.pk, stay_two.pk}

    @pytest.mark.django_db(transaction=True)
    def test_a_transfer_racing_the_discharge_of_the_bed_s_occupant(self):
        """Sortie × transfert vers le lit qu'on est en train de libérer.

        Les deux verrous ne se croisent jamais dans le même ordre (la sortie
        ne prend jamais le verrou du LIT) : pas de cycle possible. Le
        transfert perd proprement (le lit est encore occupé au moment où il
        regarde) ou gagne après la sortie — jamais une exception technique,
        jamais deux occupants.
        """
        ward = Ward()
        leaving = ward.admit(bed=ward.bed_a)
        waiting = ward.admit(
            patient=make_patient(created_by_center=ward.center)
        )
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def discharge():
            try:
                barrier.wait()
                services.discharge_stay(actor=ward.doctor_user, stay=leaving)
                outcomes.append(("sortie", "ok"))
            except Exception as exc:  # noqa: BLE001
                outcomes.append(("sortie", f"{type(exc).__name__}: {exc}"))
            finally:
                connections.close_all()

        def transfer():
            try:
                barrier.wait()
                services.assign_bed(
                    actor=ward.doctor_user, stay=waiting, bed=ward.bed_a
                )
                outcomes.append(("transfert", "ok"))
            except ValidationError as exc:
                outcomes.append(("transfert", f"refus: {exc}"))
            except Exception as exc:  # noqa: BLE001
                outcomes.append(("transfert", f"{type(exc).__name__}: {exc}"))
            finally:
                connections.close_all()

        threads = [threading.Thread(target=discharge),
                   threading.Thread(target=transfer)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        results = dict(outcomes)
        assert results["sortie"] == "ok"
        assert results["transfert"] == "ok" or results["transfert"].startswith(
            "refus:"
        )
        assert BedAssignment.objects.filter(
            bed=ward.bed_a, released_at__isnull=True
        ).count() <= 1
        leaving.refresh_from_db()
        assert leaving.status == Status.DISCHARGED

    def test_a_bed_of_a_DEACTIVATED_ROOM_never_receives_a_patient(self, ward):
        """Le lit est actif, sa CHAMBRE ne l'est plus (dératisation,
        travaux) : le service ET le modèle refusent."""
        ward.room.is_active = False
        ward.room.save(update_fields=["is_active"])
        stay = ward.admit()
        with pytest.raises(ValidationError, match="n'est pas disponible"):
            services.assign_bed(
                actor=ward.doctor_user, stay=stay, bed=ward.bed_a
            )
        with pytest.raises(ValidationError, match="n'est pas disponible"):
            BedAssignment.objects.create(
                stay=stay, bed=ward.bed_a, assigned_at=timezone.now(),
                assigned_by=ward.doctor_user,
            )
        assert ward.bed_a not in list(
            Bed.objects.for_center(ward.center).available()
        )

    def test_the_api_refuses_a_bed_of_another_center_in_the_body(self, ward):
        other = Ward()
        stay = ward.admit()
        response = client_for(ward.doctor_user).post(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{stay.pk}/bed/",
            {"bed": other.bed_a.pk}, format="json",
        )
        assert response.status_code == 400
        # Message IDENTIQUE à celui d'un lit inexistant : aucun oracle.
        ghost = client_for(ward.doctor_user).post(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{stay.pk}/bed/",
            {"bed": 9_999_999}, format="json",
        )
        assert str(ghost.data) == str(response.data)


# ---------------------------------------------------------------------------
# AXE 4 — SEGMENTATION R-API-1 : le cumul de casquettes
# ---------------------------------------------------------------------------


class TestClinicalSegmentationUnderDualHats:
    def test_a_director_who_is_a_doctor_ELSEWHERE_reads_no_clinical_here(self):
        """Le cumul élargit dans SON centre, jamais d'un centre à l'autre.

        Le directeur du centre A est aussi médecin au centre B (cas réel :
        un praticien propriétaire). Sa casquette clinique de B ne doit pas
        déteindre sur ses lectures de A.
        """
        ward = Ward()
        elsewhere, _ = make_center_with_director()
        make_staff(user=ward.director, center=elsewhere, role=Role.DOCTOR)
        stay = ward.admit(bed=ward.bed_a)
        services.cancel_stay(
            actor=ward.doctor_user, stay=stay, reason="Erreur de guichet"
        )

        base = f"/api/v1/centers/{ward.center.pk}/inpatient"
        client = client_for(ward.director)
        detail = client.get(f"{base}/stays/{stay.pk}/")
        assert detail.status_code == 200
        assert {"reason", "diagnosis", "cancel_reason"}.isdisjoint(detail.data)
        listed = client.get(f"{base}/stays/?all=true")
        assert {"reason", "diagnosis", "cancel_reason"}.isdisjoint(
            listed.data["results"][0]
        )
        board = client.get(f"{base}/occupancy/")
        assert "Poussée hypertensive" not in str(board.data)
        # …et la trace des transferts lui reste fermée (clinique seule).
        assert client.get(
            f"{base}/stays/{stay.pk}/bed-assignments/"
        ).status_code == 403

    def test_the_billing_response_payload_is_administrative(self, ward):
        """Le payload de RÉPONSE d'une écriture suit la casquette de son
        auteur : un caissier qui facture des journées ne doit pas récupérer
        le motif d'admission dans l'accusé de réception."""
        cashier = make_staff_user(ward.center, role=Role.CASHIER)
        stay = ward.admit_days_ago(2)
        tariff = ward.day_tariff()
        response = client_for(cashier).post(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{stay.pk}"
            f"/bill-days/",
            {"tariff": tariff.pk, "days": 2, "idempotency_key": "accusé"},
            format="json",
        )
        assert response.status_code == 200
        assert {"reason", "diagnosis", "cancel_reason"}.isdisjoint(response.data)
        assert "Poussée hypertensive" not in str(response.data)

    def test_the_administrative_serializer_is_closed_by_construction(self):
        """Sonde FAIL-CLOSED : le jour où quelqu'un ajoutera un champ
        clinique au séjour, il devra le retirer ici EXPLICITEMENT."""
        admin_fields = set(StayAdminSerializer().fields)
        assert {"reason", "diagnosis", "cancel_reason"}.isdisjoint(admin_fields)
        assert admin_fields == {
            "id", "patient", "patient_name", "encounter", "admitted_at",
            "discharged_at", "status", "priority", "bed", "attending",
            "billed_days", "created_at",
        }
        patient_fields = set(StayPatientSerializer().fields)
        assert patient_fields == {
            "id", "center", "center_name", "encounter", "admitted_at",
            "discharged_at", "status",
        }

    def test_no_refusal_message_of_the_module_ever_quotes_a_motive(self, ward):
        """Les messages d'erreur sont une fenêtre : aucun ne recopie le
        motif d'admission ni le motif d'annulation."""
        stay = ward.admit(bed=ward.bed_a)
        secretary = make_staff_user(ward.center, role=Role.SECRETARY)
        base = f"/api/v1/centers/{ward.center.pk}/inpatient"
        refusals = [
            client_for(secretary).post(
                f"{base}/stays/{stay.pk}/discharge/", {}, format="json"
            ),
            client_for(secretary).post(
                f"{base}/stays/{stay.pk}/cancel/",
                {"reason": "peu importe"}, format="json",
            ),
            client_for(ward.doctor_user).post(
                f"{base}/stays/",
                {"patient": ward.patient.pk, "reason": "Autre motif"},
                format="json",
            ),
        ]
        for response in refusals:
            assert response.status_code in (400, 403)
            assert "Poussée hypertensive" not in str(response.data)


# ---------------------------------------------------------------------------
# AXE 5 — LE VERROU TUTEUR, FERMÉ STRUCTURELLEMENT
# ---------------------------------------------------------------------------


class TestNothingOfS6EverReachesAGuardian:
    #: Les SEULS fichiers hors de l'app autorisés à connaître le module
    #: (patron de la sonde fail-closed du gel, S5). Un sérialiseur ou une
    #: vue tuteur qui importerait ``Stay`` un jour fera tomber la suite.
    ALLOWED_IMPORTERS = {
        "patients/services.py",       # fusion de doublons (invariant 5)
        "medical/services.py",        # garde « pivot d'un séjour en cours »
        "accounts/management/commands/seed_demo.py",
        # SV (16/08/2026, extension CONSCIENTE) : l'export RGPD art. 20
        # gagne la clé `stays` — fenêtre PATIENT (`StayPatientSerializer`)
        # dans le bloc PATIENT seul. Le verrou tuteur tient : le bloc
        # tuteur de l'export ne touche pas ce module, et le test « widest
        # consent » ci-dessous balaie l'export tuteur par le CONTENU.
        "accounts/export.py",
    }

    def test_the_list_of_modules_that_know_the_ward_is_closed(self):
        root = pathlib.Path(__file__).resolve().parents[1] / "apps"
        offenders = set()
        for path in root.rglob("*.py"):
            relative = path.relative_to(root).as_posix()
            if relative.startswith("inpatient/"):
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                module = getattr(node, "module", None) or ""
                if isinstance(node, ast.ImportFrom) and "inpatient" in module:
                    offenders.add(relative)
                if isinstance(node, ast.Import) and any(
                    "inpatient" in alias.name for alias in node.names
                ):
                    offenders.add(relative)
        assert offenders == self.ALLOWED_IMPORTERS, (
            "Un module hors de l'app connaît l'hospitalisation. Si c'est une "
            "vue ou un sérialiseur TUTEUR, le verrou de sprint (ADR 0016) "
            f"vient de tomber : {offenders}"
        )

    def test_a_guardian_with_the_widest_consent_reads_nothing_of_the_stay(self):
        """Balayage par le CONTENU, pas par les clés : les noms de chambre,
        de lit et le motif d'admission ne doivent apparaître dans AUCUN
        octet servi à un tuteur — y compris son export RGPD."""
        from apps.medical.models import Consent

        ward = Ward(patient=make_claimed_patient(
            first_name="Anfia", last_name="Saïd",
        ))
        # Le patient est connu du centre par sa consultation d'admission.
        stay = ward.admit(bed=ward.bed_a)
        guardian_user, guardian = make_guardian_user()
        link = make_active_link(guardian, ward.patient)
        Consent.objects.create(
            patient=ward.patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        client = client_for(guardian_user)
        payloads = [
            str(client.get("/api/v1/guardian/proteges/").data),
            str(client.get("/api/v1/guardian/links/").data),
            str(client.get("/api/v1/guardian/payment-requests/").data),
            str(client.get("/api/v1/auth/me/export/").data),
        ]
        haystack = " ".join(payloads)
        for needle in (
            "Chambre 1", "Lit A", "Poussée hypertensive", "en_cours",
            "admitted_at", "stays",
        ):
            assert needle not in haystack, needle
        assert stay.status == Status.IN_PROGRESS  # le séjour existe bien


# ---------------------------------------------------------------------------
# AXE 6 — L'ARGENT : rejeu et concurrence sur les journées
# ---------------------------------------------------------------------------


class TestBillingTheDaysAdversarially:
    def test_a_replayed_billing_gesture_NEVER_doubles_the_days(self, ward):
        """SONDE CONVERTIE — elle documentait une faille, elle verrouille
        désormais sa fermeture (correctif PO du 15/08/2026).

        Ce qu'elle disait avant : `bill-days/` n'avait aucun jeton
        d'idempotence, un double-clic posait 2 × N actes, et
        `create_invoice` sans ``act_ids`` réclamait ensuite TOUS les actes
        de la consultation — la créance doublée partait pour de vrai vers
        un patient.

        Ce qu'elle dit maintenant : le jeton est OBLIGATOIRE et le rejeu à
        l'identique répond 200 avec le MÊME état — aucun acte de plus,
        aucune entrée d'audit de plus, et la facture qui suit ne réclame
        que ce qui a été soigné.
        """
        stay = ward.admit_days_ago(3)
        tariff = ward.day_tariff()
        url = (
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{stay.pk}"
            f"/bill-days/"
        )
        body = {"tariff": tariff.pk, "days": 3, "idempotency_key": "double-clic"}
        first = client_for(ward.director).post(url, body, format="json")
        second = client_for(ward.director).post(url, body, format="json")
        assert (first.status_code, second.status_code) == (200, 200)
        assert first.data["billed_days"] == second.data["billed_days"] == 3
        assert ActPerformed.objects.filter(encounter=stay.encounter).count() == 3
        assert (
            AuditLog.objects.filter(action="stay.days_billed").count() == 1
        )
        # …et sans jeton, la requête n'existe même plus.
        naked = client_for(ward.director).post(
            url, {"tariff": tariff.pk, "days": 3}, format="json"
        )
        assert naked.status_code == 400
        assert "idempotency_key" in naked.data

    def test_the_billed_days_ARE_bounded_by_the_length_of_the_stay(self, ward):
        """SONDE CONVERTIE — elle prouvait que 200 journées étaient
        facturables sur un séjour d'une heure (rien ne reliait le nombre de
        journées à la durée réelle : 366 par geste était la seule borne).

        Règle produit retenue par le PO : **toute journée civile entamée
        sous le toit du centre est facturable, et pas une de plus** (heure
        des Comores). Un séjour du jour ouvre donc 1 journée — une
        hospitalisation de quatre heures se facture, mais une fois.
        """
        stay = ward.admit()
        assert services.billable_days_cap(stay) == 1
        with pytest.raises(ValidationError) as excinfo:
            services.bill_stay_days(
                actor=ward.director, stay=stay, tariff=ward.day_tariff(),
                days=200, idempotency_key="deux-cents-journees",
            )
        assert "ouvre 1 journée(s) facturable(s)" in str(excinfo.value)
        assert services.billed_days(stay) == 0
        assert (timezone.now() - stay.admitted_at) < timedelta(days=1)

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_billings_with_the_SAME_key_post_the_acts_once(self):
        """Course réelle sur le jeton : deux threads, deux transactions,
        une seule facturation. Le verrou de ligne du séjour sérialise les
        candidats — le perdant relit le lot du gagnant et le renvoie."""
        ward = Ward()
        stay = ward.admit_days_ago(3)
        tariff = ward.day_tariff()
        barrier = threading.Barrier(2, timeout=10)
        results, errors = [], []

        def attempt(actor):
            try:
                barrier.wait()
                billing = services.bill_stay_days(
                    actor=actor, stay=stay, tariff=tariff, days=2,
                    idempotency_key="course-reelle",
                )
                results.append(
                    (billing.pk, getattr(billing, "was_replayed", False))
                )
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(f"{type(exc).__name__}: {exc}")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(actor,))
            for actor in (ward.director, ward.doctor_user)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert errors == []
        assert len(results) == 2
        assert len({pk for pk, _ in results}) == 1  # LE même lot pour les deux
        assert sorted(replayed for _, replayed in results) == [False, True]
        assert ActPerformed.objects.filter(encounter=stay.encounter).count() == 2
        assert AuditLog.objects.filter(action="stay.days_billed").count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_billings_never_exceed_the_cap_together(self):
        """L'autre course, celle du plafond : deux gestes DISTINCTS (clés
        différentes) qui, additionnés, dépasseraient la durée du séjour.
        Un seul doit passer — sinon le plafond ne serait qu'une opinion."""
        ward = Ward()
        stay = ward.admit_days_ago(1)  # 2 journées ouvertes
        tariff = ward.day_tariff()
        barrier = threading.Barrier(2, timeout=10)
        outcomes, errors = [], []

        def attempt(key):
            try:
                barrier.wait()
                services.bill_stay_days(
                    actor=ward.director, stay=stay, tariff=tariff, days=2,
                    idempotency_key=key,
                )
                outcomes.append("facturé")
            except ValidationError:
                outcomes.append("refusé")
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(f"{type(exc).__name__}: {exc}")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(key,))
            for key in ("lot-a", "lot-b")
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert errors == []
        assert sorted(outcomes) == ["facturé", "refusé"]
        assert services.billed_days(stay) == 2
        assert ActPerformed.objects.filter(encounter=stay.encounter).count() == 2

    @pytest.mark.django_db(transaction=True)
    def test_billing_racing_the_cancellation_of_the_stay(self):
        """Course facturation × annulation : les deux gestes se sérialisent
        sur la ligne du séjour, et les deux issues sont cohérentes —
        JAMAIS un séjour annulé qui porte des journées facturées."""
        ward = Ward()
        stay = ward.admit_days_ago(2)
        tariff = ward.day_tariff()
        barrier = threading.Barrier(2, timeout=10)
        outcomes = {}

        def bill():
            try:
                barrier.wait()
                services.bill_stay_days(
                    actor=ward.director, stay=stay, tariff=tariff, days=2,
                    idempotency_key="course-annulation",
                )
                outcomes["bill"] = "ok"
            except ValidationError as exc:
                outcomes["bill"] = f"refus: {exc}"
            except Exception as exc:  # noqa: BLE001
                outcomes["bill"] = f"{type(exc).__name__}: {exc}"
            finally:
                connections.close_all()

        def cancel():
            try:
                barrier.wait()
                services.cancel_stay(
                    actor=ward.doctor_user, stay=stay, reason="Erreur de saisie"
                )
                outcomes["cancel"] = "ok"
            except ValidationError as exc:
                outcomes["cancel"] = f"refus: {exc}"
            except Exception as exc:  # noqa: BLE001
                outcomes["cancel"] = f"{type(exc).__name__}: {exc}"
            finally:
                connections.close_all()

        threads = [threading.Thread(target=bill), threading.Thread(target=cancel)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert not any(
            value.startswith(("OperationalError", "IntegrityError"))
            for value in outcomes.values()
        ), outcomes
        stay.refresh_from_db()
        acts = ActPerformed.objects.filter(encounter=stay.encounter).count()
        if stay.status == Status.CANCELLED:
            assert acts == 0, "un séjour annulé ne porte jamais de journées"
        else:
            assert stay.status == Status.IN_PROGRESS and acts == 2

    def test_billing_a_stay_of_another_center_through_my_url_is_a_404(self):
        ward = Ward()
        other = Ward()
        foreign = other.admit()
        response = client_for(ward.director).post(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{foreign.pk}"
            f"/bill-days/",
            {
                "tariff": ward.day_tariff().pk,
                "days": 1,
                "idempotency_key": "tentative-inter-centres",
            },
            format="json",
        )
        assert response.status_code == 404
        assert ActPerformed.objects.filter(
            encounter=foreign.encounter
        ).count() == 0

    def test_the_audit_of_a_billing_never_carries_the_tariff_label(self, ward):
        stay = ward.admit_days_ago(2)
        tariff = ward.day_tariff()
        services.bill_stay_days(
            actor=ward.director, stay=stay, tariff=tariff, days=2,
            idempotency_key="Clé de Mme Ahamada, chambre 3",
        )
        entry = AuditLog.objects.get(action="stay.days_billed")
        assert "Journée d'hospitalisation" not in str(entry.payload)
        # Le jeton d'idempotence est du TEXTE LIBRE écrit par un client :
        # il reste hors du payload d'audit, au même titre qu'un motif.
        assert "Ahamada" not in str(entry.payload)
        assert set(entry.payload) == {
            "stay_id", "patient_id", "center_id", "encounter_id",
            "tariff_id", "days", "billing_id",
        }


# ---------------------------------------------------------------------------
# AXE 7 — ROBUSTESSE DES ENTRÉES HOSTILES
# ---------------------------------------------------------------------------


class TestHostileInputs:
    def test_a_giant_patient_filter_never_crashes_the_ward_board(self, ward):
        """Un id de patient hors bornes SQL doit répondre 400 (ou une liste
        vide) — jamais un 500 : c'est une porte de déni de service ouverte à
        n'importe quelle secrétaire."""
        response = client_for(ward.director).get(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/"
            f"?patient=99999999999999999999999"
        )
        assert response.status_code in (200, 400)

    def test_the_attending_refusal_gives_no_oracle(self, ward):
        """Un membership ÉTRANGER et un id INEXISTANT répondent le même
        message, octet pour octet (norme S1)."""
        other = Ward()
        foreign = other.doctor_user.staff_memberships.get(center=other.center)
        base = f"/api/v1/centers/{ward.center.pk}/inpatient/stays/"
        body = {"patient": ward.patient.pk, "reason": "Motif"}
        strange = client_for(ward.doctor_user).post(
            base, {**body, "attending": [foreign.pk]}, format="json"
        )
        ghost = client_for(ward.doctor_user).post(
            base, {**body, "attending": [9_999_999]}, format="json"
        )
        assert strange.status_code == ghost.status_code == 400
        assert str(strange.data) == str(ghost.data)


# ---------------------------------------------------------------------------
# AXE 8 — FUSION DE DOUBLONS : le cas des DEUX hospitalisés
# ---------------------------------------------------------------------------


class TestMergeOfTwoHospitalisedDuplicates:
    def test_the_merge_may_reunite_two_live_stays_VIGILANCE(self):
        """CONSTAT HONNÊTE (vigilance non bloquante).

        La garde « un seul séjour en cours » vit dans le service
        d'admission ; la fusion, elle, ré-ancre les séjours sans la
        rejouer. Deux doublons hospitalisés en même temps (exactement ce
        qu'une fusion vient réparer) laissent donc le profil canonique avec
        deux séjours ouverts.

        Ne PAS bloquer la fusion est le bon arbitrage : refuser
        réunifierait moins bien un carnet qu'elle ne protège d'une anomalie
        visible au tableau d'occupation (deux lits, deux séjours). Consigné
        en SV — le remède serait une sortie automatique, donc une décision
        clinique que le code n'a pas à prendre.
        """
        ward = Ward()
        duplicate = make_patient(
            first_name="Anfia", last_name="Said", created_by_center=ward.center
        )
        canonical = ward.patient
        first = ward.admit(patient=canonical, bed=ward.bed_a)
        second = ward.admit(patient=duplicate, bed=ward.bed_b)
        merge_profiles(
            actor=ward.director, center=ward.center,
            source=duplicate, target=canonical,
        )
        first.refresh_from_db()
        second.refresh_from_db()
        assert second.patient_id == canonical.pk  # invariant 5 : le séjour suit
        assert Stay.objects.filter(
            patient=canonical, status=Status.IN_PROGRESS
        ).count() == 2


# ---------------------------------------------------------------------------
# AXE 9 — LE GEL, ENCORE : la facturation des journées d'un centre gelé
# ---------------------------------------------------------------------------


class TestTheFrozenTenantStillBillsItsDays:
    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_billing_the_days_survives_the_freeze(self, status):
        """La facturation des journées est de la CAISSE, jamais de
        l'administratif : elle doit passer sur un centre gelé (sinon le
        centre soigne sans pouvoir facturer, ce qui reviendrait à le punir
        deux fois)."""
        ward = Ward()
        make_subscription(
            center=ward.center, status=status, status_reason="Impayé."
        )
        stay = ward.admit_days_ago(2, bed=ward.bed_a)
        tariff = ward.day_tariff()
        response = client_for(ward.director).post(
            f"/api/v1/centers/{ward.center.pk}/inpatient/stays/{stay.pk}"
            f"/bill-days/",
            {"tariff": tariff.pk, "days": 2, "idempotency_key": "gel-lot-1"},
            format="json",
        )
        assert response.status_code == 200, response.data
        assert response.data["billed_days"] == 2
        invoice = client_for(ward.director).post(
            f"/api/v1/centers/{ward.center.pk}/invoices/",
            {"encounter": stay.encounter_id}, format="json",
        )
        assert invoice.status_code == 201
        assert invoice.data["total_kmf"] == "24000.00"

    def test_the_surveillance_of_a_frozen_tenant_s_inpatient_continues(self):
        ward = Ward()
        make_subscription(
            center=ward.center, status="suspendu", status_reason="Impayé."
        )
        stay = ward.admit(bed=ward.bed_a)
        reading = record_vital_signs(
            actor=ward.doctor_user, encounter=stay.encounter,
            measured_by=ward.practitioner, temperature_c=Decimal("38.4"),
        )
        assert reading.pk is not None

    @pytest.mark.parametrize("kyc", ["en_attente", "suspendu"])
    def test_the_KYC_gate_never_closes_the_ward_either(self, kyc):
        """L'autre axe de sanction (ADR 0017) : le KYC ferme le RAIL
        DIASPORA, jamais le lit. Un centre dont le dossier est suspendu
        continue d'admettre, de transférer et de faire sortir — et de
        facturer localement."""
        ward = Ward()
        ward.center.kyc_status = kyc
        ward.center.kyc_reason = "Pièces illisibles."
        ward.center.save(update_fields=["kyc_status", "kyc_reason"])
        base = f"/api/v1/centers/{ward.center.pk}/inpatient"
        admission = client_for(ward.doctor_user).post(
            f"{base}/stays/",
            {
                "patient": ward.patient.pk,
                "reason": "Paludisme grave",
                "bed": ward.bed_a.pk,
                "admitted_at": (timezone.now() - timedelta(days=2)).isoformat(),
            },
            format="json",
        )
        assert admission.status_code == 201, admission.data
        stay_pk = admission.data["id"]
        moved = client_for(ward.doctor_user).post(
            f"{base}/stays/{stay_pk}/bed/", {"bed": ward.bed_b.pk},
            format="json",
        )
        assert moved.status_code == 200
        billed = client_for(ward.director).post(
            f"{base}/stays/{stay_pk}/bill-days/",
            {
                "tariff": ward.day_tariff().pk,
                "days": 2,
                "idempotency_key": "kyc-lot-1",
            },
            format="json",
        )
        assert billed.status_code == 200
        out = client_for(ward.doctor_user).post(
            f"{base}/stays/{stay_pk}/discharge/", {}, format="json"
        )
        assert out.status_code == 200


# ---------------------------------------------------------------------------
# AXE 10 — L'AUDIT : aucun texte libre, sur AUCUNE des sept actions
# ---------------------------------------------------------------------------


class TestNoFreeTextEverEntersAnS6Payload:
    #: Longueur au-delà de laquelle une valeur de payload n'est plus un code
    #: mais une phrase (les codes du module font au plus 8 caractères).
    MAX_CODE_LENGTH = 24

    def test_a_complete_hospitalisation_journalises_references_only(self):
        """Scénario COMPLET (chambre → lit → admission → transfert →
        journées → annulation), puis balayage de TOUTES les valeurs de
        TOUS les payloads S6 : que des entiers, des booléens et des codes
        courts. Un motif, un libellé de tarif ou un nom de lit qui
        arriverait demain dans un payload fait tomber cette sonde.
        """
        ward = Ward()
        motive = "Suspicion de tuberculose pulmonaire — isolement"
        room = services.create_room(
            actor=ward.director, center=ward.center, name="Isolement Sud"
        )
        bed = services.create_bed(
            actor=ward.director, room=room, name="Lit Isolement 1"
        )
        stay = ward.admit(reason=motive, bed=ward.bed_a)
        services.assign_bed(actor=ward.doctor_user, stay=stay, bed=bed)
        services.release_bed(actor=ward.doctor_user, stay=stay)
        services.cancel_stay(
            actor=ward.doctor_user, stay=stay,
            reason="Le patient a refusé l'hospitalisation, retour à domicile",
        )
        second = ward.admit_days_ago(2, reason=motive)
        services.bill_stay_days(
            actor=ward.director, stay=second, tariff=ward.day_tariff(), days=2,
            idempotency_key="balayage-audit",
        )
        services.discharge_stay(actor=ward.doctor_user, stay=second)

        entries = AuditLog.objects.filter(
            action__in=[
                "room.created", "bed.created", "stay.admitted",
                "stay.discharged", "stay.cancelled", "stay.days_billed",
                "bed.assigned", "bed.released",
            ]
        )
        assert entries.count() >= 8
        for entry in entries:
            assert entry.center_id == ward.center.pk
            for key, value in entry.payload.items():
                assert isinstance(value, (int, bool, str)), (key, value)
                if isinstance(value, str):
                    assert len(value) <= self.MAX_CODE_LENGTH, (key, value)
                    assert " " not in value, (key, value)
