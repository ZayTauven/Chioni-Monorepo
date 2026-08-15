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


def make_room(center=None, name=None):
    """A room. Direct ORM on purpose (like ``make_center``): this factory
    sets a STATE — ``create_room`` and its audit have their own tests."""
    from apps.inpatient.models import Room

    return Room.objects.create(
        center=center or make_center(), name=name or f"Chambre {next(_seq)}"
    )


def make_bed(room=None, center=None, name=None, is_active=True):
    """A bed of ``room`` (a room is created in ``center`` when omitted)."""
    from apps.inpatient.models import Bed

    return Bed.objects.create(
        room=room or make_room(center=center),
        name=name or f"Lit {next(_seq)}",
        is_active=is_active,
    )


def make_stay(patient=None, center=None, bed=None, encounter=None,
              admitted_by=None, **kwargs):
    """A stay IN PROGRESS with its pivot encounter (created when omitted).

    Direct ORM on purpose: this factory sets a STATE — the admission
    service, its state machine and its audit are exercised by their own
    tests. ``bed``, when given, is occupied through a real
    ``BedAssignment`` (the exclusivity constraint applies).
    """
    from apps.inpatient.models import BedAssignment, Stay

    center = center or (bed.room.center if bed is not None else make_center())
    patient = patient or make_patient()
    encounter = encounter or make_encounter(patient=patient, center=center)
    admitted_by = admitted_by or make_user()
    kwargs.setdefault("admitted_at", timezone.now() - timedelta(days=1))
    stay = Stay(
        patient=patient, center=center, encounter=encounter,
        admitted_by=admitted_by, **kwargs,
    )
    stay.save()
    if bed is not None:
        BedAssignment.objects.create(
            stay=stay, bed=bed, assigned_at=stay.admitted_at,
            assigned_by=admitted_by,
        )
    return stay


def make_department(center=None, name=None):
    """Un service RH. Direct ORM on purpose (like ``make_center``): this
    factory sets a STATE — ``create_department``, son audit et son gel ont
    leurs propres tests."""
    from apps.hrm.models import Department

    return Department.objects.create(
        center=center or make_center(), name=name or f"Service {next(_seq)}"
    )


def make_job_title(center=None, name=None):
    """Une fonction. Rappel de l'ADR 0020 décision 2 : c'est un LIBELLÉ,
    jamais un droit — aucune permission ne le lit."""
    from apps.hrm.models import JobTitle

    return JobTitle.objects.create(
        center=center or make_center(), name=name or f"Fonction {next(_seq)}"
    )


def make_employment(user=None, center=None, hired_at=None, **kwargs):
    """Un dossier RH — le PIVOT du module (unique par (user, center)).

    Direct ORM on purpose : ``create_employment`` porte la garde « cette
    personne fait partie du personnel » et le gel, testés chez eux. La
    fabrique pose l'ÉTAT dont un scénario a besoin.
    """
    from apps.hrm.models import Employment

    center = center or make_center()
    employment = Employment(
        user=user or make_user(),
        center=center,
        hired_at=hired_at or (timezone.localdate() - timedelta(days=365)),
        **kwargs,
    )
    employment.save()
    return employment


def make_holiday(center=None, date=None, name="Fête de l'Indépendance"):
    from apps.hrm.models import Holiday

    return Holiday.objects.create(
        center=center or make_center(),
        date=date or timezone.localdate(),
        name=name,
    )


def make_attendance(employment=None, date=None, status=None, noted_by=None):
    from apps.hrm.models import AttendanceRecord

    employment = employment or make_employment()
    record = AttendanceRecord(
        employment=employment,
        date=date or timezone.localdate(),
        status=status or AttendanceRecord.Status.PRESENT,
        noted_by=noted_by or make_user(),
    )
    record.save()
    return record


def make_leave(employment=None, leave_type=None, start_date=None,
               end_date=None, status=None, decided_by=None):
    """Une demande de congé dans l'état voulu.

    Direct ORM on purpose : la machine à états, la garde de chevauchement
    et le gel vivent dans ``hrm.services`` et y sont testés. Un état
    terminal reçoit sa ``decided_at`` (contrainte DB
    ``leave_decision_matches_status``).
    """
    from apps.hrm.models import LeaveRequest

    employment = employment or make_employment()
    start_date = start_date or (timezone.localdate() + timedelta(days=7))
    status = status or LeaveRequest.Status.REQUESTED
    leave = LeaveRequest(
        employment=employment,
        leave_type=leave_type or LeaveRequest.Type.ANNUAL,
        start_date=start_date,
        end_date=end_date or (start_date + timedelta(days=4)),
        status=status,
        requested_by=employment.user,
    )
    if status != LeaveRequest.Status.REQUESTED:
        leave.decided_by = decided_by or make_user()
        leave.decided_at = timezone.now()
    leave.save()
    return leave


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
