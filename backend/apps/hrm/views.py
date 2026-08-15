"""HRM views — one section per AUDIENCE (ADR 0008 / ADR 0020 décision 6).

STAFF of the center:

- **configuration** (services, fonctions, jours fériés) : lecture par TOUT
  membre actif (un organigramme et un calendrier de fermeture sont des
  outils de service), écriture par le **DIRECTEUR** ;
- **dossiers RH, feuille de présence, congés, statistiques** : le
  **DIRECTEUR seul**. Précédents de « donnée visible du directeur seul » :
  ``kyc_reason``, les pièces KYC, le motif de gel d'abonnement, le journal
  d'audit. Un délégué RH est explicitement hors périmètre S7 (décision 6) ;
- **planning collectif du jour** : TOUT membre actif — et le payload fond
  ``absent`` et ``conge`` en une seule valeur (invariant n° 3).

LA PERSONNE, sous ``…/hrm/me/`` : son dossier, ses présences, ses congés
(type compris), ses justificatifs. Elle demande et retire un congé, elle ne
le décide pas. **Cette famille de routes ne passe par aucune garde de
gel** (arbitrage PO n° 3 : « on ne prend jamais en otage les données d'une
personne »).

PATIENT, TUTEUR, EXPLOITANT PLATEFORME : **rien**. Aucune route de ce
module ne vit sous ``/guardian/``, ``/patients/me/`` ni ``/platform/``, et
la sonde structurelle de ``tests/test_adversarial_s3.py``, étendue par S7,
refuse qu'il en apparaisse une.

Sémantique des refus (norme S1) : anonyme → 401 ; centre où l'appelant n'a
aucun membership → 404 (``CenterScopedViewMixin``) ; un dossier, un congé,
un service d'un AUTRE centre atteint par mon URL → 404 (cloisonnement au
queryset, réponse IDOR déterministe) ; une référence qui voyage dans le
CORPS (personne, service, fonction, dossier) hors périmètre → **400
explicite**.
"""

from pathlib import PurePosixPath

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.centers.models import StaffMembership
from apps.common.periods import parse_day, parse_period
from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter
from apps.hrm.models import (
    AttendanceRecord,
    Department,
    Employment,
    Holiday,
    JobTitle,
    LeaveDocument,
    LeaveRequest,
)
from apps.hrm.serializers import (
    AttendanceRecordSerializer,
    AttendanceWriteSerializer,
    DepartmentPatchSerializer,
    DepartmentSerializer,
    DepartmentWriteSerializer,
    EmploymentCreateSerializer,
    EmploymentPatchSerializer,
    EmploymentSerializer,
    HolidaySerializer,
    HolidayWriteSerializer,
    JobTitlePatchSerializer,
    JobTitleSerializer,
    JobTitleWriteSerializer,
    LeaveCreateSerializer,
    LeaveDocumentSerializer,
    LeaveDocumentUploadSerializer,
    LeaveRequestSerializer,
    MyAttendanceSerializer,
    MyEmploymentSerializer,
    MyLeaveRequestSerializer,
    ScheduleRowSerializer,
)
from apps.hrm.services import (
    archive_leave_document,
    attendance_summary,
    cancel_leave,
    create_department,
    create_employment,
    create_holiday,
    create_job_title,
    decide_leave,
    delete_holiday,
    employments_queryset,
    record_attendance,
    request_leave,
    schedule_rows,
    staff_user_ids,
    update_department,
    update_employment,
    update_job_title,
    upload_leave_document,
)

DIRECTOR = StaffMembership.Role.DIRECTOR

#: Fenêtre de lecture du module — **choix explicite** (invariant 6) :
#: ``apps.common.periods`` (jours locaux Comores inclusifs, 30 par défaut,
#: **366 maximum**), le même contrat que le journal du directeur et les
#: statistiques de pilotage. PAS celui de ``scheduling`` (62 jours,
#: ``?date=`` exclusif de ``?from=&to=``) : un agenda de rendez-vous est un
#: calendrier de travail qu'on borne pour protéger un payload lourd, alors
#: qu'un registre du personnel se lit au mois et à l'année (une feuille de
#: présence annuelle, un historique de congés). Le planning collectif, lui,
#: porte sur UN jour : il utilise ``parse_day``.

#: Fenêtre du PLANNING COLLECTIF, en jours autour d'aujourd'hui (revue
#: adversariale S7). Le planning est la seule donnée d'une personne que ses
#: COLLÈGUES lisent, et il répond à une question de service — « qui est là
#: aujourd'hui ? ». Sans borne, la même route servait n'importe quelle date
#: passée : 365 requêtes (le throttle en autorise 600 par minute) et
#: n'importe quel membre du personnel reconstituait, collègue par collègue,
#: le compte de ses journées d'absence sur l'année. Le régime ne fuitait
#: pas, mais l'AGRÉGAT est exactement l'instrument que l'arbitrage PO n° 2
#: refuse d'inventer (« aucune surveillance qui n'existait pas avant » — la
#: feuille papier est chez le responsable, elle n'est pas affichée au
#: service). Un mois de part et d'autre couvre le besoin réel (« qui était
#: là hier ? », « qui est de garde la semaine prochaine ? ») ; au-delà,
#: chacun lit SON historique sous ``…/hrm/me/attendance/`` et le directeur
#: la feuille entière. Arbitrage RÉVERSIBLE.
SCHEDULE_WINDOW_DAYS = 31


# ---------------------------------------------------------------------------
# Résolution des références du CORPS — 400 explicite, jamais un 404 (norme S1)
# ---------------------------------------------------------------------------


def _resolve_department(center, pk):
    if pk is None:
        return None
    department = Department.objects.for_center(center).filter(pk=pk).first()
    if department is None:
        raise DjangoValidationError("Ce service n'appartient pas à ce centre.")
    return department


def _resolve_job_title(center, pk):
    if pk is None:
        return None
    job_title = JobTitle.objects.for_center(center).filter(pk=pk).first()
    if job_title is None:
        raise DjangoValidationError("Cette fonction n'appartient pas à ce centre.")
    return job_title


def _resolve_staff_user(center, pk):
    """A person of THIS center's staff — one message for the foreign and the
    non-existent id alike (no user-table oracle)."""
    from django.contrib.auth import get_user_model

    user = (
        get_user_model()
        .objects.filter(pk=pk, pk__in=staff_user_ids(center))
        .first()
    )
    if user is None:
        raise DjangoValidationError(
            "Cette personne ne fait pas partie du personnel de ce centre."
        )
    return user


def _resolve_employment(center, pk):
    employment = (
        Employment.objects.for_center(center)
        .select_related("user", "department", "job_title")
        .filter(pk=pk)
        .first()
    )
    if employment is None:
        raise DjangoValidationError("Ce dossier RH n'appartient pas à ce centre.")
    return employment


def _document_file_response(document):
    """Stream a supporting file — private diffusion (ADR 0016 §5 patron).

    ``as_attachment`` + a NEUTRAL name (``justificatif-{id}.jpg``): the
    stored name is a uuid and the original one was never kept, so nothing
    of the person's health can travel in a Content-Disposition header.
    ``nosniff`` closes the inline-render path.

    A row whose bytes were purged by the RGPD erasure of its owner
    (``hrm.services.purge_leave_documents_of``) answers an honest 404 in
    French: the register still says a piece existed, the piece itself no
    longer does.
    """
    if not document.file:
        raise NotFound(
            "Ce justificatif n'est plus disponible : son propriétaire a "
            "exercé son droit à l'effacement."
        )
    extension = PurePosixPath(document.file.name).suffix
    response = FileResponse(
        document.file.open("rb"),
        as_attachment=True,
        filename=f"justificatif-{document.pk}{extension}",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


# ---------------------------------------------------------------------------
# Configuration — lecture tout staff, écriture directeur
# ---------------------------------------------------------------------------


class CenterDepartmentListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/hrm/departments/.

    GET : tout membre actif (l'organigramme est un outil de service).
    POST : le DIRECTEUR. Gelé par l'abonnement (ADR 0020, décision 7).
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DepartmentWriteSerializer
        return DepartmentSerializer

    def get_queryset(self):
        return Department.objects.for_center(self.center)

    @extend_schema(
        request=DepartmentWriteSerializer, responses={201: DepartmentSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = DepartmentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = create_department(
            actor=request.user, center=self.center,
            name=serializer.validated_data["name"],
        )
        return Response(
            DepartmentSerializer(department).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterDepartmentDetailView(CenterScopedViewMixin, APIView):
    """PATCH /centers/{center_pk}/hrm/departments/{pk}/ — directeur."""

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = DepartmentPatchSerializer

    @extend_schema(
        request=DepartmentPatchSerializer, responses=DepartmentSerializer
    )
    def patch(self, request, center_pk, pk):
        department = get_object_or_404(
            Department.objects.for_center(self.center), pk=pk
        )
        serializer = DepartmentPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = update_department(
            actor=request.user, department=department,
            **serializer.validated_data,
        )
        return Response(DepartmentSerializer(department).data)


class CenterJobTitleListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/hrm/job-titles/ — mêmes règles.

    Rappel de la décision 2 : une fonction est un LIBELLÉ, jamais un droit.
    Aucune classe de permission du produit ne lit ce modèle.
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return JobTitleWriteSerializer
        return JobTitleSerializer

    def get_queryset(self):
        return JobTitle.objects.for_center(self.center)

    @extend_schema(
        request=JobTitleWriteSerializer, responses={201: JobTitleSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = JobTitleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job_title = create_job_title(
            actor=request.user, center=self.center,
            name=serializer.validated_data["name"],
        )
        return Response(
            JobTitleSerializer(job_title).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterJobTitleDetailView(CenterScopedViewMixin, APIView):
    """PATCH /centers/{center_pk}/hrm/job-titles/{pk}/ — directeur."""

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = JobTitlePatchSerializer

    @extend_schema(request=JobTitlePatchSerializer, responses=JobTitleSerializer)
    def patch(self, request, center_pk, pk):
        job_title = get_object_or_404(
            JobTitle.objects.for_center(self.center), pk=pk
        )
        serializer = JobTitlePatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job_title = update_job_title(
            actor=request.user, job_title=job_title, **serializer.validated_data
        )
        return Response(JobTitleSerializer(job_title).data)


class CenterHolidayListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/hrm/holidays/?from=&to=.

    GET : tout membre actif — savoir que le centre ferme le 6 juillet est
    un besoin de service. POST : le DIRECTEUR (décision 5 : le calendrier
    appartient au centre, pas à une liste nationale imposée).
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return HolidayWriteSerializer
        return HolidaySerializer

    def get_queryset(self):
        qs = Holiday.objects.for_center(self.center)
        params = self.request.query_params
        if params.get("from") or params.get("to"):
            from_day, to_day, _start, _end = parse_period(self.request)
            qs = qs.filter(date__gte=from_day, date__lte=to_day)
        return qs

    @extend_schema(
        request=HolidayWriteSerializer, responses={201: HolidaySerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = HolidayWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        holiday = create_holiday(
            actor=request.user, center=self.center,
            date=serializer.validated_data["date"],
            name=serializer.validated_data["name"],
        )
        return Response(
            HolidaySerializer(holiday).data, status=http_status.HTTP_201_CREATED
        )


class CenterHolidayDetailView(CenterScopedViewMixin, APIView):
    """DELETE /centers/{center_pk}/hrm/holidays/{pk}/ — directeur.

    Le seul modèle du module qui se SUPPRIME : un férié est de la
    configuration de calendrier pure — il ne documente aucune décision sur
    une personne et ne porte aucun argent. Ce qui s'est réellement passé ce
    jour-là est sur la feuille de présence, qui n'est pas touchée.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, center_pk, pk):
        holiday = get_object_or_404(
            Holiday.objects.for_center(self.center), pk=pk
        )
        delete_holiday(actor=request.user, holiday=holiday)
        return Response(status=http_status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Audience : le DIRECTEUR — dossiers, présence, congés, statistiques
# ---------------------------------------------------------------------------


class CenterEmploymentListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/hrm/employments/ — DIRECTEUR seul.

    Un dossier RH porte une date d'embauche, un service et une fonction :
    ce sont des données personnelles sur un collègue, pas un annuaire.
    ``?running=true`` ne garde que les emplois en cours.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmploymentCreateSerializer
        return EmploymentSerializer

    def get_queryset(self):
        qs = employments_queryset(self.center)
        raw = self.request.query_params.get("running")
        if raw is not None:
            if raw not in ("true", "false"):
                raise DrfValidationError(
                    {"running": ["Valeur attendue : true ou false."]}
                )
            if raw == "true":
                from django.utils import timezone

                qs = qs.active_on(timezone.localdate())
        return qs

    @extend_schema(
        request=EmploymentCreateSerializer, responses={201: EmploymentSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = EmploymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        employment = create_employment(
            actor=request.user,
            center=self.center,
            user=_resolve_staff_user(self.center, data["user"]),
            hired_at=data["hired_at"],
            department=_resolve_department(self.center, data.get("department")),
            job_title=_resolve_job_title(self.center, data.get("job_title")),
        )
        return Response(
            EmploymentSerializer(employment).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterEmploymentDetailView(CenterScopedViewMixin, APIView):
    """GET|PATCH /centers/{center_pk}/hrm/employments/{pk}/ — DIRECTEUR."""

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = EmploymentPatchSerializer

    def _employment(self, pk):
        return get_object_or_404(employments_queryset(self.center), pk=pk)

    @extend_schema(responses=EmploymentSerializer)
    def get(self, request, center_pk, pk):
        return Response(EmploymentSerializer(self._employment(pk)).data)

    @extend_schema(request=EmploymentPatchSerializer, responses=EmploymentSerializer)
    def patch(self, request, center_pk, pk):
        employment = self._employment(pk)
        serializer = EmploymentPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        if "department" in fields:
            fields["department"] = _resolve_department(
                self.center, fields["department"]
            )
        if "job_title" in fields:
            fields["job_title"] = _resolve_job_title(
                self.center, fields["job_title"]
            )
        employment = update_employment(
            actor=request.user, employment=employment, **fields
        )
        return Response(EmploymentSerializer(employment).data)


class CenterAttendanceListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/hrm/attendance/ — DIRECTEUR seul.

    GET ``?from=&to=&employment=`` : jours locaux Comores inclusifs, 30 par
    défaut, 366 maximum (contrat ``apps.common.periods``, comme le journal
    d'audit).

    POST : **upsert** sur (dossier, date). Une feuille papier se CORRIGE,
    elle ne s'empile pas — rejouer la même journée avec un autre statut
    remplace la ligne et ré-audite, sans jamais créer un doublon. 201 à la
    création, 200 à la correction.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AttendanceWriteSerializer
        return AttendanceRecordSerializer

    def get_queryset(self):
        from_day, to_day, _start, _end = parse_period(self.request)
        qs = (
            AttendanceRecord.objects.for_center(self.center)
            .filter(date__gte=from_day, date__lte=to_day)
            .select_related("employment__user")
        )
        raw = self.request.query_params.get("employment")
        if raw:
            if not raw.isdigit():
                raise DrfValidationError(
                    {"employment": ["Identifiant de dossier RH invalide."]}
                )
            # Queryset déjà cloisonné : un id étranger ne remonte rien
            # (aucune sonde inter-centres par le filtre).
            qs = qs.filter(employment_id=int(raw))
        return qs.order_by("-date", "employment_id")

    @extend_schema(
        request=AttendanceWriteSerializer, responses=AttendanceRecordSerializer
    )
    def create(self, request, *args, **kwargs):
        serializer = AttendanceWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        employment = _resolve_employment(self.center, data["employment"])
        written = record_attendance(
            actor=request.user, employment=employment,
            date=data["date"], status=data["status"],
        )
        # 201/200 lu sur le FAIT, sous le verrou de l'emploi — un
        # pré-contrôle pris avant la transaction annonçait « créé » à celui
        # des deux responsables qui avait en réalité corrigé (revue
        # adversariale S7).
        created = getattr(written, "was_created", False)
        record = (
            AttendanceRecord.objects.select_related("employment__user")
            .get(pk=written.pk)
        )
        return Response(
            AttendanceRecordSerializer(record).data,
            status=(
                http_status.HTTP_201_CREATED if created
                else http_status.HTTP_200_OK
            ),
        )


class CenterScheduleView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/hrm/schedule/?date= — TOUT MEMBRE ACTIF.

    Le planning COLLECTIF du jour, et le seul point du module où la donnée
    d'une personne est vue par ses collègues. Il répond au besoin de
    service (« qui est là aujourd'hui ? ») et s'arrête exactement là :
    ``absent`` et ``conge`` sont **fondus en une seule valeur** par
    :data:`~apps.hrm.serializers.PUBLIC_ATTENDANCE` (invariant n° 3) —
    sinon « en congé » se lirait comme « pas malade », et l'absence non
    expliquée deviendrait un signal.

    ``?date=`` seul (pas de plage) : c'est un tableau de service, on l'ouvre
    sur un jour. Date malformée ou impossible → 400 par champ, et une date
    hors de la fenêtre de service (:data:`SCHEDULE_WINDOW_DAYS`) → 400
    aussi : un tableau de service n'est pas un historique d'absentéisme
    (revue adversariale S7).
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = ScheduleRowSerializer
    pagination_class = None

    def get_queryset(self):
        from django.utils import timezone

        today = timezone.localdate()
        raw = self.request.query_params.get("date")
        day = parse_day(raw, "date") if raw else today
        if abs((day - today).days) > SCHEDULE_WINDOW_DAYS:
            raise DrfValidationError(
                {
                    "date": [
                        "Le planning collectif est un tableau de service : "
                        f"il s'ouvre sur les {SCHEDULE_WINDOW_DAYS} jours "
                        "autour d'aujourd'hui. Chacun retrouve son propre "
                        "historique dans « Mes présences »."
                    ]
                }
            )
        return schedule_rows(self.center, day)


class CenterLeaveListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/hrm/leaves/ — DIRECTEUR seul.

    Il décide, donc il voit le type (décision 6). ``?status=`` et
    ``?employment=`` ; sans filtre, tout, plus récent d'abord.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.for_center(self.center).select_related(
            "employment__user"
        )
        params = self.request.query_params
        raw_status = params.get("status")
        if raw_status:
            if raw_status not in LeaveRequest.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=raw_status)
        raw_employment = params.get("employment")
        if raw_employment:
            if not raw_employment.isdigit():
                raise DrfValidationError(
                    {"employment": ["Identifiant de dossier RH invalide."]}
                )
            qs = qs.filter(employment_id=int(raw_employment))
        return qs.order_by("-start_date", "-id")


class _CenterLeaveActionMixin(CenterScopedViewMixin):
    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    def get_leave(self, pk):
        return get_object_or_404(
            LeaveRequest.objects.for_center(self.center).select_related(
                "employment__user"
            ),
            pk=pk,
        )

    def render(self, leave):
        fresh = (
            LeaveRequest.objects.select_related("employment__user")
            .get(pk=leave.pk)
        )
        return LeaveRequestSerializer(fresh).data


class CenterLeaveDetailView(_CenterLeaveActionMixin, APIView):
    @extend_schema(responses=LeaveRequestSerializer)
    def get(self, request, center_pk, pk):
        return Response(self.render(self.get_leave(pk)))


class CenterLeaveApproveView(_CenterLeaveActionMixin, APIView):
    """POST .../leaves/{pk}/approve/ — corps vide.

    Deux congés APPROUVÉS ne peuvent pas se chevaucher : la garde est prise
    sous le verrou de l'EMPLOI (hiérarchie emploi → congé). Deux demandes
    qui se chevauchent, elles, sont permises — on tranche ici.
    """

    @extend_schema(request=None, responses=LeaveRequestSerializer)
    def post(self, request, center_pk, pk):
        leave = self.get_leave(pk)
        decide_leave(actor=request.user, leave=leave, approve=True)
        return Response(self.render(leave))


class CenterLeaveRefuseView(_CenterLeaveActionMixin, APIView):
    """POST .../leaves/{pk}/refuse/ — corps vide.

    **Aucun motif n'est demandé, et c'est volontaire** : le produit ne
    stocke aucun texte libre sur le congé de quelqu'un (décision 4). Un
    refus s'explique de vive voix, comme il l'a toujours été.
    """

    @extend_schema(request=None, responses=LeaveRequestSerializer)
    def post(self, request, center_pk, pk):
        leave = self.get_leave(pk)
        decide_leave(actor=request.user, leave=leave, approve=False)
        return Response(self.render(leave))


class CenterLeaveDocumentListView(_CenterLeaveActionMixin, generics.ListAPIView):
    """GET .../leaves/{pk}/documents/ — DIRECTEUR : il décide, il lit.

    Aucune URL dans le payload (le storage privé n'en a pas) : le
    téléchargement passe par la route dédiée ci-dessous.
    """

    serializer_class = LeaveDocumentSerializer
    pagination_class = None

    def get_queryset(self):
        return LeaveDocument.objects.filter(
            leave=self.get_leave(self.kwargs["pk"])
        ).order_by("-created_at", "-id")


class CenterLeaveDocumentDownloadView(_CenterLeaveActionMixin, APIView):
    """GET .../leaves/{pk}/documents/{doc_pk}/download/ — DIRECTEUR.

    Une pièce archivée reste téléchargeable : vérifier ce qui a été archivé
    fait partie de la correction d'une erreur (patron KYC).
    """

    def get(self, request, center_pk, pk, doc_pk):
        document = get_object_or_404(
            LeaveDocument.objects.filter(leave=self.get_leave(pk)), pk=doc_pk
        )
        return _document_file_response(document)


class CenterAttendanceStatsView(CenterScopedViewMixin, APIView):
    """GET /centers/{center_pk}/hrm/stats/attendance/?from=&to= — DIRECTEUR.

    Endpoint DÉDIÉ (ADR 0020 invariant 6) : rien de ce sprint n'entre dans
    ``apps/centers/stats_views.py``, qui agrège l'activité de SOIN et dont
    les ``assertNumQueries`` sont verrouillés. Patron ``occupancy_rows``
    de S6 — une lecture agrégée vit dans son module.

    Fenêtre : ``apps.common.periods`` (30 j par défaut, 366 max, bornes
    locales Comores). Deux agrégats SQL, jamais une requête par personne.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]

    def get(self, request, center_pk):
        from_day, to_day, _start, _end = parse_period(request)
        per_day, per_employment = attendance_summary(
            self.center, from_day, to_day
        )
        statuses = list(AttendanceRecord.Status.values)
        days = []
        cursor = from_day
        from datetime import timedelta

        while cursor <= to_day:
            bucket = per_day.get(cursor, {})
            row = {"date": cursor}
            row.update({key: bucket.get(key, 0) for key in statuses})
            row["total"] = sum(bucket.values())
            days.append(row)
            cursor += timedelta(days=1)
        totals = {
            key: sum(row[key] for row in days) for key in statuses
        }
        totals["total"] = sum(row["total"] for row in days)

        names = {
            employment.pk: employment
            for employment in employments_queryset(self.center)
        }
        by_employment = {}
        for row in per_employment:
            entry = by_employment.setdefault(
                row["employment_id"],
                {key: 0 for key in statuses},
            )
            entry[row["status"]] = row["total"]
        rows = []
        for employment_id, counts in by_employment.items():
            employment = names.get(employment_id)
            if employment is None:  # pragma: no cover — scoped queryset
                continue
            user = employment.user
            rows.append(
                {
                    "employment": employment_id,
                    "display_name": (
                        f"{user.first_name} {user.last_name}".strip()
                        or user.username
                    ),
                    **counts,
                    "total": sum(counts.values()),
                }
            )
        rows.sort(key=lambda row: (-row["total"], row["display_name"]))
        return Response(
            {
                "from": from_day,
                "to": to_day,
                "days": days,
                "totals": totals,
                "by_employment": rows,
            }
        )


# ---------------------------------------------------------------------------
# Audience : LA PERSONNE — ses propres données, jamais gelées
# ---------------------------------------------------------------------------


class _MyHrmMixin(CenterScopedViewMixin):
    """Résout le dossier RH DE L'APPELANT dans ce centre.

    ``IsStaffOfCenter()`` (n'importe quel rôle actif) ouvre la porte ; le
    queryset, lui, est scellé sur ``for_user(request.user)`` — une personne
    ne lit jamais que la sienne, quel que soit son rôle. Un directeur passe
    par ici pour SES congés, comme tout le monde.
    """

    permission_classes = [IsStaffOfCenter()]

    @property
    def employment(self):
        employment = (
            Employment.objects.for_center(self.center)
            .for_user(self.request.user)
            .select_related("center", "department", "job_title")
            .first()
        )
        if employment is None:
            raise NotFound(
                "Vous n'avez pas encore de dossier RH dans ce centre."
            )
        return employment

    def my_leaves(self):
        return LeaveRequest.objects.filter(employment=self.employment)

    def get_my_leave(self, pk):
        return get_object_or_404(self.my_leaves(), pk=pk)


class MyEmploymentView(_MyHrmMixin, APIView):
    """GET /centers/{center_pk}/hrm/me/ — mon dossier RH dans ce centre.

    404 « Vous n'avez pas encore de dossier RH dans ce centre. » est un état
    NORMAL (personne n'en a avant que le directeur ne l'ouvre) : un état
    vide honnête, jamais une erreur rouge.
    """

    @extend_schema(responses=MyEmploymentSerializer)
    def get(self, request, center_pk):
        return Response(MyEmploymentSerializer(self.employment).data)


class MyAttendanceView(_MyHrmMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/hrm/me/attendance/?from=&to=.

    **Jamais gelée** (arbitrage PO n° 3) : la lecture de ses propres données
    ne passe par aucune garde d'abonnement — on ne prend jamais en otage les
    données d'une personne.
    """

    serializer_class = MyAttendanceSerializer

    def get_queryset(self):
        from_day, to_day, _start, _end = parse_period(self.request)
        return (
            AttendanceRecord.objects.filter(employment=self.employment)
            .filter(date__gte=from_day, date__lte=to_day)
            .order_by("-date", "-id")
        )


class MyLeaveListCreateView(_MyHrmMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/hrm/me/leaves/.

    POST = demander un congé POUR SOI. Le dossier n'est jamais dans le
    corps : il est celui de l'appelant, un id y ouvrirait la porte à une
    demande au nom d'un collègue.

    **Pas gelé** : demander un congé est l'acte de la personne sur son
    propre dossier ; le refuser punirait un salarié pour la facture impayée
    de son employeur. C'est la DÉCISION (côté directeur) qui est gelée.
    """

    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LeaveCreateSerializer
        return MyLeaveRequestSerializer

    def get_queryset(self):
        return self.my_leaves().order_by("-start_date", "-id")

    @extend_schema(
        request=LeaveCreateSerializer, responses={201: MyLeaveRequestSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = LeaveCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        leave = request_leave(
            actor=request.user, employment=self.employment,
            leave_type=data["leave_type"], start_date=data["start_date"],
            end_date=data["end_date"],
        )
        return Response(
            MyLeaveRequestSerializer(leave).data,
            status=http_status.HTTP_201_CREATED,
        )


class MyLeaveCancelView(_MyHrmMixin, APIView):
    """POST .../me/leaves/{pk}/cancel/ — retirer MA demande (corps vide).

    Seule une demande EN ATTENTE se retire : un congé approuvé est terminal
    en S7 (consigné dans l'ADR), et la feuille de présence dit ce qui s'est
    réellement passé.
    """

    @extend_schema(request=None, responses=MyLeaveRequestSerializer)
    def post(self, request, center_pk, pk):
        leave = self.get_my_leave(pk)
        cancel_leave(actor=request.user, leave=leave)
        leave.refresh_from_db()
        return Response(MyLeaveRequestSerializer(leave).data)


class MyLeaveDocumentListCreateView(_MyHrmMixin, generics.ListCreateAPIView):
    """GET/POST .../me/leaves/{pk}/documents/ — MON justificatif.

    POST multipart, pipeline ADR 0014 (JPEG/PNG/WebP par le contenu réel,
    2 Mo, métadonnées strippées, nom uuid) puis stockage PRIVÉ. Throttle
    ``uploads`` sur le POST SEUL — lire la liste ne doit jamais consommer
    le budget d'upload.
    """

    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "uploads"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LeaveDocumentUploadSerializer
        return LeaveDocumentSerializer

    def get_queryset(self):
        return LeaveDocument.objects.filter(
            leave=self.get_my_leave(self.kwargs["pk"])
        ).order_by("-created_at", "-id")

    @extend_schema(
        request=LeaveDocumentUploadSerializer,
        responses={201: LeaveDocumentSerializer},
    )
    def create(self, request, *args, **kwargs):
        leave = self.get_my_leave(self.kwargs["pk"])
        serializer = LeaveDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = upload_leave_document(
            actor=request.user, leave=leave,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response(
            LeaveDocumentSerializer(document).data,
            status=http_status.HTTP_201_CREATED,
        )


class MyLeaveDocumentDownloadView(_MyHrmMixin, APIView):
    """GET .../me/leaves/{pk}/documents/{doc_pk}/download/ — la personne."""

    def get(self, request, center_pk, pk, doc_pk):
        document = get_object_or_404(
            LeaveDocument.objects.filter(leave=self.get_my_leave(pk)), pk=doc_pk
        )
        return _document_file_response(document)


class MyLeaveDocumentArchiveView(_MyHrmMixin, APIView):
    """POST .../me/leaves/{pk}/documents/{doc_pk}/archive/ — corps vide.

    Correction SANS destruction : la personne s'est trompée de photo, elle
    archive et en dépose une autre. La pièce qui a fondé une décision reste
    lisible du directeur — l'archivage est définitif.
    """

    @extend_schema(request=None, responses=LeaveDocumentSerializer)
    def post(self, request, center_pk, pk, doc_pk):
        document = get_object_or_404(
            LeaveDocument.objects.filter(leave=self.get_my_leave(pk)), pk=doc_pk
        )
        document = archive_leave_document(actor=request.user, document=document)
        return Response(LeaveDocumentSerializer(document).data)
