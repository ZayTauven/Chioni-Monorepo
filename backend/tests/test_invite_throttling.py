"""Guardian-invitation throttles (revue guardian de l'incrément SMS).

``POST /patients/me/guardians/invite/`` fires an SMS towards a phone typed
by the caller — same posture as the OTP request endpoint (R-API-4, ADR
0010): capped per CALLING USER (``invite_guardian_user``) AND per TARGET
PHONE (``invite_guardian_phone``), two independent budgets. Door C (desk
creation with a guardian phone) is deliberately NOT throttled: the caller
is authenticated staff of a KYC-verified center, acting under traced
responsibility.
"""

import pytest

from .api_helpers import client_for, make_claimed_patient

pytestmark = pytest.mark.django_db

INVITE_URL = "/api/v1/patients/me/guardians/invite/"

TARGET_PHONE = "+2693440301"


def set_rates(monkeypatch, **rates):
    """Same technique as the OTP throttle tests: THROTTLE_RATES is a class
    attribute frozen at import — patch it on SimpleRateThrottle directly."""
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {
            "auth_token": "10/min",
            "auth_refresh": "30/min",
            "otp_request_phone": "100/hour",
            "otp_request_ip": "100/hour",
            "otp_verify_ip": "100/hour",
            "invite_guardian_user": "100/day",
            "invite_guardian_phone": "100/day",
            **rates,
        },
    )


def invite(client, phone):
    return client.post(INVITE_URL, {"phone": phone, "relationship": "enfant"})


class TestInviteThrottling:
    def test_default_rates_are_wired_and_env_tunable_scopes_exist(self, settings):
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        assert rates["invite_guardian_user"] == "5/day"
        assert rates["invite_guardian_phone"] == "3/day"

    def test_per_user_cap_across_many_phones(self, monkeypatch):
        set_rates(monkeypatch, invite_guardian_user="2/day")
        patient = make_claimed_patient()
        client = client_for(patient.user)
        codes = [
            invite(client, f"+269344031{n}").status_code for n in range(3)
        ]
        assert codes == [201, 201, 429]

    def test_per_user_budget_is_per_account_not_global(self, monkeypatch):
        set_rates(monkeypatch, invite_guardian_user="1/day")
        first = make_claimed_patient()
        assert invite(client_for(first.user), "+2693440320").status_code == 201
        assert invite(client_for(first.user), "+2693440321").status_code == 429
        # Another patient still has their own budget.
        second = make_claimed_patient()
        assert invite(client_for(second.user), "+2693440322").status_code == 201

    def test_per_phone_cap_is_independent_of_the_caller(self, monkeypatch):
        """Nobody floods one victim's phone, from however many accounts."""
        set_rates(monkeypatch, invite_guardian_phone="2/day")
        codes = [
            invite(client_for(make_claimed_patient().user), TARGET_PHONE).status_code
            for _ in range(3)
        ]
        assert codes == [201, 201, 429]
        # Another target phone still passes for a fresh caller (independent key).
        assert (
            invite(
                client_for(make_claimed_patient().user), "+2693440330"
            ).status_code
            == 201
        )

    def test_budgets_are_independent(self, monkeypatch):
        """Burning the phone budget must not burn the user budget: the same
        caller can still invite ANOTHER phone after a 429 on the first."""
        set_rates(monkeypatch, invite_guardian_phone="1/day")
        patient = make_claimed_patient()
        other = make_claimed_patient()
        assert invite(client_for(other.user), TARGET_PHONE).status_code == 201
        # The phone budget is exhausted for this target…
        assert invite(client_for(patient.user), TARGET_PHONE).status_code == 429
        # …but the caller's own budget is intact for another number.
        assert invite(client_for(patient.user), "+2693440340").status_code == 201

    def test_invalid_phone_burns_user_budget_but_not_phone_budget(
        self, monkeypatch
    ):
        """Mirror of the OTP probe: an unparseable phone can never trigger
        an SMS (serializer 400) — it is not throttled by phone but still
        consumes the caller's budget."""
        set_rates(monkeypatch, invite_guardian_user="2/day")
        patient = make_claimed_patient()
        client = client_for(patient.user)
        assert invite(client, "junk").status_code == 400
        assert invite(client, "junk").status_code == 400
        assert invite(client, TARGET_PHONE).status_code == 429
