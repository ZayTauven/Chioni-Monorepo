"""Account serializers.

``MeSerializer`` — audience: the AUTHENTICATED USER about themself. It is
what the frontend consumes to route the three spaces (center / patient /
guardian): identity + every hat the user wears. It exposes nothing about
OTHER people beyond minimal center labels.
"""

from rest_framework import serializers

from apps.centers.models import HealthCenter, StaffMembership
from apps.patients.models import GuardianProfile, PatientProfile


class _CenterLabelSerializer(serializers.ModelSerializer):
    """Minimal center label embedded in memberships (id + display data)."""

    class Meta:
        model = HealthCenter
        fields = ["id", "name", "type", "island", "city"]
        read_only_fields = fields


class _StaffMembershipSerializer(serializers.ModelSerializer):
    center = _CenterLabelSerializer(read_only=True)

    class Meta:
        model = StaffMembership
        fields = ["id", "center", "role"]
        read_only_fields = fields


class _OwnPatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ["id", "first_name", "last_name", "claim_status"]
        read_only_fields = fields


class _OwnGuardianProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuardianProfile
        fields = ["id", "country_of_residence", "preferred_currency"]
        read_only_fields = fields


class MeSerializer(serializers.Serializer):
    """Identity + hats of the current user (read-only aggregate)."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    phone = serializers.CharField(read_only=True, allow_null=True)
    staff_memberships = _StaffMembershipSerializer(many=True, read_only=True)
    patient_profile = _OwnPatientProfileSerializer(read_only=True, allow_null=True)
    guardian_profile = _OwnGuardianProfileSerializer(read_only=True, allow_null=True)


class LogoutSerializer(serializers.Serializer):
    """Body of `/auth/logout/` — the refresh token to blacklist."""

    refresh = serializers.CharField(
        write_only=True,
        error_messages={"required": "Le jeton de rafraîchissement est requis."},
    )
