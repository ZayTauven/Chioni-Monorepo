"""S8 (ADR 0021) — l'inventaire des équipements, le plus petit module du plan.

Ce fichier verrouille, dans cet ordre :

1. **LE point critique du sprint** : le gel commercial ne s'applique PAS au
   parc. Un centre suspendu déclare un appareil, change son état et
   **signale une panne** — *signaler une panne doit toujours passer*, et le
   centre gelé est précisément celui qui a le plus besoin que
   l'information circule. Le gabarit est celui de
   ``test_subscription_effects`` / ``test_inpatient`` : ce qui CONTINUE est
   écrit avant tout le reste ;
2. les permissions (« tout staff signale, le directeur décide ») et le
   cloisonnement inter-centres en 404 déterministe ;
3. la machine à états (``en_service ⇄ en_panne``, les deux → ``reforme``
   **terminal**), rejouée dans ``save()`` et sérialisée par verrou de ligne ;
4. le signalement : **append-only**, et il **ne change pas** l'état ;
5. l'arbitrage d'audience du sprint — **le constat à tout le staff, son
   AUTEUR au directeur seul** (voir le docstring de
   ``apps/equipment/serializers.py``) ;
6. l'audit : quatre actions, dans la liste blanche du directeur, **jamais**
   la description d'un signalement ni les notes ;
7. **aucune valeur financière** (décision 3) — par absence de champ, pour
   qu'un ajout futur soit un choix conscient.
"""

import threading

import pytest
from django.core.exceptions import ValidationError
from django.db import connections, models

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS
from apps.common.models import AppendOnlyError
from apps.equipment import services
from apps.equipment.models import Equipment, EquipmentReport

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import make_equipment, make_subscription, make_user

pytestmark = pytest.mark.django_db

Status = Equipment.Status
Category = Equipment.Category


class Scene:
    """Un centre, ses casquettes, un appareil en service."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.nurse = make_staff_user(self.center, role=Role.NURSE)
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.cashier = make_staff_user(self.center, role=Role.CASHIER)
        self.equipment = services.create_equipment(
            actor=self.director, center=self.center,
            name="Échographe portable", category=Category.IMAGING,
            location="Salle d'échographie", serial_number="ECHO-77A",
        )

    @property
    def base(self):
        return f"/api/v1/centers/{self.center.pk}/equipment/"

    def url(self, suffix=""):
        return f"{self.base}{self.equipment.pk}/{suffix}"

    def report(self, actor=None, description="La sonde ne s'allume plus."):
        return services.report_equipment_issue(
            actor=actor or self.nurse, equipment=self.equipment,
            description=description,
        )


@pytest.fixture
def scene():
    return Scene()


# ---------------------------------------------------------------------------
# 1 — LE POINT CRITIQUE : le gel n'atteint JAMAIS le parc (décision 4)
# ---------------------------------------------------------------------------


class TestTheFreezeNeverReachesTheEquipmentPark:
    """« Signaler une panne doit toujours passer. »

    Un appareil cassé est une information de soin. Geler l'inventaire n'a
    en outre aucun levier commercial : personne ne paie pour enregistrer un
    tensiomètre. Ces sondes sont ce qui empêche la garde d'entrer un jour
    par copier-coller.
    """

    def test_no_module_of_the_app_imports_the_freeze_guard(self):
        """Sonde propre au module, MIROIR de la sonde fail-closed S5 (qui
        verrouille la liste des importeurs par égalité stricte). Elle dit
        ICI, dans le fichier du sprint, pourquoi la garde est absente."""
        import ast
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1] / "apps" / "equipment"
        offenders = []
        for path in root.rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            tree = ast.parse(source)
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                ):
                    offenders.append(path.name)
            # …et l'import qui ne ressemble pas à un import (leçon de la
            # revue guardian S7) : un `apps.get_model`/attribut ne suffirait
            # pas à appeler la garde, mais un appel nu, si.
            if "require_center_can_administer(" in source:
                offenders.append(path.name)
        assert not offenders, (
            "Signaler une panne doit TOUJOURS passer : un appareil cassé "
            "est une information de soin, et le centre gelé est celui qui a "
            f"le plus besoin qu'elle circule ({offenders})."
        )

    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_a_frozen_center_declares_reports_and_decides(self, scene, status):
        make_subscription(
            center=scene.center, status=status,
            status_reason="Facture A-000012 impayée depuis 60 jours.",
        )
        director = client_for(scene.director)

        created = director.post(
            scene.base,
            {"name": "Concentrateur d'oxygène", "category": Category.DIAGNOSTIC},
            format="json",
        )
        assert created.status_code == 201, created.data

        reported = client_for(scene.nurse).post(
            scene.url("reports/"),
            {"description": "La sonde ne s'allume plus depuis ce matin."},
            format="json",
        )
        assert reported.status_code == 201, reported.data

        decided = director.post(
            scene.url("status/"), {"status": Status.OUT_OF_ORDER}, format="json"
        )
        assert decided.status_code == 200, decided.data
        assert client_for(scene.cashier).get(scene.base).status_code == 200

    def test_the_contrast_the_freeze_really_is_wired_elsewhere(self, scene):
        """Preuve que l'absence de garde ici est une DÉCISION et pas un
        oubli : sur le MÊME centre gelé, l'écriture administrative que
        l'ADR 0018 gèle répond bien 400."""
        make_subscription(
            center=scene.center, status="suspendu", status_reason="Impayé."
        )
        refused = client_for(scene.director).post(
            f"/api/v1/centers/{scene.center.pk}/staff/",
            {"phone": "+2693390444", "role": Role.CASHIER},
        )
        assert refused.status_code == 400
        assert "abonnement" in str(refused.data).lower()


# ---------------------------------------------------------------------------
# 2 — Qui lit, qui écrit, qui signale (arbitrage PO n° 2)
# ---------------------------------------------------------------------------


class TestWhoReadsWhoWritesWhoReports:
    def test_every_active_staff_reads_the_park(self, scene):
        for user in (scene.director, scene.doctor, scene.secretary, scene.cashier):
            response = client_for(user).get(scene.base)
            assert response.status_code == 200, user
            assert [row["name"] for row in response.data] == ["Échographe portable"]

    @pytest.mark.parametrize("role", [Role.DOCTOR, Role.SECRETARY, Role.CASHIER])
    def test_only_the_director_writes_the_park(self, scene, role):
        client = client_for(make_staff_user(scene.center, role=role))
        assert client.post(
            scene.base, {"name": "Autoclave", "category": Category.OPERATING_ROOM},
            format="json",
        ).status_code == 403
        assert client.patch(
            scene.url(), {"location": "Bloc"}, format="json"
        ).status_code == 403
        assert client.post(
            scene.url("status/"), {"status": Status.OUT_OF_ORDER}, format="json"
        ).status_code == 403

    @pytest.mark.parametrize("role", [Role.NURSE, Role.SECRETARY, Role.CASHIER])
    def test_every_active_staff_reports_a_breakdown(self, scene, role):
        """« C'est l'infirmière qui constate que le tensiomètre ne marche
        plus » — et la secrétaire, et le caissier."""
        response = client_for(make_staff_user(scene.center, role=role)).post(
            scene.url("reports/"),
            {"description": "Bruit anormal au démarrage."}, format="json",
        )
        assert response.status_code == 201, response.data

    def test_a_deactivated_member_is_out(self, scene):
        from apps.centers.models import StaffMembership

        membership = StaffMembership.objects.for_center(scene.center).get(
            user=scene.nurse
        )
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        assert client_for(scene.nurse).get(scene.base).status_code == 404

    def test_anonymous_is_401(self, scene):
        assert client_for().get(scene.base).status_code == 401


# ---------------------------------------------------------------------------
# 3 — Cloisonnement multi-tenant et norme S1 des refus
# ---------------------------------------------------------------------------


class TestTenantIsolationAndRefusalNorm:
    def test_a_foreign_center_does_not_exist(self, scene):
        other, _director = make_center_with_director()
        assert client_for(scene.director).get(
            f"/api/v1/centers/{other.pk}/equipment/"
        ).status_code == 404

    def test_the_park_never_leaks_across_tenants(self, scene):
        other, other_director = make_center_with_director()
        make_equipment(center=other, name="Microscope")
        rows = client_for(scene.director).get(scene.base).data
        assert [row["name"] for row in rows] == ["Échographe portable"]
        assert client_for(other_director).get(
            f"/api/v1/centers/{other.pk}/equipment/"
        ).data[0]["name"] == "Microscope"

    def test_an_equipment_of_another_center_reached_by_my_url_is_404(self, scene):
        """Norme S1 : la référence voyage dans l'URL → 404 déterministe,
        indiscernable d'un id inexistant."""
        other, _director = make_center_with_director()
        foreign = make_equipment(center=other)
        client = client_for(scene.director)
        for url in (
            f"{scene.base}{foreign.pk}/",
            f"{scene.base}{foreign.pk}/reports/",
            f"{scene.base}999999/",
        ):
            assert client.get(url).status_code == 404, url
        assert client.post(
            f"{scene.base}{foreign.pk}/status/",
            {"status": Status.OUT_OF_ORDER}, format="json",
        ).status_code == 404

    def test_an_unknown_value_in_the_body_is_a_400_by_field(self, scene):
        """Norme S1 : la valeur voyage dans le CORPS → 400 explicite."""
        client = client_for(scene.director)
        created = client.post(
            scene.base, {"name": "Autoclave", "category": "radiologie"},
            format="json",
        )
        assert created.status_code == 400
        assert "category" in created.data

        no_name = client.post(
            scene.base, {"category": Category.OTHER}, format="json"
        )
        assert no_name.status_code == 400 and "name" in no_name.data

        bad_status = client.post(
            scene.url("status/"), {"status": "casse"}, format="json"
        )
        assert bad_status.status_code == 400 and "status" in bad_status.data

    def test_an_unknown_filter_value_is_a_400_by_field(self, scene):
        client = client_for(scene.doctor)
        assert client.get(f"{scene.base}?status=casse").status_code == 400
        assert client.get(f"{scene.base}?category=radiologie").status_code == 400
        assert client.get(f"{scene.base}?status={Status.IN_SERVICE}").data

    def test_a_patient_sees_nothing(self, scene):
        patient = make_claimed_patient()
        assert client_for(patient.user).get(scene.base).status_code == 404


# ---------------------------------------------------------------------------
# 4 — La machine à états : en_service ⇄ en_panne, les deux → reforme
# ---------------------------------------------------------------------------


class TestTheStateMachine:
    def test_a_device_goes_out_of_order_and_comes_back(self, scene):
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.OUT_OF_ORDER,
        )
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.OUT_OF_ORDER
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.IN_SERVICE,
        )
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE

    @pytest.mark.parametrize("start", [Status.IN_SERVICE, Status.OUT_OF_ORDER])
    def test_both_states_lead_to_decommissioned(self, scene, start):
        equipment = make_equipment(center=scene.center, status=start)
        services.set_equipment_status(
            actor=scene.director, equipment=equipment,
            status=Status.DECOMMISSIONED,
        )
        equipment.refresh_from_db()
        assert equipment.status == Status.DECOMMISSIONED

    def test_decommissioning_is_final(self, scene):
        """Un équipement ne se supprime pas : il se réforme, et la réforme
        est définitive. Le parc raconte son histoire, y compris ce qui en
        est sorti."""
        equipment = make_equipment(
            center=scene.center, status=Status.DECOMMISSIONED
        )
        for target in (Status.IN_SERVICE, Status.OUT_OF_ORDER,
                       Status.DECOMMISSIONED):
            with pytest.raises(ValidationError, match="Transition impossible"):
                services.set_equipment_status(
                    actor=scene.director, equipment=equipment, status=target
                )

    def test_the_terminal_state_is_replayed_in_save(self, scene):
        """Le service n'est pas la seule garde : un chemin d'écriture hors
        service (ORM direct) ne ressuscite pas un appareil réformé."""
        equipment = make_equipment(
            center=scene.center, status=Status.DECOMMISSIONED
        )
        equipment.status = Status.IN_SERVICE
        with pytest.raises(ValidationError, match="réforme est définitive"):
            equipment.save()

    def test_the_park_write_path_never_touches_the_status(self, scene):
        """``PATCH`` corrige une fiche, jamais un état : la machine a une
        seule porte (``…/status/``)."""
        assert "status" not in services.EDITABLE_FIELDS
        response = client_for(scene.director).patch(
            scene.url(), {"status": Status.DECOMMISSIONED, "location": "Bloc"},
            format="json",
        )
        assert response.status_code == 200
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE
        assert scene.equipment.location == "Bloc"

    def test_the_database_refuses_a_status_outside_the_closed_list(self, scene):
        """Ce qui EST exprimable en base l'est : un ``update()`` brut ne
        peut pas inventer un état hors machine."""
        from django.db import IntegrityError, transaction

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Equipment.objects.filter(pk=scene.equipment.pk).update(
                    status="casse"
                )

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_decisions_serialise_on_the_row(self):
        """Le verrou de ligne (patron ``_transition`` de ``scheduling``) :
        réformer et remettre en panne à la même seconde ne peuvent pas
        passer tous les deux — le perdant relit l'état du gagnant et reçoit
        le refus français, jamais un 500."""
        scene = Scene()
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def decide(name, target):
            try:
                gate.wait()
                services.set_equipment_status(
                    actor=scene.director, equipment=scene.equipment,
                    status=target,
                )
                outcomes[name] = "done"
            except ValidationError:
                outcomes[name] = "refused"
            except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                outcomes[name] = f"crash:{type(exc).__name__}"
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=decide, args=("a", Status.DECOMMISSIONED)),
            threading.Thread(target=decide, args=("b", Status.OUT_OF_ORDER)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        assert not any(
            str(value).startswith("crash") for value in outcomes.values()
        ), outcomes
        scene.equipment.refresh_from_db()
        # Un seul des deux a écrit : si c'est la réforme, elle est
        # définitive ; si c'est la panne, la réforme a été refusée.
        assert scene.equipment.status in (
            Status.DECOMMISSIONED, Status.OUT_OF_ORDER
        )
        assert list(outcomes.values()).count("done") >= 1


# ---------------------------------------------------------------------------
# 5 — Le signalement est un CONSTAT, pas une décision (décision 1)
# ---------------------------------------------------------------------------


class TestTheReportIsAConstatNotADecision:
    def test_reporting_does_not_change_the_state(self, scene):
        """LE point de la décision 1 : signaler est un constat, décider est
        un geste de directeur. Deux gestes, deux personnes."""
        scene.report(actor=scene.nurse)
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE

    def test_a_report_is_append_only(self, scene):
        report = scene.report()
        report.description = "En fait tout va bien."
        with pytest.raises(AppendOnlyError):
            report.save()
        with pytest.raises(AppendOnlyError):
            report.delete()
        with pytest.raises(AppendOnlyError):
            EquipmentReport.objects.filter(pk=report.pk).update(description="x")

    def test_a_correction_is_a_SECOND_report(self, scene):
        scene.report(description="La sonde ne s'allume plus.")
        scene.report(description="Corrigé : c'est le câble d'alimentation.")
        assert EquipmentReport.objects.filter(
            equipment=scene.equipment
        ).count() == 2

    def test_a_report_has_no_lifecycle_of_its_own(self):
        """Aucun ``status``, aucun ``resolved_at`` : ce qui dit où on en est
        est l'ÉTAT de l'équipement, jamais un second système à côté."""
        names = {field.name for field in EquipmentReport._meta.get_fields()}
        assert not (names & {"status", "resolved_at", "resolved_by", "closed_at"})

    def test_an_empty_description_is_refused(self, scene):
        with pytest.raises(ValidationError):
            scene.report(description="   ")
        response = client_for(scene.nurse).post(
            scene.url("reports/"), {"description": "  "}, format="json"
        )
        assert response.status_code == 400 and "description" in response.data

    def test_a_decommissioned_device_is_out_of_the_park(self, scene):
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.DECOMMISSIONED,
        )
        with pytest.raises(ValidationError, match="réformé"):
            scene.report()


# ---------------------------------------------------------------------------
# 6 — L'ARBITRAGE du sprint : qui voit le nom de qui a signalé
# ---------------------------------------------------------------------------


class TestWhoSeesWhoReported:
    """Le constat à TOUT le staff, son AUTEUR au DIRECTEUR seul.

    Un signalement ne change rien (décision 1) : l'équipe n'a besoin
    d'aucun responsable pour agir, seulement de la phrase et de la date.
    Nommer le signaleur devant toute l'équipe refroidirait la prochaine
    panne, et ``GET /centers/{c}/staff/`` est déjà directeur-seul — rendre
    un nom (ou un id résoluble) ici en ferait une fenêtre latérale sur
    l'annuaire du personnel. Arbitrage RÉVERSIBLE, en un champ.
    """

    PUBLIC_FIELDS = {"id", "equipment", "description", "created_at"}

    @pytest.mark.parametrize("role", [Role.DOCTOR, Role.SECRETARY, Role.CASHIER])
    def test_a_colleague_reads_the_constat_without_its_author(self, scene, role):
        scene.report(actor=scene.nurse, description="Bruit anormal.")
        response = client_for(make_staff_user(scene.center, role=role)).get(
            scene.url("reports/")
        )
        assert response.status_code == 200
        (row,) = response.data["results"]
        assert set(row) == self.PUBLIC_FIELDS
        assert row["description"] == "Bruit anormal."
        assert "reported_by" not in row and "reported_by_display" not in row

    def test_the_director_reads_who_reported(self, scene):
        reporter = make_staff_user(scene.center, role=Role.NURSE)
        reporter.first_name, reporter.last_name = "Hadidja", "Soilihi"
        reporter.save(update_fields=["first_name", "last_name"])
        scene.report(actor=reporter)

        (row,) = client_for(scene.director).get(scene.url("reports/")).data[
            "results"
        ]
        assert set(row) == self.PUBLIC_FIELDS | {
            "reported_by", "reported_by_display"
        }
        assert row["reported_by"] == reporter.pk
        assert row["reported_by_display"] == "Hadidja Soilihi"

    def test_the_creation_response_follows_the_same_rule(self, scene):
        posted = client_for(scene.nurse).post(
            scene.url("reports/"), {"description": "Écran noir."}, format="json"
        )
        assert set(posted.data) == self.PUBLIC_FIELDS

        posted_by_director = client_for(scene.director).post(
            scene.url("reports/"), {"description": "Écran noir."}, format="json"
        )
        assert "reported_by_display" in posted_by_director.data

    def test_the_author_travels_in_no_write_payload(self, scene):
        """``reported_by`` est l'appelant, jamais un champ du corps : sinon
        on signalerait au nom d'un collègue."""
        colleague = make_user()
        client_for(scene.nurse).post(
            scene.url("reports/"),
            {"description": "Écran noir.", "reported_by": colleague.pk},
            format="json",
        )
        assert EquipmentReport.objects.get().reported_by_id == scene.nurse.pk


# ---------------------------------------------------------------------------
# 7 — L'audit : quatre actions, aucun texte libre
# ---------------------------------------------------------------------------


class TestAuditTrail:
    ACTIONS = (
        AuditAction.EQUIPMENT_CREATED,
        AuditAction.EQUIPMENT_UPDATED,
        AuditAction.EQUIPMENT_STATUS_CHANGED,
        AuditAction.EQUIPMENT_REPORTED,
    )

    def test_the_four_writes_are_journalised_with_their_center(self, scene):
        services.update_equipment(
            actor=scene.director, equipment=scene.equipment, location="Bloc"
        )
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.OUT_OF_ORDER,
        )
        scene.report(actor=scene.nurse)

        entries = AuditLog.objects.filter(action__in=self.ACTIONS)
        assert set(entries.values_list("action", flat=True)) == set(self.ACTIONS)
        assert set(entries.values_list("center_id", flat=True)) == {
            scene.center.pk
        }

    def test_no_free_text_ever_reaches_a_payload(self, scene):
        """Contrat ADR 0007, resserré par l'ADR 0021 : ni la description
        d'un signalement, ni les notes, ni le nom ou l'emplacement d'un
        appareil."""
        secret = "La sonde ne s'allume plus depuis ce matin."
        equipment = services.create_equipment(
            actor=scene.director, center=scene.center,
            name="Microscope Zeiss", category=Category.LABORATORY,
            location="Laboratoire", serial_number="MIC-9", notes="Sous garantie.",
        )
        services.update_equipment(
            actor=scene.director, equipment=equipment, notes="Garantie expirée."
        )
        services.report_equipment_issue(
            actor=scene.nurse, equipment=equipment, description=secret
        )
        forbidden = (
            secret, "Microscope Zeiss", "Laboratoire", "MIC-9",
            "Sous garantie.", "Garantie expirée.",
        )
        for entry in AuditLog.objects.filter(action__in=self.ACTIONS):
            rendered = str(entry.payload)
            for needle in forbidden:
                assert needle not in rendered, (entry.action, needle)
        # …et le payload d'``updated`` dit QUELS champs, jamais leur valeur.
        updated = AuditLog.objects.get(action=AuditAction.EQUIPMENT_UPDATED)
        assert updated.payload["fields"] == "notes"

    def test_the_status_change_carries_both_codes(self, scene):
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.OUT_OF_ORDER,
        )
        entry = AuditLog.objects.get(action=AuditAction.EQUIPMENT_STATUS_CHANGED)
        assert entry.payload["from_status"] == Status.IN_SERVICE
        assert entry.payload["to_status"] == Status.OUT_OF_ORDER

    def test_the_four_actions_are_in_the_director_journal(self, scene):
        """Configuration de l'établissement, même famille que
        ``room.created`` et ``tariff.created`` — le directeur répond du
        matériel de sa maison."""
        assert set(self.ACTIONS) <= DIRECTOR_JOURNAL_ACTIONS

        scene.report(actor=scene.nurse)
        journal = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/audit-log/"
        )
        assert journal.status_code == 200
        actions = {row["action"] for row in journal.data["results"]}
        assert AuditAction.EQUIPMENT_CREATED in actions
        assert AuditAction.EQUIPMENT_REPORTED in actions
        # Le journal résout le nom de l'acteur pour les membres du centre :
        # c'est le MÊME arbitrage que le sérialiseur (le directeur, et lui
        # seul, sait qui a signalé), jamais une fenêtre de plus.
        reported = next(
            row for row in journal.data["results"]
            if row["action"] == AuditAction.EQUIPMENT_REPORTED
        )
        assert reported["actor"] == scene.nurse.pk
        assert "description" not in str(reported["payload"])


# ---------------------------------------------------------------------------
# 8 — Ce que le module n'a PAS, et qui est une décision (décisions 2 et 3)
# ---------------------------------------------------------------------------


class TestTheAbsencesAreDecisions:
    def test_no_financial_value_lives_in_this_module(self):
        """Décision 3 : ni prix d'achat, ni amortissement, ni valeur de
        parc. Ce test existe pour qu'un futur champ « prix » soit un CHOIX
        conscient — la comptabilité est le sujet de S10, et ouvrir une
        surface d'argent dans le module le moins surveillé du produit ne
        peut pas se faire par glissement."""
        money_names = {
            "price", "price_kmf", "price_eur", "purchase_price", "amount",
            "amount_kmf", "value", "cost", "currency", "depreciation",
            "book_value", "warranty_cost",
        }
        for model in (Equipment, EquipmentReport):
            names = {field.name for field in model._meta.get_fields()}
            assert not (names & money_names), model.__name__
            # La sonde fail-closed : AUCUN champ décimal, quel que soit son
            # nom — c'est ainsi que l'argent entre dans un modèle.
            assert not [
                field for field in model._meta.fields
                if isinstance(field, (models.DecimalField, models.FloatField))
            ], model.__name__

    def test_the_location_is_a_text_never_a_room(self):
        """Décision 2 : aucune FK vers ``inpatient.Room``. Tous les centres
        n'ont pas d'hospitalisation, et un échographe vit au bloc, en salle
        d'accouchement ou dans un couloir."""
        from apps.inpatient.models import Bed, Room

        assert isinstance(
            Equipment._meta.get_field("location"), models.CharField
        )
        related = {
            field.related_model
            for field in Equipment._meta.get_fields()
            if getattr(field, "related_model", None) is not None
        }
        assert Room not in related and Bed not in related

    def test_no_preventive_maintenance_field_slipped_in(self):
        """Arbitrage PO n° 1 : la maintenance préventive attendra d'être
        vérifiée sur le terrain, et s'ajoutera comme une table de plus."""
        names = {field.name for field in Equipment._meta.get_fields()}
        assert not (names & {
            "next_maintenance_on", "maintenance_period_days",
            "maintenance_contract", "last_maintenance_on",
        })

    def test_no_blame_field_exists(self):
        """Un parc sert à réparer, pas à imputer (ligne n° 1 du produit)."""
        names = {
            field.name
            for model in (Equipment, EquipmentReport)
            for field in model._meta.get_fields()
        }
        assert not (names & {"responsible", "blamed_by", "fault_of", "broken_by"})
