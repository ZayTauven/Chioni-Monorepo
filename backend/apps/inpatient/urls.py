"""Hospitalisation routes — mounted at the ROOT of `/api/v1/`.

Two URL families, like every module of the project: the tenant's
(`centers/<center_pk>/inpatient/…`) and the patient's transversal window
(`patients/me/stays/`).

**No `guardian/` route, and there never will be one in this sprint**: the
clinical guardian window stays conditioned to SV.1.1 (ADR 0016, décision
cadre n° 1). The structural probe of ``tests/test_adversarial_s3.py``
walks these urlpatterns and refuses any `guardian/` route carrying a
`stays` / `beds` / `rooms` / `inpatient` marker — the interdiction is
explicit rather than accidental.
"""

from django.urls import path

from apps.inpatient.views import (
    CenterBedListView,
    CenterOccupancyView,
    CenterRoomBedListCreateView,
    CenterRoomListCreateView,
    CenterStayAttendingView,
    CenterStayBedAssignmentListView,
    CenterStayBedView,
    CenterStayBillDaysView,
    CenterStayCancelView,
    CenterStayDetailView,
    CenterStayDischargeView,
    CenterStayListCreateView,
    MyStaysView,
)

app_name = "inpatient"

urlpatterns = [
    # Audience: staff of the center — configuration
    path(
        "centers/<int:center_pk>/inpatient/rooms/",
        CenterRoomListCreateView.as_view(),
        name="center-rooms",
    ),
    path(
        "centers/<int:center_pk>/inpatient/rooms/<int:room_pk>/beds/",
        CenterRoomBedListCreateView.as_view(),
        name="center-room-beds",
    ),
    path(
        "centers/<int:center_pk>/inpatient/beds/",
        CenterBedListView.as_view(),
        name="center-beds",
    ),
    path(
        "centers/<int:center_pk>/inpatient/occupancy/",
        CenterOccupancyView.as_view(),
        name="center-occupancy",
    ),
    # Audience: staff of the center — stays
    path(
        "centers/<int:center_pk>/inpatient/stays/",
        CenterStayListCreateView.as_view(),
        name="center-stays",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/",
        CenterStayDetailView.as_view(),
        name="center-stay-detail",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/bed/",
        CenterStayBedView.as_view(),
        name="center-stay-bed",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/bed-assignments/",
        CenterStayBedAssignmentListView.as_view(),
        name="center-stay-bed-assignments",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/attending/",
        CenterStayAttendingView.as_view(),
        name="center-stay-attending",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/discharge/",
        CenterStayDischargeView.as_view(),
        name="center-stay-discharge",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/cancel/",
        CenterStayCancelView.as_view(),
        name="center-stay-cancel",
    ),
    path(
        "centers/<int:center_pk>/inpatient/stays/<int:pk>/bill-days/",
        CenterStayBillDaysView.as_view(),
        name="center-stay-bill-days",
    ),
    # Audience: the patient (transversal record)
    path("patients/me/stays/", MyStaysView.as_view(), name="my-stays"),
]
