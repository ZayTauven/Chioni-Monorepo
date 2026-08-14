"""S3 (ADR 0016, invariant 1) — duplicate merge re-anchors the enriched
record: documents and insurances move to the target, the medical file is
taken over ONLY when the target has none, vital signs follow their
encounters. The audit entry carries the new counters.
"""

import pytest
from django.core.files.base import ContentFile

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.medical.models import PatientDocument, PatientMedicalFile, VitalSigns
from apps.patients.models import PatientInsurance
from apps.patients.services import merge_profiles

from .api_helpers import Role, make_center_with_director, make_staff_user
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db


def make_document(patient, center, **kwargs):
    return PatientDocument.objects.create(
        patient=patient,
        center=center,
        doc_type=PatientDocument.DocType.OTHER,
        title="Document de test",
        file=ContentFile(b"fake-bytes", name="doc.png"),
        uploaded_by=make_user(),
        **kwargs,
    )


def make_insurance(patient, **kwargs):
    return PatientInsurance.objects.create(
        patient=patient,
        insurer_name="Mutuelle des Comores",
        member_number="MC-0001",
        created_by=make_user(),
        **kwargs,
    )


def make_medical_file(patient, blood_group="A+"):
    return PatientMedicalFile.objects.create(
        patient=patient, blood_group=blood_group, updated_by=make_user()
    )


class TestMergeReanchorsTheEnrichedRecord:
    def test_documents_and_insurances_move_to_the_target(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        document = make_document(source, center)
        insurance = make_insurance(source)

        merge_profiles(source=source, target=target, actor=director, center=center)

        document.refresh_from_db()
        insurance.refresh_from_db()
        assert document.patient == target
        assert insurance.patient == target

    def test_vital_signs_follow_their_encounter(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        membership = StaffMembership.objects.get(user=doctor, center=center)
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        encounter = make_encounter(
            patient=source, center=center, practitioner=membership
        )
        vitals = VitalSigns.objects.create(
            encounter=encounter, measured_by=membership, heart_rate=80
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        assert list(VitalSigns.objects.for_patient(target)) == [vitals]
        assert not VitalSigns.objects.for_patient(source).exists()

    def test_medical_file_taken_over_when_target_has_none(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        source_file = make_medical_file(source, blood_group="O-")

        merge_profiles(source=source, target=target, actor=director, center=center)

        source_file.refresh_from_db()
        assert source_file.patient == target

    def test_medical_file_kept_on_target_source_stays_on_tombstone(self):
        """No automatic pick between two clinical contents: the target's
        file wins, the duplicate's stays on the tombstone (nothing medical
        is deleted)."""
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        source_file = make_medical_file(source, blood_group="O-")
        target_file = make_medical_file(target, blood_group="A+")

        merge_profiles(source=source, target=target, actor=director, center=center)

        source_file.refresh_from_db()
        target_file.refresh_from_db()
        assert target_file.patient == target
        assert target_file.blood_group == "A+"
        assert source_file.patient == source  # tombstone keeps it

    def test_merge_audit_carries_the_new_counters(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        make_document(source, center)
        make_insurance(source)
        make_medical_file(source)

        merge_profiles(source=source, target=target, actor=director, center=center)

        entry = AuditLog.objects.get(action=AuditAction.PATIENT_MERGED)
        assert entry.payload["documents_moved"] == 1
        assert entry.payload["insurances_moved"] == 1
        assert entry.payload["medical_file_moved"] is True
