"""Caisse du centre — API contract of ADR 0015.

Same refusal semantics as every other family (ADR 0008): anonymous → 401 ;
center where the caller holds no membership → 404 (invisible) ; member
without a billing role → 403 ; cross-tenant invoice/payment probes → 404 ;
business refusals → explicit French 400. The cash journal uses Comoros
local-day bounds, shows reversals signed, and totals per method. Counter
receipts are readable by the center (billing) and the patient — NEVER by
a guardian (the « paiements » scope only opens requests shared with them).
"""

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, Invoice, MobileMoneyOperator

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

Method = CashPayment.Method

#: Exact field contracts (asserted, not just spot-checked).
#: SV : ``received_by_display``/``reversed_by_display`` (redevabilité de la
#: caisse, audience staff BILLING) et ``invoice`` sur la contre-passation
#: (navigabilité du journal) — champs AJOUTÉS, jamais retirés.
CASH_PAYMENT_FIELDS = {
    "id", "invoice", "method", "operator", "reference", "amount_kmf",
    "received_by", "received_by_display", "payment_intent",
    "ledger_transaction", "receipt", "reversal", "created_at",
}
CASH_RECEIPT_FIELDS = {
    "id", "receipt_number", "sequence_number", "center", "center_name",
    "amount_kmf", "method", "issued_at",
}
REVERSAL_FIELDS = {
    "id", "cash_payment", "invoice", "method", "amount_kmf", "reason",
    "reversed_by", "reversed_by_display", "ledger_transaction", "created_at",
}
PATIENT_CASH_RECEIPT_FIELDS = {
    "id", "receipt_number", "center_name", "amount_kmf", "method",
    "reversed", "issued_at",
}


def counter_scenario(price_kmf="20000"):
    scn = build_scenario(status="facture_brouillon", price_kmf=price_kmf)
    services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
    scn.invoice.refresh_from_db()
    return scn


def payments_url(scn):
    return f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/payments/"


def reverse_url(scn, payment):
    return (
        f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}"
        f"/payments/{payment.pk}/reverse/"
    )


def journal_url(scn, date=None):
    url = f"/api/v1/centers/{scn.center.pk}/cash-journal/"
    return f"{url}?date={date}" if date else url


def post_cash(scn, user=None, **overrides):
    body = {"method": "especes", "amount_kmf": "5000"}
    body.update(overrides)
    return client_for(user or scn.cashier).post(
        payments_url(scn), body, format="json"
    )


# ---------------------------------------------------------------------------
# POST /centers/{c}/invoices/{pk}/payments/
# ---------------------------------------------------------------------------


class TestRecordPaymentEndpoint:
    def test_anonymous_is_401(self):
        scn = counter_scenario()
        assert client_for().post(payments_url(scn), {}).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        scn = counter_scenario()
        other_center, _ = make_center_with_director()
        outsider = make_staff_user(other_center, role=Role.CASHIER)
        assert post_cash(scn, user=outsider).status_code == 404

    def test_doctor_gets_403(self):
        scn = counter_scenario()
        assert post_cash(scn, user=scn.doctor).status_code == 403

    def test_cross_tenant_invoice_is_404(self):
        scn = counter_scenario()
        other = counter_scenario()
        url = (
            f"/api/v1/centers/{scn.center.pk}/invoices/"
            f"{other.invoice.pk}/payments/"
        )
        response = client_for(scn.cashier).post(
            url, {"method": "especes", "amount_kmf": "5000"}, format="json"
        )
        assert response.status_code == 404

    def test_cashier_records_cash_and_gets_the_receipt(self):
        scn = counter_scenario()
        response = post_cash(scn)
        assert response.status_code == 201, response.content
        assert set(response.data.keys()) == CASH_PAYMENT_FIELDS
        assert response.data["method"] == "especes"
        assert Decimal(response.data["amount_kmf"]) == Decimal("5000")
        assert response.data["received_by"] == scn.cashier.pk
        assert response.data["reversal"] is None
        receipt = response.data["receipt"]
        assert set(receipt.keys()) == CASH_RECEIPT_FIELDS
        assert receipt["receipt_number"] == "G-000001"
        assert Decimal(receipt["amount_kmf"]) == Decimal("5000")

    def test_director_and_secretary_may_record(self):
        scn = counter_scenario()
        secretary = make_staff_user(scn.center, role=Role.SECRETARY)
        assert post_cash(scn, user=scn.director).status_code == 201
        assert post_cash(scn, user=secretary).status_code == 201

    def test_mobile_money_requires_an_operator(self):
        scn = counter_scenario()
        response = post_cash(scn, method="mobile_money")
        assert response.status_code == 400
        assert "opérateur" in str(response.data)

    def test_mobile_money_with_operator_is_recorded(self):
        scn = counter_scenario()
        response = post_cash(
            scn, method="mobile_money",
            operator=MobileMoneyOperator.HURI.value, reference="MM-42",
        )
        assert response.status_code == 201
        assert response.data["operator"] == "huri"
        assert response.data["reference"] == "MM-42"

    def test_kmf_decimals_are_refused(self):
        scn = counter_scenario()
        response = post_cash(scn, amount_kmf="5000.50")
        assert response.status_code == 400
        assert "décimales" in str(response.data)

    def test_trust_bridge_method_is_refused_with_a_teaching_message(self):
        scn = counter_scenario()
        response = post_cash(scn, method="pont_confiance")
        assert response.status_code == 400
        assert "jamais saisi au guichet" in str(response.data)

    def test_overshoot_is_a_400(self):
        scn = counter_scenario()
        assert post_cash(scn, amount_kmf="15000").status_code == 201
        response = post_cash(scn, amount_kmf="6000")
        assert response.status_code == 400
        assert "dépasse" in str(response.data)

    def test_draft_invoice_is_a_400(self):
        scn = build_scenario(status="facture_brouillon")
        response = post_cash(scn)
        assert response.status_code == 400
        assert "brouillon" in str(response.data)

    def test_settled_invoice_is_a_400(self):
        scn = counter_scenario()
        assert post_cash(scn, amount_kmf="20000").status_code == 201
        response = post_cash(scn, amount_kmf="1000")
        assert response.status_code == 400
        assert "déjà entièrement réglée" in str(response.data)

    def test_full_payment_settles_the_invoice(self):
        scn = counter_scenario()
        post_cash(scn, amount_kmf="12000")
        post_cash(scn, amount_kmf="8000")
        detail = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/"
        )
        assert detail.data["status"] == Invoice.Status.PAID
        assert Decimal(detail.data["paid_kmf"]) == Decimal("20000")
        assert Decimal(detail.data["balance_kmf"]) == Decimal("0")

    def test_get_lists_the_invoice_payments(self):
        scn = counter_scenario()
        post_cash(scn, amount_kmf="12000")
        post_cash(
            scn, method="mobile_money",
            operator=MobileMoneyOperator.MVOLA.value, amount_kmf="8000",
        )
        response = client_for(scn.cashier).get(payments_url(scn))
        assert response.status_code == 200
        assert [row["method"] for row in response.data] == [
            "especes", "mobile_money",
        ]


# ---------------------------------------------------------------------------
# POST .../payments/{pk}/reverse/
# ---------------------------------------------------------------------------


class TestReverseEndpoint:
    def _paid(self, scn, amount="5000"):
        response = post_cash(scn, amount_kmf=amount)
        assert response.status_code == 201
        return CashPayment.objects.get(pk=response.data["id"])

    def test_reversal_is_recorded_and_signed(self):
        scn = counter_scenario()
        payment = self._paid(scn, amount="20000")
        response = client_for(scn.cashier).post(
            reverse_url(scn, payment), {"reason": "Erreur de saisie"},
            format="json",
        )
        assert response.status_code == 201, response.content
        reversal = response.data["reversal"]
        assert set(reversal.keys()) == REVERSAL_FIELDS
        assert reversal["reason"] == "Erreur de saisie"
        assert reversal["reversed_by"] == scn.cashier.pk
        assert Decimal(reversal["amount_kmf"]) == Decimal("20000")
        # Honest status effect: the invoice owes the money again.
        detail = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/"
        )
        assert detail.data["status"] == Invoice.Status.ISSUED
        assert Decimal(detail.data["balance_kmf"]) == Decimal("20000")

    def test_missing_reason_is_a_400(self):
        scn = counter_scenario()
        payment = self._paid(scn)
        response = client_for(scn.cashier).post(
            reverse_url(scn, payment), {}, format="json"
        )
        assert response.status_code == 400
        assert "motif" in str(response.data)

    def test_second_reversal_is_a_400(self):
        scn = counter_scenario()
        payment = self._paid(scn)
        first = client_for(scn.cashier).post(
            reverse_url(scn, payment), {"reason": "Erreur"}, format="json"
        )
        assert first.status_code == 201
        second = client_for(scn.cashier).post(
            reverse_url(scn, payment), {"reason": "Encore"}, format="json"
        )
        assert second.status_code == 400
        assert "déjà été contre-passé" in str(second.data)

    def test_doctor_gets_403(self):
        scn = counter_scenario()
        payment = self._paid(scn)
        response = client_for(scn.doctor).post(
            reverse_url(scn, payment), {"reason": "Erreur"}, format="json"
        )
        assert response.status_code == 403

    def test_foreign_center_payment_is_404(self):
        scn = counter_scenario()
        payment = self._paid(scn)
        other_center, other_director = make_center_with_director()
        url = (
            f"/api/v1/centers/{other_center.pk}/invoices/{scn.invoice.pk}"
            f"/payments/{payment.pk}/reverse/"
        )
        response = client_for(other_director).post(
            url, {"reason": "Erreur"}, format="json"
        )
        assert response.status_code == 404

    def test_payment_of_another_invoice_is_404(self):
        scn = counter_scenario()
        payment = self._paid(scn)
        other = counter_scenario()  # other center, other invoice
        url = (
            f"/api/v1/centers/{scn.center.pk}/invoices/{other.invoice.pk}"
            f"/payments/{payment.pk}/reverse/"
        )
        response = client_for(scn.cashier).post(
            url, {"reason": "Erreur"}, format="json"
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /centers/{c}/cash-journal/
# ---------------------------------------------------------------------------


class TestCashJournal:
    def test_anonymous_is_401(self):
        scn = counter_scenario()
        assert client_for().get(journal_url(scn)).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        scn = counter_scenario()
        other_center, _ = make_center_with_director()
        outsider = make_staff_user(other_center, role=Role.CASHIER)
        assert client_for(outsider).get(journal_url(scn)).status_code == 404

    def test_doctor_gets_403(self):
        scn = counter_scenario()
        assert client_for(scn.doctor).get(journal_url(scn)).status_code == 403

    def test_default_day_totals_by_method_with_signed_reversals(self):
        scn = counter_scenario()
        cash = post_cash(scn, amount_kmf="5000")
        post_cash(
            scn, method="mobile_money",
            operator=MobileMoneyOperator.HURI.value, amount_kmf="3000",
        )
        client_for(scn.cashier).post(
            reverse_url(scn, CashPayment.objects.get(pk=cash.data["id"])),
            {"reason": "Erreur de saisie"},
            format="json",
        )
        response = client_for(scn.cashier).get(journal_url(scn))
        assert response.status_code == 200
        data = response.data
        assert data["date"] == str(timezone.localdate())
        assert len(data["payments"]) == 2
        assert len(data["reversals"]) == 1
        reversal = data["reversals"][0]
        assert reversal["reason"] == "Erreur de saisie"
        assert reversal["reversed_by"] == scn.cashier.pk
        totals = data["totals"]
        assert Decimal(totals["especes"]["encaisse_kmf"]) == Decimal("5000")
        assert Decimal(totals["especes"]["contre_passe_kmf"]) == Decimal("5000")
        assert Decimal(totals["especes"]["net_kmf"]) == Decimal("0")
        assert Decimal(totals["mobile_money"]["net_kmf"]) == Decimal("3000")
        assert Decimal(totals["pont_confiance"]["net_kmf"]) == Decimal("0")
        assert Decimal(totals["total"]["encaisse_kmf"]) == Decimal("8000")
        assert Decimal(totals["total"]["net_kmf"]) == Decimal("3000")

    def test_trust_bridge_payments_appear_in_the_journal(self):
        scn = build_scenario(status=Status.PAID)
        response = client_for(scn.cashier).get(journal_url(scn))
        assert response.status_code == 200
        methods = [row["method"] for row in response.data["payments"]]
        assert methods == ["pont_confiance"]
        row = response.data["payments"][0]
        assert row["receipt"] is None  # its receipt is the diaspora one
        totals = response.data["totals"]
        assert Decimal(totals["pont_confiance"]["encaisse_kmf"]) == Decimal(
            "15000"
        )

    def test_date_filter_uses_the_comoros_local_day(self):
        scn = counter_scenario()
        post_cash(scn)
        today = timezone.localdate()
        on_day = client_for(scn.cashier).get(journal_url(scn, date=str(today)))
        assert len(on_day.data["payments"]) == 1
        day_before = client_for(scn.cashier).get(
            journal_url(scn, date=str(today - timezone.timedelta(days=1)))
        )
        assert day_before.data["payments"] == []
        assert Decimal(
            day_before.data["totals"]["total"]["encaisse_kmf"]
        ) == Decimal("0")

    def test_malformed_and_impossible_dates_answer_400(self):
        scn = counter_scenario()
        for bad in ("13-08-2026", "2026-02-30", "n'importe quoi"):
            response = client_for(scn.cashier).get(journal_url(scn, date=bad))
            assert response.status_code == 400, bad

    def test_journal_is_tenant_scoped(self):
        scn = counter_scenario()
        post_cash(scn)
        other = counter_scenario()
        response = client_for(other.cashier).get(journal_url(other))
        assert response.status_code == 200
        assert response.data["payments"] == []


# ---------------------------------------------------------------------------
# GET /patients/me/cash-receipts/ — and what guardians never see
# ---------------------------------------------------------------------------


class TestPatientCashReceipts:
    def test_patient_sees_their_counter_receipts(self):
        scn = counter_scenario()
        post_cash(scn)
        response = client_for(scn.patient_user).get(
            "/api/v1/patients/me/cash-receipts/"
        )
        assert response.status_code == 200
        rows = response.data["results"]
        assert len(rows) == 1
        assert set(rows[0].keys()) == PATIENT_CASH_RECEIPT_FIELDS
        assert rows[0]["receipt_number"] == "G-000001"
        assert rows[0]["reversed"] is False

    def test_reversed_flag_is_honest(self):
        scn = counter_scenario()
        paid = post_cash(scn)
        client_for(scn.cashier).post(
            reverse_url(scn, CashPayment.objects.get(pk=paid.data["id"])),
            {"reason": "Erreur"},
            format="json",
        )
        response = client_for(scn.patient_user).get(
            "/api/v1/patients/me/cash-receipts/"
        )
        assert response.data["results"][0]["reversed"] is True

    def test_another_patient_sees_nothing(self):
        scn = counter_scenario()
        post_cash(scn)
        other = counter_scenario()
        response = client_for(other.patient_user).get(
            "/api/v1/patients/me/cash-receipts/"
        )
        assert response.data["results"] == []

    def test_guardian_has_no_access_to_counter_receipts(self):
        """ADR 0015 — the guardian's « paiements » scope only opens the
        requests shared with THEM: what the patient pays with their own
        money at the counter is invisible, on every route."""
        scn = counter_scenario()
        post_cash(scn)
        # The patient space refuses the guardian hat outright…
        response = client_for(scn.guardian_user).get(
            "/api/v1/patients/me/cash-receipts/"
        )
        assert response.status_code == 403
        # …and the guardian receipt list never carries counter receipts.
        receipts = client_for(scn.guardian_user).get("/api/v1/guardian/receipts/")
        assert receipts.status_code == 200
        assert receipts.data["results"] == []

    def test_staff_without_patient_profile_gets_403(self):
        scn = counter_scenario()
        post_cash(scn)
        response = client_for(scn.cashier).get(
            "/api/v1/patients/me/cash-receipts/"
        )
        assert response.status_code == 403
