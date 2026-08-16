"""Routes de l'export comptable — montées à la RACINE de `/api/v1/`.

**Une seule famille d'URL : celle du TENANT**
(`centers/<center_pk>/accounting/…`). Une pièce comptable appartient au
centre dont elle photographie la caisse.

**Aucune route `patients/me/`, `guardian/`, `platform/` ni `pharmacy/`, et
il n'y en aura pas.** L'exploitant Chioni a sa réconciliation PSP (S4), qui
est un autre objet ; il ne lit jamais les mouvements de caisse d'un tenant.
L'interdit est explicite plutôt qu'accidentel : la sonde structurelle de
``tests/test_adversarial_s3.py``, étendue par S10 (marqueurs
``accounting``, ``exports``), parcourt ces urlpatterns.
"""

from django.urls import path

from apps.accounting.views import (
    CenterAccountingExportDetailView,
    CenterAccountingExportDownloadView,
    CenterAccountingExportListCreateView,
)

app_name = "accounting"

urlpatterns = [
    path(
        "centers/<int:center_pk>/accounting/exports/",
        CenterAccountingExportListCreateView.as_view(),
        name="center-accounting-exports",
    ),
    path(
        "centers/<int:center_pk>/accounting/exports/<int:pk>/",
        CenterAccountingExportDetailView.as_view(),
        name="center-accounting-export-detail",
    ),
    path(
        "centers/<int:center_pk>/accounting/exports/<int:pk>/download/",
        CenterAccountingExportDownloadView.as_view(),
        name="center-accounting-export-download",
    ),
]
