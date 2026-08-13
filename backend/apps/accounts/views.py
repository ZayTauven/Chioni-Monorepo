"""Auth endpoints (stopgap JWT — phone+OTP is a dedicated upcoming chantier).

- `/auth/token/` and `/auth/token/refresh/` come from SimpleJWT (settings
  enforce rotation + blacklist — F4).
- `/auth/logout/` blacklists the presented refresh token.
- `/auth/me/` returns identity + hats, consumed by the frontend router.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.serializers import LogoutSerializer, MeSerializer
from apps.common.permissions import claimed_patient_profile, guardian_profile
from apps.common.permissions import active_membership_qs


class LogoutView(APIView):
    """Blacklist the refresh token — the pair dies with the session."""

    @extend_schema(request=LogoutSerializer, responses={205: None})
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            return Response(
                {"detail": "Jeton de rafraîchissement invalide ou déjà expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """Identity + hats of the current user (routes the three spaces)."""

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        user = request.user
        payload = {
            "id": user.pk,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "staff_memberships": active_membership_qs(user).select_related("center"),
            "patient_profile": claimed_patient_profile(user),
            "guardian_profile": guardian_profile(user),
        }
        return Response(MeSerializer(payload).data)
