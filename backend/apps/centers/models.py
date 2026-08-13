"""Centers: the SaaS tenant and its operating data.

``HealthCenter`` is THE tenant. Every operating model (staff, tariffs —
and later appointments, cash desk) carries a ``center`` FK and exposes a
``for_center()`` queryset method: API querysets for operating data MUST go
through it so no data ever leaks between centers.
"""

from django.conf import settings
from django.db import models
from django.db.models.functions import Round

from apps.common.models import ActCategory, TimeStampedModel
from apps.common.money import validate_kmf_integral


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
        help_text="Un centre ne peut recevoir de paiements qu'une fois vérifié (actif).",
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
