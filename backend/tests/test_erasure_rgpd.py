"""S4 lot 3 — RGPD: erasure by anonymisation, and data portability.

This file locks the implementation of ADR 0007 (the contract of principle)
delivered by ADR 0017 décision 7. Five things it verifies, in this order of
importance:

1. **Nothing is ever DELETED.** The tombstone strips the identity and
   leaves every immutability standing: ledger, audit trail, receipts,
   invoices. Physical deletion would break the ``PROTECT`` FKs that make
   « chaque franc relié à un payeur » true.
2. **The health record is NOT erased** — deliberately (ADR 0007: it
   belongs to the patient and follows the local retention law; it becomes
   an orphan of identity). A whole class asserts this, because a reviewer
   must be able to tell a CHOICE from an oversight.
3. **The refusal guards are explicit and motivated, never silent**: last
   active director of a center, PSP payment in flight, last platform
   admin. A blocked request STAYS pending — the person must not have to
   ask twice for something Chioni was not ready to do.
4. **The audit trail of the erasure carries references only** — never the
   refusal motive, never an old name, never a phone (ADR 0007). Testing
   this is testing the very promise that makes anonymisation sufficient.
5. **The export reveals nothing new**: it re-plays the caller's own
   screens, hat by hat. A guardian does not receive their protégé's
   carnet, whatever they hold.
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.accounts.models import ErasureRequest, OtpCode, PlatformStaff
from apps.accounts.services import (
    ERASURE_BLOCKER_LAST_DIRECTOR,
    ERASURE_BLOCKER_LAST_PLATFORM_ADMIN,
    ERASURE_BLOCKER_PAYMENT_IN_FLIGHT,
    anonymize_user,
    erasure_blockers,
    process_erasure_request,
    request_erasure,
    request_otp,
    set_user_avatar,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.medical.models import (
    Consent,
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    VitalSigns,
)
from apps.medical.services import (
    create_patient_document,
    create_record_entry,
    record_vital_signs,
    update_patient_medical_file,
)
from apps.patients.models import (
    GuardianLink,
    GuardianProfile,
    PatientInsurance,
    PatientProfile,
)
from apps.patients.services import create_patient_insurance
from apps.trustbridge.models import (
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
    PaymentRequest,
    Receipt,
)

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_appointment,
    make_center,
    make_encounter,
    make_patient,
    make_platform_staff,
    make_staff,
    make_user,
)
from .test_uploads import image_bytes, upload
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db

User = get_user_model()

#: Every field of ``User`` the tombstone must neutralise.
NEUTRALISED_USER_FIELDS = (
    "first_name", "last_name", "email", "phone", "phone_verified_at",
)

#: Every identity field of ``PatientProfile`` the tombstone must blank —
#: the historical six plus the six added by S3 (ADR 0016 §1).
BLANKED_PATIENT_FIELDS = (
    "phone", "city", "address", "phone_alt", "national_id",
    "emergency_contact_name", "emergency_contact_phone",
    "emergency_contact_relationship", "sex",
)


def operator_admin():
    """A Chioni operator able to execute an erasure, plus a SECOND admin
    so the « last platform admin » guard never fires by accident."""
    user, _op = make_platform_staff(role=PlatformStaff.Role.ADMIN)
    make_platform_staff(role=PlatformStaff.Role.ADMIN)
    return user


# ---------------------------------------------------------------------------
# 1 — the request object itself
# ---------------------------------------------------------------------------


class TestOneOpenRequestPerUser:
    def test_a_second_open_request_is_refused(self):
        user = make_user()
        request_erasure(user=user)
        with pytest.raises(ValidationError, match="déjà en cours"):
            request_erasure(user=user)

    def test_a_refused_request_reopens_the_right_to_ask(self):
        """The guard the person hit may be fixable (hand over the last
        director seat, wait for the payment): they must be able to ask
        again — only OPEN requests are unique."""
        user = make_user()
        first = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=first,
            decision="refuser", refusal_reason="Dossier incomplet.",
        )
        second = request_erasure(user=user)
        assert second.pk != first.pk
        assert ErasureRequest.objects.filter(user=user).count() == 2

    def test_the_partial_constraint_is_enforced_by_the_database(self):
        from django.db import IntegrityError, transaction

        user = make_user()
        request_erasure(user=user)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ErasureRequest.objects.create(user=user)


# ---------------------------------------------------------------------------
# 2 — the user's own space: `/auth/me/erasure-request/`
# ---------------------------------------------------------------------------


class TestMyErasureRequestEndpoint:
    def test_get_without_any_request_is_404(self):
        response = client_for(make_user()).get("/api/v1/auth/me/erasure-request/")
        assert response.status_code == 404
        assert "aucune demande" in response.data["detail"].lower()

    def test_post_then_get_shows_the_pending_request(self):
        client = client_for(make_user())
        created = client.post("/api/v1/auth/me/erasure-request/")
        assert created.status_code == 201
        assert created.data["status"] == "en_attente"
        assert created.data["processed_at"] is None
        assert set(created.data) == {
            "id", "status", "requested_at", "processed_at", "refusal_reason",
        }
        assert client.get("/api/v1/auth/me/erasure-request/").data["id"] == (
            created.data["id"]
        )

    def test_a_second_post_is_an_explicit_400(self):
        client = client_for(make_user())
        client.post("/api/v1/auth/me/erasure-request/")
        response = client.post("/api/v1/auth/me/erasure-request/")
        assert response.status_code == 400
        assert "déjà en cours" in str(response.data)

    def test_every_hat_may_ask(self):
        """A patient, a guardian, a staff member, an operator — the row
        references the ACCOUNT, never a casquette (ADR 0001)."""
        center, director = make_center_with_director()
        guardian_user, _profile = make_guardian_user()
        patient = make_claimed_patient()
        operator, _op = make_platform_staff()
        for user in (director, guardian_user, patient.user, operator):
            response = client_for(user).post("/api/v1/auth/me/erasure-request/")
            assert response.status_code == 201, user.pk

    def test_anonymous_is_401(self):
        assert (
            client_for().post("/api/v1/auth/me/erasure-request/").status_code == 401
        )

    def test_the_refusal_motive_is_rendered_to_the_person_concerned(self):
        """RGPD art. 12.4 — the ONE free operator text of the project that
        the subject reads (unlike kyc_reason / cancel_reason / dispute)."""
        user = make_user()
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="refuser",
            refusal_reason="Obligation légale de conservation en cours.",
        )
        response = client_for(user).get("/api/v1/auth/me/erasure-request/")
        assert response.data["status"] == "refusee"
        assert response.data["refusal_reason"] == (
            "Obligation légale de conservation en cours."
        )
        assert response.data["processed_at"] is not None
        # Who at Chioni decided stays internal.
        assert "processed_by" not in response.data


# ---------------------------------------------------------------------------
# 3 — the back-office queue
# ---------------------------------------------------------------------------


class TestPlatformErasureQueue:
    def test_support_and_admin_read_the_queue(self):
        request_erasure(user=make_user())
        for role in (PlatformStaff.Role.SUPPORT, PlatformStaff.Role.ADMIN):
            user, _op = make_platform_staff(role=role)
            response = client_for(user).get("/api/v1/platform/erasure-requests/")
            assert response.status_code == 200
            assert response.data["count"] == 1

    def test_the_payload_is_an_account_id_and_hats_never_a_name(self):
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")
        patient.user.phone = "+2693440777"
        patient.user.save(update_fields=["phone"])
        request_erasure(user=patient.user)
        operator, _op = make_platform_staff()

        response = client_for(operator).get("/api/v1/platform/erasure-requests/")
        (row,) = response.data["results"]
        assert set(row) == {
            "id", "user", "status", "requested_at", "processed_at",
            "processed_by", "refusal_reason", "hats", "blockers",
        }
        assert row["user"] == patient.user.pk
        assert row["hats"] == {
            "is_patient": True, "is_guardian": False,
            "is_center_staff": False, "is_platform_operator": False,
        }
        body = response.content.decode()
        assert "Anfia" not in body and "Saïd" not in body
        assert "2693440777" not in body

    def test_status_filter_and_its_refusal(self):
        user = make_user()
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="refuser", refusal_reason="Non.",
        )
        request_erasure(user=make_user())
        operator, _op = make_platform_staff()
        client = client_for(operator)

        assert client.get(
            "/api/v1/platform/erasure-requests/?status=en_attente"
        ).data["count"] == 1
        assert client.get(
            "/api/v1/platform/erasure-requests/?status=refusee"
        ).data["count"] == 1
        bad = client.get("/api/v1/platform/erasure-requests/?status=inconnu")
        assert bad.status_code == 400
        assert "status" in bad.data

    def test_blockers_are_surfaced_before_the_operator_clicks(self):
        center, director = make_center_with_director()
        request_erasure(user=director)
        operator, _op = make_platform_staff()
        (row,) = client_for(operator).get(
            "/api/v1/platform/erasure-requests/"
        ).data["results"]
        assert row["blockers"] == [ERASURE_BLOCKER_LAST_DIRECTOR]
        assert row["hats"]["is_center_staff"] is True

    def test_a_processed_request_reports_no_blockers(self):
        user = make_user()
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="anonymiser",
        )
        operator, _op = make_platform_staff()
        (row,) = client_for(operator).get(
            "/api/v1/platform/erasure-requests/"
        ).data["results"]
        assert row["status"] == "traitee"
        assert row["blockers"] == []


class TestProcessEndpointRefusals:
    def test_unknown_request_is_404(self):
        client = client_for(operator_admin())
        assert client.post(
            "/api/v1/platform/erasure-requests/999999/process/",
            {"decision": "refuser", "refusal_reason": "x"},
        ).status_code == 404

    def test_refusing_without_a_motive_is_400(self):
        erasure_request = request_erasure(user=make_user())
        response = client_for(operator_admin()).post(
            f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
            {"decision": "refuser"},
        )
        assert response.status_code == 400
        assert "motif du refus est obligatoire" in str(response.data)
        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.PENDING

    def test_unknown_decision_is_400_per_field(self):
        erasure_request = request_erasure(user=make_user())
        response = client_for(operator_admin()).post(
            f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
            {"decision": "supprimer"},
        )
        assert response.status_code == 400
        assert "decision" in response.data

    def test_processing_twice_is_400(self):
        erasure_request = request_erasure(user=make_user())
        client = client_for(operator_admin())
        url = f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/"
        assert client.post(url, {"decision": "anonymiser"}).status_code == 200
        second = client.post(url, {"decision": "anonymiser"})
        assert second.status_code == 400
        assert "déjà été traitée" in str(second.data)


# ---------------------------------------------------------------------------
# 4 — the tombstone itself
# ---------------------------------------------------------------------------


class TestAnonymizeUser:
    def test_the_account_is_stripped_and_deactivated(self):
        user = make_user(username="mariama", phone="+2693440123")
        user.first_name, user.last_name = "Mariama", "Ahamada"
        user.email = "mariama@example.test"
        user.phone_verified_at = timezone.now()
        user.save()

        anonymize_user(actor=operator_admin(), user=user)
        user.refresh_from_db()

        assert user.username == f"anon-{user.pk}"
        for field in NEUTRALISED_USER_FIELDS:
            assert not getattr(user, field), field
        assert user.phone is None  # NULL, not "" — the unique pivot vanishes
        assert user.is_active is False
        assert user.has_usable_password() is False
        assert user.anonymized_at is not None
        assert User.objects.filter(pk=user.pk).exists()  # never a DELETE

    def test_the_patient_profile_keeps_a_readable_neutral_label(self):
        patient = make_claimed_patient(
            first_name="Anfia", last_name="Saïd", phone="+2693440001",
            city="Moroni", address="Quartier Coulée", national_id="CNI-42",
            emergency_contact_name="Nassim", emergency_contact_phone="+33612345678",
            emergency_contact_relationship="fils", phone_alt="+2693440002",
        )
        anonymize_user(actor=operator_admin(), user=patient.user)
        patient.refresh_from_db()

        assert patient.first_name == "Patient"
        assert patient.last_name == f"anonymisé #{patient.pk}"
        for field in BLANKED_PATIENT_FIELDS:
            assert getattr(patient, field) == "", field
        assert patient.birth_date is None
        # The profile row SURVIVES: it owns the carnet (ADR 0002/0007).
        assert PatientProfile.objects.filter(pk=patient.pk).exists()
        assert patient.claim_status == PatientProfile.ClaimStatus.ACTIVE

    def test_insurance_lines_lose_the_insurer_and_the_member_number(self):
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        patient = make_claimed_patient()
        make_encounter(patient=patient, center=center)
        create_patient_insurance(
            actor=cashier, center=center, patient=patient,
            insurer_name="Mutuelle des Comores", member_number="MC-2026-4471",
            notes="Carte présentée au guichet.",
        )
        anonymize_user(actor=operator_admin(), user=patient.user)

        insurance = PatientInsurance.objects.get(patient=patient)
        assert insurance.insurer_name == "Assurance anonymisée"
        assert insurance.member_number == ""
        assert insurance.notes == ""

    def test_guardianship_dies_in_both_directions_with_its_consents(self):
        """The person may be a guardian AND a protégé: an account that no
        longer exists must not keep a single live scope on either side."""
        patient = make_claimed_patient()
        guardian_user, guardian_profile = make_guardian_user(user=patient.user)
        # as a guardian of somebody else…
        outgoing = make_active_link(guardian_profile, make_patient())
        # …and as the protégé of somebody else.
        _other_user, other_guardian = make_guardian_user()
        incoming = make_active_link(other_guardian, patient)
        Consent.objects.create(
            patient=patient, guardian_link=incoming,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )

        anonymize_user(actor=operator_admin(), user=guardian_user)

        outgoing.refresh_from_db()
        incoming.refresh_from_db()
        assert outgoing.status == GuardianLink.Status.REVOKED
        assert incoming.status == GuardianLink.Status.REVOKED
        assert Consent.objects.active_scopes(incoming) == frozenset()
        assert GuardianProfile.objects.get(pk=guardian_profile.pk).country_of_residence == ""

    def test_staff_memberships_and_the_operator_hat_are_deactivated(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        _user, operator_row = make_platform_staff(user=doctor)
        make_platform_staff(role=PlatformStaff.Role.ADMIN)

        anonymize_user(actor=operator_admin(), user=doctor)

        assert not StaffMembership.objects.filter(
            user=doctor, is_active=True
        ).exists()
        # …but the row is KEPT: history is not amnesia.
        assert StaffMembership.objects.filter(user=doctor).exists()
        operator_row.refresh_from_db()
        assert operator_row.is_active is False

    def test_otp_codes_of_the_old_phone_are_purged(self):
        user = make_user(phone="+2693440555")
        request_otp(phone="+2693440555")
        assert OtpCode.objects.filter(phone="+2693440555").exists()

        anonymize_user(actor=operator_admin(), user=user)

        assert not OtpCode.objects.filter(phone="+2693440555").exists()

    def test_the_avatar_file_leaves_the_storage(self):
        user = make_user()
        set_user_avatar(
            user=user, uploaded_file=upload(image_bytes(), name="moi.png")
        )
        user.refresh_from_db()
        path = user.avatar.path
        from pathlib import Path

        assert Path(path).exists()

        anonymize_user(actor=operator_admin(), user=user)
        user.refresh_from_db()

        assert not user.avatar
        assert not Path(path).exists()

    def test_running_it_twice_changes_nothing_and_breaks_nothing(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        operator = operator_admin()
        anonymize_user(actor=operator, user=scn.guardian_user)
        scn.guardian_user.refresh_from_db()
        first_date = scn.guardian_user.anonymized_at

        anonymize_user(actor=operator, user=scn.guardian_user)
        scn.guardian_user.refresh_from_db()

        assert scn.guardian_user.anonymized_at == first_date
        assert scn.guardian_user.username == f"anon-{scn.guardian_user.pk}"
        assert scn.guardian_user.phone is None

    def test_it_is_safe_on_an_already_inactive_account(self):
        user = make_user()
        user.is_active = False
        user.save(update_fields=["is_active"])
        anonymize_user(actor=operator_admin(), user=user)
        user.refresh_from_db()
        assert user.is_active is False
        assert user.anonymized_at is not None


# ---------------------------------------------------------------------------
# 5 — what SURVIVES, and why it is a choice
# ---------------------------------------------------------------------------


class TestTheHealthRecordIsNotErased:
    """ADR 0007, explicitly: the carnet belongs to the patient and follows
    the local retention law. It becomes an ORPHAN OF IDENTITY, not a hole.

    This class exists so a reviewer can tell a decision from an oversight:
    if a future sprint wants to purge the carnet, it deletes these tests
    on purpose, with an ADR to point at.
    """

    def _patient_with_a_full_record(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        practitioner = StaffMembership.objects.get(user=doctor, center=center)
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")
        encounter = make_encounter(
            patient=patient, center=center, practitioner=practitioner
        )
        create_record_entry(
            actor=doctor, encounter=encounter,
            entry_type=HealthRecordEntry.EntryType.HISTORY,
            content="Hypertension connue depuis 2023.",
        )
        update_patient_medical_file(
            actor=doctor, center=center, patient=patient,
            blood_group=PatientMedicalFile.BloodGroup.O_POS, notes="RAS",
        )
        record_vital_signs(
            actor=doctor, encounter=encounter, measured_by=practitioner,
            systolic_bp=152, diastolic_bp=94,
        )
        create_patient_document(
            actor=doctor, center=center, patient=patient,
            uploaded_file=SimpleUploadedFile(
                "analyses.png", image_bytes(), content_type="image/png"
            ),
            doc_type=PatientDocument.DocType.LAB_RESULT,
            title="Analyses sanguines",
        )
        return center, patient, encounter

    def test_every_clinical_row_survives_the_erasure(self):
        _center, patient, encounter = self._patient_with_a_full_record()
        anonymize_user(actor=operator_admin(), user=patient.user)

        assert Encounter.objects.filter(pk=encounter.pk).exists()
        assert HealthRecordEntry.objects.for_patient(patient).count() == 1
        assert PatientMedicalFile.objects.filter(patient=patient).exists()
        assert VitalSigns.objects.for_patient(patient).count() == 1
        assert PatientDocument.objects.for_patient(patient).count() == 1

    def test_the_clinical_CONTENT_is_untouched_not_blanked(self):
        _center, patient, encounter = self._patient_with_a_full_record()
        anonymize_user(actor=operator_admin(), user=patient.user)

        encounter.refresh_from_db()
        assert encounter.reason  # the story stays readable to the center
        entry = HealthRecordEntry.objects.for_patient(patient).get()
        assert "Hypertension" in entry.content
        assert (
            PatientMedicalFile.objects.get(patient=patient).blood_group
            == PatientMedicalFile.BloodGroup.O_POS
        )

    def test_but_the_record_no_longer_names_anybody(self):
        """The point of « orphan of identity »: the carnet is intact, the
        person behind it is not nameable from Chioni any more."""
        _center, patient, _encounter = self._patient_with_a_full_record()
        anonymize_user(actor=operator_admin(), user=patient.user)
        patient.refresh_from_db()
        assert "Anfia" not in f"{patient.first_name} {patient.last_name}"
        assert patient.user.phone is None


class TestMoneyAndEvidenceSurvive:
    def test_ledger_receipts_and_invoices_are_intact(self):
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        ledger_before = LedgerEntry.objects.count()
        tx_before = LedgerTransaction.objects.count()

        anonymize_user(actor=operator_admin(), user=scn.guardian_user)

        assert LedgerEntry.objects.count() == ledger_before
        assert LedgerTransaction.objects.count() == tx_before
        receipt = Receipt.objects.get(payment_request=scn.payment_request)
        assert receipt.amount_kmf_received > 0
        assert Invoice.objects.filter(pk=scn.invoice.pk).exists()
        assert PaymentIntent.objects.filter(pk=scn.intent.pk).exists()

    def test_the_center_still_reads_its_receipt_after_the_payer_is_erased(self):
        """The money trail must not depend on the payer's identity: the
        receipt carries ids and amounts, never a name (ADR 0007)."""
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        anonymize_user(actor=operator_admin(), user=scn.guardian_user)

        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/payment-requests/"
            f"{scn.payment_request.pk}/"
        )
        assert response.status_code == 200
        assert response.data["status"] == "cloturee"

    def test_the_audit_trail_keeps_every_row(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        before = AuditLog.objects.count()
        anonymize_user(actor=operator_admin(), user=scn.guardian_user)
        # Append-only: entries are ADDED, never rewritten nor removed.
        assert AuditLog.objects.count() > before
        assert AuditLog.objects.filter(
            action=AuditAction.PAYMENT_RECORDED
        ).exists()


class TestStaffViewsSurviveAnAnonymizedPatient:
    def test_the_registry_and_the_consultation_list_still_answer(self):
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")
        make_encounter(patient=patient, center=center)
        make_appointment(patient=patient, center=center)

        anonymize_user(actor=operator_admin(), user=patient.user)

        client = client_for(doctor)
        registry = client.get(f"/api/v1/centers/{center.pk}/patients/")
        assert registry.status_code == 200
        (row,) = registry.data["results"]
        assert row["first_name"] == "Patient"
        assert row["last_name"].startswith("anonymisé")
        assert row["phone"] == ""

        encounters = client.get(f"/api/v1/centers/{center.pk}/encounters/")
        assert encounters.status_code == 200
        assert encounters.data["count"] == 1

        queue = client.get(f"/api/v1/centers/{center.pk}/appointments/")
        assert queue.status_code == 200

    def test_the_anonymised_account_can_no_longer_authenticate(self):
        patient = make_claimed_patient()
        anonymize_user(actor=operator_admin(), user=patient.user)
        # force_authenticate bypasses the JWT check, so assert the flag the
        # authentication layer reads.
        patient.user.refresh_from_db()
        assert patient.user.is_active is False


# ---------------------------------------------------------------------------
# 6 — the guards: explicit, motivated, never silent
# ---------------------------------------------------------------------------


class TestErasureGuards:
    def test_the_last_active_director_of_a_center_is_blocked(self):
        center, director = make_center_with_director()
        assert erasure_blockers(director) == [ERASURE_BLOCKER_LAST_DIRECTOR]

        erasure_request = request_erasure(user=director)
        response = client_for(operator_admin()).post(
            f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
            {"decision": "anonymiser"},
        )
        assert response.status_code == 400
        assert "dernier directeur actif" in str(response.data)
        # The request STAYS pending — nothing was anonymised.
        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.PENDING
        director.refresh_from_db()
        assert director.anonymized_at is None
        assert director.is_active is True

    def test_a_co_director_unblocks_it(self):
        center, director = make_center_with_director()
        make_staff(user=make_user(), center=center, role=Role.DIRECTOR)
        assert erasure_blockers(director) == []

    def test_a_payment_in_flight_blocks_the_payer(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        from apps.trustbridge.services import create_payment_intent

        create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert erasure_blockers(scn.guardian_user) == [
            ERASURE_BLOCKER_PAYMENT_IN_FLIGHT
        ]

        erasure_request = request_erasure(user=scn.guardian_user)
        response = client_for(operator_admin()).post(
            f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
            {"decision": "anonymiser"},
        )
        assert response.status_code == 400
        assert "paiement est en cours" in str(response.data)

    def test_a_landed_payment_no_longer_blocks(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        assert erasure_blockers(scn.guardian_user) == []

    def test_the_last_platform_admin_is_blocked(self):
        """Symmetric of the tenant guard: losing every operator would lock
        Chioni out of its own back-office."""
        lonely, _op = make_platform_staff(role=PlatformStaff.Role.ADMIN)
        assert erasure_blockers(lonely) == [ERASURE_BLOCKER_LAST_PLATFORM_ADMIN]

        make_platform_staff(role=PlatformStaff.Role.ADMIN)
        assert erasure_blockers(lonely) == []

    def test_a_support_operator_is_never_blocked_by_that_guard(self):
        support, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        assert erasure_blockers(support) == []

    def test_all_blockers_are_reported_at_once(self):
        """One answer listing everything to fix, not a refusal drip-feed."""
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        from apps.trustbridge.services import create_payment_intent

        create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        center = make_center()
        make_staff(user=scn.guardian_user, center=center, role=Role.DIRECTOR)
        assert set(erasure_blockers(scn.guardian_user)) == {
            ERASURE_BLOCKER_LAST_DIRECTOR, ERASURE_BLOCKER_PAYMENT_IN_FLIGHT
        }


# ---------------------------------------------------------------------------
# 7 — the audit trail of the erasure (ADR 0007: references only)
# ---------------------------------------------------------------------------


class TestErasureAuditTrail:
    def test_the_four_actions_are_journalised(self):
        user = make_user(username="mariama", phone="+2693440321")
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="anonymiser",
        )
        actions = set(AuditLog.objects.values_list("action", flat=True))
        assert {
            AuditAction.ERASURE_REQUESTED,
            AuditAction.ERASURE_PROCESSED,
            AuditAction.USER_ANONYMIZED,
        } <= actions

    def test_the_refusal_motive_never_enters_the_payload(self):
        user = make_user()
        erasure_request = request_erasure(user=user)
        secret = "Litige en cours avec le centre El-Maarouf"
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="refuser", refusal_reason=secret,
        )
        entry = AuditLog.objects.get(action=AuditAction.ERASURE_REFUSED)
        assert entry.payload == {
            "erasure_request_id": erasure_request.pk,
            "user_id": user.pk,
            "has_reason": True,
        }
        assert secret not in str(
            list(AuditLog.objects.values_list("payload", flat=True))
        )

    def test_no_erasure_payload_carries_pii(self):
        user = make_user(username="mariama.ahamada", phone="+2693440999")
        user.first_name, user.last_name = "Mariama", "Ahamada"
        user.email = "mariama@example.test"
        user.save()
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="anonymiser",
        )
        blob = str(list(AuditLog.objects.values_list("payload", flat=True)))
        for pii in ("Mariama", "Ahamada", "+2693440999", "mariama@example.test"):
            assert pii not in blob, pii

    def test_the_anonymisation_entry_counts_what_it_did(self):
        patient = make_claimed_patient()
        _other, guardian = make_guardian_user()
        make_active_link(guardian, patient)
        anonymize_user(actor=operator_admin(), user=patient.user)

        entry = AuditLog.objects.get(action=AuditAction.USER_ANONYMIZED)
        assert entry.payload["user_id"] == patient.user.pk
        assert entry.payload["had_patient_profile"] is True
        assert entry.payload["had_guardian_profile"] is False
        assert entry.payload["links_revoked"] == 1
        assert entry.payload["replay"] is False

    def test_erasure_actions_are_transverse_and_carry_no_center(self):
        """They concern a PERSON, not a tenant — putting them under a
        center would be a fiction, and would surface them in a director's
        journal (lot 2 whitelist deliberately excludes them)."""
        from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS

        user = make_user()
        erasure_request = request_erasure(user=user)
        process_erasure_request(
            actor=operator_admin(), erasure_request=erasure_request,
            decision="anonymiser",
        )
        for action in (
            AuditAction.ERASURE_REQUESTED,
            AuditAction.ERASURE_PROCESSED,
            AuditAction.USER_ANONYMIZED,
        ):
            assert action not in DIRECTOR_JOURNAL_ACTIONS, action
            for entry in AuditLog.objects.filter(action=action):
                assert entry.center_id is None


# ---------------------------------------------------------------------------
# 8 — portability: the export reveals NOTHING new
# ---------------------------------------------------------------------------


class TestExportPerimeter:
    def test_a_bare_account_gets_its_identity_and_four_null_hats(self):
        user = make_user()
        response = client_for(user).get("/api/v1/auth/me/export/")
        assert response.status_code == 200
        assert set(response.data) == {
            "generated_at", "account", "patient", "guardian",
            "center_staff", "platform_staff",
        }
        assert response.data["patient"] is None
        assert response.data["guardian"] is None
        assert response.data["center_staff"] is None
        assert response.data["platform_staff"] is None
        assert response.data["account"]["id"] == user.pk

    def test_anonymous_is_401(self):
        assert client_for().get("/api/v1/auth/me/export/").status_code == 401

    def test_the_patient_block_mirrors_the_patient_space(self):
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        practitioner = StaffMembership.objects.get(
            user=scn.doctor, center=scn.center
        )
        create_record_entry(
            actor=scn.doctor, encounter=scn.encounter,
            entry_type=HealthRecordEntry.EntryType.ALLERGY,
            content="Allergie à la pénicilline.",
        )
        record_vital_signs(
            actor=scn.doctor, encounter=scn.encounter,
            measured_by=practitioner, systolic_bp=130, diastolic_bp=80,
        )
        create_patient_document(
            actor=scn.doctor, center=scn.center, patient=scn.patient,
            uploaded_file=SimpleUploadedFile(
                "r.png", image_bytes(), content_type="image/png"
            ),
            doc_type=PatientDocument.DocType.LAB_RESULT, title="Bilan",
        )
        make_appointment(patient=scn.patient, center=scn.center)

        block = client_for(scn.patient_user).get(
            "/api/v1/auth/me/export/"
        ).data["patient"]

        assert set(block) == {
            "profile", "guardian_links", "appointments", "encounters",
            "prescriptions", "record_entries", "medical_file", "vital_signs",
            "documents", "insurances", "payment_requests", "receipts",
            "cash_receipts",
        }
        assert block["profile"]["id"] == scn.patient.pk
        assert len(block["encounters"]) == 1
        assert len(block["record_entries"]) == 1
        assert len(block["vital_signs"]) == 1
        assert len(block["appointments"]) == 1
        assert len(block["payment_requests"]) == 1
        assert len(block["receipts"]) == 1
        assert len(block["guardian_links"]) == 1
        # Documents: METADATA only — never a file URL (ADR 0016 §5).
        (document,) = block["documents"]
        assert set(document) == {
            "id", "center", "center_name", "doc_type", "title",
            "source_encounter", "created_at",
        }

    def test_the_export_carries_the_patients_own_clinical_content(self):
        """It is THEIR carnet (ADR 0002) — the same content
        `/patients/me/encounters/` already serves."""
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        block = client_for(scn.patient_user).get(
            "/api/v1/auth/me/export/"
        ).data["patient"]
        (encounter,) = block["encounters"]
        assert encounter["reason"] == scn.encounter.reason
        assert "diagnosis" in encounter

    def test_the_guardian_block_never_contains_the_carnet(self):
        """THE invariant of this endpoint. A guardian holding the clinical
        consent still gets no clinical read — none exists in the product
        (verrou de sprint ADR 0016), so none may appear here."""
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        Consent.objects.create(
            patient=scn.patient, guardian_link=scn.link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        create_record_entry(
            actor=scn.doctor, encounter=scn.encounter,
            entry_type=HealthRecordEntry.EntryType.ALLERGY,
            content="Allergie à la pénicilline.",
        )

        payload = client_for(scn.guardian_user).get("/api/v1/auth/me/export/").data
        block = payload["guardian"]

        assert payload["patient"] is None
        assert set(block) == {
            "profile", "links", "proteges", "invitations",
            "payment_requests", "receipts",
        }
        body = str(payload)
        assert "pénicilline" not in body
        assert scn.encounter.reason not in body
        # …and not even the sensitive act LABEL (ADR 0005).
        assert scn.tariff.label not in body
        assert len(block["payment_requests"]) == 1
        assert block["payment_requests"][0]["lines"][0]["generic_category"]

    def test_a_revoked_link_removes_the_rows_from_the_export_too(self):
        """The export is derived from the SAME helpers as the screens
        (F3): revoking the link empties both, in one move."""
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        scn.link.revoke()

        block = client_for(scn.guardian_user).get(
            "/api/v1/auth/me/export/"
        ).data["guardian"]
        assert block["payment_requests"] == []
        assert block["proteges"] == []
        # The link HISTORY stays — the guardian already sees it at
        # `/guardian/links/`, and hiding it would be dishonest.
        assert len(block["links"]) == 1
        assert block["links"][0]["status"] == "revoque"

    def test_the_staff_block_is_memberships_not_the_centers_data(self):
        center, director = make_center_with_director(name="Clinique Ylang")
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")
        make_encounter(patient=patient, center=center)

        payload = client_for(director).get("/api/v1/auth/me/export/").data
        assert set(payload["center_staff"]) == {"memberships"}
        (membership,) = payload["center_staff"]["memberships"]
        assert membership["center"]["name"] == "Clinique Ylang"
        assert membership["role"] == Role.DIRECTOR
        # The employee's export is not the tenant's export.
        assert "Anfia" not in str(payload)

    def test_the_operator_block_is_the_hat_and_nothing_of_the_tenants(self):
        make_center(name="Clinique Ylang")
        operator, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        payload = client_for(operator).get("/api/v1/auth/me/export/").data
        assert payload["platform_staff"]["role"] == "support"
        assert "Ylang" not in str(payload)

    def test_cumulated_hats_produce_cumulated_blocks(self):
        """A doctor who is also a guardian gets both spaces — the hats add
        up in the export exactly as they add up in `/auth/me/`."""
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        guardian_user, guardian_profile = make_guardian_user(user=doctor)
        make_active_link(guardian_profile, make_patient())

        payload = client_for(doctor).get("/api/v1/auth/me/export/").data
        assert payload["center_staff"] is not None
        assert payload["guardian"] is not None
        assert payload["patient"] is None

    def test_the_export_lists_my_own_erasure_requests(self):
        user = make_user()
        request_erasure(user=user)
        account = client_for(user).get("/api/v1/auth/me/export/").data["account"]
        assert len(account["erasure_requests"]) == 1
        assert account["erasure_requests"][0]["status"] == "en_attente"

    def test_the_export_declares_its_own_throttle_scope(self):
        """A fan-out endpoint must never ride on the generous global user
        throttle alone (patron of ``uploads``, S1)."""
        from django.conf import settings

        from apps.accounts.views import MeExportView

        assert MeExportView.throttle_scope == "data_export"
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        assert rates["data_export"]


class TestExportOfAnAnonymizedAccount:
    def test_it_answers_an_empty_identity_without_crashing(self):
        """Not a nominal path (the account cannot log in any more), but the
        builder must stay total: a tombstone has no phone and no avatar."""
        from apps.accounts.export import build_user_export

        patient = make_claimed_patient()
        anonymize_user(actor=operator_admin(), user=patient.user)
        patient.user.refresh_from_db()

        payload = build_user_export(user=patient.user)
        assert payload["account"]["phone"] is None
        assert payload["account"]["avatar"] is None
        assert payload["patient"]["profile"]["first_name"] == "Patient"


# ---------------------------------------------------------------------------
# 9 — end to end, through the API only
# ---------------------------------------------------------------------------


class TestEndToEnd:
    def test_a_guardian_asks_and_the_operator_executes(self):
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        operator = operator_admin()

        asked = client_for(scn.guardian_user).post(
            "/api/v1/auth/me/erasure-request/"
        )
        assert asked.status_code == 201

        queue = client_for(operator).get("/api/v1/platform/erasure-requests/")
        (row,) = queue.data["results"]
        assert row["blockers"] == []
        assert row["hats"]["is_guardian"] is True

        processed = client_for(operator).post(
            f"/api/v1/platform/erasure-requests/{row['id']}/process/",
            {"decision": "anonymiser"},
        )
        assert processed.status_code == 200
        assert processed.data["status"] == "traitee"
        assert processed.data["processed_by"] == operator.pk

        scn.guardian_user.refresh_from_db()
        assert scn.guardian_user.phone is None
        assert scn.guardian_user.is_active is False
        scn.link.refresh_from_db()
        assert scn.link.status == GuardianLink.Status.REVOKED
        # The care that was paid for is untouched.
        assert Receipt.objects.filter(
            payment_request=scn.payment_request
        ).exists()
        assert Encounter.objects.filter(pk=scn.encounter.pk).exists()

    def test_the_patient_keeps_their_carnet_and_their_receipts(self):
        """After their guardian is erased, the patient's own space still
        works — an erasure is personal, never contagious."""
        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        anonymize_user(actor=operator_admin(), user=scn.guardian_user)

        client = client_for(scn.patient_user)
        assert client.get("/api/v1/patients/me/encounters/").data["count"] == 1
        assert client.get("/api/v1/patients/me/receipts/").data["count"] == 1
        links = client.get("/api/v1/patients/me/guardians/").data["results"]
        assert links[0]["status"] == "revoque"
        assert links[0]["scopes"] == []

    def test_amounts_stay_exact_after_an_erasure(self):
        scn = build_scenario(status=PaymentRequest.Status.CLOSED, price_kmf="15000")
        receipt = Receipt.objects.get(payment_request=scn.payment_request)
        before = receipt.amount_kmf_received
        anonymize_user(actor=operator_admin(), user=scn.guardian_user)
        receipt.refresh_from_db()
        assert receipt.amount_kmf_received == before == Decimal("15000.00")
