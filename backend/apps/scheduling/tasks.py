"""Celery tasks of the scheduling app — the start of the « CRM santé ».

Beat wiring lives in ``config/settings.py`` (``CELERY_BEAT_SCHEDULE``),
which references tasks BY NAME only — settings never import application
code. The reminder runs DAILY at 18:00 Comoros time (crontab expressed in
``CELERY_TIMEZONE`` = ``Indian/Comoro``): late enough to catch same-week
rebookings, early enough for the patient to organise transport.
"""

from celery import shared_task

from apps.scheduling.services import send_appointment_reminders


@shared_task(name="scheduling.send_appointment_reminders")
def send_appointment_reminders_task() -> int:
    """J-1 SMS reminders for tomorrow's ``prevu`` appointments.

    Delegates to :func:`apps.scheduling.services.send_appointment_reminders`
    — the only write path (per-appointment transaction: ``reminder_sent_at``
    anti-duplicate flag and on_commit SMS stand or fall together). SMS
    content follows ADR 0012: never the reason, never the practitioner,
    never the center name.

    Returns the number of reminders queued (surfaced in worker logs via
    the task result).
    """
    return send_appointment_reminders()
