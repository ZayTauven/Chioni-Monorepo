"""Adversarial OTP probes (chioni-health-data-guardian, chantier auth OTP).

Both findings of the pass are now CLOSED; these probes are kept in
regression and rewritten to PROVE the protection holds (green = fixed).

- OTP-1 (Élevé, corrigé): a claim by the titulaire suspends every surviving
  guardian link (``PENDING_CLAIMANT_CONFIRMATION``, ∅ scope). A stranger who
  pre-seeded a door-A profile with the victim's phone no longer keeps a live
  link on the victim's first OTP login — it takes the patient's explicit
  confirmation to (re)activate, and a decline cuts the stranger off for good.
- OTP-2 (Faible, corrigé): the deactivated-request path now does equivalent
  work (it stores a throwaway code) so it is not a response-time oracle;
  only the SMS delivery is skipped for a banned number.
"""

import re

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.models import OtpCode
from apps.accounts.services import request_otp, verify_otp
from apps.medical.models import Consent
from apps.patients.models import GuardianLink
from apps.patients.services import (
    confirm_guardian_link,
    create_protege,
    decline_guardian_link,
)

from .api_helpers import make_guardian_user

pytestmark = pytest.mark.django_db

User = get_user_model()
VICTIM_PHONE = "+2693334455"


def code_for(phone, outbox):
    request_otp(phone=phone)
    m = re.search(r"\b(\d{6})\b", outbox[-1][1])
    assert m, outbox[-1][1]
    return m.group(1)


class TestAutoClaimHijackClosed:
    def test_stranger_link_is_suspended_until_the_patient_confirms(
        self, sms_outbox
    ):
        """A stranger who merely KNOWS the victim's phone pre-seeds a door-A
        protégé profile declaring that phone (``create_protege`` makes the
        link ACTIVE — legitimate while the profile is unclaimed: « patient
        without a smartphone, managed by their relative »). On the victim's
        FIRST OTP login the profile still reunites with its owner, BUT the
        stranger's link drops to PENDING_CLAIMANT_CONFIRMATION: ∅ scope, no
        payments visibility. Only the patient's explicit confirmation
        reactivates it."""
        attacker_user, _attacker_profile = make_guardian_user()
        seeded_profile, link = create_protege(
            guardian_user=attacker_user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Cible", last_name="Victime",
            phone=VICTIM_PHONE,  # a number the attacker does NOT control
        )
        assert link.status == GuardianLink.Status.ACTIVE  # legit while unclaimed

        result = verify_otp(
            phone=VICTIM_PHONE, code=code_for(VICTIM_PHONE, sms_outbox)
        )

        # The carnet still reunites with its rightful owner…
        assert result["claimed_profile"] is not None
        assert result["claimed_profile"].pk == seeded_profile.pk
        # …but the pre-seeded link is SUSPENDED — zero visibility.
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert Consent.objects.active_scopes(link) == frozenset()

        # It takes the patient's explicit confirmation to (re)activate.
        patient_user = result["user"]
        confirm_guardian_link(patient_user=patient_user, link=link)
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE
        assert Consent.Scope.PAYMENTS in Consent.objects.active_scopes(link)

    def test_declining_a_pre_seeded_link_cuts_the_stranger_off_for_good(
        self, sms_outbox
    ):
        attacker_user, _ = make_guardian_user()
        _profile, link = create_protege(
            guardian_user=attacker_user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Cible", last_name="Victime",
            phone=VICTIM_PHONE,
        )
        result = verify_otp(
            phone=VICTIM_PHONE, code=code_for(VICTIM_PHONE, sms_outbox)
        )
        # Re-fetch the link fresh (as the view does) — its cached patient
        # relation predates the claim.
        link = GuardianLink.objects.get(pk=link.pk)
        decline_guardian_link(patient_user=result["user"], link=link)
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED  # final
        assert Consent.objects.active_scopes(link) == frozenset()


class TestDeactivatedRequestSymmetry:
    def test_deactivated_request_does_equivalent_work(self, sms_outbox):
        """Anti-oracle: a banned/tombstone number now stores a throwaway code
        exactly like every other phone (equivalent DB + HMAC work); only the
        SMS delivery is skipped (never harass a banned number). No cheap path
        to time-probe « this number is deactivated »."""
        deact = User.objects.create_user(
            username="deact", phone="+2693330020", password="x"
        )
        deact.is_active = False
        deact.save(update_fields=["is_active"])

        request_otp(phone="+2693330020")  # deactivated
        assert OtpCode.objects.filter(phone="+2693330020").count() == 1  # stored
        assert sms_outbox == []  # but never delivered

        request_otp(phone="+2693330021")  # unknown number
        assert OtpCode.objects.filter(phone="+2693330021").count() == 1
        assert len(sms_outbox) == 1  # delivered
