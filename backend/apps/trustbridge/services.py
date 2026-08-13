"""Trust Bridge domain services — the ONLY write paths for money flows.

This module closes, at the service layer, the probes left open by the
model-layer hardening (``tests/test_hardening.py``):

- **M5** — the ``PaymentRequest`` state machine lives HERE and is
  EXCLUSIVE: every status write goes through :func:`_set_status`, whose
  transition map refuses anything else with a French ``ValidationError``.
  No endpoint ever sets a status directly.
- **F2** — ``payee`` is reachable ONLY through
  :func:`register_payment_success`, which records the balanced
  ``LedgerTransaction`` and stamps it on the intent in the SAME atomic
  block: a SUCCEEDED intent without its ledger trace cannot exist on this
  path.
- **R5/F3** — receipts are issued ONLY by :func:`close_payment_request`
  via ``Receipt.issue()``, with amounts read back from the ledger entries
  and reconciled against the intent before issuance.
- **R6/E4** — no code here (nor anywhere else) opens the private ledger
  window: every ledger write goes through ``LedgerTransaction.record()``.

Structural money rules (CLAUDE.md): the destination of the funds is ALWAYS
derived from ``payment_request.invoice.center`` — never from any caller
input — and a center must hold an ACTIVE KYC status to cash in. Every
sensitive action writes its immutable audit entry (references, amounts and
currencies only — never an act label, ADR 0005/0007) inside the same
transaction.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.centers.models import HealthCenter
from apps.common import notifications
from apps.common.models import Currency
from apps.patients.models import GuardianLink
from apps.trustbridge.fx import net_eur_for_kmf, quote_eur_for_kmf
from apps.trustbridge.models import (
    Dispute,
    Invoice,
    InvoiceLine,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
    PaymentRequest,
    PaymentRequestShare,
    Receipt,
)
from apps.trustbridge.psp import PspError, WebhookEvent, get_psp

Status = PaymentRequest.Status

# ---------------------------------------------------------------------------
# M5 — the EXCLUSIVE state machine. Any transition outside this map is
# refused; the DISPUTED exits are reachable only through resolve_dispute()
# (it restores the pre-dispute status recorded on the Dispute row).
# ---------------------------------------------------------------------------

_ALLOWED_TRANSITIONS = {
    Status.DRAFT: {Status.SENT},
    Status.SENT: {Status.PAID, Status.DISPUTED},
    Status.PAID: {Status.CARE_CONFIRMED, Status.DISPUTED},
    Status.CARE_CONFIRMED: {Status.CLOSED},
    Status.CLOSED: set(),
    Status.DISPUTED: {Status.SENT, Status.PAID},
}


def _set_status(payment_request, target):
    """The ONE gate every status change goes through (M5)."""
    current = payment_request.status
    if target not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise ValidationError(
            f"Transition refusée : une demande de paiement "
            f"«{Status(current).label}» ne peut pas passer à "
            f"«{Status(target).label}»."
        )
    payment_request.status = target
    payment_request.save(update_fields=["status", "updated_at"])
    return payment_request


def _locked(payment_request):
    """Re-read the request under row lock (state transitions are races)."""
    return PaymentRequest.objects.select_for_update().get(pk=payment_request.pk)


def _require_center_can_collect(center):
    """Money NEVER goes to an individual, and only to a VERIFIED center."""
    if center.kyc_status != HealthCenter.KycStatus.ACTIVE:
        raise ValidationError(
            "Ce centre ne peut pas encore encaisser de paiements : "
            "sa vérification (KYC) n'est pas active."
        )


# ---------------------------------------------------------------------------
# Invoices — snapshots of performed acts, frozen at issuance
# ---------------------------------------------------------------------------


@transaction.atomic
def create_invoice(*, actor, center, encounter, act_ids=None):
    """Staff creates a DRAFT invoice from an encounter of THEIR center.

    Lines are SNAPSHOTS of the encounter's ``ActPerformed`` rows (label,
    price, generic category — ADR 0005). ``act_ids`` selects a subset;
    omitted, every act of the encounter is billed. An act already carried
    by a living invoice cannot be billed twice.
    """
    if encounter.center_id != center.pk:
        raise ValidationError(
            "Cette consultation n'appartient pas à ce centre : facturation refusée."
        )
    acts = encounter.acts.all()
    if act_ids is not None:
        acts = acts.filter(pk__in=act_ids)
        if acts.count() != len(set(act_ids)):
            raise ValidationError(
                "Certains actes demandés n'appartiennent pas à cette consultation."
            )
    acts = list(acts)
    if not acts:
        raise ValidationError(
            "Aucun acte à facturer sur cette consultation."
        )
    for act in acts:
        already_billed = act.invoice_lines.exclude(
            invoice__status=Invoice.Status.CANCELLED
        ).exists()
        if already_billed:
            raise ValidationError(
                "Un des actes est déjà porté par une facture : "
                "un acte ne se facture qu'une seule fois."
            )
    invoice = Invoice.objects.create(
        encounter=encounter,
        center=center,
        patient=encounter.patient,
        status=Invoice.Status.DRAFT,
    )
    for act in acts:
        InvoiceLine.objects.create(invoice=invoice, act=act)
    invoice.recompute_total()
    audit(
        actor=actor, action=AuditAction.INVOICE_CREATED, target=invoice,
        invoice_id=invoice.pk, center_id=center.pk, encounter_id=encounter.pk,
        patient_id=invoice.patient_id, line_count=len(acts),
        total_kmf=invoice.total_kmf, currency=str(Currency.KMF),
    )
    return invoice


@transaction.atomic
def issue_invoice(*, actor, invoice):
    """DRAFT → ISSUED: amounts and lines freeze (model + DB trigger)."""
    if invoice.status != Invoice.Status.DRAFT:
        raise ValidationError("Seule une facture en brouillon peut être émise.")
    if not invoice.lines.exists():
        raise ValidationError("Une facture sans ligne ne peut pas être émise.")
    if invoice.total_kmf <= 0:
        raise ValidationError("Une facture d'un total nul ne peut pas être émise.")
    invoice.status = Invoice.Status.ISSUED
    invoice.save(update_fields=["status", "updated_at"])
    audit(
        actor=actor, action=AuditAction.INVOICE_ISSUED, target=invoice,
        invoice_id=invoice.pk, center_id=invoice.center_id,
        total_kmf=invoice.total_kmf, currency=str(Currency.KMF),
    )
    return invoice


# ---------------------------------------------------------------------------
# Payment requests — creation, sharing, sending
# ---------------------------------------------------------------------------


@transaction.atomic
def create_payment_request(*, actor, invoice):
    """Open a DRAFT payment request on an ISSUED invoice (one per invoice:
    two living requests on the same invoice would collect the money twice)."""
    if invoice.status != Invoice.Status.ISSUED:
        raise ValidationError(
            "Une demande de paiement ne peut être créée que sur une facture émise."
        )
    if invoice.payment_requests.exists():
        raise ValidationError(
            "Une demande de paiement existe déjà pour cette facture."
        )
    payment_request = PaymentRequest.objects.create(
        invoice=invoice, created_by=actor, status=Status.DRAFT
    )
    audit(
        actor=actor, action=AuditAction.PAYMENT_REQUEST_CREATED,
        target=payment_request,
        payment_request_id=payment_request.pk, invoice_id=invoice.pk,
        center_id=invoice.center_id, patient_id=invoice.patient_id,
        total_kmf=invoice.total_kmf, currency=str(Currency.KMF),
    )
    return payment_request


@transaction.atomic
def share_payment_request(*, actor, payment_request, guardian_link):
    """Target one ACTIVE guardian link of the invoiced patient.

    THE sharing service — always ``PaymentRequestShare.objects.create()``
    (validated ``save()`` path + DB trigger R1), never a raw M2M ``add()``.
    """
    if payment_request.status not in (Status.DRAFT, Status.SENT):
        raise ValidationError(
            "Le partage n'est possible que sur une demande en brouillon ou envoyée."
        )
    if guardian_link.status != GuardianLink.Status.ACTIVE:
        raise ValidationError(
            "Ce lien de tutelle n'est pas actif : partage refusé."
        )
    if guardian_link.patient_id != payment_request.invoice.patient_id:
        raise ValidationError(
            "Partage refusé : ce lien de tutelle ne concerne pas le patient facturé."
        )
    if payment_request.shares.filter(guardian_link=guardian_link).exists():
        raise ValidationError("Cette demande est déjà partagée avec ce tuteur.")
    share = PaymentRequestShare.objects.create(
        payment_request=payment_request,
        guardian_link=guardian_link,
        shared_by=actor,
    )
    audit(
        actor=actor, action=AuditAction.PAYMENT_REQUEST_SHARED,
        target=payment_request,
        payment_request_id=payment_request.pk, link_id=guardian_link.pk,
        guardian_id=guardian_link.guardian_id,
        patient_id=guardian_link.patient_id,
    )
    if payment_request.status == Status.SENT:
        # Événement 4, rattrapage (revue guardian) : la demande est DÉJÀ
        # envoyée — ce tuteur a raté la vague de SMS de l'envoi ; il reçoit
        # le sien maintenant (même template, on_commit). Un partage en
        # brouillon reste muet jusqu'à send_payment_request.
        notifications.notify_payment_request_share_added(share)
    return share


@transaction.atomic
def unshare_payment_request(*, actor, payment_request, guardian_link):
    """Withdraw a share — the guardian immediately stops seeing the request."""
    if payment_request.status not in (Status.DRAFT, Status.SENT):
        raise ValidationError(
            "Le retrait de partage n'est possible que sur une demande "
            "en brouillon ou envoyée."
        )
    share = payment_request.shares.filter(guardian_link=guardian_link).first()
    if share is None:
        raise ValidationError("Cette demande n'est pas partagée avec ce tuteur.")
    share.delete()
    audit(
        actor=actor, action=AuditAction.PAYMENT_REQUEST_UNSHARED,
        target=payment_request,
        payment_request_id=payment_request.pk, link_id=guardian_link.pk,
        guardian_id=guardian_link.guardian_id,
        patient_id=guardian_link.patient_id,
    )
    return payment_request


@transaction.atomic
def send_payment_request(*, actor, payment_request):
    """brouillon → envoyee — requires at least one share (someone to pay)."""
    payment_request = _locked(payment_request)
    if payment_request.status == Status.DRAFT and not payment_request.shares.exists():
        raise ValidationError(
            "Impossible d'envoyer une demande qui n'est partagée avec aucun tuteur."
        )
    _set_status(payment_request, Status.SENT)
    audit(
        actor=actor, action=AuditAction.PAYMENT_REQUEST_SENT,
        target=payment_request,
        payment_request_id=payment_request.pk,
        invoice_id=payment_request.invoice_id,
        share_count=payment_request.shares.count(),
    )
    # Événement 4 (notifications métier) : un SMS à chaque tuteur partagé —
    # montant admis (destinataire tuteur), jamais le libellé de l'acte.
    notifications.notify_payment_request_sent(payment_request)
    return payment_request


# ---------------------------------------------------------------------------
# Quote & payment — PSP abstraction, frozen conversion
# ---------------------------------------------------------------------------


def quote_payment_request(payment_request):
    """The transparent quote (rate + explicit fees) BEFORE any payment."""
    if payment_request.status != Status.SENT:
        raise ValidationError(
            "Cette demande n'est pas ouverte au paiement : pas de devis."
        )
    return quote_eur_for_kmf(payment_request.invoice.total_kmf)


def _shared_active_link_for(payment_request, user):
    """The caller's ACTIVE guardian link this request was shared with."""
    return (
        GuardianLink.objects.filter(
            guardian__user=user,
            status=GuardianLink.Status.ACTIVE,
            payment_request_shares__payment_request=payment_request,
        )
        .select_related("guardian")
        .first()
    )


def _refuse_if_recent_pending_intent(payment_request):
    """Anti-double-débit guard (guardian review of the frontend, 2026-08-13).

    With a real PSP, an intent can linger ``en_cours`` (3DS pending, card
    declined after the fact) while the request stays ``envoyee``: without
    this guard, a returning guardian could be charged TWICE for one
    request, the second webhook landing on an already-paid request. So a
    ``cree``/``en_cours`` intent more recent than
    ``PSP_INTENT_GUARD_MINUTES`` blocks any new intent on the SAME request.
    Older pending intents are considered abandoned and no longer block —
    a 3DS never completed must not make the request unpayable forever
    (its late webhook stays harmless: replay on the same intent is a
    strict no-op, and success on a no-longer-SENT request writes nothing).

    Callers hold the ``select_for_update`` row lock on the request
    (:func:`_locked`), which serialises two concurrent ``pay/`` calls:
    the second transaction only runs this check AFTER the first committed
    its intent, and therefore sees it.
    """
    guard_minutes = settings.PSP_INTENT_GUARD_MINUTES
    threshold = timezone.now() - timedelta(minutes=guard_minutes)
    pending = payment_request.payment_intents.filter(
        status__in=(
            PaymentIntent.Status.CREATED,
            PaymentIntent.Status.PROCESSING,
        ),
        created_at__gte=threshold,
    )
    if pending.exists():
        raise ValidationError(
            "Un paiement est déjà en cours pour cette demande. "
            "Attendez quelques minutes avant de réessayer."
        )


@transaction.atomic
def create_payment_intent(*, guardian_user, payment_request):
    """A shared guardian starts paying: rate and amounts FROZEN here.

    The destination is structurally ``invoice.center`` (never an input),
    and the center must be KYC-active BEFORE the guardian is charged.
    A recent pending intent on the same request blocks a new one
    (:func:`_refuse_if_recent_pending_intent` — anti-double-débit).
    """
    payment_request = _locked(payment_request)
    if payment_request.status != Status.SENT:
        raise ValidationError(
            "Cette demande n'est pas ouverte au paiement "
            f"(statut : {Status(payment_request.status).label})."
        )
    link = _shared_active_link_for(payment_request, guardian_user)
    if link is None:
        raise ValidationError(
            "Cette demande de paiement ne vous a pas été partagée."
        )
    _refuse_if_recent_pending_intent(payment_request)
    _require_center_can_collect(payment_request.invoice.center)
    quote = quote_eur_for_kmf(payment_request.invoice.total_kmf)
    intent = PaymentIntent.objects.create(
        payment_request=payment_request,
        guardian=link.guardian,
        psp=get_psp_choice(),
        idempotency_key=uuid.uuid4().hex,
        amount_eur=quote.total_eur,  # what the guardian pays, fees included
        exchange_rate=quote.rate,
        amount_kmf=quote.amount_kmf,  # what the center receives, in full
        status=PaymentIntent.Status.CREATED,
    )
    intent.psp_reference = get_psp().create_payment(intent)
    intent.status = PaymentIntent.Status.PROCESSING
    intent.save(update_fields=["psp_reference", "status", "updated_at"])
    audit(
        actor=guardian_user, action=AuditAction.PAYMENT_INTENT_CREATED,
        target=intent,
        intent_id=intent.pk, payment_request_id=payment_request.pk,
        guardian_id=link.guardian_id, center_id=payment_request.invoice.center_id,
        amount_eur=quote.total_eur, fees_eur=quote.fees_eur,
        amount_kmf=quote.amount_kmf, exchange_rate=quote.rate,
        currency_paid=str(Currency.EUR), currency_received=str(Currency.KMF),
    )
    return intent


def get_psp_choice():
    """Map the active backend onto the ``PaymentIntent.Psp`` choice."""
    return (
        PaymentIntent.Psp.FAKE
        if settings.PSP_BACKEND == "fake"
        else PaymentIntent.Psp.STRIPE
    )


class _LateWebhookRefused(Exception):
    """Internal signal: a SUCCESS event landed on an intent/request that can
    no longer cash in. Raised INSIDE the atomic block (rolls it back), caught
    by :func:`register_payment_success` OUTSIDE it, where the refusal is
    audited — an audit row written before raising inside the transaction
    would be rolled back with it and leave no reconciliation trace.
    """

    def __init__(self, message, **refs):
        super().__init__(message)
        self.message = message
        self.refs = refs


def register_payment_success(*, intent, actor=None):
    """THE cash-in path — the ONLY way a request ever becomes ``payee``.

    In ONE atomic block: balanced ledger entries per currency (rate
    carried), intent → SUCCEEDED with its ledger transaction stamped (F2),
    request → PAID (M5), invoice → PAID, audit. Replaying the webhook is a
    strict no-op: the intent row is locked and an already-SUCCEEDED intent
    returns immediately.

    A LATE success (intent already ``echoue``/``annule`` — purge des
    zombies, ADR 0009 — or request no longer ``envoyee``) is refused with a
    400, but the provider may have really debited the guardian: the refusal
    writes a system AuditLog (``payment.webhook_refused``, references only)
    OUTSIDE the rolled-back transaction — matière à réconciliation.
    """
    try:
        return _register_payment_success(intent=intent, actor=actor)
    except _LateWebhookRefused as refused:
        audit(
            actor=actor, action=AuditAction.PAYMENT_WEBHOOK_REFUSED,
            target=intent, reason="late_webhook_refused", **refused.refs,
        )
        raise ValidationError(refused.message)


@transaction.atomic
def _register_payment_success(*, intent, actor=None):
    intent = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
    if intent.status == PaymentIntent.Status.SUCCEEDED:
        return intent  # idempotent replay — nothing written twice
    if intent.status in (PaymentIntent.Status.FAILED, PaymentIntent.Status.CANCELLED):
        raise _LateWebhookRefused(
            "Cette intention de paiement a échoué ou été annulée : "
            "elle ne peut plus être encaissée.",
            intent_id=intent.pk,
            payment_request_id=intent.payment_request_id,
            intent_status=intent.status,
        )
    payment_request = _locked(intent.payment_request)
    if payment_request.status != Status.SENT:
        raise _LateWebhookRefused(
            "Encaissement refusé : la demande n'est plus ouverte au paiement "
            f"(statut : {Status(payment_request.status).label}).",
            intent_id=intent.pk,
            payment_request_id=payment_request.pk,
            intent_status=intent.status,
            request_status=payment_request.status,
        )
    center = payment_request.invoice.center  # structural destination
    _require_center_can_collect(center)

    total_eur = intent.amount_eur
    net_eur = net_eur_for_kmf(intent.amount_kmf, intent.exchange_rate)
    fees_eur = total_eur - net_eur
    if fees_eur < 0:
        raise ValidationError(
            "Encaissement refusé : montants de l'intention incohérents "
            "(frais négatifs)."
        )
    entries = [
        {
            "account": LedgerEntry.Account.GUARDIAN_FUNDS,
            "direction": LedgerEntry.Direction.DEBIT,
            "amount": total_eur,
            "currency": Currency.EUR,
        },
        {
            "account": LedgerEntry.Account.FX_CONVERSION,
            "direction": LedgerEntry.Direction.CREDIT,
            "amount": net_eur,
            "currency": Currency.EUR,
            "exchange_rate": intent.exchange_rate,
        },
        {
            "account": LedgerEntry.Account.FX_CONVERSION,
            "direction": LedgerEntry.Direction.DEBIT,
            "amount": intent.amount_kmf,
            "currency": Currency.KMF,
            "exchange_rate": intent.exchange_rate,
        },
        {
            "account": LedgerEntry.Account.DUE_TO_CENTER,
            "direction": LedgerEntry.Direction.CREDIT,
            "amount": intent.amount_kmf,
            "currency": Currency.KMF,
            "exchange_rate": intent.exchange_rate,
        },
    ]
    if fees_eur > 0:
        entries.insert(1, {
            "account": LedgerEntry.Account.PSP_FEES,
            "direction": LedgerEntry.Direction.CREDIT,
            "amount": fees_eur,
            "currency": Currency.EUR,
        })
    ledger_tx = LedgerTransaction.record(
        description=(
            f"Encaissement Pont de Confiance — demande #{payment_request.pk}, "
            f"intent {intent.idempotency_key}"
        ),
        payment_request=payment_request,
        entries=entries,
    )
    intent.status = PaymentIntent.Status.SUCCEEDED
    intent.ledger_transaction = ledger_tx
    intent.save(update_fields=["status", "ledger_transaction", "updated_at"])
    _set_status(payment_request, Status.PAID)
    # ``paid_at`` — the requestable payment timestamp (frontend constat B2:
    # « payée par un proche » must carry a date). Stamped HERE only, in the
    # same atomic block as the ledger write, exactly once: the replay no-op
    # returns before this point, a second success on the same request is
    # refused above (status is no longer SENT), and a dispute/resolution
    # cycle never clears it. Reading audience serializers expose it as-is.
    payment_request.paid_at = timezone.now()
    payment_request.save(update_fields=["paid_at", "updated_at"])
    invoice = payment_request.invoice
    invoice.status = Invoice.Status.PAID
    invoice.save(update_fields=["status", "updated_at"])
    audit(
        actor=actor, action=AuditAction.PAYMENT_RECORDED, target=payment_request,
        payment_request_id=payment_request.pk, intent_id=intent.pk,
        ledger_transaction_id=ledger_tx.pk, center_id=center.pk,
        guardian_id=intent.guardian_id,
        amount_eur=total_eur, fees_eur=fees_eur, amount_kmf=intent.amount_kmf,
        exchange_rate=intent.exchange_rate,
        currency_paid=str(Currency.EUR), currency_received=str(Currency.KMF),
    )
    # Événement 5 (notifications métier) : SMS au patient, SANS montant.
    # Le rejeu du webhook retourne AVANT ce point (no-op idempotent) :
    # jamais deux SMS pour un même encaissement.
    notifications.notify_payment_received(payment_request)
    return intent


@transaction.atomic
def register_payment_failure(*, intent, actor=None):
    """Provider reported a failure. A stale failure AFTER a success is
    ignored (the money is in the ledger — the ledger is the truth)."""
    intent = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
    if intent.status in (PaymentIntent.Status.SUCCEEDED, PaymentIntent.Status.FAILED):
        return intent  # no-op: already settled or already failed
    intent.status = PaymentIntent.Status.FAILED
    intent.save(update_fields=["status", "updated_at"])
    audit(
        actor=actor, action=AuditAction.PAYMENT_INTENT_FAILED, target=intent,
        intent_id=intent.pk, payment_request_id=intent.payment_request_id,
    )
    return intent


def handle_psp_webhook(*, payload, signature):
    """Entry point of the PSP webhook endpoint (system actor).

    Verifies the signature via the active backend, resolves the intent by
    provider reference and dispatches. Errors surface as French
    ``ValidationError`` (HTTP 400) — nothing is ever recorded on a bad
    signature or an unknown reference.
    """
    try:
        event = get_psp().parse_webhook(payload, signature)
    except PspError as exc:
        raise ValidationError(f"Webhook rejeté : {exc}")
    intent = PaymentIntent.objects.filter(psp_reference=event.reference).first()
    if intent is None:
        raise ValidationError("Webhook rejeté : référence de paiement inconnue.")
    if event.status == WebhookEvent.SUCCEEDED:
        return register_payment_success(intent=intent, actor=None)
    return register_payment_failure(intent=intent, actor=None)


# ---------------------------------------------------------------------------
# Care confirmation, patient acknowledgement, closure (receipt)
# ---------------------------------------------------------------------------


@transaction.atomic
def confirm_care(*, actor, payment_request):
    """Center staff confirms the care was delivered: payee → soin_confirme."""
    payment_request = _locked(payment_request)
    _set_status(payment_request, Status.CARE_CONFIRMED)
    audit(
        actor=actor, action=AuditAction.CARE_CONFIRMED, target=payment_request,
        payment_request_id=payment_request.pk,
        invoice_id=payment_request.invoice_id,
        center_id=payment_request.invoice.center_id,
    )
    return payment_request


@transaction.atomic
def acknowledge_care_received(*, patient_user, payment_request):
    """The patient's « j'ai bien reçu ce soin » — optional, STORED (mission
    indicator, étude §10), audited. Does not drive the state machine."""
    payment_request = _locked(payment_request)
    if payment_request.invoice.patient.user_id != patient_user.pk:
        raise ValidationError(
            "Seul le patient concerné peut accuser réception du soin."
        )
    if payment_request.status not in (
        Status.PAID, Status.CARE_CONFIRMED, Status.CLOSED
    ):
        raise ValidationError(
            "L'accusé de réception n'est possible qu'après le paiement du soin."
        )
    if payment_request.patient_acknowledged_at is not None:
        raise ValidationError("Vous avez déjà accusé réception de ce soin.")
    payment_request.patient_acknowledged_at = timezone.now()
    payment_request.save(update_fields=["patient_acknowledged_at", "updated_at"])
    audit(
        actor=patient_user, action=AuditAction.PATIENT_CARE_ACKNOWLEDGED,
        target=payment_request,
        payment_request_id=payment_request.pk,
        invoice_id=payment_request.invoice_id,
    )
    return payment_request


def _ledger_sum(ledger_tx, *, account, direction, currency):
    total = Decimal("0")
    for entry in ledger_tx.entries.filter(
        account=account, direction=direction, currency=currency
    ):
        total += entry.amount
    return total


@transaction.atomic
def close_payment_request(*, actor, payment_request):
    """soin_confirme → cloturee, receipt issued via ``Receipt.issue()`` ONLY.

    R5/F3 functional closure: the receipt amounts are READ BACK from the
    ledger entries of the cash-in transaction and reconciled against the
    intent — a receipt that the ledger does not corroborate is refused.
    """
    payment_request = _locked(payment_request)
    if payment_request.status == Status.DISPUTED:
        raise ValidationError(
            "Cette demande est en litige : résolvez le litige avant de clôturer."
        )
    if payment_request.status != Status.CARE_CONFIRMED:
        raise ValidationError(
            "Clôture refusée : le soin doit d'abord être confirmé par le centre "
            f"(statut actuel : {Status(payment_request.status).label})."
        )
    if payment_request.disputes.filter(status=Dispute.Status.OPEN).exists():
        raise ValidationError(
            "Cette demande est en litige : résolvez le litige avant de clôturer."
        )
    intent = payment_request.payment_intents.filter(
        status=PaymentIntent.Status.SUCCEEDED
    ).first()
    if intent is None or intent.ledger_transaction_id is None:
        raise ValidationError(
            "Clôture refusée : aucun paiement encaissé (intention aboutie et "
            "trace au ledger requises)."
        )
    ledger_tx = intent.ledger_transaction
    amount_eur_paid = _ledger_sum(
        ledger_tx,
        account=LedgerEntry.Account.GUARDIAN_FUNDS,
        direction=LedgerEntry.Direction.DEBIT,
        currency=Currency.EUR,
    )
    fees_eur = _ledger_sum(
        ledger_tx,
        account=LedgerEntry.Account.PSP_FEES,
        direction=LedgerEntry.Direction.CREDIT,
        currency=Currency.EUR,
    )
    amount_kmf_received = _ledger_sum(
        ledger_tx,
        account=LedgerEntry.Account.DUE_TO_CENTER,
        direction=LedgerEntry.Direction.CREDIT,
        currency=Currency.KMF,
    )
    if (
        amount_eur_paid != intent.amount_eur
        or amount_kmf_received != intent.amount_kmf
    ):
        raise ValidationError(
            "Clôture refusée : les montants du ledger ne correspondent pas à "
            "l'intention de paiement (réconciliation impossible)."
        )
    receipt = Receipt.issue(
        payment_request=payment_request,
        center=payment_request.invoice.center,
        ledger_transaction=ledger_tx,
        amount_eur_paid=amount_eur_paid,
        amount_kmf_received=amount_kmf_received,
        fees_eur=fees_eur,
        exchange_rate=intent.exchange_rate,
    )
    _set_status(payment_request, Status.CLOSED)
    audit(
        actor=actor, action=AuditAction.PAYMENT_REQUEST_CLOSED,
        target=payment_request,
        payment_request_id=payment_request.pk, receipt_id=receipt.pk,
        receipt_number=receipt.sequence_number,
        center_id=receipt.center_id, ledger_transaction_id=ledger_tx.pk,
        amount_eur=receipt.amount_eur_paid, fees_eur=receipt.fees_eur,
        amount_kmf=receipt.amount_kmf_received,
        exchange_rate=receipt.exchange_rate,
        currency_paid=str(Currency.EUR), currency_received=str(Currency.KMF),
    )
    # Événement 6 (notifications métier) : SMS au tuteur payeur (celui de
    # l'intent abouti dont le ledger vient d'être réconcilié).
    notifications.notify_receipt_issued(receipt, intent.guardian)
    return receipt


# ---------------------------------------------------------------------------
# Disputes — mandatory reason, staff resolution restoring the prior status
# ---------------------------------------------------------------------------


@transaction.atomic
def open_dispute(*, actor_user, payment_request, reason):
    """envoyee|payee → litige, by the PAYING SIDE (a shared guardian) or
    the patient. The reason is mandatory; the pre-dispute status is stored
    so resolution can restore it."""
    if not (reason or "").strip():
        raise ValidationError("Le motif du litige est obligatoire.")
    payment_request = _locked(payment_request)
    is_patient = (
        payment_request.invoice.patient.user_id is not None
        and payment_request.invoice.patient.user_id == actor_user.pk
    )
    is_shared_guardian = (
        _shared_active_link_for(payment_request, actor_user) is not None
    )
    if not (is_patient or is_shared_guardian):
        raise ValidationError(
            "Seuls le patient ou un tuteur destinataire de la demande "
            "peuvent ouvrir un litige."
        )
    previous_status = payment_request.status
    _set_status(payment_request, Status.DISPUTED)  # refuses outside envoyee|payee
    dispute = Dispute.objects.create(
        payment_request=payment_request,
        opened_by=actor_user,
        reason=reason.strip(),
        previous_status=previous_status,
    )
    audit(
        actor=actor_user, action=AuditAction.DISPUTE_OPENED, target=dispute,
        dispute_id=dispute.pk, payment_request_id=payment_request.pk,
        previous_status=previous_status,
        opened_as="patient" if is_patient else "tuteur",
    )
    return dispute


@transaction.atomic
def resolve_dispute(*, actor, dispute, resolution_note):
    """Staff resolves with a mandatory motive; the request returns to its
    pre-dispute status (the only exits from ``litige``)."""
    if not (resolution_note or "").strip():
        raise ValidationError("Le motif de résolution est obligatoire.")
    if dispute.status != Dispute.Status.OPEN:
        raise ValidationError("Ce litige est déjà résolu.")
    payment_request = _locked(dispute.payment_request)
    dispute.status = Dispute.Status.RESOLVED
    dispute.resolved_by = actor
    dispute.resolution_note = resolution_note.strip()
    dispute.resolved_at = timezone.now()
    dispute.save(
        update_fields=[
            "status", "resolved_by", "resolution_note", "resolved_at", "updated_at",
        ]
    )
    _set_status(payment_request, dispute.previous_status)
    audit(
        actor=actor, action=AuditAction.DISPUTE_RESOLVED, target=dispute,
        dispute_id=dispute.pk, payment_request_id=payment_request.pk,
        restored_status=dispute.previous_status,
    )
    return dispute


# ---------------------------------------------------------------------------
# Hygiene — zombie intents purge (ADR 0009 addendum, point 3)
# ---------------------------------------------------------------------------


def cancel_stale_intents():
    """Cancel abandoned ``cree``/``en_cours`` intents older than
    ``PSP_INTENT_STALE_HOURS`` (env, default 24 h; boot-guarded >= 1).

    Why: an intent whose 3DS was never completed (tab closed, card put
    away) stays ``en_cours`` forever. The anti-double-débit guard already
    stops considering it after ``PSP_INTENT_GUARD_MINUTES`` (the request
    becomes payable again), but the row itself must eventually reach a
    terminal state — an eternal ``en_cours`` pollutes reconciliation and
    keeps a confirmable payment hanging at the provider.

    Concurrency: each intent is re-read and re-checked UNDER ROW LOCK in
    its own transaction (never a raw ``update()``). A webhook landing at
    the same moment either wins the lock first — the intent is no longer
    pending and is skipped here — or arrives after the cancellation and is
    refused by :func:`register_payment_success` (an ``annule`` intent can
    never cash in; the money stays a provider-side reconciliation case,
    limite documentée de l'ADR 0009).

    When ``psp/stripe.py`` exists, this purge MUST ALSO cancel the intent
    on the provider side (``payment_intent.cancel`` — exigence actée à
    l'addendum ADR 0009) : l'annulation locale seule laisse un client
    secret Stripe confirmable pendant des heures. The Fake PSP holds no
    provider-side state, so there is nothing to cancel remotely yet.

    Returns the number of intents cancelled (surfaced in worker logs via
    the Celery task result).
    """
    pending_statuses = (
        PaymentIntent.Status.CREATED,
        PaymentIntent.Status.PROCESSING,
    )
    threshold = timezone.now() - timedelta(
        hours=settings.PSP_INTENT_STALE_HOURS
    )
    stale_pks = list(
        PaymentIntent.objects.filter(
            status__in=pending_statuses, created_at__lt=threshold
        ).values_list("pk", flat=True)
    )
    cancelled = 0
    for pk in stale_pks:
        with transaction.atomic():
            intent = PaymentIntent.objects.select_for_update().get(pk=pk)
            if intent.status not in pending_statuses:
                continue  # settled by a concurrent webhook — leave it alone
            intent.status = PaymentIntent.Status.CANCELLED
            intent.save(update_fields=["status", "updated_at"])
            audit(
                actor=None, action=AuditAction.PAYMENT_INTENT_CANCELLED,
                target=intent,
                intent_id=intent.pk,
                payment_request_id=intent.payment_request_id,
                reason="stale",
            )
            cancelled += 1
    return cancelled
