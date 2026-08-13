"""Plain helper factories for model tests (no factory_boy — kept sober).

Realistic Comorian demo data: names, towns, KMF tariffs.
"""

from decimal import Decimal
from itertools import count

from django.contrib.auth import get_user_model

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
