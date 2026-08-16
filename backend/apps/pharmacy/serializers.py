"""Sérialiseurs du réseau — **une section par audience** (S9, ADR 0022).

Ce fichier est le lieu où l'invariant du sprint se vérifie à l'œil nu :

    une pharmacie connaît une ZONE, une LISTE DE MÉDICAMENTS et un NUMÉRO
    de demande. Rien d'autre.

Les payloads sortants vers le réseau sont donc des **listes blanches
écrites à la main** (jamais ``fields = "__all__"``, jamais un ``+=`` sur la
liste d'un parent — leçon S8 : la concaténation de champs entre deux
sérialiseurs d'audiences différentes est exactement le geste qui ouvre le
mauvais champ au mauvais lecteur).

Ce qui n'est nulle part dans la section « pharmacie » ci-dessous, et ne doit
jamais y entrer : le centre demandeur, l'ordonnance, la consultation, le
patient (nom, id, téléphone, âge, sexe), le prescripteur, la posologie.
"""

from rest_framework import serializers

from apps.common.geo import Island
from apps.pharmacy.models import (
    AvailabilityRequest,
    AvailabilityRequestItem,
    AvailabilityResponse,
    Pharmacy,
    PharmacyDocument,
    PharmacyMembership,
)

#: Borne haute des listes acceptées en ENTRÉE (revue adversariale S9). Elle
#: ne dit rien du métier — une ordonnance de plus de cent lignes n'existe
#: pas — et elle évite qu'un corps hostile (côté centre pour ``item_ids``,
#: côté PHARMACIE pour les lignes de réponse, c'est-à-dire depuis un acteur
#: hors tenant) fasse matérialiser une liste sans fin avant d'être refusé.
MAX_ITEMS_PER_REQUEST = 100


# ---------------------------------------------------------------------------
# Audience : TOUT LE MONDE dans le réseau — l'annuaire
# ---------------------------------------------------------------------------


class PharmacyDirectorySerializer(serializers.ModelSerializer):
    """Une officine telle que le centre et le patient la voient.

    Ces cinq champs sont **publics par nature** dans le réseau : c'est ce
    qu'une enseigne affiche sur sa devanture, et c'est ce qui permet à un
    patient d'y aller. Le statut n'y est pas : l'annuaire ne rend que des
    officines validées (``services.pharmacy_directory_qs``), donc le champ
    n'apprendrait rien — et il ferait de l'annuaire une fenêtre sur les
    décisions de la plateforme.
    """

    class Meta:
        model = Pharmacy
        fields = ["id", "name", "island", "city", "address", "phone"]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Audience : le CENTRE demandeur (rôles cliniques + pharmacien)
# ---------------------------------------------------------------------------


class AvailabilityItemSerializer(serializers.ModelSerializer):
    """Un médicament parti au réseau — la copie figée, pas la ligne source."""

    class Meta:
        model = AvailabilityRequestItem
        fields = ["id", "medication"]
        read_only_fields = fields


class _ResponseLineSerializer(serializers.Serializer):
    """« Ce médicament-là : oui / non. » Partagé par les trois lecteurs."""

    item = serializers.IntegerField(source="item_id", read_only=True)
    is_available = serializers.BooleanField(read_only=True)


class AvailabilityResponseCenterSerializer(serializers.ModelSerializer):
    """La réponse d'une officine, telle que le CENTRE la lit.

    Elle porte le ``comment`` — texte libre écrit par un tiers, utile au
    personnel (« j'ai le générique ») et qui s'arrête ici : il **ne descend
    pas** dans le carnet du patient (ADR 0022 décision 3).
    """

    pharmacy = PharmacyDirectorySerializer(
        source="recipient.pharmacy", read_only=True
    )
    lines = _ResponseLineSerializer(many=True, read_only=True)

    class Meta:
        model = AvailabilityResponse
        fields = ["id", "pharmacy", "comment", "lines", "created_at"]
        read_only_fields = fields


class AvailabilityRequestCenterSerializer(serializers.ModelSerializer):
    """Une demande vue du centre : la liste envoyée, la zone, l'avancement.

    ``recipient_count`` / ``response_count`` / ``last_response_at`` sont
    annotés par ``services.center_requests_qs`` (une jointure agrégée, pas
    de N+1) et valent ``0``/``null`` dans la réponse d'une écriture, où
    l'objet n'est pas annoté — le contrat frontend le dit.
    """

    items = AvailabilityItemSerializer(many=True, read_only=True)
    recipient_count = serializers.IntegerField(read_only=True, default=0)
    response_count = serializers.IntegerField(read_only=True, default=0)
    last_response_at = serializers.DateTimeField(read_only=True, default=None)

    class Meta:
        model = AvailabilityRequest
        fields = [
            "id", "prescription", "island", "city", "status", "close_reason",
            "items", "recipient_count", "response_count", "last_response_at",
            "created_at", "expires_at", "closed_at",
        ]
        read_only_fields = fields


class AvailabilityRequestCenterDetailSerializer(
    AvailabilityRequestCenterSerializer
):
    """La même, plus les réponses reçues.

    ``Meta.fields`` est une liste **NEUVE**, jamais un ``+=`` sur celle du
    parent : la leçon S8 vaut ici deux fois, puisque la classe parente est
    aussi celle que lit la liste.
    """

    responses = serializers.SerializerMethodField()

    class Meta(AvailabilityRequestCenterSerializer.Meta):
        fields = [
            "id", "prescription", "island", "city", "status", "close_reason",
            "items", "recipient_count", "response_count", "last_response_at",
            "created_at", "expires_at", "closed_at", "responses",
        ]
        read_only_fields = fields

    def get_responses(self, request) -> list:
        responses = (
            AvailabilityResponse.objects.filter(recipient__request=request)
            .select_related("recipient__pharmacy")
            .prefetch_related("lines")
            .order_by("-created_at", "-id")
        )
        return AvailabilityResponseCenterSerializer(responses, many=True).data


class AvailabilityRequestCreateSerializer(serializers.Serializer):
    """Le corps de l'envoi : une zone, et **les lignes cochées**.

    ``item_ids`` est obligatoire et explicite — le service ne prend jamais
    « toute l'ordonnance » par défaut. C'est la traduction, dans le
    contrat d'API, de la garde n° 1 de l'ADR 0022 : *le prescripteur choisit
    ce qui sort*.
    """

    island = serializers.ChoiceField(
        choices=Island.choices,
        error_messages={"invalid_choice": "Île inconnue."},
    )
    city = serializers.CharField(
        max_length=128, required=False, allow_blank=True, default=""
    )
    item_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        # Borne HAUTE (revue adversariale S9) : sans elle, un corps de cent
        # mille identifiants était matérialisé puis passé tel quel dans un
        # ``pk__in`` avant d'être refusé. Une ordonnance de plus de cent
        # lignes n'existe pas ; refuser tôt coûte moins qu'un ``IN`` géant.
        max_length=MAX_ITEMS_PER_REQUEST,
        error_messages={
            "empty": "Cochez au moins un médicament à chercher.",
            "max_length": (
                "Trop de lignes sélectionnées pour une seule recherche."
            ),
        },
    )


# ---------------------------------------------------------------------------
# Audience : le PATIENT (son carnet)
# ---------------------------------------------------------------------------


class AvailabilityResponsePatientSerializer(serializers.ModelSerializer):
    """« Cette pharmacie-là a ces médicaments. »

    Volontairement SANS ``comment`` : c'est du texte non modéré écrit par un
    tiers, et l'écran du patient doit rester une information, pas une
    conversation (ADR 0022 décision 3). Le nom, la commune et le téléphone
    de l'officine y sont, eux : c'est exactement ce qui évite le trajet
    inutile.
    """

    pharmacy = PharmacyDirectorySerializer(
        source="recipient.pharmacy", read_only=True
    )
    lines = _ResponseLineSerializer(many=True, read_only=True)

    class Meta:
        model = AvailabilityResponse
        fields = ["id", "pharmacy", "lines", "created_at"]
        read_only_fields = fields


class AvailabilityRequestPatientSerializer(serializers.ModelSerializer):
    """Une recherche telle que le patient la lit dans son carnet.

    Ni le centre (il le connaît, mais la ligne n'a pas à le porter), ni
    l'auteur, ni les compteurs de diffusion : « on a cherché ces
    médicaments, voilà qui les a. »
    """

    items = AvailabilityItemSerializer(many=True, read_only=True)
    responses = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilityRequest
        fields = [
            "id", "status", "city", "island", "items", "responses",
            "created_at", "expires_at",
        ]
        read_only_fields = fields

    def get_responses(self, request) -> list:
        responses = (
            AvailabilityResponse.objects.filter(recipient__request=request)
            .select_related("recipient__pharmacy")
            .prefetch_related("lines")
            .order_by("-created_at", "-id")
        )
        return AvailabilityResponsePatientSerializer(responses, many=True).data


# ---------------------------------------------------------------------------
# Audience : LA PHARMACIE (5ᵉ espace) — la liste blanche du sprint
# ---------------------------------------------------------------------------


class PharmacySelfSerializer(serializers.ModelSerializer):
    """L'officine telle qu'elle se voit elle-même.

    ``status_reason`` y est — et c'est le miroir exact de ``kyc_reason``
    pour un directeur de centre (ADR 0017) : suspendre quelqu'un sans lui
    dire ce qu'il doit corriger n'est pas une décision, c'est une punition.
    Il n'apparaît nulle part ailleurs (ni annuaire, ni audit).
    """

    class Meta:
        model = Pharmacy
        fields = [
            "id", "name", "island", "city", "address", "phone", "email",
            "status", "status_reason", "status_updated_at", "created_at",
        ]
        read_only_fields = fields


class PharmacyPatchSerializer(serializers.Serializer):
    """Ce qu'une officine corrige elle-même — jamais son statut."""

    name = serializers.CharField(max_length=255, required=False)
    island = serializers.ChoiceField(
        choices=Island.choices,
        required=False,
        error_messages={"invalid_choice": "Île inconnue."},
    )
    city = serializers.CharField(max_length=128, required=False)
    address = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class PharmacyMemberSerializer(serializers.ModelSerializer):
    """Les collègues de l'officine — des noms, jamais des numéros.

    Le téléphone d'un membre n'est rendu à personne : il a servi à créer le
    compte (pivot d'identité, ADR 0001) et n'a aucune raison de circuler
    dans une liste. Même posture que l'annuaire du personnel d'un centre.
    """

    display_name = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyMembership
        fields = ["id", "display_name", "is_active", "created_at"]
        read_only_fields = fields

    def get_display_name(self, membership) -> str:
        user = membership.user
        return f"{user.first_name} {user.last_name}".strip() or user.username


class PharmacyMemberCreateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class PharmacyDocumentSerializer(serializers.ModelSerializer):
    """Une pièce justificative — **aucune URL de fichier**.

    Le stockage privé n'en produit pas (``PrivateMediaStorage.url()`` lève
    toujours) : la lecture passe par l'endpoint de téléchargement
    authentifié, jamais par un lien.
    """

    class Meta:
        model = PharmacyDocument
        fields = ["id", "doc_type", "created_at", "archived_at"]
        read_only_fields = fields


class PharmacyDocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(
        error_messages={"required": "Le fichier image est requis."}
    )
    doc_type = serializers.ChoiceField(
        choices=PharmacyDocument.DocType.choices,
        error_messages={"invalid_choice": "Type de pièce invalide."},
    )


class InboxResponseSerializer(serializers.ModelSerializer):
    """La réponse que CETTE officine a déjà donnée (la dernière fait foi)."""

    lines = _ResponseLineSerializer(many=True, read_only=True)

    class Meta:
        model = AvailabilityResponse
        fields = ["id", "comment", "lines", "created_at"]
        read_only_fields = fields


class InboxRequestSerializer(serializers.Serializer):
    """**LA liste blanche du sprint.** Ce qu'une pharmacie voit d'une demande.

    Sérialiseur ``Serializer`` nu et non ``ModelSerializer`` : il est monté
    sur la ligne de DIFFUSION (``AvailabilityRequestRecipient``), pas sur la
    demande — donc aucun champ de ``AvailabilityRequest`` ne peut arriver
    ici par héritage, par ``__all__`` ou par distraction. Le centre et
    l'ordonnance ne sont pas « exclus » : ils sont **hors de portée**.

    Champ par champ, et pourquoi :

    - ``id`` — l'id de la LIGNE DE DIFFUSION, jamais celui de la demande :
      deux officines qui compareraient leurs écrans ne peuvent pas savoir
      qu'elles parlent de la même recherche ;
    - ``island`` / ``city`` — pour juger si le patient peut venir jusqu'ici.
      C'est tout ce que la zone dit : jamais le nom du centre (décision 2) ;
    - ``created_at`` / ``expires_at`` — la FRAÎCHEUR, qui est la moitié de
      l'utilité du service ; ``status`` dit si le centre attend encore ;
    - ``items`` — la liste, et rien que les libellés (la posologie ne sort
      pas) ;
    - ``my_response`` — ce que CETTE officine a répondu ; jamais ce que les
      autres ont répondu, qui ne la regarde pas et serait un signal
      commercial sur ses concurrentes.
    """

    id = serializers.IntegerField(read_only=True)
    island = serializers.CharField(source="request.island", read_only=True)
    city = serializers.CharField(source="request.city", read_only=True)
    status = serializers.CharField(source="request.status", read_only=True)
    created_at = serializers.DateTimeField(
        source="request.created_at", read_only=True
    )
    expires_at = serializers.DateTimeField(
        source="request.expires_at", read_only=True
    )
    items = AvailabilityItemSerializer(
        source="request.items", many=True, read_only=True
    )
    my_response = serializers.SerializerMethodField()

    def get_my_response(self, recipient) -> dict | None:
        response = max(
            recipient.responses.all(),
            key=lambda row: (row.created_at, row.pk),
            default=None,
        )
        return InboxResponseSerializer(response).data if response else None


class AvailabilityAnswerLineSerializer(serializers.Serializer):
    item = serializers.IntegerField(min_value=1)
    is_available = serializers.BooleanField()


class AvailabilityAnswerSerializer(serializers.Serializer):
    """Le corps d'une réponse : une ligne par médicament, toutes obligatoires.

    Le service refuse une couverture partielle — « pas répondu » et « pas
    disponible » doivent rester deux choses distinctes pour le patient.
    """

    lines = AvailabilityAnswerLineSerializer(
        many=True, allow_empty=False, max_length=MAX_ITEMS_PER_REQUEST
    )
    comment = serializers.CharField(
        max_length=280, required=False, allow_blank=True, default=""
    )
