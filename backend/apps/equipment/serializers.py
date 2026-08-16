"""Equipment serializers (S8 — ADR 0021).

**Un seul sérialiseur de lecture pour l'équipement lui-même** : tout le
staff actif lit exactement la même fiche. Un appareil n'a ni régime, ni
secret médical, ni argent — inventer ici deux audiences aurait été une
cérémonie sans objet (le module fait deux tables, il ne mérite pas la
machinerie de segmentation de S3).

---

**LA question d'audience du sprint : le nom de qui a signalé.**

Le signalement est le seul endroit du module où une PERSONNE apparaît.
Arbitrage retenu — **le constat est lu par tout le staff, l'auteur du
constat par le DIRECTEUR seul** (:class:`EquipmentReportDirectorSerializer`
n'ajoute qu'un champ à :class:`EquipmentReportSerializer`) :

1. **Un signalement ne change rien** (ADR 0021, décision 1) : il ne modifie
   pas l'état de l'appareil. L'équipe n'a donc besoin d'aucun responsable
   pour agir — ce dont elle a besoin, c'est de la PHRASE (« l'échographe
   fait un bruit anormal ») et de la date, qu'elle reçoit intégralement.
   Le nom, lui, n'est utile qu'à qui **décide** : le directeur, qui va
   changer l'état ou faire réparer, et qui doit pouvoir demander « qu'as-tu
   constaté exactement ? ».
2. **Nommer le signaleur devant toute l'équipe refroidit le signalement.**
   Dans une clinique de huit personnes, « qui a encore dit que l'appareil
   est cassé ? » suffit à faire taire la prochaine panne. La ligne n° 1 du
   produit — *aider mieux, jamais surveiller ; la dignité de TOUS les
   acteurs est une contrainte de conception* — vaut pour le personnel
   depuis S7, et un parc sert à réparer, pas à imputer (le modèle n'a
   d'ailleurs aucun champ de responsabilité).
3. **La cohérence avec ce que le produit expose déjà.**
   ``GET /centers/{c}/staff/`` est **directeur seul** : rendre un nom (ou
   même un id résoluble via l'annuaire des praticiens) à tout le staff
   ferait de cette route une fenêtre latérale sur l'annuaire du personnel.
   Le précédent exact est ``AuditLogEntrySerializer.actor_display``, résolu
   pour le directeur et pour lui seul ; celui de la feuille de présence
   (``MyAttendanceSerializer`` sans ``noted_by``, « savoir quel collègue a
   coché la case transformerait la feuille en objet de conflit ») dit la
   même chose.
4. **Le directeur le lit déjà**, par son journal d'audit
   (``equipment.reported`` est dans la liste blanche, et ``actor_display``
   y résout les membres de son centre). Le sérialiseur ne lui ouvre donc
   rien de neuf : il évite un second appel. L'exposer plus largement
   aurait, à l'inverse, créé une information que le journal lui-même
   réserve au directeur.

**Arbitrage RÉVERSIBLE**, et il tient en un champ : si le terrain montre
qu'un service a besoin de rappeler le collègue qui a constaté, c'est
``EquipmentReportSerializer`` qu'on élargit, pas la discipline qu'on
abandonne.
"""

from rest_framework import serializers

from apps.equipment.models import Equipment, EquipmentReport


def _display_name(user) -> str:
    """Nom affiché d'un collègue — convention STAFF (patron ``apps.hrm``)."""
    return f"{user.first_name} {user.last_name}".strip() or user.username


# ---------------------------------------------------------------------------
# Le parc — UNE audience, une fiche
# ---------------------------------------------------------------------------


class EquipmentSerializer(serializers.ModelSerializer):
    """La fiche d'un équipement, lue par tout membre actif du centre.

    ``report_count`` / ``last_report_at`` viennent des annotations de
    ``services.equipments_queryset`` : ils valent 0/``None`` si l'instance
    n'en vient pas (une réponse d'écriture, par exemple), jamais une
    requête par ligne.
    """

    report_count = serializers.IntegerField(read_only=True, default=0)
    last_report_at = serializers.DateTimeField(read_only=True, default=None)

    class Meta:
        model = Equipment
        fields = [
            "id", "name", "category", "serial_number", "location",
            "commissioned_on", "status", "notes", "report_count",
            "last_report_at", "created_at", "updated_at",
        ]
        read_only_fields = fields


class EquipmentWriteSerializer(serializers.Serializer):
    """Création — écrit à la main (jamais un ``ModelSerializer``) : aucun
    champ du modèle ne peut s'inviter par distraction, et ``status`` reste
    hors de portée (la machine à états a sa porte)."""

    name = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "Le nom de l'équipement est requis.",
            "blank": "Le nom de l'équipement est requis.",
        },
    )
    category = serializers.ChoiceField(
        choices=Equipment.Category.choices,
        error_messages={
            "required": "La catégorie est requise.",
            "invalid_choice": "Catégorie inconnue.",
        },
    )
    serial_number = serializers.CharField(
        max_length=64, required=False, allow_blank=True, default=""
    )
    location = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    commissioned_on = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class EquipmentPatchSerializer(serializers.Serializer):
    """Correction de fiche — tous les champs facultatifs, ``status`` absent."""

    name = serializers.CharField(max_length=120, required=False)
    category = serializers.ChoiceField(
        choices=Equipment.Category.choices,
        required=False,
        error_messages={"invalid_choice": "Catégorie inconnue."},
    )
    serial_number = serializers.CharField(
        max_length=64, required=False, allow_blank=True
    )
    location = serializers.CharField(
        max_length=120, required=False, allow_blank=True
    )
    commissioned_on = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class EquipmentStatusSerializer(serializers.Serializer):
    """``{status}`` — la seule porte de la machine à états (directeur)."""

    status = serializers.ChoiceField(
        choices=Equipment.Status.choices,
        error_messages={
            "required": "L'état est requis.",
            "invalid_choice": "État inconnu.",
        },
    )


# ---------------------------------------------------------------------------
# Les signalements — DEUX audiences, un champ d'écart (voir le docstring)
# ---------------------------------------------------------------------------


class EquipmentReportSerializer(serializers.ModelSerializer):
    """Le constat, tel que TOUT le staff actif le lit : la phrase et la
    date, **sans l'auteur** (ni son nom, ni son id — un id se résout dans
    l'annuaire des praticiens)."""

    class Meta:
        model = EquipmentReport
        fields = ["id", "equipment", "description", "created_at"]
        read_only_fields = fields


class EquipmentReportDirectorSerializer(EquipmentReportSerializer):
    """Le même constat pour le DIRECTEUR, qui décide — avec son auteur.

    Identité, pas duplication : la classe hérite du sérialiseur public et
    n'ajoute qu'un champ, de sorte qu'un champ ajouté demain à l'un le soit
    à l'autre sans divergence possible.
    """

    reported_by_display = serializers.SerializerMethodField()

    class Meta(EquipmentReportSerializer.Meta):
        fields = EquipmentReportSerializer.Meta.fields + [
            "reported_by", "reported_by_display",
        ]
        read_only_fields = fields

    def get_reported_by_display(self, report) -> str:
        return _display_name(report.reported_by)


class EquipmentReportWriteSerializer(serializers.Serializer):
    """``{description}`` — et rien d'autre : l'équipement voyage dans
    l'URL, l'auteur est l'appelant (un champ ``reported_by`` ouvrirait un
    signalement au nom d'un collègue)."""

    description = serializers.CharField(
        max_length=2000,
        error_messages={
            "required": "La description du signalement est requise.",
            "blank": "La description du signalement est requise.",
        },
    )
