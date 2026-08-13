"""S1 — list filters (C.6) and the appointment range mode.

Contract locked here for every new filter: an INVALID value answers a 400
per field (never a 500 — leçon des revues), a FOREIGN id simply matches
nothing (empty list, no cross-tenant probe — pattern ``?practitioner=``
de scheduling). Plus the disputes BILLING restriction (arbitrage C.3) and
the ``?from=&to=`` appointment range (exclusive with ``?date=``, 62 days
max, local Comoros bounds).
"""

from datetime import datetime, time as dtime, timedelta

import pytest
from django.utils import timezone

from apps.medical.models import Encounter
from apps.trustbridge import services
from apps.trustbridge.models import Invoice

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import (
    make_appointment,
    make_encounter,
    make_patient,
    make_staff,
)
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db


def local_dt(day_offset=0, hour=10, minute=0):
    day = timezone.localdate() + timedelta(days=day_offset)
    return timezone.make_aware(datetime.combine(day, dtime(hour, minute)))


# ---------------------------------------------------------------------------
# Encounters — ?patient= &date= &practitioner=
# ---------------------------------------------------------------------------


class TestEncounterFilters:
    def _scene(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        p1 = make_patient(first_name="Mariama", created_by_center=center)
        p2 = make_patient(first_name="Anfia", created_by_center=center)
        practitioner = make_staff(center=center, role=Role.DOCTOR)
        e1 = make_encounter(
            patient=p1, center=center, practitioner=practitioner,
            occurred_at=local_dt(0, 9),
        )
        e2 = make_encounter(patient=p2, center=center, occurred_at=local_dt(-1, 23, 30))
        return center, staff, p1, p2, practitioner, e1, e2

    def _url(self, center):
        return f"/api/v1/centers/{center.pk}/encounters/"

    def test_patient_filter(self):
        center, staff, p1, _p2, _pr, e1, _e2 = self._scene()
        response = client_for(staff).get(self._url(center), {"patient": p1.pk})
        assert response.status_code == 200
        assert [r["id"] for r in response.data["results"]] == [e1.pk]

    def test_foreign_patient_id_matches_nothing(self):
        center, staff, *_ = self._scene()
        foreign = make_patient()  # never seen by this center
        response = client_for(staff).get(self._url(center), {"patient": foreign.pk})
        assert response.status_code == 200
        assert response.data["results"] == []

    def test_practitioner_filter(self):
        center, staff, _p1, _p2, practitioner, e1, _e2 = self._scene()
        response = client_for(staff).get(
            self._url(center), {"practitioner": practitioner.pk}
        )
        assert [r["id"] for r in response.data["results"]] == [e1.pk]

    def test_date_filter_uses_local_days(self):
        """A 23:30 encounter belongs to ITS local day (ADR 0013 pattern)."""
        center, staff, _p1, _p2, _pr, _e1, e2 = self._scene()
        yesterday = str(timezone.localdate() - timedelta(days=1))
        response = client_for(staff).get(self._url(center), {"date": yesterday})
        assert [r["id"] for r in response.data["results"]] == [e2.pk]

    @pytest.mark.parametrize(
        "params,field",
        [
            ({"patient": "abc"}, "patient"),
            ({"patient": "-1"}, "patient"),
            ({"practitioner": "1;DROP"}, "practitioner"),
            ({"date": "pas-une-date"}, "date"),
            ({"date": "2026-02-30"}, "date"),
            ({"date": "9999-12-31"}, "date"),
        ],
    )
    def test_invalid_values_answer_400_per_field(self, params, field):
        center, staff, *_ = self._scene()
        response = client_for(staff).get(self._url(center), params)
        assert response.status_code == 400, params
        assert field in response.data

    def test_filters_combine(self):
        center, staff, p1, _p2, practitioner, e1, _e2 = self._scene()
        response = client_for(staff).get(
            self._url(center),
            {"patient": p1.pk, "practitioner": practitioner.pk,
             "date": str(timezone.localdate())},
        )
        assert [r["id"] for r in response.data["results"]] == [e1.pk]


# ---------------------------------------------------------------------------
# Invoices — ?patient= &status= ; payment requests — ?status=
# ---------------------------------------------------------------------------


class TestMoneyListFilters:
    def test_invoice_status_and_patient_filters(self):
        scn = build_scenario(status="facture_brouillon")
        issued = build_scenario(status=Status.SENT, center=scn.center,
                                director=scn.director)
        client = client_for(scn.cashier)
        url = f"/api/v1/centers/{scn.center.pk}/invoices/"

        drafts = client.get(url, {"status": Invoice.Status.DRAFT})
        assert [r["id"] for r in drafts.data["results"]] == [scn.invoice.pk]

        by_patient = client.get(url, {"patient": issued.patient.pk})
        assert [r["id"] for r in by_patient.data["results"]] == [issued.invoice.pk]

        assert client.get(url, {"status": "inconnu"}).status_code == 400
        assert client.get(url, {"patient": "abc"}).status_code == 400
        foreign_patient = make_patient()
        empty = client.get(url, {"patient": foreign_patient.pk})
        assert empty.data["results"] == []

    def test_payment_request_status_filter(self):
        scn = build_scenario(status=Status.SENT)
        client = client_for(scn.cashier)
        url = f"/api/v1/centers/{scn.center.pk}/payment-requests/"
        sent = client.get(url, {"status": Status.SENT})
        assert [r["id"] for r in sent.data["results"]] == [scn.payment_request.pk]
        assert client.get(url, {"status": Status.CLOSED}).data["results"] == []
        assert client.get(url, {"status": "n-importe-quoi"}).status_code == 400


# ---------------------------------------------------------------------------
# Disputes — BILLING restriction (arbitrage C.3) + ?status=
# ---------------------------------------------------------------------------


class TestDisputeListRestrictionAndFilter:
    def _scene(self):
        scn = build_scenario(status=Status.SENT)
        services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason="Montant contesté",
        )
        return scn

    def test_billing_roles_read_disputes(self):
        scn = self._scene()
        url = f"/api/v1/centers/{scn.center.pk}/disputes/"
        for user in (scn.cashier, scn.director):
            response = client_for(user).get(url)
            assert response.status_code == 200
            assert len(response.data["results"]) == 1

    def test_clinical_and_pharmacist_roles_get_403(self):
        """Négatif (arbitrage C.3) : le motif libre d'un litige n'a rien à
        faire sous les yeux de tout le staff."""
        scn = self._scene()
        url = f"/api/v1/centers/{scn.center.pk}/disputes/"
        assert client_for(scn.doctor).get(url).status_code == 403
        for role in (Role.NURSE, Role.MIDWIFE, Role.PHARMACIST):
            staff = make_staff_user(scn.center, role=role)
            assert client_for(staff).get(url).status_code == 403, role

    def test_status_filter(self):
        scn = self._scene()
        client = client_for(scn.cashier)
        url = f"/api/v1/centers/{scn.center.pk}/disputes/"
        assert len(client.get(url, {"status": "ouvert"}).data["results"]) == 1
        assert client.get(url, {"status": "resolu"}).data["results"] == []
        assert client.get(url, {"status": "autre"}).status_code == 400


# ---------------------------------------------------------------------------
# Appointments — ?from=&to= range (S1)
# ---------------------------------------------------------------------------


class TestAppointmentRange:
    def _scene(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(created_by_center=center)
        today = make_appointment(
            center=center, patient=patient, scheduled_at=local_dt(0, 10)
        )
        late_tomorrow = make_appointment(
            center=center, patient=patient, scheduled_at=local_dt(1, 23, 30)
        )
        next_week = make_appointment(
            center=center, patient=patient, scheduled_at=local_dt(7, 9)
        )
        return center, staff, today, late_tomorrow, next_week

    def _url(self, center):
        return f"/api/v1/centers/{center.pk}/appointments/"

    def test_range_is_inclusive_on_local_days(self):
        center, staff, today, late_tomorrow, next_week = self._scene()
        d0, d1 = timezone.localdate(), timezone.localdate() + timedelta(days=1)
        response = client_for(staff).get(
            self._url(center), {"from": str(d0), "to": str(d1)}
        )
        assert response.status_code == 200, response.content
        ids = [r["id"] for r in response.data["results"]]
        # 23:30 on the `to` day is INSIDE the range (local bound at +1 day).
        assert ids == [today.pk, late_tomorrow.pk]
        assert next_week.pk not in ids

    def test_range_covers_more_than_one_week(self):
        """The exact contract gap: the calendar grid was stuck on a week."""
        center, staff, today, late_tomorrow, next_week = self._scene()
        d0 = timezone.localdate()
        response = client_for(staff).get(
            self._url(center), {"from": str(d0), "to": str(d0 + timedelta(days=30))}
        )
        ids = [r["id"] for r in response.data["results"]]
        assert next_week.pk in ids

    def test_date_and_range_are_exclusive(self):
        center, staff, *_ = self._scene()
        d0 = str(timezone.localdate())
        response = client_for(staff).get(
            self._url(center), {"date": d0, "from": d0, "to": d0}
        )
        assert response.status_code == 400
        assert "date" in response.data

    def test_both_bounds_are_required_together(self):
        center, staff, *_ = self._scene()
        d0 = str(timezone.localdate())
        missing_to = client_for(staff).get(self._url(center), {"from": d0})
        assert missing_to.status_code == 400
        assert "to" in missing_to.data
        missing_from = client_for(staff).get(self._url(center), {"to": d0})
        assert missing_from.status_code == 400
        assert "from" in missing_from.data

    def test_range_refusals(self):
        center, staff, *_ = self._scene()
        d0 = timezone.localdate()
        client = client_for(staff)
        url = self._url(center)
        too_long = client.get(
            url, {"from": str(d0), "to": str(d0 + timedelta(days=62))}
        )  # 63 inclusive days
        assert too_long.status_code == 400
        assert "62 jours" in str(too_long.data)
        inverted = client.get(
            url, {"from": str(d0), "to": str(d0 - timedelta(days=1))}
        )
        assert inverted.status_code == 400
        malformed = client.get(url, {"from": "pas-une-date", "to": str(d0)})
        assert malformed.status_code == 400
        impossible = client.get(url, {"from": "2026-02-30", "to": str(d0)})
        assert impossible.status_code == 400
        out_of_calendar = client.get(
            url, {"from": "9999-12-01", "to": "9999-12-31"}
        )
        assert out_of_calendar.status_code == 400

    def test_sixty_two_days_exactly_is_accepted(self):
        center, staff, *_ = self._scene()
        d0 = timezone.localdate()
        response = client_for(staff).get(
            self._url(center),
            {"from": str(d0), "to": str(d0 + timedelta(days=61))},
        )
        assert response.status_code == 200

    def test_day_mode_is_untouched(self):
        center, staff, today, *_ = self._scene()
        response = client_for(staff).get(
            self._url(center), {"date": str(timezone.localdate())}
        )
        assert [r["id"] for r in response.data["results"]] == [today.pk]

    def test_range_stays_center_scoped(self):
        center, staff, *_ = self._scene()
        foreign = make_appointment(scheduled_at=local_dt(0, 11))  # other center
        d0 = str(timezone.localdate())
        response = client_for(staff).get(
            self._url(center), {"from": d0, "to": d0}
        )
        assert foreign.pk not in [r["id"] for r in response.data["results"]]
