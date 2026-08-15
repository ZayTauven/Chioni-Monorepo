"""Inpatient views — one section per AUDIENCE (ADR 0008 / ADR 0019 §5).

STAFF of the center:

- **read** (stays, occupancy board): ANY active staff member, with a
  ROLE-SEGMENTED payload — clinical roles get the reason and the
  diagnosis, administrative roles get the occupation without them
  (``is_clinical_member`` is the single test, patron ``medical/views.py``);
- **admit / discharge / cancel / move a bed**: CLINICAL roles. Admission
  opens a consultation, so it is a clinical act by construction;
- **bill the days**: BILLING roles — it produces the acts an invoice will
  carry, exactly like ``create_invoice``;
- **declare rooms and beds**: the DIRECTOR. The physical structure of the
  establishment is configuration, and it changes rarely (arbitrage
  RÉVERSIBLE — reopen it to the secretary the day the ward asks).

PATIENT: reads their own stays across centers (``for_patient`` — the
mirror of the carnet's reads), never writes.

GUARDIAN: **nothing**. No route of this module lives under `/guardian/`,
and a structural probe (``tests/test_adversarial_s3.py``, extended by S6)
refuses one — the clinical guardian window stays conditioned to SV.1.1.

Refusal semantics (norme S1): anonymous → 401 ; center where the caller
holds no membership → 404 (``CenterScopedViewMixin``) ; a stay, a room or
a bed of ANOTHER center reached through my URL → 404 (queryset scoping,
deterministic IDOR answer) ; a reference travelling in the BODY (patient,
bed, tariff, attending) outside the perimeter → **400 explicite**.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.centers.models import StaffMembership
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsPatientSelf,
    IsStaffOfCenter,
    active_membership_qs,
    claimed_patient_profile,
)
from apps.common.roles import BILLING_ROLES, CLINICAL_ROLES
from apps.inpatient.models import Bed, BedAssignment, Room, Stay
from apps.inpatient.serializers import (
    AdmissionSerializer,
    AttendingSerializer,
    BedAssignSerializer,
    BedAssignmentSerializer,
    BedCreateSerializer,
    BedSerializer,
    BillStayDaysSerializer,
    DischargeSerializer,
    OccupancySerializer,
    RoomCreateSerializer,
    RoomSerializer,
    StayAdminSerializer,
    StayCancelSerializer,
    StayClinicalSerializer,
    StayPatientSerializer,
)
from apps.inpatient.services import (
    admit_patient,
    assign_bed,
    bill_stay_days,
    cancel_stay,
    create_bed,
    create_room,
    discharge_stay,
    occupancy_rows,
    release_bed,
    resolve_tariff,
    set_attending,
    stays_queryset,
)
from apps.medical.views import is_clinical_member
from apps.patients.views import center_patients_qs

DIRECTOR = StaffMembership.Role.DIRECTOR


# ---------------------------------------------------------------------------
# Body-reference resolution — 400 explicite, never a 404 (norme S1)
# ---------------------------------------------------------------------------


def _resolve_patient(center, patient_pk):
    patient = center_patients_qs(center).filter(pk=patient_pk).first()
    if patient is None:
        raise DjangoValidationError("Ce patient n'est pas connu de ce centre.")
    return patient


def _resolve_bed(center, bed_pk):
    bed = Bed.objects.for_center(center).filter(pk=bed_pk).first()
    if bed is None:
        raise DjangoValidationError("Ce lit n'appartient pas à ce centre.")
    return bed


def _resolve_attending(center, ids):
    """Active CLINICAL memberships of THIS center — one message for the
    foreign and the non-existent id alike."""
    memberships = []
    for pk in ids:
        membership = (
            StaffMembership.objects.for_center(center)
            .filter(pk=pk, is_active=True, role__in=CLINICAL_ROLES)
            .first()
        )
        if membership is None:
            raise DjangoValidationError(
                "Ce praticien n'appartient pas à ce centre."
            )
        memberships.append(membership)
    return memberships


def _acting_practitioner(request, center):
    """The caller's OWN clinical membership — a view never attributes a
    medical act to someone else's hat (patron ``create_encounter``)."""
    return (
        active_membership_qs(request.user, center=center, roles=CLINICAL_ROLES)
        .order_by("id")
        .first()
    )


# ---------------------------------------------------------------------------
# Configuration: rooms and beds (DIRECTOR writes, every staff reads)
# ---------------------------------------------------------------------------


class CenterRoomListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/inpatient/rooms/.

    GET: any active staff (the ward board is everybody's tool).
    POST: the DIRECTOR — the physical structure of the establishment.
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RoomCreateSerializer
        return RoomSerializer

    def get_queryset(self):
        return Room.objects.for_center(self.center).order_by("name", "id")

    @extend_schema(request=RoomCreateSerializer, responses={201: RoomSerializer})
    def create(self, request, *args, **kwargs):
        serializer = RoomCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = create_room(
            actor=request.user, center=self.center,
            name=serializer.validated_data["name"],
        )
        return Response(
            RoomSerializer(room).data, status=http_status.HTTP_201_CREATED
        )


class CenterRoomBedListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/inpatient/rooms/{room_pk}/beds/.

    The room travels in the URL: a room of another center is a 404
    (queryset scoping), never a 400 that would confirm its existence.
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BedCreateSerializer
        return BedSerializer

    def get_room(self):
        return get_object_or_404(
            Room.objects.for_center(self.center), pk=self.kwargs["room_pk"]
        )

    def get_queryset(self):
        return (
            Bed.objects.filter(room=self.get_room())
            .select_related("room")
            .order_by("name", "id")
        )

    @extend_schema(request=BedCreateSerializer, responses={201: BedSerializer})
    def create(self, request, *args, **kwargs):
        room = self.get_room()
        serializer = BedCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bed = create_bed(
            actor=request.user, room=room,
            name=serializer.validated_data["name"],
        )
        return Response(
            BedSerializer(bed).data, status=http_status.HTTP_201_CREATED
        )


class CenterBedListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/inpatient/beds/?free=true — the flat list.

    ``?free=true`` keeps only the beds that can receive a patient right now
    (active bed, active room, no open assignment): that is the selector the
    admission form needs. Any other value → 400 per field (norme S1).
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = BedSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Bed.objects.for_center(self.center).select_related("room")
        raw_free = self.request.query_params.get("free")
        if raw_free is not None:
            if raw_free not in ("true", "false"):
                raise DrfValidationError(
                    {"free": ["Valeur attendue : true ou false."]}
                )
            if raw_free == "true":
                qs = qs.available()
        return qs.order_by("room__name", "name", "id")


class CenterOccupancyView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/inpatient/occupancy/ — the board of the day.

    « Combien de lits libres maintenant ? » serves to ADMIT: it lives in
    the module, never in ``stats_views`` (which is piloting, gelable by the
    subscription, and whose ``assertNumQueries`` are locked) — ADR 0019
    décision 6.

    Any active staff reads it; the occupant's payload is role-segmented
    (the admission motive only crosses into a clinical payload).
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = OccupancySerializer
    pagination_class = None

    def get_queryset(self):
        return occupancy_rows(self.center)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["clinical"] = is_clinical_member(self.request.user, self.center)
        return context


# ---------------------------------------------------------------------------
# Stays
# ---------------------------------------------------------------------------


class _StayScopeMixin(CenterScopedViewMixin):
    """Center resolution + the role-segmented payload of ONE caller."""

    @property
    def is_clinical(self):
        return is_clinical_member(self.request.user, self.center)

    def stay_serializer_class(self):
        return StayClinicalSerializer if self.is_clinical else StayAdminSerializer

    def scoped_stays(self):
        return stays_queryset(self.center)

    def get_stay(self):
        return get_object_or_404(self.scoped_stays(), pk=self.kwargs["pk"])

    def render(self, stay):
        """Re-read through the annotated queryset so a write answers the
        SAME payload the detail serves (bed position, billed days…)."""
        fresh = self.scoped_stays().get(pk=stay.pk)
        return self.stay_serializer_class()(fresh).data


class CenterStayListCreateView(_StayScopeMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/inpatient/stays/.

    GET (any active staff): ``?status=`` (default: the ONGOING stays — the
    ward board is what people open) and ``?patient=<id>``. An unknown
    status answers 400 per field; a foreign patient id simply matches
    nothing in the center-scoped queryset.

    POST (clinical roles) = the ADMISSION: it opens the pivot consultation
    and the stay in ONE transaction, and assigns the bed when one is given.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(*CLINICAL_ROLES)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdmissionSerializer
        return self.stay_serializer_class()

    def get_queryset(self):
        qs = self.scoped_stays()
        params = self.request.query_params
        raw_status = params.get("status")
        if raw_status:
            if raw_status not in Stay.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=raw_status)
        elif params.get("all") != "true":
            # The default view IS the ward board: who is here right now.
            qs = qs.filter(status=Stay.Status.IN_PROGRESS)
        raw_patient = params.get("patient")
        if raw_patient:
            if not raw_patient.isdigit():
                raise DrfValidationError(
                    {"patient": ["Identifiant de patient invalide."]}
                )
            qs = qs.filter(patient_id=int(raw_patient))
        return qs.order_by("-admitted_at", "-id")

    @extend_schema(
        request=AdmissionSerializer, responses={201: StayClinicalSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = AdmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        patient = _resolve_patient(self.center, data["patient"])
        bed = (
            _resolve_bed(self.center, data["bed"])
            if data.get("bed") is not None
            else None
        )
        attending = _resolve_attending(self.center, data.get("attending") or [])
        stay = admit_patient(
            actor=request.user,
            center=self.center,
            practitioner=_acting_practitioner(request, self.center),
            patient=patient,
            reason=data["reason"],
            diagnosis=data.get("diagnosis", ""),
            priority=data["priority"],
            bed=bed,
            attending=attending,
            admitted_at=data.get("admitted_at"),
        )
        # The caller holds a clinical role (permission above).
        fresh = self.scoped_stays().get(pk=stay.pk)
        return Response(
            StayClinicalSerializer(fresh).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterStayDetailView(_StayScopeMixin, generics.RetrieveAPIView):
    """GET /centers/{center_pk}/inpatient/stays/{pk}/ — role-segmented."""

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        return self.stay_serializer_class()

    def get_queryset(self):
        return self.scoped_stays()


class CenterStayBedAssignmentListView(_StayScopeMixin, generics.ListAPIView):
    """GET .../stays/{pk}/bed-assignments/ — the transfer trail.

    CLINICAL roles only: the chain « which bed, from when to when » is ward
    movement information, and the administrative board already answers the
    only question the desk needs (« where is the patient NOW »).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = BedAssignmentSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            BedAssignment.objects.filter(stay=self.get_stay())
            .select_related("bed__room")
            .order_by("-assigned_at", "-id")
        )


class CenterStayBedView(_StayScopeMixin, APIView):
    """POST|DELETE /centers/{center_pk}/inpatient/stays/{pk}/bed/.

    POST = assign or TRANSFER (the service releases the current occupation
    and opens a new one — history stacked, never rewritten). DELETE =
    release without a new bed, because « le patient attend dans le couloir »
    is a state the product must be able to say.
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = BedAssignSerializer

    @extend_schema(
        request=BedAssignSerializer, responses=StayClinicalSerializer
    )
    def post(self, request, center_pk, pk):
        stay = self.get_stay()
        serializer = BedAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bed = _resolve_bed(self.center, serializer.validated_data["bed"])
        assign_bed(actor=request.user, stay=stay, bed=bed)
        return Response(self.render(stay))

    @extend_schema(request=None, responses=StayClinicalSerializer)
    def delete(self, request, center_pk, pk):
        stay = self.get_stay()
        release_bed(actor=request.user, stay=stay)
        return Response(self.render(stay))


class CenterStayAttendingView(_StayScopeMixin, APIView):
    """PUT /centers/{center_pk}/inpatient/stays/{pk}/attending/.

    The FULL new set of attending physicians (a PUT, not a PATCH: « qui
    suit ce patient » is a list one replaces, not a field one nudges).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = AttendingSerializer

    @extend_schema(request=AttendingSerializer, responses=StayClinicalSerializer)
    def put(self, request, center_pk, pk):
        stay = self.get_stay()
        serializer = AttendingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attending = _resolve_attending(
            self.center, serializer.validated_data["attending"]
        )
        set_attending(actor=request.user, stay=stay, attending=attending)
        return Response(self.render(stay))


class CenterStayDischargeView(_StayScopeMixin, APIView):
    """POST .../stays/{pk}/discharge/ — ``en_cours → sortie``.

    Releases the bed AND closes the pivot consultation in the same
    transaction. Billing the days stays possible afterwards (it usually
    happens exactly then).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = DischargeSerializer

    @extend_schema(request=DischargeSerializer, responses=StayClinicalSerializer)
    def post(self, request, center_pk, pk):
        stay = self.get_stay()
        serializer = DischargeSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        discharge_stay(
            actor=request.user, stay=stay,
            discharged_at=serializer.validated_data.get("discharged_at"),
        )
        return Response(self.render(stay))


class CenterStayCancelView(_StayScopeMixin, APIView):
    """POST .../stays/{pk}/cancel/ — ``en_cours → annule``, motif OBLIGATOIRE.

    For an admission entered by MISTAKE only: the service refuses as soon
    as a single act sits on the pivot (« aucune journée facturée »).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]
    serializer_class = StayCancelSerializer

    @extend_schema(
        request=StayCancelSerializer, responses=StayClinicalSerializer
    )
    def post(self, request, center_pk, pk):
        stay = self.get_stay()
        serializer = StayCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cancel_stay(
            actor=request.user, stay=stay,
            reason=serializer.validated_data["reason"],
        )
        return Response(self.render(stay))


class CenterStayBillDaysView(_StayScopeMixin, APIView):
    """POST .../stays/{pk}/bill-days/ — N journées = N actes (ADR 0019 §4).

    BILLING roles: this produces the acts an invoice will carry, exactly
    like ``create_invoice`` does. ``POST /centers/{c}/invoices/`` then takes
    over on the pivot consultation without learning anything new.

    **Idempotent** (correctif PO du 15/08/2026): ``idempotency_key`` is
    mandatory, and replaying the same key answers **200 with the same stay
    payload** — nothing written, nothing audited twice. The status code is
    deliberately 200 in BOTH cases, unlike the counter's 201/200: the body
    of this route is the STAY (a resource that already existed), never the
    billing gesture, so announcing a « created » resource that is not in
    the answer would be a lie the client cannot act on. ``billed_days``
    is the field that says what happened.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]
    serializer_class = BillStayDaysSerializer

    @extend_schema(request=BillStayDaysSerializer, responses=StayAdminSerializer)
    def post(self, request, center_pk, pk):
        stay = self.get_stay()
        serializer = BillStayDaysSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tariff = resolve_tariff(self.center, serializer.validated_data["tariff"])
        bill_stay_days(
            actor=request.user, stay=stay, tariff=tariff,
            days=serializer.validated_data["days"],
            idempotency_key=serializer.validated_data["idempotency_key"],
        )
        return Response(self.render(stay))


# ---------------------------------------------------------------------------
# Audience: the PATIENT owner of the record (transversal, all centers)
# ---------------------------------------------------------------------------


class MyStaysView(generics.ListAPIView):
    """GET /patients/me/stays/ — my hospitalisations, across ALL centers.

    The record belongs to the patient (ADR 0002): transversal read, like
    the carnet. Payload deliberately small — center, dates, status and the
    pivot consultation id; **no bed, no priority, no cancellation motive**
    (ADR 0019 §5): those are ward-management data written by the staff for
    the staff. The clinical story is read in full at
    `GET /patients/me/encounters/`.
    """

    permission_classes = [IsPatientSelf]
    serializer_class = StayPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            Stay.objects.for_patient(profile)
            .select_related("center")
            .order_by("-admitted_at", "-id")
        )
