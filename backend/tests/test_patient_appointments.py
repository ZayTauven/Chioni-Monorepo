"""S2 — appointments seen by the PATIENT (`/patients/me/appointments/`).

The patient already receives J-1 reminder SMS; these endpoints are the app
counterpart: a TRANSVERSAL read across centers (like the carnet) and the
cancellation of a still-``prevu`` appointment. Locked here:

- cross-patient isolation (patient A never sees patient B's rows — 404
  deterministic on the cancel URL, absent from the list);
- the PATIENT payload is NOT the staff payload: ``reason`` (desk
  operational note, uncontrolled content) is ABSENT — negative assertion;
- cancellation is narrower than the staff path: ``prevu`` ONLY;
- the practitioner display name never falls back to a username (shadow
  staff usernames embed a phone number).
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.scheduling.models import Appointment

from .api_helpers import client_for, make_claimed_patient, make_staff_user
from .factories import make_appointment, make_center, make_staff, make_user

pytestmark = pytest.mark.django_db

Status = Appointment.Status

LIST_URL = "/api/v1/patients/me/appointments/"


def cancel_url(pk):
    return f"/api/v1/patients/me/appointments/{pk}/cancel/"


class TestMyAppointmentsList:
    def test_transversal_across_centers(self):
        """The patient sees their appointments from EVERY center at once."""
        patient = make_claimed_patient()
        center_a = make_center(name="Clinique Ylang")
        center_b = make_center(name="CHR El-Maarouf", city="Moroni")
        make_appointment(patient=patient, center=center_a)
        make_appointment(patient=patient, center=center_b)

        response = client_for(patient.user).get(LIST_URL)

        assert response.status_code == 200
        names = {item["center"]["name"] for item in response.data["results"]}
        assert names == {"Clinique Ylang", "CHR El-Maarouf"}

    def test_patient_a_never_sees_patient_b_rows(self):
        mine = make_claimed_patient()
        other = make_claimed_patient(first_name="Anfia", last_name="Soilihi")
        center = make_center()
        make_appointment(patient=mine, center=center)
        foreign = make_appointment(patient=other, center=center)

        response = client_for(mine.user).get(LIST_URL)

        assert response.status_code == 200
        ids = {item["id"] for item in response.data["results"]}
        assert foreign.pk not in ids
        assert len(ids) == 1

    def test_sorted_newest_first(self):
        patient = make_claimed_patient()
        center = make_center()
        base = timezone.now() + timedelta(days=1)
        early = make_appointment(
            patient=patient, center=center, scheduled_at=base
        )
        late = make_appointment(
            patient=patient, center=center, scheduled_at=base + timedelta(days=3)
        )

        response = client_for(patient.user).get(LIST_URL)

        assert [i["id"] for i in response.data["results"]] == [late.pk, early.pk]

    def test_payload_is_the_patient_shape_and_reason_is_absent(self):
        """Exact keys — and the NEGATIVE assertion: no ``reason`` (desk
        operational note, staff-only per ADR 0013), no staff plumbing."""
        patient = make_claimed_patient()
        center = make_center(name="Clinique Ylang")
        make_appointment(
            patient=patient, center=center, reason="note de guichet sensible"
        )

        response = client_for(patient.user).get(LIST_URL)

        item = response.data["results"][0]
        assert set(item.keys()) == {
            "id", "center", "scheduled_at", "duration_minutes", "status",
            "practitioner_display_name",
        }
        assert item["center"] == {"id": center.pk, "name": "Clinique Ylang"}
        assert "reason" not in item
        assert "note de guichet sensible" not in str(response.data)
        assert "patient" not in item
        assert "reminder_sent_at" not in item

    def test_practitioner_display_name_resolution(self):
        patient = make_claimed_patient()
        center = make_center()
        named_user = make_user()
        named_user.first_name, named_user.last_name = "Faïza", "Mohamed"
        named_user.save(update_fields=["first_name", "last_name"])
        named = make_staff(user=named_user, center=center)
        make_appointment(patient=patient, center=center, practitioner=named)
        make_appointment(patient=patient, center=center)  # « avec le centre »

        response = client_for(patient.user).get(LIST_URL)

        by_name = {i["practitioner_display_name"] for i in response.data["results"]}
        assert by_name == {"Faïza Mohamed", None}

    def test_nameless_practitioner_never_leaks_the_username(self):
        """Shadow staff usernames are « invite-<phone> » — the fallback is
        null, never the username."""
        patient = make_claimed_patient()
        center = make_center()
        shadow = make_user(username="invite-2691234567")
        membership = make_staff(user=shadow, center=center)
        make_appointment(patient=patient, center=center, practitioner=membership)

        response = client_for(patient.user).get(LIST_URL)

        item = response.data["results"][0]
        assert item["practitioner_display_name"] is None
        assert "invite-2691234567" not in str(response.data)

    def test_upcoming_true_keeps_only_future_still_prevu(self):
        patient = make_claimed_patient()
        center = make_center()
        future = make_appointment(patient=patient, center=center)
        make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=2),
        )
        make_appointment(
            patient=patient, center=center, status=Status.CANCELLED
        )

        response = client_for(patient.user).get(LIST_URL, {"upcoming": "true"})

        assert response.status_code == 200
        assert [i["id"] for i in response.data["results"]] == [future.pk]

    def test_upcoming_false_returns_everything(self):
        patient = make_claimed_patient()
        center = make_center()
        make_appointment(patient=patient, center=center)
        make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=2),
        )

        response = client_for(patient.user).get(LIST_URL, {"upcoming": "false"})

        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    def test_upcoming_invalid_value_is_a_400_per_field(self):
        patient = make_claimed_patient()

        response = client_for(patient.user).get(LIST_URL, {"upcoming": "oui"})

        assert response.status_code == 400
        assert "upcoming" in response.data

    def test_anonymous_401(self):
        assert client_for().get(LIST_URL).status_code == 401

    def test_user_without_claimed_profile_403(self):
        assert client_for(make_user()).get(LIST_URL).status_code == 403

    def test_staff_hat_does_not_open_the_patient_space(self):
        """Cross-hat check (ADR 0008): being staff of the center where the
        appointment lives opens NOTHING here."""
        center = make_center()
        staff = make_staff_user(center)
        make_appointment(patient=make_claimed_patient(), center=center)

        assert client_for(staff).get(LIST_URL).status_code == 403


class TestMyAppointmentCancel:
    def test_cancels_a_prevu_appointment(self):
        patient = make_claimed_patient()
        appointment = make_appointment(patient=patient)

        response = client_for(patient.user).post(cancel_url(appointment.pk))

        assert response.status_code == 200, response.content
        assert response.data["status"] == Status.CANCELLED
        appointment.refresh_from_db()
        assert appointment.status == Status.CANCELLED

    def test_response_uses_the_patient_payload(self):
        patient = make_claimed_patient()
        appointment = make_appointment(patient=patient, reason="privé guichet")

        response = client_for(patient.user).post(cancel_url(appointment.pk))

        assert "reason" not in response.data
        assert set(response.data.keys()) == {
            "id", "center", "scheduled_at", "duration_minutes", "status",
            "practitioner_display_name",
        }

    @pytest.mark.parametrize(
        "status", [Status.ARRIVED, Status.HONORED, Status.MISSED, Status.CANCELLED]
    )
    def test_only_prevu_is_cancellable_by_the_patient(self, status):
        """Narrower than the staff machine (arrive → annule allowed there):
        once checked in, the flow belongs to the center."""
        patient = make_claimed_patient()
        appointment = make_appointment(patient=patient, status=status)

        response = client_for(patient.user).post(cancel_url(appointment.pk))

        assert response.status_code == 400
        assert "Seul un rendez-vous encore prévu peut être annulé." in str(
            response.data
        )
        appointment.refresh_from_db()
        assert appointment.status == status

    def test_someone_elses_appointment_is_invisible(self):
        mine = make_claimed_patient()
        other = make_claimed_patient(first_name="Anfia", last_name="Soilihi")
        foreign = make_appointment(patient=other)

        response = client_for(mine.user).post(cancel_url(foreign.pk))

        assert response.status_code == 404
        foreign.refresh_from_db()
        assert foreign.status == Status.SCHEDULED

    def test_nonexistent_appointment_404(self):
        patient = make_claimed_patient()
        assert client_for(patient.user).post(cancel_url(999999)).status_code == 404

    def test_anonymous_401_and_staff_hat_403(self):
        center = make_center()
        appointment = make_appointment(
            patient=make_claimed_patient(), center=center
        )
        assert client_for().post(cancel_url(appointment.pk)).status_code == 401
        staff = make_staff_user(center)
        assert client_for(staff).post(cancel_url(appointment.pk)).status_code == 403
