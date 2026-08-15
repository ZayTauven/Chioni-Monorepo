"""Inpatient admin — READ-ONLY, the five tables (S6, ADR 0019).

Born closed, like every table since S4 (ADR 0017 décision 4). A change
form here would offer a silent second path around:

- the STATE MACHINE of a stay (``sortie``/``annule`` are terminal, and the
  discharge releases the bed AND closes the pivot consultation in the same
  transaction);
- the **exclusivity of a bed** — the partial unique constraint would still
  hold, but an admin form editing ``released_at`` could re-open a released
  occupation and rewrite a bed's history;
- the audit entries a director never sees but a reviewer must find
  (``stay.admitted``, ``bed.assigned``…);
- the mandatory cancellation motive, and the « no act billed » guard.

``Room`` and ``Bed`` are read-only too: their creation is audited
(``room.created`` / ``bed.created``, whitelisted in the director's
journal), and a hand-made bed would exist with no trace of who declared
it.
"""

from django.contrib import admin

from apps.common.admin import ReadOnlyAdminMixin

from .models import Bed, BedAssignment, Room, Stay, StayDayBilling


@admin.register(Room)
class RoomAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "center", "is_active", "created_at")
    list_filter = ("is_active", "center")
    search_fields = ("name", "center__name")
    autocomplete_fields = ("center",)


@admin.register(Bed)
class BedAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "room", "is_active", "created_at")
    list_filter = ("is_active", "room__center")
    search_fields = ("name", "room__name")
    autocomplete_fields = ("room",)


@admin.register(Stay)
class StayAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "patient", "center", "admitted_at", "discharged_at", "status",
        "priority",
    )
    list_filter = ("status", "priority", "center")
    search_fields = ("patient__last_name", "patient__first_name")
    autocomplete_fields = ("patient", "center", "encounter", "admitted_by")
    date_hierarchy = "admitted_at"


@admin.register(StayDayBilling)
class StayDayBillingAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only, comme tout ce qui touche à l'argent.

    Un formulaire ici offrirait la seule porte capable de poser une clé
    d'idempotence déjà servie, de délier un lot de ses actes ou de
    contourner le plafond de journées — c'est-à-dire d'annuler à lui seul
    le correctif du 15/08/2026. Le modèle est append-only : la base
    refuserait de toute façon la modification.
    """

    list_display = ("stay", "center", "days", "tariff", "created_at")
    list_filter = ("center",)
    search_fields = ("stay__patient__last_name", "idempotency_key")
    autocomplete_fields = ("stay", "center", "tariff", "billed_by")
    date_hierarchy = "created_at"


@admin.register(BedAssignment)
class BedAssignmentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("bed", "stay", "assigned_at", "released_at")
    list_filter = ("bed__room__center",)
    search_fields = ("stay__patient__last_name", "bed__name")
    autocomplete_fields = ("stay", "bed", "assigned_by", "released_by")
    date_hierarchy = "assigned_at"
