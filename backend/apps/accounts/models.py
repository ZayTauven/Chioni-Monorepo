"""Accounts: custom user model and OTP codes.

The verified phone number is the pivot identifier for the platform
(ADR 0001): OTP SMS is the primary auth path for patients and guardians
(ADR 0010); `username` + password JWT remains for staff/back-office.

A single ``User`` can wear several hats (doctor in a health center AND
guardian of a relative in the diaspora): roles are modelled as profiles /
memberships in their own apps — never as a single ``role`` field here.
"""

from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.db import models


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

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self) -> str:
        return self.phone or self.get_username()


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
