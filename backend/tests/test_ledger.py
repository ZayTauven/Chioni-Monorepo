"""Ledger invariants: double entry enforced at creation, append-only forever."""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.common.models import AppendOnlyError
from apps.trustbridge.models import LedgerEntry, LedgerTransaction

from .factories import make_payment_request

pytestmark = pytest.mark.django_db

Account = LedgerEntry.Account
Direction = LedgerEntry.Direction


def balanced_entries():
    """A realistic EUR payment: guardian funds → due to center + PSP fees."""
    return [
        {
            "account": Account.GUARDIAN_FUNDS,
            "direction": Direction.DEBIT,
            "amount": Decimal("50.00"),
            "currency": "EUR",
        },
        {
            "account": Account.DUE_TO_CENTER,
            "direction": Direction.CREDIT,
            "amount": Decimal("48.50"),
            "currency": "EUR",
        },
        {
            "account": Account.PSP_FEES,
            "direction": Direction.CREDIT,
            "amount": Decimal("1.50"),
            "currency": "EUR",
        },
    ]


class TestDoubleEntryBalance:
    def test_balanced_transaction_is_created_with_its_entries(self):
        tx = LedgerTransaction.record(
            description="Paiement Nassim — consultation Mariama",
            entries=balanced_entries(),
        )

        assert tx.pk is not None
        assert tx.entries.count() == 3

    def test_unbalanced_transaction_is_rejected(self):
        entries = balanced_entries()
        entries[1]["amount"] = Decimal("40.00")  # breaks the balance

        with pytest.raises(ValidationError, match="non équilibrées"):
            LedgerTransaction.record(description="déséquilibrée", entries=entries)

        assert LedgerTransaction.objects.count() == 0
        assert LedgerEntry.objects.count() == 0

    def test_balance_is_enforced_per_currency(self):
        # EUR leg balanced, KMF leg NOT balanced -> must be rejected.
        entries = balanced_entries() + [
            {
                "account": Account.FX_CONVERSION,
                "direction": Direction.DEBIT,
                "amount": Decimal("24000"),
                "currency": "KMF",
            },
        ]

        with pytest.raises(ValidationError, match="KMF"):
            LedgerTransaction.record(description="KMF orpheline", entries=entries)

    def test_dual_currency_transaction_balances_each_leg(self):
        entries = balanced_entries() + [
            {
                "account": Account.FX_CONVERSION,
                "direction": Direction.DEBIT,
                "amount": Decimal("23861"),
                "currency": "KMF",
                "exchange_rate": Decimal("491.9675"),
            },
            {
                "account": Account.DUE_TO_CENTER,
                "direction": Direction.CREDIT,
                "amount": Decimal("23861"),
                "currency": "KMF",
                "exchange_rate": Decimal("491.9675"),
            },
        ]

        tx = LedgerTransaction.record(description="conversion EUR→KMF", entries=entries)

        assert tx.entries.filter(currency="KMF").count() == 2

    def test_fewer_than_two_entries_is_rejected(self):
        with pytest.raises(ValidationError, match="au moins deux"):
            LedgerTransaction.record(
                description="simple entrée",
                entries=[balanced_entries()[0]],
            )

    def test_zero_or_negative_amount_is_rejected(self):
        entries = balanced_entries()
        entries[0]["amount"] = Decimal("0")
        entries[1]["amount"] = Decimal("-1.50")

        with pytest.raises(ValidationError, match="> 0"):
            LedgerTransaction.record(description="montants invalides", entries=entries)

    def test_transaction_can_be_linked_to_a_payment_request(self):
        pr = make_payment_request()

        tx = LedgerTransaction.record(
            description="paiement fléché",
            entries=balanced_entries(),
            payment_request=pr,
        )

        assert tx.payment_request == pr


class TestLedgerAppendOnly:
    def test_entry_update_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())
        entry = tx.entries.first()
        entry.amount = Decimal("999.99")

        with pytest.raises(AppendOnlyError):
            entry.save()

    def test_entry_delete_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError):
            tx.entries.first().delete()

    def test_transaction_update_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())
        tx.description = "réécrite"

        with pytest.raises(AppendOnlyError):
            tx.save()

    def test_transaction_delete_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError):
            tx.delete()

    def test_queryset_bulk_update_and_delete_are_refused(self):
        LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError):
            LedgerEntry.objects.all().update(amount=Decimal("0.01"))
        with pytest.raises(AppendOnlyError):
            LedgerEntry.objects.all().delete()
        with pytest.raises(AppendOnlyError):
            LedgerTransaction.objects.all().delete()
