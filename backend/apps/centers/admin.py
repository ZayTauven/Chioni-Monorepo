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
class StaffMembershipAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """READ-ONLY since S5 lot 3 (ADR 0018 décision 6 — dette de l'ADR 0017).

    S4 kept this form writable as « the last way back into a center that
    has locked itself out », while noting the condition of its closure:
    « si un futur sprint donne à la plateforme un module personnel
    complet, cette porte doit se fermer ». The rescue path it was standing
    in for has existed by API since S4 and is now the normal one:
    ``POST /platform/centers/{pk}/directors/`` — audited
    (``staff.membership_created``), carrying the separation-of-duties
    guard (an operator cannot mint a tenant hat onto their own account),
    and deliberately NOT frozen by a subscription suspension, so Chioni
    can always seed a director back into a tenant it has sanctioned.

    What closing this form removes, stated plainly:

    - creating a membership WITHOUT ``add_staff_member`` — i.e. without an
      audit entry the director reads in his journal, without the
      shadow-account-by-phone creation, and without the duplicate-role
      refusal ;
    - changing a role WITHOUT the « last active director » guard (whose
      ordered ``FOR UPDATE`` closed a real race in vague 1) ;
    - deactivating a membership by hand on a center whose subscription is
      frozen — which the product allows anyway (deactivation is a SECURITY
      act, never a paid feature, ADR 0018 lot 1 §9).

    What remains, and is enough: a Chioni ``admin`` seeds a director by
    API. If NO operator is reachable either, the offline bootstrap
    (``python manage.py create_platform_staff``) makes one.
    """

    list_display = ("user", "center", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "center")
    search_fields = ("user__username", "user__phone", "center__name")
    readonly_fields = (
        "user", "center", "role", "is_active", "created_at", "updated_at",
    )


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
