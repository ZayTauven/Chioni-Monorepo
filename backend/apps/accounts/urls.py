"""Auth routes — mounted under `/api/v1/auth/`."""

from django.urls import path

from apps.accounts.views import (
    LogoutView,
    MeAvatarView,
    MeView,
    OtpRequestView,
    OtpVerifyView,
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)

app_name = "accounts"

urlpatterns = [
    path("otp/request/", OtpRequestView.as_view(), name="otp_request"),
    path("otp/verify/", OtpVerifyView.as_view(), name="otp_verify"),
    path("token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path(
        "token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"
    ),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/avatar/", MeAvatarView.as_view(), name="me_avatar"),
]
