"""Shared « fenêtre de jours locaux » parsing for read-only list endpoints.

Extracted from ``apps/centers/stats_views.py`` at S4 lot 2 (ADR 0017,
décisions 5 & 6): the director's audit journal and the platform's PSP
reconciliation need EXACTLY the same period contract as the piloting
stats, and a views module must never import another views module (the
lesson of S1 § C.5.2 — ``stats_views`` stopped importing
``trustbridge.views`` for the same reason).

The contract, unchanged and now single-sourced:

- ``?from=&to=`` are INCLUSIVE local Comoros days (bounds computed in
  ``TIME_ZONE`` — pattern ADR 0013: an event at 23:30 or 00:30 stays on
  its own local day);
- defaults: ``to`` = today (local), ``from`` = ``to`` − 29 days
  (30 inclusive days);
- maximum ``MAX_PERIOD_DAYS`` (366 — a leap year);
- malformed AND well-formed-impossible dates answer the SAME 400 per
  field (leçon de la revue vague 1), as do ``from`` > ``to``, an over-long
  span and a date the calendar cannot bound.
"""

from datetime import datetime, time, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError as DrfValidationError

#: Longest inclusive period served (a leap year).
MAX_PERIOD_DAYS = 366
#: Default window when ``from``/``to`` are omitted.
DEFAULT_PERIOD_DAYS = 30


def parse_day(raw, field):
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
    covering ``[from_day 00:00, to_day + 1 day 00:00)``.
    """
    raw_from = request.query_params.get("from")
    raw_to = request.query_params.get("to")
    to_day = parse_day(raw_to, "to") if raw_to else timezone.localdate()
    if raw_from:
        from_day = parse_day(raw_from, "from")
    else:
        try:
            from_day = to_day - timedelta(days=DEFAULT_PERIOD_DAYS - 1)
        except OverflowError:
            raise DrfValidationError({"to": ["Date hors limites."]})
    start, end = day_bounds(from_day, to_day)
    return from_day, to_day, start, end


def day_bounds(from_day, to_day, *, from_field="from", to_field="to"):
    """``(start, end)`` — les bornes aware d'une période de jours locaux.

    Extrait de :func:`parse_period` en S10 (ADR 0023 lot 3) : l'export
    comptable reçoit ses bornes dans le CORPS d'un POST, pas en query
    params, mais il doit obéir **exactement** au même contrat — ordre des
    dates, longueur maximale, bornes en heure des Comores, et les mêmes
    refus. Une seconde implémentation aurait divergé au premier correctif
    (leçon C.5.2 : un groupe monte au commun dès qu'il a deux
    consommateurs).

    ``from_field``/``to_field`` laissent l'appelant nommer ses champs dans
    le 400 — le corps de l'export parle de ``period_start``/``period_end``.
    """
    if from_day > to_day:
        raise DrfValidationError(
            {from_field: ["La date de début doit précéder la date de fin."]}
        )
    if (to_day - from_day).days + 1 > MAX_PERIOD_DAYS:
        raise DrfValidationError(
            {from_field: [f"Période trop longue : {MAX_PERIOD_DAYS} jours maximum."]}
        )
    try:
        start = timezone.make_aware(datetime.combine(from_day, time.min))
        end = timezone.make_aware(datetime.combine(to_day, time.min)) + timedelta(
            days=1
        )
    except OverflowError:
        raise DrfValidationError({to_field: ["Date hors limites."]})
    return start, end
