"""SV — DB-level belt for the inpatient module (extension du socle ADR 0006).

Chaque trigger est le MIROIR STRICT d'un invariant ORM existant — jamais un
invariant nouveau :

- ``inpatient_staydaybilling`` (append-only) : hérite d'``AppendOnlyModel``
  (correctif PO du 15/08/2026 — le lot d'idempotence est de la même famille
  que le ledger : un geste de facturation ne s'édite pas, il se corrige par
  l'annulation de la facture).
- ``inpatient_stay`` : états terminaux DÉFINITIFS, miroir de ``Stay.save()``
  — une fois ``status`` ∈ {'sortie', 'annule'} (``Status.DISCHARGED`` /
  ``Status.CANCELLED``), le statut ne change plus. Les AUTRES champs
  restent modifiables (miroir exact : l'ORM ne gèle qu'eux).
- ``inpatient_bedassignment`` : (a) ``stay_id``/``bed_id``/``assigned_at``
  gelés (miroir de ``BedAssignment.save()`` — « l'historique d'occupation
  d'un lit ne se réécrit pas ») ; (b) ``released_at`` posé UNE SEULE FOIS —
  l'ORM a été aligné dans ce lot (il n'interdisait que non-null → NULL ;
  re-dater une libération réécrivait l'historique tout autant).

Tables VOLONTAIREMENT sans trigger (mutables par conception, consigné) :
``inpatient_room`` / ``inpatient_bed`` (libellés et activation) ; les
tables de liaison M2M ``inpatient_stay_attending`` (les médecins assignés
se RÉASSIGNENT — ``set()`` supprime et réinsère, c'est le contrat) et
``inpatient_staydaybilling_acts`` (peuplée à la création du lot).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents (« definitive », « reecrit ») ; le message
append-only contient « append-only ». Row-level BEFORE triggers do not
fire on TRUNCATE, so test-database teardown/flush is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION inpatient_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un geste de facturation ne s''edite pas, il se corrige par la facture).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inpatient_staydaybilling_append_only
BEFORE UPDATE OR DELETE ON inpatient_staydaybilling
FOR EACH ROW EXECUTE FUNCTION inpatient_forbid_mutation();

CREATE OR REPLACE FUNCTION inpatient_check_stay_terminal_final() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('sortie', 'annule') AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Chioni : un sejour clos ne change plus d''etat, l''etat terminal est definitif — sejour %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inpatient_stay_terminal_final
BEFORE UPDATE ON inpatient_stay
FOR EACH ROW EXECUTE FUNCTION inpatient_check_stay_terminal_final();

CREATE OR REPLACE FUNCTION inpatient_check_bedassignment_frozen() RETURNS trigger AS $$
BEGIN
    IF NEW.stay_id IS DISTINCT FROM OLD.stay_id
        OR NEW.bed_id IS DISTINCT FROM OLD.bed_id
        OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
    THEN
        RAISE EXCEPTION 'Chioni : l''historique d''occupation d''un lit ne se reecrit pas (liberez l''occupation et ouvrez-en une autre) — occupation %.',
            OLD.id;
    END IF;
    IF OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at THEN
        RAISE EXCEPTION 'Chioni : une occupation liberee le reste, la liberation est definitive — occupation %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inpatient_bedassignment_history_frozen
BEFORE UPDATE ON inpatient_bedassignment
FOR EACH ROW EXECUTE FUNCTION inpatient_check_bedassignment_frozen();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS inpatient_staydaybilling_append_only ON inpatient_staydaybilling;
DROP TRIGGER IF EXISTS inpatient_stay_terminal_final ON inpatient_stay;
DROP TRIGGER IF EXISTS inpatient_bedassignment_history_frozen ON inpatient_bedassignment;
DROP FUNCTION IF EXISTS inpatient_forbid_mutation();
DROP FUNCTION IF EXISTS inpatient_check_stay_terminal_final();
DROP FUNCTION IF EXISTS inpatient_check_bedassignment_frozen();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("inpatient", "0002_staydaybilling"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
