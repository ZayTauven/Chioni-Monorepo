"""C2 — DB-level belt for the append-only lock (ADR 0006).

The ORM guards (`AppendOnlyModel`, `AppendOnlyQuerySet`) stop every ORM
path, but raw SQL, another connection or a future bug in the guards could
still mutate the money tables. These PostgreSQL triggers raise on ANY
UPDATE or DELETE against LedgerTransaction, LedgerEntry and Receipt, no
matter who is connected.

Reversible: the reverse SQL drops the triggers and the function.
No legitimate code path ever updates or deletes rows in these tables
(corrections are new reversing transactions), so the test suite runs
unchanged with the triggers in place. Row-level BEFORE triggers do not
fire on TRUNCATE, so test-database teardown/flush is unaffected.
"""

from django.db import migrations

APPEND_ONLY_TABLES = (
    "trustbridge_ledgertransaction",
    "trustbridge_ledgerentry",
    "trustbridge_receipt",
)

CREATE_SQL = """
CREATE OR REPLACE FUNCTION trustbridge_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refusé sur % (le ledger ne se corrige que par transaction inverse).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""
CREATE TRIGGER {table}_append_only
BEFORE UPDATE OR DELETE ON {table}
FOR EACH ROW EXECUTE FUNCTION trustbridge_forbid_mutation();
"""
    for table in APPEND_ONLY_TABLES
)

DROP_SQL = "\n".join(
    f"DROP TRIGGER IF EXISTS {table}_append_only ON {table};"
    for table in APPEND_ONLY_TABLES
) + "\nDROP FUNCTION IF EXISTS trustbridge_forbid_mutation();"


class Migration(migrations.Migration):

    dependencies = [
        ("trustbridge", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
