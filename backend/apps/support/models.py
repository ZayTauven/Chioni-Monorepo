"""Support — the canal centre → Chioni (S5 lot 3, ADR 0018 décision 5).

**Why an app of its own, and not a corner of ``apps.billing``.** The
subscription registry carries one discipline from end to end (ADR 0018
décision 1): it is money, it is separate from the care ledger, and a
structural test forbids it to import the diaspora rail. A support
conversation is not money — it has no amount, no period, no state that a
franc depends on, and its ONE risk is the opposite one (free text a Chioni
operator will read). Folding it into ``billing`` would blur a boundary the
sprint spent a lot to draw; and the app is not anemic — three models, a
service layer, two audiences, two URL modules and an admin, the weight of
``apps.scheduling``.

Three tables:

- :class:`SupportTicket` — one request from ONE tenant. Opened by ANY
  active staff member (« c'est la secrétaire qui rencontre le bug, pas le
  directeur »), read by its author, by the director of the center and by
  Chioni.
- :class:`SupportMessage` — **append-only**: a message that was sent is
  never rewritten. Same discipline as the ledger and the cash desk, for a
  different reason: a support thread is the trace of what each side said,
  and an editable trace is not a trace.
- :class:`SupportAttachment` — a screenshot, on the PRIVATE storage
  (ADR 0016 §5) through the ADR 0014 pipeline unchanged. A capture d'écran
  is a PNG: the main use case passes without touching the socle.

**The risk this module names and does not pretend to solve** (ADR 0018
décision 5): a ticket is free text an operator will read, and nothing
technically stops someone typing « le dossier de Mme X ne s'ouvre pas ».
Three parades, all here:

(a) **NO structured field points at a patient** — no FK to
    ``PatientProfile``, none to ``Encounter``, none to an ``Invoice`` of a
    patient. A support module is not a door into the carnet, and the
    absence of that FK is what makes it structurally true (locked by a
    test that walks the fields of the three models);
(b) the **content never enters an audit payload** (``subject``/``body``
    are absent from the three ``support_ticket.*`` entries — only ids,
    codes and counts, ADR 0007);
(c) an explicit warning at write time — frontend's job, but the sentence
    lives here (:data:`SUPPORT_PRIVACY_NOTICE`) so both sides say the
    same thing.

**The administrative freeze does NOT apply here** (the critical point of
the lot): ``require_center_can_administer`` is deliberately NOT called on
any support write. A center suspended for non-payment is precisely the one
that needs to ask « pourquoi suis-je gelé ? ». Locked by test.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.centers.models import CenterScopedQuerySet, HealthCenter
from apps.common.models import AppendOnlyModel, TimeStampedModel
from apps.common.private_storage import PrivateMediaStorage

#: The sentence the frontend must show ABOVE the compose box, exported so
#: the API and the UI never drift apart (parade (b) of the ADR). It is a
#: warning, not a filter: we inform, we structure, we do not pretend to
#: prevent — and we consign the residual risk rather than fake it away.
SUPPORT_PRIVACY_NOTICE = (
    "Ne mettez ni nom de patient ni information médicale dans un ticket : "
    "donnez le numéro de dossier ou l'identifiant affiché à l'écran. "
    "L'équipe Chioni lit ces messages."
)


class SupportTicket(TimeStampedModel):
    """One support request of a tenant — the unit of the conversation.

    ``center`` is mandatory: in S5 the support channel is centre → Chioni
    and nothing else (patients and guardians are explicitly out of scope,
    ADR 0018 « Hors périmètre »). ``opened_by`` is the human who hit the
    problem, whatever their role.

    ``priority`` is chosen by the OPENER and never changes afterwards
    ([ARBITRAGE] lot 3, RÉVERSIBLE): it is a declaration of urgency by the
    person who has the problem, not a workflow state. Chioni triages with
    ``status``, which is the field that carries a state machine and an
    audit entry.
    """

    class Category(models.TextChoices):
        BUG = "bug", "Anomalie"
        QUESTION = "question", "Question"
        BILLING = "facturation", "Facturation"
        OTHER = "autre", "Autre"

    class Status(models.TextChoices):
        OPEN = "ouvert", "Ouvert"
        IN_PROGRESS = "en_cours", "En cours"
        RESOLVED = "resolu", "Résolu"
        CLOSED = "ferme", "Fermé"

    class Priority(models.TextChoices):
        LOW = "basse", "Basse"
        NORMAL = "normale", "Normale"
        HIGH = "haute", "Haute"
        URGENT = "urgente", "Urgente"

    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="support_tickets",
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ouvert par",
        on_delete=models.PROTECT,
        related_name="support_tickets_opened",
        help_text="N'importe quel membre ACTIF du personnel du centre.",
    )
    subject = models.CharField("objet", max_length=200)
    category = models.CharField(
        "catégorie", max_length=16, choices=Category.choices
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        "priorité",
        max_length=16,
        choices=Priority.choices,
        default=Priority.NORMAL,
        help_text=(
            "Déclarée à l'ouverture par la personne qui rencontre le "
            "problème — non modifiable ensuite (le tri se fait au statut)."
        ),
    )
    closed_at = models.DateTimeField("fermé le", null=True, blank=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "ticket de support"
        verbose_name_plural = "tickets de support"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["center", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"#{self.pk} — {self.subject}"

    @property
    def is_closed(self) -> bool:
        return self.status == self.Status.CLOSED


class SupportMessage(AppendOnlyModel):
    """One message of a thread — **append-only** (ADR 0018 décision 5).

    « Un message envoyé ne se réécrit pas » : the thread is the record of
    what each side actually said, and an editable record would let either
    party rewrite history after a dispute about an incident. Correcting a
    message is posting another one.

    ``author_side`` is posed by the SERVICE from the door the message came
    through (tenant route vs back-office route), never by the client and
    never derived at read time: a Chioni operator who is also a nurse
    somewhere must not see his old answers change side the day he leaves
    the team.
    """

    class Side(models.TextChoices):
        CENTER = "centre", "Le centre"
        CHIONI = "chioni", "Chioni"

    ticket = models.ForeignKey(
        SupportTicket,
        verbose_name="ticket",
        on_delete=models.PROTECT,
        related_name="messages",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="auteur",
        on_delete=models.PROTECT,
        related_name="support_messages",
    )
    author_side = models.CharField(
        "côté", max_length=8, choices=Side.choices,
        help_text="Posé par le service selon la porte empruntée.",
    )
    body = models.TextField("message")

    class Meta:
        verbose_name = "message de support"
        verbose_name_plural = "messages de support"
        ordering = ["created_at", "id"]

    def __str__(self) -> str:  # pragma: no cover — admin/debug only
        return f"Message #{self.pk} — ticket #{self.ticket_id}"


class SupportAttachment(TimeStampedModel):
    """A screenshot attached to a ticket — ADR 0014 socle UNCHANGED.

    JPEG/PNG/WebP by REAL decoded content, 2 MB, 2048², EXIF stripped,
    uuid name — and the PDF stays deferred (arbitrage commun ADR
    0016/0017). That is not a limitation here: **a screenshot is a PNG**,
    so the main use case of a support attachment passes as is.

    Private diffusion, exactly like a KYC piece or a patient document: the
    file lives under ``PRIVATE_MEDIA_ROOT``, ``url()`` always raises, and
    the bytes are only reachable through an authenticated endpoint that
    replays the list's permissions.
    """

    ticket = models.ForeignKey(
        SupportTicket,
        verbose_name="ticket",
        on_delete=models.PROTECT,
        related_name="attachments",
    )
    file = models.FileField(
        "fichier",
        storage=PrivateMediaStorage(),
        upload_to="support_attachments/%Y/%m/",
        max_length=255,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="déposé par",
        on_delete=models.PROTECT,
        related_name="support_attachments_uploaded",
    )

    class Meta:
        verbose_name = "pièce jointe d'un ticket"
        verbose_name_plural = "pièces jointes des tickets"
        ordering = ["created_at", "id"]

    def __str__(self) -> str:  # pragma: no cover — admin/debug only
        return f"Pièce jointe #{self.pk} — ticket #{self.ticket_id}"

    def save(self, *args, **kwargs):
        # A piece is attached once and never re-pointed at another ticket:
        # the thread it documents would silently change meaning.
        if self.pk is not None:
            previous = (
                type(self).objects.filter(pk=self.pk)
                .values_list("ticket_id", flat=True)
                .first()
            )
            if previous is not None and previous != self.ticket_id:
                raise ValidationError(
                    "Une pièce jointe reste attachée à son ticket."
                )
        super().save(*args, **kwargs)
