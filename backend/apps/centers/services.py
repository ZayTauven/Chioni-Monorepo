"""Center domain services — staff and tariff writes, audited (finding M1).

Role changes and tariff changes are money-adjacent sensitive actions:
every write below goes through ``save()`` and journalises its audit entry
in the same transaction.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import AuditAction, audit
from apps.centers.models import StaffMembership, TariffItem
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


@transaction.atomic
def deactivate_staff_member(*, actor, membership):
    """Director deactivates a membership (never deleted — history stays).

    Guard: the last active director of a center cannot be deactivated —
    a tenant without any director would be locked out of its own space.
    """
    if not membership.is_active:
        raise ValidationError("Ce membre est déjà désactivé.")
    if membership.role == StaffMembership.Role.DIRECTOR:
        other_directors = (
            StaffMembership.objects.for_center(membership.center)
            .filter(role=StaffMembership.Role.DIRECTOR, is_active=True)
            .exclude(pk=membership.pk)
        )
        if not other_directors.exists():
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
