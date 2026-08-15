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
class PlatformStaffAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """The FOURTH hat — READ-ONLY since S5 lot 3 (ADR 0018 décision 6).

    It stayed writable through the whole of S4 « à dessein » (ADR 0017 lot
    1 §13): the very first Chioni operator could be born nowhere else. The
    S4 adversarial review consigned the price of that choice — « un
    superuser Django est toujours à un formulaire de la 4ᵉ casquette » —
    and S5 pays it off, because the two doors that were missing now exist:

    - the PRODUCT door: `GET|POST /platform/operators/` and
      `PATCH /platform/operators/{pk}/` (``admin`` only, audited
      ``platform_staff.created|updated``, with the « last active admin »
      guard that stops Chioni from locking itself out of its own
      back-office) ;
    - the BOOTSTRAP door: ``python manage.py create_platform_staff``,
      usable in production, granting no credential (shadow account + OTP).

    What closing this form removes, stated plainly: an emergency
    revocation by a Django superuser. That lever moves to the API — where
    it is audited and where the last-admin guard applies, which the form
    never enforced.
    """

    list_display = ("user", "role", "is_active", "created_at")
    list_filter = ("role", "is_active")
    search_fields = ("user__username", "user__phone", "user__email")
    readonly_fields = ("user", "role", "is_active", "created_at", "updated_at")


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
