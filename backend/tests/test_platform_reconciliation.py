"""S4 (ADR 0017, décision 6) — PSP reconciliation for the Chioni operator.

`GET /platform/reconciliation/`. ADR 0009 wanted the refused webhooks to
be « matière à réconciliation »; until now only a Django superuser
browsing ``AuditLog`` could read them.

The four things this file locks:

1. **The four real refusal cases are produced by the REAL services** —
   not by hand-written audit rows — and each lands with its own incident
   code and its own references (that is the whole value of the view: an
   operator must be able to tell « the guardian was debited and the
   invoice had been cancelled » from « the balance moved at the counter »).
2. **Roles**: ``support`` AND ``admin`` read; nobody else — a director,
   a cashier, a patient, a guardian, a Django superuser without an
   operator row all get 403.
3. **Never a patient, never a name, never a franc of clinical context**:
   only the allow-listed reference keys are surfaced, so a service adding
   a richer ref tomorrow cannot leak it here.
4. Filters (`from`/`to`/`reason`/`center`) refuse garbage per field.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import PlatformStaff
from apps.audit.services import AuditAction
from apps.trustbridge import services as tb_services
from apps.trustbridge.models import Invoice, PaymentIntent, PaymentRequest
from apps.trustbridge.platform_views import (
    INCIDENT_ACTIONS,
    INCIDENT_FILTERS,
    INCIDENT_REF_FIELDS,
    INCIDENT_INTENT_FAILED,
    INCIDENT_INTENT_STALE_CANCELLED,
    INCIDENT_WEBHOOK_BALANCE_CHANGED,
    INCIDENT_WEBHOOK_INTENT_NOT_PAYABLE,
    INCIDENT_WEBHOOK_INVOICE_CANCELLED,
    INCIDENT_WEBHOOK_REQUEST_NOT_PAYABLE,
)

from .api_helpers import client_for, make_center_with_director, make_guardian_user
from .factories import make_platform_staff, make_user
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db

URL = "/api/v1/platform/reconciliation/"

#: The EXACT contract of one incident row.
ROW_FIELDS = {"id", "created_at", "action", "incident", "center", "center_name", "refs"}


def operator(role=PlatformStaff.Role.SUPPORT):
    user, _op = make_platform_staff(role=role)
    return client_for(user)


def rows(response):
    return response.data["results"]


# ---------------------------------------------------------------------------
# The four real refusal cases, produced by the real services
# ---------------------------------------------------------------------------


class TestTheFourRefusalsAreDistinguishable:
    def test_intent_already_cancelled_by_the_zombie_purge(self, settings):
        """The stale purge cancelled the intent; the provider's success
        arrives afterwards — the guardian may really have been debited."""
        settings.PSP_INTENT_STALE_HOURS = 1
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        PaymentIntent.objects.filter(pk=intent.pk).update(
            status=PaymentIntent.Status.CANCELLED
        )
        intent.refresh_from_db()
        with pytest.raises(Exception):
            tb_services.register_payment_success(intent=intent)

        (row,) = rows(operator().get(URL))
        assert row["action"] == AuditAction.PAYMENT_WEBHOOK_REFUSED
        assert row["incident"] == INCIDENT_WEBHOOK_INTENT_NOT_PAYABLE
        assert row["center"] == scn.center.pk
        assert row["refs"]["intent_id"] == intent.pk
        assert row["refs"]["intent_status"] == PaymentIntent.Status.CANCELLED

    def test_request_no_longer_open_to_payment(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        first = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        tb_services.register_payment_success(intent=first)
        # A duplicate provider event on ANOTHER intent of the same request
        # (a replay of the SAME intent is a strict no-op, so the
        # request-level refusal needs a second intent row).
        late = PaymentIntent.objects.create(
            payment_request=scn.payment_request,
            guardian=scn.guardian_profile,
            psp=first.psp,
            idempotency_key="late-" + first.idempotency_key,
            amount_eur=first.amount_eur,
            exchange_rate=first.exchange_rate,
            amount_kmf=first.amount_kmf,
            status=PaymentIntent.Status.PROCESSING,
        )
        with pytest.raises(Exception):
            tb_services.register_payment_success(intent=late)

        incidents = [
            row for row in rows(operator().get(URL))
            if row["action"] == AuditAction.PAYMENT_WEBHOOK_REFUSED
        ]
        assert len(incidents) == 1
        assert incidents[0]["incident"] == INCIDENT_WEBHOOK_REQUEST_NOT_PAYABLE
        assert incidents[0]["refs"]["request_status"] == PaymentRequest.Status.PAID
        assert incidents[0]["refs"]["payment_request_id"] == scn.payment_request.pk

    def test_invoice_cancelled_under_the_guardian(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        Invoice.objects.filter(pk=scn.invoice.pk).update(
            status=Invoice.Status.CANCELLED
        )
        with pytest.raises(Exception):
            tb_services.register_payment_success(intent=intent)

        (row,) = [
            r for r in rows(operator().get(URL))
            if r["action"] == AuditAction.PAYMENT_WEBHOOK_REFUSED
        ]
        assert row["incident"] == INCIDENT_WEBHOOK_INVOICE_CANCELLED
        assert row["refs"]["invoice_id"] == scn.invoice.pk
        assert row["refs"]["intent_kmf"] == str(intent.amount_kmf)

    def test_balance_moved_at_the_counter(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT, price_kmf="20000")
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        # Push the intent past the counter-side anti-double-débit window,
        # exactly like tests/test_cash_payments.py: the cashier must be
        # able to take the instalment for the race to happen at all.
        PaymentIntent.objects.filter(pk=intent.pk).update(
            created_at=timezone.now() - timedelta(minutes=60)
        )
        tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method="especes", amount_kmf=5000,
        )
        with pytest.raises(Exception):
            tb_services.register_payment_success(intent=intent)

        (row,) = [
            r for r in rows(operator().get(URL))
            if r["action"] == AuditAction.PAYMENT_WEBHOOK_REFUSED
        ]
        assert row["incident"] == INCIDENT_WEBHOOK_BALANCE_CHANGED
        assert row["refs"]["intent_kmf"] == "20000.00"
        assert row["refs"]["balance_kmf"] == "15000.00"

    def test_provider_failure_and_zombie_purge(self, settings):
        settings.PSP_INTENT_STALE_HOURS = 1
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        tb_services.register_payment_failure(intent=intent)

        other = build_scenario(status=PaymentRequest.Status.SENT)
        stale = tb_services.create_payment_intent(
            guardian_user=other.guardian_user, payment_request=other.payment_request
        )
        PaymentIntent.objects.filter(pk=stale.pk).update(
            created_at=stale.created_at.replace(year=stale.created_at.year - 1)
        )
        assert tb_services.cancel_stale_intents() == 1

        by_incident = {row["incident"]: row for row in rows(operator().get(URL))}
        assert by_incident[INCIDENT_INTENT_FAILED]["center"] == scn.center.pk
        assert by_incident[INCIDENT_INTENT_STALE_CANCELLED]["center"] == other.center.pk
        assert (
            by_incident[INCIDENT_INTENT_STALE_CANCELLED]["refs"]["intent_id"]
            == stale.pk
        )


# ---------------------------------------------------------------------------
# The door
# ---------------------------------------------------------------------------


class TestWhoMayRead:
    @pytest.mark.parametrize(
        "role", [PlatformStaff.Role.SUPPORT, PlatformStaff.Role.ADMIN]
    )
    def test_both_operator_roles_read(self, role):
        assert operator(role).get(URL).status_code == 200

    def test_a_director_a_patient_and_a_guardian_are_403(self):
        _center, director = make_center_with_director()
        guardian_user, _profile = make_guardian_user()
        for user in (director, guardian_user, make_user()):
            assert client_for(user).get(URL).status_code == 403

    def test_a_django_superuser_without_an_operator_row_is_403(self):
        superuser = make_user()
        superuser.is_staff = superuser.is_superuser = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        response = client_for(superuser).get(URL)
        assert response.status_code == 403
        assert "équipe Chioni" in str(response.data)

    def test_anonymous_is_401(self):
        assert client_for().get(URL).status_code == 401

    def test_a_deactivated_operator_is_indistinguishable_from_a_stranger(self):
        user, _op = make_platform_staff(is_active=False)
        a = client_for(user).get(URL)
        b = client_for(make_user()).get(URL)
        assert a.status_code == b.status_code == 403
        assert a.content == b.content


# ---------------------------------------------------------------------------
# The payload: technical references, and nothing else
# ---------------------------------------------------------------------------


class TestNoPatientEverReachesTheOperator:
    def test_row_shape_is_exactly_the_contract(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        tb_services.register_payment_failure(intent=intent)
        (row,) = rows(operator().get(URL))
        assert set(row) == ROW_FIELDS
        assert set(row["refs"]) <= set(INCIDENT_REF_FIELDS)

    def test_no_name_no_act_label_no_patient_id(self):
        """The stage carries a deliberately sensitive act label and a
        Comorian patient name — neither may appear anywhere."""
        from .trustbridge_helpers import SENSITIVE_LABEL

        scn = build_scenario(status=PaymentRequest.Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        tb_services.register_payment_failure(intent=intent)

        response = operator().get(URL)
        body = response.content.decode()
        assert SENSITIVE_LABEL not in body
        assert "Mariama" not in body and "Ahamada" not in body
        for row in rows(response):
            assert "patient_id" not in row["refs"]
            assert "guardian_id" not in row["refs"]

    def test_only_allow_listed_refs_are_surfaced(self):
        """A future service adding a richer ref to one of these actions
        must not leak it: the serializer reads an allow-list, never the
        payload as a whole."""
        from apps.audit.services import audit

        center, _director = make_center_with_director()
        audit(
            actor=None, action=AuditAction.PAYMENT_INTENT_FAILED, center=center,
            intent_id=1, payment_request_id=2,
            patient_id=42, guardian_name="Ali Combo",
        )
        (row,) = rows(operator().get(URL))
        assert row["refs"] == {"intent_id": 1, "payment_request_id": 2}
        assert "Combo" not in operator().get(URL).content.decode()

    def test_the_tenant_is_named_because_the_tenant_is_the_perimeter(self):
        center, _director = make_center_with_director(name="Clinique Ylang")
        from apps.audit.services import audit

        audit(
            actor=None, action=AuditAction.PAYMENT_INTENT_FAILED, center=center,
            intent_id=1,
        )
        (row,) = rows(operator().get(URL))
        assert row["center"] == center.pk and row["center_name"] == "Clinique Ylang"

    def test_a_pre_s4_incident_shows_with_a_null_center(self):
        """Append-only: old rows were never back-filled and never will be."""
        from apps.audit.services import audit

        audit(actor=None, action=AuditAction.PAYMENT_INTENT_FAILED, intent_id=9)
        (row,) = rows(operator().get(URL))
        assert row["center"] is None and row["center_name"] is None


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


class TestFilters:
    def _three_incidents(self):
        from apps.audit.services import audit

        center_a, _d1 = make_center_with_director(name="A")
        center_b, _d2 = make_center_with_director(name="B")
        audit(
            actor=None, action=AuditAction.PAYMENT_INTENT_FAILED, center=center_a,
            intent_id=1,
        )
        audit(
            actor=None, action=AuditAction.PAYMENT_INTENT_CANCELLED, center=center_b,
            intent_id=2, reason="stale",
        )
        audit(
            actor=None, action=AuditAction.PAYMENT_WEBHOOK_REFUSED, center=center_b,
            intent_id=3, refusal="balance_changed", reason="late_webhook_refused",
        )
        return center_a, center_b

    def test_center_filter(self):
        _a, b = self._three_incidents()
        response = operator().get(URL, {"center": b.pk})
        assert {row["center"] for row in rows(response)} == {b.pk}
        assert response.data["count"] == 2

    def test_unknown_center_is_an_empty_page_not_an_error(self):
        """The platform's perimeter IS every center: there is no
        cross-tenant probe to protect against here."""
        self._three_incidents()
        assert operator().get(URL, {"center": 999999}).data["count"] == 0

    def test_invalid_center_is_400_per_field(self):
        response = operator().get(URL, {"center": "abc"})
        assert response.status_code == 400 and "center" in response.data

    @pytest.mark.parametrize("code", sorted(INCIDENT_FILTERS))
    def test_every_incident_code_filters_exactly_what_it_labels(self, code):
        """The vocabulary must not drift: the ``Q`` used to filter and the
        code derived for display are two faces of one rule."""
        self._three_incidents()
        response = operator().get(URL, {"reason": code})
        assert response.status_code == 200
        for row in rows(response):
            assert row["incident"] == code

    def test_unknown_reason_is_400_per_field(self):
        response = operator().get(URL, {"reason": "je-ne-sais-pas"})
        assert response.status_code == 400 and "reason" in response.data

    def test_period_bounds_are_the_shared_contract(self):
        client = operator()
        assert client.get(URL, {"from": "pas-une-date"}).status_code == 400
        assert client.get(URL, {"from": "2026-02-30"}).status_code == 400
        assert client.get(
            URL, {"from": "2026-08-10", "to": "2026-08-01"}
        ).status_code == 400
        assert client.get(
            URL, {"from": "2020-01-01", "to": "2026-08-01"}
        ).status_code == 400

    def test_the_window_hides_older_incidents(self):
        self._three_incidents()
        assert operator().get(URL).data["count"] == 3
        assert operator().get(
            URL, {"from": "2020-01-01", "to": "2020-12-31"}
        ).data["count"] == 0

    def test_only_the_three_incident_actions_are_listed(self):
        """A successful payment is not an incident."""
        build_scenario(status=PaymentRequest.Status.PAID)
        response = operator().get(URL)
        assert response.data["count"] == 0
        assert set(INCIDENT_ACTIONS) == {
            AuditAction.PAYMENT_WEBHOOK_REFUSED,
            AuditAction.PAYMENT_INTENT_CANCELLED,
            AuditAction.PAYMENT_INTENT_FAILED,
        }

    def test_most_recent_first(self):
        from apps.audit.services import audit

        center, _d = make_center_with_director()
        for n in range(3):
            audit(
                actor=None, action=AuditAction.PAYMENT_INTENT_FAILED,
                center=center, intent_id=n,
            )
        ids = [row["id"] for row in rows(operator().get(URL))]
        assert ids == sorted(ids, reverse=True)

    def test_query_count_is_flat(self, django_assert_num_queries):
        """``center_name`` is select_related: no query per incident."""
        from apps.audit.services import audit

        center, _d = make_center_with_director()
        for n in range(10):
            audit(
                actor=None, action=AuditAction.PAYMENT_INTENT_FAILED,
                center=center, intent_id=n,
            )
        client = operator()
        # count + page, and nothing else: the tenant name rides on the
        # select_related. (The operator row is already resolved on the
        # authenticated user instance.)
        with django_assert_num_queries(2):
            response = client.get(URL)
        assert len(rows(response)) == 10
