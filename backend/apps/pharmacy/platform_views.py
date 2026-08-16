"""Le back-office du réseau — audience ``PlatformStaff`` (S9, ADR 0022).

Monté sous ``/api/v1/platform/``, donc soumis aux deux règles du rail S4 :
toute vue DÉCLARE ``IsPlatformStaff`` (sonde structurelle
``tests/test_permissions_platform.py``), et **aucun patient n'y apparaît**.

Répartition des rôles, identique au rail des centres : ``support`` lit,
``admin`` seul écrit — enregistrer une officine, décider de son statut,
lui amorcer une personne. La décision de validation est le seul vrai
pouvoir de ce module : elle ouvre (ou ferme) la réception des demandes.
"""

from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PlatformStaff
from apps.common.geo import Island
from apps.common.permissions import IsPlatformStaff
from apps.pharmacy.models import Pharmacy, PharmacyDocument
from apps.pharmacy.platform_serializers import (
    PlatformPharmacyCreateSerializer,
    PlatformPharmacySerializer,
    PlatformPharmacyStatusSerializer,
)
from apps.pharmacy.serializers import (
    PharmacyDocumentSerializer,
    PharmacyMemberCreateSerializer,
    PharmacyMemberSerializer,
)
from apps.pharmacy.services import (
    add_pharmacy_member,
    create_pharmacy_with_member,
    set_pharmacy_status,
)
from apps.pharmacy.space_views import pharmacy_document_file_response

PLATFORM_ADMIN = PlatformStaff.Role.ADMIN


def platform_pharmacies_qs():
    """Toutes les officines, annotées de ce qu'un exploitant doit surveiller."""
    return Pharmacy.objects.annotate(
        member_active_count=Count(
            "memberships",
            filter=Q(memberships__is_active=True),
            distinct=True,
        ),
        document_count=Count(
            "documents",
            filter=Q(documents__archived_at__isnull=True),
            distinct=True,
        ),
        received_request_count=Count("received_requests", distinct=True),
    )


class PlatformPharmacyListCreateView(generics.ListCreateAPIView):
    """GET /platform/pharmacies/ (support+admin) — POST (admin seul).

    Filtres : ``?status=`` (valeur inconnue → 400 par champ, jamais un 500),
    ``?island=`` et ``?q=`` sur le nom ou la commune.

    POST enregistre l'officine ET sa première personne dans UNE transaction :
    une pharmacie sans personne est une boîte de réception morte.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformPharmacySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsPlatformStaff(PLATFORM_ADMIN)()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PlatformPharmacyCreateSerializer
        return PlatformPharmacySerializer

    def get_queryset(self):
        qs = platform_pharmacies_qs().order_by("name", "id")
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in Pharmacy.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=status_filter)
        island = (params.get("island") or "").strip()
        if island:
            if island not in Island.values:
                raise DrfValidationError({"island": ["Île inconnue."]})
            qs = qs.filter(island=island)
        query = (params.get("q") or "").strip()
        if query:
            qs = qs.filter(Q(name__icontains=query) | Q(city__icontains=query))
        return qs

    @extend_schema(
        request=PlatformPharmacyCreateSerializer,
        responses={201: PlatformPharmacySerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = PlatformPharmacyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        try:
            pharmacy, membership = create_pharmacy_with_member(
                actor=request.user,
                member_phone=data.pop("member_phone"),
                member_first_name=data.pop("member_first_name", ""),
                member_last_name=data.pop("member_last_name", ""),
                **data,
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        payload = PlatformPharmacySerializer(
            platform_pharmacies_qs().get(pk=pharmacy.pk)
        ).data
        payload["member"] = PharmacyMemberSerializer(membership).data
        return Response(payload, status=status.HTTP_201_CREATED)


class PlatformPharmacySimilarView(generics.ListAPIView):
    """GET /platform/pharmacies/similar/?name=&city=&island= — NON bloquant.

    Miroir de la détection de doublons des centres (S4) : aucune contrainte
    d'unicité n'est posée — deux « Pharmacie du Port » peuvent coexister sur
    deux îles — l'exploitant est INFORMÉ et décide.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformPharmacySerializer

    def get_queryset(self):
        params = self.request.query_params
        name = (params.get("name") or "").strip()
        city = (params.get("city") or "").strip()
        island = (params.get("island") or "").strip()
        if island and island not in Island.values:
            raise DrfValidationError({"island": ["Île inconnue."]})
        if not name and not city:
            raise DrfValidationError(
                ["Au moins un critère est requis : nom, ou commune."]
            )
        criteria = Q(pk__in=[])
        if name:
            criteria |= Q(name__icontains=name)
        if city:
            criteria |= Q(city__icontains=city)
        qs = platform_pharmacies_qs().filter(criteria)
        if island:
            qs = qs.filter(island=island)
        return qs.order_by("name", "id")


class PlatformPharmacyDetailView(generics.RetrieveAPIView):
    """GET /platform/pharmacies/{pk}/ — support + admin, lecture seule.

    Corriger l'adresse ou le téléphone reste le travail de l'officine
    (``PATCH /pharmacy/{pk}/``) : la plateforme décide du statut, pas de la
    devanture. Même partage qu'avec les centres.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PlatformPharmacySerializer

    def get_queryset(self):
        return platform_pharmacies_qs()


class PlatformPharmacyStatusView(APIView):
    """POST /platform/pharmacies/{pk}/status/ — admin seul.

    LA porte unique du statut (l'admin Django est en lecture seule sur ces
    tables). Machine explicite, motif obligatoire pour suspendre, motif
    JAMAIS journalisé.

    Ce que ferme une suspension, et rien de plus : la réception de nouvelles
    demandes et le droit de répondre. L'officine garde la lecture de son
    historique et le dépôt de ses pièces — c'est ainsi qu'elle se
    régularise.
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]
    serializer_class = PlatformPharmacyStatusSerializer

    @extend_schema(
        request=PlatformPharmacyStatusSerializer,
        responses={200: PlatformPharmacySerializer},
    )
    def post(self, request, pk):
        pharmacy = get_object_or_404(Pharmacy.objects.all(), pk=pk)
        serializer = PlatformPharmacyStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            set_pharmacy_status(
                actor=request.user,
                pharmacy=pharmacy,
                status=serializer.validated_data["status"],
                reason=serializer.validated_data.get("reason", ""),
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            PlatformPharmacySerializer(platform_pharmacies_qs().get(pk=pk)).data
        )


class PlatformPharmacyMemberCreateView(APIView):
    """POST /platform/pharmacies/{pk}/members/ — admin seul, chemin de secours.

    Amorce une personne dans une officine qui n'en a plus (départ,
    accident) : sans elle, la boîte de réception reste sans relève et
    personne ne peut plus s'inscrire. Miroir de
    ``POST /platform/centers/{pk}/directors/``, garde de séparation des
    pouvoirs comprise (un exploitant ne s'inscrit pas dans le réseau qu'il
    valide).
    """

    permission_classes = [IsPlatformStaff(PLATFORM_ADMIN)]
    serializer_class = PharmacyMemberCreateSerializer

    @extend_schema(
        request=PharmacyMemberCreateSerializer,
        responses={201: PharmacyMemberSerializer},
    )
    def post(self, request, pk):
        pharmacy = get_object_or_404(Pharmacy.objects.all(), pk=pk)
        serializer = PharmacyMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = add_pharmacy_member(
                actor=request.user, pharmacy=pharmacy, **serializer.validated_data
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            PharmacyMemberSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class PlatformPharmacyDocumentListView(generics.ListAPIView):
    """GET /platform/pharmacies/{pk}/documents/ — les pièces AVANT la décision.

    Les pièces archivées restent dans la liste : une validation doit rester
    auditable contre ce qui l'a fondée.
    """

    permission_classes = [IsPlatformStaff()]
    serializer_class = PharmacyDocumentSerializer
    pagination_class = None

    def get_queryset(self):
        pharmacy = get_object_or_404(Pharmacy.objects.all(), pk=self.kwargs["pk"])
        return PharmacyDocument.objects.filter(pharmacy=pharmacy).order_by(
            "-created_at"
        )


class PlatformPharmacyDocumentDownloadView(APIView):
    """GET /platform/pharmacies/{pk}/documents/{document_pk}/download/.

    Le seul chemin de lecture des octets côté plateforme : le stockage privé
    n'a pas d'URL, donc la licence d'une officine ne peut ni être servie
    statiquement ni fuir par un sérialiseur.
    """

    permission_classes = [IsPlatformStaff()]

    def get(self, request, pk, document_pk):
        pharmacy = get_object_or_404(Pharmacy.objects.all(), pk=pk)
        document = get_object_or_404(
            PharmacyDocument.objects.filter(pharmacy=pharmacy), pk=document_pk
        )
        return pharmacy_document_file_response(document)
