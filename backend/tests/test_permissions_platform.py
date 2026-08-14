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

import pytest
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver

from apps.accounts.models import PlatformStaff
from apps.accounts.services import request_erasure
from apps.centers.models import HealthCenter

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
)
from .factories import make_center, make_encounter, make_platform_staff, make_user

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
        user, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        center = make_center()
        # S4 lot 3 — a real erasure request, so the « process » route is
        # exercised on an existing object (a 404 would hide the 403).
        erasure_request = request_erasure(user=make_user())
        client = client_for(user)
        assert client.get(f"/api/v1/platform/centers/{center.pk}/").status_code == 200
        assert client.get("/api/v1/platform/erasure-requests/").status_code == 200
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
        ):
            response = client.post(url, body)
            assert response.status_code == 403, url
            assert "administrateurs de la plateforme" in str(response.data)


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
        from apps.centers import platform_serializers, platform_views
        from apps.trustbridge import platform_views as tb_platform_views

        for module in (
            platform_views,
            platform_serializers,
            tb_platform_views,
            acc_platform_views,
            acc_platform_serializers,
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
        }


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
