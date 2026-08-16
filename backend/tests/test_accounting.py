"""Export comptable figé — S10 lot 3 (ADR 0023, décisions 6 et 7).

Ce que ce fichier verrouille :

1. **des MOUVEMENTS, pas des soldes** — l'encaissement du J1 et sa
   contre-passation du J12 coexistent à leurs dates, et le total du J1 ne
   bouge pas (retraitement de la vigilance ADR 0015 consignée en SV.2) ;
2. le **snapshot est relu**, jamais recalculé ;
3. la **série « E- » est par centre, contiguë**, et tient sous course réelle ;
4. l'export **annonce** un précédent recouvrant la période, sans rien
   bloquer ;
5. le **throttle est réellement branché** — et une sonde le vérifie pour
   toutes les vues du produit (leçon S9).
"""

import ast
import pathlib
import threading
from contextlib import contextmanager
from datetime import timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.db import connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone

from apps.accounting.models import AccountingExport, AccountingExportSeries
from apps.accounting.services import (
    CSV_COLUMNS,
    MOVEMENT_PAYMENT,
    MOVEMENT_REVERSAL,
    export_csv_bytes,
    generate_accounting_export,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.trustbridge.models import CashPayment, CashPaymentReversal
from apps.trustbridge.services import record_cash_payment, reverse_cash_payment

from .api_helpers import client_for, make_center_with_director, make_staff_user
from .factories import make_encounter, make_invoice, make_patient

pytestmark = pytest.mark.django_db


@contextmanager
def clock_moved_back(days):
    """Faire naître une ligne de caisse À UNE DATE PASSÉE — banc de test.

    On ne PEUT PAS rétro-dater après coup : la caisse est verrouillée à
    trois niveaux (ADR 0006/0015). L'ORM refuse ``save()`` et ``update()``
    (socle ``AppendOnlyModel``), un **trigger PostgreSQL** refuse jusqu'à
    l'``UPDATE`` en SQL brut, et l'``ALTER TABLE … DISABLE TRIGGER`` est
    lui-même refusé tant que la transaction porte des événements de
    trigger en attente. C'est exactement ce qu'on veut en production.

    Reste donc la seule voie honnête : reculer l'horloge le temps de
    l'écriture. ``auto_now_add`` lit ``django.utils.timezone.now`` au
    moment du ``pre_save``, et tout le chemin d'encaissement lit la même
    fonction — la ligne, son reçu et sa transaction de ledger naissent
    donc **cohérents entre eux**, ce qui est précisément ce qu'un
    encaissement d'il y a vingt jours doit être.

    Ce que ce helper permet d'éprouver ne se teste pas autrement : un
    encaissement du J1 contre-passé au J12, c'est-à-dire LA décision 7 de
    l'ADR 0023. Il ne vit que dans ce fichier.
    """
    real_now = timezone.now
    moment = real_now() - timedelta(days=days)
    with mock.patch.object(timezone, "now", lambda: moment):
        yield moment


def _select_for_update_receivers(module_path):
    """Les expressions sur lesquelles ``select_for_update`` est appelé.

    Lecture par AST et non par recherche de texte : une sonde qui
    grepperait le source ferait échouer le test sur une PROSE de docstring
    (« jamais un verrou sur ``HealthCenter`` ») — c'est-à-dire sur la
    phrase qui documente précisément la règle qu'elle vérifie.
    """
    tree = ast.parse(pathlib.Path(module_path).read_text(encoding="utf-8"))
    receivers = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "select_for_update"
        ):
            receivers.add(ast.unparse(node.func.value))
    return receivers


def _imported_and_called_names(package_root):
    """Les noms IMPORTÉS et les attributs APPELÉS dans un package.

    Même raison que ci-dessus : on interroge le code, pas les commentaires.
    """
    imported, called = set(), set()
    for path in pathlib.Path(package_root).rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.Import):
                imported.update(alias.name for alias in node.names)
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute):
                    called.add(node.func.attr)
                elif isinstance(node.func, ast.Name):
                    called.add(node.func.id)
    return imported, called


class Scene:
    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.cashier = make_staff_user(self.center, role="caissier")
        self.doctor = make_staff_user(self.center, role="medecin")
        self.patient = make_patient(created_by_center=self.center)
        self.invoice = make_invoice(
            encounter=make_encounter(patient=self.patient, center=self.center)
        )

    def cash_in(self, amount="3000", days_ago=0, method=CashPayment.Method.CASH,
                operator=""):
        with clock_moved_back(days_ago):
            payment = record_cash_payment(
                actor=self.cashier, center=self.center, invoice=self.invoice,
                method=method, amount_kmf=Decimal(amount), operator=operator,
            )
        return payment[0] if isinstance(payment, tuple) else payment

    def reverse(self, payment, days_ago=0, reason="Erreur de saisie."):
        with clock_moved_back(days_ago):
            reversal = reverse_cash_payment(
                actor=self.cashier, cash_payment=payment, reason=reason
            )
        return reversal[0] if isinstance(reversal, tuple) else reversal

    def export(self, *, start_days_ago=30, end_days_ago=0, actor=None):
        today = timezone.localdate()
        return generate_accounting_export(
            actor=actor or self.cashier,
            center=self.center,
            period_start=today - timedelta(days=start_days_ago),
            period_end=today - timedelta(days=end_days_ago),
        )


# ---------------------------------------------------------------------------
# 1 — LA décision du lot : des MOUVEMENTS, pas des soldes
# ---------------------------------------------------------------------------


class TestMovementsNotBalances:
    def test_a_reversal_never_rewrites_an_earlier_day(self):
        """Le test qui porte la décision 7, et le retraitement de la
        vigilance SV.2 : encaissement le J1, contre-passation le J12 — les
        DEUX lignes existent, à leurs dates, et le total du J1 ne bouge pas.

        Dans ``stats/finances``, la recette du 3 août change si on
        contre-passe le 12. Acceptable pour un tableau de pilotage,
        inacceptable pour une pièce comptable.
        """
        scene = Scene()
        payment = scene.cash_in("3000", days_ago=20)
        scene.reverse(payment, days_ago=8)
        today = timezone.localdate()
        day_of_payment = (today - timedelta(days=20)).isoformat()
        day_of_reversal = (today - timedelta(days=8)).isoformat()

        export = scene.export()

        assert export.line_count == 2
        by_type = {row["type"]: row for row in export.lines}
        assert by_type[MOVEMENT_PAYMENT]["date"] == day_of_payment
        assert by_type[MOVEMENT_REVERSAL]["date"] == day_of_reversal
        # Le mouvement d'origine reste POSITIF à sa date : rien n'est
        # soustrait en silence d'un jour antérieur.
        assert by_type[MOVEMENT_PAYMENT]["montant_kmf"] == "3000.00"
        assert by_type[MOVEMENT_REVERSAL]["montant_kmf"] == "-3000.00"
        # La contre-passation dit d'où elle vient.
        assert by_type[MOVEMENT_REVERSAL]["reference_origine"] == (
            f"ENC-{payment.pk}"
        )
        assert by_type[MOVEMENT_REVERSAL]["date_origine"] == day_of_payment
        # Les totaux sont la somme algébrique de ce qui est écrit.
        assert export.total_collected_kmf == Decimal("3000")
        assert export.total_reversed_kmf == Decimal("3000")
        assert export.net_kmf == Decimal("0")

    def test_the_day_of_the_payment_is_untouched_when_the_period_stops_before(
        self,
    ):
        """La photo du 3 août reste la photo du 3 août : une période qui
        s'arrête avant la contre-passation ne la voit pas, et n'en retire
        donc rien."""
        scene = Scene()
        scene.cash_in("3000", days_ago=20)
        payment = CashPayment.objects.get()
        scene.reverse(payment, days_ago=0)

        export = scene.export(start_days_ago=25, end_days_ago=10)

        assert export.line_count == 1
        assert export.lines[0]["type"] == MOVEMENT_PAYMENT
        assert export.net_kmf == Decimal("3000")

    def test_a_reversal_of_a_payment_OUTSIDE_the_period_still_appears(self):
        """Et c'est justement le cas qui compte : le comptable voit la
        correction ET d'où elle vient, même si l'origine est antérieure."""
        scene = Scene()
        payment = scene.cash_in("3000", days_ago=100)
        scene.reverse(payment, days_ago=2)

        export = scene.export(start_days_ago=10, end_days_ago=0)

        assert export.line_count == 1
        (row,) = export.lines
        assert row["type"] == MOVEMENT_REVERSAL
        assert row["reference_origine"] == f"ENC-{payment.pk}"
        assert row["date_origine"] == (
            timezone.localdate() - timedelta(days=100)
        ).isoformat()

    def test_a_trust_bridge_cash_in_is_a_movement_like_any_other(self):
        scene = Scene()
        scene.cash_in("2000", method=CashPayment.Method.MOBILE_MONEY,
                      operator="huri")

        export = scene.export()

        (row,) = export.lines
        assert row["methode"] == "mobile_money"
        assert row["operateur"] == "huri"

    def test_another_centers_movements_never_enter(self):
        scene = Scene()
        scene.cash_in("3000")
        other = Scene()
        other.cash_in("6400")

        export = scene.export()

        assert export.line_count == 1
        assert export.lines[0]["montant_kmf"] == "3000.00"
        assert export.net_kmf == Decimal("3000")


# ---------------------------------------------------------------------------
# 2 — Le snapshot est RELU, jamais recalculé
# ---------------------------------------------------------------------------


class TestTheSnapshotIsFrozen:
    def test_a_later_reversal_does_not_change_an_emitted_export(self):
        scene = Scene()
        payment = scene.cash_in("3000", days_ago=2)
        export = scene.export()
        assert export.net_kmf == Decimal("3000")

        scene.reverse(payment)

        export.refresh_from_db()
        assert export.line_count == 1
        assert export.net_kmf == Decimal("3000")
        assert export.lines[0]["montant_kmf"] == "3000.00"

    def test_two_downloads_of_the_same_export_are_byte_identical(self):
        scene = Scene()
        payment = scene.cash_in("3000", days_ago=2)
        export = scene.export()
        url = (
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
            f"{export.pk}/download/"
        )

        first = client_for(scene.cashier).get(url).content
        scene.reverse(payment)  # la caisse bouge entre les deux
        second = client_for(scene.cashier).get(url).content

        assert first == second

    def test_the_export_is_append_only(self):
        from apps.common.models import AppendOnlyError

        scene = Scene()
        export = scene.export()

        with pytest.raises(AppendOnlyError):
            export.net_kmf = Decimal("1")
            export.save()
        with pytest.raises(AppendOnlyError):
            export.delete()
        with pytest.raises(AppendOnlyError):
            AccountingExport.objects.all().update(line_count=0)


# ---------------------------------------------------------------------------
# 3 — Le CSV : colonnes stables, en-têtes durcis
# ---------------------------------------------------------------------------


class TestTheCsv:
    def test_the_columns_are_stable_and_in_order(self):
        scene = Scene()
        scene.cash_in("3000")
        export = scene.export()

        content = export_csv_bytes(export).decode("utf-8-sig")
        header = content.splitlines()[0]

        assert header == ";".join(CSV_COLUMNS)

    def test_the_download_is_an_attachment_with_a_neutral_name_and_nosniff(self):
        scene = Scene()
        scene.cash_in("3000")
        export = scene.export()

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
            f"{export.pk}/download/"
        )

        assert response.status_code == 200
        assert response["X-Content-Type-Options"] == "nosniff"
        assert "attachment;" in response["Content-Disposition"]
        assert export.number in response["Content-Disposition"]
        # Nom NEUTRE : ni centre, ni patient dans un en-tête.
        assert scene.center.name not in response["Content-Disposition"]
        assert scene.patient.last_name not in response["Content-Disposition"]

    def test_no_name_and_nothing_clinical_ever_reaches_the_file(self):
        scene = Scene()
        scene.cash_in("3000")
        export = scene.export()

        content = export_csv_bytes(export).decode("utf-8-sig")

        for forbidden in (
            scene.patient.last_name, scene.patient.first_name,
            scene.center.name, "Consultation", "Céphalées",
        ):
            assert forbidden not in content

    def test_the_file_opens_with_a_bom_for_excel(self):
        scene = Scene()
        export = scene.export()

        assert export_csv_bytes(export).startswith(b"\xef\xbb\xbf")


# ---------------------------------------------------------------------------
# 4 — La série « E- » : par centre, contiguë
# ---------------------------------------------------------------------------


class TestTheSeries:
    def test_numbers_are_sequential_and_start_at_one(self):
        scene = Scene()

        first, second = scene.export(), scene.export()

        assert (first.sequence_number, second.sequence_number) == (1, 2)
        assert first.number == "E-000001"

    def test_each_center_has_its_OWN_series(self):
        scene, other = Scene(), Scene()

        scene.export()
        scene.export()
        first_of_other = other.export()

        assert first_of_other.sequence_number == 1

    def test_a_rolled_back_emission_burns_no_number(self):
        """Ce que la ``SEQUENCE`` PostgreSQL n'aurait pas su faire : un
        rollback remet le numéro, et la série reste contiguë (un trou dans
        une série ressemble à une fraude — ADR 0015 §6)."""
        scene = Scene()
        scene.export()

        with pytest.raises(RuntimeError):
            with transaction.atomic():
                scene.export()
                raise RuntimeError("boom")

        assert scene.export().sequence_number == 2

    def test_the_counter_row_is_created_lazily(self):
        scene = Scene()
        assert not AccountingExportSeries.objects.filter(
            center=scene.center
        ).exists()

        scene.export()

        assert AccountingExportSeries.objects.get(
            center=scene.center
        ).last_number == 1

    def test_the_series_row_is_never_the_center_row(self):
        """Le verrou ne doit JAMAIS porter sur ``HealthCenter`` : cette
        contention avec ``Receipt.issue()`` a été écartée en S5.

        Et jamais une ``SEQUENCE`` PostgreSQL : ``nextval()`` n'est pas
        transactionnelle, un rollback brûlerait un numéro.
        """
        services = (
            pathlib.Path(__file__).resolve().parents[1]
            / "apps" / "accounting" / "services.py"
        )

        assert _select_for_update_receivers(services) == {
            "AccountingExportSeries.objects"
        }
        _imported, called = _imported_and_called_names(services.parent)
        assert "nextval" not in called
        assert "RawSQL" not in called


class TestTheSeriesUnderRealConcurrency(TransactionTestCase):
    """Deux émissions VRAIMENT simultanées ne partagent jamais un numéro."""

    reset_sequences = True

    def test_two_concurrent_emissions_get_distinct_contiguous_numbers(self):
        from .api_helpers import make_center_with_director as _center
        from .factories import make_patient as _patient

        center, director = _center()
        _patient(created_by_center=center)
        today = timezone.localdate()
        errors = []
        barrier = threading.Barrier(2)

        def emit():
            try:
                barrier.wait(timeout=5)
                generate_accounting_export(
                    actor=director, center=center,
                    period_start=today - timedelta(days=30), period_end=today,
                )
            except Exception as exc:  # pragma: no cover — diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=emit) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)

        assert errors == [], errors
        numbers = sorted(
            AccountingExport.objects.filter(center=center).values_list(
                "sequence_number", flat=True
            )
        )
        assert numbers == [1, 2]


# ---------------------------------------------------------------------------
# 5 — Non bloquant, mais ANNONCÉ (arbitrage PO n° 3)
# ---------------------------------------------------------------------------


class TestNothingCloses:
    def _post(self, scene, start, end, actor=None):
        return client_for(actor or scene.cashier).post(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/",
            {"period_start": start.isoformat(), "period_end": end.isoformat()},
            format="json",
        )

    def test_the_same_month_can_be_exported_twice_and_the_second_announces_the_first(
        self,
    ):
        scene = Scene()
        today = timezone.localdate()
        start, end = today - timedelta(days=20), today

        first = self._post(scene, start, end)
        second = self._post(scene, start, end)

        assert first.status_code == 201
        assert first.data["previous_export"] is None
        assert second.status_code == 201
        assert second.data["previous_export"]["number"] == "E-000001"
        assert second.data["previous_export"]["period_start"] == start.isoformat()

    def test_a_partial_overlap_is_announced_too(self):
        scene = Scene()
        today = timezone.localdate()
        self._post(scene, today - timedelta(days=30), today - timedelta(days=15))

        second = self._post(scene, today - timedelta(days=20), today)

        assert second.data["previous_export"] is not None

    def test_a_disjoint_period_announces_nothing(self):
        scene = Scene()
        today = timezone.localdate()
        self._post(scene, today - timedelta(days=30), today - timedelta(days=20))

        second = self._post(scene, today - timedelta(days=10), today)

        assert second.data["previous_export"] is None

    def test_a_reversal_stays_possible_on_an_exported_period(self):
        """Rien ne se ferme derrière un export : l'ADR 0015 refuse qu'on
        empêche la caisse de corriger une erreur."""
        scene = Scene()
        payment = scene.cash_in("3000", days_ago=2)
        scene.export()

        reversal = scene.reverse(payment)

        assert reversal.pk is not None

    def test_an_inverted_period_is_400_on_the_right_field(self):
        scene = Scene()
        today = timezone.localdate()

        response = self._post(scene, today, today - timedelta(days=5))

        assert response.status_code == 400
        assert "period_start" in response.data

    def test_an_over_long_period_is_refused(self):
        scene = Scene()
        today = timezone.localdate()

        response = self._post(scene, today - timedelta(days=400), today)

        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 6 — Audience, cloisonnement, audit
# ---------------------------------------------------------------------------


class TestTheAudience:
    def test_billing_roles_only(self):
        scene = Scene()
        url = f"/api/v1/centers/{scene.center.pk}/accounting/exports/"

        assert client_for(scene.cashier).get(url).status_code == 200
        assert client_for(scene.director).get(url).status_code == 200
        assert client_for(scene.doctor).get(url).status_code == 403
        assert client_for().get(url).status_code == 401

    def test_another_centers_staff_gets_404_on_the_list(self):
        scene = Scene()
        _other_center, other_director = make_center_with_director()

        response = client_for(other_director).get(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
        )

        assert response.status_code == 404

    def test_an_export_of_another_center_is_404_through_my_url(self):
        scene, other = Scene(), Scene()
        foreign = other.export()

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
            f"{foreign.pk}/"
        )

        assert response.status_code == 404

    def test_the_download_of_a_foreign_export_is_404_too(self):
        scene, other = Scene(), Scene()
        foreign = other.export()

        response = client_for(scene.cashier).get(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
            f"{foreign.pk}/download/"
        )

        assert response.status_code == 404

    def test_the_audit_carries_the_number_and_the_period_but_no_amount(self):
        scene = Scene()
        scene.cash_in("3000")

        export = scene.export()

        entry = AuditLog.objects.filter(
            action=AuditAction.ACCOUNTING_EXPORT_GENERATED
        ).latest("id")
        assert entry.center_id == scene.center.pk
        assert entry.payload["number"] == export.number
        assert entry.payload["period_start"] == export.period_start.isoformat()
        assert entry.payload["line_count"] == 1
        # Jamais une ligne, jamais un montant.
        assert "3000" not in str(entry.payload)
        assert "lines" not in entry.payload

    def test_the_action_is_whitelisted_in_the_director_journal(self):
        from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS

        assert (
            AuditAction.ACCOUNTING_EXPORT_GENERATED in DIRECTOR_JOURNAL_ACTIONS
        )

    def test_the_director_really_sees_the_line_in_his_journal(self):
        scene = Scene()
        export = scene.export(actor=scene.director)

        response = client_for(scene.director).get(
            f"/api/v1/centers/{scene.center.pk}/audit-log/"
            f"?action={AuditAction.ACCOUNTING_EXPORT_GENERATED}"
        )

        assert response.status_code == 200
        (row,) = response.data["results"]
        assert row["payload"]["number"] == export.number


# ---------------------------------------------------------------------------
# 7 — Le throttle est RÉELLEMENT branché (leçon S9, faille élevée n° 2)
# ---------------------------------------------------------------------------


class TestNoThrottleScopeIsInert:
    """Sonde TRANSVERSE : un ``throttle_scope`` posé sans
    ``ScopedRateThrottle`` est **inerte**.

    C'est la faille élevée n° 2 de S9 : les 60/h de la diffusion des
    demandes de disponibilité retombaient en silence sur le budget
    générique de 600/min, sur le seul geste du produit qui parle à des
    tiers en masse. La sonde ne regarde pas ``apps/accounting`` seulement :
    elle parcourt **toutes les vues de l'API**, pour que le prochain scope
    posé quelque part ne puisse pas être muet.
    """

    @staticmethod
    def _api_views():
        from django.urls import get_resolver

        seen = {}

        def walk(patterns, prefix=""):
            for pattern in patterns:
                if hasattr(pattern, "url_patterns"):
                    walk(pattern.url_patterns, prefix + str(pattern.pattern))
                    continue
                callback = pattern.callback
                view = getattr(callback, "cls", None) or getattr(
                    callback, "view_class", None
                )
                if view is not None:
                    seen[f"{view.__module__}.{view.__name__}"] = (
                        view, prefix + str(pattern.pattern)
                    )

        walk(get_resolver().url_patterns)
        return seen

    def test_every_view_declaring_a_scope_really_returns_a_scoped_throttle(self):
        import inspect

        from rest_framework.throttling import ScopedRateThrottle

        offenders = []
        for name, (view, route) in self._api_views().items():
            scope = getattr(view, "throttle_scope", None)
            declares_in_classes = any(
                issubclass(cls, ScopedRateThrottle)
                for cls in getattr(view, "throttle_classes", []) or []
            )
            overrides_get_throttles = (
                "get_throttles" in view.__dict__
                or any("get_throttles" in base.__dict__ for base in view.__mro__[1:-1])
            )
            if scope and not (declares_in_classes or overrides_get_throttles):
                offenders.append((name, route, scope))
            # …et le miroir : une vue qui pose son scope DANS
            # ``get_throttles`` doit y retourner le throttle.
            if overrides_get_throttles and "get_throttles" in view.__dict__:
                source = inspect.getsource(view.__dict__["get_throttles"])
                if "throttle_scope" in source:
                    assert "ScopedRateThrottle" in source, name
        assert not offenders, offenders

    def test_the_accounting_scope_is_configured(self):
        from django.conf import settings

        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        assert "accounting_export" in rates

    def test_generating_is_throttled_but_reading_is_not(self, monkeypatch):
        """LA preuve que le scope n'est pas inerte : on abaisse le budget et
        le troisième POST répond 429 — tandis que les lectures continuent.

        ``THROTTLE_RATES`` est patché sur ``SimpleRateThrottle``
        directement (patron ``tests/test_metier_throttles.py``) : c'est un
        attribut de CLASSE figé à l'import, qu'un ``override_settings`` de
        ``REST_FRAMEWORK`` rechargerait dans ``api_settings`` sans jamais
        le rebinder.
        """
        from django.conf import settings as django_settings
        from django.core.cache import cache
        from rest_framework.throttling import SimpleRateThrottle

        monkeypatch.setattr(
            SimpleRateThrottle,
            "THROTTLE_RATES",
            {
                **django_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "accounting_export": "2/hour",
            },
        )
        cache.clear()
        scene = Scene()
        today = timezone.localdate()
        payload = {
            "period_start": (today - timedelta(days=5)).isoformat(),
            "period_end": today.isoformat(),
        }
        url = f"/api/v1/centers/{scene.center.pk}/accounting/exports/"
        client = client_for(scene.cashier)

        codes = [client.post(url, payload, format="json").status_code
                 for _ in range(3)]

        assert codes == [201, 201, 429]
        # Les LECTURES gardent le budget global : la file reste lisible.
        assert client.get(url).status_code == 200


# ---------------------------------------------------------------------------
# 8 — Étanchéité et sondes structurelles
# ---------------------------------------------------------------------------


class TestTheStructuralGuards:
    APPS_ROOT = pathlib.Path(__file__).resolve().parents[1] / "apps"

    def test_the_app_writes_nothing_into_the_ledger(self):
        """Exporter est une LECTURE. L'ADR 0003 tient tel quel.

        Sonde par AST (imports + appels), jamais par recherche de texte :
        les docstrings de ce module CITENT ``CashReceipt.issue()`` et
        ``Receipt.issue()`` pour expliquer pourquoi le verrou de la série
        ne leur ressemble pas — une sonde textuelle échouerait sur la
        phrase qui documente la règle.
        """
        imported, called = _imported_and_called_names(self.APPS_ROOT / "accounting")

        for forbidden in (
            "record_cash_payment", "reverse_cash_payment", "issue", "record",
        ):
            assert forbidden not in called, forbidden
        for forbidden in ("record_cash_payment", "reverse_cash_payment"):
            assert forbidden not in imported, forbidden

    def test_generating_an_export_creates_no_money_row(self):
        scene = Scene()
        scene.cash_in("3000")
        counts = (
            CashPayment.objects.count(),
            CashPaymentReversal.objects.count(),
        )

        scene.export()
        scene.export()

        assert (
            CashPayment.objects.count(),
            CashPaymentReversal.objects.count(),
        ) == counts

    def test_no_module_of_the_app_imports_the_freeze_guard(self):
        """Sonde MIROIR de la sonde fail-closed S5 : l'export est **la
        donnée du centre**, et l'ADR 0018 interdit déjà la prise d'otage
        des données."""
        offenders = []
        for path in (self.APPS_ROOT / "accounting").rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.ImportFrom) and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                ):
                    offenders.append(path.name)
            if "require_center_can_administer(" in source:
                offenders.append(path.name)
        assert not offenders, offenders

    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_a_frozen_center_still_exports_its_own_accounting(self, status):
        from .factories import make_subscription

        scene = Scene()
        make_subscription(
            center=scene.center, status=status,
            status_reason="Facture A-000012 impayée depuis 60 jours.",
        )

        response = client_for(scene.cashier).post(
            f"/api/v1/centers/{scene.center.pk}/accounting/exports/",
            {"period_start": (timezone.localdate() - timedelta(days=5)).isoformat(),
             "period_end": timezone.localdate().isoformat()},
            format="json",
        )

        assert response.status_code == 201, response.data

    def test_the_module_exposes_no_route_outside_the_tenant(self):
        from apps.accounting import urls as accounting_urls

        for pattern in accounting_urls.urlpatterns:
            route = str(pattern.pattern)
            assert route.startswith("centers/"), route
            assert not route.startswith(
                ("patients/", "guardian/", "platform/", "pharmacy/")
            ), route
