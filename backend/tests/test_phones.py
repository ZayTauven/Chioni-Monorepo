"""R-API-5 — E.164 normalisation at every phone boundary.

« +269… », « 269… » and national comorian forms must converge to ONE
account/profile; invalid numbers are refused in French; a squatted shadow
username suffixes instead of crashing (no more 500).
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.centers.services import add_staff_member
from apps.common.phones import normalize_phone
from apps.patients.models import GuardianLink
from apps.patients.services import get_or_create_shadow_user, invite_guardian

from .api_helpers import Role, client_for, make_center_with_director, make_claimed_patient, make_staff_user
from .factories import make_patient

pytestmark = pytest.mark.django_db


class TestNormalizeHelper:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("+2693312345", "+2693312345"),
            ("2693312345", "+2693312345"),   # missing « + » converges
            ("3312345", "+2693312345"),      # national comorian form
            ("+269 331 23 45", "+2693312345"),
            ("0033612345678", "+33612345678"),
            ("+33 6 12 34 56 78", "+33612345678"),
        ],
    )
    def test_equivalent_spellings_converge(self, raw, expected):
        assert normalize_phone(raw) == expected

    @pytest.mark.parametrize("raw", ["abc", "123", "+269999", "0000000000000"])
    def test_invalid_numbers_are_refused_in_french(self, raw):
        with pytest.raises(ValidationError, match="invalide"):
            normalize_phone(raw)

    def test_blank_is_refused(self):
        with pytest.raises(ValidationError, match="requis"):
            normalize_phone("   ")


class TestShadowUserConvergence:
    def test_spelling_variants_map_to_one_shadow_user(self):
        user1, created1 = get_or_create_shadow_user("2693312345")
        user2, created2 = get_or_create_shadow_user("+269 331 23 45")

        assert created1 is True
        assert created2 is False
        assert user1.pk == user2.pk
        assert user1.phone == "+2693312345"

    def test_squatted_shadow_username_suffixes_instead_of_500(self):
        User = get_user_model()
        User.objects.create_user(username="invite-2693312345", password=None)

        user, created = get_or_create_shadow_user("+2693312345")

        assert created is True
        assert user.username == "invite-2693312345-2"
        assert user.phone == "+2693312345"

    def test_staff_onboarding_converges_on_the_same_user(self):
        """The same nurse referenced with two spellings is ONE user — the
        duplicate-role guard fires instead of creating a doppelgänger."""
        center, director = make_center_with_director()
        add_staff_member(
            actor=director, center=center, phone="3390001", role=Role.NURSE
        )
        with pytest.raises(ValidationError, match="déjà ce rôle"):
            add_staff_member(
                actor=director, center=center, phone="+2693390001", role=Role.NURSE
            )

    def test_guardian_invites_converge_on_one_guardian_account(self):
        patient_a = make_claimed_patient()
        patient_b = make_patient(first_name="Autre", last_name="Protégé")
        link_a = invite_guardian(
            actor=patient_a.user, patient=patient_a, phone="0033612345678",
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        link_b = invite_guardian(
            actor=patient_a.user, patient=patient_b, phone="+33 6 12 34 56 78",
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        assert link_a.guardian_id == link_b.guardian_id
        assert link_a.guardian.user.phone == "+33612345678"


class TestApiBoundary:
    def test_desk_creation_stores_the_normalised_phone(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)

        resp = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/patients/",
            {"first_name": "Mariama", "last_name": "Ahamada", "phone": "331 23 45"},
        )

        assert resp.status_code == 201, resp.content
        assert resp.data["phone"] == "+2693312345"

    def test_desk_creation_with_an_invalid_phone_is_a_french_400(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)

        resp = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/patients/",
            {"first_name": "Mariama", "last_name": "Ahamada", "phone": "12"},
        )

        assert resp.status_code == 400
        assert "invalide" in str(resp.data)

    def test_guardian_invitation_with_an_invalid_phone_is_a_french_400(self):
        patient = make_claimed_patient()
        resp = client_for(patient.user).post(
            "/api/v1/patients/me/guardians/invite/",
            {"phone": "999", "relationship": "enfant"},
        )
        assert resp.status_code == 400
        assert "invalide" in str(resp.data)
