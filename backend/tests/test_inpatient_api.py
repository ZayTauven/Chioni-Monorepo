"""Hospitalisation — couche API (S6, ADR 0019 §5).

Ce que ce fichier verrouille :

1. **La segmentation par audience** : le staff administratif voit
   l'occupation et les séjours SANS le clinique (ni motif, ni diagnostic,
   ni motif d'annulation) — patron ``EncounterAdminSerializer`` ;
2. **Le cloisonnement multi-tenant** : un séjour, une chambre, un lit d'un
   autre centre sont INVISIBLES (404 déterministe au queryset) ;
3. **La norme S1 des refus** : URL → 404, corps → 400 explicite ;
4. **La fenêtre patient** : transversale, sans le lit ni la priorité ;
5. **Le verrou tuteur** : un tuteur, même porteur de ``detail_clinique``,
   ne lit RIEN — ni par l'espace tuteur (aucune route), ni par les routes
   du centre (404 du mixin de centre).
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.centers.models import StaffMembership
from apps.common.models import ActCategory
from apps.inpatient.models import Bed, BedAssignment, Room, Stay
from apps.medical.models import ActPerformed, Consent

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_center,
    make_encounter,
    make_patient,
    make_tariff,
    make_user,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Scénario d'API partagé
# ---------------------------------------------------------------------------


class Scene:
    """Un centre équipé, ses quatre casquettes, un séjour en cours."""

    def __init__(self, admit=True, patient=None):
        self.center, self.director = make_center_with_director()
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.nurse = make_staff_user(self.center, role=Role.NURSE)
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.cashier = make_staff_user(self.center, role=Role.CASHIER)
        self.pharmacist = make_staff_user(self.center, role=Role.PHARMACIST)
        self.patient = patient or make_claimed_patient(
            first_name="Anfia", last_name="Saïd",
            created_by_center=self.center,
        )
        self.room = Room.objects.create(center=self.center, name="Chambre 1")
        self.bed_a = Bed.objects.create(room=self.room, name="Lit A")
        self.bed_b = Bed.objects.create(room=self.room, name="Lit B")
        self._tariffs = {}
        self.stay = None
        if admit:
            self.stay = self.admit()

    @property
    def base(self):
        return f"/api/v1/centers/{self.center.pk}/inpatient"

    def admit(self, actor=None, **body):
        payload = {
            "patient": self.patient.pk,
            "reason": "Poussée hypertensive — surveillance 48 h",
            "diagnosis": "HTA sévère sans signe de gravité",
            "priority": "urgente",
            "bed": self.bed_a.pk,
        }
        payload.update(body)
        response = client_for(actor or self.doctor).post(
            f"{self.base}/stays/", payload, format="json"
        )
        assert response.status_code == 201, response.data
        return Stay.objects.get(pk=response.data["id"])

    def admit_days_ago(self, days, **body):
        """Une admission datée — depuis le correctif du plafond, facturer N
        journées suppose un séjour d'au moins N dates civiles."""
        return self.admit(
            admitted_at=(timezone.now() - timedelta(days=days)).isoformat(),
            **body,
        )

    def day_tariff(self, code="HOSP01"):
        """La ligne « journée d'hospitalisation » de la grille (nature
        générique ``hospitalisation``, la seule que ``bill-days/`` accepte).
        Mémoïsée : le code d'un tarif est unique par centre."""
        cached = self._tariffs.get(code)
        if cached is not None:
            return cached
        tariff = make_tariff(
            self.center, code=code, label="Journée d'hospitalisation",
            price_kmf="12000",
        )
        tariff.generic_category = ActCategory.HOSPITALISATION
        tariff.save()
        self._tariffs[code] = tariff
        return tariff

    def bill_days(self, days=1, tariff=None, key=None, actor=None, stay=None):
        """POST bill-days/ avec sa clé d'idempotence OBLIGATOIRE."""
        body = {
            "tariff": (tariff or self.day_tariff()).pk,
            "days": days,
            "idempotency_key": key or f"lot-{next(_api_keys)}",
        }
        stay = stay or self.stay
        return client_for(actor or self.cashier).post(
            f"{self.base}/stays/{stay.pk}/bill-days/", body, format="json"
        )


_api_keys = iter(range(1, 10_000))


@pytest.fixture
def scene():
    return Scene()


# ---------------------------------------------------------------------------
# 1 — Admission
# ---------------------------------------------------------------------------


class TestAdmission:
    def test_a_doctor_admits_and_the_payload_is_clinical(self, scene):
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert response.status_code == 200
        data = response.data
        assert data["status"] == "en_cours"
        assert data["priority"] == "urgente"
        assert data["reason"].startswith("Poussée hypertensive")
        assert data["diagnosis"] == "HTA sévère sans signe de gravité"
        assert data["bed"]["name"] == "Lit A"
        assert data["bed"]["room_name"] == "Chambre 1"
        assert data["billed_days"] == 0

    def test_a_nurse_may_admit_too(self):
        scene = Scene(admit=False)
        stay = scene.admit(actor=scene.nurse)
        assert stay.status == Stay.Status.IN_PROGRESS

    @pytest.mark.parametrize("hat", ["secretary", "cashier", "pharmacist"])
    def test_non_clinical_roles_cannot_admit(self, hat):
        scene = Scene(admit=False)
        response = client_for(getattr(scene, hat)).post(
            f"{scene.base}/stays/",
            {"patient": scene.patient.pk, "reason": "Fièvre"},
            format="json",
        )
        assert response.status_code == 403
        assert not Stay.objects.exists()

    def test_a_director_who_is_not_clinical_cannot_admit(self, scene):
        response = client_for(scene.director).post(
            f"{scene.base}/stays/",
            {"patient": make_patient(created_by_center=scene.center).pk,
             "reason": "Fièvre"},
            format="json",
        )
        assert response.status_code == 403

    def test_a_bed_is_optional(self):
        scene = Scene(admit=False)
        stay = scene.admit(bed=None)
        assert stay.current_bed is None

    def test_a_patient_outside_the_perimeter_is_a_400_in_the_body(self, scene):
        stranger = make_patient(created_by_center=make_center(name="Ailleurs"))
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": stranger.pk, "reason": "Fièvre"},
            format="json",
        )
        assert response.status_code == 400
        assert "n'est pas connu de ce centre" in str(response.data)

    def test_a_non_existent_patient_answers_the_SAME_400(self, scene):
        stranger = make_patient(created_by_center=make_center(name="Ailleurs"))
        foreign = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": stranger.pk, "reason": "Fièvre"}, format="json",
        )
        ghost = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": 9_999_999, "reason": "Fièvre"}, format="json",
        )
        # Aucun oracle : l'étranger et l'inexistant sont indistinguables.
        assert foreign.status_code == ghost.status_code == 400
        assert str(foreign.data) == str(ghost.data)

    def test_a_foreign_bed_is_a_400_in_the_body(self, scene):
        elsewhere = make_center(name="Ailleurs")
        foreign_room = Room.objects.create(center=elsewhere, name="C1")
        foreign_bed = Bed.objects.create(room=foreign_room, name="L1")
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": make_patient(created_by_center=scene.center).pk,
             "reason": "Fièvre", "bed": foreign_bed.pk},
            format="json",
        )
        assert response.status_code == 400
        assert "n'appartient pas à ce centre" in str(response.data)

    def test_a_foreign_attending_is_a_400_in_the_body(self, scene):
        elsewhere, other_director = make_center_with_director(name="Ailleurs")
        foreign = other_director.staff_memberships.get(center=elsewhere)
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": make_patient(created_by_center=scene.center).pk,
             "reason": "Fièvre", "attending": [foreign.pk]},
            format="json",
        )
        assert response.status_code == 400

    def test_a_missing_reason_is_a_field_error(self, scene):
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": make_patient(created_by_center=scene.center).pk},
            format="json",
        )
        assert response.status_code == 400
        assert "reason" in response.data

    def test_an_occupied_bed_answers_a_clean_400(self, scene):
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/",
            {"patient": make_patient(created_by_center=scene.center).pk,
             "reason": "Fièvre", "bed": scene.bed_a.pk},
            format="json",
        )
        assert response.status_code == 400
        assert "déjà occupé" in str(response.data)
        assert Stay.objects.count() == 1


# ---------------------------------------------------------------------------
# 2 — Segmentation clinique / administrative (décision 5)
# ---------------------------------------------------------------------------


CLINICAL_ONLY_KEYS = {"reason", "diagnosis", "cancel_reason"}


class TestRoleSegmentation:
    @pytest.mark.parametrize("hat", ["secretary", "cashier", "director"])
    def test_administrative_staff_reads_the_stay_without_the_clinical(
        self, scene, hat
    ):
        response = client_for(getattr(scene, hat)).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert response.status_code == 200
        assert CLINICAL_ONLY_KEYS.isdisjoint(response.data.keys())
        # …mais l'exploitation est bien là : qui, où, depuis quand.
        assert response.data["patient_name"] == "Anfia Saïd"
        assert response.data["bed"]["name"] == "Lit A"
        assert response.data["priority"] == "urgente"

    @pytest.mark.parametrize("hat", ["doctor", "nurse"])
    def test_clinical_staff_reads_everything(self, scene, hat):
        response = client_for(getattr(scene, hat)).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert CLINICAL_ONLY_KEYS.issubset(response.data.keys())

    def test_the_list_is_segmented_too(self, scene):
        admin_row = client_for(scene.secretary).get(
            f"{scene.base}/stays/"
        ).data["results"][0]
        clinical_row = client_for(scene.doctor).get(
            f"{scene.base}/stays/"
        ).data["results"][0]
        assert CLINICAL_ONLY_KEYS.isdisjoint(admin_row.keys())
        assert "reason" in clinical_row

    def test_the_pharmacist_reads_the_operating_view_only(self, scene):
        """Le pharmacien n'est pas un rôle clinique au sens R-API-1 : il lit
        l'occupation (il livre dans les chambres) mais jamais le motif."""
        response = client_for(scene.pharmacist).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert response.status_code == 200
        assert CLINICAL_ONLY_KEYS.isdisjoint(response.data.keys())

    def test_the_cancellation_motive_never_reaches_administrative_staff(
        self, scene
    ):
        motive = "Confusion avec la patiente de la chambre voisine"
        client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/cancel/",
            {"reason": motive}, format="json",
        )
        admin = client_for(scene.secretary).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert motive not in str(admin.data)
        clinical = client_for(scene.doctor).get(
            f"{scene.base}/stays/{scene.stay.pk}/"
        )
        assert clinical.data["cancel_reason"] == motive

    def test_the_occupancy_board_hides_the_motive_from_the_desk(self, scene):
        desk = client_for(scene.secretary).get(f"{scene.base}/occupancy/")
        assert desk.status_code == 200
        (room,) = desk.data
        occupant = room["beds"][0]["occupant"]
        assert occupant["patient_name"] == "Anfia Saïd"
        assert occupant["priority"] == "urgente"
        assert "reason" not in occupant

        ward = client_for(scene.doctor).get(f"{scene.base}/occupancy/")
        assert ward.data[0]["beds"][0]["occupant"]["reason"].startswith(
            "Poussée"
        )

    def test_the_board_counts_the_free_beds(self, scene):
        (room,) = client_for(scene.secretary).get(
            f"{scene.base}/occupancy/"
        ).data
        assert room["free_beds"] == 1
        assert [bed["occupant"] for bed in room["beds"]].count(None) == 1

    def test_the_bed_assignment_trail_is_clinical_only(self, scene):
        path = f"{scene.base}/stays/{scene.stay.pk}/bed-assignments/"
        assert client_for(scene.doctor).get(path).status_code == 200
        assert client_for(scene.secretary).get(path).status_code == 403


# ---------------------------------------------------------------------------
# 3 — Cloisonnement multi-tenant et IDOR
# ---------------------------------------------------------------------------


class TestTenantIsolation:
    def test_a_stay_of_another_center_is_a_404_through_my_url(self, scene):
        elsewhere = Scene()
        # Le séjour d'à côté, adressé par MON URL de centre.
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/{elsewhere.stay.pk}/"
        )
        assert response.status_code == 404

    def test_a_foreign_center_is_invisible(self, scene):
        elsewhere = Scene()
        for path in (
            f"/api/v1/centers/{elsewhere.center.pk}/inpatient/stays/",
            f"/api/v1/centers/{elsewhere.center.pk}/inpatient/occupancy/",
            f"/api/v1/centers/{elsewhere.center.pk}/inpatient/rooms/",
            f"/api/v1/centers/{elsewhere.center.pk}/inpatient/beds/",
        ):
            assert client_for(scene.doctor).get(path).status_code == 404, path

    def test_a_foreign_room_is_a_404_in_the_url(self, scene):
        elsewhere = Scene(admit=False)
        response = client_for(scene.doctor).get(
            f"{scene.base}/rooms/{elsewhere.room.pk}/beds/"
        )
        assert response.status_code == 404

    def test_lists_never_leak_across_centers(self, scene):
        elsewhere = Scene()
        stays = client_for(scene.doctor).get(f"{scene.base}/stays/").data
        assert [row["id"] for row in stays["results"]] == [scene.stay.pk]
        beds = client_for(scene.doctor).get(f"{scene.base}/beds/").data
        assert {row["id"] for row in beds} == {scene.bed_a.pk, scene.bed_b.pk}
        assert elsewhere.bed_a.pk not in {row["id"] for row in beds}

    def test_anonymous_gets_401_everywhere(self, scene):
        for path in (
            f"{scene.base}/stays/", f"{scene.base}/occupancy/",
            f"{scene.base}/rooms/", f"{scene.base}/beds/",
            "/api/v1/patients/me/stays/",
        ):
            assert client_for().get(path).status_code == 401, path


# ---------------------------------------------------------------------------
# 4 — Chambres et lits : le directeur configure
# ---------------------------------------------------------------------------


class TestRoomAndBedConfiguration:
    def test_the_director_declares_a_room_and_its_beds(self, scene):
        client = client_for(scene.director)
        room = client.post(
            f"{scene.base}/rooms/", {"name": "Chambre 2"}, format="json"
        )
        assert room.status_code == 201
        bed = client.post(
            f"{scene.base}/rooms/{room.data['id']}/beds/",
            {"name": "Lit A"}, format="json",
        )
        assert bed.status_code == 201
        assert bed.data["room_name"] == "Chambre 2"

    @pytest.mark.parametrize("hat", ["doctor", "secretary", "cashier"])
    def test_only_the_director_writes_the_structure(self, scene, hat):
        response = client_for(getattr(scene, hat)).post(
            f"{scene.base}/rooms/", {"name": "Chambre 2"}, format="json"
        )
        assert response.status_code == 403

    def test_every_staff_reads_the_structure(self, scene):
        for hat in ("doctor", "nurse", "secretary", "cashier", "pharmacist"):
            response = client_for(getattr(scene, hat)).get(
                f"{scene.base}/rooms/"
            )
            assert response.status_code == 200, hat
            assert response.data[0]["bed_count"] == 2

    def test_a_duplicate_room_name_is_a_400(self, scene):
        response = client_for(scene.director).post(
            f"{scene.base}/rooms/", {"name": "Chambre 1"}, format="json"
        )
        assert response.status_code == 400

    def test_the_free_filter_drives_the_admission_selector(self, scene):
        free = client_for(scene.doctor).get(f"{scene.base}/beds/?free=true")
        assert [row["id"] for row in free.data] == [scene.bed_b.pk]
        every = client_for(scene.doctor).get(f"{scene.base}/beds/")
        assert len(every.data) == 2

    def test_a_garbage_free_value_is_a_400_per_field(self, scene):
        response = client_for(scene.doctor).get(f"{scene.base}/beds/?free=oui")
        assert response.status_code == 400
        assert "free" in response.data


# ---------------------------------------------------------------------------
# 5 — Lit : assignation, transfert, libération
# ---------------------------------------------------------------------------


class TestBedRoutes:
    def test_transfer_then_release(self, scene):
        client = client_for(scene.doctor)
        moved = client.post(
            f"{scene.base}/stays/{scene.stay.pk}/bed/",
            {"bed": scene.bed_b.pk}, format="json",
        )
        assert moved.status_code == 200
        assert moved.data["bed"]["name"] == "Lit B"

        freed = client.delete(f"{scene.base}/stays/{scene.stay.pk}/bed/")
        assert freed.status_code == 200
        assert freed.data["bed"] is None
        # L'histoire est empilée, jamais réécrite.
        trail = client.get(
            f"{scene.base}/stays/{scene.stay.pk}/bed-assignments/"
        ).data
        assert [row["bed_name"] for row in trail] == ["Lit B", "Lit A"]
        assert all(row["released_at"] is not None for row in trail)

    @pytest.mark.parametrize("hat", ["secretary", "cashier", "director"])
    def test_non_clinical_roles_cannot_move_a_bed(self, scene, hat):
        response = client_for(getattr(scene, hat)).post(
            f"{scene.base}/stays/{scene.stay.pk}/bed/",
            {"bed": scene.bed_b.pk}, format="json",
        )
        assert response.status_code == 403

    def test_moving_a_stay_of_another_center_is_a_404(self, scene):
        elsewhere = Scene()
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/{elsewhere.stay.pk}/bed/",
            {"bed": scene.bed_b.pk}, format="json",
        )
        assert response.status_code == 404

    def test_attending_is_replaced_as_a_whole(self, scene):
        doctor_membership = scene.doctor.staff_memberships.get(
            center=scene.center
        )
        nurse_membership = scene.nurse.staff_memberships.get(center=scene.center)
        response = client_for(scene.doctor).put(
            f"{scene.base}/stays/{scene.stay.pk}/attending/",
            {"attending": [doctor_membership.pk, nurse_membership.pk]},
            format="json",
        )
        assert response.status_code == 200
        assert {row["id"] for row in response.data["attending"]} == {
            doctor_membership.pk, nurse_membership.pk
        }
        emptied = client_for(scene.doctor).put(
            f"{scene.base}/stays/{scene.stay.pk}/attending/",
            {"attending": []}, format="json",
        )
        assert emptied.data["attending"] == []


# ---------------------------------------------------------------------------
# 6 — Sortie, annulation, facturation des journées
# ---------------------------------------------------------------------------


class TestLifecycleRoutes:
    def test_discharge_frees_the_bed_and_closes_the_pivot(self, scene):
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/discharge/", {}, format="json"
        )
        assert response.status_code == 200
        assert response.data["status"] == "sortie"
        assert response.data["bed"] is None
        scene.stay.refresh_from_db()
        assert scene.stay.encounter.status == "terminee"
        assert not BedAssignment.objects.filter(
            bed=scene.bed_a, released_at__isnull=True
        ).exists()

    def test_a_second_discharge_is_a_400(self, scene):
        client = client_for(scene.doctor)
        client.post(f"{scene.base}/stays/{scene.stay.pk}/discharge/", {},
                    format="json")
        again = client.post(
            f"{scene.base}/stays/{scene.stay.pk}/discharge/", {}, format="json"
        )
        assert again.status_code == 400
        assert "Transition impossible" in str(again.data)

    def test_cancel_requires_a_reason(self, scene):
        response = client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/cancel/", {}, format="json"
        )
        assert response.status_code == 400
        assert "reason" in response.data

    def test_billing_the_days_is_a_BILLING_gesture(self):
        scene = Scene(admit=False)
        scene.stay = scene.admit_days_ago(3)
        response = scene.bill_days(days=3)
        assert response.status_code == 200, response.data
        assert response.data["billed_days"] == 3
        # …et la facturation existante prend le relais sans rien apprendre.
        invoice = client_for(scene.cashier).post(
            f"/api/v1/centers/{scene.center.pk}/invoices/",
            {"encounter": scene.stay.encounter_id}, format="json",
        )
        assert invoice.status_code == 201
        assert invoice.data["total_kmf"] == "36000.00"

    @pytest.mark.parametrize("hat", ["doctor", "nurse", "pharmacist"])
    def test_clinical_roles_do_not_bill(self, scene, hat):
        assert scene.bill_days(actor=getattr(scene, hat)).status_code == 403

    def test_a_foreign_tariff_is_a_400_in_the_body(self, scene):
        foreign = make_tariff(make_center(name="Ailleurs"))
        response = scene.bill_days(tariff=foreign)
        assert response.status_code == 400
        assert "grille de ce centre" in str(response.data)

    def test_zero_days_is_a_field_error(self, scene):
        response = scene.bill_days(days=0)
        assert response.status_code == 400
        assert "days" in response.data

    def test_the_idempotency_key_is_a_REQUIRED_field(self, scene):
        """Correctif PO du 15/08/2026 : le jeton n'est pas optionnel comme
        au guichet — cette route est neuve, aucun appelant n'a d'excuse, et
        un jeton facultatif est un jeton que la moitié des clients oublie.
        """
        response = client_for(scene.cashier).post(
            f"{scene.base}/stays/{scene.stay.pk}/bill-days/",
            {"tariff": scene.day_tariff().pk, "days": 1}, format="json",
        )
        assert response.status_code == 400
        assert "idempotency_key" in response.data
        assert response.data["idempotency_key"] == [
            "La clé d'idempotence est requise."
        ]

    def test_an_empty_key_is_a_field_error_too(self, scene):
        response = client_for(scene.cashier).post(
            f"{scene.base}/stays/{scene.stay.pk}/bill-days/",
            {
                "tariff": scene.day_tariff().pk,
                "days": 1,
                "idempotency_key": "",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "idempotency_key" in response.data

    def test_replaying_the_POST_answers_200_with_the_SAME_state(self):
        """Le contrat que lira le frontend : rejouer à l'identique répond
        200 avec le même séjour — pas un second lot d'actes, pas un 400."""
        scene = Scene(admit=False)
        scene.stay = scene.admit_days_ago(2)
        first = scene.bill_days(days=2, key="poste-caisse-1")
        replay = scene.bill_days(days=2, key="poste-caisse-1")
        assert (first.status_code, replay.status_code) == (200, 200)
        assert first.data["billed_days"] == replay.data["billed_days"] == 2
        assert ActPerformed.objects.filter(
            encounter=scene.stay.encounter
        ).count() == 2
        # …et la facture qui suit ne réclame que 2 journées, pas 4.
        invoice = client_for(scene.cashier).post(
            f"/api/v1/centers/{scene.center.pk}/invoices/",
            {"encounter": scene.stay.encounter_id}, format="json",
        )
        assert invoice.data["total_kmf"] == "24000.00"

    def test_the_same_key_with_other_parameters_is_an_explicit_400(self, scene):
        assert scene.bill_days(days=1, key="k-1").status_code == 200
        mismatch = scene.bill_days(days=1, key="k-1", tariff=scene.day_tariff("H2"))
        assert mismatch.status_code == 400
        assert "clé d'idempotence" in str(mismatch.data)

    def test_billing_beyond_the_length_of_the_stay_is_refused(self, scene):
        """Le plafond, vu du client : un séjour du jour ouvre 1 journée."""
        response = scene.bill_days(days=5)
        assert response.status_code == 400
        assert "ouvre 1 journée(s) facturable(s)" in str(response.data)
        assert not ActPerformed.objects.filter(
            encounter=scene.stay.encounter
        ).exists()


# ---------------------------------------------------------------------------
# 7 — Filtres de la liste des séjours
# ---------------------------------------------------------------------------


class TestStayListFilters:
    def test_the_default_view_is_the_ward_board(self, scene):
        client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/discharge/", {}, format="json"
        )
        board = client_for(scene.doctor).get(f"{scene.base}/stays/").data
        assert board["count"] == 0
        everything = client_for(scene.doctor).get(
            f"{scene.base}/stays/?all=true"
        ).data
        assert everything["count"] == 1

    def test_status_filter(self, scene):
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/?status=en_cours"
        )
        assert response.data["count"] == 1
        assert client_for(scene.doctor).get(
            f"{scene.base}/stays/?status=sortie"
        ).data["count"] == 0

    def test_an_unknown_status_is_a_400_per_field(self, scene):
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/?status=hospitalise"
        )
        assert response.status_code == 400
        assert "status" in response.data

    def test_patient_filter_never_probes_another_center(self, scene):
        elsewhere = Scene()
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/?patient={elsewhere.patient.pk}&all=true"
        )
        assert response.status_code == 200
        assert response.data["count"] == 0

    def test_a_garbage_patient_filter_is_a_400_per_field(self, scene):
        response = client_for(scene.doctor).get(
            f"{scene.base}/stays/?patient=abc"
        )
        assert response.status_code == 400
        assert "patient" in response.data


# ---------------------------------------------------------------------------
# 8 — La fenêtre du PATIENT (décision 5)
# ---------------------------------------------------------------------------


class TestPatientWindow:
    def test_the_patient_reads_their_stay_across_centers(self, scene):
        second = Scene(admit=False, patient=scene.patient)
        # La patiente entre dans le périmètre du 2ᵉ centre par une visite
        # ordinaire (``center_patients_qs`` : créée au guichet OU déjà vue).
        make_encounter(patient=scene.patient, center=second.center)
        client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/discharge/", {}, format="json"
        )
        second.admit()

        response = client_for(scene.patient.user).get("/api/v1/patients/me/stays/")
        assert response.status_code == 200
        assert response.data["count"] == 2
        centers = {row["center"] for row in response.data["results"]}
        assert centers == {scene.center.pk, second.center.pk}

    def test_the_patient_payload_carries_no_ward_management_data(self, scene):
        (row,) = client_for(scene.patient.user).get(
            "/api/v1/patients/me/stays/"
        ).data["results"]
        assert set(row.keys()) == {
            "id", "center", "center_name", "encounter", "admitted_at",
            "discharged_at", "status",
        }
        # Ni le lit, ni la priorité, ni le motif d'annulation, ni le clinique.
        for forbidden in (
            "bed", "priority", "cancel_reason", "reason", "diagnosis",
            "attending", "billed_days", "patient_name",
        ):
            assert forbidden not in row, forbidden

    def test_another_patient_never_sees_the_stay(self, scene):
        intruder = make_user()
        make_claimed_patient(user=intruder)
        response = client_for(intruder).get("/api/v1/patients/me/stays/")
        assert response.data["count"] == 0

    def test_a_patient_cannot_reach_the_ward_routes(self, scene):
        """Le patient n'est staff d'aucun centre : les routes du service lui
        renvoient le 404 du mixin de centre (le centre n'existe pas pour
        lui), jamais un 403 qui confirmerait son existence."""
        client = client_for(scene.patient.user)
        for path in (
            f"{scene.base}/stays/", f"{scene.base}/occupancy/",
            f"{scene.base}/stays/{scene.stay.pk}/",
        ):
            assert client.get(path).status_code == 404, path


# ---------------------------------------------------------------------------
# 9 — Le verrou TUTEUR (décision 5 + verrou de sprint S3)
# ---------------------------------------------------------------------------


class TestTheGuardianSeesNothing:
    @staticmethod
    def _empowered_guardian(scene):
        """Un tuteur ACTIF porteur du consentement le PLUS large possible :
        s'il ne voit rien avec ``detail_clinique``, il ne verra jamais rien."""
        user, guardian = make_guardian_user()
        link = make_active_link(guardian, scene.patient)
        Consent.objects.create(
            patient=scene.patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        return user

    def test_no_guardian_route_serves_a_stay(self, scene):
        guardian_user = self._empowered_guardian(scene)
        client = client_for(guardian_user)
        for path in (
            "/api/v1/guardian/stays/",
            "/api/v1/guardian/proteges/stays/",
            f"/api/v1/guardian/proteges/{scene.patient.pk}/stays/",
        ):
            assert client.get(path).status_code == 404, path

    def test_the_patient_route_is_403_for_a_guardian(self, scene):
        guardian_user = self._empowered_guardian(scene)
        assert client_for(guardian_user).get(
            "/api/v1/patients/me/stays/"
        ).status_code == 403

    def test_the_ward_routes_are_invisible_to_a_guardian(self, scene):
        guardian_user = self._empowered_guardian(scene)
        client = client_for(guardian_user)
        for path in (
            f"{scene.base}/stays/", f"{scene.base}/occupancy/",
            f"{scene.base}/rooms/", f"{scene.base}/beds/",
            f"{scene.base}/stays/{scene.stay.pk}/",
        ):
            assert client.get(path).status_code == 404, path

    def test_the_protege_payload_never_gains_a_stay_key(self, scene):
        guardian_user = self._empowered_guardian(scene)
        proteges = client_for(guardian_user).get("/api/v1/guardian/proteges/")
        (row,) = proteges.data["results"]
        assert set(row["patient"].keys()) == {
            "id", "first_name", "last_name", "claim_status"
        }
        assert "stays" not in str(row)

    def test_the_rgpd_export_of_a_guardian_carries_no_stay(self, scene):
        """L'export de portabilité rejoue les écrans : le verrou tuteur doit
        y tenir aussi (patron du contrôle S4)."""
        guardian_user = self._empowered_guardian(scene)
        export = client_for(guardian_user).get("/api/v1/auth/me/export/")
        assert export.status_code == 200
        assert "stays" not in str(export.data.get("guardian"))
        assert export.data["patient"] is None


# ---------------------------------------------------------------------------
# 10 — Le patient hospitalisé dans SON export RGPD
# ---------------------------------------------------------------------------


class TestPatientExport:
    def test_the_stay_is_in_the_export_through_the_patient_window_only(
        self, scene
    ):
        """Sonde S6 mise à jour CONSCIEMMENT en SV (reliquat soldé) : la clé
        ``stays`` est arrivée dans l'export art. 20 — par la fenêtre patient
        (`StayPatientSerializer`) et RIEN qu'elle : ni lit, ni priorité, ni
        motif d'annulation (ADR 0019 §5). La consultation pivot reste dans
        l'export, comme avant.
        """
        export = client_for(scene.patient.user).get("/api/v1/auth/me/export/")
        assert export.status_code == 200
        stays = export.data["patient"]["stays"]
        assert [row["id"] for row in stays] == [scene.stay.pk]
        (row,) = stays
        assert set(row) == {
            "id", "center", "center_name", "encounter", "admitted_at",
            "discharged_at", "status",
        }
        blob = str(stays)
        for forbidden in ("bed", "priority", "cancel_reason"):
            assert forbidden not in blob, forbidden
        # …et l'épisode reste lisible par sa consultation pivot, qui EST
        # dans l'export : rien n'est caché au patient.
        encounter_ids = {row["id"] for row in export.data["patient"]["encounters"]}
        assert scene.stay.encounter_id in encounter_ids


# ---------------------------------------------------------------------------
# 11 — Le gel commercial ne ferme aucune de ces routes (décision 6)
# ---------------------------------------------------------------------------


class TestTheFreezeNeverClosesTheWard:
    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_every_ward_gesture_still_works_on_a_frozen_tenant(self, status):
        from .factories import make_subscription

        scene = Scene(admit=False)
        make_subscription(
            center=scene.center, status=status, status_reason="Impayé."
        )
        room = client_for(scene.director).post(
            f"{scene.base}/rooms/", {"name": "Chambre 2"}, format="json"
        )
        assert room.status_code == 201
        bed = client_for(scene.director).post(
            f"{scene.base}/rooms/{room.data['id']}/beds/",
            {"name": "Lit A"}, format="json",
        )
        assert bed.status_code == 201
        stay = scene.admit()
        moved = client_for(scene.doctor).post(
            f"{scene.base}/stays/{stay.pk}/bed/",
            {"bed": bed.data["id"]}, format="json",
        )
        assert moved.status_code == 200
        out = client_for(scene.doctor).post(
            f"{scene.base}/stays/{stay.pk}/discharge/", {}, format="json"
        )
        assert out.status_code == 200

    def test_by_contrast_the_administration_IS_frozen(self):
        """Test de contraste : sur le MÊME centre suspendu, un geste
        administratif (créer un tarif) est bien refusé — la preuve que le
        gel fonctionne et que l'hospitalisation en est délibérément hors."""
        from .factories import make_subscription

        scene = Scene(admit=False)
        make_subscription(
            center=scene.center, status="suspendu", status_reason="Impayé."
        )
        refused = client_for(scene.director).post(
            f"/api/v1/centers/{scene.center.pk}/tariffs/",
            {"code": "X1", "label": "Test", "price_kmf": "1000"},
            format="json",
        )
        assert refused.status_code == 400


# ---------------------------------------------------------------------------
# 12 — Le journal du directeur (décision 6)
# ---------------------------------------------------------------------------


class TestTheDirectorsJournal:
    def test_the_configuration_shows_up_but_never_the_stay(self, scene):
        """Une hospitalisation COMPLÈTE produit un journal qui ne contient
        que la configuration : le directeur sait combien de lits il a, pas
        qui dort dedans."""
        client_for(scene.director).post(
            f"{scene.base}/rooms/", {"name": "Chambre 2"}, format="json"
        )
        client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/bed/",
            {"bed": scene.bed_b.pk}, format="json",
        )
        client_for(scene.doctor).post(
            f"{scene.base}/stays/{scene.stay.pk}/discharge/", {}, format="json"
        )
        journal = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/audit-log/"
        )
        actions = {row["action"] for row in journal.data["results"]}
        assert "room.created" in actions
        assert not {
            action for action in actions
            if action.startswith("stay.") or action.startswith("bed.assign")
            or action == "bed.released"
        }

    def test_filtering_on_a_stay_action_gives_no_oracle(self, scene):
        response = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/audit-log/?action=stay.admitted"
        )
        assert response.status_code == 400
        assert response.data["action"] == ["Action inconnue."]
