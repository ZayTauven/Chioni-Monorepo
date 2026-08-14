"""Audit: the immutable log of every sensitive action.

Money, medical data, consents and role changes MUST write here. Rows are
append-only (same locking as the ledger): an audit trail that can be
edited is worthless.
"""

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import AppendOnlyModel


class AuditLog(AppendOnlyModel):
    """One sensitive action, journalised forever."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="acteur",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
        help_text="Vide pour les actions système (webhooks PSP, tâches planifiées…).",
    )
    action = models.CharField(
        "action",
        max_length=128,
        help_text="Verbe qualifié, ex. « payment_request.created », « consent.revoked ».",
    )
    content_type = models.ForeignKey(
        ContentType,
        verbose_name="type de cible",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    object_id = models.CharField("identifiant cible", max_length=64, blank=True)
    target = GenericForeignKey("content_type", "object_id")
    # S4 (ADR 0017, décision 5) — the TENANT the action belongs to, posted
    # explicitly by ``audit(center=…)``. Before this column there was no
    # way to query « the journal of my center »: ``payload__center_id`` was
    # present on SOME actions only, in un-indexed JSONB.
    #
    # NULL is a first-class value, not a gap to fill: transverse actions
    # (OTP, account creation, guardianship links, doors A/B) belong to no
    # center, and every row written BEFORE this column existed keeps a NULL
    # forever — the table is append-only (ORM + PostgreSQL trigger,
    # ADR 0006) and back-filling history for an API's comfort is exactly
    # what that ADR forbids. The director's journal says so honestly
    # (``journal_starts_at``).
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
        help_text=(
            "Centre concerné par l'action, quand elle en concerne un. "
            "Vide pour les actions transverses (authentification, tutelle, "
            "profils patients hors guichet)."
        ),
    )
    payload = models.JSONField(
        "données",
        default=dict,
        blank=True,
        help_text="Contexte minimal de l'action — jamais de donnée clinique en clair inutile.",
    )

    class Meta:
        verbose_name = "entrée d'audit"
        verbose_name_plural = "journal d'audit"
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["action"]),
            # The director's journal reads « this center, most recent
            # first, over a window » — one composite index serves it.
            models.Index(fields=["center", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} — {self.actor or 'système'} — {self.action}"

    @classmethod
    def log(cls, *, actor, action, target=None, center=None, **payload):
        """Convenience writer used by services and views.

        ``center`` is a COLUMN, never a payload key: it is the only
        reference the API filters on, and it must be indexable.
        """
        entry = cls(actor=actor, action=action, center=center, payload=payload)
        if target is not None:
            entry.content_type = ContentType.objects.get_for_model(type(target))
            entry.object_id = str(target.pk)
        entry.save()
        return entry
