"""Patients: patient identity, diaspora guardians and guardianship links.

Key design point (needs study §3): a ``PatientProfile`` can exist WITHOUT
a ``User`` — created by a guardian (door A) or a health center (door C).
It stays "unclaimed" (limited rights for its creator) until the patient
activates the account via OTP on their phone. Identity fields therefore
live on the profile itself, and ``phone`` is NOT unique here (only the
verified ``User.phone`` is). Duplicate profiles are expected and resolved
through the merge mechanism (``merged_into``).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.common.models import Currency, TimeStampedModel


class PatientProfile(TimeStampedModel):
    """A patient's identity on the platform — owner of the health record."""

    class ClaimStatus(models.TextChoices):
        UNCLAIMED = "non_revendique", "Non revendiqué"
        INVITED = "invite", "Invité (SMS envoyé)"
        ACTIVE = "actif", "Actif (compte revendiqué)"

    class Sex(models.TextChoices):
        FEMALE = "f", "Féminin"
        MALE = "m", "Masculin"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name="compte utilisateur",
        on_delete=models.PROTECT,
        related_name="patient_profile",
        null=True,
        blank=True,
        help_text="Vide tant que le profil n'est pas revendiqué par le patient (portes A et C).",
    )
    claim_status = models.CharField(
        "statut de revendication",
        max_length=16,
        choices=ClaimStatus.choices,
        default=ClaimStatus.UNCLAIMED,
    )
    last_name = models.CharField("nom", max_length=128)
    first_name = models.CharField("prénom", max_length=128)
    birth_date = models.DateField("date de naissance", null=True, blank=True)
    sex = models.CharField("sexe", max_length=1, choices=Sex.choices, blank=True)
    phone = models.CharField(
        "téléphone",
        max_length=32,
        blank=True,
        help_text=(
            "Déclaratif, NON unique : seul le téléphone du compte User est vérifié par OTP. "
            "Sert au rapprochement de doublons et à l'invitation SMS."
        ),
    )
    city = models.CharField("ville / village", max_length=128, blank=True)

    # S3 (ADR 0016 §1) — extended ADMINISTRATIVE identity. All optional
    # (Comorian desk reality: records are completed over time), all part of
    # ``IDENTITY_FIELDS`` (patients/services.py): once the profile is
    # claimed, only the patient edits them (R-API-2). Clinical data (blood
    # group, measures) does NOT live here — see medical.PatientMedicalFile.
    address = models.CharField("adresse", max_length=255, blank=True)
    phone_alt = models.CharField(
        "second téléphone",
        max_length=32,
        blank=True,
        help_text="Déclaratif, normalisé E.164 comme « téléphone ».",
    )
    national_id = models.CharField(
        "n° d'identité / identifiant médical",
        max_length=64,
        blank=True,
        help_text=(
            "Texte libre — aucun format imposé (réalité comorienne : CNI, "
            "passeport ou identifiant médical local)."
        ),
    )
    emergency_contact_name = models.CharField(
        "personne à prévenir (nom)", max_length=128, blank=True
    )
    emergency_contact_phone = models.CharField(
        "personne à prévenir (téléphone)",
        max_length=32,
        blank=True,
        help_text="Normalisé E.164 comme « téléphone ».",
    )
    emergency_contact_relationship = models.CharField(
        "personne à prévenir (lien)", max_length=64, blank=True
    )

    # Creator tracing (doors A/B/C) — dedicated fields, simpler than a GenericFK.
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="créé par (utilisateur)",
        on_delete=models.PROTECT,
        related_name="patient_profiles_created",
        null=True,
        blank=True,
        help_text="Tuteur (porte A), le patient lui-même (porte B) ou agent du centre (porte C).",
    )
    created_by_center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="créé par (centre)",
        on_delete=models.PROTECT,
        related_name="patient_profiles_created",
        null=True,
        blank=True,
        help_text="Renseigné quand le profil a été créé au guichet d'un centre (porte C).",
    )

    # Duplicate merge mechanism (needs study §3): the duplicate points to the
    # canonical profile; its history is then re-attached by the merge flow.
    merged_into = models.ForeignKey(
        "self",
        verbose_name="fusionné dans",
        on_delete=models.PROTECT,
        related_name="merged_duplicates",
        null=True,
        blank=True,
        help_text="Si renseigné, ce profil est un doublon absorbé par le profil canonique pointé.",
    )

    class Meta:
        verbose_name = "profil patient"
        verbose_name_plural = "profils patients"
        constraints = [
            # A claimed (active) profile must have a user; unclaimed must not.
            models.CheckConstraint(
                condition=(
                    models.Q(claim_status="actif", user__isnull=False)
                    | ~models.Q(claim_status="actif")
                ),
                name="active_patient_profile_requires_user",
            ),
            # M6 — DB belt: a profile can never be merged into itself.
            models.CheckConstraint(
                condition=(
                    models.Q(merged_into__isnull=True)
                    | ~models.Q(merged_into=models.F("id"))
                ),
                name="patient_profile_no_self_merge",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or f"Patient #{self.pk}"

    @property
    def is_claimed(self) -> bool:
        return self.claim_status == self.ClaimStatus.ACTIVE

    def save(self, *args, **kwargs):
        # M6 — merge guards: never into oneself, and ONLY into a canonical
        # profile (a target that has itself been absorbed would create
        # chains/cycles and make canonical resolution loop forever).
        if self.merged_into_id is not None:
            if self.pk is not None and self.merged_into_id == self.pk:
                raise ValidationError(
                    "Un profil patient ne peut pas être fusionné dans lui-même."
                )
            target = (
                type(self)
                .objects.filter(pk=self.merged_into_id)
                .values("merged_into_id")
                .first()
            )
            if target is not None and target["merged_into_id"] is not None:
                raise ValidationError(
                    "Fusion refusée : le profil cible est lui-même un doublon absorbé. "
                    "Fusionnez vers le profil canonique."
                )
        super().save(*args, **kwargs)


class GuardianProfile(TimeStampedModel):
    """A diaspora guardian (tuteur) — pays care for their protected relatives."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name="compte utilisateur",
        on_delete=models.PROTECT,
        related_name="guardian_profile",
    )
    country_of_residence = models.CharField(
        "pays de résidence",
        max_length=2,
        default="FR",
        help_text="Code ISO 3166-1 alpha-2 (FR, RE, YT, AE…).",
    )
    preferred_currency = models.CharField(
        "devise préférée",
        max_length=3,
        choices=Currency.choices,
        default=Currency.EUR,
    )
    # S10 lot 1 (ADR 0023 décision 1) — la porte de sortie du tuteur, posée
    # AVANT le canal qu'elle refuse. Elle ne couvre QUE la relance : la
    # notification initiale d'une demande de paiement est le service qu'il
    # est venu chercher, pas une sollicitation (et le SMS « reçu émis » est
    # la preuve de ce qu'il a payé). Art. 21 RGPD — les tuteurs sont
    # résidents UE.
    payment_reminders = models.BooleanField(
        "relances de paiement",
        default=True,
        help_text=(
            "Relances SMS des factures impayées de ses protégés. La "
            "notification INITIALE d'une demande de paiement et le reçu ne "
            "sont jamais couverts par ce refus."
        ),
    )

    class Meta:
        verbose_name = "profil tuteur"
        verbose_name_plural = "profils tuteurs"

    def __str__(self) -> str:
        return f"Tuteur {self.user}"


class PatientContactPreference(TimeStampedModel):
    """Ce que la personne accepte de recevoir — S10 lot 1 (ADR 0023 §1).

    **La porte de sortie est construite AVANT les canaux.** Trois relances
    neuves livrées sans possibilité de refus seraient exactement la dérive
    que le sprint est censé éviter.

    OneToOne sur le PATIENT et non sur un couple (patient, centre) : la
    préférence appartient à la **personne**, elle est transversale comme le
    carnet (ADR 0002). Quelqu'un qui ne veut pas de SMS n'en veut pas de la
    clinique d'à côté non plus.

    Créée paresseusement au premier write (``get_or_create`` dans le
    service) et rendue en **forme complète constante** en lecture, ligne ou
    pas — patron exact de ``medical.PatientMedicalFile`` (S3) : un GET ne
    doit jamais laisser deviner qu'une préférence n'a « pas encore » été
    exprimée, et le défaut ``True`` est le comportement historique.

    **Ce que ces booléens ne couvrent JAMAIS** (ADR 0023 §1, verrouillé par
    test) : les messages de **sécurité et de consentement** — OTP de
    connexion, « un proche demande à pouvoir payer vos soins » (porte de
    confirmation du titulaire, invariant éthique du produit), « votre soin
    a été payé », invitation de tutelle. Se taire sur ceux-là ne
    protégerait personne : ça retirerait à la personne l'information dont
    elle a besoin pour décider. Un futur champ doit donc être un choix
    écrit, jamais un glissement.
    """

    patient = models.OneToOneField(
        PatientProfile,
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="contact_preference",
    )
    appointment_reminders = models.BooleanField(
        "rappels de rendez-vous",
        default=True,
        help_text="Rappel J-1 (ADR 0013) — refusable depuis S10.",
    )
    missed_appointment_followup = models.BooleanField(
        "reprise de contact après un rendez-vous manqué",
        default=True,
        help_text="Message unique et neutre du lendemain (ADR 0023 décision 5).",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="mis à jour par",
        on_delete=models.PROTECT,
        related_name="patient_contact_preferences_updated",
        help_text="La personne elle-même, ou l'agent du guichet (profil non revendiqué).",
    )

    class Meta:
        verbose_name = "préférences de contact du patient"
        verbose_name_plural = "préférences de contact des patients"

    def __str__(self) -> str:
        return f"Préférences de contact de {self.patient}"


#: Les canaux refusables, et EUX SEULS (ADR 0023 décision 1). La liste est
#: lue par le service d'écriture, par le sérialiseur et par les sondes : un
#: champ ajouté au modèle sans entrer ici ne devient pas refusable par
#: accident, et un canal de sécurité ne peut pas s'y glisser sans qu'un
#: humain relise ce diff.
CONTACT_PREFERENCE_FIELDS = (
    "appointment_reminders",
    "missed_appointment_followup",
)


def patient_accepts(patient, preference) -> bool:
    """Le patient accepte-t-il ``preference`` (code de
    :data:`CONTACT_PREFERENCE_FIELDS`) ?

    Vit ICI, à côté du modèle, et non dans ``services`` : c'est une
    LECTURE pure, et ``apps.common.notifications`` — qui doit la consulter
    avant chaque envoi refusable — est importé par ``patients.services``.
    La placer dans les services créerait un cycle d'imports que seul un
    import différé masquerait.

    Absence de ligne = accord (défaut historique du produit, antérieur à
    S10). Un code inconnu LÈVE plutôt que de rendre ``True`` par charité :
    une faute de frappe dans un appelant enverrait un SMS à quelqu'un qui
    l'a refusé, et le silence serait le pire des deux comportements.
    """
    if preference not in CONTACT_PREFERENCE_FIELDS:
        raise ValueError(
            f"Préférence de contact inconnue : {preference!r} — "
            f"attendu parmi {CONTACT_PREFERENCE_FIELDS}."
        )
    value = (
        PatientContactPreference.objects.filter(patient=patient)
        .values_list(preference, flat=True)
        .first()
    )
    return True if value is None else bool(value)


class GuardianLink(TimeStampedModel):
    """Guardianship link between a guardian and a patient.

    Multi-guardians per patient and multi-protected per guardian. The link
    only opens the MINIMAL visibility (payment requests, amounts, generic
    act nature, receipts) — any clinical detail requires an explicit
    ``medical.Consent`` from the patient.
    """

    class Status(models.TextChoices):
        INVITATION_SENT = "invitation_envoyee", "Invitation envoyée"
        # OTP-1 (revue guardian) — a link waiting for the PATIENT to confirm
        # it after the titulaire ARRIVED on the profile. Trois portes y
        # mènent : revendication OTP, fusion (lien déplacé sur une cible
        # revendiquée), fusion (transfert du titulaire sur la cible). Gives
        # NO visibility (it is not ACTIVE, so ``Consent.active_scopes``
        # returns ∅): the declarative phone never authorises a live link
        # without the titulaire's consent.
        PENDING_CLAIMANT_CONFIRMATION = (
            "attente_confirmation_titulaire",
            "En attente de confirmation du titulaire",
        )
        ACTIVE = "actif", "Actif"
        REVOKED = "revoque", "Révoqué"

    class InitiatedBy(models.TextChoices):
        GUARDIAN = "tuteur", "Le tuteur (porte A)"
        PATIENT = "patient", "Le patient (porte B)"
        CENTER = "centre", "Le centre de santé (porte C)"

    class Relationship(models.TextChoices):
        PARENT = "parent", "Parent (père / mère)"
        CHILD = "enfant", "Enfant (fils / fille)"
        SPOUSE = "conjoint", "Conjoint / Conjointe"
        SIBLING = "frere_soeur", "Frère / Sœur"
        EXTENDED_FAMILY = "famille_elargie", "Famille élargie (oncle, tante, cousin…)"
        FRIEND = "ami", "Ami / Amie"
        OTHER = "autre", "Autre"

    guardian = models.ForeignKey(
        GuardianProfile,
        verbose_name="tuteur",
        on_delete=models.PROTECT,
        related_name="links",
    )
    patient = models.ForeignKey(
        PatientProfile,
        verbose_name="protégé",
        on_delete=models.PROTECT,
        related_name="guardian_links",
    )
    relationship = models.CharField(
        "lien de parenté",
        max_length=16,
        choices=Relationship.choices,
        help_text="Lien du tuteur envers le protégé.",
    )
    status = models.CharField(
        "statut",
        max_length=32,
        choices=Status.choices,
        default=Status.INVITATION_SENT,
    )
    initiated_by = models.CharField(
        "initié par", max_length=8, choices=InitiatedBy.choices
    )
    # SV.1.1 (arbitrage PO S2, option b) — provenance du lien quand il est
    # né au guichet : QUEL centre a émis l'invitation. La garde « le centre
    # ne recueille pas de consentement clinique sur un lien qu'il a
    # lui-même fabriqué » a besoin de cette référence. Aucun
    # rétro-remplissage : les liens historiques porte C gardent NULL, et le
    # service de consentement guichet est FAIL-CLOSED sur cette valeur (un
    # lien centre dont on ne peut pas prouver la provenance est traité
    # comme initié par le centre demandeur — refuser un octroi de
    # consentement clinique est toujours la posture du produit).
    initiated_by_center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre initiateur",
        on_delete=models.PROTECT,
        related_name="initiated_guardian_links",
        null=True,
        blank=True,
        help_text=(
            "Centre qui a émis l'invitation quand le lien est né au guichet "
            "(porte C). Vide pour les portes A/B et pour les liens "
            "historiques antérieurs à SV (provenance non dérivable — "
            "fail-closed sur le consentement clinique guichet)."
        ),
    )
    accepted_at = models.DateTimeField("accepté le", null=True, blank=True)
    revoked_at = models.DateTimeField("révoqué le", null=True, blank=True)

    class Meta:
        verbose_name = "lien de tutelle"
        verbose_name_plural = "liens de tutelle"
        constraints = [
            models.UniqueConstraint(
                fields=["guardian", "patient"], name="unique_guardian_patient_link"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.guardian} → {self.patient} ({self.get_status_display()})"

    def clean(self):
        # A guardian must never be their own protected patient's profile owner.
        if (
            self.patient.user_id is not None
            and self.patient.user_id == self.guardian.user_id
        ):
            raise ValidationError(
                "Un utilisateur ne peut pas être tuteur de son propre profil patient."
            )

    def save(self, *args, **kwargs):
        # M7 — structural invariants are re-imposed here so that create()/
        # save() paths (which never call clean()) cannot bypass them.
        self.clean()
        # M2 — a revoked link is FINAL: no transition out of REVOKED, ever.
        # Guardianship is re-established by creating a NEW link (fresh
        # consent baseline), never by resurrecting the old one.
        if self.pk is not None:
            previous_status = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )
            if (
                previous_status == self.Status.REVOKED
                and self.status != self.Status.REVOKED
            ):
                raise ValidationError(
                    "Un lien de tutelle révoqué est définitif : créez un nouveau "
                    "lien plutôt que de réactiver l'ancien."
                )
        super().save(*args, **kwargs)

    def revoke(self):
        """Revoke the link AND every active consent riding on it — atomically.

        Without the cascade, a stale ``detail_clinique`` consent row would
        survive the link's revocation and silently spring back to life if
        the link were ever reactivated. Belt and braces: the cascade kills
        the stale rows, and ``save()`` forbids reactivation anyway.
        """
        with transaction.atomic():
            if self.status != self.Status.REVOKED:
                self.status = self.Status.REVOKED
                self.revoked_at = timezone.now()
                self.save(update_fields=["status", "revoked_at", "updated_at"])
            for consent in self.consents.active().select_for_update():
                consent.revoke()

    def suspend_for_claimant_confirmation(self):
        """OTP-1 — the titulaire's arrival on the profile suspends the link
        until they confirm it (trois portes : revendication OTP, fusion —
        lien déplacé sur cible revendiquée, fusion — transfert du titulaire).

        When the patient takes possession of their own profile (OTP claim
        or merge transfer), no guardian may keep a live link — and
        therefore any visibility — without the patient's explicit consent.
        The link drops to
        ``PENDING_CLAIMANT_CONFIRMATION`` (∅ scope) and its active consents
        are revoked so nothing stale can spring back if the patient later
        confirms. A REVOKED link is final and left untouched.
        """
        if self.status == self.Status.REVOKED:
            return
        with transaction.atomic():
            self.status = self.Status.PENDING_CLAIMANT_CONFIRMATION
            self.save(update_fields=["status", "updated_at"])
            for consent in self.consents.active().select_for_update():
                consent.revoke()


class PatientInsurance(TimeStampedModel):
    """An insurance/mutuelle line of a patient — ADMINISTRATIVE-financial.

    S3 (ADR 0016 §6). Transversal to centers like the carnet (ADR 0002):
    the row belongs to the PATIENT and is visible from every center whose
    perimeter includes them — an insurance card follows the person, not the
    facility. Several lines may coexist (mutuelle + assurance). Readable by
    any staff of the perimeter and by the patient; WRITTEN by billing roles
    only (it is billing data — enforced at the view layer). No interaction
    with invoicing in S3: tiers payant is a future chantier (consigné).

    Writes go through ``apps.patients.services`` exclusively (audited
    ``patient_insurance.created`` / ``.updated`` — ids and field names
    only, NEVER the insurer name or member number: ADR 0007).
    """

    patient = models.ForeignKey(
        PatientProfile,
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="insurances",
    )
    insurer_name = models.CharField("assureur / mutuelle", max_length=128)
    member_number = models.CharField("numéro d'adhérent", max_length=64)
    valid_until = models.DateField("valide jusqu'au", null=True, blank=True)
    notes = models.TextField("notes", blank=True)
    is_active = models.BooleanField("active", default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="créée par",
        on_delete=models.PROTECT,
        related_name="patient_insurances_created",
    )

    class Meta:
        verbose_name = "assurance patient"
        verbose_name_plural = "assurances patients"
        ordering = ["-is_active", "-created_at"]

    def __str__(self) -> str:
        state = "active" if self.is_active else "inactive"
        return f"Assurance de {self.patient} ({state})"
