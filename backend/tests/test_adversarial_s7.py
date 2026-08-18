"""Revue adversariale du sprint S7 « HRM » (ADR 0020) — sondes pérennes.

Ce fichier est la trace exécutable de la passe guardian S7. Il garde en
régression les trois invariants du sprint et les quatre correctifs qu'il a
fallu poser :

1. **Le régime d'un congé ne fuit jamais vers un collègue** — le planning
   collectif, les payloads d'audit, le journal du directeur, les en-têtes de
   téléchargement, les codes HTTP et l'export RGPD sont passés au crible.
2. **Aucune donnée RH ne traverse les tenants** — y compris pour le MÊME
   humain employé des deux côtés, ce qui est l'aggravation nommée par
   l'ADR (comptes ombres partagés).
3. **Le RH n'empêche jamais un effacement RGPD** — et, correctif de cette
   revue, il ne le SABOTE plus non plus.

Les quatre correctifs verrouillés ici :

- **[Élevé] le justificatif survivait à l'anonymisation** avec, dans ses
  pixels, le nom de la personne et sa pathologie. L'invariant 7 de l'ADR
  promet un registre « orphelin d'identité » : c'était vrai de six tables
  sur sept. ``hrm.services.purge_leave_documents_of``, appelée par
  ``anonymize_user``, efface les OCTETS et garde la LIGNE.
- **[Moyen] le planning collectif servait n'importe quelle date passée** :
  365 requêtes et n'importe quel collègue reconstituait un relevé
  d'absentéisme nominatif — la surveillance que l'arbitrage PO n° 2 refuse
  d'inventer. Fenêtre de service bornée (``SCHEDULE_WINDOW_DAYS``).
- **[Moyen] deux écritures RH concurrentes rendaient un 500** (feuille de
  présence et dossier RH, prouvé à threads réels via l'API) : le verrou de
  l'emploi et un refus français ont remplacé l'``IntegrityError`` nue.
- **[Faible] le 201/200 de la feuille** était lu avant la transaction.

Les sondes structurelles de la fin FERMENT ce que les sondes livrées
laissaient entrouvert (import indirect de l'organigramme, alias sur la
garde de gel).
"""

import ast
import json
import pathlib
import threading
from datetime import timedelta
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing.models import CenterSubscription
from apps.centers.audit_views import (
    DIRECTOR_JOURNAL_ACTIONS,
    DIRECTOR_JOURNAL_EXCLUDED,
)
from apps.hrm import services
from apps.hrm.models import (
    AttendanceRecord,
    Employment,
    LeaveDocument,
    LeaveRequest,
)
from apps.hrm.views import SCHEDULE_WINDOW_DAYS

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
    make_employment,
    make_leave,
    make_platform_staff,
    make_staff,
    make_subscription,
    make_user,
)

pytestmark = pytest.mark.django_db

Presence = AttendanceRecord.Status
Status = LeaveRequest.Status
LeaveType = LeaveRequest.Type

APPS_ROOT = pathlib.Path(__file__).resolve().parents[1] / "apps"


# ---------------------------------------------------------------------------
# Décor
# ---------------------------------------------------------------------------


class Ward:
    """Un centre, son directeur, deux salariées — et leurs dossiers RH."""

    def __init__(self, name="Clinique Salama"):
        self.center, self.director = make_center_with_director(name=name)
        self.nurse_user = make_staff_user(self.center, role=Role.NURSE)
        self.cashier_user = make_staff_user(self.center, role=Role.CASHIER)
        self.nurse = make_employment(
            user=self.nurse_user, center=self.center,
            hired_at=timezone.localdate() - timedelta(days=900),
        )
        self.cashier = make_employment(
            user=self.cashier_user, center=self.center,
            hired_at=timezone.localdate() - timedelta(days=900),
        )

    @property
    def base(self):
        return f"/api/v1/centers/{self.center.pk}/hrm"

    def ask_leave(self, start, end, leave_type=LeaveType.ANNUAL, who=None):
        today = timezone.localdate()
        return services.request_leave(
            actor=who or self.nurse_user,
            employment=self.nurse if who is None else who,
            leave_type=leave_type,
            start_date=today + timedelta(days=start),
            end_date=today + timedelta(days=end),
        )


def _jpeg(name="certificat.jpg"):
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (80, 60), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def _run_concurrently(runners, timeout=25):
    """Deux gestes RÉELS, sur deux connexions RÉELLES, relâchés ensemble."""
    barrier = threading.Barrier(len(runners), timeout=15)
    outcomes = []

    def wrap(label, call):
        def runner():
            try:
                barrier.wait()
                outcomes.append((label, "ok", call()))
            except ValidationError as exc:
                outcomes.append((label, "refused", str(exc)))
            except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                outcomes.append((label, f"crash:{type(exc).__name__}", str(exc)))
            finally:
                connections.close_all()

        return runner

    threads = [
        threading.Thread(target=wrap(label, call)) for label, call in runners
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout)
    return outcomes


# ---------------------------------------------------------------------------
# 1 — LE CHEVAUCHEMENT : le seul invariant du module que la base ne tient pas
# ---------------------------------------------------------------------------


class TestTheOverlapGuardIsTheOnlyGuardWithoutTheDatabase:
    """L'ADR l'assume (addendum 3) : pas d'``ExclusionConstraint`` GiST,
    donc pas de ``btree_gist``. Le verrou de l'emploi est TOUT ce qui
    sépare une personne d'un double congé approuvé le même jour.
    """

    @pytest.mark.parametrize(
        "start,end,expected",
        [
            (5, 10, "refused"),    # bord jointif par le début
            (20, 25, "refused"),   # bord jointif par la fin
            (12, 14, "refused"),   # inclusion stricte
            (1, 30, "refused"),    # englobant
            (15, 15, "refused"),   # une seule journée, au milieu
            (10, 10, "refused"),   # une seule journée, sur le bord
            (5, 9, "ok"),          # disjoint d'un jour, avant
            (21, 25, "ok"),        # disjoint d'un jour, après
        ],
    )
    def test_every_shape_of_overlap_is_arbitrated_at_approval(
        self, start, end, expected
    ):
        ward = Ward()
        first = ward.ask_leave(10, 20)
        services.decide_leave(actor=ward.director, leave=first, approve=True)
        candidate = ward.ask_leave(start, end)
        if expected == "refused":
            with pytest.raises(ValidationError, match="deux fois le même jour"):
                services.decide_leave(
                    actor=ward.director, leave=candidate, approve=True
                )
            candidate.refresh_from_db()
            assert candidate.status == Status.REQUESTED
        else:
            services.decide_leave(
                actor=ward.director, leave=candidate, approve=True
            )
            candidate.refresh_from_db()
            assert candidate.status == Status.APPROVED

    @pytest.mark.django_db(transaction=True)
    def test_three_concurrent_approvals_of_three_overlapping_leaves(self):
        """Trois candidats, tous chevauchants, relâchés ensemble : le verrou
        de l'emploi doit en laisser passer EXACTEMENT un.

        La sonde livrée en testait deux ; trois ferme la porte au cas où le
        verrou ne sérialiserait que par paires (une garde relue hors verrou
        laisserait passer les deux perdants ensemble).
        """
        ward = Ward()
        leaves = [
            ward.ask_leave(10, 20),
            ward.ask_leave(15, 25),
            ward.ask_leave(18, 22),
        ]
        outcomes = _run_concurrently(
            [
                (
                    leave.pk,
                    (lambda captured: lambda: services.decide_leave(
                        actor=ward.director, leave=captured, approve=True
                    ))(leave),
                )
                for leave in leaves
            ]
        )
        crashes = [row for row in outcomes if str(row[1]).startswith("crash")]
        assert not crashes, f"Verrous croisés : {crashes}"
        assert sorted(kind for _, kind, _ in outcomes) == [
            "ok", "refused", "refused",
        ]
        assert LeaveRequest.objects.filter(
            employment=ward.nurse, status=Status.APPROVED
        ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_approving_while_the_person_withdraws_never_double_writes(self):
        """Approbation × retrait sur LA MÊME demande : un seul gagnant, et
        l'état final est toujours l'un des deux — jamais un hybride
        (``annule`` portant un ``decided_by`` de directeur, par exemple)."""
        ward = Ward()
        leave = ward.ask_leave(5, 8)
        outcomes = _run_concurrently(
            [
                ("approve", lambda: services.decide_leave(
                    actor=ward.director, leave=leave, approve=True
                )),
                ("cancel", lambda: services.cancel_leave(
                    actor=ward.nurse_user, leave=leave
                )),
            ]
        )
        assert not [row for row in outcomes if str(row[1]).startswith("crash")]
        assert sorted(kind for _, kind, _ in outcomes) == ["ok", "refused"]
        leave.refresh_from_db()
        assert leave.status in (Status.APPROVED, Status.CANCELLED)
        assert leave.decided_at is not None

    @pytest.mark.django_db(transaction=True)
    def test_a_cancellation_never_opens_a_window_for_a_second_approval(self):
        """Annuler la demande A pendant qu'on approuve la demande B qui la
        chevauche : rien d'illégal ne peut en sortir (une annulation ne rend
        pas un congé approuvé, donc au plus UN approuvé subsiste)."""
        ward = Ward()
        first = ward.ask_leave(10, 20)
        second = ward.ask_leave(15, 25)
        outcomes = _run_concurrently(
            [
                ("cancel-first", lambda: services.cancel_leave(
                    actor=ward.nurse_user, leave=first
                )),
                ("approve-second", lambda: services.decide_leave(
                    actor=ward.director, leave=second, approve=True
                )),
            ]
        )
        assert not [row for row in outcomes if str(row[1]).startswith("crash")]
        assert LeaveRequest.objects.filter(
            employment=ward.nurse, status=Status.APPROVED
        ).count() <= 1

    def test_no_api_route_can_move_the_dates_of_a_decided_leave(self):
        """La garde ne vaut que si les dates sont FIGÉES après l'approbation.

        Sonde structurelle : aucun sérialiseur d'écriture du module n'expose
        ``start_date``/``end_date`` ailleurs qu'à la création, et le module
        n'a aucune vue de modification de congé.
        """
        from apps.hrm import serializers as hrm_serializers
        from apps.hrm import views as hrm_views

        writable = {
            name: cls
            for name, cls in vars(hrm_serializers).items()
            if isinstance(cls, type)
            and name.endswith(("PatchSerializer", "WriteSerializer"))
        }
        for name, cls in writable.items():
            fields = set(getattr(cls, "_declared_fields", {}))
            assert not fields & {"start_date", "end_date", "leave_type"}, name
        # …et aucune vue du module ne sert PATCH/PUT/DELETE sur un congé.
        from rest_framework.views import APIView

        views = [
            (name, obj)
            for name, obj in vars(hrm_views).items()
            if isinstance(obj, type)
            and issubclass(obj, APIView)
            and "Leave" in name
        ]
        assert views, "Aucune vue de congé trouvée : la sonde ne teste rien."
        for name, view in views:
            for verb in ("put", "patch", "delete"):
                assert not hasattr(view, verb), f"{name}.{verb}"

    def test_what_a_raw_update_can_and_cannot_do_is_written_down(self):
        """Vigilance consignée par l'ADR (addendum 3), rendue EXÉCUTABLE.

        Ce que la base attrape déjà (``leave_decision_matches_status``) et
        ce qu'elle n'attrape pas : le jour où quelqu'un écrira un import de
        masse de congés, cette sonde lui dit exactement ce qu'il doit
        refaire lui-même.
        """
        from django.db import DatabaseError, transaction

        ward = Ward()
        approved = ward.ask_leave(10, 20)
        services.decide_leave(actor=ward.director, leave=approved, approve=True)

        # (a) rouvrir un congé décidé : la BASE refuse. Depuis le lot SV
        # (trigger ``hrm_leaverequest_decision_final``), le refus arrive
        # AVANT la contrainte ``leave_decision_matches_status`` — même
        # arbitre (PostgreSQL), classe d'erreur élargie.
        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                LeaveRequest.objects.filter(pk=approved.pk).update(
                    status=Status.REQUESTED
                )
        # (b) déplacer ses dates : la base ne dit RIEN — seul le service
        #     protège, et aucune route ne l'expose (sonde ci-dessus).
        moved = LeaveRequest.objects.filter(pk=approved.pk).update(
            start_date=timezone.localdate() + timedelta(days=100),
            end_date=timezone.localdate() + timedelta(days=110),
        )
        assert moved == 1, (
            "Si la base attrape désormais ce cas, la vigilance de l'ADR "
            "0020 addendum 3 est soldée : mettre à jour l'ADR."
        )


# ---------------------------------------------------------------------------
# 2 — LE RÉGIME NE FUIT JAMAIS VERS UN COLLÈGUE (invariant n° 1 du sprint)
# ---------------------------------------------------------------------------


class TestTheRegimeNeverReachesAColleague:
    """« Un module RH mal cloisonné, c'est un collègue qui apprend qu'un
    autre est en congé maladie. » On attaque tous les canaux à la fois."""

    def test_absent_and_conge_are_byte_identical_including_order_and_length(
        self,
    ):
        """Pas seulement le champ ``status`` : la RÉPONSE ENTIÈRE.

        Deux scènes jumelles, l'une où la personne est ``absent``, l'autre
        où elle est ``conge`` — même nombre de lignes, mêmes clés, même
        ordre, mêmes octets une fois l'identité neutralisée.
        """
        payloads = {}
        for label, status in (
            ("absent", Presence.ABSENT), ("conge", Presence.LEAVE)
        ):
            ward = Ward()
            colleague = make_staff_user(ward.center, role=Role.SECRETARY)
            day = timezone.localdate()
            services.record_attendance(
                actor=ward.director, employment=ward.nurse, date=day,
                status=status,
            )
            services.record_attendance(
                actor=ward.director, employment=ward.cashier, date=day,
                status=Presence.PRESENT,
            )
            rows = client_for(colleague).get(
                f"{ward.base}/schedule/?date={day}"
            ).data
            # L'identité change d'une scène à l'autre (factories) : on la
            # neutralise pour comparer ce qui reste — la STRUCTURE.
            payloads[label] = json.dumps(
                [
                    {**dict(row), "employment": None, "display_name": None}
                    for row in rows
                ],
                sort_keys=True,
            )
        assert payloads["absent"] == payloads["conge"], (
            "Le planning collectif distingue un congé d'une absence : "
            "« en congé » se lirait comme « pas malade », et l'absence non "
            "expliquée deviendrait un signal (ADR 0020 invariant 3)."
        )

    def test_no_query_parameter_of_the_schedule_separates_the_two(self):
        """Un filtre, un tri ou un compteur qui distinguerait les deux
        valeurs re-fabriquerait la fuite que la traduction ferme."""
        ward = Ward()
        colleague = make_staff_user(ward.center, role=Role.SECRETARY)
        day = timezone.localdate()
        services.record_attendance(
            actor=ward.director, employment=ward.nurse, date=day,
            status=Presence.LEAVE,
        )
        services.record_attendance(
            actor=ward.director, employment=ward.cashier, date=day,
            status=Presence.ABSENT,
        )
        reference = client_for(colleague).get(
            f"{ward.base}/schedule/?date={day}"
        ).data
        for probe in (
            "status=conge", "status=absent", "ordering=status",
            "employment=1", "search=conge", "leave_type=maladie",
            "fields=status", "expand=attendance",
        ):
            response = client_for(colleague).get(
                f"{ward.base}/schedule/?date={day}&{probe}"
            )
            assert response.status_code == 200, probe
            assert response.data == reference, (
                f"« ?{probe} » change le planning collectif : un paramètre "
                "de requête ne doit jamais rouvrir le régime."
            )

    def test_the_translation_table_covers_every_status_and_maps_none_to_conge(
        self,
    ):
        """Fail-closed : une valeur future de ``Status`` non traduite rend
        ``None`` (« non renseigné »), jamais le code brut."""
        from apps.hrm.serializers import PUBLIC_ATTENDANCE

        assert set(PUBLIC_ATTENDANCE) == set(AttendanceRecord.Status)
        assert "conge" not in set(PUBLIC_ATTENDANCE.values())
        assert PUBLIC_ATTENDANCE[Presence.LEAVE] == PUBLIC_ATTENDANCE[
            Presence.ABSENT
        ]

    def test_not_one_audit_payload_of_the_module_carries_a_leave_type(self):
        """On joue TOUT le module, puis on relit le journal immuable en
        entier — types, libellés de service, noms de fichier compris."""
        ward = Ward()
        department = services.create_department(
            actor=ward.director, center=ward.center, name="Oncologie"
        )
        job_title = services.create_job_title(
            actor=ward.director, center=ward.center, name="Sage-femme"
        )
        services.update_employment(
            actor=ward.director, employment=ward.nurse,
            department=department, job_title=job_title,
        )
        holiday = services.create_holiday(
            actor=ward.director, center=ward.center,
            date=timezone.localdate() + timedelta(days=15), name="Maulid",
        )
        services.delete_holiday(actor=ward.director, holiday=holiday)
        services.record_attendance(
            actor=ward.director, employment=ward.nurse,
            date=timezone.localdate(), status=Presence.LEAVE,
        )
        for leave_type in (
            LeaveType.SICK, LeaveType.MATERNITY, LeaveType.BEREAVEMENT
        ):
            leave = services.request_leave(
                actor=ward.nurse_user, employment=ward.nurse,
                leave_type=leave_type,
                start_date=timezone.localdate() + timedelta(days=200),
                end_date=timezone.localdate() + timedelta(days=201),
            )
            services.upload_leave_document(
                actor=ward.nurse_user, leave=leave,
                uploaded_file=_jpeg("certificat-oncologie.jpg"),
            )
            services.decide_leave(
                actor=ward.director, leave=leave, approve=False
            )
        cancelled = services.request_leave(
            actor=ward.nurse_user, employment=ward.nurse,
            leave_type=LeaveType.UNPAID,
            start_date=timezone.localdate() + timedelta(days=300),
            end_date=timezone.localdate() + timedelta(days=301),
        )
        services.cancel_leave(actor=ward.nurse_user, leave=cancelled)

        blob = json.dumps(
            list(AuditLog.objects.values_list("payload", flat=True))
        )
        for forbidden in (
            *LeaveRequest.Type.values, "Oncologie", "Sage-femme", "Maulid",
            "certificat", ".jpg",
        ):
            assert forbidden not in blob, forbidden

    def test_the_directors_journal_shows_the_decision_and_nothing_of_it(self):
        """Les cinq actions « personne » sont HORS liste blanche, et le
        journal rendu ne porte aucun régime."""
        ward = Ward()
        leave = services.request_leave(
            actor=ward.nurse_user, employment=ward.nurse,
            leave_type=LeaveType.BEREAVEMENT,
            start_date=timezone.localdate() + timedelta(days=2),
            end_date=timezone.localdate() + timedelta(days=3),
        )
        services.upload_leave_document(
            actor=ward.nurse_user, leave=leave, uploaded_file=_jpeg()
        )
        services.decide_leave(actor=ward.director, leave=leave, approve=True)
        services.record_attendance(
            actor=ward.director, employment=ward.nurse,
            date=timezone.localdate(), status=Presence.LEAVE,
        )
        body = json.dumps(
            client_for(ward.director).get(
                f"/api/v1/centers/{ward.center.pk}/audit-log/"
            ).data,
            default=str,
        )
        for forbidden in (
            "deuil", "attendance.recorded", "leave_document",
            "employment.created", "leave.cancelled",
        ):
            assert forbidden not in body, forbidden
        assert "leave.decided" in body
        for action in (
            AuditAction.ATTENDANCE_RECORDED,
            AuditAction.LEAVE_DOCUMENT_UPLOADED,
            AuditAction.LEAVE_DOCUMENT_ARCHIVED,
            AuditAction.EMPLOYMENT_CREATED,
            AuditAction.EMPLOYMENT_UPDATED,
            AuditAction.LEAVE_CANCELLED,
        ):
            assert action not in DIRECTOR_JOURNAL_ACTIONS, action
            assert action in DIRECTOR_JOURNAL_EXCLUDED, action

    def test_a_colleague_gets_the_same_403_whether_the_leave_exists_or_not(
        self,
    ):
        """Pas d'oracle par code HTTP : la permission tranche AVANT le
        queryset, donc un congé réel et un id fantôme sont indiscernables."""
        ward = Ward()
        colleague = make_staff_user(ward.center, role=Role.SECRETARY)
        leave = ward.ask_leave(3, 5, leave_type=LeaveType.SICK)
        real = client_for(colleague).get(f"{ward.base}/leaves/{leave.pk}/")
        ghost = client_for(colleague).get(f"{ward.base}/leaves/999999/")
        assert real.status_code == ghost.status_code == 403
        assert json.dumps(real.data, default=str) == json.dumps(
            ghost.data, default=str
        )

    def test_the_download_headers_say_nothing_of_the_person_or_her_illness(
        self,
    ):
        ward = Ward()
        leave = ward.ask_leave(3, 5, leave_type=LeaveType.SICK)
        document = services.upload_leave_document(
            actor=ward.nurse_user, leave=leave,
            uploaded_file=_jpeg("certificat-VIH-Mariama.jpg"),
        )
        response = client_for(ward.director).get(
            f"{ward.base}/leaves/{leave.pk}/documents/{document.pk}/download/"
        )
        assert response.status_code == 200
        blob = json.dumps(dict(response.headers))
        for forbidden in ("VIH", "Mariama", "certificat-", "maladie", "sick"):
            assert forbidden not in blob, forbidden
        assert response["Content-Disposition"] == (
            f'attachment; filename="justificatif-{document.pk}.jpg"'
        )
        assert response["X-Content-Type-Options"] == "nosniff"

    def test_the_rgpd_export_carries_the_callers_own_hr_file_only(self):
        """Sonde S7 mise à jour CONSCIEMMENT en SV (reliquat 17 soldé).

        L'export art. 20 emporte désormais le dossier RH — la sonde
        d'origine (« pas de clé RH ») a rempli son office : elle a forcé la
        re-vérification du périmètre au moment de l'ajout. Ce qu'elle
        verrouille maintenant : l'export ne dit que MES données. La
        présence du collègue (feuille remplie par le directeur, congé
        maladie du collègue) ne doit JAMAIS transiter dans l'export de
        l'infirmière — et réciproquement l'infirmière retrouve les siennes.
        """
        ward = Ward()
        services.record_attendance(
            actor=ward.director, employment=ward.nurse,
            date=timezone.localdate(), status=Presence.LEAVE,
        )
        my_leave = ward.ask_leave(3, 5, leave_type=LeaveType.SICK)
        response = client_for(ward.nurse_user).get("/api/v1/auth/me/export/")
        assert response.status_code == 200
        assert set(response.data) == {
            "account", "center_staff", "generated_at", "guardian", "patient",
            "platform_staff",
        }
        hr = response.data["center_staff"]["hr"]
        assert len(hr) == 1
        mine = hr[0]
        assert set(mine) == {
            "employment", "attendance", "leave_requests", "leave_documents",
        }
        assert [leave["id"] for leave in mine["leave_requests"]] == [
            my_leave.pk
        ]
        assert len(mine["attendance"]) == 1
        # Le DIRECTEUR, lui, n'a pas de dossier RH ici : son export ne
        # porte pas la feuille de l'infirmière ni son congé maladie.
        director_export = client_for(ward.director).get(
            "/api/v1/auth/me/export/"
        )
        assert director_export.status_code == 200
        assert director_export.data["center_staff"]["hr"] == []
        blob = json.dumps(director_export.data, default=str)
        for forbidden in ("maladie", "conge_maladie", "leave_type"):
            assert forbidden not in blob, forbidden


# ---------------------------------------------------------------------------
# 3 — LE PLANNING EST UN TABLEAU DE SERVICE, PAS UN RELEVÉ D'ABSENTÉISME
# ---------------------------------------------------------------------------


class TestTheCollectiveScheduleIsNotAnAbsenteeismRegister:
    """CORRECTIF [Moyen] de cette revue.

    Le régime ne fuitait pas, mais la route servait n'importe quelle date :
    365 requêtes (le throttle en autorise 600/min) et un collègue tenait,
    nom par nom, le compte des journées d'absence de tout le service.
    « Aider mieux, jamais surveiller » : la question à laquelle le planning
    répond est « qui est là aujourd'hui ? ».
    """

    def test_a_colleague_cannot_walk_the_year_backwards(self):
        ward = Ward()
        colleague = make_staff_user(ward.center, role=Role.SECRETARY)
        far = timezone.localdate() - timedelta(days=SCHEDULE_WINDOW_DAYS + 1)
        response = client_for(colleague).get(
            f"{ward.base}/schedule/?date={far}"
        )
        assert response.status_code == 400
        assert "date" in response.data
        assert "tableau de service" in str(response.data["date"])

    def test_the_service_window_itself_stays_open_in_both_directions(self):
        ward = Ward()
        colleague = make_staff_user(ward.center, role=Role.SECRETARY)
        for offset in (-SCHEDULE_WINDOW_DAYS, -7, 0, 7, SCHEDULE_WINDOW_DAYS):
            day = timezone.localdate() + timedelta(days=offset)
            response = client_for(colleague).get(
                f"{ward.base}/schedule/?date={day}"
            )
            assert response.status_code == 200, (offset, response.data)

    def test_the_person_keeps_her_own_full_history_and_so_does_the_director(
        self,
    ):
        """La borne ferme une surveillance, elle ne prend en otage aucune
        donnée : chacun garde SON historique, le directeur garde la feuille."""
        ward = Ward()
        old = timezone.localdate() - timedelta(days=200)
        services.record_attendance(
            actor=ward.director, employment=ward.nurse, date=old,
            status=Presence.LEAVE,
        )
        window = f"?from={old}&to={old}"
        mine = client_for(ward.nurse_user).get(
            f"{ward.base}/me/attendance/{window}"
        )
        assert mine.status_code == 200
        assert [row["status"] for row in mine.data["results"]] == ["conge"]
        sheet = client_for(ward.director).get(
            f"{ward.base}/attendance/{window}"
        )
        assert sheet.status_code == 200
        assert sheet.data["count"] == 1


# ---------------------------------------------------------------------------
# 4 — AUCUNE DONNÉE RH NE TRAVERSE LES TENANTS (invariant n° 2 du sprint)
# ---------------------------------------------------------------------------


class TestNoHrDatumEverCrossesTheTenant:
    """L'aggravation nommée par l'ADR : le compte est PARTAGÉ entre tenants,
    donc le même humain a deux dossiers RH, et aucun des deux directeurs ne
    doit voir celui de l'autre."""

    def _two_wards_one_human(self):
        a = Ward(name="Clinique A")
        b = Ward(name="Clinique B")
        human = make_user()
        make_staff(user=human, center=a.center, role=Role.NURSE)
        make_staff(user=human, center=b.center, role=Role.NURSE)
        emp_a = make_employment(user=human, center=a.center)
        emp_b = make_employment(user=human, center=b.center)
        return a, b, human, emp_a, emp_b

    def test_the_director_of_a_sees_nothing_the_director_of_b_recorded(self):
        a, b, human, emp_a, emp_b = self._two_wards_one_human()
        leave_b = make_leave(employment=emp_b, leave_type=LeaveType.MATERNITY)
        record_b = services.record_attendance(
            actor=b.director, employment=emp_b, date=timezone.localdate(),
            status=Presence.LEAVE,
        )
        document_b = services.upload_leave_document(
            actor=human, leave=leave_b, uploaded_file=_jpeg()
        )
        client = client_for(a.director)
        # …par URL : 404 déterministe, jamais un 403 qui confirmerait.
        for path in (
            f"employments/{emp_b.pk}/",
            f"leaves/{leave_b.pk}/",
            f"leaves/{leave_b.pk}/documents/",
            f"leaves/{leave_b.pk}/documents/{document_b.pk}/download/",
        ):
            assert client.get(f"{a.base}/{path}").status_code == 404, path
        # …par filtre : une page vide, aucun oracle.
        for path in (
            f"attendance/?employment={emp_b.pk}",
            f"leaves/?employment={emp_b.pk}",
        ):
            response = client.get(f"{a.base}/{path}")
            assert response.status_code == 200
            assert response.data["count"] == 0, path
        # …par les listes brutes et les statistiques.
        listing = json.dumps(client.get(f"{a.base}/employments/").data)
        assert str(emp_b.pk) not in [
            str(row["id"]) for row in json.loads(listing)
        ]
        stats = client.get(f"{a.base}/stats/attendance/").data
        assert all(
            row["employment"] != emp_b.pk for row in stats["by_employment"]
        )
        assert stats["totals"]["conge"] == 0
        assert AttendanceRecord.objects.for_center(a.center).filter(
            pk=record_b.pk
        ).count() == 0

    def test_the_person_herself_never_reads_center_b_through_center_a(self):
        a, b, human, emp_a, emp_b = self._two_wards_one_human()
        leave_b = make_leave(employment=emp_b, leave_type=LeaveType.SICK)
        services.record_attendance(
            actor=b.director, employment=emp_b, date=timezone.localdate(),
            status=Presence.LEAVE,
        )
        client = client_for(human)
        mine_in_a = client.get(f"{a.base}/me/").data
        assert mine_in_a["id"] == emp_a.pk
        assert mine_in_a["center"] == a.center.pk
        assert client.get(f"{a.base}/me/leaves/").data == []
        assert client.get(f"{a.base}/me/attendance/").data["count"] == 0
        assert client.post(
            f"{a.base}/me/leaves/{leave_b.pk}/cancel/"
        ).status_code == 404
        # …et depuis B, elle lit bien les siennes : la cloison n'est pas un
        # mur, c'est une frontière.
        assert client.get(f"{b.base}/me/attendance/").data["count"] == 1

    def test_an_organisation_label_never_travels_either(self):
        a, b, human, emp_a, emp_b = self._two_wards_one_human()
        foreign = services.create_department(
            actor=b.director, center=b.center, name="Maternité B"
        )
        response = client_for(a.director).patch(
            f"{a.base}/employments/{emp_a.pk}/",
            {"department": foreign.pk}, format="json",
        )
        assert response.status_code == 400
        assert "n'appartient pas à ce centre" in str(response.data)
        blob = str(client_for(a.director).get(f"{a.base}/departments/").data)
        assert "Maternité B" not in blob

    def test_a_director_cannot_open_a_file_for_someone_elses_staff(self):
        a, b, _human, _emp_a, _emp_b = self._two_wards_one_human()
        stranger = make_staff_user(b.center, role=Role.DOCTOR)
        response = client_for(a.director).post(
            f"{a.base}/employments/",
            {"user": stranger.pk, "hired_at": str(timezone.localdate())},
            format="json",
        )
        assert response.status_code == 400
        ghost = client_for(a.director).post(
            f"{a.base}/employments/",
            {"user": 999999, "hired_at": str(timezone.localdate())},
            format="json",
        )
        # Même message pour l'étranger et l'inexistant : pas d'oracle sur la
        # table des comptes (norme S1).
        assert json.dumps(response.data, default=str) == json.dumps(
            ghost.data, default=str
        )

    @pytest.mark.parametrize(
        "path",
        [
            "departments/", "job-titles/", "holidays/", "schedule/",
            "employments/", "attendance/", "leaves/", "stats/attendance/",
            "me/", "me/attendance/", "me/leaves/",
        ],
    )
    def test_the_other_three_hats_read_nothing_at_all(self, path):
        ward = Ward()
        patient = make_claimed_patient()
        guardian_user, guardian = make_guardian_user()
        make_active_link(guardian, patient)
        operator, _row = make_platform_staff()
        for user in (patient.user, guardian_user, operator):
            response = client_for(user).get(f"{ward.base}/{path}")
            assert response.status_code == 404, (path, user, response.data)


# ---------------------------------------------------------------------------
# 5 — RGPD : le registre survit ORPHELIN D'IDENTITÉ, la pièce ne survit pas
# ---------------------------------------------------------------------------


class TestErasureLeavesNoIdentityBehind:
    """CORRECTIF [Élevé] de cette revue.

    L'invariant 7 promet un registre « orphelin d'identité ». Il l'était de
    six tables sur sept : le justificatif — une PHOTO de certificat médical
    — restituait le nom de la personne, celui de son médecin et sa
    pathologie, téléchargeable pour toujours par le directeur suivant.
    Anonymiser effaçait l'avatar et laissait le certificat.
    """

    def _employee_with_a_certificate(self):
        ward = Ward()
        # Un second directeur : la garde « dernier directeur actif » de
        # l'effacement n'est pas le sujet de cette classe.
        make_staff(
            user=make_user(), center=ward.center, role=Role.DIRECTOR
        )
        leave = services.request_leave(
            actor=ward.nurse_user, employment=ward.nurse,
            leave_type=LeaveType.SICK,
            start_date=timezone.localdate() + timedelta(days=3),
            end_date=timezone.localdate() + timedelta(days=6),
        )
        document = services.upload_leave_document(
            actor=ward.nurse_user, leave=leave,
            uploaded_file=_jpeg("certificat-oncologie-Fatima.jpg"),
        )
        services.decide_leave(actor=ward.director, leave=leave, approve=True)
        services.record_attendance(
            actor=ward.director, employment=ward.nurse,
            date=timezone.localdate(), status=Presence.LEAVE,
        )
        return ward, leave, document

    def test_the_bytes_of_the_certificate_leave_with_the_identity(self):
        from apps.accounts.services import anonymize_user

        ward, leave, document = self._employee_with_a_certificate()
        storage, name = document.file.storage, document.file.name
        assert storage.exists(name)

        anonymize_user(actor=None, user=ward.nurse_user)

        document.refresh_from_db()
        assert not document.file, (
            "Le justificatif d'une personne anonymisée porte encore son nom "
            "et sa pathologie dans ses pixels."
        )
        assert not storage.exists(name)
        assert document.archived_at is not None

    def test_the_register_itself_survives_and_still_says_a_piece_existed(self):
        from apps.accounts.services import anonymize_user

        ward, leave, document = self._employee_with_a_certificate()
        anonymize_user(actor=None, user=ward.nurse_user)

        # Le REGISTRE (invariant 7) : rien n'a disparu.
        assert Employment.objects.filter(pk=ward.nurse.pk).exists()
        assert AttendanceRecord.objects.filter(employment=ward.nurse).exists()
        leave.refresh_from_db()
        assert leave.status == Status.APPROVED
        assert leave.leave_type == LeaveType.SICK
        assert LeaveDocument.objects.filter(pk=document.pk).exists()
        # …orphelin d'identité : plus un nom nulle part.
        row = client_for(ward.director).get(
            f"{ward.base}/employments/{ward.nurse.pk}/"
        ).data
        assert row["user_display_name"] == f"anon-{ward.nurse_user.pk}"

    def test_the_director_downloads_an_honest_404_not_a_500(self):
        from apps.accounts.services import anonymize_user

        ward, leave, document = self._employee_with_a_certificate()
        anonymize_user(actor=None, user=ward.nurse_user)

        response = client_for(ward.director).get(
            f"{ward.base}/leaves/{leave.pk}/documents/{document.pk}/download/"
        )
        assert response.status_code == 404
        assert "droit à l'effacement" in str(response.data["detail"])
        # …et la liste des congés ne prétend plus qu'une pièce est lisible.
        leaves = client_for(ward.director).get(f"{ward.base}/leaves/").data
        assert all(row["has_document"] is False for row in leaves["results"])

    def test_the_purge_is_idempotent_and_never_frozen(self):
        """Une seconde anonymisation ne casse rien, et un centre SUSPENDU
        n'empêche pas une personne d'exercer son droit — geler l'effacement
        serait prendre les droits d'un salarié en otage pour la facture
        impayée de son employeur."""
        from apps.accounts.services import anonymize_user

        ward, leave, document = self._employee_with_a_certificate()
        make_subscription(
            center=ward.center, status=CenterSubscription.Status.SUSPENDED
        )
        anonymize_user(actor=None, user=ward.nurse_user)
        anonymize_user(actor=None, user=ward.nurse_user)
        document.refresh_from_db()
        assert not document.file
        assert services.purge_leave_documents_of(
            actor=None, user=ward.nurse_user
        ) == 0
        assert "purge_leave_documents_of" not in services.FROZEN_WRITES

    def test_the_purge_never_touches_a_colleagues_certificate(self):
        from apps.accounts.services import anonymize_user

        ward, leave, document = self._employee_with_a_certificate()
        other_leave = services.request_leave(
            actor=ward.cashier_user, employment=ward.cashier,
            leave_type=LeaveType.BEREAVEMENT,
            start_date=timezone.localdate() + timedelta(days=3),
            end_date=timezone.localdate() + timedelta(days=4),
        )
        other_document = services.upload_leave_document(
            actor=ward.cashier_user, leave=other_leave, uploaded_file=_jpeg()
        )
        anonymize_user(actor=None, user=ward.nurse_user)
        other_document.refresh_from_db()
        assert other_document.file
        assert other_document.archived_at is None

    def test_no_hr_constraint_can_ever_block_a_deactivation(self):
        """``anonymize_user`` appelle ``deactivate_staff_member`` en boucle :
        s'il pouvait échouer sur une contrainte RH, un salarié serait
        empêché d'exercer son droit par un solde de congés."""
        from apps.centers.services import deactivate_staff_member

        ward, leave, _document = self._employee_with_a_certificate()
        for offset in range(1, 6):
            services.record_attendance(
                actor=ward.director, employment=ward.nurse,
                date=timezone.localdate() - timedelta(days=offset),
                status=Presence.PRESENT,
            )
        membership = ward.nurse_user.staff_memberships.get(center=ward.center)
        deactivate_staff_member(actor=ward.director, membership=membership)
        membership.refresh_from_db()
        assert membership.is_active is False

    def test_the_anonymisation_entry_counts_the_purge_without_naming_it(self):
        from apps.accounts.services import anonymize_user

        ward, _leave, _document = self._employee_with_a_certificate()
        anonymize_user(actor=None, user=ward.nurse_user)
        entry = AuditLog.objects.filter(
            action=AuditAction.USER_ANONYMIZED
        ).latest("id")
        assert entry.payload["leave_documents_purged"] == 1
        blob = json.dumps(entry.payload)
        for forbidden in ("Fatima", "oncologie", ".jpg", "maladie"):
            assert forbidden not in blob, forbidden


# ---------------------------------------------------------------------------
# 6 — DEUX MAINS À LA FOIS NE RENDENT JAMAIS UN 500
# ---------------------------------------------------------------------------


class TestTwoHandsAtOnceNeverAnswerA500:
    """CORRECTIF [Moyen] de cette revue.

    Chaque ``create_*`` du module lisait (« ce nom existe-t-il ? ») puis
    écrivait. Séquentiellement la lecture est la garde ; SIMULTANÉMENT les
    deux lecteurs ne voient rien et le perdant heurtait la contrainte —
    ``IntegrityError`` non traduite, donc 500 pour un directeur qui a
    simplement cliqué à la même seconde que son collègue. Et
    ``record_attendance`` posait son ``select_for_update`` sur une ligne qui
    n'existait pas encore : il ne verrouillait rien.
    """

    @staticmethod
    def _second_director(center):
        user = make_user()
        make_staff(user=user, center=center, role=Role.DIRECTOR)
        return user

    @pytest.mark.django_db(transaction=True)
    def test_two_responsables_ticking_the_same_day_through_the_api(self):
        """Cinq manches sur cinq journées : une course perdue une fois sur
        cinq est déjà un 500 en production, et une sonde qui ne la voit
        qu'une fois sur cinq ne protège personne."""
        ward = Ward()
        other = self._second_director(ward.center)

        for round_ in range(5):
            day = str(timezone.localdate() - timedelta(days=round_))

            def tick(actor, status, day=day):
                return lambda: client_for(actor).post(
                    f"{ward.base}/attendance/",
                    {
                        "employment": ward.nurse.pk, "date": day,
                        "status": status,
                    },
                    format="json",
                ).status_code

            outcomes = _run_concurrently(
                [
                    ("first", tick(ward.director, "present")),
                    ("second", tick(other, "absent")),
                ]
            )
            assert not [
                row for row in outcomes if str(row[1]).startswith("crash")
            ], f"Manche {round_} : la feuille rend un 500 — {outcomes}"
            codes = sorted(value for _, _, value in outcomes)
            assert codes == [200, 201], (round_, codes)
            assert AttendanceRecord.objects.filter(
                employment=ward.nurse, date=day
            ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_directors_opening_the_same_hr_file_through_the_api(self):
        ward = Ward()
        other = self._second_director(ward.center)
        newcomer = make_staff_user(ward.center, role=Role.DOCTOR)

        def open_file(actor, offset):
            return lambda: client_for(actor).post(
                f"{ward.base}/employments/",
                {
                    "user": newcomer.pk,
                    "hired_at": str(
                        timezone.localdate() - timedelta(days=offset)
                    ),
                },
                format="json",
            ).status_code

        outcomes = _run_concurrently(
            [
                ("first", open_file(ward.director, 10)),
                ("second", open_file(other, 20)),
            ]
        )
        assert not [row for row in outcomes if str(row[1]).startswith("crash")], (
            f"Une course d'ouverture de dossier rend un 500 : {outcomes}"
        )
        assert sorted(value for _, _, value in outcomes) == [201, 400]
        assert Employment.objects.filter(
            center=ward.center, user=newcomer
        ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_directors_declaring_the_same_service_and_the_same_holiday(
        self,
    ):
        ward = Ward()
        other = self._second_director(ward.center)
        day = str(timezone.localdate() + timedelta(days=40))

        for path, body in (
            ("departments/", {"name": "Maternité"}),
            ("job-titles/", {"name": "Sage-femme"}),
            ("holidays/", {"date": day, "name": "Maulid"}),
        ):
            outcomes = _run_concurrently(
                [
                    (
                        actor.pk,
                        (lambda who: lambda: client_for(who).post(
                            f"{ward.base}/{path}", body, format="json"
                        ).status_code)(actor),
                    )
                    for actor in (ward.director, other)
                ]
            )
            assert not [
                row for row in outcomes if str(row[1]).startswith("crash")
            ], f"{path} : {outcomes}"
            assert sorted(value for _, _, value in outcomes) == [201, 400], (
                path, outcomes,
            )


# ---------------------------------------------------------------------------
# 7 — LE GEL, VÉRIFIÉ AUTREMENT QUE PAR LA CONSTANTE
# ---------------------------------------------------------------------------


class TestTheFreezeMatchesRealityNotTheConstant:
    """``FROZEN_WRITES`` est de la documentation ; ceci est l'EXPÉRIENCE.

    On appelle les quatorze écritures du module sur un centre suspendu PUIS
    résilié, et on compare le résultat OBSERVÉ à la liste déclarée. Un jour
    où quelqu'un déplacerait la garde d'une fonction à l'autre en gardant la
    constante à jour, cette sonde le verrait ; l'inverse aussi.
    """

    @staticmethod
    def _play_every_write(state):
        ward = Ward()
        department = services.create_department(
            actor=ward.director, center=ward.center, name="Labo"
        )
        job_title = services.create_job_title(
            actor=ward.director, center=ward.center, name="Aide"
        )
        holiday = services.create_holiday(
            actor=ward.director, center=ward.center,
            date=timezone.localdate() + timedelta(days=10), name="Férié",
        )
        leave = ward.ask_leave(5, 8)
        document = services.upload_leave_document(
            actor=ward.nurse_user, leave=leave, uploaded_file=_jpeg()
        )
        make_subscription(center=ward.center, status=state)

        attempts = {
            "create_department": lambda: services.create_department(
                actor=ward.director, center=ward.center, name="Autre"),
            "update_department": lambda: services.update_department(
                actor=ward.director, department=department, name="Labo 2"),
            "create_job_title": lambda: services.create_job_title(
                actor=ward.director, center=ward.center, name="Aide 2"),
            "update_job_title": lambda: services.update_job_title(
                actor=ward.director, job_title=job_title, name="Aide 3"),
            "create_holiday": lambda: services.create_holiday(
                actor=ward.director, center=ward.center,
                date=timezone.localdate() + timedelta(days=20), name="G"),
            "delete_holiday": lambda: services.delete_holiday(
                actor=ward.director, holiday=holiday),
            "create_employment": lambda: services.create_employment(
                actor=ward.director, center=ward.center, user=ward.director,
                hired_at=timezone.localdate()),
            "update_employment": lambda: services.update_employment(
                actor=ward.director, employment=ward.nurse,
                hired_at=timezone.localdate() - timedelta(days=800)),
            "record_attendance": lambda: services.record_attendance(
                actor=ward.director, employment=ward.nurse,
                date=timezone.localdate(), status=Presence.PRESENT),
            "decide_leave": lambda: services.decide_leave(
                actor=ward.director, leave=leave, approve=True),
            "request_leave": lambda: ward.ask_leave(40, 42),
            "upload_leave_document": lambda: services.upload_leave_document(
                actor=ward.nurse_user, leave=leave, uploaded_file=_jpeg()),
            "archive_leave_document": lambda: services.archive_leave_document(
                actor=ward.nurse_user, document=document),
            "cancel_leave": lambda: services.cancel_leave(
                actor=ward.nurse_user, leave=leave),
        }
        frozen, open_ = set(), set()
        for name, call in attempts.items():
            try:
                call()
                open_.add(name)
            except ValidationError as exc:
                message = str(exc)
                if "abonnement Chioni" in message:
                    frozen.add(name)
                else:  # un refus métier n'est pas un gel
                    open_.add(name)
        return ward, frozen, open_

    @pytest.mark.parametrize(
        "state",
        [
            CenterSubscription.Status.SUSPENDED,
            CenterSubscription.Status.TERMINATED,
        ],
    )
    def test_the_observed_freeze_is_exactly_the_declared_one(self, state):
        _ward, frozen, open_ = self._play_every_write(state)
        assert frozen == set(services.FROZEN_WRITES), (
            "Le gel observé et FROZEN_WRITES divergent : "
            f"gelé={sorted(frozen)} / déclaré={sorted(services.FROZEN_WRITES)}"
        )
        assert open_ == {
            "request_leave", "cancel_leave",
            "upload_leave_document", "archive_leave_document",
        }

    @pytest.mark.parametrize(
        "state",
        [
            CenterSubscription.Status.SUSPENDED,
            CenterSubscription.Status.TERMINATED,
        ],
    )
    def test_every_read_stays_open_including_ones_own(self, state):
        """Arbitrage PO n° 3 : « on ne prend jamais en otage les données
        d'une personne ». Un centre résilié doit encore rendre à chacun ce
        qui est à lui."""
        ward, _frozen, _open = self._play_every_write(state)
        for actor, path in (
            (ward.nurse_user, "me/"),
            (ward.nurse_user, "me/attendance/"),
            (ward.nurse_user, "me/leaves/"),
            (ward.nurse_user, "schedule/"),
            (ward.nurse_user, "departments/"),
            (ward.director, "employments/"),
            (ward.director, "attendance/"),
            (ward.director, "leaves/"),
            (ward.director, "stats/attendance/"),
        ):
            response = client_for(actor).get(f"{ward.base}/{path}")
            assert response.status_code == 200, (path, response.data)

    def test_an_unpaid_center_freezes_nothing_of_the_module(self):
        ward = Ward()
        make_subscription(
            center=ward.center, status=CenterSubscription.Status.UNPAID
        )
        services.record_attendance(
            actor=ward.director, employment=ward.nurse,
            date=timezone.localdate(), status=Presence.PRESENT,
        )
        leave = ward.ask_leave(5, 8)
        services.decide_leave(actor=ward.director, leave=leave, approve=True)
        leave.refresh_from_db()
        assert leave.status == Status.APPROVED


# ---------------------------------------------------------------------------
# 8 — LE JUSTIFICATIF EST UN FICHIER PRIVÉ, ET IL LE RESTE
# ---------------------------------------------------------------------------


class TestThePrivateCertificate:
    def _document(self):
        ward = Ward()
        leave = ward.ask_leave(3, 6, leave_type=LeaveType.SICK)
        document = services.upload_leave_document(
            actor=ward.nurse_user, leave=leave, uploaded_file=_jpeg()
        )
        return ward, leave, document

    def test_it_has_no_url_at_all_and_never_rides_media(self):
        ward, _leave, document = self._document()
        with pytest.raises(ValueError):
            document.file.url
        response = APIClient().get(f"/media/{document.file.name}")
        assert response.status_code == 404
        assert not any(
            "url" in str(key).lower()
            for key in client_for(ward.director).get(
                f"{ward.base}/leaves/{_leave.pk}/documents/"
            ).data[0]
        )

    def test_the_four_wrong_readers_each_get_the_right_refusal(self):
        ward, leave, document = self._document()
        colleague = make_staff_user(ward.center, role=Role.SECRETARY)
        foreign = Ward(name="Clinique B")
        center_path = (
            f"{ward.base}/leaves/{leave.pk}/documents/{document.pk}/download/"
        )
        me_path = (
            f"{ward.base}/me/leaves/{leave.pk}/documents/{document.pk}/"
            "download/"
        )
        assert APIClient().get(center_path).status_code == 401
        assert APIClient().get(me_path).status_code == 401
        assert client_for(colleague).get(center_path).status_code == 403
        assert client_for(colleague).get(me_path).status_code == 404
        assert client_for(foreign.director).get(
            center_path.replace(str(ward.center.pk), str(foreign.center.pk))
        ).status_code == 404

    def test_a_pdf_and_an_svg_are_refused_by_the_content_not_the_extension(
        self,
    ):
        ward, leave, _document = self._document()
        payloads = {
            "certif.jpg": b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n",
            "certif.png": b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        }
        for name, blob in payloads.items():
            response = client_for(ward.nurse_user).post(
                f"{ward.base}/me/leaves/{leave.pk}/documents/",
                {"file": SimpleUploadedFile(
                    name, blob, content_type="image/jpeg"
                )},
                format="multipart",
            )
            assert response.status_code == 400, name

    def test_archiving_is_final_even_through_the_orm(self):
        ward, _leave, document = self._document()
        services.archive_leave_document(actor=ward.nurse_user, document=document)
        document.refresh_from_db()
        document.archived_at = None
        with pytest.raises(ValidationError, match="archivage est définitif"):
            document.save()


# ---------------------------------------------------------------------------
# 9 — SONDES STRUCTURELLES : ce que les sondes livrées laissaient entrouvert
# ---------------------------------------------------------------------------


class TestTheStructuralProbesAreActuallyClosed:
    """« Une fonction n'est pas un droit » (décision 2) et « le gel ne
    touche jamais le soin » (ADR 0018) reposent sur deux sondes ``ast``.
    Elles attrapent l'import DIRECT ; ces trois-ci ferment les portes de
    service que le lecteur pressé emprunterait à leur place.
    """

    @staticmethod
    def _outside_hrm():
        for path in APPS_ROOT.rglob("*.py"):
            relative = path.relative_to(APPS_ROOT).as_posix()
            if relative.startswith("hrm/"):
                continue
            yield relative, ast.parse(path.read_text(encoding="utf-8"))

    def test_the_org_chart_cannot_be_reached_by_a_module_alias_either(self):
        """``from apps.hrm import models`` passait la sonde livrée (le nom
        importé est « models », pas « Department ») et rendait
        ``models.Department`` disponible. La surface publique de l'app est
        ses SERVICES nommés — jamais son module de modèles."""
        offenders = {}
        for relative, tree in self._outside_hrm():
            for node in ast.walk(tree):
                if not isinstance(node, ast.ImportFrom):
                    continue
                if (node.module or "") != "apps.hrm":
                    continue
                smuggled = {
                    alias.name for alias in node.names
                } & {"models", "serializers", "views", "admin"}
                if smuggled:
                    offenders[relative] = sorted(smuggled)
        assert offenders == {}, (
            "Un module hors de apps/hrm importe un MODULE du RH plutôt que "
            f"ses services nommés : {offenders}"
        )

    def test_no_module_reaches_the_hr_models_through_the_app_registry(self):
        """``apps.get_model(\"hrm\", \"JobTitle\")`` est un import qui ne
        ressemble pas à un import : la sonde livrée ne le voit pas."""
        offenders = {}
        for relative, tree in self._outside_hrm():
            for node in ast.walk(tree):
                if not (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr == "get_model"
                ):
                    continue
                literals = [
                    arg.value.lower()
                    for arg in node.args
                    if isinstance(arg, ast.Constant)
                    and isinstance(arg.value, str)
                ]
                if any("hrm" in value for value in literals):
                    offenders[relative] = literals
        assert offenders == {}, offenders

    def test_the_freeze_caller_probe_cannot_be_dodged_by_an_alias(self):
        """La sonde S5 des appelants compare ``ast.Name.id`` à
        ``require_center_can_administer`` : un ``import … as _freeze`` lui
        échappait, et une écriture RH aurait pu être gelée sans figurer dans
        ``ALLOWED_HRM_CALLERS``. On refuse donc l'alias lui-même."""
        for relative, tree in self._outside_hrm():
            for node in ast.walk(tree):
                if not isinstance(node, ast.ImportFrom):
                    continue
                for alias in node.names:
                    if alias.name == "require_center_can_administer":
                        assert alias.asname is None, (
                            f"{relative} importe la garde de gel sous un "
                            "alias : la sonde des appelants ne la verrait "
                            "plus."
                        )
        source = (APPS_ROOT / "hrm" / "services.py").read_text(encoding="utf-8")
        for node in ast.walk(ast.parse(source)):
            if isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == "require_center_can_administer":
                        assert alias.asname is None

    def test_no_serializer_read_by_all_staff_carries_an_hr_field(self):
        """Corollaire de la décision 2, balayé sur TOUT le produit et pas
        seulement sur ``PractitionerSerializer``."""
        import importlib
        import pkgutil

        import apps

        hr_fields = {
            "job_title", "job_title_name", "department", "department_name",
            "hired_at", "ended_at", "employment", "leave_type",
        }
        offenders = {}
        for module_info in pkgutil.walk_packages(
            apps.__path__, prefix="apps."
        ):
            if not module_info.name.endswith("serializers"):
                continue
            if module_info.name.startswith("apps.hrm"):
                continue
            module = importlib.import_module(module_info.name)
            for name, cls in vars(module).items():
                meta = getattr(cls, "Meta", None)
                fields = getattr(meta, "fields", None)
                if not isinstance(fields, (list, tuple)):
                    continue
                clash = set(fields) & hr_fields
                if clash:
                    offenders[f"{module_info.name}.{name}"] = sorted(clash)
        assert offenders == {}, (
            "Un champ RH voyage dans un sérialiseur hors du module : une "
            f"fonction n'est pas un droit. {offenders}"
        )

    def test_not_one_hrm_route_lives_under_guardian_patient_or_platform(self):
        from django.urls import get_resolver

        for pattern in get_resolver().url_patterns:
            for route in getattr(pattern, "url_patterns", []):
                path = str(getattr(route, "pattern", ""))
                if "hrm" not in path:
                    continue
                assert not path.startswith(
                    ("guardian/", "patients/me/", "platform/")
                ), path
