from django.contrib import admin

from .models import GuardianLink, GuardianProfile, PatientInsurance, PatientProfile


@admin.register(PatientInsurance)
class PatientInsuranceAdmin(admin.ModelAdmin):
    list_display = (
        "patient", "insurer_name", "member_number", "valid_until",
        "is_active", "created_at",
    )
    list_filter = ("is_active",)
    search_fields = ("patient__last_name", "patient__first_name", "insurer_name")
    autocomplete_fields = ("patient", "created_by")


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = (
        "last_name",
        "first_name",
        "birth_date",
        "phone",
        "city",
        "claim_status",
        "user",
        "created_at",
    )
    list_filter = ("claim_status", "sex")
    search_fields = ("last_name", "first_name", "phone", "user__phone")
    autocomplete_fields = ("user", "created_by_user", "created_by_center", "merged_into")


@admin.register(GuardianProfile)
class GuardianProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "country_of_residence", "preferred_currency", "created_at")
    list_filter = ("country_of_residence", "preferred_currency")
    search_fields = ("user__username", "user__phone")
    autocomplete_fields = ("user",)


@admin.register(GuardianLink)
class GuardianLinkAdmin(admin.ModelAdmin):
    list_display = (
        "guardian",
        "patient",
        "relationship",
        "status",
        "initiated_by",
        "accepted_at",
        "revoked_at",
    )
    list_filter = ("status", "relationship", "initiated_by")
    search_fields = (
        "guardian__user__phone",
        "patient__last_name",
        "patient__first_name",
    )
    autocomplete_fields = ("guardian", "patient")
