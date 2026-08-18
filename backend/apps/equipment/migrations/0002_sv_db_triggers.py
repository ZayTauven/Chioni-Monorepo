"""SV — DB-level belt for the equipment register (socle ADR 0006).

Solde la vigilance consignée en S8 (« un UPDATE brut pourrait ressusciter
un équipement réformé »). Chaque trigger est le MIROIR STRICT d'un
invariant ORM existant — jamais un invariant nouveau :

- ``equipment_equipmentreport`` (append-only) : hérite d'``AppendOnlyModel``
  (ADR 0021 — un signalement est un constat daté qui se corrige par un
  nouveau signalement). La base ferme désormais le SQL brut aussi.
- ``equipment_equipment`` : réforme DÉFINITIVE, miroir de
  ``Equipment.save()`` — une fois ``status = 'reforme'``
  (``Status.DECOMMISSIONED``), le statut ne change plus. Les AUTRES champs
  restent LIBRES (miroir exact : corriger la fiche d'un équipement réformé
  — emplacement, notes — est permis par l'ORM).

Le reste du modèle ``Equipment`` (nom, catégorie, listes fermées) est déjà
tenu par ses ``CheckConstraint`` — rien à dupliquer ici.

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents (« reforme », « definitive ») ; le message
append-only contient « append-only ». Row-level BEFORE triggers do not
fire on TRUNCATE, so test-database teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION equipment_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un signalement se corrige par un nouveau signalement).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_equipmentreport_append_only
BEFORE UPDATE OR DELETE ON equipment_equipmentreport
FOR EACH ROW EXECUTE FUNCTION equipment_forbid_mutation();

CREATE OR REPLACE FUNCTION equipment_check_decommission_final() RETURNS trigger AS $$
BEGIN
    IF OLD.status = 'reforme' AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Chioni : un equipement reforme ne revient pas en service, la reforme est definitive — equipement %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_equipment_decommission_final
BEFORE UPDATE ON equipment_equipment
FOR EACH ROW EXECUTE FUNCTION equipment_check_decommission_final();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS equipment_equipmentreport_append_only ON equipment_equipmentreport;
DROP TRIGGER IF EXISTS equipment_equipment_decommission_final ON equipment_equipment;
DROP FUNCTION IF EXISTS equipment_forbid_mutation();
DROP FUNCTION IF EXISTS equipment_check_decommission_final();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("equipment", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
