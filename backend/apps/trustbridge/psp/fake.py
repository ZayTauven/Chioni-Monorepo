"""FakePSP — dev/test backend. No network, fully deterministic.

Success and failure are DRIVEN BY THE CALLER: the webhook payload says
``succeeded`` or ``failed``, signed with the shared dev secret
(``PSP_WEBHOOK_SECRET``, HMAC-SHA256 over the raw body). Tests and the
local frontend simulate the provider by posting signed events to the
webhook endpoint — the exact shape the Stripe integration will follow.
"""

import hashlib
import hmac
import json

from django.conf import settings

from .base import BasePsp, PspError, WebhookEvent


class FakePsp(BasePsp):
    reference_prefix = "fake_pi_"

    def create_payment(self, intent) -> str:
        # Deterministic on the idempotency key: re-creating the same intent
        # can never mint a second provider-side payment.
        return f"{self.reference_prefix}{intent.idempotency_key}"

    @staticmethod
    def sign(payload: bytes) -> str:
        """Signature helper for tests/dev tools (what the provider would do)."""
        secret = settings.PSP_WEBHOOK_SECRET.encode()
        return hmac.new(secret, payload, hashlib.sha256).hexdigest()

    @classmethod
    def build_webhook(cls, *, reference: str, status: str) -> tuple[bytes, str]:
        """Build a signed (payload, signature) pair — dev/test convenience."""
        payload = json.dumps({"reference": reference, "status": status}).encode()
        return payload, cls.sign(payload)

    def parse_webhook(self, payload: bytes, signature: str) -> WebhookEvent:
        expected = self.sign(payload)
        if not hmac.compare_digest(expected, signature or ""):
            raise PspError("Signature du webhook invalide.")
        try:
            data = json.loads(payload.decode())
        except (ValueError, UnicodeDecodeError):
            raise PspError("Webhook illisible (JSON attendu).")
        reference = data.get("reference", "")
        status = data.get("status", "")
        if not reference or status not in (WebhookEvent.SUCCEEDED, WebhookEvent.FAILED):
            raise PspError("Webhook incomplet : référence et statut requis.")
        return WebhookEvent(reference=reference, status=status)
