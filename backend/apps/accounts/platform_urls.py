"""Back-office RGPD routes — mounted under `/api/v1/platform/` (S4 lot 3).

Third module on that prefix (tenant/KYC in ``centers``, PSP reconciliation
in ``trustbridge``, erasure here), exactly as the lot 1 addendum planned:
Django resolves several includes on one prefix without conflict, and the
structural guard-rail (``tests/test_permissions_platform.py``) walks the
whole tree — every route below MUST declare ``IsPlatformStaff``.
"""

from django.urls import path

from apps.accounts.platform_views import (
    PlatformErasureRequestListView,
    PlatformErasureRequestProcessView,
)

app_name = "platform-accounts"

urlpatterns = [
    path(
        "erasure-requests/",
        PlatformErasureRequestListView.as_view(),
        name="erasure-request-list",
    ),
    path(
        "erasure-requests/<int:pk>/process/",
        PlatformErasureRequestProcessView.as_view(),
        name="erasure-request-process",
    ),
]
