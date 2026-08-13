"""Center piloting stats — READ-ONLY aggregates (« gâter les centres », 2b).

Étude §5.1 : « Tableaux de bord du centre (activité, recettes, impayés) ».
Two endpoints, ONE hat each (ADR 0008):

- ``GET /centers/{c}/stats/activity/`` — ANY active staff of the center
  (the nurse reads the queue trend, the doctor their own activity):
  appointments by status, encounters, new desk registrations, encounters
  per practitioner. NO money in this payload.
- ``GET /centers/{c}/stats/finances/`` — BILLING roles only (directeur,
  secrétaire, caissier — ADR 0015 §7, same hat as the cash journal):
  revenue is an operations view; the doctor has no business reading the
  till. Mirror of the R-API-1 clinical segmentation, applied to money.

Period: ``?from=&to=``, INCLUSIVE local Comoros days (bounds computed in
``TIME_ZONE`` — pattern ADR 0013, reused WITHOUT touching apps.scheduling:
a 23:30 or 00:30 event stays on its local day). Default: the last 30 days;
maximum 366 days; malformed AND well-formed-impossible dates answer the
same 400 per field (leçon de la revue vague 1).

Read-only discipline: no model, no write, no AuditLog (reads are not in
the sensitive-action list). ALL aggregation happens in SQL
(annotate/aggregate) — the only Python loops run over GROUPED rows and
over the DAYS of the period (zero-filling ≤ 366 iterations), never over
individual data rows. Empty center → clean zero-filled series, no division
by zero (``attendance_rate_pct`` is null when nothing is measurable).
"""

from datetime import datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter
from apps.medical.models import Encounter
from apps.patients.models import PatientProfile
from apps.scheduling.models import Appointment
from apps.trustbridge.models import CashPayment, CashPaymentReversal, Invoice
from apps.common.roles import BILLING_ROLES
from apps.trustbridge.services import unpaid_invoices_qs

#: Longest inclusive period served (a leap year).
MAX_PERIOD_DAYS = 366
#: Default window when ``from``/``to`` are omitted.
DEFAULT_PERIOD_DAYS = 30

_ZERO = Decimal("0")


def _parse_day(raw, field):
    """One query-param day or a 400 — ``parse_date`` returns None on a
    malformed string but RAISES ValueError on a well-formed impossible
    date (« 2026-02-30 »): both are the caller's typo, both answer the
    same 400 (exact refusal semantics of the day queue / cash journal)."""
    try:
        day = parse_date(raw)
    except ValueError:
        day = None
    if day is None:
        raise DrfValidationError({field: ["Format attendu : AAAA-MM-JJ."]})
    return day


def parse_period(request):
    """``(from_day, to_day, start, end)`` — inclusive local-day period.

    ``start``/``end`` are aware datetimes in ``TIME_ZONE`` (Indian/Comoro)
    covering ``[from_day 00:00, to_day + 1 day 00:00)`` — the ADR 0013
    local-bounds pattern. Defaults: ``to`` = today (local), ``from`` =
    ``to`` − 29 days (30 inclusive days). Refusals (400 per field):
    invalid dates, ``from`` after ``to``, span over 366 days, dates the
    calendar cannot bound (« 9999-12-31 »).
    """
    raw_from = request.query_params.get("from")
    raw_to = request.query_params.get("to")
    to_day = _parse_day(raw_to, "to") if raw_to else timezone.localdate()
    if raw_from:
        from_day = _parse_day(raw_from, "from")
    else:
        try:
            from_day = to_day - timedelta(days=DEFAULT_PERIOD_DAYS - 1)
        except OverflowError:
            raise DrfValidationError({"to": ["Date hors limites."]})
    if from_day > to_day:
        raise DrfValidationError(
            {"from": ["La date de début doit précéder la date de fin."]}
        )
    if (to_day - from_day).days + 1 > MAX_PERIOD_DAYS:
        raise DrfValidationError(
            {"from": [f"Période trop longue : {MAX_PERIOD_DAYS} jours maximum."]}
        )
    try:
        start = timezone.make_aware(datetime.combine(from_day, time.min))
        end = timezone.make_aware(datetime.combine(to_day, time.min)) + timedelta(
            days=1
        )
    except OverflowError:
        raise DrfValidationError({"to": ["Date hors limites."]})
    return from_day, to_day, start, end


def _iter_days(from_day, to_day):
    day = from_day
    while day <= to_day:
        yield day
        day += timedelta(days=1)


class CenterActivityStatsView(CenterScopedViewMixin, APIView):
    """GET /centers/{c}/stats/activity/?from=&to= — l'activité du centre.

    Any active staff (the day queue is already visible to every hat —
    ADR 0013): daily series of appointments per status, encounters (by
    ``occurred_at``, the consultation's own date), new patients registered
    at this center's desk (porte C); period totals; the simple attendance
    rate honorés / (honorés + manqués) — the first brick of the « taux
    d'affluence » of the study; encounters per practitioner (the center's
    own staff directory — no cross-tenant leak possible: the queryset is
    center-scoped).
    """

    permission_classes = [IsStaffOfCenter()]

    @extend_schema(responses=None)
    def get(self, request, *args, **kwargs):
        from_day, to_day, start, end = parse_period(request)
        tz = timezone.get_current_timezone()  # Indian/Comoro (settings)

        # One grouped query each — .order_by() clears Meta.ordering so the
        # GROUP BY stays exactly (day[, status]).
        appointment_rows = (
            Appointment.objects.for_center(self.center)
            .filter(scheduled_at__gte=start, scheduled_at__lt=end)
            .order_by()
            .annotate(day=TruncDate("scheduled_at", tzinfo=tz))
            .values("day", "status")
            .annotate(n=Count("id"))
        )
        encounter_rows = (
            Encounter.objects.for_center(self.center)
            .filter(occurred_at__gte=start, occurred_at__lt=end)
            .order_by()
            .annotate(day=TruncDate("occurred_at", tzinfo=tz))
            .values("day")
            .annotate(n=Count("id"))
        )
        new_patient_rows = (
            PatientProfile.objects.filter(
                created_by_center=self.center,
                merged_into__isnull=True,  # absorbed duplicates never count
                created_at__gte=start,
                created_at__lt=end,
            )
            .order_by()
            .annotate(day=TruncDate("created_at", tzinfo=tz))
            .values("day")
            .annotate(n=Count("id"))
        )
        practitioner_rows = (
            Encounter.objects.for_center(self.center)
            .filter(occurred_at__gte=start, occurred_at__lt=end)
            .values(
                "practitioner_id",
                "practitioner__role",
                "practitioner__user__first_name",
                "practitioner__user__last_name",
                "practitioner__user__username",
            )
            .annotate(n=Count("id"))
            .order_by("-n", "practitioner_id")
        )

        appointments_by_day = {}
        for row in appointment_rows:  # grouped rows: ≤ 5 statuses × days
            appointments_by_day.setdefault(row["day"], {})[row["status"]] = row["n"]
        encounters_by_day = {row["day"]: row["n"] for row in encounter_rows}
        patients_by_day = {row["day"]: row["n"] for row in new_patient_rows}

        statuses = list(Appointment.Status.values)
        appointment_totals = dict.fromkeys(statuses, 0)
        days = []
        total_encounters = total_new_patients = 0
        for day in _iter_days(from_day, to_day):
            day_statuses = appointments_by_day.get(day, {})
            per_status = {s: day_statuses.get(s, 0) for s in statuses}
            for s in statuses:
                appointment_totals[s] += per_status[s]
            n_encounters = encounters_by_day.get(day, 0)
            n_patients = patients_by_day.get(day, 0)
            total_encounters += n_encounters
            total_new_patients += n_patients
            days.append(
                {
                    "date": str(day),
                    "appointments": per_status,
                    "encounters": n_encounters,
                    "new_patients": n_patients,
                }
            )

        honored = appointment_totals[Appointment.Status.HONORED]
        missed = appointment_totals[Appointment.Status.MISSED]
        attendance_rate_pct = None
        if honored + missed:
            attendance_rate_pct = str(
                (Decimal(honored) * 100 / Decimal(honored + missed)).quantize(
                    Decimal("0.1"), rounding=ROUND_HALF_UP
                )
            )

        by_practitioner = [
            {
                "practitioner": row["practitioner_id"],
                "practitioner_name": (
                    f"{row['practitioner__user__first_name']} "
                    f"{row['practitioner__user__last_name']}"
                ).strip()
                or row["practitioner__user__username"],
                "role": row["practitioner__role"],
                "encounters": row["n"],
            }
            for row in practitioner_rows
        ]

        return Response(
            {
                "from": str(from_day),
                "to": str(to_day),
                "days": days,
                "totals": {
                    "appointments": {
                        **appointment_totals,
                        "total": sum(appointment_totals.values()),
                    },
                    "encounters": total_encounters,
                    "new_patients": total_new_patients,
                    "attendance_rate_pct": attendance_rate_pct,
                },
                "encounters_by_practitioner": by_practitioner,
            }
        )


class CenterFinanceStatsView(CenterScopedViewMixin, APIView):
    """GET /centers/{c}/stats/finances/?from=&to= — le pilotage financier.

    BILLING roles only. Daily revenue per method from the NON-reversed
    ``CashPayment`` rows (KMF — the caisse truth of ADR 0015, all rails:
    espèces, mobile money, Pont de Confiance). Reversals MADE in the
    period appear in a dedicated field, NEVER silently subtracted from the
    series. « Facturé vs encaissé » — l'information de pilotage n° 1 du
    Dr Saïd : invoices issued (status ``emise``/``payee``, taken on
    ``created_at`` — no issuance timestamp exists on the model, decision
    logged in ADR 0015 addendum) against the period's collected total.
    ``unpaid`` is a PHOTO at request time (not a series): issued invoices
    with a positive balance, derived by ``unpaid_invoices_qs``.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(responses=None)
    def get(self, request, *args, **kwargs):
        from_day, to_day, start, end = parse_period(request)
        tz = timezone.get_current_timezone()

        revenue_rows = (
            CashPayment.objects.filter(
                center=self.center,
                reversal__isnull=True,
                created_at__gte=start,
                created_at__lt=end,
            )
            .order_by()
            .annotate(day=TruncDate("created_at", tzinfo=tz))
            .values("day", "method")
            .annotate(total=Sum("amount_kmf"))
        )
        reversal_agg = CashPaymentReversal.objects.filter(
            cash_payment__center=self.center,
            created_at__gte=start,
            created_at__lt=end,
        ).aggregate(n=Count("id"), total=Sum("cash_payment__amount_kmf"))
        invoiced_agg = (
            Invoice.objects.for_center(self.center)
            .filter(
                status__in=(Invoice.Status.ISSUED, Invoice.Status.PAID),
                created_at__gte=start,
                created_at__lt=end,
            )
            .aggregate(n=Count("id"), total=Sum("total_kmf"))
        )
        unpaid_agg = unpaid_invoices_qs(self.center).aggregate(
            n=Count("id"), total=Sum("balance_kmf_agg")
        )

        methods = list(CashPayment.Method.values)
        revenue_by_day = {}
        for row in revenue_rows:  # grouped rows: ≤ 3 methods × days
            revenue_by_day.setdefault(row["day"], {})[row["method"]] = row["total"]

        method_totals = dict.fromkeys(methods, _ZERO)
        days = []
        for day in _iter_days(from_day, to_day):
            day_methods = revenue_by_day.get(day, {})
            per_method = {m: day_methods.get(m, _ZERO) for m in methods}
            for m in methods:
                method_totals[m] += per_method[m]
            days.append(
                {
                    "date": str(day),
                    **{f"{m}_kmf": str(per_method[m]) for m in methods},
                    "total_kmf": str(sum(per_method.values(), _ZERO)),
                }
            )
        collected = sum(method_totals.values(), _ZERO)

        return Response(
            {
                "from": str(from_day),
                "to": str(to_day),
                "days": days,
                "totals": {
                    **{f"{m}_kmf": str(method_totals[m]) for m in methods},
                    "total_kmf": str(collected),
                },
                "reversals": {
                    "count": reversal_agg["n"],
                    "total_kmf": str(reversal_agg["total"] or _ZERO),
                },
                "invoiced": {
                    "count": invoiced_agg["n"],
                    "total_kmf": str(invoiced_agg["total"] or _ZERO),
                },
                "collected_kmf": str(collected),
                "unpaid": {
                    "count": unpaid_agg["n"],
                    "total_kmf": str(unpaid_agg["total"] or _ZERO),
                },
            }
        )
