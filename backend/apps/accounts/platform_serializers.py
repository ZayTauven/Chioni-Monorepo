"""Back-office serializers for RGPD erasure requests (S4 lot 3).

Audience: `PlatformStaff`. The sprint invariant applies here with a twist
worth writing down: this back-office object is ABOUT a person, so the
temptation to render their name is maximal — and it is refused.

What the operator gets: the request, its lifecycle, **the id of the
account**, the hats it wears (so the consequences of the erasure are
visible) and the machine codes of what currently blocks it. What the
operator never gets: a name, a phone, an e-mail, a birth date, a patient
profile, anything clinical. Identity is not needed to execute an erasure:
the request was deposited by the AUTHENTICATED person from their own
space — Chioni's own auth is the proof of identity, not a typed name.

This module must stay patient-serializer-free (structural test on every
module mounted under ``/api/v1/platform/``).
"""

from rest_framework import serializers

from apps.accounts.models import ErasureRequest
from apps.accounts.services import (
    ERASURE_DECISION_ANONYMIZE,
    ERASURE_DECISION_REFUSE,
    erasure_blockers,
)


class PlatformErasureRequestSerializer(serializers.ModelSerializer):
    """One erasure request as the Chioni operator sees it.

    ``blockers`` is computed per row (one small query set per request —
    the list is a back-office queue, not a hot path): it is what turns
    « je clique et ça refuse » into « je vois ce qu'il faut corriger
    d'abord ». ``hats`` are booleans, never the underlying rows.
    """

    user = serializers.IntegerField(source="user_id", read_only=True)
    hats = serializers.SerializerMethodField()
    blockers = serializers.SerializerMethodField()

    class Meta:
        model = ErasureRequest
        fields = [
            "id", "user", "status", "requested_at", "processed_at",
            "processed_by", "refusal_reason", "hats", "blockers",
        ]
        read_only_fields = fields

    def get_hats(self, erasure_request) -> dict:
        user = erasure_request.user
        return {
            "is_patient": hasattr(user, "patient_profile"),
            "is_guardian": hasattr(user, "guardian_profile"),
            "is_center_staff": user.staff_memberships.filter(
                is_active=True
            ).exists(),
            "is_platform_operator": hasattr(user, "platform_staff"),
        }

    def get_blockers(self, erasure_request) -> list:
        if erasure_request.status != ErasureRequest.Status.PENDING:
            return []
        return erasure_blockers(erasure_request.user)


class PlatformErasureDecisionSerializer(serializers.Serializer):
    """POST body of `/platform/erasure-requests/{pk}/process/`.

    ``decision`` is explicit about WHAT happens (« anonymiser » /
    « refuser »), not about the resulting status code: an operator clicking
    « traiter » on an irreversible action deserves the verb.
    """

    decision = serializers.ChoiceField(
        choices=[
            (ERASURE_DECISION_ANONYMIZE, "Anonymiser le compte"),
            (ERASURE_DECISION_REFUSE, "Refuser la demande"),
        ],
        error_messages={
            "required": "La décision est requise : « anonymiser » ou « refuser ».",
            "invalid_choice": "Décision inconnue : « anonymiser » ou « refuser ».",
        },
    )
    refusal_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text=(
            "Obligatoire pour un refus — rendu à la personne concernée "
            "(RGPD art. 12.4)."
        ),
    )
