"""Campagne adversariale S8 « Équipements » (ADR 0021).

Le plus petit module du plan, et le moins sensible : ni donnée patient, ni
donnée clinique, ni argent. La campagne est donc **courte et ciblée** — une
douzaine de sondes, pas soixante — et elle vise ce que le module a
réellement à protéger :

1. **L'arbitrage d'audience du sprint** — le constat à tout le staff, son
   AUTEUR au directeur seul. C'est une PII de personnel : elle est
   attaquée par tous les chemins détournés plausibles (le même humain
   directeur ailleurs, la contamination de classe entre les deux
   sérialiseurs, les paramètres de requête en oracle, les métadonnées
   OPTIONS, le changement de rôle, et les fenêtres latérales de l'annuaire).
2. Le **cloisonnement** sur les portes d'ÉCRITURE (les tests du sprint
   couvraient les lectures).
3. La **machine à états** : « ignoré » veut-il vraiment dire « ignoré » —
   et pas « appliqué ailleurs », ni « journalisé quand même ».
4. L'**append-only** du signalement, par ses chemins déguisés.
5. Le **gel** : la liste fail-closed de S5 est-elle restée intacte.
6. Le fait que **rien de S8 n'atteint** un patient, un tuteur ou un
   exploitant plateforme — vérifié en vivant, pas seulement sur l'URLconf.

Constat corrigé par cette passe (Faible) :
``TestTheTerminalStateHoldsOnEveryPath`` — la garde « un appareil réformé
ne se signale plus » lisait le statut de l'instance EN MÉMOIRE ; une
instance chargée avant la réforme glissait donc un signalement sur un
appareil sorti du parc. Relue en base dans ``EquipmentReport.save()``,
comme la terminalité l'est déjà dans ``Equipment.save()``.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS
from apps.centers.models import StaffMembership
from apps.common.models import AppendOnlyError
from apps.equipment import services
from apps.equipment.models import Equipment, EquipmentReport

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_equipment, make_platform_staff, make_staff, make_user

pytestmark = pytest.mark.django_db

Status = Equipment.Status
Category = Equipment.Category

#: Ce qu'un collègue NON directeur reçoit d'un signalement, et rien de plus.
PUBLIC_REPORT_FIELDS = {"id", "equipment", "description", "created_at"}

#: La fiche d'équipement — liste FERMÉE : un champ de plus devra être
#: re-décidé ici (un « acheté par », un « responsable », un prix).
EQUIPMENT_FIELDS = {
    "id", "name", "category", "serial_number", "location", "commissioned_on",
    "status", "notes", "report_count", "last_report_at", "created_at",
    "updated_at",
}


class Scene:
    """Un centre, ses casquettes, un appareil en service."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.nurse = make_staff_user(self.center, role=Role.NURSE)
        self.cashier = make_staff_user(self.center, role=Role.CASHIER)
        self.equipment = services.create_equipment(
            actor=self.director, center=self.center,
            name="Échographe portable", category=Category.IMAGING,
            location="Salle d'échographie",
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
# 1 — L'AUTEUR d'un signalement n'atteint JAMAIS un non-directeur
# ---------------------------------------------------------------------------


class TestTheAuthorOfAReportNeverReachesANonDirector:
    """« Nommer le signaleur devant toute l'équipe refroidit la prochaine
    panne. » C'est une PII de personnel : on l'attaque comme telle."""

    def test_a_director_of_ANOTHER_center_is_a_plain_colleague_here(self, scene):
        """Le même humain, deux casquettes : directeur du centre B,
        infirmier du centre A. La casquette se lit DANS le centre de l'URL —
        une garde qui oublierait le centre rendrait l'auteur à un simple
        collègue.
        """
        other, _other_director = make_center_with_director(name="Clinique Ylang")
        human = make_staff_user(scene.center, role=Role.NURSE)
        make_staff(user=human, center=other, role=Role.DIRECTOR)
        scene.report(actor=scene.nurse, description="Bruit anormal.")

        (row,) = client_for(human).get(scene.url("reports/")).data["results"]
        assert set(row) == PUBLIC_REPORT_FIELDS, row
        assert "reported_by" not in row and "reported_by_display" not in row

    def test_reading_as_the_director_FIRST_never_contaminates_the_public_form(
        self, scene
    ):
        """``EquipmentReportDirectorSerializer`` hérite du sérialiseur
        public : si sa ``Meta.fields`` mutait la liste du parent (``+=`` au
        lieu de ``+``), tout le staff hériterait de l'auteur dès qu'un
        directeur aurait lu une fois dans le processus. Ordre volontaire :
        directeur d'abord, collègue ensuite.
        """
        scene.report(actor=scene.nurse)
        director_row, = client_for(scene.director).get(
            scene.url("reports/")
        ).data["results"]
        assert "reported_by_display" in director_row

        colleague_row, = client_for(scene.cashier).get(
            scene.url("reports/")
        ).data["results"]
        assert set(colleague_row) == PUBLIC_REPORT_FIELDS, colleague_row

    def test_no_query_parameter_turns_the_list_into_an_author_oracle(self, scene):
        """Filtre, tri, pagination, sélection de champs : aucun paramètre ne
        doit trier ni filtrer sur ``reported_by``. Un ``OrderingFilter``
        posé un jour globalement suffirait à faire de ``?ordering=
        reported_by`` un oracle d'auteur (l'ordre des lignes révèle qui a
        écrit quoi) — cette sonde le refuse d'avance.
        """
        doctor = make_staff_user(scene.center, role=Role.DOCTOR)
        scene.report(actor=scene.nurse, description="Bruit anormal.")
        scene.report(actor=doctor, description="Écran noir.")

        colleague = client_for(scene.cashier)
        baseline = colleague.get(scene.url("reports/")).data["results"]
        assert len(baseline) == 2
        assert all(set(row) == PUBLIC_REPORT_FIELDS for row in baseline)

        for query in (
            f"?ordering=reported_by",
            f"?ordering=-reported_by",
            f"?ordering=reported_by__first_name",
            f"?reported_by={scene.nurse.pk}",
            f"?reported_by__isnull=false",
            f"?search={scene.nurse.username}",
            f"?fields=reported_by",
            f"?expand=reported_by",
            f"?omit=description",
        ):
            response = colleague.get(f"{scene.url('reports/')}{query}")
            assert response.status_code == 200, (query, response.data)
            assert response.data["results"] == baseline, query

    def test_options_metadata_never_names_the_author(self, scene):
        """Le classique : la description OPTIONS d'une vue DRF rend la forme
        du sérialiseur. Elle ne doit pas rendre celle du directeur."""
        scene.report(actor=scene.nurse)
        response = client_for(scene.cashier).options(scene.url("reports/"))
        assert response.status_code == 200
        assert "reported_by" not in str(response.data), response.data

    def test_a_downgraded_director_loses_the_author_on_the_NEXT_read(self, scene):
        """La casquette est relue à chaque requête : rétrograder un
        directeur referme l'auteur immédiatement, sans reconnexion."""
        second = make_staff_user(scene.center, role=Role.DIRECTOR)
        scene.report(actor=scene.nurse)
        client = client_for(second)
        assert "reported_by" in client.get(scene.url("reports/")).data["results"][0]

        membership = StaffMembership.objects.for_center(scene.center).get(
            user=second
        )
        membership.role = Role.SECRETARY
        membership.save(update_fields=["role"])

        (row,) = client.get(scene.url("reports/")).data["results"]
        assert set(row) == PUBLIC_REPORT_FIELDS, row

    def test_the_side_windows_on_the_staff_directory_stay_shut(self, scene):
        """La raison n° 3 de l'arbitrage, montrée de front.

        L'annuaire des praticiens est ouvert à TOUT le staff et rend des
        NOMS : rendre un identifiant de l'auteur dans un signalement
        suffirait donc à recoller un nom sur un constat, sans jamais passer
        par les deux écrans réservés au directeur (``/staff/`` et le
        journal, tous deux 403 ici). Le signalement ne porte donc AUCUN
        identifiant — ni celui de l'utilisateur, ni celui de son
        membership, qui est la clé de l'annuaire.
        """
        doctor = make_staff_user(scene.center, role=Role.DOCTOR)
        doctor.first_name, doctor.last_name = "Nadjat", "Abdallah"
        doctor.save(update_fields=["first_name", "last_name"])
        membership = StaffMembership.objects.for_center(scene.center).get(
            user=doctor
        )
        scene.report(actor=doctor, description="Sonde HS.")
        colleague = client_for(scene.cashier)
        center = scene.center.pk

        annuaire = colleague.get(f"/api/v1/centers/{center}/practitioners/")
        assert annuaire.status_code == 200
        assert "Nadjat Abdallah" in {row["display_name"] for row in annuaire.data}

        assert colleague.get(f"/api/v1/centers/{center}/staff/").status_code == 403
        assert (
            colleague.get(f"/api/v1/centers/{center}/audit-log/").status_code == 403
        )
        (row,) = colleague.get(scene.url("reports/")).data["results"]
        assert set(row) == PUBLIC_REPORT_FIELDS
        assert doctor.pk not in row.values()
        assert membership.pk not in row.values()
        assert "Nadjat" not in str(row)

    def test_the_equipment_fiche_is_a_CLOSED_field_list(self, scene):
        """Un seul sérialiseur de lecture pour l'appareil : la liste de
        champs est donc la même pour tout le staff, et elle est fermée — un
        « acheté par », un « responsable » ou un prix devra être re-décidé.
        """
        scene.report(actor=scene.nurse)
        for user in (scene.director, scene.nurse, scene.cashier):
            (row,) = client_for(user).get(scene.base).data
            assert set(row) == EQUIPMENT_FIELDS, (user, set(row))
            assert row["report_count"] == 1


# ---------------------------------------------------------------------------
# 2 — Cloisonnement : les portes d'ÉCRITURE aussi
# ---------------------------------------------------------------------------


class TestTenantIsolationOnTheWriteDoors:
    def test_writing_on_a_foreign_equipment_through_MY_url_is_404(self, scene):
        """Le sprint testait les lectures croisées ; les écritures sont
        testées ici. La référence voyage dans l'URL → 404 déterministe.
        """
        other, _ = make_center_with_director(name="Clinique Ylang")
        foreign = make_equipment(center=other, name="Microscope")

        assert client_for(scene.nurse).post(
            f"{scene.base}{foreign.pk}/reports/",
            {"description": "Bruit anormal."}, format="json",
        ).status_code == 404
        assert client_for(scene.director).patch(
            f"{scene.base}{foreign.pk}/", {"location": "Bloc"}, format="json"
        ).status_code == 404
        assert not EquipmentReport.objects.filter(equipment=foreign).exists()
        foreign.refresh_from_db()
        assert foreign.location == ""

    def test_the_same_human_in_two_centers_cannot_cross_the_url(self, scene):
        """Employé des DEUX centres : il lit légitimement le parc de B sous
        l'URL de B, jamais sous celle de A. Le cloisonnement est celui de
        l'URL, pas celui de la personne.
        """
        other, _ = make_center_with_director(name="Clinique Ylang")
        human = make_staff_user(scene.center, role=Role.NURSE)
        make_staff(user=human, center=other, role=Role.NURSE)
        foreign = make_equipment(center=other, name="Microscope")
        client = client_for(human)

        assert client.get(f"{scene.base}{foreign.pk}/reports/").status_code == 404
        assert client.get(
            f"/api/v1/centers/{other.pk}/equipment/{foreign.pk}/reports/"
        ).status_code == 200
        assert [row["name"] for row in client.get(scene.base).data] == [
            "Échographe portable"
        ]

    def test_nothing_of_s8_reaches_a_guardian_a_patient_or_an_operator(self, scene):
        """La sonde de routes est structurelle ; celle-ci est vivante : un
        tuteur et un exploitant Chioni — qui n'ont aucun membership — ne
        voient pas même l'existence du centre.
        """
        guardian, _profile = make_guardian_user()
        operator, _row = make_platform_staff()
        for user in (guardian, operator):
            assert client_for(user).get(scene.base).status_code == 404, user
            assert client_for(user).get(scene.url()).status_code == 404, user
            assert client_for(user).get(
                scene.url("reports/")
            ).status_code == 404, user


# ---------------------------------------------------------------------------
# 3 — La machine à états : « ignoré » veut bien dire ignoré
# ---------------------------------------------------------------------------


class TestTheStateMachineHasExactlyOneDoor:
    def test_a_generic_patch_carrying_status_writes_NOTHING_anywhere(self, scene):
        """« Ignoré en silence » doit vouloir dire : ni en base, ni dans la
        réponse, ni dans le journal. Un ``status`` accepté puis
        journalisé serait le pire des deux mondes.
        """
        response = client_for(scene.director).patch(
            scene.url(),
            {"status": Status.DECOMMISSIONED, "notes": "Sous garantie."},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == Status.IN_SERVICE
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE

        assert not AuditLog.objects.filter(
            action=AuditAction.EQUIPMENT_STATUS_CHANGED
        ).exists()
        entry = AuditLog.objects.get(action=AuditAction.EQUIPMENT_UPDATED)
        assert entry.payload["fields"] == "notes"
        assert "status" not in entry.payload

    def test_a_patch_carrying_ONLY_status_is_a_no_op_without_a_journal_line(
        self, scene
    ):
        response = client_for(scene.director).patch(
            scene.url(), {"status": Status.OUT_OF_ORDER}, format="json"
        )
        assert response.status_code == 200
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE
        assert not AuditLog.objects.filter(
            action__in=(
                AuditAction.EQUIPMENT_UPDATED,
                AuditAction.EQUIPMENT_STATUS_CHANGED,
            )
        ).exists()

    def test_the_SERVICE_door_refuses_status_as_a_keyword_too(self, scene):
        """La vue filtre par sérialiseur ; le service refuse de son côté —
        un appelant interne ne contourne pas la machine non plus."""
        with pytest.raises(ValidationError, match="non modifiable"):
            services.update_equipment(
                actor=scene.director, equipment=scene.equipment,
                status=Status.DECOMMISSIONED,
            )
        scene.equipment.refresh_from_db()
        assert scene.equipment.status == Status.IN_SERVICE

    def test_a_reformed_device_is_closed_on_EVERY_public_door(self, scene):
        """La réforme est terminale : aucune cible ne la rouvre, et le
        signalement HTTP répond 400 (pas 500)."""
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.DECOMMISSIONED,
        )
        director = client_for(scene.director)
        for target in Status.values:
            refused = director.post(
                scene.url("status/"), {"status": target}, format="json"
            )
            assert refused.status_code == 400, (target, refused.data)

        reported = client_for(scene.nurse).post(
            scene.url("reports/"), {"description": "Bruit anormal."}, format="json"
        )
        assert reported.status_code == 400, reported.data
        assert not EquipmentReport.objects.exists()


# ---------------------------------------------------------------------------
# 4 — L'append-only, par ses chemins déguisés
# ---------------------------------------------------------------------------


class TestTheReportIsAppendOnlyOnItsDisguisedPaths:
    def test_bulk_paths_that_hide_an_update_are_refused(self, scene):
        """``bulk_create(update_conflicts=True)`` compile en
        ``INSERT … ON CONFLICT DO UPDATE`` : un UPDATE déguisé. Avec
        ``bulk_update`` et le ``delete()`` de queryset, ce sont les trois
        portes que le socle append-only doit fermer sur CETTE table.
        """
        report = scene.report()
        report.description = "En fait tout va bien."
        with pytest.raises(AppendOnlyError):
            EquipmentReport.objects.bulk_create(
                [report], update_conflicts=True,
                update_fields=["description"], unique_fields=["id"],
            )
        with pytest.raises(AppendOnlyError):
            EquipmentReport.objects.bulk_update([report], ["description"])
        with pytest.raises(AppendOnlyError):
            EquipmentReport.objects.filter(pk=report.pk).delete()
        with pytest.raises(AppendOnlyError):
            EquipmentReport.objects.all().delete()

        report.refresh_from_db()
        assert report.description == "La sonde ne s'allume plus."

    def test_no_http_verb_edits_or_deletes_a_report(self, scene):
        """Il n'existe aucune route de détail d'un signalement — et la
        collection ne connaît que GET et POST."""
        scene.report()
        client = client_for(scene.director)
        for verb in (client.put, client.patch):
            assert verb(
                scene.url("reports/"), {"description": "x"}, format="json"
            ).status_code == 405
        assert client.delete(scene.url("reports/")).status_code == 405


# ---------------------------------------------------------------------------
# 5 — Le CONSTAT corrigé : la terminalité tient sur TOUT chemin d'écriture
# ---------------------------------------------------------------------------


class TestTheTerminalStateHoldsOnEveryPath:
    def test_a_stale_instance_cannot_slip_a_report_onto_a_reformed_device(
        self, scene
    ):
        """**Constat de la passe (Faible)** — la garde « un appareil réformé
        ne se signale plus » lisait le statut de l'instance EN MÉMOIRE. Une
        instance chargée avant la décision du directeur (c'est exactement ce
        que fait la vue : SELECT puis INSERT) glissait donc un signalement
        sur un appareil sorti du parc — même forme de TOCTOU que celles
        écartées en S1/S4, sans argent ni donnée médicale au bout.

        La terminalité est relue en base, comme elle l'est déjà dans
        ``Equipment.save()``.
        """
        stale = Equipment.objects.get(pk=scene.equipment.pk)
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.DECOMMISSIONED,
        )
        with pytest.raises(ValidationError, match="réformé"):
            services.report_equipment_issue(
                actor=scene.nurse, equipment=stale, description="Bruit anormal."
            )
        assert not EquipmentReport.objects.filter(equipment=stale).exists()


# ---------------------------------------------------------------------------
# 6 — Le gel et le journal : deux listes fermées, inchangées
# ---------------------------------------------------------------------------


class TestTheClosedListsDidNotMove:
    def test_the_s5_fail_closed_importer_list_is_UNCHANGED_by_s8(self):
        """Décision 4 : chaque extension de la liste des modules autorisés à
        importer la garde de gel affaiblit la sonde qui la protège. S8 ne
        l'étend pas — et cette sonde échouera si un sprint futur y glisse
        ``equipment``.
        """
        from .test_adversarial_s5 import (
            TestTheFreezeIsStructurallyBoundedToAdministration as Probe,
        )

        assert Probe.ALLOWED_IMPORTERS == {
            "centers/services.py", "centers/stats_views.py", "hrm/services.py",
        }

    def test_the_director_journal_gained_exactly_four_equipment_actions(self):
        assert {
            action for action in DIRECTOR_JOURNAL_ACTIONS
            if action.startswith("equipment.")
        } == {
            AuditAction.EQUIPMENT_CREATED,
            AuditAction.EQUIPMENT_UPDATED,
            AuditAction.EQUIPMENT_STATUS_CHANGED,
            AuditAction.EQUIPMENT_REPORTED,
        }

    def test_a_full_scenario_writes_those_four_actions_AND_NOTHING_ELSE(
        self, scene
    ):
        """Fail-closed : une cinquième action d'équipement apparue demain
        (« equipment.deleted », « equipment.assigned ») fera échouer cette
        sonde tant qu'elle n'aura pas été décidée pour le journal.
        """
        services.update_equipment(
            actor=scene.director, equipment=scene.equipment, location="Bloc"
        )
        services.set_equipment_status(
            actor=scene.director, equipment=scene.equipment,
            status=Status.OUT_OF_ORDER,
        )
        scene.report(actor=scene.nurse, description="Bruit anormal.")

        written = {
            action for action in AuditLog.objects.values_list("action", flat=True)
            if action.startswith("equipment.")
        }
        assert written == {
            AuditAction.EQUIPMENT_CREATED,
            AuditAction.EQUIPMENT_UPDATED,
            AuditAction.EQUIPMENT_STATUS_CHANGED,
            AuditAction.EQUIPMENT_REPORTED,
        }
        assert written <= DIRECTOR_JOURNAL_ACTIONS

    def test_the_free_text_of_a_report_never_reaches_the_directors_journal(
        self, scene
    ):
        """Le journal est rendu par l'API, pas seulement stocké : la sonde
        du sprint lit les payloads en base, celle-ci lit la RÉPONSE.
        """
        secret = "Le patient de la chambre 3 a fait tomber la sonde."
        scene.report(actor=scene.nurse, description=secret)
        journal = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/audit-log/"
        )
        assert journal.status_code == 200
        assert secret not in str(journal.data)
        assert "Échographe portable" not in str(journal.data)


# ---------------------------------------------------------------------------
# 7 — Utilisateurs anonymes / non authentifiés (norme S1)
# ---------------------------------------------------------------------------


class TestTheRefusalNormHolds:
    def test_an_anonymous_caller_never_learns_that_a_center_exists(self, scene):
        client = client_for()
        for url in (scene.base, scene.url(), scene.url("reports/")):
            assert client.get(url).status_code == 401, url
        assert client.post(
            scene.url("reports/"), {"description": "x"}, format="json"
        ).status_code == 401

    def test_an_authenticated_stranger_gets_404_not_403(self, scene):
        """Un compte sans aucune casquette : le centre n'existe pas pour
        lui. 403 confirmerait son existence."""
        stranger = make_user()
        client = client_for(stranger)
        assert client.get(scene.base).status_code == 404
        assert client.post(
            scene.url("reports/"), {"description": "x"}, format="json"
        ).status_code == 404
