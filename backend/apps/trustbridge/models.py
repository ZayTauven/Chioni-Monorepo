"""Trust Bridge: money flows — maximum rigour.

Structural rules (needs study §4.5, CLAUDE.md):

- No money amount is ever a mutable business field of truth: the
  double-entry, append-only ledger (``LedgerTransaction`` +
  ``LedgerEntry``) is the single source of financial truth.
- Every amount is a ``DecimalField`` with an explicit currency (EUR/KMF);
  the EUR→KMF rate is frozen per transaction and carried on entries.
- Ledger rows and receipts can never be updated nor deleted.
- The PSP (Stripe first) is an abstraction: ``PaymentIntent`` carries the
  PSP reference and a UNIQUE idempotency key so a retried webhook or
  double-click can never create money twice.
"""

import threading
from collections import defaultdict
from contextlib import contextmanager
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.centers.models import CenterScopedQuerySet
from apps.common.models import (
    ActCategory,
    AppendOnlyError,
    AppendOnlyModel,
    AppendOnlyQuerySet,
    Currency,
    TimeStampedModel,
)

# ---------------------------------------------------------------------------
# E4 — private module flag: the ONLY code allowed to write LedgerEntry rows
# is LedgerTransaction.record(), which opens this window around its atomic
# block. Everything else (managers, direct save(), bulk_create()) is refused,
# making the double-entry balance a real constraint, not an ADR guideline.
# Thread-local so concurrent workers cannot piggyback on each other's window.
# ---------------------------------------------------------------------------

_ledger_write_window = threading.local()


def _ledger_window_open() -> bool:
    return getattr(_ledger_write_window, "depth", 0) > 0


@contextmanager
def _open_ledger_window():
    _ledger_write_window.depth = getattr(_ledger_write_window, "depth", 0) + 1
    try:
        yield
    finally:
        _ledger_write_window.depth -= 1


class Invoice(TimeStampedModel):
    """A center invoice for an encounter, in KMF, built from act snapshots."""

    class Status(models.TextChoices):
        DRAFT = "brouillon", "Brouillon"
        ISSUED = "emise", "Émise"
        PAID = "payee", "Payée"
        CANCELLED = "annulee", "Annulée"

    encounter = models.ForeignKey(
        "medical.Encounter",
        verbose_name="consultation",
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient",
        on_delete=models.PROTECT,
        related_name="invoices",
    )
    total_kmf = models.DecimalField(
        "total (KMF)",
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Somme des lignes ; recalculée à chaque ajout de ligne, figée à l'émission.",
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.DRAFT
    )

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "facture"
        verbose_name_plural = "factures"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_kmf__gte=0),
                name="invoice_total_kmf_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"Facture #{self.pk} — {self.total_kmf} KMF ({self.get_status_display()})"

    # M4 — once the invoice leaves DRAFT these fields are frozen; only the
    # status itself may still move (workflow transitions stay possible).
    _FROZEN_OUTSIDE_DRAFT = ("encounter_id", "center_id", "patient_id", "total_kmf")

    def save(self, *args, **kwargs):
        if self.pk is not None and not self._state.adding:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values("status", *self._FROZEN_OUTSIDE_DRAFT)
                .first()
            )
            if previous is not None and previous["status"] != self.Status.DRAFT:
                changed = [
                    field
                    for field in self._FROZEN_OUTSIDE_DRAFT
                    if getattr(self, field) != previous[field]
                ]
                if changed:
                    raise ValidationError(
                        "Facture hors brouillon : montants et rattachements sont "
                        f"figés (champs modifiés refusés : {', '.join(changed)}). "
                        "Seule la transition de statut reste possible."
                    )
        super().save(*args, **kwargs)

    def recompute_total(self):
        """Recompute ``total_kmf`` from the lines (DRAFT stage only —
        ``save()`` refuses any amount change once the invoice is issued)."""
        total = self.lines.aggregate(s=models.Sum("amount_kmf"))["s"] or Decimal("0")
        self.total_kmf = total
        self.save(update_fields=["total_kmf", "updated_at"])


class InvoiceLine(TimeStampedModel):
    """One invoice line, SNAPSHOT from an ActPerformed (label + KMF price)."""

    invoice = models.ForeignKey(
        Invoice,
        verbose_name="facture",
        on_delete=models.CASCADE,  # a line has no life outside its (draft) invoice
        related_name="lines",
    )
    act = models.ForeignKey(
        "medical.ActPerformed",
        verbose_name="acte facturé",
        on_delete=models.PROTECT,
        related_name="invoice_lines",
    )
    label = models.CharField(
        "libellé (figé)",
        max_length=255,
        blank=True,
        help_text=(
            "Libellé comptable détaillé — portée « detail_clinique » côté tuteur "
            "(ADR 0005) : ne jamais l'exposer via les vues de paiement."
        ),
    )
    generic_category = models.CharField(
        "nature générique (figée)",
        max_length=24,
        choices=ActCategory.choices,
        blank=True,
        help_text=(
            "SNAPSHOT depuis l'acte (ADR 0005) — seule information de soin "
            "visible du tuteur sous la portée « paiements »."
        ),
    )
    amount_kmf = models.DecimalField(
        "montant (KMF)", max_digits=12, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "ligne de facture"
        verbose_name_plural = "lignes de facture"

    def __str__(self) -> str:
        return f"{self.label} — {self.amount_kmf} KMF"

    def _invoice_status_in_db(self):
        return (
            Invoice.objects.filter(pk=self.invoice_id)
            .values_list("status", flat=True)
            .first()
        )

    def save(self, *args, **kwargs):
        # M4 — lines only live while their invoice is a DRAFT.
        status = self._invoice_status_in_db()
        if status is not None and status != Invoice.Status.DRAFT:
            raise ValidationError(
                "Les lignes d'une facture ne sont modifiables qu'au stade brouillon."
            )
        # Copy the act's frozen snapshot at first save.
        if self._state.adding:
            if not self.label:
                self.label = self.act.label_snapshot
            if self.amount_kmf is None:
                self.amount_kmf = self.act.price_kmf_snapshot
            if not self.generic_category:
                self.generic_category = self.act.generic_category
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # M4 — removing a line from an issued invoice would silently change
        # what the guardian already agreed to pay.
        status = self._invoice_status_in_db()
        if status is not None and status != Invoice.Status.DRAFT:
            raise ValidationError(
                "Les lignes d'une facture émise ne peuvent pas être supprimées."
            )
        return super().delete(*args, **kwargs)


class PaymentRequest(TimeStampedModel):
    """A payment request on an invoice, shared with targeted guardian links.

    What a guardian sees of it is governed EXCLUSIVELY by
    ``medical.Consent.objects.active_scopes()`` — by default: amount,
    generic nature, status, receipt. Never expose clinical fields here.
    """

    class Status(models.TextChoices):
        DRAFT = "brouillon", "Brouillon"
        SENT = "envoyee", "Envoyée"
        PAID = "payee", "Payée"
        CARE_CONFIRMED = "soin_confirme", "Soin confirmé"
        CLOSED = "cloturee", "Clôturée"
        DISPUTED = "litige", "Litige"

    invoice = models.ForeignKey(
        Invoice,
        verbose_name="facture",
        on_delete=models.PROTECT,
        related_name="payment_requests",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="créée par",
        on_delete=models.PROTECT,
        related_name="payment_requests_created",
        help_text="Agent du centre ou patient à l'origine de la demande.",
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    shared_with = models.ManyToManyField(
        "patients.GuardianLink",
        verbose_name="partagée avec",
        related_name="payment_requests",
        blank=True,
        through="PaymentRequestShare",
        help_text="Liens de tutelle ciblés — seuls ces tuteurs voient la demande.",
    )
    patient_acknowledged_at = models.DateTimeField(
        "accusé du patient le",
        null=True,
        blank=True,
        help_text=(
            "Horodatage du « j'ai bien reçu ce soin » du patient — indicateur "
            "de mission (étude §10) : stocké, pas seulement audité."
        ),
    )

    class Meta:
        verbose_name = "demande de paiement"
        verbose_name_plural = "demandes de paiement"

    def __str__(self) -> str:
        return f"Demande #{self.pk} — facture #{self.invoice_id} ({self.get_status_display()})"


class PaymentRequestShareQuerySet(models.QuerySet):
    """Validating queryset: ``shared_with.add()`` goes through the through
    model's ``bulk_create()`` (not ``save()``), so the cross-patient check
    must live here too."""

    def bulk_create(self, objs, *args, **kwargs):
        for obj in objs:
            obj._validate_same_patient()
        return super().bulk_create(objs, *args, **kwargs)


class PaymentRequestShare(TimeStampedModel):
    """E1 — through model of ``PaymentRequest.shared_with``.

    Structural guarantee: a payment request can ONLY be shared with a
    guardian link of the very patient the invoice belongs to. A guardian
    of patient Y can never be handed patient X's payment request.
    """

    payment_request = models.ForeignKey(
        PaymentRequest,
        verbose_name="demande de paiement",
        on_delete=models.CASCADE,
        related_name="shares",
    )
    guardian_link = models.ForeignKey(
        "patients.GuardianLink",
        verbose_name="lien de tutelle",
        on_delete=models.CASCADE,
        related_name="payment_request_shares",
    )
    shared_at = models.DateTimeField("partagée le", default=timezone.now)
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="partagée par",
        on_delete=models.PROTECT,
        related_name="payment_request_shares_made",
        null=True,
        blank=True,
        help_text="Agent du centre ou patient qui a ciblé ce tuteur.",
    )

    objects = PaymentRequestShareQuerySet.as_manager()

    class Meta:
        verbose_name = "partage de demande de paiement"
        verbose_name_plural = "partages de demandes de paiement"
        constraints = [
            models.UniqueConstraint(
                fields=["payment_request", "guardian_link"],
                name="unique_share_per_request_and_link",
            ),
        ]

    def __str__(self) -> str:
        return f"Demande #{self.payment_request_id} → lien #{self.guardian_link_id}"

    def _validate_same_patient(self):
        if self.guardian_link.patient_id != self.payment_request.invoice.patient_id:
            raise ValidationError(
                "Partage refusé : le lien de tutelle ne concerne pas le patient "
                "de la facture — une demande de paiement ne se partage qu'avec "
                "les tuteurs du patient facturé."
            )

    def save(self, *args, **kwargs):
        self._validate_same_patient()
        super().save(*args, **kwargs)


class PaymentIntent(TimeStampedModel):
    """One payment attempt through the PSP abstraction (Stripe first).

    The idempotency key is UNIQUE: a replayed webhook or a double
    submission can never register the same payment twice. The EUR→KMF
    rate is frozen here before the guardian pays (transparent conversion).
    """

    class Psp(models.TextChoices):
        STRIPE = "stripe", "Stripe"
        FAKE = "fake", "Fake (développement)"

    class Status(models.TextChoices):
        CREATED = "cree", "Créé"
        PROCESSING = "en_cours", "En cours"
        SUCCEEDED = "reussi", "Réussi"
        FAILED = "echoue", "Échoué"
        CANCELLED = "annule", "Annulé"

    payment_request = models.ForeignKey(
        PaymentRequest,
        verbose_name="demande de paiement",
        on_delete=models.PROTECT,
        related_name="payment_intents",
    )
    guardian = models.ForeignKey(
        "patients.GuardianProfile",
        verbose_name="tuteur payeur",
        on_delete=models.PROTECT,
        related_name="payment_intents",
        null=True,
        blank=True,
    )
    psp = models.CharField(
        "prestataire de paiement", max_length=16, choices=Psp.choices, default=Psp.STRIPE
    )
    psp_reference = models.CharField(
        "référence PSP", max_length=255, blank=True,
        help_text="Ex. identifiant PaymentIntent Stripe.",
    )
    idempotency_key = models.CharField(
        "clé d'idempotence",
        max_length=64,
        unique=True,
        help_text="Unique : protège contre webhooks rejoués et doubles soumissions.",
    )
    amount_eur = models.DecimalField("montant payé (EUR)", max_digits=10, decimal_places=2)
    exchange_rate = models.DecimalField(
        "taux EUR→KMF figé",
        max_digits=12,
        decimal_places=6,
        help_text="Affiché au tuteur AVANT paiement, figé à la transaction.",
    )
    amount_kmf = models.DecimalField(
        "montant converti (KMF)", max_digits=12, decimal_places=2
    )
    status = models.CharField(
        "statut PSP", max_length=16, choices=Status.choices, default=Status.CREATED
    )
    ledger_transaction = models.ForeignKey(
        "LedgerTransaction",
        verbose_name="transaction d'encaissement",
        on_delete=models.PROTECT,
        related_name="payment_intents",
        null=True,
        blank=True,
        help_text=(
            "F2 — renseignée par le service d'encaissement au moment du succès : "
            "un intent SUCCEEDED est réconciliable avec SA transaction du ledger, "
            "jamais seulement affirmé. La clôture (reçu) s'appuie dessus."
        ),
    )

    class Meta:
        verbose_name = "intention de paiement"
        verbose_name_plural = "intentions de paiement"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_eur__gt=0),
                name="payment_intent_amount_eur_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_kmf__gt=0),
                name="payment_intent_amount_kmf_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(exchange_rate__gt=0),
                name="payment_intent_rate_positive",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Paiement {self.amount_eur} EUR → {self.amount_kmf} KMF "
            f"({self.get_status_display()})"
        )


class LedgerTransactionQuerySet(AppendOnlyQuerySet):
    """Append-only queryset with tenant-oriented reporting (M8)."""

    def for_center(self, center):
        return self.filter(center=center)


class LedgerTransaction(AppendOnlyModel):
    """An atomic financial event: a balanced group of ledger entries.

    Append-only. Always create through :meth:`record`, which writes the
    transaction and its entries atomically and enforces the double-entry
    balance PER CURRENCY. Corrections are new reversing transactions,
    never edits.
    """

    description = models.CharField("description", max_length=255)
    payment_request = models.ForeignKey(
        PaymentRequest,
        verbose_name="demande de paiement",
        on_delete=models.PROTECT,
        related_name="ledger_transactions",
        null=True,
        blank=True,
        help_text="Fléchage métier : chaque franc reste relié à une demande quand il y en a une.",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="ledger_transactions",
        null=True,
        blank=True,
        help_text=(
            "Renseigné automatiquement par record() depuis la facture de la "
            "demande de paiement — reporting et rapprochement par centre."
        ),
    )

    objects = LedgerTransactionQuerySet.as_manager()

    class Meta:
        verbose_name = "transaction du ledger"
        verbose_name_plural = "transactions du ledger"

    def __str__(self) -> str:
        return f"Ledger tx #{self.pk} — {self.description}"

    @classmethod
    def record(cls, *, description, entries, payment_request=None, center=None):
        """Create a balanced transaction and its entries atomically.

        ``entries`` is an iterable of dicts with keys: ``account``,
        ``direction``, ``amount``, ``currency`` and optionally
        ``exchange_rate``. Raises ``ValidationError`` if fewer than two
        entries are given or if debits and credits do not balance for
        every currency involved.

        This is the ONLY code path allowed to write ``LedgerEntry`` rows:
        it opens the private module write-window (E4) around its atomic
        block. When ``center`` is not given it is derived from
        ``payment_request.invoice.center`` (M8).
        """
        entries = list(entries)
        cls._validate_balanced(entries)
        if center is None and payment_request is not None:
            center = payment_request.invoice.center
        with transaction.atomic(), _open_ledger_window():
            tx = cls(
                description=description,
                payment_request=payment_request,
                center=center,
            )
            tx.save()
            for spec in entries:
                LedgerEntry(
                    transaction=tx,
                    account=spec["account"],
                    direction=spec["direction"],
                    amount=spec["amount"],
                    currency=spec["currency"],
                    exchange_rate=spec.get("exchange_rate"),
                ).save()
        return tx

    @staticmethod
    def _validate_balanced(entries):
        if len(entries) < 2:
            raise ValidationError(
                "Une transaction du ledger exige au moins deux écritures (double entrée)."
            )
        balance = defaultdict(Decimal)
        for spec in entries:
            amount = Decimal(spec["amount"])
            if amount <= 0:
                raise ValidationError("Chaque écriture du ledger doit avoir un montant > 0.")
            sign = 1 if spec["direction"] == LedgerEntry.Direction.DEBIT else -1
            balance[spec["currency"]] += sign * amount
        unbalanced = {cur: amt for cur, amt in balance.items() if amt != 0}
        if unbalanced:
            raise ValidationError(
                "Écritures non équilibrées par devise : "
                + ", ".join(f"{cur}: {amt}" for cur, amt in unbalanced.items())
            )


class LedgerEntryQuerySet(AppendOnlyQuerySet):
    """E4 — refuses any creation outside ``LedgerTransaction.record()``."""

    _LOCK_MESSAGE = (
        "LedgerEntry ne se crée que via LedgerTransaction.record() : "
        "la double entrée (équilibre débits/crédits par devise) n'est "
        "garantie que sur ce chemin."
    )

    def create(self, **kwargs):
        if not _ledger_window_open():
            raise AppendOnlyError(self._LOCK_MESSAGE)
        return super().create(**kwargs)

    def bulk_create(self, objs, *args, **kwargs):
        if not _ledger_window_open():
            raise AppendOnlyError(self._LOCK_MESSAGE)
        return super().bulk_create(objs, *args, **kwargs)


class LedgerEntry(AppendOnlyModel):
    """A single debit/credit line — append-only, currency explicit.

    Creation is locked to :meth:`LedgerTransaction.record` (E4): the
    manager and ``save()`` refuse any write outside the private module
    write-window that ``record()`` opens.
    """

    class Account(models.TextChoices):
        GUARDIAN_FUNDS = "fonds_tuteur", "Fonds du tuteur"
        DUE_TO_CENTER = "du_au_centre", "Dû au centre de santé"
        PSP_FEES = "frais_psp", "Frais PSP"
        CHIONI_FEES = "frais_chioni", "Frais Chioni"
        FX_CONVERSION = "conversion_change", "Conversion de change EUR↔KMF"

    class Direction(models.TextChoices):
        DEBIT = "debit", "Débit"
        CREDIT = "credit", "Crédit"

    transaction = models.ForeignKey(
        LedgerTransaction,
        verbose_name="transaction",
        on_delete=models.PROTECT,
        related_name="entries",
    )
    account = models.CharField("compte", max_length=24, choices=Account.choices)
    direction = models.CharField("sens", max_length=6, choices=Direction.choices)
    amount = models.DecimalField("montant", max_digits=14, decimal_places=2)
    currency = models.CharField("devise", max_length=3, choices=Currency.choices)
    exchange_rate = models.DecimalField(
        "taux appliqué",
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Taux EUR→KMF figé, renseigné sur les écritures issues d'une conversion.",
    )

    objects = LedgerEntryQuerySet.as_manager()

    class Meta:
        verbose_name = "écriture du ledger"
        verbose_name_plural = "écritures du ledger"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="ledger_entry_amount_positive",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.get_direction_display()} {self.amount} {self.currency} "
            f"— {self.get_account_display()}"
        )

    def save(self, *args, **kwargs):
        # E4 — covers Model(...).save() and manager.create() alike.
        if self._state.adding and not _ledger_window_open():
            raise AppendOnlyError(LedgerEntryQuerySet._LOCK_MESSAGE)
        super().save(*args, **kwargs)


class Receipt(AppendOnlyModel):
    """The closing receipt — dual currency, sequential per center, immutable.

    This is what the guardian and the patient keep: EUR paid, KMF received
    by the center, explicit fees, frozen rate. Issue through
    :meth:`issue` to get a race-safe sequential number per center.
    """

    payment_request = models.OneToOneField(
        PaymentRequest,
        verbose_name="demande de paiement",
        on_delete=models.PROTECT,
        related_name="receipt",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="receipts",
    )
    ledger_transaction = models.ForeignKey(
        LedgerTransaction,
        verbose_name="transaction de clôture",
        on_delete=models.PROTECT,
        related_name="receipts",
        help_text=(
            "M3 — la transaction du ledger qui solde la demande : les montants "
            "du reçu sont réconciliés avec le ledger, jamais seulement affirmés."
        ),
    )
    sequence_number = models.PositiveIntegerField("numéro séquentiel")
    amount_eur_paid = models.DecimalField(
        "montant payé (EUR)", max_digits=10, decimal_places=2
    )
    amount_kmf_received = models.DecimalField(
        "montant reçu par le centre (KMF)", max_digits=12, decimal_places=2
    )
    fees_eur = models.DecimalField(
        "frais explicites (EUR)", max_digits=10, decimal_places=2, default=Decimal("0")
    )
    exchange_rate = models.DecimalField(
        "taux EUR→KMF appliqué", max_digits=12, decimal_places=6
    )
    issued_at = models.DateTimeField("émis le", default=timezone.now)

    class Meta:
        verbose_name = "reçu"
        verbose_name_plural = "reçus"
        constraints = [
            models.UniqueConstraint(
                fields=["center", "sequence_number"],
                name="unique_receipt_sequence_per_center",
            ),
            # M3 — a receipt asserting a non-positive payment or negative
            # fees is a forgery vector; refused at the schema level.
            models.CheckConstraint(
                condition=models.Q(amount_eur_paid__gt=0),
                name="receipt_amount_eur_paid_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount_kmf_received__gt=0),
                name="receipt_amount_kmf_received_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(fees_eur__gte=0),
                name="receipt_fees_eur_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(exchange_rate__gt=0),
                name="receipt_exchange_rate_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"Reçu {self.center_id}-{self.sequence_number:06d}"

    @classmethod
    def issue(cls, *, payment_request, center, ledger_transaction, amount_eur_paid,
              amount_kmf_received, exchange_rate, fees_eur=Decimal("0")):
        """Create a receipt with a race-safe sequential number per center.

        ``ledger_transaction`` is REQUIRED (M3): the receipt documents a
        closing that the ledger must corroborate. Basic coherence check:
        when the transaction is tied to a payment request, it must be the
        same one the receipt closes.
        """
        from apps.centers.models import HealthCenter

        if (
            ledger_transaction.payment_request_id is not None
            and ledger_transaction.payment_request_id != payment_request.pk
        ):
            raise ValidationError(
                "Reçu refusé : la transaction de clôture est reliée à une autre "
                "demande de paiement."
            )
        if amount_eur_paid <= 0 or amount_kmf_received <= 0:
            raise ValidationError(
                "Reçu refusé : les montants payé (EUR) et reçu (KMF) doivent être > 0."
            )
        if fees_eur < 0:
            raise ValidationError("Reçu refusé : les frais ne peuvent pas être négatifs.")
        if exchange_rate <= 0:
            raise ValidationError("Reçu refusé : le taux de change doit être > 0.")

        with transaction.atomic():
            # Lock the center row to serialise numbering per tenant.
            HealthCenter.objects.select_for_update().get(pk=center.pk)
            last = (
                cls.objects.filter(center=center)
                .aggregate(m=models.Max("sequence_number"))["m"]
                or 0
            )
            receipt = cls(
                payment_request=payment_request,
                center=center,
                ledger_transaction=ledger_transaction,
                sequence_number=last + 1,
                amount_eur_paid=amount_eur_paid,
                amount_kmf_received=amount_kmf_received,
                fees_eur=fees_eur,
                exchange_rate=exchange_rate,
            )
            receipt.save()
        return receipt


class Dispute(TimeStampedModel):
    """A dispute opened on a payment request (paying guardian or patient).

    Phase B addition (argued): the mission requires disputes to be READABLE
    by center staff, to carry a MANDATORY reason, and to be resolved by
    staff with a motive that restores the pre-dispute status — none of
    which is representable with a bare status flag on PaymentRequest.
    A request under an OPEN dispute can never be closed (service rule).

    Confidentiality note: ``reason`` and ``resolution_note`` are free text
    typed by the parties about a payment disagreement — they are exposed to
    the center staff handling the dispute and to their author, NEVER pushed
    into the AuditLog payload (ADR 0007: references only).
    """

    class Status(models.TextChoices):
        OPEN = "ouvert", "Ouvert"
        RESOLVED = "resolu", "Résolu"

    payment_request = models.ForeignKey(
        PaymentRequest,
        verbose_name="demande de paiement",
        on_delete=models.PROTECT,
        related_name="disputes",
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="ouvert par",
        on_delete=models.PROTECT,
        related_name="disputes_opened",
    )
    reason = models.TextField(
        "motif", help_text="Obligatoire — un litige sans motif est irrecevable."
    )
    previous_status = models.CharField(
        "statut avant litige",
        max_length=16,
        choices=PaymentRequest.Status.choices,
        help_text="Statut de la demande au moment de l'ouverture — restauré à la résolution.",
    )
    status = models.CharField(
        "statut", max_length=16, choices=Status.choices, default=Status.OPEN
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="résolu par",
        on_delete=models.PROTECT,
        related_name="disputes_resolved",
        null=True,
        blank=True,
    )
    resolution_note = models.TextField("motif de résolution", blank=True)
    resolved_at = models.DateTimeField("résolu le", null=True, blank=True)

    class Meta:
        verbose_name = "litige"
        verbose_name_plural = "litiges"
        constraints = [
            # One OPEN dispute at a time per request; resolved history is kept.
            models.UniqueConstraint(
                fields=["payment_request"],
                condition=models.Q(status="ouvert"),
                name="unique_open_dispute_per_request",
            ),
        ]

    def __str__(self) -> str:
        return f"Litige #{self.pk} — demande #{self.payment_request_id} ({self.get_status_display()})"
