"""S1 — staff reactivation (`POST /centers/{c}/staff/{pk}/reactivate/`).

Cycle de vie C.2 : deactivation was irreversible by API (an erroneous
click meant the Django admin). Locked here: director only, symmetric of
deactivate, audit, uniqueness held by construction, rights restored.
"""

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.centers.services import deactivate_staff_member

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)

pytestmark = pytest.mark.django_db


def scene():
    center, director = make_center_with_director()
    doctor = make_staff_user(center, role=Role.DOCTOR)
    membership = StaffMembership.objects.get(user=doctor, center=center)
    deactivate_staff_member(actor=director, membership=membership)
    return center, director, doctor, membership


def reactivate_url(center, membership):
    return f"/api/v1/centers/{center.pk}/staff/{membership.pk}/reactivate/"


class TestStaffReactivation:
    def test_director_reactivates_a_deactivated_membership(self):
        center, director, _, membership = scene()
        response = client_for(director).post(reactivate_url(center, membership))
        assert response.status_code == 200, response.content
        assert response.data["is_active"] is True
        entry = AuditLog.objects.get(action=AuditAction.STAFF_REACTIVATED)
        assert entry.payload["membership_id"] == membership.pk

    def test_reactivation_restores_the_rights_of_the_hat(self):
        center, director, doctor, membership = scene()
        url = f"/api/v1/centers/{center.pk}/patients/"
        assert client_for(doctor).get(url).status_code == 404  # inactive: invisible
        client_for(director).post(reactivate_url(center, membership))
        assert client_for(doctor).get(url).status_code == 200

    def test_already_active_is_a_clean_400(self):
        center, director, _, membership = scene()
        client_for(director).post(reactivate_url(center, membership))
        again = client_for(director).post(reactivate_url(center, membership))
        assert again.status_code == 400
        assert "déjà actif" in str(again.data)

    def test_no_duplicate_membership_after_the_cycle(self):
        """The uniqueness guard: deactivate → reactivate never duplicates
        the (user, center, role) row, and re-adding while inactive is
        still refused."""
        center, director, doctor, membership = scene()
        client_for(director).post(reactivate_url(center, membership))
        assert (
            StaffMembership.objects.filter(
                user=doctor, center=center, role=Role.DOCTOR
            ).count()
            == 1
        )
        readd = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/",
            {"phone": doctor.phone, "role": Role.DOCTOR},
        )
        assert readd.status_code == 400  # « a déjà ce rôle dans ce centre »

    def test_non_director_gets_403(self):
        center, _, _, membership = scene()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        response = client_for(secretary).post(reactivate_url(center, membership))
        assert response.status_code == 403
        membership.refresh_from_db()
        assert membership.is_active is False

    def test_cross_center_is_404(self):
        center, _, _, membership = scene()
        _other, other_director = make_center_with_director()
        response = client_for(other_director).post(
            reactivate_url(center, membership)
        )
        assert response.status_code == 404

    def test_foreign_membership_through_my_center_url_is_404(self):
        center, director, _, _ = scene()
        other_center, _ = make_center_with_director()
        foreign_doctor = make_staff_user(other_center, role=Role.DOCTOR)
        foreign = StaffMembership.objects.get(user=foreign_doctor)
        response = client_for(director).post(reactivate_url(center, foreign))
        assert response.status_code == 404
        foreign.refresh_from_db()
        assert foreign.is_active is True  # untouched
