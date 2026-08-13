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
    EncounterCreateSerializer,
    EncounterPatientSerializer,
    EncounterStaffSerializer,
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

#: Roles allowed to produce clinical content.
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


# ---------------------------------------------------------------------------
# Audience: STAFF of the producing center
# ---------------------------------------------------------------------------


class CenterEncounterListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET /centers/{center_pk}/encounters/ (any staff) — POST (clinical roles).

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
        return EncounterStaffSerializer

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
        )
        return Response(
            EncounterStaffSerializer(encounter).data, status=status.HTTP_201_CREATED
        )


class CenterEncounterDetailView(CenterScopedViewMixin, generics.RetrieveAPIView):
    """GET /centers/{center_pk}/encounters/{pk}/ — center-scoped (IDOR → 404)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = EncounterStaffSerializer

    def get_queryset(self):
        return (
            Encounter.objects.for_center(self.center)
            .select_related("practitioner__user")
            .prefetch_related("acts")
        )


class _EncounterNestedCreateView(CenterScopedViewMixin, generics.GenericAPIView):
    """Base for POSTing clinical content onto one of the center's encounters."""

    def get_encounter(self):
        return get_object_or_404(
            Encounter.objects.for_center(self.center),
            pk=self.kwargs["encounter_pk"],
        )


class EncounterPrescriptionCreateView(_EncounterNestedCreateView):
    """POST /centers/{center_pk}/encounters/{encounter_pk}/prescriptions/"""

    permission_classes = [IsStaffOfCenter(*PRESCRIBER_ROLES)]
    serializer_class = PrescriptionCreateSerializer

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


class EncounterRecordEntryCreateView(_EncounterNestedCreateView):
    """POST /centers/{center_pk}/encounters/{encounter_pk}/record-entries/"""

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = HealthRecordEntryCreateSerializer

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
