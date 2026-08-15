"""HRM serializers — one serializer per AUDIENCE (ADR 0020, décision 6).

| Audience | Ce qu'elle voit |
|---|---|
| **La personne** | SON emploi, SES présences, SES congés — **type compris** (ce sont ses données) |
| **Directeur** | tout, pour SON centre : feuille de présence, congés (type compris — il décompte les droits), services, fonctions, fériés |
| **Tout staff du centre** | le **planning collectif** : qui est présent, qui est absent — **jamais sous quel régime**, jamais le type d'un congé |
| **Patient, tuteur, exploitant plateforme** | **rien** (aucune route, aucun sérialiseur) |

Le planning collectif est le SEUL point où la donnée d'une personne est vue
par ses collègues : il répond au besoin de service (« qui est là
aujourd'hui ? ») et s'arrête exactement là. C'est
:class:`ScheduleRowSerializer` qui porte l'invariant n° 3 du sprint —
``absent`` et ``conge`` y sont **fondus en une seule valeur**, sinon « en
congé » se lirait comme « pas malade » et l'absence non expliquée
deviendrait un signal.

Deux absences volontaires, à relire comme des décisions :

- ``PractitionerSerializer`` (``apps/centers``), lu par TOUT le staff, ne
  gagne **aucun champ RH** — corollaire de la décision 2 (« une fonction
  n'est pas un droit ») : la fonction d'une personne n'a pas à voyager
  dans le sélecteur de praticiens ;
- aucun sérialiseur de ce module n'expose d'URL de fichier : le storage
  des justificatifs n'en a pas, la lecture passe par les endpoints de
  téléchargement authentifiés.
"""

from rest_framework import serializers

from apps.hrm.models import (
    AttendanceRecord,
    Department,
    Employment,
    Holiday,
    JobTitle,
    LeaveDocument,
    LeaveRequest,
)

#: Invariant n° 3 (ADR 0020) — la table de traduction du planning
#: COLLECTIF. ``conge`` disparaît : il devient ``absent``, comme une
#: absence non expliquée. Toute valeur future de
#: ``AttendanceRecord.Status`` doit être traduite ici explicitement (le
#: ``.get()`` sans défaut de ``ScheduleRowSerializer`` rend ``None``, donc
#: l'oubli se voit à l'écran au lieu de fuir).
PUBLIC_ATTENDANCE = {
    AttendanceRecord.Status.PRESENT: "present",
    AttendanceRecord.Status.ABSENT: "absent",
    AttendanceRecord.Status.LEAVE: "absent",
    AttendanceRecord.Status.REST: "repos",
    AttendanceRecord.Status.HOLIDAY: "ferie",
}


def _display_name(user) -> str:
    """Nom affiché d'un collègue — convention STAFF (le username d'un
    collègue est déjà lisible dans `GET /centers/{c}/staff/`)."""
    return f"{user.first_name} {user.last_name}".strip() or user.username


# ---------------------------------------------------------------------------
# Configuration — lue par tout le staff, écrite par le directeur
# ---------------------------------------------------------------------------


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = fields


class DepartmentWriteSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "Le nom du service est requis.",
            "blank": "Le nom du service est requis.",
        },
    )


class DepartmentPatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    is_active = serializers.BooleanField(required=False)


class JobTitleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobTitle
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = fields


class JobTitleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "Le nom de la fonction est requis.",
            "blank": "Le nom de la fonction est requis.",
        },
    )


class JobTitlePatchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    is_active = serializers.BooleanField(required=False)


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name", "created_at"]
        read_only_fields = fields


class HolidayWriteSerializer(serializers.Serializer):
    date = serializers.DateField(
        error_messages={"required": "La date est requise."}
    )
    name = serializers.CharField(
        max_length=64,
        error_messages={
            "required": "Le libellé est requis.",
            "blank": "Le libellé est requis.",
        },
    )


# ---------------------------------------------------------------------------
# Audience : le DIRECTEUR de ce centre
# ---------------------------------------------------------------------------


class EmploymentSerializer(serializers.ModelSerializer):
    """Un dossier RH vu par le directeur — l'audience qui décompte.

    Le payload nomme la personne (le directeur lit déjà l'annuaire de son
    personnel) et dit son service et sa fonction. Il ne dit RIEN d'un autre
    centre : ``Employment`` porte son ``center`` et le queryset passe par
    ``for_center`` — un directeur du centre A ne voit jamais ce qu'un
    directeur du centre B a saisi pour le même humain (invariant 1).
    """

    user_display_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=None
    )
    job_title_name = serializers.CharField(
        source="job_title.name", read_only=True, default=None
    )
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = Employment
        fields = [
            "id", "user", "user_display_name", "department", "department_name",
            "job_title", "job_title_name", "hired_at", "ended_at",
            "is_running", "created_at",
        ]
        read_only_fields = fields

    def get_user_display_name(self, employment) -> str:
        return _display_name(employment.user)


class EmploymentCreateSerializer(serializers.Serializer):
    """POST body — ids résolus par la VUE dans le périmètre du centre
    (400 explicite, norme S1 : un seul message couvre l'id étranger et
    l'id inexistant)."""

    user = serializers.IntegerField(
        error_messages={"required": "La personne est requise."}
    )
    hired_at = serializers.DateField(
        error_messages={"required": "La date d'embauche est requise."}
    )
    department = serializers.IntegerField(
        required=False, allow_null=True, default=None
    )
    job_title = serializers.IntegerField(
        required=False, allow_null=True, default=None
    )


class EmploymentPatchSerializer(serializers.Serializer):
    """PATCH body. ``user`` et ``center`` sont volontairement absents :
    déplacer un dossier d'une personne ou d'un tenant à l'autre n'est pas
    une modification, c'est un autre dossier."""

    hired_at = serializers.DateField(required=False)
    ended_at = serializers.DateField(required=False, allow_null=True)
    department = serializers.IntegerField(required=False, allow_null=True)
    job_title = serializers.IntegerField(required=False, allow_null=True)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """Une journée de la feuille, vue par le directeur (statut RÉEL)."""

    employment_display_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "employment", "employment_display_name", "date", "status",
            "noted_by", "created_at",
        ]
        read_only_fields = fields

    def get_employment_display_name(self, record) -> str:
        return _display_name(record.employment.user)


class AttendanceWriteSerializer(serializers.Serializer):
    employment = serializers.IntegerField(
        error_messages={"required": "Le dossier RH est requis."}
    )
    date = serializers.DateField(
        error_messages={"required": "La date est requise."}
    )
    status = serializers.ChoiceField(
        choices=AttendanceRecord.Status.choices,
        error_messages={
            "required": "Le statut est requis.",
            "invalid_choice": "Statut de présence inconnu.",
        },
    )


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Une demande vue par le DIRECTEUR : il décide, donc il voit le type.

    ``has_document`` plutôt que la liste des pièces (patron ``has_reason``) :
    l'écran a besoin de savoir qu'un justificatif existe pour proposer le
    téléchargement, pas de le charger dans la liste.
    """

    employment_display_name = serializers.SerializerMethodField()
    days = serializers.IntegerField(read_only=True)
    has_document = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "employment", "employment_display_name", "leave_type",
            "start_date", "end_date", "days", "status", "decided_by",
            "decided_at", "has_document", "created_at",
        ]
        read_only_fields = fields

    def get_employment_display_name(self, leave) -> str:
        return _display_name(leave.employment.user)

    def get_has_document(self, leave) -> bool:
        cached = getattr(leave, "live_documents", None)
        if cached is not None:
            return bool(cached)
        return leave.documents.filter(archived_at__isnull=True).exists()


# ---------------------------------------------------------------------------
# Audience : LA PERSONNE, sur ses propres données
# ---------------------------------------------------------------------------


class MyEmploymentSerializer(serializers.ModelSerializer):
    """Mon dossier RH dans CE centre.

    Pas de champ ``user`` : c'est moi. Le service et la fonction sont
    donnés par leur libellé — la personne n'a rien à faire d'un id
    d'organigramme.
    """

    center_name = serializers.CharField(source="center.name", read_only=True)
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=None
    )
    job_title_name = serializers.CharField(
        source="job_title.name", read_only=True, default=None
    )
    is_running = serializers.BooleanField(read_only=True)

    class Meta:
        model = Employment
        fields = [
            "id", "center", "center_name", "department_name", "job_title_name",
            "hired_at", "ended_at", "is_running",
        ]
        read_only_fields = fields


class MyAttendanceSerializer(serializers.ModelSerializer):
    """Mes journées, statut RÉEL (ce sont mes données — décision 6).

    ``noted_by`` est volontairement absent : savoir QUI a coché la case
    n'apporte rien à la personne et transformerait la feuille en objet de
    conflit. Arbitrage RÉVERSIBLE — à rouvrir si le terrain montre le
    besoin d'une contestation nominative.
    """

    class Meta:
        model = AttendanceRecord
        fields = ["id", "date", "status"]
        read_only_fields = fields


class MyLeaveRequestSerializer(serializers.ModelSerializer):
    """Mes congés — type compris, ce sont mes données.

    ``decided_by`` absent, pour la même raison que ``noted_by`` ci-dessus :
    la décision est celle du centre, pas celle d'un collègue nommé.
    """

    days = serializers.IntegerField(read_only=True)
    has_document = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "leave_type", "start_date", "end_date", "days", "status",
            "decided_at", "has_document", "created_at",
        ]
        read_only_fields = fields

    def get_has_document(self, leave) -> bool:
        cached = getattr(leave, "live_documents", None)
        if cached is not None:
            return bool(cached)
        return leave.documents.filter(archived_at__isnull=True).exists()


class LeaveCreateSerializer(serializers.Serializer):
    leave_type = serializers.ChoiceField(
        choices=LeaveRequest.Type.choices,
        error_messages={
            "required": "Le type de congé est requis.",
            "invalid_choice": "Type de congé inconnu.",
        },
    )
    start_date = serializers.DateField(
        error_messages={"required": "La date de début est requise."}
    )
    end_date = serializers.DateField(
        error_messages={"required": "La date de fin est requise."}
    )


class LeaveDocumentSerializer(serializers.ModelSerializer):
    """Un justificatif — **aucune URL, aucun nom de fichier**.

    Le storage privé n'a pas d'``url()`` (il lève), et le nom d'origine
    (« certificat-oncologie.jpg ») serait exactement l'information médicale
    que les types fermés existent pour éviter. Les octets se lisent par
    l'endpoint de téléchargement authentifié de chaque audience.
    """

    class Meta:
        model = LeaveDocument
        fields = ["id", "leave", "archived_at", "created_at"]
        read_only_fields = fields


class LeaveDocumentUploadSerializer(serializers.Serializer):
    """Corps multipart — la validation profonde (format réel, taille,
    dimensions) se fait dans le pipeline ADR 0014."""

    file = serializers.FileField(
        error_messages={"required": "Le fichier image est requis."}
    )


# ---------------------------------------------------------------------------
# Audience : TOUT LE STAFF — le planning collectif (invariant n° 3)
# ---------------------------------------------------------------------------


class ScheduleRowSerializer(serializers.Serializer):
    """Une ligne du planning du jour, lue par n'importe quel membre actif.

    **C'est ici que vit l'invariant n° 3 du sprint.** ``absent`` et
    ``conge`` sont fondus par :data:`PUBLIC_ATTENDANCE` en une seule valeur
    ``absent`` : les collègues savent que la personne n'est pas là, jamais
    sous quel régime. Le payload est construit à la main (pas un
    ``ModelSerializer``) précisément pour qu'aucun champ du modèle ne
    puisse s'y inviter par distraction — un ``fields = "__all__"`` ici
    ferait fuir le statut réel.
    """

    def to_representation(self, employment):
        raw = getattr(employment, "day_status", None)
        return {
            "employment": employment.pk,
            "display_name": _display_name(employment.user),
            "job_title": (
                employment.job_title.name
                if employment.job_title_id is not None
                else None
            ),
            # ``None`` = rien n'a été noté pour cette personne ce jour-là.
            # État honnête : « non renseigné », jamais « présent » par défaut.
            "status": PUBLIC_ATTENDANCE.get(raw) if raw else None,
        }
