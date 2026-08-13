"""Account serializers.

``MeSerializer`` — audience: the AUTHENTICATED USER about themself. It is
what the frontend consumes to route the three spaces (center / patient /
guardian): identity + every hat the user wears. It exposes nothing about
OTHER people beyond minimal center labels.

``OtpRequestSerializer`` / ``OtpVerifySerializer`` — bodies of the OTP
endpoints (ADR 0010). The phone is normalised to E.164 HERE (R-API-5),
so services and throttles downstream only ever see one spelling.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.centers.models import HealthCenter, StaffMembership
from apps.common.phones import normalize_phone
from apps.common.uploads import media_url
from apps.patients.models import GuardianProfile, PatientProfile


class _CenterLabelSerializer(serializers.ModelSerializer):
    """Minimal center label embedded in memberships (id + display data).

    ``logo`` rides along so the frontend can brand the sidebar as soon as
    `/auth/me/` answers, without an extra center fetch.
    """

    logo = serializers.SerializerMethodField()

    class Meta:
        model = HealthCenter
        fields = ["id", "name", "type", "island", "city", "logo"]
        read_only_fields = fields

    def get_logo(self, obj):
        return media_url(self.context.get("request"), obj.logo)


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
    """Identity + hats of the current user (read-only aggregate).

    ``avatar`` is the pre-resolved absolute URL (or null) computed by
    ``views.me_payload`` — the user's own photo, shown to themself here and
    to colleagues through the staff directory, never in patient/guardian
    cross views.
    """

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    phone = serializers.CharField(read_only=True, allow_null=True)
    avatar = serializers.CharField(read_only=True, allow_null=True)
    staff_memberships = _StaffMembershipSerializer(many=True, read_only=True)
    patient_profile = _OwnPatientProfileSerializer(read_only=True, allow_null=True)
    guardian_profile = _OwnGuardianProfileSerializer(read_only=True, allow_null=True)


class MeUpdateSerializer(serializers.Serializer):
    """Body of `PATCH /auth/me/` — display name ONLY.

    Neither ``phone`` (identity pivot, changed only through a dedicated
    OTP-verified flow — future chantier) nor ``username`` (technical key)
    is ever writable; unknown keys are ignored by DRF.
    """

    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )


class AvatarUploadSerializer(serializers.Serializer):
    """Multipart body of `POST /auth/me/avatar/` — deep validation (real
    format, size, dimensions) happens in the upload pipeline."""

    file = serializers.FileField(
        error_messages={"required": "Le fichier image est requis."},
    )


class LogoutSerializer(serializers.Serializer):
    """Body of `/auth/logout/` — the refresh token to blacklist."""

    refresh = serializers.CharField(
        write_only=True,
        error_messages={"required": "Le jeton de rafraîchissement est requis."},
    )


class OtpRequestSerializer(serializers.Serializer):
    """Body of `/auth/otp/request/` — one phone, normalised to E.164 (KM).

    A format error is the ONLY 400 this endpoint may produce: whether the
    number matches an account or not never changes the response
    (anti-enumeration — ADR 0010).
    """

    phone = serializers.CharField(
        error_messages={
            "required": "Le numéro de téléphone est requis.",
            "blank": "Le numéro de téléphone est requis.",
        },
    )

    def validate_phone(self, value):
        try:
            return normalize_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])


class OtpVerifySerializer(OtpRequestSerializer):
    """Body of `/auth/otp/verify/` — phone + submitted code.

    The code is treated as an OPAQUE candidate (no digit validation): any
    malformed value simply fails the constant-time comparison downstream —
    validating its shape here would add nothing and vary the error paths.
    """

    code = serializers.CharField(
        max_length=16,  # sanity bound only; real codes are 6 digits
        error_messages={
            "required": "Le code est requis.",
            "blank": "Le code est requis.",
            "max_length": "Code invalide ou expiré.",
        },
    )
