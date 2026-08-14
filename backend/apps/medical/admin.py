"""Medical admin — READ-ONLY WITHOUT EXCEPTION (S4, ADR 0017 décision 4).

Everything in this app is either clinical content or a consent. Both have
service invariants a change form silently voids:

- an ``Encounter`` closes through ``close_encounter`` and gates every
  later production (no prescription, no carnet entry once « terminee ») ;
- a ``PatientDocument`` lives on the PRIVATE storage and is archived,
  never deleted — the admin never even shows ``file`` (that storage has
  no URL, ADR 0016 §5) ;
- ``VitalSigns`` carry plausibility bounds and a practitioner-of-the-
  center invariant enforced in ``save()`` ;
- **``Consent`` is the sensitive one, and closes the SV.2 debt**: it is
  THE source of truth of what a guardian may see
  (``Consent.objects.active_scopes``). Hand-granting one here would open
  a patient's clinical detail to a third party with no patient act, no
  claimant-confirmation gate and no audit entry — the exact opposite of
  everything ADR 0004 builds.

Reading stays open (that is what an admin is for); writing belongs to the
audited services.
"""

from django.contrib import admin

from apps.common.admin import ReadOnlyAdminMixin

from .models import (
    ActPerformed,
    Consent,
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    PrescriptionItem,
    VitalSigns,
)


@admin.register(PatientMedicalFile)
class PatientMedicalFileAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("patient", "blood_group", "updated_by", "updated_at")
    list_filter = ("blood_group",)
    search_fields = ("patient__last_name", "patient__first_name")
    autocomplete_fields = ("patient", "updated_by")


@admin.register(VitalSigns)
class VitalSignsAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "encounter", "measured_at", "measured_by",
        "systolic_bp", "diastolic_bp", "heart_rate", "spo2",
        "temperature_c", "respiratory_rate", "weight_kg", "height_cm",
    )
    autocomplete_fields = ("encounter", "measured_by")
    date_hierarchy = "measured_at"


@admin.register(PatientDocument)
class PatientDocumentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    # The « file » field is deliberately ABSENT everywhere: the private
    # storage has NO URL (ADR 0016 §5) and the admin widget would try to
    # render one. The bytes are only reachable through the authenticated
    # download endpoints.
    list_display = (
        "patient", "center", "doc_type", "title", "source_encounter",
        "archived_at", "created_at",
    )
    list_filter = ("doc_type", "center")
    search_fields = ("patient__last_name", "patient__first_name", "title")
    autocomplete_fields = (
        "patient", "center", "source_encounter", "uploaded_by", "archived_by",
    )
    exclude = ("file",)


class ActPerformedInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = ActPerformed
    extra = 0
    readonly_fields = ("label_snapshot", "price_kmf_snapshot")


@admin.register(Encounter)
class EncounterAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("patient", "center", "practitioner", "occurred_at", "reason", "status")
    list_filter = ("status", "center")
    search_fields = ("patient__last_name", "patient__first_name", "reason")
    autocomplete_fields = ("patient", "center", "practitioner")
    inlines = [ActPerformedInline]
    date_hierarchy = "occurred_at"


@admin.register(ActPerformed)
class ActPerformedAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Acts are tariff SNAPSHOTS (ADR 0005) and the billing base: an act
    edited by hand would either rewrite history or desynchronise a frozen
    invoice line."""

    list_display = ("label_snapshot", "price_kmf_snapshot", "encounter", "created_at")
    search_fields = ("label_snapshot", "encounter__patient__last_name")
    autocomplete_fields = ("encounter", "tariff_item")
    readonly_fields = ("label_snapshot", "price_kmf_snapshot")


class PrescriptionItemInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = PrescriptionItem
    extra = 0


@admin.register(Prescription)
class PrescriptionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "encounter", "status", "created_at")
    list_filter = ("status",)
    autocomplete_fields = ("encounter",)
    inlines = [PrescriptionItemInline]


@admin.register(HealthRecordEntry)
class HealthRecordEntryAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("patient", "entry_type", "content", "source_encounter", "created_at")
    list_filter = ("entry_type",)
    search_fields = ("patient__last_name", "patient__first_name", "content")
    autocomplete_fields = ("patient", "source_encounter")


@admin.register(Consent)
class ConsentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """SV.2 debt SOLDED here (ADR 0017 décision 4).

    A consent is the hinge of the whole guardianship model: granting or
    un-revoking one by hand would hand a third party a patient's clinical
    detail without the patient, without the claimant-confirmation gate and
    without a trace. Revocation is meant to be irreversible — the admin
    was the only place where it was not.
    """

    list_display = (
        "patient", "guardian_link", "scope", "granted_at", "revoked_at",
        "collected_via", "collected_by",
    )
    list_filter = ("scope", "collected_via")
    search_fields = ("patient__last_name", "patient__first_name")
    autocomplete_fields = ("patient", "guardian_link", "collected_by")
