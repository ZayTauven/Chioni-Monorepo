"""Medical routes — mounted at the ROOT of `/api/v1/`.

Two URL families: `centers/<center_pk>/encounters/…` (staff of the
producing center) and `patients/me/…` (the patient's transversal carnet).
NO guardian route in phase A.
"""

from django.urls import path

from apps.medical.views import (
    CenterEncounterCloseView,
    CenterEncounterDetailView,
    CenterEncounterListCreateView,
    CenterPatientDocumentArchiveView,
    CenterPatientDocumentDownloadView,
    CenterPatientDocumentListCreateView,
    CenterPatientMedicalFileView,
    CenterPrescriptionDeliverView,
    CenterPrescriptionListView,
    EncounterPrescriptionView,
    EncounterRecordEntryView,
    EncounterVitalSignsView,
    MyDocumentDownloadView,
    MyDocumentsView,
    MyEncountersView,
    MyMedicalFileView,
    MyPrescriptionsView,
    MyRecordEntriesView,
    MyVitalSignsView,
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
        "centers/<int:center_pk>/encounters/<int:pk>/close/",
        CenterEncounterCloseView.as_view(),
        name="center-encounter-close",
    ),
    path(
        "centers/<int:center_pk>/encounters/<int:encounter_pk>/prescriptions/",
        EncounterPrescriptionView.as_view(),
        name="encounter-prescriptions",
    ),
    # S9 (ADR 0022 décision 6) — le poste de travail du pharmacien : la
    # LISTE que l'audit C.1 réclamait, et la délivrance qui pose enfin
    # `Status.DELIVERED`.
    path(
        "centers/<int:center_pk>/prescriptions/",
        CenterPrescriptionListView.as_view(),
        name="center-prescriptions",
    ),
    path(
        "centers/<int:center_pk>/prescriptions/<int:pk>/deliver/",
        CenterPrescriptionDeliverView.as_view(),
        name="center-prescription-deliver",
    ),
    path(
        "centers/<int:center_pk>/encounters/<int:encounter_pk>/record-entries/",
        EncounterRecordEntryView.as_view(),
        name="encounter-record-entries",
    ),
    # S3 (ADR 0016) — vital signs, medical file, carnet documents
    path(
        "centers/<int:center_pk>/encounters/<int:encounter_pk>/vital-signs/",
        EncounterVitalSignsView.as_view(),
        name="encounter-vital-signs",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/medical-file/",
        CenterPatientMedicalFileView.as_view(),
        name="center-patient-medical-file",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/documents/",
        CenterPatientDocumentListCreateView.as_view(),
        name="center-patient-documents",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/documents/<int:document_pk>/download/",
        CenterPatientDocumentDownloadView.as_view(),
        name="center-patient-document-download",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/documents/<int:document_pk>/archive/",
        CenterPatientDocumentArchiveView.as_view(),
        name="center-patient-document-archive",
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
    path(
        "patients/me/medical-file/",
        MyMedicalFileView.as_view(),
        name="my-medical-file",
    ),
    path(
        "patients/me/vital-signs/",
        MyVitalSignsView.as_view(),
        name="my-vital-signs",
    ),
    path("patients/me/documents/", MyDocumentsView.as_view(), name="my-documents"),
    path(
        "patients/me/documents/<int:pk>/download/",
        MyDocumentDownloadView.as_view(),
        name="my-document-download",
    ),
]
