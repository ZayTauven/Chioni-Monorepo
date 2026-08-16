"""Export comptable figé (S10 lot 3 — ADR 0023, décisions 6 et 7).

**La première sortie de la donnée financière hors de l'application.** Une
fois le fichier sur une clé USB, Chioni n'a plus aucun droit dessus : le
cadrage a donc décidé ce qu'un export a le droit de contenir, et ce qu'il
fige exactement.

Deux tables :

- :class:`AccountingExport` — la PIÈCE, **append-only** : sa période, son
  numéro, ses totaux **et le contenu figé de ses lignes**. Le
  téléchargement relit le snapshot stocké ; il ne recalcule JAMAIS — sans
  quoi « figé » ne voudrait rien dire, et deux téléchargements du même
  export pourraient différer.
- :class:`AccountingExportSeries` — la ligne compteur de la série « E- »,
  **une par centre**, verrouillée le temps de l'émission.

Trois choses que ce module ne fait pas, et ce sont des décisions :

1. **Rien ne se ferme derrière un export** (arbitrage PO n° 3). Une
   contre-passation reste possible sur une période déjà exportée, un même
   mois peut être exporté deux fois. Cohérent avec le reste du produit :
   l'ADR 0018 refuse la prise d'otage des données et l'ADR 0015 refuse
   qu'on empêche la caisse de corriger une erreur. Ce que l'application
   doit, c'est **le dire** — l'API annonce la date et le numéro du
   précédent export recouvrant la période.
2. **Aucune écriture dans le ledger.** Exporter est une LECTURE. L'ADR 0003
   tient tel quel, et l'étanchéité est testée.
3. **Aucun plan comptable normalisé**, aucun format de logiciel tiers :
   c'est un relevé de mouvements, pas un journal OHADA.

**Décision 7, le cœur du lot — des MOUVEMENTS, pas des soldes.** Une ligne
par encaissement **à sa date**, une ligne par contre-passation **à SA
date**, avec la référence et la date de l'encaissement d'origine. Une
contre-passation n'est jamais soustraite en silence d'un jour antérieur :
la recette du 3 août reste la recette du 3 août, même si on contre-passe le
12. C'est le retraitement de la vigilance ADR 0015 consignée en SV.2 (dans
``stats/finances``, un encaissement contre-passé disparaît rétroactivement
de sa journée — acceptable pour un tableau de pilotage, inacceptable pour
une pièce comptable).

**Aucune donnée clinique, aucun nom.** Les lignes portent des RÉFÉRENCES
(ids de facture et d'encaissement, numéro de reçu « G- », méthode,
opérateur, montant, dates) — jamais un libellé d'acte, jamais une
catégorie générique, jamais le nom d'un patient : la minimisation vaut
d'autant plus qu'un export survit à l'application (RGPD, ADR 0007).
"""

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.centers.models import CenterScopedQuerySet, HealthCenter
from apps.common.models import AppendOnlyModel, AppendOnlyQuerySet


class AccountingExportSeries(models.Model):
    """La ligne qui numérote la série « E- » d'UN centre.

    Pourquoi une table à elle seule, et pas le patron de ``Receipt.issue()``
    / ``CashReceipt.issue()`` qui verrouillent la ligne ``HealthCenter`` :
    cette contention-là a déjà été écartée en S5 (ADR 0018 décision 4) — un
    export généré au bureau ne doit jamais faire la queue derrière le reçu
    d'un patient au guichet, ni l'inverse. La série est bien PAR CENTRE
    (c'est la comptabilité du centre), mais son verrou lui appartient.

    Pourquoi une ligne compteur plutôt qu'une ``SEQUENCE`` PostgreSQL :
    ``nextval()`` n'est pas transactionnelle, donc une émission annulée
    brûlerait un numéro et laisserait un **trou**. L'ADR 0015 §6 a déjà
    argumenté qu'un trou dans une série de reçus ressemble à une fraude ;
    c'est plus vrai encore d'une pièce comptable. Verrouiller cette ligne
    (``SELECT … FOR UPDATE``) rend la série strictement contiguë : un
    rollback remet le numéro.

    La ligne est créée paresseusement par le service de numérotation,
    jamais par une migration de données : ``TransactionTestCase`` vide les
    tables entre deux tests, et une numérotation qui dépendrait d'une ligne
    semée serait un piège (leçon ``SubscriptionInvoiceCounter``, S5).
    """

    center = models.OneToOneField(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="accounting_export_series",
    )
    last_number = models.PositiveIntegerField(
        "dernier numéro attribué",
        default=0,
        help_text=(
            "Série « E- » de CE centre : verrouillée le temps de l'émission, "
            "jamais un verrou sur la ligne du centre lui-même."
        ),
    )

    class Meta:
        verbose_name = "compteur de la série des exports comptables"
        verbose_name_plural = "compteurs des séries d'exports comptables"

    def __str__(self) -> str:  # pragma: no cover — admin/debug only
        return f"Série E- de {self.center_id} : {self.last_number} export(s)"


class AccountingExportQuerySet(CenterScopedQuerySet, AppendOnlyQuerySet):
    """Cloisonné par centre ET append-only au niveau du queryset."""


class AccountingExport(AppendOnlyModel):
    """Une photo datée et numérotée de la caisse — append-only.

    ``lines`` est le SNAPSHOT : la liste complète des mouvements de la
    période, figée à l'émission et **relue telle quelle** au
    téléchargement. Les totaux sont stockés à côté plutôt que recalculés
    depuis le snapshot pour la même raison : une pièce dit ce qu'elle
    disait le jour où on l'a signée.

    Les bornes de période sont des JOURS LOCAUX INCLUSIFS (contrat
    ``apps.common.periods`` — heure des Comores, un encaissement de 23h30
    reste sur son jour).
    """

    NUMBER_PREFIX = "E"

    center = models.ForeignKey(
        HealthCenter,
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="accounting_exports",
    )
    period_start = models.DateField("début de période (jour local inclus)")
    period_end = models.DateField("fin de période (jour local inclus)")
    sequence_number = models.PositiveIntegerField("numéro séquentiel")
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="généré par",
        on_delete=models.PROTECT,
        related_name="accounting_exports_generated",
        help_text="Un humain déclenche et signe la photo — jamais un automate.",
    )
    total_collected_kmf = models.DecimalField(
        "total encaissé (KMF)", max_digits=14, decimal_places=2, default=Decimal("0")
    )
    total_reversed_kmf = models.DecimalField(
        "total contre-passé (KMF)",
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        help_text=(
            "Somme des contre-passations DATÉES DANS LA PÉRIODE — jamais "
            "soustraites d'un jour antérieur (décision 7)."
        ),
    )
    net_kmf = models.DecimalField(
        "net de la période (KMF)",
        max_digits=14,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Somme algébrique de ce qui est écrit : encaissé − contre-passé.",
    )
    line_count = models.PositiveIntegerField("nombre de mouvements", default=0)
    lines = models.JSONField(
        "mouvements figés",
        default=list,
        help_text=(
            "SNAPSHOT complet, relu tel quel au téléchargement — jamais "
            "recalculé. Des références et des montants, aucun nom, aucun "
            "libellé d'acte."
        ),
    )

    objects = AccountingExportQuerySet.as_manager()

    class Meta:
        verbose_name = "export comptable"
        verbose_name_plural = "exports comptables"
        ordering = ["-sequence_number", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "sequence_number"],
                name="unique_accounting_export_sequence_per_center",
            ),
            models.CheckConstraint(
                condition=models.Q(period_start__lte=models.F("period_end")),
                name="accounting_export_period_is_ordered",
            ),
            models.CheckConstraint(
                condition=models.Q(sequence_number__gt=0),
                name="accounting_export_sequence_is_positive",
            ),
        ]
        indexes = [
            models.Index(fields=["center", "-created_at"]),
            models.Index(fields=["center", "period_start", "period_end"]),
        ]

    def __str__(self) -> str:
        return f"Export {self.number} — {self.period_start} → {self.period_end}"

    @property
    def number(self) -> str:
        """« E-000001 » — le numéro tel qu'il s'affiche et s'imprime."""
        return f"{self.NUMBER_PREFIX}-{self.sequence_number:06d}"

    def save(self, *args, **kwargs):
        # Invariant structurel rejoué sur TOUT chemin d'écriture : une
        # période à l'envers rendrait le snapshot inexplicable, et la
        # contrainte DB ne se déclenche qu'au moment de l'INSERT (message
        # opaque). Ici l'erreur est en français, avant la base.
        if self.period_start and self.period_end and (
            self.period_start > self.period_end
        ):
            raise ValidationError(
                "Période invalide : la date de début doit précéder la date de fin."
            )
        super().save(*args, **kwargs)
