"""SV — extension du socle ADR 0006 : l'issue d'une demande d'effacement
est DÉFINITIVE aussi pour le SQL brut.

Miroir de l'invariant de service (``process_erasure_request`` /
``cancel_erasure_request`` refusent toute demande qui n'est plus
``en_attente``) : une fois le statut sorti de ``en_attente`` (``traitee``,
``refusee`` ou ``annulee``), il ne change plus — un ``UPDATE`` brut ne peut
pas rouvrir ni requalifier une décision RGPD. Les autres colonnes restent
libres (miroir exact, aucun invariant nouveau).

Réversible (``DROP TRIGGER`` + ``DROP FUNCTION``). Row-level BEFORE
triggers do not fire on TRUNCATE — les teardowns de test sont inaffectés.
Message sans accents (matching portable dans les tests).
"""

from django.db import migrations

CREATE_SQL = """
CREATE OR REPLACE FUNCTION accounts_check_erasure_terminal() RETURNS trigger AS $$
BEGIN
    IF OLD.status <> 'en_attente' AND NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Chioni : une demande d''effacement tranchee ou annulee est definitive — demande %.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_erasurerequest_terminal_final
BEFORE UPDATE ON accounts_erasurerequest
FOR EACH ROW EXECUTE FUNCTION accounts_check_erasure_terminal();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS accounts_erasurerequest_terminal_final ON accounts_erasurerequest;
DROP FUNCTION IF EXISTS accounts_check_erasure_terminal();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_alter_erasurerequest_status"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE_SQL, reverse_sql=DROP_SQL),
    ]
