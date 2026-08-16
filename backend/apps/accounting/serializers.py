"""Sérialiseurs de l'export comptable (S10 lot 3 — ADR 0023).

Champs EXPLICITES, jamais ``fields = "__all__"``. Deux formes :

- **la liste** — l'en-tête d'une pièce (numéro, période, totaux, qui l'a
  générée quand) : ce qu'il faut pour retrouver un export, sans transporter
  des milliers de lignes à chaque affichage ;
- **le détail** — la même chose **plus le snapshot**, relu tel quel.

Aucun nom nulle part : ``generated_by`` est un id nu (le directeur lit
l'annuaire du personnel, qui est sa propre porte), et les lignes ne portent
que des références et des montants.
"""

from rest_framework import serializers

from apps.accounting.models import AccountingExport
from apps.common.periods import MAX_PERIOD_DAYS


class AccountingExportSerializer(serializers.ModelSerializer):
    """L'en-tête d'une pièce — SANS le snapshot (volumétrie)."""

    number = serializers.CharField(read_only=True)
    generated_by = serializers.IntegerField(
        source="generated_by_id", read_only=True
    )

    class Meta:
        model = AccountingExport
        fields = [
            "id", "number", "sequence_number", "period_start", "period_end",
            "total_collected_kmf", "total_reversed_kmf", "net_kmf",
            "line_count", "generated_by", "created_at",
        ]
        read_only_fields = fields


class AccountingExportDetailSerializer(AccountingExportSerializer):
    """La pièce entière — snapshot compris, **relu, jamais recalculé**."""

    class Meta(AccountingExportSerializer.Meta):
        fields = [*AccountingExportSerializer.Meta.fields, "lines"]
        read_only_fields = fields


class AccountingExportCreateSerializer(serializers.Serializer):
    """Les bornes de la période — jours locaux INCLUSIFS.

    Le contrat de période (ordre, longueur maximale, bornes en heure des
    Comores) est celui de ``apps.common.periods``, appliqué par le service
    via ``day_bounds`` : ce sérialiseur ne le réécrit pas, il ne fait que
    parser les deux dates. ``MAX_PERIOD_DAYS`` est mentionné dans l'aide
    pour que le schéma OpenAPI le dise, pas pour le contrôler deux fois.
    """

    period_start = serializers.DateField(
        help_text="Jour local inclus (AAAA-MM-JJ)."
    )
    period_end = serializers.DateField(
        help_text=(
            f"Jour local inclus (AAAA-MM-JJ). Période maximale : "
            f"{MAX_PERIOD_DAYS} jours."
        )
    )


class PreviousExportSerializer(serializers.ModelSerializer):
    """L'annonce d'un export précédent recouvrant la période demandée.

    Une ANNONCE, pas un refus (arbitrage PO n° 3 : rien ne se ferme
    derrière un export). Elle porte le strict nécessaire pour que le
    comptable sache qu'il a déjà cette matière : le numéro, la période
    couverte, et la date d'émission.
    """

    number = serializers.CharField(read_only=True)

    class Meta:
        model = AccountingExport
        fields = ["id", "number", "period_start", "period_end", "created_at"]
        read_only_fields = fields
