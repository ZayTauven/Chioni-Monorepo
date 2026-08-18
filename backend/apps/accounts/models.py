"""Accounts: custom user model and OTP codes.

The verified phone number is the pivot identifier for the platform
(ADR 0001): OTP SMS is the primary auth path for patients and guardians
(ADR 0010); `username` + password JWT remains for staff/back-office.

A single ``User`` can wear several hats (doctor in a health center AND
guardian of a relative in the diaspora): roles are modelled as profiles /
memberships in their own apps — never as a single ``role`` field here.
"""

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class UserManager(DjangoUserManager):
    """User manager that keeps the ``phone`` unique constraint healthy.

    Empty strings on a unique column would collide between users, so any
    falsy phone value is normalised to ``NULL`` before reaching the
    database. Overriding ``_create_user_object`` covers both the sync
    (``create_user`` / ``create_superuser``) and async (``acreate_user``)
    creation paths.
    """

    use_in_migrations = True

    def _create_user_object(self, username, email, password, **extra_fields):
        if not extra_fields.get("phone"):
            extra_fields["phone"] = None
        return super()._create_user_object(username, email, password, **extra_fields)


def user_avatar_upload_to(instance, filename):
    """Per-user media directory. ``filename`` is already a uuid + safe
    extension (apps/common/uploads.py re-normalises it — the client name
    never reaches this function's output)."""
    return f"avatars/{instance.pk}/{filename}"


class User(AbstractUser):
    """Chioni user account."""

    phone = models.CharField(
        "numéro de téléphone",
        max_length=32,
        unique=True,  # unique=True also creates the database index
        null=True,  # nullable: staff/back-office accounts may live without one
        blank=True,
        help_text=(
            "Identifiant pivot de la plateforme (vérifié par OTP SMS — ADR 0010). "
            "Format international E.164, ex. +2693212345."
        ),
    )
    phone_verified_at = models.DateTimeField(
        "téléphone vérifié le",
        null=True,
        blank=True,
        help_text=(
            "Posé à la PREMIÈRE vérification OTP réussie. NULL = compte ombre "
            "(invitation/guichet) ou compte n'ayant jamais vérifié son numéro ; "
            "la pose vaut activation du compte (ADR 0010)."
        ),
    )
    # « Nullable » au sens produit : pas d'avatar = chaîne vide (convention
    # Django pour FileField). Écriture UNIQUEMENT via le service
    # set_user_avatar() (pipeline durci apps/common/uploads.py). Donnée
    # personnelle : exposée à soi-même (/auth/me/) et à l'annuaire du
    # personnel d'un centre — JAMAIS dans les vues croisées patient/tuteur.
    avatar = models.ImageField(
        "photo de profil",
        upload_to=user_avatar_upload_to,
        blank=True,
    )
    # S4 lot 3 (ADR 0007 + 0017 décision 7) — RGPD « pierre tombale ».
    # Posé par ``services.anonymize_user`` : la ligne subsiste comme ancre
    # technique des FK PROTECT (ledger, audit, reçus, factures) mais ne
    # porte plus aucune donnée personnelle. JAMAIS de suppression physique
    # d'un User — c'est le contrat de l'ADR 0007.
    anonymized_at = models.DateTimeField(
        "anonymisé le",
        null=True,
        blank=True,
        help_text=(
            "Effacement RGPD exécuté (art. 17) : identité neutralisée, "
            "compte désactivé. La ligne reste pour la traçabilité "
            "financière — elle ne contient plus de donnée personnelle."
        ),
    )

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self) -> str:
        return self.phone or self.get_username()


class PlatformStaff(TimeStampedModel):
    """The FOURTH hat — a Chioni OPERATOR (ADR 0017, décision 1).

    Chioni sells a SaaS: somebody has to onboard a tenant, verify its KYC
    and answer its support. That person is neither staff of a center, nor
    a patient, nor a guardian — hence a dedicated row, exactly like every
    other hat (ADR 0001: roles are profiles/memberships, never a ``role``
    column on ``User``).

    **``is_staff`` / ``is_superuser`` grant NO product right.** Those flags
    govern the Django admin, a last-resort tool; coupling them would make
    every admin account an operator by accident. A superuser without an
    ACTIVE row here answers 403 on every ``/api/v1/platform/`` route
    (locked by test).

    What this hat NEVER sees (invariant éthique du sprint, tested): any
    clinical data and any patient PII. Its perimeter is the TENANT —
    centers, KYC, staff, subscription (S5), aggregated money and technical
    reconciliation. Chioni supervises centers, not sick people.
    """

    class Role(models.TextChoices):
        SUPPORT = "support", "Support"
        ADMIN = "admin", "Administrateur plateforme"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name="utilisateur",
        on_delete=models.PROTECT,
        related_name="platform_staff",
    )
    role = models.CharField(
        "rôle",
        max_length=16,
        choices=Role.choices,
        help_text=(
            "« support » lit (centres, KYC, réconciliation) ; "
            "« admin » seul écrit (créer un centre, changer un KYC)."
        ),
    )
    is_active = models.BooleanField("actif", default=True)

    class Meta:
        verbose_name = "membre de l'équipe Chioni"
        verbose_name_plural = "équipe Chioni (plateforme)"
        ordering = ["user__username"]

    def __str__(self) -> str:
        return f"{self.user} — {self.get_role_display()}"


class ErasureRequest(TimeStampedModel):
    """A user asks for their account to be erased (S4 lot 3 — ADR 0017 §7).

    Deliberately NOT a self-service delete button (arbitrage PO n° 3): a
    compte finançant des soins ne doit pas disparaître en un clic, ni sous
    la pression d'un tiers ayant accès au téléphone. The user DEPOSITS a
    request from their own space; a Chioni operator (``admin`` role)
    executes it — or refuses it, with a written motive.

    **Every hat may ask**: a patient, a guardian, a staff member of a
    center, an operator. The row references the ``User``, not a hat.

    ``refusal_reason`` is free operator text — and, unlike ``kyc_reason``
    or ``Invoice.cancel_reason``, it is written FOR the person concerned
    and therefore READ BY THEM (RGPD art. 12.4: refusing an erasure
    obliges the controller to explain). It stays out of the audit payload
    all the same (ADR 0007: references only).

    Writes go through ``apps.accounts.services`` exclusively
    (``request_erasure`` / ``process_erasure_request``), which audit.
    """

    class Status(models.TextChoices):
        PENDING = "en_attente", "En attente"
        PROCESSED = "traitee", "Traitée"
        REFUSED = "refusee", "Refusée"
        # SV (art. 12) — la personne retire sa PROPRE demande tant qu'elle
        # est en attente. Terminal comme les deux autres : une rétractation
        # ne se rejoue pas, on redépose une demande neuve.
        CANCELLED = "annulee", "Annulée par la personne"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="utilisateur",
        on_delete=models.PROTECT,
        related_name="erasure_requests",
    )
    requested_at = models.DateTimeField("demandé le", default=timezone.now)
    status = models.CharField(
        "statut",
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="traité par",
        on_delete=models.PROTECT,
        related_name="erasure_requests_processed",
        null=True,
        blank=True,
        help_text="Exploitant Chioni (rôle « admin ») ayant tranché.",
    )
    processed_at = models.DateTimeField("traité le", null=True, blank=True)
    refusal_reason = models.TextField(
        "motif du refus",
        blank=True,
        help_text=(
            "Obligatoire pour un refus. Rendu à la personne concernée "
            "(RGPD art. 12.4) — jamais dans un payload d'audit."
        ),
    )

    class Meta:
        verbose_name = "demande d'effacement (RGPD)"
        verbose_name_plural = "demandes d'effacement (RGPD)"
        ordering = ["-requested_at", "-id"]
        constraints = [
            # At most ONE open request per user; the history of processed
            # and refused ones is kept (same patron as
            # ``unique_active_consent_per_link_and_scope``). A refused
            # request must be re-openable: the person fixes the blocker
            # (hands over their last-director seat, waits for the payment
            # to land) and asks again.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(status="en_attente"),
                name="unique_open_erasure_request_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"Effacement #{self.pk} — {self.get_status_display()}"


class OtpCode(models.Model):
    """One SMS login code — stored HASHED, never in clear (ADR 0010).

    Deliberately MUTABLE (``attempts``/``consumed_at`` evolve), unlike the
    ledger/audit socle: this is an authentication utility table, not a
    business record — it does NOT inherit ``AppendOnlyModel``.

    Lifecycle rules (enforced by ``apps.accounts.services``, the only
    writer):

    - a new request invalidates the active codes of the same
      ``(phone, purpose)`` (their ``expires_at`` is set to now);
    - at most ``OTP_MAX_ATTEMPTS`` (5) verification attempts, then the code
      is dead; single-use (``consumed_at``); 10 minutes validity;
    - comparison is constant-time against ``code_hash`` (keyed HMAC-SHA256,
      bound to phone + purpose so a hash cannot be replayed elsewhere).
    """

    class Purpose(models.TextChoices):
        LOGIN = "login", "Connexion"
        # Extension point (chantiers futurs) : confirmation de paiement,
        # vérification de changement de numéro… — jamais de réutilisation
        # d'un code « login » pour autre chose.

    phone = models.CharField(
        "téléphone (E.164)",
        max_length=32,
        help_text="Numéro destinataire, normalisé E.164 AVANT toute écriture.",
    )
    code_hash = models.CharField(
        "empreinte du code",
        max_length=64,
        help_text="HMAC-SHA256 (clé SECRET_KEY) du code — le code en clair n'est jamais stocké.",
    )
    purpose = models.CharField(
        "finalité",
        max_length=16,
        choices=Purpose.choices,
        default=Purpose.LOGIN,
    )
    expires_at = models.DateTimeField("expire le")
    attempts = models.PositiveSmallIntegerField("tentatives de vérification", default=0)
    consumed_at = models.DateTimeField("consommé le", null=True, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)

    class Meta:
        verbose_name = "code OTP"
        verbose_name_plural = "codes OTP"
        indexes = [
            models.Index(fields=["phone", "purpose"], name="otp_phone_purpose_idx"),
        ]

    def __str__(self) -> str:
        return f"OTP {self.purpose} #{self.pk}"
