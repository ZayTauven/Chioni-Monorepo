"""Audit contract, phase B: EVERY money action writes its entry.

Same discipline as ``test_services_audit.py`` (phase A): one sensitive
action → count AuditLog rows PER ACTION — removing an ``audit()`` call
from a trustbridge service makes this file fail. Also locks the ADR
0005/0007 payload contract for money: references, amounts and currencies
only — NEVER an act label, NEVER the free text of a dispute.
"""

import json

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.trustbridge import services

from .trustbridge_helpers import (
    SENSITIVE_LABEL,
    Status,
    build_scenario,
    signed_webhook,
)

pytestmark = pytest.mark.django_db


def count(action):
    return AuditLog.objects.filter(action=action).count()


def payload_of(action):
    return AuditLog.objects.filter(action=action).latest("id").payload


class TestMoneyActionsAreAudited:
    def test_the_full_flow_writes_every_expected_entry_once(self):
        """One nominal flow → exactly one entry per money action."""
        scn = build_scenario(status=Status.CLOSED)

        assert count(AuditAction.INVOICE_CREATED) == 1
        assert count(AuditAction.INVOICE_ISSUED) == 1
        assert count(AuditAction.PAYMENT_REQUEST_CREATED) == 1
        assert count(AuditAction.PAYMENT_REQUEST_SHARED) == 1
        assert count(AuditAction.PAYMENT_REQUEST_SENT) == 1
        assert count(AuditAction.PAYMENT_INTENT_CREATED) == 1
        assert count(AuditAction.PAYMENT_RECORDED) == 1
        assert count(AuditAction.CARE_CONFIRMED) == 1
        assert count(AuditAction.PAYMENT_REQUEST_CLOSED) == 1
        # Not part of the nominal flow:
        assert count(AuditAction.PAYMENT_REQUEST_UNSHARED) == 0
        assert count(AuditAction.DISPUTE_OPENED) == 0

    def test_unshare_is_audited(self):
        scn = build_scenario(status=Status.SENT)
        services.unshare_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        assert count(AuditAction.PAYMENT_REQUEST_UNSHARED) == 1

    def test_patient_acknowledgement_is_audited(self):
        scn = build_scenario(status=Status.PAID)
        services.acknowledge_care_received(
            patient_user=scn.patient_user, payment_request=scn.payment_request
        )
        assert count(AuditAction.PATIENT_CARE_ACKNOWLEDGED) == 1

    def test_payment_failure_is_audited(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(intent.psp_reference, status="failed")
        services.handle_psp_webhook(payload=payload, signature=signature)
        assert count(AuditAction.PAYMENT_INTENT_FAILED) == 1

    def test_webhook_replay_does_not_double_the_audit_trail(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        payload, signature = signed_webhook(intent.psp_reference)
        services.handle_psp_webhook(payload=payload, signature=signature)
        services.handle_psp_webhook(payload=payload, signature=signature)
        assert count(AuditAction.PAYMENT_RECORDED) == 1

    def test_dispute_lifecycle_is_audited(self):
        scn = build_scenario(status=Status.SENT)
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request,
            reason="Je conteste ce montant, mon frère a payé sur place",
        )
        services.resolve_dispute(
            actor=scn.director, dispute=dispute,
            resolution_note="Double paiement vérifié et remboursé au guichet",
        )
        assert count(AuditAction.DISPUTE_OPENED) == 1
        assert count(AuditAction.DISPUTE_RESOLVED) == 1


class TestMoneyPayloadContract:
    def test_payment_recorded_payload_carries_references_and_amounts_only(self):
        build_scenario(status=Status.PAID)
        payload = payload_of(AuditAction.PAYMENT_RECORDED)
        # References and amounts present…
        for key in (
            "payment_request_id", "intent_id", "ledger_transaction_id",
            "center_id", "amount_eur", "fees_eur", "amount_kmf",
            "exchange_rate", "currency_paid", "currency_received",
        ):
            assert key in payload, key
        # …and no act label anywhere (ADR 0005: never in a money payload).
        assert SENSITIVE_LABEL not in json.dumps(payload)

    def test_no_trustbridge_payload_ever_carries_the_act_label(self):
        scn = build_scenario(status=Status.CLOSED)
        services.acknowledge_care_received(
            patient_user=scn.patient_user, payment_request=scn.payment_request
        )
        dump = json.dumps(list(AuditLog.objects.values_list("payload", flat=True)))
        assert SENSITIVE_LABEL not in dump
        assert "VIH" not in dump

    def test_dispute_payloads_never_carry_the_free_text(self):
        """Reason/resolution are typed by humans (possible PII or clinical
        hints): ADR 0007 keeps them OUT of the audit payload."""
        scn = build_scenario(status=Status.SENT)
        secret = "mon frère est séropositif"
        dispute = services.open_dispute(
            actor_user=scn.guardian_user,
            payment_request=scn.payment_request, reason=secret,
        )
        services.resolve_dispute(
            actor=scn.director, dispute=dispute,
            resolution_note="vérifié en confiance avec la famille",
        )
        dump = json.dumps(list(AuditLog.objects.values_list("payload", flat=True)))
        assert secret not in dump
        assert "vérifié en confiance" not in dump
        assert payload_of(AuditAction.DISPUTE_OPENED)["dispute_id"] == dispute.pk
