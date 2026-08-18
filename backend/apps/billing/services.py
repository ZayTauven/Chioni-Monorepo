"""Subscription services — the ONLY write path (S5, ADR 0018).

Same discipline as every other sensitive domain of the project: the views
never touch the ORM, the services replay ``save()``, take the row locks
that make a decision meaningful under concurrency, and journalise their
audit entry inside the same transaction.

Audit contract (ADR 0007, tightened by ADR 0018 invariant 7): references,
status codes and amounts only. **The motive of a suspension NEVER enters a
payload** — it lives on the ``CenterSubscription`` row (same rule as
``kyc_reason``, ``Invoice.cancel_reason`` and a dispute reason), and only
``has_reason`` is journalised.
"""

import calendar
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import (
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.billing.models import (
    FROZEN_SUBSCRIPTION_STATUSES,
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionInvoiceCounter,
    SubscriptionPayment,
    SubscriptionPaymentReversal,
    SubscriptionPlan,
)
from apps.centers.models import StaffMembership
from apps.common.money import validate_kmf_integral
from apps.common.notifications import (
    center_director_phones,
    notify_subscription_invoice_reminder,
)
from apps.common.roles import CLINICAL_ROLES

logger = logging.getLogger("chioni.billing")

Status = CenterSubscription.Status
InvoiceStatus = SubscriptionInvoice.Status

#: The subscription state machine, explicit and closed (patron
#: ``KYC_TRANSITIONS`` — which is NOT touched: the two axes are
#: independent, ADR 0018 décision 2).
#:
#: Reading it aloud: a trial converts, lapses or stops; an active
#: subscription can fall behind (``impaye``), be frozen or be terminated;
#: an unpaid one is regularised, frozen when the grace runs out, or
#: terminated; a frozen one comes back (``actif``) — or comes back still
#: owing (``impaye``, e.g. a partial payment lifting the freeze) — or is
#: terminated; a terminated one can only be revived by a new signature.
SUBSCRIPTION_TRANSITIONS = {
    Status.TRIAL: {Status.ACTIVE, Status.UNPAID, Status.SUSPENDED,
                   Status.TERMINATED},
    Status.ACTIVE: {Status.UNPAID, Status.SUSPENDED, Status.TERMINATED},
    Status.UNPAID: {Status.ACTIVE, Status.SUSPENDED, Status.TERMINATED},
    Status.SUSPENDED: {Status.ACTIVE, Status.UNPAID, Status.TERMINATED},
    Status.TERMINATED: {Status.ACTIVE},
}

#: A subscription is BORN alive: sanctions go through the audited state
#: machine below, never through a creation form.
SUBSCRIPTION_INITIAL_STATUSES = frozenset({Status.TRIAL, Status.ACTIVE})


# ---------------------------------------------------------------------------
# Plans — the commercial offer (platform ``admin`` only)
# ---------------------------------------------------------------------------


def _require_strictly_positive_price(fields):
    """Refus explicite d'un prix d'offre ≤ 0 (SV).

    La contrainte DB ``subscription_plan_price_positive`` n'exclut que le
    NÉGATIF (``price_kmf >= 0``) : une offre repricée à 0 KMF passerait la
    base et arrêterait silencieusement la facturation de tous ses abonnés
    (chaque période émettrait une facture à 0, soldée d'office). Le
    serializer amont (``PlatformSubscriptionPlanWriteSerializer``) n'a pas
    de ``min_value`` : la garde vit ICI, dans le service, qui porte LE
    message — la contrainte reste le filet contre l'ORM brut.
    """
    price = fields.get("price_kmf")
    if price is not None and Decimal(price) <= 0:
        raise ValidationError(
            "Le prix d'une offre doit être strictement positif : une offre "
            "à 0 KMF arrêterait silencieusement la facturation des centres "
            "abonnés."
        )


@transaction.atomic
def create_plan(*, actor, **fields):
    """Create a commercial offer. ``code`` is unique across the platform."""
    code = (fields.get("code") or "").strip()
    if not code:
        raise ValidationError("Le code de l'offre est obligatoire.")
    fields["code"] = code
    if SubscriptionPlan.objects.filter(code=code).exists():
        raise ValidationError("Ce code d'offre existe déjà.")
    _require_strictly_positive_price(fields)
    plan = SubscriptionPlan.objects.create(**fields)
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_PLAN_CREATED, target=plan,
        plan_id=plan.pk, code=plan.code, price_kmf=plan.price_kmf,
        billing_period=plan.billing_period,
    )
    return plan


@transaction.atomic
def update_plan(*, actor, plan, **fields):
    """Update an offer — NEVER retroactively.

    A price change applies to what is billed FROM NOW ON: the SaaS
    invoices of lot 2 carry their own frozen amount, so no past receivable
    is rewritten by this call (ADR 0018 décision 3). Retiring an offer is
    ``is_active=False`` — a plan referenced by a live subscription is
    never deleted (``PROTECT``).
    """
    new_code = (fields.get("code") or "").strip() or None
    if new_code and new_code != plan.code:
        if SubscriptionPlan.objects.filter(code=new_code).exclude(
            pk=plan.pk
        ).exists():
            raise ValidationError("Ce code d'offre existe déjà.")
        fields["code"] = new_code
    _require_strictly_positive_price(fields)
    for name, value in fields.items():
        setattr(plan, name, value)
    plan.save()
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_PLAN_UPDATED, target=plan,
        plan_id=plan.pk, code=plan.code, price_kmf=plan.price_kmf,
        billing_period=plan.billing_period,
        fields=",".join(sorted(fields)),
    )
    return plan


# ---------------------------------------------------------------------------
# Subscriptions — one contract per tenant (platform ``admin`` only)
# ---------------------------------------------------------------------------


@transaction.atomic
def create_subscription(
    *, actor, center, plan, status=Status.TRIAL, started_at=None,
    current_period_end=None,
):
    """Open the subscription of a center (one per tenant).

    Born ``essai`` or ``actif`` only: a contract that could be created
    already ``suspendu`` would freeze a tenant WITHOUT passing through the
    audited transition — and without the mandatory motive the director
    needs to know what to fix.
    """
    if status not in SUBSCRIPTION_INITIAL_STATUSES:
        raise ValidationError(
            "Un abonnement s'ouvre en « Essai » ou « Actif » : les autres "
            "statuts sont des décisions, prises depuis le changement de "
            "statut (avec leur motif)."
        )
    if CenterSubscription.objects.filter(center=center).exists():
        raise ValidationError("Ce centre a déjà un abonnement.")
    if not plan.is_active:
        raise ValidationError(
            "Cette offre n'est plus proposée : choisissez une offre active."
        )
    # The ``exists()`` above is the message, the OneToOne is the guard —
    # and the guard must not answer 500. Two operators opening the same
    # tenant's contract at once are serialised by the unique index; the
    # loser's INSERT is rolled back to this savepoint and comes out as the
    # same French 400 as the sequential case.
    #
    # Deliberately NOT a lock on the ``HealthCenter`` row: that row is the
    # serialisation point of ``Receipt.issue()`` (ADR 0003), and the ADR
    # 0018 warns explicitly against making the SaaS registry contend with
    # the care receipts.
    try:
        with transaction.atomic():
            subscription = CenterSubscription.objects.create(
                center=center,
                plan=plan,
                status=status,
                started_at=started_at or timezone.localdate(),
                current_period_end=current_period_end,
            )
    except IntegrityError:
        raise ValidationError("Ce centre a déjà un abonnement.")
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_CREATED,
        target=subscription, center=center,
        subscription_id=subscription.pk, center_id=center.pk,
        plan_id=plan.pk, plan_code=plan.code, status=subscription.status,
    )
    return subscription


@transaction.atomic
def change_subscription_plan(*, actor, subscription, plan):
    """Move a tenant to another offer (upsell, downsell, renegotiation).

    Nothing already billed changes: the plan is a REFERENCE, the SaaS
    invoices of lot 2 carry their own amount.
    """
    subscription = _locked(subscription)
    if plan.pk == subscription.plan_id:
        raise ValidationError("Ce centre est déjà sur cette offre.")
    if not plan.is_active:
        raise ValidationError(
            "Cette offre n'est plus proposée : choisissez une offre active."
        )
    old_plan_id = subscription.plan_id
    subscription.plan = plan
    subscription.save(update_fields=["plan", "updated_at"])
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_PLAN_CHANGED,
        target=subscription, center=subscription.center,
        subscription_id=subscription.pk, center_id=subscription.center_id,
        old_plan_id=old_plan_id, plan_id=plan.pk, plan_code=plan.code,
    )
    return subscription


@transaction.atomic
def set_subscription_status(*, actor, subscription, status, reason=""):
    """THE only path to a subscription transition (platform ``admin``).

    Patron ``set_center_kyc_status`` down to its refusals:

    - explicit, closed state machine (:data:`SUBSCRIPTION_TRANSITIONS`) —
      an impossible move is refused in French, never applied silently;
    - the row is LOCKED, so two operators clicking at once serialise (the
      second re-reads the committed status and either no-ops-refuses or
      applies a legal transition);
    - ``reason`` is MANDATORY to freeze (``suspendu``/``resilie``):
      cutting a center's administration without a written motive would
      leave its director with nothing to act on. It is stored ON THE ROW
      and never journalised.
    """
    if status not in Status.values:
        raise ValidationError("Statut d'abonnement inconnu.")
    subscription = _locked(subscription)
    previous = subscription.status
    if status == previous:
        raise ValidationError(
            f"Cet abonnement est déjà « {Status(status).label} »."
        )
    if status not in SUBSCRIPTION_TRANSITIONS.get(previous, set()):
        raise ValidationError(
            f"Transition refusée : un abonnement « {Status(previous).label} » "
            f"ne peut pas passer à « {Status(status).label} »."
        )
    reason = (reason or "").strip()
    if status in FROZEN_SUBSCRIPTION_STATUSES and not reason:
        raise ValidationError(
            "Le motif est obligatoire pour suspendre ou résilier un "
            "abonnement : le directeur du centre doit savoir ce qu'il doit "
            "régulariser."
        )
    subscription.status = status
    subscription.status_reason = reason
    subscription.status_updated_at = timezone.now()
    subscription.status_updated_by = actor
    subscription.save(
        update_fields=[
            "status", "status_reason", "status_updated_at",
            "status_updated_by", "updated_at",
        ]
    )
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_STATUS_CHANGED,
        target=subscription, center=subscription.center,
        subscription_id=subscription.pk, center_id=subscription.center_id,
        old_status=previous, status=status, has_reason=bool(reason),
    )
    return subscription


def _locked(subscription):
    """Re-read the row under ``FOR UPDATE`` — transitions are races."""
    return CenterSubscription.objects.select_for_update().get(
        pk=subscription.pk
    )


# ---------------------------------------------------------------------------
# Quotas — measured, displayed, alerted… and NEVER opposed
# ---------------------------------------------------------------------------


def _quota_report(*, staff, practitioners, plan):
    """Compare counted seats to a plan's quotas — THE single comparison.

    Both readings of usage (the per-center aggregate below and the SQL
    annotations of the back-office list) end here, so « over quota » can
    never mean two different things in two screens. ``None`` = unlimited.
    """
    exceeded = [
        name
        for name, used, included in (
            ("staff", staff, plan.included_staff),
            ("practitioners", practitioners, plan.included_practitioners),
        )
        if included is not None and used > included
    ]
    return {
        "staff": staff,
        "practitioners": practitioners,
        "included_staff": plan.included_staff,
        "included_practitioners": plan.included_practitioners,
        "exceeded": sorted(exceeded),
        "over_quota": bool(exceeded),
    }


def annotate_subscription_usage(queryset):
    """Annotate a ``CenterSubscription`` queryset with its seat counts.

    The mass reading (back-office list): pure SQL, no per-row query — the
    patron of ``unpaid_invoices_qs`` (ADR 0015 addendum 2b), including its
    obligation: a test locks row-by-row agreement between this annotation
    and :func:`subscription_usage`.
    """
    active = Q(center__staff_memberships__is_active=True)
    return queryset.annotate(
        staff_seat_count=Count(
            "center__staff_memberships__user", filter=active, distinct=True
        ),
        practitioner_seat_count=Count(
            "center__staff_memberships__user",
            filter=active & Q(center__staff_memberships__role__in=CLINICAL_ROLES),
            distinct=True,
        ),
    )


def usage_from_annotations(subscription):
    """Quota report of a row annotated by :func:`annotate_subscription_usage`."""
    return _quota_report(
        staff=subscription.staff_seat_count,
        practitioners=subscription.practitioner_seat_count,
        plan=subscription.plan,
    )


def subscription_usage(center):
    """Real usage of a center against its plan's quotas (décision 3).

    **Read-only, and nothing in the product calls it to refuse anything.**
    No business service imports this function — locked by a structural
    test — because blocking a patient record over a plan would mean
    refusing care for an accounting reason (arbitrage PO n° 3). A center
    over quota registers patients, hires and opens consultations exactly
    like any other; Chioni sees the overage and calls its client.

    Counting rule: a PERSON is one seat, even with two hats (ADR 0001 —
    roles cumulate; a nurse who is also a cashier is one salary, not two).
    Hence ``Count(user_id, distinct=True)``, one grouped query for both
    figures. ``None`` quota = unlimited, never « exceeded ».

    Returns ``None`` when the center has no subscription — there is
    nothing to compare against, and pretending otherwise would invent a
    contract.
    """
    subscription = (
        CenterSubscription.objects.filter(center_id=center.pk)
        .select_related("plan")
        .first()
    )
    if subscription is None:
        return None
    counts = (
        StaffMembership.objects.for_center(center)
        .filter(is_active=True)
        .aggregate(
            staff=Count("user_id", distinct=True),
            practitioners=Count(
                "user_id", distinct=True, filter=Q(role__in=CLINICAL_ROLES)
            ),
        )
    )
    return _quota_report(
        staff=counts["staff"],
        practitioners=counts["practitioners"],
        plan=subscription.plan,
    )


# ===========================================================================
# Facturation SaaS Chioni → centre (S5 lot 2, ADR 0018 décision 4)
# ===========================================================================
#
# Le patron est celui de la CAISSE (ADR 0015), repris tel quel là où il a
# du sens : règlement append-only, contre-passation motivée comme seule
# correction, **solde DÉRIVÉ** (jamais un champ « reste dû » mutable), tout
# sous le verrou de la ligne facture — LE point de sérialisation.
#
# Ce qu'il n'emprunte PAS, et c'est la décision 1 de l'ADR : **aucune
# écriture du ledger des soins**. Pas de ``LedgerTransaction``, pas de
# ``LedgerEntry``, pas de ``Receipt``, pas de ``CashPayment``. Un test
# structurel interdit à ce module d'importer quoi que ce soit de
# ``apps.trustbridge``.
#
# HIÉRARCHIE DES VERROUS de ce registre — à respecter par toute écriture
# future, comme la hiérarchie intent → demande → facture → centre du rail
# diaspora (correctif guardian S1) :
#
#     facture d'abonnement → abonnement → compteur de la série « A- »
#
# L'émission prend (abonnement, compteur) ; un règlement, une
# contre-passation et une annulation prennent (facture, abonnement). Aucun
# cycle. Et **jamais la ligne ``HealthCenter``** : elle sérialise
# ``Receipt.issue()`` et ``CashReceipt.issue()`` — la trésorerie de
# l'éditeur ne doit pas faire attendre le reçu d'un patient au comptoir.

#: Les seuls statuts qu'on facture. ``essai`` ne se facture pas (c'est un
#: essai) ; ``suspendu`` et ``resilie`` non plus — **on n'accumule pas de
#: dette sur ce qu'on a gelé**. Reprendre le service, c'est réactiver le
#: contrat, et la période suivante repart. RÉVERSIBLE.
BILLABLE_SUBSCRIPTION_STATUSES = frozenset({Status.ACTIVE, Status.UNPAID})

#: Les DEUX seules transitions automatiques du produit : ``actif → impaye``
#: quand une échéance passe sans règlement, et le retour ``impaye → actif``
#: dès qu'il n'y a plus rien d'échu. **``suspendu`` n'est JAMAIS
#: automatique** (ADR 0018 : c'est une sanction, elle se décide, se motive
#: et s'audite — un centre qui a payé par virement non encore saisi ne doit
#: pas être gelé par une tâche de nuit).
AUTOMATIC_UNPAID_REASON = (
    "Une facture d'abonnement est arrivée à échéance sans être réglée. "
    "Rien n'est fermé : régularisez ou contactez Chioni."
)

#: Cadence des relances SMS, en jours APRÈS l'échéance (ADR 0012 étendu) :
#: le jour même, une semaine après, trois semaines après — puis silence.
#: Trois messages, espacés de plus en plus : un virement met des jours à
#: arriver aux Comores, et au quatrième SMS ce n'est plus une relance, c'est
#: du harcèlement — à ce stade c'est un appel de Chioni qui règle l'affaire.
SUBSCRIPTION_REMINDER_OFFSETS_DAYS = (0, 7, 21)

#: Rattrapage borné : un tenant oublié pendant un an ne déclenche pas une
#: émission infinie. Au-delà, un humain regarde le dossier.
MAX_CATCHUP_PERIODS = 12

#: Output field of the KMF aggregate annotations (patron ``unpaid_invoices_qs``).
_KMF_FIELD = DecimalField(max_digits=12, decimal_places=2)


# ---------------------------------------------------------------------------
# Périodes de facturation
# ---------------------------------------------------------------------------


def _add_months(day: date, months: int) -> date:
    """``day`` + ``months``, en bornant au dernier jour du mois cible.

    31 janvier + 1 mois = 28 (ou 29) février. Conséquence assumée et
    documentée : un abonnement démarré un 31 dérive vers le 28 et n'y
    revient pas (conserver l'ancre demanderait un champ de plus pour un
    bénéfice nul au MVP).
    """
    index = day.month - 1 + months
    year = day.year + index // 12
    month = index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def _period_end(start: date, billing_period: str) -> date:
    """Dernier jour INCLUS de la période commencée le ``start``."""
    months = 12 if billing_period == SubscriptionPlan.BillingPeriod.ANNUAL else 1
    return _add_months(start, months) - timedelta(days=1)


def next_billing_period(subscription):
    """La prochaine période à facturer — ``(début, fin incluse)``.

    Jamais facturé (``current_period_end`` vide) → la première période part
    de la date de souscription. Sinon elle part du lendemain de la période
    en cours : les périodes se suivent sans trou ni chevauchement, et
    ``current_period_end`` est l'unique curseur (entretenu par l'émission).
    """
    if subscription.current_period_end is None:
        start = subscription.started_at
    else:
        start = subscription.current_period_end + timedelta(days=1)
    return start, _period_end(start, subscription.plan.billing_period)


# ---------------------------------------------------------------------------
# Numérotation « A- » : globale, contiguë, sans jamais verrouiller un centre
# ---------------------------------------------------------------------------


def _next_sequence_number():
    """Réserve le numéro suivant de la série « A- » — race-safe.

    Le compteur est UNE ligne dédiée, verrouillée ``FOR UPDATE`` le temps de
    l'émission. Trois propriétés, chacune une décision :

    1. **Aucun verrou sur ``HealthCenter``** — proscrit par la décision 4 de
       l'ADR : cette ligne sérialise ``Receipt.issue()`` et
       ``CashReceipt.issue()``, et la facturation de l'éditeur n'a pas à
       entrer en contention avec le reçu d'un patient au guichet.
    2. **Série contiguë** — une ``SEQUENCE`` PostgreSQL (``nextval()``, non
       transactionnelle) brûlerait un numéro à chaque rollback : un trou
       dans une série de factures ressemble à une facture disparue
       (l'argument même qui a séparé les séries « G- » et diaspora,
       ADR 0015 §6). Ici le rollback rend le numéro.
    3. **Ligne créée à la volée**, jamais par une migration de données :
       ``TransactionTestCase`` vide les tables entre deux tests, et une
       numérotation qui dépendrait d'une ligne semée serait un piège.

    Coût assumé : l'émission des factures SaaS est sérialisée globalement.
    C'est une poignée d'écritures par mois, faites par une tâche planifiée.
    """
    counter = (
        SubscriptionInvoiceCounter.objects.select_for_update()
        .filter(pk=SubscriptionInvoiceCounter.SINGLETON_PK)
        .first()
    )
    if counter is None:
        try:
            with transaction.atomic():
                SubscriptionInvoiceCounter.objects.create(
                    pk=SubscriptionInvoiceCounter.SINGLETON_PK, last_number=0
                )
        except IntegrityError:
            pass  # une transaction concurrente l'a créée : on relit sous verrou
        counter = SubscriptionInvoiceCounter.objects.select_for_update().get(
            pk=SubscriptionInvoiceCounter.SINGLETON_PK
        )
    counter.last_number += 1
    counter.save(update_fields=["last_number"])
    return counter.last_number


# ---------------------------------------------------------------------------
# Solde : dérivé, jamais stocké (patron ADR 0015)
# ---------------------------------------------------------------------------


def subscription_invoice_paid_kmf(invoice):
    """KMF déjà encaissés sur cette facture, contre-passations exclues."""
    total = SubscriptionPayment.objects.filter(
        invoice=invoice, reversal__isnull=True
    ).aggregate(s=Sum("amount_kmf"))["s"]
    return total or Decimal("0")


def subscription_invoice_balance_kmf(invoice):
    """Solde restant (KMF) — LA dérivation : montant figé − règlements non
    contre-passés. Aucun champ mutable « reste dû » n'existe."""
    return invoice.amount_kmf - subscription_invoice_paid_kmf(invoice)


def annotate_subscription_invoice_balance(queryset):
    """Annote ``paid_kmf_agg`` et ``balance_kmf_agg`` en SQL pur.

    Miroir ensembliste de :func:`subscription_invoice_balance_kmf` (patron
    ``unpaid_invoices_qs``, ADR 0015 addendum 2b) : toute lecture de masse
    passe par ici, jamais par un appel de solde par ligne (N+1). Un test
    verrouille leur accord ligne à ligne.
    """
    paid_per_invoice = (
        SubscriptionPayment.objects.filter(
            invoice=OuterRef("pk"), reversal__isnull=True
        )
        .order_by()
        .values("invoice")
        .annotate(s=Sum("amount_kmf"))
        .values("s")
    )
    return queryset.annotate(
        paid_kmf_agg=Coalesce(
            Subquery(paid_per_invoice, output_field=_KMF_FIELD),
            Value(Decimal("0"), output_field=_KMF_FIELD),
        )
    ).annotate(
        balance_kmf_agg=ExpressionWrapper(
            F("amount_kmf") - F("paid_kmf_agg"), output_field=_KMF_FIELD
        )
    )


def unpaid_subscription_invoices_qs():
    """Factures d'abonnement ÉMISES au solde positif — tous tenants.

    Photo à l'instant T, jamais bornée par une fenêtre : c'est la créance
    de Chioni. Les factures annulées et soldées en sortent par construction.
    """
    return annotate_subscription_invoice_balance(
        SubscriptionInvoice.objects.filter(status=InvoiceStatus.ISSUED)
    ).filter(balance_kmf_agg__gt=0)


def overdue_subscription_invoices_qs(*, today=None):
    """Factures échues NON réglées — ``due_date`` STRICTEMENT dépassée.

    Le jour de l'échéance ne compte pas comme un retard : un règlement peut
    arriver dans la journée. C'est aussi ce qui distingue la relance J+0
    (« arrive à échéance aujourd'hui ») du passage en « impayé ».
    """
    today = today or timezone.localdate()
    return unpaid_subscription_invoices_qs().filter(due_date__lt=today)


def _locked_invoice(invoice):
    """Relit la facture sous verrou de ligne — LE point de sérialisation
    (deux règlements concurrents, règlement vs contre-passation, annulation
    vs règlement)."""
    return SubscriptionInvoice.objects.select_for_update().get(pk=invoice.pk)


# ---------------------------------------------------------------------------
# Transitions automatiques actif ⇄ impaye (jamais suspendu)
# ---------------------------------------------------------------------------


def _sync_subscription_payment_status(subscription, *, actor=None, today=None):
    """Aligne le statut de l'abonnement sur la réalité des échéances.

    LE seul endroit du produit qui bouge un statut sans décision humaine, et
    son périmètre est volontairement minuscule :

    - ``actif`` + au moins une facture échue non réglée → ``impaye``
      (état d'ALERTE : la garde de gel ne le connaît pas, rien ne ferme) ;
    - ``impaye`` + plus rien d'échu → ``actif``, motif effacé.

    Tout le reste est laissé tel quel — un ``essai``, un ``suspendu`` ou un
    ``resilie`` ne bougent JAMAIS ici : lever un gel est une décision
    commerciale, et geler encore davantage.

    Retourne le nouveau statut si une transition a eu lieu, ``None`` sinon.
    Appelé DANS la transaction de l'écriture qui change le solde (règlement,
    contre-passation, annulation) et par la tâche quotidienne.
    """
    today = today or timezone.localdate()
    subscription = _locked(subscription)
    has_overdue = (
        overdue_subscription_invoices_qs(today=today)
        .filter(subscription_id=subscription.pk)
        .exists()
    )
    if has_overdue and subscription.status == Status.ACTIVE:
        target, reason = Status.UNPAID, AUTOMATIC_UNPAID_REASON
    elif not has_overdue and subscription.status == Status.UNPAID:
        target, reason = Status.ACTIVE, ""
    else:
        return None
    previous = subscription.status
    subscription.status = target
    subscription.status_reason = reason
    subscription.status_updated_at = timezone.now()
    subscription.status_updated_by = actor
    subscription.save(
        update_fields=[
            "status", "status_reason", "status_updated_at",
            "status_updated_by", "updated_at",
        ]
    )
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_STATUS_CHANGED,
        target=subscription, center=subscription.center,
        subscription_id=subscription.pk, center_id=subscription.center_id,
        old_status=previous, status=target, has_reason=bool(reason),
        automatic=True,
    )
    return target


# ---------------------------------------------------------------------------
# Émission
# ---------------------------------------------------------------------------


@transaction.atomic
def issue_subscription_invoice(*, actor, subscription, today=None):
    """Émet la facture de la PROCHAINE période due — seul chemin d'écriture.

    Ordre des verrous : abonnement (curseur de période) puis compteur de la
    série. Deux appels concurrents sur le même tenant sérialisent sur
    l'abonnement ; le second recalcule la période APRÈS le commit du premier
    et se voit refuser (« pas encore arrivée à terme »). L'index unique
    ``(subscription, period_start)`` sur les factures VIVANTES est le dernier
    arbitre — et il rend le MÊME 400 français que le contrôle applicatif.

    Le montant, le code et le nom de l'offre sont SNAPSHOTÉS : reprice
    l'offre demain ne réécrit pas un franc de ce qui a été réclamé.
    """
    today = today or timezone.localdate()
    subscription = _locked(subscription)
    plan = subscription.plan
    if subscription.status not in BILLABLE_SUBSCRIPTION_STATUSES:
        raise ValidationError(
            f"Un abonnement « {Status(subscription.status).label} » n'est pas "
            "facturé : seuls les contrats actifs ou impayés le sont."
        )
    if plan.price_kmf <= 0:
        raise ValidationError(
            f"L'offre « {plan.name} » est à 0 KMF : il n'y a rien à facturer."
        )
    period_start, period_end = next_billing_period(subscription)
    if period_start > today:
        raise ValidationError(
            "La période en cours n'est pas encore arrivée à terme : la "
            f"prochaine facture couvre la période démarrant le {period_start}."
        )
    invoice = SubscriptionInvoice(
        center_id=subscription.center_id,
        subscription=subscription,
        sequence_number=_next_sequence_number(),
        period_start=period_start,
        period_end=period_end,
        amount_kmf=plan.price_kmf,
        plan_code=plan.code,
        plan_label=plan.name,
        due_date=period_start + timedelta(
            days=settings.SUBSCRIPTION_INVOICE_DUE_DAYS
        ),
        status=InvoiceStatus.ISSUED,
        issued_by=actor,
    )
    try:
        with transaction.atomic():
            invoice.save()
    except IntegrityError:
        raise ValidationError("Cette période est déjà facturée.")
    subscription.current_period_end = period_end
    subscription.save(update_fields=["current_period_end", "updated_at"])
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_INVOICE_ISSUED,
        target=invoice, center=subscription.center,
        subscription_invoice_id=invoice.pk, subscription_id=subscription.pk,
        center_id=subscription.center_id, number=invoice.number,
        amount_kmf=invoice.amount_kmf, currency="KMF",
        plan_code=invoice.plan_code,
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        due_date=invoice.due_date.isoformat(),
        automatic=actor is None,
    )
    return invoice


# ---------------------------------------------------------------------------
# Règlements reçus (append-only) et leur contre-passation
# ---------------------------------------------------------------------------


@transaction.atomic
def record_subscription_payment(
    *, actor, invoice, amount_kmf, method, reference="", received_at=None
):
    """Enregistre un règlement REÇU par Chioni — patron ``record_cash_payment``.

    Sous le verrou de la ligne facture : contrôle du solde (un règlement ne
    dépasse JAMAIS le reste dû), ligne append-only, facture ``payee`` quand
    le solde tombe à zéro, retour automatique ``impaye → actif`` s'il ne
    reste plus rien d'échu, audit. Règlements partiels admis — c'est la
    réalité d'un centre comorien qui paie en deux virements.
    """
    today = timezone.localdate()
    received_at = received_at or today
    if received_at > today:
        raise ValidationError(
            "La date de réception ne peut pas être dans le futur."
        )
    if method not in SubscriptionPayment.Method.values:
        raise ValidationError("Moyen de règlement inconnu.")
    amount_kmf = Decimal(amount_kmf)
    if amount_kmf <= 0:
        raise ValidationError("Le montant réglé doit être > 0 KMF.")
    validate_kmf_integral(amount_kmf)
    invoice = _locked_invoice(invoice)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationError("Cette facture d'abonnement est annulée.")
    if invoice.status == InvoiceStatus.PAID:
        raise ValidationError("Cette facture d'abonnement est déjà réglée.")
    balance = subscription_invoice_balance_kmf(invoice)
    if amount_kmf > balance:
        raise ValidationError(
            f"Règlement refusé : le montant ({amount_kmf} KMF) dépasse le "
            f"solde restant de la facture ({balance} KMF)."
        )
    payment = SubscriptionPayment(
        invoice=invoice,
        amount_kmf=amount_kmf,
        method=method,
        reference=(reference or "").strip(),
        received_at=received_at,
        recorded_by=actor,
    )
    payment.save()
    new_balance = balance - amount_kmf
    if new_balance == 0:
        invoice.status = InvoiceStatus.PAID
        invoice.save(update_fields=["status", "updated_at"])
    status_after = _sync_subscription_payment_status(
        invoice.subscription, actor=actor, today=today
    )
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_PAYMENT_RECORDED,
        target=payment, center=invoice.center,
        subscription_payment_id=payment.pk, subscription_invoice_id=invoice.pk,
        subscription_id=invoice.subscription_id, center_id=invoice.center_id,
        number=invoice.number, method=str(method),
        amount_kmf=amount_kmf, balance_after_kmf=new_balance, currency="KMF",
        invoice_status_after=invoice.status,
        subscription_status_after=status_after,
    )
    return payment


@transaction.atomic
def reverse_subscription_payment(*, actor, payment, reason):
    """LA seule correction d'un règlement (patron ``reverse_cash_payment``).

    Contre-passer rouvre le solde et fait revenir une facture ``payee`` à
    ``emise`` : l'argent est de nouveau dû et la facture le dit. Si
    l'échéance est déjà passée, l'abonnement redevient ``impaye`` — la même
    synchronisation que partout ailleurs, jamais une règle parallèle.
    """
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError("Le motif de la contre-passation est obligatoire.")
    invoice = _locked_invoice(payment.invoice)
    if SubscriptionPaymentReversal.objects.filter(payment=payment).exists():
        raise ValidationError("Ce règlement a déjà été contre-passé.")
    reversal = SubscriptionPaymentReversal(
        payment=payment, reason=reason, reversed_by=actor
    )
    reversal.save()
    new_balance = subscription_invoice_balance_kmf(invoice)
    if invoice.status == InvoiceStatus.PAID and new_balance > 0:
        invoice.status = InvoiceStatus.ISSUED
        invoice.save(update_fields=["status", "updated_at"])
    status_after = _sync_subscription_payment_status(
        invoice.subscription, actor=actor
    )
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_PAYMENT_REVERSED,
        target=reversal, center=invoice.center,
        subscription_payment_id=payment.pk, reversal_id=reversal.pk,
        subscription_invoice_id=invoice.pk,
        subscription_id=invoice.subscription_id, center_id=invoice.center_id,
        number=invoice.number, method=str(payment.method),
        amount_kmf=payment.amount_kmf, balance_after_kmf=new_balance,
        currency="KMF", invoice_status_after=invoice.status,
        subscription_status_after=status_after, has_reason=True,
    )
    return reversal


@transaction.atomic
def cancel_subscription_invoice(*, actor, invoice, reason):
    """Annule une facture d'abonnement — motif OBLIGATOIRE.

    Conditions strictes, patron ``cancel_invoice`` (ADR 0015 addendum S1) :
    jamais deux fois, et **jamais tant qu'un règlement actif existe**
    (contre-passez d'abord : l'histoire de chaque franc reste explicite).

    Effet libérateur : la période redevient facturable (l'index unique
    n'attrape que les factures VIVANTES) et le curseur ``current_period_end``
    recule jusqu'à la veille de la période annulée — sans quoi une faute de
    frappe rendrait ce tenant définitivement non facturable pour ce mois-là.
    """
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError("Le motif de l'annulation est obligatoire.")
    invoice = _locked_invoice(invoice)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationError("Cette facture d'abonnement est déjà annulée.")
    if SubscriptionPayment.objects.filter(
        invoice=invoice, reversal__isnull=True
    ).exists():
        raise ValidationError(
            "Cette facture porte des règlements : contre-passez-les avant de "
            "l'annuler."
        )
    invoice.status = InvoiceStatus.CANCELLED
    invoice.cancelled_at = timezone.now()
    invoice.cancelled_by = actor
    invoice.cancel_reason = reason
    invoice.save(
        update_fields=[
            "status", "cancelled_at", "cancelled_by", "cancel_reason",
            "updated_at",
        ]
    )
    subscription = _locked(invoice.subscription)
    if subscription.current_period_end == invoice.period_end:
        subscription.current_period_end = invoice.period_start - timedelta(days=1)
        subscription.save(update_fields=["current_period_end", "updated_at"])
    status_after = _sync_subscription_payment_status(subscription, actor=actor)
    audit(
        actor=actor, action=AuditAction.SUBSCRIPTION_INVOICE_CANCELLED,
        target=invoice, center=invoice.center,
        subscription_invoice_id=invoice.pk,
        subscription_id=invoice.subscription_id, center_id=invoice.center_id,
        number=invoice.number, amount_kmf=invoice.amount_kmf, currency="KMF",
        subscription_status_after=status_after, has_reason=True,
    )
    return invoice


# ---------------------------------------------------------------------------
# Corps des tâches planifiées (apps/billing/tasks.py ne fait que déléguer)
# ---------------------------------------------------------------------------


def issue_due_subscription_invoices(*, today=None):
    """Émet toutes les factures d'abonnement arrivées à terme.

    Idempotente par construction : chaque tenant a un curseur
    (``current_period_end``) et un index unique par période vivante — la
    relancer dans la minute n'émet rien de plus. Le rattrapage d'un tenant
    en retard est borné (:data:`MAX_CATCHUP_PERIODS`).

    Chaque émission est SA transaction : un tenant en erreur n'empêche pas
    les autres d'être facturés. Le refus normal (« pas encore à terme ») est
    la condition d'arrêt de la boucle, pas un incident.

    Retourne le nombre de factures émises.
    """
    today = today or timezone.localdate()
    issued = 0
    subscriptions = (
        CenterSubscription.objects.filter(
            status__in=BILLABLE_SUBSCRIPTION_STATUSES
        )
        .select_related("plan", "center")
        .order_by("pk")
    )
    for subscription in subscriptions:
        for _ in range(MAX_CATCHUP_PERIODS):
            try:
                issue_subscription_invoice(
                    actor=None, subscription=subscription, today=today
                )
            except ValidationError as exc:
                logger.debug(
                    "Abonnement #%s non facturé : %s",
                    subscription.pk, "; ".join(exc.messages),
                )
                break
            issued += 1
            subscription.refresh_from_db()
    return issued


def flag_overdue_subscriptions(*, today=None):
    """Passe en « impayé » les contrats dont une échéance est dépassée, et
    ramène à « actif » ceux qui n'ont plus rien d'échu.

    **Ne suspend jamais rien** : la suspension gèle l'administratif, c'est
    une sanction — elle reste une décision explicite, motivée et auditée de
    l'exploitant (ADR 0018). Un centre qui a payé par virement non encore
    saisi ne doit pas se réveiller gelé.

    Retourne le nombre d'abonnements dont le statut a changé.
    """
    today = today or timezone.localdate()
    changed = 0
    subscriptions = (
        CenterSubscription.objects.filter(
            status__in=(Status.ACTIVE, Status.UNPAID)
        )
        .select_related("center")
        .order_by("pk")
    )
    for subscription in subscriptions:
        with transaction.atomic():
            if (
                _sync_subscription_payment_status(
                    subscription, actor=None, today=today
                )
                is not None
            ):
                changed += 1
    return changed


def send_subscription_payment_reminders(*, today=None):
    """Relances SMS d'une facture d'abonnement échue — AU DIRECTEUR SEUL.

    Cadence :data:`SUBSCRIPTION_REMINDER_OFFSETS_DAYS` (J+0, J+7, J+21 après
    l'échéance), UNE relance au plus par facture et par exécution, puis
    silence définitif : au quatrième message ce n'est plus une relance.

    Le compteur anti-doublon et l'envoi sont commités ENSEMBLE (le SMS part
    par ``on_commit`` à l'intérieur de la transaction, patron du rappel de
    rendez-vous) : un rollback n'envoie rien et laisse la facture
    re-éligible. Le montant relancé est le SOLDE restant, jamais le montant
    facturé.

    **La facture est relue SOUS VERROU avant l'incrément** (revue guardian
    S5) : un compteur anti-doublon lu hors verrou n'est pas anti-doublon.
    Deux exécutions qui se chevauchent — un beat qui double-déclenche, une
    tâche rejouée après un timeout — lisaient toutes deux « zéro relance
    envoyée » et faisaient partir DEUX fois le même message, celui qui
    porte un MONTANT au directeur ; le compteur retombait à 1, si bien que
    le tenant pouvait dépasser les trois relances de la cadence. Le verrou
    sert aussi à relire le solde : relancer sur une somme réglée entre la
    sélection et l'envoi serait faux et vexant.

    Retourne le nombre de relances programmées.
    """
    today = today or timezone.localdate()
    sent = 0
    invoices = (
        unpaid_subscription_invoices_qs()
        .filter(
            due_date__lte=today,
            reminders_sent__lt=len(SUBSCRIPTION_REMINDER_OFFSETS_DAYS),
        )
        .select_related("center")
        .order_by("pk")
    )
    for invoice in invoices:
        index = invoice.reminders_sent
        if (today - invoice.due_date).days < SUBSCRIPTION_REMINDER_OFFSETS_DAYS[index]:
            continue
        if not center_director_phones(invoice.center_id):
            # Aucun directeur actif joignable : on n'incrémente RIEN — sinon
            # un tenant à réamorcer brûlerait ses trois relances en silence
            # et ne serait plus jamais relancé le jour où il en a un.
            logger.debug(
                "Relance d'abonnement ignorée (aucun directeur joignable) : "
                "facture #%s.", invoice.pk,
            )
            continue
        with transaction.atomic():
            locked = _locked_invoice(invoice)
            balance = subscription_invoice_balance_kmf(locked)
            if (
                locked.reminders_sent != index
                or locked.status != InvoiceStatus.ISSUED
                or balance <= 0
            ):
                # Une exécution concurrente a pris cette relance, ou la
                # facture vient d'être réglée/annulée : on n'envoie rien et
                # on ne brûle pas le compteur.
                continue
            locked.reminders_sent = index + 1
            locked.last_reminder_at = timezone.now()
            locked.save(
                update_fields=["reminders_sent", "last_reminder_at", "updated_at"]
            )
            # SV : « première relance » ne veut pas dire « copie du jour J ».
            # ``first`` s'appuie sur la proximité RÉELLE de l'échéance, pas
            # sur le compteur : une facture très en retard (beat resté muet,
            # facture rattrapée) recevrait sinon sa PREMIÈRE relance avec la
            # copie « arrive à échéance aujourd'hui » — mensongère. L'offset
            # 0 fait normalement partir la première vague le jour J (copie
            # DUE inchangée) ; si elle part en retard, la copie OVERDUE dit
            # la vérité. Ni la cadence, ni les destinataires ne changent.
            notify_subscription_invoice_reminder(
                locked,
                balance_kmf=balance,
                first=(today - locked.due_date).days <= 0,
            )
        sent += 1
    return sent
