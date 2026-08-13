"""Campagne adversariale — caisse « encaissement généralisé » (vague 2a).

Attaques exécutées contre l'ADR 0015, conservées en régression :

- **Courses réelles à threads** : webhook PSP contre caissier sur la même
  facture (un seul franc ne doit jamais entrer deux fois), deux webhooks
  concurrents sur deux intents pendants de la même demande, contre-passation
  contre webhook (les deux ordres d'arrivée doivent laisser des livres
  cohérents).
- **Cas mixte guichet + diaspora** : contre-passer une tranche guichet d'une
  facture soldée par le PSP — l'état résultant doit être honnête et le
  reliquat recouvrable ; l'encaissement `pont_confiance` lui-même ne se
  contre-passe JAMAIS (API : 400, zéro écriture).
- **Facture annulée** (faille corrigée par cette campagne) : le rail
  diaspora refusait déjà… rien. `record_cash_payment` refusait une facture
  `annulee` mais quote/intent/webhook/send l'acceptaient — un tuteur
  pouvait être débité pour une facture annulée par le centre.
- **Intégrité** : rejeu du webhook = UN seul CashPayment `pont_confiance` ;
  triggers SQL bruts (DELETE encaissement, UPDATE n° de reçu, DELETE
  contre-passation) ; montants sub-franc refusés au niveau service.
- **Confidentialité** : le payload tuteur ne bouge pas d'un champ après des
  tranches guichet et une contre-passation (jamais un reçu G-, un moyen de
  paiement guichet ni un motif) ; un médecin ne lit même pas la liste des
  encaissements.
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection, connections, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.common.models import Currency
from apps.trustbridge import services
from apps.trustbridge.models import (
    CashPayment,
    CashPaymentReversal,
    CashReceipt,
    Invoice,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
)

from .api_helpers import client_for
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

Method = CashPayment.Method
Account = LedgerEntry.Account
Direction = LedgerEntry.Direction


def age_intent(intent, minutes=60):
    PaymentIntent.objects.filter(pk=intent.pk).update(
        created_at=timezone.now() - timedelta(minutes=minutes)
    )


def counter_pay(scn, amount, actor=None):
    return services.record_cash_payment(
        actor=actor or scn.cashier,
        center=scn.center,
        invoice=scn.invoice,
        method=Method.CASH,
        amount_kmf=Decimal(amount),
    )


def cancel_invoice(invoice):
    """La voie d'accès réelle à l'état `annulee` aujourd'hui : l'admin
    (le champ status y est éditable) ou le shell — aucun service ne le
    fait. Le guichet s'en défendait déjà ; le rail diaspora doit aussi."""
    invoice.refresh_from_db()
    invoice.status = Invoice.Status.CANCELLED
    invoice.save(update_fields=["status", "updated_at"])


def run_threads(*targets):
    barrier = threading.Barrier(len(targets), timeout=10)
    outcomes = []

    def wrap(fn):
        def runner():
            try:
                barrier.wait()
                outcomes.append(("ok", fn()))
            except ValidationError as exc:
                outcomes.append(("refused", str(exc)))
            finally:
                connections.close_all()

        return runner

    threads = [threading.Thread(target=wrap(fn)) for fn in targets]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)
    return outcomes


# ---------------------------------------------------------------------------
# Courses réelles — un franc n'entre jamais deux fois
# ---------------------------------------------------------------------------


class TestMoneyRaces:
    @pytest.mark.django_db(transaction=True)
    def test_webhook_and_cashier_race_exactly_one_full_collection(self):
        """Intent diaspora figé sur la totalité (20 000), devenu vieux (la
        garde miroir ne bloque plus le guichet) ; le webhook tardif et un
        encaissement guichet de 20 000 partent au même instant. Quel que
        soit l'ordre, UNE seule collecte aboutit — jamais 40 000."""
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        age_intent(intent)

        outcomes = run_threads(
            lambda: services.register_payment_success(intent=intent),
            lambda: counter_pay(scn, "20000"),
        )
        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("20000")
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        # Le ledger corrobore : une seule collecte de 20 000 KMF est entrée
        # (crédit du_au_centre OU crédit créances via le débit caisse).
        collected = CashPayment.objects.filter(
            invoice=scn.invoice, reversal__isnull=True
        )
        assert collected.count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_pending_intents_concurrent_webhooks_single_cash_in(self):
        """Deux intents pendants coexistent (le premier a vieilli, la garde
        laisse passer le second) : deux webhooks SUCCESS simultanés. Un
        seul encaisse ; l'autre est refusé ET audité — jamais deux
        CashPayment pont_confiance, jamais deux fois 15 000."""
        scn = build_scenario(status=Status.SENT)
        first = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        age_intent(first)
        second = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )

        outcomes = run_threads(
            lambda: services.register_payment_success(intent=first),
            lambda: services.register_payment_success(intent=second),
        )
        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        assert (
            CashPayment.objects.filter(
                invoice=scn.invoice, method=Method.TRUST_BRIDGE
            ).count()
            == 1
        )
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("15000")
        succeeded = PaymentIntent.objects.filter(
            payment_request=scn.payment_request,
            status=PaymentIntent.Status.SUCCEEDED,
        )
        assert succeeded.count() == 1
        assert AuditLog.objects.filter(
            action=AuditAction.PAYMENT_WEBHOOK_REFUSED
        ).exists()

    @pytest.mark.django_db(transaction=True)
    def test_reversal_racing_webhook_leaves_consistent_books(self):
        """Facture 20 000, tranche guichet 5 000, intent figé sur 15 000.
        La contre-passation de la tranche et le webhook partent ensemble.
        Deux ordres possibles, deux états HONNÊTES possibles — mais dans
        les deux cas : encaissé = Σ non-contre-passés, jamais de solde
        négatif, jamais un intent réussi sans son CashPayment."""
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        tranche = counter_pay(scn, "5000")
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        assert intent.amount_kmf == Decimal("15000")

        run_threads(
            lambda: services.register_payment_success(intent=intent),
            lambda: services.reverse_cash_payment(
                actor=scn.cashier, cash_payment=tranche, reason="Erreur de saisie"
            ),
        )
        intent.refresh_from_db()
        scn.invoice.refresh_from_db()
        balance = services.invoice_balance_kmf(scn.invoice)
        assert balance >= 0
        if intent.status == PaymentIntent.Status.SUCCEEDED:
            # Webhook premier : 15 000 diaspora entrés, puis la tranche de
            # 5 000 contre-passée — la facture redoit 5 000 et le dit.
            assert CashPayment.objects.filter(
                invoice=scn.invoice, method=Method.TRUST_BRIDGE
            ).exists()
            assert balance == Decimal("5000")
            assert scn.invoice.status == Invoice.Status.ISSUED
        else:
            # Contre-passation première : le solde vaut 20 000, l'intent de
            # 15 000 est refusé sans écrire un franc (trace d'audit).
            assert balance == Decimal("20000")
            assert not CashPayment.objects.filter(
                invoice=scn.invoice, method=Method.TRUST_BRIDGE
            ).exists()
            refusal = AuditLog.objects.get(
                action=AuditAction.PAYMENT_WEBHOOK_REFUSED
            )
            assert refusal.payload["refusal"] == "balance_changed"


# ---------------------------------------------------------------------------
# Rejeu du webhook — le recouvrement n'introduit pas de double écriture
# ---------------------------------------------------------------------------


class TestWebhookReplayStillSingleCashPayment:
    def test_replay_never_duplicates_the_trust_bridge_cash_payment(self):
        scn = build_scenario(status=Status.PAID)
        # Rejeu strict du même succès : no-op AVANT la création du
        # CashPayment — le recouvrement ADR 0015 ne casse pas l'idempotence.
        services.register_payment_success(intent=scn.intent)
        services.register_payment_success(intent=scn.intent)
        assert (
            CashPayment.objects.filter(
                invoice=scn.invoice, method=Method.TRUST_BRIDGE
            ).count()
            == 1
        )
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("15000")


# ---------------------------------------------------------------------------
# Cas mixte guichet + diaspora — honnêteté de l'état, reliquat recouvrable
# ---------------------------------------------------------------------------


class TestMixedReversalAfterDiasporaSettlement:
    def test_state_is_honest_and_the_remainder_is_recoverable(self):
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        tranche = counter_pay(scn, "5000")
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        services.register_payment_success(intent=intent)
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID

        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=tranche, reason="Doublon de saisie"
        )
        scn.invoice.refresh_from_db()
        scn.payment_request.refresh_from_db()
        # Honnête : la facture redoit 5 000 ; la demande reste payée (SA
        # part diaspora a bien été encaissée) — cas documenté ADR 0015 §5.
        assert scn.invoice.status == Invoice.Status.ISSUED
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("5000")
        assert scn.payment_request.status == Status.PAID
        assert scn.payment_request.paid_at is not None
        # Une seconde demande de paiement reste interdite (limitation
        # assumée : le reliquat se recouvre au guichet).
        with pytest.raises(ValidationError, match="existe déjà"):
            services.create_payment_request(
                actor=scn.cashier, invoice=scn.invoice
            )
        # Le reliquat se recouvre au guichet, la facture se solde…
        counter_pay(scn, "5000")
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        # …et la clôture diaspora réconcilie toujours les 15 000 du tuteur.
        services.confirm_care(actor=scn.doctor, payment_request=scn.payment_request)
        receipt = services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert receipt.amount_kmf_received == Decimal("15000")

    def test_trust_bridge_cash_in_reverse_api_answers_400_and_writes_nothing(self):
        """Contre-passer l'encaissement pont_confiance au guichet serait
        rembourser la diaspora sans PSP : 400, zéro ligne, zéro écriture."""
        scn = build_scenario(status=Status.PAID)
        payment = CashPayment.objects.get(
            invoice=scn.invoice, method=Method.TRUST_BRIDGE
        )
        tx_before = LedgerTransaction.objects.count()
        url = (
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}"
            f"/payments/{payment.pk}/reverse/"
        )
        response = client_for(scn.cashier).post(
            url, {"reason": "Le tuteur veut être remboursé"}, format="json"
        )
        assert response.status_code == 400
        assert "litige" in str(response.data)
        assert not CashPaymentReversal.objects.exists()
        assert LedgerTransaction.objects.count() == tx_before
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID


# ---------------------------------------------------------------------------
# Facture annulée — le rail diaspora doit refuser comme le guichet
# ---------------------------------------------------------------------------


class TestCancelledInvoiceClosesTheDiasporaRail:
    """Le guichet refusait déjà une facture `annulee` ; sans ces gardes, un
    tuteur pouvait recevoir un devis, être débité et le webhook encaissait
    une facture annulée (annulee → payee en silence)."""

    def test_quote_refuses_a_cancelled_invoice(self):
        scn = build_scenario(status=Status.SENT)
        cancel_invoice(scn.invoice)
        with pytest.raises(ValidationError, match="annulée"):
            services.quote_payment_request(scn.payment_request)

    def test_create_intent_refuses_a_cancelled_invoice(self):
        scn = build_scenario(status=Status.SENT)
        cancel_invoice(scn.invoice)
        with pytest.raises(ValidationError, match="annulée"):
            services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )
        assert not PaymentIntent.objects.exists()

    def test_webhook_success_refuses_a_cancelled_invoice_without_writing(self):
        scn = build_scenario(status=Status.SENT)
        intent = services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        cancel_invoice(scn.invoice)
        with pytest.raises(ValidationError, match="annulée"):
            services.register_payment_success(intent=intent)
        intent.refresh_from_db()
        scn.invoice.refresh_from_db()
        scn.payment_request.refresh_from_db()
        assert intent.status == PaymentIntent.Status.PROCESSING
        assert intent.ledger_transaction_id is None
        assert scn.invoice.status == Invoice.Status.CANCELLED
        assert scn.payment_request.status == Status.SENT
        assert not CashPayment.objects.filter(invoice=scn.invoice).exists()
        # Le fournisseur a pu débiter : la pièce de réconciliation existe.
        refusal = AuditLog.objects.get(action=AuditAction.PAYMENT_WEBHOOK_REFUSED)
        assert refusal.payload["refusal"] == "invoice_cancelled"

    def test_send_refuses_a_request_on_a_cancelled_invoice(self):
        scn = build_scenario(status=Status.DRAFT)
        services.share_payment_request(
            actor=scn.cashier,
            payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        cancel_invoice(scn.invoice)
        with pytest.raises(ValidationError, match="annulée"):
            services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )


# ---------------------------------------------------------------------------
# Intégrité — triggers SQL bruts (matrice complétée) et montants sub-franc
# ---------------------------------------------------------------------------


class TestRawSqlTriggerMatrixCompleted:
    def _payment(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        scn.invoice.refresh_from_db()
        return scn, counter_pay(scn, "5000")

    def test_raw_delete_on_cash_payment_is_blocked(self):
        scn, payment = self._payment()
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "DELETE FROM trustbridge_cashpayment WHERE id = %s",
                        [payment.pk],
                    )
        assert CashPayment.objects.filter(pk=payment.pk).exists()

    def test_raw_update_of_a_receipt_number_is_blocked(self):
        """Renuméroter un reçu en SQL brut = maquiller la série G-."""
        scn, payment = self._payment()
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE trustbridge_cashreceipt "
                        "SET sequence_number = 999 WHERE id = %s",
                        [payment.cash_receipt.pk],
                    )
        payment.cash_receipt.refresh_from_db()
        assert payment.cash_receipt.sequence_number == 1

    def test_raw_delete_of_a_reversal_is_blocked(self):
        """Effacer une contre-passation ferait repasser l'encaissement pour
        valide (invoice_paid_kmf le recompterait) : refusé par le trigger."""
        scn, payment = self._payment()
        reversal = services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=payment, reason="Erreur"
        )
        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "DELETE FROM trustbridge_cashpaymentreversal "
                        "WHERE id = %s",
                        [reversal.pk],
                    )
        assert services.invoice_paid_kmf(scn.invoice) == Decimal("0")


class TestSubFrancAmounts:
    def test_service_refuses_sub_franc_amounts_even_without_the_serializer(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        scn.invoice.refresh_from_db()
        for bad in ("0.001", "0.5", "0.99"):
            with pytest.raises(ValidationError, match="décimales"):
                counter_pay(scn, bad)
        assert not CashPayment.objects.exists()


# ---------------------------------------------------------------------------
# Confidentialité — le contrat tuteur ne bouge pas, le médecin ne lit pas
# ---------------------------------------------------------------------------


class TestGuardianPayloadUntouchedByCounterActivity:
    GUARDIAN_FIELDS = {
        "id", "patient", "center_name", "total_kmf", "status",
        "paid_at", "lines", "created_at",
    }

    def test_counter_tranches_and_reversal_leak_nothing_to_the_guardian(self):
        scn = build_scenario(status=Status.SENT, price_kmf="20000")
        tranche = counter_pay(scn, "5000")
        services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=tranche,
            reason="Le patient a payé pour un autre soin",
        )
        counter_pay(scn, "3000")
        detail = client_for(scn.guardian_user).get(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/"
        )
        assert detail.status_code == 200
        assert set(detail.data.keys()) == self.GUARDIAN_FIELDS
        blob = str(detail.data)
        # Jamais un reçu guichet, un moyen de paiement guichet, un motif de
        # contre-passation ni un montant de tranche dans le payload tuteur.
        for forbidden in ("G-0000", "especes", "mobile_money", "reversal",
                          "receipt", "payé pour un autre soin"):
            assert forbidden not in blob, forbidden
        # Le devis, lui, porte le solde restant — c'est le contrat ADR 0015.
        quote = client_for(scn.guardian_user).get(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/quote/"
        )
        assert Decimal(quote.data["amount_kmf"]) == Decimal("17000")

    def test_doctor_cannot_even_read_the_payments_list(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        scn.invoice.refresh_from_db()
        counter_pay(scn, "5000")
        url = (
            f"/api/v1/centers/{scn.center.pk}/invoices/"
            f"{scn.invoice.pk}/payments/"
        )
        assert client_for(scn.doctor).get(url).status_code == 403
