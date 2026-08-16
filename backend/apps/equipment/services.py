"""Equipment services — the ONLY write path for the park (S8, ADR 0021).

Project rule (CLAUDE.md): writes go through services that replay
``save()``, take the row lock that makes a decision meaningful under
concurrency, and journalise inside the same transaction.

**Machine à états** (décision 1), fermée et sérialisée sur la ligne —
patron ``_transition`` de ``apps/scheduling/services.py`` ::

    en_service ⇄ en_panne
         └──┴──────> reforme        (TERMINAL, définitif)

Un signalement **ne fait pas partie** de cette machine : il n'y touche pas.
C'est la décision 1 de l'ADR, et c'est ce qui rend l'anonymat du signaleur
tenable côté lecture (voir ``serializers.py``) — un constat qui ne change
rien n'a pas besoin d'un responsable.

**Hiérarchie de verrous : l'équipement, et rien d'autre.** Elle est
disjointe de celles de l'argent (utilisateur → intent → demande → facture →
centre), du soin, de l'hospitalisation (patient → lit → séjour) et du RH
(emploi → congé) : aucun service d'ici n'atteint une facture, un intent, un
séjour, un emploi ni une ligne de centre.

Audit payload contract (ADR 0007, resserré par l'ADR 0021) : des ids, des
CODES fermés (catégorie, états) et des noms de champs — **jamais la
description d'un signalement**, **jamais les ``notes``**, jamais le nom ni
l'emplacement d'un appareil. Les quatre actions entrent dans le journal du
directeur : c'est de la configuration d'établissement, même famille que
``room.created`` et ``tariff.created``.

**Le gel commercial est délibérément absent** (décision 4) :
``require_center_can_administer`` n'est PAS importé ici et ne doit jamais
l'être.

- *signaler une panne doit toujours passer* — un appareil cassé est une
  information de soin, et le centre gelé est précisément celui qui a le
  plus besoin qu'elle circule ;
- geler la saisie d'un inventaire n'a aucun levier commercial réel :
  personne ne paie pour enregistrer un tensiomètre ;
- chaque extension de la liste des modules autorisés à importer la garde
  affaiblit la sonde fail-closed qui la protège. Elle ne s'étend que quand
  elle sert.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import AuditAction, audit
from apps.equipment.models import Equipment, EquipmentReport

Status = Equipment.Status

#: La machine à états (ADR 0021) — l'état terminal rend un ensemble vide.
#: Fermée, sérialisée sur la ligne, jamais de saut, jamais de retour.
EQUIPMENT_TRANSITIONS = {
    Status.IN_SERVICE: frozenset({Status.OUT_OF_ORDER, Status.DECOMMISSIONED}),
    Status.OUT_OF_ORDER: frozenset({Status.IN_SERVICE, Status.DECOMMISSIONED}),
    Status.DECOMMISSIONED: frozenset(),
}

#: Les champs qu'un directeur peut corriger sur une fiche. ``status`` n'y
#: est PAS : il a sa porte (:func:`set_equipment_status`), qui est la seule
#: à connaître la machine à états — un PATCH générique l'aurait contournée.
EDITABLE_FIELDS = (
    "name", "category", "serial_number", "location", "commissioned_on", "notes",
)


# ---------------------------------------------------------------------------
# Le parc : déclarer, corriger
# ---------------------------------------------------------------------------


@transaction.atomic
def create_equipment(
    *, actor, center, name, category, serial_number="", location="",
    commissioned_on=None, notes="",
):
    """Déclarer un équipement. Audité ``equipment.created``."""
    equipment = Equipment(
        center=center,
        name=name,
        category=category,
        serial_number=serial_number or "",
        location=location or "",
        commissioned_on=commissioned_on,
        notes=notes or "",
    )
    equipment.save()
    audit(
        actor=actor, action=AuditAction.EQUIPMENT_CREATED, target=equipment,
        center=center,
        # Ids et CODES fermés seulement — jamais le nom (« Échographe du
        # service VIH » ferait d'une ligne de parc une ligne clinique), ni
        # l'emplacement, ni le numéro de série, ni les notes.
        equipment_id=equipment.pk, center_id=center.pk,
        category=equipment.category, status=equipment.status,
    )
    return equipment


@transaction.atomic
def update_equipment(*, actor, equipment, **fields):
    """Corriger une fiche — audité ``equipment.updated``.

    ``status`` n'est pas modifiable ici : la machine à états a sa porte.
    Le payload d'audit ne porte que les NOMS des champs touchés (patron
    ``staff.membership_updated``), jamais leurs valeurs.
    """
    unknown = set(fields) - set(EDITABLE_FIELDS)
    if unknown:
        raise ValidationError(
            f"Champ non modifiable : {', '.join(sorted(unknown))}."
        )
    changed = []
    for field in EDITABLE_FIELDS:
        if field not in fields:
            continue
        value = fields[field]
        if field in ("serial_number", "location", "notes") and value is None:
            value = ""
        if getattr(equipment, field) != value:
            setattr(equipment, field, value)
            changed.append(field)
    if not changed:
        return equipment
    equipment.save(update_fields=sorted({*changed, "updated_at"}))
    audit(
        actor=actor, action=AuditAction.EQUIPMENT_UPDATED, target=equipment,
        center=equipment.center,
        equipment_id=equipment.pk, center_id=equipment.center_id,
        fields=",".join(sorted(changed)),
    )
    return equipment


# ---------------------------------------------------------------------------
# L'état : la machine, sérialisée sur la ligne
# ---------------------------------------------------------------------------


def _transition(equipment, target):
    """Un pas de machine à états, sérialisé sur la LIGNE (patron
    ``apps/scheduling/services.py``) : l'état est relu sous
    ``select_for_update``, donc deux directeurs qui réforment et remettent
    en service à la même seconde ne peuvent pas passer tous les deux — le
    perdant relit l'état du gagnant et reçoit le refus français. Tout
    appelant est ``transaction.atomic``.
    """
    locked = Equipment.objects.select_for_update().get(pk=equipment.pk)
    if target not in EQUIPMENT_TRANSITIONS[locked.status]:
        raise ValidationError(
            "Transition impossible : cet équipement est "
            f"« {locked.get_status_display()} »."
        )
    previous = locked.status
    locked.status = target
    locked.save(update_fields=["status", "updated_at"])
    # L'instance de l'appelant reste cohérente (les vues la sérialisent).
    equipment.status = locked.status
    equipment.updated_at = locked.updated_at
    return previous


@transaction.atomic
def set_equipment_status(*, actor, equipment, status):
    """Changer l'état officiel du parc — **le geste du directeur**.

    Audité ``equipment.status_changed`` : ids et codes d'état seulement.
    ``reforme`` est terminal, et la terminalité est rejouée jusque dans
    ``Equipment.save()`` — un chemin hors service ne peut pas ressusciter
    un appareil réformé.
    """
    if status not in EQUIPMENT_TRANSITIONS:
        raise ValidationError("État inconnu.")
    previous = _transition(equipment, status)
    audit(
        actor=actor, action=AuditAction.EQUIPMENT_STATUS_CHANGED,
        target=equipment, center=equipment.center,
        equipment_id=equipment.pk, center_id=equipment.center_id,
        from_status=previous, to_status=status,
    )
    return equipment


# ---------------------------------------------------------------------------
# Le signalement : le constat de TOUT membre du personnel
# ---------------------------------------------------------------------------


@transaction.atomic
def report_equipment_issue(*, actor, equipment, description):
    """Signaler une panne — append-only, et **sans toucher à l'état**.

    C'est le geste que le gel ne doit jamais fermer, et c'est aussi le seul
    du module ouvert à tout le personnel actif : c'est l'infirmière qui
    constate que le tensiomètre ne marche plus, pas le directeur.

    Audité ``equipment.reported`` : ids, et l'état de l'appareil AU MOMENT
    du constat (un code fermé, utile à la relecture). **Jamais la
    description** — texte libre écrit par un humain pressé, même classe que
    le corps d'un ticket de support.
    """
    report = EquipmentReport(
        equipment=equipment, reported_by=actor, description=description
    )
    report.save()
    audit(
        actor=actor, action=AuditAction.EQUIPMENT_REPORTED, target=report,
        center=equipment.center,
        report_id=report.pk, equipment_id=equipment.pk,
        center_id=equipment.center_id, equipment_status=equipment.status,
    )
    return report


# ---------------------------------------------------------------------------
# Lectures (les vues scellent leur queryset dessus)
# ---------------------------------------------------------------------------


def equipments_queryset(center):
    """Le parc d'un centre, prêt à sérialiser (compteurs de signalements).

    Les deux annotations coûtent une jointure agrégée, jamais une requête
    par ligne : le tableau de parc affiche « 3 signalements, le dernier le
    12 août » sans N+1.
    """
    from django.db.models import Count, Max

    return (
        Equipment.objects.for_center(center)
        .annotate(
            report_count=Count("reports", distinct=True),
            last_report_at=Max("reports__created_at"),
        )
        .order_by("name", "id")
    )


def reports_queryset(equipment):
    """Les signalements d'un équipement, du plus récent au plus ancien."""
    return EquipmentReport.objects.filter(equipment=equipment).order_by(
        "-created_at", "-id"
    )
