"""Guardian-invitation throttles (revue guardian de l'incrément SMS).

``POST /patients/me/guardians/invite/`` fires an SMS towards an arbitrary
phone typed by the caller: like the OTP request endpoint (R-API-4, ADR
0010) it is both a cost hole and a harassment vector, so it is capped on
TWO independent axes:

- per CALLING USER (``invite_guardian_user``, default 5/day): one account
  cannot spray invitations across many numbers;
- per TARGET PHONE (``invite_guardian_phone``, default 3/day): several
  accounts cannot flood one victim's phone — whoever calls.

An unparseable phone is not throttled by phone (the serializer 400s it and
no SMS can leave) but still burns the caller's budget.

Door C (desk creation with a guardian phone) is deliberately NOT
throttled: the caller there is authenticated staff of a KYC-verified
center, acting under traced responsibility (audit trail) — a rate cap
would only obstruct legitimate desk work.

Rates live in ``REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`` and are
env-tunable (``THROTTLE_INVITE_GUARDIAN_*``) like the OTP scopes.
"""

from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.throttling import _phone_from_request


class InviteGuardianPerUserThrottle(SimpleRateThrottle):
    scope = "invite_guardian_user"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": request.user.pk,
        }


class InviteGuardianPerPhoneThrottle(SimpleRateThrottle):
    scope = "invite_guardian_phone"

    def get_cache_key(self, request, view):
        phone = _phone_from_request(request)
        if phone is None:
            return None
        return self.cache_format % {"scope": self.scope, "ident": phone}
