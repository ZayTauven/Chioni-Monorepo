"""Boot guards on the PSP (R-API-3) and SMS (ADR 0010) configuration.

The guards fire at settings IMPORT time (like a missing SECRET_KEY), so
they are probed in a subprocess with the environment overridden —
``override_settings`` cannot exercise import-time code. DEBUG=False probes
must override BOTH dev backends (.env ships PSP fake + SMS console).
"""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def import_settings(**overrides):
    env = {**os.environ, **overrides}
    return subprocess.run(
        [sys.executable, "-c", "import config.settings"],
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
        env=env,
        timeout=60,
    )


def read_setting(expression, **overrides):
    """Print one settings expression from a fresh subprocess import —
    settings conditionals on DEBUG can only be probed this way."""
    env = {**os.environ, **overrides}
    return subprocess.run(
        [
            sys.executable, "-c",
            f"import config.settings as s; print({expression})",
        ],
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
        env=env,
        timeout=60,
    )


class TestPspBootGuards:
    def test_fake_psp_with_debug_false_refuses_to_boot(self):
        result = import_settings(DEBUG="False", PSP_BACKEND="fake")
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "PSP_BACKEND" in result.stderr

    def test_a_real_psp_with_debug_false_boots(self):
        # SMS_BACKEND must also leave dev mode: .env ships "console".
        result = import_settings(
            DEBUG="False", PSP_BACKEND="stripe", SMS_BACKEND="stub"
        )
        assert result.returncode == 0, result.stderr

    def test_fake_psp_in_debug_boots(self):
        result = import_settings(DEBUG="True", PSP_BACKEND="fake")
        assert result.returncode == 0, result.stderr

    def test_empty_webhook_secret_refuses_to_boot(self):
        result = import_settings(DEBUG="True", PSP_WEBHOOK_SECRET="")
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "PSP_WEBHOOK_SECRET" in result.stderr


class TestPspIntentStaleGuard:
    """ADR 0009 addendum — a null/negative purge window would make the beat
    task cancel PaymentIntents that are still live: refuse to boot."""

    def test_zero_stale_hours_refuses_to_boot(self):
        result = import_settings(DEBUG="True", PSP_INTENT_STALE_HOURS="0")
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "PSP_INTENT_STALE_HOURS" in result.stderr

    def test_valid_stale_hours_boots(self):
        result = import_settings(DEBUG="True", PSP_INTENT_STALE_HOURS="6")
        assert result.returncode == 0, result.stderr


class TestSmsBootGuards:
    """ADR 0010 — a deployed instance with a non-sending SMS backend would
    silently strand every OTP login: same fail-fast posture as the PSP."""

    def test_console_sms_with_debug_false_refuses_to_boot(self):
        result = import_settings(
            DEBUG="False", PSP_BACKEND="stripe", SMS_BACKEND="console"
        )
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "SMS_BACKEND" in result.stderr

    def test_memory_sms_with_debug_false_refuses_to_boot(self):
        result = import_settings(
            DEBUG="False", PSP_BACKEND="stripe", SMS_BACKEND="memory"
        )
        assert result.returncode != 0
        assert "SMS_BACKEND" in result.stderr

    def test_stub_sms_with_debug_false_boots(self):
        result = import_settings(
            DEBUG="False", PSP_BACKEND="stripe", SMS_BACKEND="stub"
        )
        assert result.returncode == 0, result.stderr

    def test_console_sms_in_debug_boots(self):
        result = import_settings(DEBUG="True", SMS_BACKEND="console")
        assert result.returncode == 0, result.stderr


class TestSwaggerServePermissions:
    """S1 (audit C.5.5) — `/api/schema/` and `/api/docs/` are public in
    DEV only: deployed, the OpenAPI schema is a reconnaissance map."""

    def test_debug_serves_the_docs_publicly(self):
        result = read_setting(
            "s.SPECTACULAR_SETTINGS['SERVE_PERMISSIONS']", DEBUG="True"
        )
        assert result.returncode == 0, result.stderr
        assert "AllowAny" in result.stdout

    def test_production_restricts_the_docs_to_admins(self):
        result = read_setting(
            "s.SPECTACULAR_SETTINGS['SERVE_PERMISSIONS']",
            DEBUG="False", PSP_BACKEND="stripe", SMS_BACKEND="stub",
        )
        assert result.returncode == 0, result.stderr
        assert "IsAdminUser" in result.stdout
        assert "AllowAny" not in result.stdout
