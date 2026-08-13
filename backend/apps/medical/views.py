"""Medical views — audiences: STAFF of the producing center, PATIENT owner.

NO guardian endpoint here (phase A rule): the ``detail_clinique`` scope
will be wired whole in a later phase, never half-exposed.
"""

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response

from apps.centers.models import StaffMembership, TariffItem
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsPatientSelf,
    IsStaffOfCenter,
    active_membership_qs,
    claimed_patient_profile,
)
from apps.medical.models import Encounter, HealthRecordEntry, Prescription
from apps.medical.serializers import (
    EncounterAdminSerializer,
    EncounterClinicalSerializer,
    EncounterCreateSerializer,
    EncounterPatientSerializer,
    HealthRecordEntryCreateSerializer,
    HealthRecordEntrySerializer,
    PrescriptionCreateSerializer,
    PrescriptionSerializer,
)
from apps.medical.services import (
    create_encounter,
    create_prescription,
    create_record_entry,
)
from apps.patients.views import center_patients_qs
from apps.scheduling.models import Appointment

#: Roles allowed to produce AND read clinical content (R-API-1).
CLINICAL_ROLES = (
    StaffMembership.Role.DOCTOR,
    StaffMembership.Role.NURSE,
    StaffMembership.Role.MIDWIFE,
)
#: Roles allowed to prescribe.
PRESCRIBER_ROLES = (
    StaffMembership.Role.DOCTOR,
    StaffMembership.Role.MIDWIFE,
)
#: Roles allowed to READ prescriptions: clinical + the pharmacist who
#: delivers them (R-API-1).
PRESCRIPTION_READ_ROLES = CLINICAL_ROLES + (StaffMembership.Role.PHARMACIST,)


def is_clinical_member(user, center):
    """Does ``user`` hold an active CLINICAL role in ``center``?

    R-API-1 — clinical reads are segmented by role INSIDE the tenant: this
    is the single test the encounter views use to pick the clinical vs the
    administrative serializer.
    """
    return active_membership_qs(user, center=center, roles=CLINICAL_ROLES).exists()


# ---------------------------------------------------------------------------
# Audience: STAFF of the producing center
# ---------------------------------------------------------------------------


class CenterEncounterListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET /centers/{center_pk}/encounters/ (any staff) — POST (clinical roles).

    R-API-1: the GET payload depends on the caller's ROLE — clinical staff
    get the clinical serializer (reason, diagnosis), administrative staff
    the operating one (date, patient, practitioner, acts). The queryset
    stays center-scoped in both cases.

    The practitioner is ALWAYS the caller's own clinical membership in this
    center: a view can never attribute an act to someone else's hat.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(*CLINICAL_ROLES)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EncounterCreateSerializer
        if is_clinical_member(self.request.user, self.center):
            return EncounterClinicalSerializer
        return EncounterAdminSerializer

    def get_queryset(self):
        return (
            Encounter.objects.for_center(self.center)
            .select_related("practitioner__user")
            .prefetch_related("acts")
            .order_by("-occurred_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Perimeter checks: patient seen by this center, tariffs of its grid.
        patient = get_object_or_404(
            center_patients_qs(self.center), pk=data["patient"]
        )
        tariffs = [
            get_object_or_404(TariffItem.objects.for_center(self.center), pk=pk)
            for pk in data["tariff_items"]
        ]
        appointment = None
        if data.get("appointment") is not None:
            # Center-scoped resolution (IDOR → 404); the service then checks
            # the appointment concerns the SAME patient (400) and honors it.
            appointment = get_object_or_404(
                Appointment.objects.for_center(self.center),
                pk=data["appointment"],
            )
        practitioner = (
            active_membership_qs(request.user, center=self.center, roles=CLINICAL_ROLES)
            .order_by("id")
            .first()
        )
        encounter = create_encounter(
            actor=request.user,
            center=self.center,
            practitioner=practitioner,
            patient=patient,
            reason=data["reason"],
            diagnosis=data.get("diagnosis", ""),
            occurred_at=data.get("occurred_at"),
            tariff_items=tariffs,
            appointment=appointment,
        )
        return Response(
            EncounterClinicalSerializer(encounter).data,  # creator IS clinical
            status=status.HTTP_201_CREATED,
        )


class CenterEncounterDetailView(CenterScopedViewMixin, generics.RetrieveAPIView):
    """GET /centers/{center_pk}/encounters/{pk}/ — center-scoped (IDOR → 404).

    R-API-1: clinical roles read the clinical view; administrative roles
    the operating one (no diagnosis, no reason).
    """

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        if is_clinical_member(self.request.user, self.center):
            return EncounterClinicalSerializer
        return EncounterAdminSerializer

    def get_queryset(self):
        return (
            Encounter.objects.for_center(self.center)
            .select_related("practitioner__user")
            .prefetch_related("acts")
        )


class _EncounterNestedView(CenterScopedViewMixin, generics.GenericAPIView):
    """Base for clinical sub-routes of one of the center's encounters."""

    def get_encounter(self):
        return get_object_or_404(
            Encounter.objects.for_center(self.center),
            pk=self.kwargs["encounter_pk"],
        )


class EncounterPrescriptionView(_EncounterNestedView):
    """GET/POST /centers/{center_pk}/encounters/{encounter_pk}/prescriptions/

    R-API-1 — prescriptions are clinical content: readable by clinical
    roles AND the pharmacist (who delivers them); writable by prescribers
    only. Administrative staff (secretary, cashier, director) get 403.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(*PRESCRIBER_ROLES)()]
        return [IsStaffOfCenter(*PRESCRIPTION_READ_ROLES)()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PrescriptionCreateSerializer
        return PrescriptionSerializer

    def get(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        prescriptions = (
            Prescription.objects.filter(encounter=encounter)
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(PrescriptionSerializer(prescriptions, many=True).data)

    def post(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prescription = create_prescription(
            actor=request.user,
            encounter=encounter,
            items=serializer.validated_data["items"],
        )
        return Response(
            PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED
        )


class EncounterRecordEntryView(_EncounterNestedView):
    """GET/POST /centers/{center_pk}/encounters/{encounter_pk}/record-entries/

    R-API-1 — carnet entries are clinical content: read AND write are
    reserved to clinical roles. The GET lists the entries of the
    encounter's patient PRODUCED BY THIS CENTER (the staff view stays
    tenant-scoped — the transversal carnet remains the patient's own
    space, ADR 0002).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HealthRecordEntryCreateSerializer
        return HealthRecordEntrySerializer

    def get(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        entries = HealthRecordEntry.objects.filter(
            patient=encounter.patient, source_encounter__center=self.center
        ).order_by("-created_at")
        return Response(HealthRecordEntrySerializer(entries, many=True).data)

    def post(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = create_record_entry(
            actor=request.user,
            encounter=encounter,
            **serializer.validated_data,
        )
        return Response(
            HealthRecordEntrySerializer(entry).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# Audience: the PATIENT owner of the carnet (transversal, all centers)
# ---------------------------------------------------------------------------


class MyEncountersView(generics.ListAPIView):
    """GET /patients/me/encounters/ — my consultations across ALL centers."""

    permission_classes = [IsPatientSelf]
    serializer_class = EncounterPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            Encounter.objects.for_patient(profile)
            .select_related("center")
            .prefetch_related("acts")
            .order_by("-occurred_at")
        )


class MyPrescriptionsView(generics.ListAPIView):
    """GET /patients/me/prescriptions/ — my prescriptions, all centers."""

    permission_classes = [IsPatientSelf]
    serializer_class = PrescriptionSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            Prescription.objects.for_patient(profile)
            .prefetch_related("items")
            .order_by("-created_at")
        )


class MyRecordEntriesView(generics.ListAPIView):
    """GET /patients/me/record-entries/ — my carnet entries, all centers."""

    permission_classes = [IsPatientSelf]
    serializer_class = HealthRecordEntrySerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return HealthRecordEntry.objects.for_patient(profile).order_by("-created_at")
