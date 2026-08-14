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
    # S4 (ADR 0017) — back-office Chioni, 4ᵉ casquette. Chaque route de ce
    # préfixe DOIT déclarer IsPlatformStaff (garde-fou structurel testé).
    # Plusieurs modules se montent sur le MÊME préfixe (tenant/KYC dans
    # centers, réconciliation PSP dans trustbridge) : Django résout les
    # includes successifs sans conflit et le garde-fou les couvre tous.
    path("platform/", include("apps.centers.platform_urls")),
    path("platform/", include("apps.trustbridge.platform_urls")),
    path("platform/", include("apps.accounts.platform_urls")),
    path("", include("apps.patients.urls")),
    path("", include("apps.medical.urls")),
    path("", include("apps.scheduling.urls")),
    path("", include("apps.trustbridge.urls")),
]
