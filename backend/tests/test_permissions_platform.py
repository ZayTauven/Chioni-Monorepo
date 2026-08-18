"""S4 (ADR 0017, décision 1) — the FOURTH hat and its structural guard-rail.

Three things are locked here, in the exact spirit of
``test_permissions_guardian_scope.py``:

1. **``is_staff``/``is_superuser`` grant NOTHING.** The right to enter
   ``/api/v1/platform/`` is an ACTIVE ``PlatformStaff`` row and nothing
   else — a Django superuser without one gets 403 everywhere. Coupling
   the flags would have made every admin account an operator by accident.
2. **Structural guard-rail** — every route under ``/api/v1/platform/``
   declares ``IsPlatformStaff``; the WRITE routes declare the ``admin``
   role. A new back-office endpoint cannot ship unguarded: this test
   fails.
3. **The operator never sees a patient** — negative field test over every
   platform payload, plus the assertion that no platform view imports a
   patient serializer. Chioni supervises centers, not sick people.
"""

from decimal import Decimal

import pytest
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver

from apps.accounts.models import PlatformStaff
from apps.accounts.services import request_erasure
from apps.billing.models import SubscriptionPayment
from apps.billing.services import record_subscription_payment
from apps.centers.models import HealthCenter
from apps.support.models import SupportMessage, SupportTicket
from apps.support.services import open_ticket, post_message

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_center,
    make_encounter,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_subscription_invoice,
    make_user,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Layer 1 — the hat is a dedicated row, never an admin flag
# ---------------------------------------------------------------------------


class TestTheHatIsAModelNotAFlag:
    def test_active_operator_enters_the_space(self):
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        assert client_for(user).get("/api/v1/platform/centers/").status_code == 200

    def test_django_superuser_without_a_row_is_403(self):
        """THE vigilance of the sprint: admin flags govern /admin/, not the
        product. A superuser is a plain authenticated user here."""
        superuser = make_user()
        superuser.is_staff = True
        superuser.is_superuser = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        center = make_center()

        client = client_for(superuser)
        for url in (
            "/api/v1/platform/centers/",
            f"/api/v1/platform/centers/{center.pk}/",
            f"/api/v1/platform/centers/{center.pk}/kyc-documents/",
        ):
            response = client.get(url)
            assert response.status_code == 403, url
            assert "équipe Chioni" in str(response.data)

    def test_deactivated_operator_is_indistinguishable_from_a_stranger(self):
        deactivated, _op = make_platform_staff(is_active=False)
        stranger = make_user()
        a = client_for(deactivated).get("/api/v1/platform/centers/")
        b = client_for(stranger).get("/api/v1/platform/centers/")
        assert a.status_code == b.status_code == 403
        assert a.content == b.content  # byte-identical: no oracle

    def test_anonymous_is_401(self):
        assert client_for().get("/api/v1/platform/centers/").status_code == 401

    def test_center_staff_and_guardians_have_no_back_office(self):
        _center, director = make_center_with_director()
        guardian_user, _profile = make_guardian_user()
        patient = make_claimed_patient()
        for user in (director, guardian_user, patient.user):
            assert (
                client_for(user).get("/api/v1/platform/centers/").status_code == 403
            )

    def test_support_reads_but_never_writes(self):
        """« support lit, admin seul écrit » — avec UNE exception, déclarée.

        S5 lot 3 (ADR 0018 décision 5) : répondre à un ticket et le faire
        avancer EST le métier du support. L'exception est vérifiée
        POSITIVEMENT dans la classe dédiée plus bas
        (:class:`TestSupportAnswersTicketsAndNothingElse`) plutôt que
        laissée implicite ici — et elle ne touche ni un tenant, ni un
        franc, ni un patient.
        """
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        center = make_center()
        # S4 lot 3 — a real erasure request, so the « process » route is
        # exercised on an existing object (a 404 would hide the 403).
        erasure_request = request_erasure(user=make_user())
        # S5 lot 1 — same reasoning for the subscription write routes.
        plan = make_plan(code="ESSENTIEL")
        subscription = make_subscription(center=center, plan=plan)
        # S5 lot 2 — a REAL invoice and a REAL settlement, so the four
        # billing write routes are refused on existing objects.
        saas_invoice = make_subscription_invoice(subscription)
        saas_payment = record_subscription_payment(
            actor=make_platform_staff()[0], invoice=saas_invoice,
            amount_kmf=Decimal("5000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        client = client_for(user)
        assert client.get(f"/api/v1/platform/centers/{center.pk}/").status_code == 200
        assert client.get("/api/v1/platform/erasure-requests/").status_code == 200
        assert client.get("/api/v1/platform/plans/").status_code == 200
        assert client.get("/api/v1/platform/subscriptions/").status_code == 200
        assert client.get("/api/v1/platform/subscription-invoices/").status_code == 200
        assert client.get("/api/v1/platform/support/tickets/").status_code == 200
        # S5 lot 3 — la SEULE lecture fermée au support : la liste des
        # exploitants. Qui détient la 4ᵉ casquette est de la gouvernance
        # (« admin » seul), pas de la matière de support : un `support`
        # n'a pas à savoir qui peut le désactiver.
        assert client.get("/api/v1/platform/operators/").status_code == 403
        for url, body in (
            ("/api/v1/platform/centers/", {"name": "X"}),
            (f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "actif"}),
            (
                f"/api/v1/platform/centers/{center.pk}/directors/",
                {"phone": "+2693390111"},
            ),
            (
                f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
                {"decision": "anonymiser"},
            ),
            # S5 lot 1 (ADR 0018) — l'abonnement : support lit, admin écrit.
            ("/api/v1/platform/plans/", {"code": "X", "name": "X",
                                         "price_kmf": "1000"}),
            (
                "/api/v1/platform/subscriptions/",
                {"center": center.pk, "plan": plan.pk},
            ),
            (
                f"/api/v1/platform/subscriptions/{subscription.pk}/status/",
                {"status": "suspendu", "reason": "Motif."},
            ),
            (
                f"/api/v1/platform/subscriptions/{subscription.pk}/plan/",
                {"plan": plan.pk},
            ),
            # S5 lot 2 (ADR 0018 décision 4) — la facturation SaaS : émettre,
            # encaisser, contre-passer, annuler sont des actes d'``admin``.
            (
                f"/api/v1/platform/subscriptions/{subscription.pk}/invoices/",
                {},
            ),
            (
                f"/api/v1/platform/subscription-invoices/{saas_invoice.pk}/payments/",
                {"amount_kmf": "1000", "method": "virement"},
            ),
            (
                f"/api/v1/platform/subscription-invoices/{saas_invoice.pk}"
                f"/payments/{saas_payment.pk}/reverse/",
                {"reason": "Erreur de saisie."},
            ),
            (
                f"/api/v1/platform/subscription-invoices/{saas_invoice.pk}/cancel/",
                {"reason": "Facture erronée."},
            ),
            # S5 lot 3 (ADR 0018 décision 6) — l'équipe Chioni elle-même :
            # créer un exploitant est un acte de gouvernance, pas de
            # support (sinon un `support` se promeut administrateur).
            ("/api/v1/platform/operators/", {"phone": "+2693390222",
                                             "role": "admin"}),
        ):
            response = client.post(url, body)
            assert response.status_code == 403, url
            assert "administrateurs de la plateforme" in str(response.data)
        # Les deux routes d'écriture qui ne sont pas des POST.
        patched = client.patch(
            f"/api/v1/platform/plans/{plan.pk}/", {"price_kmf": "30000"}
        )
        assert patched.status_code == 403
        assert "administrateurs de la plateforme" in str(patched.data)
        promoted = client.patch(
            f"/api/v1/platform/operators/{_op.pk}/", {"role": "admin"}
        )
        assert promoted.status_code == 403
        assert "administrateurs de la plateforme" in str(promoted.data)


# ---------------------------------------------------------------------------
# Layer 2 — structural guard-rail over the URL tree
# ---------------------------------------------------------------------------


def _iter_api_routes():
    def walk(patterns, prefix):
        for entry in patterns:
            if isinstance(entry, URLResolver):
                yield from walk(entry.url_patterns, prefix + str(entry.pattern))
            elif isinstance(entry, URLPattern):
                yield prefix + str(entry.pattern), entry.callback
    yield from walk(get_resolver().url_patterns, "")


def _platform_routes():
    for route, callback in _iter_api_routes():
        if route.startswith("api/v1/platform/"):
            yield route, getattr(callback, "cls", None)


def _declared_permissions(view_cls):
    """The permission classes a view declares, whatever the method.

    ``get_permissions()`` overrides (list vs create) hide the write class
    from ``permission_classes``; the ones used here keep the SPACE door in
    the attribute, and the role split is asserted behaviourally above.
    """
    return list(getattr(view_cls, "permission_classes", []) or [])


class TestStructuralGuardRail:
    def test_every_platform_route_declares_the_platform_permission(self):
        routes = list(_platform_routes())
        assert routes, "no platform route found — the walker is broken"
        for route, view_cls in routes:
            assert view_cls is not None, route
            gates = [
                p for p in _declared_permissions(view_cls)
                if getattr(p, "platform_gate", False)
            ]
            assert gates, f"{route} declares no platform permission"

    def test_no_platform_route_falls_back_on_the_default_permission(self):
        """Deny-by-default (``IsAuthenticated``) is NOT enough here: it
        would open the back-office to every patient in the country. The
        identity check catches a view that declared nothing at all (DRF
        hands back the very ``DEFAULT_PERMISSION_CLASSES`` list object)."""
        from rest_framework.settings import api_settings

        for route, view_cls in _platform_routes():
            assert (
                view_cls.permission_classes
                is not api_settings.DEFAULT_PERMISSION_CLASSES
            ), f"{route} relies on DEFAULT_PERMISSION_CLASSES"

    def test_permission_marker_exists_and_carries_its_roles(self):
        from apps.common.permissions import IsPlatformStaff

        space = IsPlatformStaff()
        assert space.platform_gate is True
        assert space.required_platform_roles == ()
        writer = IsPlatformStaff(PlatformStaff.Role.ADMIN)
        assert writer.required_platform_roles == (PlatformStaff.Role.ADMIN,)


# ---------------------------------------------------------------------------
# Layer 3 — the operator never sees a patient (invariant éthique du sprint)
# ---------------------------------------------------------------------------


#: Anything patient-shaped that must NEVER appear in a platform payload.
FORBIDDEN_KEYS = {
    "patient", "patients", "patient_id", "first_name", "last_name",
    "birth_date", "sex", "diagnosis", "reason_clinical", "encounter",
    "encounters", "prescriptions", "record_entries", "documents",
    "vital_signs", "blood_group", "medical_file", "insurances",
    "claim_status", "guardian", "guardian_links",
}


def _keys(payload):
    if isinstance(payload, dict):
        for key, value in payload.items():
            yield key
            yield from _keys(value)
    elif isinstance(payload, list):
        for item in payload:
            yield from _keys(item)


class TestNoPatientEverReachesThePlatform:
    def test_center_payloads_carry_the_tenant_and_nothing_else(self):
        center, director = make_center_with_director(name="Clinique Ylang")
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")
        make_encounter(patient=patient, center=center)
        operator, _op = make_platform_staff()
        # S4 lot 3 — THE hardest case for this invariant: an erasure
        # request is ABOUT a person, and that person here is a PATIENT.
        # The back-office queue must still carry an id and hats, never a
        # name (« Anfia »/« Saïd » are asserted absent from the body).
        request_erasure(user=patient.user)
        # S5 lot 1 — un contrat d'abonnement RÉEL sur ce centre : les
        # payloads d'abonnement sont mesurés pleins, jamais vides.
        subscription = make_subscription(
            center=center, plan=make_plan(code="ESSENTIEL")
        )
        # S5 lot 2 — une facture SaaS RÉELLE, réglée pour partie : le
        # payload le plus chargé du module (facture + règlements imbriqués)
        # est celui qu'on mesure. Le patient d'à côté n'y entre jamais.
        saas_invoice = make_subscription_invoice(subscription)
        record_subscription_payment(
            actor=operator, invoice=saas_invoice, amount_kmf=Decimal("5000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        # S5 lot 3 — un ticket RÉEL avec son fil : c'est le payload
        # plateforme le plus exposé au risque (du texte libre écrit par un
        # humain du centre). Le corps du ticket ne nomme personne, et rien
        # dans la structure ne pointe un patient.
        ticket = open_ticket(
            actor=director, center=center,
            subject="Le sélecteur de tarifs est vide",
            category=SupportTicket.Category.BUG,
            body="Depuis ce matin la liste des tarifs ne se charge pas.",
        )
        post_message(
            actor=operator, ticket=ticket, body="Nous regardons, merci.",
            side=SupportMessage.Side.CHIONI,
        )

        client = client_for(operator)
        for url in (
            "/api/v1/platform/centers/",
            f"/api/v1/platform/centers/{center.pk}/",
            "/api/v1/platform/centers/similar/?name=Ylang",
            f"/api/v1/platform/centers/{center.pk}/kyc-documents/",
            # S4 lot 2 — réconciliation PSP (ADR 0017 décision 6).
            "/api/v1/platform/reconciliation/",
            # S4 lot 3 — RGPD (ADR 0017 décision 7).
            "/api/v1/platform/erasure-requests/",
            # S5 lot 1 — abonnement SaaS (ADR 0018 décisions 2 & 3).
            "/api/v1/platform/plans/",
            "/api/v1/platform/subscriptions/",
            f"/api/v1/platform/subscriptions/{subscription.pk}/",
            # S5 lot 2 — facturation SaaS (ADR 0018 décision 4).
            "/api/v1/platform/subscription-invoices/",
            "/api/v1/platform/subscription-invoices/?overdue=true",
            f"/api/v1/platform/subscription-invoices/{saas_invoice.pk}/",
            f"/api/v1/platform/subscription-invoices/{saas_invoice.pk}/payments/",
            f"/api/v1/platform/subscriptions/{subscription.pk}/invoices/",
            # S5 lot 3 — module Support (ADR 0018 décision 5) et gestion de
            # l'équipe Chioni (décision 6).
            "/api/v1/platform/support/tickets/",
            "/api/v1/platform/support/tickets/?open=true",
            f"/api/v1/platform/support/tickets/{ticket.pk}/",
            f"/api/v1/platform/support/tickets/{ticket.pk}/messages/",
            "/api/v1/platform/operators/",
        ):
            response = client.get(url)
            assert response.status_code == 200, url
            keys = set(_keys(response.data))
            assert not (keys & FORBIDDEN_KEYS), (url, keys & FORBIDDEN_KEYS)
            body = response.content.decode()
            assert "Anfia" not in body and "Saïd" not in body

    def test_no_platform_module_imports_a_patient_serializer(self):
        """Structural, not behavioural: a future view could add one by
        copy-paste. The module namespace must stay patient-free — EVERY
        module mounted under the platform prefix, whatever its app."""
        from apps.accounts import platform_serializers as acc_platform_serializers
        from apps.accounts import platform_views as acc_platform_views
        from apps.billing import platform_serializers as bil_platform_serializers
        from apps.billing import platform_views as bil_platform_views
        from apps.centers import platform_serializers, platform_views
        from apps.support import platform_serializers as sup_platform_serializers
        from apps.support import platform_views as sup_platform_views
        from apps.trustbridge import platform_views as tb_platform_views

        for module in (
            platform_views,
            platform_serializers,
            tb_platform_views,
            acc_platform_views,
            acc_platform_serializers,
            bil_platform_views,
            bil_platform_serializers,
            sup_platform_views,
            sup_platform_serializers,
        ):
            names = [n.lower() for n in vars(module)]
            assert not [n for n in names if "patient" in n], module.__name__

    def test_platform_center_payload_is_exactly_the_tenant_contract(self):
        make_center(name="Polyclinique Ndzuwani")
        operator, _op = make_platform_staff()
        response = client_for(operator).get("/api/v1/platform/centers/")
        (row,) = response.data["results"]
        assert set(row) == {
            "id", "name", "type", "island", "city", "address", "phone",
            "email", "kyc_status", "kyc_reason", "kyc_updated_at",
            "created_at", "staff_active_count", "director_active_count",
            "kyc_document_count",
            # SV (mise à jour CONSCIENTE du contrat exact) : `logo` — le
            # papier de facture plateforme rend enfin le vrai logo. Une
            # donnée d'identité VISUELLE du tenant, jamais une donnée
            # patient : l'invariant de cette classe est intact.
            "logo",
        }


class TestSupportAnswersTicketsAndNothingElse:
    """THE documented exception of « support lit, admin seul écrit ».

    S5 lot 3, ADR 0018 décision 5 : un `support` répond aux tickets et les
    fait avancer — c'est littéralement son métier, et un rôle qui lirait la
    file sans jamais pouvoir y répondre serait décoratif. L'exception est
    étroite, et ce test la borne dans les DEUX sens : ce qu'elle ouvre, et
    ce qu'elle n'ouvre pas.
    """

    def _ticket(self):
        center, director = make_center_with_director()
        return open_ticket(
            actor=director, center=center, subject="Écran blanc à la caisse",
            category=SupportTicket.Category.BUG,
        )

    def test_support_answers_a_ticket(self):
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        ticket = self._ticket()
        response = client_for(user).post(
            f"/api/v1/platform/support/tickets/{ticket.pk}/messages/",
            {"body": "Bonjour, pouvez-vous préciser l'heure du blocage ?"},
        )
        assert response.status_code == 201
        assert response.data["author_side"] == SupportMessage.Side.CHIONI

    def test_support_moves_a_ticket_along(self):
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        ticket = self._ticket()
        response = client_for(user).post(
            f"/api/v1/platform/support/tickets/{ticket.pk}/status/",
            {"status": SupportTicket.Status.IN_PROGRESS},
        )
        assert response.status_code == 200
        ticket.refresh_from_db()
        assert ticket.status == SupportTicket.Status.IN_PROGRESS

    def test_the_exception_stops_at_the_conversation(self):
        """Ni tenant, ni argent, ni équipe : le `support` reste un lecteur
        partout ailleurs (le balayage complet est au-dessus)."""
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        center = make_center()
        client = client_for(user)
        assert client.post(
            f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "actif"}
        ).status_code == 403
        assert client.post(
            "/api/v1/platform/operators/",
            {"phone": "+2693390333", "role": "support"},
        ).status_code == 403


class TestMePayloadRoutesTheFourthSpace:
    def test_operator_sees_their_hat(self):
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        response = client_for(user).get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["platform_staff"] == {
            "id": _op.pk, "role": "support", "is_active": True,
        }

    def test_everyone_else_sees_null(self):
        _center, director = make_center_with_director()
        superuser = make_user()
        superuser.is_superuser = superuser.is_staff = True
        superuser.save(update_fields=["is_staff", "is_superuser"])
        for user in (director, superuser):
            response = client_for(user).get("/api/v1/auth/me/")
            assert response.data["platform_staff"] is None

    def test_a_deactivated_operator_no_longer_routes_the_space(self):
        user, operator = make_platform_staff()
        operator.is_active = False
        operator.save(update_fields=["is_active", "updated_at"])
        response = client_for(user).get("/api/v1/auth/me/")
        assert response.data["platform_staff"] is None

    def test_hats_cumulate_without_bleeding(self):
        """A Chioni operator may also be a doctor somewhere and a guardian
        — the hats add up in ``me``, they never merge into a right."""
        center, director = make_center_with_director()
        _user, operator = make_platform_staff(user=director)
        response = client_for(director).get("/api/v1/auth/me/")
        assert response.data["platform_staff"]["role"] == operator.role
        assert len(response.data["staff_memberships"]) == 1
        # …and the tenant hat still cannot flip its own KYC.
        assert (
            client_for(director).patch(
                f"/api/v1/centers/{center.pk}/", {"kyc_status": "suspendu"}
            ).status_code == 200
        )
        center.refresh_from_db()
        assert center.kyc_status == HealthCenter.KycStatus.ACTIVE
