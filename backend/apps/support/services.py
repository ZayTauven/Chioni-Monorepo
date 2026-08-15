"""Support services — the ONLY write path (S5 lot 3, ADR 0018 décision 5).

Same discipline as every other domain: views never touch the ORM, the
services replay ``save()``, take the row lock that makes a decision
meaningful under concurrency, and journalise inside the same transaction.

**THE point of this module, and it is a refusal to write code**:
:func:`apps.billing.guards.require_center_can_administer` is NOT called
here, and must never be. A center suspended for non-payment is precisely
the one that most needs to open a ticket — « pourquoi suis-je gelé ? » is
the first question the freeze produces. Freezing the channel that explains
the freeze would be a support loop with no exit; the ADR 0018 lists the
frozen perimeter (personnel, tarifs, statistiques, exports) and support is
not in it. A dedicated test class locks this: every support write works on
a ``suspendu`` AND on a ``resilie`` tenant.

Audit contract (ADR 0007, tightened by ADR 0018 invariant 7): references,
codes and counts. **Never** the subject of a ticket, never the body of a
message, never a file name.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.common.uploads import process_image_upload
from apps.support.models import (
    SupportAttachment,
    SupportMessage,
    SupportTicket,
)

Status = SupportTicket.Status
Side = SupportMessage.Side

#: The ticket state machine, explicit and closed (patron
#: ``KYC_TRANSITIONS`` / ``SUBSCRIPTION_TRANSITIONS``).
#:
#: Reading it aloud: a new ticket is taken up, answered or closed; one in
#: progress lands on « résolu » or « fermé » — and can go back to
#: « ouvert » when the operator realises it was taken up too early; a
#: resolved one is closed, or REOPENED (« ça ne marche toujours pas » is
#: the most useful transition of a support tool); **``ferme`` is final** —
#: reopening a closed file means opening a new one, so the thread of an
#: incident stays the thread of THAT incident.
SUPPORT_TRANSITIONS = {
    Status.OPEN: {Status.IN_PROGRESS, Status.RESOLVED, Status.CLOSED},
    Status.IN_PROGRESS: {Status.OPEN, Status.RESOLVED, Status.CLOSED},
    Status.RESOLVED: {Status.IN_PROGRESS, Status.CLOSED},
    Status.CLOSED: set(),
}

#: Maximum body length accepted by the services (the serializers say it
#: too, in French): a support message is a paragraph, not an upload
#: channel. Generous enough for a full stack trace pasted by a director.
MAX_MESSAGE_LENGTH = 5000

CLOSED_TICKET_MESSAGE = (
    "Ce ticket est fermé : ouvrez-en un nouveau pour un autre sujet. "
    "L'historique de celui-ci reste consultable."
)


@transaction.atomic
def open_ticket(
    *, actor, center, subject, category, priority=SupportTicket.Priority.NORMAL,
    body="",
):
    """Open a ticket for ``center`` — ANY active staff member may.

    ``body`` is optional and, when given, becomes the FIRST message of the
    thread in the same transaction: « décrire son problème » and « ouvrir
    un ticket » are one gesture for the person doing it, and two round
    trips on a Comorian connection is one too many.

    Deliberately NOT guarded by the subscription freeze — see the module
    docstring. Deliberately NOT guarded by the KYC either: a center whose
    diaspora rail is closed has even more reason to write.
    """
    subject = (subject or "").strip()
    if not subject:
        raise ValidationError("L'objet du ticket est obligatoire.")
    if category not in SupportTicket.Category.values:
        raise ValidationError("Catégorie de ticket inconnue.")
    if priority not in SupportTicket.Priority.values:
        raise ValidationError("Priorité inconnue.")
    ticket = SupportTicket.objects.create(
        center=center,
        opened_by=actor,
        subject=subject,
        category=category,
        priority=priority,
        status=Status.OPEN,
    )
    audit(
        actor=actor, action=AuditAction.SUPPORT_TICKET_OPENED, target=ticket,
        center=center,
        # Ids and codes ONLY — the SUBJECT never enters here (parade (b)).
        ticket_id=ticket.pk, center_id=center.pk, category=ticket.category,
        priority=ticket.priority, status=ticket.status,
    )
    if (body or "").strip():
        post_message(actor=actor, ticket=ticket, body=body, side=Side.CENTER)
    return ticket


@transaction.atomic
def post_message(*, actor, ticket, body, side):
    """Append one message to a thread — append-only, both sides.

    ``side`` comes from the DOOR (tenant view vs back-office view), never
    from the client: it is what lets a reader tell « le centre » from
    « Chioni » forever, including after the author changes hats.

    A ``ferme`` ticket refuses new messages (400 in French, telling what to
    do instead). Everything else — including ``resolu`` — accepts them:
    « ça ne marche toujours pas » must always have somewhere to land.
    Posting does NOT move the status by itself: an implicit transition
    would be exactly the parallel door the project spends its sprints
    closing. The operator moves it explicitly (and it is audited).
    """
    body = (body or "").strip()
    if not body:
        raise ValidationError("Le message ne peut pas être vide.")
    if len(body) > MAX_MESSAGE_LENGTH:
        raise ValidationError(
            f"Le message est trop long (maximum {MAX_MESSAGE_LENGTH} "
            "caractères)."
        )
    if side not in Side.values:
        raise ValidationError("Côté d'auteur inconnu.")
    ticket = _locked(ticket)
    if ticket.is_closed:
        raise ValidationError(CLOSED_TICKET_MESSAGE)
    message = SupportMessage(
        ticket=ticket, author=actor, author_side=side, body=body
    )
    message.save()
    audit(
        actor=actor, action=AuditAction.SUPPORT_MESSAGE_POSTED, target=message,
        center=ticket.center,
        # The BODY never enters here (parade (b)) — not even its length.
        message_id=message.pk, ticket_id=ticket.pk,
        center_id=ticket.center_id, author_side=str(side),
        ticket_status=ticket.status,
    )
    return message


@transaction.atomic
def set_ticket_status(*, actor, ticket, status):
    """Move a ticket along :data:`SUPPORT_TRANSITIONS` — Chioni's triage.

    Both back-office roles may call it, and that is a deliberate arbitrage
    (ADR 0018 lot 3): answering and advancing a ticket IS the ``support``
    job. The ``admin``-only reservation of this back-office protects the
    TENANT and the MONEY (creating a center, moving a KYC, opening a
    contract, freezing an administration, recording a settlement, running
    an erasure) — a conversation is neither.

    The row is locked: two operators clicking at once serialise, and the
    second one re-reads a committed status instead of overwriting it.
    """
    if status not in Status.values:
        raise ValidationError("Statut de ticket inconnu.")
    ticket = _locked(ticket)
    previous = ticket.status
    if status == previous:
        raise ValidationError(
            f"Ce ticket est déjà « {Status(status).label} »."
        )
    if status not in SUPPORT_TRANSITIONS.get(previous, set()):
        raise ValidationError(
            f"Transition refusée : un ticket « {Status(previous).label} » "
            f"ne peut pas passer à « {Status(status).label} »."
        )
    ticket.status = status
    ticket.closed_at = (
        timezone.now() if status == Status.CLOSED else None
    )
    ticket.save(update_fields=["status", "closed_at", "updated_at"])
    audit(
        actor=actor, action=AuditAction.SUPPORT_TICKET_STATUS_CHANGED,
        target=ticket, center=ticket.center,
        ticket_id=ticket.pk, center_id=ticket.center_id,
        old_status=previous, status=status,
    )
    return ticket


@transaction.atomic
def attach_file(*, actor, ticket, uploaded_file):
    """Attach a screenshot to a ticket — ADR 0014 pipeline, unchanged.

    The bytes are validated, re-encoded (EXIF/GPS stripped) and renamed
    before any row exists; the file then lands on the PRIVATE storage,
    which has no URL at all. A ``ferme`` ticket refuses new pieces, like
    it refuses new messages.
    """
    ticket = _locked(ticket)
    if ticket.is_closed:
        raise ValidationError(CLOSED_TICKET_MESSAGE)
    content = process_image_upload(uploaded_file)
    attachment = SupportAttachment.objects.create(
        ticket=ticket, file=content, uploaded_by=actor
    )
    audit(
        actor=actor, action=AuditAction.SUPPORT_ATTACHMENT_UPLOADED,
        target=attachment, center=ticket.center,
        # Ids only — NEVER a file name (patron ``kyc_document.uploaded``).
        attachment_id=attachment.pk, ticket_id=ticket.pk,
        center_id=ticket.center_id,
    )
    return attachment


def _locked(ticket):
    """Re-read the ticket under ``FOR UPDATE``.

    No hierarchy issue to declare: this app locks ONE table and never
    reaches for a center, an invoice or an intent — it is disjoint from
    both the diaspora hierarchy (utilisateur → intent → demande → facture
    → centre) and the SaaS one (facture d'abonnement → abonnement →
    compteur).
    """
    return SupportTicket.objects.select_for_update().get(pk=ticket.pk)
