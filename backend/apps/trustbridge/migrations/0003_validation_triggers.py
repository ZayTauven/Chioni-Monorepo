"""R1 + R3 — DB validation triggers (contre-vérification du guardian, ADR 0006).

The E1 (same-patient share) and M4 (frozen invoice) guards live in
``save()``/``bulk_create()``: a raw ``QuerySet.update()`` bypasses them.
These PostgreSQL triggers make both invariants hold whatever the code path:

- R1 ``trustbridge_paymentrequestshare`` (BEFORE INSERT OR UPDATE):
  a share must target a guardian link of the invoiced patient.
- R3 ``trustbridge_invoice`` (BEFORE UPDATE): outside DRAFT, ``total_kmf``
  and the encounter/center/patient anchors are frozen — only the status
  transition itself stays free.

Reversible: the reverse SQL drops the triggers and their functions.
RAISE messages are kept accent-free so error matching stays portable.
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION trustbridge_check_share_same_patient() RETURNS trigger AS $$
DECLARE
    invoiced_patient bigint;
    link_patient bigint;
BEGIN
    SELECT i.patient_id INTO invoiced_patient
    FROM trustbridge_paymentrequest pr
    JOIN trustbridge_invoice i ON i.id = pr.invoice_id
    WHERE pr.id = NEW.payment_request_id;

    SELECT gl.patient_id INTO link_patient
    FROM patients_guardianlink gl
    WHERE gl.id = NEW.guardian_link_id;

    IF invoiced_patient IS DISTINCT FROM link_patient THEN
        RAISE EXCEPTION 'Chioni confidentialite : un partage de demande de paiement doit viser un tuteur du patient facture (lien de tutelle patient %, facture patient %).',
            link_patient, invoiced_patient;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trustbridge_paymentrequestshare_same_patient
BEFORE INSERT OR UPDATE ON trustbridge_paymentrequestshare
FOR EACH ROW EXECUTE FUNCTION trustbridge_check_share_same_patient();

CREATE OR REPLACE FUNCTION trustbridge_check_invoice_frozen() RETURNS trigger AS $$
BEGIN
    IF OLD.status <> 'brouillon' AND (
        NEW.total_kmf IS DISTINCT FROM OLD.total_kmf
        OR NEW.encounter_id IS DISTINCT FROM OLD.encounter_id
        OR NEW.center_id IS DISTINCT FROM OLD.center_id
        OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
    ) THEN
        RAISE EXCEPTION 'Chioni : facture hors brouillon, montants et rattachements figes (seule la transition de statut reste possible) — facture %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trustbridge_invoice_frozen_outside_draft
BEFORE UPDATE ON trustbridge_invoice
FOR EACH ROW EXECUTE FUNCTION trustbridge_check_invoice_frozen();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS trustbridge_paymentrequestshare_same_patient ON trustbridge_paymentrequestshare;
DROP FUNCTION IF EXISTS trustbridge_check_share_same_patient();
DROP TRIGGER IF EXISTS trustbridge_invoice_frozen_outside_draft ON trustbridge_invoice;
DROP FUNCTION IF EXISTS trustbridge_check_invoice_frozen();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("trustbridge", "0002_append_only_triggers"),
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
