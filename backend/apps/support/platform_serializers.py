"""Back-office support serializers — audience: `PlatformStaff` only.

Invariant éthique de S4 (ADR 0017 décision 1), held here too: **no
serializer of this module carries a patient**. Easy to hold structurally —
a ticket has no FK to a patient, by design (ADR 0018 décision 5, parade
(a)) — and impossible to hold on the CONTENT: ``subject`` and ``body`` are
free text a human typed. That residual risk is named and assumed in the
ADR; what the code guarantees is that no patient is ever *addressed* here,
and that nothing of this content reaches an audit payload.

Humans are ids on this side, exactly like in the RGPD queue (ADR 0017 lot
3 §5): the operator's interlocutor is a CENTER, not a person. Rendering a
staff member's civil identity would add nothing to the support gesture and
would put names in a back-office payload the negative-field test exists to
keep empty.
"""

from rest_framework import serializers

from apps.support.models import SupportMessage, SupportTicket
from apps.support.serializers import SupportAttachmentSerializer


class PlatformSupportMessageSerializer(serializers.ModelSerializer):
    """One message, as Chioni reads it — the side, never a name."""

    author = serializers.IntegerField(source="author_id", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ["id", "author", "author_side", "body", "created_at"]
        read_only_fields = fields


class PlatformSupportTicketSerializer(serializers.ModelSerializer):
    """One ticket in the back-office queue — the tenant, never a person.

    ``center``/``center_name`` identify the interlocutor; ``opened_by`` is
    an account id. Counters come from the SQL annotations of the view.
    """

    center = serializers.IntegerField(source="center_id", read_only=True)
    center_name = serializers.CharField(source="center.name", read_only=True)
    opened_by = serializers.IntegerField(source="opened_by_id", read_only=True)
    message_count = serializers.IntegerField(read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id", "center", "center_name", "subject", "category", "status",
            "priority", "opened_by", "message_count", "attachment_count",
            "last_message_at", "closed_at", "created_at", "updated_at",
        ]
        read_only_fields = fields


class PlatformSupportTicketDetailSerializer(PlatformSupportTicketSerializer):
    """The ticket AND its thread — one round trip for the answering screen."""

    messages = PlatformSupportMessageSerializer(many=True, read_only=True)
    attachments = SupportAttachmentSerializer(many=True, read_only=True)

    class Meta(PlatformSupportTicketSerializer.Meta):
        fields = PlatformSupportTicketSerializer.Meta.fields + [
            "messages", "attachments"
        ]
        read_only_fields = fields


class PlatformSupportStatusSerializer(serializers.Serializer):
    """Body of `POST /platform/support/tickets/{pk}/status/` — `{status}`.

    The state machine (and its refusals) lives in the service, not in a
    form: `ferme` is final, and an impossible move is refused in French.
    """

    status = serializers.ChoiceField(
        choices=SupportTicket.Status.choices,
        error_messages={
            "required": "Le statut cible est requis.",
            "invalid_choice": "Statut de ticket inconnu.",
        },
    )
