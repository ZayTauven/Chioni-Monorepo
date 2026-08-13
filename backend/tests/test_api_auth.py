"""Auth endpoints: JWT stopgap with rotation + blacklist (F4), /auth/me/.

Real token flows here (no force_authenticate): the blacklist behaviour IS
the thing under test.
"""

import pytest
from rest_framework.test import APIClient

from apps.centers.models import StaffMembership

from .api_helpers import make_claimed_patient, make_guardian_user
from .factories import make_center, make_staff, make_user

pytestmark = pytest.mark.django_db

TOKEN_URL = "/api/v1/auth/token/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"


def obtain_pair(client, user):
    response = client.post(
        TOKEN_URL, {"username": user.username, "password": "test-password"}
    )
    assert response.status_code == 200, response.content
    return response.data["access"], response.data["refresh"]


class TestTokenFlow:
    def test_obtain_pair_with_valid_credentials(self):
        user = make_user()
        access, refresh = obtain_pair(APIClient(), user)
        assert access and refresh

    def test_obtain_pair_with_wrong_password_is_refused(self):
        user = make_user()
        response = APIClient().post(
            TOKEN_URL, {"username": user.username, "password": "mauvais"}
        )
        assert response.status_code == 401

    def test_refresh_rotates_and_blacklists_the_old_token(self):
        """F4 — a rotated refresh token must die immediately."""
        client = APIClient()
        _access, refresh = obtain_pair(client, make_user())

        first = client.post(REFRESH_URL, {"refresh": refresh})
        assert first.status_code == 200
        assert first.data["refresh"] != refresh  # rotation issues a new one

        replay = client.post(REFRESH_URL, {"refresh": refresh})
        assert replay.status_code == 401  # the old one is blacklisted

    def test_logout_blacklists_the_refresh_token(self):
        client = APIClient()
        user = make_user()
        access, refresh = obtain_pair(client, user)

        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.post(LOGOUT_URL, {"refresh": refresh})
        assert response.status_code == 205

        replay = APIClient().post(REFRESH_URL, {"refresh": refresh})
        assert replay.status_code == 401

    def test_logout_requires_authentication(self):
        assert APIClient().post(LOGOUT_URL, {"refresh": "x"}).status_code == 401

    def test_logout_with_garbage_token_is_a_400(self):
        client = APIClient()
        access, _refresh = obtain_pair(client, make_user())
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        assert client.post(LOGOUT_URL, {"refresh": "garbage"}).status_code == 400


class TestMe:
    def test_anonymous_is_401(self):
        assert APIClient().get(ME_URL).status_code == 401

    def test_me_exposes_identity_and_every_hat(self):
        user = make_user()
        center = make_center()
        make_staff(user=user, center=center, role=StaffMembership.Role.DOCTOR)
        make_claimed_patient(user=user)
        make_guardian_user(user=user)

        client = APIClient()
        access, _ = obtain_pair(client, user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.get(ME_URL)

        assert response.status_code == 200
        data = response.data
        assert data["id"] == user.pk
        assert data["phone"] == user.phone
        roles = [(m["center"]["id"], m["role"]) for m in data["staff_memberships"]]
        assert roles == [(center.pk, "medecin")]
        assert data["patient_profile"]["claim_status"] == "actif"
        assert data["guardian_profile"]["preferred_currency"] == "EUR"

    def test_me_without_any_profile_shows_nulls(self):
        client = APIClient()
        user = make_user()
        access, _ = obtain_pair(client, user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        data = client.get(ME_URL).data
        assert data["staff_memberships"] == []
        assert data["patient_profile"] is None
        assert data["guardian_profile"] is None

    def test_inactive_membership_is_not_listed(self):
        user = make_user()
        membership = make_staff(user=user)
        membership.is_active = False
        membership.save(update_fields=["is_active", "updated_at"])

        client = APIClient()
        access, _ = obtain_pair(client, user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        assert client.get(ME_URL).data["staff_memberships"] == []
