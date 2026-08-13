"""Scheduling services — the ONLY write path for appointments.

Project rule (CLAUDE.md): writes go through services that replay
``save()``, never raw ``update()``. Appointments are NOT on the
sensitive-action list (no money, no clinical data), so — deliberately —
there is NO AuditLog here.

Business guards implemented here:

- **state machine** (``TRANSITIONS``): ``prevu → arrive|manque|annule``,
  ``arrive → honore|annule`` ; ``honore``/``manque``/``annule`` terminal;
- **past refusal** (5-minute tolerance) at creation and move — the desk
  often books « maintenant », the tolerance absorbs clock skew;
- **overlap detection, non-blocking**: double-booking is an assumed
  reality (« simple d'abord ») — the API returns the overlapping ids as a
  WARNING and the desk decides;
- **J-1 reminders** (Celery beat, 18:00 Comoros time): SMS content follows
  ADR 0012 strictly — never the reason, never the practitioner, never the
  center name (a patient phone may be declarative and shared in the
  household). Anti-duplicate via ``reminder_sent_at``, reset when the
  appointment is MOVED so a rescheduled slot is re-notified if it lands on
  « tomorrow » again.
"""

import logging
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.common.notifications import _patient_phone, notify_appointment_reminder
from apps.scheduling.models import Appointment

logger = logging.getLogger("chioni.scheduling")

Status = Appointment.Status

#: The state machine — terminal states map to an empty set.
TRANSITIONS = {
    Status.SCHEDULED: frozenset({Status.ARRIVED, Status.MISSED, Status.CANCELLED}),
    Status.ARRIVED: frozenset({Status.HONORED, Status.CANCELLED}),
    Status.HONORED: frozenset(),
    Status.MISSED: frozenset(),
    Status.CANCELLED: frozenset(),
}

#: Booking « maintenant » at the desk must not race the clock.
PAST_TOLERANCE = timedelta(minutes=5)

#: Upper bound of the booking window (revue adversariale vague 1). Beyond
#: two years a slot is a typo, and the bound keeps every datetime
#: computation derived from ``scheduled_at`` (``end_at``, overlap windows,
#: day filters) far away from ``datetime.max`` — an un-bounded year-9999
#: slot turned those additions into OverflowError 500s.
MAX_BOOKING_HORIZON = timedelta(days=730)

#: Sentinel for move_appointment: distinguishes « not provided » from None
#: (None is a meaningful value for ``practitioner`` — detach it).
UNCHANGED = object()


def _check_bookable_window(scheduled_at):
    now = timezone.now()
    if scheduled_at < now - PAST_TOLERANCE:
        raise ValidationError(
            "Impossible de programmer un rendez-vous dans le passé."
        )
    if scheduled_at > now + MAX_BOOKING_HORIZON:
        raise ValidationError(
            "Impossible de programmer un rendez-vous à plus de deux ans."
        )


def _check_practitioner(practitioner, center):
    if practitioner is None:
        return
    if practitioner.center_id != center.pk or not practitioner.is_active:
        raise ValidationError("Ce praticien n'appartient pas à ce centre.")


def find_overlapping_ids(
    *, center, practitioner, scheduled_at, duration_minutes, exclude_pk=None
):
    """Ids of same-practitioner appointments whose window overlaps.

    NON-BLOCKING warning (design decision): only ``prevu``/``arrive``
    appointments of the SAME practitioner in the SAME center count —
    a closed slot frees the agenda, and « avec le centre » (practitioner
    None) is never checked (no meaningful agenda to collide with).
    Windows touching edge-to-edge (end == start) do NOT overlap.
    """
    if practitioner is None:
        return []
    window_end = scheduled_at + timedelta(minutes=duration_minutes)
    duration_expr = models.ExpressionWrapper(
        timedelta(minutes=1) * models.F("duration_minutes"),
        output_field=models.DurationField(),
    )
    end_expr = models.ExpressionWrapper(
        models.F("scheduled_at") + duration_expr,
        output_field=models.DateTimeField(),
    )
    qs = (
        Appointment.objects.for_center(center)
        .filter(
            practitioner=practitioner,
            status__in=[Status.SCHEDULED, Status.ARRIVED],
        )
        .annotate(window_end=end_expr)
        .filter(scheduled_at__lt=window_end, window_end__gt=scheduled_at)
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return list(qs.order_by("scheduled_at", "id").values_list("pk", flat=True))


@transaction.atomic
def create_appointment(
    *,
    created_by,
    center,
    patient,
    scheduled_at,
    duration_minutes=20,
    practitioner=None,
    reason="",
):
    """Book an appointment. The VIEW resolves ``patient`` inside the
    center's perimeter and ``practitioner`` among the center's active
    memberships (400 explicite otherwise) — re-checked here for direct
    service callers."""
    _check_bookable_window(scheduled_at)
    _check_practitioner(practitioner, center)
    return Appointment.objects.create(
        center=center,
        patient=patient,
        practitioner=practitioner,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        reason=reason,
        created_by=created_by,
    )


@transaction.atomic
def move_appointment(
    *,
    appointment,
    scheduled_at=UNCHANGED,
    duration_minutes=UNCHANGED,
    practitioner=UNCHANGED,
    reason=UNCHANGED,
):
    """Move/edit an appointment — only while it is still ``prevu``.

    Moving the slot (``scheduled_at`` changes) resets ``reminder_sent_at``
    to NULL: a reminder already sent described a time that no longer
    exists, so the appointment becomes re-eligible for the J-1 reminder if
    its new slot is « tomorrow » at the next 18:00 run (documented on the
    model field).

    The row is re-read under ``select_for_update`` (revue adversariale
    vague 1): the « still ``prevu`` » check must hold at COMMIT time, not
    at read time — otherwise a move racing a check-in/cancel would edit an
    appointment that is no longer editable.
    """
    appointment = Appointment.objects.select_for_update().get(pk=appointment.pk)
    if appointment.status != Status.SCHEDULED:
        raise ValidationError(
            "Seul un rendez-vous encore prévu peut être modifié."
        )
    update_fields = {"updated_at"}
    if scheduled_at is not UNCHANGED and scheduled_at != appointment.scheduled_at:
        _check_bookable_window(scheduled_at)
        appointment.scheduled_at = scheduled_at
        appointment.reminder_sent_at = None
        update_fields.update({"scheduled_at", "reminder_sent_at"})
    if duration_minutes is not UNCHANGED:
        appointment.duration_minutes = duration_minutes
        update_fields.add("duration_minutes")
    if practitioner is not UNCHANGED:
        _check_practitioner(practitioner, appointment.center)
        appointment.practitioner = practitioner
        update_fields.add("practitioner")
    if reason is not UNCHANGED:
        appointment.reason = reason
        update_fields.add("reason")
    appointment.save(update_fields=sorted(update_fields))
    return appointment


def _transition(appointment, target):
    """One state-machine step, serialised on the ROW (revue adversariale
    vague 1): the status is re-read under ``select_for_update`` so two
    concurrent actions (cancel vs honor, check-in vs cancel…) can never
    both pass the legality check — the loser re-reads the winner's state
    and gets the clean French 400. Every caller is ``transaction.atomic``.
    """
    locked = Appointment.objects.select_for_update().get(pk=appointment.pk)
    if target not in TRANSITIONS[locked.status]:
        raise ValidationError(
            f"Transition impossible : ce rendez-vous est "
            f"« {locked.get_status_display()} »."
        )
    locked.status = target
    locked.save(update_fields=["status", "updated_at"])
    # Keep the caller's instance coherent (views serialise it).
    appointment.status = locked.status
    appointment.updated_at = locked.updated_at
    return appointment


@transaction.atomic
def check_in_appointment(*, appointment):
    """The patient is at the desk → waiting room (``prevu → arrive``)."""
    return _transition(appointment, Status.ARRIVED)


@transaction.atomic
def honor_appointment(*, appointment):
    """The patient was seen (``arrive → honore``)."""
    return _transition(appointment, Status.HONORED)


@transaction.atomic
def cancel_appointment(*, appointment):
    """Cancel (``prevu|arrive → annule``)."""
    return _transition(appointment, Status.CANCELLED)


@transaction.atomic
def mark_no_show(*, appointment):
    """The patient never showed up (``prevu → manque``)."""
    return _transition(appointment, Status.MISSED)


@transaction.atomic
def honor_appointment_from_encounter(appointment):
    """Auto-honor when an encounter is created FROM this appointment.

    Called by ``apps.medical.services.create_encounter`` (optional
    ``appointment`` parameter). Being seen by the practitioner implies the
    patient arrived: a still-``prevu`` appointment passes through
    ``arrive`` before ``honore`` — the machine never skips a state, and
    the desk is spared a redundant check-in click. A terminal appointment
    (already honored, missed or cancelled) is refused: the encounter
    creation rolls back and the desk keeps a coherent story.
    """
    if appointment.status == Status.SCHEDULED:
        _transition(appointment, Status.ARRIVED)
    if appointment.status != Status.ARRIVED:
        raise ValidationError(
            "Ce rendez-vous est déjà clos (honoré, manqué ou annulé)."
        )
    return _transition(appointment, Status.HONORED)


def send_appointment_reminders():
    """J-1 reminders — Celery beat, daily at 18:00 Comoros time.

    Eligibility: ``prevu``, scheduled TOMORROW (local Comoros day —
    ``TIME_ZONE`` boundaries, so a 23:30 slot stays on the right day),
    reminder never sent (``reminder_sent_at`` NULL), patient reachable by
    phone (verified account phone once claimed, declarative profile phone
    otherwise — same resolution as every patient SMS).

    Per appointment, flag and SMS are committed TOGETHER: the flag is
    saved in a transaction and the SMS is queued via ``on_commit`` inside
    it — a rollback sends nothing and leaves the row re-eligible, a commit
    guarantees the flag exists before the SMS leaves (anti-duplicate).
    A phoneless patient is skipped silently (DEBUG log) and the flag stays
    NULL — harmless, the slot is only « tomorrow » once.

    Returns the number of reminders queued.
    """
    tomorrow = timezone.localdate() + timedelta(days=1)
    day_start = timezone.make_aware(datetime.combine(tomorrow, time.min))
    day_end = day_start + timedelta(days=1)
    eligible = (
        Appointment.objects.filter(
            status=Status.SCHEDULED,
            reminder_sent_at__isnull=True,
            scheduled_at__gte=day_start,
            scheduled_at__lt=day_end,
        )
        .select_related("patient__user")
        .order_by("scheduled_at", "id")
    )
    sent = 0
    for appointment in eligible:
        if not _patient_phone(appointment.patient):
            logger.debug(
                "Rappel J-1 ignoré (patient sans téléphone) : RDV #%s.",
                appointment.pk,
            )
            continue
        with transaction.atomic():
            appointment.reminder_sent_at = timezone.now()
            appointment.save(update_fields=["reminder_sent_at", "updated_at"])
            notify_appointment_reminder(appointment)
        sent += 1
    return sent
