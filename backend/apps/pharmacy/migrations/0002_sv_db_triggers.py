"""SV — DB-level belt for the pharmacy network (extension du socle ADR 0006).

Solde le reliquat consigné en S9 (« aucun trigger PostgreSQL sur les 8
tables »). Chaque trigger est le MIROIR STRICT d'un invariant ORM existant
— jamais un invariant nouveau :

- ``pharmacy_availabilityrequestitem`` / ``pharmacy_availabilityrequestrecipient``
  / ``pharmacy_availabilityresponse`` / ``pharmacy_availabilityresponseline``
  (append-only) : les quatre héritent d'``AppendOnlyModel`` (ADR 0022 —
  la ligne partie au réseau est une COPIE figée, la diffusion est gelée à
  l'envoi, une réponse est un constat daté qui se corrige par une NOUVELLE
  réponse). La base ferme désormais le SQL brut aussi.
- ``pharmacy_pharmacydocument`` : (a) jamais de DELETE — une décision de
  validation doit rester auditable contre les pièces qui l'ont fondée ;
  (b) l'archivage est DÉFINITIF, miroir de ``PharmacyDocument.save()``.

Tables VOLONTAIREMENT sans trigger (mutables par conception, consigné) :
``pharmacy_pharmacy`` et ``pharmacy_pharmacymembership`` (annuaire et
appartenance, machine à états dans les services) et
``pharmacy_availabilityrequest`` (cycle ouverte → close piloté par les
services et le beat de péremption).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents ; le message append-only contient
« append-only ». Row-level BEFORE triggers do not fire on TRUNCATE, so
test-database teardown/flush is unaffected.
"""

from django.db import migrations

APPEND_ONLY_TABLES = (
    "pharmacy_availabilityrequestitem",
    "pharmacy_availabilityrequestrecipient",
    "pharmacy_availabilityresponse",
    "pharmacy_availabilityresponseline",
)

CREATE_SQL = """
CREATE OR REPLACE FUNCTION pharmacy_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un constat ne se reecrit pas, on en pose un suivant).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""
CREATE TRIGGER {table}_append_only
BEFORE UPDATE OR DELETE ON {table}
FOR EACH ROW EXECUTE FUNCTION pharmacy_forbid_mutation();
"""
    for table in APPEND_ONLY_TABLES
) + """
CREATE OR REPLACE FUNCTION pharmacy_forbid_document_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni : DELETE refuse sur % (une piece ne se supprime jamais, elle s''archive) — piece %.',
        TG_TABLE_NAME, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pharmacy_pharmacydocument_no_delete
BEFORE DELETE ON pharmacy_pharmacydocument
FOR EACH ROW EXECUTE FUNCTION pharmacy_forbid_document_delete();

CREATE OR REPLACE FUNCTION pharmacy_check_document_archive_final() RETURNS trigger AS $$
BEGIN
    IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
        RAISE EXCEPTION 'Chioni : une piece archivee le reste, l''archivage est definitif — piece %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pharmacy_pharmacydocument_archive_final
BEFORE UPDATE ON pharmacy_pharmacydocument
FOR EACH ROW EXECUTE FUNCTION pharmacy_check_document_archive_final();
"""

DROP_SQL = "\n".join(
    f"DROP TRIGGER IF EXISTS {table}_append_only ON {table};"
    for table in APPEND_ONLY_TABLES
) + """
DROP TRIGGER IF EXISTS pharmacy_pharmacydocument_no_delete ON pharmacy_pharmacydocument;
DROP TRIGGER IF EXISTS pharmacy_pharmacydocument_archive_final ON pharmacy_pharmacydocument;
DROP FUNCTION IF EXISTS pharmacy_forbid_mutation();
DROP FUNCTION IF EXISTS pharmacy_forbid_document_delete();
DROP FUNCTION IF EXISTS pharmacy_check_document_archive_final();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
