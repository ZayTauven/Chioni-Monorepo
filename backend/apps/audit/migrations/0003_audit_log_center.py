"""S4 (ADR 0017, décision 5) — the audit log learns which TENANT it is about.

Schema only, and small on purpose. **No data migration back-fills the
existing rows**: ``audit_auditlog`` is append-only at ORM level AND behind
a PostgreSQL trigger (ADR 0006, migration 0002) that raises on ANY UPDATE,
whatever the connection. Rewriting history so an API can list it would be
exactly what that ADR forbids — and the migration would simply fail.

Consequence, assumed and surfaced by the API (``journal_starts_at``): the
director's journal starts at the first entry written AFTER this migration.
Entries older than S4 keep ``center = NULL`` forever, alongside the
transverse actions (authentication, guardianship, doors A/B) that legitimately
belong to no center. Reversible: the reverse drops the index and the column.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0002_append_only_triggers'),
        ('centers', '0005_kyc_file_and_documents'),
        ('contenttypes', '0002_remove_content_type_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='center',
            field=models.ForeignKey(blank=True, help_text="Centre concerné par l'action, quand elle en concerne un. Vide pour les actions transverses (authentification, tutelle, profils patients hors guichet).", null=True, on_delete=django.db.models.deletion.PROTECT, related_name='audit_logs', to='centers.healthcenter', verbose_name='centre'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['center', 'created_at'], name='audit_audit_center__4ef46d_idx'),
        ),
    ]
