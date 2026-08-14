"""S3 (ADR 0016 §3) — structured medical file (PatientMedicalFile).

Blood group and clinical notes are HEALTH data (RGPD art. 9): clinical
roles of the perimeter read AND write; administrative staff and the
pharmacist get 403 (re-segmentation actée — the PO's « identité élargie »
list is split, clinical data never rides the administrative window); the
patient reads transversally. Audit: field names only, never a value.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.medical.models import PatientMedicalFile

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_patient, make_user

pytestmark = pytest.mark.django_db

#: The exact medical-file payload (both audiences — no id, no updated_by).
MEDICAL_FILE_FIELDS = {"blood_group", "notes", "updated_at"}

EMPTY_SHAPE = {"blood_group": "", "notes": "", "updated_at": None}


def url(center, patient):
    return f"/api/v1/centers/{center.pk}/patients/{patient.pk}/medical-file/"


def clinical_ctx():
    center, _ = make_center_with_director()
    doctor = make_staff_user(center, role=Role.DOCTOR)
    patient = make_patient(created_by_center=center)
    return center, doctor, patient


class TestCenterMedicalFile:
    def test_get_before_first_write_answers_the_empty_shape(self):
        center, doctor, patient = clinical_ctx()
        response = client_for(doctor).get(url(center, patient))
        assert response.status_code == 200
        assert dict(response.data) == EMPTY_SHAPE

    def test_patch_creates_then_updates_through_the_service(self):
        center, doctor, patient = clinical_ctx()

        created = client_for(doctor).patch(
            url(center, patient), {"blood_group": "A+", "notes": "Allergie iode."}
        )
        assert created.status_code == 200, created.content
        assert set(created.data.keys()) == MEDICAL_FILE_FIELDS
        assert created.data["blood_group"] == "A+"

        updated = client_for(doctor).patch(
            url(center, patient), {"blood_group": "O-"}
        )
        assert updated.status_code == 200
        assert updated.data["blood_group"] == "O-"
        assert updated.data["notes"] == "Allergie iode."  # partial: notes intactes
        assert PatientMedicalFile.objects.filter(patient=patient).count() == 1

    def test_invalid_blood_group_is_refused(self):
        center, doctor, patient = clinical_ctx()
        response = client_for(doctor).patch(
            url(center, patient), {"blood_group": "Z+"}
        )
        assert response.status_code == 400
        assert not PatientMedicalFile.objects.filter(patient=patient).exists()

    def test_model_guard_refuses_an_impossible_blood_group(self):
        """Service callers can't bypass the choice list either."""
        _center, doctor, patient = clinical_ctx()
        with pytest.raises(ValidationError, match="Groupe sanguin"):
            PatientMedicalFile.objects.create(
                patient=patient, blood_group="Z+", updated_by=doctor
            )

    def test_audit_carries_field_names_never_values(self):
        center, doctor, patient = clinical_ctx()
        client_for(doctor).patch(
            url(center, patient),
            {"blood_group": "AB-", "notes": "VIH positif — confidentiel."},
        )
        entry = AuditLog.objects.get(
            action=AuditAction.PATIENT_MEDICAL_FILE_UPDATED
        )
        payload = str(entry.payload)
        assert entry.payload["fields"] == "blood_group,notes"
        assert entry.payload["patient_id"] == patient.pk
        assert "AB-" not in payload
        assert "VIH" not in payload

    def test_administrative_and_pharmacist_roles_are_403(self):
        """The clinical sphere never opens to the exploitation window."""
        center, doctor, patient = clinical_ctx()
        client_for(doctor).patch(url(center, patient), {"blood_group": "A+"})

        for role in (Role.SECRETARY, Role.CASHIER, Role.DIRECTOR, Role.PHARMACIST):
            staff = make_staff_user(center, role=role)
            assert client_for(staff).get(url(center, patient)).status_code == 403, role
            assert client_for(staff).patch(
                url(center, patient), {"blood_group": "B+"}
            ).status_code == 403, role

    def test_nurse_and_midwife_are_clinical_readers_and_writers(self):
        center, _doctor, patient = clinical_ctx()
        for role in (Role.NURSE, Role.MIDWIFE):
            staff = make_staff_user(center, role=role)
            assert client_for(staff).get(url(center, patient)).status_code == 200
            assert client_for(staff).patch(
                url(center, patient), {"notes": "RAS"}
            ).status_code == 200

    def test_cross_center_isolation(self):
        """Foreign center → 404 (mixin) ; patient not in perimeter → 404."""
        center, doctor, patient = clinical_ctx()
        other_center, _ = make_center_with_director()
        other_doctor = make_staff_user(other_center, role=Role.DOCTOR)

        # The other center's doctor cannot even see this center.
        assert client_for(other_doctor).get(url(center, patient)).status_code == 404
        # A patient unknown to MY center answers 404 too.
        foreign_patient = make_patient(created_by_center=other_center)
        assert client_for(doctor).get(
            url(center, foreign_patient)
        ).status_code == 404


class TestPatientMedicalFileTransversal:
    def test_patient_reads_their_file_across_centers(self):
        center, doctor, _ = clinical_ctx()
        user = make_user()
        patient = make_claimed_patient(user=user, created_by_center=center)
        client_for(doctor).patch(url(center, patient), {"blood_group": "O+"})

        response = client_for(user).get("/api/v1/patients/me/medical-file/")

        assert response.status_code == 200
        assert response.data["blood_group"] == "O+"
        assert set(response.data.keys()) == MEDICAL_FILE_FIELDS

    def test_patient_without_file_gets_the_empty_shape(self):
        user = make_user()
        make_claimed_patient(user=user)
        response = client_for(user).get("/api/v1/patients/me/medical-file/")
        assert response.status_code == 200
        assert dict(response.data) == EMPTY_SHAPE

    def test_guardian_hat_opens_nothing_here(self):
        """Sprint lock (décision cadre n° 1) : no guardian read, ever."""
        guardian_user, _ = make_guardian_user()
        response = client_for(guardian_user).get("/api/v1/patients/me/medical-file/")
        assert response.status_code == 403
