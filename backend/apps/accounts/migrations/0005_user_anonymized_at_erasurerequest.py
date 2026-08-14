"""S4 lot 3 — RGPD (ADR 0007 implemented by ADR 0017 décision 7).

Schema only, fully reversible, no data migration: one nullable column on
``User`` (the erasure tombstone date) and the ``ErasureRequest`` table
with its partial unique constraint (at most ONE open request per user —
patron of ``unique_active_consent_per_link_and_scope``).
"""

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_platformstaff'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='anonymized_at',
            field=models.DateTimeField(blank=True, help_text='Effacement RGPD exécuté (art. 17) : identité neutralisée, compte désactivé. La ligne reste pour la traçabilité financière — elle ne contient plus de donnée personnelle.', null=True, verbose_name='anonymisé le'),
        ),
        migrations.CreateModel(
            name='ErasureRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='créé le')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='mis à jour le')),
                ('requested_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='demandé le')),
                ('status', models.CharField(choices=[('en_attente', 'En attente'), ('traitee', 'Traitée'), ('refusee', 'Refusée')], default='en_attente', max_length=16, verbose_name='statut')),
                ('processed_at', models.DateTimeField(blank=True, null=True, verbose_name='traité le')),
                ('refusal_reason', models.TextField(blank=True, help_text="Obligatoire pour un refus. Rendu à la personne concernée (RGPD art. 12.4) — jamais dans un payload d'audit.", verbose_name='motif du refus')),
                ('processed_by', models.ForeignKey(blank=True, help_text='Exploitant Chioni (rôle « admin ») ayant tranché.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='erasure_requests_processed', to=settings.AUTH_USER_MODEL, verbose_name='traité par')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='erasure_requests', to=settings.AUTH_USER_MODEL, verbose_name='utilisateur')),
            ],
            options={
                'verbose_name': "demande d'effacement (RGPD)",
                'verbose_name_plural': "demandes d'effacement (RGPD)",
                'ordering': ['-requested_at', '-id'],
                'constraints': [models.UniqueConstraint(condition=models.Q(('status', 'en_attente')), fields=('user',), name='unique_open_erasure_request_per_user')],
            },
        ),
    ]
