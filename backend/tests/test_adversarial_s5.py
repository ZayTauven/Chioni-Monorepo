"""S5 — passe adversariale guardian sur « Abonnement & Support ».

Probes pérennes (patron de ``test_adversarial_s1`` → ``_s4``) sur les trois
lots : gel administratif, registre SaaS, canal de support, séparation des
pouvoirs et fermeture des admins. Chaque classe documente l'attaque qu'elle
verrouille.

**Failles confirmées et corrigées par cette passe** (les probes restent en
régression) :

1. ``TestOperatorReactivationNeverMintsTenantRights`` — ÉLEVÉ. La garde de
   séparation des pouvoirs ``_refuse_platform_operator_as_director``
   (correctif guardian S4) ne regarde que les lignes d'exploitant ACTIVES,
   et ``update_platform_staff`` ne rejouait AUCUNE garde. Un ``admin``
   plateforme désactivait un exploitant, l'amorçait DIRECTEUR d'un centre
   par ``POST /platform/centers/{pk}/directors/`` (la garde ne voyait plus
   de ligne active), puis le réactivait : l'état interdit — une même
   personne portant la 4ᵉ casquette ET une casquette de tenant — était
   atteint **en trois appels du back-office, sans second numéro**, c'est-à
   -dire exactement l'escalade que S4 avait passé une revue à fermer. Le
   correctif : réactiver une ligne d'exploitant rejoue la garde de
   création.
2. ``TestSeparationOfDutiesUnderRealThreads`` — MOYEN. Les deux gardes en
   miroir lisaient chacune l'autre table SANS verrou : deux transactions
   concurrentes (créer l'exploitant / amorcer le directeur) sur le MÊME
   numéro passaient toutes les deux et atteignaient l'état interdit. Le
   correctif sérialise les deux gardes sur la ligne ``User``, qui est le
   sommet de la hiérarchie de verrous du produit depuis S4.
3. ``TestRemindersNeverDoubleFire`` — MOYEN. Le compteur anti-doublon des
   relances SaaS (``reminders_sent``) était incrémenté SANS verrou de
   ligne : deux exécutions qui se chevauchent lisaient toutes deux « zéro
   relance envoyée » et le directeur recevait DEUX fois le SMS — le
   premier du produit qui porte un MONTANT à un membre du personnel — le
   compteur retombant à 1, donc la cadence « trois puis silence »
   dépassable. Correctif : relecture sous ``FOR UPDATE``, avec le solde et
   le statut relus au passage (une facture réglée entre-temps ne relance
   plus et ne brûle pas de message).
4. ``TestTwoConcurrentDemotionsSerialiseInsteadOfDeadlocking`` — FAIBLE
   (disponibilité). ``update_platform_staff`` verrouillait la ligne visée
   PUIS l'ensemble ordonné des sièges ``admin`` qui la contient : deux
   rétrogradations simultanées prenaient les mêmes verrous en ordre
   inverse et PostgreSQL tranchait par un deadlock — un 500 sur une route
   de gouvernance au lieu du refus français prévu. Correctif : ordre de
   verrous canonique **utilisateur → sièges → ligne visée**.

Le reste des classes VÉRIFIE (et verrouille) ce qui tenait déjà : le gel
qui n'empêche jamais de soigner — y compris par cascade et par
**construction** (liste fermée des modules et des fonctions qui
connaissent la garde) —, l'étanchéité des deux registres DANS LES DEUX
SENS, l'argent SaaS sous fils réels, le support comme canal non
exfiltrant, et l'admin Django refermé de bout en bout.
"""

import threading
from datetime import timedelta
from itertools import count
from decimal import Decimal
from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.utils import timezone
from PIL import Image

from apps.accounts.models import PlatformStaff
from apps.accounts.services import create_platform_staff, update_platform_staff
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing import services as billing_services
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPaymentReversal,
)
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS
from apps.centers.models import StaffMembership
from apps.centers.services import add_center_director, add_staff_member
from apps.medical import services as medical_services
from apps.patients import services as patient_services
from apps.scheduling import services as scheduling_services
from apps.support import services as support_services
from apps.support.models import SupportAttachment, SupportMessage, SupportTicket
from apps.trustbridge import services as tb_services
from apps.trustbridge.models import (
    CashPayment,
    CashReceipt,
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    Receipt,
)

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .trustbridge_helpers import build_scenario
from .factories import (
    make_center,
    make_patient,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_subscription_invoice,
    make_support_ticket,
    make_tariff,
    make_user,
)

pytestmark = pytest.mark.django_db

Status = CenterSubscription.Status
InvoiceStatus = SubscriptionInvoice.Status
PLATFORM_ADMIN = PlatformStaff.Role.ADMIN
PLATFORM_SUPPORT = PlatformStaff.Role.SUPPORT


_km_phone = count(3440100)


def km_user():
    """A user whose phone is a REAL comorian number.

    ``make_user`` mints ``+269321000NN`` (8 digits after the prefix), which
    ``normalize_phone`` rejects — every probe that goes through a
    phone-referenced door (amorçage d'un directeur, création d'un
    exploitant) needs a number the E.164/KM parser accepts.
    """
    return make_user(phone=f"+269{next(_km_phone)}")


def operator(role=PLATFORM_ADMIN, user=None):
    """A Chioni operator user (the fourth hat)."""
    user, _row = make_platform_staff(user=user or km_user(), role=role)
    return user


def operator_row(role=PLATFORM_SUPPORT):
    """(user, PlatformStaff) with a phone-referencable account."""
    return make_platform_staff(user=km_user(), role=role)


def png_upload(name="capture.png"):
    """A real 4×4 PNG — the ADR 0014 pipeline decodes the BYTES."""
    buffer = BytesIO()
    Image.new("RGB", (4, 4), "white").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


# ---------------------------------------------------------------------------
# 1. ÉLEVÉ — la 4ᵉ casquette reprise APRÈS avoir minté une casquette de tenant
# ---------------------------------------------------------------------------


class TestOperatorReactivationNeverMintsTenantRights:
    """L'escalade en sandwich : désactiver, amorcer, réactiver.

    S4 avait fermé « un exploitant s'amorce directeur et lit le registre
    patients » avec ``_refuse_platform_operator_as_director``. Cette garde
    ne connaît que les lignes d'exploitant ACTIVES — et
    ``update_platform_staff`` (S5 lot 3) ne rejouait rien du tout. Le
    back-office pouvait donc reconstituer l'état interdit tout seul.

    La limitation honnête de l'ADR (« contournable avec un SECOND numéro »)
    est une autre affaire : elle force une identité DISTINCTE, tracée. Ici
    c'est le MÊME compte, en self-service.
    """

    def _sandwich(self, api, row, center, phone):
        assert api.patch(
            f"/api/v1/platform/operators/{row.pk}/",
            {"is_active": False}, format="json",
        ).status_code == 200
        seeded = api.post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": phone}, format="json",
        )
        return seeded, api.patch(
            f"/api/v1/platform/operators/{row.pk}/",
            {"is_active": True}, format="json",
        )

    def test_the_deactivate_seed_reactivate_sandwich_is_refused(self):
        admin = operator()
        target_user, row = operator_row()
        center = make_center(name="Clinique convoitée")
        api = client_for(admin)

        seeded, reactivated = self._sandwich(api, row, center, target_user.phone)

        # L'amorçage passe (la ligne d'exploitant n'est plus active) : c'est
        # la porte de secours de Chioni, et elle reste ouverte.
        assert seeded.status_code == 201
        # La REPRISE de la casquette, elle, est refusée.
        assert reactivated.status_code == 400
        row.refresh_from_db()
        assert row.is_active is False
        # L'état interdit n'existe nulle part.
        assert not (
            PlatformStaff.objects.filter(user=target_user, is_active=True).exists()
            and StaffMembership.objects.filter(
                user=target_user, is_active=True
            ).exists()
        )

    def test_the_refusal_says_what_to_do(self):
        admin = operator()
        target_user, row = operator_row()
        center = make_center()
        api = client_for(admin)
        _seeded, reactivated = self._sandwich(api, row, center, target_user.phone)
        body = str(reactivated.json())
        assert "compte distinct" in body

    def test_the_escalated_account_never_reads_a_patient_registry(self):
        """La conséquence concrète, mesurée sur la donnée : le compte visé
        ne doit pas pouvoir ouvrir le registre patients du centre AVEC sa
        casquette Chioni reprise."""
        admin = operator()
        target_user, row = operator_row()
        center = make_center()
        patient_services.create_patient_at_center(
            actor=admin, center=center, first_name="Mariama",
            last_name="Abdallah", sex="F",
        )
        api = client_for(admin)
        self._sandwich(api, row, center, target_user.phone)
        row.refresh_from_db()
        assert row.is_active is False
        # Il reste directeur du centre (l'amorçage a bien eu lieu), mais il
        # n'est plus exploitant Chioni : la CUMULATION est ce qui est fermé.
        me = client_for(target_user).get("/api/v1/auth/me/")
        assert me.status_code == 200
        assert me.json().get("platform_staff") is None

    def test_a_role_change_on_a_double_hatted_operator_is_still_possible(self):
        """La porte du TENANT reste ouverte (ADR 0018 lot 3 §19) : un
        directeur embauche qui il veut, et le back-office peut encore
        changer le rôle d'un exploitant dans cette situation. Seule la
        REPRISE d'une casquette révoquée est fermée — elle vaut création.
        """
        admin = operator()
        target_user, row = operator_row()
        center, director = make_center_with_director()
        add_staff_member(
            actor=director, center=center, phone=target_user.phone,
            role=Role.NURSE,
        )
        response = client_for(admin).patch(
            f"/api/v1/platform/operators/{row.pk}/",
            {"role": PLATFORM_ADMIN}, format="json",
        )
        assert response.status_code == 200
        row.refresh_from_db()
        assert row.role == PLATFORM_ADMIN and row.is_active is True

    def test_reactivation_of_an_operator_with_no_tenant_hat_still_works(self):
        admin = operator()
        _target_user, row = operator_row()
        api = client_for(admin)
        api.patch(
            f"/api/v1/platform/operators/{row.pk}/",
            {"is_active": False}, format="json",
        )
        response = api.patch(
            f"/api/v1/platform/operators/{row.pk}/",
            {"is_active": True}, format="json",
        )
        assert response.status_code == 200
        row.refresh_from_db()
        assert row.is_active is True


# ---------------------------------------------------------------------------
# 2. MOYEN — la course entre les deux gardes en miroir
# ---------------------------------------------------------------------------


class TestSeparationOfDutiesUnderRealThreads:
    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_doors_never_reach_the_forbidden_state(self):
        """Fils réels, MÊME numéro : d'un côté « donne-lui la 4ᵉ casquette »,
        de l'autre « amorce-le directeur ». Chaque garde lisait l'autre
        table sans verrou, donc chacune voyait un monde où l'autre écriture
        n'existait pas encore — et les deux passaient.

        Le compte pivot est pré-créé pour que la course porte sur les
        GARDES, pas sur ``get_or_create_shadow_user``.
        """
        chioni = operator()
        center = make_center()
        target = km_user()
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def as_operator():
            try:
                gate.wait()
                create_platform_staff(
                    actor=chioni, phone=target.phone, role=PLATFORM_SUPPORT
                )
                outcomes["operator"] = "created"
            except ValidationError:
                outcomes["operator"] = "refused"
            finally:
                connections.close_all()

        def as_director():
            try:
                gate.wait()
                add_center_director(
                    actor=chioni, center=center, phone=target.phone
                )
                outcomes["director"] = "created"
            except ValidationError:
                outcomes["director"] = "refused"
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=as_operator),
            threading.Thread(target=as_director),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        both_hats = (
            PlatformStaff.objects.filter(user=target, is_active=True).exists()
            and StaffMembership.objects.filter(
                user=target, is_active=True
            ).exists()
        )
        assert not both_hats, (
            "État interdit atteint par course : "
            f"{outcomes} — les deux gardes doivent se sérialiser."
        )
        assert "refused" in outcomes.values()


# ---------------------------------------------------------------------------
# 3. FAIBLE — deux rétrogradations concurrentes d'exploitants
# ---------------------------------------------------------------------------


class TestTwoConcurrentDemotionsSerialiseInsteadOfDeadlocking:
    @pytest.mark.django_db(transaction=True)
    def test_no_deadlock_between_the_row_lock_and_the_seat_lock(self):
        """``update_platform_staff`` verrouillait D'ABORD la ligne visée,
        PUIS l'ensemble ordonné des sièges ``admin`` (qui la contient) :
        deux rétrogradations simultanées prenaient les mêmes verrous dans
        des ordres inverses. PostgreSQL tranche par un DEADLOCK — donc un
        500 sur une route de gouvernance, au lieu d'un refus français.
        """
        actor = operator()
        _a_user, a_row = operator_row(role=PLATFORM_ADMIN)
        _b_user, b_row = operator_row(role=PLATFORM_ADMIN)
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def demote(name, row):
            try:
                gate.wait()
                update_platform_staff(
                    actor=actor, operator=row, role=PLATFORM_SUPPORT
                )
                outcomes[name] = "demoted"
            except ValidationError:
                outcomes[name] = "refused"
            except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                outcomes[name] = f"crash:{type(exc).__name__}"
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=demote, args=("a", a_row)),
            threading.Thread(target=demote, args=("b", b_row)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        assert not any(
            str(value).startswith("crash") for value in outcomes.values()
        ), f"Verrous pris dans deux ordres : {outcomes}"
        # Et l'invariant tient : il reste au moins un administrateur actif.
        assert PlatformStaff.objects.filter(
            is_active=True, role=PLATFORM_ADMIN
        ).exists()


# ---------------------------------------------------------------------------
# 4. CONTRAT — le gel est STRUCTURELLEMENT borné à l'administratif
# ---------------------------------------------------------------------------


class TestTheFreezeIsStructurallyBoundedToAdministration:
    """« Le gel n'empêche jamais de soigner » vérifié par la STRUCTURE.

    Une énumération de scénarios prouve que le soin passe AUJOURD'HUI ;
    elle ne dit rien du jour où quelqu'un câblera la garde dans
    ``create_encounter``. Ces deux sondes échouent ce jour-là : la liste
    des modules qui importent la garde et la liste des fonctions qui
    l'appellent sont FERMÉES, comme la liste blanche du journal du
    directeur.
    """

    #: Les seuls modules autorisés à importer la garde (ADR 0018 décision 2).
    ALLOWED_IMPORTERS = {"centers/services.py", "centers/stats_views.py"}
    #: Les seules fonctions de ``centers.services`` qui l'appellent.
    ALLOWED_CALLERS = {
        "add_staff_member", "update_staff_member", "reactivate_staff_member",
        "create_tariff", "update_tariff",
    }

    @staticmethod
    def _apps_root():
        import pathlib

        return pathlib.Path(__file__).resolve().parents[1] / "apps"

    def test_only_two_modules_even_import_the_guard(self):
        import ast

        root = self._apps_root()
        offenders = set()
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            if any(
                isinstance(node, ast.ImportFrom)
                and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                )
                for node in ast.walk(tree)
            ):
                offenders.add(path.relative_to(root).as_posix())
        assert offenders == self.ALLOWED_IMPORTERS, (
            "Le périmètre du gel a bougé. Un module clinique, de caisse ou "
            "de support qui importerait la garde ferait échouer un SOIN "
            f"pour une raison commerciale : {offenders}"
        )

    def test_the_callers_inside_centers_services_are_a_closed_list(self):
        import ast

        source = (self._apps_root() / "centers" / "services.py").read_text(
            encoding="utf-8"
        )
        callers = {
            node.name
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.FunctionDef)
            and any(
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Name)
                and inner.func.id == "require_center_can_administer"
                for inner in ast.walk(node)
            )
        }
        assert callers == self.ALLOWED_CALLERS
        # Les portes explicitement HORS gel (ADR 0018 lot 1 §9 et §10).
        assert "deactivate_staff_member" not in callers
        assert "add_center_director" not in callers
        assert "_create_staff_membership" not in callers


# ---------------------------------------------------------------------------
# 5. CONTRAT — le gel ne bloque aucune CASCADE de soin
# ---------------------------------------------------------------------------


class TestAFrozenTenantStillCaresThroughEveryCascade:
    """Les chemins INDIRECTS : un service non gelé qui en appelle un autre.

    Le gabarit « ce qui continue » de ``test_subscription_effects`` teste
    les gestes un par un. Ici on teste les CHAÎNES — c'est là qu'un appel
    en cascade se cacherait : RDV → honoré → consultation → ordonnance →
    signes vitaux → clôture → facture → caisse → reçu, la fusion de
    doublons, et l'anonymisation RGPD (qui désactive un membership).
    """

    @pytest.mark.parametrize("status", [Status.SUSPENDED, Status.TERMINATED])
    def test_the_whole_chain_from_the_appointment_to_the_receipt(self, status):
        from datetime import datetime, time

        from apps.medical.models import HealthRecordEntry

        scn = build_scenario(status="facture_brouillon")
        make_subscription(
            center=scn.center, status=status, status_reason="Impayé."
        )
        practitioner = StaffMembership.objects.for_center(scn.center).get(
            user=scn.doctor
        )
        slot = timezone.make_aware(
            datetime.combine(
                timezone.localdate() + timedelta(days=1), time(9, 30)
            )
        )
        appointment = scheduling_services.create_appointment(
            created_by=scn.cashier, center=scn.center, patient=scn.patient,
            scheduled_at=slot, reason="Contrôle",
        )
        scheduling_services.check_in_appointment(appointment=appointment)
        # ``honor_appointment_from_encounter`` est appelé DANS create_encounter
        encounter = medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, practitioner=practitioner,
            patient=scn.patient, reason="Fièvre", tariff_items=[scn.tariff],
            appointment=appointment,
        )
        appointment.refresh_from_db()
        assert appointment.status == "honore"

        medical_services.create_prescription(
            actor=scn.doctor, encounter=encounter,
            items=[{"medication": "Paracétamol", "dosage": "500 mg",
                    "duration": "5 jours"}],
        )
        medical_services.record_vital_signs(
            actor=scn.doctor, encounter=encounter, measured_by=practitioner,
            temperature_c=Decimal("38.4"),
        )
        medical_services.create_record_entry(
            actor=scn.doctor, encounter=encounter,
            entry_type=HealthRecordEntry.EntryType.HISTORY,
            content="Paludisme en 2024.",
        )
        invoice = tb_services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=encounter
        )
        tb_services.issue_invoice(actor=scn.cashier, invoice=invoice)
        medical_services.close_encounter(actor=scn.doctor, encounter=encounter)
        payment = tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=invoice,
            method=CashPayment.Method.CASH, amount_kmf=invoice.total_kmf,
        )
        assert payment.cash_receipt is not None
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.PAID

    def test_merging_two_records_still_works_on_a_frozen_tenant(self):
        scn = build_scenario(status="facture_brouillon")
        make_subscription(
            center=scn.center, status=Status.SUSPENDED, status_reason="Impayé."
        )
        duplicate = make_patient(first_name="Mariama", last_name="Ahamada")
        duplicate.created_by_center = scn.center
        duplicate.save(update_fields=["created_by_center"])
        merged = patient_services.merge_profiles(
            source=duplicate, target=scn.patient, actor=scn.cashier,
            center=scn.center,
        )
        assert merged.pk == scn.patient.pk
        duplicate.refresh_from_db()
        assert duplicate.merged_into_id == scn.patient.pk

    def test_the_rgpd_anonymisation_never_fails_for_a_commercial_reason(self):
        """``anonymize_user`` appelle ``deactivate_staff_member``. Si un
        jour la désactivation était gelée, un DROIT FONDAMENTAL échouerait
        pour une facture impayée."""
        from apps.accounts.services import (
            process_erasure_request,
            request_erasure,
        )

        center, _director = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        make_subscription(
            center=center, status=Status.TERMINATED, status_reason="Résilié."
        )
        chioni = operator()
        erasure_request = request_erasure(user=nurse)
        process_erasure_request(
            actor=chioni, erasure_request=erasure_request,
            decision="anonymiser",
        )
        nurse.refresh_from_db()
        assert nurse.anonymized_at is not None
        assert not StaffMembership.objects.filter(
            user=nurse, is_active=True
        ).exists()

    def test_the_contrast_the_freeze_really_bites_on_the_same_tenant(self):
        """L'absence de garde est une DÉCISION, pas un oubli : sur le MÊME
        centre, l'embauche et les statistiques répondent bien 400."""
        scn = build_scenario(status="facture_brouillon")
        make_subscription(
            center=scn.center, status=Status.SUSPENDED, status_reason="Impayé."
        )
        with pytest.raises(ValidationError, match="suspendu"):
            add_staff_member(
                actor=scn.director, center=scn.center, phone="+2693441234",
                role=Role.NURSE,
            )
        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/stats/finances/"
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 6. CONTRAT — les deux registres restent étanches DANS LES DEUX SENS
# ---------------------------------------------------------------------------


class TestTheTwoRegistriesStaySealedBothWays:
    """L'étanchéité testée par ABSENCE dans un sens… et dans l'autre.

    ``test_subscription_invoicing`` prouve que le cycle SaaS n'écrit pas
    une ligne du ledger des soins. Le sens inverse manquait : la caisse du
    centre ne doit pas davantage bouger le solde de Chioni, et le solde
    SaaS ne doit se lire que d'une seule façon quel que soit l'état.
    """

    def _saas_cycle(self, center, chioni):
        subscription = make_subscription(
            center=center, status=Status.ACTIVE,
            plan=make_plan(price_kmf="25000"),
        )
        invoice = billing_services.issue_subscription_invoice(
            actor=chioni, subscription=subscription
        )
        payment = billing_services.record_subscription_payment(
            actor=chioni, invoice=invoice, amount_kmf=Decimal("10000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        billing_services.reverse_subscription_payment(
            actor=chioni, payment=payment, reason="Virement rejeté."
        )
        billing_services.cancel_subscription_invoice(
            actor=chioni, invoice=invoice, reason="Erreur de période."
        )
        return subscription, invoice

    def test_the_caisse_of_the_center_never_moves_the_chioni_balance(self):
        scn = build_scenario(status="facture_brouillon")
        chioni = operator()
        subscription = make_subscription(
            center=scn.center, status=Status.ACTIVE,
            plan=make_plan(price_kmf="25000"),
        )
        saas_invoice = billing_services.issue_subscription_invoice(
            actor=chioni, subscription=subscription
        )
        before = billing_services.subscription_invoice_balance_kmf(saas_invoice)

        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=CashPayment.Method.CASH, amount_kmf=scn.invoice.total_kmf,
        )
        saas_invoice.refresh_from_db()
        assert (
            billing_services.subscription_invoice_balance_kmf(saas_invoice)
            == before == Decimal("25000")
        )
        assert saas_invoice.status == InvoiceStatus.ISSUED
        # …et le solde de la facture PATIENT ignore tout de l'abonnement.
        assert tb_services.invoice_balance_kmf(scn.invoice) == Decimal("0")

    def test_the_full_saas_cycle_writes_not_one_row_of_the_care_ledger(self):
        scn = build_scenario(status="facture_brouillon")
        chioni = operator()
        counters = {
            model: model.objects.count()
            for model in (
                LedgerTransaction, LedgerEntry, Invoice, CashPayment,
                CashReceipt, Receipt,
            )
        }
        self._saas_cycle(scn.center, chioni)
        for model, before in counters.items():
            assert model.objects.count() == before, (
                f"{model.__name__} a bougé : le registre SaaS a touché le "
                "ledger des soins."
            )

    def test_the_saas_money_never_surfaces_in_a_center_money_screen(self):
        scn = build_scenario(status="facture_brouillon")
        chioni = operator()
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        _subscription, saas_invoice = self._saas_cycle(scn.center, chioni)
        api = client_for(scn.cashier)
        today = timezone.localdate().isoformat()
        for path in (
            f"/api/v1/centers/{scn.center.pk}/cash-journal/?date={today}",
            f"/api/v1/centers/{scn.center.pk}/invoices/unpaid/",
            f"/api/v1/centers/{scn.center.pk}/invoices/",
        ):
            response = api.get(path)
            assert response.status_code == 200, path
            body = response.content.decode()
            assert saas_invoice.number not in body, path
            assert "25000" not in body and "25 000" not in body, path

    @pytest.mark.parametrize("scenario", ["vierge", "partiel", "solde",
                                          "contre_passe", "annulee"])
    def test_the_sql_mirror_and_the_derivation_never_diverge(self, scenario):
        """Patron ``unpaid_invoices_qs`` ↔ ``invoice_balance_kmf`` : les deux
        lectures du solde SaaS doivent rendre le même verdict sur TOUS les
        états, y compris ceux que la lecture unitaire ignore."""
        center = make_center()
        chioni = operator()
        subscription = make_subscription(
            center=center, status=Status.ACTIVE, plan=make_plan(price_kmf="25000")
        )
        invoice = billing_services.issue_subscription_invoice(
            actor=chioni, subscription=subscription
        )
        if scenario in ("partiel", "solde", "contre_passe"):
            amount = "25000" if scenario == "solde" else "10000"
            payment = billing_services.record_subscription_payment(
                actor=chioni, invoice=invoice, amount_kmf=Decimal(amount),
                method=SubscriptionPayment.Method.CASH,
            )
            if scenario == "contre_passe":
                billing_services.reverse_subscription_payment(
                    actor=chioni, payment=payment, reason="Erreur de saisie."
                )
        if scenario == "annulee":
            billing_services.cancel_subscription_invoice(
                actor=chioni, invoice=invoice, reason="Doublon."
            )
        invoice.refresh_from_db()
        annotated = billing_services.annotate_subscription_invoice_balance(
            SubscriptionInvoice.objects.filter(pk=invoice.pk)
        ).get()
        assert annotated.balance_kmf_agg == (
            billing_services.subscription_invoice_balance_kmf(invoice)
        )
        # Et le miroir ensembliste des impayés est d'accord avec les deux.
        listed = billing_services.unpaid_subscription_invoices_qs().filter(
            pk=invoice.pk
        ).exists()
        assert listed == (
            invoice.status == InvoiceStatus.ISSUED
            and annotated.balance_kmf_agg > 0
        )


# ---------------------------------------------------------------------------
# 7. CONTRAT — l'argent SaaS sous fils réels (les courses non couvertes)
# ---------------------------------------------------------------------------


class TestSaaSCorrectionsUnderRealThreads:
    """Les courses que le lot 2 n'avait pas jouées.

    Il verrouillait « deux règlements » et « deux émissions ». Restaient
    trois entrelacements où un franc peut se perdre : annuler pendant
    qu'on encaisse, contre-passer deux fois, et rejouer la TÂCHE
    d'émission en parallèle d'elle-même.
    """

    def _live_invoice(self, chioni, price="25000"):
        subscription = make_subscription(
            center=make_center(), status=Status.ACTIVE,
            plan=make_plan(price_kmf=price),
        )
        return billing_services.issue_subscription_invoice(
            actor=chioni, subscription=subscription
        )

    @pytest.mark.django_db(transaction=True)
    def test_cancelling_never_races_past_a_settlement(self):
        """Un règlement encaissé sur une facture qui vient d'être annulée
        serait de l'argent reçu sur une créance morte : invisible du solde,
        non remboursable par le produit."""
        chioni = operator()
        invoice = self._live_invoice(chioni)
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def cancel():
            try:
                gate.wait()
                billing_services.cancel_subscription_invoice(
                    actor=chioni, invoice=invoice, reason="Erreur de période."
                )
                outcomes["cancel"] = "done"
            except ValidationError:
                outcomes["cancel"] = "refused"
            finally:
                connections.close_all()

        def pay():
            try:
                gate.wait()
                billing_services.record_subscription_payment(
                    actor=chioni, invoice=invoice, amount_kmf=Decimal("25000"),
                    method=SubscriptionPayment.Method.TRANSFER,
                )
                outcomes["pay"] = "done"
            except ValidationError:
                outcomes["pay"] = "refused"
            finally:
                connections.close_all()

        threads = [threading.Thread(target=cancel), threading.Thread(target=pay)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        invoice.refresh_from_db()
        live_payments = SubscriptionPayment.objects.filter(
            invoice=invoice, reversal__isnull=True
        ).count()
        assert not (
            invoice.status == InvoiceStatus.CANCELLED and live_payments
        ), f"Règlement vivant sur une facture annulée : {outcomes}"

    @pytest.mark.django_db(transaction=True)
    def test_a_settlement_is_reversed_once_even_under_two_threads(self):
        chioni = operator()
        invoice = self._live_invoice(chioni)
        payment = billing_services.record_subscription_payment(
            actor=chioni, invoice=invoice, amount_kmf=Decimal("25000"),
            method=SubscriptionPayment.Method.CASH,
        )
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def reverse(name):
            try:
                gate.wait()
                billing_services.reverse_subscription_payment(
                    actor=chioni, payment=payment, reason="Erreur de saisie."
                )
                outcomes[name] = "reversed"
            except ValidationError:
                # LE contrat : le perdant reçoit le refus français
                # « déjà contre-passé », jamais une IntegrityError (500) —
                # l'index unique est le filet, le verrou est la porte.
                outcomes[name] = "refused"
            except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                outcomes[name] = f"crash:{type(exc).__name__}"
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=reverse, args=(name,))
            for name in ("first", "second")
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        assert sorted(outcomes.values()) == ["refused", "reversed"], outcomes
        assert SubscriptionPaymentReversal.objects.filter(
            payment=payment
        ).count() == 1
        invoice.refresh_from_db()
        assert billing_services.subscription_invoice_balance_kmf(
            invoice
        ) == Decimal("25000")

    @pytest.mark.django_db(transaction=True)
    def test_the_issuance_task_replayed_in_parallel_bills_a_period_once(self):
        """L'idempotence prouvée par le lot 2 est SÉQUENTIELLE (« relancée
        dans la minute »). Deux workers Celery qui se chevauchent — un beat
        qui double-déclenche — est le cas réel."""
        chioni = operator()
        make_subscription(
            center=make_center(name="Tenant A"), status=Status.ACTIVE,
            plan=make_plan(price_kmf="25000"),
        )
        make_subscription(
            center=make_center(name="Tenant B"), status=Status.ACTIVE,
            plan=make_plan(price_kmf="40000"),
        )
        assert chioni is not None
        gate = threading.Barrier(2, timeout=15)

        def run():
            try:
                gate.wait()
                billing_services.issue_due_subscription_invoices()
            except Exception:  # noqa: BLE001 — un incident ne doit rien émettre en double
                pass
            finally:
                connections.close_all()

        threads = [threading.Thread(target=run) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        for subscription in CenterSubscription.objects.all():
            periods = list(
                SubscriptionInvoice.objects.filter(subscription=subscription)
                .exclude(status=InvoiceStatus.CANCELLED)
                .values_list("period_start", flat=True)
            )
            assert len(periods) == len(set(periods)), (
                "Une période facturée deux fois par un rejeu concurrent."
            )
        numbers = list(
            SubscriptionInvoice.objects.values_list("sequence_number", flat=True)
        )
        assert len(numbers) == len(set(numbers))
        assert sorted(numbers) == list(range(1, len(numbers) + 1)), (
            f"Trou dans la série « A- » : {sorted(numbers)}"
        )


# ---------------------------------------------------------------------------
# 8. MOYEN — la relance SMS qui part deux fois
# ---------------------------------------------------------------------------


class TestRemindersNeverDoubleFire:
    """Le compteur anti-doublon lu HORS verrou n'était pas anti-doublon.

    C'est le premier SMS métier du produit qui porte un MONTANT à un
    membre du personnel (ADR 0018 lot 2 §12). Deux exécutions qui se
    chevauchent — un beat qui double-déclenche, une tâche rejouée après un
    timeout — lisaient toutes deux « zéro relance envoyée » : le directeur
    recevait le même message deux fois et ``reminders_sent`` retombait à 1,
    si bien que la cadence « trois messages puis silence » pouvait être
    dépassée. Correctif : relecture de la facture sous ``FOR UPDATE`` avant
    l'incrément, avec le solde relu au passage.
    """

    def _overdue_invoice(self, days_overdue=0):
        center, director = make_center_with_director()
        subscription = make_subscription(
            center=center, status=Status.ACTIVE,
            plan=make_plan(price_kmf="25000"),
        )
        invoice = make_subscription_invoice(
            subscription=subscription, days_overdue=days_overdue
        )
        return center, director, invoice

    @pytest.mark.django_db(transaction=True)
    def test_two_overlapping_runs_send_exactly_one_message(self, settings):
        from apps.common.sms import MemorySmsBackend

        settings.SMS_BACKEND = "memory"
        MemorySmsBackend.sent.clear()
        try:
            _center, _director, invoice = self._overdue_invoice()
            gate = threading.Barrier(2, timeout=15)

            def run():
                try:
                    gate.wait()
                    billing_services.send_subscription_payment_reminders()
                finally:
                    connections.close_all()

            threads = [threading.Thread(target=run) for _ in range(2)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(30)

            assert len(MemorySmsBackend.sent) == 1, MemorySmsBackend.sent
            invoice.refresh_from_db()
            assert invoice.reminders_sent == 1
        finally:
            MemorySmsBackend.sent.clear()

    def test_a_month_of_twice_daily_runs_still_stops_at_three(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """La cadence J+0 / J+7 / J+21 puis SILENCE, même si l'ordonnanceur
        se déclenche deux fois par jour pendant un mois."""
        _center, _director, invoice = self._overdue_invoice()
        due = invoice.due_date
        for offset in range(0, 40):
            for _ in range(2):
                with django_capture_on_commit_callbacks(execute=True):
                    billing_services.send_subscription_payment_reminders(
                        today=due + timedelta(days=offset)
                    )
        invoice.refresh_from_db()
        assert invoice.reminders_sent == 3
        assert len(sms_outbox) == 3, sms_outbox

    def test_a_settlement_landing_first_cancels_the_reminder(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le solde est relu SOUS le verrou : une facture réglée entre la
        sélection et l'envoi ne déclenche rien — et ne brûle pas une
        relance."""
        _center, _director, invoice = self._overdue_invoice()
        chioni = operator()
        billing_services.record_subscription_payment(
            actor=chioni, invoice=invoice, amount_kmf=Decimal("25000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        with django_capture_on_commit_callbacks(execute=True):
            billing_services.send_subscription_payment_reminders()
        invoice.refresh_from_db()
        assert invoice.reminders_sent == 0
        assert sms_outbox == []


# ---------------------------------------------------------------------------
# 9. CONTRAT — le support n'est pas un canal d'exfiltration
# ---------------------------------------------------------------------------


class TestSupportIsNotAnExfiltrationChannel:
    """Ce que le canal support ne doit JAMAIS rendre atteignable.

    Le risque assumé de l'ADR est le TEXTE LIBRE qu'un humain tape. Tout
    le reste est du ressort du code : la pièce jointe d'un autre tenant, le
    fil d'un collègue, le contenu dans un journal, et l'identité de
    l'interlocuteur Chioni.
    """

    def _ticket_with_attachment(self, center, author):
        ticket = support_services.open_ticket(
            actor=author, center=center, subject="Écran blanc à la caisse",
            category=SupportTicket.Category.BUG, body="Depuis ce matin.",
        )
        attachment = support_services.attach_file(
            actor=author, ticket=ticket, uploaded_file=png_upload()
        )
        return ticket, attachment

    def test_a_director_never_downloads_a_neighbours_attachment(self):
        """L'URL porte DEUX références (centre et ticket) : le centre vient
        des memberships de l'appelant, le ticket du queryset cloisonné. Un
        directeur qui met SON centre et le ticket du voisin doit tomber sur
        un 404 — jamais un octet, jamais un 403 qui apprendrait l'existence.
        """
        mine, my_director = make_center_with_director()
        theirs, their_director = make_center_with_director(name="Clinique voisine")
        their_ticket, their_attachment = self._ticket_with_attachment(
            theirs, their_director
        )
        api = client_for(my_director)
        for path in (
            f"/api/v1/centers/{mine.pk}/support/tickets/{their_ticket.pk}/",
            f"/api/v1/centers/{mine.pk}/support/tickets/{their_ticket.pk}"
            f"/attachments/{their_attachment.pk}/download/",
            f"/api/v1/centers/{theirs.pk}/support/tickets/{their_ticket.pk}/",
        ):
            assert api.get(path).status_code == 404, path

    def test_a_colleague_who_is_not_the_author_reads_nothing(self):
        center, _director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        nurse = make_staff_user(center, role=Role.NURSE)
        ticket, attachment = self._ticket_with_attachment(center, secretary)
        api = client_for(nurse)
        listed = api.get(f"/api/v1/centers/{center.pk}/support/tickets/")
        assert listed.status_code == 200
        assert listed.json()["results"] == []
        for path in (
            f"/api/v1/centers/{center.pk}/support/tickets/{ticket.pk}/",
            f"/api/v1/centers/{center.pk}/support/tickets/{ticket.pk}/messages/",
            f"/api/v1/centers/{center.pk}/support/tickets/{ticket.pk}"
            f"/attachments/{attachment.pk}/download/",
        ):
            assert api.get(path).status_code == 404, path

    def test_the_toxic_subject_never_lands_anywhere_in_the_audit_table(self):
        """Sujet et corps volontairement toxiques : on balaie la table
        d'audit ENTIÈRE (payloads + ``object_id``), pas seulement les
        quatre actions du module — une action voisine pourrait recopier."""
        center, director = make_center_with_director()
        toxic_subject = "Le dossier de Mme Combo ne s'ouvre pas"
        toxic_body = "Sérologie VIH positive affichée en double"
        chioni = operator()
        ticket = support_services.open_ticket(
            actor=director, center=center, subject=toxic_subject,
            category=SupportTicket.Category.BUG, body=toxic_body,
        )
        support_services.attach_file(
            actor=director, ticket=ticket, uploaded_file=png_upload("dossier-combo.png")
        )
        support_services.post_message(
            actor=chioni, ticket=ticket, body="Nous regardons.",
            side=SupportMessage.Side.CHIONI,
        )
        support_services.set_ticket_status(
            actor=chioni, ticket=ticket, status=SupportTicket.Status.IN_PROGRESS
        )
        haystack = "\n".join(
            f"{entry.action} {entry.object_id} {entry.payload}"
            for entry in AuditLog.objects.all()
        )
        for needle in ("Combo", "VIH", "Sérologie", "dossier-combo", ".png"):
            assert needle not in haystack, needle

    def test_the_director_sees_the_exchange_without_its_content_nor_a_name(self):
        center, director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        chioni = operator()
        ticket = support_services.open_ticket(
            actor=secretary, center=center, subject="Écran blanc",
            category=SupportTicket.Category.BUG, body="Depuis ce matin.",
        )
        support_services.post_message(
            actor=chioni, ticket=ticket, body="Correctif déployé.",
            side=SupportMessage.Side.CHIONI,
        )
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
            f"?action={AuditAction.SUPPORT_MESSAGE_POSTED}"
        )
        assert response.status_code == 200
        rows = response.json()["results"]
        chioni_rows = [
            row for row in rows if row["payload"]["author_side"] == "chioni"
        ]
        assert chioni_rows, rows
        entry = chioni_rows[0]
        # L'interlocuteur du centre est « Chioni », pas une personne.
        assert entry["actor_display"] is None
        assert "Correctif" not in response.content.decode()
        # …et le nom du personnel du centre, lui, reste résolu (même maison).
        own = [row for row in rows if row["payload"]["author_side"] == "centre"]
        assert own and own[0]["actor"] == secretary.pk

    def test_a_platform_transverse_action_never_enters_a_center_journal(self):
        """``platform_staff.*`` et ``subscription_plan.*`` ne portent aucun
        centre : ils ne peuvent PAS apparaître dans le journal d'un tenant,
        et la liste blanche le dit deux fois."""
        assert AuditAction.PLATFORM_STAFF_CREATED not in DIRECTOR_JOURNAL_ACTIONS
        assert AuditAction.PLATFORM_STAFF_UPDATED not in DIRECTOR_JOURNAL_ACTIONS
        assert (
            AuditAction.SUBSCRIPTION_PLAN_CREATED not in DIRECTOR_JOURNAL_ACTIONS
        )
        chioni = operator()
        create_platform_staff(
            actor=chioni, phone=km_user().phone, role=PLATFORM_SUPPORT
        )
        billing_services.create_plan(
            actor=chioni, code="OFFRE-X", name="Offre X", price_kmf=Decimal("1000")
        )
        assert not AuditLog.objects.filter(
            action__in=(
                AuditAction.PLATFORM_STAFF_CREATED,
                AuditAction.SUBSCRIPTION_PLAN_CREATED,
            ),
            center__isnull=False,
        ).exists()

    def test_the_suspension_motive_never_reaches_the_journal(self):
        center, director = make_center_with_director()
        chioni = operator()
        subscription = make_subscription(center=center, status=Status.ACTIVE)
        secret = "Chèque sans provision de M. Ali Combo"
        billing_services.set_subscription_status(
            actor=chioni, subscription=subscription,
            status=Status.SUSPENDED, reason=secret,
        )
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        )
        assert response.status_code == 200
        assert "Combo" not in response.content.decode()
        assert any(
            row["payload"].get("has_reason") is True
            for row in response.json()["results"]
            if row["action"] == AuditAction.SUBSCRIPTION_STATUS_CHANGED
        )


# ---------------------------------------------------------------------------
# 9. CONTRAT — les portes d'admin de S5 sont fermées POUR DE VRAI
# ---------------------------------------------------------------------------


class TestS5AdminDoorsAreShutEndToEnd:
    """``has_change_permission = False`` se teste en unité ; ce qui compte
    est ce que répond le VRAI site d'admin à un superuser qui POSTe."""

    @pytest.mark.parametrize(
        "path_factory",
        [
            "billing/subscriptioninvoice", "billing/subscriptionpayment",
            "billing/centersubscription", "billing/subscriptionplan",
            "support/supportticket", "support/supportmessage",
            "support/supportattachment",
            "centers/staffmembership", "accounts/platformstaff",
        ],
    )
    def test_no_add_form_is_reachable(self, admin_client, path_factory):
        response = admin_client.post(f"/admin/{path_factory}/add/", {})
        assert response.status_code == 403, path_factory

    def test_a_superuser_cannot_flip_a_saas_invoice_to_paid(self):
        chioni = operator()
        subscription = make_subscription(
            center=make_center(), status=Status.ACTIVE,
            plan=make_plan(price_kmf="25000"),
        )
        invoice = billing_services.issue_subscription_invoice(
            actor=chioni, subscription=subscription
        )
        User = get_user_model()
        superuser = User.objects.create_superuser(
            username="root-s5", password="x", phone="+2693449999"
        )
        client = client_for()
        client.force_login(superuser)
        response = client.post(
            f"/admin/billing/subscriptioninvoice/{invoice.pk}/change/",
            {"status": InvoiceStatus.PAID},
        )
        assert response.status_code == 403
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.ISSUED
        assert billing_services.subscription_invoice_balance_kmf(
            invoice
        ) == Decimal("25000")

    def test_a_superuser_cannot_rewrite_a_support_message(self):
        center, director = make_center_with_director()
        ticket = make_support_ticket(center=center, opened_by=director)
        message = support_services.post_message(
            actor=director, ticket=ticket, body="Texte original.",
            side=SupportMessage.Side.CENTER,
        )
        User = get_user_model()
        superuser = User.objects.create_superuser(
            username="root-s5b", password="x", phone="+2693449998"
        )
        client = client_for()
        client.force_login(superuser)
        response = client.post(
            f"/admin/support/supportmessage/{message.pk}/change/",
            {"body": "Texte réécrit."},
        )
        assert response.status_code == 403
        message.refresh_from_db()
        assert message.body == "Texte original."
        assert SupportAttachment.objects.count() == 0
