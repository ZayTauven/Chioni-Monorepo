"""Celery tasks of the accounts app — SMS dispatch and OTP hygiene.

``CELERY_TASK_ALWAYS_EAGER`` defaults to ``DEBUG`` (config/settings.py):
dev and tests execute inline without a broker; deployed environments run
through Redis workers.
"""

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from apps.common.sms import get_sms_backend

from .models import OtpCode


@shared_task(name="accounts.send_sms")
def send_sms(phone_e164: str, message: str) -> None:
    """Send one SMS through the configured backend.

    The body may contain an OTP code (ADR 0010): NEVER log it here — dev
    logging lives in the console backend, at DEBUG level only. The body
    does transit the broker when running async; that is inherent to
    off-process sending and documented in the ADR.
    """
    get_sms_backend().send(phone_e164, message)


@shared_task(name="accounts.purge_expired_otp_codes")
def purge_expired_otp_codes() -> int:
    """Physically delete dead ``OtpCode`` rows (hourly, Celery beat).

    Dead rows (expired or consumed — a new request also kills the previous
    codes by setting their ``expires_at`` to now) carry the target phone in
    CLEAR: keeping them forever violates data minimisation (RGPD) for zero
    operational value. Physical deletion is legitimate here — ADR 0010
    explicitly qualifies ``OtpCode`` as an authentication utility table,
    OUTSIDE the append-only socle (ledger/audit), and calls for this beat
    purge ("petit chantier d'hygiène").

    A row is purged only once dead for MORE than
    ``settings.OTP_PURGE_GRACE_HOURS`` (default 24). The grace window is
    deliberate: attempt counters and timing of recently dead codes are the
    raw material for investigating a reported abuse (brute force, SMS
    harassment) — an immediate purge would destroy that evidence within
    the hour. Live codes are NEVER touched.

    Returns the number of rows deleted (surfaced in worker logs via the
    task result).
    """
    cutoff = timezone.now() - timedelta(hours=settings.OTP_PURGE_GRACE_HOURS)
    # Consumed codes also expire within minutes (TTL 10 min), so the
    # ``expires_at`` clause covers virtually everything; the ``consumed_at``
    # clause is kept explicit so a consumed code could never outlive the
    # grace even if a future change extended its ``expires_at``.
    deleted_count, _ = OtpCode.objects.filter(
        Q(expires_at__lt=cutoff) | Q(consumed_at__lt=cutoff)
    ).delete()
    return deleted_count
