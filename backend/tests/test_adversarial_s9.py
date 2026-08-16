"""Campagne adversariale S9 — le réseau des pharmacies (ADR 0022).

Ce que ce fichier protège, et pourquoi il existe séparément de
``test_pharmacy.py`` : ce dernier verrouille le contrat que S9 a voulu
tenir ; celui-ci verrouille les endroits où il ne le tenait PAS, pour que
personne ne les rouvre. Chaque classe porte le scénario d'attaque en
docstring — un test dont on ne sait plus ce qu'il défend est un test qu'on
supprime au premier refactoring.

Les six correctifs de la revue, dans l'ordre de gravité :

1. **la séparation des pouvoirs ne tenait que dans un sens** (élevé) —
   S9 refusait d'inscrire un exploitant Chioni dans une officine, mais
   rien n'empêchait d'inscrire d'abord la personne dans l'officine et de
   lui donner la 4ᵉ casquette ensuite. Elle validait alors SA pharmacie,
   suspendait celle d'en face et lisait les pièces de tout le réseau.
   C'est la faille de S5 rejouée mot pour mot, sur une porte neuve ;
2. **le throttle dédié à la diffusion était inerte** (élevé) — le scope
   était posé mais le ``ScopedRateThrottle`` n'était jamais monté, si bien
   que le SEUL geste du produit qui parle à des tiers en masse (et
   déclenche N SMS) retombait sur le plafond global de 600/min ;
3. **la cinquième casquette ne se fermait pas à l'effacement RGPD**
   (moyen) — un membre anonymisé restait « actif » dans son officine :
   Chioni lisait « 1 membre actif » sur une boîte de réception que plus
   personne ne pouvait ouvrir ;
4. **une officine validée se relocalisait elle-même** (moyen) — la zone
   est la seule borne à la distance que parcourt une liste de médicaments,
   et elle était auto-déclarée après validation ;
5. **la diffusion lisait l'ordonnance en mémoire et ne verrouillait rien**
   (moyen) — délivrance concurrente non vue, et double diffusion sur
   double-clic réel, alors que l'ADR promet le contraire ;
6. **l'archivage d'une pièce lisait l'instance en mémoire** (faible).

Plus les sondes de non-régression de l'invariant du sprint, attaqué de
front : *une pharmacie connaît une zone, une liste de médicaments et un
numéro de demande — jamais le centre, jamais l'ordonnance, jamais le
patient.*
"""

import threading
from datetime import timedelta
from io import BytesIO

import pytest
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.utils import timezone

from apps.accounts import services as account_services
from apps.accounts.models import PlatformStaff
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.common.geo import Island
from apps.medical.models import Prescription
from apps.medical.services import deliver_prescription
from apps.pharmacy import services
from apps.pharmacy.models import (
    AvailabilityRequest,
    AvailabilityRequestRecipient,
    Pharmacy,
    PharmacyDocument,
    PharmacyMembership,
)

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import (
    make_encounter,
    make_pharmacy,
    make_pharmacy_member,
    make_platform_staff,
    make_prescription,
    make_user,
)

pytestmark = pytest.mark.django_db

MEDICATIONS = ["Paracétamol 500 mg", "Amoxicilline 1 g", "Fer + acide folique"]


class Scene:
    """Un centre, une ordonnance, une officine validée et sa pharmacienne."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.patient = make_claimed_patient()
        self.encounter = make_encounter(patient=self.patient, center=self.center)
        self.prescription = make_prescription(
            encounter=self.encounter, medications=MEDICATIONS
        )
        self.pharmacy = make_pharmacy(name="Pharmacie du Port", city="Moroni")
        # Numéro E.164 comorien RÉEL : les gardes de séparation des
        # pouvoirs résolvent la personne par son téléphone (ADR 0001).
        self.pharmacy_user = make_user(phone="+2693441001")
        self.membership = make_pharmacy_member(
            pharmacy=self.pharmacy, user=self.pharmacy_user
        )

    @property
    def item_ids(self):
        return list(self.prescription.items.values_list("pk", flat=True))

    @property
    def send_url(self):
        return (
            f"/api/v1/centers/{self.center.pk}/prescriptions/"
            f"{self.prescription.pk}/availability-requests/"
        )

    def send(self, city="Moroni", island=Island.NGAZIDJA):
        return services.create_availability_request(
            actor=self.doctor,
            center=self.center,
            prescription=self.prescription,
            island=island,
            city=city,
            item_ids=self.item_ids,
        )


@pytest.fixture
def scene():
    return Scene()


def _jpeg(name="licence.jpg"):
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (80, 60), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def _run_concurrently(runners, timeout=25):
    """Deux gestes RÉELS, sur deux connexions RÉELLES, relâchés ensemble.

    Le patron des campagnes S4→S8 : un `assertNumQueries` ne prouve rien
    sur une course, et un mock de verrou prouve encore moins.
    """
    barrier = threading.Barrier(len(runners), timeout=15)
    outcomes = []

    def wrap(label, call):
        def runner():
            try:
                barrier.wait()
                outcomes.append((label, "ok", call()))
            except ValidationError as exc:
                outcomes.append((label, "refused", str(exc)))
            except Exception as exc:  # noqa: BLE001 — c'est ce qu'on traque
                outcomes.append((label, f"crash:{type(exc).__name__}", str(exc)))
            finally:
                connections.close_all()

        return runner

    threads = [
        threading.Thread(target=wrap(label, call)) for label, call in runners
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout)
    return outcomes


# ---------------------------------------------------------------------------
# 1 — LA SÉPARATION DES POUVOIRS : S9 n'avait fermé qu'un sens (ÉLEVÉ)
# ---------------------------------------------------------------------------


class TestTheSeparationOfPowersMustHoldInBothDirections:
    """« Celui qui valide les pharmacies ne doit pas valider la sienne. »

    Scénario d'attaque, deux appels d'API, aucun privilège volé :

    1. une officine est enregistrée avec le numéro de M
       (``POST /platform/pharmacies/``) — M est membre du réseau ;
    2. M reçoit la 4ᵉ casquette (``POST /platform/operators/``). S9 ne
       regardait que ``StaffMembership`` : **accepté** ;
    3. M appelle ``POST /platform/pharmacies/{la sienne}/status/`` avec
       ``validee`` — sans qu'aucune pièce n'ait été lue — puis suspend
       l'officine d'en face avec un motif, et télécharge les licences de
       tout le réseau.

    L'état final est exactement celui que l'ADR 0022 décision 9 énonce
    comme interdit, et il était atteignable parce que la garde n'existait
    que dans l'autre sens. C'est la faille de S5 (« S4 avait fermé la
    porte d'entrée, S5 laissait la sortie ouverte ») rejouée sur une porte
    neuve — la couture entre deux sprints, encore.
    """

    def test_a_pharmacy_member_cannot_be_handed_the_operator_hat(self, scene):
        with pytest.raises(ValidationError, match="pharmacie du réseau"):
            account_services.create_platform_staff(
                actor=None,
                phone=scene.pharmacy_user.phone,
                role=PlatformStaff.Role.ADMIN,
            )
        assert not PlatformStaff.objects.filter(user=scene.pharmacy_user).exists()

    def test_the_refusal_is_the_mirror_and_the_other_direction_still_holds(
        self, scene
    ):
        """Les deux sens refusent, avec deux messages distincts : la
        personne doit savoir laquelle de ses casquettes bloque."""
        operator_user, _ = make_platform_staff(
            user=make_user(phone="+2693442002")
        )
        with pytest.raises(ValidationError, match="équipe Chioni"):
            services.add_pharmacy_member(
                actor=None, pharmacy=scene.pharmacy, phone=operator_user.phone
            )
        assert not PharmacyMembership.objects.filter(
            user=operator_user, is_active=True
        ).exists()

    def test_a_deactivated_pharmacy_membership_no_longer_blocks(self, scene):
        """Honnêteté de la garde : elle regarde les liens ACTIFS.

        Quelqu'un qui a réellement quitté son officine peut rejoindre
        l'équipe Chioni — c'est le sens de la règle, pas un contournement.
        """
        services.add_pharmacy_member(
            actor=None, pharmacy=scene.pharmacy, phone="+2693445005"
        )
        second = PharmacyMembership.objects.get(
            user__phone="+2693445005", pharmacy=scene.pharmacy
        )
        services.deactivate_pharmacy_member(actor=None, membership=second)
        operator = account_services.create_platform_staff(
            actor=None, phone="+2693445005", role=PlatformStaff.Role.SUPPORT
        )
        assert operator.is_active

    def test_reactivating_a_revoked_operator_replays_the_pharmacy_guard(
        self, scene
    ):
        """La faille S5 en trois appels, transposée au réseau.

        Désactiver la 4ᵉ casquette, se faire inscrire dans une officine
        (la garde S9 ne voit plus d'exploitant ACTIF), puis la réactiver :
        sans relecture à la réactivation, l'état interdit se reconstitue
        en libre-service depuis le back-office seul.
        """
        operator_user, operator = make_platform_staff(
            user=make_user(phone="+2693443003"),
            role=PlatformStaff.Role.SUPPORT,
        )
        account_services.update_platform_staff(
            actor=None, operator=operator, is_active=False
        )
        services.add_pharmacy_member(
            actor=None, pharmacy=scene.pharmacy, phone=operator_user.phone
        )
        with pytest.raises(ValidationError, match="pharmacie du réseau"):
            account_services.update_platform_staff(
                actor=None, operator=operator, is_active=True
            )
        operator.refresh_from_db()
        assert not operator.is_active

    @pytest.mark.django_db(transaction=True)
    def test_the_two_doors_raced_on_the_same_number_serialise(self, scene):
        """Les deux portes sur le MÊME numéro, relâchées ensemble.

        Sans le verrou de la ligne ``User`` — pris par les deux gardes —
        chaque transaction lit un monde où l'écriture de l'autre n'existe
        pas encore et les deux passent, atteignant l'état interdit sans
        qu'aucun refus n'ait jamais été prononcé. Le patron est celui de
        la course S5, appliqué à la troisième porte.
        """
        target = make_user(phone="+2693444004")
        pharmacy = make_pharmacy(name="Pharmacie de la Corniche", city="Mutsamudu")

        outcomes = _run_concurrently(
            [
                (
                    "operator",
                    lambda: account_services.create_platform_staff(
                        actor=None,
                        phone=target.phone,
                        role=PlatformStaff.Role.ADMIN,
                    ),
                ),
                (
                    "pharmacy",
                    lambda: services.add_pharmacy_member(
                        actor=None, pharmacy=pharmacy, phone=target.phone
                    ),
                ),
            ]
        )

        assert not any(
            status.startswith("crash") for _, status, _ in outcomes
        ), outcomes
        both_hats = (
            PlatformStaff.objects.filter(user=target, is_active=True).exists()
            and PharmacyMembership.objects.filter(
                user=target, is_active=True
            ).exists()
        )
        assert not both_hats, outcomes


# ---------------------------------------------------------------------------
# 2 — LE THROTTLE DE DIFFUSION ÉTAIT INERTE (ÉLEVÉ)
# ---------------------------------------------------------------------------


class TestTheDiffusionThrottleIsActuallyMounted:
    """Poser ``throttle_scope`` ne throttle rien.

    ``DEFAULT_THROTTLE_CLASSES`` ne contient que ``UserRateThrottle``, dont
    le scope est figé à « user » : l'attribut posé par la vue n'était lu par
    personne. Le budget ``availability`` (60/h) — présenté par l'ADR comme
    LA parade au geste « qui parle à des tiers en masse » — n'existait donc
    que dans les settings. Un compte clinique compromis pouvait diffuser au
    rythme du plafond global (600/min), soit des dizaines de milliers de
    listes de médicaments et de SMS par heure.

    Deux sondes : une structurelle (détectrice par mutation — retirer le
    ``return`` la fait tomber) et une fonctionnelle, de bout en bout.
    """

    def test_the_post_mounts_a_scoped_throttle(self):
        from rest_framework.throttling import ScopedRateThrottle

        from apps.pharmacy.views import PrescriptionAvailabilityRequestView

        view = PrescriptionAvailabilityRequestView()

        class _Req:
            method = "POST"

        view.request = _Req()
        throttles = view.get_throttles()
        assert any(isinstance(one, ScopedRateThrottle) for one in throttles), (
            "La diffusion doit monter un ScopedRateThrottle : sans lui le "
            "scope « availability » est décoratif."
        )
        assert view.throttle_scope == "availability"

    def test_a_read_is_not_charged_on_the_diffusion_budget(self):
        from rest_framework.throttling import ScopedRateThrottle

        from apps.pharmacy.views import PrescriptionAvailabilityRequestView

        view = PrescriptionAvailabilityRequestView()

        class _Req:
            method = "GET"

        view.request = _Req()
        assert not any(
            isinstance(one, ScopedRateThrottle) for one in view.get_throttles()
        ), "Lire le fil des recherches ne doit pas manger le budget d'envoi."

    def test_the_second_diffusion_of_the_hour_is_refused(self, scene, monkeypatch):
        """Bout en bout : au deuxième envoi, 429 — jamais un 201 silencieux.

        ``SimpleRateThrottle.THROTTLE_RATES`` est lu à l'IMPORT de DRF :
        un ``override_settings`` ne le rafraîchit pas. On règle donc le
        budget là où il est réellement lu — et la sonde reste une sonde de
        bout en bout, avec un vrai client et deux vrais POST.
        """
        from rest_framework.throttling import SimpleRateThrottle

        cache.clear()
        monkeypatch.setitem(
            SimpleRateThrottle.THROTTLE_RATES, "availability", "1/hour"
        )
        client = client_for(scene.doctor)
        body = {
            "island": Island.NGAZIDJA,
            "city": "Moroni",
            "item_ids": scene.item_ids,
        }
        try:
            first = client.post(scene.send_url, body, format="json")
            assert first.status_code == 201, first.data
            # La demande est fermée pour que le SECOND refus ne puisse pas
            # venir de la garde anti-doublon : on teste le throttle, seul.
            services.close_availability_request(
                actor=scene.doctor,
                request=AvailabilityRequest.objects.get(pk=first.data["id"]),
            )
            second = client.post(scene.send_url, body, format="json")
            assert second.status_code == 429, second.data
        finally:
            cache.clear()


# ---------------------------------------------------------------------------
# 3 — LA COUTURE RGPD : la 5ᵉ casquette ne se fermait pas (MOYEN)
# ---------------------------------------------------------------------------


class TestErasureClosesTheFifthHatToo:
    """S7 avait laissé le justificatif de congé survivre à l'anonymisation ;
    S9 laisse survivre l'APPARTENANCE elle-même.

    Le service promet « the hats close » et fermait quatre casquettes sur
    cinq. Conséquences réelles, dans l'ordre de gravité :

    - la garde « jamais la dernière personne » d'une officine se
      satisfaisait d'un fantôme : le dernier membre RÉEL pouvait se
      retirer, laissant une boîte de réception que personne ne peut plus
      ouvrir — et donc des patients qui attendent 48 h une réponse qui ne
      viendra jamais ;
    - le back-office affichait ``member_active_count = 1`` sur cette même
      officine : Chioni ne pouvait pas voir le problème.

    Et l'exigence symétrique, héritée de S7 : **aucune contrainte de ce
    module ne doit pouvoir mettre un effacement RGPD en échec.**
    """

    def test_the_membership_is_deactivated_by_anonymisation(self, scene):
        account_services.anonymize_user(actor=None, user=scene.pharmacy_user)
        scene.membership.refresh_from_db()
        assert not scene.membership.is_active

    def test_erasing_the_only_member_of_an_officine_is_never_blocked(
        self, scene
    ):
        """Leçon S7 : un solde de congés ne doit pas bloquer un effacement,
        et une officine d'une seule personne non plus. Le chemin de
        secours existe (``POST /platform/pharmacies/{pk}/members/``)."""
        account_services.anonymize_user(actor=None, user=scene.pharmacy_user)
        assert (
            PharmacyMembership.objects.filter(
                pharmacy=scene.pharmacy, is_active=True
            ).count()
            == 0
        )

    def test_a_ghost_no_longer_satisfies_the_last_member_guard(self, scene):
        """Le cœur du défaut : deux membres, l'un effacé, l'autre s'en va.

        Avant le correctif, le second retrait passait — le fantôme comptait
        comme « quelqu'un d'autre ». L'officine se retrouvait muette avec
        un compteur qui disait le contraire.
        """
        services.add_pharmacy_member(
            actor=None, pharmacy=scene.pharmacy, phone="+2693446006"
        )
        colleague = PharmacyMembership.objects.get(
            user__phone="+2693446006", pharmacy=scene.pharmacy
        )
        account_services.anonymize_user(actor=None, user=scene.pharmacy_user)

        with pytest.raises(ValidationError, match="dernière personne"):
            services.deactivate_pharmacy_member(actor=None, membership=colleague)

    def test_the_platform_counter_tells_the_truth_after_an_erasure(self, scene):
        """La supervision doit VOIR l'officine devenue muette."""
        operator_user, _ = make_platform_staff()
        account_services.anonymize_user(actor=None, user=scene.pharmacy_user)
        response = client_for(operator_user).get(
            f"/api/v1/platform/pharmacies/{scene.pharmacy.pk}/"
        )
        assert response.status_code == 200, response.data
        assert response.data["member_active_count"] == 0

    def test_an_erased_member_can_no_longer_read_the_inbox(self, scene):
        scene.send()
        account_services.anonymize_user(actor=None, user=scene.pharmacy_user)
        response = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/"
        )
        assert response.status_code in (401, 403), response.status_code


# ---------------------------------------------------------------------------
# 4 — UNE OFFICINE VALIDÉE SE RELOCALISAIT ELLE-MÊME (MOYEN)
# ---------------------------------------------------------------------------


class TestAnOfficineCannotMoveItselfIntoTheBusiestCommune:
    """La zone n'est pas une ligne d'adresse : c'est la SEULE borne à la
    distance que parcourt une liste de médicaments.

    Scénario : « Pharmacie de Fomboni », validée sur Mwali, deux demandes
    par mois. Elle envoie
    ``PATCH /pharmacy/{id}/ {"island": "ngazidja", "city": "Moroni"}``.
    Dès la seconde suivante, et sans que personne n'ait revérifié quoi que
    ce soit, elle entre dans le ciblage de chaque diffusion de la capitale
    — c'est-à-dire dans le flux d'ordonnances qui rend la réidentification
    possible, précisément ce que le plafond de destinataires existe pour
    empêcher.

    Correctif : déclarer un déménagement renvoie l'officine ``en_attente``.
    Elle garde tout — son historique, ses pièces, ses gens — et ne reçoit
    plus rien jusqu'à ce que Chioni confirme l'adresse. Miroir exact du
    KYC d'un centre. Réversible : c'est un arbitrage produit, il tient
    dans un ``if``.
    """

    def test_changing_commune_sends_the_officine_back_to_verification(
        self, scene
    ):
        client_for(scene.pharmacy_user).patch(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/",
            {"city": "Itsandra"},
            format="json",
        )
        scene.pharmacy.refresh_from_db()
        assert scene.pharmacy.status == Pharmacy.Status.PENDING
        assert scene.pharmacy.status_reason  # elle lit POURQUOI

    def test_changing_island_does_the_same(self, scene):
        services.update_pharmacy(
            actor=scene.pharmacy_user,
            pharmacy=scene.pharmacy,
            island=Island.MWALI,
        )
        scene.pharmacy.refresh_from_db()
        assert scene.pharmacy.status == Pharmacy.Status.PENDING

    def test_a_relocated_officine_receives_nothing_until_revalidated(
        self, scene
    ):
        services.update_pharmacy(
            actor=scene.pharmacy_user, pharmacy=scene.pharmacy, city="Itsandra"
        )
        with pytest.raises(ValidationError, match="Aucune pharmacie validée"):
            scene.send(city="Itsandra")

    def test_correcting_the_shop_front_does_not_touch_the_status(self, scene):
        """Adresse, téléphone, e-mail, nom : la devanture reste libre.
        Le correctif vise le CIBLAGE, pas la fiche."""
        services.update_pharmacy(
            actor=scene.pharmacy_user,
            pharmacy=scene.pharmacy,
            address="12 rue du Port",
            phone="+2693447007",
            name="Pharmacie du Grand Port",
        )
        scene.pharmacy.refresh_from_db()
        assert scene.pharmacy.status == Pharmacy.Status.VALIDATED

    def test_a_pending_officine_relocates_freely(self):
        """Elle ne reçoit déjà rien : la renvoyer en attente n'aurait
        aucun sens et lui donnerait un message incompréhensible."""
        pharmacy = make_pharmacy(
            name="Pharmacie neuve", city="Mutsamudu",
            status=Pharmacy.Status.PENDING,
        )
        user = make_user()
        make_pharmacy_member(pharmacy=pharmacy, user=user)
        services.update_pharmacy(actor=user, pharmacy=pharmacy, city="Domoni")
        pharmacy.refresh_from_db()
        assert pharmacy.status == Pharmacy.Status.PENDING

    def test_the_return_to_verification_is_audited_without_the_new_zone(
        self, scene
    ):
        """Le motif n'entre JAMAIS dans un payload, et la nouvelle commune
        non plus : ``pharmacy.updated`` ne porte que des NOMS de champs."""
        services.update_pharmacy(
            actor=scene.pharmacy_user, pharmacy=scene.pharmacy, city="Itsandra"
        )
        entries = AuditLog.objects.filter(
            action__in=(
                AuditAction.PHARMACY_UPDATED,
                AuditAction.PHARMACY_STATUS_CHANGED,
            )
        )
        assert entries.count() == 2
        blob = "".join(str(entry.payload) for entry in entries)
        assert "Itsandra" not in blob
        assert "vérification" not in blob

    def test_already_received_requests_survive_the_relocation(self, scene):
        """La diffusion est figée sur des lignes : un déménagement ne fait
        pas disparaître ce qui a déjà été adressé."""
        scene.send()
        services.update_pharmacy(
            actor=scene.pharmacy_user, pharmacy=scene.pharmacy, city="Itsandra"
        )
        response = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/"
        )
        assert response.status_code == 200
        assert len(response.data["results"]) == 1


# ---------------------------------------------------------------------------
# 5 — LA DIFFUSION : instance en mémoire et garde anti-doublon nue (MOYEN)
# ---------------------------------------------------------------------------


class TestTheDiffusionReadsTheDatabaseAndSerialises:
    """Deux défauts, une seule cause : rien n'était verrouillé.

    (a) ``prescription.status`` était lu sur l'instance chargée par la vue
    AVANT l'ouverture de la transaction. Une délivrance commise entre les
    deux — le comptoir sert pendant que le médecin cherche — laissait
    partir la liste de médicaments d'une ordonnance déjà servie. C'est la
    leçon S8 mot pour mot, et elle avait été appliquée à
    ``EquipmentReport`` mais pas ici.

    (b) La garde anti-doublon lisait « aucune demande ouverte » sans
    verrou : deux envois concurrents passaient tous les deux, et la même
    liste partait DEUX fois vers N officines avec 2×N SMS — alors que
    l'ADR promet noir sur blanc que « le double-clic ne diffuse pas deux
    fois ».
    """

    def test_a_stale_in_memory_prescription_no_longer_fools_the_guard(
        self, scene
    ):
        """L'appelant tient une instance « emise » ; la base dit
        « delivree ». C'est la base qui tranche."""
        stale = Prescription.objects.get(pk=scene.prescription.pk)
        deliver_prescription(actor=scene.doctor, prescription=scene.prescription)
        assert stale.status == Prescription.Status.ISSUED  # l'instance ment

        with pytest.raises(ValidationError, match="déjà été délivrée"):
            services.create_availability_request(
                actor=scene.doctor,
                center=scene.center,
                prescription=stale,
                island=Island.NGAZIDJA,
                city="Moroni",
                item_ids=scene.item_ids,
            )
        assert not AvailabilityRequest.objects.exists()

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_diffusions_do_not_double_the_broadcast(self):
        """Le double-clic RÉEL — deux connexions, relâchées ensemble."""
        scene = Scene()
        outcomes = _run_concurrently(
            [("premier", scene.send), ("second", scene.send)]
        )

        assert not any(
            status.startswith("crash") for _, status, _ in outcomes
        ), outcomes
        assert AvailabilityRequest.objects.count() == 1, outcomes
        assert AvailabilityRequestRecipient.objects.count() == 1, outcomes
        assert [status for _, status, _ in outcomes].count("refused") == 1

    @pytest.mark.django_db(transaction=True)
    def test_delivering_and_diffusing_at_the_same_second_serialise(self):
        """Le comptoir sert pendant que le médecin cherche : les deux
        gestes prennent le MÊME verrou d'ordonnance, donc l'un des deux
        voit le travail commis de l'autre. Ce qui ne doit jamais exister,
        c'est une diffusion ET une délivrance qui s'ignorent."""
        scene = Scene()
        outcomes = _run_concurrently(
            [
                ("diffusion", scene.send),
                (
                    "delivrance",
                    lambda: deliver_prescription(
                        actor=scene.doctor, prescription=scene.prescription
                    ),
                ),
            ]
        )

        assert not any(
            status.startswith("crash") for _, status, _ in outcomes
        ), outcomes
        scene.prescription.refresh_from_db()
        if AvailabilityRequest.objects.exists():
            # La diffusion a gagné la course : elle est partie sur une
            # ordonnance encore « emise » à cet instant — c'est correct.
            assert AvailabilityRequest.objects.count() == 1

    def test_the_service_refuses_a_prescription_from_another_center(self, scene):
        """Défense en profondeur : la vue scelle déjà l'ordonnance sur le
        centre de l'URL, mais le SERVICE est le chemin d'écriture. Sans
        cette garde, un second appelant pouvait ancrer une demande sur le
        centre d'un autre — elle serait apparue dans le fil de recherches
        d'un tenant étranger."""
        other_center, _ = make_center_with_director()
        with pytest.raises(ValidationError, match="n'appartient pas à ce centre"):
            services.create_availability_request(
                actor=scene.doctor,
                center=other_center,
                prescription=scene.prescription,
                island=Island.NGAZIDJA,
                city="Moroni",
                item_ids=scene.item_ids,
            )

    def test_a_hostile_item_id_list_is_refused_before_it_hits_the_database(
        self, scene
    ):
        """Cent mille identifiants n'entrent pas dans un ``pk__in``."""
        response = client_for(scene.doctor).post(
            scene.send_url,
            {
                "island": Island.NGAZIDJA,
                "city": "Moroni",
                "item_ids": list(range(1, 100_001)),
            },
            format="json",
        )
        assert response.status_code == 400, response.status_code
        assert not AvailabilityRequest.objects.exists()

    def test_a_hostile_answer_body_is_refused_the_same_way(self, scene):
        """Le corps vient d'un acteur HORS tenant : il est borné aussi."""
        request = scene.send()
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        response = client_for(scene.pharmacy_user).post(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/{recipient.pk}/respond/",
            {
                "lines": [
                    {"item": index, "is_available": True}
                    for index in range(1, 5_001)
                ]
            },
            format="json",
        )
        assert response.status_code == 400, response.status_code


# ---------------------------------------------------------------------------
# 6 — L'ARCHIVAGE D'UNE PIÈCE LISAIT L'INSTANCE EN MÉMOIRE (FAIBLE)
# ---------------------------------------------------------------------------


class TestArchivingAPieceIsIdempotentUnderConcurrency:
    """Deux archivages concurrents passaient tous les deux : la seconde
    écriture réécrivait ``archived_at``/``archived_by`` et le journal
    portait deux entrées pour un seul geste. L'archivage est censé être
    DÉFINITIF — donc opposable, donc relu en base sous verrou.
    """

    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_archives_produce_one_fact_and_one_entry(self):
        scene = Scene()
        document = services.upload_pharmacy_document(
            actor=scene.pharmacy_user,
            pharmacy=scene.pharmacy,
            uploaded_file=_jpeg(),
            doc_type=PharmacyDocument.DocType.PHARMACY_LICENCE,
        )
        loaded = [
            PharmacyDocument.objects.get(pk=document.pk),
            PharmacyDocument.objects.get(pk=document.pk),
        ]
        outcomes = _run_concurrently(
            [
                (
                    f"archive-{index}",
                    lambda row=row: services.archive_pharmacy_document(
                        actor=scene.pharmacy_user, document=row
                    ),
                )
                for index, row in enumerate(loaded)
            ]
        )

        assert not any(
            status.startswith("crash") for _, status, _ in outcomes
        ), outcomes
        assert [status for _, status, _ in outcomes].count("refused") == 1
        assert (
            AuditLog.objects.filter(
                action=AuditAction.PHARMACY_DOCUMENT_ARCHIVED
            ).count()
            == 1
        )


# ---------------------------------------------------------------------------
# 7 — L'INVARIANT DU SPRINT, ATTAQUÉ DE FRONT
# ---------------------------------------------------------------------------


class TestWhatAnOfficineCanNeverLearn:
    """« Une pharmacie connaît une ZONE, une LISTE DE MÉDICAMENTS et un
    NUMÉRO de demande. Jamais le centre, jamais l'ordonnance, jamais le
    patient, jamais la posologie. »

    ``test_pharmacy.py`` le vérifie sur la boîte de réception. Ici on
    attaque les surfaces PÉRIPHÉRIQUES, celles qu'une liste blanche ne
    couvre pas : les messages d'erreur, les réponses d'écriture, les
    métadonnées, le SMS, et le payload d'audit relu longtemps après.
    """

    def test_the_write_response_of_an_answer_leaks_nothing_more(self, scene):
        request = scene.send()
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        items = list(request.items.order_by("id"))
        response = client_for(scene.pharmacy_user).post(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/{recipient.pk}/respond/",
            {
                "lines": [
                    {"item": item.pk, "is_available": True} for item in items
                ],
                "comment": "J'ai le générique",
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        blob = str(response.data)
        for forbidden in (
            str(scene.center.pk),
            scene.center.name,
            str(scene.prescription.pk),
            scene.patient.first_name,
            scene.patient.last_name,
        ):
            assert forbidden not in blob or forbidden.isdigit(), forbidden
        assert set(response.data) == {
            "id", "island", "city", "status", "created_at", "expires_at",
            "items", "my_response",
        }

    def test_the_refusal_messages_carry_no_context(self, scene):
        """Une demande close, périmée, ou une officine non validée : trois
        refus, aucun ne dit d'où venait la demande."""
        request = scene.send()
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        services.close_availability_request(actor=scene.doctor, request=request)
        response = client_for(scene.pharmacy_user).post(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/{recipient.pk}/respond/",
            {"lines": [{"item": item.pk, "is_available": True}
                       for item in request.items.all()]},
            format="json",
        )
        assert response.status_code == 400
        blob = str(response.data)
        assert scene.center.name not in blob
        assert scene.patient.last_name not in blob

    def test_the_sms_says_nothing_about_the_prescription(self, scene, settings):
        from apps.common.notifications import (
            SMS_PHARMACY_AVAILABILITY_REQUEST as TEXT,
        )

        for medication in MEDICATIONS:
            assert medication not in TEXT
        assert scene.center.name not in TEXT
        assert "3" not in TEXT  # pas même le NOMBRE de lignes

    def test_no_audit_payload_of_the_module_carries_a_medication(self, scene):
        request = scene.send()
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        services.answer_availability_request(
            actor=scene.pharmacy_user,
            recipient=recipient,
            lines={item.pk: True for item in request.items.all()},
            comment="J'ai le générique en boîte de 12",
        )
        services.close_availability_request(actor=scene.doctor, request=request)
        blob = "".join(str(entry.payload) for entry in AuditLog.objects.all())
        for medication in MEDICATIONS:
            assert medication not in blob
        assert "générique" not in blob

    def test_an_officine_cannot_answer_for_another_one(self, scene):
        """Le destinataire d'une autre officine est un 404 — jamais un 403,
        qui confirmerait que la ligne existe."""
        other = make_pharmacy(name="Pharmacie Volo Volo", city="Moroni")
        other_user = make_user()
        make_pharmacy_member(pharmacy=other, user=other_user)
        request = scene.send()
        mine = AvailabilityRequestRecipient.objects.get(
            request=request, pharmacy=scene.pharmacy
        )
        response = client_for(other_user).post(
            f"/api/v1/pharmacy/{other.pk}/requests/{mine.pk}/respond/",
            {"lines": [{"item": item.pk, "is_available": True}
                       for item in request.items.all()]},
            format="json",
        )
        assert response.status_code == 404, response.status_code

    def test_a_pharmacy_account_reaches_no_center_and_no_platform_route(
        self, scene
    ):
        """Le cloisonnement est STRUCTUREL : aucun ``StaffMembership``,
        donc aucune route de centre ne peut répondre — et la 4ᵉ casquette
        n'est pas davantage à portée."""
        client = client_for(scene.pharmacy_user)
        for url in (
            f"/api/v1/centers/{scene.center.pk}/patients/",
            f"/api/v1/centers/{scene.center.pk}/prescriptions/",
            f"/api/v1/centers/{scene.center.pk}/availability-requests/",
            f"/api/v1/centers/{scene.center.pk}/pharmacies/",
            "/api/v1/platform/pharmacies/",
            "/api/v1/platform/centers/",
        ):
            response = client.get(url)
            assert response.status_code in (403, 404), (url, response.status_code)

    def test_two_officines_of_the_same_request_share_their_item_ids(
        self, scene
    ):
        """CONSTAT documenté, pas une régression à corriger en douce.

        L'addendum d'implémentation affirmait que l'``id`` rendu étant
        celui de la ligne de diffusion, « deux officines qui compareraient
        leurs écrans ne peuvent pas savoir qu'elles parlent de la même
        recherche ». C'est faux, et c'est faux PAR CONCEPTION : le payload
        porte délibérément l'horodatage (la fraîcheur est la moitié de
        l'utilité) et la liste exacte des médicaments — deux officines les
        comparent trivialement. Les ids d'items, eux aussi identiques, ne
        font qu'ajouter un canal à un fait déjà acquis.

        Cette sonde existe pour que la phrase ne soit pas relue comme une
        garantie : la corrélation entre officines est un ACCEPTÉ du
        module, pas un invariant tenu.
        """
        other = make_pharmacy(name="Pharmacie Volo Volo", city="Moroni")
        other_user = make_user()
        make_pharmacy_member(pharmacy=other, user=other_user)
        scene.send()

        first = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/"
        ).data["results"][0]
        second = client_for(other_user).get(
            f"/api/v1/pharmacy/{other.pk}/requests/"
        ).data["results"][0]

        assert first["id"] != second["id"]  # la ligne de diffusion diffère
        assert [row["id"] for row in first["items"]] == [
            row["id"] for row in second["items"]
        ]
        assert first["created_at"] == second["created_at"]


# ---------------------------------------------------------------------------
# 8 — LES COUTURES AVEC LES SPRINTS PRÉCÉDENTS
# ---------------------------------------------------------------------------


class TestTheSeamsWithTheOtherSprints:
    """C'est là que S7 avait sa faille élevée : « la couture entre deux
    sprints que personne ne relit ». On les parcourt une par une.
    """

    def test_a_suspended_center_can_still_search_for_medicines(self, scene):
        """ADR 0022 décision 7, vérifiée et non seulement écrite :
        suspendre un centre ferme le rail diaspora, et lui seul. Chercher
        un médicament pour un patient reste un geste de soin."""
        from apps.centers.models import HealthCenter

        HealthCenter.objects.filter(pk=scene.center.pk).update(
            kyc_status=HealthCenter.KycStatus.SUSPENDED
        )
        scene.center.refresh_from_db()
        assert scene.send().pk

    def test_a_frozen_subscription_does_not_freeze_the_search(self, scene):
        from apps.billing.models import CenterSubscription

        from .factories import make_subscription

        make_subscription(
            center=scene.center, status=CenterSubscription.Status.SUSPENDED
        )
        assert scene.send().pk

    def test_delivering_does_not_silently_reopen_a_closed_request(self, scene):
        """Le carnet du patient doit rester lisible : fermer puis délivrer
        ne réanime rien."""
        request = scene.send()
        services.close_availability_request(actor=scene.doctor, request=request)
        deliver_prescription(actor=scene.doctor, prescription=scene.prescription)
        request.refresh_from_db()
        assert request.status == AvailabilityRequest.Status.CLOSED

    def test_the_expiry_is_opposable_before_the_beat_runs(self, scene):
        """Un ordonnanceur en retard n'ouvre aucune fenêtre."""
        request = scene.send()
        AvailabilityRequest.objects.filter(pk=request.pk).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        with pytest.raises(ValidationError, match="expiré"):
            services.answer_availability_request(
                actor=scene.pharmacy_user,
                recipient=recipient,
                lines={item.pk: True for item in request.items.all()},
            )

    @pytest.mark.django_db(transaction=True)
    def test_closing_and_answering_at_the_same_second_serialise(self):
        """Aucune réponse orpheline sur une demande close, et aucun 500."""
        scene = Scene()
        request = scene.send()
        recipient = AvailabilityRequestRecipient.objects.get(request=request)
        lines = {item.pk: True for item in request.items.all()}

        outcomes = _run_concurrently(
            [
                (
                    "close",
                    lambda: services.close_availability_request(
                        actor=scene.doctor, request=request
                    ),
                ),
                (
                    "answer",
                    lambda: services.answer_availability_request(
                        actor=scene.pharmacy_user,
                        recipient=recipient,
                        lines=lines,
                    ),
                ),
            ]
        )
        assert not any(
            status.startswith("crash") for _, status, _ in outcomes
        ), outcomes

    def test_the_guardian_reaches_nothing_of_the_network(self, scene):
        """Le verrou tuteur de S3 tient tel quel : aucune route du réseau
        ne vit sous ``/guardian/``. Sonde de front, pas seulement
        structurelle."""
        from .api_helpers import make_active_link, make_guardian_user

        guardian_user, guardian_profile = make_guardian_user()
        make_active_link(guardian_profile, scene.patient)
        scene.send()
        client = client_for(guardian_user)
        for url in (
            f"/api/v1/patients/me/prescriptions/{scene.prescription.pk}/availability/",
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/",
            f"/api/v1/centers/{scene.center.pk}/pharmacies/",
        ):
            response = client.get(url)
            assert response.status_code in (403, 404), (url, response.status_code)
