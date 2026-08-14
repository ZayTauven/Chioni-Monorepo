"""Centers admin — the ONE app that keeps a deliberate write door.

S4, ADR 0017 décision 4. Three postures, each argued:

- ``HealthCenterAdmin`` — profile editable, **KYC block read-only** (lot 1):
  the platform API is the single, audited door to a KYC transition.
- ``StaffMembershipAdmin`` — **kept WRITABLE on purpose** (see its
  docstring): the last-resort bootstrap of a tenant.
- ``TariffItemAdmin`` / ``KycDocumentAdmin`` — read-only (see below).
"""

from django.contrib import admin

from apps.common.admin import ReadOnlyAdminMixin

from .models import HealthCenter, KycDocument, StaffMembership, TariffItem


@admin.register(HealthCenter)
class HealthCenterAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "island", "city", "kyc_status", "created_at")
    list_filter = ("type", "island", "kyc_status")
    search_fields = ("name", "city", "phone", "email")
    # S4 (ADR 0017, décision 3) — the KYC block is READ-ONLY here: the
    # platform API (`POST /api/v1/platform/centers/{pk}/kyc/`) is now the
    # single door, with its explicit state machine, its mandatory motive on
    # suspension and its audit entry. Leaving the field editable would keep
    # the admin as a parallel, UNAUDITED path to opening the diaspora rail.
    #
    # The rest of the tenant profile (name, address, contact) stays
    # editable ON PURPOSE: it is not sensitive (no money, no medical, no
    # consent, no role), and a support operator fixing a typo in a center's
    # address must not require a code deploy. `update_center` remains the
    # normal, audited door — this one is the fallback.
    readonly_fields = (
        "kyc_status", "kyc_reason", "kyc_updated_at", "kyc_updated_by",
    )


@admin.register(KycDocument)
class KycDocumentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only (S4 lot 2) — same class of object as ``PatientDocument``.

    Two reasons, both structural: the bytes live on the PRIVATE storage
    and pass through the hardened upload pipeline (ADR 0014) that only
    ``upload_kyc_document`` runs — a row created here would carry an
    unverified (or empty) file; and archiving is FINAL by ``save()`` guard,
    a rule the change form would let an operator undo silently on the
    evidence supporting a KYC decision.
    """

    # The « file » field is deliberately ABSENT everywhere (same contract as
    # PatientDocumentAdmin): the private storage has NO URL (ADR 0016 §5)
    # and the admin widget would try to render one. The bytes are only
    # reachable through the authenticated download endpoints.
    list_display = (
        "center", "doc_type", "uploaded_by", "archived_at", "created_at",
    )
    list_filter = ("doc_type", "center")
    search_fields = ("center__name",)
    autocomplete_fields = ("center", "uploaded_by", "archived_by")
    exclude = ("file",)


@admin.register(StaffMembership)
class StaffMembershipAdmin(admin.ModelAdmin):
    """Kept WRITABLE on purpose (ADR 0017 décision 4) — rescue bootstrap.

    This is the tenant's equivalent of ``PlatformStaffAdmin``: the very
    last way back into a center that has locked itself out (no active
    director left, and no Chioni operator available to run
    ``POST /platform/centers/{pk}/directors/``). Since S4 the platform API
    IS the normal path — the admin stopped being the only door, which was
    the actual problem — so this form should now be a rarity.

    What it costs, stated plainly: a membership created here skips
    ``add_staff_member`` (no ``staff.membership_created`` audit entry, no
    duplicate-role check beyond the DB constraint, no shadow-account
    creation by phone) and a role changed here skips the « last active
    director » guard. Whoever uses it owes the tenant a written trace
    elsewhere. If a future sprint gives the platform a complete staff
    module (S5 support), this door should close.
    """

    list_display = ("user", "center", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "center")
    search_fields = ("user__username", "user__phone", "center__name")
    autocomplete_fields = ("user", "center")


@admin.register(TariffItem)
class TariffItemAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Read-only (S4 lot 2 — arbitrage assumé, RÉVERSIBLE).

    A tariff looks like harmless configuration; it is money. Three reasons
    to close the form:

    1. ``price_kmf`` carries a DB integrality constraint
       (``tariff_price_kmf_integral``) — a fractional price makes an
       invoice unsettleable at the counter. The constraint would refuse
       the write, but with a raw ``IntegrityError`` page instead of the
       service's French 400 ;
    2. every price change is audited (``tariff.created``/``tariff.updated``
       with the code and the price) — a grid rewritten by hand leaves the
       director with an unexplained bill ;
    3. the product door already exists for the tenant itself (director and
       cashier, ``POST|PATCH /centers/{c}/tariffs/``), so the admin adds
       no capability — only an unaudited shortcut.

    Historical acts are safe either way (``ActPerformed`` snapshots label
    and price — ADR 0005), which is why this is an arbitrage and not a
    correctness fix: reopening it would cost nothing structural.
    """

    list_display = ("code", "label", "price_kmf", "center", "is_active")
    list_filter = ("is_active", "center")
    search_fields = ("code", "label", "center__name")
    autocomplete_fields = ("center",)
