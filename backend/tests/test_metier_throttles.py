"""S1 — business throttles (audit C.5.4).

Two layers locked here:

- a GLOBAL user throttle on every endpoint without its own
  ``throttle_classes`` (generous by default — 600/min — so a desk in rush
  never sees it; rates are lowered per test via ``lower_rates`` to observe
  the 429);
- a STRICT ``uploads`` scope shared by the center logo and the user
  avatar (Pillow CPU — vigilance vague 1).

Exemptions locked too: the PSP webhook and the health probe are keyed by
IP when anonymous and must NEVER answer 429 (a dropped provider retry is
an encaissement qui n'arrive jamais).
"""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .factories import make_user

pytestmark = pytest.mark.django_db


def lower_rates(monkeypatch, **rates):
    """Same technique as the invite/OTP throttle tests: ``THROTTLE_RATES``
    is a class attribute frozen at import — patch it on SimpleRateThrottle
    directly (an ``override_settings`` of REST_FRAMEWORK would reload
    ``api_settings`` but never this already-bound class attribute)."""
    from django.conf import settings as django_settings
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {**django_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], **rates},
    )


def png_upload(name="photo.png"):
    buf = BytesIO()
    Image.new("RGB", (32, 32), "red").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


class TestGlobalUserThrottle:
    def test_the_global_throttle_answers_429_past_the_rate(self, monkeypatch):
        lower_rates(monkeypatch, user="2/min")
        center, director = make_center_with_director()
        client = client_for(director)
        url = f"/api/v1/centers/{center.pk}/patients/"
        assert client.get(url).status_code == 200
        assert client.get(url).status_code == 200
        throttled = client.get(url)
        assert throttled.status_code == 429
        assert throttled.headers.get("Retry-After") is not None

    def test_the_rate_is_per_user_not_shared(self, monkeypatch):
        lower_rates(monkeypatch, user="2/min")
        center, director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        url = f"/api/v1/centers/{center.pk}/patients/"
        for _ in range(2):
            assert client_for(director).get(url).status_code == 200
        # The secretary's budget is untouched by the director's calls.
        assert client_for(secretary).get(url).status_code == 200

    def test_default_rate_is_generous_enough_for_a_desk_burst(self):
        """No override: 30 rapid calls (a heavy dashboard refresh) never
        see a 429 under the shipped default (600/min)."""
        center, director = make_center_with_director()
        client = client_for(director)
        url = f"/api/v1/centers/{center.pk}/patients/"
        assert all(client.get(url).status_code == 200 for _ in range(30))


class TestUploadsStrictScope:
    def test_avatar_uploads_hit_the_uploads_scope(self, monkeypatch):
        lower_rates(monkeypatch, uploads="1/hour")
        user = make_user()
        client = client_for(user)
        first = client.post(
            "/api/v1/auth/me/avatar/", {"file": png_upload()}, format="multipart"
        )
        assert first.status_code == 200, first.content
        second = client.post(
            "/api/v1/auth/me/avatar/", {"file": png_upload()}, format="multipart"
        )
        assert second.status_code == 429

    def test_center_logo_shares_the_same_scope(self, monkeypatch):
        lower_rates(monkeypatch, uploads="1/hour")
        center, director = make_center_with_director()
        client = client_for(director)
        url = f"/api/v1/centers/{center.pk}/logo/"
        first = client.post(url, {"file": png_upload()}, format="multipart")
        assert first.status_code == 200, first.content
        second = client.post(url, {"file": png_upload()}, format="multipart")
        assert second.status_code == 429

    def test_normal_business_calls_do_not_burn_the_uploads_budget(self, monkeypatch):
        lower_rates(monkeypatch, uploads="1/hour")
        center, director = make_center_with_director()
        client = client_for(director)
        # Plenty of ordinary reads…
        for _ in range(5):
            assert client.get(f"/api/v1/centers/{center.pk}/patients/").status_code == 200
        # …and the single upload budget is still available.
        response = client.post(
            f"/api/v1/centers/{center.pk}/logo/",
            {"file": png_upload()}, format="multipart",
        )
        assert response.status_code == 200


class TestExemptEndpoints:
    def test_the_psp_webhook_is_never_throttled(self, monkeypatch):
        lower_rates(monkeypatch, user="1/min")
        client = client_for()
        for _ in range(4):
            response = client.generic(
                "POST", "/api/v1/trustbridge/webhooks/psp/",
                data=b"{}", content_type="application/json",
                HTTP_X_PSP_SIGNATURE="invalide",
            )
            # Bad signature → 400. NEVER 429: provider retries must land.
            assert response.status_code == 400

    def test_the_health_probe_is_never_throttled(self, monkeypatch):
        lower_rates(monkeypatch, user="1/min")
        client = client_for()
        for _ in range(4):
            assert client.get("/api/v1/health/").status_code == 200

    def test_strict_auth_scopes_still_override_the_global_default(self, monkeypatch):
        """The OTP/login endpoints keep their OWN stricter throttles: the
        global default never replaces them (throttle_classes overrides)."""
        lower_rates(monkeypatch, auth_token="1/min", user="100/min")
        client = client_for()
        body = {"username": "ghost", "password": "wrong"}
        first = client.post("/api/v1/auth/token/", body)
        assert first.status_code in (400, 401)
        second = client.post("/api/v1/auth/token/", body)
        assert second.status_code == 429  # the auth_token scope, not "user"
