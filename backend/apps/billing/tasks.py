"""Celery tasks of the billing app — the SaaS billing cycle (S5 lot 2).

Beat wiring lives in ``config/settings.py`` (``CELERY_BEAT_SCHEDULE``),
which references tasks BY NAME only — settings never import application
code. Each task here does ONE thing: delegate to its service, which is the
only write path (row locks, state machine, audit, SMS after commit).

The three of them together are the cycle:

1. **émettre** ce qui est arrivé à terme (facturation mensuelle par tenant,
   déclencheur quotidien — voir la note du beat) ;
2. **constater** l'échéance dépassée : l'abonnement passe « impayé », un
   état d'ALERTE qui ne ferme rien. La suspension, elle, n'est JAMAIS
   automatique (ADR 0018) : geler l'administration d'un centre est une
   sanction, elle se décide, se motive et s'audite ;
3. **relancer** par SMS — le directeur seul, trois fois, puis silence.
"""

from celery import shared_task

from apps.billing.services import (
    flag_overdue_subscriptions,
    issue_due_subscription_invoices,
    send_subscription_payment_reminders,
)


@shared_task(name="billing.issue_due_subscription_invoices")
def issue_due_subscription_invoices_task() -> int:
    """Émet les factures d'abonnement des périodes arrivées à terme.

    Idempotente : le curseur ``current_period_end`` et l'index unique par
    période VIVANTE garantissent qu'un tenant n'est jamais facturé deux
    fois pour le même mois, quel que soit le nombre d'exécutions.

    Retourne le nombre de factures émises (visible dans les logs du worker
    via le résultat de la tâche).
    """
    return issue_due_subscription_invoices()


@shared_task(name="billing.flag_overdue_subscriptions")
def flag_overdue_subscriptions_task() -> int:
    """``actif → impaye`` sur échéance dépassée, et retour dès que réglé.

    Ce sont les DEUX seules transitions automatiques du produit. Aucune
    tâche ne suspend ni ne résilie : un centre qui a payé par virement non
    encore saisi ne doit pas se réveiller gelé.

    Retourne le nombre d'abonnements dont le statut a changé.
    """
    return flag_overdue_subscriptions()


@shared_task(name="billing.send_subscription_payment_reminders")
def send_subscription_payment_reminders_task() -> int:
    """Relances SMS d'une facture d'abonnement échue — AU DIRECTEUR SEUL.

    Premier SMS métier qui porte un montant vers un membre du personnel
    (ADR 0012 étendu par l'ADR 0018) : aucune donnée patient, aucune donnée
    médicale, aucun détail de ligne, pas même le nom du centre. Cadence
    J+0 / J+7 / J+21, puis silence.

    Retourne le nombre de relances programmées.
    """
    return send_subscription_payment_reminders()
