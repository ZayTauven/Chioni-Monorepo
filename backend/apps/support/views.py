"""Support views — TENANT side (S5 lot 3, ADR 0018 décision 5).

Who may do what, and why:

- **open a ticket: ANY active staff member of the center.** « C'est la
  secrétaire qui rencontre le bug, pas le directeur » — a support channel
  that only the director could use would simply not be used;
- **read: the AUTHOR of the ticket + the DIRECTOR** (all the tickets of
  his center). The director answers for his house, and a thread may
  contain an operational complaint about a colleague; the rest of the
  staff sees its own requests and nothing else. Scoping lives in the
  QUERYSET, so a ticket outside the caller's perimeter is a deterministic
  404 — never a 403 telling him it exists;
- **answer: whoever may read.** A thread the author cannot answer is a
  form, not a conversation.

**The freeze does NOT apply** (le point critique du lot) — no
``require_center_can_administer`` anywhere in this module: a center
suspended for non-payment is exactly the one that needs to ask why.
"""

from pathlib import PurePosixPath

from django.db.models import Count, Max
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.centers.models import StaffMembership
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsStaffOfCenter,
    active_membership_qs,
)
from apps.support.models import SupportMessage, SupportTicket
from apps.support.serializers import (
    SupportAttachmentSerializer,
    SupportAttachmentUploadSerializer,
    SupportMessageCreateSerializer,
    SupportMessageSerializer,
    SupportTicketCreateSerializer,
    SupportTicketDetailSerializer,
    SupportTicketSerializer,
)
from apps.support.services import attach_file, open_ticket, post_message

DIRECTOR = StaffMembership.Role.DIRECTOR


def annotate_tickets(queryset):
    """Counters and thread freshness in SQL — never a query per row.

    ``distinct=True`` on both counts: the two joins multiply each other,
    and a ticket with 3 messages and 2 attachments would otherwise report
    6 of each. ``Max`` is unaffected by the multiplication.
    """
    return queryset.annotate(
        message_count=Count("messages", distinct=True),
        attachment_count=Count("attachments", distinct=True),
        last_message_at=Max("messages__created_at"),
    )


def support_attachment_file_response(attachment):
    """Stream an attachment to an AUTHORISED caller (ADR 0016 §5).

    The caller's permissions were already replayed by the view. Contract of
    the response, identical to the KYC and patient-document ones:

    - ``Content-Disposition: attachment`` with a NEUTRAL name
      (``piece-<id>.<ext>``) — the uuid storage name never leaks;
    - ``X-Content-Type-Options: nosniff``;
    - at deployment this becomes an ``X-Accel-Redirect`` to an internal
      location over PRIVATE_MEDIA_ROOT.
    """
    extension = PurePosixPath(attachment.file.name).suffix
    response = FileResponse(
        attachment.file.open("rb"),
        as_attachment=True,
        filename=f"piece-{attachment.pk}{extension}",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


class _SupportScopeMixin(CenterScopedViewMixin):
    """Center resolution + the read perimeter of ONE caller.

    ``IsStaffOfCenter()`` (no role) is the door: any ACTIVE membership of
    the center. The narrowing to « my tickets » (or all of them, for a
    director) happens in the queryset — the S1 refusal norm applies, a
    colleague's ticket is a 404, not a 403.
    """

    permission_classes = [IsStaffOfCenter()]

    @property
    def is_director(self):
        return active_membership_qs(
            self.request.user, center=self.center, roles=[DIRECTOR]
        ).exists()

    def scoped_tickets(self):
        qs = SupportTicket.objects.for_center(self.center)
        if not self.is_director:
            qs = qs.filter(opened_by=self.request.user)
        return qs

    def get_ticket(self):
        return get_object_or_404(self.scoped_tickets(), pk=self.kwargs["pk"])


class CenterSupportTicketListCreateView(
    _SupportScopeMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/support/tickets/ — any active staff.

    GET: my tickets (all of the center for a director), most recent first,
    paginated. ``?status=`` and ``?category=`` filter; an unknown value
    answers 400 per field, never a silent « no filter » (S1 norm).

    POST: opens a ticket, and its first message when a ``body`` is given.
    **Never frozen by the subscription** — see the module docstring.
    """

    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        qs = annotate_tickets(
            self.scoped_tickets().select_related("opened_by")
        ).order_by("-created_at", "-id")
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in SupportTicket.Status.values:
                raise _field_error("status", "Statut de ticket inconnu.")
            qs = qs.filter(status=status_filter)
        category = (params.get("category") or "").strip()
        if category:
            if category not in SupportTicket.Category.values:
                raise _field_error("category", "Catégorie de ticket inconnue.")
            qs = qs.filter(category=category)
        return qs

    @extend_schema(
        request=SupportTicketCreateSerializer,
        responses={201: SupportTicketDetailSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = SupportTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = open_ticket(
            actor=request.user, center=self.center, **serializer.validated_data
        )
        return Response(
            _render_detail(self.scoped_tickets(), ticket.pk),
            status=http_status.HTTP_201_CREATED,
        )


class CenterSupportTicketDetailView(_SupportScopeMixin, generics.RetrieveAPIView):
    """GET /centers/{center_pk}/support/tickets/{pk}/ — ticket + thread.

    One round trip: the messages and the attachment metadata come nested.
    A ticket outside the caller's perimeter (a colleague's, another
    center's) is a 404.
    """

    serializer_class = SupportTicketDetailSerializer

    def get_queryset(self):
        return _detail_queryset(self.scoped_tickets())


class CenterSupportMessageView(_SupportScopeMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/support/tickets/{pk}/messages/.

    Bare array on GET (a thread is short — same posture as prescriptions
    and carnet entries). POST appends one message on the ``centre`` side;
    a ``ferme`` ticket answers 400 telling what to do instead.
    """

    serializer_class = SupportMessageSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            SupportMessage.objects.filter(ticket=self.get_ticket())
            .select_related("author")
            .order_by("created_at", "id")
        )

    @extend_schema(
        request=SupportMessageCreateSerializer,
        responses={201: SupportMessageSerializer},
    )
    def create(self, request, *args, **kwargs):
        ticket = self.get_ticket()
        serializer = SupportMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = post_message(
            actor=request.user,
            ticket=ticket,
            body=serializer.validated_data["body"],
            side=SupportMessage.Side.CENTER,
        )
        return Response(
            SupportMessageSerializer(message).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterSupportAttachmentView(
    _SupportScopeMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/support/tickets/{pk}/attachments/.

    POST is multipart and runs the ADR 0014 pipeline unchanged (JPEG / PNG
    / WebP by REAL content, 2 Mo, EXIF stripped) under the STRICT
    ``uploads`` throttle scope — **POST only**: listing must never starve
    on the upload budget.
    """

    serializer_class = SupportAttachmentSerializer
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "uploads"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return self.get_ticket().attachments.order_by("created_at", "id")

    @extend_schema(
        request=SupportAttachmentUploadSerializer,
        responses={201: SupportAttachmentSerializer},
    )
    def create(self, request, *args, **kwargs):
        ticket = self.get_ticket()
        serializer = SupportAttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = attach_file(
            actor=request.user,
            ticket=ticket,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response(
            SupportAttachmentSerializer(attachment).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterSupportAttachmentDownloadView(_SupportScopeMixin, APIView):
    """GET .../support/tickets/{pk}/attachments/{attachment_pk}/download/.

    THE only tenant-side read path of the bytes: it replays exactly the
    list's permissions and scoping, then streams. The private storage has
    no URL at all, so there is no other way in.
    """

    def get(self, request, center_pk, pk, attachment_pk):
        attachment = get_object_or_404(
            self.get_ticket().attachments, pk=attachment_pk
        )
        return support_attachment_file_response(attachment)


# ---------------------------------------------------------------------------
# Shared helpers (both audiences)
# ---------------------------------------------------------------------------


def _detail_queryset(queryset):
    """Ticket detail: the thread prefetched, the counters annotated."""
    return annotate_tickets(
        queryset.select_related("opened_by").prefetch_related(
            "messages__author", "attachments"
        )
    )


def _render_detail(queryset, pk, serializer_class=SupportTicketDetailSerializer):
    """Re-read through the annotated queryset so a write answers the SAME
    payload the detail serves (counters and thread included)."""
    return serializer_class(_detail_queryset(queryset).get(pk=pk)).data


def _field_error(field, message):
    """S1 filter norm: an unknown value answers 400 PER FIELD, never a
    silent « no filter » that would show the caller a wrong list."""
    return DrfValidationError({field: [message]})
