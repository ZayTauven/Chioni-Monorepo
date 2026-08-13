"""Trust Bridge invariants: idempotency, receipts, invoice snapshots, tenant scoping."""

from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.common.models import AppendOnlyError
from apps.trustbridge.models import Invoice, InvoiceLine, PaymentIntent, Receipt

from .factories import (
    make_act,
    make_center,
    make_encounter,
    make_invoice,
    make_ledger_tx,
    make_payment_request,
    make_tariff,
)

pytestmark = pytest.mark.django_db


def make_intent(payment_request, key):
    return PaymentIntent.objects.create(
        payment_request=payment_request,
        idempotency_key=key,
        amount_eur=Decimal("50.00"),
        exchange_rate=Decimal("492.000000"),
        amount_kmf=Decimal("24600.00"),
    )


class TestPaymentIntentIdempotency:
    def test_same_idempotency_key_cannot_register_twice(self):
        pr = make_payment_request()
        make_intent(pr, "stripe-evt-abc123")

        with pytest.raises(IntegrityError):
            make_intent(pr, "stripe-evt-abc123")

    def test_distinct_attempts_carry_distinct_keys(self):
        pr = make_payment_request()
        make_intent(pr, "attempt-1")
        make_intent(pr, "attempt-2")

        assert pr.payment_intents.count() == 2


class TestInvoiceSnapshot:
    def test_invoice_line_copies_the_act_snapshot(self):
        encounter = make_encounter()
        tariff = make_tariff(encounter.center, label="Analyses sanguines", price_kmf="15000")
        act = make_act(encounter=encounter, tariff_item=tariff)
        invoice = make_invoice(
            encounter=encounter, with_lines=False, status=Invoice.Status.DRAFT
        )

        line = InvoiceLine.objects.create(invoice=invoice, act=act)

        assert line.label == "Analyses sanguines"
        assert line.amount_kmf == Decimal("15000")

    def test_invoice_total_is_the_sum_of_its_lines(self):
        encounter = make_encounter()
        t1 = make_tariff(encounter.center, price_kmf="7500")
        t2 = make_tariff(encounter.center, price_kmf="15000")
        invoice = make_invoice(
            encounter=encounter, with_lines=False, status=Invoice.Status.DRAFT
        )
        InvoiceLine.objects.create(invoice=invoice, act=make_act(encounter, t1))
        InvoiceLine.objects.create(invoice=invoice, act=make_act(encounter, t2))

        invoice.recompute_total()

        assert invoice.total_kmf == Decimal("22500")


class TestReceipts:
    def issue(self, pr, center):
        return Receipt.issue(
            payment_request=pr,
            center=center,
            ledger_transaction=make_ledger_tx(payment_request=pr),
            amount_eur_paid=Decimal("50.00"),
            amount_kmf_received=Decimal("23861.00"),
            exchange_rate=Decimal("491.967500"),
            fees_eur=Decimal("1.50"),
        )

    def test_sequence_is_per_center(self):
        center_a = make_center(name="Clinique Salama")
        center_b = make_center(name="Hôpital El-Maarouf")
        r1 = self.issue(make_payment_request(), center_a)
        r2 = self.issue(make_payment_request(), center_a)
        r3 = self.issue(make_payment_request(), center_b)

        assert (r1.sequence_number, r2.sequence_number) == (1, 2)
        assert r3.sequence_number == 1  # each center numbers its own receipts

    def test_receipt_is_append_only(self):
        receipt = self.issue(make_payment_request(), make_center())
        receipt.amount_eur_paid = Decimal("9999.00")

        with pytest.raises(AppendOnlyError):
            receipt.save()
        with pytest.raises(AppendOnlyError):
            receipt.delete()

    def test_one_receipt_per_payment_request(self):
        pr = make_payment_request()
        center = make_center()
        self.issue(pr, center)

        with pytest.raises(IntegrityError):
            self.issue(pr, center)


class TestTenantScoping:
    def test_for_center_isolates_invoices(self):
        inv_a = make_invoice()
        inv_b = make_invoice()
        center_a = inv_a.center
        center_b = inv_b.center

        assert list(Invoice.objects.for_center(center_a)) == [inv_a]
        assert list(Invoice.objects.for_center(center_b)) == [inv_b]
        assert inv_b not in Invoice.objects.for_center(center_a)
