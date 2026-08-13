"""Scheduling views — audience: ANY active staff of the center.

The day queue (`?date=` list) serves the secretary at the desk and the
doctor between two consultations alike: no role gating inside the tenant
(the ``reason`` field is operational desk data — model docstring).

Refus semantics (ADR 0008): anonymous → 401 ; center where the caller
holds no membership → 404 (invisible, via ``CenterScopedViewMixin``) ;
appointment of another center → 404 (queryset scoping, deterministic
IDOR answer) ; patient/practitioner outside the center's perimeter on a
WRITE → **400 explicite** (the booking form tells the desk what is wrong
— « n'est pas connu de ce centre » covers foreign and non-existent ids
alike, nothing is leaked).
"""

from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.centers.models import StaffMembership
from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter
from apps.patients.views import center_patients_qs
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import (
    AppointmentCreateSerializer,
    AppointmentSerializer,
    AppointmentUpdateSerializer,
)
from apps.scheduling.services import (
    UNCHANGED,
    cancel_appointment,
    check_in_appointment,
    create_appointment,
    find_overlapping_ids,
    honor_appointment,
    mark_no_show,
    move_appointment,
)


def _resolve_patient(center, patient_pk):
    """The center's registry perimeter — 400 explicite outside it."""
    patient = center_patients_qs(center).filter(pk=patient_pk).first()
    if patient is None:
        raise DjangoValidationError("Ce patient n'est pas connu de ce centre.")
    return patient


def _resolve_practitioner(center, practitioner_pk):
    """An ACTIVE membership of THIS center — 400 explicite otherwise."""
    practitioner = (
        StaffMembership.objects.for_center(center)
        .filter(pk=practitioner_pk, is_active=True)
        .first()
    )
    if practitioner is None:
        raise DjangoValidationError("Ce praticien n'appartient pas à ce centre.")
    return practitioner


def _payload_with_overlaps(appointment):
    """Serialized appointment + the NON-BLOCKING double-booking warning."""
    data = AppointmentSerializer(appointment).data
    data["overlaps"] = find_overlapping_ids(
        center=appointment.center,
        practitioner=appointment.practitioner,
        scheduled_at=appointment.scheduled_at,
        duration_minutes=appointment.duration_minutes,
        exclude_pk=appointment.pk,
    )
    return data


class CenterAppointmentListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/appointments/ — the day queue.

    GET filters: ``?date=YYYY-MM-DD`` (default: TODAY in Comoros local
    time — the day boundaries are computed in ``TIME_ZONE``, so a 23:30
    slot stays on its local day), ``?practitioner=<id>``, ``?status=``.
    Sorted by ``scheduled_at`` then id, paginated: the default view IS the
    file du jour.
    """

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AppointmentCreateSerializer
        return AppointmentSerializer

    def get_queryset(self):
        params = self.request.query_params
        raw_date = params.get("date")
        if raw_date:
            # parse_date returns None on a malformed string but RAISES
            # ValueError on a well-formed impossible date (« 2026-02-30 »)
            # — both are the caller's typo, both answer the same 400
            # (revue adversariale vague 1: the ValueError was a 500).
            try:
                day = parse_date(raw_date)
            except ValueError:
                day = None
            if day is None:
                raise ValidationError({"date": ["Format attendu : AAAA-MM-JJ."]})
        else:
            day = timezone.localdate()
        day_start = timezone.make_aware(datetime.combine(day, time.min))
        try:
            day_end = day_start + timedelta(days=1)
        except OverflowError:
            # « 9999-12-31 » : la borne haute du jour n'existe pas dans le
            # calendrier Python — journée vide, jamais un 500.
            raise ValidationError({"date": ["Date hors limites."]})
        qs = (
            Appointment.objects.for_center(self.center)
            .filter(
                scheduled_at__gte=day_start,
                scheduled_at__lt=day_end,
            )
            .select_related("patient", "practitioner__user")
        )
        raw_practitioner = params.get("practitioner")
        if raw_practitioner:
            if not raw_practitioner.isdigit():
                raise ValidationError(
                    {"practitioner": ["Identifiant de praticien invalide."]}
                )
            # Center-scoped queryset: a foreign practitioner id simply
            # matches nothing (no cross-tenant probe through the filter).
            qs = qs.filter(practitioner_id=int(raw_practitioner))
        raw_status = params.get("status")
        if raw_status:
            if raw_status not in Appointment.Status.values:
                raise ValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=raw_status)
        return qs.order_by("scheduled_at", "id")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        patient = _resolve_patient(self.center, data["patient"])
        practitioner = None
        if data["practitioner"] is not None:
            practitioner = _resolve_practitioner(self.center, data["practitioner"])
        appointment = create_appointment(
            created_by=request.user,
            center=self.center,
            patient=patient,
            scheduled_at=data["scheduled_at"],
            duration_minutes=data["duration_minutes"],
            practitioner=practitioner,
            reason=data["reason"],
        )
        return Response(
            _payload_with_overlaps(appointment), status=status.HTTP_201_CREATED
        )


class CenterAppointmentDetailView(CenterScopedViewMixin, generics.GenericAPIView):
    """GET|PATCH /centers/{center_pk}/appointments/{pk}/.

    PATCH = move/edit, only while ``prevu`` (service-enforced → 400).
    The response carries the refreshed ``overlaps`` warning.
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = AppointmentUpdateSerializer

    def get_queryset(self):
        return Appointment.objects.for_center(self.center).select_related(
            "patient", "practitioner__user"
        )

    def get(self, request, *args, **kwargs):
        return Response(AppointmentSerializer(self.get_object()).data)

    def patch(self, request, *args, **kwargs):
        appointment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        practitioner = UNCHANGED
        if "practitioner" in data:
            practitioner = (
                None
                if data["practitioner"] is None
                else _resolve_practitioner(self.center, data["practitioner"])
            )
        appointment = move_appointment(
            appointment=appointment,
            scheduled_at=data.get("scheduled_at", UNCHANGED),
            duration_minutes=data.get("duration_minutes", UNCHANGED),
            practitioner=practitioner,
            reason=data.get("reason", UNCHANGED),
        )
        return Response(_payload_with_overlaps(appointment))


class _AppointmentTransitionView(CenterScopedViewMixin, generics.GenericAPIView):
    """Base for the four transition actions (empty POST body).

    The appointment is resolved through the center-scoped queryset (404
    IDOR answer), then handed to the matching service — an illegal
    transition raises a Django ValidationError, translated to 400 by the
    global handler.
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = AppointmentSerializer
    transition_service = None  # staticmethod set by subclasses

    def post(self, request, *args, **kwargs):
        appointment = get_object_or_404(
            Appointment.objects.for_center(self.center), pk=kwargs["pk"]
        )
        appointment = type(self).transition_service(appointment=appointment)
        return Response(AppointmentSerializer(appointment).data)


class AppointmentCheckInView(_AppointmentTransitionView):
    """POST /centers/{c}/appointments/{pk}/check-in/ → ``arrive``."""

    transition_service = staticmethod(check_in_appointment)


class AppointmentCancelView(_AppointmentTransitionView):
    """POST /centers/{c}/appointments/{pk}/cancel/ → ``annule``."""

    transition_service = staticmethod(cancel_appointment)


class AppointmentNoShowView(_AppointmentTransitionView):
    """POST /centers/{c}/appointments/{pk}/no-show/ → ``manque``."""

    transition_service = staticmethod(mark_no_show)


class AppointmentHonorView(_AppointmentTransitionView):
    """POST /centers/{c}/appointments/{pk}/honor/ → ``honore``.

    Manual path — creating an encounter from the appointment honors it
    automatically (``apps.medical.services.create_encounter``).
    """

    transition_service = staticmethod(honor_appointment)
