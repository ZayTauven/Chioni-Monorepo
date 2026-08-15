"""Back-office subscription views — audience: `PlatformStaff` (S5, ADR 0018).

Fourth module mounted under `/api/v1/platform/`, exactly as the ADR 0017
lot 1 addendum planned: Django resolves several includes on one prefix,
and the structural guard-rail (``tests/test_permissions_platform.py``)
walks the whole tree — so every view here MUST declare
``IsPlatformStaff`` as a CLASS ATTRIBUTE (a view that only overrode
``get_permissions()`` would silently inherit DRF's ``IsAuthenticated``
default: every patient in the country).

Role split, identical to the rest of the back-office: ``support`` reads
(answering « pourquoi mon centre est-il gelé ? » is support's job),
``admin`` alone writes — creating an offer, opening a contract, changing a
plan, freezing a tenant.

Two invariants held here:

1. **No patient, ever.** The perimeter is the tenant and its contract.
2. **Nothing of this app touches the care ledger** (ADR 0018 décision 1):
   a subscription is not an ``Invoice``, a suspension is not a
   ``LedgerEntry``, and neither ever shows up in the center's
   ``stats/finances`` or ``cash-journal``.
"""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PlatformStaff
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.billing.platform_serializers import (
    PlatformReasonSerializer,
    PlatformSubscriptionCreateSerializer,
    PlatformSubscriptionInvoiceSerializer,
    PlatformSubscriptionPaymentCreateSerializer,
    PlatformSubscriptionPaymentSerializer,
    PlatformSubscriptionPlanChangeSerializer,
    PlatformSubscriptionPlanWriteSerializer,
    PlatformSubscriptionSerializer,
    PlatformSubscriptionStatusSerializer,
)
from apps.billing.serializers import SubscriptionPlanSerializer
from apps.billing.services import (
    annotate_subscription_invoice_balance,
    annotate_subscription_usage,
    cancel_subscription_invoice,
    change_subscription_plan,
    create_plan,
    create_subscription,
    issue_subscription_invoice,
    record_subscription_payment,
    reverse_subscription_payment,
    set_subscription_status,
    update_plan,
)
from apps.common.permissions import IsPlatformStaff

PLATFORM_ADMIN = PlatformStaff.Role.ADMIN


def platform_subscriptions_qs():
    """Every contract, with its seat counts computed in SQL."""
    return annotate_subscription_usage(
        CenterSubscription.objects.select_related("center", "plan")
    )


def render_subscription(subscription):
    """Re-read through the annotated queryset so a write answers with the
    SAME payload the list serves (usage included)."""
    return PlatformSubscriptionSerializer(
        platform_subscriptions_qs().get(pk=subscription.pk)
    ).data


class PlatformPlanListCreateView(generics.ListCreateAPIView):
    """GET /platform/plans/ (support+admin) — POST (admin only).

    The offer catalogue. ``?is_active=true|false`` filters; an
    unparseable value answers 400 per field (S1 filter norm), never a
    silent « no filter ».
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = SubscriptionPlanSerializer
    pagination_class = None  # a handful of offers: the frontend wants them all

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_queryset(self):
        qs = SubscriptionPlan.objects.all().order_by("code")
        raw = (self.request.query_params.get("is_active") or "").strip()
        if raw:
            if raw.lower() not in {"true", "false"}:
                raise DrfValidationError(
                    {"is_active": ["Valeur attendue : true ou false."]}
                )
            qs = qs.filter(is_active=raw.lower() == "true")
        return qs

    @extend_schema(
        request=PlatformSubscriptionPlanWriteSerializer,
        responses={201: SubscriptionPlanSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = PlatformSubscriptionPlanWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = create_plan(actor=request.user, **serializer.validated_data)
        return Response(
            SubscriptionPlanSerializer(plan).data,
            status=http_status.HTTP_201_CREATED,
        )


class PlatformPlanDetailView(generics.RetrieveUpdateAPIView):
    """GET /platform/plans/{pk}/ (support+admin) — PATCH (admin only).

    A price change is NEVER retroactive: the SaaS invoices of lot 2 carry
    their own frozen amount. Retiring an offer is ``is_active=false`` —
    there is no DELETE, a plan referenced by a live contract is protected.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = SubscriptionPlanSerializer
    http_method_names = ["get", "patch", "head", "options"]
    queryset = SubscriptionPlan.objects.all()

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    @extend_schema(
        request=PlatformSubscriptionPlanWriteSerializer,
        responses={200: SubscriptionPlanSerializer},
    )
    def patch(self, request, *args, **kwargs):
        plan = self.get_object()
        serializer = PlatformSubscriptionPlanWriteSerializer(
            plan, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        plan = update_plan(
            actor=request.user, plan=plan, **serializer.validated_data
        )
        return Response(SubscriptionPlanSerializer(plan).data)


class PlatformSubscriptionListCreateView(generics.ListCreateAPIView):
    """GET /platform/subscriptions/ (support+admin) — POST (admin only).

    Filters: ``?status=`` (unknown value → 400 per field) and
    ``?center=<id>`` (non numeric → 400 per field; unknown id → empty
    page, not 404: the platform's perimeter IS every center, there is no
    cross-tenant probe to prevent here — patron of the reconciliation
    view, S4 lot 2).
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_queryset(self):
        qs = platform_subscriptions_qs().order_by("center__name", "id")
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in CenterSubscription.Status.values:
                raise DrfValidationError(
                    {"status": ["Statut d'abonnement inconnu."]}
                )
            qs = qs.filter(status=status_filter)
        center = (params.get("center") or "").strip()
        if center:
            if not center.isdigit():
                raise DrfValidationError(
                    {"center": ["Identifiant de centre invalide."]}
                )
            qs = qs.filter(center_id=int(center))
        return qs

    @extend_schema(
        request=PlatformSubscriptionCreateSerializer,
        responses={201: PlatformSubscriptionSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = PlatformSubscriptionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = create_subscription(
            actor=request.user, **serializer.validated_data
        )
        return Response(
            render_subscription(subscription),
            status=http_status.HTTP_201_CREATED,
        )


class PlatformSubscriptionDetailView(generics.RetrieveAPIView):
    """GET /platform/subscriptions/{pk}/ — support + admin (read only).

    Writes are the two explicit actions below (patron of the KYC
    endpoint): a PATCH that could slide a status past the state machine
    is exactly the parallel door S4 spent a sprint closing.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionSerializer

    def get_queryset(self):
        return platform_subscriptions_qs()


class PlatformSubscriptionPlanChangeView(APIView):
    """POST /platform/subscriptions/{pk}/plan/ — admin only."""

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformSubscriptionPlanChangeSerializer,
        responses={200: PlatformSubscriptionSerializer},
    )
    def post(self, request, pk):
        subscription = get_object_or_404(
            CenterSubscription.objects.all(), pk=pk
        )
        serializer = PlatformSubscriptionPlanChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_subscription_plan(
            actor=request.user,
            subscription=subscription,
            plan=serializer.validated_data["plan"],
        )
        return Response(render_subscription(subscription))


class PlatformSubscriptionStatusView(APIView):
    """POST /platform/subscriptions/{pk}/status/ — admin only.

    THE single door to a subscription transition: explicit state machine,
    motive mandatory to freeze, audit without the motive in the payload.

    Effects of ``suspendu``/``resilie`` (arbitrage PO n° 2): the
    ADMINISTRATIVE perimeter freezes — staff, tariffs, statistics. Care,
    appointments, desk registration, patient invoicing, the cash desk,
    receipts, every read, the RGPD export and the director's journal keep
    working. « Suspendre ne doit jamais empêcher de soigner. »
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformSubscriptionStatusSerializer,
        responses={200: PlatformSubscriptionSerializer},
    )
    def post(self, request, pk):
        subscription = get_object_or_404(
            CenterSubscription.objects.all(), pk=pk
        )
        serializer = PlatformSubscriptionStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_subscription_status(
            actor=request.user,
            subscription=subscription,
            status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(render_subscription(subscription))


# ---------------------------------------------------------------------------
# Facturation SaaS — Chioni émet, encaisse hors ligne, corrige par écrit
# ---------------------------------------------------------------------------
#
# Arbitrage PO n° 1 (ADR 0018) : le règlement se fait HORS de l'app (les
# rails de paiement comoriens ne sont pas instruits — risque n° 1). Chioni
# émet la facture, le centre la consulte, l'exploitant enregistre le
# règlement reçu, les relances partent toutes seules.
#
# Ces routes n'écrivent RIEN dans le ledger des soins : une facture
# d'abonnement n'est pas une ``Invoice``, un règlement n'est pas un
# ``CashPayment``, et ni l'un ni l'autre n'apparaît jamais dans le
# `cash-journal` ou les `stats/finances` d'un centre (test d'étanchéité).


def platform_subscription_invoices_qs():
    """Toutes les factures SaaS, solde calculé en SQL (jamais un N+1)."""
    return annotate_subscription_invoice_balance(
        SubscriptionInvoice.objects.select_related("center")
        .prefetch_related("payments__reversal")
        .order_by("-sequence_number")
    )


def render_invoice(invoice):
    """Relit par le queryset annoté pour qu'une écriture réponde le MÊME
    payload que la liste (soldes compris)."""
    return PlatformSubscriptionInvoiceSerializer(
        platform_subscription_invoices_qs().get(pk=invoice.pk)
    ).data


class PlatformSubscriptionInvoiceListCreateView(generics.ListCreateAPIView):
    """GET /platform/subscriptions/{pk}/invoices/ (support+admin) —
    POST (admin only): émission MANUELLE de la période due.

    Le POST est à CORPS VIDE, et c'est une décision : il déclenche
    exactement ce que ferait la tâche planifiée pour ce tenant (même
    période, même montant figé depuis l'offre, même échéance). Laisser
    saisir un montant libre ferait de cette route une porte parallèle à la
    grille tarifaire — le prix d'une offre se change sur l'offre.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionInvoiceSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_subscription(self):
        return get_object_or_404(
            CenterSubscription.objects.select_related("plan", "center"),
            pk=self.kwargs["pk"],
        )

    def get_queryset(self):
        return platform_subscription_invoices_qs().filter(
            subscription_id=self.kwargs["pk"]
        )

    @extend_schema(
        request=None, responses={201: PlatformSubscriptionInvoiceSerializer}
    )
    def create(self, request, *args, **kwargs):
        invoice = issue_subscription_invoice(
            actor=request.user, subscription=self.get_subscription()
        )
        return Response(
            render_invoice(invoice), status=http_status.HTTP_201_CREATED
        )


class PlatformSubscriptionInvoiceListView(generics.ListAPIView):
    """GET /platform/subscription-invoices/?status=&center=&overdue= —
    support + admin. La créance de Chioni, tous tenants confondus.

    ``?overdue=true`` = échéance STRICTEMENT dépassée et solde positif —
    la même définition que celle qui fait passer un abonnement en
    « impayé », jamais une seconde règle qui divergerait.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionInvoiceSerializer

    def get_queryset(self):
        qs = platform_subscription_invoices_qs()
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in SubscriptionInvoice.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=status_filter)
        center = (params.get("center") or "").strip()
        if center:
            if not center.isdigit():
                raise DrfValidationError(
                    {"center": ["Identifiant de centre invalide."]}
                )
            qs = qs.filter(center_id=int(center))
        overdue = (params.get("overdue") or "").strip().lower()
        if overdue:
            if overdue not in {"true", "false"}:
                raise DrfValidationError(
                    {"overdue": ["Valeur attendue : true ou false."]}
                )
            if overdue == "true":
                qs = qs.filter(
                    status=SubscriptionInvoice.Status.ISSUED,
                    due_date__lt=timezone.localdate(),
                    balance_kmf_agg__gt=0,
                )
        return qs


class PlatformSubscriptionInvoiceDetailView(generics.RetrieveAPIView):
    """GET /platform/subscription-invoices/{pk}/ — support + admin."""

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionInvoiceSerializer

    def get_queryset(self):
        return platform_subscription_invoices_qs()


class PlatformSubscriptionInvoicePaymentView(generics.ListCreateAPIView):
    """GET /platform/subscription-invoices/{pk}/payments/ (support+admin) —
    POST (admin only): enregistrer un règlement REÇU.

    Règlements partiels admis, jamais au-delà du solde (verrou de la ligne
    facture dans le service). Le retour automatique « impayé → actif » se
    fait dans la MÊME transaction dès qu'il ne reste plus rien d'échu.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSubscriptionPaymentSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_invoice(self):
        return get_object_or_404(
            SubscriptionInvoice.objects.select_related("center", "subscription"),
            pk=self.kwargs["pk"],
        )

    def get_queryset(self):
        return (
            SubscriptionPayment.objects.filter(invoice_id=self.kwargs["pk"])
            .select_related("reversal")
            .order_by("created_at", "id")
        )

    @extend_schema(
        request=PlatformSubscriptionPaymentCreateSerializer,
        responses={201: PlatformSubscriptionInvoiceSerializer},
    )
    def create(self, request, *args, **kwargs):
        invoice = self.get_invoice()
        serializer = PlatformSubscriptionPaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_subscription_payment(
            actor=request.user,
            invoice=invoice,
            amount_kmf=serializer.validated_data["amount_kmf"],
            method=serializer.validated_data["method"],
            reference=serializer.validated_data.get("reference", ""),
            received_at=serializer.validated_data.get("received_at"),
        )
        # La facture entière est renvoyée : c'est elle qui porte le solde,
        # le statut et l'historique — un client qui n'aurait que la ligne
        # de règlement devrait rappeler pour savoir où il en est.
        return Response(
            render_invoice(invoice), status=http_status.HTTP_201_CREATED
        )


class PlatformSubscriptionPaymentReverseView(APIView):
    """POST /platform/subscription-invoices/{invoice_pk}/payments/{pk}/reverse/
    — admin only, motif OBLIGATOIRE.

    La seule correction d'un règlement : une contre-passation motivée, une
    par règlement. Elle rouvre le solde, ramène une facture ``payee`` à
    ``emise`` et re-signale l'impayé si l'échéance est passée.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformReasonSerializer,
        responses={201: PlatformSubscriptionInvoiceSerializer},
    )
    def post(self, request, invoice_pk, pk):
        payment = get_object_or_404(
            SubscriptionPayment.objects.select_related("invoice"),
            pk=pk,
            invoice_id=invoice_pk,
        )
        serializer = PlatformReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reverse_subscription_payment(
            actor=request.user,
            payment=payment,
            reason=serializer.validated_data["reason"],
        )
        return Response(
            render_invoice(payment.invoice), status=http_status.HTTP_201_CREATED
        )


class PlatformSubscriptionInvoiceCancelView(APIView):
    """POST /platform/subscription-invoices/{pk}/cancel/ — admin only,
    motif OBLIGATOIRE.

    Refusée tant qu'un règlement actif existe (contre-passez d'abord :
    l'histoire de chaque franc reste explicite). La période annulée
    redevient facturable — une faute de frappe ne condamne pas un tenant à
    ne plus jamais être facturé pour ce mois-là.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformReasonSerializer,
        responses={200: PlatformSubscriptionInvoiceSerializer},
    )
    def post(self, request, pk):
        invoice = get_object_or_404(
            SubscriptionInvoice.objects.select_related("center", "subscription"),
            pk=pk,
        )
        serializer = PlatformReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cancel_subscription_invoice(
            actor=request.user,
            invoice=invoice,
            reason=serializer.validated_data["reason"],
        )
        return Response(render_invoice(invoice))
