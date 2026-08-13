"""PSP interface — every provider implements exactly this contract.

The PSP moves the money; the internal double-entry ledger remains the
source of truth whatever the rail (ADR 0003). A provider NEVER decides
amounts or destinations: it receives a fully-priced ``PaymentIntent``
(amounts and rate frozen by the services) and reports success/failure
through signed webhooks.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


class PspError(Exception):
    """Raised on provider-level failures (bad signature, malformed event…)."""


@dataclass(frozen=True)
class WebhookEvent:
    """A provider event, normalised for the cash-in service.

    ``reference`` — the provider-side payment reference
    (``PaymentIntent.psp_reference``).
    ``status``    — ``succeeded`` or ``failed``.
    """

    reference: str
    status: str

    SUCCEEDED = "succeeded"
    FAILED = "failed"


class BasePsp(ABC):
    """Contract of a payment service provider backend."""

    @abstractmethod
    def create_payment(self, intent) -> str:
        """Register the payment on the provider side.

        Receives a ``PaymentIntent`` whose amounts, currency and rate are
        already frozen. Returns the provider reference to store on
        ``intent.psp_reference``. Must be idempotent on
        ``intent.idempotency_key``.
        """

    @abstractmethod
    def parse_webhook(self, payload: bytes, signature: str) -> WebhookEvent:
        """Verify ``signature`` over the raw ``payload`` and normalise the
        event. Raises :class:`PspError` when the signature is invalid or the
        payload is malformed — the caller answers 400, nothing is recorded.
        """
