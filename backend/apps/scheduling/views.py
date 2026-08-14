"""Scheduling views — one section per AUDIENCE (ADR 0008).

STAFF: the day queue (`?date=` list) serves the secretary at the desk and
the doctor between two consultations alike: no role gating inside the
tenant (the ``reason`` field is operational desk data — model docstring).

PATIENT (S2): the patient reads their own appointments ACROSS centers
(``for_patient`` — the read mirror of the medical carnet) and may cancel
one while it is still ``prevu``. Self-booking stays OUT of scope (S2):
booking needs the center's perimeter rules (practitioner resolution,
overlap policy, desk validation) — a chantier of its own, documented in
the ADR 0013 addendum.

Refus semantics (ADR 0008): anonymous → 401 ; center where the caller
holds no membership → 404 (invisible, via ``CenterScopedViewMixin``) ;
appointment of another center — or of another PATIENT via the patient
routes — → 404 (queryset scoping, deterministic IDOR answer) ;
patient/practitioner outside the center's perimeter on a WRITE →
**400 explicite** (the booking form tells the desk what is wrong —
« n'est pas connu de ce centre » covers foreign and non-existent ids
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
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsPatientSelf,
    IsStaffOfCenter,
    claimed_patient_profile,
)
from apps.patients.views import center_patients_qs
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import (
    AppointmentCreateSerializer,
    AppointmentPatientSerializer,
    AppointmentSerializer,
    AppointmentUpdateSerializer,
)
from apps.scheduling.services import (
    UNCHANGED,
    cancel_appointment,
    cancel_appointment_by_patient,
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


#: Longest ``?from=&to=`` range served (S1 — the two-month calendar grid).
MAX_RANGE_DAYS = 62


def _parse_day_or_400(raw, field):
    """One day param or a 400 per field — parse_date returns None on a
    malformed string but RAISES ValueError on a well-formed impossible
    date (« 2026-02-30 »): both are the caller's typo, both answer the
    same 400 (revue adversariale vague 1: the ValueError was a 500)."""
    try:
        day = parse_date(raw)
    except ValueError:
        day = None
    if day is None:
        raise ValidationError({field: ["Format attendu : AAAA-MM-JJ."]})
    return day


class CenterAppointmentListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/appointments/ — the day queue.

    GET filters: ``?date=YYYY-MM-DD`` (default: TODAY in Comoros local
    time — the day boundaries are computed in ``TIME_ZONE``, so a 23:30
    slot stays on its local day), ``?practitioner=<id>``, ``?status=``.
    Sorted by ``scheduled_at`` then id, paginated: the default view IS the
    file du jour.

    S1 range mode: ``?from=YYYY-MM-DD&to=YYYY-MM-DD`` (INCLUSIVE local
    days, both bounds required together, max 62 days — the calendar grid
    was stuck on one week). EXCLUSIVE with ``?date=``: mixing them is a
    400, not a silent precedence.
    """

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AppointmentCreateSerializer
        return AppointmentSerializer

    def _period_bounds(self, params):
        """``(start, end)`` aware datetimes — day mode or range mode."""
        raw_date = params.get("date")
        raw_from = params.get("from")
        raw_to = params.get("to")
        if raw_date and (raw_from or raw_to):
            raise ValidationError(
                {"date": ["Le filtre date est exclusif des bornes from/to."]}
            )
        if raw_from or raw_to:
            if not raw_from:
                raise ValidationError(
                    {"from": ["Les bornes from et to vont ensemble."]}
                )
            if not raw_to:
                raise ValidationError(
                    {"to": ["Les bornes from et to vont ensemble."]}
                )
            from_day = _parse_day_or_400(raw_from, "from")
            to_day = _parse_day_or_400(raw_to, "to")
            if from_day > to_day:
                raise ValidationError(
                    {"from": ["La date de début doit précéder la date de fin."]}
                )
            if (to_day - from_day).days + 1 > MAX_RANGE_DAYS:
                raise ValidationError(
                    {"from": [f"Période trop longue : {MAX_RANGE_DAYS} jours maximum."]}
                )
        else:
            from_day = to_day = (
                _parse_day_or_400(raw_date, "date") if raw_date
                else timezone.localdate()
            )
        try:
            start = timezone.make_aware(datetime.combine(from_day, time.min))
            end = timezone.make_aware(
                datetime.combine(to_day, time.min)
            ) + timedelta(days=1)
        except OverflowError:
            # « 9999-12-31 » : la borne haute du jour n'existe pas dans le
            # calendrier Python — 400 par champ, jamais un 500.
            field = "to" if (raw_from or raw_to) else "date"
            raise ValidationError({field: ["Date hors limites."]})
        return start, end

    def get_queryset(self):
        params = self.request.query_params
        day_start, day_end = self._period_bounds(params)
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


# ---------------------------------------------------------------------------
# Audience: the PATIENT themself (S2 — audit C.4)
# ---------------------------------------------------------------------------


class MyAppointmentListView(generics.ListAPIView):
    """GET /patients/me/appointments/ — my appointments, ACROSS centers.

    The patient already receives J-1 reminder SMS; this list is the app
    counterpart. Transversal by design (``for_patient`` — like the
    carnet's reads), sorted newest first, paginated. ``?upcoming=true``
    keeps only what is still expected to happen (``prevu`` in the
    future); ``?upcoming=false`` is accepted as a no-op for symmetry;
    any other value → 400 per field (S1 filter norm).

    Payload: ``AppointmentPatientSerializer`` — NOT the staff payload
    (no ``reason``, see the serializer docstring).
    """

    permission_classes = [IsPatientSelf]
    serializer_class = AppointmentPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        qs = Appointment.objects.for_patient(profile).select_related(
            "center", "practitioner__user"
        )
        raw_upcoming = self.request.query_params.get("upcoming")
        if raw_upcoming is not None:
            if raw_upcoming not in ("true", "false"):
                raise ValidationError(
                    {"upcoming": ["Valeur attendue : true ou false."]}
                )
            if raw_upcoming == "true":
                qs = qs.filter(
                    status=Appointment.Status.SCHEDULED,
                    scheduled_at__gte=timezone.now(),
                )
        return qs.order_by("-scheduled_at", "-id")


class MyAppointmentCancelView(generics.GenericAPIView):
    """POST /patients/me/appointments/{pk}/cancel/ — patient cancellation.

    The appointment id travels in the URL → someone else's appointment is
    INVISIBLE (404, queryset scoping). An appointment of mine that is no
    longer ``prevu`` answers 400 (state refusal on a visible object) —
    the guard lives in ``cancel_appointment_by_patient`` (row-locked).
    """

    permission_classes = [IsPatientSelf]
    serializer_class = AppointmentPatientSerializer

    def post(self, request, pk):
        profile = claimed_patient_profile(request.user)
        appointment = get_object_or_404(
            Appointment.objects.for_patient(profile).select_related(
                "center", "practitioner__user"
            ),
            pk=pk,
        )
        appointment = cancel_appointment_by_patient(appointment=appointment)
        return Response(AppointmentPatientSerializer(appointment).data)
