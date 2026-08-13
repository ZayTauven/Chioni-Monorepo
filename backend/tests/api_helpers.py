"""Shared helpers for API-layer tests (phase A).

Builds on ``tests.factories`` with authentication and audience-scenario
shortcuts. Kept sober (no fixture magic): each test composes explicitly.
"""

from rest_framework.test import APIClient

from apps.centers.models import StaffMembership
from apps.patients.models import GuardianLink, GuardianProfile, PatientProfile

from .factories import make_center, make_patient, make_staff, make_user

Role = StaffMembership.Role


def client_for(user=None):
    """An APIClient, authenticated as ``user`` when given."""
    client = APIClient()
    if user is not None:
        client.force_authenticate(user)
    return client


def make_center_with_director(**center_kwargs):
    """A center plus its director user. Returns (center, director_user)."""
    center = make_center(**center_kwargs)
    director = make_user()
    make_staff(user=director, center=center, role=Role.DIRECTOR)
    return center, director


def make_staff_user(center, role=Role.DOCTOR):
    """A user holding ``role`` in ``center``."""
    user = make_user()
    make_staff(user=user, center=center, role=role)
    return user


def make_claimed_patient(user=None, **kwargs):
    """A CLAIMED patient profile owned by ``user`` (created when omitted)."""
    user = user or make_user()
    profile = make_patient(**kwargs)
    profile.user = user
    profile.claim_status = PatientProfile.ClaimStatus.ACTIVE
    profile.save()
    return profile


def make_guardian_user(user=None):
    """A user with a guardian profile. Returns (user, guardian_profile)."""
    user = user or make_user()
    profile = GuardianProfile.objects.create(user=user)
    return user, profile


def make_active_link(guardian_profile, patient):
    """An ACTIVE guardianship link guardian→patient."""
    return GuardianLink.objects.create(
        guardian=guardian_profile,
        patient=patient,
        relationship=GuardianLink.Relationship.CHILD,
        status=GuardianLink.Status.ACTIVE,
        initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
    )
