"""Scheduling: appointments and the day queue (« simple d'abord », §5.1 MVP).

Appointments are OPERATING data (ADR 0002): every row carries a ``center``
FK and every API queryset goes through ``for_center()`` — never a leak
across tenants. They are NOT in the sensitive-action list (no money, no
clinical content): no AuditLog, no append-only — an appointment gets moved,
that is its normal life. All writes still go through
``apps/scheduling/services.py`` (project rule: invariants live in services,
never in raw ``update()`` calls).

State machine (enforced by the services)::

    prevu ──> arrive ──> honore
      │         │
      ├─────────┴──> annule
      └──> manque

``honore``, ``manque`` and ``annule`` are terminal. ``scheduled_at``,
``duration_minutes``, ``practitioner`` and ``reason`` are only editable
while the appointment is still ``prevu``.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


class AppointmentQuerySet(models.QuerySet):
    """Tenant isolation helper — appointments are operating data."""

    def for_center(self, center):
        return self.filter(center=center)


class Appointment(TimeStampedModel):
    """A booked slot at a center — the unit of the day queue.

    ``reason`` — OPERATIONAL, not clinical (deliberate design choice):
    it is typed by the secretary at booking time and visible to EVERY
    active staff member of the center. It is the desk's routing note
    (« consultation », « suivi », « résultats d'analyses »), NOT the
    clinical ``Encounter.reason`` — that one is role-gated inside the
    tenant (R-API-1, ADR 0008 §5 bis) because a consultation motive can
    reveal a pathology. Here the field is authored BY desk staff FOR desk
    staff: gating it would only hide from the secretary what she herself
    wrote. The clinical story starts at the encounter, never here — and
    per ADR 0012 this field NEVER reaches an SMS.
    """

    class Status(models.TextChoices):
        SCHEDULED = "prevu", "Prévu"
        ARRIVED = "arrive", "Arrivé (salle d'attente)"
        HONORED = "honore", "Honoré"
        MISSED = "manque", "Manqué"
        CANCELLED = "annule", "Annulé"

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="appointments",
    )
    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="appointments",
    )
    practitioner = models.ForeignKey(
        "centers.StaffMembership",
        verbose_name="praticien",
        on_delete=models.PROTECT,
        related_name="appointments",
        null=True,
        blank=True,
        help_text="Optionnel : un rendez-vous peut être pris « avec le centre ».",
    )
    scheduled_at = models.DateTimeField("prévu le")
    duration_minutes = models.PositiveSmallIntegerField("durée (minutes)", default=20)
    reason = models.CharField(
        "motif opérationnel",
        max_length=255,
        blank=True,
        help_text=(
            "Note de guichet visible de tout le staff du centre — jamais un "
            "contenu clinique (voir docstring du modèle)."
        ),
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.SCHEDULED
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="créé par",
        on_delete=models.PROTECT,
        related_name="appointments_created",
    )
    reminder_sent_at = models.DateTimeField(
        "rappel envoyé le",
        null=True,
        blank=True,
        help_text=(
            "Anti-doublon du rappel J-1 (tâche beat quotidienne). Remis à NULL "
            "quand le rendez-vous est déplacé : un créneau qui change après "
            "l'envoi du rappel redevient éligible s'il retombe sur « demain »."
        ),
    )

    objects = AppointmentQuerySet.as_manager()

    class Meta:
        verbose_name = "rendez-vous"
        verbose_name_plural = "rendez-vous"
        ordering = ["scheduled_at", "id"]
        indexes = [
            # The day queue: one center, one local day, sorted by time.
            models.Index(fields=["center", "scheduled_at"]),
            # Overlap detection: one practitioner's agenda.
            models.Index(fields=["practitioner", "scheduled_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"RDV {self.patient} @ {self.center.name} "
            f"({self.scheduled_at:%d/%m/%Y %H:%M}, {self.get_status_display()})"
        )

    @property
    def end_at(self):
        return self.scheduled_at + timedelta(minutes=self.duration_minutes)

    def save(self, *args, **kwargs):
        # Structural cross-tenant invariant (enforced even outside services):
        # the practitioner must be a membership OF THIS center — a staff row
        # from another tenant can never be attached to my agenda.
        if self.practitioner_id is not None and (
            self.practitioner.center_id != self.center_id
        ):
            raise ValidationError("Ce praticien n'appartient pas à ce centre.")
        super().save(*args, **kwargs)
