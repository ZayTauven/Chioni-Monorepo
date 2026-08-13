"""C2 — DB-level belt for the audit log's append-only lock (ADR 0006).

An audit trail that raw SQL can rewrite is worthless: this PostgreSQL
trigger raises on ANY UPDATE or DELETE against ``audit_auditlog``,
whatever the code path or connection. Reversible (drops trigger and
function). Row-level BEFORE triggers do not fire on TRUNCATE, so test
teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION audit_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refusé sur % (le journal d''audit est immuable).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_auditlog_append_only
BEFORE UPDATE OR DELETE ON audit_auditlog
FOR EACH ROW EXECUTE FUNCTION audit_forbid_mutation();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS audit_auditlog_append_only ON audit_auditlog;
DROP FUNCTION IF EXISTS audit_forbid_mutation();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
