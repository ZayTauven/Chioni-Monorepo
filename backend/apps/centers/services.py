"""Center domain services — staff and tariff writes, audited (finding M1).

Role changes and tariff changes are money-adjacent sensitive actions:
every write below goes through ``save()`` and journalises its audit entry
in the same transaction.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.centers.models import (
    HealthCenter,
    KycDocument,
    StaffMembership,
    TariffItem,
)
from apps.common.uploads import clear_file, process_image_upload, replace_file
from apps.patients.services import get_or_create_shadow_user


@transaction.atomic
def add_staff_member(*, actor, center, phone, role, first_name="", last_name=""):
    """Director adds a staff member, referenced by phone (pivot — ADR 0001).

    The account is created as a shadow (unusable password) when the phone
    is unknown: it becomes loggable through the OTP chantier only.
    """
    user, created = get_or_create_shadow_user(phone)
    if created and (first_name or last_name):
        user.first_name = first_name
        user.last_name = last_name
        user.save(update_fields=["first_name", "last_name"])
    if StaffMembership.objects.filter(user=user, center=center, role=role).exists():
        raise ValidationError("Ce membre a déjà ce rôle dans ce centre.")
    membership = StaffMembership.objects.create(user=user, center=center, role=role)
    audit(
        actor=actor, action=AuditAction.STAFF_CREATED, target=membership,
        center=center,
        membership_id=membership.pk, center_id=center.pk,
        user_id=user.pk, role=role,
    )
    return membership


def _is_last_active_director(membership, *, lock=True):
    """True when ``membership`` is the ONLY active director of its center.

    Shared guard: losing the last director (by deactivation OR by demotion
    to another role) would lock the tenant out of its own space.

    The active director rows are locked ``FOR UPDATE`` in pk order (revue
    adversariale vague 1): two concurrent demotions/deactivations each saw
    « the other director is still there » and BOTH passed, leaving the
    center with zero directors. Ordered row locks serialise the guards —
    the second transaction re-reads after the first commits (Postgres
    re-evaluates the WHERE on locked rows) and correctly refuses. Callers
    are all ``transaction.atomic``.

    ``lock=False`` is for READ-ONLY callers (revue adversariale S4): the
    RGPD back-office queue renders this guard as an INFORMATION
    (``blockers``) inside a plain GET, i.e. outside any atomic block —
    where ``select_for_update`` is not merely useless but a hard
    ``TransactionManagementError`` (HTTP 500). A lock is only legitimate
    when the answer is about to be ACTED upon.
    """
    if membership.role != StaffMembership.Role.DIRECTOR:
        return False
    directors = (
        StaffMembership.objects.for_center(membership.center)
        .filter(role=StaffMembership.Role.DIRECTOR, is_active=True)
        .order_by("pk")
    )
    if lock:
        directors = directors.select_for_update()
    return all(director.pk == membership.pk for director in list(directors))


def centers_locked_by_last_director(user, *, lock):
    """Centers where ``user`` is the LAST active director (S4 lot 3).

    The public face of :func:`_is_last_active_director` for callers outside
    this module — the RGPD erasure guard (``accounts.services``) needs the
    exact same reading, and importing a private name across apps would be
    a rot vector: the day the guard changes, both readings must change
    together, here.

    ``lock`` is EXPLICIT (no default) on purpose: forgetting it is exactly
    how the read path took a row lock outside a transaction and answered
    500. Pass ``lock=True`` from inside ``transaction.atomic`` when the
    answer decides a write (anonymisation), ``lock=False`` when it merely
    informs a screen.
    """
    return [
        membership.center
        for membership in StaffMembership.objects.filter(
            user=user, is_active=True, role=StaffMembership.Role.DIRECTOR
        ).select_related("center")
        if _is_last_active_director(membership, lock=lock)
    ]


@transaction.atomic
def deactivate_staff_member(*, actor, membership):
    """Director deactivates a membership (never deleted — history stays).

    Guard: the last active director of a center cannot be deactivated —
    a tenant without any director would be locked out of its own space.
    """
    if not membership.is_active:
        raise ValidationError("Ce membre est déjà désactivé.")
    if _is_last_active_director(membership):
        raise ValidationError(
            "Impossible de désactiver le dernier directeur actif du centre."
        )
    membership.is_active = False
    membership.save(update_fields=["is_active", "updated_at"])
    audit(
        actor=actor, action=AuditAction.STAFF_DEACTIVATED, target=membership,
        center=membership.center,
        membership_id=membership.pk, center_id=membership.center_id,
        user_id=membership.user_id, role=membership.role,
    )
    return membership


@transaction.atomic
def reactivate_staff_member(*, actor, membership):
    """Director reactivates a deactivated membership (S1 — the symmetric
    of :func:`deactivate_staff_member`, which was irreversible by API).

    Uniqueness holds by construction: deactivation never deletes the row
    and the ``(user, center, role)`` unique constraint spans active AND
    inactive rows (``add_staff_member`` refuses a duplicate even against
    an inactive membership), so flipping ``is_active`` back can never
    create a second membership for the same role.
    """
    if membership.is_active:
        raise ValidationError("Ce membre est déjà actif.")
    membership.is_active = True
    membership.save(update_fields=["is_active", "updated_at"])
    audit(
        actor=actor, action=AuditAction.STAFF_REACTIVATED, target=membership,
        center=membership.center,
        membership_id=membership.pk, center_id=membership.center_id,
        user_id=membership.user_id, role=membership.role,
    )
    return membership


@transaction.atomic
def update_staff_member(*, actor, membership, role=None, first_name=None, last_name=None):
    """Director edits an ACTIVE membership: role change and, for shadow
    accounts only, the person's name.

    Rules (tested in ``tests/test_staff_roles.py``):

    - the membership must be active — a deactivated row is history, not an
      editable record;
    - role change refuses a role the user already holds in this center
      (unique constraint surfaced as a clean French 400) and refuses to
      demote the LAST active director (same lockout guard as deactivation);
    - ``first_name``/``last_name`` are writable ONLY while the account is a
      never-claimed shadow (no verified phone, unusable password) — same
      rule as patient identity (R-API-2): an activated account manages its
      own identity through ``PATCH /auth/me/``.
    """
    if not membership.is_active:
        raise ValidationError(
            "Ce membre est désactivé : seul un membre actif peut être modifié."
        )

    changed = []
    if first_name is not None or last_name is not None:
        user = membership.user
        if user.phone_verified_at is not None or user.has_usable_password():
            raise ValidationError(
                "Ce compte est activé : seule la personne concernée peut "
                "modifier son identité."
            )
        if first_name is not None and first_name != user.first_name:
            user.first_name = first_name
            changed.append("first_name")
        if last_name is not None and last_name != user.last_name:
            user.last_name = last_name
            changed.append("last_name")
        if changed:
            user.save(update_fields=changed)

    old_role = membership.role
    if role is not None and role != membership.role:
        if StaffMembership.objects.filter(
            user=membership.user, center=membership.center, role=role
        ).exists():
            raise ValidationError("Ce membre a déjà ce rôle dans ce centre.")
        if _is_last_active_director(membership):
            raise ValidationError(
                "Impossible de rétrograder le dernier directeur actif du centre."
            )
        membership.role = role
        membership.save(update_fields=["role", "updated_at"])
        changed.append("role")

    if changed:
        audit(
            actor=actor, action=AuditAction.STAFF_UPDATED, target=membership,
            center=membership.center,
            membership_id=membership.pk, center_id=membership.center_id,
            user_id=membership.user_id, old_role=old_role, role=membership.role,
            fields=",".join(sorted(changed)),
        )
    return membership


@transaction.atomic
def update_center(*, actor, center, **fields):
    """Director updates the center profile (kyc_status is NEVER writable here:
    KYC transitions belong to the Chioni back-office, not to the tenant)."""
    fields.pop("kyc_status", None)
    for name, value in fields.items():
        setattr(center, name, value)
    center.save()
    audit(
        actor=actor, action=AuditAction.CENTER_UPDATED, target=center,
        center=center, center_id=center.pk, fields=",".join(sorted(fields)),
    )
    return center


@transaction.atomic
def set_center_logo(*, actor, center, uploaded_file):
    """Director sets/replaces the center logo.

    The file goes through the hardened pipeline (apps/common/uploads.py:
    JPEG/PNG/WebP by real content, 2 Mo, 2048², metadata stripped, uuid
    name) BEFORE any write. Replacement is orphan-free: the row is saved
    pointing at the new file, then the previous file is physically deleted
    (``replace_file``). Audited as a center update — the logo appears on
    receipts, so changing it is a trust-surface action.
    """
    content = process_image_upload(uploaded_file)
    replace_file(center, "logo", content)
    audit(
        actor=actor, action=AuditAction.CENTER_UPDATED, target=center,
        center=center, center_id=center.pk, fields="logo",
    )
    return center


@transaction.atomic
def remove_center_logo(*, actor, center):
    """Director removes the logo — physical file deleted, no orphans."""
    if not clear_file(center, "logo"):
        raise ValidationError("Ce centre n'a pas de logo.")
    audit(
        actor=actor, action=AuditAction.CENTER_UPDATED, target=center,
        center=center, center_id=center.pk, fields="logo", cleared=True,
    )
    return center


@transaction.atomic
def create_tariff(*, actor, center, **fields):
    """Tariff creation — ``generic_category`` is REQUIRED by the serializer
    (default « autre » accepted but always explicit — ADR 0005)."""
    if TariffItem.objects.for_center(center).filter(code=fields.get("code")).exists():
        raise ValidationError("Ce code tarifaire existe déjà dans la grille du centre.")
    tariff = TariffItem.objects.create(center=center, **fields)
    audit(
        actor=actor, action=AuditAction.TARIFF_CREATED, target=tariff,
        center=center,
        tariff_id=tariff.pk, center_id=center.pk, code=tariff.code,
        price_kmf=tariff.price_kmf, generic_category=tariff.generic_category,
    )
    return tariff


@transaction.atomic
def update_tariff(*, actor, tariff, **fields):
    new_code = fields.get("code")
    if new_code and new_code != tariff.code:
        clash = (
            TariffItem.objects.for_center(tariff.center)
            .filter(code=new_code)
            .exclude(pk=tariff.pk)
        )
        if clash.exists():
            raise ValidationError(
                "Ce code tarifaire existe déjà dans la grille du centre."
            )
    for name, value in fields.items():
        setattr(tariff, name, value)
    tariff.save()
    audit(
        actor=actor, action=AuditAction.TARIFF_UPDATED, target=tariff,
        center=tariff.center,
        tariff_id=tariff.pk, center_id=tariff.center_id, code=tariff.code,
        price_kmf=tariff.price_kmf, generic_category=tariff.generic_category,
        fields=",".join(sorted(fields)),
    )
    return tariff


# ---------------------------------------------------------------------------
# S4 (ADR 0017) — tenant lifecycle: the PLATFORM's write paths
# ---------------------------------------------------------------------------
#
# Until this sprint a tenant could only be born in the Django admin and
# ``kyc_status`` could only be flipped there too: an unaudited parallel
# door. These services are now the ONLY product path, and the admin turns
# read-only on the field (ADR 0017, décision 3).

KycStatus = HealthCenter.KycStatus

#: The KYC state machine, explicit and closed (ADR 0017, décision 3).
#: A center is born « en_attente »; « actif » opens the diaspora rail;
#: « suspendu » closes it — and only it (le soin et la caisse continuent).
KYC_TRANSITIONS = {
    KycStatus.PENDING: {KycStatus.ACTIVE, KycStatus.SUSPENDED},
    KycStatus.ACTIVE: {KycStatus.SUSPENDED},
    KycStatus.SUSPENDED: {KycStatus.ACTIVE},
}


@transaction.atomic
def create_center_with_director(
    *, actor, director_phone, director_first_name="", director_last_name="",
    **center_fields,
):
    """Platform onboards a tenant: the center AND its first director, atomically.

    A center without a director is a locked-out tenant (nobody can add
    staff, nothing can start), so the two writes are ONE transaction —
    a failure on the director rolls the center back.

    The director is born as a SHADOW account (``get_or_create_shadow_user``
    through :func:`add_staff_member`): unusable password, no credential is
    ever transmitted out of band. He takes possession of the account by
    OTP, like every other human on the platform (ADR 0010).

    ``kyc_status`` is NEVER an input: a tenant is born « en_attente » and
    only :func:`set_center_kyc_status` moves it (décision 3).
    """
    center_fields.pop("kyc_status", None)
    center = HealthCenter.objects.create(
        kyc_status=KycStatus.PENDING, **center_fields
    )
    audit(
        actor=actor, action=AuditAction.CENTER_CREATED, target=center,
        center=center,
        center_id=center.pk, type=center.type, island=center.island,
        kyc_status=center.kyc_status,
    )
    membership = add_center_director(
        actor=actor,
        center=center,
        phone=director_phone,
        first_name=director_first_name,
        last_name=director_last_name,
    )
    return center, membership


#: French refusal of the separation-of-duties guard below — one sentence,
#: actionable, and identical on both platform write paths.
OPERATOR_AS_DIRECTOR_MESSAGE = (
    "Ce numéro est celui d'un membre de l'équipe Chioni : un exploitant "
    "de la plateforme ne peut pas recevoir de rôle dans un centre par "
    "cette porte. Amorcez le directeur avec le numéro de la personne du "
    "centre."
)


def _refuse_platform_operator_as_director(membership):
    """Separation of duties (revue adversariale S4) — the platform's write
    paths must not hand a TENANT hat to a Chioni operator.

    The invariant of the sprint says the operator sees no clinical data and
    no patient PII (ADR 0017, décision 1), and every ``/platform/`` payload
    honours it. But ``POST /platform/centers/{pk}/directors/`` writes a
    ``StaffMembership``, i.e. it MINTS tenant rights — and the operator
    could mint them onto their OWN account, then walk into
    ``/centers/{c}/patients/`` as a plain director. That is a one-call
    escalation out of the fourth hat and into the first, with nothing but
    an audit line behind it.

    So the seeding door refuses a target that currently holds an ACTIVE
    ``PlatformStaff`` row. It does NOT pretend to make the escalation
    impossible — an operator with a second phone can still be seeded as a
    director of a center — but it removes the self-service path and forces
    the abuse through a DISTINCT identity, which is what separation of
    duties buys. Nothing changes for the tenant's own door
    (``POST /centers/{c}/staff/``): hiring a Chioni employee as a doctor is
    the CENTER's decision, taken by its director, and stays legitimate.

    Raised AFTER the membership row exists, inside the caller's atomic
    block: the rollback takes the shadow account and the audit entry with
    it, and the guard never has to re-implement phone normalisation.
    """
    from apps.accounts.models import PlatformStaff

    if PlatformStaff.objects.filter(
        user_id=membership.user_id, is_active=True
    ).exists():
        raise ValidationError(OPERATOR_AS_DIRECTOR_MESSAGE)


@transaction.atomic
def add_center_director(*, actor, center, phone, first_name="", last_name=""):
    """Platform seeds a director on a center that has none left (ADR 0017).

    The rescue path (accident, departure) — until now the ONLY way back
    was the Django admin. Deliberately NOT conditioned on « the center has
    zero directors »: adding a co-director at the tenant's request is
    legitimate, and ``add_staff_member`` already refuses a duplicate role.

    Guarded by :func:`_refuse_platform_operator_as_director`: this door
    mints tenant rights, so it may not mint them for the operator using it.
    """
    membership = add_staff_member(
        actor=actor,
        center=center,
        phone=phone,
        role=StaffMembership.Role.DIRECTOR,
        first_name=first_name,
        last_name=last_name,
    )
    _refuse_platform_operator_as_director(membership)
    return membership


@transaction.atomic
def set_center_kyc_status(*, actor, center, status, reason=""):
    """THE only path to a KYC transition (platform ``admin`` role).

    Explicit state machine (:data:`KYC_TRANSITIONS`) — an unknown or
    impossible move is refused with a French message, never applied
    silently. ``reason`` is MANDATORY for a suspension: cutting a center
    off the Trust Bridge without a written motive would leave its director
    (and Chioni's support) with nothing to act on.

    Race: the center row is locked, so two operators clicking at once
    serialise (the second re-reads the committed status and either
    no-ops-refuses or applies a legal transition).

    Audit ``center.kyc_changed`` carries the STATUS CODES and whether a
    motive exists — never the motive itself (ADR 0007: free operator text
    is the same class as a dispute reason).
    """
    if status not in KycStatus.values:
        raise ValidationError("Statut KYC inconnu.")
    center = HealthCenter.objects.select_for_update().get(pk=center.pk)
    previous = center.kyc_status
    if status == previous:
        raise ValidationError(
            f"Ce centre est déjà « {KycStatus(status).label} »."
        )
    if status not in KYC_TRANSITIONS.get(previous, set()):
        raise ValidationError(
            f"Transition KYC refusée : un centre « {KycStatus(previous).label} » "
            f"ne peut pas passer à « {KycStatus(status).label} »."
        )
    reason = (reason or "").strip()
    if status == KycStatus.SUSPENDED and not reason:
        raise ValidationError(
            "Le motif est obligatoire pour suspendre un centre : le "
            "directeur doit savoir ce qu'il doit corriger."
        )
    center.kyc_status = status
    center.kyc_reason = reason
    center.kyc_updated_at = timezone.now()
    center.kyc_updated_by = actor
    center.save(
        update_fields=[
            "kyc_status", "kyc_reason", "kyc_updated_at", "kyc_updated_by",
            "updated_at",
        ]
    )
    audit(
        actor=actor, action=AuditAction.CENTER_KYC_CHANGED, target=center,
        center=center,
        center_id=center.pk, old_status=previous, kyc_status=status,
        has_reason=bool(reason),
    )
    return center


@transaction.atomic
def upload_kyc_document(*, actor, center, uploaded_file, doc_type):
    """Director attaches a supporting document to his center's KYC file.

    Same hardened pipeline as every other upload (ADR 0014 — JPEG/PNG/WebP
    by real content, PDF deferred), then the PRIVATE storage: a director's
    ID card is never addressable by a media URL (ADR 0016 §5 reused as is).

    Audit payload: ids + the ``doc_type`` code — never a file name.
    """
    if doc_type not in KycDocument.DocType.values:
        raise ValidationError("Type de pièce KYC invalide.")
    content = process_image_upload(uploaded_file)
    document = KycDocument.objects.create(
        center=center,
        doc_type=doc_type,
        file=content,
        uploaded_by=actor,
    )
    audit(
        actor=actor, action=AuditAction.KYC_DOCUMENT_UPLOADED, target=document,
        center=center,
        kyc_document_id=document.pk, center_id=center.pk,
        doc_type=str(doc_type),
    )
    return document


@transaction.atomic
def archive_kyc_document(*, actor, document):
    """Archive a KYC piece — correction WITHOUT destruction.

    The row and the file stay: a KYC decision must remain auditable
    against the pieces that supported it. Final — the model refuses any
    un-archiving.
    """
    if document.is_archived:
        raise ValidationError("Cette pièce est déjà archivée.")
    document.archived_at = timezone.now()
    document.archived_by = actor
    document.save(update_fields=["archived_at", "archived_by", "updated_at"])
    audit(
        actor=actor, action=AuditAction.KYC_DOCUMENT_ARCHIVED, target=document,
        center=document.center,
        kyc_document_id=document.pk, center_id=document.center_id,
        doc_type=str(document.doc_type),
    )
    return document
