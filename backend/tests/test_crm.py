"""Relances — S10 lot 2 (ADR 0023, décisions 2 à 5).

Ce que ce fichier verrouille, dans l'ordre des risques de l'ADR :

1. **aucune relance de dette ne part vers un patient** (arbitrage PO n° 1) ;
2. la relance va au **tuteur d'une demande partagée dont le lien est ACTIF
   au moment de l'envoi**, porte le **solde restant**, et respecte son
   opt-out ;
3. la **cadence est bornée à trois vagues**, puis silence — et l'anti-doublon
   tient sous exécutions concurrentes ;
4. le rendez-vous manqué déclenche **un seul** message, **jamais un
   reproche**, et **rien** si la personne a déjà repris rendez-vous ;
5. **aucun texte libre**, **aucune donnée clinique**, **aucun téléphone**
   dans les files de travail.
"""

import ast
import pathlib
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.crm.models import ContactLog
from apps.crm.services import (
    UNPAID_REMINDER_OFFSETS_DAYS,
    send_missed_appointment_followups,
    send_unpaid_invoice_reminders,
)
from apps.patients.models import GuardianLink
from apps.patients.services import update_patient_contact_preferences
from apps.scheduling.models import Appointment
from apps.trustbridge.models import CashPayment, Invoice, PaymentRequestShare

from .api_helpers import (
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
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

Role = "caissier"


class Scene:
    """Un centre, une patiente, une facture impayée, un proche partagé."""

    def __init__(self, *, guardian_phone="+2693440777", shared=True,
                 link_status=GuardianLink.Status.ACTIVE):
        self.center, self.director = make_center_with_director()
        self.cashier = make_staff_user(self.center, role="caissier")
        self.nurse = make_staff_user(self.center, role="infirmier")
        self.patient = make_patient(
            created_by_center=self.center, phone="+2693440555"
        )
        self.invoice = make_invoice(
            encounter=make_encounter(patient=self.patient, center=self.center)
        )
        self.request = make_payment_request(invoice=self.invoice)
        self.guardian_user, self.guardian = make_guardian_user(
            make_user(phone=guardian_phone)
        )
        self.link = make_active_link(self.guardian, self.patient)
        if link_status != GuardianLink.Status.ACTIVE:
            self.link.status = link_status
            self.link.save(update_fields=["status", "updated_at"])
        if shared:
            PaymentRequestShare.objects.create(
                payment_request=self.request, guardian_link=self.link
            )

    def age_invoice(self, days):
        """Vieillir la facture — ``created_at`` est ``auto_now_add``."""
        Invoice.objects.filter(pk=self.invoice.pk).update(
            created_at=timezone.now() - timedelta(days=days)
        )
        self.invoice.refresh_from_db()
        return self.invoice


def _run_unpaid(capture, today=None):
    """Une exécution de la tâche, ``on_commit`` compris.

    ``today`` fait avancer l'horloge de la tâche sans toucher aux lignes
    déjà écrites : c'est ainsi qu'on éprouve l'ESPACEMENT de la cadence
    (une vague, puis sept jours, puis seize) sans falsifier les
    horodatages des relances précédentes.
    """
    with capture(execute=True):
        return send_unpaid_invoice_reminders(today=today)


# ---------------------------------------------------------------------------
# 1 — La relance d'impayé : au TUTEUR SEUL
# ---------------------------------------------------------------------------


class TestTheUnpaidReminderGoesToTheGuardianAlone:
    def test_the_guardian_receives_the_remaining_balance_and_the_center_name(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(UNPAID_REMINDER_OFFSETS_DAYS[0])

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1

        [(phone, message)] = sms_outbox
        assert phone == "+2693440777"
        assert scene.center.name in message
        assert "7 500" in message  # le solde, pas un autre montant
        assert scene.patient.first_name in message

    def test_the_patient_never_receives_a_debt_sms(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Arbitrage PO n° 1, l'invariant du lot : un impayé ne part jamais
        vers un patient. Son dossier vit dans la file du guichet."""
        scene = Scene()
        scene.age_invoice(60)

        _run_unpaid(django_capture_on_commit_callbacks)

        assert scene.patient.phone not in [phone for phone, _m in sms_outbox]

    def test_a_patient_without_any_guardian_receives_nothing_at_all(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693440666")
        make_invoice(encounter=make_encounter(patient=patient, center=center))

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []
        # Et la cadence n'est pas brûlée : rien n'est écrit.
        assert not ContactLog.objects.exists()

    def test_the_amount_is_the_REMAINING_balance_after_a_partial_payment(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.trustbridge.services import record_cash_payment

        scene = Scene()
        record_cash_payment(
            actor=scene.cashier, center=scene.center, invoice=scene.invoice,
            method=CashPayment.Method.CASH, amount_kmf=Decimal("5000"),
        )
        scene.age_invoice(UNPAID_REMINDER_OFFSETS_DAYS[0])

        _run_unpaid(django_capture_on_commit_callbacks)

        [(_phone, message)] = sms_outbox
        assert "2 500" in message
        assert "7 500" not in message

    def test_a_fully_paid_invoice_is_never_reminded(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.trustbridge.services import record_cash_payment

        scene = Scene()
        record_cash_payment(
            actor=scene.cashier, center=scene.center, invoice=scene.invoice,
            method=CashPayment.Method.CASH, amount_kmf=Decimal("7500"),
        )
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_no_medical_content_ever_reaches_the_message(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(60)

        _run_unpaid(django_capture_on_commit_callbacks)

        [(_phone, message)] = sms_outbox
        for forbidden in ("Consultation", "consultation", "Céphalées"):
            assert forbidden not in message


# ---------------------------------------------------------------------------
# 2 — Qui peut recevoir : partage + lien ACTIF + opt-out + téléphone
# ---------------------------------------------------------------------------


class TestWhoIsAllowedToReceiveIt:
    def test_an_unshared_guardian_receives_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene(shared=False)
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    @pytest.mark.parametrize(
        "status",
        [
            GuardianLink.Status.REVOKED,
            GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION,
            GuardianLink.Status.INVITATION_SENT,
        ],
    )
    def test_a_share_that_survived_its_link_sends_nothing(
        self, status, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Règle de l'événement 4, inchangée : un partage peut survivre à
        son lien, le SMS ne le doit pas."""
        scene = Scene()
        scene.link.status = status
        scene.link.save(update_fields=["status", "updated_at"])
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_a_guardian_who_refused_reminders_receives_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.guardian.payment_reminders = False
        scene.guardian.save(update_fields=["payment_reminders", "updated_at"])
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []
        # Cadence intacte : le jour où il rouvre le canal, il est relancé.
        assert not ContactLog.objects.exists()

    def test_two_shared_guardians_get_one_message_each_but_ONE_wave(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Une ligne = une VAGUE, pas un destinataire : compter les proches
        ferait dépendre la cadence du nombre d'enfants à l'étranger."""
        scene = Scene()
        second_user, second_guardian = make_guardian_user(
            make_user(phone="+2693440888")
        )
        second_link = make_active_link(second_guardian, scene.patient)
        PaymentRequestShare.objects.create(
            payment_request=scene.request, guardian_link=second_link
        )
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1

        assert sorted(phone for phone, _m in sms_outbox) == [
            "+2693440777", "+2693440888"
        ]
        assert ContactLog.objects.count() == 1

    def test_a_guardian_of_ANOTHER_patient_never_receives_it(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene(shared=False)
        other_patient = make_patient(created_by_center=scene.center)
        _user, stranger = make_guardian_user(make_user(phone="+2693449999"))
        make_active_link(stranger, other_patient)
        scene.age_invoice(60)

        _run_unpaid(django_capture_on_commit_callbacks)

        assert "+2693449999" not in [phone for phone, _m in sms_outbox]


# ---------------------------------------------------------------------------
# 3 — La cadence : trois vagues, puis SILENCE
# ---------------------------------------------------------------------------


class TestTheCadenceIsBoundedThenSilent:
    def test_nothing_leaves_before_the_first_offset(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(UNPAID_REMINDER_OFFSETS_DAYS[0] - 1)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert sms_outbox == []

    def test_at_most_one_wave_per_run(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(365)  # tous les paliers sont dépassés

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert len(sms_outbox) == 1

    def test_three_waves_then_definitive_silence(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        today = timezone.localdate()
        scene.age_invoice(UNPAID_REMINDER_OFFSETS_DAYS[0])

        # Chaque vague arrive à son palier, et pas avant.
        for offset in UNPAID_REMINDER_OFFSETS_DAYS:
            day = today + timedelta(days=offset - UNPAID_REMINDER_OFFSETS_DAYS[0])
            assert _run_unpaid(django_capture_on_commit_callbacks, today=day) == 1
        assert len(sms_outbox) == len(UNPAID_REMINDER_OFFSETS_DAYS) == 3

        # …puis silence DÉFINITIF, quelle que soit l'ancienneté atteinte.
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=3650)
        ) == 0
        assert len(sms_outbox) == 3

    def test_a_very_old_invoice_never_catches_up_its_three_waves_at_once(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le compteur borne le NOMBRE, l'espacement borne le RYTHME.

        Une facture de soixante jours — un impayé ancien, un beat rétabli
        après une panne, un centre qui arrive avec son historique — ne doit
        pas recevoir ses trois relances en trois exécutions rapprochées.
        Ce serait exactement le harcèlement que la décision 2 nomme comme
        risque directeur.
        """
        scene = Scene()
        today = timezone.localdate()
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks, today=today) == 1
        # Le lendemain, et six jours plus tard : toujours rien.
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=1)
        ) == 0
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=6)
        ) == 0
        # Au septième jour, la deuxième vague.
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=7)
        ) == 1
        # …et la troisième seize jours après ELLE, pas avant. (Les lignes
        # de ``ContactLog`` portent l'horloge réelle, pas le ``today``
        # simulé : l'écart se mesure donc depuis aujourd'hui, ce qui est
        # exactement ce que la production fera passage après passage.)
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=15)
        ) == 0
        assert _run_unpaid(
            django_capture_on_commit_callbacks, today=today + timedelta(days=16)
        ) == 1
        assert len(sms_outbox) == 3

    def test_a_second_run_the_same_day_sends_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """L'anti-doublon, ce sont les LIGNES : un beat qui double-déclenche
        ne fait pas partir deux fois le même message."""
        scene = Scene()
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert _run_unpaid(django_capture_on_commit_callbacks) == 0
        assert len(sms_outbox) == 1

    def test_the_automatic_line_has_no_actor_and_no_outcome(
        self, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(60)
        _run_unpaid(django_capture_on_commit_callbacks)

        line = ContactLog.objects.get()
        assert line.created_by_id is None  # NULL = l'automate
        assert line.outcome == ""
        assert line.recipient == ContactLog.Recipient.GUARDIAN
        assert line.channel == ContactLog.Channel.SMS
        assert line.invoice_id == scene.invoice.pk
        assert line.appointment_id is None


# ---------------------------------------------------------------------------
# 4 — La reprise de contact : UN message, jamais un reproche
# ---------------------------------------------------------------------------


def _missed(center, patient, days_ago=1):
    when = timezone.now() - timedelta(days=days_ago)
    return make_appointment(
        patient=patient, center=center, scheduled_at=when,
        status=Appointment.Status.MISSED,
    )


class TestTheMissedAppointmentFollowup:
    def test_one_neutral_message_the_day_after(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        _missed(center, patient)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 1

        [(phone, message)] = sms_outbox
        assert phone == "+2693441111"
        # Ni motif, ni praticien, ni NOM DE CENTRE — mêmes règles que J-1.
        assert center.name not in message
        # …et aucun reproche : le texte dit que la porte reste ouverte.
        assert "présenté" not in message
        assert "manqué" not in message.lower()
        assert "nouveau" in message

    def test_never_repeated(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        _missed(center, patient)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 1
        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

        assert len(sms_outbox) == 1

    def test_nothing_when_the_person_already_rebooked_in_the_same_center(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        _missed(center, patient)
        make_appointment(patient=patient, center=center)  # demain, « prevu »

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

        assert sms_outbox == []

    def test_a_rebooking_in_ANOTHER_center_does_not_silence_this_one(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """La garde est bornée au centre : un rendez-vous pris ailleurs ne
        regarde pas celui-ci, et la requête ne révèle rien d'un autre
        tenant (ADR 0002)."""
        center, _director = make_center_with_director()
        other_center, _other = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        _missed(center, patient)
        make_appointment(patient=patient, center=other_center)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 1

    @pytest.mark.parametrize(
        "status",
        [
            Appointment.Status.CANCELLED,
            Appointment.Status.HONORED,
            Appointment.Status.SCHEDULED,
        ],
    )
    def test_only_a_MISSED_appointment_triggers_it(
        self, status, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        make_appointment(
            patient=patient, center=center, status=status,
            scheduled_at=timezone.now() - timedelta(days=1),
        )

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

    def test_an_old_absence_is_never_woken_up(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="+2693441111")
        _missed(center, patient, days_ago=400)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

    def test_a_patient_who_refused_the_channel_receives_nothing(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        user = make_user(phone="+2693442222")
        patient = make_claimed_patient(user=user, created_by_center=center)
        update_patient_contact_preferences(
            actor=user, patient=patient, missed_appointment_followup=False
        )
        _missed(center, patient)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

        assert sms_outbox == []
        assert not ContactLog.objects.exists()

    def test_a_phoneless_patient_is_skipped_without_burning_the_line(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        center, _director = make_center_with_director()
        patient = make_patient(created_by_center=center, phone="")
        _missed(center, patient)

        with django_capture_on_commit_callbacks(execute=True):
            assert send_missed_appointment_followups() == 0

        assert not ContactLog.objects.exists()


# ---------------------------------------------------------------------------
# 5 — Les deux files de travail : rôles, contenu, cloisonnement
# ---------------------------------------------------------------------------


class TestTheWorkQueues:
    def test_the_unpaid_queue_is_billing_only(self):
        scene = Scene()
        url = f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"

        assert client_for(scene.cashier).get(url).status_code == 200
        assert client_for(scene.nurse).get(url).status_code == 403
        assert client_for().get(url).status_code == 401

    def test_the_missed_queue_is_open_to_every_active_staff(self):
        scene = Scene()
        url = f"/api/v1/centers/{scene.center.pk}/crm/missed-appointments/"

        assert client_for(scene.nurse).get(url).status_code == 200
        assert client_for(scene.cashier).get(url).status_code == 200

    def test_another_centers_staff_gets_404_not_403(self):
        scene = Scene()
        other_center, other_director = make_center_with_director()

        response = client_for(other_director).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        assert response.status_code == 404

    def test_the_unpaid_queue_never_hands_out_a_phone_number(
        self, django_capture_on_commit_callbacks
    ):
        scene = Scene()
        scene.age_invoice(60)
        _run_unpaid(django_capture_on_commit_callbacks)

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        (row,) = response.data["results"]
        assert row["guardian_reachable"] is True
        assert scene.guardian_user.phone not in str(row)
        assert scene.patient.phone not in str(row)
        assert row["patient_phone_masked"].endswith("55")
        assert row["reminders_sent"] == 1
        assert row["reminders_exhausted"] is False
        assert row["last_contact_at"] is not None

    def test_guardian_reachable_is_false_when_the_link_died(self):
        scene = Scene(link_status=GuardianLink.Status.REVOKED)

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        (row,) = response.data["results"]
        assert row["guardian_reachable"] is False

    def test_guardian_reachable_is_false_when_the_guardian_opted_out(self):
        """Honnêteté de la file : si aucun SMS ne peut partir, elle ne dit
        pas « oui »."""
        scene = Scene()
        scene.guardian.payment_reminders = False
        scene.guardian.save(update_fields=["payment_reminders", "updated_at"])

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        (row,) = response.data["results"]
        assert row["guardian_reachable"] is False

    def test_the_unpaid_queue_shows_an_old_invoice_that_no_window_would_keep(
        self,
    ):
        """Un impayé est un ÉTAT, pas un événement : la facture de l'an
        dernier est exactement celle qu'il faut voir."""
        scene = Scene()
        scene.age_invoice(400)

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
        )

        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["age_days"] == 400

    def test_an_unknown_ordering_is_400(self):
        scene = Scene()

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
            "?ordering=montant"
        )

        assert response.status_code == 400
        assert "ordering" in response.data

    def test_the_missed_queue_carries_no_clinical_nor_operational_reason(self):
        center, _director = make_center_with_director()
        staff = make_staff_user(center, role="secretaire")
        patient = make_patient(created_by_center=center, phone="+2693441111")
        make_appointment(
            patient=patient, center=center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
            reason="Suivi grossesse",
        )

        response = client_for(staff).get(
            f"/api/v1/centers/{center.pk}/crm/missed-appointments/"
        )

        (row,) = response.data["results"]
        assert "reason" not in row
        assert "Suivi grossesse" not in str(row)
        assert row["rebooked"] is False

    def test_the_missed_queue_never_shows_another_centers_appointment(self):
        center, director = make_center_with_director()
        other_center, _other = make_center_with_director()
        patient = make_patient(created_by_center=other_center)
        make_appointment(
            patient=patient, center=other_center,
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Appointment.Status.MISSED,
        )

        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/crm/missed-appointments/"
        )

        assert response.data["results"] == []


# ---------------------------------------------------------------------------
# 6 — Journalisation d'un contact HUMAIN : listes fermées, zéro texte
# ---------------------------------------------------------------------------


class TestLoggingAHumanContact:
    def _url(self, center):
        return f"/api/v1/centers/{center.pk}/crm/contacts/"

    def test_a_cashier_logs_a_call_about_an_unpaid_invoice(self):
        scene = Scene()

        response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "promesse_de_reglement",
             "invoice": scene.invoice.pk},
            format="json",
        )

        assert response.status_code == 201, response.data
        line = ContactLog.objects.get()
        assert line.created_by_id == scene.cashier.pk
        assert line.patient_id == scene.patient.pk
        assert line.outcome == "promesse_de_reglement"

    def test_a_nurse_may_log_a_recontact_but_not_an_unpaid_relance(self):
        scene = Scene()
        appointment = _missed(scene.center, scene.patient)

        allowed = client_for(scene.nurse).post(
            self._url(scene.center),
            {"kind": "reprise_contact", "channel": "appel",
             "recipient": "patient", "outcome": "sans_reponse",
             "appointment": appointment.pk},
            format="json",
        )
        refused = client_for(scene.nurse).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "joint",
             "invoice": scene.invoice.pk},
            format="json",
        )

        assert allowed.status_code == 201, allowed.data
        assert refused.status_code == 403

    def test_the_sms_channel_is_refused(self):
        scene = Scene()

        response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "sms",
             "recipient": "tuteur", "outcome": "joint",
             "invoice": scene.invoice.pk},
            format="json",
        )

        assert response.status_code == 400

    def test_a_manual_line_never_burns_the_automatic_cadence(
        self, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Le compteur ne regarde que les lignes SMS : un appel journalisé
        n'empêche pas l'automate de faire son travail."""
        scene = Scene()
        client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "sans_reponse",
             "invoice": scene.invoice.pk},
            format="json",
        )
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1

    def test_a_mismatched_reference_is_400_per_field(self):
        scene = Scene()
        appointment = _missed(scene.center, scene.patient)

        response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "joint",
             "appointment": appointment.pk},
            format="json",
        )

        assert response.status_code == 400
        assert "invoice" in response.data

    def test_a_foreign_invoice_and_a_ghost_invoice_answer_the_SAME_400(self):
        """Norme S1 : référence dans le CORPS → 400, messages
        byte-identiques (rien à sonder)."""
        scene = Scene()
        other_center, _other = make_center_with_director()
        foreign = make_invoice(
            encounter=make_encounter(center=other_center)
        )

        foreign_response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "joint", "invoice": foreign.pk},
            format="json",
        )
        ghost_response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "joint", "invoice": 9_999_999},
            format="json",
        )

        assert foreign_response.status_code == ghost_response.status_code == 400
        assert str(foreign_response.data) == str(ghost_response.data)

    def test_an_unknown_outcome_is_refused(self):
        scene = Scene()

        response = client_for(scene.cashier).post(
            self._url(scene.center),
            {"kind": "relance_impaye", "channel": "appel",
             "recipient": "patient", "outcome": "il_a_promis_lundi",
             "invoice": scene.invoice.pk},
            format="json",
        )

        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 7 — Ce que le modèle N'A PAS (décision 3), et ce qu'il refuse
# ---------------------------------------------------------------------------


class TestTheAbsencesAreDecisions:
    def test_no_free_text_field_exists_anywhere_on_the_model(self):
        """Patron S8 (« aucune valeur financière ») : un futur champ de
        note sera un choix conscient, pas un glissement. Une note d'appel
        dans un dossier patient finit toujours par contenir du clinique, et
        ce module n'est gardé par aucun rôle clinique."""
        from django.db import models as django_models

        free_text = [
            field.name
            for field in ContactLog._meta.get_fields()
            if isinstance(field, (django_models.TextField, django_models.CharField))
            and not getattr(field, "choices", None)
        ]
        assert free_text == [], free_text

    def test_the_model_carries_no_guardian_reference(self):
        names = {field.name for field in ContactLog._meta.get_fields()}
        assert "guardian" not in names
        assert "guardian_link" not in names

    def test_the_table_is_append_only(self):
        from apps.common.models import AppendOnlyError

        scene = Scene()
        line = ContactLog.objects.create(
            center=scene.center, patient=scene.patient,
            kind=ContactLog.Kind.UNPAID_REMINDER,
            channel=ContactLog.Channel.CALL,
            recipient=ContactLog.Recipient.PATIENT,
            invoice=scene.invoice, outcome=ContactLog.Outcome.REACHED,
        )

        with pytest.raises(AppendOnlyError):
            line.outcome = ContactLog.Outcome.NO_ANSWER
            line.save()
        with pytest.raises(AppendOnlyError):
            line.delete()
        with pytest.raises(AppendOnlyError):
            ContactLog.objects.all().update(outcome="")

    def test_a_line_can_never_be_anchored_across_tenants(self):
        from django.core.exceptions import ValidationError

        scene = Scene()
        other_center, _other = make_center_with_director()

        with pytest.raises(ValidationError):
            ContactLog.objects.create(
                center=other_center, patient=scene.patient,
                kind=ContactLog.Kind.UNPAID_REMINDER,
                channel=ContactLog.Channel.CALL,
                recipient=ContactLog.Recipient.PATIENT,
                invoice=scene.invoice,
            )

    def test_a_line_can_never_be_anchored_to_another_patients_invoice(self):
        from django.core.exceptions import ValidationError

        scene = Scene()
        other_patient = make_patient(created_by_center=scene.center)

        with pytest.raises(ValidationError):
            ContactLog.objects.create(
                center=scene.center, patient=other_patient,
                kind=ContactLog.Kind.UNPAID_REMINDER,
                channel=ContactLog.Channel.CALL,
                recipient=ContactLog.Recipient.PATIENT,
                invoice=scene.invoice,
            )


# ---------------------------------------------------------------------------
# 8 — Sondes structurelles : gel, journal, routes
# ---------------------------------------------------------------------------


class TestTheStructuralGuards:
    APPS_ROOT = pathlib.Path(__file__).resolve().parents[1] / "apps"

    def test_no_module_of_the_app_imports_the_freeze_guard(self):
        """Sonde MIROIR de la sonde fail-closed S5 (patron S8/S9) : elle dit
        ICI, dans le fichier du sprint, pourquoi la garde est absente.

        Relancer un impayé recouvre les CRÉANCES DU CENTRE : geler ce geste
        ferait perdre de l'argent au centre pour une dette envers Chioni, et
        pénaliserait au passage un patient et un tuteur qui n'y sont pour
        rien. Recontacter après un rendez-vous manqué est un geste de
        continuité de soin.
        """
        offenders = []
        for path in (self.APPS_ROOT / "crm").rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.ImportFrom) and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                ):
                    offenders.append(path.name)
            if "require_center_can_administer(" in source:
                offenders.append(path.name)
        assert not offenders, offenders

    def test_the_s5_importer_list_is_UNCHANGED_by_s10(self):
        from .test_adversarial_s5 import (
            TestTheFreezeIsStructurallyBoundedToAdministration as Probe,
        )

        assert Probe.ALLOWED_IMPORTERS == {
            "centers/services.py", "centers/stats_views.py", "hrm/services.py",
        }

    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_a_frozen_center_is_still_relanced_and_still_recontacts(
        self, status, sms_outbox, django_capture_on_commit_callbacks
    ):
        from .factories import make_subscription

        scene = Scene()
        make_subscription(
            center=scene.center, status=status,
            status_reason="Facture A-000012 impayée depuis 60 jours.",
        )
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1
        assert (
            client_for(scene.cashier).get(
                f"/api/v1/centers/{scene.center.pk}/crm/unpaid-followups/"
            ).status_code
            == 200
        )

    @pytest.mark.parametrize("kyc", ["en_attente", "suspendu"])
    def test_a_center_off_the_diaspora_rail_still_works_its_queues(
        self, kyc, sms_outbox, django_capture_on_commit_callbacks
    ):
        from apps.centers.models import HealthCenter

        scene = Scene()
        HealthCenter.objects.filter(pk=scene.center.pk).update(kyc_status=kyc)
        scene.age_invoice(60)

        assert _run_unpaid(django_capture_on_commit_callbacks) == 1

    def test_no_crm_action_ever_reaches_the_director_journal(self):
        """Un journal qui listerait « le centre a relancé le patient #42 »
        serait un registre de comportement de paiement — même famille que
        l'exclusion des actions cliniques et de ``availability.*`` (S9).

        Ce module n'écrit d'ailleurs AUCUNE entrée d'audit : ``ContactLog``
        EST sa trace.
        """
        from apps.audit.models import AuditLog

        scene = Scene()
        before = AuditLog.objects.count()
        client_for(scene.cashier).post(
            f"/api/v1/centers/{scene.center.pk}/crm/contacts/",
            {"kind": "relance_impaye", "channel": "guichet",
             "recipient": "patient", "outcome": "joint",
             "invoice": scene.invoice.pk},
            format="json",
        )

        assert AuditLog.objects.count() == before

    def test_the_module_exposes_no_route_outside_the_tenant(self):
        from apps.crm import urls as crm_urls

        for pattern in crm_urls.urlpatterns:
            route = str(pattern.pattern)
            assert route.startswith("centers/"), route
            assert not route.startswith(
                ("patients/", "guardian/", "platform/", "pharmacy/")
            ), route

    def test_the_app_writes_nothing_into_the_ledger(self):
        """Étanchéité : relancer n'est pas encaisser."""
        forbidden = (
            "record_cash_payment", "reverse_cash_payment",
            "LedgerTransaction", "LedgerEntry",
        )
        for path in (self.APPS_ROOT / "crm").rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            for name in forbidden:
                assert name not in source, f"{path.name} → {name}"
