"""Adversarial API probes (2e passe, chioni-health-data-guardian).

Kept because they DOCUMENT REAL residual permissive behaviours found while
contre-verifying phase A/B (the guardrail-confirming probes of the same
pass were dropped once verified green). Each test PASSES by asserting the
current permissive behaviour — it is a finding, not a protection.

- Intra-center clinical READ is open to ANY active role (a cashier reads a
  diagnosis); only clinical WRITES are role-gated.
- ANY active staff member can rewrite the identity of a CLAIMED, patient-
  owned transversal profile (menu item A3).
"""

import json

import pytest

from apps.patients.models import PatientProfile

from .api_helpers import Role, client_for, make_staff_user
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db


class TestIntraCenterReadPolicy:
    def test_cashier_can_read_patient_diagnosis(self):
        """A CASHIER (non-clinical) of the center reads the full clinical
        ``diagnosis`` of a patient seen there. Clinical WRITES are role-gated
        (CLINICAL_ROLES) but clinical READS are open to any active member —
        a secret-médical granularity gap within the tenant. Composes with
        multi-hat: a diaspora guardian who also holds ANY staff role at the
        treating center reads their protégé's diagnosis without consent."""
        scn = build_scenario(status=Status.SENT)
        scn.encounter.diagnosis = "VIH positif — CD4 bas"
        scn.encounter.save(update_fields=["diagnosis", "updated_at"])
        cashier = make_staff_user(scn.center, role=Role.CASHIER)

        resp = client_for(cashier).get(
            f"/api/v1/centers/{scn.center.pk}/encounters/{scn.encounter.pk}/"
        )
        assert resp.status_code == 200
        assert resp.json()["diagnosis"] == "VIH positif — CD4 bas"

    def test_any_staff_can_rewrite_a_claimed_patient_identity(self):
        """A SECRETARY of a center the patient merely visited can PATCH the
        identity (name, phone, birth date) of a CLAIMED, patient-owned
        transversal profile — no ownership/role guard beyond 'active member'.
        Audited (PATIENT_UPDATED), but not prevented."""
        scn = build_scenario(status=Status.SENT)
        assert scn.patient.claim_status == PatientProfile.ClaimStatus.ACTIVE
        secretary = make_staff_user(scn.center, role=Role.SECRETARY)

        resp = client_for(secretary).patch(
            f"/api/v1/centers/{scn.center.pk}/patients/{scn.patient.pk}/",
            data=json.dumps({"last_name": "Rewritten", "phone": "+2699999999"}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        scn.patient.refresh_from_db()
        assert scn.patient.last_name == "Rewritten"
        assert scn.patient.phone == "+2699999999"
