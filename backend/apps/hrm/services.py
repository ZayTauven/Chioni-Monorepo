"""HRM services — the ONLY write path for the staff register (S7, ADR 0020).

Project rule (CLAUDE.md): writes go through services that replay
``save()``, take the row lock that makes a decision meaningful under
concurrency, and journalise inside the same transaction.

**Lock hierarchy of the module: emploi → congé**, and nothing else. It is
disjoint from the money hierarchy (utilisateur → intent → demande →
facture → centre), from the hospitalisation one (patient → lit → séjour)
and from ``claim_profile``'s (patient → lien): no service here ever reaches
for an invoice, an intent, a stay or a center row. The approval of a leave
locks the EMPLOYMENT first (it is what the overlap rule is about — « cette
personne est-elle déjà en congé ce jour-là ? »), then the leave row.

Audit payload contract (ADR 0020 invariant 4), enforced by every call
below: ids, counts, STATUS codes and booleans — **never a leave type**
(same class as a diagnosis), never a department or job-title label, never
a file name. The ``has_document`` boolean follows the ``has_reason``
patron of ``set_center_kyc_status``.

The commercial freeze (S5, ADR 0018) — **and the reason this module is the
first extension of the S5 fail-closed probe since its creation**:

- **le RH est de la GESTION, pas du SOIN.** Writing a department, a job
  title, a public holiday, an attendance sheet or a leave DECISION is
  administration, exactly like personnel and tariffs, which are already
  frozen. Those five are the closed list of :data:`FROZEN_WRITES` below.
- **Toute LECTURE reste ouverte**, and in particular a person reading their
  OWN data (arbitrage PO n° 3: « on ne prend jamais en otage les données
  d'une personne »).
- Deliberately NOT frozen either, and each one a tested contract:
  :func:`request_leave`, :func:`cancel_leave`,
  :func:`upload_leave_document` and :func:`archive_leave_document` — those
  are the PERSON's own acts about her own file. Refusing them would punish
  an employee for her employer's unpaid invoice, which is the exact
  opposite of the sprint's ethic. Same reading as
  ``deactivate_staff_member``, which has always stayed out of the freeze.

And ``deactivate_staff_member`` must NEVER be able to fail because of this
module: the RGPD anonymisation calls it in a loop, and an employee
exercising their right to erasure cannot be blocked by a leave balance. No
model here carries a FK to ``StaffMembership`` — the guarantee is
structural, not a promise, and ``test_hrm.py`` proves it end to end.
"""

from contextlib import contextmanager

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.billing.guards import require_center_can_administer
from apps.centers.models import StaffMembership
from apps.common.uploads import process_image_upload
from apps.hrm.models import (
    AttendanceRecord,
    Department,
    Employment,
    Holiday,
    JobTitle,
    LeaveDocument,
    LeaveRequest,
)

Status = LeaveRequest.Status

#: The leave state machine (ADR 0020, décision 4) — terminal states map to
#: an empty set. Closed, serialised on the row, never a jump, never a
#: return. A cancellation AFTER approval is out of scope S7 and consigned:
#: the attendance sheet is what says whether the leave was actually taken.
LEAVE_TRANSITIONS = {
    Status.REQUESTED: frozenset(
        {Status.APPROVED, Status.REFUSED, Status.CANCELLED}
    ),
    Status.APPROVED: frozenset(),
    Status.REFUSED: frozenset(),
    Status.CANCELLED: frozenset(),
}

#: Longest leave accepted in one request. Generous (a full year of
#: maternity/sick leave) but finite: « du 01/01/1900 au 31/12/2999 » is a
#: fat finger, and an unbounded range would poison every overlap check.
MAX_LEAVE_DAYS = 366

#: Longest back-dating accepted on an attendance line — a register is
#: caught up, not rewritten from another era.
MAX_ATTENDANCE_BACKDATING_DAYS = 366

#: The CLOSED list of writes the subscription freeze covers (ADR 0020
#: décision 7). Documentation exécutable: ``test_hrm.py`` asserts that the
#: functions calling ``require_center_can_administer`` in this module are
#: EXACTLY these, so extending the freeze — or forgetting it on a new
#: administrative write — is a conscious act.
FROZEN_WRITES = frozenset(
    {
        "create_department", "update_department",
        "create_job_title", "update_job_title",
        "create_holiday", "delete_holiday",
        "create_employment", "update_employment",
        "record_attendance",
        "decide_leave",
    }
)


# ---------------------------------------------------------------------------
# Les deux outils de concurrence du module (revue adversariale S7)
# ---------------------------------------------------------------------------


def _lock_employment(employment):
    """Serialise every candidate for the SAME person's HR file.

    THE lock of the module: the overlap rule (« deux congés approuvés ne se
    chevauchent pas ») is a statement about a PERSON, so the person's file
    is the row two concurrent approvals must queue on. Taken BEFORE the
    leave row — hierarchy **emploi → congé**.

    :func:`record_attendance` takes it too (revue adversariale S7): ticking
    a day is also a statement about a person, and its ``select_for_update``
    on the attendance row locked NOTHING when the row did not exist yet —
    two responsables ticking the same day answered a 500 instead of
    correcting one another. Hierarchy unchanged: **emploi → (congé |
    présence)**, and no service here ever reaches for an invoice, an
    intent, a stay or a center row.
    """
    return Employment.objects.select_for_update().get(pk=employment.pk)


@contextmanager
def _unique_or_refuse(message):
    """Turn a lost unique-constraint race into the refusal of the calm path.

    Every ``create_*`` below reads (« ce nom existe-t-il déjà ? ») then
    writes. Sequentially the read is the guard; CONCURRENTLY both readers
    see nothing and the loser hits the DB constraint — an ``IntegrityError``
    the DRF handler does not translate, i.e. a 500 for a director who
    simply clicked at the same second as his colleague (revue adversariale
    S7, prouvé à threads réels).

    The savepoint (nested ``atomic``) is what makes the outer transaction
    survivable: without it the whole call — audit entry included — would be
    poisoned. The constraint stays the authority; this only gives its
    verdict the same French sentence as the read.
    """
    try:
        with transaction.atomic():
            yield
    except IntegrityError:
        raise ValidationError(message)


# ---------------------------------------------------------------------------
# Configuration: services, fonctions, jours fériés
# ---------------------------------------------------------------------------


@transaction.atomic
def create_department(*, actor, center, name):
    """Declare a service. Audited ``hrm_department.created`` — configuration,
    so it IS in the director's journal (same family as a tariff)."""
    require_center_can_administer(center)
    name = (name or "").strip()
    if not name:
        raise ValidationError("Le nom du service est obligatoire.")
    clash = "Un service porte déjà ce nom dans ce centre."
    if Department.objects.for_center(center).filter(name=name).exists():
        raise ValidationError(clash)
    with _unique_or_refuse(clash):
        department = Department.objects.create(center=center, name=name)
    audit(
        actor=actor, action=AuditAction.HRM_DEPARTMENT_CREATED,
        target=department, center=center,
        # Ids only — never the LABEL (« Service VIH » ferait d'une ligne de
        # configuration une ligne clinique).
        department_id=department.pk, center_id=center.pk,
    )
    return department


@transaction.atomic
def update_department(*, actor, department, name=None, is_active=None):
    """Rename or deactivate a service — audited ``hrm_department.updated``."""
    require_center_can_administer(department.center)
    changed = []
    if name is not None:
        name = name.strip()
        if not name:
            raise ValidationError("Le nom du service est obligatoire.")
        if name != department.name:
            clash = (
                Department.objects.for_center(department.center)
                .filter(name=name)
                .exclude(pk=department.pk)
            )
            if clash.exists():
                raise ValidationError(
                    "Un service porte déjà ce nom dans ce centre."
                )
            department.name = name
            changed.append("name")
    if is_active is not None and is_active != department.is_active:
        department.is_active = is_active
        changed.append("is_active")
    if changed:
        with _unique_or_refuse("Un service porte déjà ce nom dans ce centre."):
            department.save(update_fields=changed + ["updated_at"])
        audit(
            actor=actor, action=AuditAction.HRM_DEPARTMENT_UPDATED,
            target=department, center=department.center,
            department_id=department.pk, center_id=department.center_id,
            fields=",".join(sorted(changed)),
        )
    return department


@transaction.atomic
def create_job_title(*, actor, center, name):
    """Declare a function. Audited ``hrm_job_title.created``.

    A function is a LABEL, never a right (ADR 0020, décision 2).
    """
    require_center_can_administer(center)
    name = (name or "").strip()
    if not name:
        raise ValidationError("Le nom de la fonction est obligatoire.")
    clash = "Une fonction porte déjà ce nom dans ce centre."
    if JobTitle.objects.for_center(center).filter(name=name).exists():
        raise ValidationError(clash)
    with _unique_or_refuse(clash):
        job_title = JobTitle.objects.create(center=center, name=name)
    audit(
        actor=actor, action=AuditAction.HRM_JOB_TITLE_CREATED, target=job_title,
        center=center, job_title_id=job_title.pk, center_id=center.pk,
    )
    return job_title


@transaction.atomic
def update_job_title(*, actor, job_title, name=None, is_active=None):
    """Rename or deactivate a function — audited ``hrm_job_title.updated``."""
    require_center_can_administer(job_title.center)
    changed = []
    if name is not None:
        name = name.strip()
        if not name:
            raise ValidationError("Le nom de la fonction est obligatoire.")
        if name != job_title.name:
            clash = (
                JobTitle.objects.for_center(job_title.center)
                .filter(name=name)
                .exclude(pk=job_title.pk)
            )
            if clash.exists():
                raise ValidationError(
                    "Une fonction porte déjà ce nom dans ce centre."
                )
            job_title.name = name
            changed.append("name")
    if is_active is not None and is_active != job_title.is_active:
        job_title.is_active = is_active
        changed.append("is_active")
    if changed:
        with _unique_or_refuse("Une fonction porte déjà ce nom dans ce centre."):
            job_title.save(update_fields=changed + ["updated_at"])
        audit(
            actor=actor, action=AuditAction.HRM_JOB_TITLE_UPDATED,
            target=job_title, center=job_title.center,
            job_title_id=job_title.pk, center_id=job_title.center_id,
            fields=",".join(sorted(changed)),
        )
    return job_title


@transaction.atomic
def create_holiday(*, actor, center, date, name):
    """Declare a public holiday FOR THIS CENTER (ADR 0020, décision 5)."""
    require_center_can_administer(center)
    name = (name or "").strip()
    if not name:
        raise ValidationError("Le libellé du jour férié est obligatoire.")
    clash = "Ce jour est déjà déclaré férié dans ce centre."
    if Holiday.objects.for_center(center).filter(date=date).exists():
        raise ValidationError(clash)
    with _unique_or_refuse(clash):
        holiday = Holiday.objects.create(center=center, date=date, name=name)
    audit(
        actor=actor, action=AuditAction.HOLIDAY_CREATED, target=holiday,
        center=center, holiday_id=holiday.pk, center_id=center.pk,
    )
    return holiday


@transaction.atomic
def delete_holiday(*, actor, holiday):
    """Remove a holiday declared by mistake — audited ``holiday.deleted``.

    Deleted rather than archived, unlike everything else in the product:
    a holiday is PURE configuration about a calendar, it documents no
    decision about a person and supports no money. What actually happened
    that day is on the attendance sheet, which is untouched.

    The audit entry is written BEFORE the row disappears (it carries the id
    it is about) — and the generic ``target`` is deliberately omitted: an
    ``object_id`` pointing at a deleted row would be a dangling reference.
    """
    require_center_can_administer(holiday.center)
    center = holiday.center
    holiday_id = holiday.pk
    holiday.delete()
    audit(
        actor=actor, action=AuditAction.HOLIDAY_DELETED, center=center,
        holiday_id=holiday_id, center_id=center.pk,
    )


# ---------------------------------------------------------------------------
# Le pivot : le dossier RH
# ---------------------------------------------------------------------------


def staff_user_ids(center):
    """The user ids holding at least ONE membership in ``center``.

    The ONLY legal source of candidates for an employment: without it, a
    director could mint an HR file on any user id and turn the endpoint
    into a user-table oracle. Inactive memberships count — a person whose
    accesses were closed still has a staff record to keep (invariant 7).
    """
    return StaffMembership.objects.for_center(center).values_list(
        "user_id", flat=True
    )


@transaction.atomic
def create_employment(*, actor, center, user, hired_at, department=None,
                      job_title=None):
    """Open the HR file of ONE person in ONE center (ADR 0020, décision 1).

    Unique per (user, center) — **never** per membership: a doctor who is
    also director holds two memberships in the same center and must keep
    ONE attendance sheet and ONE leave history.

    ``department``/``job_title`` are optional labels resolved by the view
    inside the center's perimeter; the same-center invariant is replayed in
    ``Employment.save()`` anyway (project engineering rule).
    """
    require_center_can_administer(center)
    if user.pk not in set(staff_user_ids(center)):
        raise ValidationError(
            "Cette personne ne fait pas partie du personnel de ce centre."
        )
    clash = "Cette personne a déjà un dossier RH dans ce centre."
    if Employment.objects.for_center(center).for_user(user).exists():
        raise ValidationError(clash)
    employment = Employment(
        user=user, center=center, hired_at=hired_at,
        department=department, job_title=job_title,
    )
    # Deux directeurs qui ouvrent le dossier de la même personne à la même
    # seconde : la contrainte ``unique_employment_per_user_center`` tranche,
    # et le perdant reçoit la MÊME phrase que le chemin séquentiel (revue
    # adversariale S7 — c'était un 500).
    with _unique_or_refuse(clash):
        employment.save()
    audit(
        actor=actor, action=AuditAction.EMPLOYMENT_CREATED, target=employment,
        center=center,
        # References only — never the department or job-title LABEL.
        employment_id=employment.pk, center_id=center.pk, user_id=user.pk,
        department_id=employment.department_id,
        job_title_id=employment.job_title_id,
    )
    return employment


@transaction.atomic
def update_employment(*, actor, employment, **fields):
    """Edit an HR file: service, fonction, dates. Audited ``employment.updated``.

    ``user`` and ``center`` are NOT editable — moving a file from one
    person or one tenant to another is not an edit, it is a new file.
    """
    require_center_can_administer(employment.center)
    allowed = {"department", "job_title", "hired_at", "ended_at"}
    unknown = set(fields) - allowed
    if unknown:
        raise ValidationError(
            f"Champ non modifiable : {', '.join(sorted(unknown))}."
        )
    changed = []
    for name, value in fields.items():
        if name in ("department", "job_title"):
            current = getattr(employment, f"{name}_id")
            incoming = value.pk if value is not None else None
        else:
            current = getattr(employment, name)
            incoming = value
        if current != incoming:
            setattr(employment, name, value)
            changed.append(name)
    if not changed:
        return employment
    employment.save()
    audit(
        actor=actor, action=AuditAction.EMPLOYMENT_UPDATED, target=employment,
        center=employment.center,
        employment_id=employment.pk, center_id=employment.center_id,
        user_id=employment.user_id, fields=",".join(sorted(changed)),
    )
    return employment


# ---------------------------------------------------------------------------
# La feuille de présence (ADR 0020, décision 3)
# ---------------------------------------------------------------------------


@transaction.atomic
def record_attendance(*, actor, employment, date, status):
    """Tick ONE day of the register — the responsable's gesture.

    Upsert on (emploi, date): a paper register is CORRECTED, not stacked.
    Every write is audited ``attendance.recorded`` — an action that stays
    OUT of the director's journal (daily volume, and individual
    surveillance: invariant 4).

    Bounds: never in the future (a register records what happened), never
    more than a year back, and never outside the employment period (the
    last one is structural, replayed in ``AttendanceRecord.save()``).

    Concurrency (revue adversariale S7): the EMPLOYMENT row is locked first
    — hierarchy **emploi → présence**, the same one the leave decision
    takes. The previous ``select_for_update`` on the attendance row locked
    nothing when the row did not exist yet, so two responsables ticking the
    same day raced into the unique constraint and got a 500 instead of
    correcting one another. The transient ``record.was_created`` says which
    branch ran, so the view can answer 201/200 from the FACT rather than
    from a pre-check taken outside the lock.
    """
    require_center_can_administer(employment.center)
    if status not in AttendanceRecord.Status.values:
        raise ValidationError("Statut de présence inconnu.")
    today = timezone.localdate()
    if date > today:
        raise ValidationError(
            "La feuille de présence note ce qui s'est passé : pas de "
            "journée dans le futur."
        )
    if (today - date).days > MAX_ATTENDANCE_BACKDATING_DAYS:
        raise ValidationError(
            "Impossible de noter une journée de plus d'un an."
        )
    employment = _lock_employment(employment)
    record = (
        AttendanceRecord.objects.filter(employment=employment, date=date)
        .first()
    )
    created = record is None
    if created:
        record = AttendanceRecord(employment=employment, date=date)
    record.status = status
    record.noted_by = actor
    record.save()
    record.was_created = created
    audit(
        actor=actor, action=AuditAction.ATTENDANCE_RECORDED, target=record,
        center=employment.center,
        # The STATUS code is exploitation, not a régime: « conge » here says
        # the person was not at work, exactly what the sheet is for. The
        # leave TYPE (maladie, deuil…) never appears in any payload.
        attendance_id=record.pk, employment_id=employment.pk,
        center_id=employment.center_id, status=str(status), created=created,
    )
    return record


# ---------------------------------------------------------------------------
# Les congés (ADR 0020, décision 4) — verrous emploi → congé
# ---------------------------------------------------------------------------


def _transition(leave, target):
    """One state-machine step, serialised on the ROW (patron scheduling/S6).

    The status is re-read under ``select_for_update`` so two concurrent
    decisions (approve vs refuse) can never both pass the legality check —
    the loser re-reads the winner's state and gets a clean French 400.
    """
    locked = (
        LeaveRequest.objects.select_for_update()
        .select_related("employment")
        .get(pk=leave.pk)
    )
    if target not in LEAVE_TRANSITIONS[locked.status]:
        raise ValidationError(
            f"Transition impossible : cette demande est "
            f"« {locked.get_status_display()} »."
        )
    return locked


@transaction.atomic
def request_leave(*, actor, employment, leave_type, start_date, end_date):
    """Ask for a leave — the PERSON's own act about her own file.

    Deliberately NOT frozen by the subscription (see module docstring):
    refusing it would punish an employee for her employer's unpaid invoice.

    Two overlapping REQUESTS are allowed on purpose (ADR 0020, décision 4):
    one arbitrates at approval time, not at typing time — a responsable who
    would have to delete a pending request before entering another would
    lose the trace of what was actually asked.
    """
    if leave_type not in LeaveRequest.Type.values:
        raise ValidationError("Type de congé inconnu.")
    if end_date < start_date:
        raise ValidationError("La fin du congé ne peut pas précéder son début.")
    if (end_date - start_date).days + 1 > MAX_LEAVE_DAYS:
        raise ValidationError(
            f"Congé trop long : {MAX_LEAVE_DAYS} journées au maximum."
        )
    if employment.ended_at is not None and start_date > employment.ended_at:
        raise ValidationError(
            "Ce dossier RH est clos : aucun congé ne peut plus y être posé."
        )
    leave = LeaveRequest(
        employment=employment, leave_type=leave_type,
        start_date=start_date, end_date=end_date,
        status=Status.REQUESTED, requested_by=actor,
    )
    leave.save()
    audit(
        actor=actor, action=AuditAction.LEAVE_REQUESTED, target=leave,
        center=employment.center,
        # Ids, a day COUNT and the employment — **jamais le type**
        # (invariant 4: même classe qu'un diagnostic).
        leave_id=leave.pk, employment_id=employment.pk,
        center_id=employment.center_id, days=leave.days,
    )
    return leave


def _overlapping_approved(employment, leave):
    """Another APPROVED leave of this person covering a common day."""
    return (
        LeaveRequest.objects.filter(
            employment=employment,
            status=Status.APPROVED,
            start_date__lte=leave.end_date,
            end_date__gte=leave.start_date,
        )
        .exclude(pk=leave.pk)
        .exists()
    )


@transaction.atomic
def decide_leave(*, actor, leave, approve):
    """Approve or refuse — the director's administrative act (FROZEN).

    Locks, in this order: **emploi → congé**. The employment row is what
    the overlap rule is about, so two concurrent approvals of two
    overlapping requests queue there and the second one correctly refuses
    (course à threads réels dans ``test_hrm.py``).

    « Congé sur un jour férié ou un repos : autorisé, non décompté — la
    feuille de présence fait foi » (ADR 0020, décision 4): nothing here
    looks at :class:`~apps.hrm.models.Holiday`, and that is deliberate.
    """
    require_center_can_administer(leave.employment.center)
    employment = _lock_employment(leave.employment)
    target = Status.APPROVED if approve else Status.REFUSED
    locked = _transition(leave, target)
    if approve and _overlapping_approved(employment, locked):
        raise ValidationError(
            "Un congé déjà approuvé couvre une partie de ces dates : "
            "cette personne ne peut pas être en congé deux fois le même jour."
        )
    locked.status = target
    locked.decided_by = actor
    locked.decided_at = timezone.now()
    locked.save(
        update_fields=["status", "decided_by", "decided_at", "updated_at"]
    )
    audit(
        actor=actor, action=AuditAction.LEAVE_DECIDED, target=locked,
        center=employment.center,
        # A decision CODE, never the régime it applies to.
        leave_id=locked.pk, employment_id=employment.pk,
        center_id=employment.center_id, status=str(target),
    )
    leave.status = locked.status
    leave.decided_at = locked.decided_at
    return locked


@transaction.atomic
def cancel_leave(*, actor, leave):
    """The person withdraws her OWN pending request (``demande → annule``).

    Not frozen (module docstring): withdrawing what one asked for is never
    a paid feature. Only a PENDING request can be withdrawn — an approved
    leave is terminal in S7 (consigné), and the attendance sheet is what
    says whether it was actually taken.
    """
    employment = _lock_employment(leave.employment)
    locked = _transition(leave, Status.CANCELLED)
    locked.status = Status.CANCELLED
    locked.decided_by = actor
    locked.decided_at = timezone.now()
    locked.save(
        update_fields=["status", "decided_by", "decided_at", "updated_at"]
    )
    audit(
        actor=actor, action=AuditAction.LEAVE_CANCELLED, target=locked,
        center=employment.center,
        leave_id=locked.pk, employment_id=employment.pk,
        center_id=employment.center_id,
    )
    leave.status = locked.status
    return locked


# ---------------------------------------------------------------------------
# Les justificatifs — un FICHIER privé, jamais un texte
# ---------------------------------------------------------------------------


@transaction.atomic
def upload_leave_document(*, actor, leave, uploaded_file):
    """Attach a supporting file to a leave — pipeline ADR 0014 + private storage.

    The person's own act about her own file: NOT frozen. The bytes go
    through the hardened pipeline (JPEG/PNG/WebP by REAL content, 2 MB,
    metadata stripped, uuid name — PDF still deferred, arbitrage réversible
    commun aux ADR 0016/0017) and land under ``PRIVATE_MEDIA_ROOT``, which
    has no ``url()`` at all.

    Audit payload: ids only — **never a file name** (a client-chosen string
    such as « certificat-oncologie.jpg » would be exactly the medical
    information the closed leave types exist to avoid).
    """
    content = process_image_upload(uploaded_file)
    document = LeaveDocument.objects.create(
        leave=leave, file=content, uploaded_by=actor
    )
    audit(
        actor=actor, action=AuditAction.LEAVE_DOCUMENT_UPLOADED,
        target=document, center=leave.employment.center,
        document_id=document.pk, leave_id=leave.pk,
        employment_id=leave.employment_id,
        center_id=leave.employment.center_id,
    )
    return document


@transaction.atomic
def archive_leave_document(*, actor, document):
    """Archive a supporting file — correction WITHOUT destruction.

    Same posture as a KYC piece: the file that supported a leave decision
    stays auditable. Final — the model refuses any un-archiving.
    """
    if document.is_archived:
        raise ValidationError("Ce justificatif est déjà archivé.")
    document.archived_at = timezone.now()
    document.archived_by = actor
    document.save(update_fields=["archived_at", "archived_by", "updated_at"])
    audit(
        actor=actor, action=AuditAction.LEAVE_DOCUMENT_ARCHIVED,
        target=document, center=document.leave.employment.center,
        document_id=document.pk, leave_id=document.leave_id,
        center_id=document.leave.employment.center_id,
    )
    return document


@transaction.atomic
def purge_leave_documents_of(*, actor, user):
    """RGPD — the BYTES of a person's supporting files leave with her identity.

    Called by ``accounts.services.anonymize_user`` (revue adversariale S7),
    and it closes the one hole in invariant 7. That invariant says the staff
    register survives **orphelin d'identité** — and it was true of every
    table but this one: a photographed sick-leave certificate carries, in
    its pixels, the person's full name, her doctor's, and her pathology.
    Anonymising the account emptied the name columns and deleted the avatar
    while leaving that image downloadable, forever, by whoever directs the
    center next. The register kept the identity the erasure was supposed to
    remove, in the single place nobody thinks to look.

    What survives, deliberately (the register, invariant 7): the
    :class:`~apps.hrm.models.LeaveDocument` ROW — a center must still be
    able to say « une pièce a été déposée le 4 mars, puis retirée » — plus
    the leave, its closed type, its dates and its decision. What goes: the
    file itself, exactly like ``clear_file(user, "avatar")`` two steps
    later in the same service.

    **Never frozen** (it is not in :data:`FROZEN_WRITES` and takes no
    guard): an erasure must go through on a suspended tenant — refusing it
    would hold a person's rights hostage to her ex-employer's unpaid bill.
    Idempotent: a second run finds nothing left to purge.
    """
    purged = 0
    documents = (
        LeaveDocument.objects.filter(leave__employment__user=user)
        .exclude(file="")
        .select_related("leave__employment")
    )
    for document in documents:
        storage, name = document.file.storage, document.file.name
        fields = ["file", "updated_at"]
        if document.archived_at is None:
            # Archiving first keeps the row's own contract true (a piece
            # without bytes is not a live piece) and makes ``has_document``
            # answer False on every screen.
            document.archived_at = timezone.now()
            document.archived_by = actor
            fields += ["archived_at", "archived_by"]
        document.file = ""
        document.save(update_fields=fields)
        storage.delete(name)
        purged += 1
    return purged


# ---------------------------------------------------------------------------
# Lectures agrégées — DANS LE MODULE, jamais dans ``stats_views``
# ---------------------------------------------------------------------------
#
# Patron ``inpatient.occupancy_rows`` (ADR 0019 décision 6), et pour les
# mêmes deux raisons : ``apps/centers/stats_views.py`` agrège l'activité de
# SOIN et ses ``assertNumQueries`` sont verrouillés (7/7/4) — y ajouter une
# série RH casserait des tests qui protègent autre chose. Un endpoint dédié
# porte sa propre discipline (invariant 6 de l'ADR 0020).


def departments_queryset(center):
    """The center's services (org chart).

    **The ONLY door to the org chart from outside ``apps.hrm``** — with
    :func:`job_titles_queryset`, :func:`find_department` and
    :func:`find_job_title`. The structural probe of ``test_hrm.py`` refuses
    any import of ``Department``/``JobTitle`` outside this app (décision 2:
    « une fonction n'est pas un droit »), so a caller that needs to READ a
    label goes through a named service function that a reviewer sees in a
    diff — never through the model class, which could be joined into a
    permission decision.
    """
    return Department.objects.for_center(center)


def job_titles_queryset(center):
    """The center's functions — same contract as :func:`departments_queryset`."""
    return JobTitle.objects.for_center(center)


def find_department(center, name):
    """One service of ``center`` by name, or None (idempotence helper)."""
    return departments_queryset(center).filter(name=name).first()


def find_job_title(center, name):
    """One function of ``center`` by name, or None (idempotence helper)."""
    return job_titles_queryset(center).filter(name=name).first()


def employments_queryset(center):
    """The center's HR files, with everything the serializers read."""
    return (
        Employment.objects.for_center(center)
        .select_related("user", "department", "job_title")
        .order_by("user__last_name", "user__first_name", "id")
    )


def schedule_rows(center, day):
    """The COLLECTIVE planning of one day — read by ANY staff member.

    « Qui est là aujourd'hui ? » is a service need, and it stops exactly
    there. The payload built by
    :class:`~apps.hrm.serializers.ScheduleRowSerializer` **fuses ``absent``
    and ``conge`` into a single value** (invariant 3): otherwise « en
    congé » would read as « pas malade », and an unexplained absence would
    become a signal.

    One query for the employments plus one for the day's attendance — never
    one per row.
    """
    employments = list(
        Employment.objects.for_center(center)
        .active_on(day)
        .select_related("user", "job_title")
        .order_by("user__last_name", "user__first_name", "id")
    )
    statuses = dict(
        AttendanceRecord.objects.filter(
            employment__in=employments, date=day
        ).values_list("employment_id", "status")
    )
    for employment in employments:
        employment.day_status = statuses.get(employment.pk)
    return employments


def attendance_summary(center, start, end):
    """Counts per day and per person over an inclusive local-day window.

    DIRECTOR audience (he counts the rights), so the raw statuses —
    ``conge`` included — are legitimate here. Two SQL aggregates, never one
    query per employment.
    """
    from django.db.models import Count

    rows = (
        AttendanceRecord.objects.for_center(center)
        .filter(date__gte=start, date__lte=end)
        .values("date", "status")
        .annotate(total=Count("id"))
    )
    per_day = {}
    for row in rows:
        bucket = per_day.setdefault(row["date"], {})
        bucket[row["status"]] = row["total"]

    per_employment = (
        AttendanceRecord.objects.for_center(center)
        .filter(date__gte=start, date__lte=end)
        .values("employment_id", "status")
        .annotate(total=Count("id"))
    )
    return per_day, list(per_employment)
