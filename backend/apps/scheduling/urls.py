"""Scheduling routes — mounted at the ROOT of `/api/v1/`.

Two URL families, one per audience:
- `centers/<center_pk>/appointments/…` — staff of the center (the day
  queue is `GET ?date=…` — no separate endpoint) ;
- `patients/me/appointments/…` — the patient about their own
  appointments (S2 : lecture transversale + annulation d'un `prevu`).
"""

from django.urls import path

from apps.scheduling.views import (
    AppointmentCancelView,
    AppointmentCheckInView,
    AppointmentHonorView,
    AppointmentNoShowView,
    CenterAppointmentDetailView,
    CenterAppointmentListCreateView,
    MyAppointmentCancelView,
    MyAppointmentListView,
)

app_name = "scheduling"

urlpatterns = [
    # Audience: the patient (S2)
    path(
        "patients/me/appointments/",
        MyAppointmentListView.as_view(),
        name="my-appointments",
    ),
    path(
        "patients/me/appointments/<int:pk>/cancel/",
        MyAppointmentCancelView.as_view(),
        name="my-appointment-cancel",
    ),
    # Audience: staff of a center
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
