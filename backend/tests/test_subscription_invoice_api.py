"""S5 lot 2 (ADR 0018 décision 4) — l'API de la facturation SaaS.

Deux côtés, deux audiences, deux contrats :

- **côté centre** : `GET /centers/{c}/subscription/invoices/[{pk}/]`,
  **DIRECTEUR SEUL** (même arbitrage que le contrat lui-même, lot 1 — la
  garde frontend doit refléter la permission backend, sinon l'écran
  s'affiche pour recevoir un 403). Lecture uniquement : c'est Chioni qui
  émet, encaisse, contre-passe et annule ;
- **côté plateforme** : `support` lit, `admin` seul écrit (le balayage
  exhaustif « un support n'écrit rien » vit dans
  ``test_permissions_platform.py``).

Norme S1 des refus, vérifiée ici : une référence en URL → **404**, une
référence dans le CORPS → **400 explicite**.
"""

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.accounts.models import PlatformStaff
from apps.billing import services as billing_services
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
)
from apps.centers.models import StaffMembership

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import (
    make_plan,
    make_platform_staff,
    make_subscription,
    make_subscription_invoice,
)

pytestmark = pytest.mark.django_db

Role = StaffMembership.Role
Status = CenterSubscription.Status
InvoiceStatus = SubscriptionInvoice.Status


def operator(role=PlatformStaff.Role.ADMIN):
    user, _op = make_platform_staff(role=role)
    return user


def scenario(price_kmf="25000", status=Status.ACTIVE):
    center, director = make_center_with_director(name="Clinique Ylang")
    subscription = make_subscription(
        center=center, plan=make_plan(price_kmf=price_kmf), status=status
    )
    return center, director, subscription


def center_url(center, suffix=""):
    return f"/api/v1/centers/{center.pk}/subscription/invoices/{suffix}"


# ---------------------------------------------------------------------------
# Côté centre — le directeur lit ses factures, et lui seul
# ---------------------------------------------------------------------------


class TestTheDirectorReadsHisBills:
    def test_the_payload_is_exactly_the_contract(self):
        center, director, subscription = scenario()
        invoice = make_subscription_invoice(subscription, amount_kmf="25000")
        billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice, amount_kmf=Decimal("10000"),
            method=SubscriptionPayment.Method.TRANSFER, reference="VIR-42",
        )
        response = client_for(director).get(center_url(center))
        assert response.status_code == 200
        (row,) = response.data["results"]
        assert set(row) == {
            "id", "number", "status", "period_start", "period_end",
            "amount_kmf", "paid_kmf", "balance_kmf", "due_date",
            "plan_code", "plan_label", "created_at", "cancelled_at",
            "cancel_reason", "payments",
        }
        assert row["number"] == invoice.number
        assert row["balance_kmf"] == "15000.00"
        (payment,) = row["payments"]
        assert payment["reference"] == "VIR-42"
        assert payment["reversed"] is False
        # L'identité de l'exploitant Chioni qui a saisi la ligne ne
        # traverse pas : le directeur lirait une personne qu'il n'a aucun
        # autre moyen de voir.
        assert "recorded_by" not in payment

    def test_a_reversal_is_explained_not_just_signalled(self):
        center, director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        payment = billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice, amount_kmf=Decimal("5000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Virement rejeté par la banque."
        )
        response = client_for(director).get(center_url(center, f"{invoice.pk}/"))
        (line,) = response.data["payments"]
        assert line["reversed"] is True
        assert line["reversal_reason"] == "Virement rejeté par la banque."

    def test_no_invoice_yet_is_an_empty_list_not_a_404(self):
        """« Pas de contrat » (404 sur la route contrat) et « pas encore de
        facture » (200 vide) ne sont pas la même nouvelle."""
        center, director, _subscription = scenario()
        response = client_for(director).get(center_url(center))
        assert response.status_code == 200
        assert response.data["results"] == []

    def test_the_status_filter_is_validated(self):
        center, director, subscription = scenario()
        make_subscription_invoice(subscription)
        cancelled = make_subscription_invoice(
            subscription,
            period_start=timezone.localdate().replace(day=1).replace(year=2025),
        )
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=cancelled, reason="Erreur."
        )
        client = client_for(director)
        assert len(client.get(center_url(center) + "?status=emise").data["results"]) == 1
        assert (
            len(client.get(center_url(center) + "?status=annulee").data["results"]) == 1
        )
        bad = client.get(center_url(center) + "?status=inconnu")
        assert bad.status_code == 400
        assert bad.data["status"] == ["Statut inconnu."]

    def test_reading_is_never_frozen(self):
        """C'est même par là qu'un directeur gelé comprend ce qu'il doit."""
        center, director, subscription = scenario()
        make_subscription_invoice(subscription)
        subscription.status = Status.SUSPENDED
        subscription.status_reason = "Trois échéances impayées."
        subscription.save(update_fields=["status", "status_reason", "updated_at"])
        assert client_for(director).get(center_url(center)).status_code == 200


class TestNobodyElseReadsThem:
    @pytest.mark.parametrize(
        "role", [Role.CASHIER, Role.SECRETARY, Role.DOCTOR, Role.NURSE]
    )
    def test_the_rest_of_the_staff_is_refused(self, role):
        center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        user = make_staff_user(center, role=role)
        client = client_for(user)
        assert client.get(center_url(center)).status_code == 403
        assert client.get(center_url(center, f"{invoice.pk}/")).status_code == 403

    def test_a_patient_never_sees_what_the_center_owes_chioni(self):
        center, _director, subscription = scenario()
        make_subscription_invoice(subscription)
        patient = make_claimed_patient()
        assert client_for(patient.user).get(center_url(center)).status_code in (
            403, 404
        )

    def test_a_director_of_another_center_gets_a_404(self):
        """Cloisonnement : le centre est en URL → 404, jamais 403 (qui
        confirmerait l'existence du tenant voisin)."""
        center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        _other, neighbour_director = make_center_with_director(name="Voisin")
        client = client_for(neighbour_director)
        assert client.get(center_url(center)).status_code == 404
        assert client.get(center_url(center, f"{invoice.pk}/")).status_code == 404

    def test_a_foreign_invoice_id_is_a_404_not_a_leak(self):
        center, director, _subscription = scenario()
        _other_center, _other_director, other_subscription = scenario()
        foreign = make_subscription_invoice(other_subscription)
        response = client_for(director).get(center_url(center, f"{foreign.pk}/"))
        assert response.status_code == 404

    def test_anonymous_is_401(self):
        center, _director, _subscription = scenario()
        assert client_for().get(center_url(center)).status_code == 401


# ---------------------------------------------------------------------------
# Côté plateforme — émettre, encaisser, corriger
# ---------------------------------------------------------------------------


class TestPlatformIssuance:
    def test_an_admin_issues_the_due_period(self):
        _center, _director, subscription = scenario()
        response = client_for(operator()).post(
            f"/api/v1/platform/subscriptions/{subscription.pk}/invoices/", {}
        )
        assert response.status_code == 201, response.content
        assert response.data["number"] == "A-000001"
        assert response.data["balance_kmf"] == "25000.00"
        assert response.data["center_name"] == "Clinique Ylang"

    def test_issuing_twice_is_refused_in_french(self):
        _center, _director, subscription = scenario()
        client = client_for(operator())
        url = f"/api/v1/platform/subscriptions/{subscription.pk}/invoices/"
        assert client.post(url, {}).status_code == 201
        second = client.post(url, {})
        assert second.status_code == 400
        assert "pas encore arrivée à terme" in str(second.data)
        assert SubscriptionInvoice.objects.count() == 1

    def test_a_frozen_contract_accumulates_no_new_debt(self):
        _center, _director, subscription = scenario(status=Status.SUSPENDED)
        response = client_for(operator()).post(
            f"/api/v1/platform/subscriptions/{subscription.pk}/invoices/", {}
        )
        assert response.status_code == 400
        assert "n'est pas facturé" in str(response.data)

    def test_an_unknown_subscription_is_a_404(self):
        response = client_for(operator()).post(
            "/api/v1/platform/subscriptions/999999/invoices/", {}
        )
        assert response.status_code == 404

    def test_the_list_of_one_contract_is_scoped_to_it(self):
        _c1, _d1, first = scenario()
        _c2, _d2, second = scenario()
        make_subscription_invoice(first)
        make_subscription_invoice(second)
        response = client_for(operator(PlatformStaff.Role.SUPPORT)).get(
            f"/api/v1/platform/subscriptions/{first.pk}/invoices/"
        )
        assert response.status_code == 200
        assert [row["subscription"] for row in response.data["results"]] == [first.pk]


class TestPlatformSettlements:
    def test_recording_a_settlement_answers_the_whole_invoice(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription, amount_kmf="25000")
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}/payments/",
            {"amount_kmf": "10000", "method": "virement", "reference": "VIR-7"},
        )
        assert response.status_code == 201, response.content
        assert response.data["balance_kmf"] == "15000.00"
        assert response.data["status"] == InvoiceStatus.ISSUED
        (line,) = response.data["payments"]
        assert line["method"] == "virement"

    def test_settling_the_last_franc_marks_it_paid(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription, amount_kmf="25000")
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}/payments/",
            {"amount_kmf": "25000", "method": "especes"},
        )
        assert response.data["status"] == InvoiceStatus.PAID
        assert response.data["balance_kmf"] == "0.00"

    def test_overshooting_the_balance_is_a_400(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription, amount_kmf="25000")
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}/payments/",
            {"amount_kmf": "30000", "method": "virement"},
        )
        assert response.status_code == 400
        assert "dépasse le solde" in str(response.data)
        assert not SubscriptionPayment.objects.exists()

    def test_an_unknown_method_is_a_400_per_field(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}/payments/",
            {"amount_kmf": "1000", "method": "bitcoin"},
        )
        assert response.status_code == 400
        assert "method" in response.data

    def test_settling_an_overdue_invoice_lifts_the_unpaid_flag(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=5
        )
        billing_services.flag_overdue_subscriptions()
        subscription.refresh_from_db()
        assert subscription.status == Status.UNPAID
        client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}/payments/",
            {"amount_kmf": "25000", "method": "virement"},
        )
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE

    def test_an_unknown_invoice_is_a_404(self):
        response = client_for(operator()).post(
            "/api/v1/platform/subscription-invoices/999999/payments/",
            {"amount_kmf": "1000", "method": "virement"},
        )
        assert response.status_code == 404


class TestPlatformCorrections:
    def test_reversing_reopens_the_balance(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription, amount_kmf="5000")
        payment = billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice, amount_kmf=Decimal("5000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice.pk}"
            f"/payments/{payment.pk}/reverse/",
            {"reason": "Virement jamais parvenu."},
        )
        assert response.status_code == 201, response.content
        assert response.data["status"] == InvoiceStatus.ISSUED
        assert response.data["balance_kmf"] == "5000.00"
        (line,) = response.data["payments"]
        assert line["reversed"] is True

    def test_a_reversal_without_a_motive_is_a_400_per_field(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        payment = billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice, amount_kmf=Decimal("1000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        url = (
            f"/api/v1/platform/subscription-invoices/{invoice.pk}"
            f"/payments/{payment.pk}/reverse/"
        )
        client = client_for(operator())
        for body in ({}, {"reason": ""}):
            response = client.post(url, body)
            assert response.status_code == 400
            assert response.data["reason"] == ["Le motif est obligatoire."]

    def test_a_settlement_of_another_invoice_is_a_404(self):
        """Référence en URL → 404 (norme S1), jamais une contre-passation
        croisée."""
        _c1, _d1, first = scenario()
        _c2, _d2, second = scenario()
        invoice_a = make_subscription_invoice(first)
        invoice_b = make_subscription_invoice(second)
        payment_b = billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice_b, amount_kmf=Decimal("1000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        response = client_for(operator()).post(
            f"/api/v1/platform/subscription-invoices/{invoice_a.pk}"
            f"/payments/{payment_b.pk}/reverse/",
            {"reason": "Tentative croisée."},
        )
        assert response.status_code == 404

    def test_cancelling_needs_a_motive_and_a_clean_invoice(self):
        _center, _director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        url = f"/api/v1/platform/subscription-invoices/{invoice.pk}/cancel/"
        client = client_for(operator())
        assert client.post(url, {}).status_code == 400

        payment = billing_services.record_subscription_payment(
            actor=operator(), invoice=invoice, amount_kmf=Decimal("1000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        blocked = client.post(url, {"reason": "Erreur de période."})
        assert blocked.status_code == 400
        assert "contre-passez" in str(blocked.data)

        billing_services.reverse_subscription_payment(
            actor=operator(), payment=payment, reason="Erreur de saisie."
        )
        cancelled = client.post(url, {"reason": "Erreur de période."})
        assert cancelled.status_code == 200
        assert cancelled.data["status"] == InvoiceStatus.CANCELLED
        assert cancelled.data["cancel_reason"] == "Erreur de période."

    def test_the_center_reads_the_cancellation_motive_chioni_wrote_for_it(self):
        """Asymétrie assumée avec ``Invoice.cancel_reason`` (BILLING seul,
        écrit par le centre sur la facture d'un patient) : celui-ci est
        écrit par CHIONI et adressé au directeur."""
        center, director, subscription = scenario()
        invoice = make_subscription_invoice(subscription)
        billing_services.cancel_subscription_invoice(
            actor=operator(), invoice=invoice, reason="Doublon de facturation."
        )
        response = client_for(director).get(center_url(center, f"{invoice.pk}/"))
        assert response.data["cancel_reason"] == "Doublon de facturation."


class TestPlatformRegister:
    def test_the_overdue_filter_matches_the_flagging_rule(self):
        _c1, _d1, first = scenario()
        _c2, _d2, second = scenario()
        overdue = make_subscription_invoice(first, days_overdue=3)
        make_subscription_invoice(second, days_overdue=-3)  # échéance à venir
        response = client_for(operator(PlatformStaff.Role.SUPPORT)).get(
            "/api/v1/platform/subscription-invoices/?overdue=true"
        )
        assert response.status_code == 200
        assert [row["id"] for row in response.data["results"]] == [overdue.pk]

    @pytest.mark.parametrize(
        "query,field",
        [
            ("status=inconnu", "status"),
            ("center=abc", "center"),
            ("overdue=peut-etre", "overdue"),
        ],
    )
    def test_every_filter_answers_400_per_field(self, query, field):
        response = client_for(operator()).get(
            f"/api/v1/platform/subscription-invoices/?{query}"
        )
        assert response.status_code == 400
        assert field in response.data

    def test_filtering_by_center(self):
        center, _director, subscription = scenario()
        _c2, _d2, other = scenario()
        mine = make_subscription_invoice(subscription)
        make_subscription_invoice(other)
        response = client_for(operator()).get(
            f"/api/v1/platform/subscription-invoices/?center={center.pk}"
        )
        assert [row["id"] for row in response.data["results"]] == [mine.pk]
