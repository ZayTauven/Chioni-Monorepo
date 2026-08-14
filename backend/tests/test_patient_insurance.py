"""S3 (ADR 0016 §6) — insurance/mutuelle lines (PatientInsurance).

Administrative-FINANCIAL data: read by ANY staff of the perimeter and by
the patient (transversal, ADR 0002); WRITTEN by billing roles only.
Audit: ids and field names — never an insurer name or member number.
"""

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.patients.models import PatientInsurance

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db

#: Exact payload of one insurance line (staff AND patient windows).
INSURANCE_FIELDS = {
    "id", "insurer_name", "member_number", "valid_until", "notes",
    "is_active", "created_at",
}


def url(center, patient):
    return f"/api/v1/centers/{center.pk}/patients/{patient.pk}/insurances/"


def billing_ctx(role=Role.CASHIER):
    center, _ = make_center_with_director()
    staff = make_staff_user(center, role=role)
    patient = make_patient(created_by_center=center)
    return center, staff, patient


def create_line(center, staff, patient, **extra):
    response = client_for(staff).post(
        url(center, patient),
        {"insurer_name": "Mutuelle des Comores", "member_number": "MC-4471",
         **extra},
    )
    assert response.status_code == 201, response.content
    return PatientInsurance.objects.get(pk=response.data["id"])


class TestInsuranceWrites:
    def test_billing_roles_create_a_line(self):
        for role in (Role.CASHIER, Role.SECRETARY, Role.DIRECTOR):
            center, staff, patient = billing_ctx(role=role)
            line = create_line(center, staff, patient)
            assert line.created_by == staff
            assert line.is_active is True

    def test_clinical_and_pharmacist_roles_cannot_write(self):
        center, cashier, patient = billing_ctx()
        for role in (Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST):
            staff = make_staff_user(center, role=role)
            assert client_for(staff).post(
                url(center, patient),
                {"insurer_name": "X", "member_number": "1"},
            ).status_code == 403, role

    def test_required_fields(self):
        center, staff, patient = billing_ctx()
        response = client_for(staff).post(url(center, patient), {})
        assert response.status_code == 400
        assert {"insurer_name", "member_number"} <= set(response.data.keys())

    def test_patch_updates_and_deactivates(self):
        center, staff, patient = billing_ctx()
        line = create_line(center, staff, patient)

        response = client_for(staff).patch(
            f"{url(center, patient)}{line.pk}/",
            {"is_active": False, "notes": "Carte expirée."},
        )

        assert response.status_code == 200, response.content
        assert set(response.data.keys()) == INSURANCE_FIELDS
        line.refresh_from_db()
        assert line.is_active is False

    def test_patch_by_clinical_role_is_403(self):
        center, staff, patient = billing_ctx()
        line = create_line(center, staff, patient)
        doctor = make_staff_user(center, role=Role.DOCTOR)
        assert client_for(doctor).patch(
            f"{url(center, patient)}{line.pk}/", {"is_active": False}
        ).status_code == 403

    def test_audit_never_carries_the_insurer_name_nor_the_number(self):
        center, staff, patient = billing_ctx()
        line = create_line(center, staff, patient)
        client_for(staff).patch(
            f"{url(center, patient)}{line.pk}/", {"member_number": "MC-9999"}
        )

        created = AuditLog.objects.get(action=AuditAction.PATIENT_INSURANCE_CREATED)
        updated = AuditLog.objects.get(action=AuditAction.PATIENT_INSURANCE_UPDATED)
        assert created.payload["insurance_id"] == line.pk
        assert created.payload["center_id"] == center.pk
        assert updated.payload["fields"] == "member_number"
        for payload in (str(created.payload), str(updated.payload)):
            assert "Mutuelle" not in payload
            assert "MC-4471" not in payload
            assert "MC-9999" not in payload


class TestInsuranceReads:
    def test_any_staff_of_the_perimeter_reads(self):
        center, cashier, patient = billing_ctx()
        create_line(center, cashier, patient)
        for role in (Role.DOCTOR, Role.NURSE, Role.PHARMACIST, Role.SECRETARY):
            staff = make_staff_user(center, role=role)
            response = client_for(staff).get(url(center, patient))
            assert response.status_code == 200, role
            assert set(response.data["results"][0].keys()) == INSURANCE_FIELDS

    def test_transversal_a_second_center_sees_the_same_lines(self):
        """The insurance card follows the PERSON (ADR 0002), not the
        center that typed it."""
        center_a, cashier_a, patient = billing_ctx()
        line = create_line(center_a, cashier_a, patient)

        center_b, _ = make_center_with_director()
        make_encounter(patient=patient, center=center_b)
        staff_b = make_staff_user(center_b, role=Role.SECRETARY)

        response = client_for(staff_b).get(url(center_b, patient))
        assert response.status_code == 200
        assert [row["id"] for row in response.data["results"]] == [line.pk]

    def test_foreign_patient_is_404(self):
        center, staff, _ = billing_ctx()
        other_center, _ = make_center_with_director()
        foreign = make_patient(created_by_center=other_center)
        assert client_for(staff).get(url(center, foreign)).status_code == 404

    def test_insurance_of_another_patient_is_404_on_detail(self):
        center, staff, patient = billing_ctx()
        other_patient = make_patient(created_by_center=center)
        line = create_line(center, staff, other_patient)
        assert client_for(staff).get(
            f"{url(center, patient)}{line.pk}/"
        ).status_code == 404

    def test_patient_reads_their_lines(self):
        center, cashier, _ = billing_ctx()
        user = make_user()
        patient = make_claimed_patient(user=user, created_by_center=center)
        create_line(center, cashier, patient)

        response = client_for(user).get("/api/v1/patients/me/insurances/")

        assert response.status_code == 200
        assert response.data["count"] == 1
        assert set(response.data["results"][0].keys()) == INSURANCE_FIELDS

    def test_guardian_hat_opens_nothing_here(self):
        guardian_user, _ = make_guardian_user()
        assert client_for(guardian_user).get(
            "/api/v1/patients/me/insurances/"
        ).status_code == 403
