"""SV — DB-level belt for the support thread (extension du socle ADR 0006).

MIROIR STRICT d'un invariant ORM existant — jamais un invariant nouveau :

- ``support_supportmessage`` (append-only) : le modèle hérite
  d'``AppendOnlyModel`` (ADR 0018 décision 5 — « un message envoyé ne se
  réécrit pas » : le fil est la trace de ce que chaque partie a dit, et une
  trace éditable n'est pas une trace). La base ferme désormais le SQL brut
  aussi.

Tables VOLONTAIREMENT sans trigger (consigné) :

- ``support_supportticket`` : mutable par conception — machine à états
  (``ouvert → en_cours → resolu → ferme``) pilotée par les services.
- ``support_supportattachment`` : PAS d'archivage définitif dans son
  ``save()`` (contrairement aux pièces KYC/congé/pharmacie) — sa seule
  garde (« une pièce reste attachée à son ticket ») demeure ORM-only,
  consignée telle quelle. Un miroir DB serait un invariant élargi, pas un
  miroir.

Réversible : le reverse droppe le trigger ET la fonction créée ici.
Row-level BEFORE triggers do not fire on TRUNCATE, so test-database
teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION support_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un message envoye ne se reecrit pas, on en poste un autre).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_supportmessage_append_only
BEFORE UPDATE OR DELETE ON support_supportmessage
FOR EACH ROW EXECUTE FUNCTION support_forbid_mutation();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS support_supportmessage_append_only ON support_supportmessage;
DROP FUNCTION IF EXISTS support_forbid_mutation();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("support", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
