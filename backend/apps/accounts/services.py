"""Account services — OTP SMS authentication (ADR 0010).

THE login path for patients and guardians (username+password JWT remains
for staff/back-office). Everything phone-related enters ALREADY normalised
to E.164 (R-API-5: serializers call ``apps.common.phones.normalize_phone``).

Security contract (tested in ``tests/test_otp_services.py`` /
``tests/test_api_otp.py``):

- codes are 6 ``secrets`` digits, stored as a keyed HMAC-SHA256 bound to
  (phone, purpose) — never in clear, nowhere (DB, logs, audit, Celery
  logs);
- a new request invalidates the previous active codes of the same
  (phone, purpose); 10 minutes validity; single use; 5 verification
  attempts max, counted in a transaction that COMMITS BEFORE the refusal
  is raised (a rolled-back counter would reopen brute force);
- every failure raises the SAME French message — no oracle distinguishing
  unknown phone / expired / consumed / wrong code;
- anti-enumeration on request: no exception, no signal whether the phone
  matches an account, a shadow account or nothing.
"""

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from apps.accounts.models import OtpCode
from apps.accounts.tasks import send_sms
from apps.audit.services import AuditAction, audit
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import claim_profile

OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5

#: The ONE refusal message of `/auth/otp/verify/` — anti-oracle: identical
#: for unknown phone, expired, consumed, dead or plain wrong code.
OTP_GENERIC_ERROR = "Code invalide ou expiré."

#: French, short (single SMS segment), never reveals more than needed.
OTP_SMS_TEMPLATE = (
    "Chioni : votre code de connexion est {code}. "
    "Il expire dans 10 minutes. Ne le partagez avec personne."
)


# ---------------------------------------------------------------------------
# Crypto helpers
# ---------------------------------------------------------------------------


def _hash_code(phone: str, purpose: str, code: str) -> str:
    """Keyed HMAC-SHA256 of ``code`` (key = SECRET_KEY via ``salted_hmac``).

    The salt binds phone AND purpose: a stored hash can never be replayed
    for another number or another purpose.
    """
    return salted_hmac(
        f"chioni.accounts.otp.{purpose}.{phone}", code, algorithm="sha256"
    ).hexdigest()


def phone_audit_ref(phone: str) -> str:
    """Pseudonymous stable reference of a phone for audit payloads.

    ADR 0007 forbids PII in audit payloads; when no ``User`` row exists to
    reference, this keyed hash (non-reversible without SECRET_KEY, truncated)
    still lets ops correlate request/failure entries for one number.
    """
    return salted_hmac(
        "chioni.accounts.otp.phone-ref", phone, algorithm="sha256"
    ).hexdigest()[:16]


def _generate_code() -> str:
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def _unique_username(base: str) -> str:
    """Collision-safe username (same posture as ``get_or_create_shadow_user``)."""
    User = get_user_model()
    username, suffix = base, 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base}-{suffix}"
    return username


# ---------------------------------------------------------------------------
# Request — issue a code and send the SMS
# ---------------------------------------------------------------------------


def request_otp(*, phone: str, purpose: str = OtpCode.Purpose.LOGIN) -> None:
    """Issue a fresh OTP for ``phone`` (E.164) and dispatch the SMS.

    Anti-enumeration: never raises for a valid E.164 phone and returns
    nothing — the HTTP answer upstream is IDENTICAL whether the phone
    matches an account, a shadow account or nothing (door B creates the
    account at verify time, so there is almost always « something to do »).

    The ONLY case where no SMS leaves: the phone belongs to a DEACTIVATED
    account (RGPD tombstone / banned) — sending would be harassment and no
    login can result. The response upstream still does not change.
    """
    user = get_user_model().objects.filter(phone=phone).first()
    if user is not None and not user.is_active:
        audit(
            actor=None, action=AuditAction.OTP_REQUESTED,
            user_id=user.pk, purpose=str(purpose), sent=False,
        )
        return

    code = _generate_code()
    with transaction.atomic():
        # A new request kills the previous active codes of the pair —
        # exactly one code can be live per (phone, purpose).
        OtpCode.objects.filter(
            phone=phone, purpose=purpose, consumed_at__isnull=True
        ).update(expires_at=timezone.now())
        otp = OtpCode.objects.create(
            phone=phone,
            purpose=purpose,
            code_hash=_hash_code(phone, purpose, code),
            expires_at=timezone.now() + OTP_TTL,
        )
        refs = {"user_id": user.pk} if user else {"phone_ref": phone_audit_ref(phone)}
        audit(
            actor=None, action=AuditAction.OTP_REQUESTED, target=otp,
            otp_id=otp.pk, purpose=str(purpose), sent=True, **refs,
        )
    # Outside the transaction: an SMS for a rolled-back code must not leave.
    send_sms.delay(phone, OTP_SMS_TEMPLATE.format(code=code))


# ---------------------------------------------------------------------------
# Verify — consume the code, then log in / activate / create + auto-claim
# ---------------------------------------------------------------------------


def verify_otp(*, phone: str, code: str, purpose: str = OtpCode.Purpose.LOGIN):
    """Verify ``code`` for ``phone`` and resolve the account (ADR 0010).

    Returns ``{"user", "created", "activated", "claimed_profile"}``:

    - existing ACTIVE user, phone already verified → simple login;
    - existing user, phone never verified (shadow account from invitations/
      desk/staff onboarding — or legacy password account) → ACTIVATION:
      ``phone_verified_at`` is set, the password stays exactly as it is
      (unusable for shadows: OTP is their method);
    - no user → CREATION (door B, the patient's official entry point) with
      an unusable password;
    - then STRICT auto-claim of at most one unclaimed patient profile
      (see :func:`_auto_claim_profile` — the rule is documented in ADR 0010).

    Every refusal raises the same :data:`OTP_GENERIC_ERROR`.
    """
    _consume_code(phone=phone, code=code, purpose=purpose)

    # Deactivated account: a code may predate the deactivation. Never open
    # a session, never reveal the account. Audited OUTSIDE the transaction
    # below so the entry survives the refusal.
    existing = get_user_model().objects.filter(phone=phone).first()
    if existing is not None and not existing.is_active:
        audit(
            actor=None, action=AuditAction.OTP_FAILED,
            user_id=existing.pk, purpose=str(purpose), reason="inactive_account",
        )
        raise ValidationError(OTP_GENERIC_ERROR)

    with transaction.atomic():
        user, created, activated = _login_or_create_user(phone)
        claimed = _auto_claim_profile(user)
        claim_ref = {"claimed_patient_id": claimed.pk} if claimed else {}
        audit(
            actor=user, action=AuditAction.OTP_VERIFIED, target=user,
            user_id=user.pk, purpose=str(purpose),
            account_created=created, account_activated=activated, **claim_ref,
        )
    return {
        "user": user,
        "created": created,
        "activated": activated,
        "claimed_profile": claimed,
    }


def _consume_code(*, phone: str, code: str, purpose: str) -> None:
    """Constant-time check of ``code`` against the single live OTP row.

    The attempt counter and the failure audit are written in a transaction
    that COMMITS BEFORE the ValidationError is raised: a counter that
    rolled back with the refusal would never reach 5 and the brute-force
    cap would be fiction. ``select_for_update`` serialises concurrent
    verifies (two racing successes: the second sees ``consumed_at`` set and
    fails generically).
    """
    failed = False
    with transaction.atomic():
        now = timezone.now()
        otp = (
            OtpCode.objects.select_for_update()
            .filter(
                phone=phone,
                purpose=purpose,
                consumed_at__isnull=True,
                expires_at__gt=now,
                attempts__lt=OTP_MAX_ATTEMPTS,
            )
            .order_by("-created_at")
            .first()
        )
        if otp is None:
            audit(
                actor=None, action=AuditAction.OTP_FAILED,
                phone_ref=phone_audit_ref(phone), purpose=str(purpose),
                reason="no_active_code",
            )
            failed = True
        elif not constant_time_compare(
            _hash_code(phone, purpose, code), otp.code_hash
        ):
            # Only THIS code pays for the wrong attempt — superseded or
            # foreign codes keep their counters untouched.
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            audit(
                actor=None, action=AuditAction.OTP_FAILED, target=otp,
                otp_id=otp.pk, attempts=otp.attempts, purpose=str(purpose),
                reason="code_mismatch",
            )
            failed = True
        else:
            otp.attempts += 1
            otp.consumed_at = now
            otp.save(update_fields=["attempts", "consumed_at"])
    if failed:
        raise ValidationError(OTP_GENERIC_ERROR)


def _login_or_create_user(phone: str):
    """Resolve the account for a VERIFIED phone. Returns (user, created, activated)."""
    User = get_user_model()
    user = User.objects.filter(phone=phone).first()
    created = activated = False
    now = timezone.now()
    if user is None:
        # Door B — account born verified, password UNUSABLE (OTP is its
        # login method; a password may be set later by a dedicated flow).
        user = User.objects.create_user(
            username=_unique_username(f"user-{phone.lstrip('+')}"),
            phone=phone,
            password=None,
        )
        user.phone_verified_at = now
        user.save(update_fields=["phone_verified_at"])
        created = True
        audit(
            actor=user, action=AuditAction.ACCOUNT_CREATED, target=user,
            user_id=user.pk, door="B",
        )
    elif user.phone_verified_at is None:
        # First successful verification = activation (shadow accounts from
        # guardian/patient invitations, desk door C, staff onboarding —
        # and legacy password accounts verifying their phone for the first
        # time). The password is NOT touched.
        user.phone_verified_at = now
        user.save(update_fields=["phone_verified_at"])
        activated = True
        audit(
            actor=user, action=AuditAction.ACCOUNT_ACTIVATED, target=user,
            user_id=user.pk,
        )
    return user, created, activated


def _auto_claim_profile(user):
    """STRICT auto-claim at OTP login (ADR 0010) — at most ONE profile.

    A ``PatientProfile`` is claimed for ``user`` iff ALL of:

    - the user has no patient profile yet (the OneToOne is free);
    - the profile is unclaimed (``user`` NULL) and not a merge tombstone;
    - its DECLARATIVE phone equals the user's VERIFIED phone;
    - it was NOT created at a center desk (``created_by_center`` NULL):
      door C's typed phone is NOT proof of identity — a desk profile is
      claimed through the in-person flow of the center, never silently;
    - its creator still holds an ACTIVE guardian link on the profile
      (door A: the invitation channel that targeted this very phone —
      a revoked link kills the trust basis, so no claim).

    When several profiles qualify (several guardians declared the same
    protégé), the OLDEST is claimed; the others stay unclaimed — duplicate
    profiles are a normal state resolved by the merge flow (ADR 0001/0002).
    ``claim_profile`` (patients service) does the write + audit, and
    revokes any link that would become self-guardianship.
    """
    if user.phone is None:
        return None
    if PatientProfile.objects.filter(user=user).exists():
        return None
    profile = (
        PatientProfile.objects.filter(
            user__isnull=True,
            merged_into__isnull=True,
            phone=user.phone,
            created_by_center__isnull=True,
            created_by_user__isnull=False,
            guardian_links__guardian__user=models.F("created_by_user"),
            guardian_links__status=GuardianLink.Status.ACTIVE,
        )
        .order_by("created_at", "pk")
        .first()
    )
    if profile is None:
        return None
    return claim_profile(user=user, profile=profile)
