from django.contrib import admin

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
class PatientMedicalFileAdmin(admin.ModelAdmin):
    list_display = ("patient", "blood_group", "updated_by", "updated_at")
    list_filter = ("blood_group",)
    search_fields = ("patient__last_name", "patient__first_name")
    autocomplete_fields = ("patient", "updated_by")


@admin.register(VitalSigns)
class VitalSignsAdmin(admin.ModelAdmin):
    list_display = (
        "encounter", "measured_at", "measured_by",
        "systolic_bp", "diastolic_bp", "heart_rate", "spo2",
        "temperature_c", "respiratory_rate", "weight_kg", "height_cm",
    )
    autocomplete_fields = ("encounter", "measured_by")
    date_hierarchy = "measured_at"


@admin.register(PatientDocument)
class PatientDocumentAdmin(admin.ModelAdmin):
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


class ActPerformedInline(admin.TabularInline):
    model = ActPerformed
    extra = 0
    readonly_fields = ("label_snapshot", "price_kmf_snapshot")


@admin.register(Encounter)
class EncounterAdmin(admin.ModelAdmin):
    list_display = ("patient", "center", "practitioner", "occurred_at", "reason", "status")
    list_filter = ("status", "center")
    search_fields = ("patient__last_name", "patient__first_name", "reason")
    autocomplete_fields = ("patient", "center", "practitioner")
    inlines = [ActPerformedInline]
    date_hierarchy = "occurred_at"


@admin.register(ActPerformed)
class ActPerformedAdmin(admin.ModelAdmin):
    list_display = ("label_snapshot", "price_kmf_snapshot", "encounter", "created_at")
    search_fields = ("label_snapshot", "encounter__patient__last_name")
    autocomplete_fields = ("encounter", "tariff_item")
    readonly_fields = ("label_snapshot", "price_kmf_snapshot")


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "encounter", "status", "created_at")
    list_filter = ("status",)
    autocomplete_fields = ("encounter",)
    inlines = [PrescriptionItemInline]


@admin.register(HealthRecordEntry)
class HealthRecordEntryAdmin(admin.ModelAdmin):
    list_display = ("patient", "entry_type", "content", "source_encounter", "created_at")
    list_filter = ("entry_type",)
    search_fields = ("patient__last_name", "patient__first_name", "content")
    autocomplete_fields = ("patient", "source_encounter")


@admin.register(Consent)
class ConsentAdmin(admin.ModelAdmin):
    list_display = (
        "patient", "guardian_link", "scope", "granted_at", "revoked_at",
        "collected_via", "collected_by",
    )
    list_filter = ("scope", "collected_via")
    search_fields = ("patient__last_name", "patient__first_name")
    autocomplete_fields = ("patient", "guardian_link", "collected_by")
