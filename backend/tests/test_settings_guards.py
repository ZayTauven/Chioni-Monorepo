"""R-API-3 — boot guards on the PSP configuration.

The guards fire at settings IMPORT time (like a missing SECRET_KEY), so
they are probed in a subprocess with the environment overridden —
``override_settings`` cannot exercise import-time code.
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


class TestPspBootGuards:
    def test_fake_psp_with_debug_false_refuses_to_boot(self):
        result = import_settings(DEBUG="False", PSP_BACKEND="fake")
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "PSP_BACKEND" in result.stderr

    def test_a_real_psp_with_debug_false_boots(self):
        result = import_settings(DEBUG="False", PSP_BACKEND="stripe")
        assert result.returncode == 0, result.stderr

    def test_fake_psp_in_debug_boots(self):
        result = import_settings(DEBUG="True", PSP_BACKEND="fake")
        assert result.returncode == 0, result.stderr

    def test_empty_webhook_secret_refuses_to_boot(self):
        result = import_settings(DEBUG="True", PSP_WEBHOOK_SECRET="")
        assert result.returncode != 0
        assert "ImproperlyConfigured" in result.stderr
        assert "PSP_WEBHOOK_SECRET" in result.stderr
