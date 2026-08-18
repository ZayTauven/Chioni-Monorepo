"""SV.1.2 (arbitrage PO S2, 14/08/2026) — le mode `oral` disparaît du
consentement clinique guichet : papier signé obligatoire (trace opposable).

Migration de données DÉFENSIVE : tout consentement `oral` encore ACTIF au
moment de la migration est RÉVOQUÉ, avec une entrée d'AuditLog par ligne —
jamais requalifié en silence (un consentement recueilli oralement n'a pas la
trace opposable que l'arbitrage exige ; le requalifier en `papier` serait un
mensonge, le laisser actif ignorerait l'arbitrage). L'historique reste
lisible : le choix `oral` demeure sur le modèle, seule l'ENTRÉE le refuse
(serializer + service).

Le reverse est un no-op assumé : une révocation de consentement ne se
rejoue pas à l'envers (aucun code ne sait si la personne consentirait
encore), et l'AuditLog est append-only — la migration est réversible au
sens de Django (elle se déroule), pas au sens du consentement.
"""

from django.db import migrations
from django.utils import timezone


def _revoke_oral_desk_consents(apps, schema_editor):
    Consent = apps.get_model("medical", "Consent")
    AuditLog = apps.get_model("audit", "AuditLog")
    ContentType = apps.get_model("contenttypes", "ContentType")

    oral_active = Consent.objects.filter(
        collected_via="oral", revoked_at__isnull=True
    )
    now = timezone.now()
    consent_ct = None
    for consent in oral_active.iterator():
        if consent_ct is None:
            # Lazy: on a fresh database this loop never runs, and the
            # contenttypes row for Consent may not exist yet during the
            # initial migrate.
            consent_ct = ContentType.objects.filter(
                app_label="medical", model="consent"
            ).first()
        Consent.objects.filter(pk=consent.pk).update(revoked_at=now)
        AuditLog.objects.create(
            actor=None,  # action système (migration), comme les webhooks
            action="consent.revoked",
            content_type=consent_ct,
            object_id=str(consent.pk),
            payload={
                "consent_id": consent.pk,
                "link_id": consent.guardian_link_id,
                "patient_id": consent.patient_id,
                "scope": consent.scope,
                "reason": "collected_via_oral_retired_sv12",
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("medical", "0004_prescription_delivered_at_prescription_delivered_by"),
        ("audit", "0003_audit_log_center"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(
            _revoke_oral_desk_consents, migrations.RunPython.noop
        ),
    ]
