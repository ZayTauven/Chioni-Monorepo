"""Trust Bridge API — permission matrix, guardian field contract, flows.

Same contract as phase A (`test_api_*.py`): anonymous → 401 ; wrong hat →
403/404 ; cross-center / cross-patient / cross-guardian IDOR → 404 ;
guardian payloads are asserted on FIELDS (never a `label`, ADR 0005);
every state change flows through the services (a 400 on any illegal
transition).
"""

import json
from decimal import Decimal

import pytest

from apps.trustbridge import services
from apps.trustbridge.models import (
    Dispute,
    Invoice,
    PaymentIntent,
    PaymentRequest,
    Receipt,
)

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_user
from .trustbridge_helpers import (
    SENSITIVE_LABEL,
    Status,
    add_shared_guardian,
    build_scenario,
    signed_webhook,
)

pytestmark = pytest.mark.django_db

#: Exact field contracts (asserted, not just spot-checked).
GUARDIAN_PR_FIELDS = {
    "id", "patient", "center_name", "total_kmf", "status", "lines", "created_at",
}
GUARDIAN_LINE_FIELDS = {"generic_category", "amount_kmf"}
RECEIPT_FIELDS = {
    "id", "payment_request", "center", "center_name", "receipt_number",
    "amount_eur_paid", "fees_eur", "amount_kmf_received", "exchange_rate",
    "issued_at",
}


def post_webhook(client, payload, signature):
    return client.generic(
        "POST",
        "/api/v1/trustbridge/webhooks/psp/",
        data=payload,
        content_type="application/json",
        HTTP_X_PSP_SIGNATURE=signature,
    )


def pay_via_api(scn, guardian_user=None):
    """Guardian pays through the API, provider confirms via webhook."""
    client = client_for(guardian_user or scn.guardian_user)
    paid = client.post(
        f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
    )
    assert paid.status_code == 201, paid.content
    reference = paid.data["psp_reference"]
    payload, signature = signed_webhook(reference)
    hook = post_webhook(client_for(), payload, signature)
    assert hook.status_code == 200, hook.content
    return paid.data


# ---------------------------------------------------------------------------
# STAFF — invoices
# ---------------------------------------------------------------------------


class TestStaffInvoiceEndpoints:
    def test_anonymous_is_401(self):
        scn = build_scenario(status="facture_brouillon")
        url = f"/api/v1/centers/{scn.center.pk}/invoices/"
        assert client_for().get(url).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        scn = build_scenario(status="facture_brouillon")
        other_center, _ = make_center_with_director()
        outsider = make_staff_user(other_center, role=Role.CASHIER)
        url = f"/api/v1/centers/{scn.center.pk}/invoices/"
        assert client_for(outsider).get(url).status_code == 404

    def test_doctor_cannot_create_an_invoice_403(self):
        scn = build_scenario(status="facture_brouillon")
        response = client_for(scn.doctor).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/",
            {"encounter": scn.encounter.pk},
        )
        assert response.status_code == 403

    def test_cashier_creates_issues_and_opens_a_request(self):
        scn = build_scenario(status="facture_brouillon")
        # The helper already built one DRAFT invoice; drive the API on it.
        client = client_for(scn.cashier)
        base = f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}"

        issued = client.post(f"{base}/issue/")
        assert issued.status_code == 200, issued.content
        assert issued.data["status"] == Invoice.Status.ISSUED

        request_created = client.post(f"{base}/payment-requests/")
        assert request_created.status_code == 201, request_created.content
        assert request_created.data["status"] == Status.DRAFT
        assert Decimal(request_created.data["total_kmf"]) == Decimal("15000.00")

    def test_invoice_creation_snapshots_the_encounter_acts(self):
        scn = build_scenario(status="facture_brouillon")
        # Bill a fresh encounter through the API.
        from apps.medical.models import ActPerformed
        from .factories import make_encounter, make_tariff

        encounter = make_encounter(patient=scn.patient, center=scn.center)
        tariff = make_tariff(scn.center, label="Consultation générale")
        ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)

        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/",
            {"encounter": encounter.pk},
        )
        assert response.status_code == 201, response.content
        assert len(response.data["lines"]) == 1
        assert response.data["lines"][0]["label"] == "Consultation générale"

    def test_billing_an_encounter_of_another_center_is_404(self):
        scn = build_scenario(status="facture_brouillon")
        foreign = build_scenario(status="facture_brouillon")
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/",
            {"encounter": foreign.encounter.pk},
        )
        assert response.status_code == 404

    def test_invoice_list_is_center_scoped(self):
        scn = build_scenario(status="facture_brouillon")
        build_scenario(status="facture_brouillon")  # another center's invoice
        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/"
        )
        assert response.status_code == 200
        assert [i["id"] for i in response.data["results"]] == [scn.invoice.pk]


# ---------------------------------------------------------------------------
# STAFF — payment requests lifecycle
# ---------------------------------------------------------------------------


class TestStaffPaymentRequestEndpoints:
    def test_share_send_flow(self):
        scn = build_scenario(status=Status.DRAFT)
        client = client_for(scn.cashier)
        base = f"/api/v1/centers/{scn.center.pk}/payment-requests/{scn.payment_request.pk}"

        sent_too_early = client.post(f"{base}/send/")
        assert sent_too_early.status_code == 400  # no share yet

        shared = client.post(f"{base}/share/", {"guardian_link": scn.link.pk})
        assert shared.status_code == 201, shared.content

        sent = client.post(f"{base}/send/")
        assert sent.status_code == 200, sent.content
        assert sent.data["status"] == Status.SENT

    def test_share_with_a_foreign_patients_link_is_404(self):
        scn = build_scenario(status=Status.DRAFT)
        _, other_profile = make_guardian_user()
        foreign_link = make_active_link(
            other_profile, make_claimed_patient(first_name="Anfia")
        )
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/share/",
            {"guardian_link": foreign_link.pk},
        )
        assert response.status_code == 404  # invisible, not merely refused

    def test_share_with_an_inactive_link_is_400(self):
        scn = build_scenario(status=Status.DRAFT)
        scn.link.revoke()
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/share/",
            {"guardian_link": scn.link.pk},
        )
        assert response.status_code == 400

    def test_unshare_removes_guardian_access_immediately(self):
        scn = build_scenario(status=Status.SENT)
        guardian_client = client_for(scn.guardian_user)
        url = f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/"
        assert guardian_client.get(url).status_code == 200

        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/unshare/",
            {"guardian_link": scn.link.pk},
        )
        assert response.status_code == 200
        assert guardian_client.get(url).status_code == 404

    def test_confirm_care_requires_a_care_role(self):
        scn = build_scenario(status=Status.PAID)
        base = (
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}"
        )
        refused = client_for(scn.cashier).post(f"{base}/confirm-care/")
        assert refused.status_code == 403  # cashier: money yes, care no

        confirmed = client_for(scn.doctor).post(f"{base}/confirm-care/")
        assert confirmed.status_code == 200, confirmed.content
        assert confirmed.data["status"] == Status.CARE_CONFIRMED

    def test_close_returns_the_receipt(self):
        scn = build_scenario(status=Status.CARE_CONFIRMED)
        response = client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/close/"
        )
        assert response.status_code == 201, response.content
        assert set(response.data.keys()) == RECEIPT_FIELDS
        assert response.data["receipt_number"] == 1

    def test_illegal_transitions_are_400_from_the_api(self):
        scn = build_scenario(status=Status.SENT)
        client = client_for(scn.doctor)
        base = (
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}"
        )
        assert client.post(f"{base}/confirm-care/").status_code == 400
        assert client_for(scn.cashier).post(f"{base}/close/").status_code == 400

    def test_request_list_and_detail_are_center_scoped(self):
        scn = build_scenario(status=Status.SENT)
        foreign = build_scenario(status=Status.SENT)
        client = client_for(scn.cashier)
        listing = client.get(f"/api/v1/centers/{scn.center.pk}/payment-requests/")
        assert [r["id"] for r in listing.data["results"]] == [scn.payment_request.pk]
        cross = client.get(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{foreign.payment_request.pk}/"
        )
        assert cross.status_code == 404


# ---------------------------------------------------------------------------
# STAFF — disputes
# ---------------------------------------------------------------------------


class TestStaffDisputeEndpoints:
    def test_disputes_are_readable_and_center_scoped(self):
        scn = build_scenario(status=Status.SENT)
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="montant contesté",
        )
        foreign = build_scenario(status=Status.SENT)
        services.open_dispute(
            actor_user=foreign.guardian_user,
            payment_request=foreign.payment_request, reason="autre litige",
        )
        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/disputes/"
        )
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["reason"] == "montant contesté"

    def test_resolution_is_director_only_with_a_note(self):
        scn = build_scenario(status=Status.SENT)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="montant contesté",
        )
        url = f"/api/v1/centers/{scn.center.pk}/disputes/{dispute.pk}/resolve/"

        refused = client_for(scn.cashier).post(url, {"resolution_note": "ok"})
        assert refused.status_code == 403

        missing_note = client_for(scn.director).post(url, {})
        assert missing_note.status_code == 400

        resolved = client_for(scn.director).post(
            url, {"resolution_note": "Grille tarifaire vérifiée avec la famille"}
        )
        assert resolved.status_code == 200, resolved.content
        assert resolved.data["status"] == Dispute.Status.RESOLVED

    def test_cross_center_dispute_resolution_is_404(self):
        scn = build_scenario(status=Status.SENT)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="montant",
        )
        other_center, other_director = make_center_with_director()
        response = client_for(other_director).post(
            f"/api/v1/centers/{other_center.pk}/disputes/{dispute.pk}/resolve/",
            {"resolution_note": "je résous chez le voisin"},
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# PATIENT — my requests, share, acknowledge, dispute, receipts
# ---------------------------------------------------------------------------


class TestPatientEndpoints:
    def test_anonymous_is_401_and_unclaimed_is_403(self):
        assert client_for().get("/api/v1/patients/me/payment-requests/").status_code == 401
        assert (
            client_for(make_user()).get("/api/v1/patients/me/payment-requests/").status_code
            == 403
        )

    def test_list_shows_only_my_requests(self):
        scn = build_scenario(status=Status.SENT)
        other = build_scenario(status=Status.SENT)
        response = client_for(scn.patient_user).get(
            "/api/v1/patients/me/payment-requests/"
        )
        assert response.status_code == 200
        assert [r["id"] for r in response.data["results"]] == [scn.payment_request.pk]
        cross = client_for(scn.patient_user).get(
            f"/api/v1/patients/me/payment-requests/{other.payment_request.pk}/"
        )
        assert cross.status_code == 404

    def test_patient_sees_their_own_care_labels(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.patient_user).get(
            f"/api/v1/patients/me/payment-requests/{scn.payment_request.pk}/"
        )
        assert response.status_code == 200
        assert response.data["lines"][0]["label"] == SENSITIVE_LABEL  # their carnet

    def test_patient_shares_their_request_with_their_link(self):
        scn = build_scenario(status=Status.DRAFT)
        response = client_for(scn.patient_user).post(
            f"/api/v1/patients/me/payment-requests/{scn.payment_request.pk}/share/",
            {"guardian_link": scn.link.pk},
        )
        assert response.status_code == 201, response.content
        assert scn.payment_request.shares.filter(guardian_link=scn.link).exists()

    def test_patient_cannot_share_with_a_foreign_link_404(self):
        scn = build_scenario(status=Status.DRAFT)
        _, other_profile = make_guardian_user()
        foreign_link = make_active_link(
            other_profile, make_claimed_patient(first_name="Anfia")
        )
        response = client_for(scn.patient_user).post(
            f"/api/v1/patients/me/payment-requests/{scn.payment_request.pk}/share/",
            {"guardian_link": foreign_link.pk},
        )
        assert response.status_code == 404

    def test_acknowledge_after_payment_is_stored(self):
        scn = build_scenario(status=Status.PAID)
        url = (
            f"/api/v1/patients/me/payment-requests/"
            f"{scn.payment_request.pk}/acknowledge/"
        )
        response = client_for(scn.patient_user).post(url)
        assert response.status_code == 200, response.content
        assert response.data["patient_acknowledged_at"] is not None
        again = client_for(scn.patient_user).post(url)
        assert again.status_code == 400  # single acknowledgement

    def test_acknowledge_before_payment_is_400(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.patient_user).post(
            f"/api/v1/patients/me/payment-requests/"
            f"{scn.payment_request.pk}/acknowledge/"
        )
        assert response.status_code == 400

    def test_patient_opens_a_dispute_with_a_reason(self):
        scn = build_scenario(status=Status.PAID)
        url = (
            f"/api/v1/patients/me/payment-requests/"
            f"{scn.payment_request.pk}/dispute/"
        )
        missing = client_for(scn.patient_user).post(url, {})
        assert missing.status_code == 400

        response = client_for(scn.patient_user).post(
            url, {"reason": "Je n'ai pas reçu ce soin"}
        )
        assert response.status_code == 201, response.content
        assert response.data["status"] == Status.DISPUTED

    def test_my_receipts_are_mine_only(self):
        scn = build_scenario(status=Status.CLOSED)
        build_scenario(status=Status.CLOSED)  # someone else's receipt
        response = client_for(scn.patient_user).get("/api/v1/patients/me/receipts/")
        assert response.status_code == 200
        assert [r["id"] for r in response.data["results"]] == [scn.receipt.pk]
        assert set(response.data["results"][0].keys()) == RECEIPT_FIELDS


# ---------------------------------------------------------------------------
# GUARDIAN — perimeter (F3), field contract (ADR 0005), payment
# ---------------------------------------------------------------------------


class TestGuardianPerimeter:
    def test_anonymous_is_401_and_non_guardian_is_403(self):
        assert client_for().get("/api/v1/guardian/payment-requests/").status_code == 401
        assert (
            client_for(make_user()).get("/api/v1/guardian/payment-requests/").status_code
            == 403
        )

    def test_only_shared_requests_are_visible(self):
        """F3 both halves: an ACTIVE link alone opens NOTHING — the share
        is required too."""
        scn = build_scenario(status=Status.SENT)
        unshared_user, unshared_profile = make_guardian_user()
        make_active_link(unshared_profile, scn.patient)  # active, never shared

        listing = client_for(unshared_user).get("/api/v1/guardian/payment-requests/")
        assert listing.status_code == 200
        assert listing.data["results"] == []
        detail = client_for(unshared_user).get(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/"
        )
        assert detail.status_code == 404

    def test_link_revocation_cuts_access_instantly(self):
        scn = build_scenario(status=Status.SENT)
        client = client_for(scn.guardian_user)
        url = f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/"
        assert client.get(url).status_code == 200
        scn.link.revoke()
        assert client.get(url).status_code == 404
        assert client.get("/api/v1/guardian/payment-requests/").data["results"] == []

    def test_cross_guardian_idor_is_404(self):
        scn = build_scenario(status=Status.SENT)
        foreign = build_scenario(status=Status.SENT)
        client = client_for(scn.guardian_user)
        for action in ("", "quote/", "pay/", "dispute/"):
            url = (
                f"/api/v1/guardian/payment-requests/"
                f"{foreign.payment_request.pk}/{action}"
            )
            response = client.post(url) if action in ("pay/", "dispute/") else client.get(url)
            assert response.status_code == 404, (action, response.status_code)

    def test_multi_guardians_all_shared_see_the_request(self):
        scn = build_scenario(status=Status.SENT)
        second = add_shared_guardian(scn)
        for user in (scn.guardian_user, second.guardian_user):
            listing = client_for(user).get("/api/v1/guardian/payment-requests/")
            assert [r["id"] for r in listing.data["results"]] == [
                scn.payment_request.pk
            ]


class TestGuardianFieldContract:
    def test_detail_exposes_generic_category_and_never_the_label(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.guardian_user).get(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/"
        )
        assert response.status_code == 200
        assert set(response.data.keys()) == GUARDIAN_PR_FIELDS
        assert len(response.data["lines"]) == 1
        line = response.data["lines"][0]
        assert set(line.keys()) == GUARDIAN_LINE_FIELDS
        assert line["generic_category"] == "analyses_examens"
        # The sensitive label must not appear ANYWHERE in the payload.
        raw = response.content.decode("utf-8")
        assert SENSITIVE_LABEL not in raw
        assert "VIH" not in raw
        # The protégé block stays administrative (phase A contract).
        assert set(response.data["patient"].keys()) == {
            "id", "first_name", "last_name", "claim_status",
        }

    def test_list_payload_is_equally_clean(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.guardian_user).get(
            "/api/v1/guardian/payment-requests/"
        )
        raw = response.content.decode("utf-8")
        assert "VIH" not in raw
        assert set(response.data["results"][0].keys()) == GUARDIAN_PR_FIELDS

    def test_receipts_carry_dual_currency_fees_and_no_care_info(self):
        scn = build_scenario(status=Status.CLOSED)
        response = client_for(scn.guardian_user).get("/api/v1/guardian/receipts/")
        assert response.status_code == 200
        receipt = response.data["results"][0]
        assert set(receipt.keys()) == RECEIPT_FIELDS
        assert Decimal(receipt["amount_eur_paid"]) == scn.intent.amount_eur
        assert Decimal(receipt["amount_kmf_received"]) == scn.intent.amount_kmf
        assert Decimal(receipt["exchange_rate"]) == scn.intent.exchange_rate
        assert "VIH" not in response.content.decode("utf-8")

    def test_receipts_of_other_guardians_are_invisible(self):
        build_scenario(status=Status.CLOSED)
        outsider_user, _ = make_guardian_user()
        response = client_for(outsider_user).get("/api/v1/guardian/receipts/")
        assert response.status_code == 200
        assert response.data["results"] == []


class TestGuardianPaymentFlow:
    def test_quote_before_payment_is_transparent(self, settings):
        settings.FX_EUR_KMF_RATE = "491.9678"
        settings.PSP_FEE_PERCENT = "2.50"
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.guardian_user).get(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/quote/"
        )
        assert response.status_code == 200, response.content
        data = response.data
        assert Decimal(data["amount_kmf"]) == Decimal("15000.00")
        assert Decimal(data["exchange_rate"]) == Decimal("491.9678")
        assert Decimal(data["amount_eur"]) == Decimal("30.49")
        assert Decimal(data["fees_eur"]) == Decimal("0.76")
        assert Decimal(data["total_eur"]) == Decimal("31.25")
        assert data["currency_paid"] == "EUR"
        assert data["currency_received"] == "KMF"

    def test_end_to_end_payment_via_webhook(self):
        scn = build_scenario(status=Status.SENT)
        intent_data = pay_via_api(scn)
        assert intent_data["psp"] == PaymentIntent.Psp.FAKE

        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID
        assert scn.payment_request.ledger_transactions.count() == 1

    def test_webhook_replay_via_api_is_a_noop(self):
        scn = build_scenario(status=Status.SENT)
        paid = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        )
        payload, signature = signed_webhook(paid.data["psp_reference"])
        first = post_webhook(client_for(), payload, signature)
        replay = post_webhook(client_for(), payload, signature)
        assert first.status_code == 200
        assert replay.status_code == 200
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.ledger_transactions.count() == 1
        assert scn.payment_request.status == Status.PAID

    def test_webhook_bad_signature_is_400(self):
        scn = build_scenario(status=Status.SENT)
        paid = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        )
        payload, _ = signed_webhook(paid.data["psp_reference"])
        response = post_webhook(client_for(), payload, "forged-signature")
        assert response.status_code == 400
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.SENT

    def test_webhook_unknown_reference_is_400(self):
        payload, signature = signed_webhook("fake_pi_fantome")
        assert post_webhook(client_for(), payload, signature).status_code == 400

    def test_second_shared_guardian_can_pay(self):
        scn = build_scenario(status=Status.SENT)
        second = add_shared_guardian(scn)
        pay_via_api(scn, guardian_user=second.guardian_user)
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID
        intent = PaymentIntent.objects.get(status=PaymentIntent.Status.SUCCEEDED)
        assert intent.guardian_id == second.guardian_profile.pk

    def test_paying_an_already_paid_request_is_400(self):
        scn = build_scenario(status=Status.PAID)
        response = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        )
        assert response.status_code == 400
        assert "pas ouverte au paiement" in response.data[0]

    def test_double_pay_within_guard_window_is_400_with_actionable_message(self):
        # Anti-double-débit: the guardian pays, 3DS drags on, they retry —
        # the SERVICE refuses (never the view alone), bare-array error body.
        scn = build_scenario(status=Status.SENT)
        client = client_for(scn.guardian_user)
        url = f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        first = client.post(url)
        assert first.status_code == 201, first.content
        second = client.post(url)
        assert second.status_code == 400
        assert second.data == [
            "Un paiement est déjà en cours pour cette demande. "
            "Attendez quelques minutes avant de réessayer."
        ]
        assert PaymentIntent.objects.count() == 1

    def test_after_a_failed_webhook_the_guardian_can_retry_immediately(self):
        scn = build_scenario(status=Status.SENT)
        client = client_for(scn.guardian_user)
        url = f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        first = client.post(url)
        payload, signature = signed_webhook(
            first.data["psp_reference"], status="failed"
        )
        assert post_webhook(client_for(), payload, signature).status_code == 200
        retry = client.post(url)
        assert retry.status_code == 201, retry.content
        assert retry.data["psp_reference"] != first.data["psp_reference"]

    def test_kyc_pending_center_cannot_be_paid_via_api(self):
        scn = build_scenario(status=Status.SENT)
        scn.center.kyc_status = "en_attente"
        scn.center.save(update_fields=["kyc_status", "updated_at"])
        response = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        )
        assert response.status_code == 400
        assert PaymentIntent.objects.count() == 0

    def test_guardian_opens_a_dispute(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/dispute/",
            {"reason": "Le montant a changé après le partage"},
        )
        assert response.status_code == 201, response.content
        assert response.data["status"] == Status.DISPUTED
        assert "VIH" not in response.content.decode("utf-8")


# ---------------------------------------------------------------------------
# Cross-hat hygiene — a staff hat opens nothing on guardian/patient routes
# ---------------------------------------------------------------------------


class TestCrossHatHygiene:
    def test_staff_hat_alone_opens_no_guardian_route(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.cashier).get("/api/v1/guardian/payment-requests/")
        assert response.status_code == 403  # no guardian profile

    def test_guardian_hat_alone_opens_no_center_route(self):
        scn = build_scenario(status=Status.SENT)
        response = client_for(scn.guardian_user).get(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
        )
        assert response.status_code == 404  # the center itself is invisible
