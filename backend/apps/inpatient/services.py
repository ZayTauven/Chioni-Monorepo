"""Inpatient services — the ONLY write path for rooms, beds and stays.

Project rule (CLAUDE.md): writes go through services that replay
``save()``, take the row lock that makes a decision meaningful under
concurrency, and journalise inside the same transaction.

Contrary to ``apps.scheduling`` (which deliberately audits nothing — « no
money, no clinical content »), **everything here is audited**: an
admission IS a clinical act, and a billed hospitalisation day IS money.
Payload contract (ADR 0007, tightened by ADR 0019 invariant 4):
references, status/priority codes and counts — **never** the admission
motive (same class as a diagnosis; it lives on ``Encounter.reason``),
never a cancellation motive, never a room or bed name.

State machine (ADR 0019, décision 3), closed and serialised on the row —
patron ``_transition`` of ``apps/scheduling/services.py``::

    en_cours ──> sortie      (la sortie libère le lit et clôture le pivot)
        └─────> annule       (admission saisie par erreur, motif obligatoire)

``sortie`` and ``annule`` are terminal; the machine never skips a state and
never comes back.

**Lock hierarchy.** This module locks ``PatientProfile`` (admission only),
then ``Bed``, then ``Stay`` — **patient → lit → séjour**, and nothing else.
It is disjoint from the diaspora money hierarchy (utilisateur → intent →
demande → facture → centre) and from the SaaS one: no service here ever
reaches for an invoice, an intent or a center row. The one money-adjacent
service, :func:`bill_stay_days`, writes ``ActPerformed`` rows — which is
upstream of every invoice lock, never inside one; it takes the STAY row
lock (last of the module's hierarchy) and nothing else, so a billing
gesture can never cross a bed transfer or an admission. The patient row is
taken FIRST and only at admission, which keeps this hierarchy compatible
with the ``patient → lien`` order of ``claim_profile`` (ADR 0010).

**Facturer des journées est idempotent** (correctif PO du 15/08/2026) :
jeton fourni par le client, unique par centre au niveau de la BASE, rejeu
résolu sous le verrou du séjour avant toute autre vérification — patron
``record_cash_payment`` (ADR 0015). Et le cumul des journées facturées ne
dépasse jamais la durée réelle du séjour (:func:`billable_days_cap`).

**The commercial freeze is deliberately absent** (ADR 0019, décision 6):
``require_center_can_administer`` is NOT imported here and must never be.
A center whose subscription is suspended must keep hospitalising, and
configuring a bed is the physical prerequisite of that. The S5
fail-closed probe locks the importers list by strict equality.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.centers.models import TariffItem
from apps.common.models import ActCategory
from apps.inpatient.models import (
    Bed,
    BedAssignment,
    Room,
    Stay,
    StayDayBilling,
)
from apps.medical.models import ActPerformed, Encounter
from apps.medical.services import close_encounter, create_encounter
from apps.patients.models import PatientProfile

Status = Stay.Status

#: The state machine — terminal states map to an empty set.
STAY_TRANSITIONS = {
    Status.IN_PROGRESS: frozenset({Status.DISCHARGED, Status.CANCELLED}),
    Status.DISCHARGED: frozenset(),
    Status.CANCELLED: frozenset(),
}

#: Admitting « maintenant » at the ward must not race the clock (same
#: tolerance as the appointment desk).
PAST_TOLERANCE = timedelta(minutes=5)

#: An admission dated more than a year back is a typo, not a record: the
#: bound also keeps every datetime derived from ``admitted_at`` far from
#: ``datetime.min/max`` (lesson of the wave-1 adversarial review).
MAX_ADMISSION_BACKDATING = timedelta(days=366)

#: Upper bound of one billing gesture. Generous (a year of hospitalisation)
#: but finite: « 100000 journées » is a fat finger, and N acts are N rows.
MAX_BILLABLE_DAYS = 366


# ---------------------------------------------------------------------------
# Configuration: rooms and beds
# ---------------------------------------------------------------------------


@transaction.atomic
def create_room(*, actor, center, name):
    """Declare a room. Audited ``room.created`` — configuration, so it IS
    in the director's journal (same family as a tariff)."""
    name = (name or "").strip()
    if not name:
        raise ValidationError("Le nom de la chambre est obligatoire.")
    if Room.objects.for_center(center).filter(name=name).exists():
        raise ValidationError("Une chambre porte déjà ce nom dans ce centre.")
    room = Room.objects.create(center=center, name=name)
    audit(
        actor=actor, action=AuditAction.ROOM_CREATED, target=room, center=center,
        # Ids only — never the room NAME (a name can be « Isolement
        # tuberculose » and would turn a configuration line into a clinical
        # one the day a bed is linked to it).
        room_id=room.pk, center_id=center.pk,
    )
    return room


@transaction.atomic
def create_bed(*, actor, room, name):
    """Declare a bed inside a room. Audited ``bed.created``."""
    name = (name or "").strip()
    if not name:
        raise ValidationError("Le nom du lit est obligatoire.")
    if Bed.objects.filter(room=room, name=name).exists():
        raise ValidationError("Un lit porte déjà ce nom dans cette chambre.")
    bed = Bed.objects.create(room=room, name=name)
    audit(
        actor=actor, action=AuditAction.BED_CREATED, target=bed,
        center=room.center,
        bed_id=bed.pk, room_id=room.pk, center_id=room.center_id,
    )
    return bed


# ---------------------------------------------------------------------------
# Beds: assignment, transfer, release
# ---------------------------------------------------------------------------


def _lock_bed(bed):
    """Serialise every candidate for the SAME bed.

    The partial unique constraint is the GUARANTEE (a raw INSERT can never
    double-book); this lock is what turns the loser's answer into a clean
    French 400 instead of an IntegrityError that would poison the caller's
    transaction. Both layers are tested — the DB one with real threads.
    """
    return Bed.objects.select_for_update().select_related("room").get(pk=bed.pk)


def _lock_stay(stay):
    return Stay.objects.select_for_update().get(pk=stay.pk)


def _close_pivot(*, actor, stay):
    """Close the pivot consultation, tolerating an already-closed one.

    A clinician may legitimately have closed the consultation from the
    encounter routes before the ward records the discharge; making the
    discharge fail on that would trap a real patient in a bed. Closing
    twice is refused by ``close_encounter`` — so we only call it when the
    consultation is still open, and the outcome is the same either way.
    """
    encounter = stay.encounter
    if encounter.status == Encounter.Status.IN_PROGRESS:
        close_encounter(actor=actor, encounter=encounter)
    return encounter


def _release_open_assignment(*, actor, stay, at=None):
    """Close the stay's current occupation, if any. Returns it or None."""
    assignment = (
        BedAssignment.objects.select_for_update()
        .filter(stay=stay, released_at__isnull=True)
        .order_by("-assigned_at", "-id")
        .first()
    )
    if assignment is None:
        return None
    released_at = at or timezone.now()
    if released_at < assignment.assigned_at:
        released_at = assignment.assigned_at
    assignment.released_at = released_at
    assignment.released_by = actor
    assignment.save(update_fields=["released_at", "released_by", "updated_at"])
    audit(
        actor=actor, action=AuditAction.BED_RELEASED, target=assignment,
        center=stay.center,
        assignment_id=assignment.pk, stay_id=stay.pk, bed_id=assignment.bed_id,
        center_id=stay.center_id,
    )
    return assignment


@transaction.atomic
def assign_bed(*, actor, stay, bed, assigned_at=None):
    """Put (or move) a stay into ``bed`` — the transfer path too.

    A transfer RELEASES the current assignment and OPENS a new one: the
    bed's history is stacked, never rewritten (ADR 0019, décision 2).
    Assigning the bed the stay is already in is refused explicitly rather
    than silently producing a no-op transfer line.

    Locks, in this order: **bed → séjour** (the module's own hierarchy —
    every candidate for the same bed queues on the bed row first, so two
    concurrent admissions can never both pass the « libre ? » check).
    """
    bed = _lock_bed(bed)
    stay = _lock_stay(stay)
    if stay.status != Status.IN_PROGRESS:
        raise ValidationError(
            "Ce séjour est clos : aucun lit ne peut plus lui être attribué."
        )
    if bed.room.center_id != stay.center_id:
        raise ValidationError("Ce lit n'appartient pas à ce centre.")
    if not bed.is_active or not bed.room.is_active:
        raise ValidationError("Ce lit n'est pas disponible.")
    current = (
        BedAssignment.objects.filter(stay=stay, released_at__isnull=True)
        .order_by("-assigned_at", "-id")
        .first()
    )
    if current is not None and current.bed_id == bed.pk:
        raise ValidationError("Ce patient occupe déjà ce lit.")
    occupied = (
        BedAssignment.objects.filter(bed=bed, released_at__isnull=True)
        .exclude(stay=stay)
        .exists()
    )
    if occupied:
        raise ValidationError("Ce lit est déjà occupé par un autre patient.")
    assigned_at = assigned_at or timezone.now()
    _release_open_assignment(actor=actor, stay=stay, at=assigned_at)
    assignment = BedAssignment.objects.create(
        stay=stay, bed=bed, assigned_at=assigned_at, assigned_by=actor
    )
    audit(
        actor=actor, action=AuditAction.BED_ASSIGNED, target=assignment,
        center=stay.center,
        assignment_id=assignment.pk, stay_id=stay.pk, bed_id=bed.pk,
        room_id=bed.room_id, center_id=stay.center_id,
        transfer=current is not None,
    )
    return assignment


@transaction.atomic
def release_bed(*, actor, stay):
    """Free the stay's bed WITHOUT giving it another one.

    A patient waiting in the corridor is a representable state (ADR 0019,
    décision 2), so releasing without transferring must be possible.
    """
    stay = _lock_stay(stay)
    assignment = _release_open_assignment(actor=actor, stay=stay)
    if assignment is None:
        raise ValidationError("Ce séjour n'occupe aucun lit.")
    return assignment


# ---------------------------------------------------------------------------
# Stays: admission, discharge, cancellation
# ---------------------------------------------------------------------------


def _check_admission_window(admitted_at):
    now = timezone.now()
    if admitted_at > now + PAST_TOLERANCE:
        raise ValidationError(
            "Impossible d'enregistrer une admission dans le futur."
        )
    if admitted_at < now - MAX_ADMISSION_BACKDATING:
        raise ValidationError(
            "Impossible d'enregistrer une admission de plus d'un an."
        )


@transaction.atomic
def admit_patient(*, actor, center, practitioner, patient, reason,
                  priority=Stay.Priority.NORMAL, bed=None, attending=(),
                  admitted_at=None, diagnosis=""):
    """Admit a patient — opens the PIVOT consultation and the stay.

    « On n'hospitalise pas sans acte médical » (ADR 0019, décision 1): the
    pivot ``Encounter`` is created here, in the same transaction, through
    ``medical.services.create_encounter`` — so the admission motive lands
    on the role-gated clinical field and the consultation is audited as
    such. It stays OPEN until the discharge closes it, which is what lets
    the surveillance readings hang off it unchanged.

    ``bed`` is OPTIONAL: an admission without a bed (waiting, corridor) is
    a first-class state. Refusing the admission for lack of a free bed
    would mean refusing a patient who is physically there.

    NO tariff is passed to the pivot: hospitalisation days are billed
    LATER and EXPLICITLY (:func:`bill_stay_days`) — « le staff déclenche,
    le système ne facture pas tout seul ».
    """
    if priority not in Stay.Priority.values:
        raise ValidationError("Priorité inconnue.")
    admitted_at = admitted_at or timezone.now()
    _check_admission_window(admitted_at)
    attending = list(attending)
    for membership in attending:
        if membership.center_id != center.pk:
            raise ValidationError("Ce praticien n'appartient pas à ce centre.")
    # « Un patient n'a qu'un séjour en cours » — mais DANS CE CENTRE, et
    # sous verrou (revue guardian S6, deux défauts d'un seul tenant) :
    #
    # 1. la garde était TRANSVERSALE : un centre qui recevait un patient
    #    transféré depuis un autre établissement Chioni s'entendait répondre
    #    « déjà hospitalisé ». C'était à la fois une donnée clinique d'un
    #    AUTRE tenant (ADR 0002 : ce staff ne lit pas les consultations du
    #    voisin) et une impasse — il ne peut ni voir ni clore ce séjour, donc
    #    le patient présent devenait inadmissible et le service repassait au
    #    papier. Chioni ne peut pas arbitrer la réalité physique entre deux
    #    tenants ; il garde l'invariant là où il a un sens et un remède ;
    # 2. le ``exists()`` n'était protégé par AUCUN verrou : deux admissions
    #    concurrentes du même patient passaient toutes les deux (course à
    #    threads réels dans ``test_adversarial_s6.py``) et la personne
    #    occupait deux lits. Le verrou de ligne sur le PATIENT sérialise les
    #    candidats — hiérarchie **patient → lit → séjour**, disjointe de
    #    celle de l'argent (utilisateur → intent → demande → facture →
    #    centre) et compatible avec l'ordre patient → lien de ``claim_profile``.
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    if Stay.objects.for_center(center).for_patient(patient).ongoing().exists():
        raise ValidationError(
            "Ce patient est déjà hospitalisé dans ce centre : terminez le "
            "séjour en cours avant d'en ouvrir un autre."
        )
    encounter = create_encounter(
        actor=actor, center=center, practitioner=practitioner,
        patient=patient, reason=reason, diagnosis=diagnosis,
        occurred_at=admitted_at,
    )
    stay = Stay(
        patient=patient, center=center, encounter=encounter,
        admitted_at=admitted_at, status=Status.IN_PROGRESS,
        priority=priority, admitted_by=actor,
    )
    stay.save()
    if attending:
        stay.attending.set(attending)
    audit(
        actor=actor, action=AuditAction.STAY_ADMITTED, target=stay,
        center=center,
        # References and CODES only — the admission motive (clinical) is
        # never journalised here (ADR 0019 invariant 4).
        stay_id=stay.pk, patient_id=patient.pk, center_id=center.pk,
        encounter_id=encounter.pk, priority=str(priority),
        attending_count=len(attending),
    )
    if bed is not None:
        assign_bed(actor=actor, stay=stay, bed=bed, assigned_at=admitted_at)
    return stay


@transaction.atomic
def set_attending(*, actor, stay, attending):
    """Re-assign the physicians following a stay (several, replaceable).

    Not on the audited list of ADR 0019 §4 and deliberately left there:
    the set is exploitation-side staffing, it carries no money and no
    clinical content, and the stay itself is already journalised. The
    center-perimeter invariant is structural (``m2m_changed`` receiver).
    """
    stay = _lock_stay(stay)
    if stay.is_terminal:
        raise ValidationError(
            "Ce séjour est clos : les médecins assignés ne changent plus."
        )
    attending = list(attending)
    for membership in attending:
        if membership.center_id != stay.center_id:
            raise ValidationError("Ce praticien n'appartient pas à ce centre.")
    stay.attending.set(attending)
    return stay


def _transition(stay, target):
    """One state-machine step, serialised on the ROW (patron scheduling).

    The status is re-read under ``select_for_update`` so two concurrent
    actions (discharge vs cancel) can never both pass the legality check —
    the loser re-reads the winner's state and gets the clean French 400.
    Every caller is ``transaction.atomic``.
    """
    locked = Stay.objects.select_for_update().get(pk=stay.pk)
    if target not in STAY_TRANSITIONS[locked.status]:
        raise ValidationError(
            f"Transition impossible : ce séjour est "
            f"« {locked.get_status_display()} »."
        )
    return locked


@transaction.atomic
def discharge_stay(*, actor, stay, discharged_at=None):
    """Discharge: ``en_cours → sortie``.

    Three effects, all in the same transaction — a rollback leaves the
    patient hospitalised, in his bed, with his consultation open:

    1. the bed is released (the board frees the place immediately);
    2. the pivot consultation is CLOSED (``close_encounter``) — clinical
       production stops with the stay, exactly like an outpatient visit;
    3. the stay becomes terminal, definitively.

    Billing stays possible afterwards: an invoice is routinely built after
    the care ends (decision documented in the ADR 0008 S1 addendum), and
    the hospitalisation days are precisely billed at that moment.
    """
    locked = _transition(stay, Status.DISCHARGED)
    discharged_at = discharged_at or timezone.now()
    if discharged_at < locked.admitted_at:
        raise ValidationError("La sortie ne peut pas précéder l'admission.")
    if discharged_at > timezone.now() + PAST_TOLERANCE:
        raise ValidationError(
            "Impossible d'enregistrer une sortie dans le futur."
        )
    _release_open_assignment(actor=actor, stay=locked, at=discharged_at)
    locked.status = Status.DISCHARGED
    locked.discharged_at = discharged_at
    locked.save(update_fields=["status", "discharged_at", "updated_at"])
    _close_pivot(actor=actor, stay=locked)
    audit(
        actor=actor, action=AuditAction.STAY_DISCHARGED, target=locked,
        center=locked.center,
        stay_id=locked.pk, patient_id=locked.patient_id,
        center_id=locked.center_id, encounter_id=locked.encounter_id,
    )
    stay.status = locked.status
    stay.discharged_at = locked.discharged_at
    return locked


@transaction.atomic
def cancel_stay(*, actor, stay, reason):
    """Cancel an admission entered BY MISTAKE: ``en_cours → annule``.

    Not a discharge, and the difference matters: a cancelled stay never
    happened. Hence the two guards (ADR 0019, décision 3):

    - the motive is MANDATORY (structural, ``Stay.save()``) — it stays on
      the row, read by the clinical staff, and NEVER enters an audit
      payload (same class as ``Invoice.cancel_reason``);
    - **not a single act may have been recorded on the pivot** — « aucune
      journée facturée ». An admission that already produced billable care
      was not a data-entry error, and cancelling it would raise the invoice
      cascade question that ``close_encounter`` deliberately left out of
      scope.

    The pivot consultation is CLOSED rather than left hanging: clinical
    production must stop with the stay, and ``annulee`` on an encounter is
    an unresolved cascade (ADR 0008 S1) this sprint does not reopen.
    """
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError("Le motif d'annulation est obligatoire.")
    locked = _transition(stay, Status.CANCELLED)
    if ActPerformed.objects.filter(encounter_id=locked.encounter_id).exists():
        raise ValidationError(
            "Ce séjour porte déjà des actes : il ne peut plus être annulé "
            "comme une erreur de saisie (utilisez la sortie)."
        )
    _release_open_assignment(actor=actor, stay=locked)
    locked.status = Status.CANCELLED
    locked.cancel_reason = reason
    locked.save(update_fields=["status", "cancel_reason", "updated_at"])
    _close_pivot(actor=actor, stay=locked)
    audit(
        actor=actor, action=AuditAction.STAY_CANCELLED, target=locked,
        center=locked.center,
        # References only — the motive is free text and stays on the row.
        stay_id=locked.pk, patient_id=locked.patient_id,
        center_id=locked.center_id, encounter_id=locked.encounter_id,
    )
    stay.status = locked.status
    stay.cancel_reason = locked.cancel_reason
    return locked


# ---------------------------------------------------------------------------
# Billing: N journées = N actes (ADR 0019, décision 4)
# ---------------------------------------------------------------------------


def billed_days(stay):
    """Number of hospitalisation days already posted on the pivot.

    Derived, never stored: the count of ``ActPerformed`` rows of the pivot
    consultation whose FROZEN generic category is ``hospitalisation``
    (ADR 0005 snapshot — a later grid change can never rewrite it).

    This count IS the cumulative base of the cap below, which is why
    :func:`bill_stay_days` now refuses a tariff of any other generic
    category: a « journée » billed under ``autre`` would be invisible here
    and would silently reopen the ceiling it was meant to respect.
    """
    return ActPerformed.objects.filter(
        encounter_id=stay.encounter_id,
        generic_category=ActCategory.HOSPITALISATION,
    ).count()


def billable_days_cap(stay):
    """How many days this stay opens the right to bill, IN TOTAL.

    **Règle produit (correctif PO du 15/08/2026), à relire comme telle :
    toute journée CIVILE entamée sous le toit du centre est facturable, et
    pas une de plus.** Concrètement, le plafond est le nombre de dates
    distinctes touchées par le séjour, en heure des Comores :

        plafond = (date de fin − date d'admission) + 1

    - un séjour **en cours** court jusqu'à *maintenant* (le plafond grandit
      avec lui, sans qu'aucune tâche n'ait à le rafraîchir) ;
    - un séjour **sorti** s'arrête à ``discharged_at`` — définitivement,
      puisque les états terminaux le sont ;
    - une admission et une sortie le même jour ouvrent **1** journée : une
      hospitalisation de quatre heures se facture, elle n'est pas gratuite.

    Pourquoi la journée civile plutôt que des tranches de 24 h : c'est la
    façon dont un service compte (« elle est restée du 3 au 7 »), c'est
    vérifiable par le patient sur un calendrier mural sans arithmétique sur
    des horodatages, et cela n'interdit pas la pratique courante « jour
    d'entrée + jour de sortie » (une nuit à cheval sur deux dates ouvre
    bien 2 journées). Un décompte en tranches de 24 h l'aurait interdite,
    et Chioni aurait imposé une politique de facturation au lieu de poser
    une borne.

    C'est un PLAFOND, jamais un montant : le centre facture ce qu'il juste,
    en dessous ; le système refuse seulement l'impossible.

    Les bornes locales suivent ``TIME_ZONE`` (Indian/Comoro), comme le
    journal de caisse et la file du jour des rendez-vous.
    """
    end = stay.discharged_at or timezone.now()
    if end < stay.admitted_at:  # sécurité : jamais un plafond négatif
        end = stay.admitted_at
    start_date = timezone.localtime(stay.admitted_at).date()
    end_date = timezone.localtime(end).date()
    return (end_date - start_date).days + 1


def _existing_day_billing_for_key(*, center_id, key):
    """The committed billing gesture already carrying (center, key), or
    None — relations preloaded for the caller's answer."""
    return (
        StayDayBilling.objects.filter(center_id=center_id, idempotency_key=key)
        .select_related("stay", "tariff")
        .first()
    )


def _validate_idempotent_replay(existing, *, stay, tariff, days):
    """A replayed key must describe the SAME gesture.

    Patron ``_validate_idempotent_replay`` de la caisse (ADR 0015,
    correctif guardian S1) : une clé rejouée avec d'autres paramètres est
    un bug du client, refusé EXPLICITEMENT — jamais « fusionné » dans la
    mauvaise facturation, et jamais répondu en silence avec l'ancien
    résultat (ce qui effacerait des livres la seconde intention).
    """
    if (
        existing.stay_id != stay.pk
        or existing.tariff_id != tariff.pk
        or existing.days != days
    ):
        raise ValidationError(
            "Cette clé d'idempotence a déjà servi pour une autre "
            "facturation de journées : rejouez la requête à l'identique ou "
            "changez de clé."
        )


def bill_stay_days(*, actor, stay, tariff, days, idempotency_key):
    """Post ONE ``ActPerformed`` per hospitalisation day on the pivot.

    The three rules of ADR 0019 décision 4, and why:

    - **N lignes, jamais une ligne × N.** Adding a ``quantity`` on an
      invoice line would break ``recompute_total()``, ``unpaid_invoices_qs``
      and ``stats/finances`` — three places where the money is read. One
      act per day costs one row and breaks nothing.
    - **Le staff déclenche.** Nothing bills automatically at discharge: an
      automatic run would turn a date typo into a real debt on a patient.
    - **Aucun second moteur.** The tariff is an ordinary line of the
      center's grid; ``create_invoice`` then takes over unchanged, and the
      guardian sees ``hospitalisation`` as the generic nature of the act —
      already the Trust Bridge contract (ADR 0005), no clinical leak.

    **Correctif PO du 15/08/2026** (revue guardian S6) — deux garde-fous
    que ce geste n'avait pas, et qui font de lui de l'argent sérieux :

    1. ``idempotency_key`` est OBLIGATOIRE. Rejouer la même clé à
       l'identique renvoie la MÊME facturation (aucun acte de plus, aucune
       entrée d'audit de plus) ; la rejouer avec d'autres paramètres est
       un 400 explicite. Sans elle, un double-clic posait 2 × N actes que
       ``create_invoice`` (sans ``act_ids``) réclamait ensuite pour de vrai
       à un patient.
    2. Le cumul des journées facturées ne peut pas dépasser
       :func:`billable_days_cap` — la durée RÉELLE du séjour.

    La résolution du rejeu se fait sous le verrou du séjour et **avant**
    toute vérification d'état ou de plafond : le rejeu du geste qui a
    atteint le plafond doit renvoyer son résultat, pas le refus que ce
    geste vient de créer (leçon de la caisse : « facture déjà réglée » ne
    doit jamais masquer le rejeu de son propre reçu).

    Ce wrapper traite la seule course que le verrou du séjour ne sérialise
    pas : deux requêtes de même clé sur des séjours DIFFÉRENTS (lignes de
    verrou distinctes). La contrainte d'unicité tranche, la transaction du
    perdant (actes compris) est annulée, et le gagnant déjà commité est
    relu ici — hors de la transaction avortée.

    ``_require_open_encounter`` is deliberately NOT applied: it gates
    clinical production (prescriptions, carnet entries), while acts are
    BILLING production — and the days of a stay are normally billed after
    the discharge has closed the pivot.
    """
    key = (idempotency_key or "").strip()
    if not key:
        raise ValidationError(
            "La clé d'idempotence est obligatoire pour facturer des "
            "journées d'hospitalisation."
        )
    if len(key) > 64:
        raise ValidationError("La clé d'idempotence dépasse 64 caractères.")
    try:
        return _bill_stay_days(
            actor=actor, stay=stay, tariff=tariff, days=days,
            idempotency_key=key,
        )
    except IntegrityError as exc:
        if "unique_stay_day_billing_key_per_center" not in str(exc):
            raise
        existing = _existing_day_billing_for_key(
            center_id=stay.center_id, key=key
        )
        if existing is None:  # pragma: no cover — constraint said otherwise
            raise
        _validate_idempotent_replay(
            existing, stay=stay, tariff=tariff, days=days
        )
        existing.was_replayed = True
        return existing


@transaction.atomic
def _bill_stay_days(*, actor, stay, tariff, days, idempotency_key):
    """THE billing path — see :func:`bill_stay_days` for the contract."""
    if not isinstance(days, int) or isinstance(days, bool):
        raise ValidationError("Le nombre de journées doit être un entier.")
    if days < 1:
        raise ValidationError("Le nombre de journées doit être au moins 1.")
    if days > MAX_BILLABLE_DAYS:
        raise ValidationError(
            f"Trop de journées en une seule fois (maximum "
            f"{MAX_BILLABLE_DAYS})."
        )
    # Le verrou du séjour est LE point de sérialisation de ce geste :
    # deux facturations concurrentes du même séjour y font la queue, si
    # bien que ni le rejeu ni le plafond ne se décident sur une lecture
    # périmée. Hiérarchie du module : patient → lit → séjour.
    locked = _lock_stay(stay)
    existing = _existing_day_billing_for_key(
        center_id=locked.center_id, key=idempotency_key
    )
    if existing is not None:
        _validate_idempotent_replay(
            existing, stay=locked, tariff=tariff, days=days
        )
        existing.was_replayed = True
        return existing
    if locked.status == Status.CANCELLED:
        raise ValidationError(
            "Ce séjour est annulé : aucune journée ne peut être facturée."
        )
    if tariff.center_id != locked.center_id:
        raise ValidationError(
            "Un acte ne peut référencer qu'un tarif de la grille de ce centre."
        )
    if not tariff.is_active:
        raise ValidationError("Ce tarif n'est plus actif.")
    if tariff.generic_category != ActCategory.HOSPITALISATION:
        # Sans cette exigence le compteur de journées (dérivé de la
        # catégorie figée) ignorerait les actes posés ici, et le plafond
        # ci-dessous se rouvrirait tout seul à chaque geste.
        raise ValidationError(
            "Une journée d'hospitalisation se facture avec un tarif de "
            "nature générique « hospitalisation »."
        )
    cap = billable_days_cap(locked)
    already = billed_days(locked)
    if already + days > cap:
        end = locked.discharged_at or timezone.now()
        raise ValidationError(
            f"Facturation refusée : ce séjour ouvre {cap} journée(s) "
            f"facturable(s) (du "
            f"{timezone.localtime(locked.admitted_at):%d/%m/%Y} au "
            f"{timezone.localtime(end):%d/%m/%Y}), dont {already} déjà "
            f"facturée(s) — vous en demandez {days}. On ne facture pas "
            f"plus de journées que le séjour n'en a duré."
        )
    billing = StayDayBilling(
        stay=locked, center_id=locked.center_id, tariff=tariff, days=days,
        idempotency_key=idempotency_key, billed_by=actor,
    )
    billing.save()
    acts = [
        ActPerformed.objects.create(
            encounter_id=locked.encounter_id, tariff_item=tariff
        )
        for _ in range(days)
    ]
    billing.acts.set(acts)
    audit(
        actor=actor, action=AuditAction.STAY_DAYS_BILLED, target=locked,
        center=locked.center,
        # References, counts and the tariff id — never a label, never a
        # motive (the amount is readable on the acts and the invoice), and
        # never the idempotency key: it is free text typed by a client.
        stay_id=locked.pk, patient_id=locked.patient_id,
        center_id=locked.center_id, encounter_id=locked.encounter_id,
        tariff_id=tariff.pk, days=days, billing_id=billing.pk,
    )
    return billing


# ---------------------------------------------------------------------------
# The occupancy board (ADR 0019, décision 6)
# ---------------------------------------------------------------------------


def occupancy_rows(center):
    """Rooms → beds → the stay occupying each bed, for ONE center.

    Lives HERE and not in ``stats_views.py`` on purpose (ADR 0019, décision
    6): « combien de lits libres maintenant ? » serves to ADMIT — it is
    care, not piloting. ``stats_views`` is gelable by the subscription and
    its ``assertNumQueries`` are locked; an occupancy board has no business
    inheriting either constraint.
    """
    from django.db.models import Prefetch

    open_assignments = (
        BedAssignment.objects.filter(released_at__isnull=True)
        .select_related("stay__patient", "stay__encounter")
        .order_by("-assigned_at", "-id")
    )
    beds = (
        Bed.objects.filter(room__center=center)
        .prefetch_related(
            Prefetch(
                "assignments", queryset=open_assignments, to_attr="open_rows"
            )
        )
        .order_by("name", "id")
    )
    return (
        Room.objects.for_center(center)
        .prefetch_related(Prefetch("beds", queryset=beds))
        .order_by("name", "id")
    )


def stays_queryset(center):
    """The center's stays, with everything the serializers read prefetched.

    ``billed_days_count`` is annotated rather than counted per row: a ward
    board of twenty stays must cost one aggregate, not twenty queries.
    """
    from django.db.models import Count, Prefetch, Q

    open_assignments = (
        BedAssignment.objects.filter(released_at__isnull=True)
        .select_related("bed__room")
        .order_by("-assigned_at", "-id")
    )
    return (
        Stay.objects.for_center(center)
        .select_related("patient", "encounter")
        .annotate(
            billed_days_count=Count(
                "encounter__acts",
                filter=Q(
                    encounter__acts__generic_category=(
                        ActCategory.HOSPITALISATION
                    )
                ),
                distinct=True,
            )
        )
        .prefetch_related(
            Prefetch(
                "bed_assignments",
                queryset=open_assignments,
                to_attr="open_assignments",
            ),
            "attending__user",
        )
    )


def resolve_tariff(center, tariff_pk):
    """Body reference (S1 norm): one explicit 400 covering the foreign and
    the non-existent id alike."""
    tariff = TariffItem.objects.for_center(center).filter(pk=tariff_pk).first()
    if tariff is None:
        raise ValidationError(
            "Un acte ne peut référencer qu'un tarif de la grille de ce centre."
        )
    return tariff
