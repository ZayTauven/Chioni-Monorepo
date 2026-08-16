"""Vues de l'export comptable — une seule audience (ADR 0008 / ADR 0023).

**Rôles BILLING du centre, et personne d'autre.** C'est la caisse du
centre qui sort de l'application : même casquette que ``stats/finances``,
``cash-journal`` et ``invoices/unpaid/`` depuis S1. Un médecin n'a rien à y
faire, un patient et un tuteur encore moins, et l'exploitant Chioni ne voit
jamais les mouvements d'un tenant (invariant S4 — sa réconciliation PSP est
un autre objet, avec ses propres codes d'incident).

Sémantique des refus (norme S1) : anonyme → 401 ; centre où l'appelant n'a
aucun membership → 404 ; membre sans rôle BILLING → 403 ; export d'un AUTRE
centre atteint par mon URL → 404 (cloisonnement au queryset, réponse IDOR
déterministe) ; date invalide dans le CORPS → **400 explicite par champ**.

**Throttle** : scope dédié ``accounting_export`` sur la GÉNÉRATION seule
(agrégats + snapshot ; les lectures suivent le budget global). Et il est
**réellement branché** — ``get_throttles()`` retourne un
``ScopedRateThrottle``. La leçon est celle de la faille élevée n° 2 de S9 :
un ``throttle_scope`` posé sans cela est **inerte**, et le garde-fou du
geste le plus coûteux du sprint retombe en silence sur le budget générique.
Une sonde le vérifie pour toutes les vues du produit, pas seulement ici.

**Rien n'est gelé, rien n'est gardé par le KYC** : l'export est la donnée
du centre, et l'ADR 0018 interdit déjà la prise d'otage des données.
"""

from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounting.serializers import (
    AccountingExportCreateSerializer,
    AccountingExportDetailSerializer,
    AccountingExportSerializer,
    PreviousExportSerializer,
)
from apps.accounting.services import (
    export_csv_bytes,
    export_filename,
    exports_queryset,
    generate_accounting_export,
    previous_export_covering,
)
from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter
from apps.common.roles import BILLING_ROLES


class _AccountingScopedMixin(CenterScopedViewMixin):
    """Le queryset des pièces, scellé sur le centre de l'URL.

    Un export d'un autre centre est structurellement indiscernable d'un
    export inexistant : 404 dans les deux cas.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    def get_export(self):
        return get_object_or_404(exports_queryset(self.center), pk=self.kwargs["pk"])


class CenterAccountingExportListCreateView(
    _AccountingScopedMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{center_pk}/accounting/exports/.

    GET : les pièces déjà émises, la plus récente d'abord (en-têtes seuls
    — le snapshot se lit sur le détail).

    POST ``{period_start, period_end}`` : émet une pièce. La réponse porte
    ``previous_export`` — l'annonce, non bloquante, d'un export antérieur
    recouvrant la même période (arbitrage PO n° 3 : rien ne se ferme, mais
    l'application le DIT, sans quoi un comptable saisirait deux fois les
    mêmes mouvements sans le savoir).
    """

    serializer_class = AccountingExportSerializer

    def get_throttles(self):
        """La génération a son propre budget ; les lectures gardent le
        budget global. Le ``throttle_scope`` est posé ICI, à côté du
        ``ScopedRateThrottle`` qui le lit — les deux ne se séparent jamais
        (leçon S9)."""
        if self.request.method == "POST":
            self.throttle_scope = "accounting_export"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return exports_queryset(self.center).order_by("-sequence_number", "-id")

    @extend_schema(
        request=AccountingExportCreateSerializer,
        responses={201: AccountingExportDetailSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = AccountingExportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        period_start = serializer.validated_data["period_start"]
        period_end = serializer.validated_data["period_end"]
        # Lu AVANT l'émission : sinon la pièce qu'on vient de créer se
        # signalerait elle-même comme « précédente ».
        previous = previous_export_covering(self.center, period_start, period_end)
        export = generate_accounting_export(
            actor=request.user,
            center=self.center,
            period_start=period_start,
            period_end=period_end,
        )
        payload = AccountingExportDetailSerializer(export).data
        payload["previous_export"] = (
            PreviousExportSerializer(previous).data if previous is not None else None
        )
        return Response(payload, status=http_status.HTTP_201_CREATED)


class CenterAccountingExportDetailView(_AccountingScopedMixin, APIView):
    """GET /centers/{center_pk}/accounting/exports/{pk}/ — la pièce entière.

    Le snapshot est rendu **tel qu'il a été figé**. Rien n'est recalculé :
    c'est ce qui fait qu'une pièce dit aujourd'hui ce qu'elle disait le
    jour de sa signature, même si la caisse a bougé depuis.
    """

    serializer_class = AccountingExportDetailSerializer

    @extend_schema(responses=AccountingExportDetailSerializer)
    def get(self, request, center_pk, pk):
        return Response(AccountingExportDetailSerializer(self.get_export()).data)


class CenterAccountingExportDownloadView(_AccountingScopedMixin, APIView):
    """GET .../exports/{pk}/download/ — le CSV de la pièce.

    Contrat de la réponse (patron ``PatientDocument`` de S3) :

    - ``Content-Disposition: attachment`` avec un nom NEUTRE
      (``export-E-000004-2026-08-01-2026-08-31.csv``) — jamais le nom du
      centre, jamais celui d'un patient dans un en-tête ;
    - ``X-Content-Type-Options: nosniff`` — le navigateur ne doit jamais
      requalifier le type déclaré ;
    - le contenu vient du **snapshot stocké**, jamais d'un recalcul.

    ``CORS_EXPOSE_HEADERS`` porte déjà ``Content-Disposition`` depuis S3 :
    le frontend peut lire le nom de fichier proposé.
    """

    def get(self, request, center_pk, pk):
        export = self.get_export()
        response = HttpResponse(
            export_csv_bytes(export), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{export_filename(export)}"'
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response
