"""Services du réseau des pharmacies — le SEUL chemin d'écriture (S9, ADR 0022).

Règle du projet (CLAUDE.md) : toute écriture passe par un service qui rejoue
``save()``, prend le verrou de ligne qui rend la décision opposable sous
concurrence, et journalise DANS la même transaction.

**Hiérarchie de verrous du module : utilisateur → pharmacie → demande.**
Le niveau ``utilisateur`` n'est pris que par la garde de séparation des
pouvoirs (patron S4/S5, où il est déjà le niveau le plus externe du
produit) ; ``pharmacie`` sert la garde « dernier membre actif » ;
``demande`` sérialise la réponse d'une officine avec la fermeture par le
centre ou par la péremption. Elle est **disjointe** de celles de l'argent
(utilisateur → intent → demande de paiement → facture → centre), du soin,
de l'hospitalisation (patient → lit → séjour) et du RH (emploi → congé) :
aucun service d'ici n'atteint une facture, un intent, un séjour ni un
emploi.

**Deux gardes sont absentes, et c'est délibéré** :

- ``require_center_can_administer`` (gel d'abonnement, ADR 0018) n'est PAS
  importé — chercher un médicament pour un patient est un geste de soin, et
  un centre en impayé est précisément celui dont les patients ont le moins
  les moyens de courir la ville. ``ALLOWED_IMPORTERS`` reste inchangée
  (sonde fail-closed de S5), avec un miroir local dans
  ``tests/test_pharmacy.py`` ;
- ``_require_center_can_collect`` (KYC, ADR 0017) non plus : suspendre un
  centre ferme le rail diaspora, **et lui seul**.

CONTRAT DE PAYLOAD D'AUDIT (ADR 0007, resserré ici) : des ids, des codes
fermés et des COMPTEURS. **Jamais un libellé de médicament** — le contenu
d'une ordonnance est du ``detail_clinique`` (ADR 0005) —, jamais le motif
d'une décision de statut, jamais le commentaire d'une officine.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone

from apps.audit.services import AuditAction, audit
from apps.common.geo import Island
from apps.common.notifications import notify_pharmacy_of_availability_request
from apps.common.phones import normalize_phone
from apps.common.uploads import process_image_upload
from apps.patients.services import get_or_create_shadow_user
from apps.pharmacy.models import (
    AvailabilityRequest,
    AvailabilityRequestItem,
    AvailabilityRequestRecipient,
    AvailabilityResponse,
    AvailabilityResponseLine,
    Pharmacy,
    PharmacyDocument,
    PharmacyMembership,
)

Status = Pharmacy.Status
RequestStatus = AvailabilityRequest.Status
CloseReason = AvailabilityRequest.CloseReason

#: Le cycle de vie d'une officine — explicite et fermé (ADR 0022 décision 5).
PHARMACY_TRANSITIONS = {
    Status.PENDING: {Status.VALIDATED, Status.SUSPENDED},
    # ``VALIDATED → PENDING`` : le retour en vérification d'une officine qui
    # a DÉCLARÉ un déménagement (revue adversariale S9, voir
    # :func:`update_pharmacy`). Ce n'est pas une sanction — c'est la même
    # posture que le KYC d'un centre : la zone est ce qui borne la
    # circulation d'une liste de médicaments, donc elle se vérifie.
    Status.VALIDATED: {Status.SUSPENDED, Status.PENDING},
    Status.SUSPENDED: {Status.VALIDATED},
}

#: Les deux champs qui décident QUELLES demandes une officine reçoit. Les
#: modifier n'est pas corriger une devanture : c'est se déplacer dans le
#: ciblage (ADR 0022 décision 4).
PHARMACY_ZONE_FIELDS = ("island", "city")

#: Motif posé sur l'officine quand elle déclare elle-même un déménagement.
#: Écrit POUR elle (comme un ``kyc_reason``), jamais journalisé.
PHARMACY_RELOCATION_REASON = (
    "Vous avez déclaré un changement de commune ou d'île. Votre officine "
    "repasse en vérification : elle ne recevra pas de nouvelle demande "
    "tant que Chioni n'aura pas confirmé la nouvelle adresse. Déposez une "
    "pièce justificative à jour pour accélérer."
)

#: Les champs qu'une officine corrige elle-même. ``status`` n'y est PAS :
#: il appartient à la plateforme, comme le KYC d'un centre.
PHARMACY_EDITABLE_FIELDS = ("name", "island", "city", "address", "phone", "email")

#: Séparation des pouvoirs (patron ADR 0017/0018) — un exploitant Chioni ne
#: s'inscrit pas lui-même dans le réseau qu'il valide.
OPERATOR_AS_PHARMACY_MEMBER_MESSAGE = (
    "Ce numéro est celui d'un membre de l'équipe Chioni : un exploitant de "
    "la plateforme ne peut pas être inscrit dans une pharmacie qu'il "
    "valide. Inscrivez la personne de l'officine avec son propre numéro."
)


# ---------------------------------------------------------------------------
# L'officine : naissance, gens, pièces, statut
# ---------------------------------------------------------------------------


def _refuse_platform_operator_as_pharmacy_member(user):
    """Un exploitant Chioni ne devient pas membre d'une officine.

    Même parade, même honnêteté que les deux gardes miroir existantes
    (``centers.services._refuse_platform_operator_as_director`` et
    ``accounts.services._refuse_center_staff_as_operator``) : elle ne rend
    pas la combinaison impossible — un second numéro y suffit —, elle
    supprime le chemin en libre-service. Le conflit d'intérêt visé est
    précis : **celui qui valide les pharmacies ne doit pas valider la
    sienne**.

    La ligne ``User`` est verrouillée d'abord (leçon S5) : sans elle, deux
    transactions concurrentes prenant les deux portes sur le même numéro
    lisent chacune un monde où l'autre écriture n'existe pas encore, et
    passent toutes les deux.
    """
    from django.contrib.auth import get_user_model

    from apps.accounts.models import PlatformStaff

    get_user_model().objects.select_for_update().get(pk=user.pk)
    if PlatformStaff.objects.filter(user=user, is_active=True).exists():
        raise ValidationError(OPERATOR_AS_PHARMACY_MEMBER_MESSAGE)


@transaction.atomic
def add_pharmacy_member(*, actor, pharmacy, phone, first_name="", last_name=""):
    """Inscrire une personne dans une officine — compte OMBRE, jamais un mot
    de passe transmis (ADR 0010 : elle prend possession du compte par OTP).

    Ouvert à la plateforme (amorçage) **et** à tout membre actif de
    l'officine : une pharmacie compte une à trois personnes qui font le même
    travail, et attendre Chioni pour inscrire un collègue serait une
    friction sans contrepartie de sécurité (ADR 0022 — le lien n'a pas de
    rôle, c'est une décision).
    """
    user, created = get_or_create_shadow_user(phone)
    if created and (first_name or last_name):
        user.first_name = first_name
        user.last_name = last_name
        user.save(update_fields=["first_name", "last_name"])
    existing = PharmacyMembership.objects.filter(
        user=user, pharmacy=pharmacy
    ).first()
    if existing is not None:
        if existing.is_active:
            raise ValidationError("Cette personne est déjà membre de l'officine.")
        existing.is_active = True
        existing.save(update_fields=["is_active", "updated_at"])
        membership = existing
    else:
        membership = PharmacyMembership.objects.create(user=user, pharmacy=pharmacy)
    _refuse_platform_operator_as_pharmacy_member(user)
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_MEMBER_ADDED,
        target=membership,
        # Transverse : aucune action de ce module ne porte de ``center`` —
        # une pharmacie n'appartient à aucun tenant, donc aucun journal de
        # directeur ne la montre.
        membership_id=membership.pk,
        pharmacy_id=pharmacy.pk,
        user_id=user.pk,
        account_created=created,
    )
    return membership


@transaction.atomic
def deactivate_pharmacy_member(*, actor, membership):
    """Retirer une personne de l'officine — jamais la dernière.

    Garde « dernier membre actif », patron du « dernier directeur »
    (``centers.services``) : une officine sans personne est une boîte de
    réception que plus personne ne relève, donc des demandes qui restent
    sans réponse pendant 48 h. La ligne ``Pharmacy`` est verrouillée pour
    que deux retraits concurrents ne vident pas l'officine à deux.
    """
    Pharmacy.objects.select_for_update().get(pk=membership.pharmacy_id)
    if not membership.is_active:
        raise ValidationError("Cette personne n'est déjà plus membre.")
    others = PharmacyMembership.objects.filter(
        pharmacy_id=membership.pharmacy_id, is_active=True
    ).exclude(pk=membership.pk)
    if not others.exists():
        raise ValidationError(
            "C'est la dernière personne inscrite : inscrivez d'abord "
            "quelqu'un d'autre, sinon plus personne ne relèvera les "
            "demandes de l'officine."
        )
    membership.is_active = False
    membership.save(update_fields=["is_active", "updated_at"])
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_MEMBER_REMOVED,
        target=membership,
        membership_id=membership.pk,
        pharmacy_id=membership.pharmacy_id,
        user_id=membership.user_id,
    )
    return membership


@transaction.atomic
def create_pharmacy_with_member(
    *, actor, member_phone, member_first_name="", member_last_name="", **fields
):
    """La plateforme enregistre une officine ET sa première personne,
    atomiquement — miroir exact de ``create_center_with_director``.

    Une pharmacie sans personne est une boîte de réception morte : les deux
    écritures sont UNE transaction. ``status`` n'est jamais une entrée : une
    officine naît « en attente », et seule :func:`set_pharmacy_status` la
    déplace.
    """
    fields.pop("status", None)
    phone = (fields.pop("phone", "") or "").strip()
    pharmacy = Pharmacy(status=Status.PENDING, **fields)
    if phone:
        pharmacy.phone = normalize_phone(phone)
    pharmacy.save()
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_CREATED,
        target=pharmacy,
        pharmacy_id=pharmacy.pk,
        island=pharmacy.island,
        status=pharmacy.status,
    )
    membership = add_pharmacy_member(
        actor=actor,
        pharmacy=pharmacy,
        phone=member_phone,
        first_name=member_first_name,
        last_name=member_last_name,
    )
    return pharmacy, membership


@transaction.atomic
def update_pharmacy(*, actor, pharmacy, **fields):
    """L'officine corrige sa fiche (adresse, téléphone, commune…).

    ``status`` n'est pas modifiable ici : il appartient à la plateforme,
    exactement comme le KYC d'un centre appartient à Chioni et non à son
    directeur. Changer d'île ou de commune est légitime (un déménagement) et
    ne touche pas aux demandes DÉJÀ reçues — la diffusion est figée sur des
    lignes (``AvailabilityRequestRecipient``), pas recalculée.

    **Mais un déménagement déclaré renvoie l'officine en vérification**
    (revue adversariale S9). La zone n'est pas une ligne d'adresse : c'est
    la SEULE borne à la distance que parcourt une liste de médicaments
    (ADR 0022, « la diffusion est bornée et annoncée »). Une officine
    validée à Fomboni qui se déclarait à Moroni recevait, dès la seconde
    suivante et sans que personne ne revérifie rien, chaque diffusion de la
    capitale — soit précisément le scénario de réidentification que le
    plafond de destinataires existe pour empêcher. Elle repasse donc
    ``en_attente`` : elle garde tout (son historique, ses pièces, ses
    gens), elle ne reçoit plus rien jusqu'à ce que Chioni confirme la
    nouvelle adresse. Une officine encore ``en_attente`` ou ``suspendue``
    déménage librement : elle ne reçoit déjà rien.

    Payload d'audit : les NOMS des champs touchés, jamais leurs valeurs
    (patron ``staff.membership_updated``).
    """
    unknown = set(fields) - set(PHARMACY_EDITABLE_FIELDS)
    if unknown:
        raise ValidationError(
            f"Champ non modifiable : {', '.join(sorted(unknown))}."
        )
    changed = []
    for field in PHARMACY_EDITABLE_FIELDS:
        if field not in fields:
            continue
        value = fields[field]
        if value is None:
            value = ""
        if field == "phone" and value:
            value = normalize_phone(value)
        if getattr(pharmacy, field) != value:
            setattr(pharmacy, field, value)
            changed.append(field)
    if not changed:
        return pharmacy
    pharmacy.save(update_fields=sorted({*changed, "updated_at"}))
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_UPDATED,
        target=pharmacy,
        pharmacy_id=pharmacy.pk,
        fields=",".join(sorted(changed)),
    )
    if pharmacy.status == Status.VALIDATED and (
        set(changed) & set(PHARMACY_ZONE_FIELDS)
    ):
        # Par la porte UNIQUE du statut : verrou de ligne, machine à états
        # explicite, entrée d'audit ``pharmacy.status_changed``. L'officine
        # lit le motif sur sa propre fiche (``status_reason``).
        pharmacy = set_pharmacy_status(
            actor=actor,
            pharmacy=pharmacy,
            status=Status.PENDING,
            reason=PHARMACY_RELOCATION_REASON,
        )
    return pharmacy


@transaction.atomic
def set_pharmacy_status(*, actor, pharmacy, status, reason=""):
    """LA porte unique du statut d'une officine (plateforme, rôle ``admin``).

    Machine explicite et fermée ; motif OBLIGATOIRE pour suspendre — couper
    une officine du réseau sans écrire pourquoi laisserait le pharmacien
    sans rien à corriger. Le motif vit sur la ligne (lu par l'officine
    elle-même et par la plateforme) et **n'entre jamais** dans le payload
    d'audit : même classe qu'un ``kyc_reason``.

    Ce que ferme une suspension, et rien de plus : **la réception de
    nouvelles demandes** et le droit de répondre. L'officine garde la
    lecture de son historique — on ne prend jamais ses données en otage
    (patron « résilié » de l'ADR 0018).
    """
    if status not in Status.values:
        raise ValidationError("Statut de pharmacie inconnu.")
    pharmacy = Pharmacy.objects.select_for_update().get(pk=pharmacy.pk)
    previous = pharmacy.status
    if status == previous:
        raise ValidationError(f"Cette pharmacie est déjà « {Status(status).label} ».")
    if status not in PHARMACY_TRANSITIONS.get(previous, set()):
        raise ValidationError(
            f"Transition refusée : une pharmacie « {Status(previous).label} » "
            f"ne peut pas passer à « {Status(status).label} »."
        )
    reason = (reason or "").strip()
    if status == Status.SUSPENDED and not reason:
        raise ValidationError(
            "Le motif est obligatoire pour suspendre une pharmacie : le "
            "pharmacien doit savoir ce qu'il doit corriger."
        )
    pharmacy.status = status
    pharmacy.status_reason = reason
    pharmacy.status_updated_at = timezone.now()
    pharmacy.status_updated_by = actor
    pharmacy.save(
        update_fields=[
            "status", "status_reason", "status_updated_at", "status_updated_by",
            "updated_at",
        ]
    )
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_STATUS_CHANGED,
        target=pharmacy,
        pharmacy_id=pharmacy.pk,
        old_status=previous,
        status=status,
        has_reason=bool(reason),
    )
    return pharmacy


@transaction.atomic
def upload_pharmacy_document(*, actor, pharmacy, uploaded_file, doc_type):
    """L'officine dépose une pièce ; la plateforme la lit avant de décider.

    Pipeline durci ADR 0014 puis stockage PRIVÉ (ADR 0016 §5) : la pièce
    d'identité d'un pharmacien mérite exactement le soin d'un résultat de
    laboratoire. Payload d'audit : ids + le code ``doc_type``, jamais un nom
    de fichier.
    """
    if doc_type not in PharmacyDocument.DocType.values:
        raise ValidationError("Type de pièce invalide.")
    content = process_image_upload(uploaded_file)
    document = PharmacyDocument.objects.create(
        pharmacy=pharmacy, doc_type=doc_type, file=content, uploaded_by=actor
    )
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_DOCUMENT_UPLOADED,
        target=document,
        document_id=document.pk,
        pharmacy_id=pharmacy.pk,
        doc_type=str(doc_type),
    )
    return document


@transaction.atomic
def archive_pharmacy_document(*, actor, document):
    """Corriger SANS détruire : la ligne et le fichier restent, la décision
    de validation doit rester auditable contre les pièces qui l'ont fondée.

    L'état est relu SOUS VERROU (revue adversariale S9) : la garde lisait
    l'instance chargée par la vue, si bien que deux archivages concurrents
    passaient tous les deux — la seconde écriture réécrivait ``archived_at``
    et ``archived_by``, et le journal portait deux entrées pour un seul
    geste. Même leçon que S8, appliquée ici où elle est peu coûteuse : le
    document est une feuille de la hiérarchie de verrous.
    """
    document = PharmacyDocument.objects.select_for_update().get(pk=document.pk)
    if document.is_archived:
        raise ValidationError("Cette pièce est déjà archivée.")
    document.archived_at = timezone.now()
    document.archived_by = actor
    document.save(update_fields=["archived_at", "archived_by", "updated_at"])
    audit(
        actor=actor,
        action=AuditAction.PHARMACY_DOCUMENT_ARCHIVED,
        target=document,
        document_id=document.pk,
        pharmacy_id=document.pharmacy_id,
        doc_type=str(document.doc_type),
    )
    return document


# ---------------------------------------------------------------------------
# La demande de disponibilité
# ---------------------------------------------------------------------------


def pharmacy_directory_qs(*, island="", city="", query=""):
    """L'annuaire — **les officines VALIDÉES seulement**.

    Une officine « en attente » n'existe pas encore pour le réseau : elle ne
    doit apparaître ni dans une recherche, ni dans un ciblage. Une officine
    suspendue non plus (c'est l'effet même de la sanction).
    """
    qs = Pharmacy.objects.filter(status=Status.VALIDATED)
    if island:
        qs = qs.filter(island=island)
    if city:
        qs = qs.filter(city__iexact=city.strip())
    if query:
        qs = qs.filter(Q(name__icontains=query) | Q(city__icontains=query))
    return qs.order_by("city", "name", "id")


def _recipients_for(island, city):
    """Les officines qui recevront — le ciblage, en un seul endroit."""
    return pharmacy_directory_qs(island=island, city=city)


@transaction.atomic
def create_availability_request(
    *, actor, center, prescription, island, city="", item_ids
):
    """Envoyer la liste des médicaments cochés aux officines d'une zone.

    Ce que cette fonction protège, dans l'ordre de l'ADR 0022 :

    1. **le prescripteur choisit ce qui sort** — ``item_ids`` est un
       sous-ensemble EXPLICITE des lignes de l'ordonnance ; rien ne part par
       défaut côté serveur (le défaut « tout coché » est une affordance
       d'écran, pas une règle de service) ;
    2. **rien d'autre ne sort** — seul ``PrescriptionItem.medication`` est
       recopié ; la posologie, le patient, la consultation et le centre
       restent de ce côté-ci de la frontière ;
    3. **la diffusion est bornée ET annoncée** — au-delà de
       ``AVAILABILITY_REQUEST_MAX_RECIPIENTS`` la demande est REFUSÉE avec le
       compte réel, jamais tronquée en silence (leçon S8 : un plafond muet
       se lit « tout est couvert »).

    Refus explicites, tous en français : ordonnance déjà délivrée (chercher
    n'a plus d'objet), aucune ligne cochée, ligne étrangère à l'ordonnance,
    zone sans aucune officine validée, doublon d'une demande OUVERTE sur la
    même ordonnance et la même zone (le double-clic ne diffuse pas deux fois).
    """
    from apps.medical.models import Prescription, PrescriptionItem

    # VERROU DE L'ORDONNANCE, pris en premier (revue adversariale S9). Il
    # fait trois choses qu'aucune relecture d'instance ne peut faire :
    #
    # 1. il relit ``status`` EN BASE. L'appelant a chargé l'ordonnance
    #    avant d'ouvrir la transaction ; une délivrance commise entre les
    #    deux laissait passer une diffusion sur une ordonnance déjà servie
    #    — la leçon S8 mot pour mot (« la garde lisait l'instance en
    #    mémoire ») ;
    # 2. il sérialise avec ``medical.services.deliver_prescription``, qui
    #    prend le même verrou et aucun autre : pas de cycle ;
    # 3. il rend la garde anti-doublon ci-dessous OPPOSABLE. Sans lui, deux
    #    envois concurrents sur la même ordonnance et la même zone lisaient
    #    chacun « aucune demande ouverte » et diffusaient DEUX fois — la
    #    liste de médicaments partait deux fois vers N officines, avec 2×N
    #    SMS, alors que l'ADR promet que « le double-clic ne diffuse pas
    #    deux fois ».
    #
    # Hiérarchie de verrous du module, complétée d'un cran :
    # **utilisateur → pharmacie → ordonnance → demande**.
    prescription = Prescription.objects.select_for_update().get(
        pk=prescription.pk
    )
    if prescription.encounter.center_id != center.pk:
        # Défense en profondeur : aujourd'hui la vue scelle déjà
        # l'ordonnance sur le centre de l'URL, mais ce service est LE
        # chemin d'écriture et un second appelant ne doit pas pouvoir
        # ancrer une demande sur le centre d'un autre — ce qui la ferait
        # apparaître dans le fil de recherches d'un tenant étranger.
        raise ValidationError(
            "Cette ordonnance n'appartient pas à ce centre."
        )
    if prescription.status == Prescription.Status.DELIVERED:
        raise ValidationError(
            "Cette ordonnance a déjà été délivrée : il n'y a plus de "
            "médicament à chercher."
        )
    if island not in Island.values:
        raise ValidationError("Île inconnue.")
    city = (city or "").strip()

    item_ids = list(dict.fromkeys(item_ids or []))
    if not item_ids:
        raise ValidationError(
            "Cochez au moins un médicament à chercher."
        )
    items = list(
        PrescriptionItem.objects.filter(
            prescription=prescription, pk__in=item_ids
        ).order_by("id")
    )
    if len(items) != len(item_ids):
        # Référence dans le CORPS → 400 explicite (norme S1), et le message
        # est byte-identique qu'il s'agisse d'une ligne inexistante ou d'une
        # ligne d'une AUTRE ordonnance : aucun oracle.
        raise ValidationError(
            "Une des lignes sélectionnées n'appartient pas à cette ordonnance."
        )

    duplicate = AvailabilityRequest.objects.filter(
        prescription=prescription,
        status=RequestStatus.OPEN,
        island=island,
        city__iexact=city,
    ).exists()
    if duplicate:
        raise ValidationError(
            "Une demande est déjà en cours pour cette ordonnance dans cette "
            "zone. Fermez-la avant d'en relancer une."
        )

    recipients = list(_recipients_for(island, city))
    if not recipients:
        raise ValidationError(
            "Aucune pharmacie validée dans cette zone pour le moment."
        )
    cap = settings.AVAILABILITY_REQUEST_MAX_RECIPIENTS
    if len(recipients) > cap:
        raise ValidationError(
            f"{len(recipients)} pharmacies correspondent à cette zone, "
            f"au-delà du maximum de {cap}. Précisez la commune : plus la "
            "diffusion est large, plus la liste de médicaments circule."
        )

    request = AvailabilityRequest.objects.create(
        center=center,
        prescription=prescription,
        created_by=actor,
        island=island,
        city=city,
        expires_at=timezone.now()
        + timedelta(hours=settings.AVAILABILITY_REQUEST_TTL_HOURS),
    )
    for item in items:
        AvailabilityRequestItem.objects.create(
            request=request, medication=item.medication
        )
    for pharmacy in recipients:
        AvailabilityRequestRecipient.objects.create(
            request=request, pharmacy=pharmacy
        )
        notify_pharmacy_of_availability_request(pharmacy)
    audit(
        actor=actor,
        action=AuditAction.AVAILABILITY_REQUESTED,
        target=request,
        center=center,
        # Des ids et des COMPTEURS. Jamais un libellé de médicament : le
        # contenu d'une ordonnance est du detail_clinique (ADR 0005), et ce
        # journal se relit longtemps après.
        request_id=request.pk,
        center_id=center.pk,
        prescription_id=prescription.pk,
        island=island,
        item_count=len(items),
        recipient_count=len(recipients),
    )
    return request


@transaction.atomic
def answer_availability_request(*, actor, recipient, lines, comment=""):
    """Une officine répond : un constat daté, ligne par ligne.

    ``lines`` est un dictionnaire ``{item_id: bool}`` qui doit couvrir
    EXACTEMENT les médicaments de la demande — une réponse partielle
    laisserait le doute « pas répondu » ou « pas disponible », qui est
    précisément ce qu'on cherche à supprimer.

    Trois refus, tous relus EN BASE sous verrou de la demande (leçon S8 :
    une instance chargée avant la fermeture dirait « ouverte ») :
    demande fermée, demande PÉRIMÉE (même si le beat horaire n'est pas
    encore passé), officine non validée à l'instant de la réponse.
    """
    request = AvailabilityRequest.objects.select_for_update().get(
        pk=recipient.request_id
    )
    if request.status != RequestStatus.OPEN:
        raise ValidationError(
            "Cette demande est close : le centre n'attend plus de réponse."
        )
    if request.expires_at <= timezone.now():
        raise ValidationError(
            "Cette demande a expiré : le centre n'attend plus de réponse."
        )
    pharmacy_status = (
        Pharmacy.objects.filter(pk=recipient.pharmacy_id)
        .values_list("status", flat=True)
        .first()
    )
    if pharmacy_status != Status.VALIDATED:
        raise ValidationError(
            "Votre officine ne peut pas répondre pour le moment."
        )

    items = list(request.items.order_by("id"))
    expected = {item.pk for item in items}
    given = {int(key) for key in lines}
    if given != expected:
        raise ValidationError(
            "Répondez pour chacun des médicaments demandés."
        )

    response = AvailabilityResponse.objects.create(
        recipient=recipient, responded_by=actor, comment=comment or ""
    )
    for item in items:
        AvailabilityResponseLine.objects.create(
            response=response,
            item=item,
            is_available=bool(lines[item.pk]),
        )
    available = sum(1 for item in items if lines[item.pk])
    audit(
        actor=actor,
        action=AuditAction.AVAILABILITY_ANSWERED,
        target=response,
        # PAS de ``center`` : l'action est celle d'un acteur HORS tenant, et
        # le journal d'un directeur n'a pas à devenir la fenêtre par
        # laquelle le réseau se lit.
        response_id=response.pk,
        request_id=request.pk,
        pharmacy_id=recipient.pharmacy_id,
        available_count=available,
        item_count=len(items),
        has_comment=bool(response.comment),
    )
    return response


@transaction.atomic
def close_availability_request(*, actor, request, reason=CloseReason.MANUAL):
    """Fermer une demande — « on a trouvé », ou la péremption.

    Sérialisé sur la ligne : une fermeture concurrente d'une réponse en vol
    ne peut pas laisser une réponse orpheline sur une demande close.
    """
    request = AvailabilityRequest.objects.select_for_update().get(pk=request.pk)
    if request.status != RequestStatus.OPEN:
        raise ValidationError("Cette demande est déjà close.")
    request.status = RequestStatus.CLOSED
    request.closed_at = timezone.now()
    request.close_reason = reason
    request.save(
        update_fields=["status", "closed_at", "close_reason", "updated_at"]
    )
    audit(
        actor=actor,
        action=AuditAction.AVAILABILITY_CLOSED,
        target=request,
        center=request.center,
        request_id=request.pk,
        center_id=request.center_id,
        close_reason=reason,
    )
    return request


def close_stale_availability_requests():
    """Péremption horaire (ADR 0022 décision 8) — acteur SYSTÈME.

    Un « disponible » vieux de trois semaines est un faux espoir, et un faux
    espoir se paie en trajet. Chaque fermeture passe par le service
    ci-dessus (verrou + audit), jamais par un ``update()`` de masse : la
    course avec une réponse en vol est ainsi arbitrée ligne par ligne.
    """
    stale = AvailabilityRequest.objects.filter(
        status=RequestStatus.OPEN, expires_at__lte=timezone.now()
    ).order_by("pk")
    closed = 0
    for request in stale:
        try:
            with transaction.atomic():
                close_availability_request(
                    actor=None, request=request, reason=CloseReason.EXPIRED
                )
                closed += 1
        except ValidationError:
            # Fermée entre-temps par le centre : rien à faire, et surtout
            # pas d'échec de la tâche entière.
            continue
    return closed


# ---------------------------------------------------------------------------
# Lectures (les vues scellent leur queryset dessus)
# ---------------------------------------------------------------------------


def center_requests_qs(center):
    """Les demandes lancées PAR ce centre, avec de quoi les afficher."""
    return (
        AvailabilityRequest.objects.filter(center=center)
        .annotate(
            recipient_count=Count("recipients", distinct=True),
            response_count=Count(
                "recipients__responses", distinct=True
            ),
            last_response_at=Max("recipients__responses__created_at"),
        )
        .order_by("-created_at", "-id")
    )


def prescription_requests_qs(prescription):
    """Les demandes d'UNE ordonnance — lues par le centre ET par le patient.

    Le patient consulte, il ne lance pas (arbitrage PO n° 3) : cette
    fonction n'a pas de pendant en écriture. Les deux audiences partagent le
    queryset ; ce sont les SÉRIALISEURS qui diffèrent (le commentaire d'une
    officine ne descend pas dans le carnet — ADR 0022 décision 3).
    """
    return (
        AvailabilityRequest.objects.filter(prescription=prescription)
        .annotate(
            recipient_count=Count("recipients", distinct=True),
            response_count=Count("recipients__responses", distinct=True),
            last_response_at=Max("recipients__responses__created_at"),
        )
        .order_by("-created_at", "-id")
    )


def pharmacy_inbox_qs(pharmacy):
    """La boîte de réception d'une officine — par les lignes de diffusion.

    Jamais un filtre « ma commune » recalculé : ce qui a été adressé a été
    adressé, et ce qui ne l'a pas été n'existe pas pour cette officine.
    """
    return (
        AvailabilityRequestRecipient.objects.for_pharmacy(pharmacy)
        .select_related("request")
        .prefetch_related("request__items", "responses__lines")
        .order_by("-created_at", "-id")
    )


def latest_response(recipient):
    """La dernière réponse d'une officine à une demande (celle qui fait foi)."""
    return recipient.responses.order_by("-created_at", "-id").first()
