"""Enriched staff management — PATCH /centers/{c}/staff/{pk}/ + PATCH /auth/me/.

Role changes are money-adjacent sensitive actions (ADR 0008): director
only, audited, guarded (last active director, duplicate role). Identity
follows the SAME rule as patient profiles (R-API-2): a shadow account
that was never claimed is editable by the director; an activated account
manages its own identity through PATCH /auth/me/.
"""

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.centers.models import StaffMembership

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .factories import make_staff, make_user

pytestmark = pytest.mark.django_db


def staff_url(center, membership):
    return f"/api/v1/centers/{center.pk}/staff/{membership.pk}/"


def add_shadow_staff(client, center, role="secretaire", phone="+2693390021"):
    """Create a staff member through the API (shadow account — unusable
    password, phone never verified), mirroring the real desk flow."""
    response = client.post(
        f"/api/v1/centers/{center.pk}/staff/",
        {"phone": phone, "role": role, "first_name": "Nadjda", "last_name": "Said"},
    )
    assert response.status_code == 201, response.content
    return StaffMembership.objects.get(pk=response.data["id"])


class TestStaffRolePatch:
    def test_anonymous_is_401(self):
        center, director = make_center_with_director()
        membership = add_shadow_staff(client_for(director), center)
        assert client_for().patch(
            staff_url(center, membership), {"role": "caissier"}
        ).status_code == 401

    def test_director_changes_role_and_audits(self):
        center, director = make_center_with_director()
        client = client_for(director)
        membership = add_shadow_staff(client, center, role="secretaire")

        response = client.patch(staff_url(center, membership), {"role": "caissier"})

        assert response.status_code == 200, response.content
        assert response.data["role"] == "caissier"
        membership.refresh_from_db()
        assert membership.role == "caissier"
        entry = AuditLog.objects.get(action="staff.membership_updated")
        assert entry.payload["old_role"] == "secretaire"
        assert entry.payload["role"] == "caissier"
        assert "role" in entry.payload["fields"]

    def test_non_director_is_403(self):
        center, director = make_center_with_director()
        membership = add_shadow_staff(client_for(director), center)
        doctor = make_staff_user(center, role=Role.DOCTOR)
        assert client_for(doctor).patch(
            staff_url(center, membership), {"role": "caissier"}
        ).status_code == 403

    def test_foreign_center_is_404(self):
        center, director = make_center_with_director()
        membership = add_shadow_staff(client_for(director), center)
        _other, other_director = make_center_with_director(name="Autre")
        assert client_for(other_director).patch(
            staff_url(center, membership), {"role": "caissier"}
        ).status_code == 404

    def test_membership_of_another_center_is_404_through_my_center(self):
        """IDOR by pk: my center in the URL + a foreign membership pk."""
        center, director = make_center_with_director()
        other_center, other_director = make_center_with_director(name="Autre")
        foreign = add_shadow_staff(
            client_for(other_director), other_center, phone="+2693390077"
        )
        assert client_for(director).patch(
            staff_url(center, foreign), {"role": "caissier"}
        ).status_code == 404

    def test_last_active_director_cannot_be_demoted(self):
        center, director = make_center_with_director()
        membership = StaffMembership.objects.get(user=director, center=center)
        response = client_for(director).patch(
            staff_url(center, membership), {"role": "medecin"}
        )
        assert response.status_code == 400
        assert "dernier directeur" in str(response.data)
        membership.refresh_from_db()
        assert membership.role == Role.DIRECTOR

    def test_director_demotion_allowed_when_another_active_director_exists(self):
        center, director = make_center_with_director()
        make_staff(user=make_user(), center=center, role=Role.DIRECTOR)
        membership = StaffMembership.objects.get(user=director, center=center)
        response = client_for(director).patch(
            staff_url(center, membership), {"role": "medecin"}
        )
        assert response.status_code == 200
        membership.refresh_from_db()
        assert membership.role == Role.DOCTOR

    def test_inactive_director_does_not_count_as_backup(self):
        center, director = make_center_with_director()
        backup = make_staff(user=make_user(), center=center, role=Role.DIRECTOR)
        backup.is_active = False
        backup.save(update_fields=["is_active", "updated_at"])
        membership = StaffMembership.objects.get(user=director, center=center)
        assert client_for(director).patch(
            staff_url(center, membership), {"role": "medecin"}
        ).status_code == 400

    def test_role_already_held_is_400(self):
        center, director = make_center_with_director()
        client = client_for(director)
        user = make_user()
        make_staff(user=user, center=center, role=Role.NURSE)
        second = make_staff(user=user, center=center, role=Role.MIDWIFE)
        response = client.patch(staff_url(center, second), {"role": "infirmier"})
        assert response.status_code == 400
        assert "déjà ce rôle" in str(response.data)

    def test_deactivated_membership_is_not_editable(self):
        center, director = make_center_with_director()
        client = client_for(director)
        membership = add_shadow_staff(client, center)
        client.post(staff_url(center, membership) + "deactivate/")
        response = client.patch(staff_url(center, membership), {"role": "caissier"})
        assert response.status_code == 400
        assert "désactivé" in str(response.data)

    def test_get_detail_returns_membership(self):
        center, director = make_center_with_director()
        client = client_for(director)
        membership = add_shadow_staff(client, center)
        response = client.get(staff_url(center, membership))
        assert response.status_code == 200
        assert response.data["user"]["first_name"] == "Nadjda"


class TestStaffIdentityPatch:
    def test_shadow_account_identity_is_editable_by_director(self):
        center, director = make_center_with_director()
        client = client_for(director)
        membership = add_shadow_staff(client, center)

        response = client.patch(
            staff_url(center, membership),
            {"first_name": "Nadjidati", "last_name": "Saïd"},
        )

        assert response.status_code == 200, response.content
        membership.user.refresh_from_db()
        assert membership.user.first_name == "Nadjidati"
        assert membership.user.last_name == "Saïd"
        entry = AuditLog.objects.get(action="staff.membership_updated")
        assert entry.payload["fields"] == "first_name,last_name"

    def test_activated_account_identity_is_refused(self):
        """OTP-verified phone = the person claimed their account: same rule
        as patient identity, only the owner edits it."""
        center, director = make_center_with_director()
        client = client_for(director)
        membership = add_shadow_staff(client, center)
        user = membership.user
        user.phone_verified_at = timezone.now()
        user.save(update_fields=["phone_verified_at"])

        response = client.patch(
            staff_url(center, membership), {"first_name": "Autre"}
        )

        assert response.status_code == 400
        assert "activé" in str(response.data)
        user.refresh_from_db()
        assert user.first_name == "Nadjda"

    def test_password_account_identity_is_refused(self):
        """A usable password (staff created by back-office) is an owned
        account too — the director cannot rewrite the person's name."""
        center, director = make_center_with_director()
        colleague = make_staff_user(center, role=Role.NURSE)  # has a password
        membership = StaffMembership.objects.get(user=colleague, center=center)
        response = client_for(director).patch(
            staff_url(center, membership), {"first_name": "Autre"}
        )
        assert response.status_code == 400

    def test_role_change_still_works_on_activated_account(self):
        """The identity lock never blocks the ROLE change — the membership
        belongs to the center even when the account belongs to the person."""
        center, director = make_center_with_director()
        colleague = make_staff_user(center, role=Role.NURSE)
        membership = StaffMembership.objects.get(user=colleague, center=center)
        response = client_for(director).patch(
            staff_url(center, membership), {"role": "sage_femme"}
        )
        assert response.status_code == 200
        membership.refresh_from_db()
        assert membership.role == Role.MIDWIFE


class TestPatchMe:
    def test_anonymous_is_401(self):
        assert client_for().patch(
            "/api/v1/auth/me/", {"first_name": "X"}
        ).status_code == 401

    def test_user_updates_their_own_name(self):
        user = make_user()
        response = client_for(user).patch(
            "/api/v1/auth/me/", {"first_name": "Halima", "last_name": "Abdou"}
        )
        assert response.status_code == 200, response.content
        assert response.data["first_name"] == "Halima"
        user.refresh_from_db()
        assert user.first_name == "Halima"
        assert user.last_name == "Abdou"

    def test_phone_and_username_are_never_writable(self):
        """The phone is the identity pivot (OTP-verified) and the username a
        technical key: submitted values are ignored, rows untouched."""
        user = make_user()
        original_phone, original_username = user.phone, user.username
        response = client_for(user).patch(
            "/api/v1/auth/me/",
            {"first_name": "Halima", "phone": "+2693999999", "username": "pirate"},
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.phone == original_phone
        assert user.username == original_username

    def test_partial_patch_keeps_other_field(self):
        user = make_user()
        client_for(user).patch("/api/v1/auth/me/", {"last_name": "Mohamed"})
        user.refresh_from_db()
        client_for(user).patch("/api/v1/auth/me/", {"first_name": "Fatima"})
        user.refresh_from_db()
        assert user.first_name == "Fatima"
        assert user.last_name == "Mohamed"
