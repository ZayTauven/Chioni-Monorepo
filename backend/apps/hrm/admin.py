"""HRM admin — READ-ONLY, les sept tables (S7, ADR 0020).

Nées fermées, comme toute table depuis S4 (ADR 0017 décision 4). Un
formulaire ici offrirait une porte silencieuse autour de :

- la **machine à états des congés** (``approuve``/``refuse``/``annule`` sont
  terminaux) et de la garde de **chevauchement**, qui se joue sous le
  verrou de l'emploi — un formulaire d'admin approuverait deux congés
  superposés sans que rien ne l'arrête ;
- l'**unicité (user, center)** du dossier RH : la contrainte tiendrait,
  mais un formulaire pourrait déplacer un dossier d'une personne à une
  autre et lui attribuer les présences et les congés de quelqu'un d'autre ;
- l'**archivage définitif** d'un justificatif, et surtout le **pipeline
  d'upload durci** (ADR 0014) : un fichier posé à la main dans un
  ``FileField`` contournerait la vérification de format réel, le
  strip EXIF/GPS et le nom uuid ;
- l'**audit** : chaque écriture du module journalise, avec un payload qui
  ne porte jamais le type d'un congé. Une ligne faite à la main existerait
  sans trace de qui l'a décidée ;
- le **gel commercial**, qui passe par les services et par eux seuls.

Le champ le plus sensible du module — ``LeaveRequest.leave_type`` — est de
la donnée de santé et de vie privée (maladie, maternité, deuil). Un
``list_filter`` dessus transformerait l'admin en tableau de bord des
pathologies du personnel : il n'y en a pas, et ce n'est pas un oubli.
"""

from django.contrib import admin

from apps.common.admin import ReadOnlyAdminMixin

from .models import (
    AttendanceRecord,
    Department,
    Employment,
    Holiday,
    JobTitle,
    LeaveDocument,
    LeaveRequest,
)


@admin.register(Department)
class DepartmentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "center", "is_active", "created_at")
    list_filter = ("is_active", "center")
    search_fields = ("name", "center__name")
    autocomplete_fields = ("center",)


@admin.register(JobTitle)
class JobTitleAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("name", "center", "is_active", "created_at")
    list_filter = ("is_active", "center")
    search_fields = ("name", "center__name")
    autocomplete_fields = ("center",)


@admin.register(Employment)
class EmploymentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("user", "center", "job_title", "hired_at", "ended_at")
    list_filter = ("center",)
    search_fields = ("user__username", "user__last_name", "center__name")
    autocomplete_fields = ("user", "center", "department", "job_title")
    date_hierarchy = "hired_at"


@admin.register(Holiday)
class HolidayAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("date", "name", "center")
    list_filter = ("center",)
    search_fields = ("name", "center__name")
    autocomplete_fields = ("center",)
    date_hierarchy = "date"


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("date", "employment", "status")
    list_filter = ("status", "employment__center")
    search_fields = ("employment__user__last_name",)
    autocomplete_fields = ("employment", "noted_by")
    date_hierarchy = "date"


@admin.register(LeaveRequest)
class LeaveRequestAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    """Pas de ``list_filter`` sur ``leave_type`` — voir la docstring du
    module : filtrer le personnel par régime de congé (maladie, maternité,
    deuil) transformerait l'admin en tableau de bord des pathologies."""

    list_display = ("employment", "start_date", "end_date", "status")
    list_filter = ("status", "employment__center")
    search_fields = ("employment__user__last_name",)
    autocomplete_fields = ("employment", "requested_by", "decided_by")
    date_hierarchy = "start_date"


@admin.register(LeaveDocument)
class LeaveDocumentAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "leave", "archived_at", "created_at")
    list_filter = ("leave__employment__center",)
    search_fields = ("leave__employment__user__last_name",)
    autocomplete_fields = ("leave", "uploaded_by", "archived_by")
    date_hierarchy = "created_at"
