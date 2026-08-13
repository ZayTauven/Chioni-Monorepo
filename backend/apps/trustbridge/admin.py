from django.contrib import admin

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


class AppendOnlyAdminMixin:
    """Mirror the model-level lock in the admin: read-only after creation."""

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    readonly_fields = ("label", "amount_kmf")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "center", "patient", "total_kmf", "status", "created_at")
    list_filter = ("status", "center")
    search_fields = ("patient__last_name", "patient__first_name", "center__name")
    autocomplete_fields = ("encounter", "center", "patient")
    inlines = [InvoiceLineInline]


class PaymentRequestShareInline(admin.TabularInline):
    model = PaymentRequestShare
    extra = 0
    autocomplete_fields = ("guardian_link", "shared_by")


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "status", "created_by", "created_at")
    list_filter = ("status",)
    # State transitions live in the service layer (state machine + DB
    # triggers); the admin must not offer a bypass.
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

    def has_add_permission(self, request):
        # Intents must be created through create_payment_intent().
        return False


class LedgerEntryInline(admin.TabularInline):
    model = LedgerEntry
    extra = 0
    can_delete = False
    readonly_fields = ("account", "direction", "amount", "currency", "exchange_rate")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(LedgerTransaction)
class LedgerTransactionAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "description", "payment_request", "center", "created_at")
    search_fields = ("description",)
    inlines = [LedgerEntryInline]

    def has_add_permission(self, request):
        # Transactions must be created through LedgerTransaction.record().
        return False


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

    def has_add_permission(self, request):
        return False


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
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

    def has_delete_permission(self, request, obj=None):
        # Disputes are part of the money trail: resolved, never erased.
        return False


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

    def has_add_permission(self, request):
        return False


@admin.register(CashPaymentReversal)
class CashPaymentReversalAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "cash_payment",
        "reversed_by",
        "ledger_transaction",
        "created_at",
    )

    def has_add_permission(self, request):
        # Reversals must be created through reverse_cash_payment().
        return False


@admin.register(CashReceipt)
class CashReceiptAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "center",
        "sequence_number",
        "cash_payment",
        "amount_kmf",
        "issued_at",
    )
    list_filter = ("center",)

    def has_add_permission(self, request):
        # Counter receipts must be created through CashReceipt.issue().
        return False


@admin.register(Receipt)
class ReceiptAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
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

    def has_add_permission(self, request):
        # Receipts must be created through Receipt.issue().
        return False
