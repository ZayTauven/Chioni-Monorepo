"""Tâches Celery du réseau — l'hygiène des demandes (S9, ADR 0022).

Le câblage du beat vit dans ``config/settings.py``, qui référence les
tâches PAR NOM : les settings n'importent jamais de code applicatif.
"""

from celery import shared_task

from apps.pharmacy.services import close_stale_availability_requests


@shared_task(name="pharmacy.close_stale_availability_requests")
def close_stale_availability_requests_task() -> int:
    """Ferme les demandes de disponibilité périmées (décision 8).

    Délègue au service, seul chemin d'écriture (verrou de ligne, ``save()``,
    audit acteur SYSTÈME) — jamais un ``update()`` de masse : la course avec
    une réponse en vol s'arbitre ligne par ligne.

    Note : la péremption est déjà opposable AVANT le passage du beat — le
    service de réponse compare ``expires_at`` à l'instant courant. Cette
    tâche solde l'enregistrement (statut, raison, date), elle n'est pas la
    garde. Un beat en retard n'ouvre donc aucune fenêtre.
    """
    return close_stale_availability_requests()
