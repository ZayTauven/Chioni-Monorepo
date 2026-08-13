"""URL routes for API version 1 (`/api/v1/`).

Patient and medical apps mount at the root because their routes span
several audience prefixes (`centers/…`, `patients/me/…`, `guardian/…`).
Django resolves the most specific patterns first, so the families coexist.
"""

from django.urls import include, path

from config.views import HealthCheckView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health"),
    path("auth/", include("apps.accounts.urls")),
    path("centers/", include("apps.centers.urls")),
    path("", include("apps.patients.urls")),
    path("", include("apps.medical.urls")),
    path("", include("apps.trustbridge.urls")),
]
