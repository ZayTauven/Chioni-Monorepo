"""Center routes — mounted under `/api/v1/centers/`."""

from django.urls import path

from apps.centers.stats_views import (
    CenterActivityStatsView,
    CenterFinanceStatsView,
)
from apps.centers.views import (
    CenterDetailView,
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
