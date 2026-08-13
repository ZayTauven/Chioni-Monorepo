"""Trust Bridge views — one section per AUDIENCE (ADR 0008).

Same discipline as phase A: every view declares exactly ONE hat, derives
its queryset from that hat only (cross-perimeter rows answer a
deterministic 404), and NEVER writes state itself — all writes go through
``apps.trustbridge.services`` (the exclusive state machine, the ledger,
the audit trail). No endpoint sets a ``status`` field, ever.

Refusal semantics (phase A contract): anonymous → 401 ; foreign center →
404 (invisible) ; member without the required role → 403 ; cross-patient /
cross-guardian probes → 404.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.centers.models import StaffMembership
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsGuardianWithScope,
    IsPatientSelf,
    IsStaffOfCenter,
    claimed_patient_profile,
    payment_requests_shared_with_guardian,
    receipts_visible_to_guardian,
)
from apps.medical.models import Consent, Encounter
from apps.patients.models import GuardianLink
from apps.trustbridge.models import (
    CashPayment,
    CashPaymentReversal,
    CashReceipt,
    Dispute,
    Invoice,
    PaymentRequest,
    Receipt,
)
from apps.trustbridge.serializers import (
    CashPaymentCreateSerializer,
    CashPaymentReversalSerializer,
    CashPaymentStaffSerializer,
    CashReceiptPatientSerializer,
    CashReversalCreateSerializer,
    DisputeCreateSerializer,
    DisputeResolveSerializer,
    DisputeStaffSerializer,
    InvoiceCreateSerializer,
    InvoiceStaffSerializer,
    PaymentIntentGuardianSerializer,
    PaymentRequestGuardianSerializer,
    PaymentRequestPatientSerializer,
    PaymentRequestStaffSerializer,
    QuoteSerializer,
    ReceiptSerializer,
    ShareTargetSerializer,
    UnpaidInvoiceStaffSerializer,
)
from apps.trustbridge.services import (
    acknowledge_care_received,
    close_payment_request,
    confirm_care,
    create_invoice,
    create_payment_intent,
    create_payment_request,
    handle_psp_webhook,
    issue_invoice,
    open_dispute,
    quote_payment_request,
    record_cash_payment,
    resolve_dispute,
    reverse_cash_payment,
    send_payment_request,
    share_payment_request,
    unpaid_invoices_qs,
    unshare_payment_request,
)

Role = StaffMembership.Role

#: Roles allowed to bill and manage money on behalf of the center.
BILLING_ROLES = (Role.DIRECTOR, Role.SECRETARY, Role.CASHIER)
#: Roles allowed to attest that the care was actually delivered.
CARE_CONFIRM_ROLES = (
    Role.DIRECTOR, Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST,
)
#: Dispute resolution engages the center: director only.
DISPUTE_RESOLVE_ROLES = (Role.DIRECTOR,)


# ---------------------------------------------------------------------------
# Audience: STAFF of the invoicing center
# ---------------------------------------------------------------------------


class CenterInvoiceListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET /centers/{c}/invoices/ (any staff) — POST (billing roles):
    create a DRAFT invoice from an encounter of THIS center."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(*BILLING_ROLES)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InvoiceCreateSerializer
        return InvoiceStaffSerializer

    def get_queryset(self):
        return (
            Invoice.objects.for_center(self.center)
            .prefetch_related("lines")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        encounter = get_object_or_404(
            Encounter.objects.for_center(self.center),
            pk=serializer.validated_data["encounter"],
        )
        invoice = create_invoice(
            actor=request.user,
            center=self.center,
            encounter=encounter,
            act_ids=serializer.validated_data.get("act_ids"),
        )
        return Response(
            InvoiceStaffSerializer(invoice).data, status=status.HTTP_201_CREATED
        )


class CenterInvoiceDetailView(CenterScopedViewMixin, generics.RetrieveAPIView):
    """GET /centers/{c}/invoices/{pk}/ — center-scoped (cross-tenant → 404)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = InvoiceStaffSerializer

    def get_queryset(self):
        return Invoice.objects.for_center(self.center).prefetch_related("lines")


class CenterUnpaidInvoiceListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/invoices/unpaid/?ordering= — the actionable unpaid
    list (vague 2b « pilotage ») : factures ``emise`` à solde > 0, photo à
    l'instant T. La matière première des futures relances (chantier
    ultérieur — aucune écriture ici).

    BILLING roles only: this is a money view (patient names, balances) —
    same hat as the cash journal, the doctor has no business here (mirror
    of the R-API-1 clinical segmentation, applied to money).

    Balances come from the SQL annotations of ``unpaid_invoices_qs`` (one
    query for the whole page, mirror of ``invoice_balance_kmf``); the
    patient's phone is masked in the serializer. Ordering: ``-balance``
    (default, biggest debt first), ``balance``, ``-age`` (oldest first),
    ``age`` (newest first) — anything else answers a 400 per field.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]
    serializer_class = UnpaidInvoiceStaffSerializer

    #: ``age`` is the ancienneté: descending age = oldest created first.
    _ORDERINGS = {
        "-balance": ("-balance_kmf_agg", "id"),
        "balance": ("balance_kmf_agg", "id"),
        "-age": ("created_at", "id"),
        "age": ("-created_at", "id"),
    }

    def get_queryset(self):
        ordering = self.request.query_params.get("ordering", "-balance")
        if ordering not in self._ORDERINGS:
            raise DrfValidationError(
                {"ordering": ["Tri inconnu : -balance, balance, -age ou age."]}
            )
        return (
            unpaid_invoices_qs(self.center)
            .select_related("patient")
            .order_by(*self._ORDERINGS[ordering])
        )


class _CenterInvoiceActionView(CenterScopedViewMixin, APIView):
    """Base for POST actions on one of the center's invoices."""

    def get_invoice(self):
        return get_object_or_404(
            Invoice.objects.for_center(self.center), pk=self.kwargs["pk"]
        )


class CenterInvoiceIssueView(_CenterInvoiceActionView):
    """POST /centers/{c}/invoices/{pk}/issue/ — freeze amounts and lines."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=None, responses=InvoiceStaffSerializer)
    def post(self, request, *args, **kwargs):
        invoice = issue_invoice(actor=request.user, invoice=self.get_invoice())
        return Response(InvoiceStaffSerializer(invoice).data)


class CenterInvoicePaymentRequestCreateView(_CenterInvoiceActionView):
    """POST /centers/{c}/invoices/{pk}/payment-requests/ — open the request."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=None, responses=PaymentRequestStaffSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = create_payment_request(
            actor=request.user, invoice=self.get_invoice()
        )
        return Response(
            PaymentRequestStaffSerializer(payment_request).data,
            status=status.HTTP_201_CREATED,
        )


def center_payment_requests_qs(center):
    """Tenant perimeter for payment requests: through the invoice's center."""
    return PaymentRequest.objects.filter(invoice__center=center)


class CenterPaymentRequestListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/payment-requests/ — the center's requests (any staff)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PaymentRequestStaffSerializer

    def get_queryset(self):
        return (
            center_payment_requests_qs(self.center)
            .select_related("invoice")
            .prefetch_related("shares")
            .order_by("-created_at")
        )


class CenterPaymentRequestDetailView(CenterScopedViewMixin, generics.RetrieveAPIView):
    """GET /centers/{c}/payment-requests/{pk}/ — center-scoped."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PaymentRequestStaffSerializer

    def get_queryset(self):
        return center_payment_requests_qs(self.center).select_related("invoice")


class _CenterPaymentRequestActionView(CenterScopedViewMixin, APIView):
    """Base for POST actions on one of the center's payment requests."""

    def get_payment_request(self):
        return get_object_or_404(
            center_payment_requests_qs(self.center), pk=self.kwargs["pk"]
        )

    def get_patient_link(self, payment_request, link_pk):
        """A guardian link OF THE INVOICED PATIENT or 404 — a foreign link
        is indistinguishable from a non-existent one."""
        return get_object_or_404(
            GuardianLink.objects.filter(
                patient_id=payment_request.invoice.patient_id
            ),
            pk=link_pk,
        )


class CenterPaymentRequestShareView(_CenterPaymentRequestActionView):
    """POST /centers/{c}/payment-requests/{pk}/share/ — target one ACTIVE
    guardian link of the invoiced patient."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=ShareTargetSerializer, responses=PaymentRequestStaffSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = self.get_payment_request()
        serializer = ShareTargetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = self.get_patient_link(
            payment_request, serializer.validated_data["guardian_link"]
        )
        share_payment_request(
            actor=request.user, payment_request=payment_request, guardian_link=link
        )
        return Response(
            PaymentRequestStaffSerializer(payment_request).data,
            status=status.HTTP_201_CREATED,
        )


class CenterPaymentRequestUnshareView(_CenterPaymentRequestActionView):
    """POST /centers/{c}/payment-requests/{pk}/unshare/ — withdraw a share."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=ShareTargetSerializer, responses=PaymentRequestStaffSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = self.get_payment_request()
        serializer = ShareTargetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = self.get_patient_link(
            payment_request, serializer.validated_data["guardian_link"]
        )
        unshare_payment_request(
            actor=request.user, payment_request=payment_request, guardian_link=link
        )
        return Response(PaymentRequestStaffSerializer(payment_request).data)


class CenterPaymentRequestSendView(_CenterPaymentRequestActionView):
    """POST /centers/{c}/payment-requests/{pk}/send/ — brouillon → envoyée."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=None, responses=PaymentRequestStaffSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = send_payment_request(
            actor=request.user, payment_request=self.get_payment_request()
        )
        return Response(PaymentRequestStaffSerializer(payment_request).data)


class CenterPaymentRequestConfirmCareView(_CenterPaymentRequestActionView):
    """POST /centers/{c}/payment-requests/{pk}/confirm-care/ — the center
    attests the care was delivered (payée → soin confirmé)."""

    permission_classes = [IsStaffOfCenter(*CARE_CONFIRM_ROLES)]

    @extend_schema(request=None, responses=PaymentRequestStaffSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = confirm_care(
            actor=request.user, payment_request=self.get_payment_request()
        )
        return Response(PaymentRequestStaffSerializer(payment_request).data)


class CenterPaymentRequestCloseView(_CenterPaymentRequestActionView):
    """POST /centers/{c}/payment-requests/{pk}/close/ — issue the receipt
    (via ``Receipt.issue()`` inside the service) and close the request."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=None, responses=ReceiptSerializer)
    def post(self, request, *args, **kwargs):
        receipt = close_payment_request(
            actor=request.user, payment_request=self.get_payment_request()
        )
        return Response(
            ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED
        )


class CenterDisputeListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/disputes/ — the center's disputes (read, any staff)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = DisputeStaffSerializer

    def get_queryset(self):
        return (
            Dispute.objects.filter(payment_request__invoice__center=self.center)
            .select_related("payment_request")
            .order_by("-created_at")
        )


class CenterDisputeResolveView(CenterScopedViewMixin, APIView):
    """POST /centers/{c}/disputes/{pk}/resolve/ — director resolves with a
    mandatory motive; the request returns to its pre-dispute status."""

    permission_classes = [IsStaffOfCenter(*DISPUTE_RESOLVE_ROLES)]

    @extend_schema(request=DisputeResolveSerializer, responses=DisputeStaffSerializer)
    def post(self, request, *args, **kwargs):
        dispute = get_object_or_404(
            Dispute.objects.filter(payment_request__invoice__center=self.center),
            pk=self.kwargs["pk"],
        )
        serializer = DisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dispute = resolve_dispute(
            actor=request.user,
            dispute=dispute,
            resolution_note=serializer.validated_data["resolution_note"],
        )
        return Response(DisputeStaffSerializer(dispute).data)


# ---------------------------------------------------------------------------
# Audience: STAFF — caisse du centre (ADR 0015, BILLING roles)
# ---------------------------------------------------------------------------


class CenterInvoicePaymentListCreateView(CenterScopedViewMixin, APIView):
    """GET/POST /centers/{c}/invoices/{pk}/payments/ — the invoice's
    cash-ins (all methods). POST records a COUNTER payment (espèces /
    mobile money — the Pont de Confiance only arrives through the signed
    PSP webhook) and answers 201 WITH the counter receipt embedded."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    def get_invoice(self):
        return get_object_or_404(
            Invoice.objects.for_center(self.center), pk=self.kwargs["pk"]
        )

    @extend_schema(responses=CashPaymentStaffSerializer(many=True))
    def get(self, request, *args, **kwargs):
        invoice = self.get_invoice()
        payments = (
            invoice.cash_payments.select_related(
                "cash_receipt__center", "reversal", "received_by"
            )
            .order_by("created_at", "id")
        )
        return Response(CashPaymentStaffSerializer(payments, many=True).data)

    @extend_schema(
        request=CashPaymentCreateSerializer, responses=CashPaymentStaffSerializer
    )
    def post(self, request, *args, **kwargs):
        invoice = self.get_invoice()
        serializer = CashPaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = record_cash_payment(
            actor=request.user,
            center=self.center,
            invoice=invoice,
            method=serializer.validated_data["method"],
            amount_kmf=serializer.validated_data["amount_kmf"],
            operator=serializer.validated_data.get("operator", ""),
            reference=serializer.validated_data.get("reference", ""),
        )
        return Response(
            CashPaymentStaffSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class CenterCashPaymentReverseView(CenterScopedViewMixin, APIView):
    """POST /centers/{c}/invoices/{invoice_pk}/payments/{pk}/reverse/ —
    the ONLY correction of a cash-in: mandatory reason, one reversal per
    payment, never on a Pont de Confiance cash-in (dispute instead)."""

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(
        request=CashReversalCreateSerializer, responses=CashPaymentStaffSerializer
    )
    def post(self, request, *args, **kwargs):
        payment = get_object_or_404(
            CashPayment.objects.filter(
                center=self.center, invoice_id=self.kwargs["invoice_pk"]
            ),
            pk=self.kwargs["pk"],
        )
        serializer = CashReversalCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reverse_cash_payment(
            actor=request.user,
            cash_payment=payment,
            reason=serializer.validated_data["reason"],
        )
        payment = CashPayment.objects.select_related(
            "cash_receipt__center", "reversal", "received_by"
        ).get(pk=payment.pk)
        return Response(
            CashPaymentStaffSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class CenterCashJournalView(CenterScopedViewMixin, APIView):
    """GET /centers/{c}/cash-journal/?date=YYYY-MM-DD — le journal de caisse.

    Default: TODAY in Comoros local time — day boundaries computed in
    ``TIME_ZONE`` (same pattern as the appointment day queue, ADR 0013).
    All methods together (espèces, mobile money, Pont de Confiance);
    reversals MADE that day are visible and signed even when they undo a
    payment from another day; totals per method: collected / reversed /
    net.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(responses=None)
    def get(self, request, *args, **kwargs):
        day, day_start, day_end = self._day_bounds()
        payments = list(
            CashPayment.objects.filter(
                center=self.center,
                created_at__gte=day_start,
                created_at__lt=day_end,
            )
            .select_related("cash_receipt__center", "reversal", "received_by")
            .order_by("created_at", "id")
        )
        reversals = list(
            CashPaymentReversal.objects.filter(
                cash_payment__center=self.center,
                created_at__gte=day_start,
                created_at__lt=day_end,
            )
            .select_related("cash_payment")
            .order_by("created_at", "id")
        )
        totals = {}
        grand_in = grand_out = Decimal("0")
        for method in CashPayment.Method:
            method_in = sum(
                (p.amount_kmf for p in payments if p.method == method),
                Decimal("0"),
            )
            method_out = sum(
                (
                    r.cash_payment.amount_kmf
                    for r in reversals
                    if r.cash_payment.method == method
                ),
                Decimal("0"),
            )
            grand_in += method_in
            grand_out += method_out
            totals[str(method.value)] = {
                "encaisse_kmf": str(method_in),
                "contre_passe_kmf": str(method_out),
                "net_kmf": str(method_in - method_out),
            }
        totals["total"] = {
            "encaisse_kmf": str(grand_in),
            "contre_passe_kmf": str(grand_out),
            "net_kmf": str(grand_in - grand_out),
        }
        return Response(
            {
                "date": str(day),
                "payments": CashPaymentStaffSerializer(payments, many=True).data,
                "reversals": CashPaymentReversalSerializer(
                    reversals, many=True
                ).data,
                "totals": totals,
            }
        )

    def _day_bounds(self):
        """Local-day bounds in ``TIME_ZONE`` (Indian/Comoro) — the exact
        refusal semantics of the appointment day queue: malformed AND
        well-formed-impossible dates both answer the same 400."""
        raw_date = self.request.query_params.get("date")
        if raw_date:
            try:
                day = parse_date(raw_date)
            except ValueError:
                day = None
            if day is None:
                raise DrfValidationError({"date": ["Format attendu : AAAA-MM-JJ."]})
        else:
            day = timezone.localdate()
        day_start = timezone.make_aware(datetime.combine(day, time.min))
        try:
            day_end = day_start + timedelta(days=1)
        except OverflowError:
            raise DrfValidationError({"date": ["Date hors limites."]})
        return day, day_start, day_end


# ---------------------------------------------------------------------------
# Audience: the PATIENT (owner of the invoiced care)
# ---------------------------------------------------------------------------


def my_payment_requests_qs(user):
    """The claimed patient's requests, across all centers (their carnet side)."""
    return PaymentRequest.objects.filter(
        invoice__patient=claimed_patient_profile(user)
    )


class MyPaymentRequestListView(generics.ListAPIView):
    """GET /patients/me/payment-requests/ — my requests, all centers."""

    permission_classes = [IsPatientSelf]
    serializer_class = PaymentRequestPatientSerializer

    def get_queryset(self):
        return (
            my_payment_requests_qs(self.request.user)
            .select_related("invoice__center")
            .prefetch_related("invoice__lines", "shared_with")
            .order_by("-created_at")
        )


class MyPaymentRequestDetailView(generics.RetrieveAPIView):
    """GET /patients/me/payment-requests/{pk}/ — mine or 404."""

    permission_classes = [IsPatientSelf]
    serializer_class = PaymentRequestPatientSerializer

    def get_queryset(self):
        return my_payment_requests_qs(self.request.user).select_related(
            "invoice__center"
        )


class _MyPaymentRequestActionView(APIView):
    """Base for POST actions on one of MY payment requests (404 otherwise)."""

    permission_classes = [IsPatientSelf]

    def get_payment_request(self):
        return get_object_or_404(
            my_payment_requests_qs(self.request.user), pk=self.kwargs["pk"]
        )


class MyPaymentRequestShareView(_MyPaymentRequestActionView):
    """POST /patients/me/payment-requests/{pk}/share/ — the patient shares
    THEIR request with one of THEIR active guardian links."""

    @extend_schema(request=ShareTargetSerializer, responses=PaymentRequestPatientSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = self.get_payment_request()
        serializer = ShareTargetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = get_object_or_404(
            GuardianLink.objects.filter(
                patient=claimed_patient_profile(request.user)
            ),
            pk=serializer.validated_data["guardian_link"],
        )
        share_payment_request(
            actor=request.user, payment_request=payment_request, guardian_link=link
        )
        return Response(
            PaymentRequestPatientSerializer(payment_request).data,
            status=status.HTTP_201_CREATED,
        )


class MyPaymentRequestAcknowledgeView(_MyPaymentRequestActionView):
    """POST /patients/me/payment-requests/{pk}/acknowledge/ — « j'ai bien
    reçu ce soin » (stocké : indicateur de mission, étude §10)."""

    @extend_schema(request=None, responses=PaymentRequestPatientSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = acknowledge_care_received(
            patient_user=request.user, payment_request=self.get_payment_request()
        )
        return Response(PaymentRequestPatientSerializer(payment_request).data)


class MyPaymentRequestDisputeView(_MyPaymentRequestActionView):
    """POST /patients/me/payment-requests/{pk}/dispute/ — motif obligatoire."""

    @extend_schema(request=DisputeCreateSerializer, responses=PaymentRequestPatientSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = self.get_payment_request()
        serializer = DisputeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        open_dispute(
            actor_user=request.user,
            payment_request=payment_request,
            reason=serializer.validated_data["reason"],
        )
        payment_request.refresh_from_db()
        return Response(
            PaymentRequestPatientSerializer(payment_request).data,
            status=status.HTTP_201_CREATED,
        )


class MyReceiptListView(generics.ListAPIView):
    """GET /patients/me/receipts/ — my receipts, all centers."""

    permission_classes = [IsPatientSelf]
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        return (
            Receipt.objects.filter(
                payment_request__invoice__patient=claimed_patient_profile(
                    self.request.user
                )
            )
            .select_related("center")
            .order_by("-issued_at")
        )


class MyCashReceiptListView(generics.ListAPIView):
    """GET /patients/me/cash-receipts/ — my counter receipts (pure KMF),
    all centers. Guardians NEVER see these (ADR 0015): the « paiements »
    scope only opens the requests explicitly shared with them — what the
    patient pays with their own money at the counter is their business.
    """

    permission_classes = [IsPatientSelf]
    serializer_class = CashReceiptPatientSerializer

    def get_queryset(self):
        return (
            CashReceipt.objects.filter(
                cash_payment__invoice__patient=claimed_patient_profile(
                    self.request.user
                )
            )
            .select_related("center", "cash_payment__reversal")
            .order_by("-issued_at")
        )


# ---------------------------------------------------------------------------
# Audience: a GUARDIAN — only what was SHARED, only generic natures
# ---------------------------------------------------------------------------


class GuardianPaymentRequestListView(generics.ListAPIView):
    """GET /guardian/payment-requests/ — requests shared with ME (F3:
    consent scope × explicit share, combined in the central helper)."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]
    serializer_class = PaymentRequestGuardianSerializer

    def get_queryset(self):
        return (
            payment_requests_shared_with_guardian(self.request.user)
            .select_related("invoice__patient", "invoice__center")
            .prefetch_related("invoice__lines")
            .order_by("-created_at")
        )


class GuardianPaymentRequestDetailView(generics.RetrieveAPIView):
    """GET /guardian/payment-requests/{pk}/ — shared with me or 404."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]
    serializer_class = PaymentRequestGuardianSerializer

    def get_queryset(self):
        return payment_requests_shared_with_guardian(
            self.request.user
        ).select_related("invoice__patient", "invoice__center")


class _GuardianPaymentRequestActionView(APIView):
    """Base for actions on a payment request shared with the caller."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]

    def get_payment_request(self):
        return get_object_or_404(
            payment_requests_shared_with_guardian(self.request.user),
            pk=self.kwargs["pk"],
        )


class GuardianPaymentRequestQuoteView(_GuardianPaymentRequestActionView):
    """GET /guardian/payment-requests/{pk}/quote/ — the transparent EUR↔KMF
    quote (rate + explicit fees) BEFORE paying."""

    @extend_schema(responses=QuoteSerializer)
    def get(self, request, *args, **kwargs):
        quote = quote_payment_request(self.get_payment_request())
        return Response(
            QuoteSerializer(
                {
                    "amount_kmf": quote.amount_kmf,
                    "currency_received": "KMF",
                    "exchange_rate": quote.rate,
                    "amount_eur": quote.amount_eur,
                    "fees_eur": quote.fees_eur,
                    "total_eur": quote.total_eur,
                    "currency_paid": "EUR",
                }
            ).data
        )


class GuardianPaymentRequestPayView(_GuardianPaymentRequestActionView):
    """POST /guardian/payment-requests/{pk}/pay/ — create the payment
    intent (rate frozen). Amounts are NEVER read from the client."""

    @extend_schema(request=None, responses=PaymentIntentGuardianSerializer)
    def post(self, request, *args, **kwargs):
        intent = create_payment_intent(
            guardian_user=request.user,
            payment_request=self.get_payment_request(),
        )
        return Response(
            PaymentIntentGuardianSerializer(intent).data,
            status=status.HTTP_201_CREATED,
        )


class GuardianPaymentRequestDisputeView(_GuardianPaymentRequestActionView):
    """POST /guardian/payment-requests/{pk}/dispute/ — motif obligatoire."""

    @extend_schema(request=DisputeCreateSerializer, responses=PaymentRequestGuardianSerializer)
    def post(self, request, *args, **kwargs):
        payment_request = self.get_payment_request()
        serializer = DisputeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        open_dispute(
            actor_user=request.user,
            payment_request=payment_request,
            reason=serializer.validated_data["reason"],
        )
        payment_request.refresh_from_db()
        return Response(
            PaymentRequestGuardianSerializer(payment_request).data,
            status=status.HTTP_201_CREATED,
        )


class GuardianReceiptListView(generics.ListAPIView):
    """GET /guardian/receipts/ — receipts in my payment perimeter (dual
    currency, explicit fees; no care information)."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        return (
            receipts_visible_to_guardian(self.request.user)
            .select_related("center")
            .order_by("-issued_at")
        )


# ---------------------------------------------------------------------------
# System: the PSP webhook (signature-authenticated, no user session)
# ---------------------------------------------------------------------------


class PspWebhookView(APIView):
    """POST /trustbridge/webhooks/psp/ — provider events (FakePSP in dev).

    Authentication is the SIGNATURE over the raw body, verified by the
    active PSP backend; a bad signature or an unknown reference answers
    400 and records nothing. Replays are no-ops (idempotency key + row
    lock in the service).
    """

    authentication_classes = []  # signature-based, not session/JWT
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses=None)
    def post(self, request, *args, **kwargs):
        intent = handle_psp_webhook(
            payload=request.body,
            signature=request.headers.get("X-PSP-Signature", ""),
        )
        return Response({"detail": "ok", "intent_status": intent.status})
