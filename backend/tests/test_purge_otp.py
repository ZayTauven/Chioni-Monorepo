"""Planned purge of dead ``OtpCode`` rows (ADR 0010 — RGPD minimisation).

``accounts.purge_expired_otp_codes`` (Celery beat, hourly) physically
deletes rows that are dead — expired or consumed — for MORE than
``OTP_PURGE_GRACE_HOURS`` (default 24). The grace is the investigation
window for reported abuse: recently dead codes keep their attempt
counters until the window closes. Live codes must NEVER be touched.

``OtpCode`` is an authentication utility table, explicitly OUTSIDE the
append-only socle (ADR 0010): physical deletion is the intended design,
not a breach of the ledger/audit immutability rules.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import OtpCode
from apps.accounts.tasks import purge_expired_otp_codes

pytestmark = pytest.mark.django_db

PHONE = "+2693390077"


def make_otp(
    *,
    expires_in: timedelta,
    consumed_ago: timedelta | None = None,
    phone: str = PHONE,
) -> OtpCode:
    """One OtpCode row with controlled timestamps.

    ``expires_in`` is relative to now (negative = already expired);
    ``consumed_ago`` marks the code consumed that long ago (None = never).
    The purge criteria only read ``expires_at``/``consumed_at``, so direct
    creation keeps every test deterministic (no monkeypatched clock).
    """
    now = timezone.now()
    return OtpCode.objects.create(
        phone=phone,
        code_hash="f" * 64,  # opaque HMAC placeholder — never verified here
        expires_at=now + expires_in,
        consumed_at=(now - consumed_ago) if consumed_ago is not None else None,
    )


class TestPurgeCriteria:
    def test_expired_code_past_grace_is_deleted(self):
        make_otp(expires_in=timedelta(hours=-25))

        assert purge_expired_otp_codes() == 1
        assert OtpCode.objects.count() == 0

    def test_consumed_code_past_grace_is_deleted(self):
        # expires_at artificially in the FUTURE to isolate the consumed_at
        # clause: a consumed code must never outlive the grace, even if a
        # future change extended its expiry.
        make_otp(expires_in=timedelta(hours=1), consumed_ago=timedelta(hours=25))

        assert purge_expired_otp_codes() == 1
        assert OtpCode.objects.count() == 0

    def test_live_code_is_untouched(self):
        live = make_otp(expires_in=timedelta(minutes=5))

        assert purge_expired_otp_codes() == 0
        assert OtpCode.objects.filter(pk=live.pk).exists()

    def test_recently_consumed_code_within_grace_is_kept(self):
        # Realistic shape: consumed one hour ago, hence also expired since
        # (TTL 10 min). Both timestamps are inside the grace — the row is
        # abuse-investigation material, not purgeable yet.
        recent = make_otp(
            expires_in=timedelta(hours=-1), consumed_ago=timedelta(hours=1)
        )

        assert purge_expired_otp_codes() == 0
        assert OtpCode.objects.filter(pk=recent.pk).exists()

    def test_recently_expired_code_within_grace_is_kept(self):
        # Failed brute-force attempts live on expired, never-consumed rows:
        # the grace window applies to them too.
        recent = make_otp(expires_in=timedelta(minutes=-30))

        assert purge_expired_otp_codes() == 0
        assert OtpCode.objects.filter(pk=recent.pk).exists()


class TestPurgeReturnValue:
    def test_returns_the_exact_number_of_deleted_rows(self):
        make_otp(expires_in=timedelta(hours=-30), phone="+2693390071")
        make_otp(
            expires_in=timedelta(hours=-26),
            consumed_ago=timedelta(hours=26),
            phone="+2693390072",
        )
        kept_live = make_otp(expires_in=timedelta(minutes=9), phone="+2693390073")
        kept_recent = make_otp(
            expires_in=timedelta(hours=-2),
            consumed_ago=timedelta(hours=2),
            phone="+2693390074",
        )

        assert purge_expired_otp_codes() == 2
        assert set(OtpCode.objects.values_list("pk", flat=True)) == {
            kept_live.pk,
            kept_recent.pk,
        }

    def test_empty_table_returns_zero(self):
        assert purge_expired_otp_codes() == 0


class TestGraceSetting:
    def test_grace_hours_setting_is_honoured(self, settings):
        settings.OTP_PURGE_GRACE_HOURS = 1
        make_otp(expires_in=timedelta(hours=-2), phone="+2693390075")
        kept = make_otp(expires_in=timedelta(minutes=-30), phone="+2693390076")

        assert purge_expired_otp_codes() == 1
        assert OtpCode.objects.filter(pk=kept.pk).exists()

    def test_default_grace_is_24_hours(self, settings):
        assert settings.OTP_PURGE_GRACE_HOURS == 24


class TestBeatWiring:
    """The beat schedule references tasks BY NAME — a typo would silently
    never run anything. Pin the contract here."""

    def test_task_registered_under_its_beat_name(self):
        assert purge_expired_otp_codes.name == "accounts.purge_expired_otp_codes"

    def test_beat_schedules_hourly_otp_purge(self, settings):
        entry = settings.CELERY_BEAT_SCHEDULE["purge-expired-otp-codes"]
        assert entry["task"] == "accounts.purge_expired_otp_codes"
        assert entry["schedule"] == timedelta(hours=1)

    def test_beat_schedules_hourly_stale_intent_cleanup(self, settings):
        # trustbridge task referenced by name only (parallel chantier —
        # ADR 0009 addendum); this asserts the schedule entry, not the task.
        entry = settings.CELERY_BEAT_SCHEDULE["cancel-stale-payment-intents"]
        assert entry["task"] == "trustbridge.cancel_stale_intents"
        assert entry["schedule"] == timedelta(hours=1)

    def test_task_runs_through_celery(self):
        """Eager mode in tests: ``delay`` proves end-to-end Celery wiring."""
        make_otp(expires_in=timedelta(hours=-48))

        assert purge_expired_otp_codes.delay().get() == 1
        assert OtpCode.objects.count() == 0
