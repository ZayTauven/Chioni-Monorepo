"""Patient domain services — the ONLY write paths for patient identity,
guardianship links and consents.

CLAUDE.md engineering rule: GuardianLink / PatientProfile invariants live in
``save()``/``clean()`` — every write below goes through ``save()`` (or a
model method that does), NEVER through raw ``update()``/``bulk_update()``.

Every sensitive action writes its immutable audit entry (finding M1) via
``apps.audit.services.audit`` inside the same transaction.
"""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.common.phones import normalize_phone
from apps.medical.models import Consent, Encounter, HealthRecordEntry
from apps.patients.models import GuardianLink, GuardianProfile, PatientProfile

#: Bounded ascent for canonical-profile resolution (R4): merge chains are
#: expected to be short (a duplicate absorbed once); anything deeper than
#: this is pathological and must stop with a clean error, never a loop.
MERGE_MAX_HOPS = 20


# ---------------------------------------------------------------------------
# Users referenced by phone (guardian attach, staff onboarding)
# ---------------------------------------------------------------------------


def get_or_create_shadow_user(phone):
    """Return the user holding ``phone``, creating a non-loggable shadow
    account if none exists yet.

    Doors A/B/C all reference third parties by phone before those people
    ever open the app (needs study §3). The shadow account has an unusable
    password: it becomes loggable only through the OTP claim chantier —
    creating it grants NO access to anyone.

    R-API-5: the phone is normalised to E.164 BEFORE any match or creation,
    so « +269… » and « 269… » always converge to the same account.
    """
    phone = normalize_phone(phone)
    User = get_user_model()
    user = User.objects.filter(phone=phone).first()
    if user is not None:
        return user, False
    # Collision-safe username: a leftover account may squat the canonical
    # « invite-… » name with a different (or cleared) phone — suffix instead
    # of crashing with an IntegrityError.
    base_username = f"invite-{phone.lstrip('+')}"
    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base_username}-{suffix}"
    user = User.objects.create_user(username=username, phone=phone, password=None)
    return user, True


def _normalize_identity(identity):
    """Normalise the declarative ``phone`` of a patient identity dict.

    Blank stays blank (the desk may not know the number); anything present
    must be a real E.164-normalisable phone.
    """
    if identity.get("phone"):
        identity = {**identity, "phone": normalize_phone(identity["phone"])}
    return identity


# ---------------------------------------------------------------------------
# Patient profiles — one creation service per door
# ---------------------------------------------------------------------------


@transaction.atomic
def create_patient_at_center(*, actor, center, guardian_phone=None,
                             guardian_relationship=None, **identity):
    """Door C — desk creation by center staff.

    The profile stays UNCLAIMED (limited creator rights until the patient
    activates by OTP). Optionally attaches a guardian by phone: the link
    starts as ``invitation_envoyee`` (initiated_by=centre) — the guardian
    must accept before anything opens, even the minimal payments scope.
    """
    identity = _normalize_identity(identity)
    profile = PatientProfile.objects.create(
        claim_status=PatientProfile.ClaimStatus.UNCLAIMED,
        created_by_user=actor,
        created_by_center=center,
        **identity,
    )
    audit(
        actor=actor, action=AuditAction.PATIENT_CREATED, target=profile,
        door="C", center_id=center.pk, patient_id=profile.pk,
    )
    link = None
    if guardian_phone:
        link = invite_guardian(
            actor=actor,
            patient=profile,
            phone=guardian_phone,
            relationship=guardian_relationship or GuardianLink.Relationship.OTHER,
            initiated_by=GuardianLink.InitiatedBy.CENTER,
        )
    return profile, link


@transaction.atomic
def create_protege(*, guardian_user, relationship, **identity):
    """Door A — a guardian registers a protected relative.

    The profile is UNCLAIMED; the link is ACTIVE immediately (the guardian
    created and manages this profile — there is nobody to accept yet; the
    protégé is invited to claim by OTP later, and can revoke once active).
    An active link only ever opens the minimal payments scope (ADR 0004).
    """
    identity = _normalize_identity(identity)
    profile_obj = guardian_profile_required(guardian_user)
    profile = PatientProfile.objects.create(
        claim_status=PatientProfile.ClaimStatus.UNCLAIMED,
        created_by_user=guardian_user,
        **identity,
    )
    link = GuardianLink.objects.create(
        guardian=profile_obj,
        patient=profile,
        relationship=relationship,
        status=GuardianLink.Status.ACTIVE,
        initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
        accepted_at=timezone.now(),
    )
    audit(
        actor=guardian_user, action=AuditAction.PATIENT_CREATED, target=profile,
        door="A", patient_id=profile.pk,
    )
    audit(
        actor=guardian_user, action=AuditAction.LINK_CREATED, target=link,
        link_id=link.pk, patient_id=profile.pk, guardian_id=profile_obj.pk,
        initiated_by=link.initiated_by, status=link.status,
    )
    return profile, link


@transaction.atomic
def create_own_profile(*, user, **identity):
    """Door B — the patient creates and owns their profile (claimed at birth)."""
    identity = _normalize_identity(identity)
    if PatientProfile.objects.filter(user=user).exists():
        raise ValidationError("Vous avez déjà un profil patient.")
    profile = PatientProfile.objects.create(
        user=user,
        claim_status=PatientProfile.ClaimStatus.ACTIVE,
        created_by_user=user,
        **identity,
    )
    audit(
        actor=user, action=AuditAction.PATIENT_CREATED, target=profile,
        door="B", patient_id=profile.pk,
    )
    return profile


#: Fields a patient owns once the profile is claimed (R-API-2).
IDENTITY_FIELDS = frozenset(
    {"first_name", "last_name", "birth_date", "sex", "phone", "city"}
)


@transaction.atomic
def update_patient_profile(*, actor, profile, **fields):
    """Identity update — through ``save()``, audited.

    R-API-2: once a profile is CLAIMED, its identity belongs to the patient.
    Desk staff keep free editing on unclaimed profiles only; on a claimed
    profile, any identity change by someone else than the owner is refused.
    """
    if (
        profile.is_claimed
        and actor.pk != profile.user_id
        and IDENTITY_FIELDS & set(fields)
    ):
        raise ValidationError(
            "Ce profil est géré par le patient : seule la personne concernée "
            "peut modifier son identité."
        )
    fields = _normalize_identity(fields)
    for name, value in fields.items():
        setattr(profile, name, value)
    profile.save()
    audit(
        actor=actor, action=AuditAction.PATIENT_UPDATED, target=profile,
        patient_id=profile.pk, fields=",".join(sorted(fields)),
    )
    return profile


def _revoke_self_guardianship_links(*, profile, user, actor):
    """Kill any link that would make ``user`` guardian of their OWN profile.

    Claiming (or receiving through a merge) a profile that a guardian
    created about *themselves* would materialise self-guardianship — the
    M7 invariant forbids creating such links, so attaching the user must
    revoke the ones that become self-referential.
    """
    revoked = 0
    for link in profile.guardian_links.filter(guardian__user=user).exclude(
        status=GuardianLink.Status.REVOKED
    ):
        link.revoke()
        audit(
            actor=actor, action=AuditAction.LINK_REVOKED, target=link,
            link_id=link.pk, patient_id=link.patient_id,
            guardian_id=link.guardian_id, reason="self_guardianship",
        )
        revoked += 1
    return revoked


@transaction.atomic
def claim_profile(*, user, profile):
    """Attach a verified user to an unclaimed profile (OTP chantier will be
    the caller). Exposed as a service now so merge/tests exercise the audit
    contract; no public endpoint before OTP exists.
    """
    if profile.merged_into_id is not None:
        raise ValidationError(
            "Ce profil a été fusionné dans un autre : revendiquez le profil canonique."
        )
    if profile.user_id is not None:
        raise ValidationError("Ce profil est déjà revendiqué.")
    if PatientProfile.objects.filter(user=user).exists():
        raise ValidationError("Cet utilisateur a déjà un profil patient.")
    _revoke_self_guardianship_links(profile=profile, user=user, actor=user)
    profile.user = user
    profile.claim_status = PatientProfile.ClaimStatus.ACTIVE
    profile.save()
    audit(
        actor=user, action=AuditAction.PATIENT_CLAIMED, target=profile,
        patient_id=profile.pk, user_id=user.pk,
    )
    return profile


# ---------------------------------------------------------------------------
# Guardianship links
# ---------------------------------------------------------------------------


def guardian_profile_required(user):
    try:
        return user.guardian_profile
    except GuardianProfile.DoesNotExist:
        raise ValidationError("Créez d'abord votre profil tuteur.")


@transaction.atomic
def create_guardian_profile(*, user, **fields):
    if GuardianProfile.objects.filter(user=user).exists():
        raise ValidationError("Vous avez déjà un profil tuteur.")
    return GuardianProfile.objects.create(user=user, **fields)


@transaction.atomic
def invite_guardian(*, actor, patient, phone, relationship, initiated_by):
    """Doors B and C — invite a guardian by phone onto ``patient``.

    Creates (or finds) the guardian's account+profile by phone and opens a
    link in ``invitation_envoyee``: NOTHING is visible to the guardian until
    they accept (and even then, only the minimal payments scope).
    """
    user, _created = get_or_create_shadow_user(phone)
    guardian, _ = GuardianProfile.objects.get_or_create(user=user)
    existing = GuardianLink.objects.filter(guardian=guardian, patient=patient).first()
    if existing is not None:
        if existing.status == GuardianLink.Status.REVOKED:
            # Model limitation (documented for guardian review): the unique
            # (guardian, patient) constraint keeps the revoked row, so the
            # same pair cannot be re-linked without a schema evolution.
            raise ValidationError(
                "Un lien révoqué existe déjà entre ce tuteur et ce patient : "
                "le ré-établissement n'est pas encore pris en charge."
            )
        raise ValidationError("Un lien existe déjà entre ce tuteur et ce patient.")
    link = GuardianLink.objects.create(
        guardian=guardian,
        patient=patient,
        relationship=relationship,
        status=GuardianLink.Status.INVITATION_SENT,
        initiated_by=initiated_by,
    )
    audit(
        actor=actor, action=AuditAction.LINK_CREATED, target=link,
        link_id=link.pk, patient_id=patient.pk, guardian_id=guardian.pk,
        initiated_by=initiated_by, status=link.status,
    )
    return link


@transaction.atomic
def accept_link(*, link, guardian_user):
    """The invited guardian accepts — the link becomes ACTIVE (minimal scope)."""
    if link.guardian.user_id != guardian_user.pk:
        raise ValidationError("Cette invitation ne vous est pas destinée.")
    if link.status != GuardianLink.Status.INVITATION_SENT:
        raise ValidationError("Cette invitation n'est plus en attente.")
    link.status = GuardianLink.Status.ACTIVE
    link.accepted_at = timezone.now()
    link.save(update_fields=["status", "accepted_at", "updated_at"])
    audit(
        actor=guardian_user, action=AuditAction.LINK_ACCEPTED, target=link,
        link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
    )
    return link


@transaction.atomic
def revoke_link(*, link, actor):
    """Revocation — by the patient OR the guardian, always via ``revoke()``
    (cascades onto active consents, final at model+DB level)."""
    if link.status == GuardianLink.Status.REVOKED:
        raise ValidationError("Ce lien est déjà révoqué.")
    link.revoke()
    audit(
        actor=actor, action=AuditAction.LINK_REVOKED, target=link,
        link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
    )
    return link


# ---------------------------------------------------------------------------
# Consents — the PATIENT alone grants/revokes the clinical-detail scope
# ---------------------------------------------------------------------------


@transaction.atomic
def grant_clinical_consent(*, patient_user, link):
    """Grant ``detail_clinique`` on an ACTIVE link of the calling patient."""
    if link.patient.user_id != patient_user.pk:
        raise ValidationError("Seul le patient concerné peut accorder ce consentement.")
    if link.status != GuardianLink.Status.ACTIVE:
        raise ValidationError(
            "Le consentement ne peut être accordé que sur un lien de tutelle actif."
        )
    if Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL):
        raise ValidationError("Ce consentement est déjà accordé.")
    consent = Consent.objects.create(
        patient=link.patient,
        guardian_link=link,
        scope=Consent.Scope.CLINICAL_DETAIL,
    )
    audit(
        actor=patient_user, action=AuditAction.CONSENT_GRANTED, target=consent,
        consent_id=consent.pk, link_id=link.pk, patient_id=link.patient_id,
        scope=str(Consent.Scope.CLINICAL_DETAIL),
    )
    return consent


@transaction.atomic
def revoke_clinical_consent(*, patient_user, link):
    """Revoke ``detail_clinique`` — effective immediately on permissions."""
    if link.patient.user_id != patient_user.pk:
        raise ValidationError("Seul le patient concerné peut révoquer ce consentement.")
    consent = (
        Consent.objects.active()
        .filter(guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL)
        .first()
    )
    if consent is None:
        raise ValidationError("Aucun consentement clinique actif sur ce lien.")
    consent.revoke()
    audit(
        actor=patient_user, action=AuditAction.CONSENT_REVOKED, target=consent,
        consent_id=consent.pk, link_id=link.pk, patient_id=link.patient_id,
        scope=str(Consent.Scope.CLINICAL_DETAIL),
    )
    return consent


# ---------------------------------------------------------------------------
# Duplicate merge (R4 closure)
# ---------------------------------------------------------------------------


def resolve_canonical(profile):
    """Follow the ``merged_into`` chain to the canonical profile.

    R4 closure — the model's save() guard can be bypassed by queryset
    ``update()``, so a cycle CAN exist in the database: resolution is
    bounded (``MERGE_MAX_HOPS``) and cycle-detected (visited set), failing
    with a clean French error instead of looping forever.
    """
    seen = {profile.pk}
    current = profile
    for _ in range(MERGE_MAX_HOPS):
        if current.merged_into_id is None:
            return current
        current = PatientProfile.objects.get(pk=current.merged_into_id)
        if current.pk in seen:
            raise ValidationError(
                "Chaîne de fusion cyclique détectée : résolution impossible, "
                "intervention manuelle requise."
            )
        seen.add(current.pk)
    raise ValidationError(
        "Chaîne de fusion trop profonde : résolution impossible, "
        "intervention manuelle requise."
    )


@transaction.atomic
def merge_profiles(*, source, target, actor, center):
    """Absorb duplicate ``source`` into canonical ``target`` (staff only,
    both profiles inside the center's perimeter — enforced by the view).

    What moves, and why (documented re-attachment):

    - **Encounters and health record entries** → re-anchored on the target
      (the carnet belongs to the patient; fragments must reunite).
    - **Guardian links** → moved to the target; when the same guardian
      already has a link on the target (or would become guardian of their
      own profile), the source link is REVOKED instead (its consents die
      with it — cascade).
    - **Consents** riding a moved link → re-anchored on the target so the
      same-patient invariant keeps holding.
    - **Claimed user** → transferred if exactly one side is claimed; merging
      two CLAIMED profiles is refused (identity conflict → manual/OTP
      resolution, never an automatic pick).
    - **Invoices / payment data** → NOT moved: outside draft the patient
      anchor is frozen by a DB trigger (ADR 0006). The absorbed profile
      remains as a tombstone whose ``merged_into`` points to the canonical
      one — financial history stays exact, canonical resolution follows.
    """
    if source.pk == target.pk:
        raise ValidationError("Un profil ne peut pas être fusionné avec lui-même.")
    if source.merged_into_id is not None:
        raise ValidationError("Le profil source a déjà été absorbé par une fusion.")
    # R4: never trust the requested target — resolve it to canonical first,
    # with the bounded, cycle-safe ascent.
    target = resolve_canonical(target)
    if target.pk == source.pk:
        raise ValidationError(
            "Fusion refusée : la cible se résout vers le profil source (cycle)."
        )
    if source.user_id and target.user_id:
        raise ValidationError(
            "Fusion refusée : les deux profils sont revendiqués — résolution "
            "manuelle requise (vérification d'identité)."
        )

    moved_links = revoked_links = 0

    # 1. Guardian links (+ their consents) — save()/revoke() only.
    for link in source.guardian_links.select_related("guardian").all():
        duplicate_exists = GuardianLink.objects.filter(
            guardian=link.guardian, patient=target
        ).exists()
        would_self_guard = (
            target.user_id is not None
            and link.guardian.user_id == target.user_id
        )
        if duplicate_exists or would_self_guard:
            if link.status != GuardianLink.Status.REVOKED:
                link.revoke()
                revoked_links += 1
            continue
        link.patient = target
        link.save()
        for consent in link.consents.all():
            consent.patient = target
            consent.save(update_fields=["patient", "updated_at"])
        moved_links += 1

    # 2. Medical data — the carnet reunites on the canonical profile.
    encounters_moved = 0
    for encounter in Encounter.objects.for_patient(source):
        encounter.patient = target
        encounter.save(update_fields=["patient", "updated_at"])
        encounters_moved += 1
    entries_moved = 0
    for entry in HealthRecordEntry.objects.for_patient(source):
        entry.patient = target
        entry.save(update_fields=["patient", "updated_at"])
        entries_moved += 1

    # 3. Claimed user transfer (at most one side claimed — checked above).
    user_transferred = False
    if source.user_id and not target.user_id:
        claimed_user = source.user
        source.user = None
        source.claim_status = PatientProfile.ClaimStatus.UNCLAIMED
        source.save()  # frees the OneToOne before re-attaching
        # A link on the target whose guardian IS the transferred user would
        # become self-guardianship the moment the user lands — revoke first.
        revoked_links += _revoke_self_guardianship_links(
            profile=target, user=claimed_user, actor=actor
        )
        target.user = claimed_user
        target.claim_status = PatientProfile.ClaimStatus.ACTIVE
        target.save()
        user_transferred = True

    # 4. Tombstone: the source now points to its canonical profile.
    source.merged_into = target
    source.save()

    audit(
        actor=actor, action=AuditAction.PATIENT_MERGED, target=target,
        source_id=source.pk, target_id=target.pk, center_id=center.pk,
        links_moved=moved_links, links_revoked=revoked_links,
        encounters_moved=encounters_moved, entries_moved=entries_moved,
        user_transferred=user_transferred,
    )
    return target
