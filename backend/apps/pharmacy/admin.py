"""Admin du réseau — LECTURE SEULE sur les huit tables (S9, ADR 0022).

Nées fermées, comme toute table depuis S4. Un formulaire ici offrirait une
seconde porte, silencieuse, autour de :

- la **machine à états** d'une officine — valider une pharmacie est la
  décision qui ouvre la réception des demandes ; elle a une porte auditée
  (``/platform/pharmacies/{pk}/status/``) et une seule ;
- l'**append-only** des demandes, des diffusions et des réponses — la base
  refuserait de toute façon, mais un écran qui propose le geste est déjà un
  mensonge ;
- l'**audit** : chaque écriture du module laisse une entrée, et une ligne
  faite à la main existerait sans trace.

``list_display`` ne montre **jamais un libellé de médicament** : c'est du
``detail_clinique`` (ADR 0005), et l'admin Django est transverse par nature
— un ``search_fields`` sur ``medication`` ferait de cette page un moteur de
recherche sur les ordonnances de tout le pays. Même posture que la
description d'un signalement (S8) et le corps d'un ticket (S5).
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .models import (
    AvailabilityRequest,
    AvailabilityRequestItem,
    AvailabilityRequestRecipient,
    AvailabilityResponse,
    AvailabilityResponseLine,
    Pharmacy,
    PharmacyDocument,
    PharmacyMembership,
)


@admin.register(Pharmacy)
class PharmacyAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "island", "city", "status", "phone")
    list_filter = ("status", "island")
    search_fields = ("name", "city")
    date_hierarchy = "created_at"


@admin.register(PharmacyMembership)
class PharmacyMembershipAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("user", "pharmacy", "is_active", "created_at")
    list_filter = ("is_active", "pharmacy")
    search_fields = ("user__username", "pharmacy__name")
    date_hierarchy = "created_at"


@admin.register(PharmacyDocument)
class PharmacyDocumentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Aucun lien de téléchargement : le stockage privé n'a pas d'URL, et
    l'admin ne doit pas devenir le chemin par lequel une licence se lit."""

    list_display = ("pharmacy", "doc_type", "created_at", "archived_at")
    list_filter = ("doc_type", "pharmacy")
    date_hierarchy = "created_at"


@admin.register(AvailabilityRequest)
class AvailabilityRequestAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "center", "island", "city", "status", "created_at")
    list_filter = ("status", "island", "center")
    date_hierarchy = "created_at"


@admin.register(AvailabilityRequestItem)
class AvailabilityRequestItemAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """``list_display`` SANS ``medication`` et ``search_fields`` vide : la
    liste des médicaments d'un patient ne s'affiche pas dans un back-office
    transverse, et ne s'y cherche pas."""

    list_display = ("id", "request", "created_at")
    date_hierarchy = "created_at"


@admin.register(AvailabilityRequestRecipient)
class AvailabilityRequestRecipientAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "request", "pharmacy", "created_at")
    list_filter = ("pharmacy",)
    date_hierarchy = "created_at"


@admin.register(AvailabilityResponse)
class AvailabilityResponseAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """``comment`` absent de la liste : texte libre écrit par un tiers."""

    list_display = ("id", "recipient", "created_at")
    date_hierarchy = "created_at"


@admin.register(AvailabilityResponseLine)
class AvailabilityResponseLineAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "response", "item", "is_available")
