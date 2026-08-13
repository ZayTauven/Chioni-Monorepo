"""Trust Bridge serializers — ONE serializer PER AUDIENCE (ADR 0005/0008).

The hard rule this module materialises: under the minimal ``paiements``
scope a guardian sees amounts, statuses, receipts and the GENERIC nature
of acts (``generic_category``) — NEVER the detailed ``label`` of a tariff,
act or invoice line, nor anything clinical. Any « paiements » serializer
embarking ``label`` is a review-blocking defect (ADR 0005).

Explicit fields everywhere — never ``fields = "__all__"`` on money models.
Every amount field name carries its currency (``_kmf``/``_eur``).
"""

from rest_framework import serializers

from apps.patients.serializers import PatientGuardianSerializer
from apps.trustbridge.models import (
    Dispute,
    Invoice,
    InvoiceLine,
    PaymentIntent,
    PaymentRequest,
    PaymentRequestShare,
    Receipt,
)

# ---------------------------------------------------------------------------
# Audience: STAFF of the invoicing center
# ---------------------------------------------------------------------------


class InvoiceLineStaffSerializer(serializers.ModelSerializer):
    """Staff sees the full accounting line (label included — their invoice)."""

    class Meta:
        model = InvoiceLine
        fields = ["id", "act", "label", "generic_category", "amount_kmf"]
        read_only_fields = fields


class InvoiceStaffSerializer(serializers.ModelSerializer):
    lines = InvoiceLineStaffSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "encounter", "patient", "total_kmf", "status",
            "lines", "created_at",
        ]
        read_only_fields = fields


class InvoiceCreateSerializer(serializers.Serializer):
    """Staff creates an invoice from an encounter (acts optional subset)."""

    encounter = serializers.IntegerField(
        error_messages={"required": "L'identifiant de la consultation est requis."}
    )
    act_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=False
    )


class PaymentRequestShareStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRequestShare
        fields = ["id", "guardian_link", "shared_at", "shared_by"]
        read_only_fields = fields


class PaymentRequestStaffSerializer(serializers.ModelSerializer):
    shares = PaymentRequestShareStaffSerializer(many=True, read_only=True)
    total_kmf = serializers.DecimalField(
        source="invoice.total_kmf", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = PaymentRequest
        fields = [
            "id", "invoice", "total_kmf", "status", "created_by",
            "patient_acknowledged_at", "shares", "created_at",
        ]
        read_only_fields = fields


class ShareTargetSerializer(serializers.Serializer):
    """Target of a share/unshare action: one guardian link."""

    guardian_link = serializers.IntegerField(
        error_messages={"required": "L'identifiant du lien de tutelle est requis."}
    )


class DisputeStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dispute
        fields = [
            "id", "payment_request", "opened_by", "reason", "previous_status",
            "status", "resolved_by", "resolution_note", "resolved_at",
            "created_at",
        ]
        read_only_fields = fields


class DisputeResolveSerializer(serializers.Serializer):
    resolution_note = serializers.CharField(
        error_messages={"required": "Le motif de résolution est obligatoire."}
    )


class DisputeCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(
        error_messages={"required": "Le motif du litige est obligatoire."}
    )


# ---------------------------------------------------------------------------
# Shared: RECEIPTS (dual currency, explicit fees — no clinical data at all)
# ---------------------------------------------------------------------------


class ReceiptSerializer(serializers.ModelSerializer):
    """The receipt everyone keeps: EUR paid, KMF received, explicit fees,
    frozen rate. Carries NO care information whatsoever."""

    receipt_number = serializers.IntegerField(
        source="sequence_number", read_only=True
    )
    center_name = serializers.CharField(source="center.name", read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id", "payment_request", "center", "center_name", "receipt_number",
            "amount_eur_paid", "fees_eur", "amount_kmf_received",
            "exchange_rate", "issued_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Audience: the PATIENT (owner of the invoiced care)
# ---------------------------------------------------------------------------


class InvoiceLinePatientSerializer(serializers.ModelSerializer):
    """The patient sees their own care labels — it is THEIR information."""

    class Meta:
        model = InvoiceLine
        fields = ["id", "label", "generic_category", "amount_kmf"]
        read_only_fields = fields


class PaymentRequestPatientSerializer(serializers.ModelSerializer):
    total_kmf = serializers.DecimalField(
        source="invoice.total_kmf", max_digits=12, decimal_places=2, read_only=True
    )
    center_name = serializers.CharField(
        source="invoice.center.name", read_only=True
    )
    lines = InvoiceLinePatientSerializer(
        source="invoice.lines", many=True, read_only=True
    )
    shared_with_links = serializers.PrimaryKeyRelatedField(
        source="shared_with", many=True, read_only=True
    )

    class Meta:
        model = PaymentRequest
        fields = [
            "id", "center_name", "total_kmf", "status", "lines",
            "shared_with_links", "patient_acknowledged_at", "created_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Audience: a GUARDIAN — generic categories ONLY, never a label
# ---------------------------------------------------------------------------


class InvoiceLineGuardianSerializer(serializers.ModelSerializer):
    """ADR 0005 — the ONLY care information here is the generic nature.

    NO ``label``, NO ``act`` reference: « Analyses et examens — 15 000
    KMF », never « Sérologie VIH — 15 000 KMF ».
    """

    class Meta:
        model = InvoiceLine
        fields = ["generic_category", "amount_kmf"]
        read_only_fields = fields


class PaymentRequestGuardianSerializer(serializers.ModelSerializer):
    """What a shared guardian sees of a request: amounts, status, generic
    natures, the protégé's administrative identity — nothing else."""

    patient = PatientGuardianSerializer(source="invoice.patient", read_only=True)
    center_name = serializers.CharField(
        source="invoice.center.name", read_only=True
    )
    total_kmf = serializers.DecimalField(
        source="invoice.total_kmf", max_digits=12, decimal_places=2, read_only=True
    )
    lines = InvoiceLineGuardianSerializer(
        source="invoice.lines", many=True, read_only=True
    )

    class Meta:
        model = PaymentRequest
        fields = [
            "id", "patient", "center_name", "total_kmf", "status",
            "lines", "created_at",
        ]
        read_only_fields = fields


class QuoteSerializer(serializers.Serializer):
    """The transparent conversion quote shown BEFORE payment (étude §4.5)."""

    amount_kmf = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency_received = serializers.CharField(default="KMF")
    exchange_rate = serializers.DecimalField(max_digits=12, decimal_places=6)
    amount_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    fees_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_eur = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency_paid = serializers.CharField(default="EUR")


class PaymentIntentGuardianSerializer(serializers.ModelSerializer):
    """The guardian's view of their own payment attempt."""

    class Meta:
        model = PaymentIntent
        fields = [
            "id", "payment_request", "psp", "psp_reference",
            "amount_eur", "exchange_rate", "amount_kmf", "status",
            "created_at",
        ]
        read_only_fields = fields
