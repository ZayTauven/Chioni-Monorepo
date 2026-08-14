"""Back-office money routes — mounted under `/api/v1/platform/` (S4 lot 2).

Second module on that prefix, exactly as the lot 1 addendum planned
(ADR 0017): Django resolves several includes on one prefix without
conflict, and the structural guard-rail
(``tests/test_permissions_platform.py``) walks the whole tree, so this
route is covered automatically — it MUST declare ``IsPlatformStaff``.
"""

from django.urls import path

from apps.trustbridge.platform_views import PlatformReconciliationView

app_name = "platform-trustbridge"

urlpatterns = [
    path(
        "reconciliation/",
        PlatformReconciliationView.as_view(),
        name="reconciliation",
    ),
]
