"""Sérialiseurs du BACK-OFFICE pour le réseau (S9, ADR 0022).

Audience : ``PlatformStaff``. L'invariant de l'ADR 0017 vaut ici sans
retouche — **l'exploitant ne voit aucun patient** —, et il est plus facile
à tenir qu'ailleurs : une pharmacie n'a pas de patient à montrer. Ce qui est
rendu, ce sont des officines, des compteurs et des pièces.

Ce que la plateforme ne voit PAS, et c'est délibéré : le CONTENU des
demandes de disponibilité (les médicaments qui circulent dans le réseau).
Superviser des officines n'est pas lire les ordonnances de tout le pays —
la réconciliation technique de S4 avait déjà ce principe.
"""

from rest_framework import serializers

from apps.common.geo import Island
from apps.pharmacy.models import Pharmacy


class PlatformPharmacySerializer(serializers.ModelSerializer):
    """Une officine vue de Chioni : sa fiche, son statut, ses compteurs.

    Des COMPTEURS, jamais une liste de personnes : savoir qu'une pharmacie
    n'a plus aucun membre actif est de la supervision (la boîte de réception
    n'est plus relevée) ; parcourir ses gens ne l'est pas.
    """

    member_active_count = serializers.IntegerField(read_only=True, default=0)
    document_count = serializers.IntegerField(read_only=True, default=0)
    received_request_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Pharmacy
        fields = [
            "id", "name", "island", "city", "address", "phone", "email",
            "status", "status_reason", "status_updated_at",
            "member_active_count", "document_count", "received_request_count",
            "created_at",
        ]
        read_only_fields = fields


class PlatformPharmacyCreateSerializer(serializers.Serializer):
    """Enregistrer une officine ET sa première personne, en un appel.

    ``status`` n'est pas une entrée : une pharmacie naît « en attente » et
    seule la transition dédiée la déplace (miroir du KYC d'un centre).
    """

    name = serializers.CharField(max_length=255)
    island = serializers.ChoiceField(
        choices=Island.choices,
        error_messages={"invalid_choice": "Île inconnue."},
    )
    city = serializers.CharField(max_length=128)
    address = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    phone = serializers.CharField(
        max_length=32, required=False, allow_blank=True, default=""
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    member_phone = serializers.CharField(max_length=32)
    member_first_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    member_last_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )


class PlatformPharmacyStatusSerializer(serializers.Serializer):
    """La transition de statut — motif OBLIGATOIRE pour suspendre.

    Le motif est vérifié par le service (source unique) ; il est déclaré
    facultatif ici pour que le refus soit UN message métier français et non
    une erreur de champ générique.
    """

    status = serializers.ChoiceField(
        choices=Pharmacy.Status.choices,
        error_messages={"invalid_choice": "Statut de pharmacie inconnu."},
    )
    reason = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=2000
    )
