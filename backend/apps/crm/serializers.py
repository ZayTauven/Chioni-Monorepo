"""Sérialiseurs des files de travail (S10 lot 2 — ADR 0023).

Champs EXPLICITES partout, jamais ``fields = "__all__"``. Deux règles
gouvernent ces payloads, et elles sont testées :

1. **Aucune donnée clinique.** Le ``reason`` d'un rendez-vous est un motif
   OPÉRATIONNEL (ADR 0013) mais il n'a rien à faire dans une file de
   relance, et le diagnostic, l'ordonnance, la catégorie générique d'un
   acte n'y entrent évidemment pas. La file dit **qui rappeler et pour
   quel objet**, jamais pourquoi la personne était venue.
2. **Aucun téléphone.** La file des impayés rend un BOOLÉEN « un proche
   peut recevoir la relance », jamais un numéro : une vue de masse ne
   devient pas un annuaire moissonnable (même posture que
   ``invoices/unpaid/`` depuis la vague 2b). Le numéro du patient reste
   MASQUÉ, comme partout ailleurs — le guichet confirme une identité d'un
   coup d'œil, il ne recopie pas un carnet d'adresses.
"""

from rest_framework import serializers

from apps.crm.models import ContactLog
from apps.patients.serializers import _mask_phone
from apps.scheduling.models import Appointment
from apps.trustbridge.models import Invoice


class UnpaidFollowupSerializer(serializers.ModelSerializer):
    """Une ligne de la file « à relancer » (rôles BILLING).

    Les soldes lisent les annotations SQL portées par
    ``services.unpaid_followup_rows`` (miroir ensembliste de
    ``invoice_balance_kmf``) — jamais les helpers par ligne, qui
    re-requêteraient les encaissements pour chaque facture (N+1).
    """

    patient_name = serializers.SerializerMethodField()
    patient_phone_masked = serializers.SerializerMethodField()
    balance_kmf = serializers.SerializerMethodField()
    paid_kmf = serializers.SerializerMethodField()
    age_days = serializers.SerializerMethodField()
    reminders_sent = serializers.SerializerMethodField()
    last_contact_at = serializers.SerializerMethodField()
    last_outcome = serializers.SerializerMethodField()
    guardian_reachable = serializers.SerializerMethodField()
    reminders_exhausted = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id", "patient", "patient_name", "patient_phone_masked",
            "total_kmf", "paid_kmf", "balance_kmf", "age_days", "created_at",
            "reminders_sent", "reminders_exhausted", "last_contact_at",
            "last_outcome", "guardian_reachable",
        ]
        read_only_fields = fields

    def get_patient_name(self, invoice) -> str:
        patient = invoice.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_patient_phone_masked(self, invoice) -> str:
        phone = invoice.patient.phone
        return _mask_phone(phone) if phone else ""

    def get_paid_kmf(self, invoice) -> str:
        return str(invoice.paid_kmf_agg)

    def get_balance_kmf(self, invoice) -> str:
        return str(invoice.balance_kmf_agg)

    def get_age_days(self, invoice) -> int:
        from django.utils import timezone

        created_day = timezone.localtime(invoice.created_at).date()
        return (timezone.localdate() - created_day).days

    def get_reminders_sent(self, invoice) -> int:
        return invoice.reminders_sent_agg or 0

    def get_reminders_exhausted(self, invoice) -> bool:
        """La cadence automatique est-elle épuisée ?

        Rendu explicitement plutôt que laissé à déduire côté frontend : ce
        booléen est ce qui dit à l'équipe « l'automate ne fera plus rien,
        à vous de jouer ». Une file de travail qui laisse croire qu'un
        robot s'en occupe encore ne sert à rien.
        """
        from apps.crm.services import UNPAID_REMINDER_OFFSETS_DAYS

        return (invoice.reminders_sent_agg or 0) >= len(
            UNPAID_REMINDER_OFFSETS_DAYS
        )

    def get_last_contact_at(self, invoice):
        return invoice.last_contact_at_agg

    def get_last_outcome(self, invoice) -> str:
        return invoice.last_outcome_agg or ""

    def get_guardian_reachable(self, invoice) -> bool:
        """Un proche peut-il RECEVOIR la relance automatique ?

        Vrai quand il existe un partage vivant : lien ACTIF, relances non
        refusées, téléphone renseigné. Honnête par construction — si le
        booléen disait « oui » là où aucun SMS ne peut partir, la file
        mentirait au caissier.
        """
        return bool(invoice.guardian_reachable_agg)


class MissedAppointmentFollowupSerializer(serializers.ModelSerializer):
    """Une ligne de la file « à recontacter » (TOUT staff actif).

    ``reason`` est **absent volontairement** : ce champ est le motif de
    guichet, lisible sur la fiche du rendez-vous par qui en a besoin ; une
    file de rappel n'a pas à l'étaler, et la frontière avec le clinique est
    d'autant plus nette qu'on ne la frôle pas.
    """

    patient_name = serializers.SerializerMethodField()
    patient_phone_masked = serializers.SerializerMethodField()
    contacted_at = serializers.SerializerMethodField()
    last_outcome = serializers.SerializerMethodField()
    rebooked = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_name", "patient_phone_masked",
            "scheduled_at", "contacted_at", "last_outcome", "rebooked",
        ]
        read_only_fields = fields

    def get_patient_name(self, appointment) -> str:
        patient = appointment.patient
        return f"{patient.first_name} {patient.last_name}".strip()

    def get_patient_phone_masked(self, appointment) -> str:
        phone = appointment.patient.phone
        return _mask_phone(phone) if phone else ""

    def get_contacted_at(self, appointment):
        return appointment.contacted_at_agg

    def get_last_outcome(self, appointment) -> str:
        return appointment.last_outcome_agg or ""

    def get_rebooked(self, appointment) -> bool:
        return bool(appointment.rebooked_agg)


class ContactLogSerializer(serializers.ModelSerializer):
    """Une trace de contact rendue au staff — références et codes.

    ``created_by`` est un ID nu : la file n'a pas à résoudre un nom (le
    directeur lit l'annuaire du personnel, qui est sa propre porte). NULL
    se lit « l'automate ».
    """

    created_by = serializers.IntegerField(source="created_by_id", read_only=True)

    class Meta:
        model = ContactLog
        fields = [
            "id", "patient", "kind", "channel", "recipient",
            "invoice", "appointment", "outcome", "created_by", "created_at",
        ]
        read_only_fields = fields


class ContactLogCreateSerializer(serializers.Serializer):
    """Journalisation d'un contact HUMAIN — listes fermées, zéro texte.

    ``Serializer`` nu plutôt que ``ModelSerializer`` : la liste des champs
    acceptés est celle de l'ADR, jamais « tout ce que le modèle porte ».
    Le canal ``sms`` est absent des choix — un SMS n'est pas un geste qu'on
    journalise, c'est un envoi, et le seul chemin d'envoi est l'automate
    (décision 3 : personne, dans aucun écran, ne compose de message).
    """

    #: Les canaux HUMAINS. ``sms`` est délibérément hors de cette liste.
    HUMAN_CHANNELS = (ContactLog.Channel.CALL, ContactLog.Channel.DESK)

    kind = serializers.ChoiceField(choices=ContactLog.Kind.choices)
    channel = serializers.ChoiceField(choices=HUMAN_CHANNELS)
    recipient = serializers.ChoiceField(choices=ContactLog.Recipient.choices)
    outcome = serializers.ChoiceField(
        choices=ContactLog.Outcome.choices, required=True
    )
    invoice = serializers.IntegerField(required=False, allow_null=True)
    appointment = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        """L'appariement motif ↔ objet, refusé en 400 explicite par champ.

        La base porte la même contrainte (``ContactLog.Meta``), mais elle
        ne sait dire qu'un message opaque : c'est ici que l'API l'explique.
        """
        from apps.crm.services import MANUAL_CONTACT_REFERENCE

        expected = MANUAL_CONTACT_REFERENCE[attrs["kind"]]
        other = "appointment" if expected == "invoice" else "invoice"
        if not attrs.get(expected):
            raise serializers.ValidationError(
                {expected: ["Cette référence est obligatoire pour ce motif."]}
            )
        if attrs.get(other):
            raise serializers.ValidationError(
                {other: ["Cette référence ne correspond pas au motif choisi."]}
            )
        return attrs
