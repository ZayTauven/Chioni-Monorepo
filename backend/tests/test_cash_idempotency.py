"""S1 — counter idempotency (vigilance 2a soldée, ADR 0015 addendum).

An optional ``idempotency_key`` on `POST /centers/{c}/invoices/{pk}/payments/`
makes the request replayable: the same key answers 200 with the SAME
payment and the SAME receipt — never a second cash-in, never a second
ledger transaction, never a second audit entry. Concurrency is arbitrated
by the invoice row lock (same invoice) and the DB unique constraint
(anything else) — real threads below.
"""

import threading
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connections

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, CashReceipt, LedgerTransaction

from .api_helpers import client_for
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db

Method = CashPayment.Method


def counter_scenario(price_kmf="20000"):
    scn = build_scenario(status="facture_brouillon", price_kmf=price_kmf)
    services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
    scn.invoice.refresh_from_db()
    return scn


def payments_url(scn, invoice=None):
    invoice = invoice or scn.invoice
    return f"/api/v1/centers/{scn.center.pk}/invoices/{invoice.pk}/payments/"


def post_payment(scn, amount="5000", key=None, **extra):
    body = {"method": "especes", "amount_kmf": amount, **extra}
    if key is not None:
        body["idempotency_key"] = key
    return client_for(scn.cashier).post(payments_url(scn), body)


class TestReplayContract:
    def test_replaying_the_same_key_returns_the_same_payment_and_receipt(self):
        scn = counter_scenario()
        first = post_payment(scn, key="caisse-1")
        assert first.status_code == 201, first.content
        replay = post_payment(scn, key="caisse-1")
        assert replay.status_code == 200, replay.content  # rien de nouveau
        assert replay.data["id"] == first.data["id"]
        assert (
            replay.data["receipt"]["receipt_number"]
            == first.data["receipt"]["receipt_number"]
        )
        assert CashPayment.objects.count() == 1
        assert CashReceipt.objects.count() == 1
        assert (
            AuditLog.objects.filter(
                action=AuditAction.CASH_PAYMENT_RECORDED
            ).count()
            == 1
        )

    def test_replay_after_the_invoice_is_settled_still_answers_200(self):
        """The payment that SETTLED the invoice must stay replayable — the
        « déjà réglée » refusal must never mask the replay of its own
        receipt (the timeout-retry case this feature exists for)."""
        scn = counter_scenario(price_kmf="5000")
        first = post_payment(scn, amount="5000", key="solde-total")
        assert first.status_code == 201
        replay = post_payment(scn, amount="5000", key="solde-total")
        assert replay.status_code == 200
        assert replay.data["id"] == first.data["id"]

    def test_no_key_keeps_the_old_behavior(self):
        scn = counter_scenario()
        assert post_payment(scn, amount="3000").status_code == 201
        assert post_payment(scn, amount="3000").status_code == 201
        assert CashPayment.objects.count() == 2

    def test_ledger_is_written_exactly_once(self):
        scn = counter_scenario()
        before = LedgerTransaction.objects.count()
        post_payment(scn, key="grand-livre")
        post_payment(scn, key="grand-livre")
        assert LedgerTransaction.objects.count() == before + 1


class TestReplayMismatches:
    def test_same_key_with_a_different_amount_is_refused(self):
        scn = counter_scenario()
        assert post_payment(scn, amount="5000", key="k1").status_code == 201
        mismatch = post_payment(scn, amount="7000", key="k1")
        assert mismatch.status_code == 400
        assert "clé d'idempotence" in str(mismatch.data)
        assert CashPayment.objects.count() == 1

    def test_same_key_on_another_invoice_is_refused(self):
        scn = counter_scenario()
        assert post_payment(scn, key="k1").status_code == 201
        other = build_scenario(
            status="facture_brouillon", center=scn.center, director=scn.director
        )
        services.issue_invoice(actor=scn.cashier, invoice=other.invoice)
        mismatch = client_for(scn.cashier).post(
            payments_url(scn, invoice=other.invoice),
            {"method": "especes", "amount_kmf": "5000", "idempotency_key": "k1"},
        )
        assert mismatch.status_code == 400
        assert CashPayment.objects.count() == 1

    def test_the_same_key_in_two_different_centers_is_independent(self):
        """The uniqueness is PER CENTER: two tenants can use the same key
        without colliding (no cross-tenant coupling through a constraint)."""
        scn_a = counter_scenario()
        scn_b = counter_scenario()
        assert post_payment(scn_a, key="janvier-001").status_code == 201
        assert post_payment(scn_b, key="janvier-001").status_code == 201
        assert CashPayment.objects.count() == 2

    def test_blank_key_in_json_is_a_serializer_400(self):
        """JSON contract (what the frontend sends): an explicitly blank
        key is a client bug → 400. (Form data treats '' as an absent
        optional field — standard DRF HTML-input semantics — which the
        service then handles as « no key »: harmless either way.)"""
        scn = counter_scenario()
        response = client_for(scn.cashier).post(
            payments_url(scn),
            {"method": "especes", "amount_kmf": "5000", "idempotency_key": ""},
            format="json",
        )
        assert response.status_code == 400
        assert "idempotency_key" in response.data

    def test_whitespace_key_is_treated_as_absent_by_the_service(self):
        scn = counter_scenario()
        payment = services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method=Method.CASH, amount_kmf=Decimal("1000"),
            idempotency_key="   ",
        )
        assert payment.idempotency_key is None


class TestReplayConcurrency:
    @pytest.mark.django_db(transaction=True)
    def test_two_simultaneous_requests_with_the_same_key_cash_in_once(self):
        """Real threads, real commits: the invoice row lock serialises the
        pair — exactly ONE CashPayment exists afterwards and BOTH callers
        end up holding the same payment (created or replayed)."""
        scn = counter_scenario()
        barrier = threading.Barrier(2, timeout=10)
        results, errors = [], []

        def attempt(user):
            try:
                barrier.wait()
                payment = services.record_cash_payment(
                    actor=user, center=scn.center, invoice=scn.invoice,
                    method=Method.CASH, amount_kmf=Decimal("5000"),
                    idempotency_key="course-reelle",
                )
                results.append((payment.pk, getattr(payment, "was_replayed", False)))
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(user,))
            for user in (scn.cashier, scn.director)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)

        assert errors == []
        assert len(results) == 2
        pks = {pk for pk, _replayed in results}
        assert len(pks) == 1  # the SAME payment for both callers
        assert sorted(r for _pk, r in results) == [False, True]
        assert CashPayment.objects.filter(invoice=scn.invoice).count() == 1
        assert CashReceipt.objects.count() == 1
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("5000")

    @pytest.mark.django_db(transaction=True)
    def test_same_key_race_on_two_invoices_creates_exactly_one_payment(self):
        """DIFFERENT invoices → different lock rows: the DB unique
        constraint arbitrates. One caller wins; the loser's transaction
        (ledger included) rolls back and surfaces the explicit mismatch
        400 — never two payments under one key."""
        scn = counter_scenario()
        other = build_scenario(
            status="facture_brouillon", center=scn.center, director=scn.director
        )
        services.issue_invoice(actor=scn.cashier, invoice=other.invoice)
        barrier = threading.Barrier(2, timeout=10)
        outcomes, errors = [], []

        def attempt(invoice):
            try:
                barrier.wait()
                services.record_cash_payment(
                    actor=scn.cashier, center=scn.center, invoice=invoice,
                    method=Method.CASH, amount_kmf=Decimal("5000"),
                    idempotency_key="cle-partagee",
                )
                outcomes.append("recorded")
            except ValidationError:
                outcomes.append("refused")
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(invoice,))
            for invoice in (scn.invoice, other.invoice)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)

        assert errors == []
        assert sorted(outcomes) == ["recorded", "refused"]
        assert (
            CashPayment.objects.filter(idempotency_key="cle-partagee").count() == 1
        )
        # The loser's ledger transaction rolled back with it: one cash-in,
        # one balanced transaction (plus nothing orphaned).
        assert CashReceipt.objects.count() == 1
