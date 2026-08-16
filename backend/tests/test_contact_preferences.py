"""Préférences de contact — S10 lot 1 (ADR 0023 décision 1).

La porte de sortie, construite AVANT les canaux. Ce fichier verrouille les
quatre choses qui font qu'un opt-out en est un :

1. la forme rendue est **complète et constante**, ligne ou pas ;
2. le guichet ne règle que les profils **non revendiqués** ;
3. le rappel J-1 est **réellement refusable** (câblage, pas déclaration) ;
4. l'opt-out **ne couvre jamais** un message de sécurité ou de consentement
   — c'est l'invariant du lot, et il a sa propre classe.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.patients.models import (
    CONTACT_PREFERENCE_FIELDS,
    GuardianLink,
    PatientContactPreference,
    patient_accepts,
)
from apps.patients.services import merge_profiles, update_patient_contact_preferences

from .api_helpers import (
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_appointment, make_patient, make_user

pytestmark = pytest.mark.django_db


def _center_and_patient():
    center, director = make_center_with_director()
    patient = make_patient(created_by_center=center)
    return center, director, patient


# ---------------------------------------------------------------------------
# 1 — La forme est complète et constante (patron PatientMedicalFile, S3)
# ---------------------------------------------------------------------------


class TestTheShapeIsConstant:
    def test_a_patient_with_no_row_reads_the_full_shape_with_defaults(self):
        user = make_user()
        make_claimed_patient(user=user)

        response = client_for(user).get("/api/v1/patients/me/contact-preferences/")

        assert response.status_code == 200
        assert set(response.data) == {*CONTACT_PREFERENCE_FIELDS, "updated_at"}
        assert response.data["appointment_reminders"] is True
        assert response.data["missed_appointment_followup"] is True
        # Honnête : « personne n'a encore réglé ceci » n'est pas « la
        # personne a accepté ».
        assert response.data["updated_at"] is None

    def test_reading_creates_nothing(self):
        user = make_user()
        profile = make_claimed_patient(user=user)

        client_for(user).get("/api/v1/patients/me/contact-preferences/")

        assert not PatientContactPreference.objects.filter(patient=profile).exists()

    def test_the_patient_switches_one_channel_off(self):
        user = make_user()
        profile = make_claimed_patient(user=user)

        response = client_for(user).patch(
            "/api/v1/patients/me/contact-preferences/",
            {"appointment_reminders": False},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["appointment_reminders"] is False
        # Le PATCH est PARTIEL : l'autre canal n'a pas bougé.
        assert response.data["missed_appointment_followup"] is True
        assert response.data["updated_at"] is not None
        assert patient_accepts(profile, "appointment_reminders") is False

    def test_an_unknown_preference_is_refused_400(self):
        user = make_user()
        make_claimed_patient(user=user)

        response = client_for(user).patch(
            "/api/v1/patients/me/contact-preferences/",
            {"marketing": False},
            format="json",
        )

        assert response.status_code == 400

    def test_an_unknown_preference_code_raises_rather_than_defaulting_true(self):
        """Une faute de frappe dans un appelant enverrait un SMS à
        quelqu'un qui l'a refusé : le helper lève."""
        profile = make_patient()

        with pytest.raises(ValueError):
            patient_accepts(profile, "appointment_reminder")  # sans le « s »

    def test_a_guardian_or_anonymous_never_reaches_the_patient_route(self):
        guardian_user, _profile = make_guardian_user()

        assert client_for(guardian_user).get(
            "/api/v1/patients/me/contact-preferences/"
        ).status_code == 403
        assert client_for().get(
            "/api/v1/patients/me/contact-preferences/"
        ).status_code == 401


# ---------------------------------------------------------------------------
# 2 — Le guichet : profil NON revendiqué seulement (même règle que S2)
# ---------------------------------------------------------------------------


class TestTheDeskDoor:
    def test_any_active_staff_reads_and_writes_an_unclaimed_profile(self):
        center, _director, patient = _center_and_patient()
        nurse = make_staff_user(center, role="infirmier")
        url = (
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
            "contact-preferences/"
        )

        assert client_for(nurse).get(url).status_code == 200
        response = client_for(nurse).put(
            url,
            {"appointment_reminders": False,
             "missed_appointment_followup": True},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["appointment_reminders"] is False

    def test_a_claimed_profile_is_refused_400_with_the_same_family_of_message(
        self,
    ):
        center, director, _patient = _center_and_patient()
        claimed = make_claimed_patient(created_by_center=center)
        url = (
            f"/api/v1/centers/{center.pk}/patients/{claimed.pk}/"
            "contact-preferences/"
        )

        response = client_for(director).put(
            url,
            {"appointment_reminders": False,
             "missed_appointment_followup": False},
            format="json",
        )

        assert response.status_code == 400
        assert "gère lui-même" in str(response.data)
        assert not PatientContactPreference.objects.filter(patient=claimed).exists()

    def test_reading_a_claimed_profile_stays_open(self):
        """Le guichet doit pouvoir RÉPONDRE à la personne au comptoir sans
        rien modifier — seule l'écriture est fermée."""
        center, director, _patient = _center_and_patient()
        claimed = make_claimed_patient(created_by_center=center)

        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/patients/{claimed.pk}/"
            "contact-preferences/"
        )

        assert response.status_code == 200

    def test_the_desk_put_requires_the_whole_form(self):
        center, director, patient = _center_and_patient()

        response = client_for(director).put(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
            "contact-preferences/",
            {"appointment_reminders": False},
            format="json",
        )

        assert response.status_code == 400

    def test_a_patient_of_another_center_is_404(self):
        center, director, _patient = _center_and_patient()
        other_center, _other_director = make_center_with_director()
        stranger = make_patient(created_by_center=other_center)

        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/patients/{stranger.pk}/"
            "contact-preferences/"
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# 3 — Le tuteur refuse LES RELANCES, jamais la notification initiale
# ---------------------------------------------------------------------------


class TestTheGuardianDoor:
    def test_the_guardian_switches_payment_reminders_off(self):
        user, profile = make_guardian_user()

        response = client_for(user).patch(
            "/api/v1/guardian/profile/", {"payment_reminders": False},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["payment_reminders"] is False
        profile.refresh_from_db()
        assert profile.payment_reminders is False

    def test_the_default_is_to_receive(self):
        _user, profile = make_guardian_user()
        assert profile.payment_reminders is True


# ---------------------------------------------------------------------------
# 4 — L'INVARIANT : l'opt-out ne couvre jamais sécurité ni consentement
# ---------------------------------------------------------------------------


class TestTheOptOutNeverCoversSecurityMessages:
    """ADR 0023 décision 1 — la liste des canaux refusables est FERMÉE.

    Se taire sur un OTP, sur « un proche demande à pouvoir payer vos
    soins » ou sur « votre soin a été payé » ne protégerait personne : ça
    retirerait à la personne l'information dont elle a besoin pour décider.
    """

    def test_the_refusable_list_is_exactly_two_channels(self):
        assert CONTACT_PREFERENCE_FIELDS == (
            "appointment_reminders", "missed_appointment_followup",
        )

    def test_only_the_refusable_events_consult_the_preference(self):
        """Sonde FAIL-CLOSED : la liste des fonctions de
        ``notifications.py`` qui consultent la porte de sortie est fermée.

        Un futur événement qui l'appellerait — l'OTP, l'invitation, la
        confirmation du titulaire — ferait échouer cette sonde AVANT
        d'atteindre la production. C'est la garde structurelle de
        l'invariant : l'énumération de scénarios ci-dessous prouve le
        comportement d'aujourd'hui, celle-ci ferme demain.
        """
        import ast
        import pathlib

        source = (
            pathlib.Path(__file__).resolve().parents[1]
            / "apps" / "common" / "notifications.py"
        ).read_text(encoding="utf-8")
        callers = {
            node.name
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.FunctionDef)
            and any(
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Name)
                and inner.func.id == "_patient_refused"
                for inner in ast.walk(node)
            )
        }
        assert callers == {
            "notify_appointment_reminder",
            "notify_missed_appointment_followup",
        }
        # …et les messages de sécurité/consentement n'y sont PAS.
        for protected in (
            "notify_guardian_invited",
            "notify_invitation_accepted",
            "notify_links_pending_confirmation",
            "notify_payment_request_sent",
            "notify_payment_received",
            "notify_receipt_issued",
        ):
            assert protected not in callers

    def test_a_patient_who_refused_everything_still_gets_the_consent_sms(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.common import notifications

        user = make_user(phone="+2693440111")
        profile = make_claimed_patient(user=user)
        for field in CONTACT_PREFERENCE_FIELDS:
            update_patient_contact_preferences(
                actor=user, patient=profile, **{field: False}
            )

        with django_capture_on_commit_callbacks(execute=True):
            notifications.notify_links_pending_confirmation(profile)

        assert [phone for phone, _msg in sms_outbox] == ["+2693440111"]

    def test_a_patient_who_refused_everything_still_learns_their_care_was_paid(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.common import notifications

        from .factories import make_invoice, make_payment_request

        user = make_user(phone="+2693440222")
        profile = make_claimed_patient(user=user)
        for field in CONTACT_PREFERENCE_FIELDS:
            update_patient_contact_preferences(
                actor=user, patient=profile, **{field: False}
            )
        center, _director = make_center_with_director()
        from .factories import make_encounter

        invoice = make_invoice(
            encounter=make_encounter(patient=profile, center=center)
        )
        request = make_payment_request(invoice=invoice)

        with django_capture_on_commit_callbacks(execute=True):
            notifications.notify_payment_received(request)

        assert [phone for phone, _msg in sms_outbox] == ["+2693440222"]


# ---------------------------------------------------------------------------
# 5 — Câblage réel du rappel J-1 (le canal qui n'était PAS refusable)
# ---------------------------------------------------------------------------


class TestTheJ1ReminderIsFinallyRefusable:
    def test_a_refusing_patient_gets_no_reminder_and_keeps_the_flag_null(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.scheduling.services import send_appointment_reminders

        center, _director = make_center_with_director()
        user = make_user(phone="+2693440333")
        profile = make_claimed_patient(user=user)
        update_patient_contact_preferences(
            actor=user, patient=profile, appointment_reminders=False
        )
        appointment = make_appointment(patient=profile, center=center)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_appointment_reminders() == 0

        assert sms_outbox == []
        appointment.refresh_from_db()
        # Le drapeau reste NULL : rouvrir le canal rend le RDV éligible.
        assert appointment.reminder_sent_at is None

    def test_an_accepting_patient_still_gets_it(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.scheduling.services import send_appointment_reminders

        center, _director = make_center_with_director()
        user = make_user(phone="+2693440444")
        profile = make_claimed_patient(user=user)
        make_appointment(patient=profile, center=center)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_appointment_reminders() == 1

        assert len(sms_outbox) == 1


# ---------------------------------------------------------------------------
# 6 — Audit : codes des préférences, jamais qui a lu
# ---------------------------------------------------------------------------


class TestTheAuditTrail:
    def test_a_write_is_audited_with_field_codes_only(self):
        center, director, patient = _center_and_patient()

        client_for(director).put(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
            "contact-preferences/",
            {"appointment_reminders": False,
             "missed_appointment_followup": False},
            format="json",
        )

        entry = AuditLog.objects.filter(
            action=AuditAction.PATIENT_CONTACT_PREFERENCES_UPDATED
        ).latest("id")
        assert entry.center_id == center.pk
        assert entry.payload["fields"] == (
            "appointment_reminders,missed_appointment_followup"
        )
        # Références only : ni valeur, ni nom.
        assert patient.last_name not in str(entry.payload)
        assert "True" not in str(entry.payload)

    def test_a_read_is_never_audited(self):
        center, director, patient = _center_and_patient()
        before = AuditLog.objects.count()

        client_for(director).get(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
            "contact-preferences/"
        )
        client_for(director).get(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/"
            "contact-preferences/"
        )

        assert AuditLog.objects.count() == before

    def test_the_action_stays_out_of_the_director_journal(self):
        from apps.centers.audit_views import (
            DIRECTOR_JOURNAL_ACTIONS,
            DIRECTOR_JOURNAL_EXCLUDED,
        )

        assert (
            AuditAction.PATIENT_CONTACT_PREFERENCES_UPDATED
            not in DIRECTOR_JOURNAL_ACTIONS
        )
        assert (
            AuditAction.PATIENT_CONTACT_PREFERENCES_UPDATED
            in DIRECTOR_JOURNAL_EXCLUDED
        )


# ---------------------------------------------------------------------------
# 7 — Fusion de doublons : un REFUS survit (combinaison par ET)
# ---------------------------------------------------------------------------


class TestARefusalSurvivesAMerge:
    def test_the_duplicates_refusal_tightens_the_target(self):
        center, director, target = _center_and_patient()
        source = make_patient(created_by_center=center, first_name="Mariama")
        update_patient_contact_preferences(
            actor=director, patient=source, appointment_reminders=False
        )
        update_patient_contact_preferences(
            actor=director, patient=target, appointment_reminders=True
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        assert patient_accepts(target, "appointment_reminders") is False

    def test_the_row_moves_when_the_target_has_none(self):
        center, director, target = _center_and_patient()
        source = make_patient(created_by_center=center)
        update_patient_contact_preferences(
            actor=director, patient=source, missed_appointment_followup=False
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        assert patient_accepts(target, "missed_appointment_followup") is False
        assert not PatientContactPreference.objects.filter(patient=source).exists()

    def test_a_merge_without_any_preference_row_is_a_no_op(self):
        center, director, target = _center_and_patient()
        source = make_patient(created_by_center=center)

        merge_profiles(source=source, target=target, actor=director, center=center)

        assert patient_accepts(target, "appointment_reminders") is True


# ---------------------------------------------------------------------------
# 8 — Cloisonnement : le service refuse un champ inconnu
# ---------------------------------------------------------------------------


class TestTheServiceGuards:
    def test_the_service_refuses_an_unknown_field(self):
        patient = make_patient()
        actor = make_user()

        with pytest.raises(ValidationError):
            update_patient_contact_preferences(
                actor=actor, patient=patient, newsletter=False
            )

    def test_a_guardian_link_is_never_needed_to_set_a_preference(self):
        """Une préférence appartient à la PERSONNE : aucun tuteur, aucun
        lien, aucun consentement n'entre dans l'équation."""
        patient = make_patient()
        actor = make_user()
        guardian_user, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        update_patient_contact_preferences(
            actor=actor, patient=patient, appointment_reminders=False
        )

        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE
        assert guardian_user.guardian_profile.payment_reminders is True
