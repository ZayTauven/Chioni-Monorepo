"""S5 lot 1 (ADR 0018 décisions 1 à 3) — le contrat d'abonnement lui-même.

Trois couches, dans l'ordre où elles décident :

1. **Le modèle** — intégralité KMF (champ, ``save()`` ET contrainte de
   base, patron ``TariffItem``), un abonnement par centre, une offre
   jamais supprimée.
2. **Les services** — machine à états explicite, motif obligatoire pour
   geler, audit références-only (**jamais le motif**), quotas mesurés.
3. **L'API** — côté centre (`GET /centers/{c}/subscription/`, DIRECTEUR
   SEUL) et côté plateforme (`support` lit, `admin` seul écrit).

Le fichier compagnon ``test_subscription_effects.py`` porte, lui, le
contrat de comportement du gel (ce qui s'arrête / ce qui continue).
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.accounts.models import PlatformStaff
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing import services as billing_services
from apps.billing.models import CenterSubscription, SubscriptionPlan
from apps.centers.models import StaffMembership

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import (
    make_center,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_user,
)

pytestmark = pytest.mark.django_db

Role = StaffMembership.Role
Status = CenterSubscription.Status


def operator(role=PlatformStaff.Role.ADMIN):
    user, _op = make_platform_staff(role=role)
    return user


# ---------------------------------------------------------------------------
# 1 — le modèle
# ---------------------------------------------------------------------------


class TestPlanIsWholeFrancs:
    def test_save_refuses_decimals(self):
        with pytest.raises(ValidationError):
            make_plan(price_kmf="25000.50")

    def test_the_database_closes_the_update_and_bulk_create_bypasses(self):
        """``save()`` ne suffit pas : ``update()``/``bulk_create()`` ne
        passent pas par lui. La contrainte naît AVEC la table (aucun
        existant fractionnaire à refuser, contrairement aux tarifs)."""
        plan = make_plan(price_kmf="25000")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SubscriptionPlan.objects.filter(pk=plan.pk).update(
                    price_kmf=Decimal("25000.50")
                )
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SubscriptionPlan.objects.bulk_create(
                    [
                        SubscriptionPlan(
                            code="FRAC", name="Fractionnaire",
                            price_kmf=Decimal("100.25"),
                        )
                    ]
                )

    def test_a_negative_price_is_refused_by_the_database(self):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SubscriptionPlan.objects.create(
                    code="NEG", name="Négatif", price_kmf=Decimal("-1")
                )


class TestOneContractPerTenant:
    def test_a_second_subscription_on_the_same_center_is_refused(self):
        center = make_center()
        make_subscription(center=center)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                make_subscription(center=center)

    def test_a_referenced_plan_cannot_be_deleted(self):
        from django.db.models import ProtectedError

        plan = make_plan()
        make_subscription(plan=plan)
        with pytest.raises(ProtectedError):
            plan.delete()


# ---------------------------------------------------------------------------
# 2 — les services : machine à états, motif, audit
# ---------------------------------------------------------------------------


class TestTheStateMachine:
    @pytest.mark.parametrize(
        "start,target",
        [
            (Status.TRIAL, Status.ACTIVE),
            (Status.ACTIVE, Status.UNPAID),
            (Status.UNPAID, Status.SUSPENDED),
            (Status.SUSPENDED, Status.ACTIVE),
            (Status.SUSPENDED, Status.UNPAID),
            (Status.TERMINATED, Status.ACTIVE),
        ],
    )
    def test_legal_transitions_apply(self, start, target):
        subscription = make_subscription(status=start)
        billing_services.set_subscription_status(
            actor=operator(), subscription=subscription, status=target,
            reason="Décision commerciale.",
        )
        subscription.refresh_from_db()
        assert subscription.status == target

    @pytest.mark.parametrize(
        "start,target",
        [
            (Status.TERMINATED, Status.UNPAID),
            (Status.TERMINATED, Status.SUSPENDED),
            (Status.ACTIVE, Status.TRIAL),
            (Status.UNPAID, Status.TRIAL),
        ],
    )
    def test_impossible_transitions_are_refused(self, start, target):
        subscription = make_subscription(status=start)
        with pytest.raises(ValidationError, match="Transition refusée"):
            billing_services.set_subscription_status(
                actor=operator(), subscription=subscription, status=target,
                reason="Motif.",
            )
        subscription.refresh_from_db()
        assert subscription.status == start

    def test_the_same_status_is_refused(self):
        subscription = make_subscription(status=Status.ACTIVE)
        with pytest.raises(ValidationError, match="déjà"):
            billing_services.set_subscription_status(
                actor=operator(), subscription=subscription,
                status=Status.ACTIVE,
            )

    def test_an_unknown_status_is_refused(self):
        subscription = make_subscription()
        with pytest.raises(ValidationError, match="inconnu"):
            billing_services.set_subscription_status(
                actor=operator(), subscription=subscription, status="gele",
            )

    @pytest.mark.parametrize(
        "target", [Status.SUSPENDED, Status.TERMINATED]
    )
    def test_freezing_without_a_motive_is_refused(self, target):
        """Couper l'administration d'un centre sans motif écrit laisserait
        son directeur sans rien à corriger."""
        subscription = make_subscription(status=Status.ACTIVE)
        with pytest.raises(ValidationError, match="motif est obligatoire"):
            billing_services.set_subscription_status(
                actor=operator(), subscription=subscription, status=target,
                reason="   ",
            )
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE

    def test_unfreezing_needs_no_motive(self):
        subscription = make_subscription(status=Status.SUSPENDED)
        billing_services.set_subscription_status(
            actor=operator(), subscription=subscription, status=Status.ACTIVE
        )
        subscription.refresh_from_db()
        assert subscription.status == Status.ACTIVE
        assert subscription.status_reason == ""


class TestOpeningAndMovingAContract:
    def test_a_contract_is_born_alive_only(self):
        center = make_center()
        plan = make_plan()
        for status in (Status.UNPAID, Status.SUSPENDED, Status.TERMINATED):
            with pytest.raises(ValidationError, match="Essai"):
                billing_services.create_subscription(
                    actor=operator(), center=center, plan=plan, status=status
                )
        assert not CenterSubscription.objects.exists()

    def test_a_center_cannot_have_two_contracts(self):
        center = make_center()
        plan = make_plan()
        billing_services.create_subscription(
            actor=operator(), center=center, plan=plan
        )
        with pytest.raises(ValidationError, match="déjà un abonnement"):
            billing_services.create_subscription(
                actor=operator(), center=center, plan=plan
            )

    def test_the_unique_index_answers_the_same_400_not_a_500(self):
        """Course de deux exploitants : le second passe le contrôle
        d'existence (l'autre n'avait pas encore commité) et bute sur
        l'index unique. Il doit sortir du point de sauvegarde avec le MÊME
        400 français, jamais une ``IntegrityError`` (500).

        On simule « la ligne n'existait pas quand j'ai regardé » en
        neutralisant le ``exists()`` du service : ce qui est testé ici,
        c'est la ceinture (la contrainte), pas les bretelles.
        """
        from unittest import mock

        center = make_center()
        make_subscription(center=center)
        with mock.patch(
            "django.db.models.query.QuerySet.exists", return_value=False
        ):
            with pytest.raises(ValidationError, match="déjà un abonnement"):
                billing_services.create_subscription(
                    actor=operator(), center=center,
                    plan=make_plan(code="RACE"),
                )

    def test_a_retired_offer_cannot_be_sold_or_moved_to(self):
        retired = make_plan(code="OLD", is_active=False)
        with pytest.raises(ValidationError, match="plus proposée"):
            billing_services.create_subscription(
                actor=operator(), center=make_center(), plan=retired
            )
        subscription = make_subscription()
        with pytest.raises(ValidationError, match="plus proposée"):
            billing_services.change_subscription_plan(
                actor=operator(), subscription=subscription, plan=retired
            )

    def test_changing_the_plan_keeps_the_status_and_the_center(self):
        subscription = make_subscription(status=Status.UNPAID)
        target = make_plan(code="CLINIQUE", price_kmf="90000")
        billing_services.change_subscription_plan(
            actor=operator(), subscription=subscription, plan=target
        )
        subscription.refresh_from_db()
        assert subscription.plan_id == target.pk
        assert subscription.status == Status.UNPAID

    def test_moving_to_the_same_plan_is_refused(self):
        subscription = make_subscription()
        with pytest.raises(ValidationError, match="déjà sur cette offre"):
            billing_services.change_subscription_plan(
                actor=operator(), subscription=subscription,
                plan=subscription.plan,
            )


class TestAuditContract:
    def test_the_three_center_actions_carry_their_tenant(self):
        center, _director = make_center_with_director()
        plan = make_plan(code="ESSENTIEL")
        subscription = billing_services.create_subscription(
            actor=operator(), center=center, plan=plan
        )
        billing_services.change_subscription_plan(
            actor=operator(), subscription=subscription,
            plan=make_plan(code="CLINIQUE"),
        )
        billing_services.set_subscription_status(
            actor=operator(), subscription=subscription,
            status=Status.SUSPENDED, reason="Trois échéances impayées.",
        )
        for action in (
            AuditAction.SUBSCRIPTION_CREATED,
            AuditAction.SUBSCRIPTION_PLAN_CHANGED,
            AuditAction.SUBSCRIPTION_STATUS_CHANGED,
        ):
            entry = AuditLog.objects.get(action=action)
            assert entry.center_id == center.pk
            assert entry.payload["center_id"] == center.pk

    def test_the_motive_never_enters_a_payload(self):
        """Même règle que ``kyc_reason``, ``cancel_reason`` et le motif
        d'un litige : sur la ligne, jamais dans le log."""
        subscription = make_subscription(status=Status.ACTIVE)
        billing_services.set_subscription_status(
            actor=operator(), subscription=subscription,
            status=Status.SUSPENDED,
            reason="Le directeur ne répond plus depuis mars.",
        )
        entry = AuditLog.objects.get(
            action=AuditAction.SUBSCRIPTION_STATUS_CHANGED
        )
        assert entry.payload["has_reason"] is True
        assert entry.payload["old_status"] == Status.ACTIVE
        assert entry.payload["status"] == Status.SUSPENDED
        assert "mars" not in str(entry.payload)
        assert "directeur ne répond" not in str(entry.payload)

    def test_offer_catalogue_actions_belong_to_no_tenant(self):
        plan = billing_services.create_plan(
            actor=operator(), code="ESSENTIEL", name="Essentiel",
            price_kmf=Decimal("25000"),
        )
        billing_services.update_plan(
            actor=operator(), plan=plan, price_kmf=Decimal("30000")
        )
        for action in (
            AuditAction.SUBSCRIPTION_PLAN_CREATED,
            AuditAction.SUBSCRIPTION_PLAN_UPDATED,
        ):
            entry = AuditLog.objects.get(action=action)
            assert entry.center_id is None

    def test_the_director_reads_the_subscription_lines_of_his_own_center(self):
        """Décision consciente (ADR 0018 invariant 6) : ce sont des
        actions d'exploitation de SON centre. Le catalogue d'offres, lui,
        n'y apparaît jamais."""
        center, director = make_center_with_director()
        subscription = billing_services.create_subscription(
            actor=operator(), center=center, plan=make_plan()
        )
        billing_services.set_subscription_status(
            actor=operator(), subscription=subscription,
            status=Status.SUSPENDED, reason="Impayé.",
        )
        billing_services.create_plan(
            actor=operator(), code="AUTRE", name="Autre",
            price_kmf=Decimal("1000"),
        )
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        )
        actions = [row["action"] for row in response.data["results"]]
        assert AuditAction.SUBSCRIPTION_CREATED in actions
        assert AuditAction.SUBSCRIPTION_STATUS_CHANGED in actions
        assert AuditAction.SUBSCRIPTION_PLAN_CREATED not in actions
        # Le motif reste hors du journal (payload références seules).
        assert "Impayé." not in response.content.decode()


# ---------------------------------------------------------------------------
# 3 — les quotas (mesure only)
# ---------------------------------------------------------------------------


class TestQuotaMeasurement:
    def test_no_subscription_means_no_measure(self):
        assert billing_services.subscription_usage(make_center()) is None

    def test_a_person_is_one_seat_even_with_two_hats(self):
        """ADR 0001 : les rôles se cumulent — une infirmière qui tient
        aussi la caisse est un salaire, pas deux."""
        center, _director = make_center_with_director()
        polyvalent = make_staff_user(center, role=Role.NURSE)
        StaffMembership.objects.create(
            user=polyvalent, center=center, role=Role.CASHIER
        )
        make_subscription(center=center)
        usage = billing_services.subscription_usage(center)
        assert usage["staff"] == 2  # le directeur + la polyvalente
        assert usage["practitioners"] == 1

    def test_deactivated_members_free_their_seat(self):
        center, _director = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        make_subscription(center=center)
        StaffMembership.objects.filter(user=nurse, center=center).update(
            is_active=False
        )
        assert billing_services.subscription_usage(center)["staff"] == 1

    def test_an_unlimited_quota_is_never_exceeded(self):
        center, _director = make_center_with_director()
        make_subscription(
            center=center,
            plan=make_plan(included_staff=None, included_practitioners=None),
        )
        usage = billing_services.subscription_usage(center)
        assert usage["over_quota"] is False
        assert usage["exceeded"] == []

    def test_the_sql_annotation_agrees_with_the_per_center_aggregate(self):
        """Accord ensembliste ↔ dérivation unitaire, patron
        ``unpaid_invoices_qs`` ↔ ``invoice_balance_kmf`` (ADR 0015 2b) :
        deux lectures d'un même chiffre ne doivent jamais diverger."""
        for index in range(3):
            center, _director = make_center_with_director(
                name=f"Centre {index}"
            )
            for role in (Role.NURSE, Role.CASHIER, Role.DOCTOR)[: index + 1]:
                make_staff_user(center, role=role)
            make_subscription(
                center=center,
                plan=make_plan(included_staff=2, included_practitioners=1),
            )
        annotated = billing_services.annotate_subscription_usage(
            CenterSubscription.objects.select_related("center", "plan")
        )
        for subscription in annotated:
            assert billing_services.usage_from_annotations(
                subscription
            ) == billing_services.subscription_usage(subscription.center)


# ---------------------------------------------------------------------------
# 4 — l'API côté centre : le directeur, et lui seul
# ---------------------------------------------------------------------------


def center_url(center):
    return f"/api/v1/centers/{center.pk}/subscription/"


class TestCenterSubscriptionEndpoint:
    def test_the_director_reads_the_exact_contract(self):
        center, director = make_center_with_director()
        make_subscription(
            center=center,
            plan=make_plan(
                code="ESSENTIEL", price_kmf="25000",
                included_staff=10, included_practitioners=3,
            ),
            status=Status.UNPAID,
            status_reason="Échéance de juillet non réglée.",
        )
        response = client_for(director).get(center_url(center))
        assert response.status_code == 200
        assert set(response.data) == {
            "id", "status", "status_reason", "started_at",
            "current_period_end", "status_updated_at", "is_frozen",
            "plan", "usage",
        }
        assert response.data["status"] == Status.UNPAID
        assert response.data["is_frozen"] is False  # l'impayé ne gèle RIEN
        assert response.data["status_reason"] == (
            "Échéance de juillet non réglée."
        )
        assert set(response.data["plan"]) == {
            "id", "code", "name", "price_kmf", "billing_period",
            "included_practitioners", "included_staff", "is_active",
        }
        assert response.data["usage"] == {
            "staff": 1, "practitioners": 0,
            "included_staff": 10, "included_practitioners": 3,
            "exceeded": [], "over_quota": False,
        }

    @pytest.mark.parametrize(
        "role",
        [Role.CASHIER, Role.SECRETARY, Role.DOCTOR, Role.NURSE,
         Role.MIDWIFE, Role.PHARMACIST],
    )
    def test_every_other_role_is_403(self, role):
        """Arbitrage RÉVERSIBLE : le contrat commercial est du ressort du
        directeur, comme le dossier KYC et le journal d'audit."""
        center, _director = make_center_with_director()
        make_subscription(center=center)
        staff = make_staff_user(center, role=role)
        assert client_for(staff).get(center_url(center)).status_code == 403

    def test_a_center_without_a_contract_answers_404(self):
        center, director = make_center_with_director()
        response = client_for(director).get(center_url(center))
        assert response.status_code == 404
        assert "pas encore d'abonnement" in str(response.data)

    def test_a_foreign_center_is_invisible(self):
        _mine, director = make_center_with_director()
        other, _other_director = make_center_with_director(name="Voisine")
        make_subscription(center=other)
        assert client_for(director).get(center_url(other)).status_code == 404

    def test_a_patient_and_an_anonymous_never_enter(self):
        center, _director = make_center_with_director()
        make_subscription(center=center)
        patient = make_claimed_patient()
        assert client_for(patient.user).get(center_url(center)).status_code == 404
        assert client_for().get(center_url(center)).status_code == 401

    def test_a_chioni_operator_is_not_a_member_of_the_tenant(self):
        center, _director = make_center_with_director()
        make_subscription(center=center)
        assert client_for(operator()).get(center_url(center)).status_code == 404


# ---------------------------------------------------------------------------
# 5 — l'API plateforme : support lit, admin seul écrit
# ---------------------------------------------------------------------------


class TestPlatformPlanApi:
    def test_admin_creates_and_edits_an_offer(self):
        admin = operator()
        client = client_for(admin)
        response = client.post(
            "/api/v1/platform/plans/",
            {
                "code": "ESSENTIEL", "name": "Essentiel",
                "price_kmf": "25000", "billing_period": "mensuel",
                "included_staff": 10, "included_practitioners": 3,
            },
        )
        assert response.status_code == 201, response.content
        plan_id = response.data["id"]
        patched = client.patch(
            f"/api/v1/platform/plans/{plan_id}/", {"price_kmf": "30000"}
        )
        assert patched.status_code == 200
        assert patched.data["price_kmf"] == "30000.00"

    def test_a_fractional_price_is_refused_in_french(self):
        response = client_for(operator()).post(
            "/api/v1/platform/plans/",
            {"code": "FRAC", "name": "Fractionnaire", "price_kmf": "25000.50"},
        )
        assert response.status_code == 400
        assert "décimales" in str(response.data)

    def test_a_duplicate_code_is_refused(self):
        make_plan(code="ESSENTIEL")
        response = client_for(operator()).post(
            "/api/v1/platform/plans/",
            {"code": "ESSENTIEL", "name": "Doublon", "price_kmf": "1000"},
        )
        assert response.status_code == 400

    def test_the_active_filter_answers_400_on_garbage(self):
        response = client_for(operator()).get(
            "/api/v1/platform/plans/?is_active=peut-etre"
        )
        assert response.status_code == 400
        assert "is_active" in response.data

    def test_support_reads_the_catalogue_but_never_writes_it(self):
        make_plan(code="ESSENTIEL")
        support = operator(PlatformStaff.Role.SUPPORT)
        client = client_for(support)
        assert client.get("/api/v1/platform/plans/").status_code == 200
        assert client.post(
            "/api/v1/platform/plans/",
            {"code": "X", "name": "X", "price_kmf": "1000"},
        ).status_code == 403


class TestPlatformSubscriptionApi:
    def test_admin_opens_a_contract_and_freezes_it(self):
        center, director = make_center_with_director()
        plan = make_plan(code="ESSENTIEL")
        client = client_for(operator())

        created = client.post(
            "/api/v1/platform/subscriptions/",
            {"center": center.pk, "plan": plan.pk, "status": "actif"},
        )
        assert created.status_code == 201, created.content
        subscription_id = created.data["id"]
        assert created.data["center"] == center.pk
        assert created.data["usage"]["staff"] == 1

        frozen = client.post(
            f"/api/v1/platform/subscriptions/{subscription_id}/status/",
            {"status": "suspendu", "reason": "Trois échéances impayées."},
        )
        assert frozen.status_code == 200, frozen.content
        assert frozen.data["status"] == "suspendu"
        assert frozen.data["is_frozen"] is True

        # …et le centre le voit immédiatement, motif compris.
        seen = client_for(director).get(center_url(center))
        assert seen.data["is_frozen"] is True
        assert seen.data["status_reason"] == "Trois échéances impayées."

    def test_freezing_without_a_motive_answers_400(self):
        subscription = make_subscription(status=Status.ACTIVE)
        response = client_for(operator()).post(
            f"/api/v1/platform/subscriptions/{subscription.pk}/status/",
            {"status": "suspendu"},
        )
        assert response.status_code == 400
        assert "motif est obligatoire" in str(response.data)

    def test_changing_the_plan_through_the_api(self):
        subscription = make_subscription()
        target = make_plan(code="CLINIQUE", price_kmf="90000")
        response = client_for(operator()).post(
            f"/api/v1/platform/subscriptions/{subscription.pk}/plan/",
            {"plan": target.pk},
        )
        assert response.status_code == 200
        assert response.data["plan"]["code"] == "CLINIQUE"

    def test_body_references_answer_400_explicitly(self):
        """Norme S1 : référence dans le CORPS → 400 explicite (l'URL, elle,
        rend 404)."""
        client = client_for(operator())
        response = client.post(
            "/api/v1/platform/subscriptions/",
            {"center": 999999, "plan": make_plan().pk},
        )
        assert response.status_code == 400
        assert "introuvable" in str(response.data["center"])
        assert client.post(
            f"/api/v1/platform/subscriptions/999999/status/",
            {"status": "suspendu", "reason": "Motif."},
        ).status_code == 404

    def test_the_list_filters_and_never_leaks_another_hat(self):
        active = make_subscription(
            center=make_center(name="Ylang"), status=Status.ACTIVE
        )
        make_subscription(
            center=make_center(name="Karthala"), status=Status.SUSPENDED,
            status_reason="Impayé.",
        )
        client = client_for(operator(PlatformStaff.Role.SUPPORT))
        response = client.get("/api/v1/platform/subscriptions/?status=actif")
        assert [row["id"] for row in response.data["results"]] == [active.pk]

        assert client.get(
            "/api/v1/platform/subscriptions/?status=gele"
        ).status_code == 400
        assert client.get(
            "/api/v1/platform/subscriptions/?center=abc"
        ).status_code == 400
        # Un centre inexistant = page vide, jamais 404 : le périmètre de la
        # plateforme EST l'ensemble des centres (patron réconciliation).
        empty = client.get("/api/v1/platform/subscriptions/?center=999999")
        assert empty.status_code == 200 and empty.data["count"] == 0

    def test_support_never_writes(self):
        subscription = make_subscription(status=Status.ACTIVE)
        client = client_for(operator(PlatformStaff.Role.SUPPORT))
        for url, body in (
            (
                "/api/v1/platform/subscriptions/",
                {"center": make_center().pk, "plan": make_plan().pk},
            ),
            (
                f"/api/v1/platform/subscriptions/{subscription.pk}/status/",
                {"status": "suspendu", "reason": "Motif."},
            ),
            (
                f"/api/v1/platform/subscriptions/{subscription.pk}/plan/",
                {"plan": make_plan(code="OTHER").pk},
            ),
        ):
            response = client.post(url, body)
            assert response.status_code == 403, url
            assert "administrateurs de la plateforme" in str(response.data)

    def test_a_tenant_never_enters_the_back_office(self):
        center, director = make_center_with_director()
        subscription = make_subscription(center=center)
        for user in (director, make_user()):
            client = client_for(user)
            assert client.get(
                "/api/v1/platform/subscriptions/"
            ).status_code == 403
            assert client.post(
                f"/api/v1/platform/subscriptions/{subscription.pk}/status/",
                {"status": "suspendu", "reason": "Motif."},
            ).status_code == 403

    def test_the_list_payload_is_the_tenant_contract_and_nothing_else(self):
        make_subscription(center=make_center(name="Clinique Ylang"))
        response = client_for(operator()).get(
            "/api/v1/platform/subscriptions/"
        )
        (row,) = response.data["results"]
        assert set(row) == {
            "id", "center", "center_name", "status", "status_reason",
            "started_at", "current_period_end", "status_updated_at",
            "is_frozen", "plan", "usage", "created_at",
        }
