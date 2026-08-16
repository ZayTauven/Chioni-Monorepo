"""Equipment views — one section per AUDIENCE (ADR 0008 / ADR 0021).

STAFF of the center, et personne d'autre :

- **lecture du parc et des signalements** : TOUT membre actif. Savoir si
  l'échographe marche est un besoin de service, pas un privilège ;
- **écriture du parc** (déclarer, corriger, changer l'état, réformer) : le
  **DIRECTEUR**. « Tout staff signale, le directeur décide » (arbitrage PO
  n° 2, même esprit que le module Support où la secrétaire ouvre le
  ticket) ;
- **signalement d'une panne** : TOUT membre actif — c'est l'infirmière qui
  constate.

PATIENT, TUTEUR, EXPLOITANT PLATEFORME : **rien**. Aucune route de ce
module ne vit sous ``/guardian/``, ``/patients/me/`` ni ``/platform/``, et
la sonde structurelle de ``tests/test_adversarial_s3.py``, étendue par S8,
refuse qu'il en apparaisse une.

Sémantique des refus (norme S1) : anonyme → 401 ; centre où l'appelant n'a
aucun membership → 404 (``CenterScopedViewMixin``) ; un équipement d'un
AUTRE centre atteint par mon URL → 404 (cloisonnement au queryset, réponse
IDOR déterministe) ; une valeur invalide qui voyage dans le CORPS ou dans
la query → **400 explicite par champ**.

**Aucune de ces vues n'est gelable** (ADR 0021 décision 4) : le module
n'importe pas la garde d'abonnement, et un centre suspendu déclare,
corrige, réforme et signale exactement comme les autres.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.centers.models import StaffMembership
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsStaffOfCenter,
    active_membership_qs,
)
from apps.equipment.models import Equipment
from apps.equipment.serializers import (
    EquipmentPatchSerializer,
    EquipmentReportDirectorSerializer,
    EquipmentReportSerializer,
    EquipmentReportWriteSerializer,
    EquipmentSerializer,
    EquipmentStatusSerializer,
    EquipmentWriteSerializer,
)
from apps.equipment.services import (
    create_equipment,
    equipments_queryset,
    report_equipment_issue,
    reports_queryset,
    set_equipment_status,
    update_equipment,
)

DIRECTOR = StaffMembership.Role.DIRECTOR


def is_director(request, center) -> bool:
    """L'appelant porte-t-il la casquette de directeur DANS ce centre ?

    Sert uniquement à choisir le sérialiseur des signalements (le nom de
    l'auteur, voir ``serializers.py``) — jamais à autoriser : les
    permissions restent déclarées par ``IsStaffOfCenter(DIRECTOR)``.
    """
    return active_membership_qs(
        request.user, center=center, roles=(DIRECTOR,)
    ).exists()


class _EquipmentScopedMixin(CenterScopedViewMixin):
    """Le queryset du parc, scellé sur le centre de l'URL.

    Un équipement d'un autre centre est structurellement indiscernable d'un
    équipement inexistant : 404 dans les deux cas.
    """

    def get_equipment(self):
        return generics.get_object_or_404(
            equipments_queryset(self.center), pk=self.kwargs["pk"]
        )


class CenterEquipmentListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/equipment/?status=&category=.

    GET : tout membre actif (le parc est l'outil de tout le monde).
    POST : le DIRECTEUR — l'inventaire est de la configuration
    d'établissement, même famille qu'un tarif ou une chambre.

    Non paginé, comme les chambres et les services RH : le parc d'un centre
    tient à l'écran et le frontend en a besoin entier pour son tableau.
    """

    pagination_class = None

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EquipmentWriteSerializer
        return EquipmentSerializer

    def get_queryset(self):
        qs = equipments_queryset(self.center)
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in Equipment.Status.values:
                raise DrfValidationError({"status": ["État inconnu."]})
            qs = qs.filter(status=status_filter)
        category = (params.get("category") or "").strip()
        if category:
            if category not in Equipment.Category.values:
                raise DrfValidationError({"category": ["Catégorie inconnue."]})
            qs = qs.filter(category=category)
        return qs

    @extend_schema(
        request=EquipmentWriteSerializer, responses={201: EquipmentSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = EquipmentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        equipment = create_equipment(
            actor=request.user, center=self.center, **serializer.validated_data
        )
        return Response(
            EquipmentSerializer(equipment).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterEquipmentDetailView(_EquipmentScopedMixin, APIView):
    """GET/PATCH /centers/{center_pk}/equipment/{pk}/.

    GET : tout membre actif. PATCH : le DIRECTEUR, et **jamais l'état** —
    il passe par ``…/status/``, seule porte de la machine à états.
    """

    serializer_class = EquipmentPatchSerializer

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsStaffOfCenter(DIRECTOR)()]
        return [IsStaffOfCenter()()]

    @extend_schema(responses=EquipmentSerializer)
    def get(self, request, center_pk, pk):
        return Response(EquipmentSerializer(self.get_equipment()).data)

    @extend_schema(request=EquipmentPatchSerializer, responses=EquipmentSerializer)
    def patch(self, request, center_pk, pk):
        equipment = self.get_equipment()
        serializer = EquipmentPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        equipment = update_equipment(
            actor=request.user, equipment=equipment, **serializer.validated_data
        )
        return Response(EquipmentSerializer(equipment).data)


class CenterEquipmentStatusView(_EquipmentScopedMixin, APIView):
    """POST /centers/{center_pk}/equipment/{pk}/status/ `{status}` — DIRECTEUR.

    « Tout staff signale, le directeur décide » : c'est ici que le geste de
    décision vit, et il est sérialisé sur la ligne. ``reforme`` est
    terminal — le rejouer, ou en revenir, répond 400.
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = EquipmentStatusSerializer

    @extend_schema(request=EquipmentStatusSerializer, responses=EquipmentSerializer)
    def post(self, request, center_pk, pk):
        equipment = self.get_equipment()
        serializer = EquipmentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        equipment = set_equipment_status(
            actor=request.user,
            equipment=equipment,
            status=serializer.validated_data["status"],
        )
        return Response(EquipmentSerializer(equipment).data)


class CenterEquipmentReportListCreateView(
    _EquipmentScopedMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/equipment/{pk}/reports/ — TOUT staff actif.

    C'est LE geste que rien ne ferme : ni le rôle (l'infirmière constate),
    ni le gel commercial (décision 4).

    Le payload de lecture dépend d'une seule chose, et c'est l'arbitrage du
    sprint : **le directeur voit qui a signalé, les autres non** (voir le
    docstring de ``serializers.py``). Un signalement ne changeant pas
    l'état de l'appareil, l'équipe n'a besoin que du constat lui-même.
    """

    def get_permissions(self):
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EquipmentReportWriteSerializer
        # ``kwargs`` est vide pendant la génération du schéma OpenAPI : on
        # rend alors la forme PUBLIQUE, qui est le sous-ensemble — le schéma
        # ne promet jamais plus que ce que la casquette la moins dotée reçoit.
        if self.kwargs.get(self.center_url_kwarg) and is_director(
            self.request, self.center
        ):
            return EquipmentReportDirectorSerializer
        return EquipmentReportSerializer

    def get_queryset(self):
        return reports_queryset(self.get_equipment()).select_related(
            "reported_by"
        )

    @extend_schema(
        request=EquipmentReportWriteSerializer,
        responses={201: EquipmentReportSerializer},
    )
    def create(self, request, *args, **kwargs):
        equipment = self.get_equipment()
        serializer = EquipmentReportWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = report_equipment_issue(
            actor=request.user,
            equipment=equipment,
            description=serializer.validated_data["description"],
        )
        payload_class = (
            EquipmentReportDirectorSerializer
            if is_director(request, self.center)
            else EquipmentReportSerializer
        )
        return Response(
            payload_class(report).data, status=http_status.HTTP_201_CREATED
        )
