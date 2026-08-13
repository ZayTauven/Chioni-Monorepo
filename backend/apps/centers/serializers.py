"""Center serializers — audience: STAFF of the center only.

No center resource is ever exposed to patients or guardians through these
serializers; receipts/payment views (phase B) will carry their own minimal
center label.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.centers.models import HealthCenter, StaffMembership, TariffItem
from apps.common.uploads import media_url


class HealthCenterSerializer(serializers.ModelSerializer):
    """Audience: staff (read), director (update).

    ``kyc_status`` is read-only: KYC transitions belong to the Chioni
    back-office, a tenant must never self-activate its payment capability.
    ``logo`` is read-only here too: writes go through the dedicated
    multipart endpoint (`POST/DELETE /centers/{pk}/logo/` — hardened upload
    pipeline), never through a JSON PATCH.
    """

    logo = serializers.SerializerMethodField()

    class Meta:
        model = HealthCenter
        fields = [
            "id", "name", "type", "island", "city",
            "address", "phone", "email", "kyc_status", "logo", "created_at",
        ]
        read_only_fields = ["id", "kyc_status", "logo", "created_at"]

    def get_logo(self, obj):
        return media_url(self.context.get("request"), obj.logo)


class LogoUploadSerializer(serializers.Serializer):
    """Multipart body of `POST /centers/{pk}/logo/` — deep validation
    (real format, size, dimensions) happens in the upload pipeline."""

    file = serializers.FileField(
        error_messages={"required": "Le fichier image est requis."},
    )


class StaffUserSerializer(serializers.ModelSerializer):
    """Minimal staff identity embedded in memberships (no credentials).

    ``avatar`` is exposed here on purpose: the staff directory of a center
    shows colleagues' photos. This serializer must NEVER be reused in
    patient/guardian-facing views (the photo is personal data — it stays
    inside the professional space).
    """

    avatar = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ["id", "first_name", "last_name", "phone", "avatar"]
        read_only_fields = fields

    def get_avatar(self, obj):
        return media_url(self.context.get("request"), obj.avatar)


class StaffMembershipSerializer(serializers.ModelSerializer):
    """Audience: director (staff management screens)."""

    user = StaffUserSerializer(read_only=True)

    class Meta:
        model = StaffMembership
        fields = ["id", "user", "role", "is_active", "created_at"]
        read_only_fields = ["id", "user", "is_active", "created_at"]


class PractitionerSerializer(serializers.ModelSerializer):
    """One row of the practitioner directory (S1 — annuaire praticiens).

    MINIMAL payload on purpose: the whole staff can read this (the
    secretary resolves a practitioner for an appointment), so it carries
    the display name, the role and the photo — never a phone, never the
    activation state, nothing the director-only staff screens expose.
    ``id`` is the MEMBERSHIP id: it feeds ``practitioner`` in appointment
    and encounter payloads directly.
    """

    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = StaffMembership
        fields = ["id", "display_name", "role", "avatar"]
        read_only_fields = fields

    def get_display_name(self, membership) -> str:
        user = membership.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.username

    def get_avatar(self, membership):
        return media_url(self.context.get("request"), membership.user.avatar)


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


class StaffUpdateSerializer(serializers.Serializer):
    """Audience: director — `PATCH /centers/{c}/staff/{pk}/`.

    All fields optional (partial by nature). The business rules — active
    membership only, no demotion of the last director, identity writable
    on never-claimed shadow accounts only — live in
    ``services.update_staff_member``, not here.
    """

    role = serializers.ChoiceField(
        choices=StaffMembership.Role.choices, required=False
    )
    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )


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
