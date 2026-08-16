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

OPT-OUT CONTRACT (S10 lot 1 — ADR 0023 décision 1) :

- Les événements **refusables** consultent la préférence de la personne
  AVANT d'appeler :func:`_schedule` — ce sont, et ce sont les seuls :
  le rappel J-1 (:func:`notify_appointment_reminder`), la reprise de
  contact (:func:`notify_missed_appointment_followup`) et la relance
  d'impayé (:func:`notify_unpaid_invoice_reminder`, côté tuteur).
- Les autres ne le consultent JAMAIS, et c'est un invariant testé : OTP,
  invitation de tutelle, « un proche demande à pouvoir payer vos soins »,
  « votre soin a été payé », reçu émis. Ce sont des messages de
  **sécurité et de consentement** : se taire n'y protégerait personne, ça
  retirerait à la personne l'information dont elle a besoin pour décider.
- La règle générale du projet tient telle quelle : **le contenu d'un SMS
  suit la visibilité dans l'app, jamais l'inverse.**

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
from apps.patients.models import GuardianLink, patient_accepts

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

#: Événement 10 — une demande de disponibilité arrive dans une officine
#: (S9, ADR 0022 décision 9). Le destinataire n'est pas un patient, mais la
#: donnée, elle, parle de lui : **aucun médicament n'entre dans ce texte**,
#: et pas davantage le nombre de lignes (« 6 médicaments » dit déjà quelque
#: chose d'une ordonnance). Un SMS atterrit sur un téléphone partagé, prêté
#: ou perdu — la règle de contenu de l'ADR 0012 vaut ici sans exception.
#:
#: Le centre demandeur n'y est pas non plus, pour la même raison qu'il n'est
#: pas dans l'application : l'annuaire des pharmacies est public, l'activité
#: d'un centre ne l'est pas (ADR 0022 décision 2).
SMS_PHARMACY_AVAILABILITY_REQUEST = (
    "Chioni : vous avez une nouvelle demande de disponibilité. "
    "Ouvrez Chioni pour y répondre."
)

#: Événement 11 — relance d'une facture de soins impayée (S10, ADR 0023
#: décision 2). Destinataire : **le tuteur SEUL**, et seulement celui d'une
#: demande de paiement DÉJÀ PARTAGÉE avec lui, dont le lien est encore
#: ACTIF au moment de l'envoi (règle de l'événement 4, inchangée).
#:
#: Le montant et le nom du centre sont admis ici pour la même raison qu'à
#: l'événement 4 : le destinataire les lit déjà dans l'application, et une
#: relance qui tairait le montant obligerait la personne à ouvrir l'app
#: pour savoir de quoi on lui parle — ce qui n'est pas de la protection,
#: c'est de l'obscurité. Le montant est le **SOLDE RESTANT** (leçon S5,
#: même remède) : relancer sur une somme à moitié réglée serait faux et
#: vexant. Aucun libellé d'acte, aucune catégorie générique — comme partout.
#:
#: **Aucune relance de dette ne part jamais vers un patient** (arbitrage PO
#: n° 1) : son impayé vit dans la file du guichet, et c'est un humain qui
#: appelle.
#:
#: **Formulation revue par l'UX care S10**, sur deux points. Le double
#: « : » se lisait mal sur un écran de téléphone (le nom du centre est
#: désormais détaché par un tiret). Et « à régler » est une INJONCTION là
#: où le cadrage demande un fait : on énonce ce qui reste, on ne somme
#: personne de payer — le ton d'un rappel de dette est la moitié de la
#: différence entre un service et une pression.
SMS_UNPAID_INVOICE_REMINDER = (
    "Chioni — {center} : il reste {amount_kmf} KMF sur les soins de "
    "{patient_first_name}. Détail et paiement sur Chioni."
)

#: Événement 12 — reprise de contact après un rendez-vous manqué (S10,
#: ADR 0023 décision 5). Destinataire : le patient. **UN SEUL message,
#: jamais répété.**
#:
#: Contenu MINIMAL, mêmes règles que le rappel J-1 (événement 7) et pour la
#: même raison : ni motif, ni praticien, ni nom de centre — le téléphone
#: d'un profil non revendiqué est déclaratif et circule dans le foyer.
#:
#: Et surtout : **aucun reproche**. On manque un rendez-vous parce qu'on
#: n'a pas le transport, pas l'argent, ou parce qu'on avait honte. Le texte
#: ne dit pas « vous ne vous êtes pas présenté », il dit que la porte reste
#: ouverte — la formulation est la moitié du travail de ce sprint.
#:
#: **Formulation revue par l'UX care S10** : « Ouvrez Chioni ou appelez le
#: centre » s'adressait en priorité à un profil NON revendiqué — c'est-à-dire
#: à quelqu'un qui n'a pas l'application, et pour qui la moitié de la
#: consigne était inapplicable. Le message n'ordonne plus rien : il dit que
#: la porte reste ouverte, et laisse la personne choisir son chemin.
SMS_MISSED_APPOINTMENT_FOLLOWUP = (
    "Chioni : votre rendez-vous n'a pas eu lieu. Vous pouvez en fixer un "
    "nouveau quand vous voulez."
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


def _patient_refused(profile, preference, event) -> bool:
    """Porte de sortie (S10 lot 1) — le patient a-t-il refusé ce canal ?

    Appelée par les SEULS événements refusables, juste avant
    :func:`_schedule`. Le refus est journalisé en DEBUG uniquement : un log
    INFO « telle personne refuse les rappels » serait, lui aussi, une
    donnée de comportement.
    """
    if patient_accepts(profile, preference):
        return False
    logger.debug(
        "Notification SMS «%s» ignorée : la personne a refusé ce canal.", event
    )
    return True


def notify_appointment_reminder(appointment):
    """Événement 7 — rappel J-1 d'un rendez-vous : SMS au patient.

    Appelé par ``apps.scheduling.services.send_appointment_reminders``
    DANS la transaction qui pose ``reminder_sent_at`` : le on_commit de
    ``_schedule`` garantit que le SMS ne part que si l'anti-doublon est
    commité. L'heure est rendue en heure LOCALE (Indian/Comoro), format
    « 09h30 » — rien d'autre n'est interpolé (contrat de contenu en tête
    de module et sur la constante).

    **Refusable depuis S10** (ADR 0023 décision 1) : ce rappel ne l'était
    pas, ce qui était le vrai trou du contrat SMS — un canal automatique
    sans porte de sortie. La préférence est relue ICI en plus du filtre de
    l'appelant : un futur appelant ne peut pas la contourner en oubliant.
    """
    if _patient_refused(
        appointment.patient, "appointment_reminders", "rappel_rdv"
    ):
        return
    local = timezone.localtime(appointment.scheduled_at)
    _schedule(
        "rappel_rdv",
        _patient_phone(appointment.patient),
        SMS_APPOINTMENT_REMINDER.format(time=f"{local:%Hh%M}"),
    )


def notify_missed_appointment_followup(appointment):
    """Événement 12 — reprise de contact après un rendez-vous manqué (S10).

    Appelé par ``apps.crm.services.send_missed_appointment_followups`` DANS
    la transaction qui écrit la ligne de ``ContactLog`` : le ``on_commit``
    de :func:`_schedule` garantit qu'aucun message ne part si l'anti-doublon
    n'est pas commité (patron du rappel J-1 et de la relance d'abonnement).

    Refusable (``missed_appointment_followup``). Texte constant : rien de
    l'``appointment`` n'est interpolé — ni l'heure, ni le motif, ni le
    praticien, ni le centre. Le paramètre ne sert qu'à résoudre le
    destinataire et sa préférence.
    """
    if _patient_refused(
        appointment.patient, "missed_appointment_followup", "reprise_contact"
    ):
        return
    _schedule(
        "reprise_contact",
        _patient_phone(appointment.patient),
        SMS_MISSED_APPOINTMENT_FOLLOWUP,
    )


def notify_unpaid_invoice_reminder(*, guardian_link, invoice, balance_kmf):
    """Événement 11 — relance d'un impayé, AU TUTEUR (S10, ADR 0023 §2).

    Appelé par ``apps.crm.services.send_unpaid_invoice_reminders`` DANS la
    transaction qui écrit la ligne de ``ContactLog`` (l'anti-doublon), donc
    sous le même contrat ``on_commit`` que les deux autres relances du
    produit.

    L'appelant a déjà vérifié, sous verrou : la demande de paiement est
    PARTAGÉE avec ce lien, le lien est ACTIF, le tuteur n'a pas refusé les
    relances, et ``balance_kmf`` est le solde relu à cet instant. Ces
    vérifications ne sont pas refaites ici — elles ont besoin du verrou de
    la facture, qui est la responsabilité du service.

    ``balance_kmf`` est le SOLDE RESTANT, jamais ``invoice.total_kmf``.
    """
    _schedule(
        "relance_impaye",
        _guardian_phone(guardian_link.guardian),
        SMS_UNPAID_INVOICE_REMINDER.format(
            center=invoice.center.name,
            amount_kmf=format_kmf(balance_kmf),
            patient_first_name=invoice.patient.first_name,
        ),
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


def notify_pharmacy_of_availability_request(pharmacy):
    """Événement 10 — une demande arrive dans une officine (S9, ADR 0022).

    Appelé par ``apps.pharmacy.services.create_availability_request`` DANS
    la transaction qui pose la ligne de diffusion : le ``on_commit`` de
    :func:`_schedule` garantit qu'aucun SMS ne part si l'envoi est annulé.

    Destinataire : le numéro DÉCLARÉ DE L'OFFICINE, pas les téléphones
    personnels de ses membres. C'est le numéro professionnel, celui qui est
    déjà public dans l'annuaire du réseau, et un seul SMS par pharmacie
    plutôt qu'un par personne — moins intrusif et moins coûteux. Une
    officine sans téléphone est ignorée en silence : elle verra la demande
    en ouvrant l'application (contrat de :func:`_schedule`).
    """
    _schedule(
        "demande_disponibilite", pharmacy.phone, SMS_PHARMACY_AVAILABILITY_REQUEST
    )
