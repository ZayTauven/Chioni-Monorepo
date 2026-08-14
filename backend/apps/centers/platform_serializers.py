"""Serializers of the Chioni BACK-OFFICE — audience: `PlatformStaff` only.

Invariant éthique du sprint S4 (ADR 0017, décision 1), materialised here:
**no serializer of this module carries a patient**. The operator's
perimeter is the TENANT — the center, its KYC file, its staff COUNTERS.
Not a name, not a phone, not a birth date, nothing clinical. Chioni
supervises centers, not sick people; a negative field test keeps it that
way (``tests/test_platform_api.py``).

The center payload is deliberately NOT ``HealthCenterSerializer``: the
tenant-facing one gates ``kyc_reason`` by role and carries the logo URL,
two concerns that do not belong in a back-office list.
"""

from rest_framework import serializers

from apps.centers.models import HealthCenter, StaffMembership


class PlatformCenterSerializer(serializers.ModelSerializer):
    """One tenant as the platform sees it: identity, KYC file, headcount.

    ``staff_active_count`` / ``director_active_count`` are the operational
    signal an operator needs (« ce centre n'a plus de directeur, il faut
    en amorcer un ») WITHOUT opening the staff directory — that richer
    support module is S5. They are annotated by the view (SQL), never
    computed row by row.
    """

    staff_active_count = serializers.IntegerField(read_only=True)
    director_active_count = serializers.IntegerField(read_only=True)
    kyc_document_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = HealthCenter
        fields = [
            "id", "name", "type", "island", "city", "address", "phone",
            "email", "kyc_status", "kyc_reason", "kyc_updated_at",
            "created_at",
            "staff_active_count", "director_active_count",
            "kyc_document_count",
        ]
        read_only_fields = fields


class PlatformCenterCreateSerializer(serializers.Serializer):
    """Body of `POST /platform/centers/` — the tenant AND its first director.

    ``kyc_status`` is absent BY DESIGN: a center is born « en_attente » and
    only the KYC endpoint moves it (a creation that could self-activate the
    diaspora rail would hollow out the whole verification).

    The director is referenced by PHONE (pivot identifier, ADR 0001): the
    account is created as a shadow and claimed by OTP — no password is ever
    transmitted out of band.
    """

    name = serializers.CharField(
        max_length=255,
        error_messages={"required": "Le nom du centre est requis."},
    )
    type = serializers.ChoiceField(
        choices=HealthCenter.Type.choices,
        error_messages={"required": "Le type d'établissement est requis."},
    )
    island = serializers.ChoiceField(
        choices=HealthCenter.Island.choices,
        error_messages={"required": "L'île est requise."},
    )
    city = serializers.CharField(
        max_length=128,
        error_messages={"required": "La ville est requise."},
    )
    address = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    phone = serializers.CharField(
        max_length=32, required=False, allow_blank=True, default=""
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    director_phone = serializers.CharField(
        max_length=32,
        error_messages={
            "required": "Le téléphone du premier directeur est requis.",
        },
    )
    director_first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    director_last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class PlatformDirectorCreateSerializer(serializers.Serializer):
    """Body of `POST /platform/centers/{pk}/directors/` — rescue path."""

    phone = serializers.CharField(
        max_length=32,
        error_messages={"required": "Le numéro de téléphone est requis."},
    )
    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class PlatformKycTransitionSerializer(serializers.Serializer):
    """Body of `POST /platform/centers/{pk}/kyc/` — `{status, reason}`.

    ``reason`` is optional HERE and mandatory for a suspension in the
    service: the rule lives with the state machine, not in a form.
    """

    status = serializers.ChoiceField(
        choices=HealthCenter.KycStatus.choices,
        error_messages={"required": "Le statut KYC cible est requis."},
    )
    reason = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, default=""
    )


class PlatformStaffMembershipSerializer(serializers.ModelSerializer):
    """The membership created by an onboarding — echoed back so the
    operator can confirm « le directeur est bien amorcé ».

    Staff identity IS in the platform perimeter (ADR 0017), but the payload
    stays minimal: ids and the role. No password, no token, nothing that
    could substitute for the OTP claim.
    """

    user_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = StaffMembership
        fields = ["id", "user_id", "center", "role", "is_active", "created_at"]
        read_only_fields = fields
