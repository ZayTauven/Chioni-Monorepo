"""Adversarial OTP probes (chioni-health-data-guardian, chantier auth OTP).

Kept because they DOCUMENT REAL residual behaviours of ADR 0010 (the
guardrail-confirming probes of the same pass — brute-force counter, byte-
identical anti-enum, JWT-dies-on-deactivation, no-code-leak — were dropped
once verified green). Each test PASSES by asserting the current permissive
behaviour: it is a finding, not a protection.

- OTP-1 (Élevé): silent auto-claim binds a first-login user to a door-A
  profile seeded by an arbitrary third party who merely declared the phone,
  handing that third party a standing ACTIVE guardian link (payments-scope
  visibility) with no acceptance/confirmation from the new user.
- OTP-2 (Faible): the deactivated-account request path is structurally
  cheaper (no OtpCode, no SMS) — a response-time oracle for banned/tombstone
  numbers, despite the byte-identical response body.
"""

import re

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.models import OtpCode
from apps.accounts.services import request_otp, verify_otp
from apps.patients.models import GuardianLink
from apps.patients.services import create_protege

from .api_helpers import make_guardian_user

pytestmark = pytest.mark.django_db

User = get_user_model()
VICTIM_PHONE = "+2693334455"


def code_for(phone, outbox):
    request_otp(phone=phone)
    m = re.search(r"\b(\d{6})\b", outbox[-1][1])
    assert m, outbox[-1][1]
    return m.group(1)


class TestAutoClaimHijack:
    def test_stranger_who_knows_your_phone_gets_a_guardian_link_on_login(
        self, sms_outbox
    ):
        """A stranger who merely KNOWS the victim's phone pre-seeds a door-A
        protégé profile declaring that phone (``create_protege`` makes the
        link ACTIVE immediately — no acceptance step). On the victim's FIRST
        OTP login, auto-claim SILENTLY binds them to the stranger's profile
        and the stranger keeps a standing ACTIVE guardian link: payments-
        scope visibility (amounts, generic care nature, receipts) over the
        victim, never consented to. All three auto-claim guard conditions
        (declared phone + not-a-desk-profile + active creator link) are
        attacker-controllable; the phone-match only authenticates the
        CLAIMANT, never the profile's CREATOR."""
        attacker_user, attacker_profile = make_guardian_user()
        seeded_profile, link = create_protege(
            guardian_user=attacker_user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Cible", last_name="Victime",
            phone=VICTIM_PHONE,  # a number the attacker does NOT control
        )
        assert link.status == GuardianLink.Status.ACTIVE

        result = verify_otp(phone=VICTIM_PHONE, code=code_for(VICTIM_PHONE, sms_outbox))

        assert result["claimed_profile"] is not None
        assert result["claimed_profile"].pk == seeded_profile.pk
        result["claimed_profile"].refresh_from_db()
        assert result["claimed_profile"].user_id == result["user"].pk
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE  # live link over the victim
        assert link.patient_id == result["claimed_profile"].pk
        assert link.guardian_id == attacker_profile.pk


class TestDeactivatedRequestAsymmetry:
    def test_deactivated_request_does_less_work_than_any_other(self, sms_outbox):
        """Anti-enum on the BODY holds (byte-identical 200), but the
        deactivated path is structurally cheaper: NO OtpCode, NO SMS —
        whereas every other phone (unknown or active) creates both. In async
        prod (SMS enqueued to Redis) that missing work is a response-time
        oracle: « this number is a deactivated / banned account »."""
        deact = User.objects.create_user(
            username="deact", phone="+2693330020", password="x"
        )
        deact.is_active = False
        deact.save(update_fields=["is_active"])

        request_otp(phone="+2693330020")  # deactivated
        assert OtpCode.objects.filter(phone="+2693330020").count() == 0
        assert sms_outbox == []

        request_otp(phone="+2693330021")  # unknown number
        assert OtpCode.objects.filter(phone="+2693330021").count() == 1
        assert len(sms_outbox) == 1
