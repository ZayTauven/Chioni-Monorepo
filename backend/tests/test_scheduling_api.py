"""Scheduling API — `/api/v1/centers/{c}/appointments/…` (any active staff).

Refus semantics under test (ADR 0008 + spec du chantier) :

- anonymous → 401 ;
- center where the caller holds no membership → 404 (invisible) ;
- appointment of ANOTHER center through my center's URL → 404 (IDOR) ;
- patient / practitioner outside the center's perimeter on a WRITE →
  **400 explicite** (the booking form must say what is wrong).

Plus: the day queue (local-day filter, sort, ``?practitioner=`` /
``?status=``), non-blocking ``overlaps`` warning, move rules, the four
transition actions, and auto-honor through encounter creation.
"""

from datetime import datetime, time, timedelta

import pytest
from django.utils import timezone

from apps.medical.models import Encounter
from apps.scheduling.models import Appointment

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import make_appointment, make_patient, make_staff, make_user

pytestmark = pytest.mark.django_db

Status = Appointment.Status


def local_dt(day_offset, hour, minute=0):
    return timezone.make_aware(
        datetime.combine(
            timezone.localdate() + timedelta(days=day_offset), time(hour, minute)
        )
    )


def desk_patient(center, **kwargs):
    return make_patient(created_by_center=center, **kwargs)


def appointments_url(center):
    return f"/api/v1/centers/{center.pk}/appointments/"


class TestAccessSemantics:
    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert client_for().get(appointments_url(center)).status_code == 401

    def test_staff_of_another_center_gets_404(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_b = make_staff_user(center_b, role=Role.SECRETARY)

        assert client_for(staff_b).get(appointments_url(center_a)).status_code == 404

    def test_user_without_any_membership_gets_404(self):
        center, _ = make_center_with_director()
        outsider = make_user()

        assert client_for(outsider).get(appointments_url(center)).status_code == 404

    def test_every_active_role_reads_the_day_queue(self):
        """The day queue serves the secretary AND the doctor — no role gate
        inside the tenant."""
        center, director = make_center_with_director()
        make_appointment(center=center, scheduled_at=local_dt(0, 9))
        for user in (
            director,
            make_staff_user(center, role=Role.SECRETARY),
            make_staff_user(center, role=Role.DOCTOR),
            make_staff_user(center, role=Role.CASHIER),
        ):
            response = client_for(user).get(appointments_url(center))
            assert response.status_code == 200
            assert response.data["count"] == 1

    def test_foreign_appointment_through_my_center_url_is_404(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        secretary_a = make_staff_user(center_a, role=Role.SECRETARY)
        foreign = make_appointment(center=center_b)

        client = client_for(secretary_a)
        base = f"{appointments_url(center_a)}{foreign.pk}/"
        assert client.get(base).status_code == 404
        assert client.patch(base, {"reason": "x"}, format="json").status_code == 404
        for action in ("check-in", "cancel", "no-show", "honor"):
            assert client.post(f"{base}{action}/").status_code == 404
        foreign.refresh_from_db()
        assert foreign.status == Status.SCHEDULED


class TestCreation:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.patient = desk_patient(self.center)

    def post(self, payload):
        return client_for(self.secretary).post(
            appointments_url(self.center), payload, format="json"
        )

    def test_secretary_books_an_appointment(self):
        practitioner = make_staff(center=self.center)
        response = self.post(
            {
                "patient": self.patient.pk,
                "scheduled_at": local_dt(1, 10).isoformat(),
                "practitioner": practitioner.pk,
                "reason": "consultation",
            }
        )

        assert response.status_code == 201, response.content
        assert response.data["status"] == "prevu"
        assert response.data["duration_minutes"] == 20
        assert response.data["overlaps"] == []
        assert response.data["patient_name"] == "Mariama Ahamada"
        appointment = Appointment.objects.get(pk=response.data["id"])
        assert appointment.center == self.center
        assert appointment.created_by == self.secretary

    def test_appointment_with_the_center_needs_no_practitioner(self):
        response = self.post(
            {"patient": self.patient.pk, "scheduled_at": local_dt(1, 10).isoformat()}
        )
        assert response.status_code == 201, response.content
        assert response.data["practitioner"] is None
        assert response.data["practitioner_name"] is None

    def test_foreign_patient_is_a_explicit_400(self):
        other_center, _ = make_center_with_director()
        foreign_patient = desk_patient(other_center)

        response = self.post(
            {"patient": foreign_patient.pk, "scheduled_at": local_dt(1, 10).isoformat()}
        )

        assert response.status_code == 400
        assert "Ce patient n'est pas connu de ce centre." in str(response.data)
        assert Appointment.objects.count() == 0

    def test_foreign_practitioner_is_a_explicit_400(self):
        other_center, _ = make_center_with_director()
        foreign_practitioner = make_staff(center=other_center)

        response = self.post(
            {
                "patient": self.patient.pk,
                "scheduled_at": local_dt(1, 10).isoformat(),
                "practitioner": foreign_practitioner.pk,
            }
        )

        assert response.status_code == 400
        assert "Ce praticien n'appartient pas à ce centre." in str(response.data)
        assert Appointment.objects.count() == 0

    def test_past_slot_is_400(self):
        response = self.post(
            {
                "patient": self.patient.pk,
                "scheduled_at": (timezone.now() - timedelta(hours=1)).isoformat(),
            }
        )
        assert response.status_code == 400
        assert "dans le passé" in str(response.data)

    def test_double_booking_is_created_with_a_warning(self):
        """Non-blocking by design: the desk decides."""
        practitioner = make_staff(center=self.center)
        first = self.post(
            {
                "patient": self.patient.pk,
                "scheduled_at": local_dt(1, 10).isoformat(),
                "practitioner": practitioner.pk,
            }
        )
        second = self.post(
            {
                "patient": desk_patient(self.center, first_name="Fatima").pk,
                "scheduled_at": local_dt(1, 10, 10).isoformat(),
                "practitioner": practitioner.pk,
            }
        )

        assert second.status_code == 201
        assert second.data["overlaps"] == [first.data["id"]]
        assert Appointment.objects.count() == 2


class TestDayQueue:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.client = client_for(self.secretary)

    def test_default_is_today_sorted_by_time(self):
        late = make_appointment(center=self.center, scheduled_at=local_dt(0, 14))
        early = make_appointment(center=self.center, scheduled_at=local_dt(0, 9))
        make_appointment(center=self.center, scheduled_at=local_dt(1, 9))  # tomorrow

        response = self.client.get(appointments_url(self.center))

        assert response.status_code == 200
        assert [item["id"] for item in response.data["results"]] == [
            early.pk,
            late.pk,
        ]

    def test_date_filter_uses_local_day_boundaries(self):
        """23:30 local and next-day 00:15 local are 25 minutes apart but on
        DIFFERENT local days — a UTC-day filter would put both on the same
        one (UTC+3)."""
        today_night = make_appointment(
            center=self.center, scheduled_at=local_dt(0, 23, 30)
        )
        tomorrow_early = make_appointment(
            center=self.center, scheduled_at=local_dt(1, 0, 15)
        )

        today = timezone.localdate().isoformat()
        response = self.client.get(appointments_url(self.center), {"date": today})
        assert [item["id"] for item in response.data["results"]] == [today_night.pk]

        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.get(appointments_url(self.center), {"date": tomorrow})
        assert [item["id"] for item in response.data["results"]] == [tomorrow_early.pk]

    def test_practitioner_and_status_filters(self):
        practitioner = make_staff(center=self.center)
        mine = make_appointment(
            center=self.center, practitioner=practitioner, scheduled_at=local_dt(0, 9)
        )
        make_appointment(center=self.center, scheduled_at=local_dt(0, 10))
        arrived = make_appointment(
            center=self.center,
            practitioner=practitioner,
            scheduled_at=local_dt(0, 11),
            status=Status.ARRIVED,
        )

        response = self.client.get(
            appointments_url(self.center), {"practitioner": practitioner.pk}
        )
        assert [i["id"] for i in response.data["results"]] == [mine.pk, arrived.pk]

        response = self.client.get(
            appointments_url(self.center), {"status": "arrive"}
        )
        assert [i["id"] for i in response.data["results"]] == [arrived.pk]

    def test_invalid_filters_are_explicit_400(self):
        assert (
            self.client.get(
                appointments_url(self.center), {"date": "13/08/2026"}
            ).status_code
            == 400
        )
        assert (
            self.client.get(
                appointments_url(self.center), {"status": "en_retard"}
            ).status_code
            == 400
        )
        assert (
            self.client.get(
                appointments_url(self.center), {"practitioner": "abc"}
            ).status_code
            == 400
        )

    def test_day_queue_is_center_scoped(self):
        mine = make_appointment(center=self.center, scheduled_at=local_dt(0, 9))
        make_appointment(scheduled_at=local_dt(0, 9))  # another center, same day

        response = self.client.get(appointments_url(self.center))
        assert [item["id"] for item in response.data["results"]] == [mine.pk]


class TestMoveApi:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.client = client_for(self.secretary)

    def detail_url(self, appointment):
        return f"{appointments_url(self.center)}{appointment.pk}/"

    def test_move_updates_slot_and_resets_reminder(self):
        appointment = make_appointment(
            center=self.center,
            scheduled_at=local_dt(1, 10),
            reminder_sent_at=timezone.now(),
        )
        response = self.client.patch(
            self.detail_url(appointment),
            {"scheduled_at": local_dt(1, 16).isoformat()},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert "overlaps" in response.data
        appointment.refresh_from_db()
        assert appointment.scheduled_at == local_dt(1, 16)
        assert appointment.reminder_sent_at is None

    def test_move_reports_overlaps_without_blocking(self):
        practitioner = make_staff(center=self.center)
        settled = make_appointment(
            center=self.center, practitioner=practitioner, scheduled_at=local_dt(1, 10)
        )
        moved = make_appointment(
            center=self.center, practitioner=practitioner, scheduled_at=local_dt(1, 15)
        )

        response = self.client.patch(
            self.detail_url(moved),
            {"scheduled_at": local_dt(1, 10, 5).isoformat()},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["overlaps"] == [settled.pk]

    def test_move_after_check_in_is_400(self):
        appointment = make_appointment(center=self.center, status=Status.ARRIVED)
        response = self.client.patch(
            self.detail_url(appointment),
            {"scheduled_at": local_dt(2, 9).isoformat()},
            format="json",
        )
        assert response.status_code == 400
        assert "encore prévu" in str(response.data)

    def test_practitioner_null_detaches(self):
        practitioner = make_staff(center=self.center)
        appointment = make_appointment(center=self.center, practitioner=practitioner)

        response = self.client.patch(
            self.detail_url(appointment), {"practitioner": None}, format="json"
        )

        assert response.status_code == 200
        appointment.refresh_from_db()
        assert appointment.practitioner is None

    def test_foreign_practitioner_on_move_is_400(self):
        appointment = make_appointment(center=self.center)
        foreign = make_staff(center=make_center_with_director()[0])

        response = self.client.patch(
            self.detail_url(appointment), {"practitioner": foreign.pk}, format="json"
        )

        assert response.status_code == 400
        assert "Ce praticien n'appartient pas à ce centre." in str(response.data)


class TestTransitionsApi:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.client = client_for(self.secretary)

    def action_url(self, appointment, action):
        return f"{appointments_url(self.center)}{appointment.pk}/{action}/"

    def test_full_day_at_the_desk(self):
        appointment = make_appointment(center=self.center)

        response = self.client.post(self.action_url(appointment, "check-in"))
        assert response.status_code == 200
        assert response.data["status"] == "arrive"

        response = self.client.post(self.action_url(appointment, "honor"))
        assert response.status_code == 200
        assert response.data["status"] == "honore"

    def test_honor_straight_from_prevu_is_400(self):
        appointment = make_appointment(center=self.center)
        response = self.client.post(self.action_url(appointment, "honor"))
        assert response.status_code == 400
        assert "Transition impossible" in str(response.data)

    def test_no_show_and_cancel(self):
        missed = make_appointment(center=self.center)
        response = self.client.post(self.action_url(missed, "no-show"))
        assert response.status_code == 200
        assert response.data["status"] == "manque"

        cancelled = make_appointment(center=self.center)
        response = self.client.post(self.action_url(cancelled, "cancel"))
        assert response.status_code == 200
        assert response.data["status"] == "annule"

    def test_terminal_appointment_refuses_every_action(self):
        appointment = make_appointment(center=self.center, status=Status.CANCELLED)
        for action in ("check-in", "honor", "no-show", "cancel"):
            response = self.client.post(self.action_url(appointment, action))
            assert response.status_code == 400


class TestAutoHonorThroughEncounterApi:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.patient = desk_patient(self.center)

    def post_encounter(self, payload):
        return client_for(self.doctor).post(
            f"/api/v1/centers/{self.center.pk}/encounters/", payload, format="json"
        )

    def test_encounter_created_from_appointment_honors_it(self):
        appointment = make_appointment(center=self.center, patient=self.patient)

        response = self.post_encounter(
            {
                "patient": self.patient.pk,
                "reason": "Fièvre persistante",
                "appointment": appointment.pk,
            }
        )

        assert response.status_code == 201, response.content
        appointment.refresh_from_db()
        assert appointment.status == Status.HONORED

    def test_foreign_appointment_is_404_and_nothing_is_created(self):
        other_center, _ = make_center_with_director()
        foreign = make_appointment(center=other_center)

        response = self.post_encounter(
            {
                "patient": self.patient.pk,
                "reason": "Intrusion",
                "appointment": foreign.pk,
            }
        )

        assert response.status_code == 404
        assert Encounter.objects.count() == 0
        foreign.refresh_from_db()
        assert foreign.status == Status.SCHEDULED

    def test_appointment_of_another_patient_is_400(self):
        other_patient = desk_patient(self.center, first_name="Fatima")
        appointment = make_appointment(center=self.center, patient=other_patient)

        response = self.post_encounter(
            {
                "patient": self.patient.pk,
                "reason": "Erreur de dossier",
                "appointment": appointment.pk,
            }
        )

        assert response.status_code == 400
        assert "ne concerne pas ce patient" in str(response.data)
        assert Encounter.objects.count() == 0
        appointment.refresh_from_db()
        assert appointment.status == Status.SCHEDULED
