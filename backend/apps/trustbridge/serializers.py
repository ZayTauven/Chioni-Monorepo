"""Trust Bridge serializers — ONE serializer PER AUDIENCE (ADR 0005/0008).

The hard rule this module materialises: under the minimal ``paiements``
scope a guardian sees amounts, statuses, receipts and the GENERIC nature
of acts (``generic_category``) — NEVER the detailed ``label`` of a tariff,
act or invoice line, nor anything clinical. Any « paiements » serializer
embarking ``label`` is a review-blocking defect (ADR 0005).

Explicit fields everywhere — never ``fields = "__all__"`` on money models.
Every amount field name carries its currency (``_kmf``/``_eur``).
"""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.patients.serializers import PatientGuardianSerializer, _mask_phone
from apps.trustbridge.models import (
    CashPayment,
    CashPaymentReversal,
    CashReceipt,
    Dispute,
    Invoice,
    InvoiceLine,
    MobileMoneyOperator,
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
    # ADR 0015 — the caisse view: what was collected (all methods,
    # reversals excluded) and what is still owed. Derived from the
    # payments, never a stored mutable field.
    paid_kmf = serializers.SerializerMethodField()
    balance_kmf = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "encounter", "patient", "total_kmf", "paid_kmf",
            "balance_kmf", "status", "lines",
            # S1 — cancellation trail (null/empty until cancelled). The
            # reason is BILLING-facing information (like the reversal
            # reason on the cash journal and the dispute motive): this
            # serializer is for BILLING readers — the any-staff invoice
            # reads use InvoiceOperatingSerializer below, and patients or
            # guardians never carry it (their serializers don't).
            "cancelled_at", "cancel_reason",
            "created_at",
        ]
        read_only_fields = fields

    def get_paid_kmf(self, obj) -> str:
        from apps.trustbridge.services import invoice_paid_kmf

        return str(invoice_paid_kmf(obj))

    def get_balance_kmf(self, obj) -> str:
        from apps.trustbridge.services import invoice_balance_kmf

        return str(invoice_balance_kmf(obj))


class InvoiceOperatingSerializer(InvoiceStaffSerializer):
    """Any-staff operating view of an invoice (S1, passe guardian).

    Everything the floor needs — EXCEPT ``cancel_reason``: free text typed
    at the caisse, the same class of narrative as a dispute motive or a
    reversal reason, both already restricted to BILLING roles (arbitrage
    C.3). The operational STATE (``status``, ``cancelled_at``) stays
    visible to everyone; the narrative does not. Mirror of the R-API-1
    role segmentation, applied to money texts.
    """

    class Meta(InvoiceStaffSerializer.Meta):
        fields = [
            f for f in InvoiceStaffSerializer.Meta.fields
            if f != "cancel_reason"
        ]
        read_only_fields = fields


class UnpaidInvoiceStaffSerializer(serializers.ModelSerializer):
    """One row of the unpaid list (ADR 0015, vague 2b) — relance material.

    ``paid_kmf``/``balance_kmf`` read the SQL annotations carried by
    ``services.unpaid_invoices_qs`` (set-based mirror of
    ``invoice_balance_kmf``, agreement locked by tests) — NEVER the per-row
    helpers, which would re-query the payments for every row (N+1).

    The patient's phone is MASKED (same helper as the guardian routing
    list of the previous wave): the desk confirms an identity at a glance
    (« le numéro finissant par 78 ? »), a bulk money view never hands out
    a harvestable phone book. The full phone stays where it already is —
    the patient registry, one profile at a time.
    """

    patient_name = serializers.SerializerMethodField()
    patient_phone_masked = serializers.SerializerMethodField()
    paid_kmf = serializers.SerializerMethodField()
    balance_kmf = serializers.SerializerMethodField()
    age_days = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "patient", "patient_name", "patient_phone_masked",
            "total_kmf", "paid_kmf", "balance_kmf", "age_days", "created_at",
        ]
        read_only_fields = fields

    def get_patient_name(self, invoice) -> str:
        patient = invoice.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_patient_phone_masked(self, invoice) -> str:
        phone = invoice.patient.phone
        return _mask_phone(phone) if phone else ""

    def get_paid_kmf(self, invoice) -> str:
        return str(invoice.paid_kmf_agg)

    def get_balance_kmf(self, invoice) -> str:
        return str(invoice.balance_kmf_agg)

    def get_age_days(self, invoice) -> int:
        """Whole LOCAL days since the invoice was created (ancienneté)."""
        created_day = timezone.localtime(invoice.created_at).date()
        return (timezone.localdate() - created_day).days


class InvoiceCreateSerializer(serializers.Serializer):
    """Staff creates an invoice from an encounter (acts optional subset)."""

    encounter = serializers.IntegerField(
        error_messages={"required": "L'identifiant de la consultation est requis."}
    )
    act_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=False
    )


class InvoiceCancelSerializer(serializers.Serializer):
    """Body of `POST /centers/{c}/invoices/{pk}/cancel/` (S1)."""

    reason = serializers.CharField(
        error_messages={
            "required": "Le motif d'annulation est obligatoire.",
            "blank": "Le motif d'annulation est obligatoire.",
        }
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
            "paid_at", "patient_acknowledged_at", "shares", "created_at",
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
            "shared_with_links", "paid_at", "patient_acknowledged_at",
            "created_at",
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
            "paid_at", "lines", "created_at",
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


# ---------------------------------------------------------------------------
# Caisse du centre — encaissements guichet (ADR 0015)
# ---------------------------------------------------------------------------


class CashReceiptSerializer(serializers.ModelSerializer):
    """Counter receipt — pure KMF, « G- » series separate from diaspora."""

    receipt_number = serializers.CharField(source="number", read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    method = serializers.CharField(source="cash_payment.method", read_only=True)

    class Meta:
        model = CashReceipt
        fields = [
            "id", "receipt_number", "sequence_number", "center",
            "center_name", "amount_kmf", "method", "issued_at",
        ]
        read_only_fields = fields


def _staff_display_name(user):
    """Nom complet d'un membre du personnel — JAMAIS le username en repli
    (identifiant technique, il ne sort pas d'un payload de caisse) : deux
    noms vides rendent une chaîne vide, une FK nulle rend ``None`` (miroir
    du champ id — l'encaissement Pont de Confiance n'a pas de caissier)."""
    if user is None:
        return None
    return f"{user.first_name} {user.last_name}".strip()


class CashPaymentReversalSerializer(serializers.ModelSerializer):
    """A reversal, visible and SIGNED in the cash journal: who, why, when,
    which amount/method it undoes, and its own ledger transaction."""

    amount_kmf = serializers.DecimalField(
        source="cash_payment.amount_kmf",
        max_digits=12, decimal_places=2, read_only=True,
    )
    method = serializers.CharField(source="cash_payment.method", read_only=True)
    # SV : la liste ``reversals`` du journal du jour rend cet objet à plat,
    # et une contre-passation peut défaire un encaissement d'un AUTRE jour —
    # sans l'id de facture elle n'était pas navigable.
    invoice = serializers.IntegerField(
        source="cash_payment.invoice_id", read_only=True
    )
    # AUDIENCE TRANCHÉE (SV) : tous les lecteurs staff de ce serializer —
    # déjà gatés BILLING par les vues. Un encaissement est un geste
    # d'argent : la redevabilité de qui a tenu la caisse vaut pour toute la
    # caisse. Ce n'est PAS le cas S8 du signaleur d'équipement (un
    # signalement ne change rien, un encaissement si).
    reversed_by_display = serializers.SerializerMethodField()

    class Meta:
        model = CashPaymentReversal
        fields = [
            "id", "cash_payment", "invoice", "method", "amount_kmf", "reason",
            "reversed_by", "reversed_by_display", "ledger_transaction",
            "created_at",
        ]
        read_only_fields = fields

    def get_reversed_by_display(self, obj) -> str | None:
        return _staff_display_name(obj.reversed_by)


class CashPaymentStaffSerializer(serializers.ModelSerializer):
    """One cash-in as the center sees it — receipt and reversal embedded.

    ``receipt`` is null for a Trust Bridge cash-in (its receipt is the
    dual-currency one issued at closure) and ``reversal`` is null until
    the payment is reversed.
    """

    receipt = serializers.SerializerMethodField()
    reversal = serializers.SerializerMethodField()
    # AUDIENCE TRANCHÉE (SV) : tous les lecteurs staff de ce serializer —
    # déjà gatés BILLING par les vues. Un encaissement est un geste
    # d'argent : la redevabilité de qui a tenu la caisse vaut pour toute la
    # caisse. Ce n'est PAS le cas S8 du signaleur d'équipement (un
    # signalement ne change rien, un encaissement si). ``None`` pour un
    # encaissement Pont de Confiance (``received_by`` nul : webhook PSP).
    received_by_display = serializers.SerializerMethodField()

    class Meta:
        model = CashPayment
        fields = [
            "id", "invoice", "method", "operator", "reference",
            "amount_kmf", "received_by", "received_by_display",
            "payment_intent", "ledger_transaction", "receipt", "reversal",
            "created_at",
        ]
        read_only_fields = fields

    def get_received_by_display(self, obj) -> str | None:
        return _staff_display_name(obj.received_by)

    @staticmethod
    def get_receipt(obj):
        receipt = getattr(obj, "cash_receipt", None)
        return CashReceiptSerializer(receipt).data if receipt else None

    @staticmethod
    def get_reversal(obj):
        reversal = getattr(obj, "reversal", None)
        return CashPaymentReversalSerializer(reversal).data if reversal else None


class CashPaymentCreateSerializer(serializers.Serializer):
    """Counter cash-in input — the amount is in WHOLE KMF (the franc has
    no subdivision in practice, ADR 0003); the balance rules live in the
    service, never here."""

    method = serializers.ChoiceField(
        choices=CashPayment.Method.choices,
        error_messages={
            "required": "Le moyen de paiement est requis.",
            "invalid_choice": "Moyen de paiement inconnu.",
        },
    )
    amount_kmf = serializers.DecimalField(
        max_digits=12,
        decimal_places=0,
        min_value=Decimal("1"),
        error_messages={
            "required": "Le montant encaissé (KMF) est requis.",
            "invalid": "Montant invalide.",
            "max_decimal_places": "Le franc comorien ne porte pas de décimales.",
            "min_value": "Le montant encaissé doit être d'au moins 1 KMF.",
        },
    )
    operator = serializers.ChoiceField(
        choices=MobileMoneyOperator.choices,
        required=False,
        allow_blank=True,
        error_messages={"invalid_choice": "Opérateur mobile money inconnu."},
    )
    reference = serializers.CharField(
        required=False, allow_blank=True, max_length=64
    )
    # S1 idempotence guichet (ADR 0015 addendum) : optionnelle ; rejouer la
    # même clé renvoie l'encaissement déjà créé (200, même reçu) au lieu
    # d'en créer un second. Unique par centre (contrainte DB).
    idempotency_key = serializers.CharField(
        required=False,
        max_length=64,
        error_messages={
            "blank": "La clé d'idempotence ne peut pas être vide.",
            "max_length": "La clé d'idempotence dépasse 64 caractères.",
        },
    )


class CashReversalCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(
        error_messages={
            "required": "Le motif de la contre-passation est obligatoire.",
            "blank": "Le motif de la contre-passation est obligatoire.",
        }
    )


class CashReceiptPatientSerializer(serializers.ModelSerializer):
    """The patient's counter receipts — their money trail, no staff refs.

    ``reversed`` is honest bookkeeping: a reversed cash-in's receipt no
    longer proves an acquitted amount.
    """

    receipt_number = serializers.CharField(source="number", read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    method = serializers.CharField(source="cash_payment.method", read_only=True)
    reversed = serializers.SerializerMethodField()

    class Meta:
        model = CashReceipt
        fields = [
            "id", "receipt_number", "center_name", "amount_kmf", "method",
            "reversed", "issued_at",
        ]
        read_only_fields = fields

    @staticmethod
    def get_reversed(obj) -> bool:
        return getattr(obj.cash_payment, "reversal", None) is not None
