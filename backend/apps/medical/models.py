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

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import ActCategory, TimeStampedModel
from apps.common.private_storage import PrivateMediaStorage


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
        # S3 (ADR 0016 §3) — richer carnet, same free-text contract (the
        # fine structuration — CIM codes, coded posology — is explicitly
        # deferred to the i18n / paper-recovery chantiers).
        SURGERY = "chirurgie", "Chirurgie / hospitalisation antérieure"
        FAMILY_HISTORY = "antecedent_familial", "Antécédent familial"
        OBSERVATION = "observation", "Observation (note d'évolution)"

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


class PatientMedicalFile(TimeStampedModel):
    """Structured medical file of a patient — CLINICAL sphere (S3, ADR 0016).

    One per patient (OneToOne), created lazily at the first clinical write
    (``get_or_create`` in the service). Blood group and clinical notes are
    HEALTH data (RGPD art. 9): readable/writable by CLINICAL roles of the
    perimeter and readable by the patient — NEVER by administrative staff,
    the pharmacist, or a guardian (S3 sprint lock: no guardian exposure).

    Measures (height, weight, vitals) deliberately do NOT live here: they
    are per-visit data (``VitalSigns``), not static attributes.
    """

    class BloodGroup(models.TextChoices):
        A_POS = "A+", "A+"
        A_NEG = "A-", "A−"
        B_POS = "B+", "B+"
        B_NEG = "B-", "B−"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB−"
        O_POS = "O+", "O+"
        O_NEG = "O-", "O−"

    patient = models.OneToOneField(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="medical_file",
    )
    blood_group = models.CharField(
        "groupe sanguin", max_length=3, choices=BloodGroup.choices, blank=True
    )
    notes = models.TextField("notes cliniques", blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="mis à jour par",
        on_delete=models.PROTECT,
        related_name="patient_medical_files_updated",
    )

    class Meta:
        verbose_name = "fiche médicale patient"
        verbose_name_plural = "fiches médicales patients"

    def __str__(self) -> str:
        return f"Fiche médicale de {self.patient}"

    def save(self, *args, **kwargs):
        # Structural guard for service callers too (choices are not
        # validated by save() in Django): an impossible blood group is
        # refused, never stored.
        if self.blood_group and self.blood_group not in self.BloodGroup.values:
            raise ValidationError(
                "Groupe sanguin invalide : A+, A-, B+, B-, AB+, AB-, O+ ou O-."
            )
        super().save(*args, **kwargs)


#: S3 (ADR 0016 §4) — plausibility bounds per measure. Deliberately WIDE
#: (they must accept every real patient, newborn to outlier) but
#: physiologically defensible: any value outside is a typo or a unit error,
#: refused and never stored. Sources: extreme documented clinical ranges
#: (e.g. SpO2 measurable floor ~40 %, survived hypothermia ~30 °C,
#: hyperthermia < 45 °C, extreme HR 20–300 bpm).
VITAL_SIGNS_BOUNDS = {
    "systolic_bp": (40, 300),        # mmHg
    "diastolic_bp": (20, 200),       # mmHg
    "heart_rate": (20, 300),         # bpm
    "spo2": (40, 100),               # %
    "temperature_c": (Decimal("30.0"), Decimal("45.0")),  # °C
    "respiratory_rate": (4, 90),     # /min
    "weight_kg": (Decimal("0.40"), Decimal("400.00")),    # kg (prématuré → obésité extrême)
    "height_cm": (20, 260),          # cm
}

#: The measure fields of :class:`VitalSigns` — at least ONE is required.
VITAL_SIGNS_MEASURE_FIELDS = tuple(VITAL_SIGNS_BOUNDS)


class VitalSigns(TimeStampedModel):
    """One set of vital signs measured during a consultation (S3, ADR 0016).

    Anchored on the encounter (PROTECT, mandatory): the hospitalised
    context with repeated charted measurements is the S6 module — this
    model does not prefigure it. Several rows per encounter are fine
    (before/after treatment); a closed encounter refuses new rows
    (service-level, same ``_require_open_encounter`` rule as the carnet).

    ``measured_by`` carries the SAME practitioner-of-the-center invariant
    as ``Appointment.practitioner`` (structural, in ``save()``): a staff
    membership from another tenant can never sign a measure here.
    """

    encounter = models.ForeignKey(
        Encounter,
        verbose_name="consultation",
        on_delete=models.PROTECT,
        related_name="vital_signs",
    )
    measured_at = models.DateTimeField("mesuré le", default=timezone.now)
    measured_by = models.ForeignKey(
        "centers.StaffMembership",
        verbose_name="mesuré par",
        on_delete=models.PROTECT,
        related_name="vital_signs_measured",
    )
    systolic_bp = models.PositiveSmallIntegerField(
        "PA systolique (mmHg)", null=True, blank=True
    )
    diastolic_bp = models.PositiveSmallIntegerField(
        "PA diastolique (mmHg)", null=True, blank=True
    )
    heart_rate = models.PositiveSmallIntegerField(
        "fréquence cardiaque (bpm)", null=True, blank=True
    )
    spo2 = models.PositiveSmallIntegerField("SpO₂ (%)", null=True, blank=True)
    temperature_c = models.DecimalField(
        "température (°C)", max_digits=4, decimal_places=1, null=True, blank=True
    )
    respiratory_rate = models.PositiveSmallIntegerField(
        "fréquence respiratoire (/min)", null=True, blank=True
    )
    weight_kg = models.DecimalField(
        "poids (kg)", max_digits=6, decimal_places=2, null=True, blank=True
    )
    height_cm = models.PositiveSmallIntegerField(
        "taille (cm)", null=True, blank=True
    )

    objects = ViaEncounterQuerySet.as_manager()

    class Meta:
        verbose_name = "signes vitaux"
        verbose_name_plural = "signes vitaux"
        ordering = ["-measured_at", "-id"]

    def __str__(self) -> str:
        return f"Signes vitaux — consultation #{self.encounter_id}"

    def clean(self):
        # Practitioner-of-the-center invariant (same as Appointment).
        if (
            self.measured_by_id is not None
            and self.encounter_id is not None
            and self.measured_by.center_id != self.encounter.center_id
        ):
            raise ValidationError("Ce praticien n'appartient pas à ce centre.")
        values = {
            name: getattr(self, name) for name in VITAL_SIGNS_MEASURE_FIELDS
        }
        if all(value is None for value in values.values()):
            raise ValidationError(
                "Au moins une mesure est requise pour un relevé de signes vitaux."
            )
        for name, value in values.items():
            if value is None:
                continue
            low, high = VITAL_SIGNS_BOUNDS[name]
            if not (low <= value <= high):
                label = self._meta.get_field(name).verbose_name
                raise ValidationError(
                    {name: [f"Valeur impossible pour « {label} » "
                            f"(bornes plausibles : {low}–{high})."]}
                )
        # A diastolic pressure equal to or above the systolic one is not a
        # measurement, it is a swap or a typo — refused.
        if (
            self.systolic_bp is not None
            and self.diastolic_bp is not None
            and self.diastolic_bp >= self.systolic_bp
        ):
            raise ValidationError(
                "La pression diastolique doit être inférieure à la systolique."
            )

    def save(self, *args, **kwargs):
        # Invariants re-imposed on every write path (create()/save() never
        # call clean() by themselves) — project engineering rule.
        self.clean()
        super().save(*args, **kwargs)


class PatientDocument(TimeStampedModel):
    """A document attached to the carnet — photo of a medical paper (S3).

    Clinical sphere, transversal ownership (ADR 0002): the row belongs to
    the PATIENT and carries its PRODUCING center for staff-side read
    scoping — exactly the ``HealthRecordEntry.source_encounter`` model.

    Two hard contracts (ADR 0016 §5):

    - **Upload**: the bytes pass through the ADR 0014 hardened pipeline
      (JPEG/PNG/WebP only — PDF explicitly deferred, 2 MB, re-encode
      stripping EXIF/GPS, uuid name). Enforced by the service.
    - **Private diffusion**: the file lives under ``PRIVATE_MEDIA_ROOT``
      (storage below), NEVER under ``MEDIA_URL``; no serializer exposes a
      URL; reading goes through the authenticated download endpoints that
      replay the list permissions.

    Archiving (``archived_at``/``archived_by``) is the error-correction
    path — ADR 0002: nothing medical is ever deleted. Archiving is FINAL
    (structural guard in ``save()``); the patient no longer sees an
    archived document, the producing center's clinical staff still sees
    its state.
    """

    class DocType(models.TextChoices):
        LAB_RESULT = "resultat_biologie", "Résultat de biologie"
        IMAGING = "imagerie", "Imagerie"
        REPORT = "compte_rendu", "Compte rendu"
        OTHER = "autre", "Autre"

    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="documents",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre producteur",
        on_delete=models.PROTECT,
        related_name="patient_documents",
    )
    source_encounter = models.ForeignKey(
        Encounter,
        verbose_name="consultation source",
        on_delete=models.PROTECT,
        related_name="documents",
        null=True,
        blank=True,
    )
    doc_type = models.CharField(
        "type de document", max_length=24, choices=DocType.choices
    )
    title = models.CharField("titre", max_length=255)
    file = models.FileField(
        "fichier",
        storage=PrivateMediaStorage(),
        upload_to="patient_documents/%Y/%m/",
        max_length=255,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="déposé par",
        on_delete=models.PROTECT,
        related_name="patient_documents_uploaded",
    )
    archived_at = models.DateTimeField("archivé le", null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="archivé par",
        on_delete=models.PROTECT,
        related_name="patient_documents_archived",
        null=True,
        blank=True,
    )

    objects = PatientScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "document patient"
        verbose_name_plural = "documents patients"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Document {self.get_doc_type_display()} — {self.patient}"

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def save(self, *args, **kwargs):
        # Structural invariants (every write path):
        # 1. source encounter, when given, must belong to the SAME patient
        #    and the SAME producing center — a document can never smuggle a
        #    foreign encounter into a patient's carnet.
        if self.source_encounter_id is not None:
            if self.source_encounter.patient_id != self.patient_id:
                raise ValidationError(
                    "La consultation source ne concerne pas ce patient."
                )
            if self.source_encounter.center_id != self.center_id:
                raise ValidationError(
                    "La consultation source n'appartient pas à ce centre."
                )
        # 2. Archiving is FINAL (ADR 0002: correction without destruction —
        #    never a resurrection).
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("archived_at", flat=True)
                .first()
            )
            if previous is not None and self.archived_at is None:
                raise ValidationError(
                    "Un document archivé le reste : l'archivage est définitif."
                )
        super().save(*args, **kwargs)


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

    class CollectedVia(models.TextChoices):
        """S2 (ADR 0004 addendum) — how a DESK-collected consent was
        obtained. Empty string = granted by the patient from their own
        space (the historical, default path)."""

        PAPER = "papier", "Formulaire papier signé au guichet"
        ORAL = "oral", "Recueil oral au guichet"

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
    # S2 (ADR 0004 addendum) — traceability of DESK collection (porte C):
    # a consent recorded by the center for an UNCLAIMED patient carries WHO
    # collected it and HOW (paper form / orally). Both stay empty on the
    # historical path (the patient granting from their own space) — the
    # semantics of the grant itself are IDENTICAL, only the collection
    # trace differs.
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="recueilli par",
        on_delete=models.PROTECT,
        related_name="consents_collected",
        null=True,
        blank=True,
        help_text=(
            "Agent du centre qui a recueilli le consentement au guichet "
            "(patient non revendiqué, porte C). Vide quand le patient "
            "l'accorde lui-même depuis son espace."
        ),
    )
    collected_via = models.CharField(
        "mode de recueil",
        max_length=8,
        choices=CollectedVia.choices,
        blank=True,
        help_text=(
            "Mode de recueil au guichet (papier signé / oral). Vide quand "
            "le patient l'accorde lui-même depuis son espace."
        ),
    )

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
