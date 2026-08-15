"""Support serializers — TENANT side (S5 lot 3, ADR 0018 décision 5).

Audience: the staff of the center. Enums are rendered raw, as everywhere
else in the API — the French labels belong to the frontend
(`src/lib/labels.ts`).

No file URL is ever rendered: an attachment lives on the private storage
(``url()`` raises by construction) and the bytes are reachable only
through the authenticated download endpoint.
"""

from rest_framework import serializers

from apps.support.models import (
    SupportAttachment,
    SupportMessage,
    SupportTicket,
)
from apps.support.services import MAX_MESSAGE_LENGTH


def _display_name(user):
    """« Prénom Nom » or the username — never a phone, never an e-mail."""
    if user is None:
        return None
    return f"{user.first_name} {user.last_name}".strip() or user.username


class SupportMessageSerializer(serializers.ModelSerializer):
    """One message of a thread, as the CENTER reads it.

    ``author_display`` names the author ONLY on the ``centre`` side — the
    people of the reader's own house, whose names he already sees in
    `GET /centers/{c}/staff/`. A Chioni operator stays ``null``: the
    center's interlocutor is « Chioni », not an agent's civil identity
    (same discipline as ``actor_display`` in the director's journal).
    """

    author = serializers.IntegerField(source="author_id", read_only=True)
    author_display = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ["id", "author", "author_side", "author_display", "body",
                  "created_at"]
        read_only_fields = fields

    def get_author_display(self, message) -> str | None:
        if message.author_side != SupportMessage.Side.CENTER:
            return None
        return _display_name(message.author)


class SupportAttachmentSerializer(serializers.ModelSerializer):
    """One attached screenshot — metadata only, NEVER a URL (ADR 0016 §5)."""

    uploaded_by = serializers.IntegerField(
        source="uploaded_by_id", read_only=True
    )

    class Meta:
        model = SupportAttachment
        fields = ["id", "uploaded_by", "created_at"]
        read_only_fields = fields


class SupportTicketSerializer(serializers.ModelSerializer):
    """One ticket in a list — counters, never the thread.

    ``message_count`` / ``attachment_count`` / ``last_message_at`` come
    from the SQL annotations of the view (one query for the page, patron
    ``unpaid_invoices_qs``), never one query per row.
    """

    opened_by = serializers.IntegerField(source="opened_by_id", read_only=True)
    opened_by_display = serializers.SerializerMethodField()
    message_count = serializers.IntegerField(read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id", "subject", "category", "status", "priority",
            "opened_by", "opened_by_display", "message_count",
            "attachment_count", "last_message_at", "closed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_opened_by_display(self, ticket) -> str | None:
        return _display_name(ticket.opened_by)


class SupportTicketDetailSerializer(SupportTicketSerializer):
    """The ticket AND its thread in one round trip.

    Deliberately nested: on a Comorian connection, opening a ticket screen
    must cost one request, not three. Threads are short by nature — no
    pagination here, same posture as prescriptions and carnet entries.
    """

    messages = SupportMessageSerializer(many=True, read_only=True)
    attachments = SupportAttachmentSerializer(many=True, read_only=True)

    class Meta(SupportTicketSerializer.Meta):
        fields = SupportTicketSerializer.Meta.fields + [
            "messages", "attachments"
        ]
        read_only_fields = fields


class SupportTicketCreateSerializer(serializers.Serializer):
    """Body of `POST /centers/{c}/support/tickets/`.

    ``body`` is optional but expected: it becomes the first message of the
    thread in the same transaction. ``priority`` is declared here and
    nowhere else — it never changes afterwards (ADR 0018 lot 3 arbitrage).
    """

    subject = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "L'objet du ticket est obligatoire.",
            "blank": "L'objet du ticket est obligatoire.",
        },
    )
    category = serializers.ChoiceField(
        choices=SupportTicket.Category.choices,
        error_messages={
            "required": "La catégorie est requise.",
            "invalid_choice": "Catégorie de ticket inconnue.",
        },
    )
    priority = serializers.ChoiceField(
        choices=SupportTicket.Priority.choices,
        required=False,
        default=SupportTicket.Priority.NORMAL,
    )
    body = serializers.CharField(
        max_length=MAX_MESSAGE_LENGTH, required=False, allow_blank=True,
        default="",
    )


class SupportMessageCreateSerializer(serializers.Serializer):
    """Body of the two « répondre » routes — `{body}`, jamais vide.

    ``author_side`` is NOT accepted from the client: it is posed by the
    service from the door the request came through.
    """

    body = serializers.CharField(
        max_length=MAX_MESSAGE_LENGTH,
        error_messages={
            "required": "Le message ne peut pas être vide.",
            "blank": "Le message ne peut pas être vide.",
        },
    )


class SupportAttachmentUploadSerializer(serializers.Serializer):
    """Body of `POST .../attachments/` — multipart, one image.

    Format, size, dimensions and metadata stripping are the ADR 0014
    pipeline's job (``process_image_upload``), in the service: a
    screenshot is a PNG, and the PDF stays deferred.
    """

    file = serializers.FileField(
        error_messages={"required": "Le fichier est requis."}
    )
