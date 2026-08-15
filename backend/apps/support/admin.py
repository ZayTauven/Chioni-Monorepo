"""Support admin — READ-ONLY, the three tables (S5 lot 3, ADR 0018).

Born closed, like every table of S5: the product now carries its own
audited doors (`/centers/{c}/support/…` and `/platform/support/…`), and a
change form would offer a second, silent path — one that skips the state
machine (``ferme`` is final), the ``author_side`` the service poses, the
audit entry the director reads in his journal, and the ADR 0014 pipeline
that every byte of an attachment goes through.

``SupportMessage`` and ``SupportAttachment`` are ``AppendOnlyAdminMixin``:
the first is structurally append-only (``AppendOnlyModel``), the second
would produce a row whose file never passed the upload pipeline. The
``file`` field is deliberately EXCLUDED everywhere (same contract as
``KycDocumentAdmin`` / ``PatientDocumentAdmin``): the private storage has
NO url, and the admin widget would try to render one.
"""

from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .models import SupportAttachment, SupportMessage, SupportTicket


@admin.register(SupportTicket)
class SupportTicketAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "id", "center", "subject", "category", "status", "priority",
        "created_at",
    )
    list_filter = ("status", "category", "priority")
    search_fields = ("subject", "center__name")
    readonly_fields = (
        "center", "opened_by", "subject", "category", "status", "priority",
        "closed_at", "created_at", "updated_at",
    )


@admin.register(SupportMessage)
class SupportMessageAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    """Append-only at the model level — the admin never offers the form."""

    list_display = ("id", "ticket", "author_side", "created_at")
    list_filter = ("author_side",)
    search_fields = ("ticket__subject",)
    readonly_fields = ("ticket", "author", "author_side", "body", "created_at")


@admin.register(SupportAttachment)
class SupportAttachmentAdmin(AppendOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "ticket", "uploaded_by", "created_at")
    search_fields = ("ticket__subject",)
    readonly_fields = ("ticket", "uploaded_by", "created_at")
    exclude = ("file",)
