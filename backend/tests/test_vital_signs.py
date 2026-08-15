"""S3 (ADR 0016 §4) — vital signs per visit (VitalSigns).

Contract under test:

- clinical roles of the producing center write and read; administrative
  staff and the pharmacist → 403; foreign center → 404;
- ``measured_by`` is ALWAYS the caller's own clinical membership, and the
  model re-imposes the practitioner-of-the-center invariant;
- at least one measure; plausibility bounds refuse impossible values
  (never stored); closed encounter refuses new rows;
- the patient reads transversally (``?encounter=`` filter);
- audit: references + measured field NAMES — never a value.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.medical.models import VitalSigns
from apps.medical.services import close_encounter

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

#: Exact staff payload of one vital-signs row.
STAFF_VITAL_FIELDS = {
    "id", "encounter", "measured_at", "measured_by", "measured_by_name",
    "systolic_bp", "diastolic_bp", "heart_rate", "spo2", "temperature_c",
    "respiratory_rate", "weight_kg", "height_cm", "created_at",
}

#: Exact patient payload — NO measured_by (staff internals stay inside).
PATIENT_VITAL_FIELDS = {
    "id", "encounter", "measured_at", "systolic_bp", "diastolic_bp",
    "heart_rate", "spo2", "temperature_c", "respiratory_rate", "weight_kg",
    "height_cm", "created_at",
}


def clinical_ctx(patient=None):
    center, _ = make_center_with_director()
    doctor = make_staff_user(center, role=Role.DOCTOR)
    membership = StaffMembership.objects.get(user=doctor, center=center)
    patient = patient or make_patient(created_by_center=center)
    encounter = make_encounter(
        patient=patient, center=center, practitioner=membership
    )
    return center, doctor, membership, encounter


def url(center, encounter):
    return f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/vital-signs/"


class TestRecordVitalSigns:
    def test_doctor_records_a_full_set(self):
        center, doctor, membership, encounter = clinical_ctx()

        response = client_for(doctor).post(
            url(center, encounter),
            {"systolic_bp": 142, "diastolic_bp": 91, "heart_rate": 78,
             "spo2": 97, "temperature_c": "37.2", "respiratory_rate": 16,
             "weight_kg": "68.50", "height_cm": 162},
        )

        assert response.status_code == 201, response.content
        assert set(response.data.keys()) == STAFF_VITAL_FIELDS
        row = VitalSigns.objects.get(pk=response.data["id"])
        assert row.measured_by == membership  # the caller's OWN hat
        assert row.systolic_bp == 142

    def test_several_rows_per_encounter_are_fine(self):
        center, doctor, _, encounter = clinical_ctx()
        for bp in (150, 140):
            assert client_for(doctor).post(
                url(center, encounter), {"systolic_bp": bp, "diastolic_bp": 90}
            ).status_code == 201
        listed = client_for(doctor).get(url(center, encounter))
        assert listed.status_code == 200
        assert len(listed.data) == 2  # bare array, like the other sub-routes

    def test_at_least_one_measure_is_required(self):
        center, doctor, _, encounter = clinical_ctx()
        response = client_for(doctor).post(url(center, encounter), {})
        assert response.status_code == 400
        assert "Au moins une mesure" in str(response.data)
        assert VitalSigns.objects.count() == 0

    @pytest.mark.parametrize(
        "payload",
        [
            {"spo2": 101},
            {"spo2": 39},
            {"systolic_bp": 39},
            {"systolic_bp": 301},
            {"diastolic_bp": 19},
            {"heart_rate": 310},
            {"temperature_c": "29.9"},
            {"temperature_c": "45.1"},
            {"respiratory_rate": 3},
            {"weight_kg": "500.00"},
            {"weight_kg": "0.30"},
            {"height_cm": 300},
            {"height_cm": 10},
        ],
    )
    def test_impossible_values_are_refused_never_stored(self, payload):
        center, doctor, _, encounter = clinical_ctx()
        response = client_for(doctor).post(url(center, encounter), payload)
        assert response.status_code == 400, payload
        assert "impossible" in str(response.data)
        assert VitalSigns.objects.count() == 0

    def test_diastolic_above_systolic_is_a_typo_not_a_measure(self):
        center, doctor, _, encounter = clinical_ctx()
        response = client_for(doctor).post(
            url(center, encounter), {"systolic_bp": 90, "diastolic_bp": 140}
        )
        assert response.status_code == 400
        assert "diastolique" in str(response.data)

    def test_closed_encounter_refuses_new_measures(self):
        center, doctor, _, encounter = clinical_ctx()
        close_encounter(actor=doctor, encounter=encounter)
        response = client_for(doctor).post(
            url(center, encounter), {"heart_rate": 80}
        )
        assert response.status_code == 400
        assert "terminée" in str(response.data)

    def test_model_invariant_measured_by_must_belong_to_the_center(self):
        _center, _doctor, _membership, encounter = clinical_ctx()
        other_center, _ = make_center_with_director()
        foreign_doctor = make_staff_user(other_center, role=Role.DOCTOR)
        foreign_membership = StaffMembership.objects.get(
            user=foreign_doctor, center=other_center
        )
        with pytest.raises(ValidationError, match="n'appartient pas"):
            VitalSigns.objects.create(
                encounter=encounter,
                measured_by=foreign_membership,
                heart_rate=80,
            )

    def test_roles_matrix(self):
        center, doctor, _, encounter = clinical_ctx()
        client_for(doctor).post(url(center, encounter), {"heart_rate": 80})

        for role in (Role.SECRETARY, Role.CASHIER, Role.DIRECTOR, Role.PHARMACIST):
            staff = make_staff_user(center, role=role)
            assert client_for(staff).get(url(center, encounter)).status_code == 403, role
            assert client_for(staff).post(
                url(center, encounter), {"heart_rate": 90}
            ).status_code == 403, role

        nurse = make_staff_user(center, role=Role.NURSE)
        assert client_for(nurse).get(url(center, encounter)).status_code == 200
        assert client_for(nurse).post(
            url(center, encounter), {"spo2": 98}
        ).status_code == 201

    def test_cross_center_encounter_is_404(self):
        center, _doctor, _m, encounter = clinical_ctx()
        other_center, _ = make_center_with_director()
        other_doctor = make_staff_user(other_center, role=Role.DOCTOR)
        assert client_for(other_doctor).post(
            url(other_center, encounter), {"heart_rate": 80}
        ).status_code == 404

    def test_audit_references_only_never_a_value(self):
        center, doctor, _, encounter = clinical_ctx()
        client_for(doctor).post(
            url(center, encounter), {"systolic_bp": 142, "spo2": 97}
        )
        entry = AuditLog.objects.get(action=AuditAction.VITAL_SIGNS_RECORDED)
        assert entry.payload["fields"] == "spo2,systolic_bp"
        assert entry.payload["encounter_id"] == encounter.pk
        # Le contrat est un contrat de CLÉS : rien d'autre que des
        # références et la liste des champs renseignés. Chercher « 142 » ou
        # « 97 » dans le payload sérialisé était une sonde fragile — un id
        # de patient à 1297 la faisait rougir sans qu'aucune mesure ait
        # fuité (constaté au lot 3 de S5, quand les séquences ont bougé).
        assert set(entry.payload) == {
            "vital_signs_id", "encounter_id", "patient_id", "center_id",
            "fields",
        }
        measured = {142, 97}
        assert not measured & {
            value for value in entry.payload.values() if isinstance(value, int)
        }


class TestPatientVitalSignsTransversal:
    def test_patient_reads_their_measures_across_centers(self):
        user = make_user()
        patient = make_claimed_patient(user=user)
        center_a, doctor_a, _, encounter_a = clinical_ctx(patient=patient)
        _center_b, doctor_b, _, encounter_b = clinical_ctx(patient=patient)
        client_for(doctor_a).post(
            url(center_a, encounter_a), {"systolic_bp": 142, "diastolic_bp": 91}
        )
        client_for(doctor_b).post(
            url(encounter_b.center, encounter_b), {"heart_rate": 80}
        )

        response = client_for(user).get("/api/v1/patients/me/vital-signs/")

        assert response.status_code == 200
        assert response.data["count"] == 2
        assert set(response.data["results"][0].keys()) == PATIENT_VITAL_FIELDS

    def test_encounter_filter_and_its_refusals(self):
        user = make_user()
        patient = make_claimed_patient(user=user)
        center, doctor, _, encounter = clinical_ctx(patient=patient)
        client_for(doctor).post(url(center, encounter), {"heart_rate": 80})
        # Another patient's encounter: filtering on it matches NOTHING.
        _c2, d2, _m2, foreign_encounter = clinical_ctx()
        client_for(d2).post(
            url(foreign_encounter.center, foreign_encounter), {"spo2": 98}
        )

        mine = client_for(user).get(
            "/api/v1/patients/me/vital-signs/", {"encounter": encounter.pk}
        )
        assert mine.data["count"] == 1

        foreign = client_for(user).get(
            "/api/v1/patients/me/vital-signs/", {"encounter": foreign_encounter.pk}
        )
        assert foreign.data["count"] == 0

        garbage = client_for(user).get(
            "/api/v1/patients/me/vital-signs/", {"encounter": "abc"}
        )
        assert garbage.status_code == 400
        assert "encounter" in garbage.data

    def test_guardian_hat_opens_nothing_here(self):
        guardian_user, _ = make_guardian_user()
        assert client_for(guardian_user).get(
            "/api/v1/patients/me/vital-signs/"
        ).status_code == 403
