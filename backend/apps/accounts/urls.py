"""Auth routes — mounted under `/api/v1/auth/`."""

from django.urls import path

from apps.accounts.views import (
    LogoutView,
    MeView,
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)

app_name = "accounts"

urlpatterns = [
    path("token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path(
        "token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"
    ),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]
