"""Plain helper factories for model tests (no factory_boy — kept sober).

Realistic Comorian demo data: names, towns, KMF tariffs.
"""

from datetime import timedelta
from decimal import Decimal
from itertools import count

from django.contrib.auth import get_user_model
from django.db.models import Max
from django.utils import timezone

from apps.accounts.models import PlatformStaff
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPlan,
)
from apps.centers.models import HealthCenter, StaffMembership, TariffItem
from apps.medical.models import ActPerformed, Encounter
from apps.patients.models import GuardianLink, GuardianProfile, PatientProfile
from apps.trustbridge.models import (
    Invoice,
    InvoiceLine,
    LedgerEntry,
    LedgerTransaction,
    PaymentRequest,
)

_seq = count(1)


def make_user(username=None, phone=None):
    n = next(_seq)
    return get_user_model().objects.create_user(
        username=username or f"user{n}",
        password="test-password",
        phone=phone or f"+26932100{n:03d}",
    )


def make_center(name="Clinique Salama", **kwargs):
    defaults = {
        "type": HealthCenter.Type.PRIVATE_CLINIC,
        "island": HealthCenter.Island.NGAZIDJA,
        "city": "Moroni",
        "kyc_status": HealthCenter.KycStatus.ACTIVE,
    }
    defaults.update(kwargs)
    return HealthCenter.objects.create(name=name, **defaults)


def make_platform_staff(user=None, role=PlatformStaff.Role.ADMIN, is_active=True):
    """A Chioni operator — the FOURTH hat (S4, ADR 0017).

    Returns (user, platform_staff). NB: the user carries NO ``is_staff``
    flag on purpose — admin flags are not product rights.
    """
    user = user or make_user()
    operator = PlatformStaff.objects.create(
        user=user, role=role, is_active=is_active
    )
    return user, operator


def make_plan(code=None, price_kmf="25000", **kwargs):
    """A SaaS offer (S5, ADR 0018). Quotas default to None = unlimited,
    so a plain plan never makes a center « over quota » by accident."""
    defaults = {
        "name": "Essentiel",
        "billing_period": SubscriptionPlan.BillingPeriod.MONTHLY,
        "is_active": True,
    }
    defaults.update(kwargs)
    return SubscriptionPlan.objects.create(
        code=code or f"PLAN{next(_seq):03d}",
        price_kmf=Decimal(price_kmf),
        **defaults,
    )


def make_subscription(center=None, plan=None, status=None, **kwargs):
    """A center's subscription. Direct ORM on purpose (like ``make_center``
    for ``kyc_status``): this factory sets a STATE, the state machine of
    ``billing.services`` is exercised by its own tests."""
    return CenterSubscription.objects.create(
        center=center or make_center(),
        plan=plan or make_plan(),
        status=status or CenterSubscription.Status.ACTIVE,
        **kwargs,
    )


def make_subscription_invoice(
    subscription=None, *, amount_kmf="25000", period_start=None,
    due_date=None, status=SubscriptionInvoice.Status.ISSUED, days_overdue=None,
):
    """A SaaS invoice (S5 lot 2). Direct ORM on purpose, like
    ``make_subscription``: this factory sets a STATE — the issuance
    service, its numbering and its state machine are exercised by their own
    tests.

    ``days_overdue`` places the échéance N days in the PAST (the shortcut
    every dunning/flagging test needs).
    """
    subscription = subscription or make_subscription()
    today = timezone.localdate()
    if period_start is None:
        period_start = today.replace(day=1)
    if due_date is None:
        due_date = (
            today - timedelta(days=days_overdue)
            if days_overdue is not None
            else period_start + timedelta(days=15)
        )
    last = (
        SubscriptionInvoice.objects.aggregate(m=Max("sequence_number"))["m"] or 0
    )
    return SubscriptionInvoice.objects.create(
        center=subscription.center,
        subscription=subscription,
        sequence_number=last + 1,
        period_start=min(period_start, due_date),
        period_end=period_start + timedelta(days=29),
        amount_kmf=Decimal(amount_kmf),
        plan_code=subscription.plan.code,
        plan_label=subscription.plan.name,
        due_date=due_date,
        status=status,
    )


def make_support_ticket(center=None, opened_by=None, **kwargs):
    """A support ticket (S5 lot 3). Direct ORM on purpose, like
    ``make_subscription``: this factory sets a STATE — the opening
    service, its audit and its state machine are exercised by their own
    tests."""
    from apps.support.models import SupportTicket

    defaults = {
        "subject": "Le sélecteur de tarifs reste vide",
        "category": SupportTicket.Category.BUG,
        "status": SupportTicket.Status.OPEN,
        "priority": SupportTicket.Priority.NORMAL,
    }
    defaults.update(kwargs)
    center = center or make_center()
    return SupportTicket.objects.create(
        center=center, opened_by=opened_by or make_user(), **defaults
    )


def make_staff(user=None, center=None, role=StaffMembership.Role.DOCTOR):
    return StaffMembership.objects.create(
        user=user or make_user(),
        center=center or make_center(),
        role=role,
    )


def make_tariff(center, code=None, label="Consultation générale", price_kmf="7500"):
    return TariffItem.objects.create(
        center=center,
        code=code or f"CS{next(_seq):03d}",
        label=label,
        price_kmf=Decimal(price_kmf),
    )


def make_patient(first_name="Mariama", last_name="Ahamada", **kwargs):
    kwargs.setdefault("city", "Mitsamiouli")
    return PatientProfile.objects.create(
        first_name=first_name, last_name=last_name, **kwargs
    )


def make_guardian(user=None, **kwargs):
    return GuardianProfile.objects.create(user=user or make_user(), **kwargs)


def make_link(guardian=None, patient=None, status=GuardianLink.Status.ACTIVE):
    return GuardianLink.objects.create(
        guardian=guardian or make_guardian(),
        patient=patient or make_patient(),
        relationship=GuardianLink.Relationship.CHILD,
        status=status,
        initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
    )


def make_appointment(
    patient=None, center=None, practitioner=None, scheduled_at=None,
    created_by=None, **kwargs,
):
    """Direct ORM creation (bypasses the service's past-guard on purpose:
    tests need historical rows too). Default slot: tomorrow 10:00 local."""
    from datetime import datetime, time, timedelta

    from django.utils import timezone

    from apps.scheduling.models import Appointment

    center = center or make_center()
    if scheduled_at is None:
        scheduled_at = timezone.make_aware(
            datetime.combine(timezone.localdate() + timedelta(days=1), time(10, 0))
        )
    return Appointment.objects.create(
        center=center,
        patient=patient or make_patient(),
        practitioner=practitioner,
        scheduled_at=scheduled_at,
        created_by=created_by or make_user(),
        **kwargs,
    )


def make_encounter(patient=None, center=None, practitioner=None, **kwargs):
    center = center or make_center()
    kwargs.setdefault("reason", "Céphalées et tension élevée")
    return Encounter.objects.create(
        patient=patient or make_patient(),
        center=center,
        practitioner=practitioner or make_staff(center=center),
        **kwargs,
    )


def make_act(encounter=None, tariff_item=None):
    encounter = encounter or make_encounter()
    return ActPerformed.objects.create(
        encounter=encounter,
        tariff_item=tariff_item or make_tariff(encounter.center),
    )


def make_invoice(encounter=None, with_lines=True, status=Invoice.Status.ISSUED):
    """Build the invoice in DRAFT (lines are only writable there — M4),
    then transition to the requested status (default: issued)."""
    encounter = encounter or make_encounter()
    invoice = Invoice.objects.create(
        encounter=encounter,
        center=encounter.center,
        patient=encounter.patient,
        status=Invoice.Status.DRAFT,
    )
    if with_lines:
        act = make_act(encounter=encounter)
        InvoiceLine.objects.create(invoice=invoice, act=act)
        invoice.recompute_total()
    if status != Invoice.Status.DRAFT:
        invoice.status = status
        invoice.save(update_fields=["status", "updated_at"])
    return invoice


def make_payment_request(invoice=None, created_by=None, **kwargs):
    invoice = invoice or make_invoice()
    kwargs.setdefault("status", PaymentRequest.Status.SENT)
    return PaymentRequest.objects.create(
        invoice=invoice,
        created_by=created_by or make_user(),
        **kwargs,
    )


def make_ledger_tx(payment_request=None, description="Paiement tuteur", amount="50.00"):
    """A minimal balanced EUR transaction through the ONLY legal path."""
    return LedgerTransaction.record(
        description=description,
        payment_request=payment_request,
        entries=[
            {
                "account": LedgerEntry.Account.GUARDIAN_FUNDS,
                "direction": LedgerEntry.Direction.DEBIT,
                "amount": Decimal(amount),
                "currency": "EUR",
            },
            {
                "account": LedgerEntry.Account.DUE_TO_CENTER,
                "direction": LedgerEntry.Direction.CREDIT,
                "amount": Decimal(amount),
                "currency": "EUR",
            },
        ],
    )
