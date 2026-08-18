"""S5 lot 2 (ADR 0018 décision 4) — la facturation SaaS Chioni → centre.

Quatre couches, dans l'ordre où elles décident :

1. **Le modèle** — série « A- » GLOBALE et contiguë, montant FIGÉ à
   l'émission, règlements append-only, une facture vivante par période.
2. **Les services** — solde dérivé (jamais un champ « reste dû »), jamais
   de règlement au-delà du solde, contre-passation motivée comme seule
   correction, courses sérialisées par le verrou de la ligne facture.
3. **Le cycle** — émission mensuelle par tenant, ``actif → impaye``
   automatique sur échéance dépassée, retour automatique dès que réglé, et
   **``suspendu`` jamais automatique**.
4. **Les relances SMS** — le directeur SEUL, J+0 / J+7 / J+21, puis
   silence.

Et l'invariant transverse du sprint, vérifié ici aussi : **étanchéité des
registres** — pas un franc de ce module n'entre dans le ledger des soins.

Le fichier compagnon ``test_subscription_invoice_api.py`` porte l'API.
"""

import threading
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connections, transaction
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing import services as billing_services
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionInvoiceCounter,
    SubscriptionPayment,
    SubscriptionPaymentReversal,
    SubscriptionPlan,
)
from apps.common.models import AppendOnlyError
from apps.common.notifications import (
    SMS_SUBSCRIPTION_INVOICE_DUE,
    SMS_SUBSCRIPTION_INVOICE_OVERDUE,
)
from apps.centers.models import StaffMembership
from apps.trustbridge.models import (
    CashPayment,
    CashReceipt,
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    Receipt,
)

from .api_helpers import client_for, make_center_with_director, make_staff_user
from .factories import (
    make_center,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_subscription_invoice,
    make_user,
)

pytestmark = pytest.mark.django_db

Status = CenterSubscription.Status
InvoiceStatus = SubscriptionInvoice.Status
Method = SubscriptionPayment.Method


def operator():
    user, _op = make_platform_staff()
    return user


def billed_center(price_kmf="25000", status=Status.ACTIVE, **plan_kwargs):
    """A center with a director and an ACTIVE contract, ready to be billed."""
    center, director = make_center_with_director()
    subscription = make_subscription(
        center=center,
        plan=make_plan(price_kmf=price_kmf, **plan_kwargs),
        status=status,
    )
    return center, director, subscription


def issue(subscription, *, actor=None, today=None):
    return billing_services.issue_subscription_invoice(
        actor=actor or operator(), subscription=subscription, today=today
    )


def pay(invoice, amount, *, actor=None, method=Method.TRANSFER, **kwargs):
    return billing_services.record_subscription_payment(
        actor=actor or operator(), invoice=invoice,
        amount_kmf=Decimal(amount), method=method, **kwargs
    )


def balance(invoice):
    invoice.refresh_from_db()
    return billing_services.subscription_invoice_balance_kmf(invoice)


# ---------------------------------------------------------------------------
# 1 — le modèle : série, gel, append-only
# ---------------------------------------------------------------------------


class TestTheGlobalASeries:
    def test_the_series_is_global_not_per_tenant(self):
        """C'est CHIONI qui émet : deux tenants se suivent dans la MÊME
        série, contrairement aux reçus « G- » et diaspora (par centre)."""
        _c1, _d1, first = billed_center()
        _c2, _d2, second = billed_center()
        a = issue(first)
        b = issue(second)
        assert (a.number, b.number) == ("A-000001", "A-000002")

    def test_numbering_never_locks_a_health_center_row(self):
        """LA contrainte de l'ADR : la numérotation SaaS ne doit pas entrer
        en contention avec ``Receipt.issue()`` / ``CashReceipt.issue()``,
        qui verrouillent la ligne du centre pour numéroter. Sonde
        structurelle sur le SQL réellement émis."""
        _center, _director, subscription = billed_center()
        with CaptureQueriesContext(connection) as captured:
            issue(subscription)
        locking = [
            query["sql"]
            for query in captured.captured_queries
            if "FOR UPDATE" in query["sql"].upper()
        ]
        assert locking, "l'émission doit bien prendre des verrous"
        assert not [
            sql for sql in locking if "centers_healthcenter" in sql.lower()
        ], locking

    def test_a_rolled_back_issuance_does_not_burn_a_number(self):
        """Une ``SEQUENCE`` PostgreSQL laisserait un trou : un numéro
        manquant dans une série de factures ressemble à une facture
        disparue (l'argument même de l'ADR 0015 §6)."""
        _center, _director, subscription = billed_center()
        first = issue(subscription)
        assert first.number == "A-000001"
        with pytest.raises(ValidationError):
            issue(subscription)  # période pas encore à terme → rien n'est écrit
        subscription.refresh_from_db()
        second = issue(subscription, today=first.period_end + timedelta(days=1))
        assert second.number == "A-000002"
        assert SubscriptionInvoiceCounter.objects.get().last_number == 2

    def test_the_counter_row_is_created_lazily(self):
        """Aucune migration de données ne la sème : ``TransactionTestCase``
        vide les tables entre deux tests."""
        assert not SubscriptionInvoiceCounter.objects.exists()
        _center, _director, subscription = billed_center()
        issue(subscription)
        assert SubscriptionInvoiceCounter.objects.count() == 1

    def test_two_invoices_can_never_share_a_number(self):
        _center, _director, subscription = billed_center()
        first = issue(subscription)
        subscription.refresh_from_db()
        second = issue(subscription, today=first.period_end + timedelta(days=1))
        # Depuis le lot SV, le trigger ``billing_subscriptioninvoice_frozen``
        # refuse la réécriture du numéro AVANT même que la contrainte
        # d'unicité soit consultée — même arbitre (PostgreSQL).
        with pytest.raises(DatabaseError, match="figes"):
            with transaction.atomic():
                SubscriptionInvoice.objects.filter(pk=second.pk).update(
                    sequence_number=first.sequence_number
                )


class TestAnIssuedInvoiceIsFrozen:
    def test_the_amount_can_never_be_rewritten(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        invoice.amount_kmf = Decimal("1")
        with pytest.raises(ValidationError, match="figés"):
            invoice.save()

    def test_the_status_still_moves(self):
        """Le gel porte sur les montants et les rattachements, pas sur le
        workflow — sinon aucune facture ne pourrait jamais être réglée."""
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        invoice.status = InvoiceStatus.PAID
        invoice.save(update_fields=["status", "updated_at"])
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.PAID

    def test_repricing_the_offer_never_rewrites_a_past_invoice(self):
        """L'offre est RÉFÉRENCÉE, le montant est un SNAPSHOT."""
        _center, _director, subscription = billed_center(price_kmf="25000")
        invoice = issue(subscription)
        billing_services.update_plan(
            actor=operator(), plan=subscription.plan, price_kmf=Decimal("40000")
        )
        invoice.refresh_from_db()
        assert invoice.amount_kmf == Decimal("25000.00")
        assert invoice.plan_label == "Essentiel"
        # …et la période SUIVANTE, elle, part au nouveau prix.
        subscription.refresh_from_db()
        following = issue(
            subscription, today=invoice.period_end + timedelta(days=1)
        )
        assert following.amount_kmf == Decimal("40000.00")

    def test_the_database_refuses_a_fractional_amount(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        # Depuis le lot SV, le trigger de gel refuse la réécriture du
        # montant avant même le ``CheckConstraint`` d'intégralité — même
        # arbitre (PostgreSQL). L'INSERT fractionnaire, lui, reste attrapé
        # par la contrainte (les triggers SV ne portent que sur UPDATE).
        with pytest.raises(DatabaseError, match="figes"):
            with transaction.atomic():
                SubscriptionInvoice.objects.filter(pk=invoice.pk).update(
                    amount_kmf=Decimal("25000.50")
                )

    def test_an_invoice_never_belongs_to_another_center(self):
        _center, _director, subscription = billed_center()
        with pytest.raises(ValidationError, match="centre"):
            SubscriptionInvoice(
                center=make_center(name="Ailleurs"),
                subscription=subscription,
                sequence_number=999,
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 31),
                amount_kmf=Decimal("1000"),
                plan_code="X", plan_label="X",
                due_date=date(2026, 1, 16),
            ).save()


class TestSettlementsAreAppendOnly:
    def test_a_payment_is_never_rewritten_nor_deleted(self):
        _center, _director, subscription = billed_center()
        payment = pay(issue(subscription), "5000")
        payment.amount_kmf = Decimal("1")
        with pytest.raises(AppendOnlyError):
            payment.save()
        with pytest.raises(AppendOnlyError):
            payment.delete()
        with pytest.raises(AppendOnlyError):
            SubscriptionPayment.objects.filter(pk=payment.pk).update(
                amount_kmf=Decimal("1")
            )

    def test_a_reversal_is_append_only_too(self):
        _center, _director, subscription = billed_center()
        payment = pay(issue(subscription), "5000")
        reversal = billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Virement non parvenu."
        )
        with pytest.raises(AppendOnlyError):
            reversal.delete()


# ---------------------------------------------------------------------------
# 2 — les périodes et l'éligibilité
# ---------------------------------------------------------------------------


class TestBillingPeriods:
    def test_the_first_period_starts_at_the_subscription_date(self):
        _center, _director, subscription = billed_center()
        subscription.started_at = date(2026, 3, 10)
        subscription.save(update_fields=["started_at", "updated_at"])
        invoice = issue(subscription, today=date(2026, 3, 10))
        assert invoice.period_start == date(2026, 3, 10)
        assert invoice.period_end == date(2026, 4, 9)
        subscription.refresh_from_db()
        assert subscription.current_period_end == date(2026, 4, 9)

    def test_periods_follow_each_other_without_gap_or_overlap(self):
        _center, _director, subscription = billed_center()
        subscription.started_at = date(2026, 1, 1)
        subscription.save(update_fields=["started_at", "updated_at"])
        first = issue(subscription, today=date(2026, 1, 1))
        subscription.refresh_from_db()
        second = issue(subscription, today=date(2026, 2, 1))
        assert first.period_end == date(2026, 1, 31)
        assert second.period_start == date(2026, 2, 1)

    def test_an_annual_offer_bills_twelve_months(self):
        _center, _director, subscription = billed_center(
            price_kmf="250000",
            billing_period=SubscriptionPlan.BillingPeriod.ANNUAL,
        )
        subscription.started_at = date(2026, 1, 1)
        subscription.save(update_fields=["started_at", "updated_at"])
        invoice = issue(subscription, today=date(2026, 1, 1))
        assert invoice.period_end == date(2026, 12, 31)

    def test_the_end_of_month_is_clamped(self):
        """31 janvier + 1 mois = 28 février (dérive assumée, documentée)."""
        assert billing_services._add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
        assert billing_services._add_months(date(2026, 12, 15), 1) == date(2027, 1, 15)

    def test_a_period_not_yet_over_is_refused(self):
        _center, _director, subscription = billed_center()
        issue(subscription)
        subscription.refresh_from_db()
        with pytest.raises(ValidationError, match="pas encore arrivée à terme"):
            issue(subscription)

    def test_the_due_date_follows_the_setting(self, settings):
        settings.SUBSCRIPTION_INVOICE_DUE_DAYS = 30
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        assert (invoice.due_date - invoice.period_start).days == 30


class TestWhoGetsBilled:
    @pytest.mark.parametrize(
        "status", [Status.TRIAL, Status.SUSPENDED, Status.TERMINATED]
    )
    def test_only_active_and_unpaid_contracts_are_billed(self, status):
        """On ne facture pas un essai, et **on n'accumule pas de dette sur
        ce qu'on a gelé** (arbitrage documenté, réversible)."""
        _center, _director, subscription = billed_center(status=status)
        with pytest.raises(ValidationError, match="n'est pas facturé"):
            issue(subscription)

    def test_an_unpaid_contract_keeps_being_billed(self):
        """Être en retard n'arrête pas le service — donc pas la facture."""
        _center, _director, subscription = billed_center(status=Status.UNPAID)
        assert issue(subscription).pk is not None

    def test_a_free_offer_produces_no_invoice(self):
        _center, _director, subscription = billed_center(price_kmf="0")
        with pytest.raises(ValidationError, match="rien à facturer"):
            issue(subscription)


# ---------------------------------------------------------------------------
# 3 — règlements : partiels, jamais au-delà du solde, courses réelles
# ---------------------------------------------------------------------------


class TestSettlements:
    def test_a_partial_settlement_leaves_the_invoice_issued(self):
        _center, _director, subscription = billed_center(price_kmf="25000")
        invoice = issue(subscription)
        pay(invoice, "10000")
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.ISSUED
        assert balance(invoice) == Decimal("15000.00")

    def test_settling_the_last_franc_marks_the_invoice_paid(self):
        _center, _director, subscription = billed_center(price_kmf="25000")
        invoice = issue(subscription)
        pay(invoice, "10000")
        pay(invoice, "15000")
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.PAID
        assert balance(invoice) == Decimal("0")

    def test_never_beyond_the_balance(self):
        _center, _director, subscription = billed_center(price_kmf="25000")
        invoice = issue(subscription)
        pay(invoice, "20000")
        with pytest.raises(ValidationError, match="dépasse le solde"):
            pay(invoice, "6000")
        assert balance(invoice) == Decimal("5000.00")

    def test_a_settled_or_cancelled_invoice_takes_nothing_more(self):
        _center, _director, subscription = billed_center(price_kmf="5000")
        invoice = issue(subscription)
        pay(invoice, "5000")
        with pytest.raises(ValidationError, match="déjà réglée"):
            pay(invoice, "1000")

        _c2, _d2, other = billed_center(price_kmf="5000")
        cancelled = issue(other)
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=cancelled, reason="Erreur de période."
        )
        with pytest.raises(ValidationError, match="annulée"):
            pay(cancelled, "1000")

    def test_kmf_carries_no_decimals(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        with pytest.raises(ValidationError, match="décimales"):
            pay(invoice, "1000.50")

    def test_a_settlement_is_never_dated_in_the_future(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        with pytest.raises(ValidationError, match="futur"):
            pay(
                invoice, "1000",
                received_at=timezone.localdate() + timedelta(days=1),
            )

    def test_a_zero_or_negative_settlement_is_refused(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        for amount in ("0", "-5000"):
            with pytest.raises(ValidationError, match="> 0"):
                pay(invoice, amount)


class TestConcurrentSettlements:
    @pytest.mark.django_db(transaction=True)
    def test_two_operators_never_cash_beyond_the_balance(self):
        """Threads RÉELS : le verrou de la ligne facture est LE point de
        sérialisation (patron ``record_cash_payment``, ADR 0015)."""
        _center, _director, subscription = billed_center(price_kmf="25000")
        invoice = issue(subscription)
        actor = operator()
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def attempt():
            try:
                barrier.wait()
                outcomes.append(("ok", pay(invoice, "20000", actor=actor)))
            except ValidationError as exc:
                outcomes.append(("refused", str(exc)))
            finally:
                connections.close_all()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert SubscriptionPayment.objects.count() == 1
        assert balance(invoice) == Decimal("5000.00")


class TestConcurrentIssuance:
    @pytest.mark.django_db(transaction=True)
    def test_two_tenants_billed_at_the_same_instant_get_distinct_numbers(self):
        """Le compteur de la série est LE point de sérialisation — et il
        n'entre en contention avec rien d'autre (surtout pas un reçu de
        caisse en cours d'émission dans un centre)."""
        _c1, _d1, first = billed_center()
        _c2, _d2, second = billed_center()
        actor = operator()
        barrier = threading.Barrier(2, timeout=10)
        numbers = []

        def run(subscription):
            def inner():
                try:
                    barrier.wait()
                    numbers.append(issue(subscription, actor=actor).number)
                finally:
                    connections.close_all()
            return inner

        threads = [
            threading.Thread(target=run(first)),
            threading.Thread(target=run(second)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(numbers) == ["A-000001", "A-000002"]

    @pytest.mark.django_db(transaction=True)
    def test_the_same_tenant_billed_twice_at_once_gets_ONE_invoice(self):
        _center, _director, subscription = billed_center()
        actor = operator()
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def attempt():
            try:
                barrier.wait()
                outcomes.append(("ok", issue(subscription, actor=actor).number))
            except ValidationError as exc:
                outcomes.append(("refused", str(exc)))
            finally:
                connections.close_all()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert SubscriptionInvoice.objects.count() == 1


# ---------------------------------------------------------------------------
# 4 — contre-passation et annulation : les deux corrections écrites
# ---------------------------------------------------------------------------


class TestReversal:
    def test_reversing_reopens_the_balance_and_the_invoice(self):
        _center, _director, subscription = billed_center(price_kmf="5000")
        invoice = issue(subscription)
        payment = pay(invoice, "5000")
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.PAID
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Virement rejeté."
        )
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.ISSUED
        assert balance(invoice) == Decimal("5000.00")

    def test_the_motive_is_mandatory(self):
        _center, _director, subscription = billed_center()
        payment = pay(issue(subscription), "5000")
        for reason in ("", "   "):
            with pytest.raises(ValidationError, match="motif"):
                billing_services.reverse_subscription_payment(
                    actor=operator(), payment=payment, reason=reason
                )

    def test_a_settlement_is_reversed_only_once(self):
        _center, _director, subscription = billed_center()
        payment = pay(issue(subscription), "5000")
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Erreur."
        )
        with pytest.raises(ValidationError, match="déjà été contre-passé"):
            billing_services.reverse_subscription_payment(
                actor=operator(), payment=payment, reason="Encore."
            )
        assert SubscriptionPaymentReversal.objects.count() == 1


class TestCancellation:
    def test_the_motive_is_mandatory(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        with pytest.raises(ValidationError, match="motif"):
            billing_services.cancel_subscription_invoice(
                actor=operator(), invoice=invoice, reason=" "
            )

    def test_an_invoice_carrying_a_live_settlement_is_not_cancelled(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        payment = pay(invoice, "5000")
        with pytest.raises(ValidationError, match="contre-passez"):
            billing_services.cancel_subscription_invoice(
                actor=operator(), invoice=invoice, reason="Erreur."
            )
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Erreur de saisie."
        )
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Période erronée."
        )
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.CANCELLED
        assert invoice.cancel_reason == "Période erronée."

    def test_cancelling_makes_the_period_billable_again(self):
        """Une faute de frappe ne doit pas condamner un tenant à ne plus
        jamais être facturé pour ce mois-là."""
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        period_start = invoice.period_start
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Mauvais montant."
        )
        subscription.refresh_from_db()
        assert subscription.current_period_end == period_start - timedelta(days=1)
        reissued = issue(subscription)
        assert reissued.period_start == period_start
        assert reissued.number != invoice.number

    def test_an_invoice_is_cancelled_only_once(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Erreur."
        )
        with pytest.raises(ValidationError, match="déjà annulée"):
            billing_services.cancel_subscription_invoice(
                actor=operator(), invoice=invoice, reason="Encore."
            )

    def test_two_live_invoices_can_never_cover_the_same_period(self):
        _center, _director, subscription = billed_center()
        invoice = issue(subscription)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SubscriptionInvoice.objects.create(
                    center=subscription.center, subscription=subscription,
                    sequence_number=9999,
                    period_start=invoice.period_start,
                    period_end=invoice.period_end,
                    amount_kmf=Decimal("25000"),
                    plan_code="X", plan_label="X",
                    due_date=invoice.due_date,
                )


# ---------------------------------------------------------------------------
# 5 — le cycle automatique : actif ⇄ impayé, et rien d'autre
# ---------------------------------------------------------------------------


class TestOverdueFlagging:
    def test_a_passed_due_date_flags_the_contract_unpaid(self):
        center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, days_overdue=1)
        assert billing_services.flag_overdue_subscriptions() == 1
        subscription.refresh_from_db()
        assert subscription.status == Status.UNPAID
        assert "échéance" in subscription.status_reason

    def test_the_due_day_itself_is_not_a_delay(self):
        """Un règlement peut arriver dans la journée : l'échéance du jour
        déclenche la relance, jamais le passage en impayé."""
        _center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, days_overdue=0)
        assert billing_services.flag_overdue_subscriptions() == 0
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE

    def test_settling_the_debt_brings_the_contract_back_to_active(self):
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=3
        )
        billing_services.flag_overdue_subscriptions()
        subscription.refresh_from_db()
        assert subscription.status == Status.UNPAID
        pay(invoice, "25000")
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE
        assert subscription.status_reason == ""

    def test_a_partial_settlement_does_not_lift_the_flag(self):
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=3
        )
        billing_services.flag_overdue_subscriptions()
        pay(invoice, "10000")
        subscription.refresh_from_db()
        assert subscription.status == Status.UNPAID

    def test_reversing_a_settlement_flags_the_contract_again(self):
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="5000", days_overdue=3
        )
        payment = pay(invoice, "5000")
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Chèque sans provision."
        )
        subscription.refresh_from_db()
        assert subscription.status == Status.UNPAID

    def test_cancelling_the_overdue_invoice_clears_the_flag(self):
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(subscription, days_overdue=5)
        billing_services.flag_overdue_subscriptions()
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Facturé par erreur."
        )
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE

    @pytest.mark.parametrize(
        "status", [Status.TRIAL, Status.SUSPENDED, Status.TERMINATED]
    )
    def test_no_task_ever_freezes_or_unfreezes_a_contract(self, status):
        """**LE test du lot** : ``suspendu`` n'est jamais automatique. Un
        centre qui a payé par virement non encore saisi ne doit pas se
        réveiller gelé — et un centre gelé ne se dégèle pas tout seul."""
        _center, _director, subscription = billed_center(status=status)
        subscription.status_reason = "Décision humaine."
        subscription.save(update_fields=["status_reason", "updated_at"])
        invoice = make_subscription_invoice(subscription, days_overdue=90)
        billing_services.flag_overdue_subscriptions()
        subscription.refresh_from_db()
        assert subscription.status == status
        # …et même une fois la dette soldée, rien ne bouge tout seul.
        pay(invoice, invoice.amount_kmf)
        subscription.refresh_from_db()
        assert subscription.status == status
        assert subscription.status_reason == "Décision humaine."

    def test_the_flag_is_journalised_as_automatic_without_any_free_text(self):
        _center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, days_overdue=2)
        billing_services.flag_overdue_subscriptions()
        entry = AuditLog.objects.filter(
            action=AuditAction.SUBSCRIPTION_STATUS_CHANGED
        ).latest("id")
        assert entry.actor_id is None  # tâche système
        assert entry.payload["automatic"] is True
        assert entry.payload["status"] == Status.UNPAID
        assert "reason" not in entry.payload
        assert "échéance" not in str(entry.payload)


class TestTheMonthlyIssuanceTask:
    def test_it_bills_every_due_tenant_once(self):
        _c1, _d1, first = billed_center()
        _c2, _d2, second = billed_center()
        assert billing_services.issue_due_subscription_invoices() == 2
        # Idempotente : relancée dans la minute, elle n'émet plus rien.
        assert billing_services.issue_due_subscription_invoices() == 0
        assert SubscriptionInvoice.objects.count() == 2

    def test_a_forgotten_tenant_is_caught_up_period_by_period(self):
        _center, _director, subscription = billed_center()
        subscription.started_at = date(2026, 1, 1)
        subscription.save(update_fields=["started_at", "updated_at"])
        issued = billing_services.issue_due_subscription_invoices(
            today=date(2026, 3, 15)
        )
        assert issued == 3  # janvier, février, mars
        periods = list(
            SubscriptionInvoice.objects.filter(subscription=subscription)
            .order_by("period_start")
            .values_list("period_start", flat=True)
        )
        assert periods == [date(2026, 1, 1), date(2026, 2, 1), date(2026, 3, 1)]

    def test_the_catch_up_is_bounded(self):
        _center, _director, subscription = billed_center()
        subscription.started_at = date(2020, 1, 1)
        subscription.save(update_fields=["started_at", "updated_at"])
        issued = billing_services.issue_due_subscription_invoices(
            today=date(2026, 1, 1)
        )
        assert issued == billing_services.MAX_CATCHUP_PERIODS

    def test_a_frozen_or_trial_tenant_is_skipped(self):
        billed_center(status=Status.TRIAL)
        billed_center(status=Status.SUSPENDED)
        billed_center(status=Status.TERMINATED)
        assert billing_services.issue_due_subscription_invoices() == 0

    def test_the_celery_tasks_only_delegate(self):
        """Les settings référencent ces trois noms — ils doivent exister et
        ne rien faire d'autre que déléguer à leur service."""
        from django.conf import settings

        from apps.billing import tasks

        scheduled = {
            entry["task"] for entry in settings.CELERY_BEAT_SCHEDULE.values()
        }
        assert {
            "billing.issue_due_subscription_invoices",
            "billing.flag_overdue_subscriptions",
            "billing.send_subscription_payment_reminders",
        } <= scheduled
        _center, _director, _subscription = billed_center()
        assert tasks.issue_due_subscription_invoices_task() == 1
        assert tasks.flag_overdue_subscriptions_task() == 0
        assert tasks.send_subscription_payment_reminders_task() == 0


# ---------------------------------------------------------------------------
# 6 — les relances SMS : le directeur SEUL, sobrement
# ---------------------------------------------------------------------------


class TestReminders:
    """La suite tourne dans une transaction jamais commitée : les envois
    programmés par ``on_commit`` sont exécutés explicitement par
    ``django_capture_on_commit_callbacks`` — ce qui prouve au passage le
    contrat de remise (rollback = aucun SMS)."""

    def test_the_due_day_reminder_goes_to_the_director_alone(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, director, subscription = billed_center()
        cashier = make_staff_user(center, role=StaffMembership.Role.CASHIER)
        nurse = make_staff_user(center, role=StaffMembership.Role.NURSE)
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=0
        )
        with django_capture_on_commit_callbacks(execute=True):
            assert billing_services.send_subscription_payment_reminders() == 1
        assert [phone for phone, _ in sms_outbox] == [director.phone]
        assert cashier.phone not in str(sms_outbox)
        assert nurse.phone not in str(sms_outbox)
        (_phone, message), = sms_outbox
        assert message == SMS_SUBSCRIPTION_INVOICE_DUE.format(
            number=invoice.number, amount_kmf="25 000"
        )

    def test_a_rolled_back_run_notifies_nobody(self, sms_outbox):
        """Sans commit, rien ne part : le compteur anti-doublon et le SMS
        tiennent ou tombent ensemble (patron du rappel de rendez-vous)."""
        _center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, days_overdue=0)
        assert billing_services.send_subscription_payment_reminders() == 1
        assert sms_outbox == []

    def test_the_reminder_carries_no_patient_and_no_center_name(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director, subscription = billed_center()
        center.name = "Clinique Ylang"
        center.save(update_fields=["name", "updated_at"])
        make_subscription_invoice(subscription, days_overdue=0)
        with django_capture_on_commit_callbacks(execute=True):
            billing_services.send_subscription_payment_reminders()
        (_phone, message), = sms_outbox
        assert "Ylang" not in message
        for forbidden in ("patient", "consultation", "soin", "dossier"):
            assert forbidden not in message.lower()

    def test_the_amount_relayed_is_the_REMAINING_balance(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Relancer sur un montant déjà réglé pour moitié serait faux."""
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=0
        )
        pay(invoice, "10000")
        with django_capture_on_commit_callbacks(execute=True):
            billing_services.send_subscription_payment_reminders()
        (_phone, message), = sms_outbox
        assert "15 000 KMF" in message

    def test_the_cadence_is_zero_seven_twentyone_then_silence(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=0
        )
        due = invoice.due_date
        for offset, expected in (
            (0, 1), (1, 1), (6, 1), (7, 2), (20, 2), (21, 3), (60, 3), (365, 3)
        ):
            with django_capture_on_commit_callbacks(execute=True):
                billing_services.send_subscription_payment_reminders(
                    today=due + timedelta(days=offset)
                )
            invoice.refresh_from_db()
            assert invoice.reminders_sent == expected, offset
        assert len(sms_outbox) == 3
        # Le premier texte annonce l'échéance, les suivants la rappellent.
        assert sms_outbox[0][1].startswith(SMS_SUBSCRIPTION_INVOICE_DUE[:30])
        assert sms_outbox[1][1].startswith(SMS_SUBSCRIPTION_INVOICE_OVERDUE[:30])

    def test_a_settled_or_cancelled_invoice_is_never_chased(self, sms_outbox):
        _center, _director, subscription = billed_center()
        settled = make_subscription_invoice(
            subscription, amount_kmf="5000", days_overdue=2
        )
        pay(settled, "5000")
        _c2, _d2, other = billed_center()
        cancelled = make_subscription_invoice(other, days_overdue=2)
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=cancelled, reason="Erreur."
        )
        assert billing_services.send_subscription_payment_reminders() == 0
        assert sms_outbox == []

    def test_an_invoice_before_its_due_date_is_never_chased(self, sms_outbox):
        _center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, days_overdue=-3)
        assert billing_services.send_subscription_payment_reminders() == 0
        assert sms_outbox == []

    def test_a_tenant_without_a_reachable_director_burns_no_reminder(
        self, sms_outbox
    ):
        """Sinon un centre à réamorcer épuiserait ses trois relances en
        silence et ne serait plus jamais relancé le jour où il en a un."""
        center = make_center()
        subscription = make_subscription(center=center)
        invoice = make_subscription_invoice(subscription, days_overdue=0)
        assert billing_services.send_subscription_payment_reminders() == 0
        invoice.refresh_from_db()
        assert invoice.reminders_sent == 0
        assert sms_outbox == []

    def test_both_directors_of_a_co_managed_center_are_told(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, director, subscription = billed_center()
        second = make_staff_user(center, role=StaffMembership.Role.DIRECTOR)
        make_subscription_invoice(subscription, days_overdue=0)
        with django_capture_on_commit_callbacks(execute=True):
            billing_services.send_subscription_payment_reminders()
        assert sorted(phone for phone, _ in sms_outbox) == sorted(
            [director.phone, second.phone]
        )

    def test_a_deactivated_director_is_no_longer_told(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, director, subscription = billed_center()
        StaffMembership.objects.filter(user=director, center=center).update(
            is_active=False
        )
        make_subscription_invoice(subscription, days_overdue=0)
        with django_capture_on_commit_callbacks(execute=True):
            assert billing_services.send_subscription_payment_reminders() == 0
        assert sms_outbox == []

    def test_no_reminder_ever_reaches_a_patient_or_a_guardian(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le montant que le centre doit à Chioni ne regarde personne
        d'autre — surtout pas les gens soignés là."""
        center, director, subscription = billed_center()
        patient_user = make_user()
        make_subscription_invoice(subscription, days_overdue=0)
        with django_capture_on_commit_callbacks(execute=True):
            billing_services.send_subscription_payment_reminders()
        assert patient_user.phone not in str(sms_outbox)
        assert {phone for phone, _ in sms_outbox} == {director.phone}


# ---------------------------------------------------------------------------
# 7 — étanchéité des registres (invariant transverse n° 4 de l'ADR 0018)
# ---------------------------------------------------------------------------


class TestNotOneFrancEntersTheCareLedger:
    def test_the_whole_saas_cycle_writes_no_money_row_of_the_care_ledger(self):
        _center, _director, subscription = billed_center()
        before = {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "cash_receipts": CashReceipt.objects.count(),
            "receipts": Receipt.objects.count(),
        }
        invoice = issue(subscription)
        payment = pay(invoice, "10000")
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Erreur."
        )
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Erreur."
        )
        assert {
            "transactions": LedgerTransaction.objects.count(),
            "entries": LedgerEntry.objects.count(),
            "invoices": Invoice.objects.count(),
            "cash": CashPayment.objects.count(),
            "cash_receipts": CashReceipt.objects.count(),
            "receipts": Receipt.objects.count(),
        } == before

    def test_no_billing_module_imports_the_care_ledger(self):
        """Structurel : le jour où quelqu'un écrit une ``LedgerEntry``
        depuis l'abonnement, les deux registres fusionnent en silence."""
        import pathlib
        import re

        root = pathlib.Path(__file__).resolve().parents[1] / "apps" / "billing"
        # Les IMPORTS seulement : le module a le droit de NOMMER le rail
        # diaspora dans ses commentaires — il a même le devoir d'expliquer
        # pourquoi il ne le touche pas.
        pattern = re.compile(
            r"^\s*(?:from|import)\s+(?:apps\.)?trustbridge", re.MULTILINE
        )
        offenders = [
            str(path.name)
            for path in root.rglob("*.py")
            if pattern.search(path.read_text(encoding="utf-8"))
        ]
        assert not offenders, offenders


# ---------------------------------------------------------------------------
# 8 — accord SQL ↔ dérivation, et audit
# ---------------------------------------------------------------------------


class TestTheBalanceIsSaidOnlyOnce:
    def test_the_sql_annotation_agrees_with_the_unit_derivation(self):
        """Patron ``unpaid_invoices_qs`` ↔ ``invoice_balance_kmf`` : deux
        lectures, un seul verdict."""
        _center, _director, subscription = billed_center(price_kmf="25000")
        untouched = make_subscription_invoice(subscription, amount_kmf="25000")
        partial = make_subscription_invoice(
            subscription, amount_kmf="25000",
            period_start=timezone.localdate() - timedelta(days=60),
        )
        settled = make_subscription_invoice(
            subscription, amount_kmf="25000",
            period_start=timezone.localdate() - timedelta(days=120),
        )
        reversed_one = make_subscription_invoice(
            subscription, amount_kmf="25000",
            period_start=timezone.localdate() - timedelta(days=180),
        )
        pay(partial, "10000")
        pay(settled, "25000")
        payment = pay(reversed_one, "25000")
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Rejeté."
        )

        unpaid = {
            row.pk: row.balance_kmf_agg
            for row in billing_services.unpaid_subscription_invoices_qs()
        }
        assert set(unpaid) == {untouched.pk, partial.pk, reversed_one.pk}
        for pk, annotated in unpaid.items():
            derived = billing_services.subscription_invoice_balance_kmf(
                SubscriptionInvoice.objects.get(pk=pk)
            )
            assert annotated == derived
        assert settled.pk not in unpaid


class TestAudit:
    def test_the_four_actions_are_written_with_references_only(self):
        center, _director, subscription = billed_center()
        invoice = issue(subscription)
        payment = pay(invoice, "10000")
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment,
            reason="Motif confidentiel de contre-passation.",
        )
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice,
            reason="Motif confidentiel d'annulation.",
        )
        actions = set(
            AuditLog.objects.filter(center=center).values_list("action", flat=True)
        )
        assert {
            AuditAction.SUBSCRIPTION_INVOICE_ISSUED,
            AuditAction.SUBSCRIPTION_PAYMENT_RECORDED,
            AuditAction.SUBSCRIPTION_PAYMENT_REVERSED,
            AuditAction.SUBSCRIPTION_INVOICE_CANCELLED,
        } <= actions
        blob = str(list(AuditLog.objects.values_list("payload", flat=True)))
        assert "confidentiel" not in blob
        for entry in AuditLog.objects.filter(
            action__in=(
                AuditAction.SUBSCRIPTION_PAYMENT_REVERSED,
                AuditAction.SUBSCRIPTION_INVOICE_CANCELLED,
            )
        ):
            assert entry.payload["has_reason"] is True

    def test_the_director_reads_the_money_of_his_own_center(self):
        """Liste blanche fail-closed (ADR 0018 invariant 6) : c'est SA
        facture d'abonnement, il doit la voir passer."""
        center, director, subscription = billed_center()
        invoice = issue(subscription)
        pay(invoice, "10000")
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        )
        assert response.status_code == 200
        actions = {row["action"] for row in response.data["results"]}
        assert AuditAction.SUBSCRIPTION_INVOICE_ISSUED in actions
        assert AuditAction.SUBSCRIPTION_PAYMENT_RECORDED in actions
