"""Relances (S10 lot 2 — ADR 0023, décisions 3 et 4).

**Une seule table**, et son nom dit exactement ce qu'elle est : la trace
d'un CONTACT sortant. Ce module s'appelle « CRM » par commodité de plan de
sprint, mais il ne fait ni segment, ni campagne, ni message libre — et
c'est ce qui le rend acceptable dans un produit de santé.

Ce que :class:`ContactLog` **n'a pas**, et pourquoi (les absences sont des
décisions, jamais des oublis — patron ``apps.equipment``) :

1. **Aucun champ de texte libre. Nulle part.** Pas de note d'appel, pas de
   commentaire, pas d'objet. Une note d'appel dans un dossier patient finit
   toujours par contenir de la donnée clinique (« tousse encore »,
   « rendez-vous VIH »), et ce module n'est gardé par AUCUN rôle clinique :
   la file des rendez-vous manqués est lue par tout le staff. Les issues
   fermées disent le nécessaire pour organiser un rappel. Un test d'absence
   de champ verrouille l'invariant (patron S8 « aucune valeur financière »).
2. **Aucun critère de ciblage.** Les deux seuls déclencheurs sont des FAITS
   D'EXPLOITATION — une facture émise dont le solde est positif, un
   rendez-vous passé au statut ``manque``. Aucun filtre par acte, par
   diagnostic, par ordonnance, par catégorie générique n'existe ici, donc
   aucune campagne « rappel de suivi » ne peut être écrite : dans une
   commune de deux mille habitants, elle désignerait ses destinataires
   (leçon ADR 0022 — anonymiser n'est pas dé-identifier).
3. **Aucun lien vers un tuteur.** ``recipient`` dit la FAMILLE du
   destinataire (« patient » / « tuteur »), jamais qui précisément. Une
   ligne = **une vague de relance**, pas un destinataire : deux proches
   partagés reçoivent le même message et cela reste UN contact, sans quoi
   la cadence dépendrait du nombre de proches, ce qui n'aurait aucun sens.
4. **Aucun statut, aucune date de clôture.** Un contact est un fait daté,
   pas un dossier. Ce qui dit où on en est, c'est le solde de la facture ou
   l'existence d'un nouveau rendez-vous.

**Append-only** (ORM : ``AppendOnlyModel`` + ``AppendOnlyQuerySet``) — un
contact se corrige par un nouveau contact. Dette assumée et consignée,
identique à S3/S5/S6/S7/S8 : **pas de trigger PostgreSQL** sur cette table.
Les triggers de l'ADR 0006 protègent l'argent (ledger, reçus, audit) ; un
``UPDATE`` brut resterait ici possible depuis un shell, et le pire qu'il
puisse faire est de fausser une cadence de relance.

Cloisonnement (ADR 0002) : la ligne porte son ``center``, et ``save()``
revérifie EN BASE que la facture et le rendez-vous référencés appartiennent
bien à ce centre ET à ce patient — jamais sur l'objet en mémoire (leçon S8).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.centers.models import CenterScopedQuerySet
from apps.common.models import AppendOnlyModel, AppendOnlyQuerySet


class ContactKind(models.TextChoices):
    """Les deux SEULS motifs de contact, et ils sont fermés.

    Déclarés au niveau du module (et non dans le corps du modèle) pour que
    les ``CheckConstraint`` de ``Meta`` puissent lire la liste — patron
    ``apps.equipment``. ``ContactLog.Kind`` reste l'alias public.
    """

    UNPAID_REMINDER = "relance_impaye", "Relance d'impayé"
    RECONTACT = "reprise_contact", "Reprise de contact (rendez-vous manqué)"


class ContactChannel(models.TextChoices):
    """Par où le contact est passé. ``sms`` est le seul canal AUTOMATIQUE ;
    ``appel`` et ``guichet`` sont des gestes humains journalisés à la main.

    Aucun autre canal n'existe (ni e-mail, ni WhatsApp — ADR 0023 « ce qui
    n'entre pas dans S10 »)."""

    SMS = "sms", "SMS"
    CALL = "appel", "Appel téléphonique"
    DESK = "guichet", "Au guichet"


class ContactRecipient(models.TextChoices):
    """La FAMILLE du destinataire — jamais son identité (voir §3 du module)."""

    PATIENT = "patient", "Le patient"
    GUARDIAN = "tuteur", "Un proche de confiance"


class ContactOutcome(models.TextChoices):
    """Issues FERMÉES d'un contact humain — la parade au texte libre.

    Un SMS automatique n'a pas d'issue (``NULL``) : personne n'était au
    bout du fil.
    """

    REACHED = "joint", "Joint"
    NO_ANSWER = "sans_reponse", "Sans réponse"
    PAYMENT_PROMISED = "promesse_de_reglement", "Promesse de règlement"
    CALL_BACK = "a_rappeler", "À rappeler"


class ContactLogQuerySet(CenterScopedQuerySet, AppendOnlyQuerySet):
    """Cloisonné par centre ET append-only au niveau du queryset.

    L'ordre des bases compte : ``CenterScopedQuerySet`` apporte
    ``for_center``, ``AppendOnlyQuerySet`` ferme ``update()``,
    ``delete()``, ``bulk_update()`` et le ``bulk_create(update_conflicts)``
    déguisé.
    """

    def for_patient(self, patient):
        return self.filter(patient=patient)


class ContactLog(AppendOnlyModel):
    """Un contact sortant, daté — append-only (ADR 0023 décision 4).

    Trois rôles, et c'est tout le lot :

    1. **C'est l'anti-doublon.** La cadence se calcule en COMPTANT les
       lignes existantes, relues sous le verrou de la facture (ou du
       rendez-vous) avant écriture. Le compteur non verrouillé de
       ``send_subscription_payment_reminders`` avait produit un double
       envoi réel en S5 ; ici il n'y a pas de compteur mutable du tout —
       ce qui compte, ce sont les lignes, et elles sont immuables.
    2. **C'est le « dernier contact »** des deux files de travail, sans
       champ mutable nulle part.
    3. **C'est la mémoire de l'équipe** : qui a déjà appelé, et ce que ça a
       donné (issues fermées).

    ``created_by`` **NULL = l'automate**. C'est la seule lecture de ce
    champ, et elle est explicite : une ligne sans acteur est un SMS parti
    tout seul.
    """

    #: Alias publics — le reste du produit écrit ``ContactLog.Kind.…``.
    Kind = ContactKind
    Channel = ContactChannel
    Recipient = ContactRecipient
    Outcome = ContactOutcome

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="contact_logs",
    )
    patient = models.ForeignKey(
        "patients.PatientProfile",
        verbose_name="patient concerné",
        on_delete=models.PROTECT,
        related_name="contact_logs",
        help_text=(
            "Le patient dont il est question — pas nécessairement le "
            "destinataire (voir « recipient »)."
        ),
    )
    kind = models.CharField("motif", max_length=24, choices=ContactKind.choices)
    channel = models.CharField("canal", max_length=8, choices=ContactChannel.choices)
    recipient = models.CharField(
        "destinataire", max_length=8, choices=ContactRecipient.choices
    )
    invoice = models.ForeignKey(
        "trustbridge.Invoice",
        verbose_name="facture",
        on_delete=models.PROTECT,
        related_name="contact_logs",
        null=True,
        blank=True,
        help_text="Obligatoire pour une relance d'impayé, interdite sinon.",
    )
    appointment = models.ForeignKey(
        "scheduling.Appointment",
        verbose_name="rendez-vous",
        on_delete=models.PROTECT,
        related_name="contact_logs",
        null=True,
        blank=True,
        help_text="Obligatoire pour une reprise de contact, interdit sinon.",
    )
    outcome = models.CharField(
        "issue",
        max_length=24,
        choices=ContactOutcome.choices,
        blank=True,
        help_text="Vide pour un envoi automatique : personne n'était au bout du fil.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="contact effectué par",
        on_delete=models.PROTECT,
        related_name="contact_logs_made",
        null=True,
        blank=True,
        help_text="NULL = l'automate (tâche planifiée).",
    )

    objects = ContactLogQuerySet.as_manager()

    class Meta:
        verbose_name = "trace de contact"
        verbose_name_plural = "traces de contact"
        ordering = ["-created_at", "-id"]
        constraints = [
            # Ce qui EST exprimable en base l'est (règle d'ingénierie du
            # projet) : les quatre listes fermées, et l'appariement
            # motif ↔ objet référencé.
            models.CheckConstraint(
                condition=models.Q(kind__in=ContactKind.values),
                name="contact_log_kind_is_closed",
            ),
            models.CheckConstraint(
                condition=models.Q(channel__in=ContactChannel.values),
                name="contact_log_channel_is_closed",
            ),
            models.CheckConstraint(
                condition=models.Q(recipient__in=ContactRecipient.values),
                name="contact_log_recipient_is_closed",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(outcome="")
                    | models.Q(outcome__in=ContactOutcome.values)
                ),
                name="contact_log_outcome_is_closed",
            ),
            # Une relance d'impayé porte SA facture ; une reprise de contact
            # porte SON rendez-vous. Jamais l'un pour l'autre, jamais les
            # deux, jamais aucun : sans cet appariement le journal se
            # remplirait de lignes flottantes qu'aucune file de travail ne
            # sait rattacher, et la cadence perdrait son ancrage.
            models.CheckConstraint(
                condition=(
                    models.Q(
                        kind=ContactKind.UNPAID_REMINDER,
                        invoice__isnull=False,
                        appointment__isnull=True,
                    )
                    | models.Q(
                        kind=ContactKind.RECONTACT,
                        appointment__isnull=False,
                        invoice__isnull=True,
                    )
                ),
                name="contact_log_reference_matches_kind",
            ),
        ]
        indexes = [
            # L'anti-doublon et le « dernier contact » des deux files.
            models.Index(fields=["invoice", "kind"]),
            models.Index(fields=["appointment", "kind"]),
            models.Index(fields=["center", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} — patient #{self.patient_id}"

    def save(self, *args, **kwargs):
        # Invariants STRUCTURELS, rejoués sur TOUT chemin d'écriture (règle
        # d'ingénierie CLAUDE.md) : les services ne sont pas la seule garde.
        #
        # Les rattachements sont relus EN BASE et jamais sur l'objet en
        # mémoire (leçon S8) : une vue charge la facture, puis écrit ; une
        # instance en cache dirait « ce centre » d'une facture qui a changé
        # de main entre-temps. Pas de ``select_for_update`` ici : ``save()``
        # est appelable hors transaction (factories, imports), où il
        # lèverait — la sérialisation qui compte est celle du service, qui
        # verrouille déjà la facture ou le rendez-vous.
        # Imports LOCAUX (patron ``merge_profiles``) : ``crm`` reste une
        # feuille du graphe de dépendances — il connaît la facture et le
        # rendez-vous par des références en chaîne, jamais par un import de
        # module au chargement.
        if self.invoice_id is not None:
            from apps.trustbridge.models import Invoice

            self._check_anchor(
                Invoice, self.invoice_id, "Cette facture", "ne concerne pas"
            )
        if self.appointment_id is not None:
            from apps.scheduling.models import Appointment

            self._check_anchor(
                Appointment, self.appointment_id, "Ce rendez-vous", "ne concerne pas"
            )
        super().save(*args, **kwargs)

    def _check_anchor(self, model, pk, label, verb):
        anchor = (
            model.objects.filter(pk=pk).values("center_id", "patient_id").first()
        )
        if anchor is None or anchor["center_id"] != self.center_id:
            raise ValidationError(f"{label} n'appartient pas à ce centre.")
        if anchor["patient_id"] != self.patient_id:
            raise ValidationError(f"{label} {verb} ce patient.")
