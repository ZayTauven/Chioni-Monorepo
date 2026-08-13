"""S1 — passe adversariale guardian sur le sprint « Assainissement ».

Probes pérennes (comme ``test_hardening`` et ``test_adversarial_api_recheck``)
sur les surfaces ouvertes ou déplacées par S1. Chaque classe documente
l'attaque qu'elle verrouille :

- ``TestCancelVersusPayInterleaving`` — LA course argent : une facture
  annulée pendant qu'un tuteur est dans ``pay/`` ne doit jamais laisser un
  intent vivant qui débite le tuteur vers un refus (le MVP n'a pas de
  remboursement). Fermée par le verrou de ligne facture pris dans
  ``create_payment_intent`` (ordre demande → facture, comme le webhook).
- ``TestConcurrentDoubleInvoicing`` — deux ``create_invoice`` simultanés
  sur les mêmes actes ne produisent jamais deux factures vivantes (double
  facturation du patient). Fermée par le verrou de ligne consultation.
- ``TestIdempotencyReplayIntegrity`` — une clé guichet rejouée avec une
  RÉFÉRENCE mobile money différente désigne une autre transaction du monde
  réel : refus explicite, jamais une fusion silencieuse (le second
  versement disparaîtrait des livres). Et la clé ne fuit nulle part
  (réponse API, payload d'audit).
- ``TestCancelReasonAudience`` — le motif d'annulation est un texte libre
  tapé à la caisse (même classe que le motif de litige, arbitrage C.3) :
  masqué aux rôles non BILLING, l'état ``cancelled_at`` restant visible.
- ``TestGuardian403Oracle`` — le 403 « scope » ne parle QUE de l'état du
  tuteur appelant : octets identiques qu'il n'ait jamais eu de lien, ait
  une invitation en attente, ou ait été révoqué.
- ``TestIdParamRobustness`` — des identifiants grotesques (30 chiffres)
  en query param ou dans le corps répondent 400/liste vide, jamais un 500.
"""

import threading

import pytest
from django.core.exceptions import ValidationError
from django.db import connections

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.medical.models import ActPerformed
from apps.patients.models import GuardianLink
from apps.patients.services import invite_guardian
from apps.trustbridge import services
from apps.trustbridge.fx import quote_eur_for_kmf as real_quote
from apps.trustbridge.models import CashPayment, Invoice, PaymentIntent

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_encounter, make_tariff, make_user
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

HUGE_ID = str(10**30)  # au-delà de tout bigint PostgreSQL


# ---------------------------------------------------------------------------
# 1. Annulation de facture × pay/ tuteur — la course qui débite vers un refus
# ---------------------------------------------------------------------------


class TestCancelVersusPayInterleaving:
    @pytest.mark.django_db(transaction=True)
    def test_cancellation_racing_pay_never_leaves_a_live_intent(self, monkeypatch):
        """Entrelacement FORCÉ (déterministe) : le fil « pay » est suspendu
        au moment du devis (donc APRÈS ses contrôles, AVANT la création de
        l'intent) pendant que la caisse annule la facture.

        Sans le verrou facture dans ``create_payment_intent``, la caisse ne
        voit aucun intent (pas encore créé), annule, et le fil pay repart
        créer un intent ``en_cours`` sur une facture annulée : le tuteur
        part au 3DS, paie, et le webhook refuse — un débit réel vers un
        refus, sans chemin de remboursement. Avec le verrou (ordre demande
        → facture, le même que le webhook), l'annulation attend le commit
        du pay puis est refusée par la garde anti-double-débit.
        """
        scn = build_scenario(status=Status.SENT)
        pay_at_quote = threading.Event()
        cancel_finished = threading.Event()
        outcomes, errors = {}, []

        def slow_quote(balance):
            # Le fil pay signale qu'il a passé tous ses contrôles, puis
            # laisse à l'annulation le temps de se produire (ou de se
            # bloquer sur le verrou de ligne — c'est tout l'enjeu).
            pay_at_quote.set()
            cancel_finished.wait(timeout=3)
            return real_quote(balance)

        monkeypatch.setattr(services, "quote_eur_for_kmf", slow_quote)

        def pay():
            try:
                services.create_payment_intent(
                    guardian_user=scn.guardian_user,
                    payment_request=scn.payment_request,
                )
                outcomes["pay"] = "intent_created"
            except ValidationError:
                outcomes["pay"] = "refused"
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                pay_at_quote.set()  # jamais de blocage du fil cancel
                connections.close_all()

        def cancel():
            try:
                pay_at_quote.wait(timeout=10)
                services.cancel_invoice(
                    actor=scn.cashier, invoice=scn.invoice,
                    reason="Annulée pendant le paiement",
                )
                outcomes["cancel"] = "cancelled"
            except ValidationError:
                outcomes["cancel"] = "refused"
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                cancel_finished.set()
                connections.close_all()

        threads = [threading.Thread(target=pay), threading.Thread(target=cancel)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert errors == []
        scn.invoice.refresh_from_db()
        live_intents = PaymentIntent.objects.filter(
            payment_request=scn.payment_request,
            status__in=(
                PaymentIntent.Status.CREATED, PaymentIntent.Status.PROCESSING,
            ),
        )
        # L'invariant qui compte : jamais un intent vivant SUR une facture
        # annulée (= un tuteur en train d'être débité vers un refus).
        assert not (
            scn.invoice.status == Invoice.Status.CANCELLED
            and live_intents.exists()
        ), "facture annulée avec un intent vivant : le tuteur paie vers un refus"
        # Et l'un des deux gestes a bien été refusé, explicitement.
        assert sorted(outcomes.values()) == ["intent_created", "refused"] or (
            sorted(outcomes.values()) == ["cancelled", "refused"]
        ), outcomes

    def test_pay_sequenced_after_cancellation_stays_refused(self):
        """Le cas séquentiel (non concurrent) reste un 400 propre — la
        régression de la revue 2a, revérifiée depuis le chemin API."""
        scn = build_scenario(status=Status.SENT)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice, reason="Erreur"
        )
        response = client_for(scn.guardian_user).post(
            f"/api/v1/guardian/payment-requests/{scn.payment_request.pk}/pay/"
        )
        assert response.status_code == 400
        assert not PaymentIntent.objects.exists()


# ---------------------------------------------------------------------------
# 2. Double facturation concurrente des mêmes actes
# ---------------------------------------------------------------------------


class TestConcurrentDoubleInvoicing:
    @pytest.mark.django_db(transaction=True)
    def test_two_simultaneous_create_invoice_bill_the_acts_once(self):
        """Deux guichets facturent la même consultation au même instant :
        le contrôle « acte déjà porté » ne vaut que sous verrou — sans le
        verrou de ligne consultation, les deux transactions le passent et
        DEUX factures vivantes portent les mêmes actes (le patient peut
        payer deux fois). Exactement une doit survivre."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        encounter = make_encounter(center=center)
        tariff = make_tariff(center, price_kmf="10000")
        act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)

        barrier = threading.Barrier(2, timeout=10)
        outcomes, errors = [], []

        def attempt(actor):
            try:
                barrier.wait()
                services.create_invoice(
                    actor=actor, center=center, encounter=encounter
                )
                outcomes.append("created")
            except ValidationError:
                outcomes.append("refused")
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(user,))
            for user in (cashier, director)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)

        assert errors == []
        assert sorted(outcomes) == ["created", "refused"], outcomes
        living = Invoice.objects.exclude(
            status=Invoice.Status.CANCELLED
        ).filter(lines__act=act)
        assert living.count() == 1, (
            "deux factures vivantes portent le même acte : double facturation"
        )


# ---------------------------------------------------------------------------
# 3. Idempotence guichet — intégrité du rejeu et non-fuite de la clé
# ---------------------------------------------------------------------------


def _issued_counter_scenario(price_kmf="20000"):
    scn = build_scenario(status="facture_brouillon", price_kmf=price_kmf)
    services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
    scn.invoice.refresh_from_db()
    return scn


class TestIdempotencyReplayIntegrity:
    def _post(self, scn, **body):
        return client_for(scn.cashier).post(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/payments/",
            {"method": "especes", "amount_kmf": "5000", **body},
        )

    def test_replay_with_a_different_reference_is_refused(self):
        """La référence est l'identifiant de la transaction du monde réel
        (mobile money) : une clé rejouée avec une AUTRE référence désigne
        un AUTRE versement — le « fusionner » silencieusement ferait
        disparaître ce versement des livres. Refus explicite, rien d'écrit."""
        scn = _issued_counter_scenario()
        first = self._post(scn, reference="TXN-0001", idempotency_key="k-ref")
        assert first.status_code == 201, first.content
        mismatch = self._post(scn, reference="TXN-0002", idempotency_key="k-ref")
        assert mismatch.status_code == 400
        assert "clé d'idempotence" in str(mismatch.data)
        assert CashPayment.objects.count() == 1
        # Le rejeu à l'identique, lui, reste un 200 avec le même paiement.
        replay = self._post(scn, reference="TXN-0001", idempotency_key="k-ref")
        assert replay.status_code == 200
        assert replay.data["id"] == first.data["id"]

    def test_the_key_never_leaks_in_responses_or_audit(self):
        """La clé est un texte libre choisi par le client du guichet : elle
        n'appartient ni aux payloads API (aucun serializer ne la porte) ni
        aux payloads d'audit (références only, ADR 0007)."""
        scn = _issued_counter_scenario()
        key = "cle-secrete-du-guichet-42"
        first = self._post(scn, idempotency_key=key)
        assert first.status_code == 201
        assert key not in first.content.decode("utf-8")
        assert "idempotency" not in first.content.decode("utf-8")
        replay = self._post(scn, idempotency_key=key)
        assert replay.status_code == 200
        assert key not in replay.content.decode("utf-8")
        entry = AuditLog.objects.get(action=AuditAction.CASH_PAYMENT_RECORDED)
        assert key not in str(entry.payload)


# ---------------------------------------------------------------------------
# 4. Le motif d'annulation est un texte de caisse — pas une lecture tout-staff
# ---------------------------------------------------------------------------


class TestCancelReasonAudience:
    def _cancelled_scenario(self):
        scn = build_scenario(status="facture_brouillon")
        services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        services.cancel_invoice(
            actor=scn.cashier, invoice=scn.invoice,
            reason="Le patient conteste la présence du Dr X",
        )
        return scn

    def test_billing_roles_read_the_reason(self):
        scn = self._cancelled_scenario()
        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/"
        )
        assert response.status_code == 200
        assert response.data["cancel_reason"] == (
            "Le patient conteste la présence du Dr X"
        )

    @pytest.mark.parametrize(
        "role", [Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST]
    )
    def test_non_billing_staff_see_the_state_never_the_narrative(self, role):
        """Arbitrage C.3 appliqué à lui-même : le motif d'annulation est la
        même classe de texte libre que le motif d'un litige ou d'une
        contre-passation (tous deux BILLING-only). L'ÉTAT (annulée, quand)
        reste visible de tout le staff — le récit, non."""
        scn = self._cancelled_scenario()
        staff = make_staff_user(scn.center, role=role)
        detail = client_for(staff).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/"
        )
        assert detail.status_code == 200
        assert "cancel_reason" not in detail.data, role
        assert detail.data["cancelled_at"] is not None
        assert detail.data["status"] == Invoice.Status.CANCELLED
        listing = client_for(staff).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/"
        )
        assert listing.status_code == 200
        assert "conteste" not in listing.content.decode("utf-8")


# ---------------------------------------------------------------------------
# 5. Le 403 tuteur ne raconte JAMAIS l'histoire des liens
# ---------------------------------------------------------------------------


class TestGuardian403Oracle:
    URL = "/api/v1/guardian/payment-requests/"

    def test_the_scoped_403_is_byte_identical_whatever_the_link_history(self):
        """Trois tuteurs, trois histoires : jamais lié, invitation jamais
        acceptée, lien révoqué. Le 403 « scope » doit être STRICTEMENT le
        même corps de réponse — un tuteur révoqué n'apprend rien de plus
        qu'un tuteur neuf, la réponse ne parle que de son propre état."""
        never_user, _ = make_guardian_user()

        invited_user = make_user(phone="+2693399077")
        make_guardian_user(user=invited_user)
        patient = make_claimed_patient()
        invite_guardian(
            actor=patient.user, patient=patient, phone="+2693399077",
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )

        revoked_user, revoked_profile = make_guardian_user()
        link = make_active_link(revoked_profile, make_claimed_patient())
        link.revoke()

        bodies = set()
        for user in (never_user, invited_user, revoked_user):
            response = client_for(user).get(self.URL)
            assert response.status_code == 403
            bodies.add(response.content)
        assert len(bodies) == 1, "le corps du 403 varie selon l'histoire des liens"


# ---------------------------------------------------------------------------
# 6. Identifiants grotesques — jamais un 500
# ---------------------------------------------------------------------------


class TestIdParamRobustness:
    def test_huge_query_param_ids_answer_an_empty_page_never_500(self):
        scn = build_scenario(status="facture_brouillon")
        client = client_for(scn.cashier)
        for url in (
            f"/api/v1/centers/{scn.center.pk}/invoices/?patient={HUGE_ID}",
            f"/api/v1/centers/{scn.center.pk}/encounters/?patient={HUGE_ID}",
            f"/api/v1/centers/{scn.center.pk}/encounters/?practitioner={HUGE_ID}",
        ):
            response = client.get(url)
            assert response.status_code == 200, (url, response.status_code)
            assert response.data["results"] == [], url

    def test_huge_body_ids_answer_the_same_explicit_400(self):
        """Le corps aussi : un id à 30 chiffres suit exactement le chemin
        d'un id inexistant (même message, rien ne fuit, jamais un 500)."""
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        huge = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/",
            {"patient": HUGE_ID, "reason": "Sonde"},
            format="json",
        )
        unknown = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/encounters/",
            {"patient": 999999, "reason": "Sonde"},
            format="json",
        )
        assert huge.status_code == 400
        assert huge.data == unknown.data
