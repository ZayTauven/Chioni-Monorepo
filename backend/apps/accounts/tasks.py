"""Celery tasks of the accounts app — SMS dispatch.

``CELERY_TASK_ALWAYS_EAGER`` defaults to ``DEBUG`` (config/settings.py):
dev and tests execute inline without a broker; deployed environments run
through Redis workers.
"""

from celery import shared_task

from apps.common.sms import get_sms_backend


@shared_task(name="accounts.send_sms")
def send_sms(phone_e164: str, message: str) -> None:
    """Send one SMS through the configured backend.

    The body may contain an OTP code (ADR 0010): NEVER log it here — dev
    logging lives in the console backend, at DEBUG level only. The body
    does transit the broker when running async; that is inherent to
    off-process sending and documented in the ADR.
    """
    get_sms_backend().send(phone_e164, message)
