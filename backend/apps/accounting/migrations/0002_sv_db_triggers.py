"""SV — DB-level belt for the frozen accounting export (socle ADR 0006).

L'enjeu le plus haut du lot : le snapshot figé est le seul objet du produit
qui prétend SURVIVRE à l'application — une fois le CSV sur une clé USB, la
seule preuve que la pièce n'a pas bougé est que sa ligne ne PEUT pas
bouger. Chaque trigger est le MIROIR STRICT d'un invariant existant —
jamais un invariant nouveau :

- ``accounting_accountingexport`` (append-only) : hérite
  d'``AppendOnlyModel`` (ADR 0023 décisions 6/7 — la pièce est une photo
  datée et numérotée, relue TELLE QUELLE au téléchargement, jamais
  recalculée). La base ferme désormais le SQL brut aussi.
- ``accounting_accountingexportseries`` : garde de MONOTONIE seulement —
  le compteur « E- » ne recule jamais (un recul ferait renuméroter une
  pièce déjà signée, et un trou ou un doublon dans une série comptable
  ressemble à une fraude — ADR 0015 §6). Rien d'autre n'est gelé sur la
  série : le compteur est mutable par conception (incrément sous
  ``SELECT … FOR UPDATE`` dans ``_next_sequence_number``).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents (« monotone », « ne recule jamais ») ; le
message append-only contient « append-only ». Row-level BEFORE triggers do
not fire on TRUNCATE, so test-database teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION accounting_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (une piece comptable signee ne bouge plus).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounting_accountingexport_append_only
BEFORE UPDATE OR DELETE ON accounting_accountingexport
FOR EACH ROW EXECUTE FUNCTION accounting_forbid_mutation();

CREATE OR REPLACE FUNCTION accounting_check_series_monotonic() RETURNS trigger AS $$
BEGIN
    IF NEW.last_number < OLD.last_number THEN
        RAISE EXCEPTION 'Chioni : la serie des exports comptables est monotone, le compteur ne recule jamais — serie %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounting_accountingexportseries_monotonic
BEFORE UPDATE ON accounting_accountingexportseries
FOR EACH ROW EXECUTE FUNCTION accounting_check_series_monotonic();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS accounting_accountingexport_append_only ON accounting_accountingexport;
DROP TRIGGER IF EXISTS accounting_accountingexportseries_monotonic ON accounting_accountingexportseries;
DROP FUNCTION IF EXISTS accounting_forbid_mutation();
DROP FUNCTION IF EXISTS accounting_check_series_monotonic();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
