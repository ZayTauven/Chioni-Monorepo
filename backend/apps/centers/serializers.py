"""Center serializers — audience: STAFF of the center only.

No center resource is ever exposed to patients or guardians through these
serializers; receipts/payment views (phase B) will carry their own minimal
center label.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.centers.models import HealthCenter, KycDocument, StaffMembership, TariffItem
from apps.centers.services import staff_identity_editable
from apps.common.permissions import active_membership_qs
from apps.common.uploads import media_url


class HealthCenterSerializer(serializers.ModelSerializer):
    """Audience: staff (read), director (update).

    ``kyc_status`` is read-only: KYC transitions belong to the Chioni
    back-office, a tenant must never self-activate its payment capability
    (S4 — the platform API is now the single door, ADR 0017).
    ``logo`` is read-only here too: writes go through the dedicated
    multipart endpoint (`POST/DELETE /centers/{pk}/logo/` — hardened upload
    pipeline), never through a JSON PATCH.

    ``kyc_reason`` — the motive of the last KYC decision — follows the
    ``cancel_reason`` precedent (S1): free text typed by a Chioni operator
    is shown to the DIRECTOR of the concerned center and to nobody else on
    the tenant side (``null`` for every other role). It never reaches a
    patient or a guardian: no patient/guardian serializer carries a center
    beyond its label.
    """

    logo = serializers.SerializerMethodField()
    kyc_reason = serializers.SerializerMethodField()

    class Meta:
        model = HealthCenter
        fields = [
            "id", "name", "type", "island", "city",
            "address", "phone", "email", "kyc_status", "kyc_reason",
            "kyc_updated_at", "logo", "created_at",
        ]
        read_only_fields = [
            "id", "kyc_status", "kyc_reason", "kyc_updated_at", "logo",
            "created_at",
        ]

    def get_logo(self, obj):
        return media_url(self.context.get("request"), obj.logo)

    def get_kyc_reason(self, obj) -> str | None:
        return obj.kyc_reason if self._is_director_of(obj) else None

    def _is_director_of(self, center) -> bool:
        """Director of THIS center? (one query per serialisation, reused
        across rows — a user holds a handful of memberships at most)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        ids = getattr(self, "_director_center_ids", None)
        if ids is None:
            ids = set(
                active_membership_qs(
                    user, roles=(StaffMembership.Role.DIRECTOR,)
                ).values_list("center_id", flat=True)
            )
            self._director_center_ids = ids
        return center.pk in ids


class KycDocumentSerializer(serializers.ModelSerializer):
    """One KYC supporting document — audience: director of the center AND
    the Chioni platform (identical payload, ADR 0017).

    **No file URL, ever** (ADR 0016 §5 reused): the storage is private and
    has no ``url()``. The bytes are reachable only through the
    authenticated download endpoints of each audience.
    """

    class Meta:
        model = KycDocument
        fields = [
            "id", "center", "doc_type", "uploaded_by",
            "archived_at", "created_at",
        ]
        read_only_fields = fields


class KycDocumentUploadSerializer(serializers.Serializer):
    """Multipart body of `POST /centers/{pk}/kyc-documents/` — deep
    validation (real format, size, dimensions) happens in the upload
    pipeline (ADR 0014: JPEG/PNG/WebP only, PDF deferred)."""

    file = serializers.FileField(
        error_messages={"required": "Le fichier image est requis."},
    )
    doc_type = serializers.ChoiceField(
        choices=KycDocument.DocType.choices,
        error_messages={"required": "Le type de pièce est requis."},
    )


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
    # SV : le frontend grise proactivement l'édition d'identité (le PATCH
    # staff ne la permet QUE sur un compte « jamais revendiqué »). Calculé
    # par ``services.staff_identity_editable`` — LE prédicat que la garde
    # d'écriture applique (source unique, lecture et écriture ne peuvent
    # pas dériver). Rien de plus n'est exposé : ni ``phone_verified_at``,
    # ni l'état du mot de passe — un booléen suffit au geste.
    identity_editable = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = [
            "id", "first_name", "last_name", "phone", "avatar",
            "identity_editable",
        ]
        read_only_fields = fields

    def get_avatar(self, obj):
        return media_url(self.context.get("request"), obj.avatar)

    def get_identity_editable(self, obj) -> bool:
        return staff_identity_editable(obj)


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
