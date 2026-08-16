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

from apps.accounts.models import ErasureRequest, OtpCode, PlatformStaff
from apps.accounts.tasks import send_sms
from apps.audit.services import AuditAction, audit
from apps.centers.models import StaffMembership
from apps.centers.services import (
    centers_locked_by_last_director,
    deactivate_staff_member,
)
from apps.common.uploads import clear_file, process_image_upload, replace_file
from apps.patients.models import (
    GuardianLink,
    GuardianProfile,
    PatientInsurance,
    PatientProfile,
)
from apps.patients.services import claim_profile, get_or_create_shadow_user

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
# Own profile — name and avatar (the user about THEMSELF, any hat)
# ---------------------------------------------------------------------------


def update_own_identity(*, user, first_name=None, last_name=None):
    """`PATCH /auth/me/` — the user edits their OWN display name.

    Deliberately narrow: first/last name ONLY. The phone is the identity
    pivot (verified by OTP — ADR 0001/0010) and the username is a technical
    key: neither is ever writable here. Not audited: renaming oneself is
    not in the sensitive catalogue (money/medical/consents/roles) — a THIRD
    PARTY writing someone's name (director on a shadow staff account) is,
    and goes through ``update_staff_member`` which audits.
    """
    changed = []
    if first_name is not None and first_name != user.first_name:
        user.first_name = first_name
        changed.append("first_name")
    if last_name is not None and last_name != user.last_name:
        user.last_name = last_name
        changed.append("last_name")
    if changed:
        user.save(update_fields=changed)
    return user


def set_user_avatar(*, user, uploaded_file):
    """Set/replace the user's profile photo — hardened pipeline first
    (JPEG/PNG/WebP by real content, 2 Mo, 2048², metadata stripped, uuid
    name), then orphan-free replacement (``replace_file``: row saved on the
    new file, previous file physically deleted)."""
    content = process_image_upload(uploaded_file)
    replace_file(user, "avatar", content)
    return user


def remove_user_avatar(*, user):
    """Remove the profile photo — physical file deleted, no orphans."""
    if not clear_file(user, "avatar"):
        raise ValidationError("Aucune photo de profil à retirer.")
    return user


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

    OTP-2 (revue guardian): the ONLY case where no SMS leaves is a
    DEACTIVATED account (RGPD tombstone / banned) — delivering would be
    harassment and no login can result (verify blocks it anyway). To deny a
    response-time oracle, that path still does the SAME work: it generates,
    invalidates and STORES a throwaway code — only the delivery is skipped.
    """
    user = get_user_model().objects.filter(phone=phone).first()
    # A banned/tombstone account never receives an SMS; every other phone
    # (known-active or unknown) does. The stored code is identical work.
    deliverable = user is None or user.is_active

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
            otp_id=otp.pk, purpose=str(purpose), sent=deliverable, **refs,
        )
    # Outside the transaction: an SMS for a rolled-back code must not leave;
    # and a banned number is never messaged (a stored-but-undelivered code
    # can never log in — verify refuses deactivated accounts).
    if deliverable:
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


# ---------------------------------------------------------------------------
# RGPD — right to erasure by ANONYMISATION (ADR 0007, implemented S4 lot 3)
# ---------------------------------------------------------------------------
#
# Chioni rests on two immutabilities: the double-entry ledger and the audit
# trail (ADR 0003/0006, PostgreSQL triggers). Physically deleting a ``User``
# would break the ``PROTECT`` FKs that guarantee « chaque franc relié à un
# payeur », and rewriting the ledger or the log to remove a name is exactly
# what those triggers forbid. So erasure is a TOMBSTONE: the row survives as
# a technical anchor, stripped of every personal datum.
#
# What is deliberately NOT erased, and why (ADR 0007):
#
# - **the health record** (Encounter, Prescription, HealthRecordEntry,
#   VitalSigns, PatientDocument, PatientMedicalFile): it belongs to the
#   PATIENT (ADR 0002) and follows the local law on medical-record
#   retention. It becomes an orphan of identity — attached to a profile
#   that no longer names anyone. This is a CHOICE, locked by test ;
# - **the ledger**: no PII by construction (enumerated accounts, amounts,
#   currencies) ;
# - **the audit trail**: references only (ADR 0007), so anonymising the
#   account mechanically anonymises the whole history that references it,
#   without rewriting a single append-only row ;
# - **invoices, receipts, cash receipts**: accounting evidence the CENTER
#   must keep; they carry ids and amounts, never a name.

#: Machine codes of what forbids anonymising an account RIGHT NOW.
#: They are refusals to be FIXED, not verdicts: the API helps, the operator
#: (and the tenant) act — hence a pending request stays pending.
ERASURE_BLOCKER_LAST_DIRECTOR = "dernier_directeur"
ERASURE_BLOCKER_PAYMENT_IN_FLIGHT = "paiement_en_cours"
ERASURE_BLOCKER_LAST_PLATFORM_ADMIN = "dernier_admin_plateforme"

#: One French sentence per blocker — rendered to the operator (400) and,
#: as a code, in the back-office payload. Never a name, never a phone.
ERASURE_BLOCKER_MESSAGES = {
    ERASURE_BLOCKER_LAST_DIRECTOR: (
        "Effacement refusé : cette personne est le dernier directeur actif "
        "d'un centre. Nommez un autre directeur avant d'effacer son compte "
        "— sinon le centre perdrait l'accès à son propre espace."
    ),
    ERASURE_BLOCKER_PAYMENT_IN_FLIGHT: (
        "Effacement refusé : un paiement est en cours pour cette personne. "
        "Le paiement doit d'abord aboutir (ou être annulé par la purge "
        "horaire des intentions abandonnées)."
    ),
    ERASURE_BLOCKER_LAST_PLATFORM_ADMIN: (
        "Effacement refusé : cette personne est le dernier administrateur "
        "actif de la plateforme Chioni. Nommez un autre administrateur "
        "avant d'effacer son compte."
    ),
}

#: Decisions accepted by :func:`process_erasure_request`.
ERASURE_DECISION_ANONYMIZE = "anonymiser"
ERASURE_DECISION_REFUSE = "refuser"

#: Neutral, readable labels for the tombstoned identities. A staff member
#: browsing an old consultation list must SEE that the person exercised
#: their right, not a blank row that looks like a bug. The pk keeps two
#: anonymised patients distinguishable in a list without naming anyone.
ANONYMIZED_USERNAME_TEMPLATE = "anon-{pk}"
ANONYMIZED_PATIENT_FIRST_NAME = "Patient"
ANONYMIZED_PATIENT_LAST_NAME_TEMPLATE = "anonymisé #{pk}"
ANONYMIZED_INSURER_LABEL = "Assurance anonymisée"


def erasure_blockers(user, *, lock=False):
    """Codes of everything that forbids anonymising ``user`` right now.

    Empty list = the erasure can be executed. Deliberately a LIST of codes
    rather than a boolean: the operator must be told everything that stands
    in the way, in one answer, not discover them one refusal at a time.

    ``lock`` (revue adversariale S4) separates the two audiences of this
    function, which used to be conflated:

    - ``False`` (default) — a READ. The back-office queue renders these
      codes inside a plain GET, outside any transaction; taking a row lock
      there raised ``TransactionManagementError`` (a 500 any director could
      trigger by simply filing an erasure request) ;
    - ``True`` — the answer is about to DECIDE a write. The « last
      director » and « last platform admin » rows are then locked
      ``FOR UPDATE`` in pk order, so two erasures racing on the two last
      holders of a seat serialise instead of both passing (same failure
      mode, and same parade, as the vague-1 fix on staff deactivation).
    """
    from apps.trustbridge.models import PaymentIntent

    blockers = []
    if centers_locked_by_last_director(user, lock=lock):
        blockers.append(ERASURE_BLOCKER_LAST_DIRECTOR)
    # A PSP payment still in the air: the money must land (or the hourly
    # zombie purge must cancel it) before the payer's account disappears —
    # a debit reaching a tombstone would be unreconcilable.
    if PaymentIntent.objects.filter(
        guardian__user=user,
        status__in=(
            PaymentIntent.Status.CREATED,
            PaymentIntent.Status.PROCESSING,
        ),
    ).exists():
        blockers.append(ERASURE_BLOCKER_PAYMENT_IN_FLIGHT)
    # Symmetric of the tenant guard, one floor up: losing every platform
    # ``admin`` would lock Chioni out of its own back-office (only the
    # Django admin could rebuild one). Judged necessary — an operator IS a
    # person and may ask, they just cannot be the last one standing.
    if _is_last_platform_admin(user, lock=lock):
        blockers.append(ERASURE_BLOCKER_LAST_PLATFORM_ADMIN)
    return blockers


def _is_last_platform_admin(user, *, lock):
    """True when ``user`` is the ONLY active platform ``admin`` left.

    The whole active-admin set is read (and, when ``lock``, locked in pk
    order) rather than « does another one exist »: an ordered row lock is
    what makes two concurrent erasures serialise. Without it, each
    transaction saw the other admin still active, both passed, and Chioni
    ended with ZERO administrators — the exact lock-out this guard exists
    to prevent (probed with real threads in
    ``tests/test_adversarial_s4.py``).
    """
    admins = PlatformStaff.objects.filter(
        is_active=True, role=PlatformStaff.Role.ADMIN
    ).order_by("pk")
    if lock:
        admins = admins.select_for_update()
    rows = list(admins)
    return bool(rows) and all(row.user_id == user.pk for row in rows)


@transaction.atomic
def request_erasure(*, user):
    """The user deposits an erasure request from their OWN space.

    Any hat may ask (a patient, a guardian, a staff member, an operator):
    the row references the ``User``, never a casquette. At most ONE open
    request per person — the user row is locked so two concurrent taps
    serialise into one request instead of an IntegrityError.

    Audited ``erasure.requested`` — references only.
    """
    get_user_model().objects.select_for_update().get(pk=user.pk)
    if ErasureRequest.objects.filter(
        user=user, status=ErasureRequest.Status.PENDING
    ).exists():
        raise ValidationError(
            "Une demande d'effacement est déjà en cours pour votre compte."
        )
    erasure_request = ErasureRequest.objects.create(user=user)
    audit(
        actor=user, action=AuditAction.ERASURE_REQUESTED, target=erasure_request,
        erasure_request_id=erasure_request.pk, user_id=user.pk,
    )
    return erasure_request


@transaction.atomic
def process_erasure_request(*, actor, erasure_request, decision, refusal_reason=""):
    """The Chioni operator (``admin``) executes or refuses the erasure.

    Two decisions, both explicit and both traced:

    - ``anonymiser`` — runs :func:`erasure_blockers` first. **A blocked
      request is NOT auto-refused**: it stays ``en_attente`` and the
      operator gets the French sentences telling them what to fix (name
      another director, wait for the payment). Closing the request would
      force the person to ask twice for something Chioni simply was not
      ready to do yet ;
    - ``refuser`` — motive MANDATORY. Unlike ``kyc_reason`` or
      ``Invoice.cancel_reason``, this free text is written FOR the person
      concerned and is rendered to them (RGPD art. 12.4). It still never
      enters an audit payload (ADR 0007).

    The request row is locked: two operators clicking at once serialise,
    the second finds a request that is no longer pending and gets a 400.
    """
    erasure_request = (
        ErasureRequest.objects.select_for_update()
        .select_related("user")
        .get(pk=erasure_request.pk)
    )
    if erasure_request.status != ErasureRequest.Status.PENDING:
        raise ValidationError(
            "Cette demande d'effacement a déjà été traitée."
        )
    if decision not in (ERASURE_DECISION_ANONYMIZE, ERASURE_DECISION_REFUSE):
        raise ValidationError("Décision inconnue : « anonymiser » ou « refuser ».")

    now = timezone.now()
    if decision == ERASURE_DECISION_REFUSE:
        reason = (refusal_reason or "").strip()
        if not reason:
            raise ValidationError(
                "Le motif du refus est obligatoire : la personne a le droit "
                "de savoir pourquoi sa demande n'est pas suivie."
            )
        erasure_request.status = ErasureRequest.Status.REFUSED
        erasure_request.refusal_reason = reason
        erasure_request.processed_by = actor
        erasure_request.processed_at = now
        erasure_request.save(
            update_fields=[
                "status", "refusal_reason", "processed_by", "processed_at",
                "updated_at",
            ]
        )
        audit(
            actor=actor, action=AuditAction.ERASURE_REFUSED, target=erasure_request,
            erasure_request_id=erasure_request.pk,
            user_id=erasure_request.user_id,
            has_reason=True,
        )
        return erasure_request

    blockers = erasure_blockers(erasure_request.user, lock=True)
    if blockers:
        raise ValidationError(
            [ERASURE_BLOCKER_MESSAGES[code] for code in blockers]
        )
    anonymize_user(actor=actor, user=erasure_request.user)
    erasure_request.status = ErasureRequest.Status.PROCESSED
    erasure_request.processed_by = actor
    erasure_request.processed_at = now
    erasure_request.save(
        update_fields=["status", "processed_by", "processed_at", "updated_at"]
    )
    audit(
        actor=actor, action=AuditAction.ERASURE_PROCESSED, target=erasure_request,
        erasure_request_id=erasure_request.pk, user_id=erasure_request.user_id,
    )
    return erasure_request


@transaction.atomic
def anonymize_user(*, actor, user):
    """Tombstone ``user``: every personal datum goes, the row stays.

    NEVER a ``DELETE`` — anywhere. What this does, in order:

    1. revokes every surviving guardianship link the person is party to,
       **in both directions** (as a guardian AND, when they own a patient
       profile, as a protégé): ``GuardianLink.revoke()`` cascades on the
       active consents (ADR 0004), so no scope survives the account ;
    2. deactivates EVERY hat the person wears — staff memberships (the
       tenant must not keep a phantom member it can no longer even call),
       the platform-operator row, and the pharmacy memberships of the
       network (revue adversariale S9: the fifth hat was the one that
       stayed open, and a ghost « active member » made an officine look
       staffed while nobody could ever read its inbox again) ;
    3. anonymises the patient profile (identity + the six extended S3
       fields) and its insurance lines, and the guardian profile ;
    4. purges the OTP codes of the old phone — that table stores the
       number IN CLEAR (it is an authentication utility table) ;
    5. neutralises the account itself: deterministic ``anon-{pk}``
       username, empty names and e-mail, ``phone`` back to ``NULL`` (the
       identity pivot disappears — the unique column is nullable exactly
       for this), unverified, unusable password, avatar file deleted from
       storage, ``is_active=False``, ``anonymized_at`` posed.

    **Idempotent** and safe on an already-inactive account: re-running
    revokes nothing more, deletes no file that is gone, and keeps the
    FIRST ``anonymized_at`` (the date of the erasure is itself a fact).

    **The refusal guards are re-evaluated HERE, under the user row lock**
    (revue adversariale S4). Two reasons, both proved by probes:

    1. this service is public and irreversible — called on its own (a
       shell, a future admin action, a management command) it used to
       happily tombstone the LAST director of a center and lock the tenant
       out of its own space. A guard that lives only in the caller is not
       a guard ;
    2. it closes the TOCTOU with a payment in flight: the check in
       ``process_erasure_request`` ran before the lock, so a guardian's
       ``pay/`` committing in between left a live PSP intent pointing at a
       tombstone. ``create_payment_intent`` now takes the SAME user row
       lock first, so the two paths serialise: whoever arrives second sees
       the other's committed work and refuses.

    Lock hierarchy, extended by one OUTERMOST level and unchanged below:
    **utilisateur → intent → demande → facture → centre**.
    """
    User = get_user_model()
    user = User.objects.select_for_update().get(pk=user.pk)
    blockers = erasure_blockers(user, lock=True)
    if blockers:
        raise ValidationError([ERASURE_BLOCKER_MESSAGES[code] for code in blockers])
    old_phone = user.phone
    already_anonymized = user.anonymized_at is not None

    patient_profile = PatientProfile.objects.filter(user=user).first()
    guardian = GuardianProfile.objects.filter(user=user).first()

    # 1 — guardianship dies with the account, both directions.
    links_revoked = 0
    link_filter = models.Q(pk__in=[])
    if guardian is not None:
        link_filter |= models.Q(guardian=guardian)
    if patient_profile is not None:
        link_filter |= models.Q(patient=patient_profile)
    for link in (
        GuardianLink.objects.filter(link_filter)
        .exclude(status=GuardianLink.Status.REVOKED)
        .select_related("guardian__user", "patient")
    ):
        link.revoke()
        audit(
            actor=actor, action=AuditAction.LINK_REVOKED, target=link,
            link_id=link.pk, patient_id=link.patient_id,
            guardian_id=link.guardian_id, reason="user_anonymized",
        )
        links_revoked += 1

    # 2 — the hats close. Staff memberships go through their own service
    # (audited ``staff.membership_deactivated``, visible in the director's
    # journal: a member leaving is the tenant's business). The last-director
    # guard inside it can no longer fire — ``erasure_blockers`` refused the
    # whole erasure upstream.
    memberships_deactivated = 0
    for membership in user.staff_memberships.filter(is_active=True):
        deactivate_staff_member(actor=actor, membership=membership)
        memberships_deactivated += 1
    operator = PlatformStaff.objects.filter(user=user, is_active=True).first()
    if operator is not None:
        operator.is_active = False
        operator.save(update_fields=["is_active", "updated_at"])
    # 2 bis — la CINQUIÈME casquette (S9, ADR 0022), oubliée par S9 et
    # ajoutée par la revue adversariale. Deux raisons, dans cet ordre :
    #
    # 1. le compteur ``member_active_count`` que Chioni surveille pour
    #    savoir si une boîte de réception est encore relevée comptait un
    #    fantôme : la garde « jamais la dernière personne » se satisfaisait
    #    de lui, si bien que le DERNIER membre réel pouvait se retirer sans
    #    rien casser et laisser l'officine muette 48 h par demande, avec un
    #    back-office affichant « 1 membre actif » ;
    # 2. la promesse du service — « the hats close » — était vraie de
    #    quatre casquettes sur cinq.
    #
    # Écriture DIRECTE et non ``deactivate_pharmacy_member`` : ce service
    # porte la garde « jamais la dernière personne », qui ferait ÉCHOUER
    # l'effacement d'une pharmacienne seule dans son officine. Leçon S7 —
    # aucune contrainte d'un module métier ne doit pouvoir mettre en échec
    # un droit RGPD (l'officine se réamorce par
    # ``POST /platform/pharmacies/{pk}/members/``, chemin de secours prévu).
    pharmacy_memberships_deactivated = user.pharmacy_memberships.filter(
        is_active=True
    ).update(is_active=False, updated_at=timezone.now())

    # 3 — the profiles. The carnet itself is NOT touched (ADR 0007).
    insurances_anonymized = 0
    if patient_profile is not None:
        patient_profile.first_name = ANONYMIZED_PATIENT_FIRST_NAME
        patient_profile.last_name = ANONYMIZED_PATIENT_LAST_NAME_TEMPLATE.format(
            pk=patient_profile.pk
        )
        patient_profile.birth_date = None
        patient_profile.sex = ""
        patient_profile.phone = ""
        patient_profile.city = ""
        patient_profile.address = ""
        patient_profile.phone_alt = ""
        patient_profile.national_id = ""
        patient_profile.emergency_contact_name = ""
        patient_profile.emergency_contact_phone = ""
        patient_profile.emergency_contact_relationship = ""
        patient_profile.save()
        for insurance in PatientInsurance.objects.filter(patient=patient_profile):
            insurance.insurer_name = ANONYMIZED_INSURER_LABEL
            insurance.member_number = ""
            insurance.notes = ""
            insurance.save(
                update_fields=[
                    "insurer_name", "member_number", "notes", "updated_at",
                ]
            )
            insurances_anonymized += 1
    if guardian is not None:
        # Country of residence is location data about a person — it goes.
        # ``preferred_currency`` is a display preference, not a personal
        # datum, and is left alone.
        guardian.country_of_residence = ""
        guardian.save(update_fields=["country_of_residence", "updated_at"])

    # 3 bis — the staff register (S7, ADR 0020 invariant 7) SURVIVES: the
    # employment, the attendance sheet, the leaves and their closed types
    # stay, « orphelins d'identité », because a center has retention
    # obligations. The one thing that is NOT orphan of identity is the
    # supporting FILE of a leave: a photographed medical certificate
    # carries the person's name and her pathology in its pixels. Its bytes
    # go, exactly like the avatar two steps below; the row stays, archived,
    # so the register can still say a piece existed (revue adversariale S7).
    from apps.hrm.services import purge_leave_documents_of

    leave_documents_purged = purge_leave_documents_of(actor=actor, user=user)

    # 4 — the only table storing a phone in clear.
    otp_purged = 0
    if old_phone:
        otp_purged, _ = OtpCode.objects.filter(phone=old_phone).delete()

    # 5 — the account itself.
    clear_file(user, "avatar")
    user.username = ANONYMIZED_USERNAME_TEMPLATE.format(pk=user.pk)
    user.first_name = ""
    user.last_name = ""
    user.email = ""
    user.phone = None
    user.phone_verified_at = None
    user.is_active = False
    user.set_unusable_password()
    if not already_anonymized:
        user.anonymized_at = timezone.now()
    user.save()

    audit(
        actor=actor, action=AuditAction.USER_ANONYMIZED, target=user,
        user_id=user.pk,
        had_patient_profile=patient_profile is not None,
        had_guardian_profile=guardian is not None,
        links_revoked=links_revoked,
        memberships_deactivated=memberships_deactivated,
        insurances_anonymized=insurances_anonymized,
        pharmacy_memberships_deactivated=pharmacy_memberships_deactivated,
        otp_codes_purged=otp_purged,
        leave_documents_purged=leave_documents_purged,
        replay=already_anonymized,
    )
    return user


# ---------------------------------------------------------------------------
# L'équipe Chioni elle-même (S5 lot 3 — ADR 0018 décision 6)
# ---------------------------------------------------------------------------
#
# L'ADR 0017 laissait `PlatformStaffAdmin` en écriture « à dessein » : le
# tout premier exploitant ne pouvait naître nulle part ailleurs. Le prix
# était consigné en vigilance de la revue guardian S4 — « un superuser
# Django est toujours à un formulaire de la 4ᵉ casquette ». Ces deux
# services referment la porte : la 4ᵉ casquette se crée et se modifie par
# API auditée (`admin` seul), et l'amorçage hors ligne passe par la
# commande `create_platform_staff` (aucune garde DEBUG : elle doit tourner
# en production le jour de l'installation).

#: French refusal of the separation-of-duties guard below — mirror of
#: ``centers.services.OPERATOR_AS_DIRECTOR_MESSAGE``, in the other
#: direction.
DIRECTOR_AS_OPERATOR_MESSAGE = (
    "Ce numéro est celui d'un membre du personnel d'un centre : une "
    "casquette d'exploitant Chioni ne s'ajoute pas à une casquette de "
    "tenant. Utilisez un compte distinct pour l'équipe Chioni."
)

#: Le MÊME refus, côté réseau des pharmacies (revue adversariale S9). S9
#: n'avait posé que la porte d'entrée
#: (``pharmacy.services._refuse_platform_operator_as_pharmacy_member``) :
#: la sortie — inscrire d'abord la personne dans une officine, lui donner
#: la 4ᵉ casquette ensuite — laissait atteindre exactement l'état que
#: l'ADR 0022 décision 9 existe pour interdire, *celui qui valide les
#: pharmacies ne doit pas valider la sienne*.
PHARMACY_MEMBER_AS_OPERATOR_MESSAGE = (
    "Ce numéro est celui d'un membre d'une pharmacie du réseau : une "
    "casquette d'exploitant Chioni ne s'ajoute pas à une casquette "
    "d'officine — c'est l'exploitant qui valide les pharmacies. Utilisez "
    "un compte distinct pour l'équipe Chioni."
)

LAST_PLATFORM_ADMIN_MESSAGE = (
    "Refusé : ce compte est le dernier administrateur actif de la "
    "plateforme Chioni. Nommez un autre administrateur avant de le "
    "rétrograder ou de le désactiver — sinon Chioni se retrouve enfermée "
    "hors de son propre back-office."
)


def _refuse_center_staff_as_operator(user):
    """Separation of duties, the MIRROR of the S4/S9 guards (revue guardian).

    ``centers.services._refuse_platform_operator_as_director`` closes the
    escalation « exploitant → directeur ». Without this one, the exact same
    state (one human wearing both the tenant hat and the back-office hat)
    was reachable from the other side: make somebody a director first, then
    hand them the operator row. A guard that only holds in one direction is
    not a guard.

    Honesty of the correction, same as its mirror: it removes the
    self-service path, it does not make the combination impossible — a
    Chioni employee who is also a nurse somewhere can hold both hats
    through a SECOND account, which is precisely what separation of duties
    buys. RÉVERSIBLE: if the terrain shows the constraint is absurd (a very
    small team wearing every hat), drop the call, not the discipline.

    **The ``User`` row is LOCKED first** (revue guardian S5). The two
    mirrored guards each read the OTHER table, and both did so without a
    lock: two concurrent transactions — « donne-lui la 4ᵉ casquette » and
    « amorce-le directeur » on the same number — each saw a world where the
    other write did not exist yet, and BOTH passed, reaching precisely the
    state the pair exists to forbid (probed with real threads in
    ``tests/test_adversarial_s5.py``). The ``User`` row is the natural
    serialisation point: it is the pivot both doors resolve the person by,
    and it is already the OUTERMOST level of the product's lock hierarchy
    (utilisateur → intent → demande → facture → centre, correctif S4).

    **S9 (revue adversariale) — la garde regarde DEUX tables, pas une.**
    Le réseau des pharmacies a introduit une 5ᵉ casquette et sa propre
    garde de séparation des pouvoirs, mais dans un seul sens : elle refuse
    d'inscrire un exploitant ACTIF dans une officine. La sortie restait
    ouverte, et c'est la faille de S5 rejouée à l'identique — inscrire la
    personne dans l'officine d'abord, lui donner la 4ᵉ casquette ensuite,
    et elle valide sa propre pharmacie, suspend celle d'en face et lit les
    pièces de tout le réseau. Une garde qui ne tient que dans un sens n'est
    pas une garde ; celle-ci en tient maintenant deux, sous le MÊME verrou
    de ligne ``User`` (le pivot par lequel les trois portes résolvent la
    personne).
    """
    from apps.pharmacy.models import PharmacyMembership

    get_user_model().objects.select_for_update().get(pk=user.pk)
    if StaffMembership.objects.filter(user=user, is_active=True).exists():
        raise ValidationError(DIRECTOR_AS_OPERATOR_MESSAGE)
    if PharmacyMembership.objects.filter(user=user, is_active=True).exists():
        raise ValidationError(PHARMACY_MEMBER_AS_OPERATOR_MESSAGE)


@transaction.atomic
def create_platform_staff(*, actor, phone, role, first_name="", last_name=""):
    """Create a Chioni operator — the FOURTH hat (ADR 0017 décision 1).

    Referenced by PHONE, like every other human of the platform (ADR 0001):
    the account is created as a SHADOW when the number is unknown
    (unusable password) and its holder takes possession of it by OTP. **No
    password is ever transmitted out of band**, not even for Chioni's own
    team.

    Refusals, all in French: an unknown/invalid number (normalisation
    E.164), an account that already holds an operator row (change its role
    instead — :func:`update_platform_staff`), and an account holding an
    ACTIVE staff membership in a center (separation of duties).
    """
    if role not in PlatformStaff.Role.values:
        raise ValidationError("Rôle d'exploitant inconnu.")
    user, created = get_or_create_shadow_user(phone)
    if created and (first_name or last_name):
        user.first_name = first_name
        user.last_name = last_name
        user.save(update_fields=["first_name", "last_name"])
    if PlatformStaff.objects.filter(user=user).exists():
        raise ValidationError(
            "Ce compte fait déjà partie de l'équipe Chioni : changez son "
            "rôle ou réactivez-le plutôt que d'en créer un second."
        )
    _refuse_center_staff_as_operator(user)
    operator = PlatformStaff.objects.create(
        user=user, role=role, is_active=True
    )
    audit(
        actor=actor, action=AuditAction.PLATFORM_STAFF_CREATED, target=operator,
        # References only — never the phone, never the name (ADR 0007).
        platform_staff_id=operator.pk, user_id=user.pk, role=operator.role,
        account_created=created,
    )
    return operator


@transaction.atomic
def update_platform_staff(*, actor, operator, role=None, is_active=None):
    """Change an operator's role and/or activation — ``admin`` only.

    The ONE guard, and it is the same one the RGPD erasure already runs
    (:func:`_is_last_platform_admin`, whose ordered ``FOR UPDATE`` closed
    the « two concurrent last admins » race of the S4 review): the last
    ACTIVE ``admin`` can neither be demoted to ``support`` nor deactivated.
    Losing every administrator would lock Chioni out of its own back-office
    with only the Django admin — now read-only — to rebuild one.

    The reading is DELIBERATELY not duplicated here: the day the guard
    changes, both callers must change together, and that only happens if
    there is one function.

    **Second guard, added by the revue guardian S5: REACTIVATING a revoked
    operator row replays the creation guard.** Without it the separation of
    duties had a three-call bypass, self-service, from the back-office
    alone and WITHOUT the second number the ADR names as the honest
    residual: deactivate the operator → seed him director through
    ``POST /platform/centers/{pk}/directors/`` (the S4 guard only looks at
    ACTIVE operator rows, so it no longer sees one) → reactivate. The end
    state is the exact escalation S4 spent a review closing — one human
    holding the fourth hat AND a tenant hat, minted entirely by the
    platform. Reactivating a revoked row IS creating one; it carries the
    same guard.

    What this does NOT close, on purpose (ADR 0018 lot 3 §19): the
    TENANT's own door. A director remains free to hire somebody who works
    at Chioni — that is HIS decision, and it stays traced. A role change on
    such an account is untouched too; only the platform re-minting a
    revoked fourth hat is refused.
    """
    if role is not None and role not in PlatformStaff.Role.values:
        raise ValidationError("Rôle d'exploitant inconnu.")
    get_user_model().objects.select_for_update().get(pk=operator.user_id)
    # LOCK ORDER — utilisateur → ensemble ordonné des sièges ``admin`` → la
    # ligne visée. Le siège se prend AVANT la ligne, et c'est le point
    # (revue guardian S5) : verrouiller d'abord la ligne visée puis un
    # ensemble qui la CONTIENT fait prendre les mêmes verrous dans deux
    # ordres dès que deux exploitants sont rétrogradés en même temps —
    # PostgreSQL tranche par un deadlock, donc un 500 sur une route de
    # gouvernance au lieu du refus français prévu. L'ensemble contient
    # déjà la ligne visée quand elle compte, si bien que la relecture
    # ci-dessous n'ajoute aucun verrou.
    is_last_admin = _is_last_platform_admin(operator.user, lock=True)
    operator = PlatformStaff.objects.select_for_update().get(pk=operator.pk)
    if is_active is True and not operator.is_active:
        _refuse_center_staff_as_operator(operator.user)
    changed = []
    loses_admin = operator.is_active and operator.role == PlatformStaff.Role.ADMIN and (
        (role is not None and role != PlatformStaff.Role.ADMIN)
        or is_active is False
    )
    if loses_admin and is_last_admin:
        raise ValidationError(LAST_PLATFORM_ADMIN_MESSAGE)
    if role is not None and role != operator.role:
        operator.role = role
        changed.append("role")
    if is_active is not None and is_active != operator.is_active:
        operator.is_active = is_active
        changed.append("is_active")
    if not changed:
        raise ValidationError("Aucun changement demandé.")
    operator.save(update_fields=changed + ["updated_at"])
    audit(
        actor=actor, action=AuditAction.PLATFORM_STAFF_UPDATED, target=operator,
        platform_staff_id=operator.pk, user_id=operator.user_id,
        role=operator.role, is_active=operator.is_active,
        fields=",".join(sorted(changed)),
    )
    return operator
