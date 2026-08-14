"""Center routes — mounted under `/api/v1/centers/`."""

from django.urls import path

from apps.centers.audit_views import CenterAuditLogView
from apps.centers.stats_views import (
    CenterActivityStatsView,
    CenterFinanceStatsView,
)
from apps.centers.views import (
    CenterDetailView,
    CenterKycDocumentArchiveView,
    CenterKycDocumentDownloadView,
    CenterKycDocumentListCreateView,
    CenterListView,
    CenterLogoView,
    CenterPractitionerListView,
    StaffDeactivateView,
    StaffDetailView,
    StaffListCreateView,
    StaffReactivateView,
    TariffDetailView,
    TariffListCreateView,
)

app_name = "centers"

urlpatterns = [
    path("", CenterListView.as_view(), name="center-list"),
    path("<int:pk>/", CenterDetailView.as_view(), name="center-detail"),
    path("<int:pk>/logo/", CenterLogoView.as_view(), name="center-logo"),
    # S4 (ADR 0017) — pièces justificatives du KYC : le DIRECTEUR dépose,
    # la plateforme lit (routes miroir sous /platform/). Stockage privé,
    # téléchargement authentifié seul.
    path(
        "<int:center_pk>/kyc-documents/",
        CenterKycDocumentListCreateView.as_view(),
        name="kyc-document-list",
    ),
    path(
        "<int:center_pk>/kyc-documents/<int:pk>/download/",
        CenterKycDocumentDownloadView.as_view(),
        name="kyc-document-download",
    ),
    path(
        "<int:center_pk>/kyc-documents/<int:pk>/archive/",
        CenterKycDocumentArchiveView.as_view(),
        name="kyc-document-archive",
    ),
    path("<int:center_pk>/staff/", StaffListCreateView.as_view(), name="staff-list"),
    path(
        "<int:center_pk>/staff/<int:pk>/",
        StaffDetailView.as_view(),
        name="staff-detail",
    ),
    path(
        "<int:center_pk>/staff/<int:pk>/deactivate/",
        StaffDeactivateView.as_view(),
        name="staff-deactivate",
    ),
    path(
        "<int:center_pk>/staff/<int:pk>/reactivate/",
        StaffReactivateView.as_view(),
        name="staff-reactivate",
    ),
    # S1 — annuaire praticiens (tout staff actif, non paginé).
    path(
        "<int:center_pk>/practitioners/",
        CenterPractitionerListView.as_view(),
        name="practitioner-list",
    ),
    # S4 (ADR 0017, décision 5) — journal d'audit du centre, DIRECTEUR SEUL,
    # liste blanche d'actions (jamais le clinique ni les consentements).
    path(
        "<int:center_pk>/audit-log/",
        CenterAuditLogView.as_view(),
        name="audit-log",
    ),
    # Pilotage (vague 2b) — lecture seule, agrégats SQL.
    path(
        "<int:center_pk>/stats/activity/",
        CenterActivityStatsView.as_view(),
        name="stats-activity",
    ),
    path(
        "<int:center_pk>/stats/finances/",
        CenterFinanceStatsView.as_view(),
        name="stats-finances",
    ),
    path("<int:center_pk>/tariffs/", TariffListCreateView.as_view(), name="tariff-list"),
    path(
        "<int:center_pk>/tariffs/<int:pk>/",
        TariffDetailView.as_view(),
        name="tariff-detail",
    ),
]
