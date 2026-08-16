"""Equipment admin — READ-ONLY, les deux tables (S8, ADR 0021).

Nées fermées, comme toute table depuis S4 (ADR 0017 décision 4). Un
formulaire ici offrirait une seconde porte, silencieuse, autour de :

- la **machine à états** (``reforme`` est terminal, et sa terminalité est
  rejouée dans ``save()`` : un formulaire d'admin serait le seul chemin à
  tenter de la contourner) ;
- l'**append-only** du signalement — la base refuserait de toute façon,
  mais un écran qui propose le geste est déjà un mensonge ;
- l'**audit** : déclarer un équipement, corriger sa fiche, changer son
  état et signaler une panne écrivent quatre entrées que le directeur lit
  dans son journal. Un appareil fait à la main existerait sans trace.
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .models import Equipment, EquipmentReport


@admin.register(Equipment)
class EquipmentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "center", "category", "status", "location")
    list_filter = ("status", "category", "center")
    search_fields = ("name", "serial_number", "center__name")
    autocomplete_fields = ("center",)
    date_hierarchy = "created_at"


@admin.register(EquipmentReport)
class EquipmentReportAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """``list_display`` volontairement SANS ``description`` : le texte libre
    d'un constat n'a pas à s'afficher en liste à côté du nom de qui l'a
    écrit — même posture que le contenu d'un ticket de support."""

    list_display = ("equipment", "reported_by", "created_at")
    list_filter = ("equipment__center",)
    search_fields = ("equipment__name",)
    autocomplete_fields = ("equipment", "reported_by")
    date_hierarchy = "created_at"
