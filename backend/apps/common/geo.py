"""Géographie comorienne — les libellés partagés par plusieurs domaines.

Une île n'appartient à aucun module : elle qualifie un centre de santé
(``centers.HealthCenter``), une pharmacie du réseau (``pharmacy.Pharmacy``)
et, demain, une demande de disponibilité. La liste vit donc ici plutôt que
dans l'app qui l'a nommée la première.

``HealthCenter.Island`` est **volontairement laissée en place** : la
déplacer coûterait une migration sur une table centrale pour un gain nul
(les ``choices`` ne sont pas une contrainte de base). La parité des deux
listes est verrouillée par un test (``tests/test_pharmacy.py``) — si l'une
gagne une île, l'autre doit la gagner le même jour, sinon un centre et une
pharmacie du même endroit deviendraient incomparables et le ciblage d'une
demande de disponibilité laisserait des officines hors de portée.
"""

from django.db import models


class Island(models.TextChoices):
    """Les trois îles de l'Union des Comores."""

    NGAZIDJA = "ngazidja", "Ngazidja (Grande Comore)"
    NDZUWANI = "ndzuwani", "Ndzuwani (Anjouan)"
    MWALI = "mwali", "Mwali (Mohéli)"
