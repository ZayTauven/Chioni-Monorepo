"""Sondes adversariales du sprint S10 — « CRM santé & comptabilité ».

Campagne conservée en RÉGRESSION (patron ``test_adversarial_s1.py`` →
``test_adversarial_s9.py``). Chaque classe porte le constat qu'elle a
produit, sa gravité, et le correctif qu'elle verrouille ; chaque sonde a
été **vérifiée détectrice par mutation réelle du code** (on casse le
correctif, la sonde rougit — discipline S8/S9).

Les six constats de la passe, dans l'ordre de gravité :

1. **ÉLEVÉ — le harcèlement n'était borné que PAR FACTURE.** Trois
   factures impayées d'une même patiente faisaient partir trois SMS
   *byte-identiques* le même matin sur le téléphone du même proche ; trois
   rendez-vous manqués, trois fois le même texte générique. La cadence de
   l'ADR borne l'objet, pas la personne — or c'est la personne qui reçoit.
2. **ÉLEVÉ — une demande en LITIGE continuait d'être relancée.** S1 avait
   fermé le rail diaspora sur une facture annulée, et ``cancel_invoice``
   refuse d'annuler tant qu'une demande est en litige : le rail RELANCE
   était resté grand ouvert. « Il reste 7 500 KMF à régler » partait vers
   quelqu'un qui venait d'écrire « ce soin n'a pas eu lieu ».
3. **ÉLEVÉ — une demande jamais ENVOYÉE (brouillon) déclenchait une
   relance.** Le produit est délibérément muet sur un partage en brouillon
   (``notify_payment_request_share_added``) : le tout premier SMS qu'un
   proche recevait pouvait donc être une RELANCE d'une sollicitation qui
   n'avait jamais eu lieu.
4. **MOYEN — la liste des destinataires était lue HORS du verrou.** Un
   lien révoqué entre la sélection et l'écriture recevait quand même le
   montant, là où l'ADR promet « encore ACTIF **au moment de l'envoi** ».
5. **MOYEN — la garde « profil non revendiqué » du guichet vivait dans
   l'appelant et lisait l'objet en mémoire.** Les deux patrons du dépôt
   cumulés (S4 « une garde qui vit dans l'appelant n'est pas une garde » et
   S8 « une garde qui lit l'instance en mémoire n'en est pas une »), sur la
   porte que la revue S2 avait justement fermée pour le consentement
   clinique.
6. **FAIBLE — le tri du snapshot comptable était lexicographique.**
   ``ENC-10`` se rangeait avant ``ENC-9`` : les mouvements d'une même
   journée n'étaient pas dans l'ordre où la caisse les avait encaissés.

Ce qui a été éprouvé et jugé SAIN (sondes conservées quand même — elles
sont le filet du prochain sprint) : l'anti-doublon des trois beats sous
**course réelle à threads**, le cloisonnement des deux files et de
l'export, l'immuabilité du snapshet, la série « E- », l'étanchéité avec le
ledger, l'invariant « rien n'est gelé », et le devenir des traces après
fusion de doublons et après effacement RGPD.
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.accounting.models import AccountingExport
from apps.accounting.services import build_movements, generate_accounting_export
from apps.common.sms import MemorySmsBackend
from apps.crm.models import ContactLog
from apps.crm.services import (
    MISSED_FOLLOWUP_PATIENT_GAP_DAYS,
    REMINDABLE_REQUEST_STATUSES,
    UNPAID_REMINDER_OFFSETS_DAYS,
    UNPAID_REMINDER_PATIENT_GAP_DAYS,
    send_missed_appointment_followups,
    send_unpaid_invoice_reminders,
)
from apps.patients.models import (
    GuardianLink,
    PatientContactPreference,
    PatientProfile,
)
from apps.patients.services import (
    merge_profiles,
    update_patient_contact_preferences,
)
from apps.scheduling.models import Appointment
from apps.trustbridge.models import Invoice, PaymentRequest, PaymentRequestShare

from .api_helpers import (
    client_for,
    make_active_link,
    make_center_with_director,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_appointment,
    make_encounter,
    make_invoice,
    make_patient,
    make_payment_request,
    make_user,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Décor commun
# ---------------------------------------------------------------------------


class Scene:
    """Un centre, une patiente, une facture impayée, un proche partagé."""

    def __init__(self, *, request_status=PaymentRequest.Status.SENT,
                 guardian_phone="+2693440777"):
        self.center, self.director = make_center_with_director()
        self.cashier = make_staff_user(self.center, role="caissier")
        self.patient = make_patient(
            created_by_center=self.center, phone="+2693440555"
        )
        self.invoice = self.add_invoice(request_status=request_status)
        self.guardian_user, self.guardian = make_guardian_user(
            make_user(phone=guardian_phone)
        )
        self.link = make_active_link(self.guardian, self.patient)
        PaymentRequestShare.objects.create(
            payment_request=self.request, guardian_link=self.link
        )

    def add_invoice(self, *, request_status=PaymentRequest.Status.SENT):
        invoice = make_invoice(
            encounter=make_encounter(patient=self.patient, center=self.center)
        )
        self.request = make_payment_request(
            invoice=invoice, status=request_status
        )
        return invoice

    def share(self, invoice):
        PaymentRequestShare.objects.create(
            payment_request=invoice.payment_requests.get(),
            guardian_link=self.link,
        )

    @staticmethod
    def age(invoice, days):
        """Vieillir une facture — ``created_at`` est ``auto_now_add``."""
        Invoice.objects.filter(pk=invoice.pk).update(
            created_at=timezone.now() - timedelta(days=days)
        )


def _cash_in(actor, center, invoice, amount, method="especes"):
    """Un encaissement guichet par LE service (jamais un ORM nu).

    ``record_cash_payment`` rend un tuple sur le chemin idempotent : on
    normalise ici, comme ``tests/test_accounting.py``.
    """
    from apps.trustbridge.services import record_cash_payment

    payment = record_cash_payment(
        actor=actor, center=center, invoice=invoice, method=method,
        amount_kmf=Decimal(amount),
    )
    return payment[0] if isinstance(payment, tuple) else payment


def _reverse(actor, payment, reason="Erreur de saisie."):
    from apps.trustbridge.services import reverse_cash_payment

    reversal = reverse_cash_payment(
        actor=actor, cash_payment=payment, reason=reason
    )
    return reversal[0] if isinstance(reversal, tuple) else reversal


def _run_unpaid(capture, today=None):
    with capture(execute=True):
        return send_unpaid_invoice_reminders(today=today)


def _run_missed(capture, today=None):
    with capture(execute=True):
        return send_missed_appointment_followups(today=today)


# ---------------------------------------------------------------------------
# 1 — ÉLEVÉ : le plafond doit borner la PERSONNE, pas seulement l'objet
# ---------------------------------------------------------------------------


class TestTheCapIsOnThePersonNotOnlyOnTheObject:
    """Constat n° 1 — le risque directeur de l'ADR, pris à la lettre.

    « Une relance répétée devient du harcèlement. La différence entre un
    service et une pression tient dans un compteur borné et dans une porte
    de sortie. » Un compteur qui borne la FACTURE ne borne rien pour
    l'humain : deux consultations et une hospitalisation le même jour — la
    vie normale d'un centre — produisaient trois SMS identiques le même
    matin.
    """

    def test_three_unpaid_invoices_of_one_patient_send_ONE_message(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        for _ in range(2):
            extra = scene.add_invoice()
            scene.share(extra)
            Scene.age(extra, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 1

    def test_the_two_others_are_NOT_burnt_and_come_back_later(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Écarter n'est pas consommer.

        Une facture écartée par le plafond de la personne n'écrit AUCUNE
        ligne : sa cadence est intacte, elle repart au passage suivant une
        fois l'espacement respecté. Sans cette propriété, le correctif
        anti-harcèlement aurait silencieusement supprimé deux relances
        légitimes sur trois.
        """
        scene = Scene()
        today = timezone.localdate()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        extra = scene.add_invoice()
        scene.share(extra)
        Scene.age(extra, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert ContactLog.objects.count() == 1
        # Le lendemain : toujours rien, l'espacement de la personne tient.
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=1)
        ) == 0
        # Passé l'espacement, la seconde facture retrouve sa voix.
        assert _run_unpaid(
            django_capture_on_commit_callbacks,
            today=today + timedelta(days=UNPAID_REMINDER_PATIENT_GAP_DAYS),
        ) == 1
        assert len(sms_outbox) == 2

    def test_three_missed_appointments_send_ONE_generic_message(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        for day in (1, 2, 3):
            make_appointment(
                patient=patient, center=center,
                scheduled_at=timezone.now() - timedelta(days=day),
                status=Appointment.Status.MISSED,
            )

        assert _run_missed(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 1

    def test_the_followup_cap_holds_on_the_DAY_the_spacing_expires(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """La sonde jumelle de celle des impayés, sur le jour charnière.

        L'espacement lu en base autorise de nouveau la personne le jour
        où il expire — et ce jour-là, DEUX absences en attente repartiraient
        dans le même passage si rien ne bornait l'exécution elle-même. Ce
        qui borne le passage doit donc être vérifié le jour exact où la
        garde de base cesse de mordre : c'est la seule fenêtre où elle est
        seule à travailler.
        """
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        today = timezone.localdate()
        for day in (1, 2, 3):
            make_appointment(
                patient=patient, center=center,
                scheduled_at=timezone.now() - timedelta(days=day),
                status=Appointment.Status.MISSED,
            )

        assert _run_missed(django_capture_on_commit_callbacks) == 1
        assert _run_missed(
            django_capture_on_commit_callbacks,
            today=today + timedelta(days=MISSED_FOLLOWUP_PATIENT_GAP_DAYS),
        ) == 1
        assert len(sms_outbox) == 2

    def test_a_human_call_also_buys_the_person_some_quiet(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Si la secrétaire a appelé hier, l'automate se tait.

        Le texte de la reprise de contact est générique : après un appel
        humain, il n'apprend rien et se lit comme du harcèlement.
        """
        center, _director = make_center_with_director()
        cashier = make_staff_user(center, role="secretaire")
        patient = make_patient(created_by_center=center, phone="+2693441111")
        called = make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=2),
            status=Appointment.Status.MISSED,
        )
        ContactLog.objects.create(
            center=center, patient=patient, kind=ContactLog.Kind.RECONTACT,
            channel=ContactLog.Channel.CALL,
            recipient=ContactLog.Recipient.PATIENT, appointment=called,
            outcome=ContactLog.Outcome.REACHED, created_by=cashier,
        )
        make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )

        assert _run_missed(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_two_DIFFERENT_patients_are_never_capped_by_each_other(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le plafond est celui d'une personne, pas celui du centre.

        Sans cette sonde, un correctif anti-harcèlement trop large
        (« une relance par exécution ») passerait pour bon et réduirait au
        silence tout un registre de patients.
        """
        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        other = make_patient(created_by_center=scene.center, phone="+2693440666")
        other_invoice = make_invoice(
            encounter=make_encounter(patient=other, center=scene.center)
        )
        other_request = make_payment_request(invoice=other_invoice)
        other_guardian_user, other_guardian = make_guardian_user(
            make_user(phone="+2693440888")
        )
        PaymentRequestShare.objects.create(
            payment_request=other_request,
            guardian_link=make_active_link(other_guardian, other),
        )
        Scene.age(other_invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 2
        assert {phone for phone, _ in sms_outbox} == {
            "+2693440777", "+2693440888"
        }

    def test_the_person_cap_crosses_tenants_on_purpose(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Un téléphone ne sait pas ce qu'est un tenant.

        Écart ASSUMÉ au cloisonnement de lecture habituel, et il n'est
        possible que parce que le lecteur est un automate de plateforme,
        jamais une vue : deux centres qui relancent la même personne le
        même matin lui envoient deux fois la même phrase.
        """
        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        other_center, _other_director = make_center_with_director()
        elsewhere = make_invoice(
            encounter=make_encounter(
                patient=scene.patient, center=other_center
            )
        )
        PaymentRequestShare.objects.create(
            payment_request=make_payment_request(invoice=elsewhere),
            guardian_link=scene.link,
        )
        Scene.age(elsewhere, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 1


# ---------------------------------------------------------------------------
# 2 & 3 — ÉLEVÉ : le rail relance suit les mêmes fermetures que le rail
#         diaspora (litige, brouillon, annulation)
# ---------------------------------------------------------------------------


class TestTheReminderRailClosesLikeTheDiasporaRail:
    def test_a_DISPUTED_request_silences_the_reminder(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Constat n° 2 — la couture S1 × S10.

        ``cancel_invoice`` refuse d'annuler une facture dont une demande
        est en ``litige`` : l'argent est contesté. Relancer « il reste
        7 500 KMF à régler » celui qui vient d'ouvrir ce litige était la
        même erreur, par une porte que personne ne relisait.
        """
        scene = Scene(request_status=PaymentRequest.Status.DISPUTED)
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []
        assert not ContactLog.objects.exists()

    def test_a_dispute_on_a_SISTER_request_silences_the_whole_invoice(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Une facture peut porter plusieurs demandes : relancer par la
        porte d'à côté un argent partiellement contesté serait pire que de
        se taire (miroir exact de ``cancel_invoice``)."""
        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        PaymentRequest.objects.create(
            invoice=scene.invoice, created_by=scene.cashier,
            status=PaymentRequest.Status.DISPUTED,
        )

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_a_request_still_in_DRAFT_never_produces_a_reminder(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Constat n° 3 — on ne relance pas une sollicitation qui n'a
        jamais eu lieu.

        ``share_payment_request`` autorise le partage d'un brouillon, et
        le produit reste alors volontairement MUET jusqu'à l'envoi. Sans
        ce filtre, le tout premier SMS qu'un proche recevait au sujet de
        cette facture était une relance.
        """
        scene = Scene(request_status=PaymentRequest.Status.DRAFT)
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_sending_the_request_re_opens_the_rail(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le miroir positif : le brouillon n'est pas une impasse."""
        scene = Scene(request_status=PaymentRequest.Status.DRAFT)
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        PaymentRequest.objects.filter(pk=scene.request.pk).update(
            status=PaymentRequest.Status.SENT
        )

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 1

    def test_a_CANCELLED_invoice_never_produces_a_reminder(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Régression : le rail est fermé sur ``annulee`` depuis S1, et
        l'automate hérite de la fermeture par ``unpaid_invoices_qs``."""
        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        Invoice.objects.filter(pk=scene.invoice.pk).update(
            status=Invoice.Status.CANCELLED
        )

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_the_rail_statuses_are_a_closed_and_deliberate_list(self):
        """La liste est une DÉCISION : un statut ajouté demain à
        ``PaymentRequest`` n'entre pas dans le rail par accident."""
        assert set(REMINDABLE_REQUEST_STATUSES) == {
            PaymentRequest.Status.SENT,
            PaymentRequest.Status.PAID,
            PaymentRequest.Status.CARE_CONFIRMED,
            PaymentRequest.Status.CLOSED,
        }
        assert PaymentRequest.Status.DRAFT not in REMINDABLE_REQUEST_STATUSES
        assert PaymentRequest.Status.DISPUTED not in REMINDABLE_REQUEST_STATUSES

    def test_the_work_queue_boolean_tells_the_cashier_the_truth(self):
        """``guardian_reachable`` est un miroir du rail, pas une promesse
        approximative : s'il disait « oui » là où aucun SMS ne peut
        partir, la file mentirait à la personne qui la lit."""
        scene = Scene(request_status=PaymentRequest.Status.DISPUTED)
        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        assert response.status_code == 200
        [row] = response.data["results"]
        assert row["guardian_reachable"] is False


# ---------------------------------------------------------------------------
# 4 — MOYEN : « encore ACTIF au moment de l'envoi »
# ---------------------------------------------------------------------------


class TestTheRecipientsAreReadUnderTheLock:
    def test_a_link_revoked_after_the_pre_filter_receives_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks, monkeypatch
    ):
        """Constat n° 4 — la patiente révoque, le SMS partait quand même.

        La sonde simule exactement la fenêtre : la révocation commite
        entre le pré-filtre de confort et le verrou de la facture. Seule
        une relecture DANS la transaction qui écrit la trace peut la voir.
        """
        from apps.crm import services as crm_services

        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        real = crm_services.reminder_reachable_links
        state = {"calls": 0}

        def racing(invoice):
            state["calls"] += 1
            links = real(invoice)
            if state["calls"] == 1:
                # …et la patiente révoque, juste après le pré-filtre.
                GuardianLink.objects.filter(pk=scene.link.pk).update(
                    status=GuardianLink.Status.REVOKED
                )
            return links

        monkeypatch.setattr(crm_services, "reminder_reachable_links", racing)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []
        # …et surtout : aucune trace écrite pour un message jamais parti.
        assert not ContactLog.objects.exists()
        assert state["calls"] >= 2, (
            "La liste des destinataires doit être relue SOUS le verrou de "
            "la facture — un seul appel signifie qu'elle est lue en amont."
        )

    def test_a_guardian_who_opts_out_after_the_pre_filter_receives_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks, monkeypatch
    ):
        """Même fenêtre, porte de sortie RGPD : l'opt-out du tuteur doit
        prendre effet immédiatement, y compris à la milliseconde."""
        from apps.crm import services as crm_services
        from apps.patients.models import GuardianProfile

        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        real = crm_services.reminder_reachable_links
        state = {"calls": 0}

        def racing(invoice):
            state["calls"] += 1
            links = real(invoice)
            if state["calls"] == 1:
                GuardianProfile.objects.filter(pk=scene.guardian.pk).update(
                    payment_reminders=False
                )
            return links

        monkeypatch.setattr(crm_services, "reminder_reachable_links", racing)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []


# ---------------------------------------------------------------------------
# 5 — MOYEN : la garde du guichet vit dans le SERVICE, sous verrou
# ---------------------------------------------------------------------------


class TestTheDeskGuardLivesInTheService:
    def test_the_service_refuses_a_claimed_profile_on_its_own(self):
        """Constat n° 5a — leçon S4 : « une garde qui vit dans l'appelant
        n'est pas une garde ». Le service est public (shell, commande,
        future vue) et écrivait sans rien vérifier."""
        from django.core.exceptions import ValidationError

        scene = Scene()
        user = make_user(phone="+2693440999")
        PatientProfile.objects.filter(pk=scene.patient.pk).update(
            user=user, claim_status=PatientProfile.ClaimStatus.ACTIVE
        )
        scene.patient.refresh_from_db()

        with pytest.raises(ValidationError):
            update_patient_contact_preferences(
                actor=scene.cashier, patient=scene.patient,
                center=scene.center, appointment_reminders=False,
            )
        assert not PatientContactPreference.objects.exists()

    def test_a_claim_committed_after_the_view_resolved_is_SEEN(self):
        """Constat n° 5b — leçon S8, et TOCTOU jumeau de celui que la revue
        S2 avait fermé sur le consentement clinique porte C.

        La vue résout le patient AVANT la transaction : la revendication
        OTP qui commite dans l'intervalle laissait le guichet régler les
        canaux de quelqu'un qui gère désormais lui-même.
        """
        from django.core.exceptions import ValidationError

        scene = Scene()
        stale = PatientProfile.objects.get(pk=scene.patient.pk)  # la vue
        assert not stale.is_claimed
        user = make_user(phone="+2693440998")
        PatientProfile.objects.filter(pk=scene.patient.pk).update(
            user=user, claim_status=PatientProfile.ClaimStatus.ACTIVE
        )

        with pytest.raises(ValidationError):
            update_patient_contact_preferences(
                actor=scene.cashier, patient=stale, center=scene.center,
                appointment_reminders=False, missed_appointment_followup=False,
            )

    def test_the_person_herself_is_never_blocked_by_that_guard(self):
        """La garde vise le GESTE DE GUICHET (``center`` renseigné), jamais
        la personne : sans cette sonde, le correctif fermerait la porte de
        sortie à celui-là même qu'elle protège."""
        scene = Scene()
        user = make_user(phone="+2693440997")
        PatientProfile.objects.filter(pk=scene.patient.pk).update(
            user=user, claim_status=PatientProfile.ClaimStatus.ACTIVE
        )
        scene.patient.refresh_from_db()

        preferences = update_patient_contact_preferences(
            actor=user, patient=scene.patient, appointment_reminders=False
        )
        assert preferences.appointment_reminders is False

    def test_the_desk_still_serves_an_unclaimed_profile(self):
        scene = Scene()
        preferences = update_patient_contact_preferences(
            actor=scene.cashier, patient=scene.patient, center=scene.center,
            appointment_reminders=False, missed_appointment_followup=True,
        )
        assert preferences.appointment_reminders is False


# ---------------------------------------------------------------------------
# 6 — FAIBLE : l'ordre des mouvements dans une pièce comptable
# ---------------------------------------------------------------------------


class TestTheSnapshotIsOrderedLikeTheCashDrawer:
    def test_movements_of_one_day_follow_their_real_sequence(self):
        """Constat n° 6 — ``ENC-10`` se rangeait AVANT ``ENC-9``.

        Une pièce comptable se relit : les encaissements d'une journée
        doivent y apparaître dans l'ordre où la caisse les a pris. Onze
        mouvements suffisent à faire apparaître la bascule lexicographique.
        """
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role="caissier")
        patient = make_patient(created_by_center=center)
        invoice = make_invoice(
            encounter=make_encounter(patient=patient, center=center)
        )
        for _ in range(11):
            _cash_in(cashier, center, invoice, "100")
        today = timezone.localdate()

        movements = build_movements(
            center,
            start=timezone.now() - timedelta(days=1),
            end=timezone.now() + timedelta(days=1),
        )
        ids = [int(row["reference"].split("-")[1]) for row in movements]
        assert ids == sorted(ids), (
            "Les mouvements d'une même journée doivent suivre l'ordre de la "
            f"caisse, pas l'ordre alphabétique de leurs références : {ids}"
        )
        # …et la clé de tri interne ne fuit jamais dans la pièce figée.
        assert all("_sort_id" not in row for row in movements)
        export = generate_accounting_export(
            actor=director, center=center,
            period_start=today, period_end=today,
        )
        assert all("_sort_id" not in row for row in export.lines)


# ---------------------------------------------------------------------------
# 7 — Les coutures entre sprints (leçon S9 : cinq défauts sur six)
# ---------------------------------------------------------------------------


class TestTheSeamsWithTheOtherSprints:
    def test_a_merged_duplicate_never_diverts_a_reminder_to_its_phone(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Fusion × S10 — le correctif exact qu'avait exigé le module
        rendez-vous (vague 1) : un objet laissé sur le tombstone enverrait
        son SMS au téléphone DÉCLARATIF du doublon, potentiellement celui
        d'un tiers."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role="caissier")
        target = make_patient(created_by_center=center, phone="+2693441000")
        duplicate = make_patient(created_by_center=center, phone="+2693449999")
        make_appointment(
            patient=duplicate, center=center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )
        merge_profiles(
            source=duplicate, target=target, actor=cashier, center=center
        )

        assert _run_missed(django_capture_on_commit_callbacks) == 1
        [(phone, _message)] = sms_outbox
        assert phone == "+2693441000"

    def test_a_contact_trace_stays_on_the_tombstone_and_keeps_its_meaning(
        self, django_capture_on_commit_callbacks
    ):
        """Choix ASSUMÉ, verrouillé pour qu'il reste un choix.

        ``ContactLog`` est append-only : une trace dit « ce jour-là, nous
        avons contacté au sujet de CE dossier ». Elle ne se déplace donc
        pas à la fusion — exactement comme les factures, que
        ``merge_profiles`` laisse elles aussi sur le tombstone. Ce qui
        compte est vérifié ici : l'anti-doublon reste ancré sur l'objet
        (rendez-vous, facture), donc il tient de part et d'autre d'une
        fusion.
        """
        center, _director = make_center_with_director()
        cashier = make_staff_user(center, role="caissier")
        target = make_patient(created_by_center=center, phone="+2693441000")
        duplicate = make_patient(created_by_center=center, phone="+2693449999")
        appointment = make_appointment(
            patient=duplicate, center=center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )
        trace = ContactLog.objects.create(
            center=center, patient=duplicate,
            kind=ContactLog.Kind.RECONTACT, channel=ContactLog.Channel.SMS,
            recipient=ContactLog.Recipient.PATIENT, appointment=appointment,
        )
        merge_profiles(
            source=duplicate, target=target, actor=cashier, center=center
        )

        trace.refresh_from_db()
        appointment.refresh_from_db()
        assert trace.patient_id == duplicate.pk  # la trace ne bouge pas…
        assert appointment.patient_id == target.pk  # …le rendez-vous, si.
        # L'anti-doublon tient malgré tout : rien ne repart.
        assert _run_missed(django_capture_on_commit_callbacks) == 0

    def test_an_erased_person_never_receives_anything_again(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """RGPD × S10 — le pivot téléphone disparaît, les liens meurent,
        donc les deux canaux neufs se taisent par CONSTRUCTION.

        Le défaut de S7 (le justificatif de congé survivait à
        l'anonymisation) était d'une autre nature : des OCTETS restaient.
        Ici rien n'est stocké qui parle de la personne — la sonde le
        vérifie sur les deux tables neuves.
        """
        from apps.accounts.services import anonymize_user

        scene = Scene()
        Scene.age(scene.invoice, UNPAID_REMINDER_OFFSETS_DAYS[0])
        make_appointment(
            patient=scene.patient, center=scene.center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )
        anonymize_user(actor=scene.guardian_user, user=scene.guardian_user)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_the_new_tables_carry_no_personal_datum_to_erase(self):
        """Ce qui SURVIT à un effacement, nommé plutôt que découvert.

        ``ContactLog`` ne porte que des références et des codes fermés ;
        les lignes figées d'un ``AccountingExport`` ne portent ni nom, ni
        identifiant de patient — des références de facture et de reçu, des
        montants, des dates. Une pièce comptable a des obligations de
        conservation : ce qu'elle garde doit être défendable, et ça l'est
        parce qu'il n'y a rien d'identifiant dedans.
        """
        contact_fields = {f.name for f in ContactLog._meta.get_fields()}
        assert not (contact_fields & {
            "note", "notes", "comment", "commentaire", "message", "body",
            "phone", "telephone", "subject", "objet",
        })
        export_line_keys = {
            "date", "type", "reference", "montant_kmf", "methode",
            "operateur", "facture", "recu", "reference_origine",
            "date_origine",
        }
        from apps.accounting.services import CSV_COLUMNS

        assert set(CSV_COLUMNS) == export_line_keys
        assert not (export_line_keys & {"patient", "nom", "prenom", "acte"})

    def test_neither_module_can_ever_be_frozen_or_kyc_gated(self):
        """ADR 0023 décision transverse — vérifiée sur le CODE, pas sur la
        prose : ``ALLOWED_IMPORTERS`` (sonde S5) reste intacte, et aucun
        des deux modules neufs n'importe la garde de gel."""
        import ast
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1] / "apps"
        for app in ("crm", "accounting"):
            for path in (root / app).rglob("*.py"):
                tree = ast.parse(path.read_text(encoding="utf-8"))
                for node in ast.walk(tree):
                    names = []
                    if isinstance(node, ast.ImportFrom):
                        names = [alias.name for alias in node.names]
                    elif isinstance(node, ast.Import):
                        names = [alias.name for alias in node.names]
                    assert "require_center_can_administer" not in names, path
                    assert "_require_center_can_collect" not in names, path


# ---------------------------------------------------------------------------
# 8 — La course RÉELLE : deux beats qui se chevauchent
# ---------------------------------------------------------------------------


class TestTheBeatsUnderRealConcurrency(TransactionTestCase):
    """Ce que l'ADR appelle « l'anti-doublon », éprouvé à deux threads.

    Le compteur non verrouillé de ``send_subscription_payment_reminders``
    avait produit un **double envoi réel** en S5, et le guardian avait noté
    que ``send_appointment_reminders`` avait « exactement la même forme » —
    dette que S10 solde. Les trois beats sont donc mis face à eux-mêmes,
    barrière de synchronisation comprise : un test séquentiel n'aurait
    jamais vu la fenêtre.
    """

    reset_sequences = True

    @staticmethod
    def _race(target, threads=2):
        errors = []
        barrier = threading.Barrier(threads)

        def run():
            try:
                barrier.wait(timeout=10)
                target()
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        with override_settings(SMS_BACKEND="memory"):
            MemorySmsBackend.sent.clear()
            workers = [threading.Thread(target=run) for _ in range(threads)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(timeout=30)
            sent = list(MemorySmsBackend.sent)
            MemorySmsBackend.sent.clear()
        assert errors == [], errors
        return sent

    def test_two_overlapping_unpaid_beats_send_ONE_message(self):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693440555")
        _guardian_user, guardian = make_guardian_user(
            make_user(phone="+2693440777")
        )
        link = make_active_link(guardian, patient)
        invoice = make_invoice(
            encounter=make_encounter(patient=patient, center=center)
        )
        PaymentRequestShare.objects.create(
            payment_request=make_payment_request(invoice=invoice),
            guardian_link=link,
        )
        Invoice.objects.filter(pk=invoice.pk).update(
            created_at=timezone.now() - timedelta(days=60)
        )

        sent = self._race(send_unpaid_invoice_reminders)

        assert ContactLog.objects.count() == 1
        assert len(sent) == 1

    def test_two_overlapping_missed_beats_send_ONE_message(self):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693440556")
        make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )

        sent = self._race(send_missed_appointment_followups)

        assert ContactLog.objects.count() == 1
        assert len(sent) == 1

    def test_two_overlapping_J1_reminder_beats_send_ONE_message(self):
        """La dette SV.2 soldée par S10, prouvée là où elle vivait."""
        from datetime import datetime, time as dtime

        from apps.scheduling.services import send_appointment_reminders

        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693440557")
        tomorrow = timezone.localdate() + timedelta(days=1)
        slot = timezone.make_aware(
            datetime.combine(tomorrow, dtime(10, 0))
        )
        appointment = make_appointment(
            patient=patient, center=center, scheduled_at=slot
        )

        sent = self._race(send_appointment_reminders)

        appointment.refresh_from_db()
        assert appointment.reminder_sent_at is not None
        assert len(sent) == 1


# ---------------------------------------------------------------------------
# 9 — L'export : ce qui sort de l'application
# ---------------------------------------------------------------------------


class TestTheAccountingExportUnderAttack:
    def _export(self, center, director, day=None):
        day = day or timezone.localdate()
        return generate_accounting_export(
            actor=director, center=center, period_start=day, period_end=day
        )

    def test_the_same_piece_can_never_render_two_different_contents(self):
        """« Figé » n'a de sens que si le téléchargement RELIT le snapshot.

        La caisse bouge entre les deux lectures ; la pièce, non.
        """
        from apps.accounting.services import export_csv_bytes
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role="caissier")
        patient = make_patient(created_by_center=center)
        invoice = make_invoice(
            encounter=make_encounter(patient=patient, center=center)
        )
        payment = _cash_in(cashier, center, invoice, "500")
        export = self._export(center, director)
        first = export_csv_bytes(export)

        _reverse(cashier, payment)
        _cash_in(cashier, center, invoice, "300")
        export.refresh_from_db()

        assert export_csv_bytes(export) == first

    def test_an_export_never_carries_another_tenants_franc(self):
        center, director = make_center_with_director()
        other_center, other_director = make_center_with_director()
        other_cashier = make_staff_user(other_center, role="caissier")
        other_patient = make_patient(created_by_center=other_center)
        other_invoice = make_invoice(
            encounter=make_encounter(
                patient=other_patient, center=other_center
            )
        )
        _cash_in(other_cashier, other_center, other_invoice, "900")

        export = self._export(center, director)

        assert export.lines == []
        assert export.net_kmf == Decimal("0")

    def test_a_later_reversal_never_rewrites_an_emitted_piece(self):
        """Décision 7, prise à la lettre : la recette du 3 août reste la
        recette du 3 août."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role="caissier")
        patient = make_patient(created_by_center=center)
        invoice = make_invoice(
            encounter=make_encounter(patient=patient, center=center)
        )
        payment = _cash_in(cashier, center, invoice, "500")
        export = self._export(center, director)
        assert export.total_collected_kmf == Decimal("500")

        _reverse(cashier, payment)
        export.refresh_from_db()

        assert export.total_collected_kmf == Decimal("500")
        assert export.total_reversed_kmf == Decimal("0")
        assert len(export.lines) == 1

    def test_the_generation_throttle_is_really_wired(self):
        """Leçon S9 (faille élevée n° 2) : un ``throttle_scope`` posé sans
        ``get_throttles()`` qui retourne un ``ScopedRateThrottle`` est
        INERTE — et c'est le garde-fou du geste le plus lourd du sprint."""
        from rest_framework.throttling import ScopedRateThrottle

        from apps.accounting.views import CenterAccountingExportListCreateView

        view = CenterAccountingExportListCreateView()

        class _Request:
            method = "POST"

        view.request = _Request()
        throttles = view.get_throttles()

        assert any(isinstance(t, ScopedRateThrottle) for t in throttles)
        assert view.throttle_scope == "accounting_export"

    def test_a_foreign_export_is_404_through_my_url(self):
        center, director = make_center_with_director()
        other_center, other_director = make_center_with_director()
        make_patient(created_by_center=other_center)
        foreign = self._export(other_center, other_director)

        for suffix in ("", "download/"):
            response = client_for(director).get(
                f"/api/v1/centers/{center.pk}/accounting/exports/"
                f"{foreign.pk}/{suffix}"
            )
            assert response.status_code == 404, suffix

    def test_the_piece_is_append_only_at_every_level(self):
        from apps.common.models import AppendOnlyError

        center, director = make_center_with_director()
        make_patient(created_by_center=center)
        export = self._export(center, director)

        export.lines = [{"date": "1970-01-01"}]
        with pytest.raises(AppendOnlyError):
            export.save()
        with pytest.raises(AppendOnlyError):
            AccountingExport.objects.filter(pk=export.pk).update(line_count=0)
        with pytest.raises(AppendOnlyError):
            AccountingExport.objects.filter(pk=export.pk).delete()
