"""S1 — practitioner directory (`GET /centers/{c}/practitioners/`).

Manque n° 1 du frontend (audit C.1) : tout staff actif lit la liste des
praticiens cliniques ACTIFS du centre (le sélecteur RDV n'a plus à se
rabattre sur ``stats/activity``). Payload minimal, non paginé, cloisonné.
"""

import pytest

from apps.centers.models import StaffMembership
from apps.centers.services import deactivate_staff_member

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import make_user

pytestmark = pytest.mark.django_db


def url(center):
    return f"/api/v1/centers/{center.pk}/practitioners/"


class TestPractitionerDirectory:
    def test_any_staff_reads_clinical_roles_only(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        nurse = make_staff_user(center, role=Role.NURSE)
        midwife = make_staff_user(center, role=Role.MIDWIFE)
        make_staff_user(center, role=Role.SECRETARY)
        make_staff_user(center, role=Role.CASHIER)
        make_staff_user(center, role=Role.PHARMACIST)
        secretary = make_staff_user(center, role=Role.SECRETARY)

        response = client_for(secretary).get(url(center))

        assert response.status_code == 200, response.content
        rows = response.data  # nude array: NOT paginated (feeds a <select>)
        assert isinstance(rows, list)
        assert {r["role"] for r in rows} == {
            Role.DOCTOR, Role.NURSE, Role.MIDWIFE,
        }
        listed_ids = {r["id"] for r in rows}
        expected = set(
            StaffMembership.objects.filter(
                center=center,
                user__in=[doctor, nurse, midwife],
            ).values_list("pk", flat=True)
        )
        assert listed_ids == expected

    def test_payload_is_minimal(self):
        center, _ = make_center_with_director()
        make_staff_user(center, role=Role.DOCTOR)
        secretary = make_staff_user(center, role=Role.SECRETARY)
        (row,) = client_for(secretary).get(url(center)).data
        assert set(row.keys()) == {"id", "display_name", "role", "avatar"}
        # No phone anywhere: the directory is not the staff admin screen.
        assert "phone" not in str(row)

    def test_a_newly_recruited_doctor_appears_without_any_encounter(self):
        """The exact frontend gap: stats/activity only lists practitioners
        who already consulted — the directory lists them from day one."""
        center, director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        assert client_for(secretary).get(url(center)).data == []
        client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/",
            {"phone": "+2693398765", "role": Role.DOCTOR,
             "first_name": "Ben Ali", "last_name": "Soilihi"},
        )
        (row,) = client_for(secretary).get(url(center)).data
        assert row["display_name"] == "Ben Ali Soilihi"

    def test_deactivated_practitioners_disappear(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        secretary = make_staff_user(center, role=Role.SECRETARY)
        membership = StaffMembership.objects.get(user=doctor, center=center)
        deactivate_staff_member(actor=director, membership=membership)
        assert client_for(secretary).get(url(center)).data == []

    def test_tenancy_and_hats(self):
        center, _ = make_center_with_director()
        make_staff_user(center, role=Role.DOCTOR)
        other_center, _ = make_center_with_director()
        outsider = make_staff_user(other_center, role=Role.SECRETARY)
        assert client_for(outsider).get(url(center)).status_code == 404
        assert client_for().get(url(center)).status_code == 401
        patient = make_claimed_patient()
        assert client_for(patient.user).get(url(center)).status_code == 404
        assert client_for(make_user()).get(url(center)).status_code == 404

    def test_directory_never_lists_a_foreign_centers_practitioner(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        other_center, _ = make_center_with_director()
        make_staff_user(other_center, role=Role.DOCTOR)  # foreign doctor
        assert client_for(secretary).get(url(center)).data == []
