"""SV — DB-level belt for the HRM register (extension du socle ADR 0006).

Chaque trigger est le MIROIR STRICT d'un invariant ORM/service existant —
jamais un invariant nouveau :

- ``hrm_leaverequest`` : décision GELÉE, miroir de ``LeaveRequest.save()``
  et de la machine ``LEAVE_TRANSITIONS`` — une fois ``status`` ≠ 'demande'
  (``Status.REQUESTED``), ni le statut ni la décision
  (``decided_at``/``decided_by``) ne bougent plus. Les DATES du congé
  restent LIBRES au niveau base : c'est le reliquat assumé de l'ADR 0020
  (addendum 3, sonde exécutable dans ``test_adversarial_s7.py``) — le
  geler ici serait un invariant nouveau, pas un miroir.
- ``hrm_leavedocument`` : (a) jamais de DELETE — même la purge RGPD
  (``purge_leave_documents_of``) efface les OCTETS et GARDE la ligne ;
  (b) l'archivage est DÉFINITIF, miroir de ``LeaveDocument.save()``. Le
  champ ``file`` reste volontairement LIBRE : la purge RGPD fait un UPDATE
  légitime de ce champ (fichier vidé, ligne conservée) — le trigger ne
  doit JAMAIS la bloquer (prouvé par test).

Tables VOLONTAIREMENT sans trigger (mutables par conception, consigné) :
``hrm_department`` / ``hrm_jobtitle`` (libellés d'organisation),
``hrm_holiday`` (calendrier du centre), ``hrm_attendancerecord`` (« la
feuille se corrige, elle ne s'empile pas » — ADR 0020 décision 3) et
``hrm_employment`` (le dossier RH évolue : service, fonction, départ).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents (« definitive », « definitif »). Row-level
BEFORE triggers do not fire on TRUNCATE, so test-database teardown/flush
is unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION hrm_check_leave_decision_final() RETURNS trigger AS $$
BEGIN
    IF OLD.status <> 'demande' AND (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
        OR NEW.decided_by_id IS DISTINCT FROM OLD.decided_by_id
    ) THEN
        RAISE EXCEPTION 'Chioni : cette demande de conge est close, la decision est definitive — demande %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hrm_leaverequest_decision_final
BEFORE UPDATE ON hrm_leaverequest
FOR EACH ROW EXECUTE FUNCTION hrm_check_leave_decision_final();

CREATE OR REPLACE FUNCTION hrm_forbid_leavedocument_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni : DELETE refuse sur % (un justificatif ne se supprime jamais ; la purge RGPD efface les octets et garde la ligne) — justificatif %.',
        TG_TABLE_NAME, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hrm_leavedocument_no_delete
BEFORE DELETE ON hrm_leavedocument
FOR EACH ROW EXECUTE FUNCTION hrm_forbid_leavedocument_delete();

CREATE OR REPLACE FUNCTION hrm_check_leavedocument_archive_final() RETURNS trigger AS $$
BEGIN
    IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
        RAISE EXCEPTION 'Chioni : un justificatif archive le reste, l''archivage est definitif — justificatif %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hrm_leavedocument_archive_final
BEFORE UPDATE ON hrm_leavedocument
FOR EACH ROW EXECUTE FUNCTION hrm_check_leavedocument_archive_final();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS hrm_leaverequest_decision_final ON hrm_leaverequest;
DROP TRIGGER IF EXISTS hrm_leavedocument_no_delete ON hrm_leavedocument;
DROP TRIGGER IF EXISTS hrm_leavedocument_archive_final ON hrm_leavedocument;
DROP FUNCTION IF EXISTS hrm_check_leave_decision_final();
DROP FUNCTION IF EXISTS hrm_forbid_leavedocument_delete();
DROP FUNCTION IF EXISTS hrm_check_leavedocument_archive_final();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("hrm", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
