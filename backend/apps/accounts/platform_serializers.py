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

from apps.accounts.models import ErasureRequest, PlatformStaff
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
        # SV (dette S4) — ``is_platform_operator`` ne compte que les lignes
        # ACTIVES, comme ``is_center_staff`` : un exploitant désactivé n'est
        # plus une casquette, seulement de l'historique. ``getattr`` sur la
        # OneToOne inverse rend None quand la ligne n'existe pas
        # (RelatedObjectDoesNotExist est un AttributeError).
        platform_staff = getattr(user, "platform_staff", None)
        return {
            "is_patient": hasattr(user, "patient_profile"),
            "is_guardian": hasattr(user, "guardian_profile"),
            "is_center_staff": user.staff_memberships.filter(
                is_active=True
            ).exists(),
            "is_platform_operator": (
                platform_staff is not None and platform_staff.is_active
            ),
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


# ---------------------------------------------------------------------------
# L'équipe Chioni elle-même (S5 lot 3 — ADR 0018 décision 6)
# ---------------------------------------------------------------------------


class PlatformStaffSerializer(serializers.ModelSerializer):
    """One Chioni operator, as the back-office sees them.

    **Account IDS only** — no name, no phone, no e-mail, no username. Two
    reasons, and the second one is the decisive one:

    1. consistency with the RGPD queue right above (ADR 0017 lot 3 §5):
       this back-office renders identifiers, not civil identities ;
    2. a shadow account created by phone carries its NUMBER inside its
       username (``invite-2693440020``) — rendering the username would
       quietly publish a phone in a payload the negative-field test exists
       to keep clean.

    **Vigilance consignée** (ADR 0018 lot 3): an operator list made of ids
    is sober to the point of being austere. Giving the Chioni team real
    names in its own back-office is a legitimate future need — and it must
    then be a CONSCIOUS contract change, argued, not a field that slid in.
    """

    user = serializers.IntegerField(source="user_id", read_only=True)

    class Meta:
        model = PlatformStaff
        fields = ["id", "user", "role", "is_active", "created_at", "updated_at"]
        read_only_fields = fields


class PlatformStaffCreateSerializer(serializers.Serializer):
    """Body of `POST /platform/operators/` — `{phone, role, …}`.

    The operator is referenced by PHONE (pivot identifier, ADR 0001): the
    account is created as a shadow and claimed by OTP. No password is ever
    transmitted — not even for Chioni's own team.
    """

    phone = serializers.CharField(
        max_length=32,
        error_messages={"required": "Le numéro de téléphone est requis."},
    )
    role = serializers.ChoiceField(
        choices=PlatformStaff.Role.choices,
        error_messages={
            "required": "Le rôle est requis.",
            "invalid_choice": "Rôle d'exploitant inconnu.",
        },
    )
    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class PlatformStaffUpdateSerializer(serializers.Serializer):
    """Body of `PATCH /platform/operators/{pk}/` — `{role?, is_active?}`.

    Both optional, at least one required (the service refuses an empty
    change): changing a role and revoking an access are the two gestures
    this route exists for. The « last active admin » guard lives in the
    service, with its row lock — not in a form.
    """

    role = serializers.ChoiceField(
        choices=PlatformStaff.Role.choices,
        required=False,
        error_messages={"invalid_choice": "Rôle d'exploitant inconnu."},
    )
    is_active = serializers.BooleanField(required=False)
