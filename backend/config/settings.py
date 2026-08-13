"""
Django settings for the Chioni backend.

Environment-driven via django-environ: secrets and machine-specific values
live in `backend/.env` (see `.env.example`), never in this file.
"""

from datetime import timedelta
from pathlib import Path

import environ
from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured

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
    "apps.scheduling",
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

# ---------------------------------------------------------------------------
# Media — user uploads (center logos, profile avatars)
# ---------------------------------------------------------------------------

# Every uploaded file goes through apps/common/uploads.py (hardened pipeline:
# real-format whitelist, Pillow verification, re-encode stripping metadata,
# uuid filenames). Django serves MEDIA_URL itself ONLY in DEBUG (config/urls.py);
# deployed environments must front it with the web server / object storage.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

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
    # R-API-4 — scoped throttles for credential-bearing endpoints.
    # OTP scopes (ADR 0010) are STRICT and multilayered: an SMS endpoint is
    # both a cost hole and a harassment vector, so the request endpoint is
    # capped per TARGET PHONE and per CALLER IP independently.
    "DEFAULT_THROTTLE_RATES": {
        "auth_token": env("THROTTLE_AUTH_TOKEN", default="10/min"),
        "auth_refresh": env("THROTTLE_AUTH_REFRESH", default="30/min"),
        "otp_request_phone": env("THROTTLE_OTP_REQUEST_PHONE", default="3/hour"),
        "otp_request_ip": env("THROTTLE_OTP_REQUEST_IP", default="10/hour"),
        "otp_verify_ip": env("THROTTLE_OTP_VERIFY_IP", default="10/hour"),
        # Guardian invitation (SMS to a caller-typed phone) — same posture
        # as the OTP request: per caller AND per target phone. Door C (desk)
        # is not throttled (staff of a KYC-verified center, traced).
        "invite_guardian_user": env(
            "THROTTLE_INVITE_GUARDIAN_USER", default="5/day"
        ),
        "invite_guardian_phone": env(
            "THROTTLE_INVITE_GUARDIAN_PHONE", default="3/day"
        ),
    },
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

# R-API-3 — boot guard: the FakePSP simulates money movements; letting it
# run with DEBUG=False would let a deployed instance "collect" payments
# that never happened. Fail fast, at import time, like a missing SECRET_KEY.
if PSP_BACKEND == "fake" and not DEBUG:
    raise ImproperlyConfigured(
        "PSP_BACKEND=\"fake\" est interdit hors développement (DEBUG=False) : "
        "configurez un PSP réel (ex. \"stripe\") dans l'environnement."
    )

# Shared secret signing PSP webhooks (HMAC-SHA256 over the raw body).
# R-API-3 — REQUIRED from the environment, like SECRET_KEY: no default,
# and an empty value is refused (a guessable secret = forgeable payments).
PSP_WEBHOOK_SECRET = env("PSP_WEBHOOK_SECRET")
if not PSP_WEBHOOK_SECRET:
    raise ImproperlyConfigured(
        "PSP_WEBHOOK_SECRET est requis (non vide) dans l'environnement — "
        "il signe les webhooks de paiement."
    )

# EUR→KMF rate served by the dev FixedRateSource — the KMF is pegged to the
# euro. Frozen per PaymentIntent at creation; shown to the guardian BEFORE
# payment (transparent conversion, decision actée).
FX_EUR_KMF_RATE = env("FX_EUR_KMF_RATE", default="491.9678")

# Explicit fees (percent of the net EUR amount), paid ON TOP by the guardian:
# the center always receives the full invoice amount in KMF.
PSP_FEE_PERCENT = env("PSP_FEE_PERCENT", default="2.50")

# Anti-double-débit (revue guardian du frontend, 2026-08-13) : tant qu'un
# PaymentIntent cree/en_cours plus récent que cette fenêtre existe pour une
# demande, aucun nouvel intent ne peut être créé sur la même demande (un
# 3DS qui traîne ne doit pas permettre deux débits). Au-delà de la fenêtre,
# l'intent en cours est considéré abandonné et ne bloque plus — sinon un
# 3DS jamais terminé rendrait la demande impayable pour toujours.
PSP_INTENT_GUARD_MINUTES = env.int("PSP_INTENT_GUARD_MINUTES", default=15)
# Boot guard (same philosophy as PSP_BACKEND/SMS_BACKEND): a value < 1 would
# silently disable the double-debit guard — refuse to boot instead.
if PSP_INTENT_GUARD_MINUTES < 1:
    raise ImproperlyConfigured(
        "PSP_INTENT_GUARD_MINUTES doit être >= 1 : une valeur nulle ou "
        "négative désactiverait silencieusement la garde anti-double-débit."
    )

# Purge des intents zombies (ADR 0009 addendum, point 3) : un intent
# cree/en_cours plus vieux que cette fenêtre est réputé abandonné (3DS jamais
# terminé, onglet fermé) et passe à « annule » par la tâche Celery
# `trustbridge.cancel_stale_intents` (apps/trustbridge/tasks.py, planifiée
# dans CELERY_BEAT_SCHEDULE). Fenêtre bien plus large que la garde ci-dessus :
# la garde rend la demande re-payable au bout de quelques minutes, la purge
# solde l'enregistrement au bout de quelques heures.
PSP_INTENT_STALE_HOURS = env.int("PSP_INTENT_STALE_HOURS", default=24)
# Boot guard (même philosophie que PSP_INTENT_GUARD_MINUTES) : une valeur
# nulle ou négative annulerait des intentions de paiement encore actives.
if PSP_INTENT_STALE_HOURS < 1:
    raise ImproperlyConfigured(
        "PSP_INTENT_STALE_HOURS doit être >= 1 : une valeur nulle ou négative "
        "ferait annuler par la purge des intentions de paiement encore actives."
    )

# ---------------------------------------------------------------------------
# SMS — OTP login + notifications (ADR 0010, needs study §5.4)
# ---------------------------------------------------------------------------

# Active SMS backend: "console"/"memory" (dev/tests, nothing leaves the
# machine) or "stub" (skeleton for the Comorian aggregators — dedicated
# chantier, boots but refuses to send).
SMS_BACKEND = env("SMS_BACKEND", default="console")

# Boot guard, same posture as the PSP one above: a deployed instance with a
# non-sending SMS backend would silently strand every OTP login (patients
# and guardians locked out) while pretending to work. Fail fast at import.
if SMS_BACKEND in {"console", "memory"} and not DEBUG:
    raise ImproperlyConfigured(
        f"SMS_BACKEND=\"{SMS_BACKEND}\" est interdit hors développement "
        "(DEBUG=False) : configurez un fournisseur SMS réel (ex. \"stub\" en "
        "attendant l'agrégateur comorien)."
    )

# ---------------------------------------------------------------------------
# Celery (Redis broker)
# ---------------------------------------------------------------------------

CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True

# Dev/tests execute tasks inline (no broker needed); deployed environments
# override via env to run through real workers.
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=DEBUG)
CELERY_TASK_EAGER_PROPAGATES = CELERY_TASK_ALWAYS_EAGER

# Beat schedule — periodic hygiene tasks. Tasks are referenced BY NAME
# (plain strings): settings must never import application code.

# Grace before physically deleting dead OtpCode rows (expired or consumed).
# Dead rows carry the phone in clear (RGPD minimisation wants them gone),
# but an immediate purge would also erase the attempt counters and timing
# needed to investigate a reported abuse — 24 h keeps that window open
# without letting the table grow (ADR 0010).
OTP_PURGE_GRACE_HOURS = env.int("OTP_PURGE_GRACE_HOURS", default=24)
# Boot guard (same philosophy as PSP_INTENT_GUARD_MINUTES above): 0 would
# silently remove the investigation window, and a NEGATIVE value would put
# the purge cutoff in the future — deleting codes that are still valid.
if OTP_PURGE_GRACE_HOURS < 1:
    raise ImproperlyConfigured(
        "OTP_PURGE_GRACE_HOURS doit être >= 1 : une valeur nulle supprimerait "
        "la fenêtre d'investigation des abus, une valeur négative purgerait "
        "des codes OTP encore valides."
    )

CELERY_BEAT_SCHEDULE = {
    # RGPD hygiene: drop dead OtpCode rows past the investigation grace
    # (accounts/tasks.py — utility table, outside the append-only socle).
    "purge-expired-otp-codes": {
        "task": "accounts.purge_expired_otp_codes",
        "schedule": timedelta(hours=1),
    },
    # Zombie PaymentIntents cleanup (apps/trustbridge/tasks.py — ADR 0009
    # addendum): abandoned cree/en_cours intents past the guard window.
    "cancel-stale-payment-intents": {
        "task": "trustbridge.cancel_stale_intents",
        "schedule": timedelta(hours=1),
    },
    # J-1 appointment reminders (apps/scheduling/tasks.py — ADR 0013):
    # daily at 18:00 COMOROS time (crontab is evaluated in CELERY_TIMEZONE,
    # which follows TIME_ZONE = Indian/Comoro). SMS content per ADR 0012:
    # never the reason, the practitioner, nor the center name.
    "send-appointment-reminders": {
        "task": "scheduling.send_appointment_reminders",
        "schedule": crontab(hour=18, minute=0),
    },
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

# Without this block the "chioni.*" loggers propagate to a handler-less root
# logger and Python only surfaces WARNING+: the console SMS backend's DEBUG
# line carrying the OTP code (apps/common/sms.py) never showed anywhere, so
# OTP login was impossible in dev. DEBUG level is what makes the code visible
# in the runserver terminal — and only there (console/memory backends are
# refused at boot when DEBUG=False; INFO+ lines never contain a body).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "[{asctime}] {name} {levelname} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "loggers": {
        "chioni": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
        },
    },
}
