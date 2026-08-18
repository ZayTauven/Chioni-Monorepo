"""SV — parité du journal du directeur entre le backend et le frontend.

Remède STRUCTUREL de la dérive S5 (constat guardian frontend) : la liste
blanche d'affichage du frontend est fail-closed — elle protège la donnée
mais DÉGRADE EN SILENCE. Les 4 actions ``support_ticket.*`` ajoutées par le
lot 3 backend n'ont jamais atteint ``labels.ts``, et le directeur a lu des
codes bruts anglais pendant tout un sprint sans qu'aucun test ne le dise.

Ce test couple donc la suite Python au fichier ``labels.ts`` (arbitrage
d'architecture SV, acté par le PO) : le backend détient les DEUX vérités
(la liste blanche du journal ET les clés de payload réellement posées par
les ``audit()``), le frontend détient les libellés — la parité se vérifie
ici, côté backend.

Contrat :

(a) ``DIRECTOR_JOURNAL_ACTIONS`` ⊆ clés d'``AUDIT_ACTION_LABELS`` (et du
    type ``AuditAction`` de ``types.ts``) ;
(b) les clés de payload posées par les ``audit()`` des actions
    whitelistées ⊆ clés d'``AUDIT_PAYLOAD_LABELS``.

**Fichier frontend absent = ÉCHEC** (jamais un skip) : un repo sans
``labels.ts`` est un repo dont le contrat d'affichage a disparu.

Cliquet de dérive CONNUE : à l'écriture du test (SV, 16/08/2026), les
actions RH/fériés/congés du journal S7 n'ont JAMAIS atteint le frontend —
exactement la dérive S5, rejouée. Les constantes ``KNOWN_MISSING_*``
listent cet état, et les assertions sont des ÉGALITÉS : toute dérive
NOUVELLE échoue, et le jour où la vague frontend ajoute les libellés,
l'égalité échoue aussi — la constante doit alors être VIDÉE, jamais
étendue. (Le backend ne modifie pas ``labels.ts`` : la correction
appartient à la vague frontend, consignée au rapport SV.)
"""

import ast
import pathlib
import re

from apps.audit.services import AuditAction
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
LABELS_TS = REPO_ROOT / "frontend" / "src" / "lib" / "labels.ts"
TYPES_TS = REPO_ROOT / "frontend" / "src" / "lib" / "types.ts"
APPS_ROOT = pathlib.Path(__file__).resolve().parents[1] / "apps"

#: Cliquet de dérive connue — VIDÉ par la vague frontend SV (les 8 actions
#: du journal S7 et leurs clés de payload ont rejoint ``labels.ts`` et
#: ``types.ts``). Ne JAMAIS étendre : une entrée nouvelle ici serait la
#: dérive S5 assumée au lieu d'être corrigée — le libellé s'ajoute côté
#: frontend, dans le même mouvement que l'action backend.
KNOWN_MISSING_ACTION_LABELS = frozenset()

#: Même cliquet pour les clés de payload posées par les ``audit()`` des
#: actions whitelistées et absentes d'``AUDIT_PAYLOAD_LABELS``. Vidé en SV
#: (journal S7, plus ``stays_moved``/``preferences_tightened`` de la fusion).
KNOWN_MISSING_PAYLOAD_LABELS = frozenset()


def _block_keys(source, const_name):
    """Les clés d'un objet littéral `export const NAME … = { … };`."""
    match = re.search(
        rf"export const {const_name}[^=]*=\s*{{(.*?)\n}};",
        source,
        flags=re.DOTALL,
    )
    assert match is not None, (
        f"{const_name} introuvable dans labels.ts — le contrat d'affichage "
        "du journal a bougé, mettre ce test en face."
    )
    keys = set()
    for line in match.group(1).splitlines():
        stripped = line.strip()
        if stripped.startswith(("//", "/*", "*")):
            continue
        # Le frontend est écrit en guillemets SIMPLES (convention repo) —
        # accepter les deux, plus les identifiants nus.
        key = re.match(
            r"""(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))\s*:""",
            stripped,
        )
        if key:
            keys.add(key.group(1) or key.group(2) or key.group(3))
    return keys


def _audit_action_type_values(source):
    """Les valeurs de l'union `export type AuditAction = …;` de types.ts."""
    match = re.search(
        r"export type AuditAction\s*=(.*?);", source, flags=re.DOTALL
    )
    assert match is not None, "Type AuditAction introuvable dans types.ts."
    segment = match.group(1)
    # Les commentaires du bloc contiennent des apostrophes françaises
    # (« l'exclusion ») qui déraillent l'appariement des quotes : on les
    # retire AVANT d'extraire les littéraux de l'union.
    segment = re.sub(r"/\*.*?\*/", "", segment, flags=re.DOTALL)
    segment = re.sub(r"//[^\n]*", "", segment)
    return set(re.findall(r"""["']([^"']+)["']""", segment))


def _payload_keys_by_action():
    """Vérité backend : pour chaque action, les clés de payload posées par
    les appels ``audit(action=AuditAction.X, **refs)`` — balayage ``ast``
    de tout ``apps/`` (les kwargs réservés ``actor/action/target/center``
    sont des colonnes, pas des clés de payload)."""
    reserved = {"actor", "action", "target", "center"}
    by_action = {}
    for path in APPS_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "audit"
            ):
                continue
            action_value = None
            payload_keys = set()
            for keyword in node.keywords:
                if keyword.arg == "action":
                    value = keyword.value
                    if (
                        isinstance(value, ast.Attribute)
                        and isinstance(value.value, ast.Name)
                        and value.value.id == "AuditAction"
                    ):
                        action_value = getattr(AuditAction, value.attr, None)
                elif keyword.arg is not None and keyword.arg not in reserved:
                    payload_keys.add(keyword.arg)
            if action_value:
                by_action.setdefault(action_value, set()).update(payload_keys)
    return by_action


class TestDirectorJournalFrontendParity:
    def test_the_frontend_contract_files_exist(self):
        """Fichier absent = ÉCHEC — jamais un skip."""
        assert LABELS_TS.exists(), (
            "frontend/src/lib/labels.ts est introuvable : le contrat "
            "d'affichage du journal du directeur a disparu du repo."
        )
        assert TYPES_TS.exists(), (
            "frontend/src/lib/types.ts est introuvable : le type AuditAction "
            "du frontend a disparu du repo."
        )

    def test_every_whitelisted_action_has_a_frontend_label(self):
        source = LABELS_TS.read_text(encoding="utf-8")
        labelled = _block_keys(source, "AUDIT_ACTION_LABELS")
        missing = set(DIRECTOR_JOURNAL_ACTIONS) - labelled
        assert missing == set(KNOWN_MISSING_ACTION_LABELS), (
            "Parité journal ↔ labels.ts rompue. Actions whitelistées sans "
            f"libellé frontend : {sorted(missing)} — attendu (cliquet SV) : "
            f"{sorted(KNOWN_MISSING_ACTION_LABELS)}. Une action NOUVELLE "
            "dans cet écart = la dérive S5 rejouée : ajouter son libellé "
            "dans labels.ts (vague frontend). Un écart RÉSORBÉ : vider la "
            "constante KNOWN_MISSING_ACTION_LABELS, jamais l'étendre."
        )

    def test_every_whitelisted_action_is_in_the_frontend_type(self):
        typed = _audit_action_type_values(TYPES_TS.read_text(encoding="utf-8"))
        missing = set(DIRECTOR_JOURNAL_ACTIONS) - typed
        assert missing == set(KNOWN_MISSING_ACTION_LABELS), (
            "Le type AuditAction de types.ts ne couvre pas la liste blanche "
            f"du journal : {sorted(missing)} (cliquet SV : "
            f"{sorted(KNOWN_MISSING_ACTION_LABELS)})."
        )

    def test_every_payload_key_of_a_whitelisted_action_has_a_label(self):
        source = LABELS_TS.read_text(encoding="utf-8")
        labelled = _block_keys(source, "AUDIT_PAYLOAD_LABELS")
        by_action = _payload_keys_by_action()
        missing = {}
        for action in DIRECTOR_JOURNAL_ACTIONS:
            gap = by_action.get(action, set()) - labelled
            if gap:
                missing[action] = sorted(gap)
        flat = set().union(*missing.values()) if missing else set()
        assert flat == set(KNOWN_MISSING_PAYLOAD_LABELS), (
            "Clés de payload posées par des audit() whitelistés et absentes "
            f"d'AUDIT_PAYLOAD_LABELS : {missing} — attendu (cliquet SV) : "
            f"{sorted(KNOWN_MISSING_PAYLOAD_LABELS)}. Le PayloadCell du "
            "frontend rendra ces lignes muettes tant que la vague frontend "
            "n'a pas ajouté les libellés."
        )

    def test_the_backend_truth_is_not_empty(self):
        """Garde-fou du test lui-même : si le balayage ast ne trouve plus
        aucun audit() whitelisté, c'est le TEST qui est cassé (imports,
        renommage) — il doit échouer bruyamment plutôt que valider du
        vide."""
        by_action = _payload_keys_by_action()
        covered = set(by_action) & set(DIRECTOR_JOURNAL_ACTIONS)
        assert len(covered) >= 30, (
            f"Le balayage ast ne voit plus que {len(covered)} actions "
            "whitelistées — le détecteur lui-même a dérivé."
        )
