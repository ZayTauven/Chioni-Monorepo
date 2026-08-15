"""HRM routes — mounted at the ROOT of `/api/v1/` (patron S6).

**Une seule famille d'URL : celle du TENANT** (`centers/<center_pk>/hrm/…`),
et c'est la traduction directe de la décision 1 : le dossier RH d'une
personne existe DANS un centre, jamais au-dessus. Une fenêtre transversale
`/staff/me/hr/` aurait recréé exactement ce que l'invariant n° 1 interdit —
une lecture de données RH qui traverse les tenants pour un même humain.

**Aucune route `guardian/`, aucune route `patients/me/`, aucune route
`platform/`, et il n'y en aura pas** : un salarié n'est pas un objet du
Pont de Confiance, et l'exploitant Chioni ne voit aucune donnée personnelle
d'un tenant (ADR 0017, invariant du sprint S4). La sonde structurelle de
``tests/test_adversarial_s3.py``, étendue par S7, parcourt ces urlpatterns
et refuse toute route `guardian/` portant un marqueur RH — l'interdit est
explicite plutôt qu'accidentel.

Le sous-préfixe `hrm/me/` est la fenêtre de LA PERSONNE sur ses propres
données : il est déclaré AVANT les routes à paramètre pour rester lisible,
et ses vues scellent leur queryset sur ``for_user(request.user)``.
"""

from django.urls import path

from apps.hrm.views import (
    CenterAttendanceListCreateView,
    CenterAttendanceStatsView,
    CenterDepartmentDetailView,
    CenterDepartmentListCreateView,
    CenterEmploymentDetailView,
    CenterEmploymentListCreateView,
    CenterHolidayDetailView,
    CenterHolidayListCreateView,
    CenterJobTitleDetailView,
    CenterJobTitleListCreateView,
    CenterLeaveApproveView,
    CenterLeaveDetailView,
    CenterLeaveDocumentDownloadView,
    CenterLeaveDocumentListView,
    CenterLeaveListView,
    CenterLeaveRefuseView,
    CenterScheduleView,
    MyAttendanceView,
    MyEmploymentView,
    MyLeaveCancelView,
    MyLeaveDocumentArchiveView,
    MyLeaveDocumentDownloadView,
    MyLeaveDocumentListCreateView,
    MyLeaveListCreateView,
)

app_name = "hrm"

urlpatterns = [
    # --- Configuration : lecture tout staff, écriture directeur
    path(
        "centers/<int:center_pk>/hrm/departments/",
        CenterDepartmentListCreateView.as_view(),
        name="center-departments",
    ),
    path(
        "centers/<int:center_pk>/hrm/departments/<int:pk>/",
        CenterDepartmentDetailView.as_view(),
        name="center-department-detail",
    ),
    path(
        "centers/<int:center_pk>/hrm/job-titles/",
        CenterJobTitleListCreateView.as_view(),
        name="center-job-titles",
    ),
    path(
        "centers/<int:center_pk>/hrm/job-titles/<int:pk>/",
        CenterJobTitleDetailView.as_view(),
        name="center-job-title-detail",
    ),
    path(
        "centers/<int:center_pk>/hrm/holidays/",
        CenterHolidayListCreateView.as_view(),
        name="center-holidays",
    ),
    path(
        "centers/<int:center_pk>/hrm/holidays/<int:pk>/",
        CenterHolidayDetailView.as_view(),
        name="center-holiday-detail",
    ),
    # --- Le planning collectif : TOUT membre actif (invariant n° 3)
    path(
        "centers/<int:center_pk>/hrm/schedule/",
        CenterScheduleView.as_view(),
        name="center-schedule",
    ),
    # --- La fenêtre de LA PERSONNE sur ses propres données (jamais gelée)
    path(
        "centers/<int:center_pk>/hrm/me/",
        MyEmploymentView.as_view(),
        name="my-employment",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/attendance/",
        MyAttendanceView.as_view(),
        name="my-attendance",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/leaves/",
        MyLeaveListCreateView.as_view(),
        name="my-leaves",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/leaves/<int:pk>/cancel/",
        MyLeaveCancelView.as_view(),
        name="my-leave-cancel",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/leaves/<int:pk>/documents/",
        MyLeaveDocumentListCreateView.as_view(),
        name="my-leave-documents",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/leaves/<int:pk>/documents/"
        "<int:doc_pk>/download/",
        MyLeaveDocumentDownloadView.as_view(),
        name="my-leave-document-download",
    ),
    path(
        "centers/<int:center_pk>/hrm/me/leaves/<int:pk>/documents/"
        "<int:doc_pk>/archive/",
        MyLeaveDocumentArchiveView.as_view(),
        name="my-leave-document-archive",
    ),
    # --- Le DIRECTEUR : dossiers, feuille de présence, congés, statistiques
    path(
        "centers/<int:center_pk>/hrm/employments/",
        CenterEmploymentListCreateView.as_view(),
        name="center-employments",
    ),
    path(
        "centers/<int:center_pk>/hrm/employments/<int:pk>/",
        CenterEmploymentDetailView.as_view(),
        name="center-employment-detail",
    ),
    path(
        "centers/<int:center_pk>/hrm/attendance/",
        CenterAttendanceListCreateView.as_view(),
        name="center-attendance",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/",
        CenterLeaveListView.as_view(),
        name="center-leaves",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/<int:pk>/",
        CenterLeaveDetailView.as_view(),
        name="center-leave-detail",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/<int:pk>/approve/",
        CenterLeaveApproveView.as_view(),
        name="center-leave-approve",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/<int:pk>/refuse/",
        CenterLeaveRefuseView.as_view(),
        name="center-leave-refuse",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/<int:pk>/documents/",
        CenterLeaveDocumentListView.as_view(),
        name="center-leave-documents",
    ),
    path(
        "centers/<int:center_pk>/hrm/leaves/<int:pk>/documents/"
        "<int:doc_pk>/download/",
        CenterLeaveDocumentDownloadView.as_view(),
        name="center-leave-document-download",
    ),
    path(
        "centers/<int:center_pk>/hrm/stats/attendance/",
        CenterAttendanceStatsView.as_view(),
        name="center-attendance-stats",
    ),
]
