"""Adversarial API probes (2e passe, chioni-health-data-guardian) — CLOSED.

These two probes used to PROVE residual permissive behaviours found while
contre-verifying phases A/B. Both are now fixed (R-API-1, R-API-2): the
same probes assert that the protections HOLD.

- R-API-1 — intra-center clinical READ is segmented by role: an
  administrative member (cashier, secretary, director) gets the operating
  payload only — no ``diagnosis``, no ``reason``. Composed with multi-hat:
  a diaspora guardian holding a non-clinical staff role at the treating
  center can no longer read their protégé's diagnosis without consent.
- R-API-2 — the identity of a CLAIMED, patient-owned profile is frozen for
  staff: desk editing stays free on unclaimed profiles only.
"""

import json

import pytest

from apps.patients.models import PatientProfile

from .api_helpers import Role, client_for, make_staff_user
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db


class TestIntraCenterReadPolicy:
    def test_cashier_can_no_longer_read_patient_diagnosis(self):
        """R-API-1 CLOSED — the CASHIER still gets the operating view of the
        encounter (date, patient, practitioner, acts: what billing needs)
        but the clinical fields are structurally absent from the payload."""
        scn = build_scenario(status=Status.SENT)
        scn.encounter.diagnosis = "VIH positif — CD4 bas"
        scn.encounter.save(update_fields=["diagnosis", "updated_at"])
        cashier = make_staff_user(scn.center, role=Role.CASHIER)

        resp = client_for(cashier).get(
            f"/api/v1/centers/{scn.center.pk}/encounters/{scn.encounter.pk}/"
        )

        assert resp.status_code == 200
        payload = resp.json()
        assert "diagnosis" not in payload
        assert "reason" not in payload  # the motive can reveal the pathology
        assert "CD4" not in json.dumps(payload)  # no diagnosis text anywhere
        # The operating view keeps what billing actually needs — including
        # the tariff label (décision actée : the admin staff already manage
        # the grid; ADR 0005 gates that label for GUARDIANS, not for staff).
        assert payload["id"] == scn.encounter.pk
        assert payload["patient"] == scn.patient.pk
        assert len(payload["acts"]) == 1

    def test_the_doctor_still_reads_the_full_clinical_view(self):
        """Counter-probe: segmentation must not blind the care team."""
        scn = build_scenario(status=Status.SENT)
        scn.encounter.diagnosis = "VIH positif — CD4 bas"
        scn.encounter.save(update_fields=["diagnosis", "updated_at"])

        resp = client_for(scn.doctor).get(
            f"/api/v1/centers/{scn.center.pk}/encounters/{scn.encounter.pk}/"
        )

        assert resp.status_code == 200
        assert resp.json()["diagnosis"] == "VIH positif — CD4 bas"


class TestClaimedIdentityProtection:
    def test_staff_can_no_longer_rewrite_a_claimed_patient_identity(self):
        """R-API-2 CLOSED — a SECRETARY of a center the patient merely
        visited gets a clear French 400; the profile is untouched."""
        scn = build_scenario(status=Status.SENT)
        assert scn.patient.claim_status == PatientProfile.ClaimStatus.ACTIVE
        original_last_name = scn.patient.last_name
        original_phone = scn.patient.phone
        secretary = make_staff_user(scn.center, role=Role.SECRETARY)

        resp = client_for(secretary).patch(
            f"/api/v1/centers/{scn.center.pk}/patients/{scn.patient.pk}/",
            data=json.dumps({"last_name": "Rewritten", "phone": "+2699999999"}),
            content_type="application/json",
        )

        assert resp.status_code == 400
        assert "géré par le patient" in json.dumps(resp.json(), ensure_ascii=False)
        scn.patient.refresh_from_db()
        assert scn.patient.last_name == original_last_name
        assert scn.patient.phone == original_phone

    def test_desk_editing_stays_free_on_unclaimed_profiles(self):
        """Counter-probe: the desk keeps correcting the profiles it owns
        (unclaimed) — the guard targets claimed profiles only."""
        scn = build_scenario(status=Status.SENT)
        secretary = make_staff_user(scn.center, role=Role.SECRETARY)
        unclaimed = PatientProfile.objects.create(
            first_name="Nael", last_name="Bacar",
            created_by_center=scn.center,
        )

        resp = client_for(secretary).patch(
            f"/api/v1/centers/{scn.center.pk}/patients/{unclaimed.pk}/",
            data=json.dumps({"city": "Moroni", "phone": "+2693312345"}),
            content_type="application/json",
        )

        assert resp.status_code == 200
        unclaimed.refresh_from_db()
        assert unclaimed.city == "Moroni"
        assert unclaimed.phone == "+2693312345"
