"""Business SMS notifications (``apps/common/notifications.py``).

Contract under test, event by event:

- the SMS leaves for the RIGHT phone with the RIGHT text (exact equality);
- NEGATIVE content assertions (contrat guardian) : jamais de libellé
  d'acte, de motif ou de catégorie ; jamais de montant vers le patient ;
  jamais le nom du tuteur dans le SMS « attente de confirmation » ;
- a rolled-back transaction sends NOTHING (``transaction.on_commit``);
- a recipient without a phone is silently skipped (no error);
- a failing SMS backend never breaks the business operation;
- the OTP SMS flow keeps working (non-regression).

SMS backend: ``memory`` (fixture ``sms_outbox``). The test transaction
never commits, so ``on_commit`` callbacks are executed explicitly through
pytest-django's ``django_capture_on_commit_callbacks(execute=True)`` —
which also proves the on_commit contract: a service called OUTSIDE the
capture context delivers nothing.
"""

import logging
import re
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.centers.models import StaffMembership
from apps.common import notifications
from apps.common.models import ActCategory
from apps.medical.models import ActPerformed
from apps.patients.models import GuardianLink, GuardianProfile
from apps.patients.services import (
    accept_link,
    claim_profile,
    create_patient_at_center,
    create_protege,
    invite_guardian,
    merge_profiles,
    revoke_link,
)
from apps.trustbridge import services as tb
from apps.trustbridge.models import PaymentRequest

from .api_helpers import (
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_encounter, make_patient, make_tariff, make_user
from .trustbridge_helpers import SENSITIVE_LABEL, add_shared_guardian, build_scenario

pytestmark = pytest.mark.django_db

Status = PaymentRequest.Status

GUARDIAN_PHONE = "+2693440201"
PATIENT_PHONE = "+2693440202"


def make_user_without_phone(username):
    """A user with NO phone at all (staff-style account)."""
    return get_user_model().objects.create_user(
        username=username, password="test-password", phone=None
    )


def make_named_guardian(first_name="Nassim", phone=GUARDIAN_PHONE):
    """A guardian user + profile whose account carries a first name."""
    user = make_user(phone=phone)
    user.first_name = first_name
    user.save(update_fields=["first_name"])
    profile = GuardianProfile.objects.create(user=user)
    return user, profile


# ---------------------------------------------------------------------------
# Templates — global contract
# ---------------------------------------------------------------------------


class TestTemplates:
    def test_every_template_is_prefixed_chioni(self):
        for template in (
            notifications.SMS_GUARDIAN_INVITED,
            notifications.SMS_INVITATION_ACCEPTED,
            notifications.SMS_LINKS_PENDING_CONFIRMATION,
            notifications.SMS_PAYMENT_REQUEST_SENT,
            notifications.SMS_PAYMENT_RECEIVED,
            notifications.SMS_RECEIPT_ISSUED,
        ):
            assert template.startswith("Chioni : ")

    def test_realistic_messages_stay_under_160_characters(self):
        samples = [
            notifications.SMS_GUARDIAN_INVITED,
            notifications.SMS_INVITATION_ACCEPTED.format(
                guardian_first_name="Nassim Abdoulhalim"
            ),
            notifications.SMS_LINKS_PENDING_CONFIRMATION,
            notifications.SMS_PAYMENT_REQUEST_SENT.format(
                center="Centre Hospitalier El-Maarouf",
                amount_kmf="1 250 000",
                patient_first_name="Mariama",
            ),
            notifications.SMS_PAYMENT_RECEIVED,
            notifications.SMS_RECEIPT_ISSUED.format(
                receipt_number=90210, center="Centre Hospitalier El-Maarouf"
            ),
        ]
        for message in samples:
            assert len(message) < 160, message

    def test_format_kmf_groups_thousands(self):
        assert notifications.format_kmf("20000.00") == "20 000"
        assert notifications.format_kmf("7500") == "7 500"
        assert notifications.format_kmf("1250000") == "1 250 000"
        assert notifications.format_kmf("500") == "500"


# ---------------------------------------------------------------------------
# Événement 1 — invitation de tutelle envoyée
# ---------------------------------------------------------------------------


class TestGuardianInvitedSms:
    def _invite(self):
        patient = make_claimed_patient(first_name="Mariama", last_name="Ahamada")
        link = invite_guardian(
            actor=patient.user,
            patient=patient,
            phone=GUARDIAN_PHONE,
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        return patient, link

    def test_sms_reaches_the_invited_phone_with_the_exact_text(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            self._invite()
        assert sms_outbox == [(GUARDIAN_PHONE, notifications.SMS_GUARDIAN_INVITED)]

    def test_door_c_desk_creation_with_guardian_phone_notifies(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, director = make_center_with_director()
        with django_capture_on_commit_callbacks(execute=True):
            create_patient_at_center(
                actor=director,
                center=center,
                guardian_phone=GUARDIAN_PHONE,
                first_name="Mariama",
                last_name="Ahamada",
            )
        assert sms_outbox == [(GUARDIAN_PHONE, notifications.SMS_GUARDIAN_INVITED)]

    def test_the_invitation_names_nobody(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le numéro saisi peut être erroné : le SMS ne révèle ni le nom du
        patient ni celui de l'invitant."""
        with django_capture_on_commit_callbacks(execute=True):
            patient, _link = self._invite()
        message = sms_outbox[0][1]
        assert patient.first_name not in message
        assert patient.last_name not in message
        assert patient.user.username not in message

    def test_rollback_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(RuntimeError):
                with transaction.atomic():
                    self._invite()
                    raise RuntimeError("rollback métier")
        assert sms_outbox == []

    def test_nothing_leaves_before_commit(self, sms_outbox):
        """Le service programme l'envoi via on_commit : sans commit, rien
        ne part (la transaction de test ne committe jamais)."""
        self._invite()
        assert sms_outbox == []


# ---------------------------------------------------------------------------
# Événement 2 — invitation acceptée
# ---------------------------------------------------------------------------


class TestInvitationAcceptedSms:
    def _invited_link(self, patient=None, guardian_phone=GUARDIAN_PHONE):
        patient = patient or make_claimed_patient()
        link = invite_guardian(
            actor=patient.user,
            patient=patient,
            phone=guardian_phone,
            relationship=GuardianLink.Relationship.CHILD,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        return patient, link

    def test_patient_gets_the_guardian_first_name(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        guardian_user = make_user(phone=GUARDIAN_PHONE)
        guardian_user.first_name = "Nassim"
        guardian_user.save(update_fields=["first_name"])
        patient, link = self._invited_link()  # hors capture : rien ne part
        with django_capture_on_commit_callbacks(execute=True):
            accept_link(link=link, guardian_user=guardian_user)
        assert sms_outbox == [
            (patient.user.phone, "Chioni : Nassim a accepté votre invitation.")
        ]

    def test_shadow_guardian_without_first_name_falls_back(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        patient, link = self._invited_link()
        shadow_user = link.guardian.user  # compte ombre créé par l'invitation
        assert shadow_user.first_name == ""
        with django_capture_on_commit_callbacks(execute=True):
            accept_link(link=link, guardian_user=shadow_user)
        assert sms_outbox == [
            (patient.user.phone, "Chioni : votre proche a accepté votre invitation.")
        ]

    def test_unclaimed_patient_uses_the_declarative_phone(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Porte C : le profil guichet n'est pas revendiqué — le SMS part
        vers le téléphone déclaratif du profil."""
        center, director = make_center_with_director()
        profile, link = create_patient_at_center(
            actor=director,
            center=center,
            guardian_phone=GUARDIAN_PHONE,
            first_name="Mariama",
            last_name="Ahamada",
            phone=PATIENT_PHONE,
        )
        with django_capture_on_commit_callbacks(execute=True):
            accept_link(link=link, guardian_user=link.guardian.user)
        assert sms_outbox == [
            (PATIENT_PHONE, "Chioni : votre proche a accepté votre invitation.")
        ]

    def test_patient_without_any_phone_is_silently_skipped(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        owner = make_user_without_phone("patient-sans-tel")
        patient = make_claimed_patient(user=owner)  # profile.phone reste vide
        _, link = self._invited_link(patient=patient)
        with django_capture_on_commit_callbacks(execute=True):
            accept_link(link=link, guardian_user=link.guardian.user)
        assert sms_outbox == []
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE  # l'opération a réussi


# ---------------------------------------------------------------------------
# Événement 3 — lien(s) en attente de confirmation du titulaire
# ---------------------------------------------------------------------------


class TestPendingConfirmationSms:
    def _door_a_profile(self):
        guardian_user, _profile = make_named_guardian(first_name="Nassim")
        profile, link = create_protege(
            guardian_user=guardian_user,
            relationship=GuardianLink.Relationship.PARENT,
            first_name="Mariama",
            last_name="Ahamada",
            phone=PATIENT_PHONE,
        )
        return guardian_user, profile, link

    def test_claim_sends_one_generic_sms_to_the_patient(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        _guardian_user, profile, _link = self._door_a_profile()
        claimant = make_user(phone=PATIENT_PHONE)
        with django_capture_on_commit_callbacks(execute=True):
            claim_profile(user=claimant, profile=profile)
        assert sms_outbox == [
            (PATIENT_PHONE, notifications.SMS_LINKS_PENDING_CONFIRMATION)
        ]

    def test_the_sms_never_names_the_guardian(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Un SMS se lit par-dessus l'épaule : le tuteur demandeur n'y
        figure jamais — l'app donne le détail après connexion."""
        guardian_user, profile, _link = self._door_a_profile()
        claimant = make_user(phone=PATIENT_PHONE)
        with django_capture_on_commit_callbacks(execute=True):
            claim_profile(user=claimant, profile=profile)
        message = sms_outbox[0][1]
        assert "Nassim" not in message
        assert guardian_user.username not in message
        assert guardian_user.phone not in message

    def test_one_single_sms_even_with_several_suspended_links(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        _guardian_user, profile, _link = self._door_a_profile()
        _user2, guardian2 = make_guardian_user()
        make_active_link(guardian2, profile)
        claimant = make_user(phone=PATIENT_PHONE)
        with django_capture_on_commit_callbacks(execute=True):
            claim_profile(user=claimant, profile=profile)
        assert len(sms_outbox) == 1

    def test_claim_without_links_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        profile = make_patient()
        claimant = make_user(phone=PATIENT_PHONE)
        with django_capture_on_commit_callbacks(execute=True):
            claim_profile(user=claimant, profile=profile)
        assert sms_outbox == []

    def test_merge_onto_claimed_target_sends_the_same_generic_sms(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Porte fusion (ADR 0010, 2e passe guardian) : un lien qui atterrit
        sur un profil revendiqué passe en attente — même SMS générique."""
        center, director = make_center_with_director()
        _guardian_user, guardian_profile = make_named_guardian(first_name="Nassim")
        source = make_patient(first_name="Mariama", last_name="Ahamada")
        make_active_link(guardian_profile, source)
        target = make_claimed_patient(first_name="Mariama", last_name="Ahamada")
        with django_capture_on_commit_callbacks(execute=True):
            merge_profiles(source=source, target=target, actor=director, center=center)
        assert sms_outbox == [
            (target.user.phone, notifications.SMS_LINKS_PENDING_CONFIRMATION)
        ]
        assert "Nassim" not in sms_outbox[0][1]

    def test_merge_onto_unclaimed_target_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Cible non revendiquée : le tuteur continue de gérer le dossier —
        aucune suspension, donc aucun SMS."""
        center, director = make_center_with_director()
        _guardian_user, guardian_profile = make_named_guardian()
        source = make_patient()
        make_active_link(guardian_profile, source)
        target = make_patient()
        with django_capture_on_commit_callbacks(execute=True):
            merge_profiles(source=source, target=target, actor=director, center=center)
        assert sms_outbox == []

    def test_merge_transferring_the_titulaire_suspends_and_notifies(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Troisième porte (revue guardian de l'incrément) : la source
        REVENDIQUÉE est absorbée par une cible non revendiquée porteuse
        d'un lien actif — le titulaire arrive sur la cible, le lien passe
        en attente de confirmation et UN SEUL SMS générique part."""
        center, director = make_center_with_director()
        _guardian_user, guardian_profile = make_named_guardian(first_name="Nassim")
        target = make_patient(first_name="Mariama", last_name="Ahamada")
        link = make_active_link(guardian_profile, target)
        source = make_claimed_patient(first_name="Mariama", last_name="Ahamada")
        titulaire = source.user
        with django_capture_on_commit_callbacks(execute=True):
            merge_profiles(source=source, target=target, actor=director, center=center)
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert sms_outbox == [
            (titulaire.phone, notifications.SMS_LINKS_PENDING_CONFIRMATION)
        ]
        assert "Nassim" not in sms_outbox[0][1]


# ---------------------------------------------------------------------------
# Événement 4 — demande de paiement envoyée
# ---------------------------------------------------------------------------

EXPECTED_REQUEST_SMS = (
    "Chioni : Clinique Salama : une demande de paiement de 15 000 KMF "
    "pour Mariama vous attend sur Chioni."
)


class TestPaymentRequestSentSms:
    def _draft_shared_scenario(self):
        scn = build_scenario(status=Status.DRAFT)
        tb.share_payment_request(
            actor=scn.cashier,
            payment_request=scn.payment_request,
            guardian_link=scn.link,
        )
        return scn

    def test_the_shared_guardian_gets_amount_center_and_first_name(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = self._draft_shared_scenario()
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(actor=scn.cashier, payment_request=scn.payment_request)
        assert sms_outbox == [(scn.guardian_user.phone, EXPECTED_REQUEST_SMS)]

    def test_every_shared_guardian_is_notified(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = self._draft_shared_scenario()
        second = add_shared_guardian(scn)
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(actor=scn.cashier, payment_request=scn.payment_request)
        assert len(sms_outbox) == 2
        assert {phone for phone, _ in sms_outbox} == {
            scn.guardian_user.phone,
            second.guardian_user.phone,
        }
        assert all(message == EXPECTED_REQUEST_SMS for _, message in sms_outbox)

    def test_never_the_act_label_nor_reason_nor_category(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Contrat guardian : AUCUNE information médicale dans un SMS —
        même la catégorie générique reste dans l'app."""
        scn = self._draft_shared_scenario()
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(actor=scn.cashier, payment_request=scn.payment_request)
        message = sms_outbox[0][1]
        assert SENSITIVE_LABEL not in message  # « Sérologie VIH »
        assert "VIH" not in message
        assert scn.encounter.reason not in message
        assert str(ActCategory.ANALYSES_EXAMENS) not in message
        assert ActCategory.ANALYSES_EXAMENS.label not in message

    def test_guardian_without_phone_is_skipped_the_other_notified(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = self._draft_shared_scenario()
        phoneless = make_user_without_phone("tuteur-sans-tel")
        guardian2 = GuardianProfile.objects.create(user=phoneless)
        link2 = make_active_link(guardian2, scn.patient)
        tb.share_payment_request(
            actor=scn.cashier,
            payment_request=scn.payment_request,
            guardian_link=link2,
        )
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(actor=scn.cashier, payment_request=scn.payment_request)
        assert sms_outbox == [(scn.guardian_user.phone, EXPECTED_REQUEST_SMS)]

    def test_rollback_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = self._draft_shared_scenario()
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(RuntimeError):
                with transaction.atomic():
                    tb.send_payment_request(
                        actor=scn.cashier, payment_request=scn.payment_request
                    )
                    raise RuntimeError("rollback métier")
        assert sms_outbox == []

    def test_a_revoked_link_gets_no_sms_the_active_one_does(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Correctif guardian : le partage survit à la révocation du lien,
        le SMS ne doit pas la survivre — le montant suit la visibilité dans
        l'app, jamais l'inverse. L'autre tuteur actif reçoit le sien."""
        scn = self._draft_shared_scenario()
        second = add_shared_guardian(scn)
        revoke_link(link=second.link, actor=scn.patient_user)
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        assert sms_outbox == [(scn.guardian_user.phone, EXPECTED_REQUEST_SMS)]

    def test_a_link_suspended_by_the_claim_gets_no_sms(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Variante suspension : le titulaire revendique son profil entre le
        partage et l'envoi — le lien porte-A tombe en attente de
        confirmation, le tuteur ne reçoit ni visibilité ni SMS."""
        scn = _door_a_payment_scenario()
        claim_profile(  # hors capture : le SMS « événement 3 » ne part pas
            user=make_user(phone=PATIENT_PHONE), profile=scn.patient
        )
        scn.link.refresh_from_db()
        assert (
            scn.link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        )
        with django_capture_on_commit_callbacks(execute=True):
            tb.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        assert sms_outbox == []


def _door_a_payment_scenario():
    """A Trust Bridge stage whose patient is UNCLAIMED (door A) : le tuteur
    gère le dossier, son lien ACTIF reçoit le partage — jusqu'à ce que la
    revendication du titulaire le suspende."""
    center, _director = make_center_with_director()
    cashier = make_staff_user(center, role=StaffMembership.Role.CASHIER)
    guardian_user, _profile = make_named_guardian()
    patient, link = create_protege(
        guardian_user=guardian_user,
        relationship=GuardianLink.Relationship.PARENT,
        first_name="Mariama",
        last_name="Ahamada",
        phone=PATIENT_PHONE,
    )
    encounter = make_encounter(patient=patient, center=center)
    tariff = make_tariff(center, label=SENSITIVE_LABEL, price_kmf="15000")
    ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)
    invoice = tb.create_invoice(actor=cashier, center=center, encounter=encounter)
    tb.issue_invoice(actor=cashier, invoice=invoice)
    payment_request = tb.create_payment_request(actor=cashier, invoice=invoice)
    tb.share_payment_request(
        actor=cashier, payment_request=payment_request, guardian_link=link
    )
    return SimpleNamespace(
        cashier=cashier, patient=patient, guardian_user=guardian_user,
        link=link, payment_request=payment_request,
    )


# ---------------------------------------------------------------------------
# Événement 4 (rattrapage) — partage ajouté après l'envoi
# ---------------------------------------------------------------------------


class TestLateShareSms:
    def test_share_on_a_sent_request_notifies_that_guardian_alone(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Correctif guardian : le tuteur ajouté APRÈS l'envoi a raté la
        vague de SMS — il reçoit le sien, et lui seul (l'envoi initial est
        hors capture : rien d'autre ne part)."""
        scn = build_scenario(status=Status.SENT)
        with django_capture_on_commit_callbacks(execute=True):
            second = add_shared_guardian(scn)
        assert sms_outbox == [(second.guardian_user.phone, EXPECTED_REQUEST_SMS)]

    def test_share_on_a_draft_request_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Un partage en brouillon reste muet : le SMS n'existe qu'à
        l'envoi (send_payment_request)."""
        scn = build_scenario(status=Status.DRAFT)
        _user2, guardian2 = make_guardian_user()
        link2 = make_active_link(guardian2, scn.patient)
        with django_capture_on_commit_callbacks(execute=True):
            tb.share_payment_request(
                actor=scn.cashier,
                payment_request=scn.payment_request,
                guardian_link=link2,
            )
        assert sms_outbox == []


# ---------------------------------------------------------------------------
# Événement 5 — paiement reçu (SMS au patient, SANS montant)
# ---------------------------------------------------------------------------


class TestPaymentReceivedSms:
    def test_patient_is_told_without_any_amount(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = build_scenario()  # SENT
        intent = tb.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with django_capture_on_commit_callbacks(execute=True):
            tb.register_payment_success(intent=intent)
        assert sms_outbox == [
            (
                scn.patient.user.phone,
                "Chioni : votre soin a été payé par un proche.",
            )
        ]
        message = sms_outbox[0][1]
        # Sécurité : un téléphone patient peut circuler (déclaratif sur un
        # profil non revendiqué) — jamais de montant, jamais de devise,
        # jamais de contenu médical, et JAMAIS le nom du centre (un centre
        # spécialisé est une information quasi médicale).
        assert "15 000" not in message and "15000" not in message
        assert str(intent.amount_eur) not in message
        assert "KMF" not in message and "EUR" not in message
        assert not re.search(r"\d", message)
        assert SENSITIVE_LABEL not in message
        assert scn.center.name not in message

    def test_webhook_replay_sends_no_second_sms(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = build_scenario()
        intent = tb.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with django_capture_on_commit_callbacks(execute=True):
            tb.register_payment_success(intent=intent)
        with django_capture_on_commit_callbacks(execute=True):
            tb.register_payment_success(intent=intent)  # rejeu = no-op strict
        assert len(sms_outbox) == 1

    def test_patient_without_phone_is_silently_skipped(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = build_scenario()
        owner = scn.patient.user
        owner.phone = None
        owner.save(update_fields=["phone"])
        intent = tb.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with django_capture_on_commit_callbacks(execute=True):
            tb.register_payment_success(intent=intent)
        assert sms_outbox == []
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == Status.PAID  # l'encaissement a réussi


# ---------------------------------------------------------------------------
# Événement 6 — reçu émis (SMS au tuteur payeur)
# ---------------------------------------------------------------------------


class TestReceiptIssuedSms:
    def test_paying_guardian_gets_the_receipt_number(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = build_scenario(status=Status.CARE_CONFIRMED)
        with django_capture_on_commit_callbacks(execute=True):
            receipt = tb.close_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        assert sms_outbox == [
            (
                scn.guardian_user.phone,
                f"Chioni : votre reçu n° {receipt.sequence_number} "
                "de Clinique Salama est disponible sur Chioni.",
            )
        ]

    def test_receipt_sms_carries_no_medical_content(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scn = build_scenario(status=Status.CARE_CONFIRMED)
        with django_capture_on_commit_callbacks(execute=True):
            tb.close_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        message = sms_outbox[0][1]
        assert SENSITIVE_LABEL not in message
        assert scn.encounter.reason not in message
        assert ActCategory.ANALYSES_EXAMENS.label not in message


# ---------------------------------------------------------------------------
# Robustesse et non-régression
# ---------------------------------------------------------------------------


class TestRobustness:
    def test_failing_sms_backend_never_breaks_the_operation(
        self, settings, django_capture_on_commit_callbacks, caplog
    ):
        """Backend « stub » : chaque envoi lève SmsError. En mode eager
        l'exception remonterait dans l'appelant — elle doit être attrapée
        et loggée SANS téléphone ni corps au niveau WARNING."""
        settings.SMS_BACKEND = "stub"
        patient = make_claimed_patient()
        with caplog.at_level(logging.WARNING, logger="chioni.notifications"):
            with django_capture_on_commit_callbacks(execute=True):
                link = invite_guardian(
                    actor=patient.user,
                    patient=patient,
                    phone=GUARDIAN_PHONE,
                    relationship=GuardianLink.Relationship.CHILD,
                    initiated_by=GuardianLink.InitiatedBy.PATIENT,
                )
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.INVITATION_SENT
        warnings = [r for r in caplog.records if r.levelno >= logging.WARNING]
        assert any("non remise" in r.getMessage() for r in warnings)
        for record in warnings:
            assert GUARDIAN_PHONE not in record.getMessage()

    def test_otp_sms_still_flows(self, sms_outbox):
        """Non-régression : l'OTP n'emprunte pas le chemin des notifications
        (envoi direct hors transaction) et continue de partir."""
        from apps.accounts.services import request_otp

        request_otp(phone=PATIENT_PHONE)
        assert len(sms_outbox) == 1
        phone, message = sms_outbox[0]
        assert phone == PATIENT_PHONE
        assert re.search(r"\b\d{6}\b", message)
        assert message.startswith("Chioni : ")
