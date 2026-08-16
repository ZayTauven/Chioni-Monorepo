"""Routes back-office du réseau — sous `/api/v1/platform/` (S9, ADR 0022).

Même contrat que les autres modules montés sur ce préfixe (centres,
réconciliation, RGPD, abonnement, support) : toute vue déclare
``IsPlatformStaff``, et la sonde ``tests/test_permissions_platform.py``
couvre celles-ci automatiquement.
"""

from django.urls import path

from apps.pharmacy.platform_views import (
    PlatformPharmacyDetailView,
    PlatformPharmacyDocumentDownloadView,
    PlatformPharmacyDocumentListView,
    PlatformPharmacyListCreateView,
    PlatformPharmacyMemberCreateView,
    PlatformPharmacySimilarView,
    PlatformPharmacyStatusView,
)

app_name = "platform-pharmacy"

urlpatterns = [
    path(
        "pharmacies/",
        PlatformPharmacyListCreateView.as_view(),
        name="pharmacy-list",
    ),
    # Avant <int:pk>/ par intention (le convertisseur int ne matcherait pas
    # de toute façon) : la détection de doublons est informative, jamais
    # bloquante.
    path(
        "pharmacies/similar/",
        PlatformPharmacySimilarView.as_view(),
        name="pharmacy-similar",
    ),
    path(
        "pharmacies/<int:pk>/",
        PlatformPharmacyDetailView.as_view(),
        name="pharmacy-detail",
    ),
    path(
        "pharmacies/<int:pk>/status/",
        PlatformPharmacyStatusView.as_view(),
        name="pharmacy-status",
    ),
    path(
        "pharmacies/<int:pk>/members/",
        PlatformPharmacyMemberCreateView.as_view(),
        name="pharmacy-members",
    ),
    path(
        "pharmacies/<int:pk>/documents/",
        PlatformPharmacyDocumentListView.as_view(),
        name="pharmacy-documents",
    ),
    path(
        "pharmacies/<int:pk>/documents/<int:document_pk>/download/",
        PlatformPharmacyDocumentDownloadView.as_view(),
        name="pharmacy-document-download",
    ),
]
