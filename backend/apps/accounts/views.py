"""Auth endpoints.

- `/auth/otp/request/` + `/auth/otp/verify/` — THE login path for patients
  and guardians: phone + OTP SMS (ADR 0010), strict anti-enumeration and
  multilayer throttling.
- `/auth/token/` and `/auth/token/refresh/` — username+password JWT, kept
  for staff/back-office (SimpleJWT settings enforce rotation + blacklist — F4).
- `/auth/logout/` blacklists the presented refresh token.
- `/auth/me/` returns identity + hats, consumed by the frontend router.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.serializers import (
    LogoutSerializer,
    MeSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
)
from apps.accounts.services import request_otp, verify_otp
from apps.accounts.throttling import (
    OtpRequestPerIpThrottle,
    OtpRequestPerPhoneThrottle,
    OtpVerifyPerIpThrottle,
)
from apps.common.permissions import claimed_patient_profile, guardian_profile
from apps.common.permissions import active_membership_qs

#: The ONE response body of `/auth/otp/request/` — byte-identical whether
#: the phone matches an account, a shadow account or nothing (ADR 0010).
OTP_REQUEST_RESPONSE = {
    "detail": (
        "Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé."
    )
}


def me_payload(user):
    """Identity + hats aggregate serialised by ``MeSerializer`` (`/auth/me/`
    and the OTP verify response share this exact contract)."""
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "staff_memberships": active_membership_qs(user).select_related("center"),
        "patient_profile": claimed_patient_profile(user),
        "guardian_profile": guardian_profile(user),
    }


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """`/auth/token/` — R-API-4: anti brute-force scoped throttle.

    Rates live in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`` (env-tunable
    ``THROTTLE_AUTH_TOKEN``). The upcoming OTP endpoints (request/verify)
    MUST follow this exact pattern with their own, STRICTER scopes — an
    SMS-sending endpoint without a throttle is both a cost hole and a
    harassment vector.
    """

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_token"


class ThrottledTokenRefreshView(TokenRefreshView):
    """`/auth/token/refresh/` — scoped throttle (blacklist probing)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"


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
        return Response(MeSerializer(me_payload(request.user)).data)


class OtpRequestView(APIView):
    """`POST /auth/otp/request/` — issue and send a login code by SMS.

    Anti-enumeration (ADR 0010): the 200 body is CONSTANT. A 400 happens
    for a malformed phone only — never because of what the phone matches.
    Two independent throttle layers (per target phone, per caller IP): the
    SMS costs money and can harass.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OtpRequestPerPhoneThrottle, OtpRequestPerIpThrottle]

    @extend_schema(request=OtpRequestSerializer, responses={200: None})
    def post(self, request):
        serializer = OtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_otp(phone=serializer.validated_data["phone"])
        return Response(OTP_REQUEST_RESPONSE, status=status.HTTP_200_OK)


class OtpVerifyView(APIView):
    """`POST /auth/otp/verify/` — trade a valid code for a JWT pair + `me`.

    Success resolves the account in ONE transactional service (login /
    shadow activation / door-B creation + strict auto-claim — ADR 0010).
    Every failure surfaces the same 400 « Code invalide ou expiré. » —
    no oracle distinguishing unknown phone / expired / consumed / wrong.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OtpVerifyPerIpThrottle]

    @extend_schema(request=OtpVerifySerializer, responses={200: None})
    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = verify_otp(
            phone=serializer.validated_data["phone"],
            code=serializer.validated_data["code"],
        )
        user = result["user"]
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "me": MeSerializer(me_payload(user)).data,
            },
            status=status.HTTP_200_OK,
        )
