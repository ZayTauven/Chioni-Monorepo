"""SV — DB-level belt for the SaaS registry (extension du socle ADR 0006).

Chaque trigger est le MIROIR STRICT d'un invariant ORM existant — jamais un
invariant nouveau :

- ``billing_subscriptionpayment`` / ``billing_subscriptionpaymentreversal``
  (append-only) : les deux modèles héritent d'``AppendOnlyModel``
  (ADR 0018 — un règlement se corrige par contre-passation, jamais par
  réécriture) ; la base ferme désormais le SQL brut aussi.
- ``billing_subscriptioninvoice`` : champs gelés INCONDITIONNELLEMENT —
  il n'y a pas d'état brouillon, une facture d'abonnement naît « emise ».
  Miroir exact de ``SubscriptionInvoice._FROZEN_FIELDS`` : ``center_id``,
  ``subscription_id``, ``sequence_number``, ``period_start``,
  ``period_end``, ``amount_kmf``, ``plan_code``, ``plan_label``,
  ``due_date``. Restent LIBRES (comme à l'ORM) : ``status``, la piste
  d'annulation (``cancelled_at``/``cancelled_by``/``cancel_reason``),
  ``issued_by``, la comptabilité des relances (``reminders_sent``,
  ``last_reminder_at``) et ``updated_at``.

Tables VOLONTAIREMENT sans trigger (mutables par conception, consigné) :
``billing_subscriptionplan`` (une offre se reprice pour l'avenir),
``billing_centersubscription`` (machine à états pilotée par les services)
et ``billing_subscriptioninvoicecounter`` (ligne compteur, verrouillée par
``SELECT … FOR UPDATE`` à l'émission).

Réversible : le reverse droppe les triggers ET les fonctions créées ici.
Messages RAISE sans accents (« figes ») pour un matching portable ; le
message append-only contient « append-only ». Row-level BEFORE triggers do
not fire on TRUNCATE, so test-database teardown/flush is unaffected.
"""

from django.db import migrations

APPEND_ONLY_TABLES = (
    "billing_subscriptionpayment",
    "billing_subscriptionpaymentreversal",
)

CREATE_SQL = """
CREATE OR REPLACE FUNCTION billing_forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Chioni append-only : % refuse sur % (un reglement se corrige par contre-passation, jamais par reecriture).',
        TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
""" + "\n".join(
    f"""
CREATE TRIGGER {table}_append_only
BEFORE UPDATE OR DELETE ON {table}
FOR EACH ROW EXECUTE FUNCTION billing_forbid_mutation();
"""
    for table in APPEND_ONLY_TABLES
) + """
CREATE OR REPLACE FUNCTION billing_check_subscription_invoice_frozen() RETURNS trigger AS $$
BEGIN
    IF NEW.center_id IS DISTINCT FROM OLD.center_id
        OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
        OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
        OR NEW.period_start IS DISTINCT FROM OLD.period_start
        OR NEW.period_end IS DISTINCT FROM OLD.period_end
        OR NEW.amount_kmf IS DISTINCT FROM OLD.amount_kmf
        OR NEW.plan_code IS DISTINCT FROM OLD.plan_code
        OR NEW.plan_label IS DISTINCT FROM OLD.plan_label
        OR NEW.due_date IS DISTINCT FROM OLD.due_date
    THEN
        RAISE EXCEPTION 'Chioni : facture d''abonnement emise, montant, periode, numero et rattachements figes (seuls le workflow et les relances bougent) — facture %.',
            OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_subscriptioninvoice_frozen
BEFORE UPDATE ON billing_subscriptioninvoice
FOR EACH ROW EXECUTE FUNCTION billing_check_subscription_invoice_frozen();
"""

DROP_SQL = "\n".join(
    f"DROP TRIGGER IF EXISTS {table}_append_only ON {table};"
    for table in APPEND_ONLY_TABLES
) + """
DROP TRIGGER IF EXISTS billing_subscriptioninvoice_frozen ON billing_subscriptioninvoice;
DROP FUNCTION IF EXISTS billing_forbid_mutation();
DROP FUNCTION IF EXISTS billing_check_subscription_invoice_frozen();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0002_saas_invoicing"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
