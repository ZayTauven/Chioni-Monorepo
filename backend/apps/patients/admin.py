"""Patients admin — READ-ONLY WITHOUT EXCEPTION (S4, ADR 0017 décision 4).

``GuardianLink`` and ``PatientProfile`` carry the most delicate invariants
of the product, and they live in ``save()``/``clean()`` plus PostgreSQL
triggers (CLAUDE.md engineering rule, ADR 0006). A change form is exactly
the « raw update » that rule forbids:

- flipping a link back to ``actif`` would re-open a guardian's window on a
  claimed profile WITHOUT the titulaire's confirmation — the ethical
  invariant of the product (the DB trigger refuses leaving ``revoque``,
  but ``invitation_envoyee``/``attente_confirmation_titulaire`` are not
  trigger-protected) ;
- editing the identity of a CLAIMED profile bypasses R-API-2 (the
  identity belongs to the patient once claimed) ;
- writing ``merged_into`` by hand can build the very cycle
  ``resolve_canonical`` is bounded against ;
- an insurance line is billing data, audited by its service.

Everything above has an audited product door. Reading stays open.
"""

from django.contrib import admin

from apps.common.admin import ReadOnlyAdminMixin

from .models import GuardianLink, GuardianProfile, PatientInsurance, PatientProfile


@admin.register(PatientInsurance)
class PatientInsuranceAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "patient", "insurer_name", "member_number", "valid_until",
        "is_active", "created_at",
    )
    list_filter = ("is_active",)
    search_fields = ("patient__last_name", "patient__first_name", "insurer_name")
    autocomplete_fields = ("patient", "created_by")


@admin.register(PatientProfile)
class PatientProfileAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
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
class GuardianProfileAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("user", "country_of_residence", "preferred_currency", "created_at")
    list_filter = ("country_of_residence", "preferred_currency")
    search_fields = ("user__username", "user__phone")
    autocomplete_fields = ("user",)


@admin.register(GuardianLink)
class GuardianLinkAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """THE link between a guardian and a patient — read-only since S4.

    « Ne jamais réintroduire un lien tuteur ACTIVE sur un profil revendiqué
    sans passer par la porte de confirmation du titulaire » (CLAUDE.md).
    This form was the last place where that could happen in one click.
    """

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
