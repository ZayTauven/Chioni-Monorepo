"""S1 — invoice cancellation (`POST /centers/{c}/invoices/{pk}/cancel/`).

ADR 0015 addendum: the clean re-invoicing path. Strict conditions locked
here: mandatory reason (stored on the row, NEVER in the audit payload),
never with an active cash-in, never once the linked request moved money
or opened a dispute, mirror anti-double-débit guard, diaspora rail closed
after cancellation (quote/pay/webhook all refuse), acts freed for a fresh
invoice, no SMS.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, Invoice, PaymentIntent

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .trustbridge_helpers import Status, build_scenario, signed_webhook

pytestmark = pytest.mark.django_db


def cancel_url(scn):
    return f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/cancel/"


def age_intent(intent, minutes=60):
    PaymentIntent.objects.filter(pk=intent.pk).update(
        created_at=timezone.now() - timedelta(minutes=minutes)
    )


class TestCancelHappyPaths:
    def test_cashier_cancels_an_issued_invoice_without_payments(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Erreur de saisie des actes"}
        )
        assert response.status_code == 200, response.content
        assert response.data["status"] == Invoice.Status.CANCELLED
        assert response.data["cancel_reason"] == "Erreur de saisie des actes"
        assert response.data["cancelled_at"] is not None
        scn.invoice.refresh_from_db()
        assert scn.invoice.cancelled_by == scn.cashier

    def test_a_draft_invoice_is_cancellable_too(self):
        scn = build_scenario(status="facture_brouillon")
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Doublon de facture"}
        )
        assert response.status_code == 200
        assert response.data["status"] == Invoice.Status.CANCELLED

    def test_cancellation_frees_the_acts_for_a_fresh_invoice(self):
        """The re-invoicing path: the cancelled invoice's acts are billable
        again (create_invoice excludes cancelled invoices)."""
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Mauvais acte"
        )
        fresh = services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=scn.encounter
        )
        assert fresh.pk != scn.invoice.pk
        assert fresh.total_kmf == Decimal("15000.00")

    def test_reversed_payments_do_not_block_cancellation(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        payment = services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=CashPayment.Method.CASH, amount_kmf=Decimal("5000"),
        )
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur de caisse"
        )
        invoice = services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Facture erronée"
        )
        assert invoice.status == Invoice.Status.CANCELLED

    def test_audit_entry_carries_references_never_the_reason(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        secret_reason = "Le patient conteste la présence du Dr X"
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason=secret_reason
        )
        entry = AuditLog.objects.get(action=AuditAction.INVOICE_CANCELLED)
        assert entry.payload["invoice_id"] == scn.invoice.pk
        assert entry.payload["status_before"] == Invoice.Status.ISSUED
        assert secret_reason not in str(entry.payload)


class TestCancelStrictConditions:
    def test_reason_is_mandatory(self):
        scn = build_scenario(status="facture_brouillon")
        assert client_for(scn.cashier).post(cancel_url(scn), {}).status_code == 400
        assert (
            client_for(scn.cashier).post(cancel_url(scn), {"reason": "  "}).status_code
            == 400
        )
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.DRAFT

    def test_active_cash_payment_blocks_cancellation(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=CashPayment.Method.CASH, amount_kmf=Decimal("5000"),
        )
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Tentative"}
        )
        assert response.status_code == 400
        assert "contre-pass" in str(response.data)

    def test_paid_invoice_is_never_cancellable(self):
        scn = build_scenario(status=Status.PAID)
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Tentative"}
        )
        assert response.status_code == 400
        assert "réglée" in str(response.data)

    def test_already_cancelled_is_a_clean_400(self):
        scn = build_scenario(status="facture_brouillon")
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Premier motif"
        )
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Second motif"}
        )
        assert response.status_code == 400
        scn.invoice.refresh_from_db()
        assert scn.invoice.cancel_reason == "Premier motif"  # jamais réécrit

    @pytest.mark.parametrize(
        "stage", [Status.PAID, Status.CARE_CONFIRMED, Status.CLOSED]
    )
    def test_request_that_moved_money_blocks_cancellation(self, stage):
        scn = build_scenario(status=stage)
        with pytest.raises(ValidationError):
            services.cancel_invoice(
                actor=scn.cashier, invoice=scn.invoice, reason="Tentative"
            )

    def test_open_dispute_blocks_cancellation(self):
        scn = build_scenario(status=Status.SENT)
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="Montant contesté",
        )
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Tentative"}
        )
        assert response.status_code == 400
        assert "litige" in str(response.data)

    def test_recent_pending_intent_blocks_for_a_few_minutes(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        response = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Tentative"}
        )
        assert response.status_code == 400
        assert "Attendez quelques minutes" in str(response.data)

        age_intent(intent)  # beyond the guard window: abandoned 3DS
        aged = client_for(scn.cashier).post(
            cancel_url(scn), {"reason": "Plus personne ne paie"}
        )
        assert aged.status_code == 200, aged.content

    def test_roles_and_tenancy(self):
        scn = build_scenario(status="facture_brouillon")
        assert (
            client_for(scn.doctor).post(cancel_url(scn), {"reason": "x"}).status_code
            == 403
        )
        other_center, other_director = make_center_with_director()
        foreign = client_for(other_director).post(
            f"/api/v1/centers/{other_center.pk}/invoices/{scn.invoice.pk}/cancel/",
            {"reason": "chez le voisin"},
        )
        assert foreign.status_code == 404
        assert client_for().post(cancel_url(scn), {"reason": "x"}).status_code == 401


class TestDiasporaRailClosedAfterCancellation:
    def _cancelled_sent_scenario(self):
        """Request ``envoyee`` whose invoice is then cancelled — the honest
        limitation of ADR 0015 §4: the request keeps its status, the rail
        answers 400 everywhere."""
        scn = build_scenario(status=Status.SENT)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Erreur de facturation"
        )
        return scn

    def test_request_stays_sent_but_quote_and_pay_refuse(self):
        scn = self._cancelled_sent_scenario()
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.SENT  # documenté
        client = client_for(scn.guardian_user)
        base = f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}"
        quote = client.get(f"{base}/quote/")
        assert quote.status_code == 400
        assert "annulée" in str(quote.data)
        pay = client.post(f"{base}/pay/")
        assert pay.status_code == 400
        assert "annulée" in str(pay.data)

    def test_late_webhook_after_cancellation_is_refused_and_audited(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        age_intent(intent)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Annulée pendant le 3DS"
        )
        payload, signature = signed_webhook(intent.psp_reference)
        response = client_for().generic(
            "POST", "/api/v1/trustbridge/webhooks/psp/",
            data=payload, content_type="application/json",
            HTTP_X_PSP_SIGNATURE=signature,
        )
        assert response.status_code == 400
        refusal = AuditLog.objects.filter(
            action=AuditAction.PAYMENT_WEBHOOK_REFUSED
        ).latest("id")
        assert refusal.payload["refusal"] == "invoice_cancelled"
        assert not CashPayment.objects.filter(invoice=scn.invoice).exists()

    def test_no_sms_leaves_on_cancellation(self, sms_outbox):
        """Décision documentée (ADR 0015 addendum) : le contenu d'un SMS
        suit la visibilité dans l'app — l'app ne montre aucun événement
        « annulation » au tuteur, donc aucun SMS ne part."""
        scn = build_scenario(status=Status.SENT)
        sms_outbox.clear()  # drop the invitation/send notifications
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Erreur"
        )
        assert sms_outbox == []

    def test_cancelled_invoice_refuses_new_payment_requests(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Erreur"
        )
        scn.invoice.refresh_from_db()  # the API path always re-fetches
        with pytest.raises(ValidationError):
            services.create_payment_request(actor=scn.cashier, invoice=scn.invoice)
