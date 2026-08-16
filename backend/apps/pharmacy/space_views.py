"""Le 5ᵉ espace — les vues de la PHARMACIE elle-même (S9, ADR 0022).

Tout ce qui vit ici est monté sous ``/api/v1/pharmacy/`` et DOIT déclarer
``IsPharmacyMember`` : une sonde structurelle parcourt l'arbre d'URL et
échoue sinon (``tests/test_pharmacy.py``, patron des rails ``/guardian/``
et ``/platform/``). Une future route de cet espace ne peut pas partir sans
garde — ni sans liste blanche.

L'invariant du sprint se joue en entier dans ce fichier et dans la section
« pharmacie » des sérialiseurs :

    une officine connaît une ZONE, une LISTE DE MÉDICAMENTS et un NUMÉRO.
    Jamais le centre, jamais l'ordonnance, jamais le patient.

Sémantique des refus : anonyme → 401 ; compte sans appartenance active →
403 ; pharmacie d'un autre → 404 (``PharmacyScopedViewMixin``) ; demande
jamais adressée à cette officine → 404 (le queryset part des lignes de
diffusion, pas d'un filtre de commune recalculé).
"""

from pathlib import PurePosixPath

from django.core.exceptions import ValidationError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.common.permissions import IsPharmacyMember, PharmacyScopedViewMixin
from apps.pharmacy.models import (
    AvailabilityRequest,
    PharmacyDocument,
    PharmacyMembership,
)
from apps.pharmacy.serializers import (
    AvailabilityAnswerSerializer,
    InboxRequestSerializer,
    PharmacyDocumentSerializer,
    PharmacyDocumentUploadSerializer,
    PharmacyMemberCreateSerializer,
    PharmacyMemberSerializer,
    PharmacyPatchSerializer,
    PharmacySelfSerializer,
)
from apps.pharmacy.services import (
    add_pharmacy_member,
    answer_availability_request,
    archive_pharmacy_document,
    deactivate_pharmacy_member,
    pharmacy_inbox_qs,
    update_pharmacy,
    upload_pharmacy_document,
)


def pharmacy_document_file_response(document):
    """Stream une pièce à un appelant AUTORISÉ (contrat ADR 0016 §5).

    Les permissions ont déjà été rejouées par la vue. Nom neutre
    (``pharmacie-<id>.<ext>`` — le nom uuid du stockage ne fuit jamais),
    ``attachment``, ``nosniff`` ; au déploiement, ceci devient un
    ``X-Accel-Redirect`` vers une location interne sur PRIVATE_MEDIA_ROOT.
    """
    extension = PurePosixPath(document.file.name).suffix
    response = FileResponse(
        document.file.open("rb"),
        as_attachment=True,
        filename=f"pharmacie-{document.pk}{extension}",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


# ---------------------------------------------------------------------------
# La fiche de l'officine
# ---------------------------------------------------------------------------


class PharmacyProfileView(PharmacyScopedViewMixin, APIView):
    """GET/PATCH /pharmacy/{pharmacy_pk}/ — la fiche, par ses gens.

    Le PATCH ne touche jamais le statut : il appartient à la plateforme,
    exactement comme le KYC d'un centre appartient à Chioni et non à son
    directeur. ``status_reason`` est rendu en lecture — une officine
    suspendue doit lire ce qu'elle a à corriger.
    """

    permission_classes = [IsPharmacyMember]
    serializer_class = PharmacyPatchSerializer

    @extend_schema(responses=PharmacySelfSerializer)
    def get(self, request, pharmacy_pk):
        return Response(PharmacySelfSerializer(self.pharmacy).data)

    @extend_schema(request=PharmacyPatchSerializer, responses=PharmacySelfSerializer)
    def patch(self, request, pharmacy_pk):
        serializer = PharmacyPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pharmacy = update_pharmacy(
                actor=request.user,
                pharmacy=self.pharmacy,
                **serializer.validated_data,
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(PharmacySelfSerializer(pharmacy).data)


# ---------------------------------------------------------------------------
# La boîte de réception
# ---------------------------------------------------------------------------


class PharmacyInboxView(PharmacyScopedViewMixin, generics.ListAPIView):
    """GET /pharmacy/{pharmacy_pk}/requests/?status= — les demandes reçues.

    Le queryset part des LIGNES DE DIFFUSION adressées à cette officine :
    ce qui ne lui a pas été adressé n'existe pas pour elle, et aucune
    officine ne peut deviner l'activité d'une autre.
    """

    permission_classes = [IsPharmacyMember]
    serializer_class = InboxRequestSerializer

    def get_queryset(self):
        qs = pharmacy_inbox_qs(self.pharmacy)
        status_filter = (self.request.query_params.get("status") or "").strip()
        if status_filter:
            if status_filter not in AvailabilityRequest.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(request__status=status_filter)
        return qs


class _InboxItemMixin(PharmacyScopedViewMixin):
    def get_recipient(self):
        return get_object_or_404(pharmacy_inbox_qs(self.pharmacy), pk=self.kwargs["pk"])


class PharmacyInboxDetailView(_InboxItemMixin, APIView):
    """GET /pharmacy/{pharmacy_pk}/requests/{pk}/ — une demande reçue."""

    permission_classes = [IsPharmacyMember]
    serializer_class = InboxRequestSerializer

    @extend_schema(responses=InboxRequestSerializer)
    def get(self, request, pharmacy_pk, pk):
        return Response(InboxRequestSerializer(self.get_recipient()).data)


class PharmacyRespondView(_InboxItemMixin, APIView):
    """POST /pharmacy/{pharmacy_pk}/requests/{pk}/respond/ — « je l'ai / je ne
    l'ai pas », ligne par ligne.

    Répondre à nouveau est LÉGITIME et prévu : le stock bouge, et une
    officine se corrige par une nouvelle réponse (append-only). La dernière
    fait foi ; l'historique reste.

    Le service refuse une demande close, périmée, ou une officine non
    validée à cet instant — les trois relus en base sous verrou.
    """

    permission_classes = [IsPharmacyMember]
    serializer_class = AvailabilityAnswerSerializer

    @extend_schema(
        request=AvailabilityAnswerSerializer, responses=InboxRequestSerializer
    )
    def post(self, request, pharmacy_pk, pk):
        recipient = self.get_recipient()
        serializer = AvailabilityAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lines = {line["item"]: line["is_available"] for line in data["lines"]}
        if len(lines) != len(data["lines"]):
            raise DrfValidationError(
                {"lines": ["Un médicament ne peut pas apparaître deux fois."]}
            )
        try:
            answer_availability_request(
                actor=request.user,
                recipient=recipient,
                lines=lines,
                comment=data.get("comment", ""),
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(InboxRequestSerializer(self.get_recipient()).data)


# ---------------------------------------------------------------------------
# Les gens de l'officine
# ---------------------------------------------------------------------------


class PharmacyMemberListCreateView(PharmacyScopedViewMixin, generics.ListAPIView):
    """GET/POST /pharmacy/{pharmacy_pk}/members/ — les collègues.

    Sans rôle et sans hiérarchie (ADR 0022) : dans une officine d'une à
    trois personnes, tout membre actif peut en inscrire un autre. Le compte
    créé est un compte OMBRE réclamé par OTP — aucun mot de passe transmis.
    """

    permission_classes = [IsPharmacyMember]
    serializer_class = PharmacyMemberSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            PharmacyMembership.objects.filter(pharmacy=self.pharmacy)
            .select_related("user")
            .order_by("-is_active", "id")
        )

    @extend_schema(
        request=PharmacyMemberCreateSerializer,
        responses={201: PharmacyMemberSerializer},
    )
    def post(self, request, pharmacy_pk):
        serializer = PharmacyMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = add_pharmacy_member(
                actor=request.user,
                pharmacy=self.pharmacy,
                **serializer.validated_data,
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            PharmacyMemberSerializer(membership).data,
            status=http_status.HTTP_201_CREATED,
        )


class PharmacyMemberDeactivateView(PharmacyScopedViewMixin, APIView):
    """POST /pharmacy/{pharmacy_pk}/members/{pk}/deactivate/ — jamais la dernière.

    Une officine sans personne est une boîte de réception que plus personne
    ne relève : la garde « dernier membre actif » est le miroir exact de la
    garde « dernier directeur » d'un centre.
    """

    permission_classes = [IsPharmacyMember]

    @extend_schema(request=None, responses=PharmacyMemberSerializer)
    def post(self, request, pharmacy_pk, pk):
        membership = get_object_or_404(
            PharmacyMembership.objects.filter(pharmacy=self.pharmacy), pk=pk
        )
        try:
            membership = deactivate_pharmacy_member(
                actor=request.user, membership=membership
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(PharmacyMemberSerializer(membership).data)


# ---------------------------------------------------------------------------
# Les pièces justificatives
# ---------------------------------------------------------------------------


class PharmacyDocumentListCreateView(
    PharmacyScopedViewMixin, generics.ListAPIView
):
    """GET/POST /pharmacy/{pharmacy_pk}/documents/ — la licence, le registre.

    POST est multipart, passe par le pipeline durci ADR 0014 (JPEG/PNG/WebP
    par contenu réel — le PDF reste différé, arbitrage commun ADR 0016/0017)
    et porte le throttle STRICT ``uploads`` : chaque dépôt fait tourner le
    décodage Pillow. Le GET n'y est pas soumis — lire la liste ne doit
    jamais mourir de faim sur le budget d'upload.
    """

    permission_classes = [IsPharmacyMember]
    serializer_class = PharmacyDocumentSerializer
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "uploads"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return PharmacyDocument.objects.filter(pharmacy=self.pharmacy).order_by(
            "-created_at"
        )

    @extend_schema(
        request=PharmacyDocumentUploadSerializer,
        responses={201: PharmacyDocumentSerializer},
    )
    def post(self, request, pharmacy_pk):
        serializer = PharmacyDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            document = upload_pharmacy_document(
                actor=request.user,
                pharmacy=self.pharmacy,
                uploaded_file=serializer.validated_data["file"],
                doc_type=serializer.validated_data["doc_type"],
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            PharmacyDocumentSerializer(document).data,
            status=http_status.HTTP_201_CREATED,
        )


class _PharmacyDocumentMixin(PharmacyScopedViewMixin):
    def get_document(self):
        return get_object_or_404(
            PharmacyDocument.objects.filter(pharmacy=self.pharmacy),
            pk=self.kwargs["pk"],
        )


class PharmacyDocumentDownloadView(_PharmacyDocumentMixin, APIView):
    """GET /pharmacy/{pharmacy_pk}/documents/{pk}/download/ — les octets.

    Le stockage privé n'a pas d'URL : c'est le seul chemin de lecture,
    authentifié et rejouant les permissions de la liste.
    """

    permission_classes = [IsPharmacyMember]

    def get(self, request, pharmacy_pk, pk):
        return pharmacy_document_file_response(self.get_document())


class PharmacyDocumentArchiveView(_PharmacyDocumentMixin, APIView):
    """POST /pharmacy/{pharmacy_pk}/documents/{pk}/archive/ — corriger sans
    détruire (l'archivage est définitif)."""

    permission_classes = [IsPharmacyMember]

    @extend_schema(request=None, responses=PharmacyDocumentSerializer)
    def post(self, request, pharmacy_pk, pk):
        try:
            document = archive_pharmacy_document(
                actor=request.user, document=self.get_document()
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(PharmacyDocumentSerializer(document).data)
