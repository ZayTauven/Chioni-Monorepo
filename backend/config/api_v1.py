"""URL routes for API version 1 (`/api/v1/`).

Every business app will plug its own `urls` module here, e.g.:
    path("centers/", include("apps.centers.urls")),
"""

from django.urls import path

from config.views import HealthCheckView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health"),
]
