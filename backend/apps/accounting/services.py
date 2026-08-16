"""Services de l'export comptable — le SEUL chemin d'écriture (S10 lot 3).

Même discipline que partout : les vues ne touchent pas l'ORM, le service
prend le verrou qui rend la numérotation sérialisable, et journalise son
entrée d'audit dans la même transaction.

**Hiérarchie de verrous — une chaîne COURTE et DISJOINTE** (ADR 0023) ::

    compteur de série → export

Rien d'autre n'est verrouillé. En particulier **jamais la ligne
``HealthCenter``** : cette contention avec ``Receipt.issue()`` /
``CashReceipt.issue()`` a été écartée en S5 (un export généré au bureau ne
doit pas faire la queue derrière le reçu d'un patient au guichet, ni
l'inverse). Et **jamais une ``SEQUENCE`` PostgreSQL** : ``nextval()`` n'est
pas transactionnelle, un rollback brûlerait un numéro et laisserait un trou
— or un trou dans une série ressemble à une fraude (ADR 0015 §6).

**Ce module ne fait que LIRE l'argent.** Il n'écrit pas une ligne de
ledger, pas un encaissement, pas une contre-passation : l'étanchéité avec
``apps.trustbridge`` est testée dans les deux sens. Un export ne change
rien à la caisse — il la photographie.

**Décision 7 — des MOUVEMENTS, pas des soldes.** Une ligne par
encaissement à SA date, une ligne par contre-passation à SA date, avec la
référence et la date de l'encaissement d'origine. Une contre-passation
n'est jamais soustraite en silence d'un jour antérieur : le total du 3 août
ne bouge pas quand on contre-passe le 12. C'est le retraitement de la
vigilance ADR 0015 consignée en SV.2.

**Rien n'est gelé, rien n'est gardé par le KYC** : l'export est **la donnée
du centre**, et l'ADR 0018 interdit déjà la prise d'otage des données —
``require_center_can_administer`` n'est importé nulle part ici et ne doit
jamais l'être.
"""

import csv
import io
import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounting.models import AccountingExport, AccountingExportSeries
from apps.audit.services import AuditAction, audit
from apps.common.periods import day_bounds
from apps.trustbridge.models import CashPayment, CashPaymentReversal

logger = logging.getLogger("chioni.accounting")

#: Les deux natures de mouvement. Codes STABLES : ils voyagent dans le
#: snapshot figé et dans le CSV, donc les renommer réécrirait le sens de
#: pièces déjà émises.
MOVEMENT_PAYMENT = "encaissement"
MOVEMENT_REVERSAL = "contre_passation"

#: Colonnes du CSV, dans l'ordre — **STABLE**. Un comptable construit ses
#: formules dessus ; les réordonner ou en retirer une casserait
#: silencieusement un classeur. On peut en AJOUTER à la fin.
CSV_COLUMNS = (
    "date",
    "type",
    "reference",
    "montant_kmf",
    "methode",
    "operateur",
    "facture",
    "recu",
    "reference_origine",
    "date_origine",
)


def _local_day_str(moment) -> str:
    """Le jour LOCAL (Indian/Comoro) d'un horodatage, en ISO.

    Un encaissement de 23h30 reste sur son jour local (patron ADR 0013) :
    la comptabilité d'un centre comorien se tient en heure comorienne, pas
    en UTC.
    """
    return timezone.localtime(moment).date().isoformat()


def build_movements(center, *, start, end):
    """Les mouvements de la période, à leurs dates respectives.

    ``start``/``end`` sont les bornes aware rendues par
    :func:`apps.common.periods.day_bounds` (``[jour 00:00, jour+1 00:00)``).

    Deux requêtes, deux familles de lignes, aucune compensation :

    - un ``CashPayment`` **créé** dans la fenêtre → une ligne positive à sa
      date, quelle que soit sa contre-passation ultérieure ;
    - un ``CashPaymentReversal`` **créé** dans la fenêtre → une ligne
      négative à SA date, portant la référence et la date de l'encaissement
      d'origine (même si celui-ci est antérieur à la période, et c'est
      justement le cas qui compte : le comptable voit d'où vient la
      correction).

    Le tri est (date, type, id) : stable, reproductible, et lisible — les
    encaissements d'un jour avant ses contre-passations.

    **Aucun nom, aucun libellé d'acte, aucune catégorie générique.** Un
    export survit à l'application : il porte des références et des
    montants, rien qui puisse raconter un soin.
    """
    movements = []
    payments = (
        CashPayment.objects.filter(center=center, created_at__gte=start,
                                   created_at__lt=end)
        .select_related("cash_receipt")
        .order_by("created_at", "pk")
    )
    for payment in payments:
        receipt = getattr(payment, "cash_receipt", None)
        movements.append({
            "_sort_id": payment.pk,
            "date": _local_day_str(payment.created_at),
            "type": MOVEMENT_PAYMENT,
            "reference": f"ENC-{payment.pk}",
            "montant_kmf": str(payment.amount_kmf),
            "methode": payment.method,
            "operateur": payment.operator or "",
            "facture": payment.invoice_id,
            "recu": receipt.number if receipt is not None else "",
            "reference_origine": "",
            "date_origine": "",
        })
    reversals = (
        CashPaymentReversal.objects.filter(
            cash_payment__center=center, created_at__gte=start, created_at__lt=end
        )
        .select_related("cash_payment")
        .order_by("created_at", "pk")
    )
    for reversal in reversals:
        origin = reversal.cash_payment
        movements.append({
            "_sort_id": reversal.pk,
            "date": _local_day_str(reversal.created_at),
            "type": MOVEMENT_REVERSAL,
            "reference": f"CP-{reversal.pk}",
            # Le signe est PORTÉ PAR LA LIGNE, pas déduit du type : un
            # tableur qui somme la colonne retrouve le net sans rien savoir
            # de notre vocabulaire.
            "montant_kmf": str(-origin.amount_kmf),
            "methode": origin.method,
            "operateur": origin.operator or "",
            "facture": origin.invoice_id,
            "recu": "",
            "reference_origine": f"ENC-{origin.pk}",
            "date_origine": _local_day_str(origin.created_at),
        })
    # Tri (date, type, id NUMÉRIQUE) — et le dernier terme est un entier,
    # pas la référence textuelle (revue guardian S10) : ``"ENC-10"`` se
    # range AVANT ``"ENC-9"`` en lexicographique, ce qui donnait une pièce
    # comptable dont les mouvements d'une même journée n'étaient pas dans
    # l'ordre où la caisse les avait encaissés. La clé de tri ne voyage pas
    # dans le snapshot : elle est retirée juste après.
    movements.sort(key=lambda row: (row["date"], row["type"], row["_sort_id"]))
    for row in movements:
        del row["_sort_id"]
    return movements


def previous_export_covering(center, from_day, to_day):
    """Le dernier export dont la période RECOUVRE (même partiellement)
    celle demandée, ou ``None``.

    Sert l'annonce, jamais un refus : rien ne se ferme derrière un export
    (arbitrage PO n° 3). Mais l'application doit **le dire** — « le mois
    d'août a déjà été exporté le 03/09 sous le n° E-000004 » évite qu'un
    comptable saisisse deux fois les mêmes mouvements sans s'en rendre
    compte.

    Recouvrement au sens des intervalles : ``start <= to_day`` ET
    ``end >= from_day``.
    """
    return (
        AccountingExport.objects.for_center(center)
        .filter(period_start__lte=to_day, period_end__gte=from_day)
        .order_by("-sequence_number")
        .first()
    )


def _next_sequence_number(center) -> int:
    """Le prochain numéro de la série « E- » de ce centre, SOUS VERROU.

    La ligne compteur est créée paresseusement (jamais par une migration
    de données : ``TransactionTestCase`` vide les tables entre deux tests).
    Le ``get_or_create`` initial peut perdre une course — la relecture
    ``select_for_update`` juste après est ce qui sérialise réellement les
    deux émissions concurrentes.

    À appeler DANS une transaction : le verrou doit tenir jusqu'au commit
    de l'export, sinon deux émissions liraient le même numéro.
    """
    series = (
        AccountingExportSeries.objects.select_for_update()
        .filter(center=center)
        .first()
    )
    if series is None:
        AccountingExportSeries.objects.get_or_create(
            center=center, defaults={"last_number": 0}
        )
        series = AccountingExportSeries.objects.select_for_update().get(
            center=center
        )
    series.last_number += 1
    series.save(update_fields=["last_number"])
    return series.last_number


@transaction.atomic
def generate_accounting_export(*, actor, center, period_start, period_end):
    """Émettre une pièce comptable figée pour ``[period_start, period_end]``.

    Les bornes sont des JOURS LOCAUX INCLUSIFS, validées par le contrat
    partagé ``apps.common.periods`` (ordre, longueur maximale, bornes en
    heure des Comores) — jamais réécrit ici.

    Ce que la fonction fige, et pourquoi : les **lignes** (le snapshot est
    ce qui sera relu au téléchargement — un export qui recalculerait ne
    serait pas figé) ET les **totaux** (une pièce dit ce qu'elle disait le
    jour où on l'a signée ; les recalculer depuis le snapshot serait
    équivalent aujourd'hui et divergerait le jour où le format des lignes
    bougera).

    Audité ``accounting.export_generated`` : références, période et
    NUMÉRO — **jamais une ligne, jamais un montant** (recopier les totaux
    dans le journal immuable en ferait un second registre financier, non
    réconcilié, que personne n'a demandé).
    """
    start, end = day_bounds(
        period_start, period_end, from_field="period_start", to_field="period_end"
    )
    movements = build_movements(center, start=start, end=end)
    collected = sum(
        (Decimal(row["montant_kmf"]) for row in movements
         if row["type"] == MOVEMENT_PAYMENT),
        Decimal("0"),
    )
    reversed_total = sum(
        (-Decimal(row["montant_kmf"]) for row in movements
         if row["type"] == MOVEMENT_REVERSAL),
        Decimal("0"),
    )
    export = AccountingExport.objects.create(
        center=center,
        period_start=period_start,
        period_end=period_end,
        sequence_number=_next_sequence_number(center),
        generated_by=actor,
        total_collected_kmf=collected,
        total_reversed_kmf=reversed_total,
        net_kmf=collected - reversed_total,
        line_count=len(movements),
        lines=movements,
    )
    audit(
        actor=actor,
        action=AuditAction.ACCOUNTING_EXPORT_GENERATED,
        target=export,
        center=center,
        export_id=export.pk,
        center_id=center.pk,
        number=export.number,
        period_start=period_start.isoformat(),
        period_end=period_end.isoformat(),
        line_count=export.line_count,
    )
    return export


def exports_queryset(center):
    """Les pièces de CE centre — cloisonnement au queryset (ADR 0002)."""
    return AccountingExport.objects.for_center(center)


def export_csv_bytes(export) -> bytes:
    """Le CSV de la pièce — **relu du snapshot, jamais recalculé**.

    C'est la moitié du sens du mot « figé » : deux téléchargements du même
    export rendent le même fichier, aujourd'hui et dans trois ans, même si
    la caisse a bougé entre-temps.

    Encodage **UTF-8 avec BOM** : c'est ce qui fait qu'Excel sous Windows
    — l'outil réel d'un comptable comorien — ouvre le fichier avec les
    accents corrects au lieu de « contre_passation Ã© ». Séparateur
    point-virgule pour la même raison (Excel en locale FR).
    """
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=CSV_COLUMNS, delimiter=";", extrasaction="ignore"
    )
    writer.writeheader()
    for row in export.lines:
        writer.writerow({column: row.get(column, "") for column in CSV_COLUMNS})
    return buffer.getvalue().encode("utf-8-sig")


def export_filename(export) -> str:
    """Nom de fichier NEUTRE : le numéro de pièce et la période, rien
    d'autre — jamais le nom du centre ni d'un patient dans un en-tête
    (patron ``document-{id}.ext`` de S3)."""
    return f"export-{export.number}-{export.period_start}-{export.period_end}.csv"


#: Marqueur de lecture pure : ce module ne doit JAMAIS importer un service
#: d'écriture de la caisse. La sonde d'étanchéité (tests) vérifie que
#: ``apps.accounting`` n'importe ni ``record_cash_payment``, ni
#: ``reverse_cash_payment``, ni ``LedgerTransaction.record``.
READ_ONLY_TOWARDS_LEDGER = True
