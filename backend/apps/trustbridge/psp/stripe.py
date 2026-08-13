"""Stripe backend — SKELETON only (dedicated chantier, needs keys).

The real integration (stripe-python, PaymentIntents API, signed webhooks
via ``Stripe-Signature``) is a drop-in behind :class:`BasePsp`: implement
the two methods, set ``PSP_BACKEND=stripe`` and the services need no
change. NO network call may live anywhere else in the codebase.
"""

from .base import BasePsp, WebhookEvent


class StripePsp(BasePsp):
    def create_payment(self, intent) -> str:
        raise NotImplementedError(
            "Intégration Stripe : chantier dédié (clés API requises). "
            "Utilisez PSP_BACKEND=fake en développement."
        )

    def parse_webhook(self, payload: bytes, signature: str) -> WebhookEvent:
        raise NotImplementedError(
            "Intégration Stripe : chantier dédié (vérification Stripe-Signature)."
        )
