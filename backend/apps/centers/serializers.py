"""Center serializers — audience: STAFF of the center only.

No center resource is ever exposed to patients or guardians through these
serializers; receipts/payment views (phase B) will carry their own minimal
center label.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.centers.models import HealthCenter, StaffMembership, TariffItem


class HealthCenterSerializer(serializers.ModelSerializer):
    """Audience: staff (read), director (update).

    ``kyc_status`` is read-only: KYC transitions belong to the Chioni
    back-office, a tenant must never self-activate its payment capability.
    """

    class Meta:
        model = HealthCenter
        fields = [
            "id", "name", "type", "island", "city",
            "address", "phone", "email", "kyc_status", "created_at",
        ]
        read_only_fields = ["id", "kyc_status", "created_at"]


class StaffUserSerializer(serializers.ModelSerializer):
    """Minimal staff identity embedded in memberships (no credentials)."""

    class Meta:
        model = get_user_model()
        fields = ["id", "first_name", "last_name", "phone"]
        read_only_fields = fields


class StaffMembershipSerializer(serializers.ModelSerializer):
    """Audience: director (staff management screens)."""

    user = StaffUserSerializer(read_only=True)

    class Meta:
        model = StaffMembership
        fields = ["id", "user", "role", "is_active", "created_at"]
        read_only_fields = ["id", "user", "is_active", "created_at"]


class StaffCreateSerializer(serializers.Serializer):
    """Audience: director — add a staff member by phone (pivot, ADR 0001)."""

    phone = serializers.CharField(
        max_length=32,
        error_messages={"required": "Le numéro de téléphone est requis."},
    )
    role = serializers.ChoiceField(
        choices=StaffMembership.Role.choices,
        error_messages={"required": "Le rôle est requis."},
    )
    first_name = serializers.CharField(max_length=150, required=False, default="")
    last_name = serializers.CharField(max_length=150, required=False, default="")


class TariffItemSerializer(serializers.ModelSerializer):
    """Audience: staff (read), director/cashier (write).

    ``generic_category`` is REQUIRED at creation (no silent model default):
    « autre » is accepted but must be an explicit choice — it is the only
    care information a guardian will ever see under the payments scope
    (ADR 0005), so classifying is a conscious act.
    """

    generic_category = serializers.ChoiceField(
        choices=TariffItem._meta.get_field("generic_category").choices,
        error_messages={
            "required": (
                "La nature générique est requise (« autre » est accepté mais "
                "doit être un choix explicite)."
            ),
        },
    )

    class Meta:
        model = TariffItem
        fields = [
            "id", "code", "label", "generic_category",
            "price_kmf", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
