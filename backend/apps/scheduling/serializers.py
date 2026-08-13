"""Scheduling serializers — single audience: STAFF of the center.

The day queue is the tool of the secretary AND the doctor: every active
staff member of the center reads the same payload (the ``reason`` field is
operational desk data, not clinical — see the model docstring). There is
deliberately NO patient or guardian serializer here: appointments are
operating data of the center (ADR 0002), a patient-facing agenda is a
later chantier.
"""

from rest_framework import serializers

from apps.scheduling.models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    """Read shape — list, detail and every action response.

    ``overlaps`` is NOT a model field: creation/move responses append it
    (list of overlapping appointment ids, non-blocking warning) — see the
    views.
    """

    patient_name = serializers.SerializerMethodField()
    practitioner_name = serializers.SerializerMethodField()
    end_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_name", "practitioner", "practitioner_name",
            "scheduled_at", "duration_minutes", "end_at", "reason", "status",
            "reminder_sent_at", "created_at",
        ]
        read_only_fields = fields

    def get_patient_name(self, appointment) -> str:
        patient = appointment.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_practitioner_name(self, appointment):
        if appointment.practitioner_id is None:
            return None
        user = appointment.practitioner.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or user.username


class AppointmentCreateSerializer(serializers.Serializer):
    """POST body. ``patient`` and ``practitioner`` are plain ids: the VIEW
    resolves them inside the center's perimeter — a foreign id yields an
    explicit 400 (« patient hors périmètre », « praticien d'un autre
    centre »), never a silent attach."""

    patient = serializers.IntegerField(
        error_messages={"required": "Le patient est requis."}
    )
    scheduled_at = serializers.DateTimeField(
        error_messages={"required": "La date et l'heure sont requises."}
    )
    duration_minutes = serializers.IntegerField(
        required=False, default=20, min_value=5, max_value=480
    )
    practitioner = serializers.IntegerField(
        required=False, allow_null=True, default=None
    )
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=255
    )


class AppointmentUpdateSerializer(serializers.Serializer):
    """PATCH body (move/edit — ``prevu`` only, enforced by the service).

    Every field is optional; an ABSENT key leaves the value untouched,
    while ``"practitioner": null`` explicitly detaches the practitioner
    (the appointment becomes « avec le centre »).
    """

    scheduled_at = serializers.DateTimeField(required=False)
    duration_minutes = serializers.IntegerField(
        required=False, min_value=5, max_value=480
    )
    practitioner = serializers.IntegerField(required=False, allow_null=True)
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )
