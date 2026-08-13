"""PSP abstraction — Stripe first, provider interchangeable (needs study §4.5).

``get_psp()`` returns the active backend from ``settings.PSP_BACKEND``:
``fake`` (dev/tests, no network) or ``stripe`` (dedicated chantier — the
skeleton exists so the real integration is a drop-in).
"""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import BasePsp, PspError, WebhookEvent
from .fake import FakePsp
from .stripe import StripePsp

_BACKENDS = {
    "fake": FakePsp,
    "stripe": StripePsp,
}


def get_psp() -> BasePsp:
    backend = getattr(settings, "PSP_BACKEND", "fake")
    try:
        return _BACKENDS[backend]()
    except KeyError:
        raise ImproperlyConfigured(
            f"PSP_BACKEND inconnu : «{backend}» (attendu : {', '.join(_BACKENDS)})."
        )


__all__ = ["BasePsp", "FakePsp", "StripePsp", "PspError", "WebhookEvent", "get_psp"]
