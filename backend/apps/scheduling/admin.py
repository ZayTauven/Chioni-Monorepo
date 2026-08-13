from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "patient", "center", "practitioner", "scheduled_at",
        "duration_minutes", "status",
    )
    list_filter = ("status", "center")
    search_fields = ("patient__last_name", "patient__first_name", "reason")
    autocomplete_fields = ("patient", "center", "practitioner", "created_by")
    date_hierarchy = "scheduled_at"
    readonly_fields = ("reminder_sent_at", "created_at", "updated_at")
