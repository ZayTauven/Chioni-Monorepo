"""Vues côté CENTRE et côté PATIENT du réseau (S9, ADR 0022).

Deux audiences ici, et une troisième explicitement absente :

- **le CENTRE** — l'annuaire est lisible par tout membre actif (savoir
  quelles officines existent n'est pas une information clinique) ; **lancer
  et lire une recherche** est réservé aux rôles qui voient déjà
  l'ordonnance (``PRESCRIPTION_ROLES`` : cliniques + pharmacien —
  R-API-1). Une secrétaire ne diffuse pas une liste de médicaments ;
- **le PATIENT** — sa propre ordonnance, en lecture seule. Il consulte, il
  ne lance pas (arbitrage PO n° 3) ;
- **le TUTEUR — rien.** Ni demande, ni réponse, ni annuaire. La
  disponibilité d'un traitement est une information clinique, et le verrou
  de S3 tient tel quel : aucune route de ce module ne vit sous
  ``/guardian/``, et la sonde de routes le vérifie de front.

Sémantique des refus (norme S1) : anonyme → 401 ; centre sans membership →
404 (``CenterScopedViewMixin``) ; ordonnance d'un autre centre → 404
(cloisonnement au queryset) ; valeur invalide dans le CORPS → 400 explicite
par champ.

**Aucune de ces vues n'est gelable** (ADR 0022 décision 7) ni conditionnée
au KYC : chercher un médicament pour un patient est un geste de soin.
"""

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.common.geo import Island
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsPatientSelf,
    IsStaffOfCenter,
    claimed_patient_profile,
)
from apps.common.roles import PRESCRIPTION_ROLES
from apps.medical.models import Prescription
from apps.pharmacy.models import AvailabilityRequest
from apps.pharmacy.serializers import (
    AvailabilityRequestCenterDetailSerializer,
    AvailabilityRequestCenterSerializer,
    AvailabilityRequestCreateSerializer,
    AvailabilityRequestPatientSerializer,
    PharmacyDirectorySerializer,
)
from apps.pharmacy.services import (
    center_requests_qs,
    close_availability_request,
    create_availability_request,
    pharmacy_directory_qs,
    prescription_requests_qs,
)


# ---------------------------------------------------------------------------
# Audience : STAFF du centre
# ---------------------------------------------------------------------------


class CenterPharmacyDirectoryView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/pharmacies/?island=&city=&q= — TOUT staff actif.

    L'annuaire des officines VALIDÉES. C'est aussi l'écran qui répond à la
    question « combien de pharmacies vont recevoir ma demande ? » avant
    l'envoi : la diffusion doit être **annoncée** (ADR 0022), et elle l'est
    en montrant la liste réelle plutôt qu'un compteur abstrait.

    Non paginé, comme les chambres, l'annuaire des praticiens et le parc :
    le réseau d'une île tient à l'écran.
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PharmacyDirectorySerializer
    pagination_class = None

    def get_queryset(self):
        params = self.request.query_params
        island = (params.get("island") or "").strip()
        if island and island not in Island.values:
            raise DrfValidationError({"island": ["Île inconnue."]})
        return pharmacy_directory_qs(
            island=island,
            city=(params.get("city") or "").strip(),
            query=(params.get("q") or "").strip(),
        )


class _CenterPrescriptionMixin(CenterScopedViewMixin):
    """L'ordonnance, scellée sur le centre de l'URL.

    Une ordonnance produite par un autre centre est structurellement
    indiscernable d'une ordonnance inexistante : 404 dans les deux cas.
    """

    def get_prescription(self):
        return get_object_or_404(
            Prescription.objects.filter(encounter__center=self.center),
            pk=self.kwargs["prescription_pk"],
        )


class PrescriptionAvailabilityRequestView(
    _CenterPrescriptionMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{c}/prescriptions/{prescription_pk}/availability-requests/

    POST : **le geste du sprint**. Le corps porte la zone et les LIGNES
    COCHÉES ; le service refuse tout le reste (ligne étrangère, ordonnance
    délivrée, zone vide de pharmacie, diffusion au-delà du plafond, doublon
    d'une recherche déjà ouverte).

    Throttle ``availability`` : c'est le seul geste du produit qui parle à
    des tiers en nombre — il mérite son propre budget, distinct de celui des
    lectures.
    """

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_ROLES)]
    pagination_class = None

    def get_throttles(self):
        # Le scope ne suffit PAS : ``DEFAULT_THROTTLE_CLASSES`` ne contient
        # que ``UserRateThrottle``, dont le scope est figé à « user » et qui
        # ignore ``throttle_scope``. Poser l'attribut sans monter le
        # ``ScopedRateThrottle`` laissait le budget « availability » (60/h)
        # entièrement INERTE, et la diffusion — le seul geste du produit qui
        # parle à des tiers en masse et déclenche N SMS — retombait sur le
        # plafond global généreux de 600/min (revue adversariale S9). Patron
        # des cinq autres modules du dépôt : on RETOURNE le throttle scopé.
        if self.request.method == "POST":
            self.throttle_scope = "availability"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AvailabilityRequestCreateSerializer
        return AvailabilityRequestCenterSerializer

    def get_queryset(self):
        return prescription_requests_qs(self.get_prescription())

    @extend_schema(
        request=AvailabilityRequestCreateSerializer,
        responses={201: AvailabilityRequestCenterSerializer},
    )
    def create(self, request, *args, **kwargs):
        prescription = self.get_prescription()
        serializer = AvailabilityRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            availability_request = create_availability_request(
                actor=request.user,
                center=self.center,
                prescription=prescription,
                island=data["island"],
                city=data.get("city", ""),
                item_ids=data["item_ids"],
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            AvailabilityRequestCenterSerializer(availability_request).data,
            status=http_status.HTTP_201_CREATED,
        )


class CenterAvailabilityRequestListView(
    CenterScopedViewMixin, generics.ListAPIView
):
    """GET /centers/{center_pk}/availability-requests/?status=&prescription=

    Le fil des recherches lancées par CE centre — de quoi voir d'un coup
    d'œil ce qui attend encore une réponse.
    """

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_ROLES)]
    serializer_class = AvailabilityRequestCenterSerializer

    def get_queryset(self):
        qs = center_requests_qs(self.center)
        params = self.request.query_params
        status_filter = (params.get("status") or "").strip()
        if status_filter:
            if status_filter not in AvailabilityRequest.Status.values:
                raise DrfValidationError({"status": ["Statut inconnu."]})
            qs = qs.filter(status=status_filter)
        prescription = (params.get("prescription") or "").strip()
        if prescription:
            if not prescription.isdigit():
                raise DrfValidationError(
                    {"prescription": ["Identifiant d'ordonnance invalide."]}
                )
            qs = qs.filter(prescription_id=int(prescription))
        return qs


class _CenterRequestMixin(CenterScopedViewMixin):
    def get_request_object(self):
        return get_object_or_404(center_requests_qs(self.center), pk=self.kwargs["pk"])


class CenterAvailabilityRequestDetailView(_CenterRequestMixin, APIView):
    """GET /centers/{center_pk}/availability-requests/{pk}/ — avec les réponses."""

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_ROLES)]
    serializer_class = AvailabilityRequestCenterDetailSerializer

    @extend_schema(responses=AvailabilityRequestCenterDetailSerializer)
    def get(self, request, center_pk, pk):
        return Response(
            AvailabilityRequestCenterDetailSerializer(
                self.get_request_object()
            ).data
        )


class CenterAvailabilityRequestCloseView(_CenterRequestMixin, APIView):
    """POST /centers/{center_pk}/availability-requests/{pk}/close/ — « on a trouvé ».

    Fermer est un geste ordinaire et sans motif : le centre a trouvé, ou n'a
    plus besoin. La péremption automatique fait la même chose 48 h plus
    tard, avec un code de raison distinct.
    """

    permission_classes = [IsStaffOfCenter(*PRESCRIPTION_ROLES)]

    @extend_schema(
        request=None, responses=AvailabilityRequestCenterDetailSerializer
    )
    def post(self, request, center_pk, pk):
        availability_request = self.get_request_object()
        try:
            close_availability_request(
                actor=request.user, request=availability_request
            )
        except ValidationError as error:
            raise DrfValidationError(error.messages)
        return Response(
            AvailabilityRequestCenterDetailSerializer(
                self.get_request_object()
            ).data
        )


# ---------------------------------------------------------------------------
# Audience : LE PATIENT (son carnet)
# ---------------------------------------------------------------------------


class MyPrescriptionAvailabilityView(generics.ListAPIView):
    """GET /patients/me/prescriptions/{prescription_pk}/availability/

    « Où trouver mes médicaments ? » — le bénéfice du sprint, rendu à la
    personne qui marche. Lecture seule : le patient consulte, le centre
    lance (arbitrage PO n° 3).

    Le payload est le sérialiseur PATIENT : le commentaire de l'officine n'y
    est pas, les compteurs de diffusion non plus. Une ordonnance qui n'est
    pas la sienne est un 404 (queryset ``for_patient``).
    """

    permission_classes = [IsPatientSelf]
    serializer_class = AvailabilityRequestPatientSerializer
    pagination_class = None

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        prescription = get_object_or_404(
            Prescription.objects.for_patient(profile),
            pk=self.kwargs["prescription_pk"],
        )
        return prescription_requests_qs(prescription)
