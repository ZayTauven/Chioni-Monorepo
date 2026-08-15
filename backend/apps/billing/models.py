"""Billing — the SaaS subscription Chioni sells to a center (S5, ADR 0018).

**A SEPARATE registry, never the care ledger** (décision 1). The ledger of
ADR 0003 records the money of PATIENTS: every franc is tied to a patient,
an act, a provider and a receipt. A Chioni → center receivable has none of
those, `Receipt.payment_request` and `CashPayment.invoice` are mandatory
one-to-ones, and the readers of the ledger are the people of the CENTER
(``stats/finances``, ``cash-journal``): an editor's invoice showing up
there would be a reading bug, not a datum. So nothing in this app writes a
``LedgerTransaction``, a ``LedgerEntry``, an ``Invoice``, a ``Receipt`` or
a ``CashPayment`` — the same discipline that already separated the « G- »
cash receipts from the diaspora ones (ADR 0015 §6).

Lot 1 — the contract:

- :class:`SubscriptionPlan` — the commercial offer. **Referenced** by the
  subscriptions, never rewritten into them: a plan's price may change for
  the future, the SaaS invoice carries its OWN frozen amount.
- :class:`CenterSubscription` — the contract of ONE tenant, whose
  ``status`` is an axis STRICTLY INDEPENDENT of ``kyc_status``
  (décision 2). A center can be KYC-verified and unpaid, or KYC-suspended
  and up to date. ``KYC_TRANSITIONS`` is not touched.

Lot 2 — the SaaS invoicing (décision 4), which borrows the caisse patron
of ADR 0015 wholesale (append-only cash-in, reversal as the ONLY
correction, derived balance, never a mutable « reste dû » field) but
writes NOT ONE ledger row:

- :class:`SubscriptionInvoice` — what Chioni claims for one period, with
  a frozen amount and a plan SNAPSHOT (the offer may be repriced
  tomorrow; an issued invoice never moves).
- :class:`SubscriptionPayment` — **append-only**: money received is not
  rewritten. A mistake is corrected by a
  :class:`SubscriptionPaymentReversal` (OneToOne, motive mandatory).
- :class:`SubscriptionInvoiceCounter` — the single row that serialises
  the GLOBAL « A- » series **without ever locking a ``HealthCenter``
  row** (which is the serialisation point of ``Receipt.issue()`` and
  ``CashReceipt.issue()``: the ADR forbids making the editor's
  bookkeeping contend with a patient's receipt).

Money: KMF only, whole francs (``validate_kmf_integral``, field + save()
+ DB constraint — the ADR 0015 patron of ``TariffItem.price_kmf``). A
fractional amount would produce an invoice nobody can settle.

Writes go through ``apps.billing.services`` exclusively (invariants +
audit); the admin is read-only.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Round
from django.utils import timezone

from apps.centers.models import CenterScopedQuerySet, HealthCenter
from apps.common.models import AppendOnlyModel, TimeStampedModel
from apps.common.money import validate_kmf_integral


class SubscriptionPlan(TimeStampedModel):
    """One commercial offer (« Essentiel », « Clinique »…).

    ``included_practitioners`` / ``included_staff`` are the quotas of the
    offer, and they are **indicative only** (décision 3): they are
    measured, displayed and alerted on — never opposed to a business
    action. Registering a patient or opening a consultation must never
    fail because of a plan (arbitrage PO n° 3: refusing care for an
    accounting reason is not a thing Chioni does). ``None`` = unlimited.

    A plan is never deleted (``PROTECT`` from the subscriptions): an offer
    is retired with ``is_active=False``, exactly like a tariff line.
    """

    class BillingPeriod(models.TextChoices):
        MONTHLY = "mensuel", "Mensuel"
        ANNUAL = "annuel", "Annuel"

    code = models.CharField(
        "code",
        max_length=32,
        unique=True,
        help_text="Identifiant stable de l'offre, ex. « ESSENTIEL ».",
    )
    name = models.CharField("nom commercial", max_length=128)
    price_kmf = models.DecimalField(
        "prix (KMF)",
        max_digits=12,
        decimal_places=2,
        validators=[validate_kmf_integral],
        help_text=(
            "Prix par période de facturation, en francs entiers. Les "
            "factures déjà émises portent leur propre montant figé : "
            "changer ce prix n'a jamais d'effet rétroactif."
        ),
    )
    billing_period = models.CharField(
        "période de facturation",
        max_length=16,
        choices=BillingPeriod.choices,
        default=BillingPeriod.MONTHLY,
    )
    included_practitioners = models.PositiveIntegerField(
        "praticiens inclus",
        null=True,
        blank=True,
        help_text="Vide = illimité. Quota INDICATIF : ne bloque jamais rien.",
    )
    included_staff = models.PositiveIntegerField(
        "membres du personnel inclus",
        null=True,
        blank=True,
        help_text="Vide = illimité. Quota INDICATIF : ne bloque jamais rien.",
    )
    is_active = models.BooleanField(
        "proposé à la vente",
        default=True,
        help_text=(
            "Une offre retirée reste référencée par les abonnements en "
            "cours — jamais de suppression."
        ),
    )

    class Meta:
        verbose_name = "offre d'abonnement"
        verbose_name_plural = "offres d'abonnement"
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price_kmf__gte=0),
                name="subscription_plan_price_positive",
            ),
            # Same DB-level integrality guard as ``TariffItem`` (ADR 0015
            # addendum S1 §3): ``save()`` and the serializer already refuse
            # decimals, but a raw ``update()``/``bulk_create()`` would slip
            # through — and a fractional price makes an unsettleable
            # invoice. ROUND(price) = price ⇔ whole francs.
            models.CheckConstraint(
                condition=models.Q(price_kmf=Round("price_kmf")),
                name="subscription_plan_price_kmf_integral",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.code}] {self.name} — {self.price_kmf} KMF"

    def save(self, *args, **kwargs):
        validate_kmf_integral(self.price_kmf)
        super().save(*args, **kwargs)


class CenterSubscription(TimeStampedModel):
    """The subscription contract of ONE center — an axis of its own.

    ``status`` is **distinct from ``kyc_status``** (décision 2, demanded
    explicitly by the audit §B.6). The two compose without merging:

    ======================  ==================================================
    ``essai`` / ``actif``   nothing is closed
    ``impaye``              **nothing is closed** — banner + SMS reminders
                            (lot 2). Being late is not being cut off.
    ``suspendu``            **administrative freeze** (see
                            ``apps.billing.guards``)
    ``resilie``             administrative freeze, and reading + export
                            GUARANTEED during the retention period
    ======================  ==================================================

    What the freeze NEVER closes, and it is a tested contract: care,
    carnet, documents, vital signs, prescriptions, appointments, **the
    registration of a patient standing at the desk**, patient invoicing,
    the cash desk, receipts, every read, the RGPD export and the
    director's audit journal. « Suspendre ne doit jamais empêcher de
    soigner » (arbitrage fondateur de S4, tenu par S5).

    The diaspora rail deliberately stays OPEN on an unpaid center: closing
    it would punish the guardian and the patient rather than the center,
    the KYC already carries that lever, and Chioni takes its fee on that
    rail — cutting it would shrink its own income exactly when it is
    trying to get paid.
    """

    class Status(models.TextChoices):
        TRIAL = "essai", "Essai"
        ACTIVE = "actif", "Actif"
        UNPAID = "impaye", "Impayé"
        SUSPENDED = "suspendu", "Suspendu"
        TERMINATED = "resilie", "Résilié"

    center = models.OneToOneField(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        verbose_name="offre",
        on_delete=models.PROTECT,
        related_name="subscriptions",
        help_text=(
            "L'offre est RÉFÉRENCÉE : ses prix passés ne sont jamais "
            "réécrits dans les factures déjà émises."
        ),
    )
    status = models.CharField(
        "statut de l'abonnement",
        max_length=16,
        choices=Status.choices,
        default=Status.TRIAL,
        help_text=(
            "Axe INDÉPENDANT du KYC. Seuls « suspendu » et « résilié » "
            "gèlent l'administratif (personnel, tarifs, statistiques) — "
            "jamais le soin, jamais la caisse."
        ),
    )
    started_at = models.DateField("démarré le", default=timezone.localdate)
    current_period_end = models.DateField(
        "échéance de la période en cours",
        null=True,
        blank=True,
        help_text=(
            "Date à laquelle la période en cours est due. La facturation "
            "SaaS (émission, relances, règlements) est le lot 2."
        ),
    )
    # Motive of the LAST decision (patron ``HealthCenter.kyc_reason``,
    # ADR 0017 lot 1 §5): mandatory to freeze, overwritten at each
    # transition, visible to the platform and to the DIRECTOR of the
    # center concerned — and NEVER in an audit payload (free operator
    # text = same class as a dispute reason, ADR 0007).
    status_reason = models.TextField(
        "motif de la dernière décision",
        blank=True,
        help_text=(
            "Obligatoire pour suspendre ou résilier. Visible de la "
            "plateforme et du directeur du centre — jamais d'un patient "
            "ni d'un tuteur."
        ),
    )
    status_updated_at = models.DateTimeField(
        "statut décidé le", null=True, blank=True
    )
    status_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="statut décidé par",
        on_delete=models.PROTECT,
        related_name="subscription_decisions",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "abonnement d'un centre"
        verbose_name_plural = "abonnements des centres"
        ordering = ["center__name"]

    def __str__(self) -> str:
        return f"{self.center.name} — {self.get_status_display()}"

    @property
    def is_frozen(self) -> bool:
        """True when this subscription freezes the center's administration."""
        return self.status in FROZEN_SUBSCRIPTION_STATUSES


#: The two states that freeze administration (décision 2). ``impaye`` is
#: deliberately ABSENT: during the grace period nothing closes — a center
#: that is late keeps running, it only gets a banner and reminders.
FROZEN_SUBSCRIPTION_STATUSES = frozenset(
    {
        CenterSubscription.Status.SUSPENDED,
        CenterSubscription.Status.TERMINATED,
    }
)


# ---------------------------------------------------------------------------
# Facturation SaaS — Chioni → centre (S5 lot 2, ADR 0018 décision 4)
# ---------------------------------------------------------------------------


class SubscriptionInvoiceCounter(models.Model):
    """The ONE row that numbers the « A- » series — a global counter.

    Why a table of its own, and not the patron of ``Receipt.issue()`` /
    ``CashReceipt.issue()``: those two number **per tenant** and serialise
    on the ``HealthCenter`` row. The SaaS series is **global** (Chioni
    issues it, not the center), and the ADR 0018 décision 4 forbids
    locking a center row for it — a monthly billing job must never queue
    behind, or ahead of, a patient's receipt at a counter.

    Why a counter row rather than a PostgreSQL ``SEQUENCE``: ``nextval()``
    is non-transactional, so a rolled-back issuance would burn a number
    and leave a **gap**. ADR 0015 §6 already argued that a gap in a
    receipt series looks like a fraud; the same holds for the editor's own
    invoices. Locking this row (``SELECT … FOR UPDATE``) makes the series
    strictly contiguous: a rollback puts the number back.

    The row is created lazily by the numbering service (never a data
    migration): ``TransactionTestCase`` flushes migration-created rows
    between tests, and a numbering that depended on one would be a trap.
    """

    SINGLETON_PK = 1

    last_number = models.PositiveIntegerField(
        "dernier numéro attribué",
        default=0,
        help_text=(
            "Série « A- » GLOBALE Chioni : verrouillée le temps de "
            "l'émission, jamais un verrou sur un centre."
        ),
    )

    class Meta:
        verbose_name = "compteur de la série des factures d'abonnement"
        verbose_name_plural = "compteur de la série des factures d'abonnement"

    def __str__(self) -> str:  # pragma: no cover — admin/debug only
        return f"Série A- : {self.last_number} facture(s) émise(s)"


class SubscriptionInvoice(TimeStampedModel):
    """What Chioni claims from ONE center for ONE billing period.

    **Frozen at issuance** (patron ``Invoice._FROZEN_OUTSIDE_DRAFT``,
    ADR 0015): there is no draft stage here — an invoice is born ``emise``
    and its amount, its period, its number and its plan snapshot never
    move again. Only the workflow may still change (``payee`` when the
    balance reaches zero, ``annulee`` with a mandatory motive) plus the
    reminder bookkeeping.

    ``plan_code``/``plan_label``/``amount_kmf`` are a SNAPSHOT of the offer
    (patron ``InvoiceLine``): repricing « Essentiel » tomorrow must not
    rewrite a single franc of what was already claimed — locked by test.

    The remaining balance is DERIVED
    (:func:`apps.billing.services.subscription_invoice_balance_kmf`) —
    amount minus the non-reversed payments. No mutable « reste dû » field
    exists here, exactly as at the cash desk.
    """

    NUMBER_PREFIX = "A"

    class Status(models.TextChoices):
        ISSUED = "emise", "Émise"
        PAID = "payee", "Payée"
        CANCELLED = "annulee", "Annulée"

    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="subscription_invoices",
        help_text=(
            "Dénormalisé depuis l'abonnement par le service — jamais une "
            "entrée client (patron ``CashPayment.center``)."
        ),
    )
    subscription = models.ForeignKey(
        CenterSubscription,
        verbose_name="abonnement",
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    sequence_number = models.PositiveIntegerField(
        "numéro de la série « A- »",
        help_text="Global à Chioni — jamais par tenant (ADR 0018 décision 4).",
    )
    period_start = models.DateField("début de période")
    period_end = models.DateField("fin de période (incluse)")
    amount_kmf = models.DecimalField(
        "montant (KMF)",
        max_digits=12,
        decimal_places=2,
        validators=[validate_kmf_integral],
        help_text="Figé à l'émission : un changement de prix de l'offre n'y touche jamais.",
    )
    plan_code = models.CharField(
        "code de l'offre (figé)",
        max_length=32,
        help_text="SNAPSHOT — l'offre peut être renommée ou repricée ensuite.",
    )
    plan_label = models.CharField("nom de l'offre (figé)", max_length=128)
    due_date = models.DateField(
        "échéance",
        help_text=(
            "Une échéance dépassée fait passer l'abonnement en « impayé » "
            "(alerte), jamais en « suspendu » (sanction, décision humaine)."
        ),
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.ISSUED
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="émise par",
        on_delete=models.PROTECT,
        related_name="subscription_invoices_issued",
        null=True,
        blank=True,
        help_text="Exploitant Chioni ; vide pour l'émission automatique (tâche planifiée).",
    )
    cancelled_at = models.DateTimeField("annulée le", null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="annulée par",
        on_delete=models.PROTECT,
        related_name="subscription_invoices_cancelled",
        null=True,
        blank=True,
    )
    cancel_reason = models.TextField(
        "motif d'annulation",
        blank=True,
        help_text=(
            "Obligatoire à l'annulation. Écrit par Chioni POUR le directeur "
            "du centre : il le lit sur sa facture — jamais dans un payload "
            "d'audit (même règle que ``Invoice.cancel_reason``)."
        ),
    )
    # Reminder bookkeeping (ADR 0012 étendu) — the anti-duplicate flag of
    # the J+0 / J+7 / J+21 cadence, committed WITH its SMS (patron
    # ``Appointment.reminder_sent_at``).
    reminders_sent = models.PositiveSmallIntegerField(
        "relances envoyées", default=0
    )
    last_reminder_at = models.DateTimeField(
        "dernière relance", null=True, blank=True
    )

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "facture d'abonnement"
        verbose_name_plural = "factures d'abonnement"
        ordering = ["-sequence_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["sequence_number"],
                name="unique_subscription_invoice_sequence",
            ),
            # Idempotence of the monthly issuance: ONE live invoice per
            # (subscription, period). A CANCELLED one is excluded on
            # purpose — cancelling an invoice must leave its period
            # re-billable, otherwise a typo would make a tenant
            # permanently un-invoiceable for that month.
            models.UniqueConstraint(
                fields=["subscription", "period_start"],
                condition=~models.Q(status="annulee"),
                name="unique_live_subscription_invoice_period",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_kmf__gt=0),
                name="subscription_invoice_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_kmf=Round("amount_kmf")),
                name="subscription_invoice_amount_kmf_integral",
            ),
            models.CheckConstraint(
                condition=models.Q(period_end__gte=models.F("period_start")),
                name="subscription_invoice_period_ordered",
            ),
            models.CheckConstraint(
                condition=models.Q(due_date__gte=models.F("period_start")),
                name="subscription_invoice_due_after_period_start",
            ),
        ]

    def __str__(self) -> str:
        return f"Facture d'abonnement {self.number} — {self.amount_kmf} KMF"

    @property
    def number(self) -> str:
        """Display number « A-000001 » — never confusable with the « G- »
        counter receipts nor with a center's own invoice ids."""
        return f"{self.NUMBER_PREFIX}-{self.sequence_number:06d}"

    #: Everything an ISSUED invoice freezes. What may still move: the
    #: status, the cancellation trail and the reminder bookkeeping.
    _FROZEN_FIELDS = (
        "center_id", "subscription_id", "sequence_number", "period_start",
        "period_end", "amount_kmf", "plan_code", "plan_label", "due_date",
    )

    def save(self, *args, **kwargs):
        if self._state.adding:
            if self.center_id != self.subscription.center_id:
                raise ValidationError(
                    "Facture d'abonnement refusée : le centre ne correspond "
                    "pas à celui de l'abonnement."
                )
            validate_kmf_integral(self.amount_kmf)
        else:
            previous = (
                type(self).objects.filter(pk=self.pk)
                .values(*self._FROZEN_FIELDS)
                .first()
            )
            if previous is not None:
                changed = [
                    field for field in self._FROZEN_FIELDS
                    if getattr(self, field) != previous[field]
                ]
                if changed:
                    raise ValidationError(
                        "Facture d'abonnement émise : montant, période, "
                        "numéro et rattachements sont figés (champs modifiés "
                        f"refusés : {', '.join(changed)})."
                    )
        super().save(*args, **kwargs)


class SubscriptionPayment(AppendOnlyModel):
    """One settlement received by Chioni on a SaaS invoice — **append-only**.

    Same discipline as ``CashPayment`` (ADR 0015): money received is never
    rewritten or deleted; a mistake is corrected by an explicit,
    motivated :class:`SubscriptionPaymentReversal`. Partial settlements are
    admitted, never beyond the remaining balance — the invoice row lock in
    :func:`apps.billing.services.record_subscription_payment` is THE
    serialisation point.

    Difference with the cash desk, and it is the whole point of décision
    1: **no ledger transaction**. The care ledger records the money of
    PATIENTS — every franc tied to a patient, an act, a provider and a
    receipt. Chioni's own trésorerie has none of those and stays out.
    """

    class Method(models.TextChoices):
        TRANSFER = "virement", "Virement"
        CASH = "especes", "Espèces"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        OTHER = "autre", "Autre"

    invoice = models.ForeignKey(
        SubscriptionInvoice,
        verbose_name="facture d'abonnement",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    amount_kmf = models.DecimalField(
        "montant (KMF)",
        max_digits=12,
        decimal_places=2,
        validators=[validate_kmf_integral],
    )
    method = models.CharField(
        "moyen de règlement", max_length=16, choices=Method.choices
    )
    reference = models.CharField(
        "référence externe",
        max_length=64,
        blank=True,
        help_text="Ex. référence du virement ou de la transaction mobile money.",
    )
    received_at = models.DateField(
        "reçu le",
        default=timezone.localdate,
        help_text="Date réelle de réception des fonds — jamais dans le futur.",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="saisi par",
        on_delete=models.PROTECT,
        related_name="subscription_payments_recorded",
        help_text="Exploitant de la plateforme Chioni.",
    )

    class Meta:
        verbose_name = "règlement d'abonnement"
        verbose_name_plural = "règlements d'abonnement"
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_kmf__gt=0),
                name="subscription_payment_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_kmf=Round("amount_kmf")),
                name="subscription_payment_amount_kmf_integral",
            ),
        ]

    def __str__(self) -> str:
        return f"Règlement #{self.pk} — {self.amount_kmf} KMF"


class SubscriptionPaymentReversal(AppendOnlyModel):
    """The ONLY correction of a settlement (patron ``CashPaymentReversal``).

    One reversal per payment (OneToOne, race-safe at the DB level), a
    MANDATORY motive, and never a reversal of a reversal (structurally
    unrepresentable). Reversing reopens the balance and puts a ``payee``
    invoice back to ``emise``: the money is owed again and the invoice
    says so.

    ``reason`` is free operator text: readable by Chioni and by the
    director of the center concerned (it is his invoice), and **never** in
    an audit payload — same rule as ``cancel_reason`` and ``kyc_reason``.
    """

    payment = models.OneToOneField(
        SubscriptionPayment,
        verbose_name="règlement",
        on_delete=models.PROTECT,
        related_name="reversal",
    )
    reason = models.TextField(
        "motif",
        help_text="Obligatoire — une contre-passation sans motif est irrecevable.",
    )
    reversed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="contre-passé par",
        on_delete=models.PROTECT,
        related_name="subscription_payment_reversals_made",
    )

    class Meta:
        verbose_name = "contre-passation d'un règlement d'abonnement"
        verbose_name_plural = "contre-passations de règlements d'abonnement"

    def __str__(self) -> str:
        return f"Contre-passation du règlement #{self.payment_id}"
