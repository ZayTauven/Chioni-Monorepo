"""Pilotage du centre (vague 2b) — stats d'activité, finances, impayés.

Read-only endpoints serving the REAL data of the center dashboard
(étude §5.1 : « Tableaux de bord du centre (activité, recettes, impayés) »).

Locked here:
- exactness of the aggregates on a constructed data set (multi-status
  appointments, counter instalments + reversal + diaspora payment,
  partially settled invoices);
- Comoros local-day bounds (an 00:30 local event stays on ITS local day —
  the discriminating case for UTC+3 — and 23:30 too);
- period window: default 30 days, max 366, malformed/impossible dates and
  out-of-calendar bounds → 400 per field;
- permissions per hat (ADR 0008): activity = any active staff; finances +
  unpaid = BILLING only (doctor → 403); anonymous → 401; foreign center →
  404; tenant isolation of every aggregate;
- the SQL balance annotation agrees with ``invoice_balance_kmf`` row by
  row;
- no N+1: exact query counts asserted on each endpoint;
- empty center → clean zero-filled series, no division by zero.
"""

from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.utils import timezone

from apps.scheduling.models import Appointment
from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, Invoice

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import (
    make_appointment,
    make_encounter,
    make_invoice,
    make_patient,
    make_staff,
)
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

Method = CashPayment.Method
AppStatus = Appointment.Status

DAY_KEYS_ACTIVITY = {"date", "appointments", "encounters", "new_patients"}
DAY_KEYS_FINANCES = {
    "date", "especes_kmf", "mobile_money_kmf", "pont_confiance_kmf", "total_kmf",
}
UNPAID_ITEM_FIELDS = {
    "id", "patient", "patient_name", "patient_phone_masked",
    "total_kmf", "paid_kmf", "balance_kmf", "age_days", "created_at",
}


def activity_url(center, **params):
    url = f"/api/v1/centers/{center.pk}/stats/activity/"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return url


def finances_url(center, **params):
    url = f"/api/v1/centers/{center.pk}/stats/finances/"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return url


def unpaid_url(center, **params):
    url = f"/api/v1/centers/{center.pk}/invoices/unpaid/"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    return url


def local_dt(day, hour, minute=0):
    return timezone.make_aware(datetime.combine(day, time(hour, minute)))


def day_row(data, day):
    return next(row for row in data["days"] if row["date"] == str(day))


# ---------------------------------------------------------------------------
# Period parsing (shared by both stats endpoints — probed through activity)
# ---------------------------------------------------------------------------


class TestPeriodWindow:
    def test_default_window_is_the_last_30_local_days(self):
        center, director = make_center_with_director()
        response = client_for(director).get(activity_url(center))
        assert response.status_code == 200
        today = timezone.localdate()
        assert response.data["from"] == str(today - timedelta(days=29))
        assert response.data["to"] == str(today)
        assert len(response.data["days"]) == 30

    def test_explicit_window_is_inclusive_of_both_days(self):
        center, director = make_center_with_director()
        today = timezone.localdate()
        response = client_for(director).get(
            activity_url(center, **{"from": today - timedelta(days=5), "to": today})
        )
        assert response.status_code == 200
        assert len(response.data["days"]) == 6
        assert response.data["days"][0]["date"] == str(today - timedelta(days=5))
        assert response.data["days"][-1]["date"] == str(today)

    def test_from_alone_extends_to_today(self):
        center, director = make_center_with_director()
        today = timezone.localdate()
        response = client_for(director).get(
            activity_url(center, **{"from": today - timedelta(days=2)})
        )
        assert response.status_code == 200
        assert response.data["to"] == str(today)
        assert len(response.data["days"]) == 3

    def test_malformed_date_is_400_per_field(self):
        center, director = make_center_with_director()
        response = client_for(director).get(
            activity_url(center, **{"from": "pas-une-date"})
        )
        assert response.status_code == 400
        assert "from" in response.data

    def test_well_formed_impossible_date_is_the_same_400(self):
        center, director = make_center_with_director()
        response = client_for(director).get(
            activity_url(center, **{"to": "2026-02-30"})
        )
        assert response.status_code == 400
        assert "to" in response.data

    def test_from_after_to_is_400(self):
        center, director = make_center_with_director()
        today = timezone.localdate()
        response = client_for(director).get(
            activity_url(center, **{"from": today, "to": today - timedelta(days=1)})
        )
        assert response.status_code == 400
        assert "from" in response.data

    def test_366_days_pass_and_367_are_refused(self):
        center, director = make_center_with_director()
        today = timezone.localdate()
        ok = client_for(director).get(
            activity_url(center, **{"from": today - timedelta(days=365)})
        )
        assert ok.status_code == 200
        assert len(ok.data["days"]) == 366
        too_long = client_for(director).get(
            activity_url(center, **{"from": today - timedelta(days=366)})
        )
        assert too_long.status_code == 400
        assert "trop longue" in str(too_long.data["from"])

    def test_out_of_calendar_bounds_are_400_not_500(self):
        center, director = make_center_with_director()
        response = client_for(director).get(
            activity_url(center, **{"from": "9999-12-30", "to": "9999-12-31"})
        )
        assert response.status_code == 400
        assert "to" in response.data
        # Default from = to - 29 days near the calendar floor.
        response = client_for(director).get(
            activity_url(center, **{"to": "0001-01-05"})
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /centers/{c}/stats/activity/
# ---------------------------------------------------------------------------


def activity_scenario():
    """A center with a constructed day of activity (all rows today)."""
    center, director = make_center_with_director()
    m_doc = make_staff(center=center, role=Role.DOCTOR)
    m_doc.user.first_name, m_doc.user.last_name = "Nasser", "Ben Ali"
    m_doc.user.save(update_fields=["first_name", "last_name"])
    m_midwife = make_staff(center=center, role=Role.MIDWIFE)
    today = timezone.localdate()
    at = local_dt(today, 10)
    for status, count in (
        (AppStatus.HONORED, 2), (AppStatus.MISSED, 1), (AppStatus.SCHEDULED, 1),
        (AppStatus.CANCELLED, 1), (AppStatus.ARRIVED, 1),
    ):
        for _ in range(count):
            make_appointment(center=center, scheduled_at=at, status=status)
    make_encounter(center=center, practitioner=m_doc)
    make_encounter(center=center, practitioner=m_doc)
    make_encounter(center=center, practitioner=m_midwife)
    make_patient(created_by_center=center)
    make_patient(created_by_center=center)
    return center, director, m_doc, m_midwife, today


class TestActivityStats:
    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert client_for().get(activity_url(center)).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        center, _ = make_center_with_director()
        other, _ = make_center_with_director()
        outsider = make_staff_user(other, role=Role.DIRECTOR)
        assert client_for(outsider).get(activity_url(center)).status_code == 404

    def test_every_active_role_of_the_center_may_read(self):
        center, director = make_center_with_director()
        for role in (Role.NURSE, Role.DOCTOR, Role.SECRETARY, Role.CASHIER):
            user = make_staff_user(center, role=role)
            assert client_for(user).get(activity_url(center)).status_code == 200
        assert client_for(director).get(activity_url(center)).status_code == 200

    def test_daily_series_and_totals_are_exact(self):
        center, director, m_doc, m_midwife, today = activity_scenario()
        response = client_for(director).get(activity_url(center))
        assert response.status_code == 200
        data = response.data
        row = day_row(data, today)
        assert set(row.keys()) == DAY_KEYS_ACTIVITY
        assert row["appointments"] == {
            "prevu": 1, "arrive": 1, "honore": 2, "manque": 1, "annule": 1,
        }
        assert row["encounters"] == 3
        assert row["new_patients"] == 2
        # A day without activity is present, zero-filled.
        empty = day_row(data, today - timedelta(days=3))
        assert empty["appointments"] == {
            "prevu": 0, "arrive": 0, "honore": 0, "manque": 0, "annule": 0,
        }
        assert empty["encounters"] == 0 and empty["new_patients"] == 0
        totals = data["totals"]
        assert totals["appointments"] == {
            "prevu": 1, "arrive": 1, "honore": 2, "manque": 1, "annule": 1,
            "total": 6,
        }
        assert totals["encounters"] == 3
        assert totals["new_patients"] == 2
        # honorés / (honorés + manqués) = 2/3 → 66.7 %
        assert totals["attendance_rate_pct"] == "66.7"

    def test_practitioner_breakdown_names_and_order(self):
        center, director, m_doc, m_midwife, _ = activity_scenario()
        response = client_for(director).get(activity_url(center))
        breakdown = response.data["encounters_by_practitioner"]
        assert [b["practitioner"] for b in breakdown] == [m_doc.pk, m_midwife.pk]
        assert breakdown[0] == {
            "practitioner": m_doc.pk,
            "practitioner_name": "Nasser Ben Ali",
            "role": "medecin",
            "encounters": 2,
        }
        # No name on the membership's user → username fallback, never blank.
        assert breakdown[1]["practitioner_name"] == m_midwife.user.username
        assert breakdown[1]["encounters"] == 1

    def test_out_of_window_and_foreign_rows_are_excluded(self):
        center, director, *_ = activity_scenario()
        today = timezone.localdate()
        # Outside the 30-day default window.
        make_appointment(
            center=center,
            scheduled_at=local_dt(today - timedelta(days=40), 9),
            status=AppStatus.HONORED,
        )
        # Another tenant's activity.
        other, _ = make_center_with_director()
        make_appointment(center=other, scheduled_at=local_dt(today, 9),
                         status=AppStatus.HONORED)
        make_encounter(center=other)
        make_patient(created_by_center=other)
        # An absorbed duplicate registered at OUR desk.
        duplicate = make_patient(created_by_center=center)
        duplicate.merged_into = make_patient()
        duplicate.save()
        response = client_for(director).get(activity_url(center))
        totals = response.data["totals"]
        assert totals["appointments"]["honore"] == 2
        assert totals["encounters"] == 3
        assert totals["new_patients"] == 2

    def test_local_midnight_side_events_stay_on_their_comoros_day(self):
        # 00:30 local = 21:30 UTC the PREVIOUS day — the discriminating
        # case for UTC+3. 23:30 local stays same-day even in UTC; both are
        # asserted on their LOCAL day.
        center, director = make_center_with_director()
        day = timezone.localdate() - timedelta(days=2)
        make_appointment(center=center, scheduled_at=local_dt(day, 0, 30),
                         status=AppStatus.HONORED)
        make_appointment(center=center, scheduled_at=local_dt(day, 23, 30),
                         status=AppStatus.MISSED)
        on_day = client_for(director).get(
            activity_url(center, **{"from": day, "to": day})
        )
        row = day_row(on_day.data, day)
        assert row["appointments"]["honore"] == 1
        assert row["appointments"]["manque"] == 1
        day_before = client_for(director).get(
            activity_url(
                center,
                **{"from": day - timedelta(days=1), "to": day - timedelta(days=1)},
            )
        )
        before = day_row(day_before.data, day - timedelta(days=1))
        assert before["appointments"] == {
            "prevu": 0, "arrive": 0, "honore": 0, "manque": 0, "annule": 0,
        }

    def test_empty_center_is_clean_zeros(self):
        center, director = make_center_with_director()
        response = client_for(director).get(activity_url(center))
        assert response.status_code == 200
        assert len(response.data["days"]) == 30
        totals = response.data["totals"]
        assert totals["appointments"]["total"] == 0
        assert totals["attendance_rate_pct"] is None
        assert response.data["encounters_by_practitioner"] == []

    def test_query_count_is_flat(self, django_assert_num_queries):
        center, director, *_ = activity_scenario()
        client = client_for(director)
        # 1 center resolution + 1 membership check + 1 subscription-freeze
        # guard (S5, ADR 0018 — une lecture indexée par pk) + 4 grouped
        # aggregates — NEVER a query per appointment/encounter/patient row.
        with django_assert_num_queries(7):
            response = client.get(activity_url(center))
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /centers/{c}/stats/finances/
# ---------------------------------------------------------------------------


def finance_scenario():
    """One center, both rails: a diaspora-paid invoice (15 000 KMF) and a
    counter invoice (20 000 KMF) with instalments — 5 000 espèces + 3 000
    mobile money + a 2 000 espèces instalment REVERSED."""
    center, director = make_center_with_director()
    diaspora = build_scenario(status=Status.PAID, center=center,
                              director=director, price_kmf="15000")
    counter = build_scenario(status="facture_brouillon", center=center,
                             director=director, price_kmf="20000")
    services.issue_invoice(actor=counter.cashier, invoice=counter.invoice)
    counter.invoice.refresh_from_db()
    services.record_cash_payment(
        actor=counter.cashier, center=center, invoice=counter.invoice,
        method=Method.CASH, amount_kmf=Decimal("5000"),
    )
    services.record_cash_payment(
        actor=counter.cashier, center=center, invoice=counter.invoice,
        method=Method.MOBILE_MONEY, amount_kmf=Decimal("3000"), operator="huri",
    )
    reversed_payment = services.record_cash_payment(
        actor=counter.cashier, center=center, invoice=counter.invoice,
        method=Method.CASH, amount_kmf=Decimal("2000"),
    )
    services.reverse_cash_payment(
        actor=counter.cashier, cash_payment=reversed_payment,
        reason="Erreur de saisie au guichet",
    )
    return center, director, diaspora, counter


class TestFinanceStats:
    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert client_for().get(finances_url(center)).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        center, _ = make_center_with_director()
        other, _ = make_center_with_director()
        outsider = make_staff_user(other, role=Role.CASHIER)
        assert client_for(outsider).get(finances_url(center)).status_code == 404

    def test_clinical_roles_get_403(self):
        # Money is an operations view (ADR 0015): the doctor and the nurse
        # never read the till — mirror of the R-API-1 clinical segmentation.
        center, _ = make_center_with_director()
        for role in (Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST):
            user = make_staff_user(center, role=role)
            assert client_for(user).get(finances_url(center)).status_code == 403

    def test_billing_roles_may_read(self):
        center, director = make_center_with_director()
        assert client_for(director).get(finances_url(center)).status_code == 200
        for role in (Role.SECRETARY, Role.CASHIER):
            user = make_staff_user(center, role=role)
            assert client_for(user).get(finances_url(center)).status_code == 200

    def test_revenue_series_totals_and_dedicated_reversal_field(self):
        center, director, diaspora, counter = finance_scenario()
        response = client_for(director).get(finances_url(center))
        assert response.status_code == 200
        data = response.data
        today = timezone.localdate()
        row = day_row(data, today)
        assert set(row.keys()) == DAY_KEYS_FINANCES
        # The reversed 2 000 instalment is OUT of the series (non-reversed
        # payments only) and shows up in the dedicated field instead —
        # never silently subtracted.
        assert Decimal(row["especes_kmf"]) == Decimal("5000")
        assert Decimal(row["mobile_money_kmf"]) == Decimal("3000")
        assert Decimal(row["pont_confiance_kmf"]) == Decimal("15000")
        assert Decimal(row["total_kmf"]) == Decimal("23000")
        totals = data["totals"]
        assert Decimal(totals["especes_kmf"]) == Decimal("5000")
        assert Decimal(totals["mobile_money_kmf"]) == Decimal("3000")
        assert Decimal(totals["pont_confiance_kmf"]) == Decimal("15000")
        assert Decimal(totals["total_kmf"]) == Decimal("23000")
        assert data["reversals"]["count"] == 1
        assert Decimal(data["reversals"]["total_kmf"]) == Decimal("2000")

    def test_billed_vs_collected_and_unpaid_snapshot(self):
        center, director, diaspora, counter = finance_scenario()
        data = client_for(director).get(finances_url(center)).data
        # Facturé : the two issued invoices (one now payee) — 35 000.
        assert data["invoiced"]["count"] == 2
        assert Decimal(data["invoiced"]["total_kmf"]) == Decimal("35000")
        # Encaissé : 23 000 — l'écart est l'info de pilotage n° 1.
        assert Decimal(data["collected_kmf"]) == Decimal("23000")
        # Impayés : the counter invoice still owes 20 000 − 8 000 = 12 000.
        assert data["unpaid"]["count"] == 1
        assert Decimal(data["unpaid"]["total_kmf"]) == Decimal("12000")

    def test_unpaid_is_a_snapshot_not_bound_to_the_period(self):
        center, director, *_ = finance_scenario()
        far = timezone.localdate() - timedelta(days=10)
        data = client_for(director).get(
            finances_url(center, **{"from": far, "to": far})
        ).data
        # Empty revenue window…
        assert Decimal(data["totals"]["total_kmf"]) == Decimal("0")
        assert data["invoiced"]["count"] == 0
        # …but the unpaid photo is taken at request time.
        assert data["unpaid"]["count"] == 1
        assert Decimal(data["unpaid"]["total_kmf"]) == Decimal("12000")

    def test_revenue_is_tenant_scoped(self):
        center, director, *_ = finance_scenario()
        other_center, other_director, *_ = finance_scenario()
        data = client_for(other_director).get(finances_url(other_center)).data
        # The other center only ever sees ITS 23 000 — not 46 000.
        assert Decimal(data["totals"]["total_kmf"]) == Decimal("23000")
        assert data["unpaid"]["count"] == 1

    def test_late_local_evening_payment_counts_on_its_comoros_day(self):
        # A payment recorded at 00:30 local (21:30 UTC the previous day —
        # the discriminating case for UTC+3): it must land on ITS local day.
        center, director = make_center_with_director()
        scn = build_scenario(status="facture_brouillon", center=center,
                             director=director, price_kmf="20000")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        scn.invoice.refresh_from_db()
        day = timezone.localdate() - timedelta(days=2)
        with mock.patch(
            "django.utils.timezone.now", return_value=local_dt(day, 0, 30)
        ):
            services.record_cash_payment(
                actor=scn.cashier, center=center, invoice=scn.invoice,
                method=Method.CASH, amount_kmf=Decimal("5000"),
            )
        on_day = client_for(director).get(
            finances_url(center, **{"from": day, "to": day})
        ).data
        assert Decimal(day_row(on_day, day)["especes_kmf"]) == Decimal("5000")
        day_before = day - timedelta(days=1)
        before = client_for(director).get(
            finances_url(center, **{"from": day_before, "to": day_before})
        ).data
        assert Decimal(day_row(before, day_before)["especes_kmf"]) == Decimal("0")

    def test_empty_center_is_clean_zeros(self):
        center, director = make_center_with_director()
        data = client_for(director).get(finances_url(center)).data
        assert len(data["days"]) == 30
        assert Decimal(data["totals"]["total_kmf"]) == Decimal("0")
        assert data["reversals"] == {"count": 0, "total_kmf": "0"}
        assert data["invoiced"] == {"count": 0, "total_kmf": "0"}
        assert data["unpaid"] == {"count": 0, "total_kmf": "0"}

    def test_query_count_is_flat(self, django_assert_num_queries):
        center, director, *_ = finance_scenario()
        client = client_for(director)
        # 1 center + 1 membership + 1 garde de gel (S5, ADR 0018) +
        # revenue/reversals/invoiced/unpaid = 7 — never a query per payment
        # or invoice row.
        with django_assert_num_queries(7):
            response = client.get(finances_url(center))
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /centers/{c}/invoices/unpaid/
# ---------------------------------------------------------------------------


def unpaid_scenario():
    """Four invoices at 7 500 KMF each in one center: unpaid, partially
    paid (2 500), fully paid, plus a draft — only the first two must
    surface."""
    center, director = make_center_with_director()
    cashier = make_staff_user(center, role=Role.CASHIER)
    patient_a = make_patient(first_name="Fatima", last_name="Soilihi",
                             phone="+33612345678")
    patient_b = make_patient(first_name="Ali", last_name="Mzé", phone="")
    inv_unpaid = make_invoice(
        encounter=make_encounter(center=center, patient=patient_a)
    )
    inv_partial = make_invoice(
        encounter=make_encounter(center=center, patient=patient_b)
    )
    services.record_cash_payment(
        actor=cashier, center=center, invoice=inv_partial,
        method=Method.CASH, amount_kmf=Decimal("2500"),
    )
    inv_paid = make_invoice(encounter=make_encounter(center=center))
    services.record_cash_payment(
        actor=cashier, center=center, invoice=inv_paid,
        method=Method.CASH, amount_kmf=Decimal("7500"),
    )
    make_invoice(encounter=make_encounter(center=center),
                 status=Invoice.Status.DRAFT)
    return center, director, cashier, inv_unpaid, inv_partial, inv_paid


class TestUnpaidInvoiceList:
    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert client_for().get(unpaid_url(center)).status_code == 401

    def test_foreign_center_staff_gets_404(self):
        center, _ = make_center_with_director()
        other, _ = make_center_with_director()
        outsider = make_staff_user(other, role=Role.CASHIER)
        assert client_for(outsider).get(unpaid_url(center)).status_code == 404

    def test_doctor_gets_403(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        assert client_for(doctor).get(unpaid_url(center)).status_code == 403

    def test_only_issued_invoices_with_a_positive_balance_surface(self):
        center, director, cashier, inv_unpaid, inv_partial, inv_paid = (
            unpaid_scenario()
        )
        response = client_for(cashier).get(unpaid_url(center))
        assert response.status_code == 200
        results = response.data["results"]
        assert {r["id"] for r in results} == {inv_unpaid.pk, inv_partial.pk}
        by_id = {r["id"]: r for r in results}
        row = by_id[inv_partial.pk]
        assert set(row.keys()) == UNPAID_ITEM_FIELDS
        assert Decimal(row["total_kmf"]) == Decimal("7500")
        assert Decimal(row["paid_kmf"]) == Decimal("2500")
        assert Decimal(row["balance_kmf"]) == Decimal("5000")
        assert row["age_days"] == 0
        full = by_id[inv_unpaid.pk]
        assert Decimal(full["paid_kmf"]) == Decimal("0")
        assert Decimal(full["balance_kmf"]) == Decimal("7500")

    def test_sql_balance_agrees_with_invoice_balance_kmf(self):
        # The annotation of unpaid_invoices_qs is the set-based MIRROR of
        # the per-row derivation (ADR 0015) — locked row by row.
        center, director, cashier, *_ = unpaid_scenario()
        results = client_for(cashier).get(unpaid_url(center)).data["results"]
        assert results
        for row in results:
            invoice = Invoice.objects.get(pk=row["id"])
            assert Decimal(row["balance_kmf"]) == services.invoice_balance_kmf(
                invoice
            )
            assert Decimal(row["paid_kmf"]) == services.invoice_paid_kmf(invoice)

    def test_patient_identity_is_named_but_phone_is_masked(self):
        center, director, cashier, inv_unpaid, inv_partial, _ = unpaid_scenario()
        results = client_for(cashier).get(unpaid_url(center)).data["results"]
        by_id = {r["id"]: r for r in results}
        assert by_id[inv_unpaid.pk]["patient_name"] == "Fatima Soilihi"
        assert by_id[inv_unpaid.pk]["patient_phone_masked"] == "+336••••••78"
        assert "+33612345678" not in str(results)  # never harvestable
        assert by_id[inv_partial.pk]["patient_phone_masked"] == ""

    def test_default_ordering_is_biggest_balance_first(self):
        center, director, cashier, inv_unpaid, inv_partial, _ = unpaid_scenario()
        results = client_for(cashier).get(unpaid_url(center)).data["results"]
        assert [r["id"] for r in results] == [inv_unpaid.pk, inv_partial.pk]
        ascending = client_for(cashier).get(
            unpaid_url(center, ordering="balance")
        ).data["results"]
        assert [r["id"] for r in ascending] == [inv_partial.pk, inv_unpaid.pk]

    def test_age_ordering_and_invalid_ordering(self):
        center, director, cashier, inv_unpaid, inv_partial, _ = unpaid_scenario()
        oldest_first = client_for(cashier).get(
            unpaid_url(center, ordering="-age")
        ).data["results"]
        assert [r["id"] for r in oldest_first] == [inv_unpaid.pk, inv_partial.pk]
        newest_first = client_for(cashier).get(
            unpaid_url(center, ordering="age")
        ).data["results"]
        assert [r["id"] for r in newest_first] == [inv_partial.pk, inv_unpaid.pk]
        bad = client_for(cashier).get(unpaid_url(center, ordering="totale"))
        assert bad.status_code == 400
        assert "ordering" in bad.data

    def test_reversed_payment_puts_the_invoice_back_on_the_list(self):
        center, director, cashier, inv_unpaid, inv_partial, inv_paid = (
            unpaid_scenario()
        )
        payment = inv_paid.cash_payments.get()
        services.reverse_cash_payment(
            actor=cashier, cash_payment=payment, reason="Billet refusé"
        )
        results = client_for(cashier).get(unpaid_url(center)).data["results"]
        by_id = {r["id"]: r for r in results}
        assert inv_paid.pk in by_id
        assert Decimal(by_id[inv_paid.pk]["balance_kmf"]) == Decimal("7500")

    def test_list_is_tenant_scoped(self):
        center, director, cashier, inv_unpaid, *_ = unpaid_scenario()
        other_center, _, other_cashier, other_unpaid, *_ = unpaid_scenario()
        results = client_for(other_cashier).get(
            unpaid_url(other_center)
        ).data["results"]
        ids = {r["id"] for r in results}
        assert other_unpaid.pk in ids
        assert inv_unpaid.pk not in ids

    def test_query_count_is_flat(self, django_assert_num_queries):
        center, director, cashier, *_ = unpaid_scenario()
        client = client_for(cashier)
        # 1 center + 1 membership + 1 pagination count + 1 page of rows —
        # balances ride the annotations, never one query per invoice.
        with django_assert_num_queries(4):
            response = client.get(unpaid_url(center))
        assert response.status_code == 200
