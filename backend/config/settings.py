"""
Django settings for the Chioni backend.

Environment-driven via django-environ: secrets and machine-specific values
live in `backend/.env` (see `.env.example`), never in this file.
"""

from datetime import timedelta
from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / "subdir".
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

SECRET_KEY = env("SECRET_KEY")

DEBUG = env("DEBUG")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    # F4 — refresh tokens are single-use: rotation + blacklist of the old one.
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    # Chioni apps
    "apps.accounts",
    "apps.centers",
    "apps.patients",
    "apps.medical",
    "apps.trustbridge",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # CORS must run before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database — PostgreSQL only (no SQLite fallback, even in dev)
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT", default="5432"),
    }
}

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

# Custom user: phone will become the pivot identifier (OTP verification to come).
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# ---------------------------------------------------------------------------
# Internationalization — French first, Comoros timezone
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "fr"

TIME_ZONE = "Indian/Comoro"

USE_I18N = True

USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    # Deny by default: every endpoint must opt out explicitly (AllowAny).
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Domain services raise Django ValidationError — translate to HTTP 400.
    "EXCEPTION_HANDLER": "apps.common.exceptions.exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    # F4 (revue guardian) — a rotated refresh token must die: without the
    # blacklist, every refresh handed out a NEW 7-day token while the old one
    # stayed valid, making refresh tokens effectively eternal.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Chioni API",
    "DESCRIPTION": (
        "API du SaaS Chioni — gestion des centres de santé aux Comores "
        "et Pont de Confiance (paiement des soins par la diaspora)."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Dev convenience; restrict before any non-local deployment.
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
}

# ---------------------------------------------------------------------------
# CORS — frontend dev server only
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000"],
)

# ---------------------------------------------------------------------------
# Pont de Confiance — PSP abstraction & EUR→KMF conversion (étude §4.5)
# ---------------------------------------------------------------------------

# Active PSP backend: "fake" (dev/tests, no network) or "stripe" (dedicated
# chantier — skeleton only until API keys exist).
PSP_BACKEND = env("PSP_BACKEND", default="fake")

# Shared secret signing FakePSP webhooks (HMAC-SHA256 over the raw body).
# Dev-only value; each deployed environment sets its own.
PSP_WEBHOOK_SECRET = env("PSP_WEBHOOK_SECRET", default="fake-psp-webhook-secret-dev")

# EUR→KMF rate served by the dev FixedRateSource — the KMF is pegged to the
# euro. Frozen per PaymentIntent at creation; shown to the guardian BEFORE
# payment (transparent conversion, decision actée).
FX_EUR_KMF_RATE = env("FX_EUR_KMF_RATE", default="491.9678")

# Explicit fees (percent of the net EUR amount), paid ON TOP by the guardian:
# the center always receives the full invoice amount in KMF.
PSP_FEE_PERCENT = env("PSP_FEE_PERCENT", default="2.50")

# ---------------------------------------------------------------------------
# Celery (Redis broker)
# ---------------------------------------------------------------------------

CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
