"""Medical domain services — health-record writes, audited (finding M1).

The carnet belongs to the patient (ADR 0002): centers PRODUCE encounters,
prescriptions and record entries, but the rows are anchored on the patient
and readable by them across every center. Tariff data is SNAPSHOTTED on
acts at creation (ADR 0005) — later grid changes never rewrite history.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import AuditAction, audit
from apps.medical.models import (
    ActPerformed,
    Encounter,
    HealthRecordEntry,
    Prescription,
    PrescriptionItem,
)


@transaction.atomic
def create_encounter(*, actor, center, practitioner, patient, reason,
                     diagnosis="", occurred_at=None, tariff_items=(),
                     appointment=None):
    """Record a consultation with its acts (tariff snapshots).

    ``practitioner`` is the acting staff membership (clinical role, resolved
    by the view from the caller's OWN membership in ``center`` — a view can
    never attribute an act to someone else's hat). Every tariff must belong
    to the same center: cross-tenant tariffs are structurally refused.

    ``appointment`` (optional): the scheduling.Appointment this encounter
    fulfils — it is automatically marked « honoré » in the SAME transaction
    (a still-``prevu`` appointment passes through ``arrive`` first, the
    machine never skips a state). Must belong to the same center AND the
    same patient; a terminal appointment (already honored, missed,
    cancelled) is refused and the whole creation rolls back.
    """
    if practitioner.center_id != center.pk:
        raise ValidationError("Le praticien n'appartient pas à ce centre.")
    for tariff in tariff_items:
        if tariff.center_id != center.pk:
            raise ValidationError(
                "Un acte ne peut référencer qu'un tarif de la grille de ce centre."
            )
    if appointment is not None:
        if appointment.center_id != center.pk:
            raise ValidationError("Ce rendez-vous n'appartient pas à ce centre.")
        if appointment.patient_id != patient.pk:
            raise ValidationError("Ce rendez-vous ne concerne pas ce patient.")
        # Local import: medical must stay importable without the scheduling
        # app's service layer loaded (one-way dependency, no cycle).
        from apps.scheduling.services import honor_appointment_from_encounter

        honor_appointment_from_encounter(appointment)
    extra = {"occurred_at": occurred_at} if occurred_at else {}
    encounter = Encounter.objects.create(
        patient=patient,
        center=center,
        practitioner=practitioner,
        reason=reason,
        diagnosis=diagnosis,
        **extra,
    )
    for tariff in tariff_items:
        ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)
    audit(
        actor=actor, action=AuditAction.ENCOUNTER_CREATED, target=encounter,
        encounter_id=encounter.pk, center_id=center.pk,
        patient_id=patient.pk, acts=len(tariff_items),
    )
    return encounter


def _require_open_encounter(encounter, what):
    """S1 — clinical production stops once the consultation is closed.

    A closed (« terminee ») or cancelled encounter refuses new
    prescriptions and record entries with an explicit 400: post-closure
    additions would rewrite a consultation the patient already left.
    Billing an already-closed encounter stays ALLOWED (the invoice is
    routinely built after the care ends — decision documented in the
    ADR 0008 S1 addendum).
    """
    if encounter.status != Encounter.Status.IN_PROGRESS:
        raise ValidationError(
            f"Cette consultation est {encounter.get_status_display().lower()} : "
            f"{what} ne peut plus y être ajoutée."
        )


@transaction.atomic
def close_encounter(*, actor, encounter):
    """Clinical staff closes a consultation: en_cours → terminee (S1).

    ``annulee`` is deliberately OUT of this sprint's scope: cancelling an
    encounter that carries billed acts raises the cascade question of its
    invoice — to be designed together, not implied here.
    """
    if encounter.status == Encounter.Status.COMPLETED:
        raise ValidationError("Cette consultation est déjà terminée.")
    if encounter.status == Encounter.Status.CANCELLED:
        raise ValidationError(
            "Cette consultation est annulée : elle ne peut pas être terminée."
        )
    encounter.status = Encounter.Status.COMPLETED
    encounter.save(update_fields=["status", "updated_at"])
    audit(
        actor=actor, action=AuditAction.ENCOUNTER_CLOSED, target=encounter,
        encounter_id=encounter.pk, center_id=encounter.center_id,
        patient_id=encounter.patient_id,
    )
    return encounter


@transaction.atomic
def create_prescription(*, actor, encounter, items):
    """Issue a prescription on an encounter (items: dicts medication/dosage)."""
    if not items:
        raise ValidationError("Une ordonnance doit contenir au moins une ligne.")
    _require_open_encounter(encounter, "une ordonnance")
    prescription = Prescription.objects.create(encounter=encounter)
    for item in items:
        PrescriptionItem.objects.create(
            prescription=prescription,
            medication=item["medication"],
            dosage=item.get("dosage", ""),
        )
    audit(
        actor=actor, action=AuditAction.PRESCRIPTION_CREATED, target=prescription,
        prescription_id=prescription.pk, encounter_id=encounter.pk,
        patient_id=encounter.patient_id, center_id=encounter.center_id,
        items=len(items),
    )
    return prescription


@transaction.atomic
def create_record_entry(*, actor, encounter, entry_type, content):
    """Add a carnet entry sourced from an encounter (allergy, history…)."""
    _require_open_encounter(encounter, "une entrée de carnet")
    entry = HealthRecordEntry.objects.create(
        patient=encounter.patient,
        entry_type=entry_type,
        content=content,
        source_encounter=encounter,
    )
    audit(
        actor=actor, action=AuditAction.RECORD_ENTRY_CREATED, target=entry,
        entry_id=entry.pk, encounter_id=encounter.pk,
        patient_id=encounter.patient_id, center_id=encounter.center_id,
        entry_type=str(entry_type),
    )
    return entry
