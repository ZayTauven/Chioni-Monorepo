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
    # S5 (ADR 0018) — abonnement SaaS : offres et contrats des tenants.
    path("platform/", include("apps.billing.platform_urls")),
    # S5 lot 3 — module Support (file des tickets) et gestion de l'équipe
    # Chioni elle-même (la 4ᵉ casquette se gère par API auditée depuis que
    # l'admin Django est refermé).
    path("platform/", include("apps.support.platform_urls")),
    path("", include("apps.patients.urls")),
    path("", include("apps.medical.urls")),
    path("", include("apps.scheduling.urls")),
    # S6 (ADR 0019) — `centers/{c}/inpatient/…` (staff) et
    # `patients/me/stays/` (le patient). Aucune route `/guardian/`.
    path("", include("apps.inpatient.urls")),
    # S7 (ADR 0020) — `centers/{c}/hrm/…` SEULEMENT : le dossier RH d'une
    # personne existe DANS un centre, jamais au-dessus (invariant 1).
    # Aucune route `guardian/`, `patients/me/` ni `platform/`.
    path("", include("apps.hrm.urls")),
    path("", include("apps.trustbridge.urls")),
    # S5 — `centers/{c}/subscription/` (directeur seul) : l'app porte
    # l'objet, l'URL dit quelle casquette le lit.
    path("", include("apps.billing.urls")),
    # S5 lot 3 — `centers/{c}/support/tickets/` (tout staff actif).
    path("", include("apps.support.urls")),
]
