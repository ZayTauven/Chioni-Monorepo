"""Zombie ``PaymentIntent`` purge (ADR 0009 addendum, point 3).

``trustbridge.cancel_stale_intents`` (Celery beat, hourly) moves abandoned
``cree``/``en_cours`` intents older than ``PSP_INTENT_STALE_HOURS``
(default 24) to ``annule`` — through the service (row lock + ``save()`` +
system-actor audit), never a raw ``update()``. Fresh pending intents and
terminal intents (``reussi``/``echoue``/``annule``) are NEVER touched: the
ledger stays the only financial truth and a settled intent is history.

When ``psp/stripe.py`` exists, the purge must ALSO cancel provider-side
(documented in the service and the task — nothing to assert here yet).
"""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.trustbridge import services
from apps.trustbridge.models import PaymentIntent
from apps.trustbridge.tasks import cancel_stale_intents_task

from .trustbridge_helpers import Status, build_scenario, signed_webhook

pytestmark = pytest.mark.django_db


def make_pending_intent(*, age: timedelta, status=PaymentIntent.Status.PROCESSING):
    """A pending intent created ``age`` ago, through the real service.

    ``created_at`` (auto_now_add) is then back-dated via queryset
    ``update()`` — test-only clock control on a model that carries no
    ``save()`` invariants (unlike GuardianLink/Invoice, see CLAUDE.md).
    Returns (scenario, intent).
    """
    scn = build_scenario(status=Status.SENT)
    intent = services.create_payment_intent(
        guardian_user=scn.guardian_user, payment_request=scn.payment_request
    )
    PaymentIntent.objects.filter(pk=intent.pk).update(
        status=status, created_at=timezone.now() - age
    )
    intent.refresh_from_db()
    return scn, intent


class TestPurgeCriteria:
    def test_stale_processing_intent_is_cancelled(self):
        _scn, intent = make_pending_intent(age=timedelta(hours=25))

        assert services.cancel_stale_intents() == 1
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.CANCELLED

    def test_stale_created_intent_is_cancelled_too(self):
        _scn, intent = make_pending_intent(
            age=timedelta(hours=25), status=PaymentIntent.Status.CREATED
        )

        assert services.cancel_stale_intents() == 1
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.CANCELLED

    def test_fresh_pending_intent_is_untouched(self):
        _scn, intent = make_pending_intent(age=timedelta(hours=1))

        assert services.cancel_stale_intents() == 0
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING

    def test_terminal_intents_are_untouched_whatever_their_age(self):
        # SUCCEEDED — the money is in the ledger, the intent is history.
        scn = build_scenario(status=Status.PAID)
        PaymentIntent.objects.filter(pk=scn.intent.pk).update(
            created_at=timezone.now() - timedelta(hours=48)
        )
        # FAILED — already settled by the provider.
        _failed_scn, failed_intent = make_pending_intent(age=timedelta(hours=48))
        payload, signature = signed_webhook(
            failed_intent.psp_reference, status="failed"
        )
        services.handle_psp_webhook(payload=payload, signature=signature)

        assert services.cancel_stale_intents() == 0
        scn.intent.refresh_from_db()
        failed_intent.refresh_from_db()
        assert scn.intent.status == PaymentIntent.Status.SUCCEEDED
        assert failed_intent.status == PaymentIntent.Status.FAILED

    def test_stale_hours_setting_is_honoured(self, settings):
        settings.PSP_INTENT_STALE_HOURS = 1
        _scn, intent = make_pending_intent(age=timedelta(hours=2))

        assert services.cancel_stale_intents() == 1
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.CANCELLED

    def test_default_stale_window_is_24_hours(self, settings):
        assert settings.PSP_INTENT_STALE_HOURS == 24


class TestPurgeEffects:
    def test_cancellation_is_audited_as_a_system_action(self):
        _scn, intent = make_pending_intent(age=timedelta(hours=25))

        services.cancel_stale_intents()

        entry = AuditLog.objects.filter(
            action="payment_intent.cancelled", object_id=str(intent.pk)
        ).latest("created_at")
        assert entry.actor is None  # system job — no user behind it
        assert entry.payload["reason"] == "stale"
        assert entry.payload["intent_id"] == intent.pk

    def test_a_cancelled_intent_can_never_cash_in(self):
        """The late-webhook race, resolved on the safe side: once purged,
        a success webhook is refused and writes NOTHING to the ledger (the
        provider-side money becomes a reconciliation case — ADR 0009)."""
        scn, intent = make_pending_intent(age=timedelta(hours=25))
        services.cancel_stale_intents()

        with pytest.raises(ValidationError, match="annulée"):
            services.register_payment_success(intent=intent)
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.SENT
        assert scn.payment_request.ledger_transactions.count() == 0
        assert scn.payment_request.paid_at is None

    def test_the_refused_late_webhook_is_400_and_audited(self):
        """Revue guardian : le refus n'est plus silencieux — le webhook
        « succeeded » arrivant sur un intent purgé répond 400 ET laisse une
        ligne d'audit système (références seules, ``late_webhook_refused``),
        la matière première de la réconciliation avec le PSP (le tuteur a
        peut-être été réellement débité)."""
        scn, intent = make_pending_intent(age=timedelta(hours=25))
        services.cancel_stale_intents()
        payload, signature = signed_webhook(intent.psp_reference)

        response = APIClient().generic(
            "POST",
            "/api/v1/trustbridge/webhooks/psp/",
            data=payload,
            content_type="application/json",
            HTTP_X_PSP_SIGNATURE=signature,
        )

        assert response.status_code == 400
        entry = AuditLog.objects.filter(
            action="payment.webhook_refused", object_id=str(intent.pk)
        ).latest("created_at")
        assert entry.actor is None  # system: the webhook carries no user
        assert entry.payload["reason"] == "late_webhook_refused"
        assert entry.payload["intent_id"] == intent.pk
        assert entry.payload["intent_status"] == PaymentIntent.Status.CANCELLED
        # The refusal recorded evidence, never money.
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.ledger_transactions.count() == 0

    def test_purging_unblocks_nothing_it_should_not(self):
        """One stale, one fresh on DIFFERENT requests: exactly one falls."""
        _scn_old, stale = make_pending_intent(age=timedelta(hours=30))
        _scn_new, fresh = make_pending_intent(age=timedelta(minutes=5))

        assert services.cancel_stale_intents() == 1
        stale.refresh_from_db()
        fresh.refresh_from_db()
        assert stale.status == PaymentIntent.Status.CANCELLED
        assert fresh.status == PaymentIntent.Status.PROCESSING


class TestBeatWiring:
    """The beat schedule (config/settings.py) references the task BY NAME —
    a typo would silently never run anything. Pin the contract here."""

    def test_task_registered_under_its_beat_name(self):
        assert cancel_stale_intents_task.name == "trustbridge.cancel_stale_intents"

    def test_task_runs_through_celery(self):
        """Eager mode in tests: ``delay`` proves end-to-end Celery wiring."""
        _scn, intent = make_pending_intent(age=timedelta(hours=25))

        assert cancel_stale_intents_task.delay().get() == 1
        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.CANCELLED
