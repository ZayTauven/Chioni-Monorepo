"""Patient & guardianship routes — mounted at the ROOT of `/api/v1/`.

Three URL families, one per audience:
- `centers/<center_pk>/patients/…` — staff (porte C)
- `patients/me/…`                  — the patient (porte B)
- `guardian/…`                     — a guardian (porte A)
"""

from django.urls import path

from apps.patients.views import (
    AcceptInvitationView,
    CenterPatientClinicalConsentView,
    CenterPatientDetailView,
    CenterPatientGuardianLinksView,
    CenterPatientInsuranceDetailView,
    CenterPatientInsuranceListCreateView,
    CenterPatientListCreateView,
    CenterPatientMergeView,
    CenterPatientSimilarView,
    ClinicalConsentView,
    DeclineInvitationView,
    GuardianInvitationListView,
    GuardianLinkListView,
    GuardianRevokeLinkView,
    InviteGuardianView,
    MyGuardianLinksView,
    MyGuardianProfileView,
    MyInsurancesView,
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
        "centers/<int:center_pk>/patients/similar/",
        CenterPatientSimilarView.as_view(),
        name="center-patient-similar",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/insurances/",
        CenterPatientInsuranceListCreateView.as_view(),
        name="center-patient-insurances",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/insurances/<int:insurance_pk>/",
        CenterPatientInsuranceDetailView.as_view(),
        name="center-patient-insurance-detail",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/",
        CenterPatientDetailView.as_view(),
        name="center-patient-detail",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/guardian-links/",
        CenterPatientGuardianLinksView.as_view(),
        name="center-patient-guardian-links",
    ),
    path(
        "centers/<int:center_pk>/patients/<int:pk>/consents/clinical/",
        CenterPatientClinicalConsentView.as_view(),
        name="center-patient-clinical-consent",
    ),
    # Audience: the patient (porte B)
    path("patients/me/", MyPatientProfileView.as_view(), name="my-profile"),
    path(
        "patients/me/insurances/",
        MyInsurancesView.as_view(),
        name="my-insurances",
    ),
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
        "guardian/invitations/<int:link_pk>/decline/",
        DeclineInvitationView.as_view(),
        name="decline-invitation",
    ),
    path(
        "guardian/links/",
        GuardianLinkListView.as_view(),
        name="guardian-link-list",
    ),
    path(
        "guardian/links/<int:link_pk>/revoke/",
        GuardianRevokeLinkView.as_view(),
        name="guardian-revoke-link",
    ),
]
