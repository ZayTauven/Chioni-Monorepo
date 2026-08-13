"""Scenario builders for Trust Bridge tests (phase B).

``build_scenario`` advances a complete, realistic stage (Comorian names,
KMF tariffs, a deliberately SENSITIVE act label to catch any leak) up to
the requested ``PaymentRequest`` status — EXCLUSIVELY through the domain
services, which are the only legal write paths.
"""

from types import SimpleNamespace

from apps.centers.models import StaffMembership
from apps.common.models import ActCategory
from apps.medical.models import ActPerformed
from apps.trustbridge import services
from apps.trustbridge.models import PaymentRequest
from apps.trustbridge.psp.fake import FakePsp

from .api_helpers import (
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_encounter, make_tariff

Role = StaffMembership.Role
Status = PaymentRequest.Status

#: A label that MUST NEVER surface in any guardian payload (ADR 0005).
SENSITIVE_LABEL = "Sérologie VIH"


def build_scenario(
    *,
    status=Status.SENT,
    tariff_label=SENSITIVE_LABEL,
    generic_category=ActCategory.ANALYSES_EXAMENS,
    price_kmf="15000",
    center=None,
    director=None,
):
    """A full Trust Bridge stage advanced to ``status`` via services only.

    Returns a namespace with every actor and artefact of the flow.
    """
    if center is None:
        center, director = make_center_with_director()
    cashier = make_staff_user(center, role=Role.CASHIER)
    doctor = make_staff_user(center, role=Role.DOCTOR)
    patient = make_claimed_patient(first_name="Mariama", last_name="Ahamada")
    guardian_user, guardian_profile = make_guardian_user()
    link = make_active_link(guardian_profile, patient)
    encounter = make_encounter(patient=patient, center=center)
    tariff = make_tariff(center, label=tariff_label, price_kmf=price_kmf)
    tariff.generic_category = generic_category
    tariff.save()
    act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)

    invoice = services.create_invoice(
        actor=cashier, center=center, encounter=encounter
    )
    scn = SimpleNamespace(
        center=center, director=director, cashier=cashier, doctor=doctor,
        patient=patient, patient_user=patient.user,
        guardian_user=guardian_user, guardian_profile=guardian_profile,
        link=link, encounter=encounter, tariff=tariff, act=act,
        invoice=invoice, payment_request=None, intent=None, receipt=None,
    )
    if status == "facture_brouillon":
        return scn
    services.issue_invoice(actor=cashier, invoice=invoice)
    pr = services.create_payment_request(actor=cashier, invoice=invoice)
    scn.payment_request = pr
    if status == Status.DRAFT:
        return scn
    services.share_payment_request(
        actor=cashier, payment_request=pr, guardian_link=link
    )
    services.send_payment_request(actor=cashier, payment_request=pr)
    pr.refresh_from_db()
    if status == Status.SENT:
        return scn
    scn.intent = services.create_payment_intent(
        guardian_user=guardian_user, payment_request=pr
    )
    services.register_payment_success(intent=scn.intent)
    scn.intent.refresh_from_db()
    pr.refresh_from_db()
    if status == Status.PAID:
        return scn
    services.confirm_care(actor=doctor, payment_request=pr)
    pr.refresh_from_db()
    if status == Status.CARE_CONFIRMED:
        return scn
    scn.receipt = services.close_payment_request(actor=cashier, payment_request=pr)
    pr.refresh_from_db()
    return scn


def add_shared_guardian(scn):
    """A SECOND guardian of the same patient, shared on the same request
    (multi-tuteurs: chaque tuteur partagé voit et peut payer)."""
    guardian_user, guardian_profile = make_guardian_user()
    link = make_active_link(guardian_profile, scn.patient)
    services.share_payment_request(
        actor=scn.cashier,
        payment_request=scn.payment_request,
        guardian_link=link,
    )
    return SimpleNamespace(
        guardian_user=guardian_user, guardian_profile=guardian_profile, link=link
    )


def signed_webhook(reference, status="succeeded"):
    """A (payload, signature) pair as the provider would send it."""
    return FakePsp.build_webhook(reference=reference, status=status)
