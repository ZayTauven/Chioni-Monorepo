"""Audit contract (finding M1): EVERY sensitive service writes its entry.

Each test performs one sensitive action then counts AuditLog rows PER
ACTION: removing an ``audit()`` call from a service makes this file fail.
Also locks the ADR 0007 payload contract (identifiers only, no PII).
"""

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction, audit
from apps.centers.services import (
    add_staff_member,
    create_tariff,
    deactivate_staff_member,
    update_center,
    update_tariff,
)
from apps.medical.services import (
    create_encounter,
    create_prescription,
    create_record_entry,
)
from apps.patients.models import GuardianLink
from apps.patients.services import (
    accept_link,
    claim_profile,
    create_own_profile,
    create_patient_at_center,
    create_protege,
    grant_clinical_consent,
    invite_guardian,
    merge_profiles,
    revoke_clinical_consent,
    revoke_link,
    update_patient_profile,
)

from .api_helpers import (
    Role,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
)
from .factories import make_center, make_encounter, make_patient, make_staff, make_tariff, make_user

pytestmark = pytest.mark.django_db


def count(action):
    return AuditLog.objects.filter(action=action).count()


class TestPayloadContract:
    def test_payload_refuses_non_scalar_values(self):
        """ADR 0007 — nobody dumps an object (hence PII) into the payload."""
        patient = make_patient()
        with pytest.raises(TypeError, match="identifiers only"):
            audit(actor=None, action="x", patient=patient)
        assert AuditLog.objects.count() == 0

    def test_decimal_references_are_stored_as_strings(self):
        from decimal import Decimal

        entry = audit(actor=None, action="test", amount=Decimal("7500.00"))
        assert entry.payload == {"amount": "7500.00"}


class TestPatientIdentityAudit:
    def test_desk_creation_writes_patient_created(self):
        center, director = make_center_with_director()
        create_patient_at_center(
            actor=director, center=center, first_name="Mariama", last_name="Ahamada"
        )
        assert count(AuditAction.PATIENT_CREATED) == 1

    def test_desk_creation_with_guardian_also_writes_link_created(self):
        center, director = make_center_with_director()
        create_patient_at_center(
            actor=director, center=center, first_name="Ali", last_name="Soilihi",
            guardian_phone="+33612345678",
            guardian_relationship=GuardianLink.Relationship.CHILD,
        )
        assert count(AuditAction.PATIENT_CREATED) == 1
        assert count(AuditAction.LINK_CREATED) == 1

    def test_protege_creation_writes_both_entries(self):
        guardian_user, _ = make_guardian_user()
        create_protege(
            guardian_user=guardian_user, first_name="Mariama", last_name="Ahamada",
            relationship=GuardianLink.Relationship.PARENT,
        )
        assert count(AuditAction.PATIENT_CREATED) == 1
        assert count(AuditAction.LINK_CREATED) == 1

    def test_own_profile_creation_is_audited(self):
        create_own_profile(user=make_user(), first_name="Anfia", last_name="Soilihi")
        assert count(AuditAction.PATIENT_CREATED) == 1

    def test_profile_update_is_audited(self):
        profile = make_claimed_patient()
        update_patient_profile(actor=profile.user, profile=profile, city="Fomboni")
        assert count(AuditAction.PATIENT_UPDATED) == 1

    def test_claim_is_audited(self):
        profile = make_patient()
        claim_profile(user=make_user(), profile=profile)
        assert count(AuditAction.PATIENT_CLAIMED) == 1

    def test_merge_is_audited(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        merge_profiles(source=source, target=target, actor=director, center=center)
        assert count(AuditAction.PATIENT_MERGED) == 1

    def test_audit_payloads_carry_references_never_names(self):
        """No PII in any payload written by the patient services."""
        center, director = make_center_with_director()
        create_patient_at_center(
            actor=director, center=center, first_name="Mariama", last_name="Ahamada",
            phone="+2693312345",
        )
        for entry in AuditLog.objects.all():
            blob = str(entry.payload)
            assert "Mariama" not in blob
            assert "Ahamada" not in blob
            assert "+2693312345" not in blob


class TestGuardianshipAudit:
    def test_invite_accept_revoke_each_write_one_entry(self):
        patient = make_claimed_patient()
        link = invite_guardian(
            actor=patient.user, patient=patient, phone="+33698765432",
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        assert count(AuditAction.LINK_CREATED) == 1

        accept_link(link=link, guardian_user=link.guardian.user)
        assert count(AuditAction.LINK_ACCEPTED) == 1

        revoke_link(link=link, actor=patient.user)
        assert count(AuditAction.LINK_REVOKED) == 1

    def test_consent_grant_and_revoke_are_audited(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        grant_clinical_consent(patient_user=patient.user, link=link)
        assert count(AuditAction.CONSENT_GRANTED) == 1

        revoke_clinical_consent(patient_user=patient.user, link=link)
        assert count(AuditAction.CONSENT_REVOKED) == 1

    def test_grant_by_someone_else_never_writes_an_entry(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        with pytest.raises(ValidationError):
            grant_clinical_consent(patient_user=make_user(), link=link)
        assert count(AuditAction.CONSENT_GRANTED) == 0


class TestCenterAudit:
    def test_staff_lifecycle_is_audited(self):
        center, director = make_center_with_director()
        membership = add_staff_member(
            actor=director, center=center, phone="+2693390001", role=Role.NURSE
        )
        assert count(AuditAction.STAFF_CREATED) == 1

        deactivate_staff_member(actor=director, membership=membership)
        assert count(AuditAction.STAFF_DEACTIVATED) == 1

    def test_center_update_is_audited(self):
        center, director = make_center_with_director()
        update_center(actor=director, center=center, address="Corniche")
        assert count(AuditAction.CENTER_UPDATED) == 1

    def test_tariff_writes_are_audited(self):
        center, director = make_center_with_director()
        tariff = create_tariff(
            actor=director, center=center, code="CS1", label="Consultation",
            price_kmf="7500", generic_category="consultation",
        )
        assert count(AuditAction.TARIFF_CREATED) == 1

        update_tariff(actor=director, tariff=tariff, price_kmf="9000")
        assert count(AuditAction.TARIFF_UPDATED) == 1


class TestMedicalAudit:
    def test_encounter_creation_is_audited(self):
        center, _ = make_center_with_director()
        doctor_membership = make_staff(center=center, role=Role.DOCTOR)
        patient = make_patient(created_by_center=center)
        tariff = make_tariff(center)

        create_encounter(
            actor=doctor_membership.user, center=center,
            practitioner=doctor_membership, patient=patient,
            reason="Fièvre", tariff_items=[tariff],
        )

        assert count(AuditAction.ENCOUNTER_CREATED) == 1

    def test_prescription_and_record_entry_are_audited(self):
        encounter = make_encounter()
        actor = encounter.practitioner.user

        create_prescription(
            actor=actor, encounter=encounter,
            items=[{"medication": "Paracétamol", "dosage": "1 g x3"}],
        )
        assert count(AuditAction.PRESCRIPTION_CREATED) == 1

        create_record_entry(
            actor=actor, encounter=encounter,
            entry_type="allergie", content="Pénicilline",
        )
        assert count(AuditAction.RECORD_ENTRY_CREATED) == 1

    def test_medical_audit_payloads_never_carry_clinical_text(self):
        encounter = make_encounter(reason="Séropositivité suspectée")
        create_prescription(
            actor=encounter.practitioner.user, encounter=encounter,
            items=[{"medication": "Traitement antirétroviral"}],
        )
        create_record_entry(
            actor=encounter.practitioner.user, encounter=encounter,
            entry_type="antecedent", content="VIH diagnostiqué en 2020",
        )
        for entry in AuditLog.objects.all():
            blob = str(entry.payload)
            assert "Séropositivité" not in blob
            assert "antirétroviral" not in blob
            assert "VIH" not in blob
