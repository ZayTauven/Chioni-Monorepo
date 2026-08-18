"""Sprint SV — lot « correctifs & enrichissements de contrat » (backend).

Quatre familles verrouillées ici :

1. **La première relance SaaS dit la vérité** : une facture très en retard
   (beat resté muet, facture rattrapée) reçoit sa PREMIÈRE relance avec la
   copie OVERDUE — jamais « arrive à échéance aujourd'hui ».
2. **Une offre à prix ≤ 0 est refusée** avec un message explicite : une
   offre repricée à 0 KMF arrêterait silencieusement la facturation de tous
   ses abonnés (la contrainte DB n'exclut que le négatif).
3. **Le refus d'une correction de fiche équipement périmée est véridique** :
   « la fiche a changé depuis son chargement », jamais « un réformé ne
   revient pas en service » quand l'appelant ne touchait pas au statut.
4. **Enrichissements de contrat** (champs EN PLUS, jamais retirés) :
   ``invoice`` + ``reversed_by_display`` sur la contre-passation,
   ``received_by_display`` sur l'encaissement, ``identity_editable`` sur
   l'identité staff, ``logo`` sur ``/platform/centers/``,
   ``generated_by_display`` sur le DÉTAIL d'un export comptable — présents
   côté staff, ABSENTS de tout payload patient/tuteur, sans N+1.
"""

import inspect
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework import serializers as drf_serializers

from apps.billing import services as billing_services
from apps.centers import services as centers_services
from apps.common.notifications import (
    SMS_SUBSCRIPTION_INVOICE_DUE,
    SMS_SUBSCRIPTION_INVOICE_OVERDUE,
)
from apps.equipment import services as equipment_services
from apps.equipment.models import Equipment
from apps.trustbridge import serializers as trustbridge_serializers
from apps.trustbridge import services as trust_services
from apps.trustbridge.models import CashPayment

from .api_helpers import Role, client_for, make_center_with_director
from .factories import (
    make_equipment,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_subscription_invoice,
)
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db


def operator():
    user, _op = make_platform_staff()
    return user


def billed_center():
    """Un centre, son directeur, un contrat actif prêt à être relancé."""
    center, director = make_center_with_director()
    subscription = make_subscription(center=center, plan=make_plan())
    return center, director, subscription


def cash_scenario(price_kmf="20000"):
    """Une facture émise, prête à encaisser au guichet (patron
    ``test_cash_api.counter_scenario``)."""
    scn = build_scenario(status="facture_brouillon", price_kmf=price_kmf)
    trust_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
    scn.invoice.refresh_from_db()
    return scn


def record(scn, amount, actor=None):
    return trust_services.record_cash_payment(
        actor=actor or scn.cashier,
        center=scn.center,
        invoice=scn.invoice,
        method=CashPayment.Method.CASH,
        amount_kmf=Decimal(amount),
    )


def rows_of(response):
    """Liste plate, que la vue pagine ou non."""
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


# ---------------------------------------------------------------------------
# 1 — la première relance d'une facture très en retard dit la vérité
# ---------------------------------------------------------------------------


class TestLateFirstSaasReminderTellsTheTruth:
    def test_a_caught_up_invoice_gets_the_overdue_copy_first(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Échéance dépassée de 12 jours, AUCUNE relance encore partie : la
        copie « arrive à échéance aujourd'hui » serait un mensonge — c'est
        la copie OVERDUE qui part, sans toucher à la cadence."""
        _center, _director, subscription = billed_center()
        invoice = make_subscription_invoice(
            subscription, amount_kmf="25000", days_overdue=12
        )
        assert invoice.reminders_sent == 0
        with django_capture_on_commit_callbacks(execute=True):
            assert billing_services.send_subscription_payment_reminders() == 1
        (_phone, message), = sms_outbox
        assert message.startswith(SMS_SUBSCRIPTION_INVOICE_OVERDUE[:30])
        assert "arrive à échéance aujourd'hui" not in message
        invoice.refresh_from_db()
        assert invoice.reminders_sent == 1  # la cadence n'a pas bougé

    def test_the_day_J_first_reminder_keeps_the_due_copy(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Garde-fou contre l'inversion du booléen : le jour J, la première
        vague garde sa copie historique."""
        _center, _director, subscription = billed_center()
        make_subscription_invoice(subscription, amount_kmf="25000", days_overdue=0)
        with django_capture_on_commit_callbacks(execute=True):
            assert billing_services.send_subscription_payment_reminders() == 1
        (_phone, message), = sms_outbox
        assert message.startswith(SMS_SUBSCRIPTION_INVOICE_DUE[:30])


# ---------------------------------------------------------------------------
# 2 — une offre à prix ≤ 0 est refusée, avec un message qui dit pourquoi
# ---------------------------------------------------------------------------


class TestPlanPriceMustBeStrictlyPositive:
    def test_create_plan_refuses_zero(self):
        with pytest.raises(ValidationError) as exc:
            billing_services.create_plan(
                actor=operator(), code="ZERO", name="Gratuit",
                price_kmf=Decimal("0"),
            )
        assert "strictement positif" in str(exc.value)

    def test_create_plan_refuses_a_negative_price(self):
        with pytest.raises(ValidationError) as exc:
            billing_services.create_plan(
                actor=operator(), code="NEG", name="Négatif",
                price_kmf=Decimal("-500"),
            )
        assert "strictement positif" in str(exc.value)

    def test_update_plan_refuses_zero_and_the_plan_does_not_move(self):
        plan = make_plan(price_kmf="25000")
        with pytest.raises(ValidationError) as exc:
            billing_services.update_plan(
                actor=operator(), plan=plan, price_kmf=Decimal("0")
            )
        assert "strictement positif" in str(exc.value)
        plan.refresh_from_db()
        assert plan.price_kmf == Decimal("25000")

    def test_a_positive_price_still_passes_both_doors(self):
        plan = billing_services.create_plan(
            actor=operator(), code="SVOK", name="Essentiel",
            price_kmf=Decimal("25000"),
        )
        billing_services.update_plan(
            actor=operator(), plan=plan, price_kmf=Decimal("30000")
        )
        plan.refresh_from_db()
        assert plan.price_kmf == Decimal("30000")

    def test_the_api_answers_an_explicit_400(self):
        response = client_for(operator()).post(
            "/api/v1/platform/plans/",
            {"code": "ZEROAPI", "name": "Gratuit", "price_kmf": "0"},
            format="json",
        )
        assert response.status_code == 400, response.content
        assert "strictement positif" in response.content.decode("utf-8")


# ---------------------------------------------------------------------------
# 3 — le refus d'une correction de fiche périmée est véridique
# ---------------------------------------------------------------------------


class TestEquipmentStaleUpdateConflict:
    def test_a_stale_instance_gets_a_truthful_message_and_nothing_moves(self):
        """Un AUTRE directeur réforme entre le chargement et l'envoi : le
        refus dit « la fiche a changé », jamais « un réformé ne revient pas
        en service » (l'appelant ne touchait pas au statut)."""
        center, director = make_center_with_director()
        equipment = make_equipment(center=center, location="Salle 1")
        stale = Equipment.objects.get(pk=equipment.pk)
        equipment_services.set_equipment_status(
            actor=director, equipment=equipment,
            status=Equipment.Status.DECOMMISSIONED,
        )
        with pytest.raises(ValidationError) as exc:
            equipment_services.update_equipment(
                actor=director, equipment=stale, location="Salle 2"
            )
        message = str(exc.value)
        assert "changé depuis son chargement" in message
        assert "ne revient pas en service" not in message
        equipment.refresh_from_db()
        assert equipment.location == "Salle 1"  # la fiche n'a pas bougé
        assert equipment.status == Equipment.Status.DECOMMISSIONED

    def test_an_up_to_date_instance_still_corrects_a_decommissioned_sheet(self):
        """Le comportement instance-à-jour ne change PAS : corriger la
        fiche d'un réformé reste permis."""
        center, director = make_center_with_director()
        equipment = make_equipment(center=center, location="Salle 1")
        equipment_services.set_equipment_status(
            actor=director, equipment=equipment,
            status=Equipment.Status.DECOMMISSIONED,
        )
        # ``set_equipment_status`` a resynchronisé l'instance : à jour.
        equipment_services.update_equipment(
            actor=director, equipment=equipment, location="Réserve"
        )
        equipment.refresh_from_db()
        assert equipment.location == "Réserve"
        assert equipment.status == Equipment.Status.DECOMMISSIONED


# ---------------------------------------------------------------------------
# 4 — enrichissements de contrat : présents côté staff…
# ---------------------------------------------------------------------------


class TestCashJournalContract:
    def test_reversal_carries_invoice_id_and_display_names(self):
        scn = cash_scenario()
        cashier = scn.cashier
        cashier.first_name, cashier.last_name = "Nadjda", "Saïd"
        cashier.save(update_fields=["first_name", "last_name"])
        payment = record(scn, "5000")
        trust_services.reverse_cash_payment(
            actor=cashier, cash_payment=payment, reason="Erreur de saisie."
        )
        response = client_for(cashier).get(
            f"/api/v1/centers/{scn.center.pk}/cash-journal/"
        )
        assert response.status_code == 200
        row = response.data["payments"][0]
        assert row["received_by_display"] == "Nadjda Saïd"
        # La contre-passation à plat est enfin navigable, et signée d'un nom.
        reversal = response.data["reversals"][0]
        assert reversal["invoice"] == scn.invoice.pk
        assert reversal["reversed_by_display"] == "Nadjda Saïd"
        # La forme embarquée dans l'encaissement porte le même contrat.
        assert row["reversal"]["invoice"] == scn.invoice.pk
        assert row["reversal"]["reversed_by_display"] == "Nadjda Saïd"

    def test_display_is_empty_when_names_are_empty_never_the_username(self):
        scn = cash_scenario()  # make_user ne pose aucun nom
        record(scn, "5000")
        response = client_for(scn.cashier).get(
            f"/api/v1/centers/{scn.center.pk}/cash-journal/"
        )
        row = response.data["payments"][0]
        assert row["received_by_display"] == ""
        assert scn.cashier.username not in response.content.decode("utf-8")

    def test_a_trust_bridge_cash_in_has_no_cashier_display(self):
        """``received_by`` nul (webhook PSP) → ``received_by_display`` nul,
        miroir du champ id — jamais une chaîne inventée."""
        serializer = trustbridge_serializers.CashPaymentStaffSerializer
        scn = cash_scenario()
        payment = record(scn, "5000")
        payment.received_by = None  # forme webhook, sans rejouer tout le rail
        assert serializer().get_received_by_display(payment) is None

    def test_journal_query_count_is_flat(self, django_assert_num_queries):
        """Le patron des stats (ADR 0015) : jamais une requête par ligne.
        1 résolution du centre + 1 vérification de membership + 1 requête
        encaissements (jointures chargées) + 1 requête contre-passations."""
        scn = cash_scenario()
        first = record(scn, "5000")
        trust_services.reverse_cash_payment(
            actor=scn.cashier, cash_payment=first, reason="Erreur."
        )
        record(scn, "3000")
        record(scn, "2000")
        client = client_for(scn.cashier)
        with django_assert_num_queries(4):
            response = client.get(
                f"/api/v1/centers/{scn.center.pk}/cash-journal/"
            )
        assert response.status_code == 200
        assert len(response.data["payments"]) == 3
        assert len(response.data["reversals"]) == 1

    def test_invoice_payment_list_carries_the_same_contract(self):
        scn = cash_scenario()
        cashier = scn.cashier
        cashier.first_name, cashier.last_name = "Ben", "Ali"
        cashier.save(update_fields=["first_name", "last_name"])
        payment = record(scn, "5000")
        trust_services.reverse_cash_payment(
            actor=cashier, cash_payment=payment, reason="Erreur."
        )
        response = client_for(cashier).get(
            f"/api/v1/centers/{scn.center.pk}/invoices/{scn.invoice.pk}/payments/"
        )
        row = response.data[0]
        assert row["received_by_display"] == "Ben Ali"
        assert row["reversal"]["reversed_by_display"] == "Ben Ali"
        assert row["reversal"]["invoice"] == scn.invoice.pk


class TestStaffIdentityEditableFlag:
    def test_shadow_account_is_editable_activated_account_is_not(self):
        center, director = make_center_with_director()
        membership = centers_services.add_staff_member(
            actor=director, center=center, phone="+2693212345",
            role=Role.CASHIER, first_name="Ombre", last_name="Guichet",
        )
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/staff/"
        )
        assert response.status_code == 200
        by_user = {row["user"]["id"]: row["user"] for row in rows_of(response)}
        assert by_user[membership.user_id]["identity_editable"] is True
        # Le directeur a un mot de passe utilisable : identité verrouillée.
        assert by_user[director.pk]["identity_editable"] is False

    def test_the_flag_and_the_write_guard_are_the_same_predicate(self):
        """Source unique de vérité : quand le drapeau dit non, la garde
        d'écriture refuse — et réciproquement."""
        center, director = make_center_with_director()
        membership = centers_services.add_staff_member(
            actor=director, center=center, phone="+2693212346",
            role=Role.CASHIER,
        )
        shadow = membership.user
        assert centers_services.staff_identity_editable(shadow) is True
        centers_services.update_staff_member(
            actor=director, membership=membership, first_name="Fatima"
        )
        # Le compte se revendique (téléphone vérifié) : drapeau ET garde
        # basculent ensemble.
        shadow.phone_verified_at = timezone.now()
        shadow.save(update_fields=["phone_verified_at"])
        assert centers_services.staff_identity_editable(shadow) is False
        with pytest.raises(ValidationError):
            centers_services.update_staff_member(
                actor=director, membership=membership, first_name="Autre"
            )

    def test_the_serializer_exposes_the_boolean_and_nothing_more(self):
        from apps.centers.serializers import StaffUserSerializer

        assert set(StaffUserSerializer().fields) == {
            "id", "first_name", "last_name", "phone", "avatar",
            "identity_editable",
        }  # ni ``phone_verified_at``, ni l'état du mot de passe


class TestPlatformCenterLogo:
    def test_the_platform_list_carries_the_logo_url(self):
        center, _director = make_center_with_director()
        client = client_for(operator())
        response = client.get("/api/v1/platform/centers/")
        assert response.status_code == 200
        row = next(r for r in rows_of(response) if r["id"] == center.pk)
        assert row["logo"] is None
        # Le pipeline d'upload a ses propres tests (ADR 0014) : ici on pose
        # le fichier par l'ORM et on vérifie le CONTRAT de lecture.
        center.logo.save("logo.png", ContentFile(b"png-bytes"), save=True)
        response = client.get("/api/v1/platform/centers/")
        row = next(r for r in rows_of(response) if r["id"] == center.pk)
        assert row["logo"].startswith("http")


class TestAccountingExportDisplay:
    def test_the_detail_names_the_generator_the_list_does_not(self):
        from apps.accounting.services import generate_accounting_export

        center, director = make_center_with_director()
        director.first_name, director.last_name = "Ali", "Mze"
        director.save(update_fields=["first_name", "last_name"])
        today = timezone.localdate()
        export = generate_accounting_export(
            actor=director, center=center,
            period_start=today - timedelta(days=5), period_end=today,
        )
        client = client_for(director)
        detail = client.get(
            f"/api/v1/centers/{center.pk}/accounting/exports/{export.pk}/"
        )
        assert detail.status_code == 200
        assert detail.data["generated_by_display"] == "Ali Mze"
        listing = client.get(f"/api/v1/centers/{center.pk}/accounting/exports/")
        row = rows_of(listing)[0]
        assert "generated_by_display" not in row  # la LISTE garde l'id nu
        assert row["generated_by"] == director.pk


# ---------------------------------------------------------------------------
# 4 (suite) — … et ABSENTS de tout payload patient/tuteur
# ---------------------------------------------------------------------------

#: Les champs ajoutés par ce lot : AUCUN ne doit atteindre un lecteur
#: non-staff. Les noms du personnel sont de la donnée du centre.
SV_STAFF_ONLY_FIELDS = {
    "received_by_display", "reversed_by_display", "generated_by_display",
    "identity_editable",
}


class TestNothingLeaksIntoNonStaffSerializers:
    def test_the_patient_cash_receipt_gains_nothing(self):
        assert set(
            trustbridge_serializers.CashReceiptPatientSerializer().fields
        ) == {
            "id", "receipt_number", "center_name", "amount_kmf", "method",
            "reversed", "issued_at",
        }

    def test_every_patient_or_guardian_serializer_stays_clean(self):
        """Sonde structurelle fail-closed : tout serializer d'audience
        patient/tuteur du module trustbridge — présent ou FUTUR — reste
        vierge des champs de ce lot (``received_by``/``reversed_by`` bruts
        compris : même l'id d'un membre du personnel n'a rien à y faire)."""
        probed = 0
        for name, cls in inspect.getmembers(
            trustbridge_serializers, inspect.isclass
        ):
            if not issubclass(cls, drf_serializers.BaseSerializer):
                continue
            if "Patient" not in name and "Guardian" not in name:
                continue
            fields = set(cls().fields)
            forbidden = fields & (
                SV_STAFF_ONLY_FIELDS | {"received_by", "reversed_by"}
            )
            assert not forbidden, f"{name} expose {sorted(forbidden)}"
            probed += 1
        assert probed >= 4  # la sonde balaie réellement quelque chose

    def test_the_practitioner_directory_gains_nothing(self):
        """L'annuaire des praticiens est lu par TOUT le staff : il ne gagne
        ni ``identity_editable`` ni le téléphone (contrat S1 inchangé)."""
        from apps.centers.serializers import PractitionerSerializer

        assert set(PractitionerSerializer().fields) == {
            "id", "display_name", "role", "avatar",
        }
