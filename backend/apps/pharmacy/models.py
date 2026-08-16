"""Le réseau des pharmacies — un acteur HORS tenant (S9, ADR 0022).

Le premier module du produit où une donnée de soin franchit la frontière du
centre vers un tiers qui n'a signé aucun consentement, ne relève d'aucun
secret partagé et n'est lié au patient par rien. Tout ce fichier tient dans
cette phrase.

**Décision 1 — une pharmacie n'est PAS un centre de santé.** Elle a ses
propres tables et surtout **son propre lien d'appartenance**
(:class:`PharmacyMembership`), jamais un ``centers.StaffMembership`` :
celui-ci est la clé que toutes les gardes de tenant interrogent
(``active_membership_qs``), et un compte de pharmacie qui en porterait un
serait « du staff » aux yeux de chaque vue du dépôt. À l'inverse, un compte
sans aucun ``StaffMembership`` ne peut, **par construction**, atteindre
aucune route de centre : le cloisonnement est structurel, pas déclaratif.
Précédent exact : ``accounts.PlatformStaff`` (ADR 0017).

Note de vocabulaire, pour lever une ambiguïté héritée :
``HealthCenter.Type.PHARMACY`` existe depuis le premier jour et désigne un
établissement de SOIN de type officine, enregistré comme tenant. Ce n'est
pas la même chose qu'une :class:`Pharmacy` du réseau, qui n'est pas un
tenant, n'a pas de patients et ne facture rien. Les deux peuvent coexister
sans se connaître.

**Décision 2 — la demande naît d'une ordonnance et ne contient aucun texte
libre.** :class:`AvailabilityRequestItem` porte une **copie figée** du
libellé de médicament (jamais une clé vers la ligne d'ordonnance : le
payload rendu à une pharmacie ne doit pas pouvoir se résoudre vers le
haut), la posologie ne sort pas, et le prescripteur **coche** les lignes
qui partent — il n'en écrit aucune. Un champ de texte libre vers un tiers
serait le canal par lequel un nom de patient finirait par sortir un jour.

**Décision 3 — la réponse est un constat daté, jamais un engagement.**
:class:`AvailabilityResponse` est append-only : une pharmacie qui se trompe
se corrige par une NOUVELLE réponse, l'historique reste. Aucun prix en S9
(arbitrage documenté, réversible).

**La diffusion est matérialisée** (:class:`AvailabilityRequestRecipient`) :
elle est ainsi bornée, comptable, gelée au moment de l'envoi — une
pharmacie validée demain ne lira pas les demandes d'hier, et une officine
qui déménage ne perd pas celles qu'elle a déjà reçues.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.geo import Island
from apps.common.models import AppendOnlyModel, AppendOnlyQuerySet, TimeStampedModel
from apps.common.private_storage import PrivateMediaStorage


# ---------------------------------------------------------------------------
# L'acteur : la pharmacie, ses gens, ses pièces
# ---------------------------------------------------------------------------


class PharmacyStatus(models.TextChoices):
    """Le cycle de vie d'une officine dans le réseau (ADR 0022, décision 5).

    Déclaré au niveau du module pour que les ``CheckConstraint`` de ``Meta``
    puissent lire la liste ; ``Pharmacy.Status`` reste l'alias public.
    """

    PENDING = "en_attente", "En attente de validation"
    VALIDATED = "validee", "Validée"
    SUSPENDED = "suspendue", "Suspendue"


class Pharmacy(TimeStampedModel):
    """Une officine enregistrée dans le réseau Chioni.

    Ce qu'elle est : un annuaire (nom, île, commune, téléphone) et une boîte
    de réception de demandes de disponibilité.

    Ce qu'elle n'est **pas**, et ce sont des décisions : ni tenant (pas de
    patients, pas de ledger, pas d'abonnement, pas de RH, pas de lits), ni
    stock déclaré (arbitrage PO n° 1 — un catalogue non tenu à jour ment, et
    son mensonge coûte un déplacement au patient), ni tarif, ni « pharmacie
    de garde » (concept réel et utile, hors périmètre S9).

    ``status_reason`` suit exactement le contrat de ``HealthCenter.kyc_reason``
    (ADR 0017) : motif OBLIGATOIRE à la suspension, lisible par la pharmacie
    concernée et par la plateforme, **jamais** recopié dans un payload
    d'audit.
    """

    Status = PharmacyStatus

    name = models.CharField("nom", max_length=255)
    island = models.CharField("île", max_length=16, choices=Island.choices)
    city = models.CharField("ville / commune", max_length=128)
    address = models.CharField("adresse", max_length=255, blank=True)
    phone = models.CharField(
        "téléphone",
        max_length=32,
        blank=True,
        help_text=(
            "Normalisé E.164 par le service (région KM). C'est le numéro que "
            "le centre et le patient voient : il est PUBLIC dans le réseau."
        ),
    )
    email = models.EmailField("e-mail", blank=True)
    status = models.CharField(
        "statut",
        max_length=16,
        choices=PharmacyStatus.choices,
        default=PharmacyStatus.PENDING,
    )
    status_reason = models.TextField(
        "motif de la décision",
        blank=True,
        help_text=(
            "Obligatoire pour une suspension. Lu par la pharmacie concernée "
            "et par la plateforme — jamais journalisé."
        ),
    )
    status_updated_at = models.DateTimeField(
        "statut décidé le", null=True, blank=True
    )
    status_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="statut décidé par",
        on_delete=models.PROTECT,
        related_name="pharmacy_status_decisions",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "pharmacie"
        verbose_name_plural = "pharmacies"
        ordering = ["name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=PharmacyStatus.values),
                name="pharmacy_status_is_closed",
            ),
            models.CheckConstraint(
                condition=models.Q(island__in=Island.values),
                name="pharmacy_island_is_closed",
            ),
            models.CheckConstraint(
                condition=~models.Q(name=""), name="pharmacy_name_not_empty"
            ),
            models.CheckConstraint(
                condition=~models.Q(city=""), name="pharmacy_city_not_empty"
            ),
        ]
        indexes = [models.Index(fields=["status", "island", "city"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.city})"

    @property
    def can_receive_requests(self) -> bool:
        """Seule une officine VALIDÉE entre dans une diffusion."""
        return self.status == PharmacyStatus.VALIDATED

    def save(self, *args, **kwargs):
        self.name = (self.name or "").strip()
        self.city = (self.city or "").strip()
        if not self.name:
            raise ValidationError("Le nom de la pharmacie est obligatoire.")
        if not self.city:
            raise ValidationError("La commune est obligatoire.")
        self.address = (self.address or "").strip()
        super().save(*args, **kwargs)


class PharmacyMembership(TimeStampedModel):
    """Le lien d'une personne avec une officine — et il n'a **pas de rôle**.

    Décision de sobriété assumée : une officine comorienne compte une à
    trois personnes qui font le même travail. Le modèle de rôles des centres
    existe parce qu'un centre a huit métiers distincts ; le transposer ici
    fabriquerait une surface de permissions sans réalité derrière. Tout
    membre actif répond aux demandes, dépose les pièces et peut inscrire un
    collègue — comme au comptoir.

    Ce lien n'est **jamais** un ``centers.StaffMembership`` : c'est la
    décision 1 de l'ADR 0022, et c'est ce qui rend le cloisonnement
    structurel.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="utilisateur",
        on_delete=models.PROTECT,
        related_name="pharmacy_memberships",
    )
    pharmacy = models.ForeignKey(
        Pharmacy,
        verbose_name="pharmacie",
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    is_active = models.BooleanField("actif", default=True)

    class Meta:
        verbose_name = "membre d'une pharmacie"
        verbose_name_plural = "membres des pharmacies"
        ordering = ["pharmacy_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "pharmacy"], name="unique_pharmacy_membership"
            )
        ]
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self) -> str:
        return f"{self.user} @ {self.pharmacy_id}"


class PharmacyDocument(TimeStampedModel):
    """Une pièce justificative de l'officine (licence, registre, identité).

    Clone exact du pipeline ``centers.KycDocument`` (ADR 0017), lui-même
    hérité de ``medical.PatientDocument`` (ADR 0016 §5) : upload durci
    ADR 0014 (JPEG/PNG/WebP par contenu RÉEL, 2 Mo, ré-encodage stripant les
    métadonnées, nom uuid), **stockage privé sans URL**, lecture par endpoint
    authentifié seulement, archivage DÉFINITIF — une décision de validation
    doit rester auditable contre les pièces qui l'ont fondée.

    Valider une officine sans pièce serait du théâtre : c'est la seule
    raison d'être de cette table.
    """

    class DocType(models.TextChoices):
        TRADE_REGISTER = "registre_commerce", "Registre du commerce"
        PHARMACY_LICENCE = "licence_officine", "Licence d'officine"
        MANAGER_ID = "piece_identite_responsable", "Pièce d'identité du responsable"
        OTHER = "autre", "Autre"

    pharmacy = models.ForeignKey(
        Pharmacy,
        verbose_name="pharmacie",
        on_delete=models.PROTECT,
        related_name="documents",
    )
    doc_type = models.CharField(
        "type de pièce", max_length=32, choices=DocType.choices
    )
    file = models.FileField(
        "fichier",
        storage=PrivateMediaStorage(),
        upload_to="pharmacy_documents/%Y/%m/",
        max_length=255,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="déposé par",
        on_delete=models.PROTECT,
        related_name="pharmacy_documents_uploaded",
    )
    archived_at = models.DateTimeField("archivé le", null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="archivé par",
        on_delete=models.PROTECT,
        related_name="pharmacy_documents_archived",
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = "pièce d'une pharmacie"
        verbose_name_plural = "pièces des pharmacies"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_doc_type_display()} — {self.pharmacy_id}"

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def save(self, *args, **kwargs):
        if self.pk is not None:
            previous = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("archived_at", flat=True)
                .first()
            )
            if previous is not None and self.archived_at is None:
                raise ValidationError(
                    "Une pièce archivée le reste : l'archivage est définitif."
                )
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# La demande de disponibilité — le cœur du sprint
# ---------------------------------------------------------------------------


class AvailabilityRequestStatus(models.TextChoices):
    """Deux états, et une péremption (ADR 0022, décision 8)."""

    OPEN = "ouverte", "Ouverte"
    CLOSED = "close", "Close"


class AvailabilityCloseReason(models.TextChoices):
    """Pourquoi une demande s'est fermée — un CODE, jamais un texte."""

    MANUAL = "manuelle", "Fermée par le centre"
    EXPIRED = "peremption", "Périmée"


class AvailabilityRequest(TimeStampedModel):
    """« Qui a ces médicaments, maintenant, près d'ici ? »

    Elle porte deux clés que la pharmacie ne voit **jamais** — le centre
    demandeur et l'ordonnance d'origine — et deux qu'elle voit : la zone et
    la liste. L'asymétrie est la décision 2 de l'ADR : l'annuaire des
    pharmacies est public, l'activité d'un centre ne l'est pas.

    La demande **périme** (``expires_at``, défaut 48 h) : un « disponible »
    vieux de trois semaines est un faux espoir, et un faux espoir se paie en
    trajet.
    """

    Status = AvailabilityRequestStatus
    CloseReason = AvailabilityCloseReason

    center = models.ForeignKey(
        "centers.HealthCenter",
        verbose_name="centre demandeur",
        on_delete=models.PROTECT,
        related_name="availability_requests",
        help_text="JAMAIS sérialisé vers une pharmacie (ADR 0022 décision 2).",
    )
    prescription = models.ForeignKey(
        "medical.Prescription",
        verbose_name="ordonnance",
        on_delete=models.PROTECT,
        related_name="availability_requests",
        help_text="JAMAIS sérialisée vers une pharmacie — ni elle, ni le patient.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="lancée par",
        on_delete=models.PROTECT,
        related_name="availability_requests_created",
    )
    island = models.CharField("île", max_length=16, choices=Island.choices)
    city = models.CharField(
        "commune",
        max_length=128,
        blank=True,
        help_text="Vide = toute l'île (la diffusion reste bornée par le plafond).",
    )
    status = models.CharField(
        "statut",
        max_length=16,
        choices=AvailabilityRequestStatus.choices,
        default=AvailabilityRequestStatus.OPEN,
    )
    expires_at = models.DateTimeField("périme le")
    closed_at = models.DateTimeField("fermée le", null=True, blank=True)
    close_reason = models.CharField(
        "raison de fermeture",
        max_length=16,
        choices=AvailabilityCloseReason.choices,
        blank=True,
    )

    class Meta:
        verbose_name = "demande de disponibilité"
        verbose_name_plural = "demandes de disponibilité"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=AvailabilityRequestStatus.values),
                name="availability_request_status_is_closed",
            ),
            models.CheckConstraint(
                condition=models.Q(island__in=Island.values),
                name="availability_request_island_is_closed",
            ),
        ]
        indexes = [
            models.Index(fields=["center", "-created_at"]),
            models.Index(fields=["prescription"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self) -> str:
        return f"Demande de disponibilité #{self.pk}"

    @property
    def is_open(self) -> bool:
        return self.status == AvailabilityRequestStatus.OPEN


class AvailabilityRequestItem(AppendOnlyModel):
    """Une ligne partie vers le réseau — **une copie, pas une référence**.

    ``medication`` est recopié depuis ``PrescriptionItem.medication`` au
    moment de l'envoi. Deux raisons, dans cet ordre :

    1. modifier une ordonnance demain ne doit pas réécrire une demande
       d'hier (une pharmacie a répondu sur ce qu'elle a lu) ;
    2. **aucune clé ne remonte** : le payload d'une pharmacie ne contient
       rien qui se résolve vers une ligne d'ordonnance, donc vers une
       consultation, donc vers un patient.

    La **posologie ne sort pas** : elle dit comment le patient vit avec son
    traitement, et une officine n'en a pas besoin pour dire qu'elle a la
    boîte.
    """

    request = models.ForeignKey(
        AvailabilityRequest,
        verbose_name="demande",
        on_delete=models.PROTECT,
        related_name="items",
    )
    medication = models.CharField("médicament", max_length=255)

    class Meta:
        verbose_name = "médicament demandé"
        verbose_name_plural = "médicaments demandés"
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(medication=""),
                name="availability_item_medication_not_empty",
            ),
        ]

    def __str__(self) -> str:
        return self.medication

    def save(self, *args, **kwargs):
        self.medication = (self.medication or "").strip()
        if not self.medication:
            raise ValidationError("Un médicament vide ne part pas au réseau.")
        super().save(*args, **kwargs)


class AvailabilityRecipientQuerySet(AppendOnlyQuerySet):
    """La boîte de réception d'une officine — et rien d'autre."""

    def for_pharmacy(self, pharmacy):
        return self.filter(pharmacy=pharmacy)


class AvailabilityRequestRecipient(AppendOnlyModel):
    """« Cette demande a été adressée à cette officine », figé à l'envoi.

    Matérialiser la diffusion est ce qui la rend **bornée, comptable et
    stable** : le plafond s'applique sur des lignes réelles, une pharmacie
    validée demain ne lit pas les demandes d'hier, et l'officine qui change
    de commune garde celles qu'elle a déjà reçues.

    C'est aussi le seul chemin de lecture de l'espace pharmacie : pas de
    filtre « ma commune » recalculé à chaque appel, donc pas de fenêtre
    latérale sur l'activité du réseau.
    """

    request = models.ForeignKey(
        AvailabilityRequest,
        verbose_name="demande",
        on_delete=models.PROTECT,
        related_name="recipients",
    )
    pharmacy = models.ForeignKey(
        Pharmacy,
        verbose_name="pharmacie",
        on_delete=models.PROTECT,
        related_name="received_requests",
    )

    objects = AvailabilityRecipientQuerySet.as_manager()

    class Meta:
        verbose_name = "destinataire d'une demande"
        verbose_name_plural = "destinataires des demandes"
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "pharmacy"],
                name="unique_availability_recipient",
            )
        ]
        indexes = [models.Index(fields=["pharmacy", "-created_at"])]

    def __str__(self) -> str:
        return f"Demande {self.request_id} → pharmacie {self.pharmacy_id}"


class AvailabilityResponse(AppendOnlyModel):
    """Le constat daté d'une officine — append-only, jamais un engagement.

    Une pharmacie qui se trompe (ou dont le stock bouge) **répond à
    nouveau** ; la dernière réponse fait foi et l'historique reste. C'est le
    même patron que le signalement d'équipement (S8) : on ne réécrit pas un
    constat, on en pose un suivant.

    ``comment`` revient au CENTRE seulement (décision 3) : c'est du texte
    non modéré écrit par un tiers, et l'écran du patient doit rester une
    information, pas une conversation.

    Aucun PRIX en S9 — arbitrage documenté et réversible (ADR 0022) : un
    prix affiché à un patient devient une promesse opposable, et un
    classement par prix ferait de Chioni un comparateur, ce qui demande son
    propre cadrage.
    """

    recipient = models.ForeignKey(
        AvailabilityRequestRecipient,
        verbose_name="destinataire",
        on_delete=models.PROTECT,
        related_name="responses",
    )
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="répondu par",
        on_delete=models.PROTECT,
        related_name="availability_responses",
        help_text=(
            "Interne à l'officine : jamais rendu au centre ni au patient "
            "(c'est la pharmacie qui répond, pas une personne)."
        ),
    )
    comment = models.CharField("commentaire", max_length=280, blank=True)

    class Meta:
        verbose_name = "réponse de disponibilité"
        verbose_name_plural = "réponses de disponibilité"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["recipient", "-created_at"])]

    def __str__(self) -> str:
        return f"Réponse #{self.pk}"

    def save(self, *args, **kwargs):
        self.comment = (self.comment or "").strip()
        super().save(*args, **kwargs)


class AvailabilityResponseLine(AppendOnlyModel):
    """« Ce médicament-là, je l'ai / je ne l'ai pas. »

    Une ligne par médicament de la demande — le service exige la couverture
    COMPLÈTE : une réponse partielle laisserait le patient (et le centre)
    dans l'ambiguïté « pas répondu » vs « pas disponible », qui est
    précisément le doute qu'on cherche à supprimer.
    """

    response = models.ForeignKey(
        AvailabilityResponse,
        verbose_name="réponse",
        on_delete=models.PROTECT,
        related_name="lines",
    )
    item = models.ForeignKey(
        AvailabilityRequestItem,
        verbose_name="médicament demandé",
        on_delete=models.PROTECT,
        related_name="response_lines",
    )
    is_available = models.BooleanField("disponible")

    class Meta:
        verbose_name = "ligne de réponse"
        verbose_name_plural = "lignes de réponse"
        ordering = ["item_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["response", "item"],
                name="unique_availability_response_line",
            )
        ]

    def __str__(self) -> str:
        return f"{self.item_id} : {'dispo' if self.is_available else 'non'}"
