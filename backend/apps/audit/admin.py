from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Consultation only — the audit log is written by code, never by hand.

    Behaviour unchanged since S4 lot 2: the three hand-written refusals
    became the shared ``AppendOnlyAdminMixin`` (ADR 0017 décision 4). The
    table is append-only at ORM level AND behind a PostgreSQL trigger
    (ADR 0006), so a form here could only ever raise.
    """

    list_display = ("created_at", "actor", "action", "center", "content_type", "object_id")
    list_filter = ("action", "center", "content_type")
    search_fields = ("action", "actor__username", "actor__phone", "object_id")
    date_hierarchy = "created_at"
