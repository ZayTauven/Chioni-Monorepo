"""EUR→KMF conversion — the transparency module (needs study §4.5, acted).

Decision chain the code enforces:

- the rate comes from an ABSTRACT source (dev/tests: fixed rate from the
  environment, ``FX_EUR_KMF_RATE``; a market/bank feed can be dropped in
  later without touching the services);
- the quote (rate + explicit fees) is shown to the guardian BEFORE any
  payment, then FROZEN on the ``PaymentIntent`` at creation;
- fees are EXPLICIT and paid ON TOP by the guardian: the center receives
  the FULL invoice amount in KMF — the conversion is never a black box.

Money maths: ``Decimal`` only, EUR rounded to 2 places (ROUND_HALF_UP).
The KMF side is the exact invoice total — it is never recomputed.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError

TWO_PLACES = Decimal("0.01")


class FxRateSource(ABC):
    """Abstract source of the EUR→KMF rate (how many KMF for 1 EUR)."""

    @abstractmethod
    def eur_to_kmf_rate(self) -> Decimal:  # pragma: no cover - interface
        ...


class FixedRateSource(FxRateSource):
    """Dev/test source: a fixed rate configured via ``FX_EUR_KMF_RATE``.

    The KMF is pegged to the euro, so a configured fixed rate is a sound
    default far beyond dev; a live source remains pluggable.
    """

    def eur_to_kmf_rate(self) -> Decimal:
        rate = Decimal(str(settings.FX_EUR_KMF_RATE))
        if rate <= 0:
            raise ValidationError("Taux de change EUR→KMF invalide (doit être > 0).")
        return rate


def get_rate_source() -> FxRateSource:
    """The active rate source (single dev implementation for now)."""
    return FixedRateSource()


@dataclass(frozen=True)
class FxQuote:
    """A conversion quote shown to the guardian BEFORE paying.

    ``amount_kmf``  — what the center will receive (the invoice total).
    ``rate``        — EUR→KMF rate applied (frozen on the intent).
    ``amount_eur``  — net EUR equivalent of the KMF amount.
    ``fees_eur``    — explicit fees, paid on top by the guardian.
    ``total_eur``   — what the guardian actually pays (net + fees).
    """

    amount_kmf: Decimal
    rate: Decimal
    amount_eur: Decimal
    fees_eur: Decimal
    total_eur: Decimal


def net_eur_for_kmf(amount_kmf: Decimal, rate: Decimal) -> Decimal:
    """Net EUR equivalent of ``amount_kmf`` at ``rate`` — the ONE rounding
    rule, shared by the quote and the cash-in service so both always agree."""
    return (Decimal(amount_kmf) / Decimal(rate)).quantize(TWO_PLACES, ROUND_HALF_UP)


def quote_eur_for_kmf(amount_kmf: Decimal, *, rate: Decimal | None = None) -> FxQuote:
    """Build the transparent quote for a KMF amount.

    Fees: ``PSP_FEE_PERCENT`` of the net EUR amount, rounded to the cent —
    explicit on the quote, the ledger (compte ``frais_psp``) and the receipt.
    """
    amount_kmf = Decimal(amount_kmf)
    if amount_kmf <= 0:
        raise ValidationError("Le montant à convertir doit être > 0 KMF.")
    if rate is None:
        rate = get_rate_source().eur_to_kmf_rate()
    amount_eur = net_eur_for_kmf(amount_kmf, rate)
    fee_percent = Decimal(str(settings.PSP_FEE_PERCENT))
    if fee_percent < 0:
        raise ValidationError("Le pourcentage de frais ne peut pas être négatif.")
    fees_eur = (amount_eur * fee_percent / Decimal("100")).quantize(
        TWO_PLACES, ROUND_HALF_UP
    )
    return FxQuote(
        amount_kmf=amount_kmf,
        rate=rate,
        amount_eur=amount_eur,
        fees_eur=fees_eur,
        total_eur=amount_eur + fees_eur,
    )
