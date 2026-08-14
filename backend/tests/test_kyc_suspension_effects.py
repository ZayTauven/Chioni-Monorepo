"""S4 (ADR 0017, décision 3 + arbitrage PO n° 1) — « suspendu » a enfin un sens.

Before this sprint ``SUSPENDED`` was declared and never read: only
``!= ACTIVE`` was tested, at the intent and at the webhook. The arbitrage
of the PO gives the word a MEANING and a BOUND:

- ❌ what closes: the **diaspora rail** for NEW payments — creating a
  payment request, sharing it with a guardian, sending it, opening a PSP
  intent;
- ✅ what lands anyway (arbitrage PO du 14/08/2026): a payment ALREADY IN
  FLIGHT. An intent only exists because the center was ACTIVE when it was
  opened, so the guardian's card is already debited: the webhook cashes in
  and the receipt is issued. Refusing it would leave a real debit with no
  proof. Cashing in is not paying out — withholding a suspended center's
  funds belongs to the (unbuilt) payout process;
- ✅ what CONTINUES: consultations, carnet, rendez-vous, patients, staff,
  tariffs, invoicing **and the cash desk** (espèces / mobile money).
  Suspending a center must never stop it from treating the patient in
  front of it, nor send it back to paper. The commercial sanction (cutting
  access) belongs to the subscription chantier (S5).
- ✅ what also continues: the TAIL of an already-paid request — confirm
  care, close, issue the receipt. « Un tuteur qui a déjà payé n'est jamais
  laissé sans reçu. »

Plus: « en attente » and « suspendu » are two different situations and get
two different explanations (they used to share one message).
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.centers.models import HealthCenter, StaffMembership
from apps.medical import services as medical_services
from apps.medical.models import HealthRecordEntry
from apps.scheduling import services as scheduling_services
from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, Invoice, PaymentRequest
from apps.trustbridge.services import (
    KYC_PENDING_MESSAGE,
    KYC_SUSPENDED_MESSAGE,
)

from .api_helpers import client_for
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db

Status = PaymentRequest.Status


def suspend(center, reason="Licence sanitaire expirée."):
    """Through the model (the platform service is covered elsewhere): this
    module is about the EFFECTS of the state, not about who sets it."""
    center.kyc_status = HealthCenter.KycStatus.SUSPENDED
    center.kyc_reason = reason
    center.save(update_fields=["kyc_status", "kyc_reason", "updated_at"])
    return center


# ---------------------------------------------------------------------------
# ❌ The diaspora rail closes — all along the chain, not only at the ends
# ---------------------------------------------------------------------------


class TestDiasporaRailCloses:
    def test_a_payment_request_can_no_longer_be_created(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        suspend(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            services.create_payment_request(
                actor=scn.cashier, invoice=scn.invoice
            )
        assert not PaymentRequest.objects.exists()

    def test_an_existing_request_can_no_longer_be_shared(self):
        scn = build_scenario(status=Status.DRAFT)
        suspend(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            services.share_payment_request(
                actor=scn.cashier,
                payment_request=scn.payment_request,
                guardian_link=scn.link,
            )

    def test_a_shared_request_can_no_longer_be_sent(self):
        """The SMS « payez » must not leave for a rail that will refuse the
        payment: the guardian would be summoned in front of a dead button."""
        scn = build_scenario(status=Status.DRAFT)
        services.share_payment_request(
            actor=scn.cashier,
            payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        suspend(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.DRAFT

    def test_a_guardian_can_no_longer_open_an_intent(self):
        scn = build_scenario(status=Status.SENT)
        suspend(scn.center)
        with pytest.raises(ValidationError, match="suspendu"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )

    def test_the_api_hands_the_staff_the_suspension_explanation(self):
        scn = build_scenario(status=Status.DRAFT)
        suspend(scn.center)
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/share/",
            {"guardian_link": scn.link.pk},
        )
        assert response.status_code == 400
        assert KYC_SUSPENDED_MESSAGE in str(response.data)


class TestPendingAndSuspendedAreTwoDifferentStories:
    def test_the_messages_differ(self):
        assert KYC_PENDING_MESSAGE != KYC_SUSPENDED_MESSAGE
        # Both keep the word « KYC » (historical regressions match on it)…
        assert "KYC" in KYC_PENDING_MESSAGE and "KYC" in KYC_SUSPENDED_MESSAGE
        # …and both end on the same reassurance: the desk stays open.
        assert "caisse du centre reste ouverte" in KYC_PENDING_MESSAGE
        assert "caisse du centre reste ouverte" in KYC_SUSPENDED_MESSAGE

    def test_a_pending_center_gets_the_pending_explanation(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        scn.center.kyc_status = HealthCenter.KycStatus.PENDING
        scn.center.save(update_fields=["kyc_status", "updated_at"])
        with pytest.raises(ValidationError) as excinfo:
            services.create_payment_request(
                actor=scn.cashier, invoice=scn.invoice
            )
        assert excinfo.value.messages == [KYC_PENDING_MESSAGE]

    def test_a_suspended_center_gets_the_suspension_explanation(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        suspend(scn.center)
        with pytest.raises(ValidationError) as excinfo:
            services.create_payment_request(
                actor=scn.cashier, invoice=scn.invoice
            )
        assert excinfo.value.messages == [KYC_SUSPENDED_MESSAGE]


# ---------------------------------------------------------------------------
# ✅ Care, exploitation and the CASH DESK keep working
# ---------------------------------------------------------------------------


class TestEverythingElseKeepsWorking:
    def test_the_cash_desk_still_cashes_in(self):
        """THE arbitrage of the sprint: a suspended center keeps billing
        and being paid by the patient standing at its counter."""
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        suspend(scn.center)

        payment = services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=CashPayment.Method.CASH,
            amount_kmf=scn.invoice.total_kmf,
            operator="", reference="", idempotency_key="",
        )
        assert payment.ledger_transaction is not None
        assert payment.cash_receipt is not None  # série « G- » émise
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("0.00")

    def test_the_cash_desk_still_cashes_in_through_the_api(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        suspend(scn.center)
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/payments/",
            {"method": "especes", "amount_kmf": "15000"},
        )
        assert response.status_code == 201, response.content

    def test_consultations_carnet_and_invoicing_keep_running(self):
        scn = build_scenario(status="facture_brouillon")
        suspend(scn.center)
        practitioner = StaffMembership.objects.for_center(scn.center).get(
            user=scn.doctor
        )
        encounter = medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, practitioner=practitioner,
            patient=scn.patient, reason="Fièvre",
            tariff_items=[scn.tariff],
        )
        entry = medical_services.create_record_entry(
            actor=scn.doctor, encounter=encounter,
            entry_type=HealthRecordEntry.EntryType.HISTORY,
            content="Paludisme en 2024.",
        )
        assert entry.pk is not None
        invoice = services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=encounter
        )
        services.issue_invoice(actor=scn.cashier, invoice=invoice)
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.ISSUED

    def test_appointments_keep_being_booked(self):
        scn = build_scenario(status="facture_brouillon")
        suspend(scn.center)
        slot = timezone.make_aware(
            datetime.combine(
                timezone.localdate() + timedelta(days=2), time(9, 30)
            )
        )
        appointment = scheduling_services.create_appointment(
            created_by=scn.cashier, center=scn.center, patient=scn.patient,
            scheduled_at=slot, reason="Contrôle",
        )
        assert appointment.pk is not None

    def test_the_patient_still_reads_their_carnet(self):
        scn = build_scenario(status="facture_brouillon")
        suspend(scn.center)
        response = client_for(scn.patient_user).get(
            "/api/v1/patients/me/encounters/"
        )
        assert response.status_code == 200
        assert response.data["count"] >= 1


# ---------------------------------------------------------------------------
# ✅ A guardian who has ALREADY paid is never left without a receipt
# ---------------------------------------------------------------------------


class TestAlreadyPaidRequestsGoToTheirTerm:
    def test_confirm_care_close_and_receipt_survive_a_suspension(self):
        scn = build_scenario(status=Status.PAID)
        suspend(scn.center)

        services.confirm_care(
            actor=scn.doctor, payment_request=scn.payment_request
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.CARE_CONFIRMED

        receipt = services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert receipt.pk is not None
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.CLOSED

    def test_the_guardian_still_reads_the_receipt_of_a_suspended_center(self):
        scn = build_scenario(status=Status.CLOSED)
        suspend(scn.center)
        response = client_for(scn.guardian_user).get("/api/v1/guardian/receipts/")
        assert response.status_code == 200
        assert response.data["count"] == 1

    def test_the_patient_still_acknowledges_the_care(self):
        scn = build_scenario(status=Status.PAID)
        suspend(scn.center)
        services.acknowledge_care_received(
            patient_user=scn.patient_user,
            payment_request=scn.payment_request,
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.patient_acknowledged_at is not None

    def test_a_dispute_can_still_be_opened_on_a_suspended_center(self):
        """A suspension is often the CONSEQUENCE of a problem: closing the
        dispute door at the same moment would silence the very people the
        suspension protects."""
        scn = build_scenario(status=Status.PAID)
        suspend(scn.center)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request,
            reason="Le soin n'a pas été réalisé.",
        )
        assert dispute.pk is not None
