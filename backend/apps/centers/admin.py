from django.contrib import admin

from .models import HealthCenter, StaffMembership, TariffItem


@admin.register(HealthCenter)
class HealthCenterAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "island", "city", "kyc_status", "created_at")
    list_filter = ("type", "island", "kyc_status")
    search_fields = ("name", "city", "phone", "email")


@admin.register(StaffMembership)
class StaffMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "center", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "center")
    search_fields = ("user__username", "user__phone", "center__name")
    autocomplete_fields = ("user", "center")


@admin.register(TariffItem)
class TariffItemAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "price_kmf", "center", "is_active")
    list_filter = ("is_active", "center")
    search_fields = ("code", "label", "center__name")
    autocomplete_fields = ("center",)
