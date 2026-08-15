"""HRM — couche API (S7, ADR 0020 décision 6).

Ce que ce fichier verrouille :

1. **La segmentation par audience** : le directeur voit tout de SON centre ;
   la personne voit les SIENNES (type de congé compris) ; tout le staff ne
   voit que le planning collectif — **et jamais sous quel régime** ;
2. **Le cloisonnement multi-tenant** : un dossier RH, un service, un congé
   d'un autre centre sont INVISIBLES (404 déterministe au queryset) — y
   compris pour le même humain employé des deux côtés ;
3. **La norme S1 des refus** : URL → 404, corps → 400 explicite ;
4. **Le verrou tuteur/patient/plateforme** : ils ne lisent RIEN ;
5. **Le gel** : ce qu'il ferme côté directeur, ce qu'il laisse ouvert côté
   personne ;
6. **Les statistiques RH ont leur endpoint dédié** — rien n'a bougé dans
   ``stats/``.
"""

from datetime import timedelta
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.billing.models import CenterSubscription
from apps.hrm.models import (
    AttendanceRecord,
    Employment,
    Holiday,
    LeaveDocument,
    LeaveRequest,
)

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
    make_attendance,
    make_center,
    make_employment,
    make_leave,
    make_platform_staff,
    make_staff,
    make_subscription,
    make_user,
)

pytestmark = pytest.mark.django_db

Presence = AttendanceRecord.Status
LeaveType = LeaveRequest.Type
Status = LeaveRequest.Status


# ---------------------------------------------------------------------------
# Décor d'API partagé
# ---------------------------------------------------------------------------


class Scene:
    """Un centre, ses casquettes, et deux dossiers RH ouverts."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.nurse = make_staff_user(self.center, role=Role.NURSE)
        self.cashier = make_staff_user(self.center, role=Role.CASHIER)
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.department = self.post(
            self.director, "departments/", {"name": "Maternité"}
        )
        self.job_title = self.post(
            self.director, "job-titles/", {"name": "Sage-femme"}
        )
        self.nurse_file = self.post(
            self.director, "employments/",
            {
                "user": self.nurse.pk,
                "hired_at": str(timezone.localdate() - timedelta(days=200)),
                "department": self.department["id"],
                "job_title": self.job_title["id"],
            },
        )
        self.cashier_file = self.post(
            self.director, "employments/",
            {
                "user": self.cashier.pk,
                "hired_at": str(timezone.localdate() - timedelta(days=90)),
            },
        )

    @property
    def base(self):
        return f"/api/v1/centers/{self.center.pk}/hrm"

    def post(self, actor, path, body=None, expected=201):
        response = client_for(actor).post(
            f"{self.base}/{path}", body or {}, format="json"
        )
        assert response.status_code == expected, response.data
        return response.data

    def get(self, actor, path, expected=200):
        response = client_for(actor).get(f"{self.base}/{path}")
        assert response.status_code == expected, getattr(response, "data", b"")
        return response.data


def _image_upload(name="certificat.jpg"):
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (100, 80), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


# ---------------------------------------------------------------------------
# 1 — QUI PEUT QUOI (décision 6)
# ---------------------------------------------------------------------------


class TestTheDirectorIsTheOnlyHrAudience:
    """« Chacun voit les siennes, le directeur voit tout » — et un délégué
    RH est explicitement HORS PÉRIMÈTRE S7 (décision 6) : ajouter un
    échelon intermédiaire multiplie les yeux sur des données personnelles.
    """

    @pytest.mark.parametrize(
        "path",
        ["employments/", "attendance/", "leaves/", "stats/attendance/"],
    )
    def test_every_other_hat_is_refused(self, path):
        scene = Scene()
        for actor in (scene.nurse, scene.cashier, scene.doctor):
            response = client_for(actor).get(f"{scene.base}/{path}")
            assert response.status_code == 403, path

    def test_the_director_reads_them_all(self):
        scene = Scene()
        for path in ("employments/", "attendance/", "leaves/", "stats/attendance/"):
            scene.get(scene.director, path)

    @pytest.mark.parametrize(
        "path", ["departments/", "job-titles/", "holidays/", "schedule/"]
    )
    def test_configuration_and_schedule_are_read_by_any_active_staff(self, path):
        scene = Scene()
        for actor in (scene.nurse, scene.cashier, scene.doctor, scene.director):
            scene.get(actor, path)

    @pytest.mark.parametrize(
        "path,body",
        [
            ("departments/", {"name": "Laboratoire"}),
            ("job-titles/", {"name": "Laborantin"}),
            ("holidays/", {"date": "2026-07-06", "name": "Indépendance"}),
        ],
    )
    def test_only_the_director_writes_the_configuration(self, path, body):
        scene = Scene()
        for actor in (scene.nurse, scene.cashier, scene.doctor):
            response = client_for(actor).post(
                f"{scene.base}/{path}", body, format="json"
            )
            assert response.status_code == 403
        scene.post(scene.director, path, body)

    def test_an_anonymous_caller_is_401_everywhere(self):
        scene = Scene()
        for path in ("departments/", "schedule/", "employments/", "me/"):
            response = client_for().get(f"{scene.base}/{path}")
            assert response.status_code == 401, path


# ---------------------------------------------------------------------------
# 2 — CLOISONNEMENT MULTI-TENANT
# ---------------------------------------------------------------------------


class TestTenantIsolation:
    def test_a_foreign_center_is_a_404_not_a_403(self):
        scene = Scene()
        other, _other_director = make_center_with_director()
        response = client_for(scene.director).get(
            f"/api/v1/centers/{other.pk}/hrm/employments/"
        )
        assert response.status_code == 404

    def test_the_same_human_employed_twice_keeps_two_sealed_files(self):
        """LE test de l'invariant n° 1, côté API : un directeur du centre A
        ne voit JAMAIS ce que le directeur du centre B a saisi pour le même
        humain."""
        person = make_user(username="double-emploi")
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        make_staff(user=person, center=center_a, role=Role.NURSE)
        make_staff(user=person, center=center_b, role=Role.NURSE)
        file_a = make_employment(
            user=person, center=center_a,
            hired_at=timezone.localdate() - timedelta(days=300),
        )
        file_b = make_employment(
            user=person, center=center_b,
            hired_at=timezone.localdate() - timedelta(days=20),
        )
        make_attendance(
            employment=file_b, date=timezone.localdate(), status=Presence.LEAVE
        )

        rows = client_for(director_a).get(
            f"/api/v1/centers/{center_a.pk}/hrm/employments/"
        ).data
        assert [row["id"] for row in rows] == [file_a.pk]
        assert str(file_b.hired_at) not in str(rows)

        # La feuille de B est invisible de A, et son dossier est un 404.
        assert client_for(director_a).get(
            f"/api/v1/centers/{center_a.pk}/hrm/attendance/"
        ).data["results"] == []
        assert client_for(director_a).get(
            f"/api/v1/centers/{center_a.pk}/hrm/employments/{file_b.pk}/"
        ).status_code == 404
        # …et le directeur de B ne lit rien de A non plus (symétrie).
        assert client_for(director_b).get(
            f"/api/v1/centers/{center_b.pk}/hrm/employments/{file_a.pk}/"
        ).status_code == 404

    def test_a_foreign_leave_reached_through_my_url_is_a_404(self):
        scene = Scene()
        other, _ = make_center_with_director()
        foreign = make_leave(employment=make_employment(center=other))
        for path in (
            f"leaves/{foreign.pk}/",
            f"leaves/{foreign.pk}/approve/",
            f"leaves/{foreign.pk}/documents/",
        ):
            method = client_for(scene.director).post if "approve" in path else (
                client_for(scene.director).get
            )
            assert method(f"{scene.base}/{path}").status_code == 404, path

    def test_the_persons_own_window_is_sealed_on_the_caller(self):
        """``…/hrm/me/`` ne prend AUCUN identifiant : un collègue ne peut
        pas s'y glisser, quel que soit son rôle."""
        scene = Scene()
        make_leave(employment=Employment.objects.get(pk=scene.nurse_file["id"]))
        mine = scene.get(scene.cashier, "me/leaves/")
        assert mine == []
        theirs = scene.get(scene.nurse, "me/leaves/")
        assert len(theirs) == 1


# ---------------------------------------------------------------------------
# 3 — LE PLANNING COLLECTIF (invariant n° 3)
# ---------------------------------------------------------------------------


class TestTheCollectiveScheduleSaysWhoIsThereAndNothingMore:
    def test_leave_and_absence_are_indistinguishable_for_a_colleague(self):
        scene = Scene()
        day = timezone.localdate()
        scene.post(
            scene.director, "attendance/",
            {"employment": scene.nurse_file["id"], "date": str(day),
             "status": "conge"},
        )
        scene.post(
            scene.director, "attendance/",
            {"employment": scene.cashier_file["id"], "date": str(day),
             "status": "absent"},
        )
        rows = {
            row["employment"]: row
            for row in scene.get(scene.doctor, f"schedule/?date={day}")
        }
        assert rows[scene.nurse_file["id"]]["status"] == "absent"
        assert rows[scene.cashier_file["id"]]["status"] == "absent"
        assert "conge" not in str(rows)

    def test_the_payload_carries_no_hr_field(self):
        scene = Scene()
        day = timezone.localdate()
        make_attendance(
            employment=Employment.objects.get(pk=scene.nurse_file["id"]),
            date=day, status=Presence.LEAVE,
        )
        rows = scene.get(scene.doctor, f"schedule/?date={day}")
        for row in rows:
            assert set(row) == {
                "employment", "display_name", "job_title", "status"
            }
            for forbidden in (
                "hired_at", "ended_at", "leave_type", "department", "user",
            ):
                assert forbidden not in row

    def test_an_impossible_date_answers_400_per_field(self):
        scene = Scene()
        for raw in ("pas-une-date", "2026-02-30"):
            response = client_for(scene.doctor).get(
                f"{scene.base}/schedule/?date={raw}"
            )
            assert response.status_code == 400
            assert "date" in response.data


# ---------------------------------------------------------------------------
# 4 — LA FENÊTRE DE LA PERSONNE
# ---------------------------------------------------------------------------


class TestThePersonReadsAndAsksForHerOwn:
    def test_my_file_my_attendance_my_leaves(self):
        scene = Scene()
        employment = Employment.objects.get(pk=scene.nurse_file["id"])
        make_attendance(employment=employment, date=timezone.localdate())

        mine = scene.get(scene.nurse, "me/")
        assert mine["job_title_name"] == "Sage-femme"
        assert mine["department_name"] == "Maternité"
        assert "user" not in mine

        sheet = scene.get(scene.nurse, "me/attendance/")
        assert [row["status"] for row in sheet["results"]] == ["present"]
        # Ses propres données, statut RÉEL — c'est elle, ce sont les siennes.
        assert set(sheet["results"][0]) == {"id", "date", "status"}

    def test_no_hr_file_is_an_honest_404_not_an_error(self):
        scene = Scene()
        response = client_for(scene.doctor).get(f"{scene.base}/me/")
        assert response.status_code == 404
        assert "dossier RH" in response.data["detail"]

    def test_requesting_a_leave_never_takes_an_employment_id(self):
        """Le dossier n'est jamais dans le corps : un id y ouvrirait la
        porte à une demande au nom d'un collègue."""
        scene = Scene()
        created = scene.post(
            scene.nurse, "me/leaves/",
            {
                "leave_type": "maladie",
                "start_date": str(timezone.localdate() + timedelta(days=3)),
                "end_date": str(timezone.localdate() + timedelta(days=5)),
                # Tentative d'injection : le champ n'existe pas côté serveur.
                "employment": scene.cashier_file["id"],
            },
        )
        leave = LeaveRequest.objects.get(pk=created["id"])
        assert leave.employment_id == scene.nurse_file["id"]
        assert leave.requested_by_id == scene.nurse.pk

    def test_my_leave_payload_carries_the_type_but_no_decider(self):
        scene = Scene()
        leave = make_leave(
            employment=Employment.objects.get(pk=scene.nurse_file["id"]),
            leave_type=LeaveType.BEREAVEMENT,
        )
        (row,) = scene.get(scene.nurse, "me/leaves/")
        assert row["leave_type"] == "deuil"
        assert row["days"] == leave.days
        assert "decided_by" not in row
        assert "employment" not in row

    def test_i_can_withdraw_my_own_pending_request_only(self):
        scene = Scene()
        employment = Employment.objects.get(pk=scene.nurse_file["id"])
        leave = make_leave(employment=employment)
        scene.post(
            scene.nurse, f"me/leaves/{leave.pk}/cancel/", {}, expected=200
        )
        leave.refresh_from_db()
        assert leave.status == Status.CANCELLED
        # Rejouer est refusé (état terminal), et un congé d'un collègue est
        # un 404 (queryset scellé sur l'appelant).
        assert client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/{leave.pk}/cancel/", {}, format="json"
        ).status_code == 400
        colleague = make_leave(
            employment=Employment.objects.get(pk=scene.cashier_file["id"])
        )
        assert client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/{colleague.pk}/cancel/", {}, format="json"
        ).status_code == 404

    def test_a_type_outside_the_closed_list_is_400_per_field(self):
        scene = Scene()
        response = client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/",
            {
                "leave_type": "burn-out",
                "start_date": str(timezone.localdate()),
                "end_date": str(timezone.localdate()),
            },
            format="json",
        )
        assert response.status_code == 400
        assert "leave_type" in response.data


# ---------------------------------------------------------------------------
# 5 — JUSTIFICATIFS : fichier privé, téléchargement authentifié
# ---------------------------------------------------------------------------


class TestSupportingDocumentsAreNeverServedStatically:
    def _with_document(self):
        scene = Scene()
        leave = make_leave(
            employment=Employment.objects.get(pk=scene.nurse_file["id"]),
            leave_type=LeaveType.SICK,
        )
        response = client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/{leave.pk}/documents/",
            {"file": _image_upload()}, format="multipart",
        )
        assert response.status_code == 201, response.data
        return scene, leave, LeaveDocument.objects.get(pk=response.data["id"])

    def test_no_url_and_no_file_name_in_any_payload(self):
        scene, leave, document = self._with_document()
        for payload in (
            scene.get(scene.nurse, f"me/leaves/{leave.pk}/documents/"),
            scene.get(scene.director, f"leaves/{leave.pk}/documents/"),
        ):
            (row,) = payload
            assert set(row) == {"id", "leave", "archived_at", "created_at"}
            assert "url" not in str(row)
            assert "certificat" not in str(row)
        assert document.file.name not in str(payload)

    def test_both_audiences_download_with_a_neutral_name(self):
        scene, leave, document = self._with_document()
        for actor, path in (
            (scene.nurse,
             f"me/leaves/{leave.pk}/documents/{document.pk}/download/"),
            (scene.director,
             f"leaves/{leave.pk}/documents/{document.pk}/download/"),
        ):
            response = client_for(actor).get(f"{scene.base}/{path}")
            assert response.status_code == 200
            assert (
                f'filename="justificatif-{document.pk}.jpg"'
                in response["Content-Disposition"]
            )
            assert response["X-Content-Type-Options"] == "nosniff"

    def test_a_colleague_never_downloads_someone_elses_certificate(self):
        scene, leave, document = self._with_document()
        path = f"leaves/{leave.pk}/documents/{document.pk}/download/"
        for actor in (scene.cashier, scene.doctor):
            assert client_for(actor).get(
                f"{scene.base}/{path}"
            ).status_code == 403
        # …et par la fenêtre personnelle, c'est un 404 (le congé n'est pas
        # le sien : le queryset est scellé sur l'appelant).
        assert client_for(scene.cashier).get(
            f"{scene.base}/me/leaves/{leave.pk}/documents/{document.pk}/download/"
        ).status_code == 404

    def test_archiving_is_the_persons_own_correction_and_is_final(self):
        scene, leave, document = self._with_document()
        scene.post(
            scene.nurse,
            f"me/leaves/{leave.pk}/documents/{document.pk}/archive/",
            {}, expected=200,
        )
        document.refresh_from_db()
        assert document.archived_at is not None
        assert client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/{leave.pk}/documents/{document.pk}/archive/",
            {}, format="json",
        ).status_code == 400
        # Une pièce archivée reste TÉLÉCHARGEABLE : vérifier ce qui a été
        # archivé fait partie de la correction d'une erreur (patron KYC).
        assert client_for(scene.director).get(
            f"{scene.base}/leaves/{leave.pk}/documents/{document.pk}/download/"
        ).status_code == 200


# ---------------------------------------------------------------------------
# 6 — LA NORME S1 DES REFUS
# ---------------------------------------------------------------------------


class TestRefusalSemantics:
    def test_a_body_reference_outside_the_perimeter_is_a_400(self):
        scene = Scene()
        other, other_director = make_center_with_director()
        from .factories import make_department

        foreign_department = make_department(center=other)
        stranger = make_user()

        refused = client_for(scene.director).post(
            f"{scene.base}/employments/",
            {"user": stranger.pk, "hired_at": str(timezone.localdate())},
            format="json",
        )
        assert refused.status_code == 400
        assert "ne fait pas partie du personnel" in str(refused.data)

        with_foreign_department = client_for(scene.director).post(
            f"{scene.base}/employments/",
            {
                "user": scene.doctor.pk,
                "hired_at": str(timezone.localdate()),
                "department": foreign_department.pk,
            },
            format="json",
        )
        assert with_foreign_department.status_code == 400
        assert "n'appartient pas à ce centre" in str(with_foreign_department.data)

    def test_a_foreign_and_a_nonexistent_id_answer_the_same_message(self):
        """Aucun oracle : « cet identifiant existe-t-il ailleurs ? » ne se
        lit pas dans la réponse (norme S1)."""
        scene = Scene()
        other, _ = make_center_with_director()
        foreign_person = make_staff_user(other, role=Role.NURSE)

        def refusal(user_pk):
            return client_for(scene.director).post(
                f"{scene.base}/employments/",
                {"user": user_pk, "hired_at": str(timezone.localdate())},
                format="json",
            ).data

        assert refusal(foreign_person.pk) == refusal(9_999_999)

    def test_an_unknown_filter_value_is_400_per_field(self):
        scene = Scene()
        for path, field in (
            ("leaves/?status=inconnu", "status"),
            ("leaves/?employment=abc", "employment"),
            ("attendance/?employment=abc", "employment"),
            ("employments/?running=peut-etre", "running"),
        ):
            response = client_for(scene.director).get(f"{scene.base}/{path}")
            assert response.status_code == 400, path
            assert field in response.data, path


# ---------------------------------------------------------------------------
# 7 — LA FEUILLE ET LES DÉCISIONS, CÔTÉ API
# ---------------------------------------------------------------------------


class TestTheSheetAndTheDecisions:
    def test_ticking_the_same_day_twice_corrects_instead_of_duplicating(self):
        scene = Scene()
        day = str(timezone.localdate())
        body = {
            "employment": scene.nurse_file["id"], "date": day,
            "status": "present",
        }
        first = client_for(scene.director).post(
            f"{scene.base}/attendance/", body, format="json"
        )
        assert first.status_code == 201
        second = client_for(scene.director).post(
            f"{scene.base}/attendance/", {**body, "status": "absent"},
            format="json",
        )
        assert second.status_code == 200
        assert second.data["id"] == first.data["id"]
        assert second.data["status"] == "absent"
        assert AttendanceRecord.objects.for_center(scene.center).count() == 1

    def test_the_director_approves_and_the_overlap_guard_answers_400(self):
        scene = Scene()
        employment = Employment.objects.get(pk=scene.nurse_file["id"])
        start = timezone.localdate() + timedelta(days=10)
        first = make_leave(
            employment=employment, start_date=start,
            end_date=start + timedelta(days=5),
        )
        second = make_leave(
            employment=employment, start_date=start + timedelta(days=2),
            end_date=start + timedelta(days=7),
        )
        scene.post(scene.director, f"leaves/{first.pk}/approve/", {}, expected=200)
        response = client_for(scene.director).post(
            f"{scene.base}/leaves/{second.pk}/approve/", {}, format="json"
        )
        assert response.status_code == 400
        assert "deux fois le même jour" in str(response.data)

    def test_refusing_asks_for_no_reason_at_all(self):
        """Décision 4 : le produit ne stocke AUCUN texte libre sur le congé
        de quelqu'un. Un refus s'explique de vive voix."""
        scene = Scene()
        leave = make_leave(
            employment=Employment.objects.get(pk=scene.nurse_file["id"])
        )
        payload = scene.post(
            scene.director, f"leaves/{leave.pk}/refuse/", {}, expected=200
        )
        assert payload["status"] == "refuse"
        assert not any("reason" in key for key in payload)

    def test_the_director_leave_payload_says_the_type_and_flags_the_document(self):
        scene = Scene()
        employment = Employment.objects.get(pk=scene.nurse_file["id"])
        leave = make_leave(employment=employment, leave_type=LeaveType.MATERNITY)
        (row,) = scene.get(scene.director, "leaves/")["results"]
        assert row["leave_type"] == "maternite"
        assert row["has_document"] is False
        assert row["employment_display_name"]

        client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/{leave.pk}/documents/",
            {"file": _image_upload()}, format="multipart",
        )
        (row,) = scene.get(scene.director, "leaves/")["results"]
        assert row["has_document"] is True

    def test_holidays_are_declared_and_removed_by_the_director(self):
        scene = Scene()
        holiday = scene.post(
            scene.director, "holidays/",
            {"date": "2026-07-06", "name": "Fête de l'Indépendance"},
        )
        assert client_for(scene.nurse).delete(
            f"{scene.base}/holidays/{holiday['id']}/"
        ).status_code == 403
        assert client_for(scene.director).delete(
            f"{scene.base}/holidays/{holiday['id']}/"
        ).status_code == 204
        assert not Holiday.objects.filter(pk=holiday["id"]).exists()


# ---------------------------------------------------------------------------
# 8 — LES STATISTIQUES RH ONT LEUR PROPRE ENDPOINT (invariant n° 6)
# ---------------------------------------------------------------------------


class TestHrStatsLiveInTheirOwnModule:
    def test_the_series_is_zero_filled_and_counts_by_person(self):
        scene = Scene()
        employment = Employment.objects.get(pk=scene.nurse_file["id"])
        today = timezone.localdate()
        for offset, status in ((0, Presence.PRESENT), (1, Presence.LEAVE)):
            make_attendance(
                employment=employment, date=today - timedelta(days=offset),
                status=status,
            )
        payload = scene.get(
            scene.director,
            f"stats/attendance/?from={today - timedelta(days=4)}&to={today}",
        )
        assert len(payload["days"]) == 5  # série complète, zéro-remplie
        assert payload["totals"]["present"] == 1
        assert payload["totals"]["conge"] == 1
        assert payload["totals"]["total"] == 2
        (row,) = payload["by_employment"]
        assert row["employment"] == employment.pk
        assert row["total"] == 2

    def test_the_window_honours_the_shared_366_day_contract(self):
        scene = Scene()
        today = timezone.localdate()
        too_long = client_for(scene.director).get(
            f"{scene.base}/stats/attendance/"
            f"?from={today - timedelta(days=400)}&to={today}"
        )
        assert too_long.status_code == 400
        assert "from" in too_long.data
        inverted = client_for(scene.director).get(
            f"{scene.base}/stats/attendance/?from={today}"
            f"&to={today - timedelta(days=1)}"
        )
        assert inverted.status_code == 400

    def test_nothing_of_S7_was_added_to_the_piloting_stats(self):
        """``stats/activity`` et ``stats/finances`` ont des
        ``assertNumQueries`` verrouillés et agrègent l'activité de SOIN :
        rien du RH n'y entre (invariant n° 6, patron ``occupancy_rows``)."""
        import pathlib

        source = (
            pathlib.Path(__file__).resolve().parents[1]
            / "apps" / "centers" / "stats_views.py"
        ).read_text(encoding="utf-8")
        assert "hrm" not in source
        for forbidden in ("Attendance", "Employment", "LeaveRequest"):
            assert forbidden not in source

        scene = Scene()
        activity = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/stats/activity/"
        )
        assert activity.status_code == 200
        assert set(activity.data) == {
            "from", "to", "days", "totals", "encounters_by_practitioner"
        }


# ---------------------------------------------------------------------------
# 9 — LE GEL, VU DE L'API
# ---------------------------------------------------------------------------


class TestTheFreezeSeenFromTheApi:
    def test_the_director_is_frozen_but_the_person_is_not(self):
        scene = Scene()
        make_subscription(
            center=scene.center, status=CenterSubscription.Status.SUSPENDED
        )
        frozen = client_for(scene.director).post(
            f"{scene.base}/attendance/",
            {
                "employment": scene.nurse_file["id"],
                "date": str(timezone.localdate()), "status": "present",
            },
            format="json",
        )
        assert frozen.status_code == 400
        assert "abonnement Chioni" in str(frozen.data)
        # …et le message dit CE QUI CONTINUE avant ce qui est fermé.
        assert "continuent normalement" in str(frozen.data)

        # La personne, elle, lit et demande normalement.
        assert client_for(scene.nurse).get(
            f"{scene.base}/me/attendance/"
        ).status_code == 200
        asked = client_for(scene.nurse).post(
            f"{scene.base}/me/leaves/",
            {
                "leave_type": "annuel",
                "start_date": str(timezone.localdate() + timedelta(days=4)),
                "end_date": str(timezone.localdate() + timedelta(days=6)),
            },
            format="json",
        )
        assert asked.status_code == 201

    def test_every_read_stays_open_on_a_frozen_center(self):
        scene = Scene()
        make_subscription(
            center=scene.center, status=CenterSubscription.Status.TERMINATED
        )
        for path in (
            "departments/", "job-titles/", "holidays/", "schedule/",
            "employments/", "attendance/", "leaves/", "stats/attendance/",
        ):
            assert client_for(scene.director).get(
                f"{scene.base}/{path}"
            ).status_code == 200, path


# ---------------------------------------------------------------------------
# 10 — LE VERROU : PATIENT, TUTEUR, EXPLOITANT NE LISENT RIEN
# ---------------------------------------------------------------------------


class TestNoOtherAudienceEverReachesTheStaffRegister:
    ALL_PATHS = (
        "departments/", "job-titles/", "holidays/", "schedule/",
        "employments/", "attendance/", "leaves/", "stats/attendance/",
        "me/", "me/attendance/", "me/leaves/",
    )

    def test_a_guardian_reads_nothing(self):
        scene = Scene()
        guardian_user, guardian = make_guardian_user()
        make_active_link(guardian, make_claimed_patient())
        for path in self.ALL_PATHS:
            response = client_for(guardian_user).get(f"{scene.base}/{path}")
            # 404 du mixin de centre : le tuteur n'a aucun membership, donc
            # ce centre n'existe pas pour lui (réponse IDOR déterministe).
            assert response.status_code == 404, path

    def test_a_patient_reads_nothing(self):
        scene = Scene()
        patient_user = make_user()
        make_claimed_patient(user=patient_user)
        for path in self.ALL_PATHS:
            assert client_for(patient_user).get(
                f"{scene.base}/{path}"
            ).status_code == 404, path

    def test_a_chioni_operator_reads_nothing_either(self):
        """Invariant du sprint S4, jamais entamé : l'exploitant gouverne le
        TENANT, il ne voit aucune donnée personnelle de ses gens."""
        scene = Scene()
        operator_user, _operator = make_platform_staff()
        for path in self.ALL_PATHS:
            assert client_for(operator_user).get(
                f"{scene.base}/{path}"
            ).status_code == 404, path

    def test_a_deactivated_member_loses_the_whole_module(self):
        scene = Scene()
        from apps.centers.services import deactivate_staff_member

        membership = scene.nurse.staff_memberships.get(center=scene.center)
        deactivate_staff_member(actor=scene.director, membership=membership)
        for path in ("schedule/", "me/", "me/leaves/", "departments/"):
            assert client_for(scene.nurse).get(
                f"{scene.base}/{path}"
            ).status_code == 404, path
