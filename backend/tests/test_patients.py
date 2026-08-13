"""Patient identity invariants: unclaimed profiles, creator tracing, links."""

import pytest
from django.db import IntegrityError

from apps.patients.models import PatientProfile

from .factories import make_center, make_guardian, make_link, make_patient, make_user

pytestmark = pytest.mark.django_db


class TestUnclaimedProfiles:
    def test_profile_created_by_a_guardian_has_no_user_but_traces_its_creator(self):
        nassim = make_user(username="nassim")

        profile = make_patient(created_by_user=nassim)

        assert profile.user is None
        assert profile.claim_status == PatientProfile.ClaimStatus.UNCLAIMED
        assert not profile.is_claimed
        assert profile.created_by_user == nassim
        # The creator can find the profiles they registered (door A).
        assert profile in nassim.patient_profiles_created.all()

    def test_profile_created_at_the_desk_traces_the_center(self):
        center = make_center()
        clerk = make_user()

        profile = make_patient(created_by_user=clerk, created_by_center=center)

        assert profile.user is None
        assert profile.created_by_center == center
        assert profile in center.patient_profiles_created.all()

    def test_profile_phone_is_not_unique_only_the_user_phone_is(self):
        # Two unclaimed duplicates with the same declared phone must coexist
        # until the merge flow reconciles them (needs study §3).
        make_patient(phone="+2693210001")
        duplicate = make_patient(phone="+2693210001")

        assert duplicate.pk is not None

    def test_active_claim_status_requires_a_user(self):
        with pytest.raises(IntegrityError):
            make_patient(claim_status=PatientProfile.ClaimStatus.ACTIVE, user=None)

    def test_claimed_profile_carries_the_user(self):
        anfia = make_user(username="anfia")

        profile = make_patient(
            first_name="Anfia",
            user=anfia,
            created_by_user=anfia,
            claim_status=PatientProfile.ClaimStatus.ACTIVE,
        )

        assert profile.is_claimed
        assert anfia.patient_profile == profile

    def test_merge_mechanism_links_duplicate_to_canonical(self):
        canonical = make_patient()
        duplicate = make_patient(merged_into=canonical)

        assert duplicate in canonical.merged_duplicates.all()


class TestGuardianLinks:
    def test_multi_guardians_and_multi_protected(self):
        patient = make_patient()
        guardian = make_guardian()

        make_link(patient=patient)                     # guardian 1 → patient
        make_link(patient=patient, guardian=guardian)  # guardian 2 → patient
        make_link(guardian=guardian)                   # guardian 2 → patient 2

        assert patient.guardian_links.count() == 2
        assert guardian.links.count() == 2

    def test_duplicate_link_between_same_guardian_and_patient_is_refused(self):
        link = make_link()

        with pytest.raises(IntegrityError):
            make_link(guardian=link.guardian, patient=link.patient)
