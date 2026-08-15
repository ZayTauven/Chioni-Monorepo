"""Billing admin — READ-ONLY, both tables (S5, ADR 0018).

Same posture as ``TariffItemAdmin`` (ADR 0017 lot 2 §4): a plan price
carries a database integrality constraint (a raw write would raise
``IntegrityError`` where the service answers a French 400), and a
subscription status carries a state machine, a mandatory motive on a
freeze and an audit entry — all of which a change form bypasses in
silence. Worse here than elsewhere: flipping ``status`` to « suspendu »
in the admin would freeze a real center's administration with no motive
for its director to act on, and no trace of who decided it.

The product doors are the audited platform endpoints
(`POST /platform/subscriptions/{pk}/status/` and friends).

S5 lot 2 registers the three billing tables the same way. The numbering
counter (``SubscriptionInvoiceCounter``) is deliberately NOT registered at
all: it is plumbing, and the only interesting thing one could do with a
form there is desynchronise the « A- » series from the invoices.
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPaymentReversal,
    SubscriptionPlan,
)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "code", "name", "price_kmf", "billing_period", "is_active",
        "created_at",
    )
    list_filter = ("billing_period", "is_active")
    search_fields = ("code", "name")
    readonly_fields = (
        "code", "name", "price_kmf", "billing_period",
        "included_practitioners", "included_staff", "is_active",
        "created_at", "updated_at",
    )


@admin.register(CenterSubscription)
class CenterSubscriptionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "center", "plan", "status", "current_period_end", "status_updated_at",
    )
    list_filter = ("status", "plan")
    search_fields = ("center__name",)
    readonly_fields = (
        "center", "plan", "status", "started_at", "current_period_end",
        "status_reason", "status_updated_at", "status_updated_by",
        "created_at", "updated_at",
    )


@admin.register(SubscriptionInvoice)
class SubscriptionInvoiceAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only: an issued invoice is frozen by ``save()`` (amount,
    period, number, attachments) and its status carries a derived balance —
    a change form would put « payée » on an invoice nobody paid, without a
    règlement, without an audit line and without the center ever knowing."""

    list_display = (
        "number", "center", "status", "amount_kmf", "due_date",
        "period_start", "period_end",
    )
    list_filter = ("status", "plan_code")
    search_fields = ("sequence_number", "center__name")
    readonly_fields = (
        "center", "subscription", "sequence_number", "period_start",
        "period_end", "amount_kmf", "plan_code", "plan_label", "due_date",
        "status", "issued_by", "cancelled_at", "cancelled_by",
        "cancel_reason", "reminders_sent", "last_reminder_at",
        "created_at", "updated_at",
    )


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Append-only at the model level — the admin never offers the form."""

    list_display = ("id", "invoice", "amount_kmf", "method", "received_at")
    list_filter = ("method",)
    search_fields = ("reference", "invoice__sequence_number")
    readonly_fields = (
        "invoice", "amount_kmf", "method", "reference", "received_at",
        "recorded_by", "created_at",
    )


@admin.register(SubscriptionPaymentReversal)
class SubscriptionPaymentReversalAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "payment", "reversed_by", "created_at")
    readonly_fields = ("payment", "reason", "reversed_by", "created_at")
