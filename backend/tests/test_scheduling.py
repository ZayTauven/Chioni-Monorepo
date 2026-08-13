"""Scheduling — model, services and J-1 reminders (apps/scheduling).

Contract under test:

- state machine: ``prevu → arrive|manque|annule``, ``arrive → honore|annule``,
  terminal states locked — transitions ONLY through the services;
- past refusal (5-minute tolerance) at creation and move;
- overlap detection: same practitioner only, NON-blocking (ids returned);
- cross-tenant practitioner refused structurally (model ``save()``);
- auto-honor when an encounter is created from the appointment
  (``create_encounter(appointment=…)``) — same center, same patient,
  terminal appointment refused, rollback leaves no encounter;
- J-1 reminders: eligibility (tomorrow, ``prevu``, phone, not yet
  reminded), LOCAL day boundaries (a 23:30 slot stays on its day),
  content contract ADR 0012 (never the reason, the practitioner, nor the
  center name), anti-duplicate flag, re-eligibility after a move,
  phoneless patient silently skipped;
- Celery beat wiring by NAME (a typo would silently never run anything).
"""

from datetime import datetime, time, timedelta

import pytest
from celery.schedules import crontab
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.common import notifications
from apps.medical.models import Encounter
from apps.medical.services import create_encounter
from apps.scheduling.models import Appointment
from apps.scheduling.services import (
    cancel_appointment,
    check_in_appointment,
    create_appointment,
    find_overlapping_ids,
    honor_appointment,
    honor_appointment_from_encounter,
    mark_no_show,
    move_appointment,
    send_appointment_reminders,
)
from apps.scheduling.tasks import send_appointment_reminders_task

from .api_helpers import make_claimed_patient
from .factories import (
    make_appointment,
    make_center,
    make_patient,
    make_staff,
    make_user,
)

pytestmark = pytest.mark.django_db

Status = Appointment.Status

PATIENT_PHONE = "+2693440301"


def local_dt(day_offset, hour, minute=0):
    """An aware datetime at (today + offset) HH:MM in LOCAL Comoros time."""
    return timezone.make_aware(
        datetime.combine(
            timezone.localdate() + timedelta(days=day_offset), time(hour, minute)
        )
    )


# ---------------------------------------------------------------------------
# Creation guards
# ---------------------------------------------------------------------------


class TestCreationGuards:
    def test_past_appointment_is_refused(self):
        center = make_center()
        with pytest.raises(ValidationError, match="dans le passé"):
            create_appointment(
                created_by=make_user(),
                center=center,
                patient=make_patient(),
                scheduled_at=timezone.now() - timedelta(minutes=10),
            )
        assert Appointment.objects.count() == 0

    def test_five_minute_tolerance_absorbs_booking_now(self):
        """The desk books « maintenant » — small clock skew must pass."""
        center = make_center()
        appointment = create_appointment(
            created_by=make_user(),
            center=center,
            patient=make_patient(),
            scheduled_at=timezone.now() - timedelta(minutes=2),
        )
        assert appointment.status == Status.SCHEDULED

    def test_practitioner_from_another_center_is_refused(self):
        center_a, center_b = make_center(), make_center(name="Clinique Mwali")
        foreign_practitioner = make_staff(center=center_b)
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            create_appointment(
                created_by=make_user(),
                center=center_a,
                patient=make_patient(),
                scheduled_at=local_dt(1, 10),
                practitioner=foreign_practitioner,
            )

    def test_inactive_practitioner_is_refused(self):
        center = make_center()
        practitioner = make_staff(center=center)
        practitioner.is_active = False
        practitioner.save(update_fields=["is_active", "updated_at"])
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            create_appointment(
                created_by=make_user(),
                center=center,
                patient=make_patient(),
                scheduled_at=local_dt(1, 10),
                practitioner=practitioner,
            )

    def test_model_save_refuses_cross_tenant_practitioner(self):
        """Structural invariant — even a direct ORM write is refused."""
        center_a, center_b = make_center(), make_center(name="Clinique Mwali")
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            make_appointment(center=center_a, practitioner=make_staff(center=center_b))


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class TestStateMachine:
    def test_nominal_path_prevu_arrive_honore(self):
        appointment = make_appointment()
        check_in_appointment(appointment=appointment)
        assert appointment.status == Status.ARRIVED
        honor_appointment(appointment=appointment)
        assert appointment.status == Status.HONORED

    def test_honor_straight_from_prevu_is_refused(self):
        appointment = make_appointment()
        with pytest.raises(ValidationError, match="Transition impossible"):
            honor_appointment(appointment=appointment)

    def test_no_show_from_prevu(self):
        appointment = make_appointment()
        mark_no_show(appointment=appointment)
        assert appointment.status == Status.MISSED

    def test_no_show_after_check_in_is_refused(self):
        """A patient in the waiting room cannot be « manqué »."""
        appointment = make_appointment()
        check_in_appointment(appointment=appointment)
        with pytest.raises(ValidationError, match="Transition impossible"):
            mark_no_show(appointment=appointment)

    def test_cancel_from_prevu_and_from_arrive(self):
        first = make_appointment()
        cancel_appointment(appointment=first)
        assert first.status == Status.CANCELLED

        second = make_appointment()
        check_in_appointment(appointment=second)
        cancel_appointment(appointment=second)
        assert second.status == Status.CANCELLED

    @pytest.mark.parametrize(
        "terminal", [Status.HONORED, Status.MISSED, Status.CANCELLED]
    )
    def test_terminal_states_are_locked(self, terminal):
        appointment = make_appointment(status=terminal)
        for service in (
            check_in_appointment,
            honor_appointment,
            cancel_appointment,
            mark_no_show,
        ):
            with pytest.raises(ValidationError, match="Transition impossible"):
                service(appointment=appointment)


# ---------------------------------------------------------------------------
# Move / edit
# ---------------------------------------------------------------------------


class TestMove:
    def test_move_changes_slot_while_prevu(self):
        appointment = make_appointment(scheduled_at=local_dt(1, 10))
        move_appointment(appointment=appointment, scheduled_at=local_dt(2, 9))
        appointment.refresh_from_db()
        assert appointment.scheduled_at == local_dt(2, 9)

    def test_move_to_the_past_is_refused(self):
        appointment = make_appointment()
        with pytest.raises(ValidationError, match="dans le passé"):
            move_appointment(
                appointment=appointment,
                scheduled_at=timezone.now() - timedelta(hours=1),
            )

    def test_move_after_check_in_is_refused(self):
        appointment = make_appointment()
        check_in_appointment(appointment=appointment)
        with pytest.raises(ValidationError, match="encore prévu"):
            move_appointment(appointment=appointment, scheduled_at=local_dt(2, 9))

    def test_move_resets_the_reminder_flag(self):
        """A sent reminder described a slot that no longer exists — the
        appointment becomes re-eligible (documented on the model field)."""
        appointment = make_appointment(reminder_sent_at=timezone.now())
        move_appointment(appointment=appointment, scheduled_at=local_dt(1, 16))
        appointment.refresh_from_db()
        assert appointment.reminder_sent_at is None

    def test_editing_reason_only_keeps_the_reminder_flag(self):
        """Only a MOVE (slot change) re-notifies — not a note edit."""
        sent_at = timezone.now()
        appointment = make_appointment(reminder_sent_at=sent_at)
        move_appointment(appointment=appointment, reason="apporter les analyses")
        appointment.refresh_from_db()
        assert appointment.reminder_sent_at == sent_at
        assert appointment.reason == "apporter les analyses"

    def test_move_practitioner_cross_tenant_is_refused(self):
        appointment = make_appointment()
        foreign = make_staff(center=make_center(name="Clinique Mwali"))
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            move_appointment(appointment=appointment, practitioner=foreign)


# ---------------------------------------------------------------------------
# Overlaps — non-blocking warning
# ---------------------------------------------------------------------------


class TestOverlaps:
    def setup_method(self):
        self.center = make_center()
        self.practitioner = make_staff(center=self.center)

    def overlaps_for(self, scheduled_at, duration=20, practitioner=None, exclude=None):
        return find_overlapping_ids(
            center=self.center,
            practitioner=practitioner or self.practitioner,
            scheduled_at=scheduled_at,
            duration_minutes=duration,
            exclude_pk=exclude,
        )

    def test_overlapping_window_is_reported(self):
        existing = make_appointment(
            center=self.center,
            practitioner=self.practitioner,
            scheduled_at=local_dt(1, 10),  # 10:00 → 10:20
        )
        assert self.overlaps_for(local_dt(1, 10, 10)) == [existing.pk]

    def test_back_to_back_slots_do_not_overlap(self):
        make_appointment(
            center=self.center,
            practitioner=self.practitioner,
            scheduled_at=local_dt(1, 10),  # ends 10:20
        )
        assert self.overlaps_for(local_dt(1, 10, 20)) == []

    def test_other_practitioner_is_not_a_conflict(self):
        make_appointment(
            center=self.center,
            practitioner=make_staff(center=self.center),
            scheduled_at=local_dt(1, 10),
        )
        assert self.overlaps_for(local_dt(1, 10)) == []

    def test_appointment_with_the_center_is_never_checked(self):
        make_appointment(
            center=self.center, practitioner=None, scheduled_at=local_dt(1, 10)
        )
        assert (
            find_overlapping_ids(
                center=self.center,
                practitioner=None,
                scheduled_at=local_dt(1, 10),
                duration_minutes=20,
            )
            == []
        )

    @pytest.mark.parametrize(
        "closed", [Status.HONORED, Status.MISSED, Status.CANCELLED]
    )
    def test_closed_appointments_free_the_agenda(self, closed):
        make_appointment(
            center=self.center,
            practitioner=self.practitioner,
            scheduled_at=local_dt(1, 10),
            status=closed,
        )
        assert self.overlaps_for(local_dt(1, 10)) == []

    def test_arrived_appointment_still_counts(self):
        existing = make_appointment(
            center=self.center,
            practitioner=self.practitioner,
            scheduled_at=local_dt(1, 10),
            status=Status.ARRIVED,
        )
        assert self.overlaps_for(local_dt(1, 10, 5)) == [existing.pk]

    def test_exclude_pk_ignores_the_moved_appointment_itself(self):
        moved = make_appointment(
            center=self.center,
            practitioner=self.practitioner,
            scheduled_at=local_dt(1, 10),
        )
        assert self.overlaps_for(local_dt(1, 10), exclude=moved.pk) == []


# ---------------------------------------------------------------------------
# Auto-honor from encounter creation
# ---------------------------------------------------------------------------


class TestHonorFromEncounter:
    def setup_method(self):
        self.center = make_center()
        self.practitioner = make_staff(center=self.center)  # doctor
        self.patient = make_patient(created_by_center=self.center)

    def create_encounter_for(self, appointment, patient=None):
        return create_encounter(
            actor=self.practitioner.user,
            center=self.center,
            practitioner=self.practitioner,
            patient=patient or self.patient,
            reason="Fièvre persistante",
            appointment=appointment,
        )

    def test_arrived_appointment_is_honored(self):
        appointment = make_appointment(
            center=self.center, patient=self.patient, status=Status.ARRIVED
        )
        self.create_encounter_for(appointment)
        appointment.refresh_from_db()
        assert appointment.status == Status.HONORED

    def test_prevu_appointment_passes_through_arrive(self):
        """Being seen implies arrival — the desk is spared a click, and the
        machine never skips a state."""
        appointment = make_appointment(center=self.center, patient=self.patient)
        self.create_encounter_for(appointment)
        appointment.refresh_from_db()
        assert appointment.status == Status.HONORED

    def test_appointment_of_another_patient_is_refused(self):
        other = make_patient(
            first_name="Nadjma", last_name="Saïd", created_by_center=self.center
        )
        appointment = make_appointment(center=self.center, patient=other)
        with pytest.raises(ValidationError, match="ne concerne pas ce patient"):
            self.create_encounter_for(appointment)
        assert Encounter.objects.count() == 0
        appointment.refresh_from_db()
        assert appointment.status == Status.SCHEDULED

    def test_appointment_of_another_center_is_refused(self):
        other_center = make_center(name="Clinique Mwali")
        appointment = make_appointment(center=other_center, patient=self.patient)
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            self.create_encounter_for(appointment)
        assert Encounter.objects.count() == 0

    @pytest.mark.parametrize(
        "terminal", [Status.HONORED, Status.MISSED, Status.CANCELLED]
    )
    def test_terminal_appointment_refuses_the_encounter(self, terminal):
        appointment = make_appointment(
            center=self.center, patient=self.patient, status=terminal
        )
        with pytest.raises(ValidationError, match="déjà clos"):
            self.create_encounter_for(appointment)
        assert Encounter.objects.count() == 0

    def test_service_alone_honors_from_arrive(self):
        appointment = make_appointment(status=Status.ARRIVED)
        honor_appointment_from_encounter(appointment)
        assert appointment.status == Status.HONORED

    def test_encounter_without_appointment_is_untouched(self):
        """No-regression: the optional parameter changes nothing when absent."""
        encounter = create_encounter(
            actor=self.practitioner.user,
            center=self.center,
            practitioner=self.practitioner,
            patient=self.patient,
            reason="Consultation de suivi",
        )
        assert encounter.pk is not None


# ---------------------------------------------------------------------------
# J-1 reminders
# ---------------------------------------------------------------------------


class TestReminders:
    def make_tomorrow_appointment(self, hour=9, minute=30, **kwargs):
        kwargs.setdefault("patient", make_patient(phone=PATIENT_PHONE))
        return make_appointment(scheduled_at=local_dt(1, hour, minute), **kwargs)

    def run(self, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            return send_appointment_reminders()

    def test_tomorrow_prevu_with_phone_is_reminded(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        appointment = self.make_tomorrow_appointment(hour=9, minute=30)

        assert self.run(django_capture_on_commit_callbacks) == 1
        assert sms_outbox == [
            (PATIENT_PHONE, "Chioni : rappel — vous avez un rendez-vous demain à 09h30.")
        ]
        appointment.refresh_from_db()
        assert appointment.reminder_sent_at is not None

    def test_content_never_leaks_reason_practitioner_or_center(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """ADR 0012 — a specialised center name is quasi-medical data, the
        reason IS medical context, and the practitioner names the care."""
        center = make_center(name="Polyclinique Cardiologie Ndzouani")
        practitioner = make_staff(user=make_user(), center=center)
        practitioner.user.first_name = "Ali"
        practitioner.user.last_name = "Soilihi"
        practitioner.user.save(update_fields=["first_name", "last_name"])
        self.make_tomorrow_appointment(
            center=center,
            practitioner=practitioner,
            reason="Suivi hypertension sévère",
        )

        assert self.run(django_capture_on_commit_callbacks) == 1
        _, message = sms_outbox[0]
        for forbidden in (
            "hypertension", "Suivi", "Ali", "Soilihi",
            "Polyclinique", "Cardiologie", "Ndzouani",
        ):
            assert forbidden not in message
        assert message.startswith("Chioni : ")
        assert len(message) < 160

    def test_claimed_patient_gets_the_verified_account_phone(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        user = make_user(phone="+2693440302")
        patient = make_claimed_patient(user=user)
        make_appointment(patient=patient, scheduled_at=local_dt(1, 8))

        assert self.run(django_capture_on_commit_callbacks) == 1
        assert sms_outbox[0][0] == "+2693440302"

    def test_phoneless_patient_is_silently_skipped_and_stays_unflagged(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        appointment = make_appointment(
            patient=make_patient(), scheduled_at=local_dt(1, 9)
        )

        assert self.run(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []
        appointment.refresh_from_db()
        assert appointment.reminder_sent_at is None

    def test_only_tomorrow_is_eligible(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        self.make_tomorrow_appointment(hour=9)  # the only eligible one
        make_appointment(
            patient=make_patient(phone="+2693440303"),
            scheduled_at=local_dt(0, 23, 30),  # today — not tomorrow
        )
        make_appointment(
            patient=make_patient(phone="+2693440304"),
            scheduled_at=local_dt(2, 9),  # day after tomorrow
        )

        assert self.run(django_capture_on_commit_callbacks) == 1
        assert sms_outbox[0][0] == PATIENT_PHONE

    def test_local_day_boundaries_keep_late_evening_slots(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """23:30 local = 20:30 UTC: a UTC-day filter would misfile the
        edges. Both extremities of the LOCAL day must be eligible."""
        self.make_tomorrow_appointment(hour=23, minute=30)
        make_appointment(
            patient=make_patient(phone="+2693440305"),
            scheduled_at=local_dt(1, 0, 15),  # tomorrow 00:15 local
        )

        assert self.run(django_capture_on_commit_callbacks) == 2
        messages = sorted(message for _, message in sms_outbox)
        assert "à 00h15" in messages[0]
        assert "à 23h30" in messages[1]

    @pytest.mark.parametrize(
        "status", [Status.ARRIVED, Status.HONORED, Status.MISSED, Status.CANCELLED]
    )
    def test_non_prevu_statuses_are_not_reminded(
        self, status, sms_outbox, django_capture_on_commit_callbacks
    ):
        self.make_tomorrow_appointment(status=status)

        assert self.run(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_anti_duplicate_flag(self, sms_outbox, django_capture_on_commit_callbacks):
        self.make_tomorrow_appointment()

        assert self.run(django_capture_on_commit_callbacks) == 1
        assert self.run(django_capture_on_commit_callbacks) == 0
        assert len(sms_outbox) == 1

    def test_moved_appointment_is_re_notified_with_the_new_time(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        appointment = self.make_tomorrow_appointment(hour=9, minute=30)
        assert self.run(django_capture_on_commit_callbacks) == 1

        move_appointment(appointment=appointment, scheduled_at=local_dt(1, 16))

        assert self.run(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 2
        assert "à 16h00" in sms_outbox[1][1]

    def test_nothing_leaves_without_a_commit(self, sms_outbox):
        """on_commit contract: the test transaction never commits, so a run
        OUTSIDE the capture context delivers nothing."""
        self.make_tomorrow_appointment()

        assert send_appointment_reminders() == 1
        assert sms_outbox == []

    def test_template_constant_is_the_extraction_point(self):
        assert notifications.SMS_APPOINTMENT_REMINDER == (
            "Chioni : rappel — vous avez un rendez-vous demain à {time}."
        )


# ---------------------------------------------------------------------------
# Celery beat wiring
# ---------------------------------------------------------------------------


class TestBeatWiring:
    """The beat schedule references tasks BY NAME — pin the contract."""

    def test_task_registered_under_its_beat_name(self):
        assert (
            send_appointment_reminders_task.name
            == "scheduling.send_appointment_reminders"
        )

    def test_beat_schedules_daily_reminders_at_18_comoros(self, settings):
        entry = settings.CELERY_BEAT_SCHEDULE["send-appointment-reminders"]
        assert entry["task"] == "scheduling.send_appointment_reminders"
        schedule = entry["schedule"]
        assert isinstance(schedule, crontab)
        assert schedule.hour == {18}
        assert schedule.minute == {0}
        # crontab is evaluated in CELERY_TIMEZONE — must be Comoros local.
        assert settings.CELERY_TIMEZONE == "Indian/Comoro"

    def test_task_runs_through_celery(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Eager mode in tests: ``delay`` proves end-to-end Celery wiring."""
        make_appointment(
            patient=make_patient(phone=PATIENT_PHONE),
            scheduled_at=local_dt(1, 11),
        )

        with django_capture_on_commit_callbacks(execute=True):
            assert send_appointment_reminders_task.delay().get() == 1
        assert len(sms_outbox) == 1
