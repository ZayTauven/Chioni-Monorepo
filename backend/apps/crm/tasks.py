"""Tâches Celery des relances (S10 lot 2, ADR 0023).

Le câblage du beat vit dans ``config/settings.py``, qui référence les
tâches PAR NOM : les settings n'importent jamais de code applicatif
(convention du projet, patron des six tâches existantes).

Les deux tâches ne font que **déléguer à leur service**, seul chemin
d'écriture : verrou de ligne, ``save()``, ``ContactLog`` comme
anti-doublon, et envoi par ``transaction.on_commit`` dans la transaction
qui écrit la trace. Jamais un ``update()`` de masse — la course avec un
règlement au guichet ou une reprise de rendez-vous s'arbitre ligne par
ligne.

**09h00 heure des Comores** pour les deux : jamais la nuit. Un SMS de
dette ou d'absence qui réveille quelqu'un à 6 h n'est pas un service.
"""

from celery import shared_task

from apps.crm.services import (
    send_missed_appointment_followups,
    send_unpaid_invoice_reminders,
)


@shared_task(name="crm.send_unpaid_invoice_reminders")
def send_unpaid_invoice_reminders_task() -> int:
    """Relances SMS des impayés — AU TUTEUR SEUL (ADR 0023 décision 2).

    Aucun SMS de dette ne part vers un patient : son impayé vit dans la
    file du guichet, et c'est un humain qui appelle (arbitrage PO n° 1).
    Cadence bornée à trois vagues, puis silence définitif.

    Retourne le nombre de vagues programmées.
    """
    return send_unpaid_invoice_reminders()


@shared_task(name="crm.send_missed_appointment_followups")
def send_missed_appointment_followups_task() -> int:
    """UN message neutre après un rendez-vous manqué (ADR 0023 décision 5).

    Jamais répété, jamais un reproche, et rien ne part si la personne a
    déjà repris rendez-vous dans le même centre.

    Retourne le nombre de messages programmés.
    """
    return send_missed_appointment_followups()
