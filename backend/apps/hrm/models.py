"""HRM: services, fonctions, présence, congés (S7 — ADR 0020).

C'est le premier module de Chioni dont l'objet **est un salarié**. La ligne
n° 1 du produit — « aider mieux, jamais surveiller ; la dignité de TOUS les
acteurs est une contrainte de conception » — cesse ici d'être une formule
sur les patients, et chaque table ci-dessous est écrite avec ce que le
registre papier d'un centre comorien contient déjà : **rien de plus**.

Sept tables, et la raison d'être de chacune :

- :class:`Employment` — **LE pivot du module** (ADR 0020, décision 1).
  ``StaffMembership`` est unique par **(user, center, rôle)** : un médecin
  qui est aussi directeur a DEUX lignes actives dans le même centre. Un
  module de présence ancré dessus compterait deux fois la même personne,
  lui donnerait deux feuilles et deux soldes de congés. ``Employment`` est
  unique par **(user, center)** : c'est la personne au travail, là où le
  membership est une casquette de permissions. Un emploi **survit** à la
  désactivation de tous les accès (une personne partie garde son registre),
  et c'est voulu.
- :class:`Department` / :class:`JobTitle` — des LIBELLÉS d'organisation
  propres au centre (décision 2). **Ils ne donnent aucune permission et ne
  sont lus par aucune classe de permission** : le rôle
  (``StaffMembership.Role``) reste la seule source de droits. Confondre les
  deux créerait un second système d'autorisations à côté du premier, et
  c'est ainsi qu'un jour quelqu'un lit un dossier médical parce que sa
  fiche de poste dit « soignant ». Un test structurel (``test_hrm.py``)
  refuse tout import de ces deux modèles hors de ``apps.hrm``.
- :class:`AttendanceRecord` — la feuille du responsable (décision 3). On
  numérise le registre papier existant, **rien d'autre**.
- :class:`LeaveRequest` — des types FERMÉS, **aucun motif en texte libre**
  (décision 4).
- :class:`LeaveDocument` — le justificatif, et c'est un **fichier privé**,
  jamais une phrase : pipeline ADR 0014 + ``PrivateMediaStorage`` +
  endpoint authentifié + archivage définitif, clonés des pièces KYC
  (ADR 0017), pas réinventés.
- :class:`Holiday` — le calendrier des fériés **appartient au centre**
  (décision 5) : les fériés comoriens sont nationaux, mais une clinique
  privée peut travailler un 14 août.

Ce que ces tables **n'ont pas**, et pourquoi (les absences sont des
décisions, jamais des oublis) :

1. **Aucune donnée RH sur ``User``** (invariant 1). Le compte est partagé
   entre tenants : un directeur du centre A ne doit jamais voir la date
   d'embauche, les congés ou les présences saisis par le directeur du
   centre B pour le même humain. Tout pend à ``Employment``, qui porte son
   ``center``.
2. **Aucune heure d'arrivée ni de départ** sur ``AttendanceRecord``
   (décision 3). Le registre papier note une journée, pas des minutes ;
   horodater nominativement chaque journée de travail créerait un
   instrument de contrôle que la numérisation n'a pas mandat d'inventer.
   Si la paie horaire l'exige un jour, ce sera un arbitrage explicite.
3. **Aucun champ de motif sur ``LeaveRequest``** (décision 4). Un motif de
   congé est de la donnée de santé ou de vie privée (maladie, deuil) : le
   type suffit à décompter des droits, la phrase n'ajoute qu'un risque.
   Précédent inverse à ne pas suivre : les ``*_reason`` du produit sont
   écrits **par** un décideur **pour** un décideur ; ici la personne
   concernée serait l'objet du texte.
4. **Aucun champ de rémunération, aucun taux, aucun montant** (décision 8).
   La paie est hors périmètre jusqu'à son propre cadrage — barèmes locaux,
   confidentialité des salaires, et surtout : **la paie ne touchera jamais
   le ledger des soins**. Un module RH qui porterait un salaire sans
   cadrage serait le plus sûr moyen d'exposer un jour la fiche de paie de
   quelqu'un.
5. **Aucun titre ni type sur ``LeaveDocument``** : la pièce est attachée à
   un congé qui porte déjà son type fermé ; un intitulé libre rouvrirait
   par la fenêtre le motif que la décision 4 ferme par la porte.

Cloisonnement (ADR 0002) : chaque queryset d'API passe par ``for_center()``
(directement pour les tables qui portent le centre, par ``employment__``
pour les autres). Le contenu du payload est segmenté par AUDIENCE dans les
sérialiseurs (``serializers.py``) — et le **planning collectif ne
distingue jamais ``absent`` de ``conge``** (invariant 3).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.centers.models import CenterScopedQuerySet
from apps.common.models import TimeStampedModel
from apps.common.private_storage import PrivateMediaStorage


class EmploymentQuerySet(CenterScopedQuerySet):
    """Les dossiers RH d'un centre — jamais transversaux à un humain."""

    def for_user(self, user):
        return self.filter(user=user)

    def active_on(self, day):
        """Emplois en cours à cette date (embauché, pas encore parti)."""
        return self.filter(hired_at__lte=day).filter(
            models.Q(ended_at__isnull=True) | models.Q(ended_at__gte=day)
        )


class ViaEmploymentQuerySet(models.QuerySet):
    """Tables pendues à un emploi : elles atteignent le centre par lui.

    Le cloisonnement passe donc par ``employment__center`` — jamais par une
    dénormalisation du centre sur la ligne, qui pourrait diverger du dossier
    dont elle dépend (une présence appartient à un emploi, pas à un centre
    en général).
    """

    def for_center(self, center):
        return self.filter(employment__center=center)

    def for_user(self, user):
        return self.filter(employment__user=user)


class Department(TimeStampedModel):
    """Un service du centre (« Maternité », « Laboratoire »).

    **Un service n'est pas un droit** (ADR 0020, décision 2) : ce modèle
    n'est lu par aucune classe de permission, et un test structurel refuse
    son import hors de ``apps.hrm``. Le rôle du membership reste la seule
    source d'autorisations du produit.

    ``is_active`` plutôt qu'une suppression : un service fermé garde les
    emplois qui l'ont traversé (les FK sont en ``PROTECT``), et l'historique
    d'organisation reste lisible.
    """

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="hrm_departments",
    )
    name = models.CharField("nom", max_length=64)
    is_active = models.BooleanField("actif", default=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "service (RH)"
        verbose_name_plural = "services (RH)"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "name"], name="unique_hrm_department_per_center"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.center.name}"


class JobTitle(TimeStampedModel):
    """Une fonction (« Sage-femme », « Agent d'accueil »).

    Même contrat que :class:`Department` : **une fonction n'est pas un
    droit**. C'est la décision la plus importante du sprint pour la
    sécurité, et elle est verrouillée par un test structurel.
    """

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="hrm_job_titles",
    )
    name = models.CharField("nom", max_length=64)
    is_active = models.BooleanField("active", default=True)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "fonction"
        verbose_name_plural = "fonctions"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "name"], name="unique_hrm_job_title_per_center"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.center.name}"


class Employment(TimeStampedModel):
    """Le dossier RH d'UNE personne dans UN centre — le pivot du module.

    Unique par **(user, center)** : c'est tout l'objet de la décision 1.
    Les memberships restent les casquettes (une personne peut en avoir
    deux actives dans le même centre) ; l'emploi est la personne au travail.

    ``ended_at`` **ne supprime rien** : un emploi terminé garde ses présences
    et ses congés (obligations de conservation du centre — invariant 7), et
    il survit à l'anonymisation RGPD du compte, orphelin d'identité, comme
    le carnet médical. C'est une décision, pas un oubli.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="personne",
        on_delete=models.PROTECT,
        related_name="employments",
    )
    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="employments",
    )
    department = models.ForeignKey(
        Department,
        verbose_name="service",
        on_delete=models.PROTECT,
        related_name="employments",
        null=True,
        blank=True,
    )
    job_title = models.ForeignKey(
        JobTitle,
        verbose_name="fonction",
        on_delete=models.PROTECT,
        related_name="employments",
        null=True,
        blank=True,
        help_text=(
            "Libellé d'organisation. N'ouvre AUCUN droit : les permissions "
            "viennent du rôle du membership (ADR 0020, décision 2)."
        ),
    )
    hired_at = models.DateField("embauché le")
    ended_at = models.DateField("parti le", null=True, blank=True)

    objects = EmploymentQuerySet.as_manager()

    class Meta:
        verbose_name = "dossier RH"
        verbose_name_plural = "dossiers RH"
        ordering = ["-hired_at", "-id"]
        constraints = [
            # L'invariant de la décision 1, garanti par la BASE : une
            # personne = UN dossier RH par centre, quel que soit le nombre
            # de casquettes qu'elle y porte.
            models.UniqueConstraint(
                fields=["user", "center"], name="unique_employment_per_user_center"
            ),
            models.CheckConstraint(
                condition=models.Q(ended_at__isnull=True)
                | models.Q(ended_at__gte=models.F("hired_at")),
                name="employment_end_after_hire",
            ),
        ]
        indexes = [models.Index(fields=["center", "ended_at"])]

    def __str__(self) -> str:
        return f"{self.user} @ {self.center.name}"

    @property
    def is_running(self) -> bool:
        return self.ended_at is None or self.ended_at >= timezone.localdate()

    def covers(self, day) -> bool:
        """La date tombe-t-elle dans la période d'emploi ?"""
        if day < self.hired_at:
            return False
        return self.ended_at is None or day <= self.ended_at

    def save(self, *args, **kwargs):
        # Invariants STRUCTURELS, rejoués sur TOUT chemin d'écriture (règle
        # d'ingénierie du projet) — le service n'est pas la seule porte.
        #
        # 1. Périmètre : le service et la fonction appartiennent au centre
        #    de l'emploi. Sans cette garde, un centre pourrait ranger son
        #    personnel dans l'organigramme d'un autre tenant.
        if self.department_id is not None and (
            self.department.center_id != self.center_id
        ):
            raise ValidationError("Ce service n'appartient pas à ce centre.")
        if self.job_title_id is not None and (
            self.job_title.center_id != self.center_id
        ):
            raise ValidationError("Cette fonction n'appartient pas à ce centre.")
        # 2. Chronologie.
        if self.ended_at is not None and self.ended_at < self.hired_at:
            raise ValidationError(
                "La date de départ ne peut pas précéder l'embauche."
            )
        super().save(*args, **kwargs)


class Holiday(TimeStampedModel):
    """Un jour férié DU CENTRE (ADR 0020, décision 5).

    Les fériés comoriens sont nationaux, mais une clinique privée peut
    travailler un 14 août : le calendrier appartient au centre. Un
    pré-remplissage national pourra venir plus tard ; l'imposer maintenant
    obligerait des centres à désactiver des jours qu'ils travaillent.
    """

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre",
        on_delete=models.PROTECT,
        related_name="holidays",
    )
    date = models.DateField("date")
    name = models.CharField("libellé", max_length=64)

    objects = CenterScopedQuerySet.as_manager()

    class Meta:
        verbose_name = "jour férié"
        verbose_name_plural = "jours fériés"
        ordering = ["-date", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["center", "date"], name="unique_holiday_per_center_date"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date:%d/%m/%Y} — {self.name}"


class AttendanceRecord(TimeStampedModel):
    """Une journée de la feuille de présence (ADR 0020, décision 3).

    Saisie par le **responsable**, jamais par l'intéressé, et **jamais
    déduite de l'activité dans l'application** : Chioni numérise le registre
    papier, il n'invente pas une badgeuse. Ni heure d'arrivée, ni heure de
    départ, ni géolocalisation — voir la docstring du module.

    Unique par (emploi, date) : la feuille se **corrige** (le responsable
    s'est trompé de ligne), elle ne s'empile pas. Chaque correction est
    auditée ``attendance.recorded``, et cette action reste **hors** du
    journal du directeur (volumétrie quotidienne, et surveillance
    individuelle — invariant 4).
    """

    class Status(models.TextChoices):
        PRESENT = "present", "Présent"
        ABSENT = "absent", "Absent"
        LEAVE = "conge", "En congé"
        REST = "repos", "Repos"
        HOLIDAY = "ferie", "Férié"

    employment = models.ForeignKey(
        Employment,
        verbose_name="dossier RH",
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )
    date = models.DateField("date")
    status = models.CharField("statut", max_length=8, choices=Status.choices)
    noted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="noté par",
        on_delete=models.PROTECT,
        related_name="attendance_records_noted",
    )

    objects = ViaEmploymentQuerySet.as_manager()

    class Meta:
        verbose_name = "journée de présence"
        verbose_name_plural = "feuille de présence"
        ordering = ["-date", "employment_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["employment", "date"],
                name="unique_attendance_per_employment_day",
            ),
        ]
        indexes = [models.Index(fields=["date"])]

    def __str__(self) -> str:
        return f"{self.date:%d/%m/%Y} — {self.get_status_display()}"

    def save(self, *args, **kwargs):
        # Invariant structurel : une journée de présence tombe DANS la
        # période d'emploi. Sans lui, une feuille pourrait pointer une
        # personne un mois avant son embauche ou un an après son départ.
        if self.employment_id is not None and not self.employment.covers(self.date):
            raise ValidationError(
                "Cette date est hors de la période d'emploi de la personne."
            )
        super().save(*args, **kwargs)


class LeaveRequest(TimeStampedModel):
    """Une demande de congé — type FERMÉ, aucun motif libre (décision 4).

    Machine à états fermée (``services.LEAVE_TRANSITIONS``) ::

        demande ──> approuve
            ├─────> refuse
            └─────> annule      (la personne retire sa demande)

    Les trois cibles sont **terminales et définitives** (rejouées dans
    ``save()``). Une annulation APRÈS approbation est hors périmètre S7 et
    consignée comme telle : la feuille de présence, elle, dit ce qui s'est
    réellement passé — c'est elle qui fait foi (décision 4).

    Chevauchement : deux congés **approuvés** ne peuvent pas se chevaucher
    (garde sous verrou de l'emploi, ``services.decide_leave``) ; deux
    **demandes** qui se chevauchent sont permises — on tranche à
    l'approbation, pas à la saisie.
    """

    class Type(models.TextChoices):
        ANNUAL = "annuel", "Congé annuel"
        SICK = "maladie", "Congé maladie"
        MATERNITY = "maternite", "Congé maternité"
        PATERNITY = "paternite", "Congé paternité"
        BEREAVEMENT = "deuil", "Congé de deuil"
        UNPAID = "sans_solde", "Congé sans solde"
        OTHER = "autre", "Autre"

    class Status(models.TextChoices):
        REQUESTED = "demande", "Demandé"
        APPROVED = "approuve", "Approuvé"
        REFUSED = "refuse", "Refusé"
        CANCELLED = "annule", "Annulé"

    employment = models.ForeignKey(
        Employment,
        verbose_name="dossier RH",
        on_delete=models.PROTECT,
        related_name="leave_requests",
    )
    leave_type = models.CharField(
        "type de congé",
        max_length=16,
        choices=Type.choices,
        help_text=(
            "Choix FERMÉS. Il n'existe volontairement aucun champ de motif "
            "libre : un motif de congé est de la donnée de santé ou de vie "
            "privée (ADR 0020, décision 4)."
        ),
    )
    start_date = models.DateField("du")
    end_date = models.DateField("au")
    status = models.CharField(
        "statut", max_length=10, choices=Status.choices, default=Status.REQUESTED
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="demandé par",
        on_delete=models.PROTECT,
        related_name="leave_requests_made",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="décidé par",
        on_delete=models.PROTECT,
        related_name="leave_requests_decided",
        null=True,
        blank=True,
    )
    decided_at = models.DateTimeField("décidé le", null=True, blank=True)

    objects = ViaEmploymentQuerySet.as_manager()

    class Meta:
        verbose_name = "demande de congé"
        verbose_name_plural = "demandes de congé"
        ordering = ["-start_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="leave_end_after_start",
            ),
            # Une ligne « demande » ne porte pas de décision, et toute ligne
            # décidée porte SA date : la cohérence est garantie par la base,
            # pas seulement par le service.
            models.CheckConstraint(
                condition=(
                    models.Q(status="demande", decided_at__isnull=True)
                    | (~models.Q(status="demande") & models.Q(
                        decided_at__isnull=False
                    ))
                ),
                name="leave_decision_matches_status",
            ),
        ]
        indexes = [models.Index(fields=["employment", "status"])]

    def __str__(self) -> str:
        return (
            f"{self.get_leave_type_display()} "
            f"({self.start_date:%d/%m} → {self.end_date:%d/%m}) — "
            f"{self.get_status_display()}"
        )

    @property
    def days(self) -> int:
        """Nombre de journées CIVILES couvertes, bornes comprises.

        Un décompte de droits (soldes, reports) est explicitement hors
        périmètre S7 : ce nombre est un affichage, jamais un solde.
        """
        return (self.end_date - self.start_date).days + 1

    @property
    def is_terminal(self) -> bool:
        return self.status != self.Status.REQUESTED

    def save(self, *args, **kwargs):
        if self.end_date < self.start_date:
            raise ValidationError("La fin du congé ne peut pas précéder son début.")
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )
            # Un état terminal l'est DÉFINITIVEMENT (patron ``Stay``) : ni
            # réouverture d'un refus, ni requalification d'une approbation.
            if (
                previous is not None
                and previous != self.Status.REQUESTED
                and self.status != previous
            ):
                raise ValidationError(
                    "Cette demande de congé est close : son état ne change plus."
                )
        if self.status == self.Status.REQUESTED:
            if self.decided_at is not None or self.decided_by_id is not None:
                raise ValidationError(
                    "Une demande en attente ne porte pas de décision."
                )
        elif self.decided_at is None:
            raise ValidationError("Une demande décidée porte sa date de décision.")
        super().save(*args, **kwargs)


class LeaveDocument(TimeStampedModel):
    """Un justificatif de congé — un FICHIER privé, jamais un texte.

    Clone assumé de ``centers.KycDocument`` (ADR 0017), lui-même hérité de
    ``medical.PatientDocument`` (ADR 0016 §5) : un certificat médical mérite
    exactement le même soin qu'un résultat de laboratoire.

    - **Dépôt** : pipeline durci de l'ADR 0014 (JPEG/PNG/WebP par le CONTENU
      réel, 2 Mo, ré-encodage strippant EXIF/GPS, nom uuid), throttle
      ``uploads``.
    - **Diffusion privée** : le fichier vit sous ``PRIVATE_MEDIA_ROOT``,
      jamais sous ``MEDIA_URL`` ; aucun sérialiseur n'expose d'URL (le
      storage n'en a pas) ; la lecture passe par des endpoints authentifiés
      qui rejouent les permissions de la liste.
    - **Archivage DÉFINITIF** : on ne supprime pas la pièce qui a fondé une
      décision de congé ; on l'archive.

    Aucun titre, aucun type de pièce : le congé porte déjà son type fermé,
    et un intitulé libre rouvrirait par la fenêtre le motif que la
    décision 4 ferme par la porte.
    """

    leave = models.ForeignKey(
        LeaveRequest,
        verbose_name="demande de congé",
        on_delete=models.PROTECT,
        related_name="documents",
    )
    file = models.FileField(
        "fichier",
        storage=PrivateMediaStorage(),
        upload_to="leave_documents/%Y/%m/",
        max_length=255,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="déposé par",
        on_delete=models.PROTECT,
        related_name="leave_documents_uploaded",
    )
    archived_at = models.DateTimeField("archivé le", null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="archivé par",
        on_delete=models.PROTECT,
        related_name="leave_documents_archived",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "justificatif de congé"
        verbose_name_plural = "justificatifs de congé"
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"Justificatif #{self.pk} — congé #{self.leave_id}"

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def save(self, *args, **kwargs):
        # L'archivage est DÉFINITIF (même règle que KycDocument et
        # PatientDocument) : une pièce qui a fondé une décision ne
        # ressuscite pas.
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("archived_at", flat=True)
                .first()
            )
            if previous is not None and self.archived_at is None:
                raise ValidationError(
                    "Un justificatif archivé le reste : l'archivage est définitif."
                )
        super().save(*args, **kwargs)
