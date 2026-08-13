"""Center routes — mounted under `/api/v1/centers/`."""

from django.urls import path

from apps.centers.views import (
    CenterDetailView,
    CenterListView,
    StaffDeactivateView,
    StaffListCreateView,
    TariffDetailView,
    TariffListCreateView,
)

app_name = "centers"

urlpatterns = [
    path("", CenterListView.as_view(), name="center-list"),
    path("<int:pk>/", CenterDetailView.as_view(), name="center-detail"),
    path("<int:center_pk>/staff/", StaffListCreateView.as_view(), name="staff-list"),
    path(
        "<int:center_pk>/staff/<int:pk>/deactivate/",
        StaffDeactivateView.as_view(),
        name="staff-deactivate",
    ),
    path("<int:center_pk>/tariffs/", TariffListCreateView.as_view(), name="tariff-list"),
    path(
        "<int:center_pk>/tariffs/<int:pk>/",
        TariffDetailView.as_view(),
        name="tariff-detail",
    ),
]
