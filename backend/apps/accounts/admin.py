from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.common.admin import ReadOnlyAdminMixin

from .models import ErasureRequest, PlatformStaff, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Chioni", {"fields": ("phone",)}),
    )
    list_display = ("username", "phone", "email", "first_name", "last_name", "is_staff")
    search_fields = ("username", "phone", "first_name", "last_name", "email")


@admin.register(PlatformStaff)
class PlatformStaffAdmin(admin.ModelAdmin):
    """The FOURTH hat (S4, ADR 0017) — kept writable ON PURPOSE.

    This is the bootstrap of the back-office itself: the very first Chioni
    operator can only be born here (there is no operator yet to create
    him through the API). It is also the only lever to revoke an operator
    in an emergency. Keeping it small and visible is the parade: a row
    here grants product rights, ``is_staff`` does NOT.
    """

    list_display = ("user", "role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("user__username", "user__phone", "user__email")
    autocomplete_fields = ("user",)


@admin.register(ErasureRequest)
class ErasureRequestAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """RGPD erasure requests — INSPECTION only (S4 lot 3).

    Strictly read-only: the lifecycle belongs to
    ``accounts.services.process_erasure_request``, which runs the refusal
    guards (last director of a center, payment in flight, last platform
    admin), executes the tombstone anonymisation and journalises. A change
    form here would flip a status to « traitée » WITHOUT anonymising
    anything — an erasure declared done and never performed is the worst
    possible failure mode of this feature.

    ``refusal_reason`` stays visible (it is evidence of the decision), but
    nothing on this page is editable.
    """

    list_display = ("id", "user", "status", "requested_at", "processed_at")
    list_filter = ("status",)
    search_fields = ("user__username",)
    readonly_fields = (
        "user", "status", "requested_at", "processed_by", "processed_at",
        "refusal_reason", "created_at", "updated_at",
    )
