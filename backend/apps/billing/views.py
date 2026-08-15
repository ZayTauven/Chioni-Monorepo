"""Subscription views — TENANT side (S5, ADR 0018 décisions 2 to 4).

Read-only endpoints: `GET /centers/{c}/subscription/` and, since lot 2,
`GET /centers/{c}/subscription/invoices/[{pk}/]`.

**Director only** — an arbitrage the ADR left open (« entre directeur seul
et BILLING »), tranché here by symmetry with the two objects it most
resembles: the KYC file (director only) and the audit journal (director
only). A subscription is the CONTRACT between Chioni and the center: it
carries a price, an échéance and the motive of a commercial sanction. The
cashier blocked on the tariff grid is not left in the dark for all that —
the freeze refusal itself says what happened, what to do and what keeps
working. RÉVERSIBLE: opening it to BILLING is a one-line change, and the
frontend gate must follow whichever side is chosen (otherwise the screen
renders to collect a 403).

Reading is NEVER frozen — least of all this route: it is how a director
learns why his center is frozen.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import CenterSubscription, SubscriptionInvoice
from apps.billing.serializers import (
    CenterSubscriptionSerializer,
    SubscriptionInvoiceSerializer,
)
from apps.billing.services import annotate_subscription_invoice_balance
from apps.centers.models import StaffMembership
from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter

DIRECTOR = StaffMembership.Role.DIRECTOR


class CenterSubscriptionView(CenterScopedViewMixin, APIView):
    """GET /centers/{center_pk}/subscription/ — director only.

    404 when the center has no subscription yet — an honest, frequent
    state (every center born before S5), same contract as
    `GET /guardian/profile/`: « il n'y en a pas » is not an error, and
    inventing an empty contract would be a lie.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    @extend_schema(responses={200: CenterSubscriptionSerializer})
    def get(self, request, center_pk):
        subscription = (
            CenterSubscription.objects.filter(center=self.center)
            .select_related("plan", "center")
            .first()
        )
        if subscription is None:
            raise NotFound("Ce centre n'a pas encore d'abonnement.")
        return Response(CenterSubscriptionSerializer(subscription).data)


class _CenterSubscriptionInvoiceMixin(CenterScopedViewMixin):
    """Shared scoping of the tenant's SaaS invoices — DIRECTOR ONLY.

    Same audience as the contract itself (lot 1 arbitrage, kept for
    coherence: the frontend gate must mirror the backend permission,
    otherwise the screen renders to collect a 403). A foreign center is a
    404 through ``CenterScopedViewMixin``; a foreign invoice is a 404
    through the queryset — never an oracle telling which id exists.

    Balances come from the SQL annotation (one query for the page,
    ``unpaid_invoices_qs`` patron), never one derivation per row.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = SubscriptionInvoiceSerializer

    def get_queryset(self):
        return annotate_subscription_invoice_balance(
            SubscriptionInvoice.objects.for_center(self.center)
            .prefetch_related("payments__reversal")
            .order_by("-sequence_number")
        )


class CenterSubscriptionInvoiceListView(
    _CenterSubscriptionInvoiceMixin, generics.ListAPIView
):
    """GET /centers/{c}/subscription/invoices/?status= — director only.

    An empty list is the normal state of a center born before S5 (and of
    one whose first period has not ended yet): the list route answers 200
    with nothing, where the contract route answers 404 — « il n'y a pas de
    contrat » and « il n'y a pas encore de facture » are different news.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        raw = (self.request.query_params.get("status") or "").strip()
        if raw:
            if raw not in SubscriptionInvoice.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=raw)
        return qs


class CenterSubscriptionInvoiceDetailView(
    _CenterSubscriptionInvoiceMixin, generics.RetrieveAPIView
):
    """GET /centers/{c}/subscription/invoices/{pk}/ — director only."""
