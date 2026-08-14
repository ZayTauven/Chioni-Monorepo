"""S3 (ADR 0016 §1) — extended ADMINISTRATIVE identity of PatientProfile.

Contract under test:

- the six new fields (address, phone_alt, national_id, emergency contact)
  are writable at the desk and by the patient, exposed to BOTH those
  audiences (field-level assertions) and NEVER to a guardian (negative
  assertion lives in test_api_patients.py);
- both new phone fields are normalised to E.164 like ``phone`` (R-API-5);
- R-API-2 applies as-is: once the profile is claimed, staff edits of ANY
  identity field — new ones included — are refused.
"""

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.patients.models import PatientProfile

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import make_patient, make_user

pytestmark = pytest.mark.django_db

#: Exact payload of the STAFF window on a patient (desk registry).
STAFF_PATIENT_FIELDS = {
    "id", "first_name", "last_name", "birth_date", "sex", "phone", "city",
    "address", "phone_alt", "national_id", "emergency_contact_name",
    "emergency_contact_phone", "emergency_contact_relationship",
    "claim_status", "created_at",
}

#: Exact payload of the patient's SELF window — same administrative set.
SELF_PATIENT_FIELDS = STAFF_PATIENT_FIELDS


class TestDeskExtendedIdentity:
    def test_desk_creates_with_extended_identity_and_normalises_phones(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)

        response = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/patients/",
            {
                "first_name": "Mariama", "last_name": "Ahamada",
                "phone": "+2693312345",
                "address": "Quartier Coulée, Moroni",
                "phone_alt": "2693312346",  # sans « + » — doit converger
                "national_id": "CNI 123-456",
                "emergency_contact_name": "Ali Ahamada",
                "emergency_contact_phone": "3312347",  # forme nationale KM
                "emergency_contact_relationship": "fils",
            },
        )

        assert response.status_code == 201, response.content
        profile = PatientProfile.objects.get(pk=response.data["id"])
        assert profile.address == "Quartier Coulée, Moroni"
        assert profile.phone_alt == "+2693312346"
        assert profile.emergency_contact_phone == "+2693312347"
        assert profile.national_id == "CNI 123-456"
        assert set(response.data.keys()) == STAFF_PATIENT_FIELDS

    def test_staff_detail_payload_carries_exactly_the_staff_fields(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(created_by_center=center)

        response = client_for(staff).get(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
        )

        assert response.status_code == 200
        assert set(response.data.keys()) == STAFF_PATIENT_FIELDS

    def test_staff_updates_extended_identity_on_unclaimed_profile(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(created_by_center=center)

        response = client_for(staff).patch(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/",
            {"address": "Mitsamiouli, rue du marché", "phone_alt": "269 331 23 48"},
        )

        assert response.status_code == 200, response.content
        patient.refresh_from_db()
        assert patient.address == "Mitsamiouli, rue du marché"
        assert patient.phone_alt == "+2693312348"
        entry = AuditLog.objects.filter(
            action=AuditAction.PATIENT_UPDATED
        ).latest("id")
        assert entry.payload["fields"] == "address,phone_alt"

    def test_invalid_phone_alt_is_refused(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(created_by_center=center)

        response = client_for(staff).patch(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/",
            {"phone_alt": "12"},
        )

        assert response.status_code == 400
        patient.refresh_from_db()
        assert patient.phone_alt == ""

    def test_r_api_2_staff_cannot_edit_new_fields_of_a_claimed_profile(self):
        """The new fields are IDENTITY fields: a claimed profile belongs to
        the patient, staff edits are refused whatever the field."""
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_claimed_patient(created_by_center=center)

        for payload in (
            {"address": "ailleurs"},
            {"national_id": "XXX"},
            {"emergency_contact_name": "Quelqu'un"},
        ):
            response = client_for(staff).patch(
                f"/api/v1/centers/{center.pk}/patients/{patient.pk}/", payload
            )
            assert response.status_code == 400, payload
            assert "géré par le patient" in str(response.data)


class TestPatientSelfExtendedIdentity:
    def test_patient_reads_and_updates_their_extended_identity(self):
        user = make_user()
        make_claimed_patient(user=user)

        read = client_for(user).get("/api/v1/patients/me/")
        assert read.status_code == 200
        assert set(read.data.keys()) == SELF_PATIENT_FIELDS

        update = client_for(user).patch(
            "/api/v1/patients/me/",
            {"address": "Fomboni centre", "emergency_contact_phone": "+33612345678"},
        )
        assert update.status_code == 200, update.content
        assert update.data["address"] == "Fomboni centre"
        assert update.data["emergency_contact_phone"] == "+33612345678"
