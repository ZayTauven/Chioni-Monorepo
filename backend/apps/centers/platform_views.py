"""Chioni BACK-OFFICE views — audience: `PlatformStaff` (S4, ADR 0017).

Everything here is mounted under `/api/v1/platform/` and MUST declare
``IsPlatformStaff`` — a structural test walks the URL tree and fails
otherwise (``tests/test_permissions_platform.py``, patron of the
``/guardian/`` rail).

Two invariants govern this module:

1. **The operator never sees a patient.** No patient serializer, no
   patient queryset, nothing clinical — the perimeter is the TENANT.
   Locked by a negative field test.
2. **Roles**: ``support`` reads, ``admin`` alone writes (create a center,
   seed a director, move a KYC status). The split lives in
   ``permission_classes``, never in the frontend.

Refusal semantics (norme S1): a center referenced by the URL that does
not exist → 404. Unlike the tenant rails there is no « foreign center »
case here: the platform's perimeter IS every center, by design — which is
exactly why the hat is a dedicated, auditable row.
"""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PlatformStaff
from apps.centers.models import HealthCenter, KycDocument, StaffMembership
from apps.centers.platform_serializers import (
    PlatformCenterCreateSerializer,
    PlatformCenterSerializer,
    PlatformDirectorCreateSerializer,
    PlatformKycTransitionSerializer,
    PlatformStaffMembershipSerializer,
)
from apps.centers.serializers import KycDocumentSerializer
from apps.centers.services import (
    add_center_director,
    create_center_with_director,
    set_center_kyc_status,
)
from apps.centers.views import kyc_document_file_response
from apps.common.permissions import IsPlatformStaff

PLATFORM_ADMIN = PlatformStaff.Role.ADMIN
DIRECTOR = StaffMembership.Role.DIRECTOR


def platform_centers_qs():
    """Every center, annotated with the counters an operator needs.

    Counters, never a staff list: knowing « ce centre n'a plus de
    directeur » is tenant supervision; browsing its people is the S5
    support module. Aggregates are pure SQL (no per-row query).
    """
    return HealthCenter.objects.annotate(
        staff_active_count=Count(
            "staff_memberships",
            filter=Q(staff_memberships__is_active=True),
            distinct=True,
        ),
        director_active_count=Count(
            "staff_memberships",
            filter=Q(
                staff_memberships__is_active=True,
                staff_memberships__role=DIRECTOR,
            ),
            distinct=True,
        ),
        kyc_document_count=Count(
            "kyc_documents",
            filter=Q(kyc_documents__archived_at__isnull=True),
            distinct=True,
        ),
    )


class PlatformCenterListCreateView(generics.ListCreateAPIView):
    """GET /platform/centers/ (support+admin) — POST (admin only).

    GET filters: ``?kyc_status=`` (invalid value → 400 per field, never a
    500) and ``?q=`` on name/city.

    POST onboards a tenant: center + first director in ONE transaction
    (ADR 0017, décision 2). Self-service registration of a center stays
    out of scope (it needs a plan, billing and anti-abuse — S5): in S4 a
    center enters through the operator, which is how it really happens
    (démarchage, contrat signé).
    """

    # The SPACE door is declared as a class attribute on purpose: the
    # structural guard-rail reads ``permission_classes``, and a view that
    # only overrode ``get_permissions()`` would silently inherit DRF's
    # ``IsAuthenticated`` default in the eyes of that test.
    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformCenterSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PlatformCenterCreateSerializer
        return PlatformCenterSerializer

    def get_queryset(self):
        qs = platform_centers_qs().order_by("name", "id")
        params = self.request.query_params
        kyc_status = (params.get("kyc_status") or "").strip()
        if kyc_status:
            if kyc_status not in HealthCenter.KycStatus.values:
                raise DrfValidationError(
                    {"kyc_status": ["Statut KYC inconnu."]}
                )
            qs = qs.filter(kyc_status=kyc_status)
        query = (params.get("q") or "").strip()
        if query:
            qs = qs.filter(
                Q(name__icontains=query) | Q(city__icontains=query)
            )
        return qs

    @extend_schema(
        request=PlatformCenterCreateSerializer,
        responses={201: PlatformCenterSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = PlatformCenterCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        center, membership = create_center_with_director(
            actor=request.user,
            director_phone=data.pop("director_phone"),
            director_first_name=data.pop("director_first_name", ""),
            director_last_name=data.pop("director_last_name", ""),
            **data,
        )
        payload = PlatformCenterSerializer(
            platform_centers_qs().get(pk=center.pk)
        ).data
        payload["director"] = PlatformStaffMembershipSerializer(membership).data
        return Response(payload, status=status.HTTP_201_CREATED)


class PlatformCenterSimilarView(generics.ListAPIView):
    """GET /platform/centers/similar/?name=&city=&island= — NON blocking.

    Mirror of the porte-C duplicate detection (S3, ADR 0016 §2): no
    uniqueness constraint is added on ``name`` — two « Clinique
    El-Maarouf » may legitimately coexist on two islands — so the operator
    is INFORMED and decides. At least one usable criterion is required.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformCenterSerializer

    def get_queryset(self):
        params = self.request.query_params
        name = (params.get("name") or "").strip()
        city = (params.get("city") or "").strip()
        island = (params.get("island") or "").strip()

        if island and island not in HealthCenter.Island.values:
            raise DrfValidationError({"island": ["Île inconnue."]})
        if not name and not city:
            raise DrfValidationError(
                ["Au moins un critère est requis : nom, ou ville."]
            )

        criteria = Q(pk__in=[])
        if name:
            criteria |= Q(name__icontains=name)
        if city:
            criteria |= Q(city__icontains=city)
        qs = platform_centers_qs().filter(criteria)
        if island:
            qs = qs.filter(island=island)
        return qs.order_by("name", "id")


class PlatformCenterDetailView(generics.RetrieveAPIView):
    """GET /platform/centers/{pk}/ — support + admin (read only).

    Editing a tenant's profile stays the DIRECTOR's job (`PATCH
    /centers/{pk}/`): the platform decides the KYC, not the address.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformCenterSerializer

    def get_queryset(self):
        return platform_centers_qs()


class PlatformCenterDirectorCreateView(APIView):
    """POST /platform/centers/{pk}/directors/ — admin only (rescue path).

    Seeds a director on a center that has none left (accident, departure):
    the only recovery path outside the Django admin, and an audited one
    (``staff.membership_created``). The account is a shadow claimed by OTP
    — no password is ever handed over.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformDirectorCreateSerializer,
        responses={201: PlatformStaffMembershipSerializer},
    )
    def post(self, request, pk):
        center = get_object_or_404(HealthCenter.objects.all(), pk=pk)
        serializer = PlatformDirectorCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = add_center_director(
            actor=request.user, center=center, **serializer.validated_data
        )
        return Response(
            PlatformStaffMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class PlatformCenterKycView(APIView):
    """POST /platform/centers/{pk}/kyc/ — admin only.

    THE single door to a KYC transition (the Django admin field turned
    read-only in the same sprint). Explicit state machine, mandatory
    motive on a suspension, audit without the motive in the payload — all
    in ``services.set_center_kyc_status``.

    Effects of « suspendu » (arbitrage PO n° 1): the DIASPORA RAIL closes,
    and it alone. Consultations, carnet, documents, rendez-vous, patients,
    staff, tariffs, invoicing and the CASH DESK keep working — suspending
    a center must never stop it from treating the patient in front of it.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformKycTransitionSerializer,
        responses={200: PlatformCenterSerializer},
    )
    def post(self, request, pk):
        center = get_object_or_404(HealthCenter.objects.all(), pk=pk)
        serializer = PlatformKycTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_center_kyc_status(
            actor=request.user,
            center=center,
            status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(
            PlatformCenterSerializer(platform_centers_qs().get(pk=pk)).data
        )


class PlatformKycDocumentListView(generics.ListAPIView):
    """GET /platform/centers/{pk}/kyc-documents/ — support + admin.

    The pieces the operator reads BEFORE deciding. Archived rows are kept
    in the list (their state is visible): a decision must stay auditable
    against the pieces that supported it.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = KycDocumentSerializer

    def get_queryset(self):
        center = get_object_or_404(HealthCenter.objects.all(), pk=self.kwargs["pk"])
        return KycDocument.objects.for_center(center).order_by("-created_at")


class PlatformKycDocumentDownloadView(APIView):
    """GET /platform/centers/{pk}/kyc-documents/{document_pk}/download/.

    THE only platform read path of the bytes: the private storage has no
    URL (ADR 0016 §5), so a director's ID card can never be served
    statically nor leak through a serializer.
    """

    permission_classes = [IsPlatformStaff()]

    def get(self, request, pk, document_pk):
        center = get_object_or_404(HealthCenter.objects.all(), pk=pk)
        document = get_object_or_404(
            KycDocument.objects.for_center(center), pk=document_pk
        )
        return kyc_document_file_response(document)
