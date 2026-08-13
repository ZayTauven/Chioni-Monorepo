"""HTTP contract of `/api/v1/auth/otp/*` (ADR 0010).

Anti-enumeration is tested on BODIES AND STATUS CODES: whatever the phone
matches (account, shadow, nothing, deactivated tombstone), request answers
byte-identically; verify failures are one indistinguishable 400.
"""

import re

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import OtpCode
from apps.audit.models import AuditLog
from apps.centers.models import StaffMembership
from apps.centers.services import add_staff_member
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import create_protege

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
)
from .factories import make_user

pytestmark = pytest.mark.django_db

REQUEST_URL = "/api/v1/auth/otp/request/"
VERIFY_URL = "/api/v1/auth/otp/verify/"
ME_URL = "/api/v1/auth/me/"

PHONE = "+2693390011"


def code_from(sms_outbox):
    return re.search(r"\b(\d{6})\b", sms_outbox[-1][1]).group(1)


def set_rates(monkeypatch, **rates):
    """Same technique as TestAuthThrottling: THROTTLE_RATES is a class
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
            **rates,
        },
    )


class TestOtpRequestContract:
    def test_valid_phone_gets_200_and_an_sms(self, sms_outbox):
        response = APIClient().post(REQUEST_URL, {"phone": PHONE})
        assert response.status_code == 200
        assert len(sms_outbox) == 1
        assert sms_outbox[0][0] == PHONE

    def test_national_spelling_converges_to_e164(self, sms_outbox):
        response = APIClient().post(REQUEST_URL, {"phone": "339 00 11"})
        assert response.status_code == 200
        assert OtpCode.objects.get().phone == PHONE

    def test_invalid_phone_is_the_only_400(self, sms_outbox):
        response = APIClient().post(REQUEST_URL, {"phone": "12"})
        assert response.status_code == 400
        assert sms_outbox == []

    def test_response_is_identical_for_every_kind_of_phone(self, sms_outbox):
        """Anti-énumération : compte, ombre, inconnu, désactivé → mêmes octets."""
        make_user(phone="+2693390001")  # existing account
        _, guardian = make_guardian_user()
        protege, _ = create_protege(
            guardian_user=guardian.user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Nadjma",
            last_name="Abdou",
            phone="+2693390002",
        )
        tombstone = make_user(phone="+2693390003")
        tombstone.is_active = False
        tombstone.save(update_fields=["is_active"])

        client = APIClient()
        responses = [
            client.post(REQUEST_URL, {"phone": phone})
            for phone in (
                "+2693390001",  # account
                "+2693390002",  # unclaimed profile's declarative phone
                "+2693390004",  # nothing at all
                "+2693390003",  # deactivated tombstone (no SMS leaves)
            )
        ]
        assert {r.status_code for r in responses} == {200}
        bodies = {r.content for r in responses}
        assert len(bodies) == 1, "les corps de réponse doivent être identiques"

    def test_code_never_appears_in_the_response(self, sms_outbox):
        response = APIClient().post(REQUEST_URL, {"phone": PHONE})
        code = code_from(sms_outbox)
        assert code not in response.content.decode()


class TestOtpVerifyContract:
    def test_nominal_login_returns_jwt_pair_and_me(self, sms_outbox):
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        response = client.post(
            VERIFY_URL, {"phone": PHONE, "code": code_from(sms_outbox)}
        )
        assert response.status_code == 200
        data = response.data
        assert data["access"] and data["refresh"]
        assert data["me"]["phone"] == PHONE
        # The access token really opens the API.
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {data['access']}")
        assert client.get(ME_URL).status_code == 200

    def test_failures_are_indistinguishable(self, sms_outbox):
        """Téléphone inconnu / code faux / code déjà consommé → même 400."""
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        code = code_from(sms_outbox)
        wrong = "000000" if code != "000000" else "111111"

        unknown = client.post(
            VERIFY_URL, {"phone": "+2693390099", "code": "123456"}
        )
        mismatch = client.post(VERIFY_URL, {"phone": PHONE, "code": wrong})
        assert client.post(VERIFY_URL, {"phone": PHONE, "code": code}).status_code == 200
        replay = client.post(VERIFY_URL, {"phone": PHONE, "code": code})

        assert unknown.status_code == mismatch.status_code == replay.status_code == 400
        assert unknown.content == mismatch.content == replay.content

    def test_verify_response_never_contains_the_code(self, sms_outbox):
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        code = code_from(sms_outbox)
        ok = client.post(VERIFY_URL, {"phone": PHONE, "code": code})
        assert code not in ok.content.decode()


class TestOtpDoors:
    def test_door_b_full_cycle(self, sms_outbox):
        """Porte B — création du compte AU verify, puis profil via l'API patient."""
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        response = client.post(
            VERIFY_URL, {"phone": PHONE, "code": code_from(sms_outbox)}
        )
        assert response.data["me"]["patient_profile"] is None  # pas encore créé
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.get(phone=PHONE)
        assert user.phone_verified_at is not None
        assert not user.has_usable_password()

    def test_door_a_activation_claims_the_protege_profile(self, sms_outbox):
        guardian_user, _ = make_guardian_user()
        protege, _ = create_protege(
            guardian_user=guardian_user,
            relationship=GuardianLink.Relationship.PARENT,
            first_name="Mariama",
            last_name="Ahamada",
            phone=PHONE,
        )
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        response = client.post(
            VERIFY_URL, {"phone": PHONE, "code": code_from(sms_outbox)}
        )
        assert response.status_code == 200
        me = response.data["me"]
        assert me["patient_profile"]["id"] == protege.pk
        assert me["patient_profile"]["claim_status"] == "actif"

    def test_door_c_desk_profile_stays_unclaimed(self, sms_outbox):
        center, director = make_center_with_director()
        from apps.patients.services import create_patient_at_center

        profile, _ = create_patient_at_center(
            actor=director,
            center=center,
            first_name="Halima",
            last_name="Saïd",
            phone=PHONE,
        )
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        response = client.post(
            VERIFY_URL, {"phone": PHONE, "code": code_from(sms_outbox)}
        )
        assert response.status_code == 200
        assert response.data["me"]["patient_profile"] is None
        profile.refresh_from_db()
        assert profile.user is None  # le guichet n'est pas une preuve

    def test_shadow_staff_activation_exposes_the_membership(self, sms_outbox):
        center, director = make_center_with_director()
        add_staff_member(
            actor=director,
            center=center,
            phone=PHONE,
            role=StaffMembership.Role.NURSE,
            first_name="Zalia",
        )
        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        response = client.post(
            VERIFY_URL, {"phone": PHONE, "code": code_from(sms_outbox)}
        )
        assert response.status_code == 200
        memberships = response.data["me"]["staff_memberships"]
        assert [(m["center"]["id"], m["role"]) for m in memberships] == [
            (center.pk, "infirmier")
        ]


class TestOtpThrottling:
    def test_per_phone_cap_is_independent_of_the_caller(
        self, sms_outbox, monkeypatch
    ):
        set_rates(monkeypatch, otp_request_phone="2/hour")
        client = APIClient()
        codes = [
            client.post(REQUEST_URL, {"phone": PHONE}).status_code for _ in range(3)
        ]
        assert codes == [200, 200, 429]
        assert len(sms_outbox) == 2  # the throttled request sent NOTHING
        # Another phone from the same IP still passes (independent key).
        assert client.post(REQUEST_URL, {"phone": "+2693390022"}).status_code == 200

    def test_per_ip_cap_across_many_phones(self, sms_outbox, monkeypatch):
        set_rates(monkeypatch, otp_request_ip="3/hour")
        client = APIClient()
        codes = [
            client.post(
                REQUEST_URL, {"phone": f"+269339003{n}"}
            ).status_code
            for n in range(4)
        ]
        assert codes == [200, 200, 200, 429]

    def test_invalid_phone_burns_ip_budget_but_not_phone_budget(
        self, sms_outbox, monkeypatch
    ):
        set_rates(monkeypatch, otp_request_ip="2/hour")
        client = APIClient()
        assert client.post(REQUEST_URL, {"phone": "junk"}).status_code == 400
        assert client.post(REQUEST_URL, {"phone": "junk"}).status_code == 400
        assert client.post(REQUEST_URL, {"phone": PHONE}).status_code == 429

    def test_verify_endpoint_is_throttled_per_ip(self, sms_outbox, monkeypatch):
        set_rates(monkeypatch, otp_verify_ip="2/hour")
        client = APIClient()
        codes = [
            client.post(
                VERIFY_URL, {"phone": PHONE, "code": "123456"}
            ).status_code
            for _ in range(3)
        ]
        assert codes == [400, 400, 429]

    def test_verify_scope_does_not_burn_the_request_scope(
        self, sms_outbox, monkeypatch
    ):
        set_rates(monkeypatch, otp_verify_ip="1/hour")
        client = APIClient()
        assert client.post(VERIFY_URL, {"phone": PHONE, "code": "1"}).status_code == 400
        assert client.post(VERIFY_URL, {"phone": PHONE, "code": "1"}).status_code == 429
        assert client.post(REQUEST_URL, {"phone": PHONE}).status_code == 200


class TestClaimantConfirmationApi:
    """OTP-1 end-to-end over HTTP: claim suspends links, the patient
    confirms/declines, and a suspended link gives the guardian nothing."""

    def _login(self, phone, sms_outbox):
        client = APIClient()
        client.post(REQUEST_URL, {"phone": phone})
        response = client.post(
            VERIFY_URL, {"phone": phone, "code": code_from(sms_outbox)}
        )
        assert response.status_code == 200
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return client, response.data["me"]

    def _seed_door_a(self, phone):
        guardian_user, _ = make_guardian_user()
        protege, link = create_protege(
            guardian_user=guardian_user,
            relationship=GuardianLink.Relationship.CHILD,
            first_name="Mariama", last_name="Ahamada", phone=phone,
        )
        return guardian_user, protege, link

    def test_suspended_link_is_invisible_to_the_guardian_until_confirmed(
        self, sms_outbox
    ):
        guardian_user, _protege, link = self._seed_door_a(PHONE)

        # Guardian sees the protégé WHILE the profile is unclaimed.
        before = APIClient()
        before.force_authenticate(guardian_user)
        assert len(before.get("/api/v1/guardian/proteges/").data["results"]) == 1

        # The patient claims by OTP → the link is suspended → invisible.
        patient_client, me = self._login(PHONE, sms_outbox)
        assert me["patient_profile"]["claim_status"] == "actif"
        mid = APIClient()
        mid.force_authenticate(guardian_user)
        assert mid.get("/api/v1/guardian/proteges/").data["results"] == []

        # The patient sees it pending and confirms it.
        rows = patient_client.get("/api/v1/patients/me/guardians/").data["results"]
        (row,) = rows
        assert row["status"] == "attente_confirmation_titulaire"
        assert row["scopes"] == []
        confirm = patient_client.post(
            f"/api/v1/patients/me/guardians/{link.pk}/confirm/"
        )
        assert confirm.status_code == 200
        assert confirm.data["status"] == "actif"

        # Now the guardian sees the protégé again (payments scope).
        after = APIClient()
        after.force_authenticate(guardian_user)
        assert len(after.get("/api/v1/guardian/proteges/").data["results"]) == 1

    def test_patient_declines_a_pre_seeded_link(self, sms_outbox):
        guardian_user, _protege, link = self._seed_door_a(PHONE)
        patient_client, _me = self._login(PHONE, sms_outbox)

        decline = patient_client.post(
            f"/api/v1/patients/me/guardians/{link.pk}/decline/"
        )
        assert decline.status_code == 200
        assert decline.data["status"] == "revoque"

        # The stranger is cut off for good.
        guardian_client = APIClient()
        guardian_client.force_authenticate(guardian_user)
        assert guardian_client.get("/api/v1/guardian/proteges/").data["results"] == []

    def test_cross_patient_confirm_is_404(self, sms_outbox):
        _gu, _protege, link = self._seed_door_a(PHONE)
        self._login(PHONE, sms_outbox)  # legit owner claims

        intruder = make_claimed_patient()
        response = client_for(intruder.user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/confirm/"
        )
        assert response.status_code == 404  # invisible, not just forbidden


class TestOtpAuditHygiene:
    def test_full_cycle_leaves_no_code_and_no_phone_in_audit(self, sms_outbox):
        import json

        client = APIClient()
        client.post(REQUEST_URL, {"phone": PHONE})
        code = code_from(sms_outbox)
        wrong = "000000" if code != "000000" else "111111"
        client.post(VERIFY_URL, {"phone": PHONE, "code": wrong})
        client.post(VERIFY_URL, {"phone": PHONE, "code": code})

        assert AuditLog.objects.count() >= 3  # requested, failed, verified…
        for entry in AuditLog.objects.all():
            dump = json.dumps(entry.payload)
            assert code not in dump
            assert PHONE not in dump
            assert PHONE.lstrip("+") not in dump
