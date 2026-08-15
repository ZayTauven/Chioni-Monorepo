"""Business SMS notifications — one function per business event.

The SMS is the primary channel in the Comoros (needs study §5.4): after the
OTP login, the key business events now reach people by SMS too. This module
is the ONLY home of the notification texts (constants below — the future
i18n/shikomori extraction point) and the ONLY business caller of the
``accounts.send_sms`` Celery task.

CONTENT CONTRACT (revue guardian — non négociable) :

- **Jamais d'information médicale dans un SMS** : ni libellé d'acte, ni
  motif, ni diagnostic, ni catégorie générique. Un SMS se lit par-dessus
  l'épaule et reste dans la boîte de réception du téléphone.
- **Un montant ne va JAMAIS au patient** — uniquement au tuteur, sur la
  notification de demande de paiement (un téléphone patient peut circuler
  dans le foyer). Le SMS « paiement reçu » ne porte pas non plus le nom du
  centre : le téléphone d'un profil non revendiqué est déclaratif et un
  centre spécialisé est une information quasi médicale.
- **Une seule exception, actée en S5 (ADR 0018 décision 4)** : les relances
  de la facture d'ABONNEMENT SaaS portent un montant vers un membre du
  personnel. Périmètre strict : **le directeur seul** (jamais le reste du
  personnel), le montant que SON centre doit à Chioni, aucune donnée
  patient, aucune donnée médicale, aucun détail de ligne — et pas davantage
  le nom du centre.
- **Le montant ne part que vers un lien de tutelle encore ACTIF** au moment
  de l'envoi — un partage peut survivre à la révocation ou à la suspension
  du lien, le SMS ne doit pas les survivre.
- **Le SMS « attente de confirmation du titulaire » ne nomme jamais le
  tuteur demandeur** : l'app donne le détail après connexion, jamais l'écran
  verrouillé.
- Textes français simples, préfixés « Chioni : », < 160 caractères visés.

DELIVERY CONTRACT :

- Tout envoi passe par ``transaction.on_commit`` : une opération métier
  annulée (rollback) ne notifie JAMAIS personne. Le texte et le numéro sont
  résolus AU MOMENT de l'appel (dans la transaction), capturés en chaînes —
  le callback ne relit pas l'ORM après commit.
- Un destinataire sans téléphone est ignoré silencieusement (log DEBUG).
- L'échec d'un SMS ne fait JAMAIS échouer l'opération métier : en mode
  Celery eager (dev/tests, ``CELERY_TASK_EAGER_PROPAGATES`` suit ``DEBUG``),
  l'exception du backend remonterait dans l'appelant — elle est attrapée et
  loggée ici. Contrat de logs identique à ``apps/common/sms.py`` : jamais de
  corps de message ni de téléphone au niveau INFO ou plus.
"""

import logging
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.tasks import send_sms
from apps.patients.models import GuardianLink

logger = logging.getLogger("chioni.notifications")


# ---------------------------------------------------------------------------
# Templates (constants = the single i18n/shikomori extraction point)
# ---------------------------------------------------------------------------

#: Événement 1 — invitation de tutelle envoyée (portes B et C).
#: Volontairement ANONYME : le numéro saisi peut être erroné (faute de
#: frappe au guichet) — le SMS ne révèle ni le nom du patient ni celui de
#: l'invitant. L'app détaille après connexion. La phrase finale d'ignorance
#: est l'information minimale RGPD du destinataire non concerné (base
#: légale : intérêt légitime — ADR 0012, addendum revue guardian).
SMS_GUARDIAN_INVITED = (
    "Chioni : un patient vous invite comme proche de confiance pour "
    "l'aider à payer ses soins. Répondez sur Chioni. "
    "Si vous n'êtes pas concerné, ignorez ce message."
)

#: Événement 2 — le tuteur a accepté l'invitation (SMS au patient).
SMS_INVITATION_ACCEPTED = "Chioni : {guardian_first_name} a accepté votre invitation."

#: Repli quand le compte du tuteur n'a pas de prénom (compte ombre).
INVITATION_ACCEPTED_FALLBACK_NAME = "votre proche"

#: Événement 3 — lien(s) en attente de confirmation du titulaire
#: (post-revendication OU post-fusion). NE NOMME JAMAIS le tuteur.
SMS_LINKS_PENDING_CONFIRMATION = (
    "Chioni : un proche demande à pouvoir payer vos soins. "
    "Ouvrez Chioni pour confirmer ou refuser."
)

#: Événement 4 — demande de paiement envoyée (SMS à chaque tuteur partagé).
#: Le MONTANT est admis ici (destinataire = tuteur), jamais le libellé
#: d'acte ni sa catégorie (ADR 0005 : même la catégorie générique reste
#: dans l'app, derrière l'authentification).
SMS_PAYMENT_REQUEST_SENT = (
    "Chioni : {center} : une demande de paiement de {amount_kmf} KMF "
    "pour {patient_first_name} vous attend sur Chioni."
)

#: Événement 5 — paiement reçu (SMS au patient). SANS montant et SANS nom
#: de centre (revue guardian) : le téléphone d'un profil non revendiqué est
#: déclaratif, et le nom d'un centre spécialisé est une information quasi
#: médicale — cohérent avec l'exclusion du montant.
SMS_PAYMENT_RECEIVED = "Chioni : votre soin a été payé par un proche."

#: Événement 6 — reçu émis (SMS au tuteur payeur).
SMS_RECEIPT_ISSUED = (
    "Chioni : votre reçu n° {receipt_number} de {center} est disponible sur Chioni."
)

#: Événement 7 — rappel de rendez-vous J-1 (SMS au patient). Contenu
#: MINIMAL (ADR 0012, mêmes règles que l'événement 5) : jamais le motif,
#: jamais le nom du praticien, et PAS le nom du centre — le téléphone d'un
#: profil non revendiqué est déclaratif et peut circuler dans le foyer, et
#: le nom d'un centre spécialisé est une information quasi médicale. Seule
#: l'heure locale est interpolée.
SMS_APPOINTMENT_REMINDER = (
    "Chioni : rappel — vous avez un rendez-vous demain à {time}."
)

#: Événements 8 et 9 — relances de la facture d'ABONNEMENT SaaS (S5 lot 2,
#: ADR 0018 décision 4). **Première entorse assumée à la règle « un montant
#: ne va qu'au tuteur »** : le destinataire est ici un membre du personnel,
#: et le montant est celui que SON centre doit à Chioni — aucune donnée
#: patient, aucune donnée médicale, aucun détail de ligne n'entre dans ces
#: textes, et ils ne partent qu'au DIRECTEUR (jamais au reste du personnel :
#: une dette commerciale n'est pas l'affaire de la secrétaire).
#:
#: Le nom du centre est volontairement ABSENT — même discipline que partout
#: ailleurs (un SMS se lit par-dessus l'épaule ; « la clinique X doit
#: 25 000 KMF » n'a pas à circuler). Le numéro de facture suffit à
#: l'identifier dans l'app, qui porte le détail.
SMS_SUBSCRIPTION_INVOICE_DUE = (
    "Chioni : votre facture d'abonnement {number} de {amount_kmf} KMF "
    "arrive à échéance aujourd'hui. Détail et règlement sur Chioni."
)

#: Relances suivantes (J+7, J+21) — ton d'information, jamais de menace :
#: un retard de paiement ne ferme rien (l'abonnement passe « impayé », qui
#: est un état d'alerte), et le gel reste une décision humaine motivée.
SMS_SUBSCRIPTION_INVOICE_OVERDUE = (
    "Chioni : votre facture d'abonnement {number} de {amount_kmf} KMF "
    "reste à régler (échéance du {due_date}). Ouvrez Chioni ou "
    "contactez-nous."
)


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------


def format_kmf(amount) -> str:
    """« 20 000 » — francs entiers, milliers séparés par une espace.

    Le franc comorien n'a pas de subdivision en circulation : l'affichage
    SMS arrondit au franc (ROUND_HALF_UP). Les montants exacts font foi
    dans l'app et sur le reçu (relus du ledger), jamais dans un SMS.
    """
    whole = Decimal(amount).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return f"{whole:,}".replace(",", " ")


def _patient_phone(profile):
    """Best phone for a patient: the VERIFIED account phone once claimed,
    else the declarative profile phone (doors A/C)."""
    if profile.user_id is not None and profile.user.phone:
        return profile.user.phone
    return profile.phone or None


def _guardian_phone(guardian_profile):
    return guardian_profile.user.phone or None


def center_director_phones(center_id):
    """Phones of the ACTIVE directors of a center — the ONLY staff audience.

    S5 lot 2 (ADR 0018 décision 4): the subscription reminders are the
    first business SMS carrying an amount to a member of staff, and they
    stop at the director. A center may legitimately have two directors
    (co-gérance) — both are responsible, both are told. Duplicates are
    collapsed so one person never gets the same text twice.
    """
    from apps.centers.models import StaffMembership

    phones = (
        StaffMembership.objects.filter(
            center_id=center_id,
            role=StaffMembership.Role.DIRECTOR,
            is_active=True,
        )
        .values_list("user__phone", flat=True)
        .order_by("user_id")
    )
    return list(dict.fromkeys(phone for phone in phones if phone))


def _schedule(event: str, phone, message: str) -> None:
    """Queue one SMS for AFTER the surrounding transaction commits.

    ``phone`` and ``message`` are plain strings captured now: a rollback
    discards the callback (nothing leaves), and the callback never touches
    the ORM. A missing phone is a silent skip (DEBUG log) — a failing
    backend is caught and logged, never propagated to the business flow.
    """
    if not phone:
        logger.debug(
            "Notification SMS «%s» ignorée : destinataire sans téléphone.", event
        )
        return

    def dispatch():
        try:
            send_sms.delay(phone, message)
        except Exception:
            # Eager mode (dev/tests) executes the task inline and would
            # re-raise into the caller — a notification must never break
            # the business operation. INFO+ lines carry neither body nor
            # phone (contract of apps/common/sms.py); detail at DEBUG only.
            logger.warning(
                "Notification SMS «%s» non remise (échec d'envoi).", event
            )
            logger.debug(
                "Échec de la notification «%s» → %s", event, phone, exc_info=True
            )

    transaction.on_commit(dispatch)


# ---------------------------------------------------------------------------
# One function per business event
# ---------------------------------------------------------------------------


def notify_guardian_invited(link):
    """Événement 1 — invitation envoyée au tuteur (portes B et C)."""
    _schedule(
        "invitation_tutelle_envoyee",
        _guardian_phone(link.guardian),
        SMS_GUARDIAN_INVITED,
    )


def notify_invitation_accepted(link):
    """Événement 2 — le tuteur a accepté : SMS au patient (s'il a un
    téléphone). Prénom du tuteur si son compte en porte un, repli neutre
    sinon (compte ombre fraîchement activé)."""
    first_name = (link.guardian.user.first_name or "").strip()
    message = SMS_INVITATION_ACCEPTED.format(
        guardian_first_name=first_name or INVITATION_ACCEPTED_FALLBACK_NAME
    )
    _schedule("invitation_acceptee", _patient_phone(link.patient), message)


def notify_links_pending_confirmation(profile):
    """Événement 3 — lien(s) suspendus en attente de confirmation du
    titulaire (revendication OU fusion).

    UN SEUL SMS générique par événement, quel que soit le nombre de liens
    suspendus (pas de harcèlement), et JAMAIS le nom du tuteur (un SMS se
    lit par-dessus l'épaule — l'app donne le détail)."""
    _schedule(
        "lien_attente_confirmation",
        _patient_phone(profile),
        SMS_LINKS_PENDING_CONFIRMATION,
    )


def _payment_request_message(payment_request):
    """The event-4 text — shared by the send fan-out and the late share."""
    invoice = payment_request.invoice
    return SMS_PAYMENT_REQUEST_SENT.format(
        center=invoice.center.name,
        amount_kmf=format_kmf(invoice.total_kmf),
        patient_first_name=invoice.patient.first_name,
    )


def notify_payment_request_sent(payment_request):
    """Événement 4 — demande envoyée : un SMS à CHAQUE tuteur partagé dont
    le lien est encore ACTIF.

    Montant admis (destinataire tuteur) ; libellé d'acte et catégorie
    JAMAIS. Un tuteur sans téléphone est ignoré, les autres reçoivent.
    Revue guardian : un partage peut survivre à son lien (révocation par le
    patient, suspension en attente de confirmation du titulaire) — un lien
    non ACTIF ne voit plus la demande dans l'app et ne doit pas davantage
    recevoir le montant par SMS."""
    message = _payment_request_message(payment_request)
    for share in payment_request.shares.filter(
        guardian_link__status=GuardianLink.Status.ACTIVE
    ).select_related("guardian_link__guardian__user"):
        _schedule(
            "demande_paiement_envoyee",
            _guardian_phone(share.guardian_link.guardian),
            message,
        )


def notify_payment_request_share_added(share):
    """Événement 4 (rattrapage) — un tuteur partagé APRÈS l'envoi de la
    demande reçoit le même SMS que ses pairs, seul.

    Le partage exige un lien ACTIF (service trustbridge) : pas de filtre à
    refaire ici. Un partage en brouillon reste muet jusqu'à l'envoi."""
    _schedule(
        "demande_paiement_envoyee",
        _guardian_phone(share.guardian_link.guardian),
        _payment_request_message(share.payment_request),
    )


def notify_payment_received(payment_request):
    """Événement 5 — paiement encaissé : SMS au patient, SANS montant ni
    nom de centre (le texte est une constante volontairement muette)."""
    _schedule(
        "paiement_recu",
        _patient_phone(payment_request.invoice.patient),
        SMS_PAYMENT_RECEIVED,
    )


def notify_receipt_issued(receipt, paying_guardian):
    """Événement 6 — reçu émis à la clôture : SMS au tuteur payeur."""
    _schedule(
        "recu_emis",
        _guardian_phone(paying_guardian),
        SMS_RECEIPT_ISSUED.format(
            receipt_number=receipt.sequence_number, center=receipt.center.name
        ),
    )


def notify_appointment_reminder(appointment):
    """Événement 7 — rappel J-1 d'un rendez-vous : SMS au patient.

    Appelé par ``apps.scheduling.services.send_appointment_reminders``
    DANS la transaction qui pose ``reminder_sent_at`` : le on_commit de
    ``_schedule`` garantit que le SMS ne part que si l'anti-doublon est
    commité. L'heure est rendue en heure LOCALE (Indian/Comoro), format
    « 09h30 » — rien d'autre n'est interpolé (contrat de contenu en tête
    de module et sur la constante)."""
    local = timezone.localtime(appointment.scheduled_at)
    _schedule(
        "rappel_rdv",
        _patient_phone(appointment.patient),
        SMS_APPOINTMENT_REMINDER.format(time=f"{local:%Hh%M}"),
    )


def notify_subscription_invoice_reminder(invoice, *, balance_kmf, first):
    """Événements 8/9 — relance d'une facture d'abonnement, AU DIRECTEUR.

    Appelé par ``apps.billing.services.send_subscription_payment_reminders``
    DANS la transaction qui incrémente ``reminders_sent`` : le on_commit de
    ``_schedule`` garantit qu'aucun SMS ne part si l'anti-doublon n'est pas
    commité (patron du rappel de rendez-vous).

    ``balance_kmf`` est le SOLDE RESTANT (un règlement partiel a pu passer),
    jamais le montant facturé — relancer sur un montant déjà réglé pour
    moitié serait faux et vexant. ``first`` distingue le jour de l'échéance
    (« arrive à échéance aujourd'hui ») des rappels suivants.

    Un centre sans directeur actif joignable ne reçoit rien : l'appelant
    l'écarte AVANT d'incrémenter son compteur de relances (sinon un tenant
    injoignable brûlerait ses trois relances en silence), et Chioni le voit
    dans son back-office (``director_active_count == 0``), pas par SMS.
    """
    template = (
        SMS_SUBSCRIPTION_INVOICE_DUE if first else SMS_SUBSCRIPTION_INVOICE_OVERDUE
    )
    message = template.format(
        number=invoice.number,
        amount_kmf=format_kmf(balance_kmf),
        due_date=f"{invoice.due_date:%d/%m/%Y}",
    )
    for phone in center_director_phones(invoice.center_id):
        _schedule("relance_abonnement", phone, message)
