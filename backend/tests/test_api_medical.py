"""Medical API — production by center staff, transversal reading by the
patient, and NOTHING for guardians in phase A.

Matrix: anonymous → 401 ; wrong hat → 403/404 ; cross-center IDOR → 404 ;
cross-patient isolation ; snapshots frozen at act creation.
"""

from decimal import Decimal

import pytest

from apps.medical.models import Encounter, HealthRecordEntry, Prescription

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_center,
    make_encounter,
    make_patient,
    make_staff,
    make_tariff,
)

pytestmark = pytest.mark.django_db


def desk_patient(center, **kwargs):
    return make_patient(created_by_center=center, **kwargs)


class TestEncounterCreation:
    def test_anonymous_is_401(self):
        center = make_center()
        assert client_for().get(f"/api/v1/centers/{center.pk}/encounters/").status_code == 401

    def test_doctor_creates_an_encounter_with_snapshot_acts(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        patient = desk_patient(center)
        tariff = make_tariff(center, label="Consultation générale", price_kmf="7500")

        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/",
            {"patient": patient.pk, "reason": "Fièvre persistante",
             "diagnosis": "Paludisme simple", "tariff_items": [tariff.pk]},
            format="json",
        )

        assert response.status_code == 201, response.content
        encounter = Encounter.objects.get(pk=response.data["id"])
        assert encounter.center == center
        assert encounter.practitioner.user == doctor
        act = encounter.acts.get()
        assert act.label_snapshot == "Consultation générale"
        assert act.price_kmf_snapshot == Decimal("7500")
        # Snapshot survives a later grid change.
        tariff.price_kmf = Decimal("9999")
        tariff.save()
        act.refresh_from_db()
        assert act.price_kmf_snapshot == Decimal("7500")

    def test_secretary_cannot_create_an_encounter(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        patient = desk_patient(center)

        response = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/encounters/",
            {"patient": patient.pk, "reason": "Test"},
            format="json",
        )

        assert response.status_code == 403

    def test_encounter_for_a_foreign_patient_is_404(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        doctor_a = make_staff_user(center_a, role=Role.DOCTOR)
        foreign_patient = desk_patient(center_b)

        response = client_for(doctor_a).post(
            f"/api/v1/centers/{center_a.pk}/encounters/",
            {"patient": foreign_patient.pk, "reason": "Intrusion"},
            format="json",
        )

        assert response.status_code == 404
        assert Encounter.objects.count() == 0

    def test_act_with_a_foreign_tariff_is_404(self):
        """Cross-tenant tariff: never silently billed on my grid."""
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        doctor_a = make_staff_user(center_a, role=Role.DOCTOR)
        patient = desk_patient(center_a)
        foreign_tariff = make_tariff(center_b)

        response = client_for(doctor_a).post(
            f"/api/v1/centers/{center_a.pk}/encounters/",
            {"patient": patient.pk, "reason": "Test",
             "tariff_items": [foreign_tariff.pk]},
            format="json",
        )

        assert response.status_code == 404
        assert Encounter.objects.count() == 0

    def test_encounter_list_is_center_scoped(self):
        center_a, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.NURSE)
        mine = make_encounter(center=center_a)
        make_encounter()  # another center's encounter

        response = client_for(staff_a).get(f"/api/v1/centers/{center_a.pk}/encounters/")

        assert [e["id"] for e in response.data["results"]] == [mine.pk]

    def test_cross_center_encounter_detail_is_404(self):
        center_a, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.NURSE)
        foreign = make_encounter()  # produced elsewhere

        response = client_for(staff_a).get(
            f"/api/v1/centers/{center_a.pk}/encounters/{foreign.pk}/"
        )

        assert response.status_code == 404


class TestPrescriptionsAndRecordEntries:
    def test_doctor_prescribes_on_their_centers_encounter(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        encounter = make_encounter(center=center)

        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/",
            {"items": [{"medication": "Artéméther-luméfantrine",
                        "dosage": "2 cp matin et soir, 3 jours"}]},
            format="json",
        )

        assert response.status_code == 201, response.content
        prescription = Prescription.objects.get(pk=response.data["id"])
        assert prescription.items.count() == 1

    def test_nurse_cannot_prescribe(self):
        center, _ = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        encounter = make_encounter(center=center)

        response = client_for(nurse).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/",
            {"items": [{"medication": "X"}]},
            format="json",
        )

        assert response.status_code == 403

    def test_prescribing_on_a_foreign_encounter_is_404(self):
        center_a, _ = make_center_with_director()
        doctor_a = make_staff_user(center_a, role=Role.DOCTOR)
        foreign_encounter = make_encounter()  # another center

        response = client_for(doctor_a).post(
            f"/api/v1/centers/{center_a.pk}/encounters/{foreign_encounter.pk}/prescriptions/",
            {"items": [{"medication": "X"}]},
            format="json",
        )

        assert response.status_code == 404
        assert Prescription.objects.count() == 0

    def test_empty_prescription_is_refused(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        encounter = make_encounter(center=center)

        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/",
            {"items": []},
            format="json",
        )

        assert response.status_code == 400

    def test_nurse_adds_a_record_entry(self):
        center, _ = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        encounter = make_encounter(center=center)

        response = client_for(nurse).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/record-entries/",
            {"entry_type": "allergie", "content": "Allergie à la pénicilline"},
            format="json",
        )

        assert response.status_code == 201, response.content
        entry = HealthRecordEntry.objects.get(pk=response.data["id"])
        assert entry.patient == encounter.patient
        assert entry.source_encounter == encounter


class TestClinicalReadSegmentation:
    """R-API-1 — intra-center clinical READS are segmented by role.

    Clinical roles (doctor, nurse, midwife) read the clinical view;
    administrative roles (secretary, cashier, director) get the operating
    view (no diagnosis, no reason); prescriptions open to clinical roles
    + the pharmacist; carnet entries to clinical roles only.
    """

    def _center_with_encounter(self):
        center, director = make_center_with_director()
        encounter = make_encounter(
            center=center, reason="Suspicion VIH",
        )
        encounter.diagnosis = "VIH positif — CD4 bas"
        encounter.save(update_fields=["diagnosis", "updated_at"])
        return center, director, encounter

    @pytest.mark.parametrize("role", [Role.DOCTOR, Role.NURSE, Role.MIDWIFE])
    def test_clinical_roles_read_diagnosis_and_reason(self, role):
        center, _director, encounter = self._center_with_encounter()
        member = make_staff_user(center, role=role)

        detail = client_for(member).get(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/"
        )
        listing = client_for(member).get(f"/api/v1/centers/{center.pk}/encounters/")

        assert detail.data["diagnosis"] == "VIH positif — CD4 bas"
        assert detail.data["reason"] == "Suspicion VIH"
        (row,) = listing.data["results"]
        assert row["diagnosis"] == "VIH positif — CD4 bas"

    @pytest.mark.parametrize(
        "role", [Role.SECRETARY, Role.CASHIER, Role.DIRECTOR, Role.PHARMACIST]
    )
    def test_administrative_roles_get_the_operating_view_only(self, role):
        """Field-level: diagnosis and reason are ABSENT, not blanked."""
        center, _director, encounter = self._center_with_encounter()
        member = make_staff_user(center, role=role)

        detail = client_for(member).get(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/"
        )
        listing = client_for(member).get(f"/api/v1/centers/{center.pk}/encounters/")

        assert detail.status_code == 200
        assert "diagnosis" not in detail.data
        assert "reason" not in detail.data
        assert detail.data["patient"] == encounter.patient_id  # billing keeps this
        (row,) = listing.data["results"]
        assert "diagnosis" not in row
        assert "reason" not in row

    def test_multi_hat_member_with_a_clinical_role_reads_clinical(self):
        """A cashier who is ALSO a nurse of the SAME center is care team."""
        center, _director, encounter = self._center_with_encounter()
        member = make_staff_user(center, role=Role.CASHIER)
        make_staff(user=member, center=center, role=Role.NURSE)

        detail = client_for(member).get(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/"
        )

        assert detail.data["diagnosis"] == "VIH positif — CD4 bas"

    def test_prescriptions_readable_by_clinical_roles_and_pharmacist_only(self):
        center, _director, encounter = self._center_with_encounter()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/",
            {"items": [{"medication": "Traitement antirétroviral"}]},
            format="json",
        )
        url = f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/"

        pharmacist = make_staff_user(center, role=Role.PHARMACIST)
        nurse = make_staff_user(center, role=Role.NURSE)
        cashier = make_staff_user(center, role=Role.CASHIER)
        secretary = make_staff_user(center, role=Role.SECRETARY)

        assert client_for(pharmacist).get(url).status_code == 200
        assert len(client_for(pharmacist).get(url).data) == 1
        assert client_for(nurse).get(url).status_code == 200
        assert client_for(cashier).get(url).status_code == 403
        assert client_for(secretary).get(url).status_code == 403

    def test_record_entries_readable_by_clinical_roles_only(self):
        center, _director, encounter = self._center_with_encounter()
        nurse = make_staff_user(center, role=Role.NURSE)
        client_for(nurse).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/record-entries/",
            {"entry_type": "allergie", "content": "Pénicilline"},
            format="json",
        )
        url = f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/record-entries/"

        doctor = make_staff_user(center, role=Role.DOCTOR)
        pharmacist = make_staff_user(center, role=Role.PHARMACIST)
        secretary = make_staff_user(center, role=Role.SECRETARY)
        director_client = client_for(make_staff_user(center, role=Role.DIRECTOR))

        assert client_for(doctor).get(url).status_code == 200
        assert len(client_for(doctor).get(url).data) == 1
        assert client_for(pharmacist).get(url).status_code == 403
        assert client_for(secretary).get(url).status_code == 403
        assert director_client.get(url).status_code == 403

    def test_cross_center_clinical_role_gets_404_not_a_payload(self):
        """A doctor of ANOTHER center is not care team here: 404, whatever
        their clinical status elsewhere."""
        center, _director, encounter = self._center_with_encounter()
        other_center, _ = make_center_with_director()
        foreign_doctor = make_staff_user(other_center, role=Role.DOCTOR)

        resp = client_for(foreign_doctor).get(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/"
        )

        assert resp.status_code == 404


class TestPatientTransversalRecord:
    def test_anonymous_is_401(self):
        assert client_for().get("/api/v1/patients/me/encounters/").status_code == 401

    def test_patient_reads_their_carnet_across_all_centers(self):
        """ADR 0002 — the carnet reunites episodes from every center."""
        profile = make_claimed_patient()
        center_a, _ = make_center_with_director(name="Clinique Salama")
        center_b, _ = make_center_with_director(name="CHN El-Maarouf")
        make_encounter(patient=profile, center=center_a, reason="Suivi tension")
        make_encounter(patient=profile, center=center_b, reason="Radio du poignet")

        response = client_for(profile.user).get("/api/v1/patients/me/encounters/")

        assert response.status_code == 200
        centers_seen = {e["center_name"] for e in response.data["results"]}
        assert centers_seen == {"Clinique Salama", "CHN El-Maarouf"}

    def test_patient_never_sees_another_patients_encounters(self):
        me = make_claimed_patient()
        other = make_claimed_patient()
        make_encounter(patient=other, reason="Secret d'autrui")

        response = client_for(me.user).get("/api/v1/patients/me/encounters/")

        assert response.data["results"] == []

    def test_patient_reads_prescriptions_and_entries(self):
        profile = make_claimed_patient()
        encounter = make_encounter(patient=profile)
        prescription = Prescription.objects.create(encounter=encounter)
        HealthRecordEntry.objects.create(
            patient=profile, entry_type="allergie", content="Pénicilline",
            source_encounter=encounter,
        )

        prescriptions = client_for(profile.user).get("/api/v1/patients/me/prescriptions/")
        entries = client_for(profile.user).get("/api/v1/patients/me/record-entries/")

        assert [p["id"] for p in prescriptions.data["results"]] == [prescription.pk]
        assert len(entries.data["results"]) == 1

    def test_guardian_hat_gets_no_clinical_endpoint_at_all(self):
        """Phase A rule: no guardian clinical route exists — even WITH a
        clinical consent, the guardian's hat opens nothing medical."""
        guardian_user, guardian = make_guardian_user()
        patient = make_claimed_patient()
        from apps.medical.models import Consent
        from .api_helpers import make_active_link
        link = make_active_link(guardian, patient)
        Consent.objects.create(
            patient=patient, guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL
        )
        make_encounter(patient=patient, reason="Confidentiel")

        # The patient-space routes refuse the guardian hat outright.
        assert client_for(guardian_user).get("/api/v1/patients/me/encounters/").status_code == 403
        assert client_for(guardian_user).get("/api/v1/patients/me/prescriptions/").status_code == 403
        assert client_for(guardian_user).get("/api/v1/patients/me/record-entries/").status_code == 403

    def test_multi_hat_doctor_only_reads_their_own_carnet_as_patient(self):
        """A doctor who is ALSO a patient: their /patients/me/ never leaks
        the encounters they PRODUCED for others at the center."""
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        my_profile = make_claimed_patient(user=doctor)
        make_encounter(patient=my_profile, center=center, reason="Mon propre suivi")
        other_patient = desk_patient(center)
        make_encounter(patient=other_patient, center=center, reason="Patient soigné")

        response = client_for(doctor).get("/api/v1/patients/me/encounters/")

        reasons = [e["reason"] for e in response.data["results"]]
        assert reasons == ["Mon propre suivi"]
