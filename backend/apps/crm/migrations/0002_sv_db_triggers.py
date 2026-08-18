"""SV — DB-level belt for the contact log (extension du socle ADR 0006).

Solde la dette consignée dans la docstring de ``apps/crm/models.py``
(« pas de trigger PostgreSQL sur cette table »). MIROIR STRICT d'un
invariant ORM existant — jamais un invariant nouveau :

- ``crm_contactlog`` (append-only) : le modèle hérite d'``AppendOnlyModel``
  (ADR 0023 décision 4 — un contact se corrige par un nouveau contact ; la
  cadence de relance se calcule en COMPTANT des lignes immuables, un
  ``UPDATE`` brut pouvait la fausser depuis un shell). La base ferme
  désormais ce chemin aussi.

Table VOLONTAIREMENT sans trigger (mutable par conception, consigné) :
``patients_patientcontactpreference`` (app patients) — une préférence de
contact se modifie, c'est son objet.

Réversible : le reverse droppe le trigger ET la fonction créée ici.
Row-level BEFORE triggers do not fire on TRUNCATE, so test-database
teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION crm_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un contact se corrige par un nouveau contact).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_contactlog_append_only
BEFORE UPDATE OR DELETE ON crm_contactlog
FOR EACH ROW EXECUTE FUNCTION crm_forbid_mutation();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS crm_contactlog_append_only ON crm_contactlog;
DROP FUNCTION IF EXISTS crm_forbid_mutation();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
