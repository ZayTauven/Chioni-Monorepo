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
from apps.common import notifications
from apps.common.phones import normalize_phone
from apps.medical.models import Consent, Encounter, HealthRecordEntry
from apps.patients.models import (
    GuardianLink,
    GuardianProfile,
    PatientInsurance,
    PatientProfile,
)

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


#: Every declarative phone field of a patient identity dict (R-API-5):
#: normalised to E.164 before ANY write — S3 added ``phone_alt`` and the
#: emergency contact's phone alongside the historical ``phone``.
_IDENTITY_PHONE_FIELDS = ("phone", "phone_alt", "emergency_contact_phone")


def _normalize_identity(identity):
    """Normalise the declarative phone fields of a patient identity dict.

    Blank stays blank (the desk may not know the number); anything present
    must be a real E.164-normalisable phone.
    """
    normalized = dict(identity)
    for field in _IDENTITY_PHONE_FIELDS:
        if normalized.get(field):
            normalized[field] = normalize_phone(normalized[field])
    return normalized


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
        center=center, door="C", center_id=center.pk, patient_id=profile.pk,
    )
    link = None
    if guardian_phone:
        link = invite_guardian(
            actor=actor,
            patient=profile,
            phone=guardian_phone,
            relationship=guardian_relationship or GuardianLink.Relationship.OTHER,
            initiated_by=GuardianLink.InitiatedBy.CENTER,
            center=center,
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


#: Fields a patient owns once the profile is claimed (R-API-2). S3 (ADR
#: 0016 §1): the extended administrative identity joins the set as-is — a
#: claimed profile's address, second phone, national id and emergency
#: contact belong to the patient exactly like their name.
IDENTITY_FIELDS = frozenset(
    {
        "first_name", "last_name", "birth_date", "sex", "phone", "city",
        "address", "phone_alt", "national_id",
        "emergency_contact_name", "emergency_contact_phone",
        "emergency_contact_relationship",
    }
)


@transaction.atomic
def update_patient_profile(*, actor, profile, center=None, **fields):
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
        center=center, patient_id=profile.pk, fields=",".join(sorted(fields)),
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


def _suspend_links_for_claimant_confirmation(*, profile, actor):
    """OTP-1 — when the titulaire ARRIVES on a profile, every surviving
    guardian link drops to ``PENDING_CLAIMANT_CONFIRMATION``.

    Three doors lead here (invariant éthique — « est-ce bien votre
    proche ? ») :

    1. **revendication OTP** (:func:`claim_profile`) ;
    2. **fusion — lien déplacé** sur une cible déjà revendiquée
       (:func:`merge_profiles`, étape 1) ;
    3. **fusion — transfert du titulaire** : l'utilisateur revendiqué de la
       source atterrit sur la cible, dont les liens survivants n'ont jamais
       été confirmés par lui (:func:`merge_profiles`, étape 3).

    The door-A case « patient without a smartphone, managed by their
    guardian » stays legitimate WHILE the profile is unclaimed (the link is
    ACTIVE, the guardian manages the administrative record). The moment the
    titulaire takes possession — by OTP claim or by merge transfer —
    control returns to them: no link keeps its visibility without their
    explicit confirmation. Applies to the real family guardian too — that
    is the point. Self-guardianship links were already revoked (final) by
    the caller and are skipped; an already-PENDING link (merge doors) is
    idempotently skipped — never re-suspended, re-audited or re-counted.
    """
    suspended = 0
    for link in profile.guardian_links.exclude(
        status__in=(
            GuardianLink.Status.REVOKED,
            GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION,
        )
    ):
        previous_status = link.status
        link.suspend_for_claimant_confirmation()
        audit(
            actor=actor, action=AuditAction.LINK_PENDING_CONFIRMATION, target=link,
            link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
            previous_status=previous_status,
        )
        suspended += 1
    return suspended


@transaction.atomic
def claim_profile(*, user, profile):
    """Attach a verified user to an unclaimed profile (called by the OTP
    auto-claim — ADR 0010).

    OTP-1 (revue guardian): claiming a profile SUSPENDS every surviving
    guardian link (``PENDING_CLAIMANT_CONFIRMATION``) — the declarative
    phone never grants a live link, and thus visibility, without the
    titulaire's explicit consent. The patient (re)activates each link via
    :func:`confirm_guardian_link` or refuses it via
    :func:`decline_guardian_link`.
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
    suspended = _suspend_links_for_claimant_confirmation(profile=profile, actor=user)
    if suspended:
        # Événement 3 (notifications métier) : un seul SMS générique quel
        # que soit le nombre de liens suspendus — jamais le nom du tuteur.
        notifications.notify_links_pending_confirmation(profile)
    return profile


@transaction.atomic
def confirm_guardian_link(*, patient_user, link):
    """The titulaire confirms a link left pending by their claim (OTP-1).

    Only the patient the link is about may confirm, and only from
    ``PENDING_CLAIMANT_CONFIRMATION``. Confirmation (re)activates the link
    with the minimal payments scope (ADR 0004) — clinical detail still
    requires a separate explicit consent.
    """
    if link.patient.user_id != patient_user.pk:
        raise ValidationError("Ce lien de tutelle ne vous concerne pas.")
    if link.status != GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION:
        raise ValidationError(
            "Ce lien n'est pas en attente de votre confirmation."
        )
    link.status = GuardianLink.Status.ACTIVE
    link.accepted_at = timezone.now()
    link.save(update_fields=["status", "accepted_at", "updated_at"])
    audit(
        actor=patient_user, action=AuditAction.LINK_CONFIRMED, target=link,
        link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
    )
    return link


@transaction.atomic
def decline_guardian_link(*, patient_user, link):
    """The titulaire refuses a link left pending by their claim (OTP-1).

    Refusal REVOKES the link (final — a new relationship needs a fresh
    invitation), so a stranger who pre-seeded a profile with the victim's
    phone is cleanly and permanently cut off.
    """
    if link.patient.user_id != patient_user.pk:
        raise ValidationError("Ce lien de tutelle ne vous concerne pas.")
    if link.status != GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION:
        raise ValidationError(
            "Ce lien n'est pas en attente de votre confirmation."
        )
    link.revoke()
    audit(
        actor=patient_user, action=AuditAction.LINK_DECLINED, target=link,
        link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
    )
    return link


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
def update_guardian_profile(*, profile, **fields):
    """S2 — the guardian updates their own profile (through ``save()``).

    Field-by-field decision (documented — audit C.4):

    - ``country_of_residence`` : modifiable (people move; it is display/
      context data, consumed by nothing structural).
    - ``preferred_currency`` : modifiable — it is NOT consumed by the
      trustbridge quotes (devis are structurally EUR→KMF, rate and
      amounts frozen on the PaymentIntent at pay time, ADR 0009), so
      changing it can never rewrite a past or in-flight payment. It is a
      display preference only; if multi-currency quotes ever exist, the
      quote must keep freezing its own currency, never read this field
      live.
    - identity (first/last name) : lives on ``User`` → already covered by
      ``PATCH /auth/me/`` — not duplicated here.

    Deliberately NOT audited: same class as ``create_guardian_profile``
    (neither money, nor medical, nor consent, nor role — outside the
    sensitive-action catalogue).
    """
    for name, value in fields.items():
        setattr(profile, name, value)
    profile.save()
    return profile


@transaction.atomic
def invite_guardian(*, actor, patient, phone, relationship, initiated_by,
                    center=None):
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
        center=center,
        link_id=link.pk, patient_id=patient.pk, guardian_id=guardian.pk,
        initiated_by=initiated_by, status=link.status,
    )
    # Événement 1 (notifications métier) : SMS d'invitation au tuteur —
    # après commit seulement, texte volontairement anonyme.
    notifications.notify_guardian_invited(link)
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
    # Événement 2 (notifications métier) : SMS au patient s'il a un téléphone.
    notifications.notify_invitation_accepted(link)
    return link


@transaction.atomic
def decline_invitation(*, link, guardian_user):
    """The invited guardian declines — the link is REVOKED (final).

    Symmetric of :func:`accept_link`, aligned on the existing revoke
    semantics (M2): a refused invitation is definitive, a new relationship
    needs a fresh invitation — never a resurrection of this row. Audited
    as a link revocation with the decline reason reference (same pattern
    as the ``self_guardianship`` revocations).
    """
    if link.guardian.user_id != guardian_user.pk:
        raise ValidationError("Cette invitation ne vous est pas destinée.")
    if link.status != GuardianLink.Status.INVITATION_SENT:
        raise ValidationError("Cette invitation n'est plus en attente.")
    link.revoke()
    audit(
        actor=guardian_user, action=AuditAction.LINK_REVOKED, target=link,
        link_id=link.pk, patient_id=link.patient_id, guardian_id=link.guardian_id,
        reason="invitation_declined",
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
# Consents collected AT THE DESK — UNCLAIMED patients only (S2, ADR 0004)
# ---------------------------------------------------------------------------
#
# Audit C.4: an unclaimed patient could never grant `detail_clinique` (the
# consent endpoints require IsPatientSelf) and the center had no way to
# record a consent collected at the desk (paper form / orally). These two
# services close that hole under STRICT conditions:
#
# - UNCLAIMED patients ONLY — a claimed patient manages their own consents
#   from their space, the desk is refused with an explicit 400;
# - ACTIVE link of THIS patient only (single refusal message covering the
#   foreign, revoked and non-existent cases alike — S1 body-ref norm);
# - the collection trace (WHO at the desk, HOW) lives on the Consent row
#   (`collected_by` / `collected_via`) and the audit entry;
# - REVERSIBILITY is inherited, not added: the claim gate (OTP-1) suspends
#   every surviving link and revokes its active consents — a desk-collected
#   consent dies at the exact moment the patient takes possession of their
#   profile, like any other consent (verrouillé par test).


#: Single 400 for every way a body-referenced link can be wrong for this
#: patient (foreign patient, revoked, pending, non-existent) — S1 norm:
#: byte-identical, nothing leaks.
_DESK_LINK_REFUSAL = "Ce lien de tutelle n'est pas un lien actif de ce patient."

#: A claimed patient owns their consents — the desk is out (both grant
#: and revoke answer this exact 400).
_DESK_CLAIMED_REFUSAL = (
    "Ce patient gère lui-même ses consentements depuis son espace."
)


def resolve_desk_consent_link(*, patient, link_pk):
    """Resolve a body-referenced link for the desk-consent endpoints.

    ACTIVE links of ``patient`` only; anything else (foreign, revoked,
    pending, non-existent) answers the SAME explicit 400 (S1 norm for
    body references — deterministic, nothing to probe).
    """
    link = GuardianLink.objects.filter(
        patient=patient, status=GuardianLink.Status.ACTIVE, pk=link_pk
    ).first()
    if link is None:
        raise ValidationError(_DESK_LINK_REFUSAL)
    return link


@transaction.atomic
def grant_clinical_consent_at_center(*, actor, center, patient, link,
                                     collected_via):
    """Record a clinical consent collected at the desk (porte C).

    The patient — unclaimed, often without a smartphone (Mariama) —
    expressed their consent at the desk, on paper or orally; the center
    records it. Same ``Consent`` machinery as the in-app grant
    (``active_scopes`` stays THE source of truth), plus the collection
    trace. Guards are re-checked here for direct service callers; the
    view resolves patient (URL → 404) and link (body → 400) upstream.
    """
    # TOCTOU close (revue adversariale S2): the view resolves ``patient``
    # and ``link`` BEFORE this transaction, so a claim (OTP-1) racing this
    # call would leave the in-memory instances stale — ``patient.is_claimed``
    # and ``link.status`` would read the pre-claim values and let a clinical
    # consent slip PAST the claim gate, resurrecting the moment the titulaire
    # confirms the link. Re-read BOTH rows under ``select_for_update`` so the
    # desk grant and the claim serialise on the patient row (the claim updates
    # it before suspending links): a claim that commits first is SEEN
    # (refused), a grant that commits first is caught by the claim's
    # consent-revoking suspension. Same lock order (patient → link) as
    # ``claim_profile`` — no deadlock.
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    link = GuardianLink.objects.select_for_update().get(pk=link.pk)
    if patient.is_claimed:
        raise ValidationError(_DESK_CLAIMED_REFUSAL)
    if link.patient_id != patient.pk or link.status != GuardianLink.Status.ACTIVE:
        raise ValidationError(_DESK_LINK_REFUSAL)
    if collected_via not in Consent.CollectedVia.values:
        raise ValidationError("Mode de recueil invalide : papier ou oral.")
    if Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL):
        raise ValidationError("Ce consentement est déjà accordé.")
    consent = Consent.objects.create(
        patient=link.patient,
        guardian_link=link,
        scope=Consent.Scope.CLINICAL_DETAIL,
        collected_by=actor,
        collected_via=collected_via,
    )
    audit(
        actor=actor, action=AuditAction.CONSENT_GRANTED_BY_CENTER,
        target=consent, center=center, consent_id=consent.pk, link_id=link.pk,
        patient_id=link.patient_id, guardian_id=link.guardian_id,
        center_id=center.pk, scope=str(Consent.Scope.CLINICAL_DETAIL),
        collected_via=str(collected_via),
    )
    return consent


@transaction.atomic
def revoke_clinical_consent_at_center(*, actor, center, patient, link):
    """Withdraw a clinical consent from the desk (porte C) — the patient
    changed their mind at the counter. Unclaimed patients only, same
    strict link resolution as the grant — including the row-locked re-read
    that closes the claim-vs-desk race (symmetry with the grant; here a
    stale read is harmless — revoking only ever REMOVES a scope — but the
    refusal semantics must stay honest against a concurrent claim)."""
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    link = GuardianLink.objects.select_for_update().get(pk=link.pk)
    if patient.is_claimed:
        raise ValidationError(_DESK_CLAIMED_REFUSAL)
    if link.patient_id != patient.pk or link.status != GuardianLink.Status.ACTIVE:
        raise ValidationError(_DESK_LINK_REFUSAL)
    consent = (
        Consent.objects.active()
        .filter(guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL)
        .first()
    )
    if consent is None:
        raise ValidationError("Aucun consentement clinique actif sur ce lien.")
    consent.revoke()
    audit(
        actor=actor, action=AuditAction.CONSENT_REVOKED_BY_CENTER,
        target=consent, center=center, consent_id=consent.pk, link_id=link.pk,
        patient_id=link.patient_id, guardian_id=link.guardian_id,
        center_id=center.pk, scope=str(Consent.Scope.CLINICAL_DETAIL),
    )
    return consent


# ---------------------------------------------------------------------------
# Insurance / mutuelle (S3, ADR 0016 §6) — administrative-financial data
# ---------------------------------------------------------------------------


@transaction.atomic
def create_patient_insurance(*, actor, center, patient, **fields):
    """Record an insurance line for a patient (billing roles, desk).

    Transversal ownership (ADR 0002): the row is anchored on the patient;
    ``center`` only contextualises the audit entry (where it was typed).
    Payload contract: ids only — never the insurer name or member number.
    """
    insurance = PatientInsurance.objects.create(
        patient=patient, created_by=actor, **fields
    )
    audit(
        actor=actor, action=AuditAction.PATIENT_INSURANCE_CREATED,
        target=insurance, center=center,
        insurance_id=insurance.pk, patient_id=patient.pk, center_id=center.pk,
    )
    return insurance


@transaction.atomic
def update_patient_insurance(*, actor, center, insurance, **fields):
    """Update an insurance line — through ``save()``, audited (field names
    only, never values)."""
    for name, value in fields.items():
        setattr(insurance, name, value)
    insurance.save()
    audit(
        actor=actor, action=AuditAction.PATIENT_INSURANCE_UPDATED,
        target=insurance, center=center, insurance_id=insurance.pk,
        patient_id=insurance.patient_id, center_id=center.pk,
        fields=",".join(sorted(fields)),
    )
    return insurance


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
    - **Documents & insurances (S3, ADR 0016)** → re-anchored on the target;
      **medical file** → the target keeps its own, the source's is taken
      over ONLY if the target has none (otherwise it stays on the
      tombstone — nothing medical is deleted, no automatic pick between
      two clinical contents); **vital signs** follow their encounters.
    - **Stays (S6, ADR 0019)** → re-anchored on the target, right after the
      encounters they pivot on (the order satisfies ``Stay.save()``'s
      same-patient invariant); rooms, beds and bed assignments stay put —
      they belong to the CENTER, and they hang off the stay.
    - **Appointments** → re-anchored on the target too (revue adversariale
      vague 1) : un RDV laissé sur le tombstone enverrait le rappel J-1 au
      téléphone déclaratif du doublon (potentiellement celui d'un tiers) et
      rendrait le RDV inhonorable via la création d'encounter (le POST
      résout le patient parmi les profils canoniques seulement).
    - **Guardian links** → moved to the target; when the same guardian
      already has a link on the target (or would become guardian of their
      own profile), the source link is REVOKED instead (its consents die
      with it — cascade).
    - **Consents** riding a moved link → re-anchored on the target so the
      same-patient invariant keeps holding.
    - **Claimed user** → transferred if exactly one side is claimed; merging
      two CLAIMED profiles is refused (identity conflict → manual/OTP
      resolution, never an automatic pick). The transfer is the TROISIÈME
      porte de ``PENDING_CLAIMANT_CONFIRMATION`` : les liens survivants de
      la cible sont suspendus jusqu'à confirmation du titulaire, exactement
      comme à la revendication OTP.
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

    moved_links = revoked_links = suspended_links = 0

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
        # OTP-1 via the merge door — deuxième porte de
        # PENDING_CLAIMANT_CONFIRMATION (revue guardian): a link landing on
        # a CLAIMED target must pass the SAME claimant-confirmation gate as
        # at claim time — it never stays ACTIVE (nor INVITATION_SENT, which
        # could be accepted into ACTIVE) without the titulaire's consent.
        # Merging onto an UNCLAIMED target is unchanged here (the guardian
        # keeps managing the administrative record) — UNLESS step 3 below
        # transfers the titulaire onto it (troisième porte). REVOKED is
        # final and left alone; an already-PENDING link is idempotently
        # skipped.
        if (
            target.user_id is not None
            and link.status not in (
                GuardianLink.Status.REVOKED,
                GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION,
            )
        ):
            previous_status = link.status
            link.suspend_for_claimant_confirmation()
            audit(
                actor=actor, action=AuditAction.LINK_PENDING_CONFIRMATION,
                target=link, link_id=link.pk, patient_id=link.patient_id,
                guardian_id=link.guardian_id, previous_status=previous_status,
            )
            suspended_links += 1

    # 2. Medical data — the carnet reunites on the canonical profile.
    # VitalSigns rows need no step of their own: they hang off their
    # encounter (``encounter__patient``) and follow it here (S3).
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

    # 2 quater (S6, ADR 0019 invariant 5) — les SÉJOURS suivent la cible.
    # L'ordre compte : les consultations viennent d'être ré-ancrées, donc
    # l'invariant structurel de ``Stay.save()`` (« la consultation pivot
    # concerne ce patient ») est déjà satisfait quand on arrive ici. Un
    # séjour laissé sur le tombstone disparaîtrait du carnet du patient
    # canonique — c'est-à-dire l'épisode le plus lourd de son histoire.
    # Chambres, lits et occupations ne bougent pas : ce sont des ressources
    # du CENTRE, rattachées au séjour, pas au patient.
    from apps.inpatient.models import Stay

    stays_moved = 0
    for stay in Stay.objects.for_patient(source):
        stay.patient = target
        stay.save(update_fields=["patient", "updated_at"])
        stays_moved += 1

    # 2 ter (S3, ADR 0016) — the enriched record reunites too. Local import
    # mirroring the scheduling one below: patients stays a leaf dependency
    # of medical's new tables.
    from apps.medical.models import PatientDocument, PatientMedicalFile

    documents_moved = 0
    for document in PatientDocument.objects.for_patient(source):
        document.patient = target
        document.save(update_fields=["patient", "updated_at"])
        documents_moved += 1
    insurances_moved = 0
    for insurance in PatientInsurance.objects.filter(patient=source):
        insurance.patient = target
        insurance.save(update_fields=["patient", "updated_at"])
        insurances_moved += 1
    # Medical file: OneToOne — the TARGET keeps its own file; the source's
    # is taken over ONLY when the target has none (ADR 0016, invariant 1).
    # When both exist, the duplicate's file stays on the tombstone: nothing
    # medical is deleted, and no automatic pick between two clinical
    # contents is ever made.
    medical_file_moved = False
    source_file = PatientMedicalFile.objects.filter(patient=source).first()
    if (
        source_file is not None
        and not PatientMedicalFile.objects.filter(patient=target).exists()
    ):
        source_file.patient = target
        source_file.save(update_fields=["patient", "updated_at"])
        medical_file_moved = True

    # 2 bis. Appointments — same reunification as the carnet (whatever the
    # center: encounters above move regardless of center too). Local import
    # mirroring apps.medical.services: scheduling stays a leaf dependency.
    from apps.scheduling.models import Appointment

    appointments_moved = 0
    for appointment in Appointment.objects.filter(patient=source):
        appointment.patient = target
        appointment.save(update_fields=["patient", "updated_at"])
        appointments_moved += 1

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
        # Troisième porte de PENDING_CLAIMANT_CONFIRMATION (revue guardian
        # de l'incrément notifications, 2026-08-13) : le titulaire vient
        # d'ARRIVER sur la cible par le transfert — ses liens survivants
        # (ceux qui préexistaient sur la cible ET ceux déplacés depuis la
        # source à l'étape 1) n'ont jamais été confirmés par lui SUR CE
        # PROFIL. Sans cette suspension, un lien ACTIF semé sur la cible
        # non revendiquée gardait sa visibilité « paiements » sur le profil
        # fraîchement revendiqué, sans consentement — exactement la faille
        # que la porte de revendication ferme. Les liens déjà confirmés sur
        # la source repassent par la porte (sur-confirmation assumée : un
        # écran, jamais un accès silencieux).
        suspended_links += _suspend_links_for_claimant_confirmation(
            profile=target, actor=actor
        )

    # 4. Tombstone: the source now points to its canonical profile.
    source.merged_into = target
    source.save()

    audit(
        actor=actor, action=AuditAction.PATIENT_MERGED, target=target,
        center=center,
        source_id=source.pk, target_id=target.pk, center_id=center.pk,
        links_moved=moved_links, links_revoked=revoked_links,
        links_suspended=suspended_links,
        encounters_moved=encounters_moved, entries_moved=entries_moved,
        appointments_moved=appointments_moved, stays_moved=stays_moved,
        documents_moved=documents_moved, insurances_moved=insurances_moved,
        medical_file_moved=medical_file_moved,
        user_transferred=user_transferred,
    )
    if suspended_links:
        # Événement 3 (notifications métier), porte fusion : des liens ont
        # atterri en attente de confirmation sur le profil revendiqué du
        # titulaire — même SMS générique qu'à la revendication.
        notifications.notify_links_pending_confirmation(target)
    return target
