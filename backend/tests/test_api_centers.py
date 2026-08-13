"""Centers API — tenant isolation matrix (ADR 0002) and role gates.

For every endpoint: anonymous → 401 ; wrong hat → 403/404 ;
cross-center IDOR → 404 (queryset scoping, never object-level luck).
"""

import pytest

from apps.audit.models import AuditLog
from apps.centers.models import StaffMembership, TariffItem

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_center, make_staff, make_tariff, make_user

pytestmark = pytest.mark.django_db


class TestCenterListAndDetail:
    def test_anonymous_is_401(self):
        center = make_center()
        assert client_for().get("/api/v1/centers/").status_code == 401
        assert client_for().get(f"/api/v1/centers/{center.pk}/").status_code == 401

    def test_staff_lists_only_their_centers(self):
        center_a, director = make_center_with_director(name="Clinique Salama")
        make_center(name="Polyclinique Ndzuwani")  # not mine

        response = client_for(director).get("/api/v1/centers/")

        assert response.status_code == 200
        assert [c["id"] for c in response.data["results"]] == [center_a.pk]

    def test_cross_center_retrieve_is_404(self):
        _center_a, director = make_center_with_director()
        other = make_center(name="Autre centre")

        assert client_for(director).get(f"/api/v1/centers/{other.pk}/").status_code == 404

    def test_non_staff_hat_gets_404_not_403(self):
        """A guardian probing a center id learns nothing — 404."""
        center = make_center()
        guardian_user, _ = make_guardian_user()
        assert client_for(guardian_user).get(f"/api/v1/centers/{center.pk}/").status_code == 404

    def test_director_updates_their_center(self):
        center, director = make_center_with_director()
        response = client_for(director).patch(
            f"/api/v1/centers/{center.pk}/", {"address": "Route de la Corniche"}
        )
        assert response.status_code == 200
        center.refresh_from_db()
        assert center.address == "Route de la Corniche"
        assert AuditLog.objects.filter(action="center.updated").count() == 1

    def test_kyc_status_is_never_writable_by_the_tenant(self):
        center, director = make_center_with_director(kyc_status="en_attente")
        response = client_for(director).patch(
            f"/api/v1/centers/{center.pk}/", {"kyc_status": "actif"}
        )
        assert response.status_code == 200  # silently ignored (read-only field)
        center.refresh_from_db()
        assert center.kyc_status == "en_attente"

    def test_non_director_staff_cannot_update(self):
        center, _director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        response = client_for(doctor).patch(
            f"/api/v1/centers/{center.pk}/", {"name": "Renommée"}
        )
        assert response.status_code == 403


class TestStaffEndpoints:
    def test_anonymous_is_401(self):
        center = make_center()
        assert client_for().get(f"/api/v1/centers/{center.pk}/staff/").status_code == 401

    def test_non_member_is_404(self):
        center, _ = make_center_with_director()
        outsider_center, outsider_director = make_center_with_director()
        response = client_for(outsider_director).get(f"/api/v1/centers/{center.pk}/staff/")
        assert response.status_code == 404
        assert outsider_center.pk != center.pk

    def test_member_without_director_role_is_403(self):
        center, _director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        assert client_for(doctor).get(f"/api/v1/centers/{center.pk}/staff/").status_code == 403

    def test_director_creates_staff_by_phone(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/",
            {"phone": "+2693390001", "role": "infirmier",
             "first_name": "Faïza", "last_name": "Mohamed"},
        )
        assert response.status_code == 201, response.content
        assert response.data["role"] == "infirmier"
        assert response.data["user"]["phone"] == "+2693390001"
        assert AuditLog.objects.filter(action="staff.membership_created").count() == 1

    def test_deactivate_staff(self):
        center, director = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        membership = StaffMembership.objects.get(user=nurse, center=center)

        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/{membership.pk}/deactivate/"
        )

        assert response.status_code == 200
        membership.refresh_from_db()
        assert membership.is_active is False
        assert AuditLog.objects.filter(action="staff.membership_deactivated").count() == 1

    def test_last_director_cannot_be_deactivated(self):
        center, director = make_center_with_director()
        membership = StaffMembership.objects.get(user=director, center=center)
        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/{membership.pk}/deactivate/"
        )
        assert response.status_code == 400
        membership.refresh_from_db()
        assert membership.is_active is True

    def test_cross_center_staff_deactivation_is_404(self):
        center_a, director_a = make_center_with_director()
        center_b, _director_b = make_center_with_director()
        foreign_membership = StaffMembership.objects.get(center=center_b)

        response = client_for(director_a).post(
            f"/api/v1/centers/{center_a.pk}/staff/{foreign_membership.pk}/deactivate/"
        )

        assert response.status_code == 404
        foreign_membership.refresh_from_db()
        assert foreign_membership.is_active is True


class TestTariffEndpoints:
    def test_anonymous_is_401(self):
        center = make_center()
        assert client_for().get(f"/api/v1/centers/{center.pk}/tariffs/").status_code == 401

    def test_any_staff_reads_the_grid(self):
        center, _director = make_center_with_director()
        make_tariff(center, label="Consultation générale")
        doctor = make_staff_user(center, role=Role.DOCTOR)
        response = client_for(doctor).get(f"/api/v1/centers/{center.pk}/tariffs/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1

    def test_doctor_cannot_write_the_grid(self):
        center, _director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/tariffs/",
            {"code": "CS1", "label": "Consultation", "price_kmf": "7500",
             "generic_category": "consultation"},
        )
        assert response.status_code == 403

    def test_generic_category_is_required_at_creation(self):
        """ADR 0005 — « autre » is accepted but must be explicit."""
        center, director = make_center_with_director()
        client = client_for(director)

        missing = client.post(
            f"/api/v1/centers/{center.pk}/tariffs/",
            {"code": "CS1", "label": "Consultation", "price_kmf": "7500"},
        )
        assert missing.status_code == 400
        assert "generic_category" in missing.data

        explicit = client.post(
            f"/api/v1/centers/{center.pk}/tariffs/",
            {"code": "CS1", "label": "Consultation", "price_kmf": "7500",
             "generic_category": "autre"},
        )
        assert explicit.status_code == 201
        assert AuditLog.objects.filter(action="tariff.created").count() == 1

    def test_cashier_updates_a_price(self):
        center, _director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        tariff = make_tariff(center)

        response = client_for(cashier).patch(
            f"/api/v1/centers/{center.pk}/tariffs/{tariff.pk}/",
            {"price_kmf": "9000"},
        )

        assert response.status_code == 200
        tariff.refresh_from_db()
        assert str(tariff.price_kmf) == "9000.00"
        assert AuditLog.objects.filter(action="tariff.updated").count() == 1

    def test_duplicate_code_is_refused_with_a_french_message(self):
        center, director = make_center_with_director()
        make_tariff(center, code="CS1")
        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/tariffs/",
            {"code": "CS1", "label": "Doublon", "price_kmf": "100",
             "generic_category": "autre"},
        )
        assert response.status_code == 400

    def test_cross_center_tariff_is_404_even_for_a_director(self):
        center_a, director_a = make_center_with_director()
        center_b, _ = make_center_with_director()
        foreign_tariff = make_tariff(center_b)

        read = client_for(director_a).get(
            f"/api/v1/centers/{center_a.pk}/tariffs/{foreign_tariff.pk}/"
        )
        write = client_for(director_a).patch(
            f"/api/v1/centers/{center_a.pk}/tariffs/{foreign_tariff.pk}/",
            {"price_kmf": "1"},
        )

        assert read.status_code == 404
        assert write.status_code == 404
        foreign_tariff.refresh_from_db()
        assert str(foreign_tariff.price_kmf) == "7500.00"

    def test_the_grid_is_never_visible_from_another_center(self):
        center_a, director_a = make_center_with_director()
        center_b, _ = make_center_with_director()
        make_tariff(center_a, label="Mienne")
        make_tariff(center_b, label="Étrangère")

        response = client_for(director_a).get(f"/api/v1/centers/{center_a.pk}/tariffs/")

        labels = [t["label"] for t in response.data["results"]]
        assert labels == ["Mienne"]
        assert TariffItem.objects.count() == 2
