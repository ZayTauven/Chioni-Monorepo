"""SMS abstraction — mirror of the PSP pattern (``apps/trustbridge/psp``).

The SMS is the primary channel in the Comoros (needs study §5.4): OTP
login today, notifications tomorrow. The provider is interchangeable
behind :class:`BaseSmsBackend`; selection comes from ``settings.SMS_BACKEND``
(env ``SMS_BACKEND``), with the SAME boot guard as the PSP: the non-sending
dev backends (``console``, ``memory``) are refused when ``DEBUG=False``
(see ``config/settings.py`` — ImproperlyConfigured at import time).

Secret-handling contract (ADR 0010): an SMS body may contain an OTP code.
NO backend may log a message body at INFO level or above — the console
backend logs the body at DEBUG only, which is admitted (and documented)
because that backend cannot exist outside DEBUG anyway.
"""

import logging

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger("chioni.sms")


class SmsError(Exception):
    """Raised when an SMS cannot be handed to the provider."""


class BaseSmsBackend:
    """Interface of every SMS provider."""

    def send(self, phone_e164: str, message: str) -> None:
        """Send ``message`` to ``phone_e164`` (E.164). Raises SmsError on failure."""
        raise NotImplementedError


class ConsoleSmsBackend(BaseSmsBackend):
    """Dev backend: logs instead of sending — FORBIDDEN when DEBUG=False.

    The INFO line is deliberately empty of phone and body (a code in an
    INFO log would survive into any log shipping); the full message goes
    to DEBUG, admitted in local development only.
    """

    def send(self, phone_e164: str, message: str) -> None:
        logger.info("SMS sortant (backend console — développement).")
        logger.debug("SMS (dev) → %s : %s", phone_e164, message)


class MemorySmsBackend(BaseSmsBackend):
    """Test backend: collects messages in memory (like Django's mail outbox).

    FORBIDDEN when DEBUG=False, same guard as the console backend.
    """

    #: Class-level outbox: list of (phone_e164, message) tuples.
    sent: list = []

    def send(self, phone_e164: str, message: str) -> None:
        type(self).sent.append((phone_e164, message))


class StubSmsBackend(BaseSmsBackend):
    """Skeleton for the real Comorian SMS aggregators (dedicated chantier).

    Boots fine (so a DEBUG=False environment can be configured before the
    integration lands — same posture as ``psp/stripe.py``) but refuses to
    send until the provider integration exists.
    """

    def send(self, phone_e164: str, message: str) -> None:
        raise SmsError(
            "Aucun agrégateur SMS n'est encore intégré : le backend « stub » "
            "est un squelette (chantier dédié — opérateurs comoriens)."
        )


_BACKENDS = {
    "console": ConsoleSmsBackend,
    "memory": MemorySmsBackend,
    "stub": StubSmsBackend,
}

#: Backends that never reach a real phone — refused when DEBUG=False
#: (imported by config/settings.py for the boot guard).
DEV_ONLY_SMS_BACKENDS = frozenset({"console", "memory"})


def get_sms_backend() -> BaseSmsBackend:
    name = getattr(settings, "SMS_BACKEND", "console")
    try:
        return _BACKENDS[name]()
    except KeyError:
        raise ImproperlyConfigured(
            f"SMS_BACKEND inconnu : «{name}» (attendu : {', '.join(_BACKENDS)})."
        )
