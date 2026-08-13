"""OTP service layer (ADR 0010) — code lifecycle, resolution and auto-claim.

The HTTP contract (anti-enumeration, throttling, generic errors) lives in
``test_api_otp.py``; here we exercise the service invariants directly.
"""

import json
import re
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.accounts.models import OtpCode
from apps.accounts.services import (
    OTP_GENERIC_ERROR,
    OTP_MAX_ATTEMPTS,
    request_otp,
    verify_otp,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.services import add_staff_member
from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import (
    confirm_guardian_link,
    create_patient_at_center,
    create_protege,
    decline_guardian_link,
    get_or_create_shadow_user,
    invite_guardian,
    revoke_link,
)

from .api_helpers import make_center_with_director, make_guardian_user
from .factories import make_center, make_user

pytestmark = pytest.mark.django_db

PHONE = "+2693334455"


def last_code(sms_outbox):
    """Extract the 6-digit code from the most recent SMS."""
    assert sms_outbox, "aucun SMS envoyé"
    match = re.search(r"\b(\d{6})\b", sms_outbox[-1][1])
    assert match, f"pas de code à 6 chiffres dans : {sms_outbox[-1][1]}"
    return match.group(1)


def request_and_get_code(phone, sms_outbox):
    request_otp(phone=phone)
    return last_code(sms_outbox)


class TestRequestOtp:
    def test_code_is_hashed_never_stored_in_clear(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        otp = OtpCode.objects.get()
        assert code not in otp.code_hash
        assert len(otp.code_hash) == 64  # HMAC-SHA256 hex

    def test_sms_is_french_and_mentions_validity(self, sms_outbox):
        request_otp(phone=PHONE)
        phone, message = sms_outbox[-1]
        assert phone == PHONE
        assert "code de connexion" in message
        assert "10 minutes" in message

    def test_new_request_invalidates_previous_active_code(self, sms_outbox):
        old_code = request_and_get_code(PHONE, sms_outbox)
        new_code = request_and_get_code(PHONE, sms_outbox)
        first_otp = OtpCode.objects.order_by("pk").first()
        assert first_otp.expires_at <= timezone.now()  # superseded on the spot
        if old_code != new_code:  # a 1/10^6 collision would make old==new valid
            with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
                verify_otp(phone=PHONE, code=old_code)
        verify_otp(phone=PHONE, code=new_code)  # the NEW code still works

    def test_deactivated_account_stores_a_code_but_sends_no_sms(self, sms_outbox):
        """OTP-2: equivalent work (a throwaway code is stored) but no SMS to a
        banned number — no cheap path to time-probe a deactivated account."""
        user = make_user(phone=PHONE)
        user.is_active = False
        user.save(update_fields=["is_active"])
        request_otp(phone=PHONE)
        assert sms_outbox == []  # never delivered to a banned number
        assert OtpCode.objects.count() == 1  # but the work is equivalent
        entry = AuditLog.objects.get(action=AuditAction.OTP_REQUESTED)
        assert entry.payload["sent"] is False
        assert entry.payload["user_id"] == user.pk  # referenced, no PII

    def test_request_audit_without_user_carries_no_pii(self, sms_outbox):
        request_otp(phone=PHONE)
        entry = AuditLog.objects.get(action=AuditAction.OTP_REQUESTED)
        dump = json.dumps(entry.payload)
        assert PHONE not in dump
        assert PHONE.lstrip("+") not in dump
        assert "phone_ref" in entry.payload  # pseudonymous correlation key


class TestVerifyOtpLifecycle:
    def test_expired_code_is_refused(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        OtpCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=code)

    def test_code_is_single_use(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        verify_otp(phone=PHONE, code=code)
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=code)

    def test_sixth_attempt_is_refused_even_with_the_right_code(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(OTP_MAX_ATTEMPTS):
            with pytest.raises(ValidationError):
                verify_otp(phone=PHONE, code=wrong)
        assert OtpCode.objects.get().attempts == OTP_MAX_ATTEMPTS
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=code)  # the code is DEAD

    def test_wrong_code_increments_only_the_targeted_code(self, sms_outbox):
        other_phone = "+2693334456"
        request_otp(phone=PHONE)  # will be superseded
        code_a = request_and_get_code(PHONE, sms_outbox)
        request_otp(phone=other_phone)
        wrong = "000000" if code_a != "000000" else "111111"
        with pytest.raises(ValidationError):
            verify_otp(phone=PHONE, code=wrong)
        superseded, active_a, active_b = OtpCode.objects.order_by("pk")
        assert active_a.attempts == 1  # only the live code of PHONE paid
        assert superseded.attempts == 0
        assert active_b.attempts == 0

    def test_failed_attempts_survive_the_refusal(self, sms_outbox):
        """The counter commits BEFORE the error: no rollback-reset brute force."""
        code = request_and_get_code(PHONE, sms_outbox)
        wrong = "000000" if code != "000000" else "111111"
        with pytest.raises(ValidationError):
            verify_otp(phone=PHONE, code=wrong)
        assert OtpCode.objects.get().attempts == 1
        failure = AuditLog.objects.filter(action=AuditAction.OTP_FAILED)
        assert failure.count() == 1  # the audit entry survived too

    def test_all_failures_raise_the_same_message(self, sms_outbox):
        # Unknown phone (no code ever requested)
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone="+2693334457", code="123456")
        # Wrong code on a live request
        code = request_and_get_code(PHONE, sms_outbox)
        wrong = "000000" if code != "000000" else "111111"
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=wrong)
        # Expired
        OtpCode.objects.filter(phone=PHONE).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=code)

    def test_deactivated_account_cannot_login_even_with_valid_code(self, sms_outbox):
        user = make_user(phone=PHONE)
        code = request_and_get_code(PHONE, sms_outbox)
        user.is_active = False
        user.save(update_fields=["is_active"])
        with pytest.raises(ValidationError, match=OTP_GENERIC_ERROR):
            verify_otp(phone=PHONE, code=code)

    def test_no_code_appears_in_any_audit_payload(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        wrong = "000000" if code != "000000" else "111111"
        with pytest.raises(ValidationError):
            verify_otp(phone=PHONE, code=wrong)
        verify_otp(phone=PHONE, code=code)
        for entry in AuditLog.objects.all():
            dump = json.dumps(entry.payload)
            assert code not in dump
            assert wrong not in dump
            assert PHONE not in dump


class TestAccountResolution:
    def test_door_b_creates_a_verified_account_with_unusable_password(
        self, sms_outbox
    ):
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        user = result["user"]
        assert result["created"] is True and result["activated"] is False
        assert user.phone == PHONE
        assert user.phone_verified_at is not None
        assert not user.has_usable_password()
        assert AuditLog.objects.filter(
            action=AuditAction.ACCOUNT_CREATED, payload__door="B"
        ).exists()

    def test_second_login_is_a_simple_login(self, sms_outbox):
        code = request_and_get_code(PHONE, sms_outbox)
        first = verify_otp(phone=PHONE, code=code)
        code2 = request_and_get_code(PHONE, sms_outbox)
        second = verify_otp(phone=PHONE, code=code2)
        assert second["user"] == first["user"]
        assert second["created"] is False and second["activated"] is False
        # phone_verified_at keeps the FIRST verification timestamp
        assert second["user"].phone_verified_at == first["user"].phone_verified_at

    def test_shadow_guardian_account_is_activated_not_recreated(self, sms_outbox):
        """Doors B/C guardian invitation → shadow user; OTP activates it."""
        patient_owner, guardian_profile = make_guardian_user()
        protege, _ = create_protege(
            guardian_user=patient_owner,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Anfia",
            last_name="Soilihi",
        )
        link = invite_guardian(
            actor=patient_owner,
            patient=protege,
            phone=PHONE,
            relationship=GuardianLink.Relationship.EXTENDED_FAMILY,
            initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
        )
        shadow = link.guardian.user
        assert not shadow.has_usable_password()

        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        assert result["user"] == shadow
        assert result["created"] is False and result["activated"] is True
        shadow.refresh_from_db()
        assert shadow.phone_verified_at is not None
        assert not shadow.has_usable_password()  # OTP is ITS method
        assert AuditLog.objects.filter(
            action=AuditAction.ACCOUNT_ACTIVATED, payload__user_id=shadow.pk
        ).exists()

    def test_shadow_staff_account_is_activated(self, sms_outbox):
        center, director = make_center_with_director()
        membership = add_staff_member(
            actor=director,
            center=center,
            phone=PHONE,
            role="secretaire",
            first_name="Zalia",
            last_name="Mohamed",
        )
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        assert result["user"] == membership.user
        assert result["activated"] is True


class TestAutoClaim:
    """The STRICT auto-claim rule (ADR 0010), positive AND negative."""

    def _door_a_profile(self, phone=PHONE):
        guardian_user, _profile = make_guardian_user()
        protege, link = create_protege(
            guardian_user=guardian_user,
            relationship=GuardianLink.Relationship.PARENT,
            first_name="Mariama",
            last_name="Ahamada",
            phone=phone,
        )
        return protege, link

    def test_door_a_profile_is_claimed_at_first_otp(self, sms_outbox):
        protege, _link = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        protege.refresh_from_db()
        assert result["claimed_profile"] == protege
        assert protege.user == result["user"]
        assert protege.claim_status == PatientProfile.ClaimStatus.ACTIVE
        assert AuditLog.objects.filter(action=AuditAction.PATIENT_CLAIMED).exists()

    def test_desk_profile_with_matching_phone_is_NOT_claimed(self, sms_outbox):
        """Porte C : le téléphone tapé au guichet n'est pas une preuve."""
        center, director = make_center_with_director()
        profile, _ = create_patient_at_center(
            actor=director,
            center=center,
            first_name="Halima",
            last_name="Saïd",
            phone=PHONE,
        )
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        profile.refresh_from_db()
        assert result["claimed_profile"] is None
        assert profile.user is None
        assert profile.claim_status == PatientProfile.ClaimStatus.UNCLAIMED

    def test_revoked_creator_link_blocks_the_claim(self, sms_outbox):
        protege, link = self._door_a_profile()
        revoke_link(link=link, actor=link.guardian.user)
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        protege.refresh_from_db()
        assert result["claimed_profile"] is None
        assert protege.user is None

    def test_user_with_existing_profile_never_claims_a_second_one(self, sms_outbox):
        # First OTP claims the door A profile…
        self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        verify_otp(phone=PHONE, code=code)
        # …then ANOTHER guardian declares a duplicate with the same phone.
        self._door_a_profile()
        code2 = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code2)
        assert result["claimed_profile"] is None
        assert PatientProfile.objects.filter(user__isnull=False).count() == 1

    def test_oldest_eligible_profile_wins_others_stay_for_merge(self, sms_outbox):
        first, _ = self._door_a_profile()
        second, _ = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        first.refresh_from_db()
        second.refresh_from_db()
        assert result["claimed_profile"] == first
        assert second.user is None  # duplicate left for the merge flow

    def test_shadow_user_activation_claims_its_door_a_profile(self, sms_outbox):
        """A/C combinées : le protégé est AUSSI tuteur ombre invité ailleurs —
        l'activation ne doit revendiquer que le profil qui le vise."""
        protege_profile, _ = self._door_a_profile()
        # The same phone was invited as guardian on someone else (shadow user).
        other_patient, _ = self._door_a_profile(phone="+2693210777")
        invite_guardian(
            actor=other_patient.created_by_user,
            patient=other_patient,
            phone=PHONE,
            relationship=GuardianLink.Relationship.SIBLING,
            initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
        )
        shadow, _ = get_or_create_shadow_user(PHONE)
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        assert result["user"] == shadow
        protege_profile.refresh_from_db()
        assert protege_profile.user == shadow
        other_patient.refresh_from_db()
        assert other_patient.user is None


class TestClaimSuspendsLinks:
    """OTP-1 — a claim by the patient suspends every surviving link until
    the titulaire confirms it (le contrôle repasse au patient)."""

    def _door_a_profile(self, phone=PHONE, first_name="Mariama"):
        guardian_user, guardian = make_guardian_user()
        protege, link = create_protege(
            guardian_user=guardian_user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name=first_name,
            last_name="Ahamada",
            phone=phone,
        )
        return protege, link, guardian_user

    def test_claim_suspends_the_creator_link(self, sms_outbox):
        _protege, link, _gu = self._door_a_profile()
        assert link.status == GuardianLink.Status.ACTIVE  # legit while unclaimed
        code = request_and_get_code(PHONE, sms_outbox)
        verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert AuditLog.objects.filter(
            action=AuditAction.LINK_PENDING_CONFIRMATION
        ).exists()

    def test_suspended_link_gives_no_payment_scope(self, sms_outbox):
        _protege, link, _gu = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        assert Consent.objects.active_scopes(link) == frozenset()
        assert not Consent.objects.allows(link, Consent.Scope.PAYMENTS)

    def test_patient_confirmation_reactivates_the_link(self, sms_outbox):
        _protege, link, _gu = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        confirmed = confirm_guardian_link(patient_user=result["user"], link=link)
        assert confirmed.status == GuardianLink.Status.ACTIVE
        assert confirmed.accepted_at is not None
        assert Consent.Scope.PAYMENTS in Consent.objects.active_scopes(confirmed)
        assert AuditLog.objects.filter(action=AuditAction.LINK_CONFIRMED).exists()

    def test_patient_decline_revokes_the_link_finally(self, sms_outbox):
        _protege, link, _gu = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        declined = decline_guardian_link(patient_user=result["user"], link=link)
        assert declined.status == GuardianLink.Status.REVOKED
        assert AuditLog.objects.filter(action=AuditAction.LINK_DECLINED).exists()
        # Final: a revoked link can never be confirmed back.
        with pytest.raises(ValidationError):
            confirm_guardian_link(patient_user=result["user"], link=link)

    def test_another_patient_cannot_confirm_my_link(self, sms_outbox):
        _protege, link, _gu = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        with pytest.raises(ValidationError, match="ne vous concerne pas"):
            confirm_guardian_link(patient_user=make_user(), link=link)

    def test_confirm_requires_the_pending_state(self, sms_outbox):
        """A link that is not pending confirmation cannot be confirmed."""
        _protege, link, _gu = self._door_a_profile()
        code = request_and_get_code(PHONE, sms_outbox)
        result = verify_otp(phone=PHONE, code=code)
        link.refresh_from_db()
        confirm_guardian_link(patient_user=result["user"], link=link)  # → ACTIVE
        with pytest.raises(ValidationError, match="pas en attente"):
            confirm_guardian_link(patient_user=result["user"], link=link)

    def test_legit_unclaimed_management_still_works(self, sms_outbox):
        """The « Mariama managed by her daughter » case is untouched: while
        the profile is UNCLAIMED, the guardian link stays ACTIVE and opens
        the minimal payments scope."""
        _protege, link, _gu = self._door_a_profile()
        # No OTP claim happened: the profile is still unclaimed.
        assert link.status == GuardianLink.Status.ACTIVE
        assert Consent.Scope.PAYMENTS in Consent.objects.active_scopes(link)
