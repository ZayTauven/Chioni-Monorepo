"""Central phone normalisation (R-API-5) — E.164 at EVERY entry point.

The verified phone is the platform's pivot identifier (ADR 0001): two
spellings of the same number (« +2693312345 », « 2693312345 »,
« 331 23 45 ») MUST converge to one E.164 form BEFORE any match or
creation, otherwise shadow accounts and duplicate profiles multiply.

Every boundary where a phone enters (desk patient creation, guardian
invitations, shadow users, staff onboarding) calls :func:`normalize_phone`
first. Services never store or match a raw phone string.
"""

import phonenumbers
from django.core.exceptions import ValidationError

#: Comoros is the platform's home region: bare national numbers
#: (« 3312345 ») are interpreted as Comorian by default.
DEFAULT_REGION = "KM"

_INVALID_MESSAGE = (
    "Numéro de téléphone invalide. Utilisez le format international "
    "(ex. +2693212345) ou un numéro comorien."
)


def normalize_phone(raw, default_region=DEFAULT_REGION):
    """Return the E.164 form of ``raw`` or raise a French ValidationError.

    Accepts international («+269… », « 0033… ») and national comorian
    forms; a digits-only international number without « + » (« 269… »,
    « 33612345678 » is NOT one — French numbers need «+33 »/« 0033 ») is
    retried with a leading « + » so « 269… » and « +269… » converge.
    """
    raw = (raw or "").strip()
    if not raw:
        raise ValidationError("Le numéro de téléphone est requis.")

    candidates = [raw]
    if not raw.startswith("+"):
        candidates.append(f"+{raw}")

    for candidate in candidates:
        try:
            parsed = phonenumbers.parse(candidate, default_region)
        except phonenumbers.NumberParseException:
            continue
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.E164
            )
    raise ValidationError(_INVALID_MESSAGE)
