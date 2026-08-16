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
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.export import build_user_export
from apps.accounts.models import ErasureRequest
from apps.accounts.serializers import (
    AvatarUploadSerializer,
    ErasureRequestSerializer,
    LogoutSerializer,
    MeSerializer,
    MeUpdateSerializer,
    OtpRequestSerializer,
    OtpVerifySerializer,
)
from apps.accounts.services import (
    remove_user_avatar,
    request_erasure,
    request_otp,
    set_user_avatar,
    update_own_identity,
    verify_otp,
)
from apps.accounts.throttling import (
    OtpRequestPerIpThrottle,
    OtpRequestPerPhoneThrottle,
    OtpVerifyPerIpThrottle,
)
from apps.common.permissions import claimed_patient_profile, guardian_profile
from apps.common.permissions import (
    active_membership_qs,
    pharmacy_memberships_qs,
    platform_staff,
)
from apps.common.uploads import media_url

#: The ONE response body of `/auth/otp/request/` — byte-identical whether
#: the phone matches an account, a shadow account or nothing (ADR 0010).
OTP_REQUEST_RESPONSE = {
    "detail": (
        "Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé."
    )
}


def me_payload(user, request=None):
    """Identity + hats aggregate serialised by ``MeSerializer`` (`/auth/me/`
    and the OTP verify response share this exact contract). ``request``
    makes ``avatar`` (and nested center ``logo``, via serializer context)
    an ABSOLUTE URL — pass it whenever one is available.

    S4 (ADR 0017): ``platform_staff`` is the FOURTH hat — it unlocks the
    Chioni back-office space. It is derived from the dedicated model, NOT
    from ``is_staff``/``is_superuser``: a Django admin account is not an
    operator (and never was meant to be one).

    S9 (ADR 0022): ``pharmacy_memberships`` is the FIFTH — it unlocks the
    pharmacy space. Same discipline: a dedicated model, never a
    ``StaffMembership``, which is what keeps a pharmacy account structurally
    unable to reach any center route."""
    return {
        "id": user.pk,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar": media_url(request, user.avatar),
        "staff_memberships": active_membership_qs(user).select_related("center"),
        "patient_profile": claimed_patient_profile(user),
        "guardian_profile": guardian_profile(user),
        "platform_staff": platform_staff(user),
        # S9 (ADR 0022) — la CINQUIÈME casquette, et la première portée par
        # un acteur HORS tenant. Une LISTE et non un objet : une même
        # personne peut tenir deux officines (rare, mais réel), et le
        # serveur ne doit jamais trancher « laquelle ? » en silence.
        "pharmacy_memberships": pharmacy_memberships_qs(user).select_related(
            "pharmacy"
        ),
    }


def me_response(user, request):
    """The one `me` shape (context carried so nested URLs are absolute)."""
    return MeSerializer(
        me_payload(user, request), context={"request": request}
    ).data


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
    """Identity + hats of the current user (routes the three spaces).

    PATCH edits the display name ONLY (any authenticated hat) — the phone
    is the identity pivot and stays untouchable here.
    """

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(me_response(request.user, request))

    @extend_schema(request=MeUpdateSerializer, responses=MeSerializer)
    def patch(self, request):
        serializer = MeUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update_own_identity(user=request.user, **serializer.validated_data)
        return Response(me_response(request.user, request))


class MeAvatarView(APIView):
    """`POST|DELETE /auth/me/avatar/` — the user's OWN profile photo.

    Any authenticated user (staff, patient, guardian — the avatar belongs
    to the account, not to a hat). Upload goes through the hardened
    pipeline; replacement and removal leave no orphan file behind.
    Strict ``uploads`` throttle scope (S1, shared with the center logo):
    every upload runs the Pillow pipeline — CPU, vigilance vague 1.
    """

    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "uploads"

    @extend_schema(request=AvatarUploadSerializer, responses={200: None})
    def post(self, request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_user_avatar(user=request.user, uploaded_file=serializer.validated_data["file"])
        return Response({"avatar": media_url(request, request.user.avatar)})

    @extend_schema(responses={200: None})
    def delete(self, request):
        remove_user_avatar(user=request.user)
        return Response({"avatar": None})


class MeErasureRequestView(APIView):
    """`GET|POST /auth/me/erasure-request/` — my right to erasure (art. 17).

    Open to EVERY authenticated hat: a patient, a guardian, a staff member
    of a center, a Chioni operator. The row references the account, never
    a casquette.

    **Deliberately not a delete button** (arbitrage PO n° 3): the request
    is deposited here and EXECUTED by the Chioni back-office. A compte
    finançant des soins ne doit pas disparaître en un clic — ni sous la
    pression d'un tiers ayant accès au téléphone de la personne.

    GET answers the LATEST request (whatever its state, so a refusal and
    its motive stay readable), or 404 when the person never asked — the
    same contract as `GET /guardian/profile/`.
    """

    @extend_schema(responses=ErasureRequestSerializer)
    def get(self, request):
        erasure_request = (
            ErasureRequest.objects.filter(user=request.user)
            .order_by("-requested_at", "-id")
            .first()
        )
        if erasure_request is None:
            raise NotFound("Vous n'avez déposé aucune demande d'effacement.")
        return Response(ErasureRequestSerializer(erasure_request).data)

    @extend_schema(request=None, responses={201: ErasureRequestSerializer})
    def post(self, request):
        erasure_request = request_erasure(user=request.user)
        return Response(
            ErasureRequestSerializer(erasure_request).data,
            status=status.HTTP_201_CREATED,
        )


class MeExportView(APIView):
    """`GET /auth/me/export/` — portability of my own data (art. 20).

    JSON of what the caller ALREADY sees in their space, hat by hat — the
    export re-plays the exact querysets and serializers of the screens and
    reveals nothing new (see ``apps.accounts.export``). A guardian does
    NOT get their protégé's carnet here; a patient does not get the other
    party's dispute motive.

    Dedicated throttle scope (patron of ``uploads``): one call fans out
    across a dozen querysets — generous enough for a human exercising a
    right, tight enough that it never becomes a scraping surface.
    """

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "data_export"

    @extend_schema(responses={200: None})
    def get(self, request):
        return Response(build_user_export(user=request.user, request=request))


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
                "me": me_response(user, request),
            },
            status=status.HTTP_200_OK,
        )
