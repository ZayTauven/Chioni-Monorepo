"""Centers: the SaaS tenant and its operating data.

``HealthCenter`` is THE tenant. Every operating model (staff, tariffs —
and later appointments, cash desk) carries a ``center`` FK and exposes a
``for_center()`` queryset method: API querysets for operating data MUST go
through it so no data ever leaks between centers.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Round

from apps.common.models import ActCategory, TimeStampedModel
from apps.common.money import validate_kmf_integral
from apps.common.private_storage import PrivateMediaStorage


class CenterScopedQuerySet(models.QuerySet):
    """Tenant isolation helper — every operating queryset goes through it."""

    def for_center(self, center):
        return self.filter(center=center)


def center_logo_upload_to(instance, filename):
    """Per-center media directory. ``filename`` is already a uuid + safe
    extension (apps/common/uploads.py re-normalises it — the client name
    never reaches this function's output)."""
    return f"centers/{instance.pk}/logo/{filename}"


class HealthCenter(TimeStampedModel):
    """A health facility — the SaaS tenant."""

    class Type(models.TextChoices):
        PUBLIC_HOSPITAL = "hopital_public", "Hôpital public"
        PRIVATE_CLINIC = "clinique_privee", "Clinique privée"
        HEALTH_CENTER = "centre_sante", "Centre de santé"
        PRACTICE = "cabinet", "Cabinet médical"
        PHARMACY = "pharmacie", "Pharmacie"

    class Island(models.TextChoices):
        NGAZIDJA = "ngazidja", "Ngazidja (Grande Comore)"
        NDZUWANI = "ndzuwani", "Ndzuwani (Anjouan)"
        MWALI = "mwali", "Mwali (Mohéli)"

    class KycStatus(models.TextChoices):
        PENDING = "en_attente", "En attente de vérification"
        ACTIVE = "actif", "Actif"
        SUSPENDED = "suspendu", "Suspendu"

    name = models.CharField("nom", max_length=255)
    type = models.CharField("type d'établissement", max_length=32, choices=Type.choices)
    island = models.CharField("île", max_length=16, choices=Island.choices)
    city = models.CharField("ville / localité", max_length=128)
    address = models.CharField("adresse", max_length=255, blank=True)
    phone = models.CharField("téléphone", max_length=32, blank=True)
    email = models.EmailField("e-mail", blank=True)
    kyc_status = models.CharField(
        "statut KYC",
        max_length=16,
        choices=KycStatus.choices,
        default=KycStatus.PENDING,
        help_text=(
            "Un centre ne peut recevoir de paiements de la diaspora qu'une "
            "fois vérifié (actif). « suspendu » ferme le RAIL DIASPORA et lui "
            "seul : le soin et la caisse locale continuent (ADR 0017)."
        ),
    )
    # S4 (ADR 0017, décision 3) — trace de la DERNIÈRE décision KYC. Le motif
    # est visible de la plateforme et du directeur du centre concerné, JAMAIS
    # d'un patient ni d'un tuteur, et JAMAIS d'un payload d'audit (texte libre
    # = même classe que le motif d'un litige — ADR 0007).
    kyc_reason = models.TextField(
        "motif de la décision KYC",
        blank=True,
        help_text=(
            "Obligatoire pour une suspension. Visible de la plateforme et du "
            "directeur du centre — jamais du patient ni du tuteur."
        ),
    )
    kyc_updated_at = models.DateTimeField("KYC décidé le", null=True, blank=True)
    kyc_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="KYC décidé par",
        on_delete=models.PROTECT,
        related_name="kyc_decisions",
        null=True,
        blank=True,
    )
    # « Nullable » au sens produit : pas de logo = chaîne vide (convention
    # Django pour FileField — null=True y est déconseillé) ; les serializers
    # exposent None. Écriture UNIQUEMENT via le service set_center_logo()
    # (pipeline durci apps/common/uploads.py), jamais par PATCH du centre.
    logo = models.ImageField(
        "logo",
        upload_to=center_logo_upload_to,
        blank=True,
        help_text=(
            "Affiché en sidebar, sur les factures et reçus à l'écran "
            "(l'impression PDF viendra avec le chantier PDF)."
        ),
    )

    class Meta:
        verbose_name = "centre de santé"
        verbose_name_plural = "centres de santé"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_island_display()})"


class KycDocument(TimeStampedModel):
    """One supporting document of a center's KYC file (ADR 0017, décision 3).

    Provided by the center's DIRECTOR (it is his paperwork), read by the
    Chioni platform to decide the KYC transition. Two hard contracts,
    inherited from ``medical.PatientDocument`` (ADR 0016 §5) — a director's
    ID card deserves exactly the same care as a lab result:

    - **Upload**: the bytes go through the ADR 0014 hardened pipeline
      (JPEG/PNG/WebP by REAL content — the PDF stays deferred, arbitrage
      réversible de l'ADR 0017 —, 2 MB, re-encode stripping EXIF/GPS, uuid
      name). Enforced by the service, throttle ``uploads``.
    - **Private diffusion**: the file lives under ``PRIVATE_MEDIA_ROOT``
      (storage below), NEVER under ``MEDIA_URL``; no serializer exposes a
      URL; reading goes through authenticated download endpoints that
      replay the exact list permissions.

    Archiving (``archived_at``/``archived_by``) is the correction path: a
    KYC piece is never deleted — the decision it supported must stay
    auditable. Archiving is FINAL (structural guard in ``save()``).
    """

    class DocType(models.TextChoices):
        TRADE_REGISTER = "registre_commerce", "Registre du commerce"
        HEALTH_LICENCE = "licence_sante", "Licence sanitaire"
        DIRECTOR_ID = "piece_identite_directeur", "Pièce d'identité du directeur"
        OTHER = "autre", "Autre"

    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="kyc_documents",
    )
    doc_type = models.CharField(
        "type de pièce", max_length=32, choices=DocType.choices
    )
    file = models.FileField(
        "fichier",
        storage=PrivateMediaStorage(),
        upload_to="kyc_documents/%Y/%m/",
        max_length=255,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="déposé par",
        on_delete=models.PROTECT,
        related_name="kyc_documents_uploaded",
    )
    archived_at = models.DateTimeField("archivé le", null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="archivé par",
        on_delete=models.PROTECT,
        related_name="kyc_documents_archived",
        null=True,
        blank=True,
    )

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "pièce KYC"
        verbose_name_plural = "pièces KYC"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_doc_type_display()} — {self.center.name}"

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def save(self, *args, **kwargs):
        # Archiving is FINAL: a KYC piece that supported a decision must
        # never be resurrected (same rule as PatientDocument, ADR 0016).
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("archived_at", flat=True)
                .first()
            )
            if previous is not None and self.archived_at is None:
                raise ValidationError(
                    "Une pièce KYC archivée le reste : l'archivage est définitif."
                )
        super().save(*args, **kwargs)


class StaffMembership(TimeStampedModel):
    """A user's role inside a center.

    Roles are cumulative: the same human can be doctor in one center,
    director in another and guardian of a relative — one membership row
    per (user, center, role).
    """

    class Role(models.TextChoices):
        DIRECTOR = "directeur", "Directeur"
        DOCTOR = "medecin", "Médecin"
        NURSE = "infirmier", "Infirmier / Infirmière"
        MIDWIFE = "sage_femme", "Sage-femme"
        SECRETARY = "secretaire", "Secrétaire"
        CASHIER = "caissier", "Caissier / Caissière"
        PHARMACIST = "pharmacien", "Pharmacien / Pharmacienne"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="utilisateur",
        on_delete=models.PROTECT,
        related_name="staff_memberships",
    )
    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="staff_memberships",
    )
    role = models.CharField("rôle", max_length=16, choices=Role.choices)
    is_active = models.BooleanField("actif", default=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "membre du personnel"
        verbose_name_plural = "membres du personnel"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "center", "role"],
                name="unique_membership_per_user_center_role",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} — {self.get_role_display()} @ {self.center.name}"


class TariffItem(TimeStampedModel):
    """One line of a center's tariff grid (prices in KMF).

    Prices change over time: models recording money (ActPerformed,
    InvoiceLine) must SNAPSHOT the label, price AND generic category,
    never rely on this row staying stable.

    Medical secrecy rule (ADR 0005): the guardian's minimal ``paiements``
    scope exposes ONLY ``generic_category``. The detailed ``label``
    (« Sérologie VIH », « IVG médicamenteuse »…) is clinical information
    and belongs to the ``detail_clinique`` scope.
    """

    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="tariff_items",
    )
    code = models.CharField("code", max_length=32)
    label = models.CharField("libellé", max_length=255)
    generic_category = models.CharField(
        "nature générique",
        max_length=24,
        choices=ActCategory.choices,
        default=ActCategory.AUTRE,
        help_text=(
            "Seule information de soin visible du tuteur (portée « paiements »). "
            "Le libellé détaillé relève du détail clinique."
        ),
    )
    price_kmf = models.DecimalField(
        "prix (KMF)",
        max_digits=12,
        decimal_places=2,
        validators=[validate_kmf_integral],
    )
    is_active = models.BooleanField("actif", default=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "tarif"
        verbose_name_plural = "grille tarifaire"
        constraints = [
            models.UniqueConstraint(
                fields=["center", "code"], name="unique_tariff_code_per_center"
            ),
            models.CheckConstraint(
                condition=models.Q(price_kmf__gte=0),
                name="tariff_price_kmf_positive",
            ),
            # S1 (vigilance 2a soldée) — the KMF integrality rule enforced
            # AT THE DATABASE: ``save()`` and the serializer already refuse
            # decimals, but a raw ``update()``/``bulk_create()`` bypassed
            # them (the exact hole probed by the wave-2b adversarial
            # review). ROUND(price) = price ⇔ whole francs.
            models.CheckConstraint(
                condition=models.Q(price_kmf=Round("price_kmf")),
                name="tariff_price_kmf_integral",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.code}] {self.label} — {self.price_kmf} KMF"

    def save(self, *args, **kwargs):
        # KMF has no sub-unit: a fractional tariff would flow into invoice
        # snapshots and create a balance the cash desk can never settle
        # (payments are whole francs only) — enforced here, not just at the
        # serializer, so no write path can slip through.
        validate_kmf_integral(self.price_kmf)
        super().save(*args, **kwargs)
