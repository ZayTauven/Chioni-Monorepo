from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Consultation only — the audit log is written by code, never by hand."""

    list_display = ("created_at", "actor", "action", "content_type", "object_id")
    list_filter = ("action", "content_type")
    search_fields = ("action", "actor__username", "actor__phone", "object_id")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
