"""Campagne adversariale — pilotage (stats) vague 2b + correctif tarif.

Probes pérennes de la revue guardian sur ``apps/centers/stats_views.py``,
``unpaid_invoices_qs`` et la garde d'intégralité KMF de ``TariffItem``.
Chaque classe matérialise un axe d'attaque ; un échec ici est une faille
de cloisonnement, un désaccord ledger↔annotation ou une fuite.

Axes couverts par exécution :
- cloisonnement des agrégats (praticien multi-centres, patient transversal,
  casquettes non-staff → 404, encounter forgé cross-membership) ;
- accord EXACT entre ``unpaid_invoices_qs`` et ``invoice_balance_kmf()``
  sur des séquences retorses (tranches + contre-passation + re-paiement,
  payée→contre-passée→re-payée, diaspora, facture annulée avec
  encaissements) ;
- fuites : payload d'activité sans AUCUNE clé financière ni PII patient,
  téléphone jamais moissonnable sur les impayés, rôles cliniques → 403 ;
- robustesse des paramètres (dates hostiles supplémentaires, pagination
  adverse, ordering hostile) : jamais de 500 ;
- tarif fractionnaire PRÉ-EXISTANT (injecté par ``bulk_create``, comme une
  ligne d'avant la migration 0003) : le pipeline dégrade honnêtement, sans
  500, et le solde fractionnaire reste VISIBLE dans les impayés ;
- comptes de requêtes constants à volume supérieur (le pire cas, pas le
  cas jouet).
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.centers.models import TariffItem
from apps.medical.models import ActPerformed
from apps.scheduling.models import Appointment
from apps.trustbridge import services
from apps.trustbridge.models import CashPayment, Invoice, InvoiceLine

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_appointment,
    make_center,
    make_encounter,
    make_invoice,
    make_patient,
    make_staff,
    make_tariff,
    make_user,
)
from .trustbridge_helpers import Status, build_scenario

pytestmark = pytest.mark.django_db

Method = CashPayment.Method


def activity_url(center):
    return f"/api/v1/centers/{center.pk}/stats/activity/"


def finances_url(center):
    return f"/api/v1/centers/{center.pk}/stats/finances/"


def unpaid_url(center):
    return f"/api/v1/centers/{center.pk}/invoices/unpaid/"


def issued_invoice(center, total="15000", patient=None):
    """Une facture émise de ``total`` KMF dans ``center`` (via factories)."""
    encounter = make_encounter(center=center, patient=patient)
    act = ActPerformed.objects.create(
        encounter=encounter,
        tariff_item=make_tariff(center, price_kmf=total),
    )
    invoice = Invoice.objects.create(
        encounter=encounter,
        center=center,
        patient=encounter.patient,
        status=Invoice.Status.DRAFT,
    )
    InvoiceLine.objects.create(invoice=invoice, act=act)
    invoice.recompute_total()
    invoice.status = Invoice.Status.ISSUED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


def pay(cashier, invoice, amount, method=Method.CASH, operator=""):
    if method == Method.MOBILE_MONEY and not operator:
        operator = "huri"
    return services.record_cash_payment(
        actor=cashier, center=invoice.center, invoice=invoice,
        method=method, amount_kmf=Decimal(amount), operator=operator,
    )


# ---------------------------------------------------------------------------
# Axe 1 — cloisonnement des agrégats
# ---------------------------------------------------------------------------


class TestCrossTenantAggregates:
    def test_multi_center_practitioner_never_mixes_his_two_tills_of_work(self):
        """Le MÊME user est médecin dans A et dans B (cas réel) : l'activité
        de A ne compte que les consultations faites À A, sous le membership
        de A — jamais celles de B, jamais le membership de B."""
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        user = make_user()
        m_a = make_staff(user=user, center=center_a, role=Role.DOCTOR)
        m_b = make_staff(user=user, center=center_b, role=Role.DOCTOR)
        make_encounter(center=center_a, practitioner=m_a)
        make_encounter(center=center_a, practitioner=m_a)
        for _ in range(3):
            make_encounter(center=center_b, practitioner=m_b)

        data_a = client_for(director_a).get(activity_url(center_a)).data
        assert data_a["totals"]["encounters"] == 2
        assert [
            (b["practitioner"], b["encounters"])
            for b in data_a["encounters_by_practitioner"]
        ] == [(m_a.pk, 2)]

        data_b = client_for(director_b).get(activity_url(center_b)).data
        assert data_b["totals"]["encounters"] == 3
        assert [
            (b["practitioner"], b["encounters"])
            for b in data_b["encounters_by_practitioner"]
        ] == [(m_b.pk, 3)]

    def test_forged_cross_membership_encounter_follows_the_encounter_center(self):
        """Un encounter forgé (chemin admin/shell : centre A, membership de
        B) reste compté dans A — le centre de l'ENCOUNTER fait foi — et
        n'entre JAMAIS dans les stats de B via la jointure praticien."""
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        m_b = make_staff(center=center_b, role=Role.DOCTOR)
        make_encounter(center=center_a, practitioner=m_b)  # forgé

        data_a = client_for(director_a).get(activity_url(center_a)).data
        assert data_a["totals"]["encounters"] == 1
        data_b = client_for(director_b).get(activity_url(center_b)).data
        assert data_b["totals"]["encounters"] == 0
        assert data_b["encounters_by_practitioner"] == []

    def test_transversal_patient_invoices_stay_in_their_center(self):
        """Le carnet est transversal mais l'argent est tenant : le même
        patient doit des francs à A ET à B — chaque centre ne voit que SA
        créance, dans la liste ET dans l'agrégat finances."""
        patient = make_patient(first_name="Zalia", last_name="Mohamed")
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        inv_a = issued_invoice(center_a, total="9000", patient=patient)
        inv_b = issued_invoice(center_b, total="4000", patient=patient)

        rows_a = client_for(director_a).get(unpaid_url(center_a)).data["results"]
        assert {r["id"] for r in rows_a} == {inv_a.pk}
        agg_a = client_for(director_a).get(finances_url(center_a)).data["unpaid"]
        assert agg_a == {"count": 1, "total_kmf": "9000.00"}

        rows_b = client_for(director_b).get(unpaid_url(center_b)).data["results"]
        assert {r["id"] for r in rows_b} == {inv_b.pk}
        agg_b = client_for(director_b).get(finances_url(center_b)).data["unpaid"]
        assert agg_b == {"count": 1, "total_kmf": "4000.00"}

    def test_deactivated_staff_loses_the_three_endpoints_instantly(self):
        """Parti du centre mais JWT encore valide : le membership désactivé
        rend le centre invisible (404) — l'ex-directeur ne lit plus ni la
        caisse ni l'activité."""
        center, director = make_center_with_director()
        membership = center.staff_memberships.get(user=director)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        client = client_for(director)
        assert client.get(activity_url(center)).status_code == 404
        assert client.get(finances_url(center)).status_code == 404
        assert client.get(unpaid_url(center)).status_code == 404

    def test_non_staff_hats_get_a_deterministic_404_on_all_three(self):
        """Tuteur ou patient revendiqué SANS membership : le centre n'existe
        pas pour eux (404 du mixin), sur les trois endpoints."""
        center, _ = make_center_with_director()
        guardian_user, _ = make_guardian_user()
        patient_user = make_user()
        make_claimed_patient(user=patient_user)
        for user in (guardian_user, patient_user):
            client = client_for(user)
            assert client.get(activity_url(center)).status_code == 404
            assert client.get(finances_url(center)).status_code == 404
            assert client.get(unpaid_url(center)).status_code == 404


# ---------------------------------------------------------------------------
# Axe 2 — accord ledger ↔ annotation sur des séquences retorses
# ---------------------------------------------------------------------------


def _python_side_unpaid(center):
    """La dérivation unitaire, recalculée en Python, rangée par facture."""
    balances = {}
    for invoice in Invoice.objects.for_center(center).filter(
        status=Invoice.Status.ISSUED
    ):
        balance = services.invoice_balance_kmf(invoice)
        if balance > 0:
            balances[invoice.pk] = balance
    return balances


class TestLedgerAnnotationAgreement:
    def test_instalment_reversal_reinstalment_all_agree(self):
        """15 000 : tranche 5 000 contre-passée, puis 3 000 espèces et
        4 000 mobile money — solde 8 000, payé 7 000, accord ligne à ligne
        ET agrégat, série de recettes exacte."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        invoice = issued_invoice(center, total="15000")
        first = pay(cashier, invoice, "5000")
        services.reverse_cash_payment(
            actor=cashier, cash_payment=first, reason="Erreur de montant"
        )
        pay(cashier, invoice, "3000")
        pay(cashier, invoice, "4000", method=Method.MOBILE_MONEY)

        rows = client_for(director).get(unpaid_url(center)).data["results"]
        row = next(r for r in rows if r["id"] == invoice.pk)
        assert Decimal(row["paid_kmf"]) == Decimal("7000")
        assert Decimal(row["balance_kmf"]) == Decimal("8000")
        invoice.refresh_from_db()
        assert services.invoice_balance_kmf(invoice) == Decimal("8000")

        finances = client_for(director).get(finances_url(center)).data
        assert Decimal(finances["totals"]["especes_kmf"]) == Decimal("3000")
        assert Decimal(finances["totals"]["mobile_money_kmf"]) == Decimal("4000")
        assert Decimal(finances["reversals"]["total_kmf"]) == Decimal("5000")
        assert finances["unpaid"] == {"count": 1, "total_kmf": "8000.00"}

    def test_paid_then_reversed_then_repaid_stays_in_agreement(self):
        """Payée intégralement (sort de la liste), contre-passée (y revient,
        redevient émise), re-payée partiellement — accord à chaque état."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        invoice = issued_invoice(center, total="7500")
        full = pay(cashier, invoice, "7500")
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.PAID
        assert client_for(director).get(unpaid_url(center)).data["results"] == []

        services.reverse_cash_payment(
            actor=cashier, cash_payment=full, reason="Billet refusé"
        )
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.ISSUED
        pay(cashier, invoice, "2000")

        rows = client_for(director).get(unpaid_url(center)).data["results"]
        row = next(r for r in rows if r["id"] == invoice.pk)
        assert Decimal(row["balance_kmf"]) == Decimal("5500")
        assert Decimal(row["paid_kmf"]) == Decimal("2000")
        assert services.invoice_balance_kmf(invoice) == Decimal("5500")

    def test_diaspora_paid_invoice_is_out_of_the_list_with_zero_balance(self):
        scn = build_scenario(status=Status.PAID)
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        assert services.invoice_balance_kmf(scn.invoice) == Decimal("0")
        rows = client_for(scn.director).get(unpaid_url(scn.center)).data["results"]
        assert rows == []

    def test_cancelled_invoice_with_payments_degrades_honestly(self):
        """Chemin admin/shell : une facture émise, partiellement encaissée,
        forcée « annulée ». Elle sort des impayés ET du facturé ; ses
        encaissements réels RESTENT dans les recettes (l'argent est entré) ;
        aucun endpoint ne rend 500."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        invoice = issued_invoice(center, total="7500")
        pay(cashier, invoice, "2000")
        invoice.refresh_from_db()
        invoice.status = Invoice.Status.CANCELLED
        invoice.save(update_fields=["status", "updated_at"])

        unpaid = client_for(director).get(unpaid_url(center))
        assert unpaid.status_code == 200
        assert unpaid.data["results"] == []
        finances = client_for(director).get(finances_url(center))
        assert finances.status_code == 200
        assert finances.data["invoiced"] == {"count": 0, "total_kmf": "0"}
        assert Decimal(finances.data["totals"]["especes_kmf"]) == Decimal("2000")
        assert finances.data["unpaid"] == {"count": 0, "total_kmf": "0"}

    def test_aggregate_equals_the_python_side_derivation_row_by_row(self):
        """Accord GLOBAL : l'agrégat SQL des finances == la somme Python de
        ``invoice_balance_kmf()`` sur les factures émises à solde > 0."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        inv_full = issued_invoice(center, total="9000")
        inv_partial = issued_invoice(center, total="6000")
        pay(cashier, inv_partial, "2500")
        inv_paid = issued_invoice(center, total="3000")
        pay(cashier, inv_paid, "3000")
        make_invoice(  # brouillon : hors périmètre par STATUT, pas par solde
            encounter=make_encounter(center=center), status=Invoice.Status.DRAFT
        )
        expected = _python_side_unpaid(center)
        assert expected == {
            inv_full.pk: Decimal("9000"), inv_partial.pk: Decimal("3500"),
        }
        data = client_for(director).get(finances_url(center)).data
        assert data["unpaid"]["count"] == len(expected)
        assert Decimal(data["unpaid"]["total_kmf"]) == sum(expected.values())
        rows = client_for(director).get(unpaid_url(center)).data["results"]
        assert {r["id"]: Decimal(r["balance_kmf"]) for r in rows} == expected


# ---------------------------------------------------------------------------
# Axe 3 — fuites (payload activité, rôles, téléphone)
# ---------------------------------------------------------------------------


def _all_keys(payload):
    keys = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            keys.add(str(key).lower())
            keys |= _all_keys(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            keys |= _all_keys(item)
    return keys


class TestLeaks:
    FORBIDDEN_IN_ACTIVITY = (
        "kmf", "eur", "amount", "montant", "price", "balance", "paid",
        "invoice", "phone", "patient_name", "reason", "diagnosis", "motif",
    )

    def test_activity_payload_carries_no_money_and_no_patient_pii(self):
        """Le payload activité est lisible par TOUT le staff : aucune clé
        financière, aucun nom/téléphone de patient, aucun motif clinique."""
        center, director = make_center_with_director()
        make_appointment(center=center, scheduled_at=timezone.now(),
                         status=Appointment.Status.HONORED)
        make_encounter(center=center)
        make_patient(created_by_center=center)
        cashier = make_staff_user(center, role=Role.CASHIER)
        issued_invoice(center, total="9000")
        keys = _all_keys(client_for(director).get(activity_url(center)).data)
        for fragment in self.FORBIDDEN_IN_ACTIVITY:
            assert not any(fragment in key for key in keys), (
                f"clé suspecte contenant « {fragment} » dans le payload "
                f"activité : {sorted(k for k in keys if fragment in k)}"
            )

    def test_every_clinical_role_gets_403_on_unpaid_too(self):
        """La liste des impayés est une vue argent+identités : même
        périmètre que le journal de caisse — 403 pour TOUS les rôles
        cliniques, pas seulement le médecin."""
        center, _ = make_center_with_director()
        for role in (Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST):
            user = make_staff_user(center, role=role)
            assert client_for(user).get(unpaid_url(center)).status_code == 403

    def test_full_phone_never_appears_whatever_the_ordering_or_page(self):
        """Moisson par ré-ordonnancement/pagination : le numéro complet ne
        sort par AUCUNE combinaison de paramètres."""
        center, director = make_center_with_director()
        phone = "+33698765432"
        patient = make_patient(first_name="Ahmed", last_name="Saïd", phone=phone)
        issued_invoice(center, total="5000", patient=patient)
        client = client_for(director)
        for params in (
            {}, {"ordering": "balance"}, {"ordering": "-age"},
            {"ordering": "age"}, {"page": "1"},
        ):
            response = client.get(unpaid_url(center), params)
            assert response.status_code == 200
            assert phone not in str(response.data)


# ---------------------------------------------------------------------------
# Axe 4 — paramètres hostiles : jamais de 500
# ---------------------------------------------------------------------------


class TestHostileParams:
    def test_more_hostile_dates_never_500(self):
        center, director = make_center_with_director()
        client = client_for(director)
        hard_400 = [
            {"from": "10000-01-01"},          # année à 5 chiffres
            {"from": "2026-06-01T00:00:00"},  # datetime, pas une date
            {"from": " "},
            {"from": "2026-13-01"},
            {"to": "0000-01-01"},
            {"from": "1'--", "to": "2026-01-01"},
        ]
        for params in hard_400:
            response = client.get(activity_url(center), params)
            assert response.status_code == 400, params
        # Tolérés ou refusés selon le parseur — mais JAMAIS un 500.
        no_500 = [
            {"from": "2026-6-1"},              # non paddé (regex Django)
            {"from": "2026-01-01\n"},          # newline final
            {"from": "٢٠٢٦-٠١-٠١"},            # chiffres arabes-indiens
            {"to": ""},                        # vide → défaut
        ]
        for params in no_500:
            response = client.get(activity_url(center), params)
            assert response.status_code in (200, 400), params

    def test_finances_shares_the_same_refusals(self):
        center, director = make_center_with_director()
        client = client_for(director)
        assert client.get(
            finances_url(center), {"from": "2026-02-30"}
        ).status_code == 400
        assert client.get(
            finances_url(center), {"to": "9999-12-31"}
        ).status_code == 400

    def test_unpaid_hostile_pagination_and_ordering(self):
        center, director = make_center_with_director()
        issued_invoice(center, total="5000")
        client = client_for(director)
        assert client.get(unpaid_url(center), {"page": "999"}).status_code == 404
        assert client.get(unpaid_url(center), {"page": "abc"}).status_code == 404
        assert client.get(unpaid_url(center), {"page": "-1"}).status_code == 404
        for bad in ("-balance ", "balance,id", "<script>", "created_at", "id"):
            response = client.get(unpaid_url(center), {"ordering": bad})
            assert response.status_code == 400, bad


# ---------------------------------------------------------------------------
# Axe 5 — tarif : garde d'intégralité et ligne fractionnaire pré-existante
# ---------------------------------------------------------------------------


class TestTariffIntegrality:
    def test_model_save_blocks_every_orm_write_path(self):
        center = make_center()
        with pytest.raises(ValidationError):
            make_tariff(center, price_kmf="100.50")
        tariff = make_tariff(center, price_kmf="100")
        tariff.price_kmf = Decimal("100.25")
        with pytest.raises(ValidationError):
            tariff.save()

    def test_pre_existing_fractional_tariff_degrades_honestly_not_500(self):
        """Une ligne fractionnaire d'AVANT la migration 0003 (injectée par
        ``bulk_create``, qui ne passe pas par ``save()`` — même angle mort
        qu'une vieille ligne en base) : la facture qui en naît porte un
        solde fractionnaire. Les trois endpoints répondent 200, le solde
        0,50 reste VISIBLE dans les impayés (jamais une facture fantôme
        « payée »), et le guichet refuse les décimales — la créance résiduelle
        est assumée et affichée, pas cachée."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        fractional = TariffItem.objects.bulk_create([
            TariffItem(center=center, code="OLD1", label="Ancien tarif",
                       price_kmf=Decimal("100.50")),
        ])[0]
        encounter = make_encounter(center=center)
        act = ActPerformed.objects.create(
            encounter=encounter, tariff_item=fractional
        )
        invoice = Invoice.objects.create(
            encounter=encounter, center=center, patient=encounter.patient,
            status=Invoice.Status.DRAFT,
        )
        InvoiceLine.objects.create(invoice=invoice, act=act)
        invoice.recompute_total()
        services.issue_invoice(actor=director, invoice=invoice)
        invoice.refresh_from_db()
        assert invoice.total_kmf == Decimal("100.50")

        pay(cashier, invoice, "100")  # la partie entière s'encaisse
        with pytest.raises(ValidationError, match="décimales"):
            pay(cashier, invoice, "0.50")  # le sous-franc, jamais

        rows = client_for(director).get(unpaid_url(center))
        assert rows.status_code == 200
        row = next(r for r in rows.data["results"] if r["id"] == invoice.pk)
        assert Decimal(row["balance_kmf"]) == Decimal("0.50")
        finances = client_for(director).get(finances_url(center))
        assert finances.status_code == 200
        assert Decimal(finances.data["unpaid"]["total_kmf"]) == Decimal("0.50")
        assert client_for(director).get(activity_url(center)).status_code == 200
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.ISSUED  # jamais « payée »


# ---------------------------------------------------------------------------
# Axe 6 — comptes de requêtes constants à volume supérieur
# ---------------------------------------------------------------------------


class TestQueryCountsAtVolume:
    def test_activity_stays_at_6_queries_with_a_busy_month(
        self, django_assert_num_queries
    ):
        center, director = make_center_with_director()
        today = timezone.localdate()
        practitioners = [make_staff(center=center) for _ in range(3)]
        for offset in range(10):
            at = timezone.now() - timedelta(days=offset)
            for status in (Appointment.Status.HONORED, Appointment.Status.MISSED):
                make_appointment(center=center, scheduled_at=at, status=status)
            make_encounter(
                center=center, practitioner=practitioners[offset % 3]
            )
            make_patient(created_by_center=center)
        client = client_for(director)
        with django_assert_num_queries(6):
            response = client.get(activity_url(center))
        assert response.status_code == 200
        assert response.data["totals"]["encounters"] == 10

    def test_finances_stays_at_6_queries_with_many_payments(
        self, django_assert_num_queries
    ):
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        for _ in range(4):
            invoice = issued_invoice(center, total="9000")
            pay(cashier, invoice, "2000")
            pay(cashier, invoice, "1000", method=Method.MOBILE_MONEY)
            reversed_one = pay(cashier, invoice, "500")
            services.reverse_cash_payment(
                actor=cashier, cash_payment=reversed_one, reason="Erreur"
            )
        client = client_for(director)
        with django_assert_num_queries(6):
            response = client.get(finances_url(center))
        assert response.status_code == 200
        assert Decimal(response.data["totals"]["total_kmf"]) == Decimal("12000")

    def test_unpaid_stays_at_4_queries_on_a_full_page(
        self, django_assert_num_queries
    ):
        center, director = make_center_with_director()
        for _ in range(25):  # > PAGE_SIZE (20) : une pleine page servie
            issued_invoice(center, total="5000")
        client = client_for(director)
        with django_assert_num_queries(4):
            response = client.get(unpaid_url(center))
        assert response.status_code == 200
        assert len(response.data["results"]) == 20
        assert response.data["count"] == 25
