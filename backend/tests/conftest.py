"""Test-suite plumbing (no fixture magic — see api_helpers/factories).

Fast password hashing: the Trust Bridge scenarios create many users per
test and PBKDF2 dominated the suite's runtime (~9 s/test). MD5 hashing in
TESTS ONLY is the standard Django optimisation (official docs); it changes
nothing in any production code path and no test asserts hash strength.
"""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def fast_password_hashing(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def isolated_media_root(settings, tmp_path):
    """Uploads land in a per-test temp directory, never in backend/media/.

    Also what makes the « no orphan file » assertions deterministic: each
    test starts from an empty storage root. The PRIVATE root (patient
    documents, ADR 0016) is isolated the same way — its storage re-reads
    the setting on every access, so the override always applies.
    """
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.PRIVATE_MEDIA_ROOT = tmp_path / "private_media"


@pytest.fixture(autouse=True)
def isolated_throttle_cache():
    """DRF throttles (R-API-4) count hits in the default cache, which
    survives across tests in-process: clear it so a test's auth calls never
    bleed a 429 into its neighbours."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def sms_outbox(settings):
    """Route SMS to the in-memory backend and expose its outbox.

    Celery runs eager in tests (CELERY_TASK_ALWAYS_EAGER follows DEBUG), so
    ``send_sms.delay`` lands here synchronously — the list contains
    ``(phone_e164, message)`` tuples, like Django's mail outbox.
    """
    from apps.common.sms import MemorySmsBackend

    settings.SMS_BACKEND = "memory"
    MemorySmsBackend.sent.clear()
    yield MemorySmsBackend.sent
    MemorySmsBackend.sent.clear()
