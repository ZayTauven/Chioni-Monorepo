"""Center views — audience: STAFF (tenant-scoped, ADR 0002).

Every queryset here goes through the user's memberships: a center where the
caller has no active membership answers 404, whatever their other hats.
"""

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.centers.models import HealthCenter, StaffMembership, TariffItem
from apps.centers.serializers import (
    HealthCenterSerializer,
    StaffCreateSerializer,
    StaffMembershipSerializer,
    TariffItemSerializer,
)
from apps.centers.services import (
    add_staff_member,
    deactivate_staff_member,
    update_center,
    update_tariff,
    create_tariff,
)
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsStaffOfCenter,
    StaffOfObjectCenter,
    user_centers_qs,
)

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
            StaffMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
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
        return Response(StaffMembershipSerializer(membership).data)


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
