"""Root URL configuration for the Chioni backend.

API routing is versioned: everything business-facing lives under
`/api/v1/` (see `config.api_v1`). Schema and docs are version-agnostic.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI schema and interactive docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # Versioned API
    path("api/v1/", include("config.api_v1")),
]

# Media (uploads) served by Django in DEBUG ONLY — static() is already a no-op
# when DEBUG=False; deployed environments front /media/ with the web server.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
