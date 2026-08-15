"""Hospitalisation: rooms, beds, stays (S6 — ADR 0019).

**Le séjour héberge, la consultation soigne** (ADR 0019, décision 1). A
``Stay`` carries the HOSTING context — patient, center, dates, priority,
attending physicians — and is adossé to a MANDATORY pivot ``Encounter``
which keeps carrying the clinical production and the billing. Nothing of
the existing clinical layer moves:

- ``VitalSigns.encounter`` stays MANDATORY, so the surveillance sheet of an
  inpatient is just repeated readings on the pivot consultation, and
  ``ViaEncounterQuerySet.for_patient()`` (``encounter__patient``) keeps the
  patient's transversal carnet complete;
- ``ActPerformed.encounter`` and ``Invoice.encounter`` stay non-null, so
  billing a stay invents no second engine: N days = N acts on the pivot
  (:func:`apps.inpatient.services.bill_stay_days`), never a quantity on a
  line (that would break ``recompute_total``, ``unpaid_invoices_qs`` and
  ``stats/finances``).

Four tables, and the reason each exists:

- :class:`Room` / :class:`Bed` — the physical resource. No floor, no
  service, no bed type in S6 (arbitrage PO n° 1): ``Room`` is ready for a
  nullable ``floor`` the day it is needed.
- :class:`BedAssignment` — the occupation ITSELF, as history. A transfer
  RELEASES the current assignment and OPENS a new one: a bed's history is
  stacked, never rewritten, which is what makes a transfer traceable.
  **The exclusivity of a bed is guaranteed by the DATABASE** (partial
  ``UniqueConstraint`` on ``bed`` ``WHERE released_at IS NULL``), not by
  ward discipline — and the race is proved with real threads, like the
  cash desk (ADR 0015).
- :class:`Stay` — has NO ``bed`` field on purpose: the current bed is READ
  from the open assignment. A patient admitted WITHOUT a bed (waiting,
  corridor — Comorian reality) is therefore representable, and that is
  deliberate: refusing an admission for lack of a free bed would mean
  refusing a patient who is physically there.
- :class:`StayDayBilling` — ONE billing gesture, with the client's
  idempotency token and the acts it produced (correctif PO du
  15/08/2026). It exists so the question « ces N actes ont-ils déjà été
  posés par cet appel ? » has a single unambiguous answer, and so the
  answer survives a lost HTTP response.

Tenant isolation (ADR 0002): every table is operating data of ONE center
and every API queryset goes through ``for_center()``. The clinical/
administrative segmentation of the READ payload lives in the serializers
(patron ``EncounterClinicalSerializer`` / ``EncounterAdminSerializer``).

**The commercial freeze never applies here** (ADR 0019, décision 6): this
app does not import ``require_center_can_administer`` and never will — a
bed is the physical prerequisite of an admission, and freezing it would
mean preventing a center from hospitalising. The S5 fail-closed probe
(``tests/test_adversarial_s5.py``) locks the importers list by strict
equality and fails the whole suite if anyone ever forgets.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from apps.centers.models import CenterScopedQuerySet
from apps.common.models import AppendOnlyModel, TimeStampedModel


class BedQuerySet(models.QuerySet):
    """Beds are operating data of a center, reached through their room."""

    def for_center(self, center):
        return self.filter(room__center=center)

    def available(self):
        """Active beds of an active room carrying NO open assignment.

        The exclusion goes through an EXPLICIT subquery of occupied bed ids
        rather than ``exclude(assignments__released_at__isnull=True)``: the
        latter is the classic Django trap — the LEFT JOIN of a bed with NO
        assignment at all yields a NULL ``released_at``, so a brand-new
        empty bed would exclude itself and the ward would look full.
        """
        occupied = BedAssignment.objects.filter(
            released_at__isnull=True
        ).values("bed_id")
        return self.filter(is_active=True, room__is_active=True).exclude(
            pk__in=occupied
        )


class StayQuerySet(models.QuerySet):
    """A stay is BOTH operating data of a center and an episode of the
    patient's own record — hence the two scoping helpers (the staff views
    use ``for_center`` exclusively, ``/patients/me/stays/`` uses
    ``for_patient``)."""

    def for_center(self, center):
        return self.filter(center=center)

    def for_patient(self, patient):
        return self.filter(patient=patient)

    def ongoing(self):
        return self.filter(status=Stay.Status.IN_PROGRESS)


class Room(TimeStampedModel):
    """A room of a center — the container of beds.

    Deliberately minimal (ADR 0019, décision 2): no floor, no service, no
    room category. ``is_active`` exists so the model is ready for the day
    a room leaves service; S6 exposes no toggle for it (bed maintenance
    states are explicitly out of scope), and the querysets already honour
    the flag.
    """

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="rooms",
    )
    name = models.CharField("nom", max_length=64)
    is_active = models.BooleanField("active", default=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "chambre"
        verbose_name_plural = "chambres"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "name"], name="unique_room_name_per_center"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.center.name}"


class Bed(TimeStampedModel):
    """One bed of a room — the exclusive resource of the module."""

    room = models.ForeignKey(
        Room,
        verbose_name="chambre",
        on_delete=models.PROTECT,
        related_name="beds",
    )
    name = models.CharField("nom", max_length=64)
    is_active = models.BooleanField("actif", default=True)

    objects = BedQuerySet.as_manager()

    class Meta:
        verbose_name = "lit"
        verbose_name_plural = "lits"
        ordering = ["room__name", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "name"], name="unique_bed_name_per_room"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.room.name} / {self.name}"

    @property
    def center_id(self):
        return self.room.center_id


class Stay(TimeStampedModel):
    """One hospitalisation episode — the HOSTING context (ADR 0019 §1).

    ``encounter`` is a MANDATORY ``OneToOne``: one does not hospitalise
    without a medical act. It is opened by the admission and CLOSED by the
    discharge, so it stays open from the first day to the last — which is
    precisely what lets the surveillance readings (``VitalSigns``) hang off
    it unchanged.

    ``reason`` deliberately does NOT exist here: the admission motive is
    CLINICAL and lives on ``Encounter.reason``, already role-gated inside
    the tenant (R-API-1). Duplicating it on the stay would create a second,
    ungated copy of the same secret.

    ``bed`` deliberately does NOT exist either — see the module docstring.
    """

    class Status(models.TextChoices):
        IN_PROGRESS = "en_cours", "En cours"
        DISCHARGED = "sortie", "Sorti"
        CANCELLED = "annule", "Annulé"

    class Priority(models.TextChoices):
        NORMAL = "normale", "Normale"
        URGENT = "urgente", "Urgente"
        CRITICAL = "critique", "Critique"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="stays",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="stays",
    )
    encounter = models.OneToOneField(
        "medical.Encounter",
        verbose_name="consultation pivot",
        on_delete=models.PROTECT,
        related_name="stay",
        help_text=(
            "Porte la production clinique et la facturation du séjour "
            "(ADR 0019 §1). Ouverte à l'admission, clôturée à la sortie."
        ),
    )
    admitted_at = models.DateTimeField("admis le")
    discharged_at = models.DateTimeField("sorti le", null=True, blank=True)
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.IN_PROGRESS
    )
    priority = models.CharField(
        "priorité", max_length=16, choices=Priority.choices, default=Priority.NORMAL
    )
    attending = models.ManyToManyField(
        "centers.StaffMembership",
        verbose_name="médecins assignés",
        related_name="inpatient_stays_attended",
        blank=True,
        help_text=(
            "Plusieurs intervenants possibles, réassignables — c'est la "
            "raison pour laquelle un séjour n'est pas un Encounter (dont le "
            "praticien est un singleton non-nul)."
        ),
    )
    admitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="admis par",
        on_delete=models.PROTECT,
        related_name="stays_admitted",
    )
    cancel_reason = models.TextField(
        "motif d'annulation",
        blank=True,
        help_text=(
            "Obligatoire pour annuler une admission saisie par erreur. "
            "Jamais un motif d'admission (celui-là est clinique) et jamais "
            "en payload d'audit."
        ),
    )

    objects = StayQuerySet.as_manager()

    class Meta:
        verbose_name = "séjour"
        verbose_name_plural = "séjours"
        ordering = ["-admitted_at", "-id"]
        indexes = [
            # The occupancy board: one center, the ongoing stays.
            models.Index(fields=["center", "status"]),
            models.Index(fields=["patient", "-admitted_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"Séjour {self.patient} @ {self.center.name} "
            f"({self.admitted_at:%d/%m/%Y}, {self.get_status_display()})"
        )

    @property
    def is_terminal(self) -> bool:
        return self.status in (self.Status.DISCHARGED, self.Status.CANCELLED)

    @property
    def current_assignment(self):
        """The OPEN bed assignment, or None (a stay may have no bed).

        Honours the ``open_assignments`` prefetch (``to_attr``) so the
        occupancy board and the stay list never pay one query per row.
        """
        cached = getattr(self, "open_assignments", None)
        if cached is not None:
            return cached[0] if cached else None
        return (
            self.bed_assignments.filter(released_at__isnull=True)
            .select_related("bed__room")
            .first()
        )

    @property
    def current_bed(self):
        assignment = self.current_assignment
        return assignment.bed if assignment is not None else None

    def save(self, *args, **kwargs):
        # Structural invariants — replayed on EVERY write path, not only in
        # the services (project engineering rule, CLAUDE.md).
        #
        # 1. The pivot consultation belongs to the same patient AND the same
        #    center: a stay can never smuggle a foreign encounter into a
        #    patient's record, nor bill another tenant's consultation.
        if self.encounter_id is not None:
            if self.encounter.patient_id != self.patient_id:
                raise ValidationError(
                    "La consultation pivot ne concerne pas ce patient."
                )
            if self.encounter.center_id != self.center_id:
                raise ValidationError(
                    "La consultation pivot n'appartient pas à ce centre."
                )
        # 2. A terminal stay is FINAL: no resurrection, ever (same posture
        #    as the archiving of a document — ADR 0002/0016).
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )
            if (
                previous in (self.Status.DISCHARGED, self.Status.CANCELLED)
                and self.status != previous
            ):
                raise ValidationError(
                    "Un séjour clos ne peut plus changer d'état."
                )
        # 3. Dates and motives must corroborate the status.
        if self.discharged_at is not None:
            if self.status != self.Status.DISCHARGED:
                raise ValidationError(
                    "Seul un séjour sorti porte une date de sortie."
                )
            if self.discharged_at < self.admitted_at:
                raise ValidationError(
                    "La sortie ne peut pas précéder l'admission."
                )
        elif self.status == self.Status.DISCHARGED:
            raise ValidationError("Un séjour sorti doit porter sa date de sortie.")
        if self.status == self.Status.CANCELLED and not (
            self.cancel_reason or ""
        ).strip():
            raise ValidationError("Le motif d'annulation est obligatoire.")
        super().save(*args, **kwargs)


@receiver(m2m_changed, sender=Stay.attending.through)
def _check_attending_belongs_to_center(sender, instance, action, pk_set, **kwargs):
    """Practitioner-of-the-center invariant for the ``attending`` set.

    A ``ManyToManyField`` is never written through ``Stay.save()``:
    ``add()``/``set()`` compile to a bulk insert on the through table. The
    structural equivalent of the ``save()`` guard is therefore this
    ``pre_add`` receiver — it covers every write path (service, admin,
    shell, fixtures) exactly as ``Appointment.save()`` covers its own
    practitioner FK.
    """
    if action != "pre_add" or not pk_set:
        return
    from apps.centers.models import StaffMembership

    foreign = (
        StaffMembership.objects.filter(pk__in=pk_set)
        .exclude(center_id=instance.center_id)
        .exists()
    )
    if foreign:
        raise ValidationError("Ce praticien n'appartient pas à ce centre.")


class BedAssignment(TimeStampedModel):
    """One occupation of a bed by a stay — history, stacked never rewritten.

    Append-only in SPIRIT and enforced as such by ``save()``: once created,
    the ONLY fields that may ever change are ``released_at`` /
    ``released_by``, and a released assignment can never be re-opened. A
    transfer closes the current row and opens a new one, so the bed's
    history reads as a chain of occupations — which is what makes a
    transfer traceable at all.

    **The exclusivity invariant is the DATABASE's** (see ``constraints``):
    one open assignment per bed, one open assignment per stay. Two
    simultaneous admissions on the same bed are impossible by construction,
    not by discipline — and the services take the bed's row lock first so
    the loser gets a clean French 400 instead of an IntegrityError.
    """

    stay = models.ForeignKey(
        Stay,
        verbose_name="séjour",
        on_delete=models.PROTECT,
        related_name="bed_assignments",
    )
    bed = models.ForeignKey(
        Bed,
        verbose_name="lit",
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    assigned_at = models.DateTimeField("occupé depuis")
    released_at = models.DateTimeField("libéré le", null=True, blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="assigné par",
        on_delete=models.PROTECT,
        related_name="bed_assignments_made",
    )
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="libéré par",
        on_delete=models.PROTECT,
        related_name="bed_assignments_released",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "occupation de lit"
        verbose_name_plural = "occupations de lit"
        ordering = ["-assigned_at", "-id"]
        constraints = [
            # THE invariant of the module (ADR 0019, décision 2): a bed can
            # never receive two patients. Partial index — the history of
            # released assignments is unlimited.
            models.UniqueConstraint(
                fields=["bed"],
                condition=models.Q(released_at__isnull=True),
                name="unique_open_assignment_per_bed",
            ),
            # Its mirror: a patient is in ONE bed at a time. Without it a
            # transfer that forgot to release would leave the stay in two
            # beds and the occupancy board would count the patient twice.
            models.UniqueConstraint(
                fields=["stay"],
                condition=models.Q(released_at__isnull=True),
                name="unique_open_assignment_per_stay",
            ),
        ]

    def __str__(self) -> str:
        state = "en cours" if self.released_at is None else "libéré"
        return f"{self.bed} — séjour #{self.stay_id} ({state})"

    @property
    def is_open(self) -> bool:
        return self.released_at is None

    def save(self, *args, **kwargs):
        if self.pk is None:
            # 1. Perimeter: the bed belongs to the center of the stay.
            if self.bed.room.center_id != self.stay.center_id:
                raise ValidationError("Ce lit n'appartient pas à ce centre.")
            # 2. An out-of-service bed or room never receives a patient.
            if not self.bed.is_active or not self.bed.room.is_active:
                raise ValidationError("Ce lit n'est pas disponible.")
            # 3. Only a LIVE stay occupies a bed.
            if self.stay.status != Stay.Status.IN_PROGRESS:
                raise ValidationError(
                    "Ce séjour est clos : aucun lit ne peut plus lui être "
                    "attribué."
                )
        else:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values("stay_id", "bed_id", "assigned_at", "released_at")
                .first()
            )
            if previous is not None:
                if (
                    previous["stay_id"] != self.stay_id
                    or previous["bed_id"] != self.bed_id
                    or previous["assigned_at"] != self.assigned_at
                ):
                    raise ValidationError(
                        "L'historique d'occupation d'un lit ne se réécrit "
                        "pas : libérez l'occupation et ouvrez-en une autre."
                    )
                if previous["released_at"] is not None and self.released_at is None:
                    raise ValidationError(
                        "Une occupation libérée le reste : la libération est "
                        "définitive."
                    )
        if self.released_at is not None and self.released_at < self.assigned_at:
            raise ValidationError(
                "La libération ne peut pas précéder l'occupation."
            )
        super().save(*args, **kwargs)


class StayDayBilling(AppendOnlyModel):
    """ONE gesture « facturer N journées » — the unit of idempotence.

    Correctif PO du 15/08/2026 (revue guardian S6). Billing days posts N
    ``ActPerformed`` rows on the pivot consultation, and ``create_invoice``
    without ``act_ids`` bills EVERY act of that consultation: a replayed
    POST (double-clic, timeout on a Comorian network, retry) therefore
    turned into a real, doubled debt claimed from a patient. The remedy is
    the one the caisse already uses (ADR 0015, correctif guardian S1): a
    token supplied by the CLIENT, unique per center **at the database
    level**, resolved before any write.

    **Why the token lives on a batch and not on the acts themselves.** The
    question to answer is « ces N actes ont-ils déjà été posés par CET
    appel ? ». On ``ActPerformed`` the token would be duplicated N times
    (so no unique constraint could carry it), it would have no center to
    be unique per (``ActPerformed`` reaches its center through two joins),
    and it would push an inpatient concern into the shared money model of
    the whole product. A batch answers the question exactly — ``acts`` IS
    the list — carries its own ``center`` for the constraint (patron
    ``CashPayment.center``), and keeps every S6-specific column inside
    ``apps.inpatient``.

    Append-only like every money-adjacent row of the project: a gesture is
    never edited. A billing mistake is corrected where money mistakes are
    corrected — the invoice (``POST invoices/{pk}/cancel/`` releases the
    acts, which become billable again).
    """

    stay = models.ForeignKey(
        Stay,
        verbose_name="séjour",
        on_delete=models.PROTECT,
        related_name="day_billings",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="stay_day_billings",
        help_text=(
            "Dénormalisation de ``stay.center`` : c'est elle qui porte "
            "l'unicité de la clé d'idempotence (patron CashPayment)."
        ),
    )
    tariff = models.ForeignKey(
        "centers.TariffItem",
        verbose_name="tarif appliqué",
        on_delete=models.PROTECT,
        related_name="stay_day_billings",
    )
    days = models.PositiveSmallIntegerField("journées facturées")
    idempotency_key = models.CharField(
        "clé d'idempotence",
        max_length=64,
        help_text=(
            "Fournie par le client, OBLIGATOIRE : rejouer la même clé "
            "renvoie la même facturation au lieu d'en poser une seconde. "
            "Unique par centre (contrainte DB)."
        ),
    )
    acts = models.ManyToManyField(
        "medical.ActPerformed",
        verbose_name="actes posés",
        related_name="stay_day_billings",
        help_text="Les N actes que CE geste a posés sur la consultation pivot.",
    )
    billed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="facturé par",
        on_delete=models.PROTECT,
        related_name="stay_day_billings",
    )

    class Meta:
        verbose_name = "facturation de journées"
        verbose_name_plural = "facturations de journées"
        ordering = ["-created_at", "-id"]
        constraints = [
            # THE invariant of the correctif: one billing gesture per
            # (center, key). Two simultaneous replays can never both
            # insert — the DB is the last arbiter, not the service.
            models.UniqueConstraint(
                fields=["center", "idempotency_key"],
                name="unique_stay_day_billing_key_per_center",
            ),
            models.CheckConstraint(
                condition=models.Q(days__gte=1),
                name="stay_day_billing_days_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.days} journée(s) — séjour #{self.stay_id}"

    def save(self, *args, **kwargs):
        # Structural invariants, replayed on EVERY write path (project
        # engineering rule) — the service is not the only door.
        if self.center_id != self.stay.center_id:
            raise ValidationError(
                "Facturation refusée : le centre ne correspond pas à celui "
                "du séjour."
            )
        if self.tariff.center_id != self.center_id:
            raise ValidationError(
                "Un acte ne peut référencer qu'un tarif de la grille de ce "
                "centre."
            )
        self.idempotency_key = (self.idempotency_key or "").strip()
        if not self.idempotency_key:
            raise ValidationError(
                "La clé d'idempotence est obligatoire pour facturer des "
                "journées d'hospitalisation."
            )
        if not self.days or self.days < 1:
            raise ValidationError(
                "Le nombre de journées doit être au moins 1."
            )
        super().save(*args, **kwargs)
