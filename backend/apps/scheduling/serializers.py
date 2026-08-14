"""Scheduling serializers — one serializer per AUDIENCE.

The day queue is the tool of the secretary AND the doctor: every active
staff member of the center reads the same payload (the ``reason`` field is
operational desk data, not clinical — see the model docstring).

S2 adds the PATIENT's window (``AppointmentPatientSerializer``): the
patient reads their own appointments across centers — a deliberately
smaller payload than the staff one (see its docstring). There is still NO
guardian serializer: a guardian never sees appointments (nothing in the
``paiements`` scope covers them, and nothing clinical transits here
anyway — an appointment's existence at a given center is already
information about care).
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


class AppointmentPatientSerializer(serializers.ModelSerializer):
    """S2 — an appointment as seen by the PATIENT it concerns.

    Deliberately NOT the staff payload. What is excluded, and why:

    - ``reason`` — desk OPERATIONAL note, authored by staff for staff
      (ADR 0013): its content is not controlled (free text typed at the
      desk) and it was never written FOR the patient. The clinical story
      lives on the encounter, role-gated; this field must reach neither
      the patient nor an SMS (ADR 0012).
    - ``patient`` / ``patient_name`` — it is the caller themself.
    - ``practitioner`` (membership id) — internal center identifier; only
      the display NAME is useful to the patient.
    - ``reminder_sent_at`` — operational plumbing of the J-1 reminder.

    ``practitioner_display_name`` falls back to ``null`` (never the
    username: shadow staff accounts are named « invite-<phone> » — the
    practitioner's phone must not leak to patients).
    """

    center = serializers.SerializerMethodField()
    practitioner_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id", "center", "scheduled_at", "duration_minutes", "status",
            "practitioner_display_name",
        ]
        read_only_fields = fields

    def get_center(self, appointment) -> dict:
        return {"id": appointment.center_id, "name": appointment.center.name}

    def get_practitioner_display_name(self, appointment):
        if appointment.practitioner_id is None:
            return None
        user = appointment.practitioner.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or None


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
