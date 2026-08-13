"""Scheduling routes — mounted at the ROOT of `/api/v1/`.

One URL family only: `centers/<center_pk>/appointments/…` (staff of the
center). The day queue is `GET ?date=…` — no separate endpoint.
"""

from django.urls import path

from apps.scheduling.views import (
    AppointmentCancelView,
    AppointmentCheckInView,
    AppointmentHonorView,
    AppointmentNoShowView,
    CenterAppointmentDetailView,
    CenterAppointmentListCreateView,
)

app_name = "scheduling"

urlpatterns = [
    path(
        "centers/<int:center_pk>/appointments/",
        CenterAppointmentListCreateView.as_view(),
        name="center-appointment-list",
    ),
    path(
        "centers/<int:center_pk>/appointments/<int:pk>/",
        CenterAppointmentDetailView.as_view(),
        name="center-appointment-detail",
    ),
    path(
        "centers/<int:center_pk>/appointments/<int:pk>/check-in/",
        AppointmentCheckInView.as_view(),
        name="center-appointment-check-in",
    ),
    path(
        "centers/<int:center_pk>/appointments/<int:pk>/cancel/",
        AppointmentCancelView.as_view(),
        name="center-appointment-cancel",
    ),
    path(
        "centers/<int:center_pk>/appointments/<int:pk>/no-show/",
        AppointmentNoShowView.as_view(),
        name="center-appointment-no-show",
    ),
    path(
        "centers/<int:center_pk>/appointments/<int:pk>/honor/",
        AppointmentHonorView.as_view(),
        name="center-appointment-honor",
    ),
]
