"""Portability export (RGPD art. 20) — `GET /auth/me/export/`, S4 lot 3.

**The rule that governs this whole module: the export reveals NOTHING new.**
It re-plays, hat by hat, the exact querysets and the exact serializers of
the screens the caller already has. Concretely:

- a GUARDIAN gets what `/guardian/*` gives them — their profile, their
  links, the requests explicitly SHARED with them (F3: active link ×
  ``paiements`` scope × share) and the matching receipts. **Never their
  protégé's carnet**, whatever consent they hold: no clinical guardian
  read exists in the product (verrou de sprint ADR 0016), so none exists
  here ;
- a PATIENT gets their `/patients/me/*` space — carnet, documents
  (METADATA only, never the bytes), measures, insurances, appointments,
  payment requests and receipts ;
- a STAFF member gets their memberships, exactly as `/auth/me/` renders
  them — not their center's data (that belongs to the tenant, not to the
  employee) ;
- an OPERATOR gets their hat, nothing of the tenants they supervise.

Anything that would need a NEW permission decision must not be added here
without going through the audit/ADR route first: an export endpoint is the
easiest place in a codebase to leak a whole space by accident, because it
touches every serializer at once.

Cross-audience bleed is prevented the same way as everywhere else
(ADR 0008): each block is derived from ONE hat helper
(``claimed_patient_profile`` / ``guardian_profile`` / ``active_membership_qs``
/ ``platform_staff``), never from « any right the user happens to hold ».
"""

from django.utils import timezone

from apps.accounts.models import ErasureRequest
from apps.accounts.serializers import (
    ErasureRequestSerializer,
    _OwnPlatformStaffSerializer,
    _StaffMembershipSerializer,
)
from apps.common.permissions import (
    active_membership_qs,
    claimed_patient_profile,
    guardian_profile,
    guardian_links_with_scope,
    payment_requests_shared_with_guardian,
    platform_staff,
    receipts_visible_to_guardian,
)
from apps.common.uploads import media_url
from apps.medical.models import (
    Consent,
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    VitalSigns,
)
from apps.medical.serializers import (
    EncounterPatientSerializer,
    HealthRecordEntrySerializer,
    PatientDocumentPatientSerializer,
    PatientMedicalFileSerializer,
    PrescriptionSerializer,
    VitalSignsPatientSerializer,
)
from apps.patients.models import GuardianLink, PatientInsurance
from apps.patients.serializers import (
    GuardianLinkGuardianSerializer,
    GuardianLinkHistorySerializer,
    GuardianLinkPatientSerializer,
    GuardianProfileSerializer,
    PatientInsuranceSerializer,
    PatientSelfSerializer,
)
from apps.scheduling.models import Appointment
from apps.scheduling.serializers import AppointmentPatientSerializer
from apps.trustbridge.models import CashReceipt, PaymentRequest, Receipt
from apps.trustbridge.serializers import (
    CashReceiptPatientSerializer,
    PaymentRequestGuardianSerializer,
    PaymentRequestPatientSerializer,
    ReceiptSerializer,
)


def build_user_export(*, user, request=None):
    """The caller's own data, one block per hat they actually wear.

    A hat the caller does not wear is rendered as ``null`` (not an empty
    object): « je n'ai pas d'espace tuteur » and « mon espace tuteur est
    vide » are two different truths, and an export that blurred them would
    be a poor answer to a portability request.
    """
    payload = {
        "generated_at": timezone.now(),
        "account": _account_block(user, request),
        "patient": None,
        "guardian": None,
        "center_staff": None,
        "platform_staff": None,
    }
    profile = claimed_patient_profile(user)
    if profile is not None:
        payload["patient"] = _patient_block(profile)
    guardian = guardian_profile(user)
    if guardian is not None:
        payload["guardian"] = _guardian_block(user, guardian)
    memberships = active_membership_qs(user).select_related("center")
    if memberships.exists():
        payload["center_staff"] = {
            "memberships": _StaffMembershipSerializer(
                memberships, many=True, context={"request": request}
            ).data
        }
    operator = platform_staff(user)
    if operator is not None:
        payload["platform_staff"] = _OwnPlatformStaffSerializer(operator).data
    return payload


def _account_block(user, request):
    """The account itself — the same identity `/auth/me/` already renders,
    plus the account-lifecycle dates a portability answer owes (creation,
    last connection) and the RGPD requests the person filed."""
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "avatar": media_url(request, user.avatar),
        "phone_verified_at": user.phone_verified_at,
        "date_joined": user.date_joined,
        "last_login": user.last_login,
        "erasure_requests": ErasureRequestSerializer(
            ErasureRequest.objects.filter(user=user).order_by("-requested_at", "-id"),
            many=True,
        ).data,
    }


def _patient_block(profile):
    """Mirror of `/patients/me/*` — same querysets, same serializers.

    ``documents`` carries METADATA only (the serializer has no file field
    by contract, ADR 0016 §5): an export must never become the public URL
    that the private storage refuses to produce. Archived documents stay
    excluded, exactly as in the patient's list.
    """
    medical_file = (
        PatientMedicalFile.objects.filter(patient=profile).first()
        or PatientMedicalFile()
    )
    return {
        "profile": PatientSelfSerializer(profile).data,
        "guardian_links": GuardianLinkPatientSerializer(
            GuardianLink.objects.filter(patient=profile)
            .select_related("guardian__user")
            .order_by("-created_at"),
            many=True,
        ).data,
        "appointments": AppointmentPatientSerializer(
            Appointment.objects.for_patient(profile)
            .select_related("center", "practitioner__user")
            .order_by("-scheduled_at", "-id"),
            many=True,
        ).data,
        "encounters": EncounterPatientSerializer(
            Encounter.objects.for_patient(profile)
            .select_related("center")
            .prefetch_related("acts")
            .order_by("-occurred_at"),
            many=True,
        ).data,
        "prescriptions": PrescriptionSerializer(
            Prescription.objects.for_patient(profile)
            .prefetch_related("items")
            .order_by("-created_at"),
            many=True,
        ).data,
        "record_entries": HealthRecordEntrySerializer(
            HealthRecordEntry.objects.for_patient(profile).order_by("-created_at"),
            many=True,
        ).data,
        "medical_file": PatientMedicalFileSerializer(medical_file).data,
        "vital_signs": VitalSignsPatientSerializer(
            VitalSigns.objects.for_patient(profile).order_by("-measured_at", "-id"),
            many=True,
        ).data,
        "documents": PatientDocumentPatientSerializer(
            PatientDocument.objects.for_patient(profile)
            .filter(archived_at__isnull=True)
            .select_related("center")
            .order_by("-created_at"),
            many=True,
        ).data,
        "insurances": PatientInsuranceSerializer(
            PatientInsurance.objects.filter(patient=profile), many=True
        ).data,
        "payment_requests": PaymentRequestPatientSerializer(
            PaymentRequest.objects.filter(invoice__patient=profile)
            .select_related("invoice__center")
            .prefetch_related("invoice__lines", "shared_with")
            .order_by("-created_at"),
            many=True,
        ).data,
        "receipts": ReceiptSerializer(
            Receipt.objects.filter(payment_request__invoice__patient=profile)
            .select_related("center")
            .order_by("-issued_at"),
            many=True,
        ).data,
        "cash_receipts": CashReceiptPatientSerializer(
            CashReceipt.objects.filter(cash_payment__invoice__patient=profile)
            .select_related("center", "cash_payment__reversal")
            .order_by("-issued_at"),
            many=True,
        ).data,
    }


def _guardian_block(user, guardian):
    """Mirror of `/guardian/*` — and of NOTHING else.

    The double derivation (F3) is untouched: ``proteges`` and
    ``payment_requests`` go through the central helpers, so a suspended
    link (claimant-confirmation gate) or a withdrawn share removes rows
    here exactly as it removes them from the screens. ``links`` is the
    history list — display name and lifecycle only, no protégé phone, no
    claim status, nothing clinical: the guardian's carnet block does not
    exist because the endpoint behind it does not exist.
    """
    return {
        "profile": GuardianProfileSerializer(guardian).data,
        "links": GuardianLinkHistorySerializer(
            GuardianLink.objects.filter(guardian=guardian)
            .select_related("patient")
            .order_by("-created_at"),
            many=True,
        ).data,
        "proteges": GuardianLinkGuardianSerializer(
            guardian_links_with_scope(user, Consent.Scope.PAYMENTS)
            .select_related("patient")
            .order_by("-created_at"),
            many=True,
        ).data,
        "invitations": GuardianLinkGuardianSerializer(
            GuardianLink.objects.filter(
                guardian=guardian, status=GuardianLink.Status.INVITATION_SENT
            )
            .select_related("patient")
            .order_by("-created_at"),
            many=True,
        ).data,
        "payment_requests": PaymentRequestGuardianSerializer(
            payment_requests_shared_with_guardian(user)
            .select_related("invoice__patient", "invoice__center")
            .prefetch_related("invoice__lines")
            .order_by("-created_at"),
            many=True,
        ).data,
        "receipts": ReceiptSerializer(
            receipts_visible_to_guardian(user)
            .select_related("center")
            .order_by("-issued_at"),
            many=True,
        ).data,
    }
