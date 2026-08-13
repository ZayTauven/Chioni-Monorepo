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
        ]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} — {self.actor or 'système'} — {self.action}"

    @classmethod
    def log(cls, *, actor, action, target=None, **payload):
        """Convenience writer used by services and views."""
        entry = cls(actor=actor, action=action, payload=payload)
        if target is not None:
            entry.content_type = ContentType.objects.get_for_model(type(target))
            entry.object_id = str(target.pk)
        entry.save()
        return entry
