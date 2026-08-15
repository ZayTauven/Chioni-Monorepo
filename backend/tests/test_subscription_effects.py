"""S5 (ADR 0018 décision 2 + arbitrage PO n° 2) — ce que le gel ferme, et
surtout ce qu'il ne ferme JAMAIS.

Le gabarit est celui de ``test_kyc_suspension_effects.py``, et l'ordre des
classes est délibéré : **« ce qui continue » est écrit AVANT « ce qui
s'arrête »**. C'est l'invariant éthique du sprint, hérité de S4 :

    suspendre ne doit jamais empêcher de soigner.

- ❌ ce qui se ferme (gel administratif) : ajout / modification /
  réactivation de personnel · création / modification de tarifs ·
  statistiques d'activité et de finances ;
- ✅ ce qui continue, sur un centre suspendu ou résilié : consultations,
  carnet, documents, ordonnances · rendez-vous · **l'inscription d'un
  patient qui se présente au guichet** · la facturation patient · la
  caisse et les reçus · **la désactivation d'un membre** (révoquer un
  accès est un geste de sécurité, jamais une fonctionnalité payante) ·
  toute lecture · l'export RGPD · le journal d'audit du directeur ;
- ⚪ ce qui ne ferme rien du tout : ``essai``, ``actif`` et — c'est le
  point le plus important du barème — ``impaye``. Être en retard n'est
  pas être coupé : bandeau et relances (lot 2), rien d'autre.

Deux invariants transverses sont vérifiés ici aussi : l'**étanchéité des
registres** (un abonnement n'apparaît dans aucune vue argent du centre) et
les **quotas qui ne bloquent jamais**.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.billing.guards import (
    SUBSCRIPTION_SUSPENDED_MESSAGE,
    SUBSCRIPTION_TERMINATED_MESSAGE,
)
from apps.billing.models import CenterSubscription
from apps.centers import services as center_services
from apps.centers.models import StaffMembership
from apps.medical import services as medical_services
from apps.medical.models import HealthRecordEntry
from apps.patients import services as patient_services
from apps.scheduling import services as scheduling_services
from apps.trustbridge import services as tb_services
from apps.trustbridge.models import (
    CashPayment,
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    PaymentRequest,
    Receipt,
)

from .api_helpers import client_for, make_staff_user
from .factories import make_plan, make_subscription, make_tariff
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db

Role = StaffMembership.Role
Status = CenterSubscription.Status


def freeze(center, status=Status.SUSPENDED, reason="Trois échéances impayées."):
    """Put the center's subscription in a FROZEN state.

    Through the model on purpose (the state machine and its audit are
    covered by ``test_subscription_api.py``): this module is about the
    EFFECTS of the state, not about who sets it — exactly like
    ``suspend()`` in the KYC effects module.
    """
    subscription = getattr(center, "subscription", None)
    if subscription is None:
        return make_subscription(center=center, status=status,
                                 status_reason=reason)
    subscription.status = status
    subscription.status_reason = reason
    subscription.save(update_fields=["status", "status_reason", "updated_at"])
    return subscription


# ---------------------------------------------------------------------------
# ✅ CE QUI CONTINUE — écrit en premier, c'est le contrat du sprint
# ---------------------------------------------------------------------------


class TestCareAndCashNeverStop:
    def test_a_patient_can_still_be_registered_at_the_desk(self):
        """LE cas qui décide de tout : quelqu'un se présente au guichet
        d'un centre suspendu. Il est inscrit. Point."""
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        profile, _link = patient_services.create_patient_at_center(
            actor=scn.cashier, center=scn.center,
            first_name="Mariama", last_name="Ahamada",
        )
        assert profile.pk is not None
        assert profile.created_by_center_id == scn.center.pk

    def test_consultations_carnet_and_invoicing_keep_running(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        practitioner = StaffMembership.objects.for_center(scn.center).get(
            user=scn.doctor
        )
        encounter = medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, practitioner=practitioner,
            patient=scn.patient, reason="Fièvre", tariff_items=[scn.tariff],
        )
        entry = medical_services.create_record_entry(
            actor=scn.doctor, encounter=encounter,
            entry_type=HealthRecordEntry.EntryType.HISTORY,
            content="Paludisme en 2024.",
        )
        assert entry.pk is not None
        invoice = tb_services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=encounter
        )
        tb_services.issue_invoice(actor=scn.cashier, invoice=invoice)
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.ISSUED

    def test_the_cash_desk_still_cashes_in_and_issues_its_receipt(self):
        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        freeze(scn.center)

        payment = tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=CashPayment.Method.CASH, amount_kmf=scn.invoice.total_kmf,
            operator="", reference="", idempotency_key="",
        )
        assert payment.cash_receipt is not None  # série « G- » émise
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID

    def test_the_cash_desk_still_cashes_in_through_the_api(self):
        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        freeze(scn.center)
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/payments/",
            {"method": "especes", "amount_kmf": "15000"},
        )
        assert response.status_code == 201, response.content

    def test_appointments_keep_being_booked(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        slot = timezone.make_aware(
            datetime.combine(timezone.localdate() + timedelta(days=2), time(9, 30))
        )
        appointment = scheduling_services.create_appointment(
            created_by=scn.cashier, center=scn.center, patient=scn.patient,
            scheduled_at=slot, reason="Contrôle",
        )
        assert appointment.pk is not None

    def test_the_diaspora_rail_stays_open_on_an_unpaid_center(self):
        """Décision explicite de l'ADR : fermer le Pont punirait le tuteur
        et le patient, pas le centre — et Chioni y prélève ses frais."""
        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        freeze(scn.center, status=Status.SUSPENDED)
        request = tb_services.create_payment_request(
            actor=scn.cashier, invoice=scn.invoice
        )
        tb_services.share_payment_request(
            actor=scn.cashier, payment_request=request, guardian_link=scn.link
        )
        tb_services.send_payment_request(
            actor=scn.cashier, payment_request=request
        )
        request.refresh_from_db()
        assert request.status == PaymentRequest.Status.SENT

    def test_a_paid_request_goes_to_its_term_and_the_receipt_is_issued(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        freeze(scn.center, status=Status.TERMINATED, reason="Contrat résilié.")
        tb_services.confirm_care(actor=scn.doctor, payment_request=scn.payment_request)
        receipt = tb_services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert Receipt.objects.filter(pk=receipt.pk).exists()


class TestRevokingAnAccessIsNeverPunished:
    def test_a_member_can_still_be_deactivated(self):
        """Écart ASSUMÉ et documenté (addendum ADR 0018 lot 1) : la
        décision 2 gèle « ajout / modification / réactivation », pas la
        désactivation. Couper l'accès d'un salarié parti est un geste de
        SÉCURITÉ, et l'anonymisation RGPD en dépend."""
        scn = build_scenario(status="facture_brouillon")
        nurse = make_staff_user(scn.center, role=Role.NURSE)
        membership = StaffMembership.objects.for_center(scn.center).get(user=nurse)
        freeze(scn.center)
        center_services.deactivate_staff_member(
            actor=scn.director, membership=membership
        )
        membership.refresh_from_db()
        assert membership.is_active is False

    def test_the_api_deactivates_too(self):
        scn = build_scenario(status="facture_brouillon")
        nurse = make_staff_user(scn.center, role=Role.NURSE)
        membership = StaffMembership.objects.for_center(scn.center).get(user=nurse)
        freeze(scn.center, status=Status.TERMINATED, reason="Résiliation.")
        response = client_for(scn.director).post(
            f"/api/v1/centers/{scn.center.pk}/staff/{membership.pk}/deactivate/"
        )
        assert response.status_code == 200, response.content


class TestEveryReadKeepsWorking:
    @pytest.mark.parametrize("status", [Status.SUSPENDED, Status.TERMINATED])
    def test_the_center_screens_still_load(self, status):
        scn = build_scenario(status="facture_brouillon")
        make_tariff(scn.center, code="XRAY01", label="Radiographie")
        freeze(scn.center, status=status, reason="Motif.")
        client = client_for(scn.director)
        for url in (
            f"/api/v1/centers/{scn.center.pk}/",
            f"/api/v1/centers/{scn.center.pk}/staff/",
            f"/api/v1/centers/{scn.center.pk}/tariffs/",
            f"/api/v1/centers/{scn.center.pk}/practitioners/",
            f"/api/v1/centers/{scn.center.pk}/patients/",
            f"/api/v1/centers/{scn.center.pk}/invoices/",
            f"/api/v1/centers/{scn.center.pk}/cash-journal/",
            f"/api/v1/centers/{scn.center.pk}/invoices/unpaid/",
            f"/api/v1/centers/{scn.center.pk}/appointments/",
            f"/api/v1/centers/{scn.center.pk}/audit-log/",
            f"/api/v1/centers/{scn.center.pk}/subscription/",
        ):
            assert client.get(url).status_code == 200, url

    def test_the_patient_still_reads_their_carnet(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        response = client_for(scn.patient_user).get(
            "/api/v1/patients/me/encounters/"
        )
        assert response.status_code == 200
        assert response.data["count"] >= 1

    def test_the_rgpd_export_is_never_frozen(self):
        """Un droit fondamental ne dépend pas d'un contrat commercial."""
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center, status=Status.TERMINATED, reason="Résiliation.")
        for user in (scn.director, scn.patient_user):
            response = client_for(user).get("/api/v1/auth/me/export/")
            assert response.status_code == 200, response.content


# ---------------------------------------------------------------------------
# ❌ CE QUI S'ARRÊTE — le gel administratif, et lui seul
# ---------------------------------------------------------------------------


class TestAdministrationFreezes:
    def test_hiring_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        with pytest.raises(ValidationError) as excinfo:
            center_services.add_staff_member(
                actor=scn.director, center=scn.center,
                phone="+2693390111", role=Role.NURSE,
            )
        assert excinfo.value.messages == [SUBSCRIPTION_SUSPENDED_MESSAGE]
        assert not StaffMembership.objects.for_center(scn.center).filter(
            role=Role.NURSE
        ).exists()

    def test_editing_a_membership_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        nurse = make_staff_user(scn.center, role=Role.NURSE)
        membership = StaffMembership.objects.for_center(scn.center).get(user=nurse)
        freeze(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            center_services.update_staff_member(
                actor=scn.director, membership=membership, role=Role.MIDWIFE
            )

    def test_reactivating_a_membership_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        nurse = make_staff_user(scn.center, role=Role.NURSE)
        membership = StaffMembership.objects.for_center(scn.center).get(user=nurse)
        center_services.deactivate_staff_member(
            actor=scn.director, membership=membership
        )
        freeze(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            center_services.reactivate_staff_member(
                actor=scn.director, membership=membership
            )

    def test_creating_and_editing_a_tariff_are_refused(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            center_services.create_tariff(
                actor=scn.director, center=scn.center, code="NEW01",
                label="Nouvel acte", price_kmf=Decimal("3000"),
            )
        with pytest.raises(ValidationError, match="suspendu"):
            center_services.update_tariff(
                actor=scn.director, tariff=scn.tariff, price_kmf=Decimal("9000")
            )
        scn.tariff.refresh_from_db()
        assert scn.tariff.price_kmf == Decimal("15000.00")

    def test_the_api_hands_the_staff_the_explanation_and_the_way_out(self):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        response = client_for(scn.director).post(
            f"/api/v1/centers/{scn.center.pk}/staff/",
            {"phone": "+2693390112", "role": Role.NURSE},
        )
        assert response.status_code == 400
        assert SUBSCRIPTION_SUSPENDED_MESSAGE in str(response.data)

    @pytest.mark.parametrize("path", ["stats/activity", "stats/finances"])
    def test_the_piloting_stats_are_frozen(self, path):
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        response = client_for(scn.director).get(
            f"/api/v1/centers/{scn.center.pk}/{path}/"
        )
        assert response.status_code == 400
        assert SUBSCRIPTION_SUSPENDED_MESSAGE in str(response.data)

    def test_a_terminated_center_gets_its_own_explanation(self):
        """« Régularisez » et « le contrat est terminé » ne sont pas la
        même nouvelle : deux états gelés, deux messages."""
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center, status=Status.TERMINATED, reason="Fin de contrat.")
        with pytest.raises(ValidationError) as excinfo:
            center_services.create_tariff(
                actor=scn.director, center=scn.center, code="NEW02",
                label="Acte", price_kmf=Decimal("1000"),
            )
        assert excinfo.value.messages == [SUBSCRIPTION_TERMINATED_MESSAGE]

    def test_both_messages_say_what_keeps_working(self):
        assert SUBSCRIPTION_SUSPENDED_MESSAGE != SUBSCRIPTION_TERMINATED_MESSAGE
        for message in (
            SUBSCRIPTION_SUSPENDED_MESSAGE, SUBSCRIPTION_TERMINATED_MESSAGE
        ):
            assert "abonnement" in message.lower()
            # Un refus dit toujours à qui parler…
            assert "ontactez Chioni" in message
            # …et ce qui, malgré tout, continue de fonctionner.
            assert (
                "Les soins, les rendez-vous, l'inscription des patients, la "
                "facturation et la caisse continuent normalement." in message
            )

    def test_the_guard_reads_the_status_in_database_not_in_memory(self):
        """Leçon de la revue guardian S4 : une garde qui fait confiance à
        l'objet de l'appelant fait confiance à qui l'a chargé."""
        scn = build_scenario(status="facture_brouillon")
        subscription = make_subscription(center=scn.center, status=Status.ACTIVE)
        stale_center = scn.center
        assert stale_center.subscription.status == Status.ACTIVE  # mis en cache
        CenterSubscription.objects.filter(pk=subscription.pk).update(
            status=Status.SUSPENDED, status_reason="Impayé."
        )
        with pytest.raises(ValidationError, match="suspendu"):
            center_services.create_tariff(
                actor=scn.director, center=stale_center, code="STALE1",
                label="Acte", price_kmf=Decimal("1000"),
            )


class TestThePlatformKeepsItsRescuePath:
    def test_chioni_can_still_seed_a_director_into_a_frozen_tenant(self):
        """Une sanction commerciale ne doit jamais enfermer Chioni hors du
        centre qu'elle a sanctionné."""
        scn = build_scenario(status="facture_brouillon")
        freeze(scn.center)
        membership = center_services.add_center_director(
            actor=scn.director, center=scn.center, phone="+2693390113"
        )
        assert membership.role == Role.DIRECTOR
        assert membership.is_active


# ---------------------------------------------------------------------------
# ⚪ CE QUI NE GÈLE RIEN — dont l'impayé, le point le plus important
# ---------------------------------------------------------------------------


class TestOnlyTwoStatusesFreeze:
    @pytest.mark.parametrize(
        "status", [Status.TRIAL, Status.ACTIVE, Status.UNPAID]
    )
    def test_trial_active_and_unpaid_close_nothing(self, status):
        """``impaye`` = échéance dépassée, DANS la grâce : bandeau et
        relances (lot 2), jamais un verrou."""
        scn = build_scenario(status="facture_brouillon")
        make_subscription(center=scn.center, status=status)
        tariff = center_services.create_tariff(
            actor=scn.director, center=scn.center, code="OK01",
            label="Acte", price_kmf=Decimal("2000"),
        )
        assert tariff.pk is not None
        membership = center_services.add_staff_member(
            actor=scn.director, center=scn.center,
            phone="+2693390114", role=Role.NURSE,
        )
        assert membership.pk is not None
        response = client_for(scn.director).get(
            f"/api/v1/centers/{scn.center.pk}/stats/activity/"
        )
        assert response.status_code == 200

    def test_a_center_without_any_subscription_is_not_in_default(self):
        """Tous les centres nés avant S5 : pas de contrat en base ≠ centre
        sanctionné. Le gel est une décision, jamais l'état par défaut."""
        scn = build_scenario(status="facture_brouillon")
        assert not hasattr(scn.center, "subscription")
        assert center_services.create_tariff(
            actor=scn.director, center=scn.center, code="OK02",
            label="Acte", price_kmf=Decimal("2000"),
        ).pk

    def test_freezing_one_center_never_freezes_its_neighbour(self):
        """Cloisonnement : la garde lit l'abonnement DU centre visé."""
        frozen = build_scenario(status="facture_brouillon")
        neighbour = build_scenario(status="facture_brouillon")
        freeze(frozen.center)
        assert center_services.create_tariff(
            actor=neighbour.director, center=neighbour.center, code="OK03",
            label="Acte", price_kmf=Decimal("2000"),
        ).pk
        assert (
            client_for(neighbour.director)
            .get(f"/api/v1/centers/{neighbour.center.pk}/stats/finances/")
            .status_code == 200
        )


# ---------------------------------------------------------------------------
# Étanchéité des registres (invariant transverse n° 4 de l'ADR 0018)
# ---------------------------------------------------------------------------


class TestTheSubscriptionNeverTouchesTheCareLedger:
    def test_opening_and_freezing_a_subscription_writes_no_money_row(self):
        from apps.billing import services as billing_services

        scn = build_scenario(status="facture_brouillon")
        before = {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "receipts": Receipt.objects.count(),
        }
        plan = make_plan(code="ESSENTIEL", price_kmf="25000")
        subscription = billing_services.create_subscription(
            actor=scn.director, center=scn.center, plan=plan
        )
        billing_services.set_subscription_status(
            actor=scn.director, subscription=subscription,
            status=Status.SUSPENDED, reason="Impayé.",
        )
        assert {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "receipts": Receipt.objects.count(),
        } == before

    def test_the_center_money_views_never_show_the_subscription(self):
        """Une facture d'abonnement qui apparaîtrait dans « recettes » ou
        dans les impayés du centre serait un bug de lecture, pas une
        donnée (ADR 0018 décision 1)."""
        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        make_subscription(
            center=scn.center,
            plan=make_plan(code="CLINIQUE", price_kmf="90000"),
            status=Status.ACTIVE,
        )
        client = client_for(scn.director)
        finances = client.get(f"/api/v1/centers/{scn.center.pk}/stats/finances/")
        journal = client.get(f"/api/v1/centers/{scn.center.pk}/cash-journal/")
        unpaid = client.get(f"/api/v1/centers/{scn.center.pk}/invoices/unpaid/")
        assert finances.status_code == journal.status_code == 200
        assert unpaid.status_code == 200
        for response in (finances, journal, unpaid):
            body = response.content.decode()
            assert "90000" not in body and "abonnement" not in body.lower()
        # Les impayés du centre = ses factures PATIENTS, celle-ci et rien d'autre.
        assert [row["id"] for row in unpaid.data["results"]] == [scn.invoice.pk]

    def test_an_issued_saas_invoice_and_its_settlement_stay_out_of_the_caisse(self):
        """S5 lot 2 — extension du contrat d'étanchéité au cycle COMPLET :
        émettre une facture d'abonnement de 90 000 KMF et en encaisser
        30 000 ne doit apparaître NULLE PART dans l'argent du centre (les
        recettes du jour, le journal de caisse, les impayés patients), et
        n'écrire aucune ligne du ledger des soins."""
        from apps.billing import services as billing_services
        from apps.trustbridge.models import CashReceipt

        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        subscription = make_subscription(
            center=scn.center,
            plan=make_plan(code="CLINIQUE", price_kmf="90000"),
            status=Status.ACTIVE,
        )
        before = {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "cash_receipts": CashReceipt.objects.count(),
            "receipts": Receipt.objects.count(),
        }
        saas_invoice = billing_services.issue_subscription_invoice(
            actor=scn.director, subscription=subscription
        )
        billing_services.record_subscription_payment(
            actor=scn.director, invoice=saas_invoice, amount_kmf=Decimal("30000"),
            method="virement",
        )
        assert {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "cash_receipts": CashReceipt.objects.count(),
            "receipts": Receipt.objects.count(),
        } == before

        client = client_for(scn.director)
        for url in (
            f"/api/v1/centers/{scn.center.pk}/stats/finances/",
            f"/api/v1/centers/{scn.center.pk}/cash-journal/",
            f"/api/v1/centers/{scn.center.pk}/invoices/unpaid/",
            f"/api/v1/centers/{scn.center.pk}/invoices/",
        ):
            response = client.get(url)
            assert response.status_code == 200, url
            body = response.content.decode()
            for forbidden in ("90000", "30000", saas_invoice.number):
                assert forbidden not in body, (url, forbidden)


# ---------------------------------------------------------------------------
# Quotas : mesurés, affichés… et JAMAIS opposés (invariant n° 2)
# ---------------------------------------------------------------------------


class TestQuotasNeverBlock:
    def test_an_over_quota_center_registers_hires_and_consults(self):
        """Arbitrage PO n° 3 : bloquer un dossier patient au motif d'un
        plan reviendrait à refuser un soin pour une raison comptable."""
        from apps.billing.services import subscription_usage

        scn = build_scenario(status="facture_brouillon")
        make_subscription(
            center=scn.center,
            plan=make_plan(
                code="MINI", included_staff=1, included_practitioners=0
            ),
            status=Status.ACTIVE,
        )
        usage = subscription_usage(scn.center)
        assert usage["over_quota"] is True
        assert usage["exceeded"] == ["practitioners", "staff"]

        # …et rien ne s'arrête pour autant.
        profile, _link = patient_services.create_patient_at_center(
            actor=scn.cashier, center=scn.center,
            first_name="Zainaba", last_name="Combo",
        )
        membership = center_services.add_staff_member(
            actor=scn.director, center=scn.center,
            phone="+2693390115", role=Role.NURSE,
        )
        practitioner = StaffMembership.objects.for_center(scn.center).get(
            user=scn.doctor
        )
        encounter = medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, practitioner=practitioner,
            patient=profile, reason="Toux",
        )
        assert profile.pk and membership.pk and encounter.pk

    def test_no_business_module_imports_the_quota_helper(self):
        """Structurel : ``subscription_usage`` ne doit être lu QUE par les
        vues/serializers d'abonnement. Le jour où un service métier
        l'importe, le quota devient opposable — et le test rougit."""
        import pathlib
        import re

        root = pathlib.Path(__file__).resolve().parents[1] / "apps"
        allowed = {
            root / "billing" / "services.py",
            root / "billing" / "serializers.py",
            root / "billing" / "platform_serializers.py",
        }
        # Lookbehind : ``annotate_subscription_usage`` (la lecture de masse
        # du back-office) n'est pas le helper opposable.
        pattern = re.compile(r"(?<!annotate_)subscription_usage")
        offenders = [
            str(path.relative_to(root))
            for path in root.rglob("*.py")
            if path not in allowed
            and pattern.search(path.read_text(encoding="utf-8"))
        ]
        assert not offenders, offenders
