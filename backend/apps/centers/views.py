"""Center views — audience: STAFF (tenant-scoped, ADR 0002).

Every queryset here goes through the user's memberships: a center where the
caller has no active membership answers 404, whatever their other hats.
"""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.centers.models import HealthCenter, StaffMembership, TariffItem
from apps.centers.serializers import (
    HealthCenterSerializer,
    LogoUploadSerializer,
    StaffCreateSerializer,
    StaffMembershipSerializer,
    StaffUpdateSerializer,
    TariffItemSerializer,
)
from apps.centers.services import (
    add_staff_member,
    deactivate_staff_member,
    remove_center_logo,
    set_center_logo,
    update_center,
    update_staff_member,
    update_tariff,
    create_tariff,
)
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsStaffOfCenter,
    StaffOfObjectCenter,
    user_centers_qs,
)
from apps.common.uploads import media_url

DIRECTOR = StaffMembership.Role.DIRECTOR
CASHIER = StaffMembership.Role.CASHIER


class CenterListView(generics.ListAPIView):
    """GET /centers/ — the centers where I am active staff (any role)."""

    serializer_class = HealthCenterSerializer

    def get_queryset(self):
        return user_centers_qs(self.request.user)


class CenterDetailView(generics.RetrieveUpdateAPIView):
    """GET /centers/{id}/ (staff) — PATCH/PUT (director only).

    Cross-tenant IDOR: the queryset is membership-scoped, so a foreign
    center is a plain 404 even for a valid director elsewhere.
    """

    serializer_class = HealthCenterSerializer
    http_method_names = ["get", "patch", "put", "head", "options"]

    def get_queryset(self):
        return user_centers_qs(self.request.user)

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [StaffOfObjectCenter(DIRECTOR)()]
        return super().get_permissions()

    def perform_update(self, serializer):
        update_center(
            actor=self.request.user,
            center=serializer.instance,
            **serializer.validated_data,
        )


class CenterLogoView(APIView):
    """`POST|DELETE /centers/{pk}/logo/` — director only.

    Same resolution semantics as `/centers/{pk}/`: the center is looked up
    in the caller's membership perimeter (foreign center → deterministic
    404), then ``StaffOfObjectCenter(directeur)`` answers 403 for any other
    role. Upload is multipart, sanitised by the hardened pipeline; replace
    and delete leave no orphan file on disk.
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [StaffOfObjectCenter(DIRECTOR)]

    def _get_center(self, request, pk):
        center = user_centers_qs(request.user).filter(pk=pk).first()
        if center is None:
            raise NotFound("Centre introuvable.")
        self.check_object_permissions(request, center)
        return center

    @extend_schema(request=LogoUploadSerializer, responses={200: None})
    def post(self, request, pk):
        center = self._get_center(request, pk)
        serializer = LogoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_center_logo(
            actor=request.user, center=center,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response({"logo": media_url(request, center.logo)})

    @extend_schema(responses={200: None})
    def delete(self, request, pk):
        center = self._get_center(request, pk)
        remove_center_logo(actor=request.user, center=center)
        return Response({"logo": None})


class StaffListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/staff/ — director only."""

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StaffCreateSerializer
        return StaffMembershipSerializer

    def get_queryset(self):
        return (
            StaffMembership.objects.for_center(self.center)
            .select_related("user")
            .order_by("role", "id")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = add_staff_member(
            actor=request.user, center=self.center, **serializer.validated_data
        )
        return Response(
            StaffMembershipSerializer(
                membership, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )


class StaffDetailView(CenterScopedViewMixin, generics.RetrieveUpdateAPIView):
    """GET|PATCH /centers/{center_pk}/staff/{pk}/ — director only.

    PATCH: role change on an ACTIVE membership, and first/last name of the
    person ONLY while their account is a never-claimed shadow (an activated
    account manages its own identity — same rule as patient profiles,
    R-API-2). Business guards (last director, duplicate role) live in
    ``services.update_staff_member``.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return StaffMembership.objects.for_center(self.center).select_related("user")

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return StaffUpdateSerializer
        return StaffMembershipSerializer

    def patch(self, request, *args, **kwargs):
        membership = self.get_object()
        serializer = StaffUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_staff_member(
            actor=request.user, membership=membership, **serializer.validated_data
        )
        return Response(
            StaffMembershipSerializer(
                membership, context=self.get_serializer_context()
            ).data
        )


class StaffDeactivateView(CenterScopedViewMixin, APIView):
    """POST /centers/{center_pk}/staff/{pk}/deactivate/ — director only.

    Deactivation, never deletion: role history is part of the audit story.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    def post(self, request, center_pk, pk):
        membership = get_object_or_404(
            StaffMembership.objects.for_center(self.center), pk=pk
        )
        deactivate_staff_member(actor=request.user, membership=membership)
        return Response(
            StaffMembershipSerializer(
                membership, context={"request": request}
            ).data
        )


class TariffListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET /centers/{center_pk}/tariffs/ (any staff) — POST (director/cashier)."""

    serializer_class = TariffItemSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR, CASHIER)()]
        return [IsStaffOfCenter()()]

    def get_queryset(self):
        return TariffItem.objects.for_center(self.center).order_by("code")

    def perform_create(self, serializer):
        serializer.instance = create_tariff(
            actor=self.request.user, center=self.center, **serializer.validated_data
        )


class TariffDetailView(CenterScopedViewMixin, generics.RetrieveUpdateAPIView):
    """GET (any staff) — PATCH/PUT (director/cashier) on one tariff line.

    No DELETE: tariff rows are referenced by historical snapshots (PROTECT);
    retiring a price is ``is_active=false``, never a deletion.
    """

    serializer_class = TariffItemSerializer
    http_method_names = ["get", "patch", "put", "head", "options"]

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [IsStaffOfCenter(DIRECTOR, CASHIER)()]
        return [IsStaffOfCenter()()]

    def get_queryset(self):
        return TariffItem.objects.for_center(self.center)

    def perform_update(self, serializer):
        update_tariff(
            actor=self.request.user,
            tariff=serializer.instance,
            **serializer.validated_data,
        )
