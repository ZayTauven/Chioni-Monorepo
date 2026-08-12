"""Accounts: custom user model.

The verified phone number (OTP to come) is the pivot identifier for the
platform; `username` and `email` remain functional in the meantime so we
do not over-design authentication now.

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
        null=True,  # nullable until OTP onboarding is implemented
        blank=True,
        help_text=(
            "Identifiant pivot de la plateforme (vérification OTP à venir). "
            "Format international E.164 recommandé, ex. +2693212345."
        ),
    )

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self) -> str:
        return self.phone or self.get_username()
