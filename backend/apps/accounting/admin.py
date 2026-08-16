"""Admin comptable — APPEND-ONLY et compteur fermés (S10, ADR 0023).

Nés fermés, comme toute table depuis S4 (ADR 0017 décision 4).

- :class:`AccountingExport` est une PIÈCE : la retoucher à la main
  réécrirait un document déjà remis à un comptable, et la base le refuse
  de toute façon (``AppendOnlyModel``) — un écran qui propose le geste est
  déjà un mensonge.
- :class:`AccountingExportSeries` est le COMPTEUR de la série « E- » :
  l'éditer fabriquerait un trou ou un doublon de numéro, c'est-à-dire
  exactement ce que le verrou de ligne existe pour empêcher. Il n'est
  d'ailleurs pas enregistré du tout — un compteur ne s'inspecte pas, il se
  lit par la série qu'il produit (patron ``SubscriptionInvoiceCounter``,
  S5).

``list_display`` ne montre pas ``lines`` : un snapshot de plusieurs
milliers de mouvements n'a rien à faire dans une liste, et sa place est le
téléchargement authentifié.
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin

from .models import AccountingExport


@admin.register(AccountingExport)
class AccountingExportAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "number", "center", "period_start", "period_end",
        "net_kmf", "line_count", "created_at",
    )
    list_filter = ("center",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("center", "generated_by")

    @admin.display(description="numéro")
    def number(self, export):
        return export.number
