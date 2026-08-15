"""HRM — modèles et services (S7, ADR 0020).

Ce que ce fichier verrouille, dans l'ordre des décisions de l'ADR :

1. **Le pivot est ``Employment``, jamais ``StaffMembership``** — une
   personne qui porte DEUX casquettes actives dans le même centre n'a
   qu'UN dossier RH, une feuille et un historique de congés.
2. **Une fonction n'est pas un droit** — sonde structurelle interdisant
   l'import de ``Department``/``JobTitle`` hors de ``apps.hrm``, et
   ``PractitionerSerializer`` (lu par tout le staff) sans champ RH.
3. **Cloisonnement absolu par centre** — aucune donnée RH sur ``User`` ; un
   directeur du centre A ne voit jamais ce que le centre B a saisi pour le
   même humain.
4. **Aucun motif libre sur un congé**, types fermés, justificatif = fichier
   PRIVÉ (jamais un texte, jamais une URL).
5. **Machine à états fermée**, transitions sérialisées, terminal définitif
   rejoué dans ``save()``.
6. **Chevauchement** : deux congés APPROUVÉS ne se chevauchent pas (garde
   sous verrou de l'emploi, + course à threads réels) ; deux DEMANDES le
   peuvent.
7. **Le gel** : ce qu'il ferme, ce qu'il laisse ouvert — et ``FROZEN_WRITES``
   comme documentation exécutable.
8. **``deactivate_staff_member`` n'échoue JAMAIS** à cause du RH :
   l'anonymisation RGPD l'appelle en boucle, et un salarié qui exerce son
   droit à l'effacement ne doit pas être bloqué par un solde de congés.
9. **L'audit ne porte jamais le TYPE d'un congé** (même classe qu'un
   diagnostic) ni un libellé de service ou de fonction.
"""

import ast
import pathlib
import threading
from datetime import timedelta
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, connections, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing.models import CenterSubscription
from apps.centers.services import deactivate_staff_member
from apps.hrm import services
from apps.hrm.models import (
    AttendanceRecord,
    Department,
    Employment,
    Holiday,
    JobTitle,
    LeaveDocument,
    LeaveRequest,
)
from apps.hrm.serializers import PUBLIC_ATTENDANCE

from .api_helpers import Role, make_center_with_director, make_staff_user
from .factories import (
    make_attendance,
    make_center,
    make_department,
    make_employment,
    make_job_title,
    make_leave,
    make_staff,
    make_subscription,
    make_user,
)

pytestmark = pytest.mark.django_db

Status = LeaveRequest.Status
LeaveType = LeaveRequest.Type
Presence = AttendanceRecord.Status


# ---------------------------------------------------------------------------
# Décor partagé
# ---------------------------------------------------------------------------


class Team:
    """Un centre, son directeur, une infirmière — et leurs dossiers RH."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.nurse_user = make_staff_user(self.center, role=Role.NURSE)
        self.department = services.create_department(
            actor=self.director, center=self.center, name="Maternité"
        )
        self.job_title = services.create_job_title(
            actor=self.director, center=self.center, name="Sage-femme"
        )
        self.nurse = services.create_employment(
            actor=self.director, center=self.center, user=self.nurse_user,
            hired_at=timezone.localdate() - timedelta(days=400),
            department=self.department, job_title=self.job_title,
        )

    def leave(self, days_from_now=7, length=4, **kwargs):
        start = timezone.localdate() + timedelta(days=days_from_now)
        kwargs.setdefault("leave_type", LeaveType.ANNUAL)
        return services.request_leave(
            actor=self.nurse_user, employment=self.nurse,
            start_date=start, end_date=start + timedelta(days=length),
            **kwargs,
        )


def _image_upload(name="certificat.jpg"):
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (120, 90), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


APPS_ROOT = pathlib.Path(__file__).resolve().parents[1] / "apps"


# ---------------------------------------------------------------------------
# 1 — LE PIVOT : (user, center), jamais le membership
# ---------------------------------------------------------------------------


class TestEmploymentIsThePivotNotTheMembership:
    """ADR 0020 décision 1 — le piège n° 1 du sprint, fermé par test.

    ``StaffMembership`` est unique par (user, center, RÔLE) : un médecin qui
    est aussi directeur a DEUX lignes actives dans le même centre. Un module
    de présence ancré dessus lui donnerait deux feuilles et deux soldes.
    """

    def test_two_active_hats_in_the_same_center_share_one_hr_file(self):
        center, director = make_center_with_director()
        # La MÊME personne prend une seconde casquette dans le MÊME centre.
        make_staff(user=director, center=center, role=Role.DOCTOR)
        assert director.staff_memberships.filter(
            center=center, is_active=True
        ).count() == 2

        employment = services.create_employment(
            actor=director, center=center, user=director,
            hired_at=timezone.localdate() - timedelta(days=30),
        )
        # Un seul dossier, et la base le garantit.
        with pytest.raises(ValidationError, match="déjà un dossier RH"):
            services.create_employment(
                actor=director, center=center, user=director,
                hired_at=timezone.localdate(),
            )
        assert Employment.objects.for_center(center).count() == 1

        services.record_attendance(
            actor=director, employment=employment,
            date=timezone.localdate(), status=Presence.PRESENT,
        )
        # Une feuille, pas deux : la personne n'est comptée qu'une fois.
        assert AttendanceRecord.objects.for_center(center).count() == 1

    def test_the_database_refuses_a_second_file_even_bypassing_the_service(self):
        center, director = make_center_with_director()
        make_employment(user=director, center=center)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Employment.objects.create(
                    user=director, center=center,
                    hired_at=timezone.localdate(),
                )

    def test_an_hr_file_survives_the_end_of_every_access(self):
        """« Un emploi peut survivre à la désactivation de tous les accès
        (une personne partie garde son registre), et c'est voulu. »"""
        team = Team()
        make_attendance(employment=team.nurse, date=timezone.localdate())
        membership = team.nurse_user.staff_memberships.get(center=team.center)
        deactivate_staff_member(actor=team.director, membership=membership)

        team.nurse.refresh_from_db()
        assert Employment.objects.filter(pk=team.nurse.pk).exists()
        assert AttendanceRecord.objects.for_center(team.center).count() == 1


# ---------------------------------------------------------------------------
# 2 — UNE FONCTION N'EST PAS UN DROIT (décision 2, invariant 2)
# ---------------------------------------------------------------------------


class TestAJobTitleIsNeverARight:
    """La décision la plus importante du sprint pour la sécurité.

    Confondre « fonction » et « rôle » créerait un second système de
    permissions à côté du premier — et c'est ainsi qu'un jour quelqu'un lit
    un dossier médical parce que sa fiche de poste dit « soignant ».
    """

    def test_no_module_outside_apps_hrm_imports_department_or_job_title(self):
        """Sonde STRUCTURELLE (``ast``), fail-closed.

        Elle échoue le jour où une classe de permission, un serializer de
        soin ou une vue de facturation apprend à lire un libellé
        d'organigramme — c'est-à-dire le jour où la frontière commence à
        se franchir.
        """
        offenders = {}
        for path in APPS_ROOT.rglob("*.py"):
            relative = path.relative_to(APPS_ROOT).as_posix()
            if relative.startswith("hrm/"):
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    if (node.module or "").startswith("apps.hrm"):
                        names = {alias.name for alias in node.names}
                        if names & {"Department", "JobTitle"}:
                            offenders[relative] = sorted(names)
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name.startswith("apps.hrm"):
                            offenders.setdefault(relative, []).append(alias.name)
        assert offenders == {}, (
            "Un module hors de apps/hrm lit l'organigramme : une fonction "
            "n'est pas un droit (ADR 0020, décision 2). "
            f"{offenders}"
        )

    def test_no_permission_class_of_the_product_reads_the_hr_models(self):
        """Le corollaire, lu depuis l'autre bout : le fichier qui DÉFINIT
        les casquettes ne connaît pas le module RH."""
        source = (APPS_ROOT / "common" / "permissions.py").read_text(
            encoding="utf-8"
        )
        assert "hrm" not in source
        roles = (APPS_ROOT / "common" / "roles.py").read_text(encoding="utf-8")
        assert "hrm" not in roles

    def test_the_practitioner_directory_gains_no_hr_field(self):
        """``PractitionerSerializer`` est lu par TOUT le staff : la fonction
        d'une personne n'a rien à y faire (corollaire de la décision 2)."""
        from apps.centers.serializers import PractitionerSerializer

        fields = set(PractitionerSerializer.Meta.fields)
        assert fields == {"id", "display_name", "role", "avatar"}
        for forbidden in (
            "job_title", "department", "hired_at", "employment", "ended_at",
        ):
            assert forbidden not in fields


# ---------------------------------------------------------------------------
# 3 — CLOISONNEMENT : rien sur ``User``, tout sur l'emploi
# ---------------------------------------------------------------------------


class TestNoHrDataLivesOnTheSharedAccount:
    def test_the_user_model_carries_no_hr_field(self):
        """Invariant n° 1 : le compte est PARTAGÉ entre tenants. Une date
        d'embauche ou un service dessus serait visible de tous les centres
        du même humain, par construction."""
        from django.contrib.auth import get_user_model

        names = {field.name for field in get_user_model()._meta.get_fields()}
        for forbidden in (
            "hired_at", "ended_at", "department", "job_title",
            "attendance_records", "leave_requests",
        ):
            assert forbidden not in names
        # Ce que le compte porte : des DOSSIERS, chacun avec son centre.
        assert "employments" in names

    def test_a_director_never_sees_what_another_center_recorded(self):
        """Le test que l'ADR appelle « l'aggravation qui menaçait la
        vigilance des comptes ombres partagés » : le MÊME humain, deux
        centres, deux dossiers étanches."""
        person = make_user()
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        make_staff(user=person, center=center_a, role=Role.NURSE)
        make_staff(user=person, center=center_b, role=Role.NURSE)

        file_a = services.create_employment(
            actor=director_a, center=center_a, user=person,
            hired_at=timezone.localdate() - timedelta(days=300),
        )
        file_b = services.create_employment(
            actor=director_b, center=center_b, user=person,
            hired_at=timezone.localdate() - timedelta(days=10),
        )
        services.record_attendance(
            actor=director_a, employment=file_a,
            date=timezone.localdate(), status=Presence.ABSENT,
        )
        services.request_leave(
            actor=person, employment=file_b, leave_type=LeaveType.SICK,
            start_date=timezone.localdate() + timedelta(days=2),
            end_date=timezone.localdate() + timedelta(days=3),
        )

        # Chaque directeur ne lit QUE son centre — au queryset, pas à l'écran.
        assert list(
            Employment.objects.for_center(center_a).values_list("pk", flat=True)
        ) == [file_a.pk]
        assert not AttendanceRecord.objects.for_center(center_b).exists()
        assert not LeaveRequest.objects.for_center(center_a).exists()
        assert file_a.hired_at != file_b.hired_at

    def test_an_organisation_label_never_crosses_the_tenant(self):
        center_a, director_a = make_center_with_director()
        center_b, _director_b = make_center_with_director()
        foreign = make_department(center=center_b, name="Laboratoire")
        person = make_user()
        make_staff(user=person, center=center_a, role=Role.NURSE)

        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            services.create_employment(
                actor=director_a, center=center_a, user=person,
                hired_at=timezone.localdate(), department=foreign,
            )

    def test_an_employment_can_only_be_opened_for_the_centers_own_staff(self):
        """Sans cette garde, l'endpoint deviendrait un oracle sur la table
        des utilisateurs (« cet id existe-t-il ? »)."""
        center, director = make_center_with_director()
        stranger = make_user()
        with pytest.raises(ValidationError, match="ne fait pas partie du personnel"):
            services.create_employment(
                actor=director, center=center, user=stranger,
                hired_at=timezone.localdate(),
            )


# ---------------------------------------------------------------------------
# 4 — LE PLANNING COLLECTIF NE DISTINGUE JAMAIS ``absent`` DE ``conge``
# ---------------------------------------------------------------------------


class TestTheCollectiveScheduleNeverTellsTheRegime:
    """Invariant n° 3, et l'arbitrage PO n° 1 dont il découle.

    « Sinon "en congé" se lirait comme "pas malade", et l'absence non
    expliquée deviendrait un signal. »
    """

    def test_leave_and_absence_are_byte_identical_for_colleagues(self):
        from apps.hrm.serializers import ScheduleRowSerializer

        day = timezone.localdate()
        center, director = make_center_with_director()
        on_leave_user = make_staff_user(center, role=Role.NURSE)
        absent_user = make_staff_user(center, role=Role.NURSE)
        on_leave = make_employment(user=on_leave_user, center=center)
        absent = make_employment(user=absent_user, center=center)
        make_attendance(employment=on_leave, date=day, status=Presence.LEAVE)
        make_attendance(employment=absent, date=day, status=Presence.ABSENT)

        rows = {
            row["employment"]: row
            for row in ScheduleRowSerializer(
                services.schedule_rows(center, day), many=True
            ).data
        }
        assert rows[on_leave.pk]["status"] == "absent"
        assert rows[absent.pk]["status"] == "absent"
        # …et rien d'autre ne les distingue : les deux payloads sont
        # identiques une fois le nom et l'id retirés.
        strip = lambda row: {  # noqa: E731
            k: v for k, v in row.items()
            if k not in ("employment", "display_name")
        }
        assert strip(rows[on_leave.pk]) == strip(rows[absent.pk])

    def test_the_public_payload_carries_no_regime_field_at_all(self):
        from apps.hrm.serializers import ScheduleRowSerializer

        day = timezone.localdate()
        team = Team()
        make_attendance(employment=team.nurse, date=day, status=Presence.LEAVE)
        (row,) = ScheduleRowSerializer(
            services.schedule_rows(team.center, day), many=True
        ).data
        assert set(row) == {"employment", "display_name", "job_title", "status"}
        for forbidden in ("leave_type", "leave", "raw_status", "hired_at"):
            assert forbidden not in row
        assert "conge" not in str(row)

    def test_the_translation_table_never_maps_anything_to_conge(self):
        """Documentation exécutable : ``conge`` n'est PAS une valeur
        publique du planning, et aucun statut ne peut y mener."""
        assert "conge" not in set(PUBLIC_ATTENDANCE.values())
        assert PUBLIC_ATTENDANCE[Presence.LEAVE] == "absent"
        # Tout statut du modèle est traduit : un ajout futur non traduit
        # rendrait ``None`` (« non renseigné ») plutôt que de fuir.
        assert set(PUBLIC_ATTENDANCE) == set(Presence.values)

    def test_an_unrecorded_day_says_nothing_rather_than_present(self):
        from apps.hrm.serializers import ScheduleRowSerializer

        team = Team()
        (row,) = ScheduleRowSerializer(
            services.schedule_rows(team.center, timezone.localdate()), many=True
        ).data
        assert row["status"] is None


# ---------------------------------------------------------------------------
# 5 — CONGÉS : types fermés, aucun motif, justificatif = fichier privé
# ---------------------------------------------------------------------------


class TestALeaveCarriesNoFreeText:
    def test_the_model_has_no_reason_field_of_any_kind(self):
        """Décision 4 : « le type suffit à décompter des droits, la phrase
        n'ajoute qu'un risque ». Le produit a des ``*_reason`` — mais ils
        sont écrits PAR un décideur POUR un décideur ; ici la personne
        concernée serait l'objet du texte."""
        names = {field.name for field in LeaveRequest._meta.get_fields()}
        for forbidden in (
            "reason", "motif", "comment", "note", "notes", "justification",
            "description", "refusal_reason", "decision_note",
        ):
            assert forbidden not in names

    def test_the_types_are_closed(self):
        team = Team()
        with pytest.raises(ValidationError, match="Type de congé inconnu"):
            services.request_leave(
                actor=team.nurse_user, employment=team.nurse,
                leave_type="burn-out sévère",
                start_date=timezone.localdate(),
                end_date=timezone.localdate(),
            )

    def test_a_supporting_document_is_a_private_file_with_no_url(self):
        team = Team()
        leave = team.leave(leave_type=LeaveType.SICK)
        document = services.upload_leave_document(
            actor=team.nurse_user, leave=leave, uploaded_file=_image_upload()
        )
        # Stockage privé : pas d'URL, jamais — le serializer qui tenterait
        # d'en publier une casserait bruyamment en revue.
        with pytest.raises(ValueError):
            document.file.url
        # Le nom d'origine (« certificat-oncologie.jpg ») ne survit pas :
        # nom uuid + extension déduite du format RÉEL (pipeline ADR 0014).
        assert "certificat" not in document.file.name
        assert document.file.name.endswith(".jpg")

    def test_a_pdf_or_a_script_is_refused_by_the_hardened_pipeline(self):
        team = Team()
        leave = team.leave(leave_type=LeaveType.SICK)
        for payload, name in (
            (b"%PDF-1.4 fake", "certificat.pdf"),
            (b"<svg onload=alert(1)></svg>", "certificat.svg"),
        ):
            with pytest.raises(ValidationError):
                services.upload_leave_document(
                    actor=team.nurse_user, leave=leave,
                    uploaded_file=SimpleUploadedFile(name, payload),
                )
        assert not LeaveDocument.objects.exists()

    def test_archiving_a_supporting_document_is_final(self):
        team = Team()
        leave = team.leave(leave_type=LeaveType.SICK)
        document = services.upload_leave_document(
            actor=team.nurse_user, leave=leave, uploaded_file=_image_upload()
        )
        services.archive_leave_document(actor=team.nurse_user, document=document)
        document.refresh_from_db()
        document.archived_at = None
        with pytest.raises(ValidationError, match="définitif"):
            document.save()

    def test_a_leave_on_a_holiday_is_allowed_and_never_recomputed(self):
        """« Congé sur un jour férié ou un repos : autorisé, non décompté —
        la feuille de présence fait foi » (décision 4)."""
        team = Team()
        start = timezone.localdate() + timedelta(days=7)
        Holiday.objects.create(
            center=team.center, date=start, name="Fête de l'Indépendance"
        )
        leave = services.request_leave(
            actor=team.nurse_user, employment=team.nurse,
            leave_type=LeaveType.ANNUAL, start_date=start,
            end_date=start + timedelta(days=2),
        )
        services.decide_leave(actor=team.director, leave=leave, approve=True)
        leave.refresh_from_db()
        assert leave.status == Status.APPROVED
        # Le service ne consulte JAMAIS le calendrier des fériés : 3 dates
        # civiles restent 3 dates civiles, la feuille tranchera.
        assert leave.days == 3


# ---------------------------------------------------------------------------
# 6 — MACHINE À ÉTATS ET CHEVAUCHEMENT
# ---------------------------------------------------------------------------


class TestTheLeaveStateMachineIsClosed:
    def test_the_three_exits_are_terminal(self):
        team = Team()
        for index, (target, act) in enumerate((
            (Status.APPROVED, lambda leave: services.decide_leave(
                actor=team.director, leave=leave, approve=True)),
            (Status.REFUSED, lambda leave: services.decide_leave(
                actor=team.director, leave=leave, approve=False)),
            (Status.CANCELLED, lambda leave: services.cancel_leave(
                actor=team.nurse_user, leave=leave)),
        )):
            # Fenêtres disjointes : la garde de chevauchement ne doit pas
            # se mêler de ce que ce test mesure (l'état terminal).
            leave = team.leave(days_from_now=30 * (index + 1))
            act(leave)
            leave.refresh_from_db()
            assert leave.status == target
            assert services.LEAVE_TRANSITIONS[target] == frozenset()
            with pytest.raises(ValidationError, match="Transition impossible"):
                services.decide_leave(
                    actor=team.director, leave=leave, approve=True
                )

    def test_a_terminal_state_is_replayed_in_save(self):
        """L'invariant ne vit pas que dans le service : un ``save()`` direct
        (shell, fixture, admin d'un futur distrait) est refusé aussi."""
        team = Team()
        leave = team.leave()
        services.decide_leave(actor=team.director, leave=leave, approve=False)
        leave.refresh_from_db()
        leave.status = Status.APPROVED
        with pytest.raises(ValidationError, match="close"):
            leave.save()

    def test_a_pending_request_never_carries_a_decision(self):
        team = Team()
        leave = team.leave()
        leave.decided_at = timezone.now()
        with pytest.raises(ValidationError, match="ne porte pas de décision"):
            leave.save()

    def test_the_database_refuses_an_incoherent_decision(self):
        team = Team()
        leave = team.leave()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LeaveRequest.objects.filter(pk=leave.pk).update(
                    status=Status.APPROVED
                )

    def test_an_end_before_the_start_is_refused_by_the_base_too(self):
        team = Team()
        with pytest.raises(ValidationError, match="précéder son début"):
            services.request_leave(
                actor=team.nurse_user, employment=team.nurse,
                leave_type=LeaveType.ANNUAL,
                start_date=timezone.localdate() + timedelta(days=5),
                end_date=timezone.localdate(),
            )
        # …et la BASE le refuse aussi : ``bulk_create`` contourne ``save()``
        # (c'est exactement le trou qu'un import de masse ouvrirait).
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LeaveRequest.objects.bulk_create([
                    LeaveRequest(
                        employment=team.nurse, leave_type=LeaveType.ANNUAL,
                        start_date=timezone.localdate() + timedelta(days=5),
                        end_date=timezone.localdate(),
                        status=Status.REQUESTED, requested_by=team.nurse_user,
                    )
                ])


class TestApprovedLeavesNeverOverlap:
    """Décision 4 : on tranche à l'APPROBATION, pas à la saisie."""

    def test_two_overlapping_requests_are_allowed(self):
        team = Team()
        first = team.leave(days_from_now=10, length=5)
        second = team.leave(days_from_now=12, length=5)
        assert first.status == second.status == Status.REQUESTED

    def test_the_second_approval_is_refused(self):
        team = Team()
        first = team.leave(days_from_now=10, length=5)
        second = team.leave(days_from_now=12, length=5)
        services.decide_leave(actor=team.director, leave=first, approve=True)
        with pytest.raises(ValidationError, match="deux fois le même jour"):
            services.decide_leave(actor=team.director, leave=second, approve=True)
        second.refresh_from_db()
        assert second.status == Status.REQUESTED
        # …mais la REFUSER reste possible : la garde borne l'approbation.
        services.decide_leave(actor=team.director, leave=second, approve=False)
        second.refresh_from_db()
        assert second.status == Status.REFUSED

    def test_adjacent_but_disjoint_ranges_are_both_approvable(self):
        team = Team()
        first = team.leave(days_from_now=10, length=4)   # J+10 → J+14
        second = team.leave(days_from_now=15, length=4)  # J+15 → J+19
        services.decide_leave(actor=team.director, leave=first, approve=True)
        services.decide_leave(actor=team.director, leave=second, approve=True)
        assert LeaveRequest.objects.filter(
            employment=team.nurse, status=Status.APPROVED
        ).count() == 2

    def test_a_cancelled_or_refused_leave_never_blocks_a_later_one(self):
        team = Team()
        first = team.leave(days_from_now=10, length=5)
        services.decide_leave(actor=team.director, leave=first, approve=False)
        second = team.leave(days_from_now=11, length=5)
        services.decide_leave(actor=team.director, leave=second, approve=True)
        second.refresh_from_db()
        assert second.status == Status.APPROVED

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_approvals_of_overlapping_leaves(self):
        """Course à THREADS RÉELS — la garde ne vaut que si elle tient sous
        le verrou de l'emploi (hiérarchie emploi → congé).

        Sans le ``select_for_update`` sur ``Employment``, les deux
        transactions lisent chacune un monde où l'autre congé n'est pas
        encore approuvé, et la personne se retrouve en congé deux fois le
        même jour.
        """
        team = Team()
        first = team.leave(days_from_now=10, length=5)
        second = team.leave(days_from_now=12, length=5)
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def approve(leave):
            def runner():
                try:
                    barrier.wait()
                    services.decide_leave(
                        actor=team.director, leave=leave, approve=True
                    )
                    outcomes.append(("ok", leave.pk))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                finally:
                    connections.close_all()

            return runner

        threads = [
            threading.Thread(target=approve(first)),
            threading.Thread(target=approve(second)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        (refusal,) = [msg for kind, msg in outcomes if kind == "refused"]
        assert "deux fois le même jour" in refusal
        assert LeaveRequest.objects.filter(
            employment=team.nurse, status=Status.APPROVED
        ).count() == 1

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_decisions_on_the_SAME_request(self):
        """Approuver et refuser en même temps : le perdant relit l'état du
        gagnant et reçoit un 400 français, jamais un écrasement."""
        team = Team()
        leave = team.leave()
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def decide(approve):
            def runner():
                try:
                    barrier.wait()
                    services.decide_leave(
                        actor=team.director, leave=leave, approve=approve
                    )
                    outcomes.append(("ok", approve))
                except ValidationError as exc:
                    outcomes.append(("refused", str(exc)))
                finally:
                    connections.close_all()

            return runner

        threads = [
            threading.Thread(target=decide(True)),
            threading.Thread(target=decide(False)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)

        assert sorted(kind for kind, _ in outcomes) == ["ok", "refused"]
        (refusal,) = [msg for kind, msg in outcomes if kind == "refused"]
        assert "Transition impossible" in refusal
        leave.refresh_from_db()
        assert leave.status in (Status.APPROVED, Status.REFUSED)


# ---------------------------------------------------------------------------
# 7 — LA FEUILLE DE PRÉSENCE (décision 3)
# ---------------------------------------------------------------------------


class TestTheAttendanceSheetDigitisesThePaperRegister:
    def test_the_model_has_no_clock_in_no_clock_out_no_location(self):
        """« Aucune surveillance qui n'existait pas avant » (arbitrage PO
        n° 2) : le registre papier note une JOURNÉE, pas des minutes."""
        names = {field.name for field in AttendanceRecord._meta.get_fields()}
        for forbidden in (
            "check_in", "check_out", "arrived_at", "left_at", "hours",
            "worked_minutes", "latitude", "longitude", "location", "device",
            "ip_address",
        ):
            assert forbidden not in names
        assert names >= {"employment", "date", "status", "noted_by"}

    def test_the_sheet_is_corrected_never_stacked(self):
        team = Team()
        day = timezone.localdate()
        services.record_attendance(
            actor=team.director, employment=team.nurse, date=day,
            status=Presence.ABSENT,
        )
        services.record_attendance(
            actor=team.director, employment=team.nurse, date=day,
            status=Presence.LEAVE,
        )
        rows = AttendanceRecord.objects.filter(employment=team.nurse, date=day)
        assert rows.count() == 1
        assert rows.get().status == Presence.LEAVE
        # Chaque correction est tracée (l'action reste hors du journal du
        # directeur — volumétrie et surveillance individuelle).
        assert AuditLog.objects.filter(
            action=AuditAction.ATTENDANCE_RECORDED
        ).count() == 2

    def test_a_future_day_is_refused(self):
        team = Team()
        with pytest.raises(ValidationError, match="pas de journée dans le futur"):
            services.record_attendance(
                actor=team.director, employment=team.nurse,
                date=timezone.localdate() + timedelta(days=1),
                status=Presence.PRESENT,
            )

    def test_a_day_outside_the_employment_period_is_refused_in_save(self):
        team = Team()
        newcomer = make_employment(
            user=make_staff_user(team.center, role=Role.SECRETARY),
            center=team.center,
            hired_at=timezone.localdate() - timedelta(days=10),
        )
        before_hire = newcomer.hired_at - timedelta(days=1)
        with pytest.raises(ValidationError, match="hors de la période d'emploi"):
            services.record_attendance(
                actor=team.director, employment=newcomer,
                date=before_hire, status=Presence.PRESENT,
            )
        # Rejoué dans ``save()`` : un ``create`` direct est refusé aussi.
        with pytest.raises(ValidationError):
            AttendanceRecord(
                employment=newcomer, date=before_hire,
                status=Presence.PRESENT, noted_by=team.director,
            ).save()

    def test_the_database_refuses_a_duplicate_day(self):
        team = Team()
        day = timezone.localdate()
        make_attendance(employment=team.nurse, date=day)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                AttendanceRecord.objects.create(
                    employment=team.nurse, date=day,
                    status=Presence.ABSENT, noted_by=team.director,
                )


# ---------------------------------------------------------------------------
# 8 — LE GEL (décision 7)
# ---------------------------------------------------------------------------


def _freeze(center):
    make_subscription(center=center, status=CenterSubscription.Status.SUSPENDED)


class TestTheFreezeClosesAdministrationAndNothingElse:
    def test_the_five_administrative_writes_are_frozen(self):
        team = Team()
        leave = team.leave()
        _freeze(team.center)
        frozen = [
            lambda: services.create_department(
                actor=team.director, center=team.center, name="Laboratoire"),
            lambda: services.create_job_title(
                actor=team.director, center=team.center, name="Laborantin"),
            lambda: services.create_holiday(
                actor=team.director, center=team.center,
                date=timezone.localdate(), name="Fête"),
            lambda: services.create_employment(
                actor=team.director, center=team.center, user=team.director,
                hired_at=timezone.localdate()),
            lambda: services.update_employment(
                actor=team.director, employment=team.nurse,
                ended_at=timezone.localdate()),
            lambda: services.record_attendance(
                actor=team.director, employment=team.nurse,
                date=timezone.localdate(), status=Presence.PRESENT),
            lambda: services.decide_leave(
                actor=team.director, leave=leave, approve=True),
        ]
        for call in frozen:
            with pytest.raises(ValidationError, match="abonnement Chioni"):
                call()

    def test_reading_ones_own_data_is_NEVER_frozen(self):
        """Arbitrage PO n° 3 : « on ne prend jamais en otage les données
        d'une personne »."""
        team = Team()
        make_attendance(employment=team.nurse, date=timezone.localdate())
        _freeze(team.center)
        assert AttendanceRecord.objects.for_user(team.nurse_user).count() == 1
        assert services.schedule_rows(team.center, timezone.localdate())
        assert services.attendance_summary(
            team.center, timezone.localdate() - timedelta(days=7),
            timezone.localdate(),
        )

    def test_the_persons_own_acts_stay_open_on_a_frozen_center(self):
        """Demander, retirer, justifier : refuser cela punirait un salarié
        pour la facture impayée de son employeur."""
        team = Team()
        _freeze(team.center)
        leave = team.leave(days_from_now=30)
        assert leave.status == Status.REQUESTED
        document = services.upload_leave_document(
            actor=team.nurse_user, leave=leave, uploaded_file=_image_upload()
        )
        services.archive_leave_document(
            actor=team.nurse_user, document=document
        )
        services.cancel_leave(actor=team.nurse_user, leave=leave)
        leave.refresh_from_db()
        assert leave.status == Status.CANCELLED

    def test_an_unpaid_center_freezes_nothing_at_all(self):
        """``impaye`` est une bannière et des relances, jamais un verrou
        (ADR 0018 décision 2, inchangée par S7)."""
        team = Team()
        make_subscription(
            center=team.center, status=CenterSubscription.Status.UNPAID
        )
        services.record_attendance(
            actor=team.director, employment=team.nurse,
            date=timezone.localdate(), status=Presence.PRESENT,
        )
        assert AttendanceRecord.objects.for_center(team.center).exists()

    def test_frozen_writes_is_executable_documentation(self):
        """``FROZEN_WRITES`` doit coïncider avec la réalité du module — et
        avec ``ALLOWED_HRM_CALLERS`` de la sonde S5, qui la relit depuis
        l'autre bout."""
        source = (APPS_ROOT / "hrm" / "services.py").read_text(encoding="utf-8")
        callers = {
            node.name
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.FunctionDef)
            and any(
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Name)
                and inner.func.id == "require_center_can_administer"
                for inner in ast.walk(node)
            )
        }
        assert callers == set(services.FROZEN_WRITES)


# ---------------------------------------------------------------------------
# 9 — RGPD : le droit à l'effacement n'est jamais bloqué par le RH
# ---------------------------------------------------------------------------


class TestErasureIsNeverBlockedByTheStaffRegister:
    """Le piège n° 2 du sprint, fermé par test de bout en bout.

    ``deactivate_staff_member`` est appelé EN BOUCLE par ``anonymize_user``.
    S'il pouvait échouer sur une contrainte RH (« ce membre a des congés en
    cours »), un salarié serait empêché d'exercer son droit à l'effacement
    par un solde de congés. La garantie est STRUCTURELLE : aucun modèle du
    module ne porte de FK vers ``StaffMembership``.
    """

    def test_no_hr_model_points_at_a_staff_membership(self):
        for model in (
            Department, JobTitle, Employment, Holiday, AttendanceRecord,
            LeaveRequest, LeaveDocument,
        ):
            targets = {
                field.related_model.__name__
                for field in model._meta.get_fields()
                if getattr(field, "related_model", None) is not None
            }
            assert "StaffMembership" not in targets, model.__name__

    def test_deactivation_succeeds_with_a_live_leave_and_a_full_sheet(self):
        team = Team()
        leave = team.leave()
        services.decide_leave(actor=team.director, leave=leave, approve=True)
        for offset in range(5):
            make_attendance(
                employment=team.nurse,
                date=timezone.localdate() - timedelta(days=offset),
            )
        membership = team.nurse_user.staff_memberships.get(center=team.center)
        deactivate_staff_member(actor=team.director, membership=membership)
        membership.refresh_from_db()
        assert membership.is_active is False

    def test_a_full_anonymisation_goes_through(self):
        """Le scénario réel : une salariée avec congé approuvé, feuille
        remplie et justificatif déposé exerce son droit à l'effacement."""
        from apps.accounts.services import anonymize_user

        team = Team()
        leave = team.leave(leave_type=LeaveType.SICK)
        services.upload_leave_document(
            actor=team.nurse_user, leave=leave, uploaded_file=_image_upload()
        )
        services.decide_leave(actor=team.director, leave=leave, approve=True)
        for offset in range(7):
            make_attendance(
                employment=team.nurse,
                date=timezone.localdate() - timedelta(days=offset),
            )

        anonymize_user(actor=None, user=team.nurse_user)

        team.nurse_user.refresh_from_db()
        assert team.nurse_user.anonymized_at is not None
        assert team.nurse_user.phone is None
        assert team.nurse_user.staff_memberships.filter(is_active=True).count() == 0

    def test_the_staff_register_SURVIVES_the_anonymisation(self):
        """Invariant n° 7, à lire comme une DÉCISION et non comme un oubli :
        « le registre du personnel survit, orphelin d'identité, comme le
        carnet médical — un centre a des obligations de conservation ».
        """
        from apps.accounts.services import anonymize_user

        team = Team()
        leave = team.leave()
        services.decide_leave(actor=team.director, leave=leave, approve=True)
        make_attendance(employment=team.nurse, date=timezone.localdate())

        anonymize_user(actor=None, user=team.nurse_user)

        assert Employment.objects.filter(pk=team.nurse.pk).exists()
        assert AttendanceRecord.objects.filter(employment=team.nurse).exists()
        assert LeaveRequest.objects.filter(pk=leave.pk).exists()
        # …orphelin d'IDENTITÉ : le dossier existe, la personne n'est plus
        # nommable (le compte est la seule source du nom, et il est vidé).
        team.nurse.refresh_from_db()
        assert team.nurse.user.first_name == ""
        assert team.nurse.user.last_name == ""


# ---------------------------------------------------------------------------
# 10 — L'AUDIT NE DIT JAMAIS LE RÉGIME
# ---------------------------------------------------------------------------


class TestTheAuditTrailNeverCarriesARegimeOrALabel:
    def test_no_leave_payload_carries_the_type(self):
        """Invariant n° 4 : « même classe qu'un diagnostic ». Le journal
        porte des ids et une DÉCISION, jamais le régime."""
        team = Team()
        leave = team.leave(leave_type=LeaveType.BEREAVEMENT)
        services.upload_leave_document(
            actor=team.nurse_user, leave=leave, uploaded_file=_image_upload()
        )
        services.decide_leave(actor=team.director, leave=leave, approve=True)

        entries = AuditLog.objects.filter(
            action__in=(
                AuditAction.LEAVE_REQUESTED,
                AuditAction.LEAVE_DECIDED,
                AuditAction.LEAVE_DOCUMENT_UPLOADED,
            )
        )
        assert entries.count() == 3
        for entry in entries:
            serialised = str(entry.payload)
            for forbidden in LeaveRequest.Type.values:
                assert forbidden not in serialised, entry.action
            assert "leave_type" not in entry.payload
            assert "certificat" not in serialised
        decision = entries.get(action=AuditAction.LEAVE_DECIDED)
        assert decision.payload["status"] == Status.APPROVED

    def test_no_configuration_payload_carries_a_label(self):
        team = Team()
        services.create_department(
            actor=team.director, center=team.center, name="Service VIH"
        )
        services.create_job_title(
            actor=team.director, center=team.center, name="Psychiatre"
        )
        services.create_holiday(
            actor=team.director, center=team.center,
            date=timezone.localdate(), name="Aïd el-Fitr",
        )
        for entry in AuditLog.objects.filter(
            action__in=(
                AuditAction.HRM_DEPARTMENT_CREATED,
                AuditAction.HRM_JOB_TITLE_CREATED,
                AuditAction.HOLIDAY_CREATED,
            )
        ):
            serialised = str(entry.payload)
            for forbidden in ("VIH", "Psychiatre", "Aïd"):
                assert forbidden not in serialised

    def test_every_hrm_action_carries_its_center(self):
        """Sans la colonne ``center``, le journal du directeur ne pourrait
        pas filtrer — et les actions RH d'un tenant seraient invisibles ou
        transverses (S4, ADR 0017 décision 5)."""
        team = Team()
        leave = team.leave()
        services.decide_leave(actor=team.director, leave=leave, approve=True)
        services.record_attendance(
            actor=team.director, employment=team.nurse,
            date=timezone.localdate(), status=Presence.PRESENT,
        )
        hrm_actions = {
            AuditAction.HRM_DEPARTMENT_CREATED, AuditAction.HRM_JOB_TITLE_CREATED,
            AuditAction.EMPLOYMENT_CREATED, AuditAction.LEAVE_REQUESTED,
            AuditAction.LEAVE_DECIDED, AuditAction.ATTENDANCE_RECORDED,
        }
        rows = AuditLog.objects.filter(action__in=hrm_actions)
        assert rows.count() == len(hrm_actions)
        for entry in rows:
            assert entry.center_id == team.center.pk, entry.action

    def test_deleting_a_holiday_is_traced_without_a_dangling_target(self):
        team = Team()
        holiday = services.create_holiday(
            actor=team.director, center=team.center,
            date=timezone.localdate(), name="Fête",
        )
        holiday_id = holiday.pk
        services.delete_holiday(actor=team.director, holiday=holiday)
        assert not Holiday.objects.filter(pk=holiday_id).exists()
        entry = AuditLog.objects.get(action=AuditAction.HOLIDAY_DELETED)
        assert entry.payload["holiday_id"] == holiday_id
        # Pas de ``target`` générique : un ``object_id`` pointant une ligne
        # supprimée serait une référence morte.
        assert not entry.object_id
        assert entry.content_type is None


class TestTheDirectorJournalSeesConfigurationOnly:
    def test_the_whitelist_and_the_exclusions_say_what_the_adr_says(self):
        from apps.centers.audit_views import (
            DIRECTOR_JOURNAL_ACTIONS,
            DIRECTOR_JOURNAL_EXCLUDED,
        )

        admitted = {
            AuditAction.HRM_DEPARTMENT_CREATED,
            AuditAction.HRM_DEPARTMENT_UPDATED,
            AuditAction.HRM_JOB_TITLE_CREATED,
            AuditAction.HRM_JOB_TITLE_UPDATED,
            AuditAction.HOLIDAY_CREATED,
            AuditAction.HOLIDAY_DELETED,
            AuditAction.LEAVE_REQUESTED,
            AuditAction.LEAVE_DECIDED,
        }
        excluded = {
            AuditAction.ATTENDANCE_RECORDED,
            AuditAction.EMPLOYMENT_CREATED,
            AuditAction.EMPLOYMENT_UPDATED,
            AuditAction.LEAVE_CANCELLED,
            AuditAction.LEAVE_DOCUMENT_UPLOADED,
            AuditAction.LEAVE_DOCUMENT_ARCHIVED,
        }
        assert admitted <= DIRECTOR_JOURNAL_ACTIONS
        assert excluded <= DIRECTOR_JOURNAL_EXCLUDED
        assert not (admitted & DIRECTOR_JOURNAL_EXCLUDED)
        assert not (excluded & DIRECTOR_JOURNAL_ACTIONS)
