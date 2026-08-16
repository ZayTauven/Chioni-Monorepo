"""Admin des relances — APPEND-ONLY, donc fermé (S10, ADR 0023).

Née fermée, comme toute table depuis S4 (ADR 0017 décision 4). Un
formulaire ici serait une seconde porte, silencieuse, autour de la seule
chose que cette table protège : **la cadence**. Supprimer une ligne
rendrait une facture re-relançable indéfiniment ; en ajouter une à la main
ferait taire l'automate sans que personne n'ait rien envoyé.

``list_display`` ne montre ni le patient ni la facture en clair au-delà de
leur référence : un écran d'administration qui listerait « qui doit de
l'argent » serait exactement le registre de comportement de paiement que
l'ADR refuse de fabriquer (même raison que l'exclusion des actions CRM du
journal du directeur).
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin

from .models import ContactLog


@admin.register(ContactLog)
class ContactLogAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("center", "kind", "channel", "recipient", "created_at")
    list_filter = ("kind", "channel", "recipient", "center")
    date_hierarchy = "created_at"
    autocomplete_fields = ("center", "patient", "created_by")
