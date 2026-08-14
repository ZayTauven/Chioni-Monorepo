"""Trust Bridge services — the contract of phase B.

Closes, at the service layer, the probes documented open in
``test_hardening.py``: M5 (exclusive state machine), F2 (no SUCCEEDED
intent without its ledger trace on the service path), R5/F3 (receipt only
through closure, amounts reconciled with the ledger), plus KYC gating,
webhook idempotency and dispute lifecycle.
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connections
from django.utils import timezone

from apps.centers.models import HealthCenter
from apps.common.models import Currency
from apps.medical.models import ActPerformed
from apps.trustbridge import services
from apps.trustbridge.fx import net_eur_for_kmf, quote_eur_for_kmf
from apps.trustbridge.models import (
    Dispute,
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
    PaymentRequest,
    Receipt,
)

from .api_helpers import make_guardian_user, make_active_link
from .factories import make_act, make_encounter, make_tariff
from .trustbridge_helpers import (
    Status,
    add_shared_guardian,
    build_scenario,
    signed_webhook,
)

pytestmark = pytest.mark.django_db

Account = LedgerEntry.Account
Direction = LedgerEntry.Direction


# ---------------------------------------------------------------------------
# Invoices — snapshots, issuance
# ---------------------------------------------------------------------------


class TestInvoiceServices:
    def test_lines_snapshot_the_acts(self):
        scn = build_scenario(status="facture_brouillon")
        line = scn.invoice.lines.get()
        assert line.label == scn.act.label_snapshot
        assert line.generic_category == scn.act.generic_category
        assert line.amount_kmf == scn.act.price_kmf_snapshot
        assert scn.invoice.total_kmf == Decimal("15000")

    def test_foreign_encounter_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        foreign_encounter = make_encounter()  # another center
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            services.create_invoice(
                actor=scn.cashier, center=scn.center, encounter=foreign_encounter
            )

    def test_an_act_cannot_be_billed_twice(self):
        scn = build_scenario(status="facture_brouillon")
        with pytest.raises(ValidationError, match="déjà porté"):
            services.create_invoice(
                actor=scn.cashier, center=scn.center, encounter=scn.encounter
            )

    def test_act_ids_outside_the_encounter_are_refused(self):
        scn = build_scenario(status="facture_brouillon")
        foreign_act = make_act()  # other encounter, other center
        with pytest.raises(ValidationError, match="n'appartiennent pas"):
            services.create_invoice(
                actor=scn.cashier, center=scn.center,
                encounter=scn.encounter, act_ids=[foreign_act.pk],
            )

    def test_encounter_without_acts_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        empty = make_encounter(patient=scn.patient, center=scn.center)
        with pytest.raises(ValidationError, match="Aucun acte"):
            services.create_invoice(
                actor=scn.cashier, center=scn.center, encounter=empty
            )

    def test_issue_requires_draft(self):
        scn = build_scenario(status=Status.DRAFT)  # invoice already issued
        with pytest.raises(ValidationError, match="brouillon"):
            services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)

    def test_payment_request_requires_an_issued_invoice(self):
        scn = build_scenario(status="facture_brouillon")
        with pytest.raises(ValidationError, match="facture émise"):
            services.create_payment_request(actor=scn.cashier, invoice=scn.invoice)

    def test_a_second_payment_request_on_the_same_invoice_is_refused(self):
        scn = build_scenario(status=Status.DRAFT)
        with pytest.raises(ValidationError, match="existe déjà"):
            services.create_payment_request(actor=scn.cashier, invoice=scn.invoice)


# ---------------------------------------------------------------------------
# M5 — the state machine is EXCLUSIVE at the service layer
# ---------------------------------------------------------------------------


class TestStateMachineIsExclusive:
    def test_draft_cannot_be_sent_without_a_share(self):
        scn = build_scenario(status=Status.DRAFT)
        with pytest.raises(ValidationError, match="partagée avec aucun tuteur"):
            services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.DRAFT

    def test_sent_cannot_be_sent_again(self):
        scn = build_scenario(status=Status.SENT)
        with pytest.raises(ValidationError, match="Transition refusée"):
            services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )

    def test_draft_cannot_be_paid(self):
        scn = build_scenario(status=Status.DRAFT)
        services.share_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        with pytest.raises(ValidationError, match="pas ouverte au paiement"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )

    def test_care_cannot_be_confirmed_before_payment(self):
        scn = build_scenario(status=Status.SENT)
        with pytest.raises(ValidationError, match="Transition refusée"):
            services.confirm_care(
                actor=scn.doctor, payment_request=scn.payment_request
            )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.SENT

    def test_closure_requires_confirmed_care(self):
        for status in (Status.SENT, Status.PAID):
            scn = build_scenario(status=status)
            with pytest.raises(ValidationError, match="confirmé"):
                services.close_payment_request(
                    actor=scn.cashier, payment_request=scn.payment_request
                )
            assert not Receipt.objects.filter(
                payment_request=scn.payment_request
            ).exists()

    def test_closed_is_terminal(self):
        scn = build_scenario(status=Status.CLOSED)
        with pytest.raises(ValidationError):
            services.confirm_care(
                actor=scn.doctor, payment_request=scn.payment_request
            )
        with pytest.raises(ValidationError):
            services.open_dispute(
                actor_user=scn.guardian_user,
                payment_request=scn.payment_request, reason="trop tard",
            )

    def test_paid_is_unreachable_without_a_succeeded_intent_and_ledger(self):
        """The heart of M5+F2: NO service path reaches `payee` except
        register_payment_success, which writes the ledger atomically."""
        scn = build_scenario(status=Status.SENT)
        pr = scn.payment_request

        for illegal_call in (
            lambda: services.confirm_care(actor=scn.doctor, payment_request=pr),
            lambda: services.close_payment_request(actor=scn.cashier, payment_request=pr),
            lambda: services.acknowledge_care_received(
                patient_user=scn.patient_user, payment_request=pr
            ),
        ):
            with pytest.raises(ValidationError):
                illegal_call()
        pr.refresh_from_db()
        assert pr.status == Status.SENT
        assert pr.ledger_transactions.count() == 0

    def test_acknowledge_requires_payment_first(self):
        scn = build_scenario(status=Status.SENT)
        with pytest.raises(ValidationError, match="après le paiement"):
            services.acknowledge_care_received(
                patient_user=scn.patient_user,
                payment_request=scn.payment_request,
            )


# ---------------------------------------------------------------------------
# Sharing — active links of the invoiced patient only
# ---------------------------------------------------------------------------


class TestSharing:
    def test_share_requires_an_active_link(self):
        scn = build_scenario(status=Status.DRAFT)
        scn.link.revoke()
        with pytest.raises(ValidationError, match="pas actif"):
            services.share_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request,
                guardian_link=scn.link,
            )

    def test_share_refuses_a_foreign_patients_link(self):
        scn = build_scenario(status=Status.DRAFT)
        _, other_profile = make_guardian_user()
        from .api_helpers import make_claimed_patient

        foreign_link = make_active_link(
            other_profile, make_claimed_patient(first_name="Anfia")
        )
        with pytest.raises(ValidationError, match="patient facturé"):
            services.share_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request,
                guardian_link=foreign_link,
            )

    def test_duplicate_share_is_refused_in_french(self):
        scn = build_scenario(status=Status.SENT)
        with pytest.raises(ValidationError, match="déjà partagée"):
            services.share_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request,
                guardian_link=scn.link,
            )

    def test_unshare_removes_the_share(self):
        scn = build_scenario(status=Status.SENT)
        services.unshare_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        assert scn.payment_request.shares.count() == 0

    def test_share_is_frozen_once_paid(self):
        scn = build_scenario(status=Status.PAID)
        extra_user, extra_profile = make_guardian_user()
        extra_link = make_active_link(extra_profile, scn.patient)
        with pytest.raises(ValidationError, match="brouillon ou envoyée"):
            services.share_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request,
                guardian_link=extra_link,
            )
        with pytest.raises(ValidationError, match="brouillon ou envoyée"):
            services.unshare_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request,
                guardian_link=scn.link,
            )


# ---------------------------------------------------------------------------
# FX quote — transparent conversion (étude §4.5)
# ---------------------------------------------------------------------------


class TestQuote:
    def test_quote_maths_are_deterministic(self, settings):
        settings.FX_EUR_KMF_RATE = "491.9678"
        settings.PSP_FEE_PERCENT = "2.50"
        quote = quote_eur_for_kmf(Decimal("15000"))
        assert quote.rate == Decimal("491.9678")
        assert quote.amount_eur == Decimal("30.49")  # 15000 / 491.9678
        assert quote.fees_eur == Decimal("0.76")  # 2.5 % of 30.49
        assert quote.total_eur == Decimal("31.25")
        assert quote.amount_kmf == Decimal("15000")

    def test_quote_requires_a_sent_request(self):
        scn = build_scenario(status=Status.DRAFT)
        with pytest.raises(ValidationError, match="pas ouverte au paiement"):
            services.quote_payment_request(scn.payment_request)

    def test_zero_fee_configuration_is_respected(self, settings):
        settings.PSP_FEE_PERCENT = "0"
        quote = quote_eur_for_kmf(Decimal("15000"))
        assert quote.fees_eur == Decimal("0.00")
        assert quote.total_eur == quote.amount_eur


# ---------------------------------------------------------------------------
# F2 — cash-in: intent, balanced ledger, idempotent webhook
# ---------------------------------------------------------------------------


class TestCashIn:
    def test_intent_freezes_rate_and_amounts_from_the_quote(self, settings):
        settings.FX_EUR_KMF_RATE = "491.9678"
        settings.PSP_FEE_PERCENT = "2.50"
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert intent.exchange_rate == Decimal("491.9678")
        assert intent.amount_kmf == Decimal("15000")
        assert intent.amount_eur == Decimal("31.25")  # fees included
        assert intent.psp == PaymentIntent.Psp.FAKE
        assert intent.psp_reference.startswith("fake_pi_")
        assert intent.status == PaymentIntent.Status.PROCESSING

    def test_unshared_guardian_cannot_create_an_intent(self):
        scn = build_scenario(status=Status.SENT)
        stranger_user, stranger_profile = make_guardian_user()
        make_active_link(stranger_profile, scn.patient)  # active but NOT shared
        with pytest.raises(ValidationError, match="pas été partagée"):
            services.create_payment_intent(
                guardian_user=stranger_user, payment_request=scn.payment_request
            )

    def test_revoked_link_can_no_longer_pay(self):
        scn = build_scenario(status=Status.SENT)
        scn.link.revoke()
        with pytest.raises(ValidationError, match="pas été partagée"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user, payment_request=scn.payment_request
            )

    def test_kyc_pending_center_cannot_collect(self):
        scn = build_scenario(status=Status.SENT)
        scn.center.kyc_status = HealthCenter.KycStatus.PENDING
        scn.center.save(update_fields=["kyc_status", "updated_at"])
        with pytest.raises(ValidationError, match="KYC"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user, payment_request=scn.payment_request
            )

    def test_a_payment_in_flight_still_lands_after_a_suspension(self):
        """S4, arbitrage PO du 14/08/2026 — the rail closes for NEW
        payments; a card already debited is honoured.

        The intent only exists because the center was ACTIVE when it was
        opened (the guard lives upstream). Refusing the webhook here would
        leave a real debit with no receipt and no refund path — the exact
        opacity the Pont de Confiance fights. Cashing in is not paying out:
        withholding the funds of a suspended center is the payout process's
        job, not the ledger's.
        """
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        scn.center.kyc_status = HealthCenter.KycStatus.SUSPENDED
        scn.center.save(update_fields=["kyc_status", "updated_at"])

        services.register_payment_success(intent=intent)

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.SUCCEEDED
        assert intent.ledger_transaction_id is not None
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID

    def test_success_writes_a_balanced_ledger_and_flips_all_states(self):
        scn = build_scenario(status=Status.PAID)
        pr = scn.payment_request
        intent = scn.intent

        assert pr.status == Status.PAID
        assert intent.status == PaymentIntent.Status.SUCCEEDED
        assert intent.ledger_transaction_id is not None  # F2: trace required
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID

        tx = intent.ledger_transaction
        # Balanced per currency
        for currency in (Currency.EUR, Currency.KMF):
            debits = sum(
                e.amount for e in tx.entries.filter(
                    direction=Direction.DEBIT, currency=currency
                )
            )
            credits = sum(
                e.amount for e in tx.entries.filter(
                    direction=Direction.CREDIT, currency=currency
                )
            )
            assert debits == credits, currency
        # The guardian paid the total (fees included), the center is owed
        # the FULL invoice amount in KMF, fees are explicit.
        guardian_debit = tx.entries.get(
            account=Account.GUARDIAN_FUNDS, direction=Direction.DEBIT
        )
        assert guardian_debit.amount == intent.amount_eur
        assert guardian_debit.currency == Currency.EUR
        center_credit = tx.entries.get(
            account=Account.DUE_TO_CENTER, direction=Direction.CREDIT
        )
        assert center_credit.amount == scn.invoice.total_kmf
        assert center_credit.currency == Currency.KMF
        assert center_credit.exchange_rate == intent.exchange_rate
        fees_credit = tx.entries.get(
            account=Account.PSP_FEES, direction=Direction.CREDIT
        )
        net = net_eur_for_kmf(intent.amount_kmf, intent.exchange_rate)
        assert fees_credit.amount == intent.amount_eur - net
        # Tenant stamping and reporting (M8)
        assert tx.center_id == scn.center.pk
        assert tx in LedgerTransaction.objects.for_center(scn.center)
        assert tx.payment_request_id == pr.pk

    def test_webhook_replay_is_a_strict_noop(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(intent.psp_reference)

        services.handle_psp_webhook(payload=payload, signature=signature)
        services.handle_psp_webhook(payload=payload, signature=signature)  # replay

        scn.payment_request.refresh_from_db()
        intent.refresh_from_db()
        assert scn.payment_request.status == Status.PAID
        assert intent.status == PaymentIntent.Status.SUCCEEDED
        assert scn.payment_request.ledger_transactions.count() == 1  # ONE trace
        assert PaymentIntent.objects.filter(
            payment_request=scn.payment_request
        ).count() == 1

    def test_paid_at_is_stamped_once_by_the_cash_in(self):
        """`paid_at` is set by register_payment_success in the SAME atomic
        block as the ledger write; a replay never moves it, a dispute /
        resolution cycle never clears it."""
        scn = build_scenario(status=Status.SENT)
        assert scn.payment_request.paid_at is None
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(intent.psp_reference)
        services.handle_psp_webhook(payload=payload, signature=signature)

        scn.payment_request.refresh_from_db()
        first_paid_at = scn.payment_request.paid_at
        assert first_paid_at is not None

        services.handle_psp_webhook(payload=payload, signature=signature)  # replay
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.paid_at == first_paid_at

        services.open_dispute(
            actor_user=scn.patient_user,
            payment_request=scn.payment_request,
            reason="Vérification du montant",
        )
        dispute = scn.payment_request.disputes.get()
        services.resolve_dispute(
            actor=scn.director, dispute=dispute, resolution_note="Montant conforme"
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID
        assert scn.payment_request.paid_at == first_paid_at

    def test_webhook_with_a_bad_signature_records_nothing(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, _ = signed_webhook(intent.psp_reference)
        with pytest.raises(ValidationError, match="Signature"):
            services.handle_psp_webhook(payload=payload, signature="forged")
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING
        assert scn.payment_request.ledger_transactions.count() == 0

    def test_webhook_with_an_unknown_reference_is_refused(self):
        payload, signature = signed_webhook("fake_pi_inconnu")
        with pytest.raises(ValidationError, match="référence de paiement inconnue"):
            services.handle_psp_webhook(payload=payload, signature=signature)

    def test_failure_webhook_marks_the_intent_failed(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(intent.psp_reference, status="failed")
        services.handle_psp_webhook(payload=payload, signature=signature)
        intent.refresh_from_db()
        scn.payment_request.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert scn.payment_request.status == Status.SENT  # still payable

    def test_a_failed_intent_cannot_be_cashed_in_later(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        services.register_payment_failure(intent=intent)
        with pytest.raises(ValidationError, match="ne peut plus être encaissée"):
            services.register_payment_success(intent=intent)

    def test_a_stale_failure_after_success_is_ignored(self):
        scn = build_scenario(status=Status.PAID)
        services.register_payment_failure(intent=scn.intent)
        scn.intent.refresh_from_db()
        assert scn.intent.status == PaymentIntent.Status.SUCCEEDED

    def test_success_on_a_disputed_request_is_refused(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request,
            reason="Montant contesté avant paiement",
        )
        with pytest.raises(ValidationError, match="plus ouverte au paiement"):
            services.register_payment_success(intent=intent)
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING
        assert intent.ledger_transaction_id is None

    def test_refused_success_leaves_a_reconciliation_audit_trace(self):
        """Revue guardian : un « succeeded » refusé peut cacher un débit PSP
        réel — le refus écrit une ligne d'audit système (références seules)
        AVANT de lever, hors de la transaction annulée."""
        from apps.audit.models import AuditLog

        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request,
            reason="Montant contesté avant paiement",
        )
        with pytest.raises(ValidationError, match="plus ouverte au paiement"):
            services.register_payment_success(intent=intent)

        entry = AuditLog.objects.filter(
            action="payment.webhook_refused", object_id=str(intent.pk)
        ).latest("created_at")
        assert entry.actor is None  # system path (webhook has no user)
        assert entry.payload["reason"] == "late_webhook_refused"
        assert entry.payload["intent_id"] == intent.pk
        assert entry.payload["payment_request_id"] == scn.payment_request.pk
        assert entry.payload["request_status"] == Status.DISPUTED
        # References only — never an act label (ADR 0007).
        assert "Sérologie" not in str(entry.payload)


# ---------------------------------------------------------------------------
# Anti-double-débit — a recent pending intent blocks a second pay (guardian
# review of the frontend, 2026-08-13). The guard lives in the SERVICE.
# ---------------------------------------------------------------------------

GUARD_MESSAGE = "Un paiement est déjà en cours pour cette demande"


class TestDoublePaymentGuard:
    def test_second_intent_within_the_guard_window_is_refused(self):
        scn = build_scenario(status=Status.SENT)
        services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with pytest.raises(ValidationError, match=GUARD_MESSAGE):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )
        assert PaymentIntent.objects.filter(
            payment_request=scn.payment_request
        ).count() == 1

    def test_the_guard_is_per_request_not_per_guardian(self):
        # A SECOND shared guardian is blocked too: one payment per request,
        # whoever in the family started it first.
        scn = build_scenario(status=Status.SENT)
        second = add_shared_guardian(scn)
        services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with pytest.raises(ValidationError, match=GUARD_MESSAGE):
            services.create_payment_intent(
                guardian_user=second.guardian_user,
                payment_request=scn.payment_request,
            )

    def test_a_pending_intent_older_than_the_window_no_longer_blocks(
        self, settings
    ):
        settings.PSP_INTENT_GUARD_MINUTES = 15
        scn = build_scenario(status=Status.SENT)
        stale = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        # An abandoned 3DS: backdate the pending intent beyond the window.
        PaymentIntent.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timedelta(minutes=16)
        )
        retry = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert retry.pk != stale.pk
        assert PaymentIntent.objects.filter(
            payment_request=scn.payment_request
        ).count() == 2

    def test_a_failed_intent_allows_an_immediate_retry(self):
        scn = build_scenario(status=Status.SENT)
        first = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(first.psp_reference, status="failed")
        services.handle_psp_webhook(payload=payload, signature=signature)
        retry = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert retry.status == PaymentIntent.Status.PROCESSING
        assert retry.pk != first.pk

    def test_a_paid_request_stays_refused_by_the_state_machine(self):
        scn = build_scenario(status=Status.PAID)  # webhook succeeded
        with pytest.raises(ValidationError, match="pas ouverte au paiement"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )

    def test_late_success_of_a_stale_intent_writes_nothing_once_paid(
        self, settings
    ):
        """The residual real-PSP race: the abandoned 3DS completes AFTER a
        fresh intent already paid the request. The late success must be
        refused WITHOUT writing a second ledger trace (refund handled at
        the provider, outside the ledger)."""
        settings.PSP_INTENT_GUARD_MINUTES = 15
        scn = build_scenario(status=Status.SENT)
        stale = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        PaymentIntent.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timedelta(minutes=16)
        )
        fresh = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        services.register_payment_success(intent=fresh)
        payload, signature = signed_webhook(stale.psp_reference)
        with pytest.raises(ValidationError, match="plus ouverte au paiement"):
            services.handle_psp_webhook(payload=payload, signature=signature)
        stale.refresh_from_db()
        assert stale.status == PaymentIntent.Status.PROCESSING
        assert stale.ledger_transaction_id is None
        assert scn.payment_request.ledger_transactions.count() == 1

    def test_stale_success_first_then_fresh_success_stays_consistent(
        self, settings
    ):
        """Mirror of the race above: the abandoned intent's webhook lands
        FIRST (paying the request), then the fresh intent's success arrives.
        The second success must be refused without writing: exactly one
        ledger transaction, one SUCCEEDED intent."""
        settings.PSP_INTENT_GUARD_MINUTES = 15
        scn = build_scenario(status=Status.SENT)
        stale = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        PaymentIntent.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timedelta(minutes=16)
        )
        fresh = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(stale.psp_reference)
        services.handle_psp_webhook(payload=payload, signature=signature)
        payload, signature = signed_webhook(fresh.psp_reference)
        with pytest.raises(ValidationError, match="plus ouverte au paiement"):
            services.handle_psp_webhook(payload=payload, signature=signature)
        stale.refresh_from_db()
        fresh.refresh_from_db()
        assert stale.status == PaymentIntent.Status.SUCCEEDED
        assert fresh.status == PaymentIntent.Status.PROCESSING
        assert fresh.ledger_transaction_id is None
        assert scn.payment_request.ledger_transactions.count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_pays_yield_exactly_one_intent(self):
        """Two simultaneous ``pay/`` clicks: ``_locked`` serialises them on
        the request row, the loser re-reads after commit and hits the
        guard. Real threads, real connections, real commits."""
        scn = build_scenario(status=Status.SENT)
        second = add_shared_guardian(scn)
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def attempt(user):
            try:
                barrier.wait()
                services.create_payment_intent(
                    guardian_user=user, payment_request=scn.payment_request
                )
                outcomes.append("created")
            except ValidationError:
                outcomes.append("refused")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(user,))
            for user in (scn.guardian_user, second.guardian_user)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        assert sorted(outcomes) == ["created", "refused"]
        assert PaymentIntent.objects.filter(
            payment_request=scn.payment_request
        ).count() == 1


# ---------------------------------------------------------------------------
# R5/F3 — receipt: closure only, reconciled with the ledger
# ---------------------------------------------------------------------------


class TestReceiptAndClosure:
    def test_receipt_is_issued_only_at_closure(self):
        scn = build_scenario(status=Status.CARE_CONFIRMED)
        assert Receipt.objects.count() == 0
        receipt = services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert Receipt.objects.count() == 1
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.CLOSED
        assert receipt.payment_request_id == scn.payment_request.pk

    def test_receipt_amounts_reconcile_with_intent_and_ledger(self):
        scn = build_scenario(status=Status.CLOSED)
        receipt, intent = scn.receipt, scn.intent
        assert receipt.amount_eur_paid == intent.amount_eur
        assert receipt.amount_kmf_received == intent.amount_kmf
        assert receipt.exchange_rate == intent.exchange_rate
        net = net_eur_for_kmf(intent.amount_kmf, intent.exchange_rate)
        assert receipt.fees_eur == intent.amount_eur - net
        assert receipt.ledger_transaction_id == intent.ledger_transaction_id
        # Dual coherence: net + fees = paid, and the ledger corroborates.
        assert receipt.amount_eur_paid == net + receipt.fees_eur

    def test_receipt_numbering_is_sequential_per_center(self):
        scn1 = build_scenario(status=Status.CLOSED)
        scn2 = build_scenario(
            status=Status.CLOSED, center=scn1.center, director=scn1.director
        )
        other = build_scenario(status=Status.CLOSED)
        assert scn1.receipt.sequence_number == 1
        assert scn2.receipt.sequence_number == 2
        assert other.receipt.sequence_number == 1  # its own center's sequence

    def test_double_closure_is_refused(self):
        scn = build_scenario(status=Status.CLOSED)
        with pytest.raises(ValidationError):
            services.close_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        assert Receipt.objects.count() == 1

    def test_patient_acknowledgement_is_stored_and_single(self):
        scn = build_scenario(status=Status.PAID)
        services.acknowledge_care_received(
            patient_user=scn.patient_user, payment_request=scn.payment_request
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.patient_acknowledged_at is not None
        with pytest.raises(ValidationError, match="déjà accusé"):
            services.acknowledge_care_received(
                patient_user=scn.patient_user, payment_request=scn.payment_request
            )

    def test_only_the_patient_can_acknowledge(self):
        scn = build_scenario(status=Status.PAID)
        with pytest.raises(ValidationError, match="Seul le patient"):
            services.acknowledge_care_received(
                patient_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )


# ---------------------------------------------------------------------------
# Disputes — mandatory reason, staff resolution, closure blocked
# ---------------------------------------------------------------------------


class TestDisputes:
    def test_reason_is_mandatory(self):
        scn = build_scenario(status=Status.SENT)
        with pytest.raises(ValidationError, match="motif du litige est obligatoire"):
            services.open_dispute(
                actor_user=scn.guardian_user,
                payment_request=scn.payment_request, reason="   ",
            )

    def test_a_stranger_cannot_open_a_dispute(self):
        scn = build_scenario(status=Status.SENT)
        stranger_user, _ = make_guardian_user()
        with pytest.raises(ValidationError, match="patient ou un tuteur"):
            services.open_dispute(
                actor_user=stranger_user,
                payment_request=scn.payment_request, reason="je conteste",
            )

    def test_guardian_dispute_from_sent_freezes_and_resolution_restores(self):
        scn = build_scenario(status=Status.SENT)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request,
            reason="Le montant ne correspond pas à ce qui était convenu",
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.DISPUTED
        assert dispute.previous_status == Status.SENT

        services.resolve_dispute(
            actor=scn.director, dispute=dispute,
            resolution_note="Montant vérifié avec la famille, grille conforme",
        )
        scn.payment_request.refresh_from_db()
        dispute.refresh_from_db()
        assert scn.payment_request.status == Status.SENT  # restored
        assert dispute.status == Dispute.Status.RESOLVED
        assert dispute.resolved_by == scn.director

    def test_patient_dispute_from_paid_blocks_the_whole_tail(self):
        scn = build_scenario(status=Status.PAID)
        dispute = services.open_dispute(
            actor_user=scn.patient_user,
            payment_request=scn.payment_request,
            reason="Je n'ai pas reçu ce soin",
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.DISPUTED
        # Neither confirmation nor closure can proceed under dispute.
        with pytest.raises(ValidationError):
            services.confirm_care(
                actor=scn.doctor, payment_request=scn.payment_request
            )
        with pytest.raises(ValidationError, match="litige"):
            services.close_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        # Resolution restores PAID; the normal tail then completes.
        services.resolve_dispute(
            actor=scn.director, dispute=dispute,
            resolution_note="Soin re-vérifié auprès du praticien",
        )
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID
        services.confirm_care(actor=scn.doctor, payment_request=scn.payment_request)
        receipt = services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert receipt.pk is not None

    def test_dispute_is_impossible_outside_sent_or_paid(self):
        for status in (Status.DRAFT, Status.CARE_CONFIRMED, Status.CLOSED):
            scn = build_scenario(status=status)
            with pytest.raises(ValidationError):
                services.open_dispute(
                    actor_user=scn.patient_user,
                    payment_request=scn.payment_request, reason="motif",
                )

    def test_second_open_dispute_is_refused(self):
        scn = build_scenario(status=Status.SENT)
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="premier",
        )
        with pytest.raises(ValidationError):
            services.open_dispute(
                actor_user=scn.patient_user,
                payment_request=scn.payment_request, reason="second",
            )

    def test_resolution_note_is_mandatory_and_single(self):
        scn = build_scenario(status=Status.SENT)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="montant",
        )
        with pytest.raises(ValidationError, match="motif de résolution"):
            services.resolve_dispute(
                actor=scn.director, dispute=dispute, resolution_note=""
            )
        services.resolve_dispute(
            actor=scn.director, dispute=dispute, resolution_note="vérifié"
        )
        with pytest.raises(ValidationError, match="déjà résolu"):
            services.resolve_dispute(
                actor=scn.director, dispute=dispute, resolution_note="encore"
            )

    def test_multi_guardians_any_shared_guardian_can_dispute(self):
        scn = build_scenario(status=Status.DRAFT)
        second = add_shared_guardian(scn)
        services.share_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        services.send_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        dispute = services.open_dispute(
            actor_user=second.guardian_user,
            payment_request=scn.payment_request, reason="frais imprévus",
        )
        assert dispute.opened_by == second.guardian_user
