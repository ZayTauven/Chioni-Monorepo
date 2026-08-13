"""Audit log invariants: writes for anyone, edits for no one."""

import pytest

from apps.audit.models import AuditLog
from apps.common.models import AppendOnlyError

from .factories import make_payment_request, make_user

pytestmark = pytest.mark.django_db


def test_log_records_actor_action_target_and_payload():
    user = make_user()
    pr = make_payment_request()

    entry = AuditLog.log(
        actor=user,
        action="payment_request.created",
        target=pr,
        amount_kmf="7500",
    )

    assert entry.actor == user
    assert entry.target == pr
    assert entry.payload == {"amount_kmf": "7500"}


def test_system_actions_have_no_actor():
    entry = AuditLog.log(actor=None, action="psp.webhook_received")

    assert entry.actor is None
    assert entry.pk is not None


def test_update_is_refused():
    entry = AuditLog.log(actor=None, action="consent.granted")
    entry.action = "consent.rewritten"

    with pytest.raises(AppendOnlyError):
        entry.save()


def test_delete_is_refused():
    entry = AuditLog.log(actor=None, action="consent.granted")

    with pytest.raises(AppendOnlyError):
        entry.delete()


def test_queryset_update_and_delete_are_refused():
    AuditLog.log(actor=None, action="consent.granted")

    with pytest.raises(AppendOnlyError):
        AuditLog.objects.all().update(action="effacé")
    with pytest.raises(AppendOnlyError):
        AuditLog.objects.all().delete()
