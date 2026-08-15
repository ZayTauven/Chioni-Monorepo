"""RGPD erasure back-office (S4 lot 3, ADR 0017 décision 7).

Third module mounted under `/api/v1/platform/`, exactly as the lot 1
addendum planned. Every route here MUST declare ``IsPlatformStaff`` — the
structural guard-rail (``tests/test_permissions_platform.py``) walks the
whole tree and fails otherwise.

Role split, same as everywhere in the back-office: ``support`` READS the
queue (it is support's job to answer « où en est ma demande ? »),
``admin`` ALONE executes — anonymising an account is irreversible, and
refusing one is a legal act.

Sprint invariant, held here too: **no patient PII, no clinical data**.
The operator sees an account ID, hats as booleans and what blocks the
erasure. Identity is not needed to erase: the request was deposited by
the authenticated person from their own space.
"""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import ErasureRequest, PlatformStaff
from apps.accounts.platform_serializers import (
    PlatformErasureDecisionSerializer,
    PlatformErasureRequestSerializer,
    PlatformStaffCreateSerializer,
    PlatformStaffSerializer,
    PlatformStaffUpdateSerializer,
)
from apps.accounts.services import (
    create_platform_staff,
    process_erasure_request,
    update_platform_staff,
)
from apps.common.permissions import IsPlatformStaff

PLATFORM_ADMIN = PlatformStaff.Role.ADMIN


class PlatformErasureRequestListView(generics.ListAPIView):
    """GET /platform/erasure-requests/?status= — support + admin.

    The queue, most recent first. Pending requests are what the operator
    works on, but the processed and refused ones stay listable: an
    erasure file must remain auditable after the fact (« pourquoi ce
    refus, en mars ? » is a question a DPO will ask).

    ``?status=`` filters on the lifecycle; an unknown value answers 400
    per field, never a silent « no filter » (S1 filter norm).
    """

    # Class attribute on purpose: the structural guard-rail reads
    # ``permission_classes`` and refuses a view that would only override
    # ``get_permissions()`` (it would inherit DRF's IsAuthenticated
    # default — every patient in the country).
    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformErasureRequestSerializer

    def get_queryset(self):
        qs = ErasureRequest.objects.select_related("user").order_by(
            "-requested_at", "-id"
        )
        status_filter = (self.request.query_params.get("status") or "").strip()
        if status_filter:
            if status_filter not in ErasureRequest.Status.values:
                raise DrfValidationError(
                    {"status": ["Statut de demande inconnu."]}
                )
            qs = qs.filter(status=status_filter)
        return qs


class PlatformErasureRequestProcessView(APIView):
    """POST /platform/erasure-requests/{pk}/process/ — **admin only**.

    Two decisions, both explicit (see ``services.process_erasure_request``):

    - ``anonymiser`` → the account is tombstoned (ADR 0007). Irreversible
      by construction: there is nothing left to restore. A BLOCKED
      erasure (last director of a center, payment in flight, last platform
      admin) answers 400 with the French sentences telling the operator
      what to fix — and the request STAYS pending, so the person does not
      have to ask twice ;
    - ``refuser`` → motive mandatory, rendered to the person concerned.

    A request that is no longer pending answers 400; an unknown id
    answers 404 (URL ref — S1 norm).
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]

    @extend_schema(
        request=PlatformErasureDecisionSerializer,
        responses={200: PlatformErasureRequestSerializer},
    )
    def post(self, request, pk):
        erasure_request = get_object_or_404(ErasureRequest.objects.all(), pk=pk)
        serializer = PlatformErasureDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        erasure_request = process_erasure_request(
            actor=request.user,
            erasure_request=erasure_request,
            decision=serializer.validated_data["decision"],
            refusal_reason=serializer.validated_data.get("refusal_reason", ""),
        )
        return Response(PlatformErasureRequestSerializer(erasure_request).data)


# ---------------------------------------------------------------------------
# L'équipe Chioni elle-même (S5 lot 3 — ADR 0018 décision 6)
# ---------------------------------------------------------------------------
#
# La dette explicitement renvoyée par l'ADR 0017 : `PlatformStaffAdmin`
# restait écrivable faute de porte produit. Ces deux vues sont cette porte
# — **`admin` seul, en lecture comme en écriture**. La liste des personnes
# qui détiennent la 4ᵉ casquette est de la gouvernance, pas de la matière
# de support : un `support` n'a pas à savoir qui peut le désactiver.
#
# L'amorçage du TOUT PREMIER exploitant reste hors ligne
# (`python manage.py create_platform_staff`) : à l'installation, il n'y a
# personne pour appeler cette route.


class PlatformOperatorListCreateView(generics.ListCreateAPIView):
    """GET/POST /platform/operators/ — **admin only**, both verbs.

    GET: the Chioni team, ``?role=`` and ``?is_active=`` filtered (unknown
    value → 400 per field, S1 norm). POST: create an operator from a
    PHONE — shadow account, OTP claim, no password ever transmitted.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]
    serializer_class = PlatformStaffSerializer

    def get_queryset(self):
        qs = PlatformStaff.objects.all().order_by("id")
        params = self.request.query_params
        role = (params.get("role") or "").strip()
        if role:
            if role not in PlatformStaff.Role.values:
                raise DrfValidationError({"role": ["Rôle d'exploitant inconnu."]})
            qs = qs.filter(role=role)
        is_active = (params.get("is_active") or "").strip().lower()
        if is_active:
            if is_active not in {"true", "false"}:
                raise DrfValidationError(
                    {"is_active": ["Valeur attendue : true ou false."]}
                )
            qs = qs.filter(is_active=is_active == "true")
        return qs

    @extend_schema(
        request=PlatformStaffCreateSerializer,
        responses={201: PlatformStaffSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = PlatformStaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = create_platform_staff(
            actor=request.user, **serializer.validated_data
        )
        return Response(
            PlatformStaffSerializer(operator).data,
            status=status.HTTP_201_CREATED,
        )


class PlatformOperatorDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /platform/operators/{pk}/ — **admin only**.

    PATCH is the ONLY write: change a role, activate or deactivate. There
    is no DELETE — an operator row is history (it is what makes an old
    audit entry readable), and revoking an access is ``is_active: false``.
    The « last active admin » guard refuses the move that would leave
    Chioni without a single administrator.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]
    serializer_class = PlatformStaffSerializer
    http_method_names = ["get", "patch", "head", "options"]
    queryset = PlatformStaff.objects.all()

    @extend_schema(
        request=PlatformStaffUpdateSerializer,
        responses={200: PlatformStaffSerializer},
    )
    def patch(self, request, *args, **kwargs):
        operator = self.get_object()
        # ``partial=True`` is load-bearing, not decoration: DRF's
        # ``BooleanField`` reads a MISSING key of an HTML/multipart body as
        # ``False`` (unchecked checkboxes are simply not submitted) unless
        # the serializer is partial. Without it, a client patching only
        # ``role`` would silently DEACTIVATE the operator.
        serializer = PlatformStaffUpdateSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        operator = update_platform_staff(
            actor=request.user, operator=operator, **serializer.validated_data
        )
        return Response(PlatformStaffSerializer(operator).data)
