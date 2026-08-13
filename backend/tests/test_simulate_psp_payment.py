"""Dev command ``simulate_psp_payment`` — plays the provider's part.

Same stage builders as the Trust Bridge API tests: the guardian starts
paying through the domain service (intent frozen in ``en_cours``), then
the command POSTs the signed webhook on the REAL HTTP path. Guards:
DEBUG-only, fake-backend-only.

NB: the test runner forces ``DEBUG=False`` (``setup_test_environment``),
so nominal cases opt back in with ``override_settings(DEBUG=True)`` —
exactly the dev condition the command targets.
"""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.trustbridge import services
from apps.trustbridge.models import PaymentIntent

from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db


def start_payment(scn):
    """The guardian starts paying: intent stuck in ``en_cours``."""
    return services.create_payment_intent(
        guardian_user=scn.guardian_user, payment_request=scn.payment_request
    )


def run_command(*args):
    out = StringIO()
    call_command("simulate_psp_payment", *args, stdout=out)
    return out.getvalue()


class TestSimulatePspPayment:
    @override_settings(DEBUG=True)
    def test_valid_reference_marks_intent_reussi_and_request_payee(self):
        scn = build_scenario()  # SENT, shared with the guardian
        intent = start_payment(scn)
        assert intent.status == PaymentIntent.Status.PROCESSING

        output = run_command(intent.psp_reference)

        intent.refresh_from_db()
        scn.payment_request.refresh_from_db()
        assert intent.status == PaymentIntent.Status.SUCCEEDED
        assert scn.payment_request.status == Status.PAID
        assert intent.psp_reference in output
        assert "HTTP 200" in output

    @override_settings(DEBUG=True)
    def test_fail_flag_marks_intent_echoue_and_request_untouched(self):
        scn = build_scenario()
        intent = start_payment(scn)

        output = run_command(intent.psp_reference, "--fail")

        intent.refresh_from_db()
        scn.payment_request.refresh_from_db()
        assert intent.status == PaymentIntent.Status.FAILED
        assert scn.payment_request.status == Status.SENT
        assert "HTTP 200" in output

    @override_settings(DEBUG=True)
    def test_latest_selects_the_most_recent_pending_intent(self):
        older = build_scenario()
        older_intent = start_payment(older)
        newer = build_scenario()
        newer_intent = start_payment(newer)

        output = run_command("--latest")

        older_intent.refresh_from_db()
        newer_intent.refresh_from_db()
        assert newer_intent.status == PaymentIntent.Status.SUCCEEDED
        assert older_intent.status == PaymentIntent.Status.PROCESSING
        assert newer_intent.psp_reference in output

    @override_settings(DEBUG=True)
    def test_latest_skips_terminal_intents(self):
        pending = build_scenario()
        pending_intent = start_payment(pending)
        build_scenario(status=Status.PAID)  # newer, but its intent is SUCCEEDED

        run_command("--latest")

        pending_intent.refresh_from_db()
        assert pending_intent.status == PaymentIntent.Status.SUCCEEDED

    @override_settings(DEBUG=False)
    def test_refuses_to_run_when_debug_is_false(self):
        scn = build_scenario()
        intent = start_payment(scn)

        with pytest.raises(CommandError, match="DEBUG"):
            call_command("simulate_psp_payment", intent.psp_reference)

        intent.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING  # untouched

    @override_settings(DEBUG=True, PSP_BACKEND="stripe")
    def test_refuses_to_run_when_psp_backend_is_not_fake(self):
        with pytest.raises(CommandError, match="fake"):
            call_command("simulate_psp_payment", "--latest")

    @override_settings(DEBUG=True)
    def test_unknown_reference_is_a_clear_error(self):
        with pytest.raises(CommandError, match="Aucune intention"):
            call_command("simulate_psp_payment", "fake_pi_fantome")

    @override_settings(DEBUG=True)
    def test_latest_without_any_pending_intent_is_a_clear_error(self):
        build_scenario(status=Status.PAID)  # only a terminal intent exists
        with pytest.raises(CommandError, match="non terminale"):
            call_command("simulate_psp_payment", "--latest")

    @override_settings(DEBUG=True)
    def test_requires_a_reference_or_latest(self):
        with pytest.raises(CommandError, match="--latest"):
            call_command("simulate_psp_payment")

    @override_settings(DEBUG=True)
    def test_reference_and_latest_together_are_rejected(self):
        scn = build_scenario()
        intent = start_payment(scn)
        with pytest.raises(CommandError, match="pas les deux"):
            call_command("simulate_psp_payment", intent.psp_reference, "--latest")
