"""Inpatient serializers — one serializer per AUDIENCE (ADR 0019 §5).

| Audience | Ce qu'elle voit |
|---|---|
| Rôles cliniques du centre | tout : séjours, lits, assignations, surveillance |
| Staff administratif du centre | l'occupation et les séjours **sans le clinique** |
| Patient | son séjour : centre, dates — **sans le lit ni la priorité** |
| Tuteur | **rien** (verrou de sprint S3, ADR 0016 — aucune route `/guardian/`) |

The clinical/administrative split reproduces exactly the
``EncounterClinicalSerializer`` / ``EncounterAdminSerializer`` patron: the
administrative staff needs to know WHO is in WHICH bed (that is
exploitation — the desk routes visitors, the cashier bills the room), but
never WHY (``reason``) nor WHAT was found (``diagnosis``). A consultation
motive can itself reveal a pathology (R-API-1).

``cancel_reason`` follows the ``Invoice.cancel_reason`` precedent: free
text written by the deciders, for the deciders — clinical payload only.
"""

from rest_framework import serializers

from apps.inpatient.models import Bed, BedAssignment, Room, Stay


def _practitioner_name(membership):
    """Full name or the username — the STAFF-side convention (a colleague's
    username is already readable in `GET /centers/{c}/staff/`)."""
    user = membership.user
    return f"{user.first_name} {user.last_name}".strip() or user.username


def _billed_days(stay) -> int:
    """Hospitalisation days already posted on the pivot consultation.

    Reads the ``billed_days_count`` annotation posed by
    ``services.stays_queryset`` (one SQL aggregate for the whole page);
    falls back to the service's own count for the single instances the
    write endpoints return.
    """
    annotated = getattr(stay, "billed_days_count", None)
    if annotated is not None:
        return annotated
    from apps.inpatient.services import billed_days

    return billed_days(stay)


class RoomSerializer(serializers.ModelSerializer):
    bed_count = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ["id", "name", "is_active", "bed_count", "created_at"]
        read_only_fields = fields

    def get_bed_count(self, room) -> int:
        return room.beds.count()


class RoomCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "Le nom de la chambre est requis.",
            "blank": "Le nom de la chambre est requis.",
        },
    )


class BedSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)

    class Meta:
        model = Bed
        fields = ["id", "room", "room_name", "name", "is_active", "created_at"]
        read_only_fields = fields


class BedCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "Le nom du lit est requis.",
            "blank": "Le nom du lit est requis.",
        },
    )


class _BedPositionMixin:
    """The current bed of a stay — shared by both staff payloads."""

    def get_bed(self, stay) -> dict | None:
        bed = stay.current_bed
        if bed is None:
            return None
        return {
            "id": bed.pk,
            "name": bed.name,
            "room": bed.room_id,
            "room_name": bed.room.name,
        }


class StayClinicalSerializer(_BedPositionMixin, serializers.ModelSerializer):
    """Audience: CLINICAL staff of the center (doctor, nurse, midwife).

    Full view, including the pivot consultation's ``reason`` and
    ``diagnosis`` — which live on the encounter and are surfaced here
    read-only so the ward board reads in one call.
    """

    patient_name = serializers.SerializerMethodField()
    bed = serializers.SerializerMethodField()
    attending = serializers.SerializerMethodField()
    reason = serializers.CharField(source="encounter.reason", read_only=True)
    diagnosis = serializers.CharField(
        source="encounter.diagnosis", read_only=True
    )
    billed_days = serializers.SerializerMethodField()

    class Meta:
        model = Stay
        fields = [
            "id", "patient", "patient_name", "encounter", "admitted_at",
            "discharged_at", "status", "priority", "bed", "attending",
            "reason", "diagnosis", "billed_days", "cancel_reason",
            "created_at",
        ]
        read_only_fields = fields

    def get_patient_name(self, stay) -> str:
        patient = stay.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_attending(self, stay) -> list:
        return [
            {"id": membership.pk, "name": _practitioner_name(membership)}
            for membership in stay.attending.all()
        ]

    def get_billed_days(self, stay) -> int:
        return _billed_days(stay)


class StayAdminSerializer(_BedPositionMixin, serializers.ModelSerializer):
    """Audience: ADMINISTRATIVE staff (secretary, cashier, director).

    The occupancy and the stays, WITHOUT the clinical (R-API-1): no
    ``reason``, no ``diagnosis``, and no ``cancel_reason`` — the last one
    is free text written by the clinical deciders for themselves, exactly
    like ``Invoice.cancel_reason`` is written by BILLING for BILLING.

    ``billed_days`` IS here: it is the billing base of the stay, and the
    cashier cannot invoice what he cannot count.
    """

    patient_name = serializers.SerializerMethodField()
    bed = serializers.SerializerMethodField()
    attending = serializers.SerializerMethodField()
    billed_days = serializers.SerializerMethodField()

    class Meta:
        model = Stay
        fields = [
            "id", "patient", "patient_name", "encounter", "admitted_at",
            "discharged_at", "status", "priority", "bed", "attending",
            "billed_days", "created_at",
        ]
        read_only_fields = fields

    def get_patient_name(self, stay) -> str:
        patient = stay.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_attending(self, stay) -> list:
        return [
            {"id": membership.pk, "name": _practitioner_name(membership)}
            for membership in stay.attending.all()
        ]

    def get_billed_days(self, stay) -> int:
        return _billed_days(stay)


class StayPatientSerializer(serializers.ModelSerializer):
    """Audience: the PATIENT reading their own record (all centers).

    « Son séjour dans son carnet : centre, dates, sans le lit ni la
    priorité » (ADR 0019 §5). Both exclusions are deliberate: a bed number
    and a triage priority are ward-management data, written by the staff
    for the staff — the clinical story the patient owns lives on the pivot
    consultation, which they already read in full at
    `GET /patients/me/encounters/` (``encounter`` links the two).

    ``cancel_reason`` is absent too: a cancelled stay never happened, and
    the desk's internal wording is not addressed to the patient.
    """

    center_name = serializers.CharField(source="center.name", read_only=True)

    class Meta:
        model = Stay
        fields = [
            "id", "center", "center_name", "encounter", "admitted_at",
            "discharged_at", "status",
        ]
        read_only_fields = fields


class BedAssignmentSerializer(serializers.ModelSerializer):
    """The occupation history of a stay — CLINICAL staff only.

    It says which patient slept in which bed and when: the transfer trail
    is exactly the kind of movement information the ward owns.
    """

    bed_name = serializers.CharField(source="bed.name", read_only=True)
    room_name = serializers.CharField(source="bed.room.name", read_only=True)

    class Meta:
        model = BedAssignment
        fields = [
            "id", "bed", "bed_name", "room_name", "assigned_at",
            "released_at", "created_at",
        ]
        read_only_fields = fields


class AdmissionSerializer(serializers.Serializer):
    """POST body — ``patient``, ``bed`` and ``attending`` are plain ids that
    the VIEW resolves inside the center's perimeter (400 explicite, S1
    norm: one message covering the foreign and the non-existent id alike).
    """

    patient = serializers.IntegerField(
        error_messages={"required": "Le patient est requis."}
    )
    reason = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Le motif d'admission est requis.",
            "blank": "Le motif d'admission est requis.",
        },
    )
    diagnosis = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    priority = serializers.ChoiceField(
        choices=Stay.Priority.choices,
        required=False,
        default=Stay.Priority.NORMAL,
        error_messages={"invalid_choice": "Priorité inconnue."},
    )
    bed = serializers.IntegerField(required=False, allow_null=True, default=None)
    attending = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    admitted_at = serializers.DateTimeField(required=False, allow_null=True)


class BedAssignSerializer(serializers.Serializer):
    """POST body of the assignment/transfer route."""

    bed = serializers.IntegerField(
        error_messages={"required": "Le lit est requis."}
    )


class AttendingSerializer(serializers.Serializer):
    """PUT body — the FULL new set of attending physicians."""

    attending = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True
    )


class DischargeSerializer(serializers.Serializer):
    discharged_at = serializers.DateTimeField(required=False, allow_null=True)


class StayCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(
        error_messages={
            "required": "Le motif d'annulation est requis.",
            "blank": "Le motif d'annulation est requis.",
        }
    )


class BillStayDaysSerializer(serializers.Serializer):
    """POST body — ``tariff`` is resolved in the center's grid by the view.

    ``idempotency_key`` is **mandatory** (correctif PO du 15/08/2026):
    posting days produces acts that an invoice will claim from a real
    patient, so a lost response must be replayable instead of doubling the
    debt. The client generates it, keeps it on failure and regenerates it
    on success — exactly the counter's contract (ADR 0015), except that
    the counter's key is optional and this one is not: this endpoint is
    brand new, so no caller has to be spared, and an optional token is a
    token half the callers forget.
    """

    tariff = serializers.IntegerField(
        error_messages={"required": "Le tarif est requis."}
    )
    days = serializers.IntegerField(
        min_value=1,
        error_messages={
            "required": "Le nombre de journées est requis.",
            "min_value": "Le nombre de journées doit être au moins 1.",
        },
    )
    idempotency_key = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "La clé d'idempotence est requise.",
            "blank": "La clé d'idempotence ne peut pas être vide.",
            "max_length": "La clé d'idempotence dépasse 64 caractères.",
        },
    )


class OccupancySerializer(serializers.Serializer):
    """The occupancy board — rooms → beds → the stay in each bed.

    Built by hand (not a ModelSerializer) because the payload of the bed's
    occupant DEPENDS ON THE CALLER'S ROLE: clinical staff read the reason
    and the priority, administrative staff read who and since when. The
    view passes ``clinical`` in the serializer context.
    """

    def to_representation(self, room):
        clinical = self.context.get("clinical", False)
        beds = []
        for bed in room.beds.all():
            rows = getattr(bed, "open_rows", None)
            if rows is None:  # non-prefetched fallback
                rows = list(bed.assignments.filter(released_at__isnull=True))
            assignment = rows[0] if rows else None
            beds.append(
                {
                    "id": bed.pk,
                    "name": bed.name,
                    "is_active": bed.is_active,
                    "occupant": (
                        self._occupant(assignment, clinical)
                        if assignment is not None
                        else None
                    ),
                }
            )
        return {
            "id": room.pk,
            "name": room.name,
            "is_active": room.is_active,
            "beds": beds,
            "free_beds": sum(
                1
                for bed in beds
                if bed["occupant"] is None and bed["is_active"]
            ),
        }

    @staticmethod
    def _occupant(assignment, clinical):
        stay = assignment.stay
        patient = stay.patient
        occupant = {
            "stay": stay.pk,
            "patient": patient.pk,
            "patient_name": (
                f"{patient.first_name} {patient.last_name}".strip()
            ),
            "since": assignment.assigned_at,
            "priority": stay.priority,
        }
        if clinical:
            # R-API-1: the admission motive is clinical and only crosses
            # into a clinical payload.
            occupant["reason"] = stay.encounter.reason
        return occupant
