"""Medical views — audiences: STAFF of the producing center, PATIENT owner.

NO guardian endpoint here (phase A rule): the ``detail_clinique`` scope
will be wired whole in a later phase, never half-exposed.
"""

from datetime import datetime, time, timedelta
from pathlib import PurePosixPath

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.centers.models import StaffMembership, TariffItem
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsPatientSelf,
    IsStaffOfCenter,
    active_membership_qs,
    claimed_patient_profile,
)
from apps.common.roles import CLINICAL_ROLES, PRESCRIPTION_ROLES
from apps.medical.models import (
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    VitalSigns,
)
from apps.medical.serializers import (
    EncounterAdminSerializer,
    EncounterClinicalSerializer,
    EncounterCreateSerializer,
    EncounterPatientSerializer,
    HealthRecordEntryCreateSerializer,
    HealthRecordEntrySerializer,
    PatientDocumentCreateSerializer,
    PatientDocumentPatientSerializer,
    PatientDocumentStaffSerializer,
    PatientMedicalFileSerializer,
    PatientMedicalFileWriteSerializer,
    PrescriptionCreateSerializer,
    PrescriptionSerializer,
    VitalSignsCreateSerializer,
    VitalSignsPatientSerializer,
    VitalSignsStaffSerializer,
)
from apps.medical.services import (
    archive_patient_document,
    close_encounter,
    create_encounter,
    create_patient_document,
    create_prescription,
    create_record_entry,
    deliver_prescription,
    record_vital_signs,
    update_patient_medical_file,
)
from apps.patients.views import center_patients_qs
from apps.scheduling.models import Appointment

# ``CLINICAL_ROLES`` lives in apps.common.roles since S1 (single source —
# it also feeds the practitioner directory); ``PRESCRIPTION_ROLES`` joined
# it in S9 when the pharmacy network became a second consumer. Only
# ``PRESCRIBER_ROLES`` still has this module as its only consumer.

#: Roles allowed to prescribe.
PRESCRIBER_ROLES = (
    StaffMembership.Role.DOCTOR,
    StaffMembership.Role.MIDWIFE,
)
#: Roles allowed to READ prescriptions: clinical + the pharmacist who
#: delivers them (R-API-1). Le groupe a MIGRÉ vers ``apps.common.roles`` en
#: S9 (second consommateur : le réseau des pharmacies, ADR 0022) ; l'alias
#: reste pour ne pas réécrire les appelants historiques ni les tests qui
#: l'importent d'ici.
PRESCRIPTION_READ_ROLES = PRESCRIPTION_ROLES


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


def _local_day_bounds(raw_date, field="date"):
    """Local Comoros day bounds for a ``?date=`` filter — the exact ADR
    0013 refusal semantics: malformed AND well-formed-impossible dates
    both answer the same 400 per field, never a 500."""
    try:
        day = parse_date(raw_date)
    except ValueError:
        day = None
    if day is None:
        raise DrfValidationError({field: ["Format attendu : AAAA-MM-JJ."]})
    day_start = timezone.make_aware(datetime.combine(day, time.min))
    try:
        day_end = day_start + timedelta(days=1)
    except OverflowError:
        raise DrfValidationError({field: ["Date hors limites."]})
    return day_start, day_end


def _validated_id_param(params, field, label):
    """``?field=<id>`` or a 400 per field; a foreign id simply matches
    nothing in the center-scoped queryset (no cross-tenant probe)."""
    raw = params.get(field)
    if raw in (None, ""):
        return None
    if not raw.isdigit():
        raise DrfValidationError({field: [f"Identifiant de {label} invalide."]})
    return int(raw)


class CenterEncounterListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET /centers/{center_pk}/encounters/?patient=&date=&practitioner=
    (any staff) — POST (clinical roles).

    R-API-1: the GET payload depends on the caller's ROLE — clinical staff
    get the clinical serializer (reason, diagnosis), administrative staff
    the operating one (date, patient, practitioner, acts). The queryset
    stays center-scoped in both cases; filter values are validated (400
    per field on garbage) and a FOREIGN id matches nothing (S1 filters).

    The practitioner is ALWAYS the caller's own clinical membership in this
    center: a view can never attribute an act to someone else's hat.

    S1 refusal semantics (ADR 0008 addendum): ``patient``, ``tariff_items``
    and ``appointment`` travel in the POST BODY → an id outside the
    center's perimeter answers an explicit 400 (pattern scheduling — one
    message covering foreign and non-existent ids alike), never a 404.
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
        qs = (
            Encounter.objects.for_center(self.center)
            .select_related("practitioner__user")
            .prefetch_related("acts")
            .order_by("-occurred_at")
        )
        params = self.request.query_params
        patient_id = _validated_id_param(params, "patient", "patient")
        if patient_id is not None:
            qs = qs.filter(patient_id=patient_id)
        practitioner_id = _validated_id_param(params, "practitioner", "praticien")
        if practitioner_id is not None:
            qs = qs.filter(practitioner_id=practitioner_id)
        raw_date = params.get("date")
        if raw_date:
            day_start, day_end = _local_day_bounds(raw_date)
            qs = qs.filter(occurred_at__gte=day_start, occurred_at__lt=day_end)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Perimeter checks (body refs → 400 explicite, S1): patient seen by
        # this center, tariffs of its grid, appointment of this center.
        patient = center_patients_qs(self.center).filter(pk=data["patient"]).first()
        if patient is None:
            raise DjangoValidationError("Ce patient n'est pas connu de ce centre.")
        grid = TariffItem.objects.for_center(self.center)
        tariffs = []
        for pk in data["tariff_items"]:
            tariff = grid.filter(pk=pk).first()
            if tariff is None:
                raise DjangoValidationError(
                    "Un acte ne peut référencer qu'un tarif de la grille de "
                    "ce centre."
                )
            tariffs.append(tariff)
        appointment = None
        if data.get("appointment") is not None:
            # Center-perimeter resolution (400 explicite); the service then
            # checks the appointment concerns the SAME patient and honors it.
            appointment = (
                Appointment.objects.for_center(self.center)
                .filter(pk=data["appointment"])
                .first()
            )
            if appointment is None:
                raise DjangoValidationError(
                    "Ce rendez-vous n'appartient pas à ce centre."
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


class CenterEncounterCloseView(CenterScopedViewMixin, APIView):
    """POST /centers/{center_pk}/encounters/{pk}/close/ — S1: en_cours →
    terminee (clinical roles; the reference is in the URL → foreign
    encounter = 404).

    Effects (documented, ADR 0008 addendum S1): a closed encounter refuses
    new prescriptions and record entries (400 explicite in the services);
    billing it stays possible (the invoice routinely comes after the
    care). ``annulee`` is out of S1 scope (invoice cascade to design).
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]

    @extend_schema(request=None, responses=EncounterClinicalSerializer)
    def post(self, request, *args, **kwargs):
        encounter = get_object_or_404(
            Encounter.objects.for_center(self.center), pk=self.kwargs["pk"]
        )
        encounter = close_encounter(actor=request.user, encounter=encounter)
        # The caller holds a clinical role (permission above): the clinical
        # payload is theirs to read (R-API-1).
        return Response(EncounterClinicalSerializer(encounter).data)


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


class CenterPrescriptionListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/prescriptions/?patient=&status=&date=

    **Le poste de travail du pharmacien** (dette C.1 de l'audit, ouverte
    depuis le premier jour et soldée par S9). Jusqu'ici il pouvait lire une
    ordonnance consultation par consultation, à condition d'en connaître
    l'identifiant : aucune liste, aucun filtre — un métier sans écran.

    Même audience que la lecture d'une ordonnance (R-API-1 :
    ``PRESCRIPTION_ROLES`` = cliniques + pharmacien). Le périmètre est le
    CENTRE producteur : le carnet transversal reste l'espace du patient.
    """

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_READ_ROLES)]
    serializer_class = PrescriptionSerializer

    def get_queryset(self):
        qs = (
            Prescription.objects.filter(encounter__center=self.center)
            .prefetch_related("items")
            .order_by("-created_at", "-id")
        )
        params = self.request.query_params
        patient_id = _validated_id_param(params, "patient", "patient")
        if patient_id is not None:
            qs = qs.filter(encounter__patient_id=patient_id)
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in Prescription.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=status_filter)
        raw_date = (params.get("date") or "").strip()
        if raw_date:
            day_start, day_end = _local_day_bounds(raw_date)
            qs = qs.filter(created_at__gte=day_start, created_at__lt=day_end)
        return qs


class CenterPrescriptionDeliverView(CenterScopedViewMixin, APIView):
    """POST /centers/{center_pk}/prescriptions/{pk}/deliver/ — le comptoir.

    C'est ici que ``Status.DELIVERED`` est enfin posé. Ouvert aux mêmes
    rôles que la lecture : dans un centre sans officine interne — la
    majorité aux Comores —, c'est l'infirmière qui remet les médicaments.

    La délivrance est DÉFINITIVE (aucune route ne la défait, et le modèle
    refuse le retour arrière sur tout chemin d'écriture) : une erreur se
    raconte dans le carnet, elle ne s'efface pas.
    """

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_READ_ROLES)]

    @extend_schema(request=None, responses=PrescriptionSerializer)
    def post(self, request, center_pk, pk):
        prescription = get_object_or_404(
            Prescription.objects.filter(encounter__center=self.center), pk=pk
        )
        try:
            prescription = deliver_prescription(
                actor=request.user, prescription=prescription
            )
        except DjangoValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(PrescriptionSerializer(prescription).data)


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


class EncounterVitalSignsView(_EncounterNestedView):
    """GET/POST /centers/{center_pk}/encounters/{encounter_pk}/vital-signs/

    S3 (ADR 0016 §4) — vital signs are clinical content: read AND write
    reserved to clinical roles (pharmacist and administrative staff → 403,
    like the carnet). ``measured_by`` is ALWAYS the caller's own clinical
    membership in this center (same rule as the encounter's practitioner —
    a view can never attribute a measure to someone else's hat). A closed
    encounter refuses new rows (400 explicite, service). Bare array like
    the other clinical sub-routes.
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return VitalSignsCreateSerializer
        return VitalSignsStaffSerializer

    def get(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        rows = (
            VitalSigns.objects.filter(encounter=encounter)
            .select_related("measured_by__user")
            .order_by("-measured_at", "-id")
        )
        return Response(VitalSignsStaffSerializer(rows, many=True).data)

    def post(self, request, *args, **kwargs):
        encounter = self.get_encounter()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        measured_by = (
            active_membership_qs(
                request.user, center=self.center, roles=CLINICAL_ROLES
            )
            .order_by("id")
            .first()
        )
        vital_signs = record_vital_signs(
            actor=request.user,
            encounter=encounter,
            measured_by=measured_by,
            **serializer.validated_data,
        )
        return Response(
            VitalSignsStaffSerializer(vital_signs).data,
            status=status.HTTP_201_CREATED,
        )


class CenterPatientMedicalFileView(CenterScopedViewMixin, APIView):
    """GET/PATCH /centers/{center_pk}/patients/{pk}/medical-file/ — S3.

    The structured medical file is CLINICAL data (blood group = RGPD
    art. 9): clinical roles of the perimeter only, for reading AND
    writing — administrative staff and the pharmacist get 403, exactly
    like the carnet. Patient outside the perimeter → 404 (URL ref).
    Before the first write, GET answers the uniform empty shape.
    """

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]

    def _patient(self):
        return get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )

    @extend_schema(responses=PatientMedicalFileSerializer)
    def get(self, request, center_pk, pk):
        patient = self._patient()
        medical_file = (
            PatientMedicalFile.objects.filter(patient=patient).first()
            or PatientMedicalFile()  # unsaved → uniform empty shape
        )
        return Response(PatientMedicalFileSerializer(medical_file).data)

    @extend_schema(
        request=PatientMedicalFileWriteSerializer,
        responses=PatientMedicalFileSerializer,
    )
    def patch(self, request, center_pk, pk):
        patient = self._patient()
        serializer = PatientMedicalFileWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        medical_file = update_patient_medical_file(
            actor=request.user,
            center=self.center,
            patient=patient,
            **serializer.validated_data,
        )
        return Response(PatientMedicalFileSerializer(medical_file).data)


def _document_file_response(document):
    """Stream a patient document to an AUTHORISED caller (ADR 0016 §5).

    The caller's permissions were already replayed by the view (exact same
    scoping as the list). Contract of the response:

    - ``Content-Disposition: attachment`` with a NEUTRAL name
      (``document-<id>.<ext>``) — the uuid storage name never leaks, and
      nothing clinical transits in a header;
    - ``X-Content-Type-Options: nosniff`` — the browser must never
      second-guess the declared image type;
    - at deployment this becomes an ``X-Accel-Redirect`` to an internal
      location over PRIVATE_MEDIA_ROOT (documented in the ADR).
    """
    extension = PurePosixPath(document.file.name).suffix
    response = FileResponse(
        document.file.open("rb"),
        as_attachment=True,
        filename=f"document-{document.pk}{extension}",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


class _CenterPatientDocumentScopeMixin(CenterScopedViewMixin):
    """Shared scoping of the staff document routes (ADR 0016 §5): patient
    resolved in THIS center's perimeter (404), documents PRODUCED BY THIS
    CENTER only — the transversal carnet remains the patient's own space,
    a document produced elsewhere is invisible here (bornage identique aux
    entrées de carnet)."""

    permission_classes = [IsStaffOfCenter(*CLINICAL_ROLES)]

    def scoped_documents(self):
        patient = get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )
        return PatientDocument.objects.filter(
            patient=patient, center=self.center
        )


class CenterPatientDocumentListCreateView(
    _CenterPatientDocumentScopeMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/patients/{pk}/documents/ — S3.

    Clinical roles of the producing center. The LIST includes archived
    rows (the staff sees the correction state — ``archived_at``); the
    patient-side list excludes them. POST is multipart and runs the ADR
    0014 pipeline unchanged (JPEG/PNG/WebP only — PDF explicitly deferred)
    under the STRICT ``uploads`` throttle scope (POST only: reading the
    list must never starve on the upload budget).
    """

    parser_classes = [MultiPartParser, FormParser]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "uploads"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PatientDocumentCreateSerializer
        return PatientDocumentStaffSerializer

    def get_queryset(self):
        return self.scoped_documents().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        patient = get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        source_encounter = None
        if data.get("source_encounter") is not None:
            # Body ref (S1 norm): one explicit 400 covering foreign and
            # non-existent ids alike; the model then re-checks same-patient.
            source_encounter = (
                Encounter.objects.for_center(self.center)
                .filter(pk=data["source_encounter"])
                .first()
            )
            if source_encounter is None:
                raise DjangoValidationError(
                    "Cette consultation n'appartient pas à ce centre."
                )
        document = create_patient_document(
            actor=request.user,
            center=self.center,
            patient=patient,
            uploaded_file=data["file"],
            doc_type=data["doc_type"],
            title=data["title"],
            source_encounter=source_encounter,
        )
        return Response(
            PatientDocumentStaffSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class CenterPatientDocumentDownloadView(
    _CenterPatientDocumentScopeMixin, APIView
):
    """GET .../patients/{pk}/documents/{document_pk}/download/ — S3.

    THE only staff read path of the bytes (private diffusion): replays
    exactly the list permissions and scoping, then streams. An archived
    document stays downloadable by the producing center's clinical staff
    (correction without destruction — the state is visible in the list).
    """

    def get(self, request, center_pk, pk, document_pk):
        document = get_object_or_404(
            self.scoped_documents(), pk=document_pk
        )
        return _document_file_response(document)


class CenterPatientDocumentArchiveView(
    _CenterPatientDocumentScopeMixin, APIView
):
    """POST .../patients/{pk}/documents/{document_pk}/archive/ — S3.

    Error correction WITHOUT destruction (ADR 0002): the row and the file
    stay, the patient no longer sees them. Final — already archived → 400.
    """

    @extend_schema(request=None, responses=PatientDocumentStaffSerializer)
    def post(self, request, center_pk, pk, document_pk):
        document = get_object_or_404(
            self.scoped_documents(), pk=document_pk
        )
        document = archive_patient_document(actor=request.user, document=document)
        return Response(PatientDocumentStaffSerializer(document).data)


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


class MyMedicalFileView(APIView):
    """GET /patients/me/medical-file/ — my structured medical file (S3).

    The carnet belongs to the patient (ADR 0002): transversal read. Empty
    shape before any clinical write; writing stays a clinical-staff act.
    """

    permission_classes = [IsPatientSelf]

    @extend_schema(responses=PatientMedicalFileSerializer)
    def get(self, request):
        profile = claimed_patient_profile(request.user)
        medical_file = (
            PatientMedicalFile.objects.filter(patient=profile).first()
            or PatientMedicalFile()
        )
        return Response(PatientMedicalFileSerializer(medical_file).data)


class MyVitalSignsView(generics.ListAPIView):
    """GET /patients/me/vital-signs/?encounter= — my measures, all centers.

    S3 (ADR 0016 §4) — transversal patient read. ``?encounter=`` narrows
    to one consultation; a foreign encounter id simply matches nothing
    (the queryset is patient-scoped — no cross-patient probe).
    """

    permission_classes = [IsPatientSelf]
    serializer_class = VitalSignsPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        qs = VitalSigns.objects.for_patient(profile).order_by(
            "-measured_at", "-id"
        )
        encounter_id = _validated_id_param(
            self.request.query_params, "encounter", "consultation"
        )
        if encounter_id is not None:
            qs = qs.filter(encounter_id=encounter_id)
        return qs


class MyDocumentsView(generics.ListAPIView):
    """GET /patients/me/documents/ — my carnet documents, all centers (S3).

    Archived documents are EXCLUDED (ADR 0016 §5): archiving is the
    correction path — a document archived by the producing center no
    longer exists for the patient.
    """

    permission_classes = [IsPatientSelf]
    serializer_class = PatientDocumentPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            PatientDocument.objects.for_patient(profile)
            .filter(archived_at__isnull=True)
            .select_related("center")
            .order_by("-created_at")
        )


class MyDocumentDownloadView(APIView):
    """GET /patients/me/documents/{pk}/download/ — S3, private diffusion.

    Replays exactly the patient list scoping (own documents, archived
    excluded → a foreign or archived document is a deterministic 404),
    then streams the bytes. No public URL exists anywhere else.
    """

    permission_classes = [IsPatientSelf]

    def get(self, request, pk):
        profile = claimed_patient_profile(request.user)
        document = get_object_or_404(
            PatientDocument.objects.for_patient(profile).filter(
                archived_at__isnull=True
            ),
            pk=pk,
        )
        return _document_file_response(document)
