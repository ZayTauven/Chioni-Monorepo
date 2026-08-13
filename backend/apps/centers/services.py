"""Center domain services — staff and tariff writes, audited (finding M1).

Role changes and tariff changes are money-adjacent sensitive actions:
every write below goes through ``save()`` and journalises its audit entry
in the same transaction.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import AuditAction, audit
from apps.centers.models import StaffMembership, TariffItem
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
        membership_id=membership.pk, center_id=center.pk,
        user_id=user.pk, role=role,
    )
    return membership


def _is_last_active_director(membership):
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
    """
    if membership.role != StaffMembership.Role.DIRECTOR:
        return False
    directors = list(
        StaffMembership.objects.for_center(membership.center)
        .filter(role=StaffMembership.Role.DIRECTOR, is_active=True)
        .order_by("pk")
        .select_for_update()
    )
    return all(director.pk == membership.pk for director in directors)


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
        center_id=center.pk, fields=",".join(sorted(fields)),
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
        center_id=center.pk, fields="logo",
    )
    return center


@transaction.atomic
def remove_center_logo(*, actor, center):
    """Director removes the logo — physical file deleted, no orphans."""
    if not clear_file(center, "logo"):
        raise ValidationError("Ce centre n'a pas de logo.")
    audit(
        actor=actor, action=AuditAction.CENTER_UPDATED, target=center,
        center_id=center.pk, fields="logo", cleared=True,
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
        tariff_id=tariff.pk, center_id=tariff.center_id, code=tariff.code,
        price_kmf=tariff.price_kmf, generic_category=tariff.generic_category,
        fields=",".join(sorted(fields)),
    )
    return tariff
