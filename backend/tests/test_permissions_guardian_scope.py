"""S1 — the guardian scope is REALLY checked (audit C.5.1).

Before this sprint ``IsGuardianWithScope(scope)`` never tested the scope:
the whole guardian perimeter rested on queryset discipline alone. Two
layers now, both locked here:

1. **Permission layer** — ``IsGuardianWithScope(scope)`` requires at least
   one ACTIVE link whose effective scopes (``Consent.objects.active_scopes``)
   include ``scope``. A guardian who was never granted a scope is stopped
   at the door (403) even if a future view forgot its queryset filter.
   ``IsGuardian`` (space door) keeps the link-lifecycle endpoints open to
   guardians with zero links (first invitation, first protégé).
2. **Structural guard-rail** — every route under ``/api/v1/guardian/``
   must declare a guardian permission, and the scoped-data routes
   (payment-requests, receipts) must declare the ``paiements`` scope.
   A new guardian endpoint cannot ship unguarded: this test fails.

Also locks the single-source role groups (audit C.5.2).
"""

from types import SimpleNamespace

import pytest
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver

from apps.common.permissions import IsGuardian, IsGuardianWithScope
from apps.medical.models import Consent
from apps.patients.services import grant_clinical_consent

from .api_helpers import (
    client_for,
    make_active_link,
    make_claimed_patient,
    make_guardian_user,
)
from .factories import make_user

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Layer 1 — the permission verifies the scope
# ---------------------------------------------------------------------------


class TestScopeIsReallyChecked:
    def test_guardian_with_an_active_link_passes_the_payments_door(self):
        user, profile = make_guardian_user()
        make_active_link(profile, make_claimed_patient())
        response = client_for(user).get("/api/v1/guardian/payment-requests/")
        assert response.status_code == 200

    def test_guardian_with_zero_links_is_stopped_at_the_door(self):
        user, _profile = make_guardian_user()
        for url in ("/api/v1/guardian/payment-requests/", "/api/v1/guardian/receipts/"):
            response = client_for(user).get(url)
            assert response.status_code == 403, url
            assert "Aucun lien de tutelle actif" in str(response.data)

    def test_revoking_the_only_link_closes_the_door_instantly(self):
        user, profile = make_guardian_user()
        link = make_active_link(profile, make_claimed_patient())
        client = client_for(user)
        assert client.get("/api/v1/guardian/payment-requests/").status_code == 200
        link.revoke()
        assert client.get("/api/v1/guardian/payment-requests/").status_code == 403

    def test_clinical_scope_is_denied_without_an_explicit_consent(self):
        """The mechanism that matters for the FUTURE clinical endpoints:
        a payments-only guardian must never pass a clinical-scoped
        permission, even if the view behind it forgot every filter."""
        user, profile = make_guardian_user()
        patient = make_claimed_patient()
        link = make_active_link(profile, patient)
        permission = IsGuardianWithScope(Consent.Scope.CLINICAL_DETAIL)()
        request = SimpleNamespace(user=user)

        assert permission.has_permission(request, view=None) is False

        grant_clinical_consent(patient_user=patient.user, link=link)
        assert permission.has_permission(request, view=None) is True

    def test_revoking_the_clinical_consent_closes_the_clinical_door(self):
        user, profile = make_guardian_user()
        patient = make_claimed_patient()
        link = make_active_link(profile, patient)
        grant_clinical_consent(patient_user=patient.user, link=link)
        permission = IsGuardianWithScope(Consent.Scope.CLINICAL_DETAIL)()
        request = SimpleNamespace(user=user)
        assert permission.has_permission(request, view=None) is True

        from apps.patients.services import revoke_clinical_consent

        revoke_clinical_consent(patient_user=patient.user, link=link)
        assert permission.has_permission(request, view=None) is False

    def test_non_guardian_keeps_the_generic_403(self):
        response = client_for(make_user()).get("/api/v1/guardian/payment-requests/")
        assert response.status_code == 403
        assert "Réservé aux tuteurs" in str(response.data)


class TestSpaceDoorStaysOpen:
    """``IsGuardian`` — no regression on the porte A flows: a brand-new
    guardian (zero links) keeps full access to their own space."""

    def test_fresh_guardian_lists_empty_invitations_and_proteges(self):
        user, _profile = make_guardian_user()
        client = client_for(user)
        invitations = client.get("/api/v1/guardian/invitations/")
        assert invitations.status_code == 200
        assert invitations.data["results"] == []
        proteges = client.get("/api/v1/guardian/proteges/")
        assert proteges.status_code == 200
        assert proteges.data["results"] == []

    def test_fresh_guardian_creates_their_first_protege(self):
        user, _profile = make_guardian_user()
        response = client_for(user).post(
            "/api/v1/guardian/proteges/",
            {
                "first_name": "Mariama", "last_name": "Ahamada",
                "relationship": "parent",
            },
        )
        assert response.status_code == 201, response.content

    def test_first_invitation_is_acceptable_without_any_active_link(self):
        """The exact trap a naive scope check would have sprung: a link
        awaiting acceptance is not ACTIVE, so it carries no scope — the
        accept endpoint must not require one."""
        from apps.patients.models import GuardianLink
        from apps.patients.services import invite_guardian

        patient = make_claimed_patient()
        guardian_user = make_user(phone="+2693399001")
        _g_user, _profile = make_guardian_user(user=guardian_user)
        link = invite_guardian(
            actor=patient.user, patient=patient, phone="+2693399001",
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        response = client_for(guardian_user).post(
            f"/api/v1/guardian/invitations/{link.pk}/accept/"
        )
        assert response.status_code == 200, response.content
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE


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


def _guardian_routes():
    for route, callback in _iter_api_routes():
        if route.startswith("api/v1/guardian/"):
            yield route, getattr(callback, "cls", None)


#: Scoped-DATA route prefixes: these serve rows, not link lifecycle —
#: they MUST declare a scope, not just the space door.
SCOPED_DATA_PREFIXES = (
    "api/v1/guardian/payment-requests/",
    "api/v1/guardian/receipts/",
)


class TestStructuralGuardRail:
    def test_every_guardian_route_declares_a_guardian_permission(self):
        routes = list(_guardian_routes())
        assert routes, "no guardian route found — the walker is broken"
        for route, view_cls in routes:
            if route == "api/v1/guardian/profile/":
                # The profile endpoint is the space's front desk: it must
                # answer « create your profile » to users who have none
                # yet, so it is IsAuthenticated by design (documented).
                continue
            assert view_cls is not None, route
            gates = [
                p for p in view_cls.permission_classes
                if getattr(p, "guardian_gate", False)
            ]
            assert gates, f"{route} declares no guardian permission"

    def test_scoped_data_routes_declare_the_payments_scope(self):
        seen = []
        for route, view_cls in _guardian_routes():
            if not route.startswith(SCOPED_DATA_PREFIXES):
                continue
            seen.append(route)
            scopes = {
                getattr(p, "required_scope", None)
                for p in view_cls.permission_classes
            }
            assert Consent.Scope.PAYMENTS in scopes, (
                f"{route} serves guardian data without the paiements scope"
            )
        assert len(seen) >= 6  # list/detail/quote/pay/dispute + receipts

    def test_permission_markers_exist(self):
        assert IsGuardian.guardian_gate is True
        scoped = IsGuardianWithScope(Consent.Scope.PAYMENTS)
        assert scoped.guardian_gate is True
        assert scoped.required_scope == Consent.Scope.PAYMENTS


# ---------------------------------------------------------------------------
# Single-source role groups (audit C.5.2)
# ---------------------------------------------------------------------------


class TestRoleGroupsSingleSource:
    def test_billing_roles_are_the_same_object_everywhere(self):
        from apps.common import roles
        from apps.centers import stats_views
        from apps.patients import views as patients_views
        from apps.trustbridge import views as trustbridge_views

        assert trustbridge_views.BILLING_ROLES is roles.BILLING_ROLES
        assert patients_views.BILLING_ROLES is roles.BILLING_ROLES
        assert stats_views.BILLING_ROLES is roles.BILLING_ROLES

    def test_clinical_roles_are_the_same_object_everywhere(self):
        from apps.common import roles
        from apps.centers import views as centers_views
        from apps.medical import views as medical_views

        assert medical_views.CLINICAL_ROLES is roles.CLINICAL_ROLES
        assert centers_views.CLINICAL_ROLES is roles.CLINICAL_ROLES
