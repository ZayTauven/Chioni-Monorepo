"""Money helpers shared across apps.

The Comorian franc (KMF) has no sub-unit in circulation: every KMF amount
the platform accepts from users must be a whole number of francs. The
cash desk already enforces it on payments (apps/trustbridge/services.py) ;
this validator closes the other entry point — the tariff grid — so an
invoice can never be born with a fractional balance the counter cannot
settle (guardian review, wave 2a).
"""

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError

KMF_DECIMALS_MESSAGE = "Le franc comorien ne porte pas de décimales."


def validate_kmf_integral(value):
    """Field/service validator: reject KMF amounts carrying decimals."""
    if value in (None, ""):
        return
    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise ValidationError("Montant KMF invalide.")
    if amount != amount.to_integral_value():
        raise ValidationError(KMF_DECIMALS_MESSAGE)
