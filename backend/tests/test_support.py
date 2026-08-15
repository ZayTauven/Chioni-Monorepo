"""S5 lot 3 (ADR 0018 décision 5) — le module Support centre → Chioni.

Ce fichier verrouille, dans cet ordre :

1. **LE point critique du lot** : le gel administratif ne s'applique PAS
   au support. Un centre suspendu pour impayé ouvre un ticket, répond et
   dépose une capture — c'est précisément le moment où il en a le plus
   besoin (« pourquoi suis-je gelé ? »). Le gabarit est celui de
   ``test_kyc_suspension_effects`` / ``test_subscription_effects`` : ce
   qui CONTINUE est écrit avant ce qui s'arrête ;
2. les permissions (ouverture par tout staff actif, lecture par l'auteur
   + le directeur, cloisonnement inter-centres en 404) ;
3. le risque résiduel de l'ADR, structuré : **aucun champ ne pointe un
   patient** (test structurel sur les trois modèles) et **le contenu
   n'entre jamais dans un payload d'audit** ;
4. l'append-only des messages, la machine à états (« fermé » définitif),
   les pièces jointes sur stockage privé (socle ADR 0014 tel quel).
"""

from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.billing.models import CenterSubscription
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS
from apps.common.models import AppendOnlyError
from apps.support.models import (
    SupportAttachment,
    SupportMessage,
    SupportTicket,
)
from apps.support.services import open_ticket, post_message, set_ticket_status

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import (
    make_center,
    make_plan,
    make_platform_staff,
    make_subscription,
    make_support_ticket,
    make_user,
)

pytestmark = pytest.mark.django_db

#: Exact payload of a ticket row on the TENANT side — no file, no url.
TICKET_FIELDS = {
    "id", "subject", "category", "status", "priority", "opened_by",
    "opened_by_display", "message_count", "attachment_count",
    "last_message_at", "closed_at", "created_at", "updated_at",
}
TICKET_DETAIL_FIELDS = TICKET_FIELDS | {"messages", "attachments"}

MESSAGE_FIELDS = {
    "id", "author", "author_side", "author_display", "body", "created_at"
}

ATTACHMENT_FIELDS = {"id", "uploaded_by", "created_at"}

#: Exact payload of a ticket on the PLATFORM side — the tenant, never a
#: person (the invariant of the fourth hat, ADR 0017 décision 1).
PLATFORM_TICKET_FIELDS = {
    "id", "center", "center_name", "subject", "category", "status",
    "priority", "opened_by", "message_count", "attachment_count",
    "last_message_at", "closed_at", "created_at", "updated_at",
}

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n"


def png_upload(name="capture.png"):
    buf = BytesIO()
    Image.new("RGB", (48, 48), "white").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def tickets_url(center, suffix=""):
    return f"/api/v1/centers/{center.pk}/support/tickets/{suffix}"


# ---------------------------------------------------------------------------
# 1 — LE POINT CRITIQUE : le gel n'atteint jamais le canal de support
# ---------------------------------------------------------------------------


class TestTheFreezeNeverClosesTheSupportChannel:
    """« Un centre suspendu pour impayé doit pouvoir ouvrir un ticket. »

    C'est le moment où il en a le PLUS besoin : le gel produit la question
    (« pourquoi suis-je gelé ? »), et fermer le canal qui y répond ferait
    une boucle sans sortie. ``require_center_can_administer`` n'est appelé
    nulle part dans ``apps.support`` — ce test est ce qui l'empêche d'y
    entrer un jour par copier-coller.
    """

    def _frozen_center(self, status):
        center, director = make_center_with_director()
        make_subscription(
            center=center, plan=make_plan(), status=status,
            status_reason="Facture A-000012 impayée depuis 60 jours.",
        )
        return center, director

    @pytest.mark.parametrize(
        "status",
        [CenterSubscription.Status.SUSPENDED, CenterSubscription.Status.TERMINATED],
    )
    def test_a_frozen_center_opens_a_ticket_answers_and_attaches(self, status):
        center, director = self._frozen_center(status)
        secretary = make_staff_user(center, role=Role.SECRETARY)
        client = client_for(secretary)

        opened = client.post(
            tickets_url(center),
            {
                "subject": "Pourquoi mon centre est-il gelé ?",
                "category": SupportTicket.Category.QUESTION,
                "body": "Le personnel et les tarifs sont bloqués depuis hier.",
            },
        )
        assert opened.status_code == 201, opened.data
        ticket_id = opened.data["id"]

        answered = client.post(
            tickets_url(center, f"{ticket_id}/messages/"),
            {"body": "Nous avons envoyé le virement lundi."},
        )
        assert answered.status_code == 201

        attached = client.post(
            tickets_url(center, f"{ticket_id}/attachments/"),
            {"file": png_upload()},
            format="multipart",
        )
        assert attached.status_code == 201

        assert client.get(tickets_url(center)).status_code == 200
        assert client.get(tickets_url(center, f"{ticket_id}/")).status_code == 200

    def test_the_contrast_the_freeze_really_is_wired_elsewhere(self):
        """Preuve que l'absence de garde côté support est une DÉCISION et
        pas un oubli : sur le MÊME centre, l'écriture administrative que
        l'ADR gèle répond bien 400."""
        center, director = self._frozen_center(
            CenterSubscription.Status.SUSPENDED
        )
        refused = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/",
            {"phone": "+2693390444", "role": Role.CASHIER},
        )
        assert refused.status_code == 400
        assert "abonnement" in str(refused.data).lower()

    def test_the_service_module_never_imports_the_freeze_guard(self):
        """Structurel : la garde ne doit pas pouvoir entrer par un import
        discret dans une future écriture de ce module."""
        from pathlib import Path

        source = Path(
            __import__("apps.support.services", fromlist=["x"]).__file__
        ).read_text(encoding="utf-8")
        import_lines = [
            line for line in source.splitlines()
            if line.startswith(("import ", "from "))
        ]
        assert not [
            line for line in import_lines if "require_center_can_administer" in line
        ]
        assert "require_center_can_administer(" not in source


# ---------------------------------------------------------------------------
# 2 — Qui ouvre, qui lit, qui répond
# ---------------------------------------------------------------------------


class TestWhoOpensAndWhoReads:
    def test_any_active_staff_opens_a_ticket(self):
        """« C'est la secrétaire qui rencontre le bug, pas le directeur. »"""
        center, _director = make_center_with_director()
        for role in (Role.SECRETARY, Role.CASHIER, Role.NURSE, Role.DOCTOR):
            user = make_staff_user(center, role=role)
            response = client_for(user).post(
                tickets_url(center),
                {"subject": f"Souci {role}", "category": "bug"},
            )
            assert response.status_code == 201, role

    def test_the_payload_is_exactly_the_contract(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            tickets_url(center),
            {"subject": "Écran blanc", "category": "bug", "body": "Bonjour."},
        )
        assert set(response.data) == TICKET_DETAIL_FIELDS
        assert set(response.data["messages"][0]) == MESSAGE_FIELDS
        assert response.data["message_count"] == 1

    def test_the_body_becomes_the_first_message(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            tickets_url(center),
            {"subject": "Écran blanc", "category": "bug",
             "body": "Rien ne s'affiche."},
        )
        (message,) = response.data["messages"]
        assert message["body"] == "Rien ne s'affiche."
        assert message["author_side"] == SupportMessage.Side.CENTER

    def test_a_ticket_without_body_opens_an_empty_thread(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            tickets_url(center), {"subject": "Question", "category": "question"}
        )
        assert response.data["messages"] == []
        assert response.data["message_count"] == 0

    def test_an_author_sees_their_own_tickets_only(self):
        center, _director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        cashier = make_staff_user(center, role=Role.CASHIER)
        mine = make_support_ticket(center=center, opened_by=secretary)
        theirs = make_support_ticket(center=center, opened_by=cashier)

        client = client_for(secretary)
        listed = client.get(tickets_url(center))
        assert [row["id"] for row in listed.data["results"]] == [mine.pk]
        # Le ticket du collègue est INVISIBLE, pas interdit : 404, norme S1.
        assert client.get(
            tickets_url(center, f"{theirs.pk}/")
        ).status_code == 404

    def test_the_director_sees_every_ticket_of_his_center(self):
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        ticket = make_support_ticket(center=center, opened_by=cashier)
        listed = client_for(director).get(tickets_url(center))
        assert [row["id"] for row in listed.data["results"]] == [ticket.pk]

    def test_a_neighbouring_center_sees_nothing(self):
        center, director = make_center_with_director()
        other, other_director = make_center_with_director(name="Clinique Voisine")
        ticket = make_support_ticket(center=center, opened_by=director)
        client = client_for(other_director)
        # Centre étranger dans l'URL → 404 (CenterScopedViewMixin).
        assert client.get(tickets_url(center)).status_code == 404
        # …et le ticket vu depuis SON propre centre n'existe pas non plus.
        assert client.get(
            tickets_url(other, f"{ticket.pk}/")
        ).status_code == 404

    def test_a_patient_and_a_guardian_have_no_support_channel(self):
        """Hors périmètre S5, assumé : le support est centre → Chioni."""
        center, _director = make_center_with_director()
        patient = make_claimed_patient()
        assert client_for(patient.user).get(
            tickets_url(center)
        ).status_code == 404
        assert client_for().get(tickets_url(center)).status_code == 401

    def test_a_deactivated_membership_closes_the_door(self):
        center, _director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        secretary.staff_memberships.update(is_active=False)
        assert client_for(secretary).get(
            tickets_url(center)
        ).status_code == 404

    def test_filters_refuse_an_unknown_value_per_field(self):
        center, director = make_center_with_director()
        client = client_for(director)
        assert client.get(
            tickets_url(center) + "?status=inconnu"
        ).status_code == 400
        assert client.get(
            tickets_url(center) + "?category=inconnu"
        ).status_code == 400
        assert client.get(
            tickets_url(center) + "?status=ouvert"
        ).status_code == 200


# ---------------------------------------------------------------------------
# 3 — Le fil : append-only, jamais réécrit
# ---------------------------------------------------------------------------


class TestTheThreadIsAppendOnly:
    def test_a_sent_message_cannot_be_rewritten(self):
        ticket = make_support_ticket()
        message = post_message(
            actor=ticket.opened_by, ticket=ticket, body="Bonjour",
            side=SupportMessage.Side.CENTER,
        )
        message.body = "Bonjour (corrigé)"
        with pytest.raises(AppendOnlyError):
            message.save()
        with pytest.raises(AppendOnlyError):
            SupportMessage.objects.filter(pk=message.pk).update(body="X")
        with pytest.raises(AppendOnlyError):
            message.delete()

    def test_an_empty_or_oversized_message_is_refused(self):
        ticket = make_support_ticket()
        with pytest.raises(ValidationError):
            post_message(
                actor=ticket.opened_by, ticket=ticket, body="   ",
                side=SupportMessage.Side.CENTER,
            )
        with pytest.raises(ValidationError):
            post_message(
                actor=ticket.opened_by, ticket=ticket, body="x" * 5001,
                side=SupportMessage.Side.CENTER,
            )

    def test_the_author_name_is_rendered_for_the_center_side_only(self):
        center, director = make_center_with_director()
        director.first_name, director.last_name = "Saïd", "Abdallah"
        director.save(update_fields=["first_name", "last_name"])
        operator, _op = make_platform_staff()
        operator.first_name = "Zaïnaba"
        operator.save(update_fields=["first_name"])
        ticket = make_support_ticket(center=center, opened_by=director)
        post_message(
            actor=director, ticket=ticket, body="Bonjour",
            side=SupportMessage.Side.CENTER,
        )
        post_message(
            actor=operator, ticket=ticket, body="Nous regardons",
            side=SupportMessage.Side.CHIONI,
        )
        response = client_for(director).get(
            tickets_url(center, f"{ticket.pk}/messages/")
        )
        centre, chioni = response.data
        assert centre["author_display"] == "Saïd Abdallah"
        # L'exploitant reste anonyme : l'interlocuteur du centre est
        # « Chioni », pas une personne (patron ``actor_display``).
        assert chioni["author_display"] is None
        assert "Zaïnaba" not in response.content.decode()

    def test_the_side_comes_from_the_door_not_from_the_client(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            tickets_url(center),
            {"subject": "X", "category": "bug", "body": "Y",
             "author_side": SupportMessage.Side.CHIONI},
        )
        assert response.data["messages"][0]["author_side"] == (
            SupportMessage.Side.CENTER
        )


# ---------------------------------------------------------------------------
# 4 — La machine à états (« fermé » est définitif)
# ---------------------------------------------------------------------------


class TestTheStateMachine:
    def test_the_legal_moves(self):
        operator, _op = make_platform_staff()
        ticket = make_support_ticket()
        for target in (
            SupportTicket.Status.IN_PROGRESS,
            SupportTicket.Status.RESOLVED,
            SupportTicket.Status.IN_PROGRESS,  # « ça ne marche toujours pas »
            SupportTicket.Status.CLOSED,
        ):
            set_ticket_status(actor=operator, ticket=ticket, status=target)
            ticket.refresh_from_db()
            assert ticket.status == target

    def test_closing_stamps_the_date_and_is_final(self):
        operator, _op = make_platform_staff()
        ticket = make_support_ticket()
        set_ticket_status(
            actor=operator, ticket=ticket, status=SupportTicket.Status.CLOSED
        )
        ticket.refresh_from_db()
        assert ticket.closed_at is not None
        with pytest.raises(ValidationError) as exc:
            set_ticket_status(
                actor=operator, ticket=ticket,
                status=SupportTicket.Status.OPEN,
            )
        assert "Transition refusée" in str(exc.value)

    def test_a_closed_ticket_refuses_messages_and_attachments(self):
        center, director = make_center_with_director()
        operator, _op = make_platform_staff()
        ticket = make_support_ticket(center=center, opened_by=director)
        set_ticket_status(
            actor=operator, ticket=ticket, status=SupportTicket.Status.CLOSED
        )
        client = client_for(director)
        refused = client.post(
            tickets_url(center, f"{ticket.pk}/messages/"), {"body": "Encore ?"}
        )
        assert refused.status_code == 400
        assert "fermé" in str(refused.data)
        assert client.post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        ).status_code == 400

    def test_a_resolved_ticket_still_accepts_a_message(self):
        """« Ça ne marche toujours pas » doit toujours avoir où atterrir —
        et poster ne déplace RIEN tout seul (pas de transition implicite)."""
        center, director = make_center_with_director()
        operator, _op = make_platform_staff()
        ticket = make_support_ticket(center=center, opened_by=director)
        set_ticket_status(
            actor=operator, ticket=ticket, status=SupportTicket.Status.RESOLVED
        )
        response = client_for(director).post(
            tickets_url(center, f"{ticket.pk}/messages/"),
            {"body": "Le problème est revenu ce matin."},
        )
        assert response.status_code == 201
        ticket.refresh_from_db()
        assert ticket.status == SupportTicket.Status.RESOLVED

    def test_the_same_status_and_an_unknown_one_are_refused(self):
        operator, _op = make_platform_staff()
        ticket = make_support_ticket()
        with pytest.raises(ValidationError):
            set_ticket_status(
                actor=operator, ticket=ticket, status=SupportTicket.Status.OPEN
            )
        with pytest.raises(ValidationError):
            set_ticket_status(actor=operator, ticket=ticket, status="inconnu")


# ---------------------------------------------------------------------------
# 5 — Pièces jointes : socle ADR 0014 tel quel, diffusion privée
# ---------------------------------------------------------------------------


class TestAttachments:
    def _ctx(self):
        center, director = make_center_with_director()
        ticket = make_support_ticket(center=center, opened_by=director)
        return center, director, ticket

    def test_a_screenshot_passes_and_a_pdf_does_not(self):
        center, director, ticket = self._ctx()
        client = client_for(director)
        ok = client.post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        )
        assert ok.status_code == 201
        assert set(ok.data) == ATTACHMENT_FIELDS
        refused = client.post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": SimpleUploadedFile(
                "trace.pdf", PDF_BYTES, content_type="application/pdf"
            )},
            format="multipart",
        )
        assert refused.status_code == 400
        assert "JPEG, PNG ou WebP" in str(refused.data)

    def test_the_file_has_no_public_url(self):
        center, director, ticket = self._ctx()
        client_for(director).post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        )
        attachment = SupportAttachment.objects.get()
        with pytest.raises(ValueError):
            attachment.file.url

    def test_the_download_is_neutral_and_nosniff(self):
        center, director, ticket = self._ctx()
        client = client_for(director)
        created = client.post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload("capture-tres-parlante.png")},
            format="multipart",
        )
        response = client.get(
            tickets_url(
                center,
                f"{ticket.pk}/attachments/{created.data['id']}/download/",
            )
        )
        assert response.status_code == 200
        assert response["X-Content-Type-Options"] == "nosniff"
        assert f"piece-{created.data['id']}.png" in response["Content-Disposition"]
        assert "capture-tres-parlante" not in response["Content-Disposition"]

    def test_a_colleagues_attachment_is_a_404(self):
        center, _director = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        cashier = make_staff_user(center, role=Role.CASHIER)
        ticket = make_support_ticket(center=center, opened_by=cashier)
        created = client_for(cashier).post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        )
        assert client_for(secretary).get(
            tickets_url(
                center,
                f"{ticket.pk}/attachments/{created.data['id']}/download/",
            )
        ).status_code == 404

    def test_the_upload_throttle_is_on_the_post_only(self):
        """Le pipeline Pillow est du CPU (vigilance vague 1) : le POST porte
        le scope STRICT ``uploads``, la lecture de la liste ne doit jamais
        s'affamer dessus."""
        from rest_framework.throttling import ScopedRateThrottle

        from apps.support.views import CenterSupportAttachmentView

        view = CenterSupportAttachmentView()
        view.request = type("R", (), {"method": "POST"})()
        assert isinstance(view.get_throttles()[0], ScopedRateThrottle)
        assert view.throttle_scope == "uploads"

        reader = CenterSupportAttachmentView()
        reader.request = type("R", (), {"method": "GET"})()
        assert not any(
            isinstance(t, ScopedRateThrottle) for t in reader.get_throttles()
        )


# ---------------------------------------------------------------------------
# 6 — Le risque résiduel, STRUCTURÉ (ADR 0018 décision 5, parades (a)/(b))
# ---------------------------------------------------------------------------


class TestNoStructuredPathToAPatient:
    """Parade (a) : « aucun champ structuré ne pointe un patient ».

    Un module de support n'est pas une porte d'accès au dossier. On ne
    prétend pas empêcher quelqu'un d'écrire un nom dans du texte libre
    (l'ADR le consigne comme risque assumé) — on garantit qu'AUCUNE
    relation ne relie un ticket à un patient, à une consultation ou à une
    donnée clinique. Le jour où un développeur ajoute
    ``patient = FK(PatientProfile)`` « pour aider le support », ce test
    rougit.
    """

    FORBIDDEN_MODELS = {
        "patients.PatientProfile", "patients.GuardianLink",
        "patients.GuardianProfile", "patients.PatientInsurance",
        "medical.Encounter", "medical.Prescription",
        "medical.HealthRecordEntry", "medical.VitalSigns",
        "medical.PatientDocument", "medical.PatientMedicalFile",
        "medical.Consent", "trustbridge.Invoice",
        "trustbridge.PaymentRequest",
    }

    @pytest.mark.parametrize(
        "model", [SupportTicket, SupportMessage, SupportAttachment]
    )
    def test_no_relation_reaches_the_carnet(self, model):
        for field in model._meta.get_fields():
            related = getattr(field, "related_model", None)
            if related is None:
                continue
            label = f"{related._meta.app_label}.{related.__name__}"
            assert label not in self.FORBIDDEN_MODELS, (model, field.name)

    @pytest.mark.parametrize(
        "model", [SupportTicket, SupportMessage, SupportAttachment]
    )
    def test_no_field_is_even_named_after_a_patient(self, model):
        names = [f.name.lower() for f in model._meta.get_fields()]
        assert not [n for n in names if "patient" in n], model

    def test_the_privacy_notice_is_exported_for_the_frontend(self):
        from apps.support.models import SUPPORT_PRIVACY_NOTICE

        assert "nom de patient" in SUPPORT_PRIVACY_NOTICE
        assert "information médicale" in SUPPORT_PRIVACY_NOTICE


class TestTheAuditNeverCarriesTheContent:
    """Parade (b) : « le contenu n'entre JAMAIS dans un payload d'audit ».

    Le journal est immuable (ORM + trigger PostgreSQL) et le directeur le
    lit : une donnée patient recopiée d'un ticket dans un payload y
    resterait pour toujours, hors de portée de toute correction.
    """

    SECRET_SUBJECT = "Le dossier de Mme Combo ne s'ouvre pas"
    SECRET_BODY = "Elle est diabétique, sa fiche plante à l'ouverture."

    def _scenario(self):
        center, director = make_center_with_director()
        operator, _op = make_platform_staff()
        ticket = open_ticket(
            actor=director, center=center, subject=self.SECRET_SUBJECT,
            category=SupportTicket.Category.BUG, body=self.SECRET_BODY,
        )
        post_message(
            actor=operator, ticket=ticket, body="Nous regardons ce dossier.",
            side=SupportMessage.Side.CHIONI,
        )
        set_ticket_status(
            actor=operator, ticket=ticket,
            status=SupportTicket.Status.IN_PROGRESS,
        )
        return center, director, ticket

    def test_no_payload_of_the_module_contains_a_single_word_of_it(self):
        self._scenario()
        entries = AuditLog.objects.filter(action__startswith="support_ticket.")
        # ouverture + premier message (le ``body``) + réponse Chioni + statut
        assert entries.count() == 4
        blob = "".join(str(entry.payload) for entry in entries)
        assert self.SECRET_SUBJECT not in blob
        assert self.SECRET_BODY not in blob
        assert "Combo" not in blob and "diabétique" not in blob
        assert "subject" not in blob and "body" not in blob

    def test_the_payloads_carry_references_and_codes_only(self):
        center, _director, ticket = self._scenario()
        opened = AuditLog.objects.get(action=AuditAction.SUPPORT_TICKET_OPENED)
        assert opened.payload == {
            "ticket_id": ticket.pk, "center_id": center.pk,
            "category": SupportTicket.Category.BUG,
            "priority": SupportTicket.Priority.NORMAL,
            "status": SupportTicket.Status.OPEN,
        }
        assert opened.center_id == center.pk
        changed = AuditLog.objects.get(
            action=AuditAction.SUPPORT_TICKET_STATUS_CHANGED
        )
        assert changed.payload["old_status"] == SupportTicket.Status.OPEN
        assert changed.payload["status"] == SupportTicket.Status.IN_PROGRESS

    def test_an_attachment_is_audited_without_its_file_name(self):
        center, director = make_center_with_director()
        ticket = make_support_ticket(center=center, opened_by=director)
        client_for(director).post(
            tickets_url(center, f"{ticket.pk}/attachments/"),
            {"file": png_upload("registre-de-mme-combo.png")},
            format="multipart",
        )
        entry = AuditLog.objects.get(
            action=AuditAction.SUPPORT_ATTACHMENT_UPLOADED
        )
        assert set(entry.payload) == {
            "attachment_id", "ticket_id", "center_id"
        }
        assert "combo" not in str(entry.payload).lower()

    def test_the_four_actions_are_in_the_directors_journal(self):
        """Invariant 6 de l'ADR : ajout CONSCIENT à la liste blanche — ce
        sont les demandes de SON centre, et il les voit sans le contenu."""
        for action in (
            AuditAction.SUPPORT_TICKET_OPENED,
            AuditAction.SUPPORT_TICKET_STATUS_CHANGED,
            AuditAction.SUPPORT_MESSAGE_POSTED,
            AuditAction.SUPPORT_ATTACHMENT_UPLOADED,
        ):
            assert action in DIRECTOR_JOURNAL_ACTIONS

    def test_the_director_reads_them_in_his_journal_without_the_content(self):
        center, director, _ticket = self._scenario()
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/?action="
            f"{AuditAction.SUPPORT_TICKET_OPENED}"
        )
        assert response.status_code == 200
        assert response.data["count"] == 1
        body = response.content.decode()
        assert self.SECRET_SUBJECT not in body and "Combo" not in body


# ---------------------------------------------------------------------------
# 7 — Côté plateforme : la file, les filtres, l'exception « support écrit »
# ---------------------------------------------------------------------------


class TestThePlatformQueue:
    def _ctx(self):
        center, director = make_center_with_director(name="Clinique Ylang")
        other, other_director = make_center_with_director(name="Polyclinique")
        operator, _op = make_platform_staff()
        mine = open_ticket(
            actor=director, center=center, subject="Tarifs vides",
            category=SupportTicket.Category.BUG,
        )
        theirs = open_ticket(
            actor=other_director, center=other,
            subject="Question de facturation",
            category=SupportTicket.Category.BILLING,
        )
        return center, other, operator, mine, theirs

    def test_the_queue_spans_every_tenant(self):
        _center, _other, operator, mine, theirs = self._ctx()
        response = client_for(operator).get("/api/v1/platform/support/tickets/")
        assert response.status_code == 200
        assert {row["id"] for row in response.data["results"]} == {
            mine.pk, theirs.pk
        }
        assert set(response.data["results"][0]) == PLATFORM_TICKET_FIELDS

    def test_the_filters(self):
        center, _other, operator, mine, theirs = self._ctx()
        client = client_for(operator)
        assert [
            row["id"] for row in
            client.get(
                f"/api/v1/platform/support/tickets/?center={center.pk}"
            ).data["results"]
        ] == [mine.pk]
        assert [
            row["id"] for row in
            client.get(
                "/api/v1/platform/support/tickets/?category=facturation"
            ).data["results"]
        ] == [theirs.pk]
        assert client.get(
            "/api/v1/platform/support/tickets/?open=true"
        ).data["count"] == 2
        for bad in ("status=inconnu", "category=inconnu", "center=abc",
                    "open=peut-etre"):
            assert client.get(
                f"/api/v1/platform/support/tickets/?{bad}"
            ).status_code == 400, bad

    def test_an_unknown_center_filter_is_an_empty_page_not_a_404(self):
        _center, _other, operator, _mine, _theirs = self._ctx()
        response = client_for(operator).get(
            "/api/v1/platform/support/tickets/?center=999999"
        )
        assert response.status_code == 200
        assert response.data["count"] == 0

    def test_the_detail_carries_the_thread_without_naming_anyone(self):
        _center, _other, operator, mine, _theirs = self._ctx()
        post_message(
            actor=mine.opened_by, ticket=mine, body="Bonjour",
            side=SupportMessage.Side.CENTER,
        )
        response = client_for(operator).get(
            f"/api/v1/platform/support/tickets/{mine.pk}/"
        )
        assert set(response.data) == PLATFORM_TICKET_FIELDS | {
            "messages", "attachments"
        }
        assert set(response.data["messages"][0]) == {
            "id", "author", "author_side", "body", "created_at"
        }

    def test_the_platform_downloads_an_attachment(self):
        center, _other, operator, mine, _theirs = self._ctx()
        created = client_for(mine.opened_by).post(
            tickets_url(center, f"{mine.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        )
        response = client_for(operator).get(
            f"/api/v1/platform/support/tickets/{mine.pk}/attachments/"
            f"{created.data['id']}/download/"
        )
        assert response.status_code == 200
        assert response["X-Content-Type-Options"] == "nosniff"

    def test_an_attachment_of_another_ticket_is_a_404(self):
        center, _other, operator, mine, theirs = self._ctx()
        created = client_for(mine.opened_by).post(
            tickets_url(center, f"{mine.pk}/attachments/"),
            {"file": png_upload()}, format="multipart",
        )
        assert client_for(operator).get(
            f"/api/v1/platform/support/tickets/{theirs.pk}/attachments/"
            f"{created.data['id']}/download/"
        ).status_code == 404

    def test_the_center_reads_the_chioni_answer(self):
        center, _other, operator, mine, _theirs = self._ctx()
        client_for(operator).post(
            f"/api/v1/platform/support/tickets/{mine.pk}/messages/",
            {"body": "Corrigé, merci de vérifier."},
        )
        response = client_for(mine.opened_by).get(
            tickets_url(center, f"{mine.pk}/")
        )
        (message,) = response.data["messages"]
        assert message["author_side"] == SupportMessage.Side.CHIONI
        assert message["body"] == "Corrigé, merci de vérifier."


class TestTheTenantNeverReachesTheBackOffice:
    def test_center_staff_and_patients_are_refused_on_the_platform_queue(self):
        center, director = make_center_with_director()
        patient = make_claimed_patient()
        for user in (director, patient.user):
            assert client_for(user).get(
                "/api/v1/platform/support/tickets/"
            ).status_code == 403

    def test_a_center_cannot_move_its_own_ticket_status(self):
        """Le triage est le geste de Chioni : aucune route tenant ne
        change le statut d'un ticket (le centre écrit, il ne classe pas)."""
        center, director = make_center_with_director()
        ticket = make_support_ticket(center=center, opened_by=director)
        assert client_for(director).post(
            f"/api/v1/platform/support/tickets/{ticket.pk}/status/",
            {"status": "resolu"},
        ).status_code == 403
