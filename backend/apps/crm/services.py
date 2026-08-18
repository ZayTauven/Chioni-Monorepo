"""Services des relances — le SEUL chemin d'écriture (S10 lot 2, ADR 0023).

Même discipline que partout : les vues ne touchent pas l'ORM, les services
rejouent ``save()``, prennent les verrous qui rendent une décision
sérialisable, et écrivent leur trace dans la même transaction.

**Hiérarchie de verrous — deux chaînes COURTES et DISJOINTES**
(ADR 0023, décisions transverses) ::

    facture      → ContactLog
    rendez-vous  → ContactLog

Aucune n'entre par le milieu dans la chaîne de l'argent
(``utilisateur → intent → demande → facture → centre``) : ce module ne
verrouille jamais un intent, une demande, un centre ni un utilisateur, et
il **n'écrit pas un franc**. Il lit un solde et il envoie un SMS.

**L'anti-doublon, ce sont les LIGNES de ``ContactLog``, relues sous le
verrou de l'objet relancé.** Il n'y a pas de compteur mutable ici : le
compteur non verrouillé de ``send_subscription_payment_reminders`` avait
produit un double envoi réel en S5, et le guardian avait noté que
``send_appointment_reminders`` avait « exactement la même forme » (dette
soldée par S10 dans ``apps/scheduling/services.py``). Le SMS part par
``transaction.on_commit`` **à l'intérieur** de la transaction qui écrit la
ligne : un rollback n'envoie rien et laisse l'objet re-éligible, un commit
garantit que la trace existe avant que le message ne parte.

**Rien n'est gelé, rien n'est gardé par le KYC** (décision transverse) :
``require_center_can_administer`` n'est importé nulle part dans
``apps.crm`` et ne doit jamais l'être — la relance d'impayé recouvre les
CRÉANCES DU CENTRE (la geler ferait perdre de l'argent au centre pour une
dette envers Chioni, et pénaliserait au passage un patient et un tuteur qui
n'y sont pour rien), et la reprise de contact après un rendez-vous manqué
est un geste de continuité de soin. Réserve honnête consignée dans l'ADR :
le coût des SMS d'un tenant suspendu est assumé ; si le sujet devient réel,
la garde s'ajoute dans la TÂCHE, jamais dans le service.

Audit : **aucune entrée par SMS**. ``ContactLog`` EST la trace des
relances ; un ``AuditLog`` par message noierait le journal sans rien
apprendre (ADR 0023, décisions transverses).
"""

import logging
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Exists, Max, OuterRef, Subquery
from django.utils import timezone

from apps.centers.models import HealthCenter
from apps.common.notifications import (
    _guardian_phone,
    _patient_phone,
    notify_missed_appointment_followup,
    notify_unpaid_invoice_reminder,
)
from apps.crm.models import ContactLog
from apps.patients.models import GuardianLink, patient_accepts
from apps.scheduling.models import Appointment
from apps.trustbridge.models import Invoice, PaymentRequest, PaymentRequestShare
from apps.trustbridge.services import invoice_balance_kmf, unpaid_invoices_qs

logger = logging.getLogger("chioni.crm")

Kind = ContactLog.Kind
Channel = ContactLog.Channel
Recipient = ContactLog.Recipient

#: Cadence des relances d'impayé, en jours depuis la CRÉATION de la facture
#: — puis SILENCE DÉFINITIF. Trois messages, espacés de plus en plus : aux
#: Comores, une famille réunit une somme en plusieurs semaines, et au
#: quatrième SMS ce n'est plus une relance, c'est de la pression. À ce
#: stade, c'est un appel du guichet qui règle l'affaire — et la file de
#: travail est précisément là pour ça.
#:
#: **Réserve d'honnêteté (ADR 0023)** : ``Invoice`` ne stocke AUCUN
#: horodatage d'émission (limitation déjà consignée pour ``stats/finances``
#: dans l'addendum ADR 0015). La cadence s'ancre donc sur ``created_at``,
#: ce qui est exact dans la pratique réelle (une facture est émise dans la
#: foulée de sa création) et faux pour un brouillon oublié trois semaines.
#: Écart documenté, réversible par un champ ``issued_at`` le jour où il gêne.
UNPAID_REMINDER_OFFSETS_DAYS = (7, 14, 30)

#: Fenêtre de rattrapage de la reprise de contact, en jours locaux avant
#: aujourd'hui. Le message part normalement le LENDEMAIN du rendez-vous
#: manqué ; la fenêtre absorbe une panne de beat de quelques jours sans
#: jamais réveiller un absent de l'an dernier (ADR 0023 décision 5).
MISSED_FOLLOWUP_WINDOW_DAYS = 7

#: **Le plafond qui compte : celui de la PERSONNE** (revue guardian S10).
#:
#: La cadence de :data:`UNPAID_REMINDER_OFFSETS_DAYS` borne le nombre de
#: messages PAR FACTURE. Elle ne borne rien du tout pour l'humain qui les
#: reçoit : trois factures impayées d'une même patiente créées le même jour
#: — deux consultations et une hospitalisation, ce qui est la vie normale
#: d'un centre — faisaient partir TROIS SMS **byte-identiques** le même
#: matin sur le téléphone du même proche. Le risque directeur de l'ADR 0023
#: est nommé ainsi : « une relance répétée devient du harcèlement ; la
#: différence entre un service et une pression tient dans un compteur borné
#: et dans une porte de sortie ». Un compteur qui borne l'objet et non la
#: personne n'est pas ce compteur-là.
#:
#: Deux gardes, et elles ne brûlent JAMAIS la cadence d'une facture : une
#: facture écartée par le plafond de la personne n'écrit aucune ligne, donc
#: elle reste éligible au passage suivant (même discipline que « aucun
#: proche joignable »).
#:
#: Portée **transverse aux centres**, assumée : ce qui sort de
#: l'application, c'est un SMS sur le téléphone d'un humain, et ce
#: téléphone ne sait pas ce qu'est un tenant. Une personne suivie par deux
#: centres voit sa seconde relance décalée de quelques jours ; elle ne
#: reçoit pas deux fois la même phrase le même matin.
UNPAID_REMINDER_PATIENT_GAP_DAYS = 7

#: Idem pour la reprise de contact : trois rendez-vous manqués dans la
#: fenêtre envoyaient trois fois le MÊME texte générique. Un seul suffit —
#: il ne nomme ni le rendez-vous, ni le motif, ni le centre.
MISSED_FOLLOWUP_PATIENT_GAP_DAYS = 3

#: Les statuts de demande de paiement pour lesquels une RELANCE a un sens.
#:
#: Deux exclusions, et chacune ferme une couture entre sprints :
#:
#: - ``brouillon`` — ``share_payment_request`` autorise le partage d'une
#:   demande non envoyée, et le produit reste alors **délibérément muet**
#:   (``notify_payment_request_share_added`` : « un partage en brouillon
#:   reste muet jusqu'à l'envoi »). Sans cette exclusion, le tout premier
#:   SMS qu'un proche recevrait au sujet de cette facture serait une
#:   RELANCE d'une demande qu'on ne lui a jamais adressée ;
#: - ``litige`` — une contestation est ouverte sur cet argent. ``S1`` a
#:   fermé le rail diaspora sur une facture annulée, et ``cancel_invoice``
#:   refuse d'ailleurs d'annuler tant qu'une demande est en litige : le
#:   rail RELANCE doit se fermer sur la même règle. Relancer « il reste
#:   7 500 KMF à régler » quelqu'un qui vient d'écrire « ce soin n'a pas eu
#:   lieu » est le contraire du service.
#:
#: Les statuts postérieurs à l'envoi restent éligibles : un règlement
#: partiel peut laisser un solde, et le proche a bien été sollicité.
REMINDABLE_REQUEST_STATUSES = (
    PaymentRequest.Status.SENT,
    PaymentRequest.Status.PAID,
    PaymentRequest.Status.CARE_CONFIRMED,
    PaymentRequest.Status.CLOSED,
)


def _local_day(moment):
    return timezone.localtime(moment).date()


def _day_start(day):
    return timezone.make_aware(datetime.combine(day, time.min))


# ---------------------------------------------------------------------------
# Journalisation d'un contact — le geste HUMAIN (guichet, téléphone)
# ---------------------------------------------------------------------------


@transaction.atomic
def log_contact(
    *, actor, center, patient, kind, channel, recipient,
    invoice=None, appointment=None, outcome="",
):
    """Journaliser un contact effectué par un humain.

    Les rattachements (facture, rendez-vous) sont revérifiés par
    ``ContactLog.save()``, **en base** : le service ne fait pas confiance
    aux objets qu'on lui tend. Le canal ``sms`` est refusé ici — un SMS
    n'est pas un geste que le guichet « journalise », c'est un envoi, et le
    seul chemin d'envoi est l'automate (décision 3 : personne ne compose de
    message).

    Aucun texte libre n'entre : ``outcome`` est une liste fermée, et le
    modèle ne porte pas d'autre champ.
    """
    if channel == Channel.SMS:
        raise ValidationError(
            "Le canal SMS est réservé aux relances automatiques : "
            "journalisez un appel ou un passage au guichet."
        )
    if kind not in Kind.values:
        raise ValidationError("Motif de contact inconnu.")
    if channel not in Channel.values:
        raise ValidationError("Canal de contact inconnu.")
    if recipient not in Recipient.values:
        raise ValidationError("Destinataire de contact inconnu.")
    if outcome and outcome not in ContactLog.Outcome.values:
        raise ValidationError("Issue de contact inconnue.")
    return ContactLog.objects.create(
        center=center,
        patient=patient,
        kind=kind,
        channel=channel,
        recipient=recipient,
        invoice=invoice,
        appointment=appointment,
        outcome=outcome,
        created_by=actor,
    )


# ---------------------------------------------------------------------------
# Relance d'impayé — AU TUTEUR SEUL (arbitrage PO n° 1, décision 2)
# ---------------------------------------------------------------------------


def reminder_reachable_links(invoice):
    """Les liens de tutelle qui peuvent RECEVOIR la relance de cette facture.

    Cinq conditions cumulatives, et chacune a sa raison :

    1. le tuteur s'est vu **partager** une demande de paiement de cette
       facture (``PaymentRequestShare``) — sans partage, il n'a jamais eu
       accès à cette dette et un SMS la lui révélerait ;
    2. cette demande a été **ENVOYÉE** et n'est **pas en litige**
       (:data:`REMINDABLE_REQUEST_STATUSES`) — on ne relance pas une
       sollicitation qui n'a jamais eu lieu, ni un argent contesté ;
    3. le lien est **ACTIF au moment de l'envoi** (règle de l'événement 4,
       inchangée : un partage peut survivre à son lien — révocation par le
       patient, suspension en attente de confirmation du titulaire — mais
       le SMS ne le doit pas) ;
    4. le tuteur n'a **pas refusé les relances**
       (``GuardianProfile.payment_reminders``, ADR 0023 décision 1) ;
    5. il a un **téléphone**.

    Un patient sans tuteur joignable ne reçoit donc RIEN : son impayé vit
    dans la file du guichet, et c'est un humain qui appelle. C'est le prix
    de l'arbitrage n° 1, et il est assumé.

    **Relue SOUS LE VERROU de la facture** par l'appelant (revue guardian
    S10) : lue en amont, elle laissait partir le montant vers un lien
    révoqué dans l'intervalle — or l'ADR promet « encore ACTIF au moment
    de l'envoi », pas « actif quelques instants plus tôt ».
    """
    links = (
        GuardianLink.objects.filter(
            status=GuardianLink.Status.ACTIVE,
            payment_request_shares__payment_request__invoice=invoice,
            payment_request_shares__payment_request__status__in=(
                REMINDABLE_REQUEST_STATUSES
            ),
            guardian__payment_reminders=True,
        )
        .select_related("guardian__user")
        .distinct()
        .order_by("pk")
    )
    return [link for link in links if _guardian_phone(link.guardian)]


def invoice_has_open_dispute(invoice) -> bool:
    """Une contestation est-elle ouverte sur l'argent de cette facture ?

    Le filtre de :func:`reminder_reachable_links` écarte déjà la demande
    litigieuse ELLE-MÊME ; celui-ci écarte la FACTURE entière. La nuance
    compte : une facture peut porter plusieurs demandes, et relancer par la
    porte d'à côté un argent dont une partie est contestée serait pire que
    de se taire. Miroir exact de ``cancel_invoice``, qui refuse d'annuler
    tant qu'une demande est en ``litige``.
    """
    return invoice.payment_requests.filter(
        status=PaymentRequest.Status.DISPUTED
    ).exists()


def _unpaid_reminder_state(invoice):
    """``(vagues déjà parties, date locale de la dernière)`` sur ``invoice``.

    Une ligne = **une vague**, pas un destinataire : deux proches partagés
    reçoivent le même message et cela reste UN contact (le modèle ne porte
    pas de lien tuteur — ADR 0023 décision 4). Compter les destinataires
    ferait dépendre la cadence du nombre de proches, ce qui n'aurait aucun
    sens : quelqu'un avec trois enfants à l'étranger serait « relancé trois
    fois » d'un seul coup, puis plus jamais.

    Seules les lignes **SMS automatiques** comptent : un appel journalisé
    par le guichet est une information pour l'équipe, pas une consommation
    de la cadence de l'automate.
    """
    rows = ContactLog.objects.filter(
        invoice=invoice, kind=Kind.UNPAID_REMINDER, channel=Channel.SMS
    ).aggregate(n=Count("pk"), last=Max("created_at"))
    last = rows["last"]
    return rows["n"] or 0, (_local_day(last) if last else None)


def _wave_is_due(*, index, age_days, last_wave_day, today) -> bool:
    """La vague n° ``index`` est-elle due aujourd'hui ?

    DEUX conditions, et la seconde est ce qui distingue une cadence d'une
    rafale :

    1. **l'ancienneté** de la facture atteint le palier
       :data:`UNPAID_REMINDER_OFFSETS_DAYS` — c'est l'ancrage de l'ADR ;
    2. **l'espacement** depuis la vague précédente atteint l'écart prévu
       entre les deux paliers (7 puis 16 jours).

    Sans la seconde, une facture découverte tardivement — un impayé de
    soixante jours, un beat rétabli après une panne, un centre qui arrive
    sur Chioni avec son historique — rattraperait ses TROIS relances en
    trois exécutions rapprochées, c'est-à-dire potentiellement dans la même
    journée. Ce serait exactement le harcèlement que la décision 2 nomme
    comme risque directeur, et le compteur borné n'y suffirait pas : il
    borne le NOMBRE, pas le RYTHME.
    """
    if age_days < UNPAID_REMINDER_OFFSETS_DAYS[index]:
        return False
    if index == 0:
        return True
    required_gap = (
        UNPAID_REMINDER_OFFSETS_DAYS[index]
        - UNPAID_REMINDER_OFFSETS_DAYS[index - 1]
    )
    if last_wave_day is None:
        # Impossible en pratique (index > 0 implique une ligne), mais on ne
        # devine pas : sans date de référence, on attend le passage suivant.
        return False
    return (today - last_wave_day).days >= required_gap


def send_unpaid_invoice_reminders(*, today=None):
    """Relances SMS des factures de soins impayées — AU TUTEUR SEUL.

    Éligibilité : facture ``emise`` à solde positif (dérivation
    ``unpaid_invoices_qs`` — la mirror ensembliste de
    ``invoice_balance_kmf``, jamais réinventée ici), ancienneté atteignant
    le prochain palier de :data:`UNPAID_REMINDER_OFFSETS_DAYS`, au plus UNE
    vague par facture et par exécution, puis silence définitif.

    La facture est **relue sous verrou** avant l'écriture : le solde peut
    avoir été réglé entre la sélection et l'envoi (relancer sur une somme
    déjà payée serait faux et vexant — leçon S5, même remède), la facture
    peut avoir été annulée, et surtout une exécution concurrente peut avoir
    pris cette vague. Le compte des lignes est recalculé SOUS ce verrou :
    c'est lui, et lui seul, qui rend l'anti-doublon réel.

    Le montant relancé est le **SOLDE RESTANT**, jamais ``total_kmf``.

    Retourne le nombre de vagues programmées.
    """
    today = today or timezone.localdate()
    waves = 0
    #: Le plafond de la PERSONNE, dans l'exécution courante : une facture
    #: qui vient de faire partir une vague ferme la porte à ses sœurs du
    #: même dossier, y compris dans un autre centre parcouru plus loin.
    #: La garde de base (le plafond annoté ``patient_last_wave_at_agg``,
    #: revue guardian S10 : toutes factures et TOUS CENTRES confondus) ne
    #: verrait pas encore la ligne d'une transaction commitée dans la même
    #: boucle si deux exécutions se chevauchaient — ce set, lui, est
    #: infaillible à l'intérieur d'un passage.
    served_patients = set()
    for center in HealthCenter.objects.order_by("pk"):
        # SV (volumétrie) — le PRÉ-FILTRE de cadence tient désormais en UNE
        # requête par centre : l'état de cadence (compte de vagues +
        # dernière vague) et le plafond de la personne sont annotés en SQL
        # sur la sélection, au lieu de 2 requêtes PAR FACTURE. La
        # SÉMANTIQUE est inchangée : ces lectures restent le pré-filtre de
        # confort, LA décision qui fait foi reste la relecture SOUS VERROU
        # plus bas, et le pré-filtre « un proche joignable » reste l'APPEL
        # à :func:`reminder_reachable_links` — il ne concerne que les
        # factures DUES (rares), et les sondes S10 verrouillent son
        # architecture en deux temps (pré-filtre puis relecture sous
        # verrou).
        wave_logs = ContactLog.objects.filter(
            invoice=OuterRef("pk"), kind=Kind.UNPAID_REMINDER,
            channel=Channel.SMS,
        ).order_by()
        patient_waves = ContactLog.objects.filter(
            patient_id=OuterRef("patient_id"), kind=Kind.UNPAID_REMINDER,
            channel=Channel.SMS,
        ).order_by()
        invoices = (
            unpaid_invoices_qs(center)
            .select_related("center", "patient")
            .annotate(
                wave_count_agg=Subquery(
                    wave_logs.values("invoice")
                    .annotate(n=Count("pk"))
                    .values("n")
                ),
                last_wave_at_agg=Subquery(
                    wave_logs.values("invoice")
                    .annotate(last=Max("created_at"))
                    .values("last")
                ),
                patient_last_wave_at_agg=Subquery(
                    patient_waves.values("patient")
                    .annotate(last=Max("created_at"))
                    .values("last")
                ),
            )
            .order_by("pk")
        )
        for invoice in invoices:
            if invoice.patient_id in served_patients:
                logger.debug(
                    "Relance d'impayé ignorée (déjà une vague pour cette "
                    "personne dans ce passage) : facture #%s.", invoice.pk,
                )
                continue
            index = invoice.wave_count_agg or 0
            last_wave_day = (
                _local_day(invoice.last_wave_at_agg)
                if invoice.last_wave_at_agg
                else None
            )
            if index >= len(UNPAID_REMINDER_OFFSETS_DAYS):
                continue
            age_days = (today - _local_day(invoice.created_at)).days
            if not _wave_is_due(
                index=index, age_days=age_days,
                last_wave_day=last_wave_day, today=today,
            ):
                continue
            patient_last_wave_day = (
                _local_day(invoice.patient_last_wave_at_agg)
                if invoice.patient_last_wave_at_agg
                else None
            )
            if not (
                patient_last_wave_day is None
                or (today - patient_last_wave_day).days
                >= UNPAID_REMINDER_PATIENT_GAP_DAYS
            ):
                # Cette personne a reçu une relance récemment, pour une
                # AUTRE facture. Rien n'est écrit : la cadence de celle-ci
                # n'est pas brûlée, elle repartira dans quelques jours.
                logger.debug(
                    "Relance d'impayé ignorée (plafond de la personne) : "
                    "facture #%s.", invoice.pk,
                )
                continue
            if not reminder_reachable_links(invoice):
                # Pré-filtre de CONFORT (aucun proche joignable) : il évite
                # de poser un verrou de ligne sur des milliers de factures
                # qui ne parleront à personne. La décision qui fait foi est
                # la relecture SOUS VERROU, plus bas. Sans cette sortie, la
                # facture brûlerait sa cadence en silence et ne serait plus
                # jamais relancée le jour où un tuteur arrive ; la file du
                # guichet, elle, la montre déjà. (SV : cet appel ne
                # concerne plus que les factures DUES — la cadence est
                # pré-filtrée par annotation, plus par requête par ligne.)
                logger.debug(
                    "Relance d'impayé ignorée (aucun proche joignable) : "
                    "facture #%s.", invoice.pk,
                )
                continue
            with transaction.atomic():
                locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
                balance = invoice_balance_kmf(locked)
                locked_index, _last = _unpaid_reminder_state(locked)
                if (
                    locked.status != Invoice.Status.ISSUED
                    or balance <= 0
                    or locked_index != index
                    or invoice_has_open_dispute(locked)
                ):
                    # Réglée, annulée, contestée, ou une exécution
                    # concurrente a pris cette vague : rien ne part, rien
                    # n'est écrit.
                    continue
                # LA lecture qui fait foi (revue guardian S10) : elle est
                # dans la transaction qui écrit la trace, donc un lien
                # révoqué entre la sélection et ici ne reçoit plus le
                # montant — « encore ACTIF au moment de l'envoi ».
                links = reminder_reachable_links(locked)
                if not links:
                    continue
                ContactLog.objects.create(
                    center=locked.center,
                    patient=locked.patient,
                    kind=Kind.UNPAID_REMINDER,
                    channel=Channel.SMS,
                    recipient=Recipient.GUARDIAN,
                    invoice=locked,
                    created_by=None,  # l'automate
                )
                for link in links:
                    notify_unpaid_invoice_reminder(
                        guardian_link=link, invoice=locked, balance_kmf=balance
                    )
            served_patients.add(invoice.patient_id)
            waves += 1
    return waves


# ---------------------------------------------------------------------------
# Reprise de contact après un rendez-vous manqué (décision 5)
# ---------------------------------------------------------------------------


def _recontact_gap_is_clear(patient_id, *, today) -> bool:
    """Cette personne a-t-elle été laissée tranquille assez longtemps ?

    Toute reprise de contact compte — l'automate ET le geste humain
    journalisé : si la secrétaire a appelé hier, un SMS générique
    aujourd'hui n'apprend rien à personne et se lit comme du harcèlement.
    Voir :data:`MISSED_FOLLOWUP_PATIENT_GAP_DAYS`.
    """
    last = (
        ContactLog.objects.filter(patient_id=patient_id, kind=Kind.RECONTACT)
        .aggregate(last=Max("created_at"))["last"]
    )
    if last is None:
        return True
    return (today - _local_day(last)).days >= MISSED_FOLLOWUP_PATIENT_GAP_DAYS


def _has_future_appointment(appointment) -> bool:
    """Le patient a-t-il déjà repris rendez-vous DANS CE CENTRE ?

    Relancer quelqu'un qui a déjà fait le geste est le meilleur moyen de
    lui apprendre à ignorer nos messages. Borné au centre : un rendez-vous
    pris ailleurs ne regarde pas celui-ci, et la requête ne doit rien
    révéler d'un autre tenant (ADR 0002).
    """
    return Appointment.objects.filter(
        center_id=appointment.center_id,
        patient_id=appointment.patient_id,
        status=Appointment.Status.SCHEDULED,
        scheduled_at__gte=timezone.now(),
    ).exists()


def send_missed_appointment_followups(*, today=None):
    """UN SMS neutre après un rendez-vous manqué — jamais répété.

    Éligibilité : rendez-vous au statut ``manque``, dont le créneau est
    PASSÉ et tombe dans la fenêtre de rattrapage
    (:data:`MISSED_FOLLOWUP_WINDOW_DAYS` jours locaux), dont aucune reprise
    de contact n'a encore été journalisée, dont le patient est joignable et
    n'a pas refusé ce canal, et **qui n'a pas déjà repris rendez-vous**
    dans le même centre.

    Le rendez-vous est **relu sous verrou** avant l'écriture, et le compte
    des lignes recalculé sous ce verrou : deux exécutions qui se
    chevauchent ne peuvent pas envoyer deux fois le message qui doit être
    unique. La garde « a déjà repris rendez-vous » est également rejouée
    sous le verrou — au mieux : elle porte sur une AUTRE ligne, donc la
    fenêtre résiduelle est celle d'une réservation à la microseconde, sans
    conséquence.

    Retourne le nombre de messages programmés.
    """
    today = today or timezone.localdate()
    window_start = _day_start(today - timedelta(days=MISSED_FOLLOWUP_WINDOW_DAYS))
    window_end = _day_start(today)
    eligible = (
        Appointment.objects.filter(
            status=Appointment.Status.MISSED,
            scheduled_at__gte=window_start,
            scheduled_at__lt=window_end,
        )
        .annotate(
            already_contacted=Exists(
                ContactLog.objects.filter(
                    appointment=OuterRef("pk"), kind=Kind.RECONTACT
                )
            )
        )
        .filter(already_contacted=False)
        .select_related("center", "patient__user")
        .order_by("scheduled_at", "id")
    )
    sent = 0
    served_patients = set()
    for appointment in eligible:
        if appointment.patient_id in served_patients:
            logger.debug(
                "Reprise de contact ignorée (déjà un message pour cette "
                "personne dans ce passage) : RDV #%s.", appointment.pk,
            )
            continue
        if not _patient_phone(appointment.patient):
            logger.debug(
                "Reprise de contact ignorée (patient sans téléphone) : RDV #%s.",
                appointment.pk,
            )
            continue
        if not _recontact_gap_is_clear(appointment.patient_id, today=today):
            # Trois absences dans la fenêtre envoyaient trois fois le MÊME
            # texte générique (revue guardian S10). Rien n'est écrit : le
            # rendez-vous reste éligible tant qu'il est dans la fenêtre.
            logger.debug(
                "Reprise de contact ignorée (plafond de la personne) : "
                "RDV #%s.", appointment.pk,
            )
            continue
        if not patient_accepts(appointment.patient, "missed_appointment_followup"):
            logger.debug(
                "Reprise de contact ignorée (canal refusé) : RDV #%s.",
                appointment.pk,
            )
            continue
        if _has_future_appointment(appointment):
            logger.debug(
                "Reprise de contact ignorée (rendez-vous déjà repris) : RDV #%s.",
                appointment.pk,
            )
            continue
        with transaction.atomic():
            locked = (
                # ``of=("self",)`` : on verrouille LA LIGNE DU RENDEZ-VOUS,
                # et elle seule. Le ``select_related`` sur ``patient__user``
                # (nullable) produit une jointure EXTERNE, sur le côté
                # possiblement NULL de laquelle PostgreSQL refuse un
                # ``FOR UPDATE`` — et verrouiller un patient ou un compte
                # ici n'aurait aucun sens : ce qu'on sérialise, c'est
                # l'unicité du message.
                Appointment.objects.select_for_update(of=("self",))
                .select_related("center", "patient__user")
                .get(pk=appointment.pk)
            )
            already_contacted = ContactLog.objects.filter(
                appointment=locked, kind=Kind.RECONTACT
            ).exists()
            if (
                locked.status != Appointment.Status.MISSED
                or already_contacted
                or _has_future_appointment(locked)
            ):
                continue
            ContactLog.objects.create(
                center=locked.center,
                patient=locked.patient,
                kind=Kind.RECONTACT,
                channel=Channel.SMS,
                recipient=Recipient.PATIENT,
                appointment=locked,
                created_by=None,  # l'automate
            )
            notify_missed_appointment_followup(locked)
        served_patients.add(appointment.patient_id)
        sent += 1
    return sent


# ---------------------------------------------------------------------------
# Les deux FILES DE TRAVAIL (lecture seule)
# ---------------------------------------------------------------------------


def unpaid_followup_rows(center):
    """La file « à relancer » — impayés + ce qu'on en sait déjà.

    Construite SUR ``unpaid_invoices_qs`` (jamais une seconde dérivation du
    solde) et annotée en SQL pur — une requête pour la page, jamais un
    appel par ligne :

    - ``reminders_sent_agg`` — combien de vagues SMS sont parties ;
    - ``last_contact_at_agg`` — le dernier contact de TOUTE nature sur
      cette facture (SMS automatique, appel, passage au guichet) ;
    - ``last_outcome_agg`` — l'issue du dernier contact HUMAIN, celle qui
      dit à l'équipe ce qu'il reste à faire ;
    - ``guardian_reachable_agg`` — un booléen, **jamais un téléphone** :
      la file dit s'il existe quelqu'un sur qui s'appuyer, elle n'est pas
      un annuaire moissonnable (même posture que ``invoices/unpaid/``).
    """
    reminders = (
        ContactLog.objects.filter(
            invoice=OuterRef("pk"), kind=Kind.UNPAID_REMINDER,
            channel=Channel.SMS,
        )
        .order_by()
        .values("invoice")
        .annotate(n=Count("pk"))
        .values("n")
    )
    last_contact = (
        ContactLog.objects.filter(invoice=OuterRef("pk"))
        .order_by()
        .values("invoice")
        .annotate(last=Max("created_at"))
        .values("last")
    )
    last_human_outcome = (
        ContactLog.objects.filter(invoice=OuterRef("pk"))
        .exclude(outcome="")
        .order_by("-created_at", "-id")
        .values("outcome")[:1]
    )
    # SV — le QUAND du dernier contact HUMAIN (une issue n'existe que sur
    # un geste humain — l'automate n'en pose jamais) : ``last_contact_at``
    # mélange SMS automatiques et gestes humains, or « un humain a parlé à
    # cette famille il y a deux jours » est l'information qui évite de
    # rappeler trop tôt. Écart de contrat comblé pour la vague frontend.
    last_human_contact = (
        ContactLog.objects.filter(invoice=OuterRef("pk"))
        .exclude(outcome="")
        .order_by()
        .values("invoice")
        .annotate(last=Max("created_at"))
        .values("last")
    )
    # Miroir EXACT de ``reminder_reachable_links`` — statut de la demande
    # compris (revue guardian S10). Un booléen qui dirait « oui » là où
    # aucun SMS ne peut partir mentirait au caissier, et la file de travail
    # existe précisément pour lui dire qui l'automate ne joindra pas.
    reachable = PaymentRequestShare.objects.filter(
        payment_request__invoice=OuterRef("pk"),
        payment_request__status__in=REMINDABLE_REQUEST_STATUSES,
        guardian_link__status=GuardianLink.Status.ACTIVE,
        guardian_link__guardian__payment_reminders=True,
    ).exclude(guardian_link__guardian__user__phone="")
    return (
        unpaid_invoices_qs(center)
        .annotate(
            reminders_sent_agg=Subquery(reminders),
            last_contact_at_agg=Subquery(last_contact),
            last_outcome_agg=Subquery(last_human_outcome),
            last_human_contact_at_agg=Subquery(last_human_contact),
            guardian_reachable_agg=Exists(reachable),
        )
        .select_related("patient")
    )


def missed_appointment_rows(center, *, start, end):
    """La file « à recontacter » — rendez-vous manqués de la période.

    Annotations, même discipline SQL :

    - ``contacted_at_agg`` — quand la reprise de contact a eu lieu (SMS
      automatique ou geste humain), ``NULL`` si personne n'a rien fait ;
    - ``last_outcome_agg`` — l'issue du dernier contact humain ;
    - ``rebooked_agg`` — le patient a-t-il un rendez-vous futur ``prevu``
      **dans ce centre** (c'est ce qui fait sortir la ligne de la file, et
      c'est aussi la garde de l'automate).

    Aucune donnée clinique : le ``reason`` du rendez-vous est un motif
    OPÉRATIONNEL (ADR 0013), et il n'entre pas dans le payload de cette
    file — le sérialiseur ne l'expose pas.
    """
    contacted = (
        ContactLog.objects.filter(appointment=OuterRef("pk"), kind=Kind.RECONTACT)
        .order_by()
        .values("appointment")
        .annotate(last=Max("created_at"))
        .values("last")
    )
    last_human_outcome = (
        ContactLog.objects.filter(appointment=OuterRef("pk"))
        .exclude(outcome="")
        .order_by("-created_at", "-id")
        .values("outcome")[:1]
    )
    rebooked = Appointment.objects.filter(
        center=center,
        patient_id=OuterRef("patient_id"),
        status=Appointment.Status.SCHEDULED,
        scheduled_at__gte=timezone.now(),
    )
    return (
        Appointment.objects.for_center(center)
        .filter(
            status=Appointment.Status.MISSED,
            scheduled_at__gte=start,
            scheduled_at__lt=end,
        )
        .annotate(
            contacted_at_agg=Subquery(contacted),
            last_outcome_agg=Subquery(last_human_outcome),
            rebooked_agg=Exists(rebooked),
        )
        .select_related("patient")
        .order_by("-scheduled_at", "-id")
    )


def contact_logs_for_center(center):
    """Les traces de CE centre — cloisonnement au queryset (ADR 0002)."""
    return ContactLog.objects.for_center(center)


def resolve_center_invoice(center, invoice_pk):
    """Une facture de CE centre, référencée dans un CORPS de requête.

    Norme des refus S1 : une référence dans le corps répond **400
    explicite**, et le message est byte-identique pour une facture d'un
    autre centre et pour une facture inexistante — rien à sonder.
    """
    invoice = Invoice.objects.for_center(center).filter(pk=invoice_pk).first()
    if invoice is None:
        raise ValidationError("Facture inconnue dans ce centre.")
    return invoice


def resolve_center_appointment(center, appointment_pk):
    """Un rendez-vous de CE centre, référencé dans un CORPS de requête."""
    appointment = (
        Appointment.objects.for_center(center).filter(pk=appointment_pk).first()
    )
    if appointment is None:
        raise ValidationError("Rendez-vous inconnu dans ce centre.")
    return appointment


#: Les combinaisons motif × objet acceptées à la journalisation manuelle.
#: Fermée, comme tout le reste du module : un contact « relance d'impayé »
#: porte une facture, une « reprise de contact » porte un rendez-vous.
#: L'appariement est aussi une contrainte de base (``ContactLog.Meta``) ;
#: cette table est ce qui permet à la VUE de refuser en 400 explicite,
#: avant que la base ne le fasse en message opaque.
MANUAL_CONTACT_REFERENCE = {
    Kind.UNPAID_REMINDER: "invoice",
    Kind.RECONTACT: "appointment",
}
