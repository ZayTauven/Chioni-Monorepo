"""OTP throttles — R-API-4 extended to the SMS surface (ADR 0010).

An SMS-sending endpoint is both a cost hole and a harassment vector, so
`/auth/otp/request/` is capped on TWO independent axes:

- per TARGET PHONE (``otp_request_phone``, default 3/hour): nobody can
  flood one victim's phone with codes, from however many IPs;
- per CALLER IP (``otp_request_ip``, default 10/hour): one machine cannot
  spray codes across many numbers.

`/auth/otp/verify/` is capped per IP (``otp_verify_ip``) on top of the
5-attempts-per-code kill switch enforced in the service layer.

Rates live in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`` and are
env-tunable (``THROTTLE_OTP_*``) like the existing auth scopes.
"""

from django.core.exceptions import ValidationError
from rest_framework.throttling import SimpleRateThrottle

from apps.common.phones import normalize_phone


def _phone_from_request(request):
    """The E.164 phone of the request body, or None when unusable.

    An unparseable phone is NOT throttled by phone: it can never trigger
    an SMS (the serializer 400s it) and the per-IP layer still bounds the
    noise. Non-dict bodies and non-string values are tolerated here — the
    serializer will refuse them right after.
    """
    data = request.data
    raw = data.get("phone") if hasattr(data, "get") else None
    if not isinstance(raw, str):
        return None
    try:
        return normalize_phone(raw)
    except ValidationError:
        return None


class OtpRequestPerPhoneThrottle(SimpleRateThrottle):
    scope = "otp_request_phone"

    def get_cache_key(self, request, view):
        phone = _phone_from_request(request)
        if phone is None:
            return None
        return self.cache_format % {"scope": self.scope, "ident": phone}


class OtpRequestPerIpThrottle(SimpleRateThrottle):
    scope = "otp_request_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class OtpVerifyPerIpThrottle(SimpleRateThrottle):
    scope = "otp_verify_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }
