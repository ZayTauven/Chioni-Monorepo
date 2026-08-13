"""S1 — encounter closure (`POST /centers/{c}/encounters/{pk}/close/`).

Cycle de vie C.2 : « terminee » was declared but never reachable. Locked
here: clinical roles only, explicit effects (a closed encounter refuses
new prescriptions and record entries), billing stays possible, audit,
tenancy. « annulee » stays out of S1 scope (invoice cascade to design).
"""

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.medical.models import Encounter, HealthRecordEntry, Prescription
from apps.medical.services import close_encounter
from apps.trustbridge.services import create_invoice

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import make_act, make_encounter, make_patient

pytestmark = pytest.mark.django_db


def scene():
    center, director = make_center_with_director()
    doctor = make_staff_user(center, role=Role.DOCTOR)
    patient = make_patient(created_by_center=center)
    encounter = make_encounter(patient=patient, center=center)
    return center, director, doctor, encounter


def close_url(center, encounter):
    return f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/close/"


class TestCloseEndpoint:
    def test_doctor_closes_their_centers_encounter(self):
        center, _, doctor, encounter = scene()
        response = client_for(doctor).post(close_url(center, encounter))
        assert response.status_code == 200, response.content
        assert response.data["status"] == Encounter.Status.COMPLETED
        entry = AuditLog.objects.get(action=AuditAction.ENCOUNTER_CLOSED)
        assert entry.payload["encounter_id"] == encounter.pk

    @pytest.mark.parametrize("role", [Role.NURSE, Role.MIDWIFE])
    def test_other_clinical_roles_can_close(self, role):
        center, _, _, encounter = scene()
        staff = make_staff_user(center, role=role)
        assert client_for(staff).post(close_url(center, encounter)).status_code == 200

    @pytest.mark.parametrize(
        "role", [Role.SECRETARY, Role.CASHIER, Role.PHARMACIST]
    )
    def test_administrative_roles_get_403(self, role):
        center, _, _, encounter = scene()
        staff = make_staff_user(center, role=role)
        assert client_for(staff).post(close_url(center, encounter)).status_code == 403

    def test_the_director_hat_alone_cannot_close(self):
        """Closing is a CLINICAL act (the practitioner says « the
        consultation is over »), not a management one — the director needs
        a clinical membership to do it."""
        center, director, _, encounter = scene()
        assert client_for(director).post(close_url(center, encounter)).status_code == 403

    def test_foreign_encounter_is_404(self):
        center, _, doctor, _ = scene()
        foreign = make_encounter()  # another center
        response = client_for(doctor).post(close_url(center, foreign))
        assert response.status_code == 404
        foreign.refresh_from_db()
        assert foreign.status == Encounter.Status.IN_PROGRESS

    def test_closing_twice_is_a_clean_400(self):
        center, _, doctor, encounter = scene()
        assert client_for(doctor).post(close_url(center, encounter)).status_code == 200
        again = client_for(doctor).post(close_url(center, encounter))
        assert again.status_code == 400
        assert "déjà terminée" in str(again.data)


class TestClosedEncounterEffects:
    def test_closed_encounter_refuses_new_prescriptions(self):
        center, _, doctor, encounter = scene()
        close_encounter(actor=doctor, encounter=encounter)
        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/prescriptions/",
            {"items": [{"medication": "Paracétamol"}]},
            format="json",
        )
        assert response.status_code == 400
        assert "terminée" in str(response.data)
        assert Prescription.objects.count() == 0

    def test_closed_encounter_refuses_new_record_entries(self):
        center, _, doctor, encounter = scene()
        close_encounter(actor=doctor, encounter=encounter)
        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/record-entries/",
            {"entry_type": "allergie", "content": "Pénicilline"},
            format="json",
        )
        assert response.status_code == 400
        assert HealthRecordEntry.objects.count() == 0

    def test_billing_a_closed_encounter_stays_possible(self):
        """Documented decision: the invoice routinely comes AFTER the care
        ends — closure must never block the caisse."""
        center, _, doctor, encounter = scene()
        make_act(encounter=encounter)
        close_encounter(actor=doctor, encounter=encounter)
        cashier = make_staff_user(center, role=Role.CASHIER)
        invoice = create_invoice(actor=cashier, center=center, encounter=encounter)
        assert invoice.pk is not None

    def test_reading_stays_open_after_closure(self):
        center, _, doctor, encounter = scene()
        close_encounter(actor=doctor, encounter=encounter)
        listing = client_for(doctor).get(
            f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/"
        )
        assert listing.status_code == 200
        assert listing.data["status"] == Encounter.Status.COMPLETED
