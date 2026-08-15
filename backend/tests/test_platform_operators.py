"""S5 lot 3 (ADR 0018 décision 6) — l'équipe Chioni se gère par API.

L'ADR 0017 laissait `PlatformStaffAdmin` écrivable « à dessein » : le tout
premier exploitant ne pouvait naître nulle part ailleurs. La revue
adversariale S4 a consigné le prix — « un superuser Django est toujours à
un formulaire de la 4ᵉ casquette ». Ce lot le paie, avec deux portes :

- **produit** : `GET|POST /platform/operators/` et
  `PATCH /platform/operators/{pk}/`, ``admin`` SEUL, auditées, avec la
  garde « dernier admin actif » RÉUTILISÉE (jamais dupliquée) depuis le
  RGPD ;
- **hors ligne** : ``python manage.py create_platform_staff``, utilisable
  en production, qui ne transmet aucun identifiant (compte ombre + OTP).

Ce fichier verrouille les deux, plus la séparation des pouvoirs en
MIROIR de celle de S4 (un exploitant ne peut pas s'amorcer directeur ; un
membre du personnel d'un centre ne reçoit pas la 4ᵉ casquette).
"""

from io import StringIO

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import PlatformStaff
from apps.accounts.services import (
    create_platform_staff,
    update_platform_staff,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import make_center, make_platform_staff, make_staff, make_user

pytestmark = pytest.mark.django_db

#: Exact payload of an operator row — IDS ONLY. No name, no phone, no
#: e-mail, no username (a shadow username carries the phone inside it).
OPERATOR_FIELDS = {"id", "user", "role", "is_active", "created_at", "updated_at"}

OPERATORS_URL = "/api/v1/platform/operators/"


def admin_client():
    user, operator = make_platform_staff(role=PlatformStaff.Role.ADMIN)
    return client_for(user), user, operator


def staff_of_a_center(phone, role=Role.DIRECTOR):
    """A center staff member holding a REAL E.164 comorian number.

    ``make_user`` mints sequential fake numbers that ``normalize_phone``
    rightly refuses; the separation-of-duties guard is reached only with a
    number the platform door would actually accept.
    """
    user = make_user(phone=phone)
    make_staff(user=user, center=make_center(), role=role)
    return user


# ---------------------------------------------------------------------------
# Créer un exploitant
# ---------------------------------------------------------------------------


class TestCreatingAnOperator:
    def test_an_admin_creates_one_from_a_phone(self):
        client, _user, _op = admin_client()
        response = client.post(
            OPERATORS_URL,
            {"phone": "+2693390111", "role": "support",
             "first_name": "Moinaecha", "last_name": "Bacar"},
        )
        assert response.status_code == 201
        assert set(response.data) == OPERATOR_FIELDS
        operator = PlatformStaff.objects.get(pk=response.data["id"])
        assert operator.role == PlatformStaff.Role.SUPPORT
        assert operator.is_active is True

    def test_the_account_is_a_shadow_claimed_by_otp(self):
        """Aucun mot de passe n'est transmis — pas même pour l'équipe
        Chioni (ADR 0010 : le téléphone est le pivot, l'OTP la porte)."""
        client, _user, _op = admin_client()
        response = client.post(
            OPERATORS_URL, {"phone": "+2693390112", "role": "admin"}
        )
        operator = PlatformStaff.objects.get(pk=response.data["id"])
        assert operator.user.has_usable_password() is False
        assert operator.user.phone_verified_at is None
        assert operator.user.phone == "+2693390112"

    def test_the_payload_never_names_the_person(self):
        client, _user, _op = admin_client()
        client.post(
            OPERATORS_URL,
            {"phone": "+2693390113", "role": "support",
             "first_name": "Zaïnaba", "last_name": "Combo"},
        )
        listed = client.get(OPERATORS_URL)
        body = listed.content.decode()
        assert "Zaïnaba" not in body and "Combo" not in body
        assert "2693390113" not in body  # ni dans un username d'ombre

    def test_a_phone_spelled_differently_lands_on_the_same_account(self):
        client, _user, _op = admin_client()
        first = client.post(
            OPERATORS_URL, {"phone": "+2693390114", "role": "support"}
        )
        assert first.status_code == 201
        again = client.post(
            OPERATORS_URL, {"phone": "2693390114", "role": "admin"}
        )
        assert again.status_code == 400
        assert "fait déjà partie de l'équipe Chioni" in str(again.data)

    def test_an_invalid_phone_is_refused_and_creates_nothing(self):
        client, _user, _op = admin_client()
        before = PlatformStaff.objects.count()
        response = client.post(
            OPERATORS_URL, {"phone": "pas-un-numero", "role": "support"}
        )
        assert response.status_code == 400
        assert PlatformStaff.objects.count() == before

    def test_an_unknown_role_is_refused_per_field(self):
        client, _user, _op = admin_client()
        response = client.post(
            OPERATORS_URL, {"phone": "+2693390115", "role": "patron"}
        )
        assert response.status_code == 400
        assert "role" in response.data

    def test_center_staff_never_receives_the_fourth_hat(self):
        """Séparation des pouvoirs, en MIROIR de la garde S4.

        ``_refuse_platform_operator_as_director`` ferme « exploitant →
        directeur ». Sans cette garde-ci, le MÊME état (une personne
        portant la casquette tenant ET la casquette back-office) était
        atteignable par l'autre bout : nommer directeur d'abord, donner la
        4ᵉ casquette ensuite. Une garde qui ne tient que dans un sens n'est
        pas une garde.
        """
        client, _user, _op = admin_client()
        director = staff_of_a_center("+2693390150")
        response = client.post(
            OPERATORS_URL, {"phone": director.phone, "role": "admin"}
        )
        assert response.status_code == 400
        assert "personnel d'un centre" in str(response.data)
        assert not PlatformStaff.objects.filter(user=director).exists()

    def test_a_deactivated_membership_no_longer_blocks(self):
        """La garde regarde les memberships ACTIFS : quelqu'un qui a quitté
        un centre peut rejoindre Chioni."""
        client, _user, _op = admin_client()
        leaver = staff_of_a_center("+2693390151", role=Role.CASHIER)
        leaver.staff_memberships.update(is_active=False)
        response = client.post(
            OPERATORS_URL, {"phone": leaver.phone, "role": "support"}
        )
        assert response.status_code == 201

    def test_the_tenant_door_stays_open_the_other_way_round(self):
        """Ce qu'on NE ferme pas : un directeur reste libre d'embaucher
        quelqu'un qui travaille aussi chez Chioni — c'est SA décision,
        tracée (garde S4 : seule la porte PLATEFORME est fermée)."""
        from apps.centers.services import add_center_director, add_staff_member

        center, director = make_center_with_director()
        operator_user, _op = make_platform_staff(
            user=make_user(phone="+2693390152")
        )
        with pytest.raises(ValidationError):
            # …mais pas par la porte plateforme.
            add_center_director(
                actor=director, center=center, phone=operator_user.phone
            )
        membership = add_staff_member(
            actor=director, center=center, phone=operator_user.phone,
            role=Role.NURSE,
        )
        assert membership.pk is not None


# ---------------------------------------------------------------------------
# Modifier un exploitant : rôle, activation, et LA garde
# ---------------------------------------------------------------------------


class TestUpdatingAnOperator:
    def test_role_change_and_deactivation(self):
        client, _user, _op = admin_client()
        _target_user, target = make_platform_staff(
            role=PlatformStaff.Role.SUPPORT
        )
        promoted = client.patch(
            f"{OPERATORS_URL}{target.pk}/", {"role": "admin"}
        )
        assert promoted.status_code == 200
        target.refresh_from_db()
        assert target.role == PlatformStaff.Role.ADMIN
        revoked = client.patch(
            f"{OPERATORS_URL}{target.pk}/", {"is_active": False}
        )
        assert revoked.status_code == 200
        target.refresh_from_db()
        assert target.is_active is False

    def test_a_revoked_operator_loses_the_space_immediately(self):
        client, _user, _op = admin_client()
        target_user, target = make_platform_staff(
            role=PlatformStaff.Role.SUPPORT
        )
        assert client_for(target_user).get(
            "/api/v1/platform/support/tickets/"
        ).status_code == 200
        client.patch(f"{OPERATORS_URL}{target.pk}/", {"is_active": False})
        # ``force_authenticate`` réutilise l'objet User du test, qui garde
        # sa relation OneToOne en cache : on relit, comme le ferait une
        # vraie requête authentifiée par JWT.
        target_user.refresh_from_db()
        assert client_for(target_user).get(
            "/api/v1/platform/support/tickets/"
        ).status_code == 403
        assert client_for(target_user).get(
            "/api/v1/auth/me/"
        ).data["platform_staff"] is None

    def test_the_last_active_admin_cannot_be_demoted_or_deactivated(self):
        """Perdre tous les administrateurs enfermerait Chioni hors de son
        propre back-office — et l'admin Django, désormais read-only, ne
        peut plus en refabriquer un."""
        client, _user, operator = admin_client()
        # Un `support` existe : il ne compte pas comme filet.
        make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        for body in ({"role": "support"}, {"is_active": False}):
            response = client.patch(f"{OPERATORS_URL}{operator.pk}/", body)
            assert response.status_code == 400
            assert "dernier administrateur actif" in str(response.data)
        operator.refresh_from_db()
        assert operator.role == PlatformStaff.Role.ADMIN
        assert operator.is_active is True

    def test_a_second_admin_unlocks_the_guard(self):
        client, _user, operator = admin_client()
        make_platform_staff(role=PlatformStaff.Role.ADMIN)
        response = client.patch(
            f"{OPERATORS_URL}{operator.pk}/", {"is_active": False}
        )
        assert response.status_code == 200

    def test_the_guard_is_the_rgpd_one_never_a_copy(self):
        """Une garde dupliquée dérive. Celle-ci est la fonction du RGPD,
        avec son verrou de lignes ordonné (correctif de course S4)."""
        import inspect

        from apps.accounts import services

        source = inspect.getsource(services.update_platform_staff)
        assert "_is_last_platform_admin" in source

    def test_an_empty_patch_is_refused(self):
        client, _user, _op = admin_client()
        _target_user, target = make_platform_staff(
            role=PlatformStaff.Role.SUPPORT
        )
        response = client.patch(f"{OPERATORS_URL}{target.pk}/", {})
        assert response.status_code == 400

    def test_an_unknown_operator_is_a_404(self):
        client, _user, _op = admin_client()
        assert client.patch(
            f"{OPERATORS_URL}999999/", {"role": "support"}
        ).status_code == 404

    def test_there_is_no_delete(self):
        """Une ligne d'exploitant est de l'histoire (elle rend lisible une
        vieille entrée d'audit) : on révoque, on ne supprime pas."""
        client, _user, _op = admin_client()
        _target_user, target = make_platform_staff(
            role=PlatformStaff.Role.SUPPORT
        )
        assert client.delete(
            f"{OPERATORS_URL}{target.pk}/"
        ).status_code == 405

    def test_filters(self):
        client, _user, _op = admin_client()
        make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        assert client.get(
            f"{OPERATORS_URL}?role=support"
        ).data["count"] == 1
        assert client.get(
            f"{OPERATORS_URL}?is_active=true"
        ).data["count"] == 2
        assert client.get(f"{OPERATORS_URL}?role=patron").status_code == 400
        assert client.get(
            f"{OPERATORS_URL}?is_active=peut-etre"
        ).status_code == 400


# ---------------------------------------------------------------------------
# Audit — références seules, et hors journal du directeur
# ---------------------------------------------------------------------------


class TestAudit:
    def test_both_actions_carry_references_only(self):
        client, _user, _op = admin_client()
        created = client.post(
            OPERATORS_URL,
            {"phone": "+2693390116", "role": "support",
             "first_name": "Moinaecha"},
        )
        client.patch(
            f"{OPERATORS_URL}{created.data['id']}/", {"role": "admin"}
        )
        opened = AuditLog.objects.get(
            action=AuditAction.PLATFORM_STAFF_CREATED
        )
        assert set(opened.payload) == {
            "platform_staff_id", "user_id", "role", "account_created"
        }
        updated = AuditLog.objects.get(
            action=AuditAction.PLATFORM_STAFF_UPDATED
        )
        assert updated.payload["fields"] == "role"
        blob = f"{opened.payload}{updated.payload}"
        assert "Moinaecha" not in blob and "2693390116" not in blob

    def test_they_are_transverse_and_never_in_a_directors_journal(self):
        """Elles ne concernent AUCUN tenant : ``center=None``, donc hors
        liste blanche par construction."""
        client, _user, _op = admin_client()
        client.post(OPERATORS_URL, {"phone": "+2693390117", "role": "support"})
        entry = AuditLog.objects.get(action=AuditAction.PLATFORM_STAFF_CREATED)
        assert entry.center_id is None
        assert AuditAction.PLATFORM_STAFF_CREATED not in DIRECTOR_JOURNAL_ACTIONS
        assert AuditAction.PLATFORM_STAFF_UPDATED not in DIRECTOR_JOURNAL_ACTIONS


# ---------------------------------------------------------------------------
# L'amorçage hors ligne — la commande de management
# ---------------------------------------------------------------------------


class TestTheBootstrapCommand:
    def _run(self, **options):
        out = StringIO()
        call_command("create_platform_staff", stdout=out, **options)
        return out.getvalue()

    def test_it_creates_the_very_first_operator(self):
        output = self._run(phone="+2693390200", role="admin")
        operator = PlatformStaff.objects.get()
        assert operator.role == PlatformStaff.Role.ADMIN
        assert f"Exploitant #{operator.pk}" in output
        assert "OTP" in output

    def test_it_grants_no_credential(self):
        """Le seul secret d'un exploitant est son téléphone : la commande
        ne crée ni ne montre de mot de passe."""
        output = self._run(phone="+2693390201", role="support")
        operator = PlatformStaff.objects.get()
        assert operator.user.has_usable_password() is False
        assert "mot de passe" in output.lower()
        assert "ChioniDemo" not in output

    @override_settings(DEBUG=False)
    def test_it_runs_in_production(self):
        """Contrairement à ``seed_demo`` et ``simulate_psp_payment``, cette
        commande EST le geste d'installation : aucune garde DEBUG."""
        self._run(phone="+2693390202", role="admin")
        assert PlatformStaff.objects.count() == 1

    def test_it_normalises_a_national_number(self):
        self._run(phone="3390203", role="support")
        assert PlatformStaff.objects.get().user.phone == "+2693390203"

    def test_an_invalid_phone_stops_the_command(self):
        with pytest.raises(CommandError) as exc:
            self._run(phone="pas-un-numero", role="admin")
        assert "invalide" in str(exc.value).lower()
        assert not PlatformStaff.objects.exists()

    def test_a_duplicate_is_named_not_silently_upgraded(self):
        self._run(phone="+2693390204", role="support")
        with pytest.raises(CommandError) as exc:
            self._run(phone="+2693390204", role="admin")
        assert "fait déjà partie de l'équipe Chioni" in str(exc.value)
        assert PlatformStaff.objects.get().role == PlatformStaff.Role.SUPPORT

    def test_center_staff_is_refused_here_too(self):
        director = staff_of_a_center("+2693390207")
        with pytest.raises(CommandError) as exc:
            self._run(phone=director.phone, role="admin")
        assert "personnel d'un centre" in str(exc.value)

    def test_an_unknown_role_is_refused_by_the_parser(self):
        with pytest.raises(CommandError):
            self._run(phone="+2693390205", role="patron")

    def test_the_bootstrap_is_audited_without_an_actor(self):
        self._run(phone="+2693390206", role="admin")
        entry = AuditLog.objects.get(action=AuditAction.PLATFORM_STAFF_CREATED)
        assert entry.actor_id is None
        assert entry.payload["role"] == PlatformStaff.Role.ADMIN


# ---------------------------------------------------------------------------
# Les services, appelés directement (chemins hors HTTP)
# ---------------------------------------------------------------------------


class TestTheServicesGuardThemselves:
    def test_an_unknown_role_is_refused_by_the_service(self):
        with pytest.raises(ValidationError):
            create_platform_staff(actor=None, phone="+2693390300", role="patron")

    def test_update_refuses_an_unknown_role(self):
        _user, operator = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        with pytest.raises(ValidationError):
            update_platform_staff(actor=None, operator=operator, role="patron")

    def test_the_guard_holds_outside_http_too(self):
        """La garde vit dans le SERVICE, pas chez l'appelant (leçon
        ``anonymize_user`` de la revue S4)."""
        _user, operator = make_platform_staff(role=PlatformStaff.Role.ADMIN)
        with pytest.raises(ValidationError):
            update_platform_staff(
                actor=None, operator=operator, is_active=False
            )
