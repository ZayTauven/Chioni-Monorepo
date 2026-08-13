"""Patient & guardianship routes — mounted at the ROOT of `/api/v1/`.

Three URL families, one per audience:
- `centers/<center_pk>/patients/…` — staff (porte C)
- `patients/me/…`                  — the patient (porte B)
- `guardian/…`                     — a guardian (porte A)
"""

from django.urls import path

from apps.patients.views import (
    AcceptInvitationView,
    CenterPatientDetailView,
    CenterPatientListCreateView,
    CenterPatientMergeView,
    ClinicalConsentView,
    GuardianInvitationListView,
    GuardianRevokeLinkView,
    InviteGuardianView,
    MyGuardianLinksView,
    MyGuardianProfileView,
    MyPatientProfileView,
    PatientConfirmLinkView,
    PatientDeclineLinkView,
    PatientRevokeLinkView,
    ProtegeListCreateView,
)

app_name = "patients"

urlpatterns = [
    # Audience: staff of a center (porte C)
    path(
        "centers/<int:center_pk>/patients/",
        CenterPatientListCreateView.as_view(),
        name="center-patient-list",
    ),
    path(
        "centers/<int:center_pk>/patients/merge/",
        CenterPatientMergeView.as_view(),
        name="center-patient-merge",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/",
        CenterPatientDetailView.as_view(),
        name="center-patient-detail",
    ),
    # Audience: the patient (porte B)
    path("patients/me/", MyPatientProfileView.as_view(), name="my-profile"),
    path(
        "patients/me/guardians/",
        MyGuardianLinksView.as_view(),
        name="my-guardian-links",
    ),
    path(
        "patients/me/guardians/invite/",
        InviteGuardianView.as_view(),
        name="invite-guardian",
    ),
    path(
        "patients/me/guardians/<int:link_pk>/revoke/",
        PatientRevokeLinkView.as_view(),
        name="patient-revoke-link",
    ),
    path(
        "patients/me/guardians/<int:link_pk>/confirm/",
        PatientConfirmLinkView.as_view(),
        name="patient-confirm-link",
    ),
    path(
        "patients/me/guardians/<int:link_pk>/decline/",
        PatientDeclineLinkView.as_view(),
        name="patient-decline-link",
    ),
    path(
        "patients/me/guardians/<int:link_pk>/consents/clinical/",
        ClinicalConsentView.as_view(),
        name="clinical-consent",
    ),
    # Audience: a guardian (porte A)
    path("guardian/profile/", MyGuardianProfileView.as_view(), name="guardian-profile"),
    path("guardian/proteges/", ProtegeListCreateView.as_view(), name="protege-list"),
    path(
        "guardian/invitations/",
        GuardianInvitationListView.as_view(),
        name="guardian-invitations",
    ),
    path(
        "guardian/invitations/<int:link_pk>/accept/",
        AcceptInvitationView.as_view(),
        name="accept-invitation",
    ),
    path(
        "guardian/links/<int:link_pk>/revoke/",
        GuardianRevokeLinkView.as_view(),
        name="guardian-revoke-link",
    ),
]
