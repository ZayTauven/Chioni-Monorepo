"""Medical: the health record — it belongs to the PATIENT, across centers.

Two structural rules live here:

1. Medical data is attached to the patient (transversal to tenants) and
   exposes ``for_patient()`` querysets — the medical mirror of
   ``for_center()`` on operating data.
2. ``Consent`` is THE single source of truth for what a guardian may see.
   By default a guardian sees ONLY payment requests, amounts, the generic
   nature of the act and receipts. Any clinical detail (diagnosis,
   prescriptions, record entries) requires an explicit, revocable,
   traceable Consent granted by the patient. API permissions MUST call
   ``Consent.objects.active_scopes(guardian_link)`` — never re-implement
   the rule elsewhere.
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import ActCategory, TimeStampedModel


class PatientScopedQuerySet(models.QuerySet):
    """Health-record isolation helper: filter by owning patient."""

    def for_patient(self, patient):
        return self.filter(patient=patient)


class EncounterQuerySet(models.QuerySet):
    """Encounters sit at the crossing: patient-owned, produced by a center."""

    def for_patient(self, patient):
        return self.filter(patient=patient)

    def for_center(self, center):
        return self.filter(center=center)


class ViaEncounterQuerySet(models.QuerySet):
    """For models attached to the patient through their encounter."""

    def for_patient(self, patient):
        return self.filter(encounter__patient=patient)


class Encounter(TimeStampedModel):
    """A consultation: produced by a center, owned by the patient's record."""

    class Status(models.TextChoices):
        IN_PROGRESS = "en_cours", "En cours"
        COMPLETED = "terminee", "Terminée"
        CANCELLED = "annulee", "Annulée"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="encounters",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="encounters",
    )
    practitioner = models.ForeignKey(
        "centers.StaffMembership",
        verbose_name="praticien",
        on_delete=models.PROTECT,
        related_name="encounters",
    )
    occurred_at = models.DateTimeField("date de la consultation", default=timezone.now)
    reason = models.CharField("motif", max_length=255)
    diagnosis = models.TextField("diagnostic", blank=True)
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.IN_PROGRESS
    )

    objects = EncounterQuerySet.as_manager()

    class Meta:
        verbose_name = "consultation"
        verbose_name_plural = "consultations"
        ordering = ["-occurred_at"]

    def __str__(self) -> str:
        return f"Consultation {self.patient} @ {self.center.name} ({self.occurred_at:%d/%m/%Y})"


class ActPerformed(TimeStampedModel):
    """An act performed during an encounter, with tariff SNAPSHOT.

    Tariff grids change over time: the label and KMF price are frozen here
    at the moment the act is recorded. Invoices and the ledger rely on the
    snapshot, never on the live ``TariffItem``.
    """

    encounter = models.ForeignKey(
        Encounter,
        verbose_name="consultation",
        on_delete=models.PROTECT,
        related_name="acts",
    )
    tariff_item = models.ForeignKey(
        "centers.TariffItem",
        verbose_name="tarif appliqué",
        on_delete=models.PROTECT,
        related_name="acts_performed",
    )
    label_snapshot = models.CharField(
        "libellé (figé)",
        max_length=255,
        blank=True,
        help_text="Copié depuis le tarif au moment de l'acte ; ne suit pas les changements de grille.",
    )
    generic_category = models.CharField(
        "nature générique (figée)",
        max_length=24,
        choices=ActCategory.choices,
        blank=True,
        help_text=(
            "SNAPSHOT de la nature générique du tarif (ADR 0005). Seule information "
            "de soin exposée au tuteur sous la portée « paiements » ; le libellé "
            "détaillé relève de « detail_clinique »."
        ),
    )
    price_kmf_snapshot = models.DecimalField(
        "prix KMF (figé)",
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Copié depuis le tarif au moment de l'acte.",
    )

    objects = ViaEncounterQuerySet.as_manager()

    class Meta:
        verbose_name = "acte réalisé"
        verbose_name_plural = "actes réalisés"

    def __str__(self) -> str:
        return f"{self.label_snapshot} — {self.price_kmf_snapshot} KMF"

    def save(self, *args, **kwargs):
        # Freeze the tariff at first save; later grid changes must not leak in.
        if self._state.adding:
            if not self.label_snapshot:
                self.label_snapshot = self.tariff_item.label
            if self.price_kmf_snapshot is None:
                self.price_kmf_snapshot = self.tariff_item.price_kmf
            if not self.generic_category:
                self.generic_category = self.tariff_item.generic_category
        super().save(*args, **kwargs)


class Prescription(TimeStampedModel):
    """A prescription issued during an encounter."""

    class Status(models.TextChoices):
        ISSUED = "emise", "Émise"
        DELIVERED = "delivree", "Délivrée"

    encounter = models.ForeignKey(
        Encounter,
        verbose_name="consultation",
        on_delete=models.PROTECT,
        related_name="prescriptions",
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.ISSUED
    )

    objects = ViaEncounterQuerySet.as_manager()

    class Meta:
        verbose_name = "ordonnance"
        verbose_name_plural = "ordonnances"

    def __str__(self) -> str:
        return f"Ordonnance #{self.pk} ({self.get_status_display()})"


class PrescriptionItem(TimeStampedModel):
    """One line of a prescription (free text at MVP stage)."""

    prescription = models.ForeignKey(
        Prescription,
        verbose_name="ordonnance",
        on_delete=models.CASCADE,  # a line has no life outside its prescription
        related_name="items",
    )
    medication = models.CharField("médicament", max_length=255)
    dosage = models.TextField("posologie", blank=True)

    class Meta:
        verbose_name = "ligne d'ordonnance"
        verbose_name_plural = "lignes d'ordonnance"

    def __str__(self) -> str:
        return self.medication


class HealthRecordEntry(TimeStampedModel):
    """An entry of the transversal health record (owned by the patient)."""

    class EntryType(models.TextChoices):
        HISTORY = "antecedent", "Antécédent"
        ALLERGY = "allergie", "Allergie"
        CURRENT_TREATMENT = "traitement_en_cours", "Traitement en cours"
        VACCINATION = "vaccination", "Vaccination"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="health_record_entries",
    )
    entry_type = models.CharField(
        "type", max_length=24, choices=EntryType.choices
    )
    content = models.TextField("contenu")
    source_encounter = models.ForeignKey(
        Encounter,
        verbose_name="consultation source",
        on_delete=models.PROTECT,
        related_name="health_record_entries",
        null=True,
        blank=True,
        help_text="Renseigné quand l'entrée provient d'une consultation.",
    )

    objects = PatientScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "entrée du carnet de santé"
        verbose_name_plural = "entrées du carnet de santé"

    def __str__(self) -> str:
        return f"{self.get_entry_type_display()} — {self.patient}"


class ConsentQuerySet(models.QuerySet):
    def active(self):
        return self.filter(revoked_at__isnull=True)


class ConsentManager(models.Manager.from_queryset(ConsentQuerySet)):
    def active_scopes(self, guardian_link) -> frozenset:
        """THE source of truth for what a guardian link may see.

        Returns the effective set of scopes for this link:

        - empty set if the link itself is not active;
        - otherwise always the minimal ``PAYMENTS`` scope (payment
          requests, amounts, generic act nature, receipts);
        - plus ``CLINICAL_DETAIL`` only if the patient granted an
          explicit, unrevoked Consent.

        DRF permission classes must call this method — never re-derive
        the rule from raw Consent rows.
        """
        from apps.patients.models import GuardianLink

        if guardian_link.status != GuardianLink.Status.ACTIVE:
            return frozenset()
        scopes = {Consent.Scope.PAYMENTS}
        scopes.update(
            self.get_queryset()
            .active()
            .filter(guardian_link=guardian_link)
            .values_list("scope", flat=True)
        )
        return frozenset(scopes)

    def allows(self, guardian_link, scope) -> bool:
        """Convenience: does this link currently hold the given scope?"""
        return scope in self.active_scopes(guardian_link)


class Consent(TimeStampedModel):
    """An explicit, revocable grant from the patient to a guardian link.

    The minimal ``PAYMENTS`` scope exists WITHOUT any Consent row (it comes
    with an active GuardianLink). A Consent row materialises an EXTENDED
    grant — clinical detail — and its revocation is immediate.
    """

    class Scope(models.TextChoices):
        PAYMENTS = (
            "paiements",
            "Demandes de paiement, montants, nature générique, reçus (minimum)",
        )
        CLINICAL_DETAIL = (
            "detail_clinique",
            "Détail clinique : ordonnances détaillées, éléments du carnet",
        )

    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="consents",
    )
    guardian_link = models.ForeignKey(
        "patients.GuardianLink",
        verbose_name="lien de tutelle",
        on_delete=models.PROTECT,
        related_name="consents",
    )
    scope = models.CharField("portée", max_length=24, choices=Scope.choices)
    granted_at = models.DateTimeField("accordé le", default=timezone.now)
    revoked_at = models.DateTimeField("révoqué le", null=True, blank=True)

    objects = ConsentManager()

    class Meta:
        verbose_name = "consentement"
        verbose_name_plural = "consentements"
        constraints = [
            # At most ONE active grant per (link, scope); history of revoked
            # grants is kept for traceability.
            models.UniqueConstraint(
                fields=["guardian_link", "scope"],
                condition=models.Q(revoked_at__isnull=True),
                name="unique_active_consent_per_link_and_scope",
            ),
        ]

    def __str__(self) -> str:
        state = "révoqué" if self.revoked_at else "actif"
        return f"Consentement {self.get_scope_display()} ({state}) — {self.guardian_link}"

    def clean(self):
        if self.guardian_link.patient_id != self.patient_id:
            raise ValidationError(
                "Le consentement doit porter sur le lien de tutelle du même patient."
            )

    def save(self, *args, **kwargs):
        # Structural invariant, enforced even outside forms/serializers.
        if self.guardian_link.patient_id != self.patient_id:
            raise ValidationError(
                "Le consentement doit porter sur le lien de tutelle du même patient."
            )
        super().save(*args, **kwargs)

    def revoke(self):
        """Revoke the grant — effective immediately for permissions."""
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at", "updated_at"])
