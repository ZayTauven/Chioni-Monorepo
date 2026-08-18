"""Medical domain services — health-record writes, audited (finding M1).

The carnet belongs to the patient (ADR 0002): centers PRODUCE encounters,
prescriptions and record entries, but the rows are anchored on the patient
and readable by them across every center. Tariff data is SNAPSHOTTED on
acts at creation (ADR 0005) — later grid changes never rewrite history.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.common.uploads import process_image_upload
from apps.medical.models import (
    ActPerformed,
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    PrescriptionItem,
    VitalSigns,
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
        center=center,
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


def _require_no_live_stay(encounter):
    """S6 (revue guardian) — le pivot d'un séjour EN COURS ne se ferme pas.

    La décision 1 de l'ADR 0019 fait reposer TOUTE la production clinique
    d'une hospitalisation sur une consultation « ouverte du premier au
    dernier jour ». Rien n'empêchait un clinicien qui range sa liste de
    consultations de fermer ce pivot pendant que le patient est couché : à
    partir de là, :func:`_require_open_encounter` refusait DÉFINITIVEMENT
    toute mesure de surveillance, toute ordonnance et toute entrée de
    carnet pour cet hospitalisé — aucune route ne rouvre une consultation,
    et la sortie « tolère un pivot déjà fermé », donc rien ne le signalait
    jamais.

    La sortie et l'annulation d'un séjour posent l'état terminal AVANT
    d'appeler la clôture : elles passent ici sans encombre. La lecture est
    faite EN BASE (jamais sur l'instance en mémoire, qui peut être périmée).
    """
    # Import local : ``medical`` doit rester importable sans le module
    # d'hospitalisation (qui, lui, importe ce service — dépendance à sens
    # unique, aucun cycle).
    from apps.inpatient.models import Stay

    live = Stay.objects.filter(
        encounter_id=encounter.pk, status=Stay.Status.IN_PROGRESS
    ).exists()
    if live:
        raise ValidationError(
            "Ce patient est hospitalisé : cette consultation est le pivot de "
            "son séjour et se clôture à sa sortie."
        )


@transaction.atomic
def close_encounter(*, actor, encounter):
    """Clinical staff closes a consultation: en_cours → terminee (S1).

    ``annulee`` is deliberately OUT of this sprint's scope: cancelling an
    encounter that carries billed acts raises the cascade question of its
    invoice — to be designed together, not implied here.

    S6: an encounter that is the PIVOT of a live stay is refused here — see
    :func:`_require_no_live_stay`.

    SV — the encounter row is LOCKED: the closure and
    :func:`create_prescription` used to read the status on the in-memory
    instance only, letting a prescription slip into the second of the
    closure (TOCTOU consigné en S1, fermé ici — le verrou était trivial).
    Both services re-read under ``select_for_update`` so they serialise;
    single-row lock, no hierarchy to respect.
    """
    encounter = Encounter.objects.select_for_update().get(pk=encounter.pk)
    if encounter.status == Encounter.Status.COMPLETED:
        raise ValidationError("Cette consultation est déjà terminée.")
    if encounter.status == Encounter.Status.CANCELLED:
        raise ValidationError(
            "Cette consultation est annulée : elle ne peut pas être terminée."
        )
    _require_no_live_stay(encounter)
    encounter.status = Encounter.Status.COMPLETED
    encounter.save(update_fields=["status", "updated_at"])
    audit(
        actor=actor, action=AuditAction.ENCOUNTER_CLOSED, target=encounter,
        center=encounter.center,
        encounter_id=encounter.pk, center_id=encounter.center_id,
        patient_id=encounter.patient_id,
    )
    return encounter


@transaction.atomic
def create_prescription(*, actor, encounter, items):
    """Issue a prescription on an encounter (items: dicts medication/dosage).

    SV — the encounter row is re-read under ``select_for_update`` before
    the open-encounter check: a closure racing this call now serialises
    (before, a prescription could slip into the second of the closure —
    TOCTOU consigné en S1)."""
    if not items:
        raise ValidationError("Une ordonnance doit contenir au moins une ligne.")
    encounter = Encounter.objects.select_for_update().get(pk=encounter.pk)
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
        center=encounter.center,
        prescription_id=prescription.pk, encounter_id=encounter.pk,
        patient_id=encounter.patient_id, center_id=encounter.center_id,
        items=len(items),
    )
    return prescription


@transaction.atomic
def deliver_prescription(*, actor, prescription):
    """Le comptoir sert l'ordonnance — dette C.1 soldée (S9, ADR 0022 §6).

    Geste du pharmacien du centre (ou d'un soignant, dans les centres qui
    n'ont pas d'officine interne — la majorité aux Comores) : il dit que
    les médicaments ont été remis.

    **Sans marche arrière.** L'état est relu sous verrou de ligne : deux
    comptoirs qui cliquent à la même seconde se sérialisent, le perdant
    relit l'état du gagnant et reçoit un refus français — jamais un 500,
    jamais une seconde entrée d'audit pour le même geste.

    Volontairement NON conditionné à l'état de la consultation : les
    médicaments se retirent souvent après la clôture de la visite, et
    refuser reviendrait à empêcher de tracer ce qui s'est réellement passé.
    Volontairement NON gelable non plus, et sans garde KYC : servir un
    patient ne dépend pas de la situation commerciale du centre.
    """
    locked = Prescription.objects.select_for_update().get(pk=prescription.pk)
    if locked.status == Prescription.Status.DELIVERED:
        raise ValidationError("Cette ordonnance a déjà été délivrée.")
    locked.status = Prescription.Status.DELIVERED
    locked.delivered_at = timezone.now()
    locked.delivered_by = actor
    locked.save(
        update_fields=["status", "delivered_at", "delivered_by", "updated_at"]
    )
    encounter = locked.encounter
    audit(
        actor=actor, action=AuditAction.PRESCRIPTION_DELIVERED, target=locked,
        center=encounter.center,
        prescription_id=locked.pk, encounter_id=encounter.pk,
        patient_id=encounter.patient_id, center_id=encounter.center_id,
    )
    # L'instance de l'appelant reste cohérente (les vues la sérialisent).
    prescription.status = locked.status
    prescription.delivered_at = locked.delivered_at
    prescription.delivered_by = locked.delivered_by
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
        center=encounter.center,
        entry_id=entry.pk, encounter_id=encounter.pk,
        patient_id=encounter.patient_id, center_id=encounter.center_id,
        entry_type=str(entry_type),
    )
    return entry


# ---------------------------------------------------------------------------
# S3 (ADR 0016) — enriched patient record: medical file, vital signs,
# documents. Clinical sphere: the VIEWS gate the roles (CLINICAL_ROLES,
# pharmacist excluded); the services own the invariants and the audit.
# ---------------------------------------------------------------------------


@transaction.atomic
def update_patient_medical_file(*, actor, center, patient, **fields):
    """Clinical staff writes the patient's structured medical file.

    Created lazily at the first write (``get_or_create`` — ADR 0016 §3);
    every later write goes through ``save()`` (blood-group guard included).
    Audited with FIELD NAMES only — never a blood group value nor a note.
    """
    medical_file, _created = PatientMedicalFile.objects.get_or_create(
        patient=patient, defaults={"updated_by": actor}
    )
    for name, value in fields.items():
        setattr(medical_file, name, value)
    medical_file.updated_by = actor
    medical_file.save()
    audit(
        actor=actor, action=AuditAction.PATIENT_MEDICAL_FILE_UPDATED,
        target=medical_file, center=center, medical_file_id=medical_file.pk,
        patient_id=patient.pk, center_id=center.pk,
        fields=",".join(sorted(fields)),
    )
    return medical_file


@transaction.atomic
def record_vital_signs(*, actor, encounter, measured_by, measured_at=None,
                       **measures):
    """Record one set of vital signs on an OPEN encounter.

    ``measured_by`` is the acting staff membership (clinical role, resolved
    by the view from the caller's OWN membership — same rule as
    ``create_encounter``); the model re-imposes the practitioner-of-the-
    center invariant and the plausibility bounds in ``save()``.

    Audit payload: references and measured FIELD NAMES only — NEVER the
    values (a blood pressure is clinical data, ADR 0007).
    """
    _require_open_encounter(encounter, "une mesure de signes vitaux")
    extra = {"measured_at": measured_at} if measured_at else {}
    vital_signs = VitalSigns.objects.create(
        encounter=encounter,
        measured_by=measured_by,
        **extra,
        **measures,
    )
    recorded = sorted(
        name for name, value in measures.items() if value is not None
    )
    audit(
        actor=actor, action=AuditAction.VITAL_SIGNS_RECORDED,
        target=vital_signs, center=encounter.center,
        vital_signs_id=vital_signs.pk,
        encounter_id=encounter.pk, patient_id=encounter.patient_id,
        center_id=encounter.center_id, fields=",".join(recorded),
    )
    return vital_signs


@transaction.atomic
def create_patient_document(*, actor, center, patient, uploaded_file,
                            doc_type, title, source_encounter=None):
    """Attach a document (photo of a medical paper) to the patient's carnet.

    The bytes pass through the ADR 0014 hardened pipeline UNCHANGED
    (JPEG/PNG/WebP by real content — the PDF is explicitly deferred, ADR
    0016 §5 —, 2 MB cap, re-encode stripping EXIF/GPS, uuid name), then
    land under the PRIVATE storage (never /media/). ``source_encounter``,
    when given, must belong to this center AND this patient (model
    invariant; the view resolves it in the center perimeter first). An
    encounter may be closed: lab results routinely arrive after the visit
    — attaching a document is not clinical production ON the encounter.

    Audit payload: ids + doc_type code — NEVER the title (free clinical
    text, ADR 0007).
    """
    if doc_type not in PatientDocument.DocType.values:
        raise ValidationError("Type de document invalide.")
    content = process_image_upload(uploaded_file)
    document = PatientDocument.objects.create(
        patient=patient,
        center=center,
        source_encounter=source_encounter,
        doc_type=doc_type,
        title=title,
        file=content,
        uploaded_by=actor,
    )
    audit(
        actor=actor, action=AuditAction.PATIENT_DOCUMENT_CREATED,
        target=document, center=center,
        document_id=document.pk, patient_id=patient.pk,
        center_id=center.pk, doc_type=str(doc_type),
    )
    return document


@transaction.atomic
def archive_patient_document(*, actor, document):
    """Archive a document — error correction WITHOUT destruction (ADR 0002).

    The file and the row stay (the producing center's clinical staff keeps
    seeing the archived state); the patient no longer sees it. Final: the
    model refuses any un-archiving.
    """
    if document.is_archived:
        raise ValidationError("Ce document est déjà archivé.")
    document.archived_at = timezone.now()
    document.archived_by = actor
    document.save(update_fields=["archived_at", "archived_by", "updated_at"])
    audit(
        actor=actor, action=AuditAction.PATIENT_DOCUMENT_ARCHIVED,
        target=document, center=document.center, document_id=document.pk,
        patient_id=document.patient_id, center_id=document.center_id,
        doc_type=str(document.doc_type),
    )
    return document
