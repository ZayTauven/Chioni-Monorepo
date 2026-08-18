"""Inventaire des équipements (S8 — ADR 0021).

Le plus petit module du plan, et le moins sensible : **ni donnée patient,
ni argent, ni donnée personnelle** — hormis le nom de qui signale une
panne, qui est de ce fait la seule vraie question d'audience du sprint
(tranchée dans ``serializers.py``).

Deux tables, et la raison d'être de chacune :

- :class:`Equipment` — ce que le centre POSSÈDE, **où**, et **si ça
  marche**. C'est exactement ce qu'un centre a besoin de savoir tout de
  suite (ADR 0021, arbitrage PO n° 1) ; l'état est une machine fermée
  (``en_service ⇄ en_panne``, les deux → ``reforme``) dont le dernier
  état est **définitif** : un équipement ne se supprime pas, il se
  **réforme**. Le parc raconte son histoire, y compris ce qui en est sorti.
- :class:`EquipmentReport` — le CONSTAT d'un membre du personnel, et il
  est **append-only** : un signalement se corrige par un nouveau
  signalement, jamais par réécriture. **Il ne change pas l'état de
  l'équipement** : signaler est un constat (l'infirmière qui voit que le
  tensiomètre ne marche plus), décider est un geste de directeur. Deux
  gestes distincts, par deux personnes potentiellement différentes.

Ce que ces deux tables **n'ont pas**, et pourquoi — les absences sont des
décisions, jamais des oublis :

1. **Aucune valeur financière** (décision 3) : ni prix d'achat, ni
   amortissement, ni valeur de parc. Ce serait ouvrir une surface d'argent
   sans cadrage dans le module le moins surveillé du produit, alors que la
   comptabilité est le sujet de S10. Un test d'absence de champ
   (``tests/test_equipment.py``) fait qu'un futur champ « prix » sera un
   choix conscient et non un glissement.
2. **Aucune clé étrangère vers ``inpatient.Room``** (décision 2) : tous les
   centres n'ont pas d'hospitalisation, et un échographe vit au bloc, en
   salle d'accouchement ou dans un couloir. ``location`` est un **texte
   libre** qui couvre le réel sans coupler deux modules qui n'ont pas de
   raison de se connaître. Le jour où le lien aura du sens, ce sera un
   champ nullable **à côté** du texte, jamais à sa place.
3. **Aucune maintenance préventive** (arbitrage PO n° 1) : ni périodicité,
   ni date de prochaine révision, ni contrat de maintenance. Elle attendra
   d'être vérifiée sur le terrain, et s'ajoutera comme une table de plus.
4. **Aucun ``resolved_at`` ni statut sur un signalement.** Un signalement ne
   se « ferme » pas : c'est un constat daté. Ce qui dit où on en est, c'est
   l'ÉTAT de l'équipement — changé par le directeur, tracé, réversible tant
   que la réforme n'est pas prononcée. Donner un cycle de vie au constat
   aurait recréé un second système d'état à côté du premier.
5. **Aucun champ de responsabilité** (« qui l'a cassé », « imputable à »).
   La ligne n° 1 du produit vaut pour le personnel depuis S7 : on aide
   mieux, on ne surveille pas. Un parc sert à réparer, pas à imputer.
6. **Aucun format imposé sur ``serial_number``** (décision 1) : le réel
   comorien n'en a pas, et deux appareils identiques sans numéro sont un
   cas normal — d'où l'absence de contrainte d'unicité, qui aurait refusé
   la deuxième saisie honnête.

Cloisonnement (ADR 0002) : ``Equipment`` porte son ``center`` et chaque
queryset d'API passe par ``for_center()`` ; ``EquipmentReport`` l'atteint
par ``equipment__center`` — jamais par une dénormalisation du centre sur la
ligne, qui pourrait diverger de l'équipement dont elle dépend.

**Le gel commercial n'atteint jamais ce module** (décision 4) :
``require_center_can_administer`` n'est importé nulle part dans
``apps.equipment`` et ne doit jamais l'être — *signaler une panne doit
toujours passer*. La sonde fail-closed de S5
(``tests/test_adversarial_s5.py``) verrouille la liste des importeurs par
égalité stricte, et ``tests/test_equipment.py`` en pose le miroir local.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.centers.models import CenterScopedQuerySet
from apps.common.models import AppendOnlyModel, AppendOnlyQuerySet, TimeStampedModel


class EquipmentQuerySet(CenterScopedQuerySet):
    """Le parc d'un centre — donnée d'exploitation, jamais transversale."""

    def usable(self):
        """Ce qui peut servir aujourd'hui : ni en panne, ni réformé."""
        return self.filter(status=Equipment.Status.IN_SERVICE)


class EquipmentReportQuerySet(AppendOnlyQuerySet):
    """Les signalements atteignent le centre PAR leur équipement.

    Hériter d'``AppendOnlyQuerySet`` est ce qui garde ``update()``,
    ``delete()`` et ``bulk_update()`` fermés au niveau du queryset : un
    ``EquipmentReport.objects.filter(...).update(...)`` lève, il ne réécrit
    pas silencieusement un constat.
    """

    def for_center(self, center):
        return self.filter(equipment__center=center)


class EquipmentCategory(models.TextChoices):
    """Catégories FERMÉES (ADR 0021, décision 1).

    Déclarées au niveau du module — et non dans le corps du modèle — pour
    que les ``CheckConstraint`` de ``Meta`` puissent lire la liste : Python
    ne donne pas accès aux noms de la classe englobante depuis une classe
    imbriquée. ``Equipment.Category`` reste l'alias public.
    """

    DIAGNOSTIC = "diagnostic", "Diagnostic"
    IMAGING = "imagerie", "Imagerie"
    OPERATING_ROOM = "bloc_operatoire", "Bloc opératoire"
    LABORATORY = "laboratoire", "Laboratoire"
    MEDICAL_FURNITURE = "mobilier_medical", "Mobilier médical"
    IT = "informatique", "Informatique"
    OTHER = "autre", "Autre"


class EquipmentStatus(models.TextChoices):
    """Les trois états du parc — ``reforme`` est TERMINAL."""

    IN_SERVICE = "en_service", "En service"
    OUT_OF_ORDER = "en_panne", "En panne"
    DECOMMISSIONED = "reforme", "Réformé"


class Equipment(TimeStampedModel):
    """Un matériel du centre — ce qu'il a, où, et si ça marche.

    L'état est le cœur du modèle et sa machine est fermée
    (``services.EQUIPMENT_TRANSITIONS``) :

        en_service ⇄ en_panne
             └──┴──────> reforme   (TERMINAL, définitif)

    La terminalité est rejouée dans :meth:`save` — donc valable sur TOUT
    chemin d'écriture, y compris un ``objects.create``/``save()`` hors
    service — pendant que la base garantit ce qui lui est exprimable : le
    statut et la catégorie restent dans leur liste fermée, le nom n'est
    jamais vide (``CheckConstraint``). Un ``UPDATE`` brut ne peut donc pas
    inventer un état ni un parc anonyme ; et depuis le lot SV (migration
    ``equipment/0002_sv_db_triggers``), il ne peut plus non plus ressusciter
    un équipement réformé — la vigilance consignée en S8 est soldée par un
    trigger PostgreSQL miroir de la terminalité rejouée ici.
    """

    #: Alias publics — le reste du produit écrit ``Equipment.Status.…``.
    Category = EquipmentCategory
    Status = EquipmentStatus

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="equipments",
    )
    name = models.CharField("nom", max_length=120)
    category = models.CharField(
        "catégorie", max_length=24, choices=EquipmentCategory.choices
    )
    serial_number = models.CharField(
        "numéro de série",
        max_length=64,
        blank=True,
        help_text=(
            "Champ libre : le réel comorien n'a pas de format, et deux "
            "appareils identiques sans numéro sont un cas normal."
        ),
    )
    location = models.CharField(
        "emplacement",
        max_length=120,
        blank=True,
        help_text=(
            "Texte libre (ADR 0021 décision 2) — jamais une chambre : tous "
            "les centres n'ont pas d'hospitalisation."
        ),
    )
    commissioned_on = models.DateField("mis en service le", null=True, blank=True)
    status = models.CharField(
        "état",
        max_length=16,
        choices=EquipmentStatus.choices,
        default=EquipmentStatus.IN_SERVICE,
    )
    notes = models.TextField("notes", blank=True)

    objects = EquipmentQuerySet.as_manager()

    class Meta:
        verbose_name = "équipement"
        verbose_name_plural = "équipements"
        ordering = ["name", "id"]
        constraints = [
            # Ce qui EST exprimable en base l'est (règle d'ingénierie du
            # projet) : les deux listes fermées et le nom non vide. Un
            # `update()` brut ne peut donc pas inventer un état hors machine
            # ni fabriquer une ligne de parc anonyme.
            models.CheckConstraint(
                condition=models.Q(status__in=EquipmentStatus.values),
                name="equipment_status_is_closed",
            ),
            models.CheckConstraint(
                condition=models.Q(category__in=EquipmentCategory.values),
                name="equipment_category_is_closed",
            ),
            models.CheckConstraint(
                condition=~models.Q(name=""), name="equipment_name_not_empty"
            ),
        ]
        indexes = [models.Index(fields=["center", "status"])]

    def __str__(self) -> str:
        return f"{self.name} — {self.center.name}"

    @property
    def is_decommissioned(self) -> bool:
        return self.status == self.Status.DECOMMISSIONED

    def save(self, *args, **kwargs):
        # Invariants STRUCTURELS, rejoués sur TOUT chemin d'écriture (règle
        # d'ingénierie CLAUDE.md) — les services ne sont pas la seule garde.
        self.name = (self.name or "").strip()
        if not self.name:
            raise ValidationError("Le nom de l'équipement est obligatoire.")
        self.serial_number = (self.serial_number or "").strip()
        self.location = (self.location or "").strip()
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )
            if (
                previous == self.Status.DECOMMISSIONED
                and self.status != previous
            ):
                raise ValidationError(
                    "Un équipement réformé ne revient pas en service : "
                    "la réforme est définitive."
                )
        super().save(*args, **kwargs)


class EquipmentReport(AppendOnlyModel):
    """Le signalement d'une panne — un CONSTAT daté, append-only.

    Trois choses qu'il **ne fait pas**, et c'est tout le modèle :

    1. il ne change **pas** l'état de l'équipement (décision 1 de l'ADR) —
       l'infirmière constate, le directeur décide ;
    2. il ne se **corrige** pas — un second signalement dit la suite (le
       socle ``AppendOnlyModel`` refuse ``save()`` sur une ligne existante,
       ``delete()``, ``update()`` et ``bulk_update()``) ;
    3. il ne se **ferme** pas — pas de statut, pas de ``resolved_at`` : ce
       qui dit où on en est, c'est l'état de l'équipement.

    ``description`` est du texte libre écrit par un humain pressé : il n'est
    **jamais** recopié dans un payload d'audit (contrat ADR 0007, même
    parade que le contenu d'un ticket de support).
    """

    equipment = models.ForeignKey(
        Equipment,
        verbose_name="équipement",
        on_delete=models.PROTECT,
        related_name="reports",
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="signalé par",
        on_delete=models.PROTECT,
        related_name="equipment_reports",
    )
    description = models.TextField("description")

    objects = EquipmentReportQuerySet.as_manager()

    class Meta:
        verbose_name = "signalement d'équipement"
        verbose_name_plural = "signalements d'équipement"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(description=""),
                name="equipment_report_description_not_empty",
            ),
        ]
        indexes = [models.Index(fields=["equipment", "-created_at"])]

    def __str__(self) -> str:
        return f"Signalement #{self.pk} — {self.equipment_id}"

    @property
    def center_id(self):
        return self.equipment.center_id

    def save(self, *args, **kwargs):
        self.description = (self.description or "").strip()
        if not self.description:
            raise ValidationError("La description du signalement est obligatoire.")
        # Un équipement RÉFORMÉ est sorti du parc : le signaler en panne
        # n'a plus d'objet et brouillerait le registre. Corollaire direct de
        # l'état terminal, pas une garde de plus — et sans rapport avec le
        # gel commercial, qui lui ne ferme jamais rien ici.
        #
        # L'état est relu EN BASE et jamais sur ``self.equipment`` (revue
        # guardian S8) : la vue charge l'appareil, puis insère ; une
        # instance en cache dirait « en service » d'un appareil réformé
        # entre-temps, et le constat passerait. Même parade que la
        # terminalité dans :meth:`Equipment.save`, qui relit déjà son
        # ``previous``. Pas de ``select_for_update`` ici : ``save()`` est
        # appelable hors transaction (factories, imports), où il lèverait —
        # la fenêtre résiduelle est celle d'un commit concurrent à la
        # microseconde, sans conséquence (un constat de plus sur un
        # appareil sorti du parc à cet instant).
        if self.equipment_id is not None:
            current = (
                Equipment.objects.filter(pk=self.equipment_id)
                .values_list("status", flat=True)
                .first()
            )
            if current == Equipment.Status.DECOMMISSIONED:
                raise ValidationError(
                    "Cet équipement est réformé : il n'est plus en service."
                )
        super().save(*args, **kwargs)
