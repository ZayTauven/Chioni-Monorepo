"""Project-level API views (infrastructure endpoints, not business logic)."""

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Public liveness probe — no authentication, no database access."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        operation_id="health_check",
        responses={200: {"type": "object", "properties": {
            "status": {"type": "string"},
            "service": {"type": "string"},
        }}},
    )
    def get(self, request):
        return Response({"status": "ok", "service": "chioni-backend"})
