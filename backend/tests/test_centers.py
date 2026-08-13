"""Center (tenant) invariants: scoped querysets, cumulative roles, tariffs."""

import pytest
from django.db import IntegrityError

from apps.centers.models import StaffMembership, TariffItem

from .factories import make_center, make_staff, make_tariff, make_user

pytestmark = pytest.mark.django_db


class TestTenantScoping:
    def test_for_center_isolates_staff_and_tariffs(self):
        center_a = make_center(name="Clinique Salama")
        center_b = make_center(name="Centre de santé de Domoni")
        staff_a = make_staff(center=center_a)
        make_staff(center=center_b)
        tariff_a = make_tariff(center_a)
        make_tariff(center_b)

        assert list(StaffMembership.objects.for_center(center_a)) == [staff_a]
        assert list(TariffItem.objects.for_center(center_a)) == [tariff_a]


class TestCumulativeRoles:
    def test_same_user_can_hold_roles_in_several_centers(self):
        dr_said = make_user(username="dr_said")
        clinic = make_center(name="Clinique Salama")
        hospital = make_center(name="Hôpital El-Maarouf")

        make_staff(user=dr_said, center=clinic, role=StaffMembership.Role.DOCTOR)
        make_staff(user=dr_said, center=clinic, role=StaffMembership.Role.DIRECTOR)
        make_staff(user=dr_said, center=hospital, role=StaffMembership.Role.DOCTOR)

        assert dr_said.staff_memberships.count() == 3

    def test_same_role_twice_in_same_center_is_refused(self):
        membership = make_staff()

        with pytest.raises(IntegrityError):
            make_staff(
                user=membership.user,
                center=membership.center,
                role=membership.role,
            )


class TestTariffs:
    def test_tariff_code_is_unique_per_center_not_globally(self):
        center_a = make_center()
        center_b = make_center(name="Cabinet Dr Saïd")
        make_tariff(center_a, code="CS001")
        make_tariff(center_b, code="CS001")  # same code, other tenant: fine

        with pytest.raises(IntegrityError):
            make_tariff(center_a, code="CS001")
