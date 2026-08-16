"""S9 (ADR 0022) — le réseau des pharmacies, premier acteur HORS tenant.

Ce fichier verrouille, dans cet ordre :

1. **LE point critique du sprint** : ce qu'une pharmacie voit d'une demande.
   Une zone, une liste de médicaments, un numéro — et **rien** du centre, de
   l'ordonnance ou du patient. Testé par champs négatifs, sur le payload
   RÉEL rendu par l'API, parce qu'une liste blanche se vérifie de face ;
2. le **cloisonnement structurel** : un compte de pharmacie ne porte aucun
   ``StaffMembership``, donc aucune route de centre ne peut lui répondre —
   et le tuteur, symétriquement, n'atteint rien du réseau ;
3. la garde n° 1 de l'ADR : **le prescripteur choisit ce qui sort** (les
   lignes non cochées ne partent pas, la posologie jamais) ;
4. la garde n° 2 : **la diffusion est bornée et annoncée** (refus explicite
   au-delà du plafond, jamais de troncature silencieuse) ;
5. la réponse : couverture complète, append-only, refusée sur une demande
   close, **périmée** ou par une officine non validée ;
6. le cycle de vie d'une officine (machine fermée, motif obligatoire à la
   suspension, motif jamais journalisé) et la séparation des pouvoirs ;
7. l'audit : **jamais un libellé de médicament**, et les actions du réseau
   hors du journal du directeur ;
8. le gel et le KYC : **aucun des deux n'atteint ce module** — chercher un
   médicament pour un patient est un geste de soin ;
9. la dette C.1 enfin soldée : le poste du pharmacien interne (liste des
   ordonnances + délivrance définitive).
"""

import ast
import pathlib

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.audit_views import DIRECTOR_JOURNAL_ACTIONS
from apps.common.geo import Island
from apps.common.models import AppendOnlyError
from apps.centers.models import HealthCenter, StaffMembership
from apps.medical.models import Prescription
from apps.pharmacy import services
from apps.pharmacy.models import (
    AvailabilityRequest,
    AvailabilityResponse,
    Pharmacy,
    PharmacyMembership,
)

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import (
    make_encounter,
    make_pharmacy,
    make_pharmacy_member,
    make_platform_staff,
    make_prescription,
    make_subscription,
    make_user,
)

pytestmark = pytest.mark.django_db


def rows(response):
    """Les lignes d'une réponse de liste, paginée ou non.

    L'annuaire et les documents ne le sont pas (les officines d'une île
    tiennent à l'écran) ; la boîte de réception et le fil des recherches le
    sont — ils grandissent avec le temps.
    """
    payload = response.data
    return payload["results"] if isinstance(payload, dict) else payload


MEDICATIONS = ["Paracétamol 500 mg", "Amoxicilline 1 g", "Fer + acide folique"]


class Scene:
    """Un centre, une ordonnance, une officine validée et sa pharmacienne."""

    def __init__(self):
        self.center, self.director = make_center_with_director()
        self.doctor = make_staff_user(self.center, role=Role.DOCTOR)
        self.pharmacist = make_staff_user(self.center, role=Role.PHARMACIST)
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.patient = make_claimed_patient()
        self.encounter = make_encounter(
            patient=self.patient, center=self.center
        )
        self.prescription = make_prescription(
            encounter=self.encounter, medications=MEDICATIONS
        )
        self.pharmacy = make_pharmacy(name="Pharmacie du Port", city="Moroni")
        self.pharmacy_user = make_user()
        make_pharmacy_member(pharmacy=self.pharmacy, user=self.pharmacy_user)

    # -- URLs ------------------------------------------------------------
    @property
    def send_url(self):
        return (
            f"/api/v1/centers/{self.center.pk}/prescriptions/"
            f"{self.prescription.pk}/availability-requests/"
        )

    @property
    def inbox_url(self):
        return f"/api/v1/pharmacy/{self.pharmacy.pk}/requests/"

    @property
    def items(self):
        return list(self.prescription.items.order_by("id"))

    # -- gestes ----------------------------------------------------------
    def send(self, actor=None, item_ids=None, city="Moroni", island=Island.NGAZIDJA):
        # ``is None`` et non ``or`` : une sélection VIDE doit atteindre le
        # service pour qu'il la refuse — c'est précisément ce qu'un test
        # vérifie.
        if item_ids is None:
            item_ids = [item.pk for item in self.items]
        return services.create_availability_request(
            actor=actor or self.doctor,
            center=self.center,
            prescription=self.prescription,
            island=island,
            city=city,
            item_ids=item_ids,
        )

    def recipient_of(self, request, pharmacy=None):
        return request.recipients.get(pharmacy=pharmacy or self.pharmacy)

    def answer(self, request, available=True, comment="", pharmacy=None, actor=None):
        recipient = self.recipient_of(request, pharmacy)
        lines = {item.pk: available for item in request.items.all()}
        return services.answer_availability_request(
            actor=actor or self.pharmacy_user,
            recipient=recipient,
            lines=lines,
            comment=comment,
        )


@pytest.fixture
def scene():
    return Scene()


# ---------------------------------------------------------------------------
# 1 — LE POINT CRITIQUE : ce qu'une pharmacie voit, et tout ce qu'elle ne
#     voit pas (ADR 0022, décision 2 — l'invariant du sprint)
# ---------------------------------------------------------------------------


class TestWhatAPharmacySees:
    """« Une zone, une liste de médicaments, un numéro. Rien d'autre. »"""

    def test_the_inbox_payload_has_exactly_the_whitelisted_keys(self, scene):
        scene.send()
        response = client_for(scene.pharmacy_user).get(scene.inbox_url)

        assert response.status_code == 200, response.data
        [row] = rows(response)
        assert set(row) == {
            "id", "island", "city", "status", "created_at", "expires_at",
            "items", "my_response",
        }

    @pytest.mark.parametrize(
        "forbidden",
        [
            "center", "center_id", "center_name",
            "prescription", "prescription_id",
            "encounter", "encounter_id",
            "patient", "patient_id", "patient_name",
            "created_by", "practitioner", "request", "request_id",
        ],
    )
    def test_no_tenant_or_patient_reference_reaches_the_pharmacy(
        self, scene, forbidden
    ):
        """Champs négatifs sur le payload RÉEL, clé par clé — y compris
        ``request_id`` : deux officines qui compareraient leurs écrans ne
        doivent pas pouvoir savoir qu'elles parlent de la même recherche."""
        scene.send()
        body = str(client_for(scene.pharmacy_user).get(scene.inbox_url).data)

        assert forbidden not in body

    def test_the_pharmacy_never_learns_the_center_name_nor_the_patient_name(
        self, scene
    ):
        scene.send()
        body = str(client_for(scene.pharmacy_user).get(scene.inbox_url).data)

        assert scene.center.name not in body
        assert scene.patient.first_name not in body
        assert scene.patient.last_name not in body

    def test_the_posology_never_leaves_the_center(self, scene):
        """``PrescriptionItem.dosage`` dit comment le patient VIT avec son
        traitement : une officine n'en a pas besoin pour dire qu'elle a la
        boîte."""
        scene.send()
        body = str(client_for(scene.pharmacy_user).get(scene.inbox_url).data)

        assert "2 fois par jour" not in body
        assert MEDICATIONS[0] in body  # …mais le médicament, lui, est bien là

    def test_a_pharmacy_never_sees_what_another_pharmacy_answered(self, scene):
        """Ce que la concurrente a en stock est un signal commercial : il ne
        traverse pas."""
        other = make_pharmacy(name="Pharmacie Coralline", city="Moroni")
        other_user = make_user()
        make_pharmacy_member(pharmacy=other, user=other_user)
        request = scene.send()
        scene.answer(request, available=True, comment="J'ai le générique.")

        body = str(client_for(other_user).get(f"/api/v1/pharmacy/{other.pk}/requests/").data)

        assert "générique" not in body
        assert "my_response': None" in body or "'my_response': None" in body

    def test_a_pharmacy_only_sees_requests_addressed_to_it(self, scene):
        """La boîte part des LIGNES DE DIFFUSION, jamais d'un filtre de
        commune recalculé : une officine validée APRÈS l'envoi ne lit pas
        les demandes d'hier."""
        scene.send()
        latecomer = make_pharmacy(name="Pharmacie Tardive", city="Moroni")
        latecomer_user = make_user()
        make_pharmacy_member(pharmacy=latecomer, user=latecomer_user)

        response = client_for(latecomer_user).get(
            f"/api/v1/pharmacy/{latecomer.pk}/requests/"
        )

        assert response.status_code == 200
        assert rows(response) == []

    def test_a_member_cannot_read_another_pharmacys_inbox(self, scene):
        """Cloisonnement au queryset : l'officine d'un autre est INVISIBLE
        (404), jamais « interdite » — le refus ne confirme pas la ligne."""
        other = make_pharmacy(name="Pharmacie Coralline")

        response = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{other.pk}/requests/"
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# 2 — Le cloisonnement STRUCTUREL (décision 1) et le verrou tuteur
# ---------------------------------------------------------------------------


class TestTheIsolationIsStructural:
    """Une pharmacie n'est pas un centre, et ses gens ne sont pas du staff."""

    def test_a_pharmacy_member_holds_no_staff_membership(self, scene):
        assert not StaffMembership.objects.filter(user=scene.pharmacy_user).exists()

    @pytest.mark.parametrize(
        "path",
        [
            "patients/", "encounters/", "invoices/", "staff/", "tariffs/",
            "prescriptions/", "cash-journal/", "equipment/", "hrm/employments/",
        ],
    )
    def test_no_center_route_answers_a_pharmacy_account(self, scene, path):
        """Le cœur de la décision 1 : sans ``StaffMembership``,
        ``user_centers_qs`` est vide et le centre est INTROUVABLE — la garde
        n'a pas à connaître l'existence des pharmacies."""
        response = client_for(scene.pharmacy_user).get(
            f"/api/v1/centers/{scene.center.pk}/{path}"
        )

        assert response.status_code in (403, 404), (path, response.status_code)

    def test_a_guardian_reaches_nothing_of_the_network(self, scene):
        """Le verrou tuteur de S3 tient tel quel : la disponibilité d'un
        traitement est une information clinique."""
        guardian_user, guardian_profile = make_guardian_user()
        make_active_link(guardian_profile, scene.patient)
        request = scene.send()
        guardian = client_for(guardian_user)

        for url in (
            f"/api/v1/centers/{scene.center.pk}/pharmacies/",
            f"/api/v1/centers/{scene.center.pk}/availability-requests/",
            f"/api/v1/centers/{scene.center.pk}/availability-requests/{request.pk}/",
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/",
        ):
            assert guardian.get(url).status_code in (403, 404), url

    def test_no_guardian_route_carries_a_network_marker(self):
        """Sonde de routes (patron S3/S8) : l'interdit est explicite, pas
        accidentel — une future route tuteur du réseau ne peut pas naître
        par distraction."""
        from apps.pharmacy import space_urls, urls

        markers = ("pharmac", "availability", "disponibilit")
        for module in (urls, space_urls):
            for pattern in module.urlpatterns:
                route = str(pattern.pattern)
                if route.startswith("guardian/"):
                    assert not any(marker in route for marker in markers), route

    def test_every_route_of_the_fifth_space_declares_the_pharmacy_gate(self):
        """Garde-fou structurel, miroir des rails ``/guardian/`` et
        ``/platform/`` : une vue de cet espace qui n'aurait QUE le
        ``IsAuthenticated`` par défaut de DRF est refusée ici (leçon S4)."""
        from apps.pharmacy import space_urls

        unguarded = []
        for pattern in space_urls.urlpatterns:
            view = pattern.callback.cls
            classes = getattr(view, "permission_classes", [])
            if not any(
                getattr(permission, "pharmacy_gate", False) for permission in classes
            ):
                unguarded.append(view.__name__)
        assert not unguarded, unguarded

    def test_a_platform_operator_reads_pharmacies_but_never_a_medication(
        self, scene
    ):
        """L'invariant de l'ADR 0017 vaut ici : superviser des officines
        n'est pas lire les ordonnances de tout le pays."""
        operator_user, _ = make_platform_staff()
        scene.send()

        listing = client_for(operator_user).get("/api/v1/platform/pharmacies/")

        assert listing.status_code == 200
        assert MEDICATIONS[0] not in str(listing.data)


# ---------------------------------------------------------------------------
# 3 — Garde n° 1 : le prescripteur choisit ce qui sort
# ---------------------------------------------------------------------------


class TestThePrescriberChoosesWhatLeaves:
    def test_only_the_checked_lines_are_sent(self, scene):
        [first, second, third] = scene.items

        request = scene.send(item_ids=[first.pk, third.pk])

        assert [item.medication for item in request.items.all()] == [
            first.medication, third.medication,
        ]
        assert second.medication not in str(
            client_for(scene.pharmacy_user).get(scene.inbox_url).data
        )

    def test_the_sent_label_is_a_frozen_COPY_not_a_reference(self, scene):
        """Modifier une ordonnance demain ne réécrit pas une demande d'hier :
        une officine a répondu sur ce qu'elle a lu."""
        request = scene.send()
        item = scene.items[0]
        item.medication = "Autre chose"
        item.save(update_fields=["medication"])

        assert MEDICATIONS[0] in [row.medication for row in request.items.all()]

    def test_an_empty_selection_is_refused(self, scene):
        with pytest.raises(ValidationError, match="au moins un médicament"):
            scene.send(item_ids=[])

    def test_a_line_of_another_prescription_is_refused(self, scene):
        other = make_prescription(
            encounter=make_encounter(center=scene.center), medications=["Insuline"]
        )
        foreign = other.items.first()

        with pytest.raises(ValidationError) as foreign_error:
            scene.send(item_ids=[foreign.pk])
        with pytest.raises(ValidationError) as ghost_error:
            scene.send(item_ids=[9_999_999])

        # Messages BYTE-IDENTIQUES : une ligne étrangère et une ligne
        # inexistante ne se distinguent pas — aucun oracle (norme S1).
        assert foreign_error.value.messages == ghost_error.value.messages

    def test_a_delivered_prescription_cannot_be_searched_for(self, scene):
        scene.prescription.status = Prescription.Status.DELIVERED
        scene.prescription.save(update_fields=["status"])

        with pytest.raises(ValidationError, match="déjà été délivrée"):
            scene.send()

    def test_a_second_open_search_on_the_same_zone_is_refused(self, scene):
        scene.send()

        with pytest.raises(ValidationError, match="déjà en cours"):
            scene.send()

    def test_the_same_zone_reopens_once_the_first_search_is_closed(self, scene):
        first = scene.send()
        services.close_availability_request(actor=scene.doctor, request=first)

        assert scene.send() is not None

    def test_the_secretary_cannot_broadcast_a_medication_list(self, scene):
        response = client_for(scene.secretary).post(
            scene.send_url,
            {"island": Island.NGAZIDJA, "city": "Moroni",
             "item_ids": [item.pk for item in scene.items]},
            format="json",
        )

        assert response.status_code == 403

    def test_the_pharmacist_of_the_center_can(self, scene):
        response = client_for(scene.pharmacist).post(
            scene.send_url,
            {"island": Island.NGAZIDJA, "city": "Moroni",
             "item_ids": [item.pk for item in scene.items]},
            format="json",
        )

        assert response.status_code == 201, response.data

    def test_a_prescription_of_another_center_is_a_404(self, scene):
        elsewhere, _ = make_center_with_director()
        foreign = make_prescription(encounter=make_encounter(center=elsewhere))

        response = client_for(scene.doctor).post(
            f"/api/v1/centers/{scene.center.pk}/prescriptions/{foreign.pk}"
            "/availability-requests/",
            {"island": Island.NGAZIDJA, "item_ids": [1]},
            format="json",
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# 4 — Garde n° 2 : la diffusion est bornée et annoncée
# ---------------------------------------------------------------------------


class TestTheBroadcastIsBounded:
    def test_beyond_the_cap_the_send_is_REFUSED_never_truncated(
        self, scene, settings
    ):
        """Leçon S8 : un plafond muet se lit « tout est couvert ». Ici le
        refus porte le compte réel et demande de préciser la commune."""
        settings.AVAILABILITY_REQUEST_MAX_RECIPIENTS = 2
        for index in range(3):
            make_pharmacy(name=f"Pharmacie {index}", city="Moroni")

        with pytest.raises(ValidationError, match="au-delà du maximum"):
            scene.send()
        assert AvailabilityRequest.objects.count() == 0

    def test_a_zone_without_any_validated_pharmacy_is_refused(self, scene):
        with pytest.raises(ValidationError, match="Aucune pharmacie validée"):
            scene.send(city="Mitsamiouli")

    def test_only_validated_pharmacies_receive(self, scene):
        make_pharmacy(
            name="Pharmacie en attente", city="Moroni",
            status=Pharmacy.Status.PENDING,
        )
        make_pharmacy(
            name="Pharmacie suspendue", city="Moroni",
            status=Pharmacy.Status.SUSPENDED,
        )

        request = scene.send()

        assert [row.pharmacy_id for row in request.recipients.all()] == [
            scene.pharmacy.pk
        ]

    def test_the_directory_shows_only_validated_pharmacies(self, scene):
        make_pharmacy(
            name="Pharmacie en attente", city="Moroni",
            status=Pharmacy.Status.PENDING,
        )

        response = client_for(scene.secretary).get(
            f"/api/v1/centers/{scene.center.pk}/pharmacies/"
        )

        assert response.status_code == 200
        assert [row["name"] for row in rows(response)] == ["Pharmacie du Port"]

    def test_the_directory_is_readable_by_all_staff(self, scene):
        """Savoir quelles officines existent n'est pas clinique."""
        response = client_for(scene.secretary).get(
            f"/api/v1/centers/{scene.center.pk}/pharmacies/?island={Island.NGAZIDJA}"
        )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# 5 — La réponse : un constat daté, append-only
# ---------------------------------------------------------------------------


class TestTheAnswer:
    def test_answering_covers_every_medication_or_nothing(self, scene):
        request = scene.send()
        recipient = scene.recipient_of(request)
        partial = {request.items.first().pk: True}

        with pytest.raises(ValidationError, match="chacun des médicaments"):
            services.answer_availability_request(
                actor=scene.pharmacy_user, recipient=recipient, lines=partial
            )

    def test_a_response_is_append_only_and_a_correction_is_a_NEW_response(
        self, scene
    ):
        request = scene.send()
        first = scene.answer(request, available=False)
        second = scene.answer(request, available=True)

        assert AvailabilityResponse.objects.count() == 2
        with pytest.raises(AppendOnlyError):
            first.comment = "réécriture"
            first.save()
        assert services.latest_response(scene.recipient_of(request)).pk == second.pk

    def test_a_closed_request_refuses_an_answer(self, scene):
        request = scene.send()
        services.close_availability_request(actor=scene.doctor, request=request)

        with pytest.raises(ValidationError, match="close"):
            scene.answer(request)

    def test_an_EXPIRED_request_refuses_an_answer_before_the_beat_runs(
        self, scene
    ):
        """La péremption est opposable AVANT le passage du beat horaire :
        un beat en retard n'ouvre aucune fenêtre."""
        request = scene.send()
        AvailabilityRequest.objects.filter(pk=request.pk).update(
            expires_at=timezone.now() - timezone.timedelta(minutes=1)
        )

        with pytest.raises(ValidationError, match="expiré"):
            scene.answer(request)

    def test_a_suspended_pharmacy_cannot_answer_but_keeps_reading(self, scene):
        request = scene.send()
        operator_user, _ = make_platform_staff()
        services.set_pharmacy_status(
            actor=operator_user,
            pharmacy=scene.pharmacy,
            status=Pharmacy.Status.SUSPENDED,
            reason="Licence expirée.",
        )

        with pytest.raises(ValidationError, match="ne peut pas répondre"):
            scene.answer(request)
        # …mais l'historique reste lisible : on ne prend jamais ses données
        # en otage (ADR 0022 décision 5).
        assert client_for(scene.pharmacy_user).get(scene.inbox_url).status_code == 200

    def test_the_stale_task_closes_expired_requests_with_its_own_reason(
        self, scene
    ):
        request = scene.send()
        AvailabilityRequest.objects.filter(pk=request.pk).update(
            expires_at=timezone.now() - timezone.timedelta(hours=1)
        )

        assert services.close_stale_availability_requests() == 1
        request.refresh_from_db()
        assert request.status == AvailabilityRequest.Status.CLOSED
        assert request.close_reason == AvailabilityRequest.CloseReason.EXPIRED

    def test_answering_through_the_api_returns_the_pharmacys_own_payload(
        self, scene
    ):
        request = scene.send()
        recipient = scene.recipient_of(request)

        response = client_for(scene.pharmacy_user).post(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/{recipient.pk}/respond/",
            {
                "lines": [
                    {"item": item.pk, "is_available": index == 0}
                    for index, item in enumerate(request.items.all())
                ],
                "comment": "J'ai le générique.",
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        assert response.data["my_response"]["comment"] == "J'ai le générique."
        assert [line["is_available"] for line in response.data["my_response"]["lines"]] == [
            True, False, False,
        ]

    def test_a_duplicate_line_in_the_body_is_refused(self, scene):
        request = scene.send()
        recipient = scene.recipient_of(request)
        item = request.items.first()

        response = client_for(scene.pharmacy_user).post(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/{recipient.pk}/respond/",
            {"lines": [
                {"item": item.pk, "is_available": True},
                {"item": item.pk, "is_available": False},
            ]},
            format="json",
        )

        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 6 — Le centre et le patient lisent, chacun son payload
# ---------------------------------------------------------------------------


class TestWhatTheCenterAndThePatientRead:
    def test_the_center_sees_the_pharmacy_and_its_comment(self, scene):
        request = scene.send()
        scene.answer(request, comment="J'ai le générique.")

        response = client_for(scene.doctor).get(
            f"/api/v1/centers/{scene.center.pk}/availability-requests/{request.pk}/"
        )

        assert response.status_code == 200
        [answer] = response.data["responses"]
        assert answer["pharmacy"]["name"] == "Pharmacie du Port"
        assert answer["pharmacy"]["phone"] == scene.pharmacy.phone
        assert answer["comment"] == "J'ai le générique."

    def test_the_patient_reads_the_answers_in_their_carnet(self, scene):
        request = scene.send()
        scene.answer(request, comment="J'ai le générique.")

        response = client_for(scene.patient.user).get(
            f"/api/v1/patients/me/prescriptions/{scene.prescription.pk}/availability/"
        )

        assert response.status_code == 200
        [row] = rows(response)
        assert [item["medication"] for item in row["items"]] == MEDICATIONS
        assert row["responses"][0]["pharmacy"]["city"] == "Moroni"

    def test_the_pharmacys_free_comment_never_descends_into_the_carnet(
        self, scene
    ):
        """Texte non modéré écrit par un tiers : l'écran du patient reste
        une information, pas une conversation (décision 3)."""
        request = scene.send()
        scene.answer(request, comment="Passez me voir, on s'arrangera.")

        body = str(
            client_for(scene.patient.user)
            .get(
                f"/api/v1/patients/me/prescriptions/{scene.prescription.pk}"
                "/availability/"
            )
            .data
        )

        assert "on s'arrangera" not in body

    def test_another_patients_prescription_is_a_404(self, scene):
        intruder = make_claimed_patient()

        response = client_for(intruder.user).get(
            f"/api/v1/patients/me/prescriptions/{scene.prescription.pk}/availability/"
        )

        assert response.status_code == 404

    def test_the_center_can_close_a_search_it_no_longer_needs(self, scene):
        request = scene.send()

        response = client_for(scene.doctor).post(
            f"/api/v1/centers/{scene.center.pk}/availability-requests/"
            f"{request.pk}/close/"
        )

        assert response.status_code == 200
        assert response.data["status"] == AvailabilityRequest.Status.CLOSED
        assert response.data["close_reason"] == (
            AvailabilityRequest.CloseReason.MANUAL
        )

    def test_a_request_of_another_center_is_a_404(self, scene):
        request = scene.send()
        elsewhere, elsewhere_director = make_center_with_director()
        doctor = make_staff_user(elsewhere, role=Role.DOCTOR)

        response = client_for(doctor).get(
            f"/api/v1/centers/{elsewhere.pk}/availability-requests/{request.pk}/"
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# 7 — Le cycle de vie d'une officine, et la séparation des pouvoirs
# ---------------------------------------------------------------------------


class TestThePharmacyLifecycle:
    def test_a_pharmacy_is_born_pending_and_the_platform_seeds_its_first_member(
        self,
    ):
        operator_user, _ = make_platform_staff()

        response = client_for(operator_user).post(
            "/api/v1/platform/pharmacies/",
            {
                "name": "Pharmacie de la Corniche",
                "island": Island.NDZUWANI,
                "city": "Mutsamudu",
                "member_phone": "+2693331122",
                "member_first_name": "Zainaba",
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["status"] == Pharmacy.Status.PENDING
        assert response.data["member"]["display_name"] == "Zainaba"

    def test_the_status_machine_is_closed_and_a_suspension_needs_a_motive(self):
        operator_user, _ = make_platform_staff()
        pharmacy = make_pharmacy(status=Pharmacy.Status.PENDING)

        with pytest.raises(ValidationError, match="motif est obligatoire"):
            services.set_pharmacy_status(
                actor=operator_user, pharmacy=pharmacy,
                status=Pharmacy.Status.SUSPENDED,
            )
        services.set_pharmacy_status(
            actor=operator_user, pharmacy=pharmacy,
            status=Pharmacy.Status.VALIDATED,
        )
        with pytest.raises(ValidationError, match="déjà"):
            services.set_pharmacy_status(
                actor=operator_user, pharmacy=pharmacy,
                status=Pharmacy.Status.VALIDATED,
            )

    def test_the_suspension_motive_is_rendered_to_the_pharmacy_never_journalised(
        self, scene
    ):
        operator_user, _ = make_platform_staff()
        services.set_pharmacy_status(
            actor=operator_user, pharmacy=scene.pharmacy,
            status=Pharmacy.Status.SUSPENDED,
            reason="Licence d'officine expirée depuis mars.",
        )

        profile = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/"
        )
        entry = AuditLog.objects.filter(
            action=AuditAction.PHARMACY_STATUS_CHANGED
        ).latest("id")

        assert "Licence d'officine expirée" in profile.data["status_reason"]
        assert "Licence" not in str(entry.payload)
        assert entry.payload["has_reason"] is True

    def test_only_a_platform_admin_moves_a_status(self):
        from apps.accounts.models import PlatformStaff

        support_user, _ = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        pharmacy = make_pharmacy(status=Pharmacy.Status.PENDING)

        response = client_for(support_user).post(
            f"/api/v1/platform/pharmacies/{pharmacy.pk}/status/",
            {"status": Pharmacy.Status.VALIDATED},
            format="json",
        )

        assert response.status_code == 403

    def test_a_chioni_operator_cannot_be_seeded_into_a_pharmacy(self):
        """Séparation des pouvoirs : celui qui valide les officines ne
        valide pas la sienne."""
        operator_user, _ = make_platform_staff(user=make_user(phone="+2693212345"))
        pharmacy = make_pharmacy()

        with pytest.raises(ValidationError, match="équipe Chioni"):
            services.add_pharmacy_member(
                actor=operator_user, pharmacy=pharmacy,
                phone=operator_user.phone,
            )
        assert not PharmacyMembership.objects.filter(user=operator_user).exists()

    def test_the_last_active_member_cannot_be_removed(self, scene):
        membership = PharmacyMembership.objects.get(
            user=scene.pharmacy_user, pharmacy=scene.pharmacy
        )

        with pytest.raises(ValidationError, match="dernière personne"):
            services.deactivate_pharmacy_member(
                actor=scene.pharmacy_user, membership=membership
            )

    def test_a_member_can_enrol_a_colleague_then_step_out(self, scene):
        colleague = services.add_pharmacy_member(
            actor=scene.pharmacy_user, pharmacy=scene.pharmacy,
            phone="+2693334455", first_name="Ali",
        )
        membership = PharmacyMembership.objects.get(
            user=scene.pharmacy_user, pharmacy=scene.pharmacy
        )

        services.deactivate_pharmacy_member(
            actor=scene.pharmacy_user, membership=membership
        )

        assert colleague.is_active
        assert not PharmacyMembership.objects.get(pk=membership.pk).is_active

    def test_the_pharmacy_edits_its_own_card_but_never_its_status(self, scene):
        """Le champ ``status`` d'un corps de PATCH est ignoré, point.

        La devanture (adresse, téléphone, e-mail, nom) se corrige librement
        et le statut n'en bouge pas. Le cas de la ZONE est différent et
        vit dans ``test_adversarial_s9.py`` : depuis la revue, déclarer un
        déménagement renvoie l'officine en vérification — la commune n'est
        pas une ligne d'adresse, c'est la borne du ciblage.
        """
        response = client_for(scene.pharmacy_user).patch(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/",
            {"address": "12 rue du Port", "status": Pharmacy.Status.SUSPENDED},
            format="json",
        )

        assert response.status_code == 200, response.data
        assert response.data["address"] == "12 rue du Port"
        assert response.data["status"] == Pharmacy.Status.VALIDATED

    def test_a_document_is_private_and_archiving_is_final(self, scene):
        """Le socle ADR 0014/0016 est cloné tel quel : aucune URL n'est
        rendue, l'archivage ne se défait pas."""
        from apps.pharmacy.models import PharmacyDocument

        document = PharmacyDocument.objects.create(
            pharmacy=scene.pharmacy,
            doc_type=PharmacyDocument.DocType.PHARMACY_LICENCE,
            file="pharmacy_documents/2026/08/licence.jpg",
            uploaded_by=scene.pharmacy_user,
        )
        services.archive_pharmacy_document(
            actor=scene.pharmacy_user, document=document
        )

        listing = client_for(scene.pharmacy_user).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/documents/"
        )

        assert set(listing.data[0]) == {"id", "doc_type", "created_at", "archived_at"}
        document.refresh_from_db()
        document.archived_at = None
        with pytest.raises(ValidationError, match="définitif"):
            document.save()


# ---------------------------------------------------------------------------
# 8 — L'audit, les SMS, et les deux gardes ABSENTES
# ---------------------------------------------------------------------------


class TestAuditAndNotifications:
    def test_no_audit_payload_ever_carries_a_medication_label(self, scene):
        request = scene.send()
        scene.answer(request, comment="J'ai le générique.")
        services.close_availability_request(actor=scene.doctor, request=request)

        body = str(list(AuditLog.objects.values_list("payload", flat=True)))

        for medication in MEDICATIONS:
            assert medication not in body
        assert "générique" not in body

    def test_the_request_audit_carries_counts_and_references_only(self, scene):
        request = scene.send()

        entry = AuditLog.objects.get(action=AuditAction.AVAILABILITY_REQUESTED)

        assert entry.payload["item_count"] == 3
        assert entry.payload["recipient_count"] == 1
        assert entry.payload["request_id"] == request.pk

    @pytest.mark.parametrize(
        "action",
        [
            AuditAction.AVAILABILITY_REQUESTED,
            AuditAction.AVAILABILITY_CLOSED,
            AuditAction.PRESCRIPTION_DELIVERED,
        ],
    )
    def test_the_network_stays_out_of_the_directors_journal(self, action):
        """Sphère clinique : « le dossier de ce patient a déclenché une
        recherche » est de la même famille que ``prescription.created``."""
        assert action not in DIRECTOR_JOURNAL_ACTIONS

    def test_the_answer_action_carries_no_center_at_all(self, scene):
        request = scene.send()
        scene.answer(request)

        entry = AuditLog.objects.get(action=AuditAction.AVAILABILITY_ANSWERED)

        assert entry.center_id is None

    def test_the_sms_announces_a_request_and_names_no_medication(
        self, scene, sms_outbox, django_capture_on_commit_callbacks
    ):
        scene.pharmacy.phone = "+2693337788"
        scene.pharmacy.save(update_fields=["phone"])

        with django_capture_on_commit_callbacks(execute=True):
            scene.send()

        [(phone, message)] = sms_outbox
        assert phone == "+2693337788"
        for medication in MEDICATIONS:
            assert medication not in message
        assert scene.center.name not in message
        assert "3" not in message  # pas même le NOMBRE de lignes

    def test_a_rolled_back_send_notifies_nobody(
        self, scene, sms_outbox, django_capture_on_commit_callbacks
    ):
        """Contrat ``on_commit`` : une zone sans officine validée fait
        échouer l'envoi — aucun SMS ne part, même capturé de force."""
        scene.pharmacy.phone = "+2693337788"
        scene.pharmacy.save(update_fields=["phone"])

        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(ValidationError):
                scene.send(city="Mitsamiouli")

        assert sms_outbox == []


class TestNeitherFreezeNorKycReachesTheNetwork:
    """« Chercher un médicament pour un patient est un geste de soin. »"""

    def test_no_module_of_the_app_imports_the_freeze_guard(self):
        """Sonde MIROIR de la sonde fail-closed S5 (qui verrouille la liste
        des importeurs par égalité stricte) : elle dit ICI, dans le fichier
        du sprint, pourquoi la garde est absente — et ``ALLOWED_IMPORTERS``
        reste inchangée, S7 en demeurant la seule extension."""
        root = pathlib.Path(__file__).resolve().parents[1] / "apps" / "pharmacy"
        offenders = []
        for path in root.rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.ImportFrom) and any(
                    alias.name == "require_center_can_administer"
                    for alias in node.names
                ):
                    offenders.append(path.name)
            if "require_center_can_administer(" in source:
                offenders.append(path.name)
        assert not offenders, offenders

    @pytest.mark.parametrize("status", ["suspendu", "resilie"])
    def test_a_frozen_center_still_searches_for_medication(self, scene, status):
        make_subscription(
            center=scene.center, status=status,
            status_reason="Facture A-000012 impayée depuis 60 jours.",
        )

        response = client_for(scene.doctor).post(
            scene.send_url,
            {"island": Island.NGAZIDJA, "city": "Moroni",
             "item_ids": [item.pk for item in scene.items]},
            format="json",
        )

        assert response.status_code == 201, response.data

    @pytest.mark.parametrize("kyc", ["en_attente", "suspendu"])
    def test_a_center_off_the_diaspora_rail_still_searches(self, scene, kyc):
        """Suspendre un centre ferme le rail diaspora, ET LUI SEUL."""
        HealthCenter.objects.filter(pk=scene.center.pk).update(kyc_status=kyc)

        assert scene.send() is not None


# ---------------------------------------------------------------------------
# 9 — Dette C.1 soldée : le poste du pharmacien interne (décision 6)
# ---------------------------------------------------------------------------


class TestThePharmacistWorkstation:
    def test_the_pharmacist_finally_has_a_LIST_of_prescriptions(self, scene):
        response = client_for(scene.pharmacist).get(
            f"/api/v1/centers/{scene.center.pk}/prescriptions/"
        )

        assert response.status_code == 200
        assert [row["id"] for row in rows(response)] == [scene.prescription.pk]

    def test_the_list_filters_by_patient_status_and_date(self, scene):
        base = f"/api/v1/centers/{scene.center.pk}/prescriptions/"
        pharmacist = client_for(scene.pharmacist)

        assert pharmacist.get(f"{base}?patient={scene.patient.pk}").status_code == 200
        assert pharmacist.get(f"{base}?status=emise").data["count"] == 1
        assert pharmacist.get(f"{base}?status=delivree").data["count"] == 0
        assert pharmacist.get(f"{base}?status=nimportequoi").status_code == 400
        assert pharmacist.get(f"{base}?date=pas-une-date").status_code == 400

    def test_the_administrative_staff_never_reads_a_prescription_list(self, scene):
        response = client_for(scene.secretary).get(
            f"/api/v1/centers/{scene.center.pk}/prescriptions/"
        )

        assert response.status_code == 403

    def test_delivering_posts_the_status_that_no_service_ever_posted(self, scene):
        response = client_for(scene.pharmacist).post(
            f"/api/v1/centers/{scene.center.pk}/prescriptions/"
            f"{scene.prescription.pk}/deliver/"
        )

        assert response.status_code == 200, response.data
        assert response.data["status"] == Prescription.Status.DELIVERED
        assert response.data["delivered_at"] is not None
        assert "delivered_by" not in response.data  # jamais vers le patient

    def test_delivery_is_FINAL_on_every_write_path(self, scene):
        from apps.medical.services import deliver_prescription

        deliver_prescription(actor=scene.pharmacist, prescription=scene.prescription)

        with pytest.raises(ValidationError, match="déjà été délivrée"):
            deliver_prescription(
                actor=scene.pharmacist, prescription=scene.prescription
            )
        stale = Prescription.objects.get(pk=scene.prescription.pk)
        stale.status = Prescription.Status.ISSUED
        with pytest.raises(ValidationError, match="définitive"):
            stale.save()

    def test_delivery_is_audited_with_references_only(self, scene):
        from apps.medical.services import deliver_prescription

        deliver_prescription(actor=scene.pharmacist, prescription=scene.prescription)

        entry = AuditLog.objects.get(action=AuditAction.PRESCRIPTION_DELIVERED)

        assert entry.payload["prescription_id"] == scene.prescription.pk
        assert set(entry.payload) == {
            "prescription_id", "encounter_id", "patient_id", "center_id",
        }

    def test_the_patient_sees_the_delivery_date_in_their_carnet(self, scene):
        from apps.medical.services import deliver_prescription

        deliver_prescription(actor=scene.pharmacist, prescription=scene.prescription)

        response = client_for(scene.patient.user).get(
            "/api/v1/patients/me/prescriptions/"
        )

        assert response.status_code == 200
        assert rows(response)[0]["delivered_at"] is not None


# ---------------------------------------------------------------------------
# 10 — Cohérences transverses
# ---------------------------------------------------------------------------


class TestCrossCuttingConsistency:
    def test_the_two_island_lists_stay_identical(self):
        """``common.geo.Island`` et ``HealthCenter.Island`` doivent rester
        jumelles : si l'une gagne une île et pas l'autre, le ciblage d'une
        demande laisserait des officines hors de portée."""
        assert list(Island.choices) == list(HealthCenter.Island.choices)

    def test_the_fifth_hat_is_routed_by_auth_me(self, scene):
        response = client_for(scene.pharmacy_user).get("/api/v1/auth/me/")

        assert response.status_code == 200
        [membership] = response.data["pharmacy_memberships"]
        assert membership["pharmacy"]["name"] == "Pharmacie du Port"
        assert membership["pharmacy"]["status"] == Pharmacy.Status.VALIDATED
        assert response.data["staff_memberships"] == []

    def test_a_center_person_who_is_also_a_pharmacist_keeps_both_hats(self, scene):
        """Le cumul de casquettes élargit, il ne restreint jamais (ADR 0001).
        Un membre du personnel qui tient aussi une officine est un cas réel,
        et il n'y a là aucune escalade : le réseau ne montre aucun patient."""
        make_pharmacy_member(pharmacy=scene.pharmacy, user=scene.doctor)

        response = client_for(scene.doctor).get("/api/v1/auth/me/")

        assert len(response.data["staff_memberships"]) == 1
        assert len(response.data["pharmacy_memberships"]) == 1

    def test_an_anonymous_caller_gets_401_on_the_fifth_space(self, scene):
        from rest_framework.test import APIClient

        response = APIClient().get(f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/")

        assert response.status_code == 401

    def test_a_plain_user_gets_403_on_the_fifth_space(self, scene):
        response = client_for(make_user()).get(
            f"/api/v1/pharmacy/{scene.pharmacy.pk}/requests/"
        )

        assert response.status_code == 403
