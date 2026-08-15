"""Back-office subscription serializers — audience: `PlatformStaff` only.

Invariant éthique de S4, held here too (ADR 0017 décision 1): **no
serializer of this module carries a patient**. The operator's perimeter is
the tenant and its contract — a center, an offer, a status, seat counts.
Not a name, not a phone, nothing clinical. A negative field test walks
every ``/platform/`` payload and would fail on a single leaking key.
"""

from rest_framework import serializers

from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.billing.serializers import SubscriptionPlanSerializer
from apps.billing.services import (
    subscription_invoice_balance_kmf,
    subscription_invoice_paid_kmf,
    subscription_usage,
    usage_from_annotations,
)
from apps.centers.models import HealthCenter


class PlatformSubscriptionPlanWriteSerializer(serializers.ModelSerializer):
    """Body of `POST /platform/plans/` and `PATCH /platform/plans/{pk}/`.

    ``price_kmf`` inherits the model's ``validate_kmf_integral`` validator:
    a fractional price is refused at the door, in French, and the database
    constraint stands behind it (patron ``TariffItem``).
    """

    class Meta:
        model = SubscriptionPlan
        fields = [
            "code", "name", "price_kmf", "billing_period",
            "included_practitioners", "included_staff", "is_active",
        ]


class PlatformSubscriptionSerializer(serializers.ModelSerializer):
    """One tenant's contract as the back-office sees it.

    ``usage`` comes from the SQL annotations when the row was listed
    (``annotate_subscription_usage`` — no per-row query on a back-office
    list, the lesson consigned by the RGPD queue of S4 lot 3) and falls
    back to the per-center aggregate otherwise. Both funnel through the
    SAME comparison, and a test locks their row-by-row agreement.
    """

    center = serializers.IntegerField(source="center_id", read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    plan = SubscriptionPlanSerializer(read_only=True)
    usage = serializers.SerializerMethodField()
    is_frozen = serializers.BooleanField(read_only=True)

    class Meta:
        model = CenterSubscription
        fields = [
            "id", "center", "center_name", "status", "status_reason",
            "started_at", "current_period_end", "status_updated_at",
            "is_frozen", "plan", "usage", "created_at",
        ]
        read_only_fields = fields

    def get_usage(self, subscription) -> dict:
        if hasattr(subscription, "staff_seat_count"):
            return usage_from_annotations(subscription)
        return subscription_usage(subscription.center)


class PlatformSubscriptionCreateSerializer(serializers.Serializer):
    """Body of `POST /platform/subscriptions/` — open a tenant's contract.

    ``status`` accepts ``essai``/``actif`` only; the service refuses the
    rest with its own sentence — a freeze is a decision taken through the
    audited transition, with its mandatory motive, never through a
    creation form.
    """

    center = serializers.PrimaryKeyRelatedField(
        queryset=HealthCenter.objects.all(),
        error_messages={
            "required": "Le centre est requis.",
            "does_not_exist": "Ce centre est introuvable.",
            "incorrect_type": "Identifiant de centre invalide.",
        },
    )
    plan = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.all(),
        error_messages={
            "required": "L'offre est requise.",
            "does_not_exist": "Cette offre est introuvable.",
            "incorrect_type": "Identifiant d'offre invalide.",
        },
    )
    status = serializers.ChoiceField(
        choices=CenterSubscription.Status.choices,
        required=False,
        default=CenterSubscription.Status.TRIAL,
    )
    started_at = serializers.DateField(required=False, allow_null=True)
    current_period_end = serializers.DateField(required=False, allow_null=True)


class PlatformSubscriptionPlanChangeSerializer(serializers.Serializer):
    """Body of `POST /platform/subscriptions/{pk}/plan/` — `{plan}`."""

    plan = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.all(),
        error_messages={
            "required": "L'offre est requise.",
            "does_not_exist": "Cette offre est introuvable.",
            "incorrect_type": "Identifiant d'offre invalide.",
        },
    )


class PlatformSubscriptionStatusSerializer(serializers.Serializer):
    """Body of `POST /platform/subscriptions/{pk}/status/` — `{status, reason}`.

    ``reason`` is optional HERE and mandatory to freeze in the service:
    the rule lives with the state machine, not in a form (patron
    ``PlatformKycTransitionSerializer``).
    """

    status = serializers.ChoiceField(
        choices=CenterSubscription.Status.choices,
        error_messages={"required": "Le statut cible est requis."},
    )
    reason = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )


# ---------------------------------------------------------------------------
# Facturation SaaS (S5 lot 2, ADR 0018 décision 4)
# ---------------------------------------------------------------------------


class PlatformSubscriptionPaymentSerializer(serializers.ModelSerializer):
    """One settlement, as the back-office sees it.

    Richer than the tenant's view by exactly two things — WHO typed the
    line and WHO reversed it. Those are Chioni's internal accountability,
    and they stay on this side (the center reads the amounts, the method,
    the reference and the reversal motive; not the operator's identity).
    """

    reversed = serializers.SerializerMethodField()
    reversal_reason = serializers.SerializerMethodField()
    reversed_by = serializers.SerializerMethodField()
    recorded_by = serializers.IntegerField(source="recorded_by_id", read_only=True)

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id", "invoice", "amount_kmf", "method", "reference",
            "received_at", "recorded_by", "created_at", "reversed",
            "reversal_reason", "reversed_by",
        ]
        read_only_fields = fields

    def get_reversed(self, payment) -> bool:
        return hasattr(payment, "reversal")

    def get_reversal_reason(self, payment) -> str | None:
        reversal = getattr(payment, "reversal", None)
        return reversal.reason if reversal is not None else None

    def get_reversed_by(self, payment) -> int | None:
        reversal = getattr(payment, "reversal", None)
        return reversal.reversed_by_id if reversal is not None else None


class PlatformSubscriptionInvoiceSerializer(serializers.ModelSerializer):
    """One SaaS invoice in the back-office — the tenant, never a person.

    ``center`` is an id and ``center_name`` the tenant's name: the invariant
    of the fourth hat holds here too, and it is easy to hold — a SaaS
    invoice has no patient, no act and no care by construction (ADR 0018
    décision 1). That is precisely why the registry is separate.
    """

    number = serializers.CharField(read_only=True)
    center = serializers.IntegerField(source="center_id", read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    subscription = serializers.IntegerField(
        source="subscription_id", read_only=True
    )
    issued_by = serializers.IntegerField(source="issued_by_id", read_only=True)
    cancelled_by = serializers.IntegerField(
        source="cancelled_by_id", read_only=True
    )
    paid_kmf = serializers.SerializerMethodField()
    balance_kmf = serializers.SerializerMethodField()
    payments = PlatformSubscriptionPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = SubscriptionInvoice
        fields = [
            "id", "number", "center", "center_name", "subscription", "status",
            "period_start", "period_end", "amount_kmf", "paid_kmf",
            "balance_kmf", "due_date", "plan_code", "plan_label", "issued_by",
            "cancelled_at", "cancelled_by", "cancel_reason", "reminders_sent",
            "last_reminder_at", "created_at", "payments",
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


class PlatformSubscriptionPaymentCreateSerializer(serializers.Serializer):
    """Body of `POST /platform/subscription-invoices/{pk}/payments/`.

    ``received_at`` is the day the money ACTUALLY arrived (a transfer seen
    on Monday may have left on Friday) and defaults to today; the service
    refuses a future date. The amount's integrality and the « never beyond
    the balance » rule live in the service, with the row lock — not in a
    form.
    """

    amount_kmf = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        error_messages={"required": "Le montant est requis."},
    )
    method = serializers.ChoiceField(
        choices=SubscriptionPayment.Method.choices,
        error_messages={"required": "Le moyen de règlement est requis."},
    )
    reference = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default=""
    )
    received_at = serializers.DateField(required=False, allow_null=True)


class PlatformReasonSerializer(serializers.Serializer):
    """Body of the two motivated actions — `{reason}`, jamais vide.

    Shared by the reversal and the cancellation: both are corrections of a
    money line, and a correction without a written motive is exactly what
    ADR 0015 refused at the cash desk. The motive is stored ON the row
    (read by Chioni and by the director) and NEVER journalised.
    """

    reason = serializers.CharField(
        max_length=2000,
        error_messages={
            "required": "Le motif est obligatoire.",
            "blank": "Le motif est obligatoire.",
        },
    )
