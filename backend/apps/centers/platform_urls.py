"""Back-office routes — mounted under `/api/v1/platform/` (S4, ADR 0017).

Every route here MUST declare ``IsPlatformStaff``: the structural test
``tests/test_permissions_platform.py`` walks this tree and fails on any
unguarded view — the same guard-rail that protects the ``/guardian/``
rail since S1.

Future S4 lots mount their own modules under the SAME prefix
(reconciliation in ``trustbridge``, erasure requests in ``accounts``):
Django resolves several includes on one prefix without conflict, and the
structural test covers them all automatically.
"""

from django.urls import path

from apps.centers.platform_views import (
    PlatformCenterDetailView,
    PlatformCenterDirectorCreateView,
    PlatformCenterKycView,
    PlatformCenterListCreateView,
    PlatformCenterSimilarView,
    PlatformKycDocumentDownloadView,
    PlatformKycDocumentListView,
)

app_name = "platform"

urlpatterns = [
    path("centers/", PlatformCenterListCreateView.as_view(), name="center-list"),
    # Before <int:pk>/ by intent (the int converter would not match anyway):
    # duplicate detection is informational, never blocking.
    path(
        "centers/similar/",
        PlatformCenterSimilarView.as_view(),
        name="center-similar",
    ),
    path("centers/<int:pk>/", PlatformCenterDetailView.as_view(), name="center-detail"),
    path(
        "centers/<int:pk>/directors/",
        PlatformCenterDirectorCreateView.as_view(),
        name="center-directors",
    ),
    path("centers/<int:pk>/kyc/", PlatformCenterKycView.as_view(), name="center-kyc"),
    path(
        "centers/<int:pk>/kyc-documents/",
        PlatformKycDocumentListView.as_view(),
        name="center-kyc-documents",
    ),
    path(
        "centers/<int:pk>/kyc-documents/<int:document_pk>/download/",
        PlatformKycDocumentDownloadView.as_view(),
        name="center-kyc-document-download",
    ),
]
