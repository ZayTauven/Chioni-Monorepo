"""S2 — the guardian's link history (`GET /guardian/links/`).

Before S2 a link in ``attente_confirmation_titulaire`` was INVISIBLE from
the guardian space (neither `/proteges/` — active+scope only — nor
`/invitations/` — invitation_envoyee only): the protégé vanished with no
explanation during the claim gate. This list shows EVERY status so the UI
can say « en attente de confirmation de votre proche » — with a payload
reduced to the administrative strict minimum.
"""

import pytest

from apps.patients.models import GuardianLink

from .api_helpers import client_for, make_guardian_user
from .factories import make_guardian, make_link, make_patient, make_user

pytestmark = pytest.mark.django_db

URL = "/api/v1/guardian/links/"

Status = GuardianLink.Status


class TestGuardianLinkHistory:
    def test_every_status_is_visible(self):
        """LA valeur ajoutée : les quatre statuts apparaissent, dont
        `attente_confirmation_titulaire` (le protégé ne « disparaît »
        plus) et `revoque` (l'historique existe enfin)."""
        user, profile = make_guardian_user()
        make_link(guardian=profile, patient=make_patient(), status=Status.ACTIVE)
        make_link(
            guardian=profile,
            patient=make_patient(first_name="Anfia", last_name="Soilihi"),
            status=Status.INVITATION_SENT,
        )
        make_link(
            guardian=profile,
            patient=make_patient(first_name="Nassim", last_name="Abdou"),
            status=Status.PENDING_CLAIMANT_CONFIRMATION,
        )
        revoked = make_link(
            guardian=profile,
            patient=make_patient(first_name="Saïd", last_name="Ali"),
            status=Status.ACTIVE,
        )
        revoked.revoke()

        response = client_for(user).get(URL)

        assert response.status_code == 200
        statuses = {item["status"] for item in response.data["results"]}
        assert statuses == {
            "actif", "invitation_envoyee", "attente_confirmation_titulaire",
            "revoque",
        }

    def test_payload_is_the_administrative_strict_minimum(self):
        """Exact keys — and the negative assertions: no protégé phone, no
        scopes, no relationship, no claim status, nothing medical."""
        user, profile = make_guardian_user()
        patient = make_patient(phone="+2693312345")
        link = make_link(guardian=profile, patient=patient, status=Status.ACTIVE)
        revoked = make_link(
            guardian=profile,
            patient=make_patient(first_name="Saïd", last_name="Ali"),
            status=Status.ACTIVE,
        )
        revoked.revoke()

        response = client_for(user).get(URL)

        by_id = {item["id"]: item for item in response.data["results"]}
        assert set(by_id[link.pk].keys()) == {
            "id", "protege_display_name", "status", "created_at", "revoked_at",
        }
        assert by_id[link.pk]["protege_display_name"] == "Mariama Ahamada"
        assert by_id[link.pk]["revoked_at"] is None
        assert by_id[revoked.pk]["revoked_at"] is not None
        assert "+2693312345" not in str(response.data)
        assert "scopes" not in str(response.data)
        assert "relationship" not in by_id[link.pk]
        assert "claim_status" not in str(response.data)

    def test_guardian_with_zero_links_gets_an_empty_200(self):
        """`IsGuardian` (space door, S1): a guardian whose last link was
        suspended or who never had one must still SEE the list — this is
        exactly who needs the explanation."""
        user, _profile = make_guardian_user()

        response = client_for(user).get(URL)

        assert response.status_code == 200
        assert response.data["results"] == []

    def test_guardian_with_only_a_pending_link_still_reads_the_list(self):
        """The S1 scoped door would have locked this guardian out (no
        active link → no scope) — the space door must not."""
        user, profile = make_guardian_user()
        make_link(
            guardian=profile, patient=make_patient(),
            status=Status.PENDING_CLAIMANT_CONFIRMATION,
        )

        response = client_for(user).get(URL)

        assert response.status_code == 200
        assert response.data["results"][0]["status"] == (
            "attente_confirmation_titulaire"
        )

    def test_another_guardians_links_are_invisible(self):
        user, profile = make_guardian_user()
        make_link(guardian=profile, patient=make_patient(), status=Status.ACTIVE)
        other_guardian = make_guardian()
        foreign = make_link(
            guardian=other_guardian, patient=make_patient(), status=Status.ACTIVE
        )

        response = client_for(user).get(URL)

        ids = {item["id"] for item in response.data["results"]}
        assert foreign.pk not in ids
        assert len(ids) == 1

    def test_sorted_newest_first(self):
        user, profile = make_guardian_user()
        first = make_link(guardian=profile, patient=make_patient())
        second = make_link(
            guardian=profile,
            patient=make_patient(first_name="Anfia", last_name="Soilihi"),
        )

        response = client_for(user).get(URL)

        assert [i["id"] for i in response.data["results"]] == [second.pk, first.pk]

    def test_non_guardian_403_and_anonymous_401(self):
        assert client_for(make_user()).get(URL).status_code == 403
        assert client_for().get(URL).status_code == 401
