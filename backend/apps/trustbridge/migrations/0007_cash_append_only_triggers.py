"""ADR 0015 — DB-level belt for the caisse tables (same C2 discipline).

The three cash models (payments, reversals, counter receipts) are
append-only at the ORM level (`AppendOnlyModel`); these triggers extend
the existing ``trustbridge_forbid_mutation()`` function (created by
migration 0002, which this migration depends on) to the new tables so raw
SQL cannot mutate them either. A cash-in is corrected by a reversal row,
never an UPDATE; nothing is ever deleted.

Reversible: the reverse SQL drops only the new triggers (the function
stays owned by 0002). Row-level BEFORE triggers do not fire on TRUNCATE,
so test-database teardown/flush is unaffected.
"""

from django.db import migrations

CASH_APPEND_ONLY_TABLES = (
    "trustbridge_cashpayment",
    "trustbridge_cashpaymentreversal",
    "trustbridge_cashreceipt",
)

CREATE_SQL = "\n".join(
    f"""
CREATE TRIGGER {table}_append_only
BEFORE UPDATE OR DELETE ON {table}
FOR EACH ROW EXECUTE FUNCTION trustbridge_forbid_mutation();
"""
    for table in CASH_APPEND_ONLY_TABLES
)

DROP_SQL = "\n".join(
    f"DROP TRIGGER IF EXISTS {table}_append_only ON {table};"
    for table in CASH_APPEND_ONLY_TABLES
)


class Migration(migrations.Migration):

    dependencies = [
        ("trustbridge", "0006_cash_payment_models"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
