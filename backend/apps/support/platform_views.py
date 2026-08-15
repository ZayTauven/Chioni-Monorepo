"""Back-office support views — audience: `PlatformStaff` (S5 lot 3).

Fifth module mounted under `/api/v1/platform/`, exactly as the ADR 0017
lot 1 addendum planned: Django resolves several includes on one prefix,
and the structural guard-rail (``tests/test_permissions_platform.py``)
walks the whole tree — so every view here MUST declare ``IsPlatformStaff``
as a CLASS ATTRIBUTE (a view that only overrode ``get_permissions()``
would silently inherit DRF's ``IsAuthenticated`` default: every patient in
the country).

**[ARBITRAGE] Here, and here alone in the back-office, ``support``
WRITES.** Everywhere else the split is « ``support`` lit, ``admin`` seul
écrit », and it stays: creating a center, moving a KYC, opening a
contract, freezing an administration, recording a settlement, running an
erasure, managing the Chioni team — all ``admin``. Those are decisions
about the TENANT and about MONEY. Answering a ticket and moving it along
its state machine is neither: it is literally the ``support`` job, and a
role that could read the queue without ever replying to it would be
decorative. The exception is narrow (post a message, change a status), it
touches no tenant right and no franc, and it is declared as a documented
exception in the guard-rail test rather than silently smuggled in.

The sprint invariant holds unchanged: no patient, no clinical data, no
civil identity in any payload of this module.
"""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsPlatformStaff
from apps.support.models import SupportMessage, SupportTicket
from apps.support.platform_serializers import (
    PlatformSupportMessageSerializer,
    PlatformSupportStatusSerializer,
    PlatformSupportTicketDetailSerializer,
    PlatformSupportTicketSerializer,
)
from apps.support.serializers import SupportMessageCreateSerializer
from apps.support.services import post_message, set_ticket_status
from apps.support.views import (
    _detail_queryset,
    annotate_tickets,
    support_attachment_file_response,
)


def platform_tickets_qs():
    """Every ticket of every tenant, counters computed in SQL."""
    return annotate_tickets(
        SupportTicket.objects.select_related("center", "opened_by")
    )


def render_ticket(pk):
    """Re-read through the detail queryset so a write answers the SAME
    payload the detail serves (thread and counters included)."""
    return PlatformSupportTicketDetailSerializer(
        _detail_queryset(SupportTicket.objects.select_related("center")).get(
            pk=pk
        )
    ).data


class PlatformSupportTicketListView(generics.ListAPIView):
    """GET /platform/support/tickets/?status=&category=&center=&open=.

    Both roles read. The queue, most recent first. ``?open=true`` is the
    working filter (``ouvert`` + ``en_cours``): what is waiting for Chioni,
    as opposed to what has been dealt with.

    Unknown filter values answer 400 per field; an unknown ``center`` id
    gives an EMPTY PAGE rather than a 404 — the platform's perimeter IS
    every center, there is no cross-tenant probe to prevent here (patron of
    the reconciliation view, S4 lot 2).
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSupportTicketSerializer

    def get_queryset(self):
        qs = platform_tickets_qs().order_by("-created_at", "-id")
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in SupportTicket.Status.values:
                raise DrfValidationError(
                    {"status": ["Statut de ticket inconnu."]}
                )
            qs = qs.filter(status=status_filter)
        category = (params.get("category") or "").strip()
        if category:
            if category not in SupportTicket.Category.values:
                raise DrfValidationError(
                    {"category": ["Catégorie de ticket inconnue."]}
                )
            qs = qs.filter(category=category)
        center = (params.get("center") or "").strip()
        if center:
            if not center.isdigit():
                raise DrfValidationError(
                    {"center": ["Identifiant de centre invalide."]}
                )
            qs = qs.filter(center_id=int(center))
        open_only = (params.get("open") or "").strip().lower()
        if open_only:
            if open_only not in {"true", "false"}:
                raise DrfValidationError(
                    {"open": ["Valeur attendue : true ou false."]}
                )
            if open_only == "true":
                qs = qs.filter(
                    status__in=(
                        SupportTicket.Status.OPEN,
                        SupportTicket.Status.IN_PROGRESS,
                    )
                )
        return qs


class PlatformSupportTicketDetailView(generics.RetrieveAPIView):
    """GET /platform/support/tickets/{pk}/ — ticket + thread, both roles."""

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSupportTicketDetailSerializer

    def get_queryset(self):
        return _detail_queryset(SupportTicket.objects.select_related("center"))


class PlatformSupportMessageView(generics.ListCreateAPIView):
    """GET/POST /platform/support/tickets/{pk}/messages/ — **both roles**.

    The documented exception (see the module docstring): answering a
    ticket is the ``support`` job. The message is posted on the ``chioni``
    side by the SERVICE — the client never chooses its own side.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformSupportMessageSerializer
    pagination_class = None

    def get_ticket(self):
        return get_object_or_404(SupportTicket.objects.all(), pk=self.kwargs["pk"])

    def get_queryset(self):
        return (
            SupportMessage.objects.filter(ticket_id=self.kwargs["pk"])
            .order_by("created_at", "id")
        )

    @extend_schema(
        request=SupportMessageCreateSerializer,
        responses={201: PlatformSupportMessageSerializer},
    )
    def create(self, request, *args, **kwargs):
        ticket = self.get_ticket()
        serializer = SupportMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = post_message(
            actor=request.user,
            ticket=ticket,
            body=serializer.validated_data["body"],
            side=SupportMessage.Side.CHIONI,
        )
        return Response(
            PlatformSupportMessageSerializer(message).data,
            status=http_status.HTTP_201_CREATED,
        )


class PlatformSupportTicketStatusView(APIView):
    """POST /platform/support/tickets/{pk}/status/ — **both roles**.

    Same documented exception: making a ticket progress IS support work.
    Explicit state machine in the service (``ferme`` is final), row lock so
    two operators serialise, audit with the status CODES and nothing of the
    content.
    """

    permission_classes = [IsPlatformStaff()]

    @extend_schema(
        request=PlatformSupportStatusSerializer,
        responses={200: PlatformSupportTicketDetailSerializer},
    )
    def post(self, request, pk):
        ticket = get_object_or_404(SupportTicket.objects.all(), pk=pk)
        serializer = PlatformSupportStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_ticket_status(
            actor=request.user,
            ticket=ticket,
            status=serializer.validated_data["status"],
        )
        return Response(render_ticket(pk))


class PlatformSupportAttachmentDownloadView(APIView):
    """GET /platform/support/tickets/{pk}/attachments/{attachment_pk}/download/.

    Both roles: a screenshot IS the ticket, and support cannot diagnose
    what it may not open. The private storage has no URL, so this is the
    only way in — and the bytes came through the ADR 0014 pipeline, so
    they are a re-encoded JPEG/PNG/WebP and nothing else.
    """

    permission_classes = [IsPlatformStaff()]

    def get(self, request, pk, attachment_pk):
        ticket = get_object_or_404(SupportTicket.objects.all(), pk=pk)
        attachment = get_object_or_404(ticket.attachments, pk=attachment_pk)
        return support_attachment_file_response(attachment)
