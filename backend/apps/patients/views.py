"""Patient & guardianship views — one section per AUDIENCE.

Every view declares exactly one hat (permission + queryset helper from
``apps.common.permissions``); a multi-hat user never gains crossed rights
because no queryset here is derived from "any right the user holds".
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import (
    CenterScopedViewMixin,
    IsGuardianWithScope,
    IsPatientSelf,
    IsStaffOfCenter,
    claimed_patient_profile,
    guardian_links_with_scope,
    guardian_profile,
)
from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.serializers import (
    GuardianInviteSerializer,
    GuardianLinkGuardianSerializer,
    GuardianLinkPatientSerializer,
    GuardianProfileSerializer,
    MergeRequestSerializer,
    PatientSelfSerializer,
    PatientStaffCreateSerializer,
    PatientStaffSerializer,
    ProtegeCreateSerializer,
)
from apps.patients.services import (
    accept_link,
    create_guardian_profile,
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


def center_patients_qs(center):
    """Patients visible to a center: created at its desk or already seen
    there (an encounter anchors the patient into the center's activity).
    Absorbed duplicates are hidden — the registry shows canonical rows."""
    return (
        PatientProfile.objects.filter(
            Q(created_by_center=center) | Q(encounters__center=center)
        )
        .filter(merged_into__isnull=True)
        .distinct()
    )


# ---------------------------------------------------------------------------
# Audience: STAFF of a center (porte C)
# ---------------------------------------------------------------------------


class CenterPatientListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/patients/ — desk registry (any staff).

    ``?q=`` searches name/phone. Creation optionally attaches a guardian by
    phone (link ``invitation_envoyee``, initiated_by=centre).
    """

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PatientStaffCreateSerializer
        return PatientStaffSerializer

    def get_queryset(self):
        qs = center_patients_qs(self.center).order_by("last_name", "first_name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            qs = qs.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(phone__icontains=query)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        guardian_phone = data.pop("guardian_phone", "")
        guardian_relationship = data.pop("guardian_relationship", None)
        profile, _link = create_patient_at_center(
            actor=request.user,
            center=self.center,
            guardian_phone=guardian_phone or None,
            guardian_relationship=guardian_relationship,
            **data,
        )
        return Response(
            PatientStaffSerializer(profile).data, status=status.HTTP_201_CREATED
        )


class CenterPatientDetailView(CenterScopedViewMixin, generics.RetrieveUpdateAPIView):
    """GET/PATCH /centers/{center_pk}/patients/{pk}/ — scoped: a patient
    never seen by this center answers 404 (cross-tenant IDOR)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PatientStaffSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return center_patients_qs(self.center)

    def perform_update(self, serializer):
        update_patient_profile(
            actor=self.request.user,
            profile=serializer.instance,
            **serializer.validated_data,
        )


class CenterPatientMergeView(CenterScopedViewMixin, APIView):
    """POST /centers/{center_pk}/patients/merge/ — absorb a duplicate.

    Both profiles must be inside THIS center's perimeter (404 otherwise):
    a center never merges patients it has not itself received.
    """

    permission_classes = [IsStaffOfCenter()]

    @extend_schema(request=MergeRequestSerializer, responses=PatientStaffSerializer)
    def post(self, request, center_pk):
        serializer = MergeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scoped = center_patients_qs(self.center)
        source = get_object_or_404(scoped, pk=serializer.validated_data["source_id"])
        target = get_object_or_404(scoped, pk=serializer.validated_data["target_id"])
        canonical = merge_profiles(
            source=source, target=target, actor=request.user, center=self.center
        )
        return Response(PatientStaffSerializer(canonical).data)


# ---------------------------------------------------------------------------
# Audience: the PATIENT themself (porte B)
# ---------------------------------------------------------------------------


class MyPatientProfileView(APIView):
    """GET/POST/PATCH /patients/me/ — my profile.

    POST creates it (porte B, claimed at birth); GET/PATCH require it.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [IsPatientSelf()]

    @extend_schema(responses=PatientSelfSerializer)
    def get(self, request):
        profile = claimed_patient_profile(request.user)
        return Response(PatientSelfSerializer(profile).data)

    @extend_schema(request=PatientSelfSerializer, responses=PatientSelfSerializer)
    def post(self, request):
        serializer = PatientSelfSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = create_own_profile(user=request.user, **serializer.validated_data)
        return Response(
            PatientSelfSerializer(profile).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=PatientSelfSerializer, responses=PatientSelfSerializer)
    def patch(self, request):
        profile = claimed_patient_profile(request.user)
        serializer = PatientSelfSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_patient_profile(
            actor=request.user, profile=profile, **serializer.validated_data
        )
        return Response(PatientSelfSerializer(profile).data)


class MyGuardianLinksView(generics.ListAPIView):
    """GET /patients/me/guardians/ — my guardianship links (full history)."""

    permission_classes = [IsPatientSelf]
    serializer_class = GuardianLinkPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            GuardianLink.objects.filter(patient=profile)
            .select_related("guardian__user")
            .order_by("-created_at")
        )


class InviteGuardianView(APIView):
    """POST /patients/me/guardians/invite/ — invite a guardian by phone."""

    permission_classes = [IsPatientSelf]

    @extend_schema(
        request=GuardianInviteSerializer, responses=GuardianLinkPatientSerializer
    )
    def post(self, request):
        serializer = GuardianInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = invite_guardian(
            actor=request.user,
            patient=claimed_patient_profile(request.user),
            phone=serializer.validated_data["phone"],
            relationship=serializer.validated_data["relationship"],
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        return Response(
            GuardianLinkPatientSerializer(link).data, status=status.HTTP_201_CREATED
        )


class _PatientOwnLinkMixin:
    """Resolve one of MY links or 404 — cross-patient IDOR is invisible."""

    permission_classes = [IsPatientSelf]

    def get_link(self, request, link_pk):
        profile = claimed_patient_profile(request.user)
        return get_object_or_404(
            GuardianLink.objects.filter(patient=profile), pk=link_pk
        )


class PatientRevokeLinkView(_PatientOwnLinkMixin, APIView):
    """POST /patients/me/guardians/{link_pk}/revoke/ — immediate, final."""

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        revoke_link(link=link, actor=request.user)
        return Response(GuardianLinkPatientSerializer(link).data)


class ClinicalConsentView(_PatientOwnLinkMixin, APIView):
    """POST/DELETE /patients/me/guardians/{link_pk}/consents/clinical/

    The PATIENT alone grants (POST) or revokes (DELETE) the
    ``detail_clinique`` scope on one of their active links.
    """

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        grant_clinical_consent(patient_user=request.user, link=link)
        return Response(
            GuardianLinkPatientSerializer(link).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def delete(self, request, link_pk):
        link = self.get_link(request, link_pk)
        revoke_clinical_consent(patient_user=request.user, link=link)
        return Response(GuardianLinkPatientSerializer(link).data)


# ---------------------------------------------------------------------------
# Audience: a GUARDIAN (porte A)
# ---------------------------------------------------------------------------


class MyGuardianProfileView(APIView):
    """GET/POST /guardian/profile/ — my guardian profile."""

    def get_permissions(self):
        return [IsAuthenticated()]

    @extend_schema(responses=GuardianProfileSerializer)
    def get(self, request):
        profile = guardian_profile(request.user)
        if profile is None:
            raise NotFound("Vous n'avez pas encore de profil tuteur.")
        return Response(GuardianProfileSerializer(profile).data)

    @extend_schema(request=GuardianProfileSerializer, responses=GuardianProfileSerializer)
    def post(self, request):
        serializer = GuardianProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = create_guardian_profile(
            user=request.user, **serializer.validated_data
        )
        return Response(
            GuardianProfileSerializer(profile).data, status=status.HTTP_201_CREATED
        )


class ProtegeListCreateView(generics.ListCreateAPIView):
    """GET/POST /guardian/proteges/ — my protégés (administrative view only).

    The list queryset goes through ``guardian_links_with_scope`` — the F3
    combination (scope × link perimeter) — with the minimal payments scope.
    """

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProtegeCreateSerializer
        return GuardianLinkGuardianSerializer

    def get_queryset(self):
        return (
            guardian_links_with_scope(self.request.user, Consent.Scope.PAYMENTS)
            .select_related("patient")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        relationship = data.pop("relationship")
        _profile, link = create_protege(
            guardian_user=request.user, relationship=relationship, **data
        )
        return Response(
            GuardianLinkGuardianSerializer(link).data, status=status.HTTP_201_CREATED
        )


class GuardianInvitationListView(generics.ListAPIView):
    """GET /guardian/invitations/ — links awaiting MY acceptance."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]
    serializer_class = GuardianLinkGuardianSerializer

    def get_queryset(self):
        return (
            GuardianLink.objects.filter(
                guardian=guardian_profile(self.request.user),
                status=GuardianLink.Status.INVITATION_SENT,
            )
            .select_related("patient")
            .order_by("-created_at")
        )


class AcceptInvitationView(APIView):
    """POST /guardian/invitations/{link_pk}/accept/ — open the minimal scope."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]

    @extend_schema(request=None, responses=GuardianLinkGuardianSerializer)
    def post(self, request, link_pk):
        link = get_object_or_404(
            GuardianLink.objects.filter(guardian=guardian_profile(request.user)),
            pk=link_pk,
        )
        accept_link(link=link, guardian_user=request.user)
        return Response(GuardianLinkGuardianSerializer(link).data)


class GuardianRevokeLinkView(APIView):
    """POST /guardian/links/{link_pk}/revoke/ — the guardian steps back."""

    permission_classes = [IsGuardianWithScope(Consent.Scope.PAYMENTS)]

    @extend_schema(request=None, responses=GuardianLinkGuardianSerializer)
    def post(self, request, link_pk):
        link = get_object_or_404(
            GuardianLink.objects.filter(guardian=guardian_profile(request.user)),
            pk=link_pk,
        )
        revoke_link(link=link, actor=request.user)
        return Response(GuardianLinkGuardianSerializer(link).data)
