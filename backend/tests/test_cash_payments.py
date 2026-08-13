"""Caisse du centre — service contract of ADR 0015.

The cash-in is the GENERAL concept (espèces, mobile money) and the
diaspora payment is a particular case RECOVERED by it: this suite locks
the balanced KMF ledger writes per method, the remaining-balance rule
(partial instalments, overshoot refused, ``payee`` at zero), the reversal
discipline (inverse transaction, mandatory reason, single-shot, honest
invoice status effect), the counter receipt series (reconciled, race-safe,
separate from the diaspora series) and the two money races: two cashiers
on one invoice, and a cashier against the PSP webhook (which re-checks
the balance under the invoice lock before writing a franc).
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection, connections, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.common.models import AppendOnlyError, Currency
from apps.trustbridge import services
from apps.trustbridge.models import (
    CashPayment,
    CashPaymentReversal,
    CashReceipt,
    Invoice,
    LedgerEntry,
    MobileMoneyOperator,
    PaymentIntent,
    Receipt,
)

from .factories import make_encounter, make_tariff
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

Account = LedgerEntry.Account
Direction = LedgerEntry.Direction
Method = CashPayment.Method


def counter_scenario(price_kmf="20000"):
    """A center + ISSUED invoice, no payment request — the pure counter."""
    scn = build_scenario(status="facture_brouillon", price_kmf=price_kmf)
    services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
    scn.invoice.refresh_from_db()
    return scn


def pay(scn, amount, method=Method.CASH, operator="", **kwargs):
    return services.record_cash_payment(
        actor=scn.cashier,
        center=scn.center,
        invoice=scn.invoice,
        method=method,
        amount_kmf=Decimal(amount),
        operator=operator,
        **kwargs,
    )


def age_intent(intent, minutes=60):
    """Push an intent's creation beyond the anti-double-débit window."""
    PaymentIntent.objects.filter(pk=intent.pk).update(
        created_at=timezone.now() - timedelta(minutes=minutes)
    )


def entries_of(ledger_tx):
    return {
        (e.account, e.direction, e.amount, e.currency)
        for e in ledger_tx.entries.all()
    }


# ---------------------------------------------------------------------------
# Recording — balanced KMF ledger per method
# ---------------------------------------------------------------------------


class TestRecordCashPayment:
    def test_cash_writes_a_balanced_kmf_transaction(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        assert entries_of(payment.ledger_transaction) == {
            (Account.CASH_ON_HAND, Direction.DEBIT, Decimal("5000"), Currency.KMF),
            (
                Account.PATIENT_RECEIVABLES,
                Direction.CREDIT,
                Decimal("5000"),
                Currency.KMF,
            ),
        }
        assert payment.ledger_transaction.center_id == scn.center.pk
        assert payment.received_by == scn.cashier
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.ISSUED  # partial
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("15000")

    def test_mobile_money_debits_the_mobile_money_account(self):
        scn = counter_scenario()
        payment = pay(
            scn, "7000", method=Method.MOBILE_MONEY,
            operator=MobileMoneyOperator.HURI, reference="MM-2026-001",
        )
        assert payment.operator == MobileMoneyOperator.HURI
        assert payment.reference == "MM-2026-001"
        assert entries_of(payment.ledger_transaction) == {
            (Account.MOBILE_MONEY, Direction.DEBIT, Decimal("7000"), Currency.KMF),
            (
                Account.PATIENT_RECEIVABLES,
                Direction.CREDIT,
                Decimal("7000"),
                Currency.KMF,
            ),
        }

    def test_mobile_money_requires_a_valid_operator(self):
        scn = counter_scenario()
        with pytest.raises(ValidationError, match="opérateur valide"):
            pay(scn, "7000", method=Method.MOBILE_MONEY)
        with pytest.raises(ValidationError, match="opérateur valide"):
            pay(scn, "7000", method=Method.MOBILE_MONEY, operator="western_union")

    def test_cash_with_an_operator_is_refused(self):
        scn = counter_scenario()
        with pytest.raises(ValidationError, match="pas d'opérateur"):
            pay(scn, "5000", operator=MobileMoneyOperator.HURI)

    def test_trust_bridge_is_never_typed_at_the_counter(self):
        scn = counter_scenario()
        with pytest.raises(ValidationError, match="jamais saisi au guichet"):
            pay(scn, "5000", method=Method.TRUST_BRIDGE)

    def test_amount_must_be_positive(self):
        scn = counter_scenario()
        for bad in ("0", "-5000"):
            with pytest.raises(ValidationError, match="> 0 KMF"):
                pay(scn, bad)

    def test_kmf_decimals_are_refused(self):
        scn = counter_scenario()
        with pytest.raises(ValidationError, match="décimales"):
            pay(scn, "5000.50")

    def test_draft_invoice_is_refused(self):
        scn = build_scenario(status="facture_brouillon")
        with pytest.raises(ValidationError, match="brouillon"):
            services.record_cash_payment(
                actor=scn.cashier, center=scn.center, invoice=scn.invoice,
                method=Method.CASH, amount_kmf=Decimal("5000"),
            )

    def test_cancelled_invoice_is_refused(self):
        scn = counter_scenario()
        scn.invoice.status = Invoice.Status.CANCELLED
        scn.invoice.save(update_fields=["status", "updated_at"])
        with pytest.raises(ValidationError, match="annulée"):
            pay(scn, "5000")

    def test_overshoot_of_the_remaining_balance_is_refused(self):
        scn = counter_scenario()
        pay(scn, "15000")
        with pytest.raises(ValidationError, match="dépasse"):
            pay(scn, "6000")  # only 5 000 left
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("15000")

    def test_full_payment_flips_the_invoice_to_paid_atomically(self):
        scn = counter_scenario()
        pay(scn, "12000")
        pay(scn, "8000")
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("0")
        with pytest.raises(ValidationError, match="déjà entièrement réglée"):
            pay(scn, "1000")

    def test_foreign_center_is_refused(self):
        scn = counter_scenario()
        other = build_scenario(status="facture_brouillon")
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            services.record_cash_payment(
                actor=other.cashier, center=other.center, invoice=scn.invoice,
                method=Method.CASH, amount_kmf=Decimal("5000"),
            )

    def test_audit_row_carries_references_only(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        entry = AuditLog.objects.get(action=AuditAction.CASH_PAYMENT_RECORDED)
        assert entry.payload["cash_payment_id"] == payment.pk
        assert entry.payload["invoice_id"] == scn.invoice.pk
        assert entry.payload["center_id"] == scn.center.pk
        assert Decimal(entry.payload["amount_kmf"]) == Decimal("5000")
        assert Decimal(entry.payload["balance_after_kmf"]) == Decimal("15000")
        assert entry.payload["receipt_number"] == "G-000001"
        # Never a name, a phone or a care label in the payload (ADR 0007).
        blob = str(entry.payload)
        assert "Mariama" not in blob and "Sérologie" not in blob


# ---------------------------------------------------------------------------
# Counter receipts — reconciled, one per payment, separate « G- » series
# ---------------------------------------------------------------------------


class TestCashReceipts:
    def test_receipt_is_issued_and_reconciled_with_the_ledger(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        receipt = payment.cash_receipt
        assert receipt.sequence_number == 1
        assert receipt.number == "G-000001"
        assert receipt.amount_kmf == Decimal("5000")
        assert receipt.ledger_transaction_id == payment.ledger_transaction_id
        assert receipt.center_id == scn.center.pk

    def test_one_receipt_per_payment_sequentially_numbered(self):
        scn = counter_scenario()
        first = pay(scn, "5000")
        second = pay(scn, "3000")
        assert first.cash_receipt.sequence_number == 1
        assert second.cash_receipt.sequence_number == 2

    def test_series_is_separate_from_the_diaspora_receipts(self):
        # A full diaspora flow first: the center's dual-currency receipt
        # takes sequence 1 in ITS series.
        scn = build_scenario(status=Status.CLOSED)
        assert scn.receipt.sequence_number == 1
        # A second invoice cashed at the counter: the G- series ALSO
        # starts at 1 — two tables, two constraints, no interleaving.
        encounter = make_encounter(patient=scn.patient, center=scn.center)
        tariff = make_tariff(scn.center, label="Consultation", price_kmf="4000")
        from apps.medical.models import ActPerformed

        ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)
        invoice = services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=encounter
        )
        services.issue_invoice(actor=scn.cashier, invoice=invoice)
        payment = services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=invoice,
            method=Method.CASH, amount_kmf=Decimal("4000"),
        )
        assert payment.cash_receipt.sequence_number == 1
        assert Receipt.objects.filter(center=scn.center).count() == 1
        assert CashReceipt.objects.filter(center=scn.center).count() == 1

    def test_trust_bridge_cash_in_has_no_counter_receipt(self):
        scn = build_scenario(status=Status.PAID)
        payment = CashPayment.objects.get(method=Method.TRUST_BRIDGE)
        assert not CashReceipt.objects.filter(cash_payment=payment).exists()
        with pytest.raises(ValidationError, match="reçu double devise"):
            CashReceipt.issue(cash_payment=payment)


# ---------------------------------------------------------------------------
# The diaspora payment is RECOVERED by the general concept
# ---------------------------------------------------------------------------


class TestTrustBridgeIsACashPayment:
    def test_webhook_success_creates_the_trust_bridge_cash_payment(self):
        scn = build_scenario(status=Status.PAID)
        payment = CashPayment.objects.get(invoice=scn.invoice)
        assert payment.method == Method.TRUST_BRIDGE
        assert payment.amount_kmf == scn.intent.amount_kmf == Decimal("15000")
        assert payment.ledger_transaction_id == scn.intent.ledger_transaction_id
        assert payment.payment_intent_id == scn.intent.pk
        assert payment.received_by is None
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("0")

    def test_quote_and_intent_cover_the_remaining_balance(self):
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("5000"),
        )
        quote = services.quote_payment_request(scn.payment_request)
        assert quote.amount_kmf == Decimal("15000")
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert intent.amount_kmf == Decimal("15000")
        services.register_payment_success(intent=intent)
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("0")
        # And the closure receipt still reconciles on the PARTIAL amount.
        scn.payment_request.refresh_from_db()
        services.confirm_care(actor=scn.doctor, payment_request=scn.payment_request)
        receipt = services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert receipt.amount_kmf_received == Decimal("15000")

    def test_quote_refuses_a_settled_invoice(self):
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("20000"),
        )
        with pytest.raises(ValidationError, match="déjà entièrement réglée"):
            services.quote_payment_request(scn.payment_request)
        with pytest.raises(ValidationError, match="déjà entièrement réglée"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )

    def test_send_refuses_a_request_on_a_settled_invoice(self):
        scn = build_scenario(status=Status.DRAFT, price_kmf="20000")
        services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("20000"),
        )
        services.share_payment_request(
            actor=scn.cashier,
            payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        with pytest.raises(ValidationError, match="rien à demander"):
            services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )

    def test_pending_diaspora_intent_blocks_the_counter(self):
        scn = build_scenario(status=Status.SENT)
        services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with pytest.raises(ValidationError, match="paiement diaspora est en cours"):
            services.record_cash_payment(
                actor=scn.cashier, center=scn.center, invoice=scn.invoice,
                method=Method.CASH, amount_kmf=Decimal("5000"),
            )

    def test_stale_diaspora_intent_no_longer_blocks_the_counter(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        age_intent(intent)
        payment = services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("5000"),
        )
        assert payment.amount_kmf == Decimal("5000")

    def test_late_webhook_is_refused_when_the_balance_changed(self):
        """The PO race: cashier vs webhook. The stale intent was frozen on
        20 000; a 5 000 instalment lands at the counter; the late webhook
        must be refused WITHOUT writing a franc, with the audit evidence
        (the provider may have debited the guardian)."""
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        age_intent(intent)
        services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("5000"),
        )
        with pytest.raises(ValidationError, match="solde de la facture a changé"):
            services.register_payment_success(intent=intent)
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING
        assert intent.ledger_transaction_id is None
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.SENT
        refusal = AuditLog.objects.get(
            action=AuditAction.PAYMENT_WEBHOOK_REFUSED
        )
        assert refusal.payload["refusal"] == "balance_changed"
        assert Decimal(refusal.payload["intent_kmf"]) == Decimal("20000")
        assert Decimal(refusal.payload["balance_kmf"]) == Decimal("15000")
        # No Trust Bridge cash payment was written.
        assert not CashPayment.objects.filter(
            method=Method.TRUST_BRIDGE
        ).exists()


# ---------------------------------------------------------------------------
# Reversals — the only correction, honest status effect
# ---------------------------------------------------------------------------


class TestReversal:
    def test_reversal_writes_the_inverse_transaction_and_reopens_the_invoice(self):
        scn = counter_scenario()
        payment = pay(scn, "20000")
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        reversal = services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur de saisie"
        )
        assert entries_of(reversal.ledger_transaction) == {
            (
                Account.PATIENT_RECEIVABLES,
                Direction.DEBIT,
                Decimal("20000"),
                Currency.KMF,
            ),
            (Account.CASH_ON_HAND, Direction.CREDIT, Decimal("20000"), Currency.KMF),
        }
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.ISSUED  # owed again
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("20000")

    def test_partial_reversal_keeps_the_invoice_issued(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Doublon"
        )
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.ISSUED
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("20000")

    def test_reason_is_mandatory(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        for bad in ("", "   ", None):
            with pytest.raises(ValidationError, match="motif"):
                services.reverse_cash_payment(
                    actor=scn.cashier, cash_payment=payment, reason=bad
                )

    def test_a_payment_reverses_only_once(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur"
        )
        with pytest.raises(ValidationError, match="déjà été contre-passé"):
            services.reverse_cash_payment(
                actor=scn.cashier, cash_payment=payment, reason="Encore"
            )

    def test_trust_bridge_cash_in_is_never_reversed_at_the_counter(self):
        scn = build_scenario(status=Status.PAID)
        payment = CashPayment.objects.get(method=Method.TRUST_BRIDGE)
        with pytest.raises(ValidationError, match="litige"):
            services.reverse_cash_payment(
                actor=scn.cashier, cash_payment=payment, reason="Erreur"
            )

    def test_reversed_amount_can_be_collected_again(self):
        scn = counter_scenario()
        payment = pay(scn, "20000")
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur de montant"
        )
        again = pay(scn, "20000", method=Method.MOBILE_MONEY,
                    operator=MobileMoneyOperator.MVOLA)
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        assert again.cash_receipt.sequence_number == 2

    def test_reversal_audit_never_carries_the_reason_text(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        secret_reason = "Le caissier s'est trompé de patient"
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason=secret_reason
        )
        entry = AuditLog.objects.get(action=AuditAction.CASH_PAYMENT_REVERSED)
        assert secret_reason not in str(entry.payload)
        assert entry.payload["cash_payment_id"] == payment.pk
        assert entry.payload["invoice_status_after"] == Invoice.Status.ISSUED


# ---------------------------------------------------------------------------
# Immutability — ORM locks and DB triggers on the three cash tables
# ---------------------------------------------------------------------------


class TestCashTablesAreAppendOnly:
    def test_orm_mutations_are_refused(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        with pytest.raises(AppendOnlyError):
            payment.amount_kmf = Decimal("1")
            payment.save()
        with pytest.raises(AppendOnlyError):
            payment.delete()
        with pytest.raises(AppendOnlyError):
            CashPayment.objects.filter(pk=payment.pk).update(
                amount_kmf=Decimal("1")
            )
        with pytest.raises(AppendOnlyError):
            CashReceipt.objects.filter(pk=payment.cash_receipt.pk).delete()

    def test_raw_sql_update_on_cash_payment_is_blocked_by_the_trigger(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE trustbridge_cashpayment SET amount_kmf = %s "
                        "WHERE id = %s",
                        [Decimal("1.00"), payment.pk],
                    )
        payment.refresh_from_db()
        assert payment.amount_kmf == Decimal("5000")

    def test_raw_sql_delete_on_cash_receipt_is_blocked_by_the_trigger(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "DELETE FROM trustbridge_cashreceipt WHERE id = %s",
                        [payment.cash_receipt.pk],
                    )

    def test_raw_sql_update_on_reversal_is_blocked_by_the_trigger(self):
        scn = counter_scenario()
        payment = pay(scn, "5000")
        reversal = services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur"
        )
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE trustbridge_cashpaymentreversal "
                        "SET reason = %s WHERE id = %s",
                        ["motif réécrit", reversal.pk],
                    )


# ---------------------------------------------------------------------------
# Concurrency — real threads, real connections, real commits
# ---------------------------------------------------------------------------


class TestCashConcurrency:
    @pytest.mark.django_db(transaction=True)
    def test_two_cashiers_cannot_exceed_the_balance_together(self):
        """Two cashiers both try 15 000 on a 20 000 invoice at the same
        moment: the invoice row lock serialises them — exactly one
        succeeds, and the till never exceeds the invoice."""
        scn = counter_scenario()
        second_cashier = scn.director  # any billing-capable staff user
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def attempt(user):
            try:
                barrier.wait()
                services.record_cash_payment(
                    actor=user, center=scn.center, invoice=scn.invoice,
                    method=Method.CASH, amount_kmf=Decimal("15000"),
                )
                outcomes.append("recorded")
            except ValidationError:
                outcomes.append("refused")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(user,))
            for user in (scn.cashier, second_cashier)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        assert sorted(outcomes) == ["recorded", "refused"]
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("15000")

    @pytest.mark.django_db(transaction=True)
    def test_receipt_numbering_is_race_safe(self):
        """Two concurrent instalments that BOTH fit: two receipts, two
        DISTINCT consecutive numbers (center row lock in issue())."""
        scn = counter_scenario()
        barrier = threading.Barrier(2, timeout=10)
        errors = []

        def attempt(user, amount):
            try:
                barrier.wait()
                services.record_cash_payment(
                    actor=user, center=scn.center, invoice=scn.invoice,
                    method=Method.CASH, amount_kmf=Decimal(amount),
                )
            except Exception as exc:  # pragma: no cover - diagnostic only
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(scn.cashier, "5000")),
            threading.Thread(target=attempt, args=(scn.director, "3000")),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        assert errors == []
        numbers = sorted(
            CashReceipt.objects.filter(center=scn.center).values_list(
                "sequence_number", flat=True
            )
        )
        assert numbers == [1, 2]
