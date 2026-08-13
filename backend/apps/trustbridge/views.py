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

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
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
from apps.trustbridge.models import Dispute, Invoice, PaymentRequest, Receipt
from apps.trustbridge.serializers import (
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
    resolve_dispute,
    send_payment_request,
    share_payment_request,
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
