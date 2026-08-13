"""Adversarial probe — the claimant-confirmation gate also covers MERGE.

The OTP-1 fix suspends every guardian link to PENDING_CLAIMANT_CONFIRMATION
when the patient claims their profile. The guardian's re-check found the same
invariant leaking through ``merge_profiles``: moving a guardian link onto a
CLAIMED target used to keep it ACTIVE, re-opening OTP-1 through the merge
door. Now closed — this file PROVES the closure (green = fixed):

- a link moved onto a CLAIMED target is suspended to
  PENDING_CLAIMANT_CONFIRMATION (∅ scope) and only the titulaire's explicit
  confirmation reactivates it;
- a link moved onto an UNCLAIMED target stays ACTIVE (non-regression: the
  guardian keeps managing the administrative record).
"""

import pytest
from rest_framework.test import APIClient

from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import confirm_guardian_link, create_protege, merge_profiles

from .api_helpers import make_center_with_director, make_claimed_patient, make_guardian_user
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db


class TestMergePathHonoursClaimantConfirmation:
    def test_link_moved_onto_a_claimed_profile_is_suspended_not_active(self):
        """A stranger's orphan door-A profile (ACTIVE link) merged into a
        CLAIMED victim — a normal duplicate merge done by staff — now lands
        the link in PENDING_CLAIMANT_CONFIRMATION: ∅ scope, no payments
        visibility until the titulaire confirms. The merge no longer grants
        a confirmation the patient never gave."""
        center, director = make_center_with_director()

        victim = make_user(phone="+2693335500")
        claimed = make_claimed_patient(user=victim)
        make_encounter(patient=claimed, center=center)

        attacker, _attacker_profile = make_guardian_user()
        orphan, link = create_protege(
            guardian_user=attacker, relationship=GuardianLink.Relationship.CHILD,
            first_name="Orphelin", last_name="Semé", phone="+2693335599",
        )
        make_encounter(patient=orphan, center=center)

        client = APIClient()
        client.force_authenticate(director)
        resp = client.post(
            f"/api/v1/centers/{center.pk}/patients/merge/",
            {"source_id": orphan.pk, "target_id": claimed.pk}, format="json",
        )
        assert resp.status_code == 200

        link.refresh_from_db()
        assert link.patient_id == claimed.pk
        # CLOSED: suspended on the claimed victim, zero visibility.
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert Consent.objects.active_scopes(link) == frozenset()

        # Only the titulaire's explicit confirmation (re)activates it.
        confirm_guardian_link(patient_user=victim, link=GuardianLink.objects.get(pk=link.pk))
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE
        assert Consent.Scope.PAYMENTS in Consent.objects.active_scopes(link)

    def test_link_moved_onto_an_unclaimed_profile_stays_active(self):
        """Non-regression: merging onto an UNCLAIMED target leaves the link
        ACTIVE — the guardian keeps managing the administrative record of a
        patient who has not taken possession of their account yet."""
        center, director = make_center_with_director()

        guardian_user, _ = make_guardian_user()
        source, link = create_protege(
            guardian_user=guardian_user, relationship=GuardianLink.Relationship.CHILD,
            first_name="Doublon", last_name="A", phone="+2693335511",
        )
        make_encounter(patient=source, center=center)
        # Target is a plain UNCLAIMED desk profile (no user).
        target = make_patient(first_name="Doublon", last_name="B", created_by_center=center)
        make_encounter(patient=target, center=center)
        assert target.claim_status == PatientProfile.ClaimStatus.UNCLAIMED

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        assert link.patient_id == target.pk
        assert link.status == GuardianLink.Status.ACTIVE  # unchanged
        assert Consent.Scope.PAYMENTS in Consent.objects.active_scopes(link)
