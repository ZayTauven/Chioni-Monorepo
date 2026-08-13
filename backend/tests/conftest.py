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
def isolated_throttle_cache():
    """DRF throttles (R-API-4) count hits in the default cache, which
    survives across tests in-process: clear it so a test's auth calls never
    bleed a 429 into its neighbours."""
    cache.clear()
    yield
    cache.clear()
