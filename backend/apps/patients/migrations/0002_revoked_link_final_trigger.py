"""R2 — DB validation trigger (contre-vérification du guardian, ADR 0006).

The « REVOKED is final » rule (M2) lives in ``GuardianLink.save()``: a raw
``QuerySet.update()`` could flip a revoked link back to ACTIVE, restoring
the payments-scope floor without any re-consent. This PostgreSQL trigger
forbids ANY exit from the revoked status, whatever the code path.

Status value checked against the model enum: ``GuardianLink.Status.REVOKED
== "revoque"``. Reversible (drops trigger and function). RAISE message
kept accent-free so error matching stays portable.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION patients_check_link_revocation_final() RETURNS trigger AS $$
BEGIN
    IF OLD.status = 'revoque' AND NEW.status IS DISTINCT FROM 'revoque' THEN
        RAISE EXCEPTION 'Chioni : un lien de tutelle revoque est definitif — creer un nouveau lien (lien %).',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_guardianlink_revoked_final
BEFORE UPDATE ON patients_guardianlink
FOR EACH ROW EXECUTE FUNCTION patients_check_link_revocation_final();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS patients_guardianlink_revoked_final ON patients_guardianlink;
DROP FUNCTION IF EXISTS patients_check_link_revocation_final();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
