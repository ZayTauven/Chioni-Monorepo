"""Subscription serializers — TENANT side (S5, ADR 0018).

Audience: the DIRECTOR of the center, and him alone (see
``apps.billing.views``). Enums are rendered raw, as everywhere else in the
API: the French labels belong to the frontend (`src/lib/labels.ts`).
"""

from rest_framework import serializers

from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.billing.services import (
    subscription_invoice_balance_kmf,
    subscription_invoice_paid_kmf,
    subscription_usage,
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """The commercial offer, as read by whoever may see it.

    Same payload on both sides (tenant and platform): a plan carries no
    secret — it is what Chioni sells, and the center pays for it.
    """

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id", "code", "name", "price_kmf", "billing_period",
            "included_practitioners", "included_staff", "is_active",
        ]
        read_only_fields = fields


class CenterSubscriptionSerializer(serializers.ModelSerializer):
    """`GET /centers/{c}/subscription/` — the director's own contract.

    ``status_reason`` is rendered here because the audience IS the
    director: he is the only person of the center allowed on this route,
    exactly like ``kyc_reason`` on the center record (ADR 0017 lot 1 §5).
    It must never be copied into a payload readable by another role, and
    it is absent from every audit payload by construction.

    ``usage`` is INDICATIVE (ADR 0018 décision 3): it is displayed and
    alerted on, and no business action ever consults it — a center over
    quota keeps registering patients and opening consultations.
    """

    plan = SubscriptionPlanSerializer(read_only=True)
    usage = serializers.SerializerMethodField()
    is_frozen = serializers.BooleanField(read_only=True)

    class Meta:
        model = CenterSubscription
        fields = [
            "id", "status", "status_reason", "started_at",
            "current_period_end", "status_updated_at", "is_frozen",
            "plan", "usage",
        ]
        read_only_fields = fields

    def get_usage(self, subscription) -> dict:
        return subscription_usage(subscription.center)


class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    """One settlement Chioni recorded on a SaaS invoice.

    Rendered to BOTH audiences (the director of the center and the
    back-office) with the same fields on purpose: what Chioni says it
    received is exactly what the center must be able to check.

    ``recorded_by`` is deliberately ABSENT: which Chioni operator typed the
    line is internal — the director would be reading an identity he has no
    other way to see (same discipline as ``actor_display`` in his audit
    journal, which resolves a name only for members of HIS center).
    ``reversal_reason`` is present because it explains a line that
    disappeared from his balance; the plain fact of the reversal without
    the why would be worse than useless.
    """

    reversed = serializers.SerializerMethodField()
    reversal_reason = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id", "amount_kmf", "method", "reference", "received_at",
            "created_at", "reversed", "reversal_reason",
        ]
        read_only_fields = fields

    def get_reversed(self, payment) -> bool:
        return hasattr(payment, "reversal")

    def get_reversal_reason(self, payment) -> str | None:
        reversal = getattr(payment, "reversal", None)
        return reversal.reason if reversal is not None else None


class SubscriptionInvoiceSerializer(serializers.ModelSerializer):
    """`GET /centers/{c}/subscription/invoices/` — the DIRECTOR's own bills.

    ``paid_kmf``/``balance_kmf`` are DERIVED, never stored (patron
    ``InvoiceStaffSerializer``): they read the SQL annotations when the row
    came from a list (no N+1) and fall back to the per-row derivation
    otherwise. Both funnel through the same rule — amount minus
    non-reversed settlements.

    ``cancel_reason`` is rendered here, unlike ``Invoice.cancel_reason``
    which is BILLING-only: the asymmetry is deliberate. That one is written
    by the center about a patient's invoice; this one is written by CHIONI
    about the center's own bill, and the director is precisely the person it
    is addressed to.
    """

    number = serializers.CharField(read_only=True)
    paid_kmf = serializers.SerializerMethodField()
    balance_kmf = serializers.SerializerMethodField()
    payments = SubscriptionPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = SubscriptionInvoice
        fields = [
            "id", "number", "status", "period_start", "period_end",
            "amount_kmf", "paid_kmf", "balance_kmf", "due_date",
            "plan_code", "plan_label", "created_at", "cancelled_at",
            "cancel_reason", "payments",
        ]
        read_only_fields = fields

    def get_paid_kmf(self, invoice) -> str:
        value = getattr(invoice, "paid_kmf_agg", None)
        if value is None:
            value = subscription_invoice_paid_kmf(invoice)
        return str(value)

    def get_balance_kmf(self, invoice) -> str:
        value = getattr(invoice, "balance_kmf_agg", None)
        if value is None:
            value = subscription_invoice_balance_kmf(invoice)
        return str(value)
