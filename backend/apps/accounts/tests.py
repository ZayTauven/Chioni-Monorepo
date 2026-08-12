"""Tests for the custom user model (accounts.User)."""

import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

User = get_user_model()


def test_create_user_with_phone():
    """A user can be created with a phone number, the future pivot identifier."""
    user = User.objects.create_user(
        username="nassim",
        password="a-strong-dev-password-42",
        phone="+33612345678",
    )

    assert user.pk is not None
    assert user.phone == "+33612345678"
    assert str(user) == "+33612345678"
    # Uniqueness is enforced at the database level.
    assert User._meta.get_field("phone").unique is True


def test_blank_phone_is_normalised_to_null():
    """Two users without phone must not collide on the unique column."""
    first = User.objects.create_user(username="mariama", password="a-strong-dev-password-42", phone="")
    second = User.objects.create_user(username="anfia", password="a-strong-dev-password-42")

    assert first.phone is None
    assert second.phone is None
    assert str(second) == "anfia"
