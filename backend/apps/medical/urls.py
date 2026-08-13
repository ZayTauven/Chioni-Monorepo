"""Medical routes — mounted at the ROOT of `/api/v1/`.

Two URL families: `centers/<center_pk>/encounters/…` (staff of the
producing center) and `patients/me/…` (the patient's transversal carnet).
NO guardian route in phase A.
"""

from django.urls import path

from apps.medical.views import (
    CenterEncounterDetailView,
    CenterEncounterListCreateView,
    EncounterPrescriptionView,
    EncounterRecordEntryView,
    MyEncountersView,
    MyPrescriptionsView,
    MyRecordEntriesView,
)

app_name = "medical"

urlpatterns = [
    # Audience: staff of the producing center
    path(
        "centers/<int:center_pk>/encounters/",
        CenterEncounterListCreateView.as_view(),
        name="center-encounter-list",
    ),
    path(
        "centers/<int:center_pk>/encounters/<int:pk>/",
        CenterEncounterDetailView.as_view(),
        name="center-encounter-detail",
    ),
    path(
        "centers/<int:center_pk>/encounters/<int:encounter_pk>/prescriptions/",
        EncounterPrescriptionView.as_view(),
        name="encounter-prescriptions",
    ),
    path(
        "centers/<int:center_pk>/encounters/<int:encounter_pk>/record-entries/",
        EncounterRecordEntryView.as_view(),
        name="encounter-record-entries",
    ),
    # Audience: the patient (transversal carnet)
    path("patients/me/encounters/", MyEncountersView.as_view(), name="my-encounters"),
    path(
        "patients/me/prescriptions/",
        MyPrescriptionsView.as_view(),
        name="my-prescriptions",
    ),
    path(
        "patients/me/record-entries/",
        MyRecordEntriesView.as_view(),
        name="my-record-entries",
    ),
]
