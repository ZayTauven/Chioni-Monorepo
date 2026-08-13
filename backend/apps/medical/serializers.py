"""Medical serializers — audiences: STAFF of the producing center, and the
PATIENT owner of the carnet.

There is deliberately NO guardian serializer in this module: the
``detail_clinique`` scope is not wired in phase A, and a half-exposed
clinical payload is worse than none (mission rule). When phase B/C wires
it, the guardian serializers will live here with their scope declared.
"""

from rest_framework import serializers

from apps.medical.models import (
    ActPerformed,
    Encounter,
    HealthRecordEntry,
    Prescription,
    PrescriptionItem,
)


class ActPerformedSerializer(serializers.ModelSerializer):
    """An act with its frozen tariff snapshot (label, price, category)."""

    class Meta:
        model = ActPerformed
        fields = [
            "id", "label_snapshot", "generic_category",
            "price_kmf_snapshot", "tariff_item",
        ]
        read_only_fields = ["id", "label_snapshot", "generic_category",
                            "price_kmf_snapshot"]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ["id", "medication", "dosage"]
        read_only_fields = ["id"]


class PrescriptionSerializer(serializers.ModelSerializer):
    """Audience: staff of the producing center AND the patient owner."""

    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "encounter", "status", "items", "created_at"]
        read_only_fields = fields


class PrescriptionCreateSerializer(serializers.Serializer):
    """Audience: prescribing staff (doctor/midwife)."""

    items = PrescriptionItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "Une ordonnance doit contenir au moins une ligne."
            )
        return value


class EncounterClinicalSerializer(serializers.ModelSerializer):
    """Audience: CLINICAL staff of the PRODUCING center (doctor, nurse,
    midwife) — full clinical view including ``reason`` and ``diagnosis``.

    R-API-1: within a center, clinical READS are role-gated too. This
    serializer must never serve an administrative role.
    """

    acts = ActPerformedSerializer(many=True, read_only=True)
    practitioner_name = serializers.SerializerMethodField()

    class Meta:
        model = Encounter
        fields = [
            "id", "patient", "practitioner", "practitioner_name",
            "occurred_at", "reason", "diagnosis", "status", "acts", "created_at",
        ]
        read_only_fields = fields

    def get_practitioner_name(self, encounter) -> str:
        user = encounter.practitioner.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.username


class EncounterAdminSerializer(serializers.ModelSerializer):
    """Audience: ADMINISTRATIVE staff of the center (secretary, cashier,
    director) — the operating view needed for billing and scheduling:
    date, patient, practitioner, acts with their tariff snapshots.

    R-API-1: NO ``diagnosis`` and NO ``reason`` — the consultation motive
    can itself reveal a pathology; billing needs the acts, not the story.
    A cashier who happens to also be someone's guardian reads nothing
    clinical through their staff hat.
    """

    acts = ActPerformedSerializer(many=True, read_only=True)
    practitioner_name = serializers.SerializerMethodField()

    class Meta:
        model = Encounter
        fields = [
            "id", "patient", "practitioner", "practitioner_name",
            "occurred_at", "status", "acts", "created_at",
        ]
        read_only_fields = fields

    def get_practitioner_name(self, encounter) -> str:
        user = encounter.practitioner.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.username


class EncounterCreateSerializer(serializers.Serializer):
    """Audience: clinical staff creating a consultation with its acts.

    ``patient`` and ``tariff_items`` are plain ids here: the VIEW validates
    them against the center's perimeter (patients seen by the center, tariffs
    of its own grid) so a foreign id yields 404/400 — never a silent attach.
    """

    patient = serializers.IntegerField(
        error_messages={"required": "Le patient est requis."}
    )
    reason = serializers.CharField(
        max_length=255, error_messages={"required": "Le motif est requis."}
    )
    diagnosis = serializers.CharField(required=False, allow_blank=True, default="")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True)
    tariff_items = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    appointment = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text=(
            "Rendez-vous du centre que cette consultation honore : il passe "
            "automatiquement à « honoré » (résolu dans le périmètre du centre "
            "par la vue — id étranger → 404)."
        ),
    )


class EncounterPatientSerializer(serializers.ModelSerializer):
    """Audience: the PATIENT reading their own carnet (all centers).

    The carnet belongs to the patient (ADR 0002): full clinical content,
    plus the center label so the story reads across facilities.
    """

    acts = ActPerformedSerializer(many=True, read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)

    class Meta:
        model = Encounter
        fields = [
            "id", "center", "center_name", "occurred_at",
            "reason", "diagnosis", "status", "acts", "created_at",
        ]
        read_only_fields = fields


class HealthRecordEntrySerializer(serializers.ModelSerializer):
    """Audience: staff of the producing center AND the patient owner."""

    class Meta:
        model = HealthRecordEntry
        fields = ["id", "entry_type", "content", "source_encounter", "created_at"]
        read_only_fields = ["id", "source_encounter", "created_at"]


class HealthRecordEntryCreateSerializer(serializers.Serializer):
    """Audience: clinical staff adding a carnet entry from an encounter."""

    entry_type = serializers.ChoiceField(
        choices=HealthRecordEntry.EntryType.choices,
        error_messages={"required": "Le type d'entrée est requis."},
    )
    content = serializers.CharField(
        error_messages={"required": "Le contenu est requis."}
    )
