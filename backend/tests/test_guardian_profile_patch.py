"""S2 — `PATCH /guardian/profile/` (audit C.4: the profile was frozen).

Field-by-field decision (documented in ``services.update_guardian_profile``):
``country_of_residence`` and ``preferred_currency`` are editable —
``preferred_currency`` is NOT consumed by the trustbridge quotes (devis
are structurally EUR→KMF, frozen on the intent), so changing it can never
rewrite a payment. Identity lives on ``User`` → `PATCH /auth/me/`.
"""

import pytest

from apps.patients.models import GuardianProfile

from .api_helpers import client_for, make_guardian_user
from .factories import make_user

pytestmark = pytest.mark.django_db

URL = "/api/v1/guardian/profile/"


class TestGuardianProfilePatch:
    def test_updates_country_of_residence(self):
        user, profile = make_guardian_user()

        response = client_for(user).patch(URL, {"country_of_residence": "RE"})

        assert response.status_code == 200, response.content
        assert response.data["country_of_residence"] == "RE"
        profile.refresh_from_db()
        assert profile.country_of_residence == "RE"

    def test_country_is_normalised_to_uppercase(self):
        user, profile = make_guardian_user()

        response = client_for(user).patch(URL, {"country_of_residence": "de"})

        assert response.status_code == 200
        assert response.data["country_of_residence"] == "DE"

    def test_updates_preferred_currency(self):
        """Editable by decision: the field is a display preference, never
        read by the quote/pay path (rates freeze on the intent)."""
        user, profile = make_guardian_user()

        response = client_for(user).patch(URL, {"preferred_currency": "KMF"})

        assert response.status_code == 200, response.content
        profile.refresh_from_db()
        assert profile.preferred_currency == "KMF"

    @pytest.mark.parametrize("bad", ["FRA", "F", "12", "F1", ""])
    def test_invalid_country_code_is_a_400_per_field(self, bad):
        """format="json" : le frontend parle JSON — en multipart (formulaire
        HTML), DRF traite « "" » comme un champ omis sur un PATCH partiel,
        ce qui n'est pas le chemin réel du client."""
        user, _profile = make_guardian_user()

        response = client_for(user).patch(
            URL, {"country_of_residence": bad}, format="json"
        )

        assert response.status_code == 400
        assert "country_of_residence" in response.data

    def test_invalid_currency_is_a_400_per_field(self):
        user, _profile = make_guardian_user()

        response = client_for(user).patch(URL, {"preferred_currency": "USD"})

        assert response.status_code == 400
        assert "preferred_currency" in response.data

    def test_read_only_fields_are_ignored(self):
        user, profile = make_guardian_user()
        original_pk = profile.pk

        response = client_for(user).patch(
            URL, {"id": 999999, "created_at": "2020-01-01T00:00:00Z"}
        )

        assert response.status_code == 200
        profile.refresh_from_db()
        assert profile.pk == original_pk

    def test_empty_patch_is_a_no_op_200(self):
        user, profile = make_guardian_user()

        response = client_for(user).patch(URL, {})

        assert response.status_code == 200
        profile.refresh_from_db()
        assert profile.country_of_residence == "FR"

    def test_without_a_profile_404(self):
        response = client_for(make_user()).patch(
            URL, {"country_of_residence": "RE"}
        )

        assert response.status_code == 404
        assert GuardianProfile.objects.count() == 0

    def test_anonymous_401(self):
        assert client_for().patch(URL, {"country_of_residence": "RE"}).status_code == 401
