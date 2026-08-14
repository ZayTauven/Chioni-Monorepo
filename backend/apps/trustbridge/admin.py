"""Trust Bridge admin — INSPECTION ONLY (S4, ADR 0017 décision 4).

Not one class here accepts a write. The money path has a state machine
(``PaymentRequest``), a double-entry ledger, receipts reconciled against
that ledger and an immutable audit trail: an admin change form writes the
row and none of the rest. ``AppendOnlyAdminMixin``/``ReadOnlyAdminMixin``
now come from ``apps.common.admin`` — before S4 the mixin lived here and
covered change/delete only, so every consumer had to re-declare
``has_add_permission`` by hand.
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .models import (
    CashPayment,
    CashPaymentReversal,
    CashReceipt,
    Dispute,
    Invoice,
    InvoiceLine,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
    PaymentRequest,
    PaymentRequestShare,
    Receipt,
)


class InvoiceLineInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = InvoiceLine
    extra = 0
    readonly_fields = ("label", "amount_kmf")


@admin.register(Invoice)
class InvoiceAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only since S4: ``status`` was the LAST hand-editable door to
    ``annulee`` (vigilance vague 2). Cancelling an invoice is now
    ``POST /invoices/{pk}/cancel/`` — mandatory motive, cash-in guards,
    audit. Amounts and anchors are frozen outside draft by a DB trigger
    anyway (R3, ADR 0006): the form could only ever produce a refusal or
    an unaudited status flip."""

    list_display = ("id", "center", "patient", "total_kmf", "status", "created_at")
    list_filter = ("status", "center")
    search_fields = ("patient__last_name", "patient__first_name", "center__name")
    autocomplete_fields = ("encounter", "center", "patient")
    inlines = [InvoiceLineInline]


class PaymentRequestShareInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = PaymentRequestShare
    extra = 0
    autocomplete_fields = ("guardian_link", "shared_by")


@admin.register(PaymentRequest)
class PaymentRequestAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only since S4. The whole state machine (M5) is exclusive to
    the services, and a share created here would bypass the same-patient
    trigger's sibling checks (who may be asked to pay)."""

    list_display = ("id", "invoice", "status", "created_by", "created_at")
    list_filter = ("status",)
    readonly_fields = ("status",)
    search_fields = (
        "invoice__patient__last_name",
        "invoice__patient__first_name",
        "invoice__center__name",
    )
    autocomplete_fields = ("invoice", "created_by")
    inlines = [PaymentRequestShareInline]


@admin.register(PaymentIntent)
class PaymentIntentAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Money-path record: amounts and status feed the ledger on webhook
    success, so nothing here may be edited, deleted, or hand-created —
    intents only exist through ``create_payment_intent()``."""

    list_display = (
        "id",
        "payment_request",
        "psp",
        "psp_reference",
        "amount_eur",
        "exchange_rate",
        "amount_kmf",
        "status",
        "created_at",
    )
    list_filter = ("psp", "status")
    search_fields = ("psp_reference", "idempotency_key")
    autocomplete_fields = ("payment_request", "guardian")


class LedgerEntryInline(AppendOnlyAdminMixin, admin.TabularInline):
    model = LedgerEntry
    extra = 0
    can_delete = False
    readonly_fields = ("account", "direction", "amount", "currency", "exchange_rate")


@admin.register(LedgerTransaction)
class LedgerTransactionAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Transactions only exist through ``LedgerTransaction.record()``."""

    list_display = ("id", "description", "payment_request", "center", "created_at")
    search_fields = ("description",)
    inlines = [LedgerEntryInline]


@admin.register(LedgerEntry)
class LedgerEntryAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "transaction",
        "account",
        "direction",
        "amount",
        "currency",
        "exchange_rate",
        "created_at",
    )
    list_filter = ("account", "direction", "currency")


@admin.register(Dispute)
class DisputeAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only since S4 (add and change joined the existing delete
    refusal): resolving a dispute restores the pre-dispute status of the
    payment request through ``resolve_dispute`` — a hand-edited
    ``status``/``previous_status`` pair would strand the request."""

    list_display = (
        "id",
        "payment_request",
        "status",
        "previous_status",
        "opened_by",
        "resolved_by",
        "resolved_at",
        "created_at",
    )
    list_filter = ("status",)
    autocomplete_fields = ("payment_request", "opened_by", "resolved_by")


@admin.register(CashPayment)
class CashPaymentAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Caisse (ADR 0015): cash-ins only exist through the services (counter
    service or PSP webhook) — nothing here may be created, edited or
    deleted; corrections are reversals."""

    list_display = (
        "id",
        "center",
        "invoice",
        "method",
        "operator",
        "amount_kmf",
        "received_by",
        "created_at",
    )
    list_filter = ("method", "center")
    search_fields = ("reference",)


@admin.register(CashPaymentReversal)
class CashPaymentReversalAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Reversals only exist through ``reverse_cash_payment()``."""

    list_display = (
        "id",
        "cash_payment",
        "reversed_by",
        "ledger_transaction",
        "created_at",
    )


@admin.register(CashReceipt)
class CashReceiptAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Counter receipts only exist through ``CashReceipt.issue()``."""

    list_display = (
        "center",
        "sequence_number",
        "cash_payment",
        "amount_kmf",
        "issued_at",
    )
    list_filter = ("center",)


@admin.register(Receipt)
class ReceiptAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Diaspora receipts only exist through ``Receipt.issue()``."""

    list_display = (
        "center",
        "sequence_number",
        "payment_request",
        "ledger_transaction",
        "amount_eur_paid",
        "amount_kmf_received",
        "fees_eur",
        "exchange_rate",
        "issued_at",
    )
    list_filter = ("center",)
