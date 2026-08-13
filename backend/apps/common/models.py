"""Shared model building blocks (abstract only — no table lives here).

This module is intentionally NOT a Django app: it only contains abstract
models, enums and helpers imported by the business apps. Abstract models
need no app registration.
"""

from django.db import models


class Currency(models.TextChoices):
    """Currencies handled by the platform — every money field carries one."""

    EUR = "EUR", "Euro"
    KMF = "KMF", "Franc comorien"


class ActCategory(models.TextChoices):
    """Generic nature of a care act (ADR 0005).

    This is the ONLY care-related information a guardian sees under the
    minimal ``paiements`` consent scope. The detailed ``label`` of a
    tariff/act belongs to the ``detail_clinique`` scope and must never be
    exposed through payment views.
    """

    CONSULTATION = "consultation", "Consultation"
    ANALYSES_EXAMENS = "analyses_examens", "Analyses et examens"
    MEDICAMENTS = "medicaments", "Médicaments"
    HOSPITALISATION = "hospitalisation", "Hospitalisation"
    ACTE_TECHNIQUE = "acte_technique", "Acte technique"
    SOINS_INFIRMIERS = "soins_infirmiers", "Soins infirmiers"
    MATERNITE = "maternite", "Maternité"
    AUTRE = "autre", "Autre"


class TimeStampedModel(models.Model):
    """Abstract base adding systematic created/updated timestamps."""

    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("mis à jour le", auto_now=True)

    class Meta:
        abstract = True


class AppendOnlyError(Exception):
    """Raised when someone tries to mutate or delete an append-only record."""


class AppendOnlyQuerySet(models.QuerySet):
    """QuerySet that refuses bulk mutation of append-only tables."""

    def update(self, **kwargs):
        raise AppendOnlyError(
            f"{self.model.__name__} est en append-only : update() est interdit."
        )

    def delete(self):
        raise AppendOnlyError(
            f"{self.model.__name__} est en append-only : delete() est interdit."
        )

    def bulk_update(self, objs, fields, **kwargs):
        raise AppendOnlyError(
            f"{self.model.__name__} est en append-only : bulk_update() est interdit."
        )

    def bulk_create(
        self,
        objs,
        batch_size=None,
        ignore_conflicts=False,
        update_conflicts=False,
        update_fields=None,
        unique_fields=None,
    ):
        # C1 — bulk_create(update_conflicts=True) compiles to
        # INSERT ... ON CONFLICT DO UPDATE: a disguised UPDATE that would
        # rewrite an existing append-only row. Refused unconditionally.
        if update_conflicts:
            raise AppendOnlyError(
                f"{self.model.__name__} est en append-only : "
                "bulk_create(update_conflicts=True) est interdit "
                "(INSERT ... ON CONFLICT DO UPDATE réécrirait une ligne existante)."
            )
        return super().bulk_create(
            objs,
            batch_size=batch_size,
            ignore_conflicts=ignore_conflicts,
            update_conflicts=update_conflicts,
            update_fields=update_fields,
            unique_fields=unique_fields,
        )


class AppendOnlyModel(models.Model):
    """Abstract base for immutable records (ledger, audit log).

    Records can only be INSERTed: any attempt to update an existing row or
    to delete raises :class:`AppendOnlyError`, both at instance level and
    at queryset level. ``force_insert`` is always used so a manually set
    primary key can never silently overwrite an existing row.
    """

    created_at = models.DateTimeField("créé le", auto_now_add=True)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise AppendOnlyError(
                f"{type(self).__name__} est en append-only : "
                "modification d'un enregistrement existant refusée."
            )
        kwargs.pop("force_insert", None)
        kwargs.pop("force_update", None)
        super().save(*args, force_insert=True, **kwargs)

    def delete(self, *args, **kwargs):
        raise AppendOnlyError(
            f"{type(self).__name__} est en append-only : suppression refusée."
        )
