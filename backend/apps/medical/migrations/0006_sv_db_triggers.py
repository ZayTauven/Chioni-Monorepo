"""SV — DB-level belt for the enriched carnet (extension du socle ADR 0006).

Chaque trigger est le MIROIR STRICT d'un invariant ORM/service existant —
jamais un invariant nouveau :

- ``medical_vitalsigns`` (append-only) : aucune route ni aucun service ne
  modifie ou ne supprime un relevé — l'ORM est append-only DE FAIT depuis
  S3 ; la base le verrouille désormais quel que soit le chemin (SQL brut,
  autre connexion, bug futur).
- ``medical_patientdocument`` : (a) jamais de DELETE — un document médical
  s'archive, il ne se supprime pas (ADR 0002/0016) ; (b) l'archivage est
  DÉFINITIF, miroir de ``PatientDocument.save()`` (« Un document archivé le
  reste »). Les AUTRES champs restent volontairement libres : la fusion de
  doublons ré-ancre ``patient_id`` légitimement (``merge_profiles``).
- ``medical_prescription`` : la délivrance est DÉFINITIVE, miroir de
  ``Prescription.save()`` — une fois ``status = 'delivree'``
  (``Prescription.Status.DELIVERED``), le statut ne change plus. Les autres
  champs suivent le contrat ORM (seul le statut est gelé).

Tables VOLONTAIREMENT sans trigger (mutables par conception, consigné) :
``medical_patientmedicalfile`` (OneToOne mutable, PUT exposé — la fiche se
corrige) et ``patients_patientinsurance`` (app patients — ligne
administrative mutable, aucune garde ``save()``).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents pour un matching portable ; le message
append-only contient « append-only » (contrat des tests). Row-level BEFORE
triggers do not fire on TRUNCATE, so test-database teardown/flush is
unaffected.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION medical_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un releve clinique se corrige par un nouveau releve).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_vitalsigns_append_only
BEFORE UPDATE OR DELETE ON medical_vitalsigns
FOR EACH ROW EXECUTE FUNCTION medical_forbid_mutation();

CREATE OR REPLACE FUNCTION medical_forbid_document_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni : DELETE refuse sur % (un document medical ne se supprime jamais, il s''archive) — document %.',
        TG_TABLE_NAME, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_patientdocument_no_delete
BEFORE DELETE ON medical_patientdocument
FOR EACH ROW EXECUTE FUNCTION medical_forbid_document_delete();

CREATE OR REPLACE FUNCTION medical_check_document_archive_final() RETURNS trigger AS $$
BEGIN
    IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
        RAISE EXCEPTION 'Chioni : un document archive le reste, l''archivage est definitif — document %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_patientdocument_archive_final
BEFORE UPDATE ON medical_patientdocument
FOR EACH ROW EXECUTE FUNCTION medical_check_document_archive_final();

CREATE OR REPLACE FUNCTION medical_check_prescription_delivery_final() RETURNS trigger AS $$
BEGIN
    IF OLD.status = 'delivree' AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Chioni : une ordonnance delivree le reste, la delivrance est definitive — ordonnance %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_prescription_delivery_final
BEFORE UPDATE ON medical_prescription
FOR EACH ROW EXECUTE FUNCTION medical_check_prescription_delivery_final();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS medical_vitalsigns_append_only ON medical_vitalsigns;
DROP TRIGGER IF EXISTS medical_patientdocument_no_delete ON medical_patientdocument;
DROP TRIGGER IF EXISTS medical_patientdocument_archive_final ON medical_patientdocument;
DROP TRIGGER IF EXISTS medical_prescription_delivery_final ON medical_prescription;
DROP FUNCTION IF EXISTS medical_forbid_mutation();
DROP FUNCTION IF EXISTS medical_forbid_document_delete();
DROP FUNCTION IF EXISTS medical_check_document_archive_final();
DROP FUNCTION IF EXISTS medical_check_prescription_delivery_final();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("medical", "0005_revoke_oral_desk_consents"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
