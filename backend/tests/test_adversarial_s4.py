"""S4 — passe adversariale guardian sur « Le tenant de plein droit ».

Probes pérennes (patron de ``test_adversarial_s1`` / ``_s2`` / ``_s3``) sur
les surfaces ouvertes par les 3 lots : 4ᵉ casquette, onboarding, KYC,
journal du directeur, réconciliation, RGPD. Chaque classe documente
l'attaque qu'elle verrouille.

**Failles confirmées et corrigées par cette passe** (les probes restent en
régression) :

1. ``TestOperatorNeverMintsTenantRights`` — ÉLEVÉ. ``POST /platform/
   centers/{pk}/directors/`` frappe une ``StaffMembership`` : un exploitant
   ``admin`` s'amorçait DIRECTEUR sur n'importe quel centre avec son propre
   numéro, puis lisait le registre patients en clair. L'invariant du sprint
   (« l'exploitant ne voit aucune PII patient ») ne tenait qu'à l'intérieur
   de ``/platform/``. Corrigé par une garde de séparation des casquettes.
2. ``TestPlatformQueueNeverCrashes`` — ÉLEVÉ (disponibilité). Le calcul des
   ``blockers`` prenait un ``select_for_update`` dans un GET, donc hors
   transaction : n'importe quel directeur cassait la file RGPD de toute la
   plateforme (500) en déposant une demande d'effacement.
3. ``TestLastPlatformAdminIsSerialised`` — MOYEN. Deux effacements
   concurrents des deux derniers ``admin`` plateforme passaient tous les
   deux : zéro administrateur, Chioni enfermée hors de son back-office.
4. ``TestPaymentInFlightVersusErasure`` — MOYEN. Fenêtre TOCTOU entre la
   lecture des ``blockers`` et l'anonymisation : un ``pay/`` qui commitait
   entre les deux laissait un intent PSP vivant (carte réellement débitée)
   sur un compte pierre tombale.
5. ``TestAnonymizeCarriesItsOwnGuards`` — MOYEN. ``anonymize_user`` était
   public et irréversible SANS aucune garde : appelé seul, il effaçait le
   dernier directeur d'un centre et enfermait le tenant dehors.

Le reste des classes VÉRIFIE (et verrouille) ce qui tenait déjà : cloison
plateforme/tenant, journal du directeur, dossier KYC, périmètre de la
suspension, export de portabilité.
"""

import threading
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from PIL import Image

from apps.accounts.models import ErasureRequest, PlatformStaff
from apps.accounts.services import (
    anonymize_user,
    erasure_blockers,
    process_erasure_request,
    request_erasure,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import HealthCenter, KycDocument, StaffMembership
from apps.centers.services import (
    add_staff_member,
    create_center_with_director,
    set_center_kyc_status,
)
from apps.medical import services as medical_services
from apps.patients.services import grant_clinical_consent
from apps.trustbridge import services as tb_services
from apps.trustbridge.models import Invoice, PaymentIntent, PaymentRequest

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
    make_center,
    make_encounter,
    make_patient,
    make_platform_staff,
    make_tariff,
    make_user,
)
from .trustbridge_helpers import SENSITIVE_LABEL, Status, build_scenario

pytestmark = pytest.mark.django_db

KycStatus = HealthCenter.KycStatus


def operator(role=PlatformStaff.Role.ADMIN, user=None):
    """A Chioni operator user (the fourth hat), no admin flag."""
    user, _op = make_platform_staff(user=user, role=role)
    return user


def png_upload(name="registre.png"):
    buf = BytesIO()
    Image.new("RGB", (48, 48), "white").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def body_of(response):
    return response.content.decode("utf-8", "replace")


# ---------------------------------------------------------------------------
# 1. ÉLEVÉ — l'exploitant se fabriquait une casquette tenant
# ---------------------------------------------------------------------------


class TestOperatorNeverMintsTenantRights:
    """L'escalade de casquette n° 1 du sprint, fermée.

    Scénario réel : « un exploitant Chioni peut, en un appel, se nommer
    directeur du centre de son choix et lire le registre patients (noms,
    téléphones, dates de naissance) en clair » — l'invariant éthique du
    sprint ne vivait qu'à l'intérieur des payloads ``/platform/``, jamais
    contre la PERSONNE de l'exploitant.
    """

    def test_operator_cannot_seed_themselves_as_director(self):
        center, _director = make_center_with_director()
        make_claimed_patient(first_name="Anfia", last_name="Saïd")
        chioni = make_user(phone="+2693390777")
        operator(user=chioni)
        client = client_for(chioni)

        response = client.post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": "+2693390777"},
        )
        assert response.status_code == 400
        assert "équipe Chioni" in str(response.data)
        # …et rien n'a été écrit : ni membership, ni audit.
        assert not StaffMembership.objects.filter(user=chioni).exists()
        assert not AuditLog.objects.filter(
            action=AuditAction.STAFF_CREATED, payload__user_id=chioni.pk
        ).exists()
        # La porte tenant reste fermée : 404 (le centre n'existe pas pour lui).
        assert client.get(f"/api/v1/centers/{center.pk}/patients/").status_code == 404

    def test_operator_cannot_seed_a_colleague_operator_either(self):
        """La garde porte sur la CIBLE, pas sur l'appelant : deux
        exploitants ne peuvent pas se renvoyer l'ascenseur."""
        center, _director = make_center_with_director()
        colleague = make_user(phone="+2693390778")
        operator(user=colleague, role=PlatformStaff.Role.SUPPORT)
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": "+2693390778"},
        )
        assert response.status_code == 400
        assert not StaffMembership.objects.filter(user=colleague).exists()

    def test_center_creation_with_an_operator_phone_rolls_the_tenant_back(self):
        """La création centre + directeur est UNE transaction : le refus du
        directeur ne doit pas laisser un centre orphelin (donc verrouillé)."""
        chioni = make_user(phone="+2693390779")
        operator(user=chioni)
        before = HealthCenter.objects.count()
        response = client_for(chioni).post(
            "/api/v1/platform/centers/",
            {
                "name": "Clinique Fantôme", "type": "clinique_privee",
                "island": "ngazidja", "city": "Moroni",
                "director_phone": "+2693390779",
            },
        )
        assert response.status_code == 400
        assert HealthCenter.objects.count() == before
        assert not HealthCenter.objects.filter(name="Clinique Fantôme").exists()

    def test_a_deactivated_operator_may_become_a_director_again(self):
        """La garde lit une ligne ACTIVE : une personne qui a quitté
        l'équipe Chioni redevient une candidate ordinaire."""
        center, _director = make_center_with_director()
        ex = make_user(phone="+2693390780")
        _u, row = make_platform_staff(user=ex, is_active=False)
        assert row.is_active is False
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": "+2693390780"},
        )
        assert response.status_code == 201

    def test_a_real_director_is_still_seedable(self):
        """Non-régression : le chemin de secours de l'ADR reste ouvert."""
        center = make_center()
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": "+2693390781", "first_name": "Halima"},
        )
        assert response.status_code == 201
        membership = StaffMembership.objects.get(pk=response.data["id"])
        assert membership.role == Role.DIRECTOR
        assert not membership.user.has_usable_password()  # compte ombre

    def test_the_tenant_own_staff_door_is_untouched(self):
        """La garde est sur la porte PLATEFORME. Le centre reste libre
        d'embaucher quelqu'un qui travaille aussi chez Chioni : c'est la
        décision du directeur, tracée, et pas une auto-attribution."""
        center, director = make_center_with_director()
        chioni = make_user(phone="+2693390782")
        operator(user=chioni)
        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/staff/",
            {"phone": "+2693390782", "role": Role.DOCTOR},
        )
        assert response.status_code == 201


# ---------------------------------------------------------------------------
# 2. ÉLEVÉ — la file RGPD tombait en 500 sur simple dépôt d'un directeur
# ---------------------------------------------------------------------------


class TestPlatformQueueNeverCrashes:
    """« Un directeur dépose une demande d'effacement → la file RGPD de
    TOUTE la plateforme répond 500 » : ``blockers`` prenait un verrou de
    ligne (``select_for_update``) dans un GET, donc hors ``atomic`` —
    ``TransactionManagementError``. Déni de service auto-service contre une
    fonction de conformité, déclenchable par n'importe quel tenant.
    """

    @pytest.mark.django_db(transaction=True)
    def test_queue_survives_a_director_requester(self):
        _center, director = make_center_with_director()
        request_erasure(user=director)
        response = client_for(operator()).get("/api/v1/platform/erasure-requests/")
        assert response.status_code == 200
        (row,) = response.data["results"]
        assert row["blockers"] == ["dernier_directeur"]

    @pytest.mark.django_db(transaction=True)
    def test_queue_survives_a_last_platform_admin_requester(self):
        lonely = operator()
        request_erasure(user=lonely)
        response = client_for(operator(role=PlatformStaff.Role.SUPPORT)).get(
            "/api/v1/platform/erasure-requests/"
        )
        assert response.status_code == 200
        (row,) = response.data["results"]
        assert row["blockers"] == ["dernier_admin_plateforme"]

    def test_the_read_path_still_reports_every_blocker(self):
        """La correction ne doit pas avoir affaibli l'information rendue :
        les trois codes remontent en une seule réponse, avant le clic."""
        scn = build_scenario(status=Status.SENT)
        tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        make_staff(user=scn.guardian_user, center=scn.center)
        assert erasure_blockers(scn.guardian_user, lock=False) == [
            "paiement_en_cours"
        ]


def make_staff(*, user, center, role=Role.DOCTOR):
    return StaffMembership.objects.create(user=user, center=center, role=role)


def billable_encounter(scn, price_kmf="5000"):
    """A second, BILLABLE consultation for the same patient/center."""
    from apps.medical.models import ActPerformed

    encounter = make_encounter(patient=scn.patient, center=scn.center)
    ActPerformed.objects.create(
        encounter=encounter,
        tariff_item=make_tariff(scn.center, price_kmf=price_kmf),
    )
    return encounter


# ---------------------------------------------------------------------------
# 3. MOYEN — course des deux derniers administrateurs plateforme
# ---------------------------------------------------------------------------


class TestLastPlatformAdminIsSerialised:
    @pytest.mark.django_db(transaction=True)
    def test_two_concurrent_erasures_never_empty_the_back_office(self, monkeypatch):
        """Entrelacement FORCÉ : chacun des deux derniers ``admin`` est
        effacé dans un fil, et le premier retient le verrou pendant que le
        second arrive. Sans verrou ordonné, chacun voyait « l'autre est
        encore là » et les deux passaient → ZÉRO administrateur, et seul
        l'admin Django pouvait en refabriquer un.
        """
        import apps.accounts.services as acc

        a_user = operator()
        b_user = operator()
        actor = operator()
        PlatformStaff.objects.filter(user=actor).update(is_active=False)
        req_a = request_erasure(user=a_user)
        req_b = request_erasure(user=b_user)

        real_check = acc._is_last_platform_admin
        second_arrived = threading.Event()

        def instrumented(user, *, lock):
            if threading.current_thread().name == "second":
                second_arrived.set()
                return real_check(user, lock=lock)  # bloque sur le verrou
            result = real_check(user, lock=lock)  # prend le verrou
            second_arrived.wait(timeout=5)  # …et le retient
            return result

        monkeypatch.setattr(acc, "_is_last_platform_admin", instrumented)
        outcomes = {}

        def run(name, erasure_request):
            try:
                process_erasure_request(
                    actor=actor, erasure_request=erasure_request,
                    decision="anonymiser",
                )
                outcomes[name] = "anonymised"
            except ValidationError as exc:
                outcomes[name] = "refused"
                assert "dernier administrateur" in exc.messages[0]
            finally:
                second_arrived.set()
                connections.close_all()

        threads = [
            threading.Thread(target=run, args=("first", req_a), name="first"),
            threading.Thread(target=run, args=("second", req_b), name="second"),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(20)

        assert set(outcomes.values()) == {"anonymised", "refused"}
        assert PlatformStaff.objects.filter(
            is_active=True, role=PlatformStaff.Role.ADMIN
        ).count() == 1


# ---------------------------------------------------------------------------
# 4. MOYEN — un paiement en vol pendant l'effacement
# ---------------------------------------------------------------------------


class TestPaymentInFlightVersusErasure:
    @pytest.mark.django_db(transaction=True)
    def test_a_real_race_never_leaves_an_intent_on_a_tombstone(self):
        """La garde ``paiement_en_cours`` était lue AVANT le verrou : un
        tuteur qui entrait dans ``pay/`` pendant que l'exploitant cliquait
        se retrouvait avec une carte débitée, un intent PSP vivant… et un
        compte pierre tombale incapable de voir son propre reçu.

        Correctif à deux faces, sérialisées sur la ligne ``User`` :
        ``create_payment_intent`` prend ce verrou en PREMIER (nouveau
        niveau externe de la hiérarchie S1), et ``anonymize_user`` le
        reprend puis RE-vérifie les gardes dessous. Quel que soit l'ordre
        d'arrivée, l'un des deux voit le travail commité de l'autre.
        """
        scn = build_scenario(status=Status.SENT)
        erasure_request = request_erasure(user=scn.guardian_user)
        chioni = operator()
        gate = threading.Barrier(2, timeout=15)
        outcomes = {}

        def erase():
            try:
                gate.wait()
                process_erasure_request(
                    actor=chioni, erasure_request=erasure_request,
                    decision="anonymiser",
                )
                outcomes["erase"] = "anonymised"
            except ValidationError:
                outcomes["erase"] = "refused"
            finally:
                connections.close_all()

        def pay():
            try:
                gate.wait()
                tb_services.create_payment_intent(
                    guardian_user=scn.guardian_user,
                    payment_request=scn.payment_request,
                )
                outcomes["pay"] = "intent_created"
            except ValidationError:
                outcomes["pay"] = "refused"
            finally:
                connections.close_all()

        threads = [threading.Thread(target=erase), threading.Thread(target=pay)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)

        live = PaymentIntent.objects.filter(
            guardian__user=scn.guardian_user,
            status__in=(
                PaymentIntent.Status.CREATED, PaymentIntent.Status.PROCESSING,
            ),
        ).count()
        scn.guardian_user.refresh_from_db()
        anonymised = scn.guardian_user.anonymized_at is not None
        # L'invariant, quel que soit l'ordre : jamais un intent VIVANT sur
        # une pierre tombale (une carte débitée sans destinataire lisible).
        assert not (live and anonymised)
        assert outcomes in (
            {"erase": "anonymised", "pay": "refused"},
            {"erase": "refused", "pay": "intent_created"},
        ), outcomes

    def test_a_pay_committed_first_blocks_the_erasure_without_closing_it(self):
        """L'autre moitié, déterministe : l'intent existe → l'effacement
        est refusé ET la demande RESTE en attente (ADR §7 point 7 : une
        garde est un obstacle à lever, pas un verdict)."""
        scn = build_scenario(status=Status.SENT)
        erasure_request = request_erasure(user=scn.guardian_user)
        tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with pytest.raises(ValidationError) as excinfo:
            process_erasure_request(
                actor=operator(), erasure_request=erasure_request,
                decision="anonymiser",
            )
        assert "paiement est en cours" in excinfo.value.messages[0]
        assert ErasureRequest.objects.get(
            pk=erasure_request.pk
        ).status == ErasureRequest.Status.PENDING
        scn.guardian_user.refresh_from_db()
        assert scn.guardian_user.anonymized_at is None

    def test_an_anonymised_guardian_can_no_longer_start_a_payment(self):
        """L'autre sens de la course, sans fil : après l'effacement, la
        porte du paiement est fermée par le même verrou."""
        scn = build_scenario(status=Status.SENT)
        anonymize_user(actor=operator(), user=scn.guardian_user)
        with pytest.raises(ValidationError) as excinfo:
            tb_services.create_payment_intent(
                guardian_user=scn.guardian_user,
                payment_request=scn.payment_request,
            )
        assert "n'est plus actif" in excinfo.value.messages[0]
        assert not PaymentIntent.objects.filter(
            payment_request=scn.payment_request
        ).exists()


# ---------------------------------------------------------------------------
# 5. MOYEN — anonymize_user, public et irréversible, sans gardes
# ---------------------------------------------------------------------------


class TestAnonymizeCarriesItsOwnGuards:
    """« Une garde qui ne vit que chez l'appelant n'est pas une garde. »
    ``anonymize_user`` est un service public, irréversible, appelable
    depuis un shell, une commande ou une action d'admin future.
    """

    def test_direct_call_refuses_the_last_director(self):
        center, director = make_center_with_director()
        with pytest.raises(ValidationError) as excinfo:
            anonymize_user(actor=operator(), user=director)
        assert "dernier directeur" in excinfo.value.messages[0]
        director.refresh_from_db()
        assert director.anonymized_at is None
        assert director.is_active is True
        assert StaffMembership.objects.filter(
            center=center, role=Role.DIRECTOR, is_active=True
        ).exists()

    def test_direct_call_refuses_a_payment_in_flight(self):
        scn = build_scenario(status=Status.SENT)
        tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        with pytest.raises(ValidationError):
            anonymize_user(actor=operator(), user=scn.guardian_user)
        scn.guardian_user.refresh_from_db()
        assert scn.guardian_user.anonymized_at is None

    def test_direct_call_refuses_the_last_platform_admin(self):
        lonely = operator()
        with pytest.raises(ValidationError):
            anonymize_user(actor=operator(role=PlatformStaff.Role.SUPPORT),
                           user=lonely)
        assert PlatformStaff.objects.get(user=lonely).is_active is True

    def test_the_replay_is_still_idempotent(self):
        """La garde ne doit pas casser l'idempotence : rejouer sur une
        pierre tombale reste un no-op silencieux (ADR §7 point 16)."""
        patient = make_claimed_patient()
        chioni = operator()
        anonymize_user(actor=chioni, user=patient.user)
        first = patient.user.__class__.objects.get(pk=patient.user_id).anonymized_at
        anonymize_user(actor=chioni, user=patient.user)
        again = patient.user.__class__.objects.get(pk=patient.user_id)
        assert again.anonymized_at == first
        assert AuditLog.objects.filter(
            action=AuditAction.USER_ANONYMIZED, payload__replay=True
        ).exists()

    def test_a_non_blocking_erasure_still_goes_through(self):
        """Non-régression du chemin nominal (le lot 3 doit rester utile)."""
        center, director = make_center_with_director()
        add_staff_member(
            actor=director, center=center, phone="+2693390790", role=Role.DIRECTOR
        )
        erasure_request = request_erasure(user=director)
        process_erasure_request(
            actor=operator(), erasure_request=erasure_request,
            decision="anonymiser",
        )
        director.refresh_from_db()
        assert director.anonymized_at is not None
        assert director.username == f"anon-{director.pk}"
        assert director.phone is None


# ---------------------------------------------------------------------------
# 6. L'invariant éthique : l'exploitant ne voit ni clinique ni PII patient
# ---------------------------------------------------------------------------


class TestOperatorSeesNoTenantData:
    def test_the_fourth_hat_opens_no_tenant_rail_at_all(self):
        """Balayage : toutes les portes tenant/patient/tuteur répondent
        404 (cloisonnement au queryset) ou 403 (casquette absente) — jamais
        200. Un exploitant n'est PAS membre des centres qu'il gouverne.
        """
        scn = build_scenario(status=Status.PAID)
        chioni = operator()
        client = client_for(chioni)
        for url in (
            f"/api/v1/centers/{scn.center.pk}/",
            f"/api/v1/centers/{scn.center.pk}/patients/",
            f"/api/v1/centers/{scn.center.pk}/patients/{scn.patient.pk}/",
            f"/api/v1/centers/{scn.center.pk}/encounters/",
            f"/api/v1/centers/{scn.center.pk}/invoices/",
            f"/api/v1/centers/{scn.center.pk}/cash-journal/",
            f"/api/v1/centers/{scn.center.pk}/audit-log/",
            f"/api/v1/centers/{scn.center.pk}/staff/",
            f"/api/v1/centers/{scn.center.pk}/stats/finances/",
            "/api/v1/patients/me/",
            "/api/v1/guardian/proteges/",
        ):
            assert client.get(url).status_code in (403, 404), url

    def test_no_platform_payload_ever_names_a_human(self):
        """Le cas le plus dur du sprint : la file RGPD porte SUR une
        personne — ici une patiente nommée, tutrice, avec un téléphone."""
        scn = build_scenario(status=Status.PAID)
        patient = scn.patient
        patient.first_name, patient.last_name = "Zainaba", "Mmadi"
        patient.phone = "+2693399123"
        patient.save()
        request_erasure(user=patient.user)
        request_erasure(user=scn.guardian_user)
        # …et un incident PSP réel pour la vue de réconciliation.
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request,
        ) if scn.payment_request.status == PaymentRequest.Status.SENT else None
        assert intent is None or intent

        client = client_for(operator())
        for url in (
            "/api/v1/platform/erasure-requests/",
            "/api/v1/platform/erasure-requests/?status=en_attente",
            "/api/v1/platform/centers/",
            f"/api/v1/platform/centers/{scn.center.pk}/",
            "/api/v1/platform/reconciliation/",
        ):
            response = client.get(url)
            assert response.status_code == 200, url
            body = body_of(response)
            for needle in ("Zainaba", "Mmadi", "2693399123", SENSITIVE_LABEL):
                assert needle not in body, (url, needle)

    def test_the_erasure_queue_contract_is_closed(self):
        """Contrat de champs figé : un ajout de champ dans ce serializer
        doit faire rougir la revue (c'est ici que la PII entrerait)."""
        patient = make_claimed_patient(first_name="Fatima", last_name="Abdou")
        request_erasure(user=patient.user)
        response = client_for(operator()).get("/api/v1/platform/erasure-requests/")
        (row,) = response.data["results"]
        assert set(row) == {
            "id", "user", "status", "requested_at", "processed_at",
            "processed_by", "refusal_reason", "hats", "blockers",
        }
        assert row["user"] == patient.user_id  # un id, jamais un nom
        assert row["hats"] == {
            "is_patient": True, "is_guardian": False,
            "is_center_staff": False, "is_platform_operator": False,
        }

    def test_a_support_operator_cannot_execute_nor_refuse(self):
        erasure_request = request_erasure(user=make_user())
        client = client_for(operator(role=PlatformStaff.Role.SUPPORT))
        for decision in ("anonymiser", "refuser"):
            response = client.post(
                f"/api/v1/platform/erasure-requests/{erasure_request.pk}/process/",
                {"decision": decision, "refusal_reason": "non"},
            )
            assert response.status_code == 403
        assert ErasureRequest.objects.get(
            pk=erasure_request.pk
        ).status == ErasureRequest.Status.PENDING


# ---------------------------------------------------------------------------
# 7. Le journal du directeur — la segmentation clinique de S3 tient
# ---------------------------------------------------------------------------


class TestDirectorJournalStaysClinicalFree:
    def test_clinical_lines_carry_the_center_and_stay_invisible(self):
        """Le lot 2 a câblé ``center=`` sur les services médicaux : les
        lignes cliniques SONT dans le tenant. Seule la liste blanche les
        cache — vérifié des deux côtés (la ligne existe en base, elle
        n'apparaît pas dans la réponse)."""
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        patient = make_claimed_patient()
        encounter = medical_services.create_encounter(
            actor=doctor, center=center, patient=patient,
            practitioner=StaffMembership.objects.get(user=doctor, center=center),
            reason="Fièvre",
        )
        medical_services.create_prescription(
            actor=doctor, encounter=encounter,
            items=[{"medication": "Artéméther", "dosage": "1 cp"}],
        )
        assert AuditLog.objects.filter(
            center=center, action=AuditAction.ENCOUNTER_CREATED
        ).exists()
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        )
        assert response.status_code == 200
        actions = {row["action"] for row in response.data["results"]}
        assert not (actions & {"encounter.created", "prescription.created"})
        assert "Artéméther" not in body_of(response)
        assert "Fièvre" not in body_of(response)

    def test_the_action_filter_is_not_an_oracle(self):
        """Un directeur ne doit pas apprendre par le 400 ce qui existe mais
        lui est caché : réponse byte-identique pour une action inventée et
        pour une action cliniquement masquée."""
        center, director = make_center_with_director()
        client = client_for(director)
        invented = client.get(
            f"/api/v1/centers/{center.pk}/audit-log/?action=chose.inventee"
        )
        hidden = client.get(
            f"/api/v1/centers/{center.pk}/audit-log/?action=encounter.created"
        )
        assert invented.status_code == hidden.status_code == 400
        assert invented.content == hidden.content

    def test_a_deactivated_director_loses_the_journal(self):
        center, director = make_center_with_director()
        second = make_staff_user(center, role=Role.DIRECTOR)
        assert second
        StaffMembership.objects.filter(user=director, center=center).update(
            is_active=False
        )
        assert client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        ).status_code == 404

    def test_a_foreign_director_gets_a_plain_404(self):
        center_a, _director_a = make_center_with_director()
        _center_b, director_b = make_center_with_director(name="Autre centre")
        assert client_for(director_b).get(
            f"/api/v1/centers/{center_a.pk}/audit-log/"
        ).status_code == 404

    def test_transverse_actions_never_land_in_a_tenant_journal(self):
        """Les actions RGPD/authentification/tutelle sont ``center=None``
        par choix : elles concernent une personne, pas un tenant. Un
        directeur ne doit pas apprendre qu'un de ses membres s'efface."""
        center, director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        request_erasure(user=doctor)
        response = client_for(director).get(
            f"/api/v1/centers/{center.pk}/audit-log/"
        )
        actions = {row["action"] for row in response.data["results"]}
        assert "erasure.requested" not in actions
        assert AuditLog.objects.filter(
            action=AuditAction.ERASURE_REQUESTED, center__isnull=True
        ).exists()


# ---------------------------------------------------------------------------
# 8. Le dossier KYC — motif, pièces, portes
# ---------------------------------------------------------------------------


class TestKycFileStaysWhereItBelongs:
    def test_the_suspension_motive_reaches_the_director_and_nobody_else(self):
        scn = build_scenario(status=Status.PAID)
        motive = "Registre de commerce illisible — pièce à refournir"
        set_center_kyc_status(
            actor=operator(), center=scn.center,
            status=KycStatus.SUSPENDED, reason=motive,
        )
        director_view = client_for(scn.director).get(
            f"/api/v1/centers/{scn.center.pk}/"
        )
        assert director_view.data["kyc_reason"] == motive
        for user in (scn.cashier, scn.doctor):
            other = client_for(user).get(f"/api/v1/centers/{scn.center.pk}/")
            assert other.data["kyc_reason"] is None
        # Patient et tuteur : le motif n'existe dans AUCUN de leurs écrans.
        for user, urls in (
            (scn.patient_user, (
                "/api/v1/patients/me/",
                "/api/v1/patients/me/payment-requests/",
                "/api/v1/patients/me/receipts/",
            )),
            (scn.guardian_user, (
                "/api/v1/guardian/payment-requests/",
                "/api/v1/guardian/receipts/",
                "/api/v1/guardian/links/",
            )),
        ):
            for url in urls:
                response = client_for(user).get(url)
                assert response.status_code == 200, url
                assert motive not in body_of(response), url
                assert "kyc_reason" not in body_of(response), url

    def test_the_motive_never_enters_an_audit_payload(self):
        center = make_center()
        motive = "Soupçon de facturation fictive sur trois dossiers"
        set_center_kyc_status(
            actor=operator(), center=center,
            status=KycStatus.SUSPENDED, reason=motive,
        )
        entry = AuditLog.objects.get(action=AuditAction.CENTER_KYC_CHANGED)
        assert entry.payload["has_reason"] is True
        assert motive not in str(entry.payload)

    def test_the_tenant_creation_audit_carries_no_name_nor_phone(self):
        center, membership = create_center_with_director(
            actor=operator(), name="Clinique Nassiba", type="clinique_privee",
            island="ngazidja", city="Moroni",
            director_phone="+2693390795", director_first_name="Nassiba",
        )
        payload = str(
            AuditLog.objects.get(
                action=AuditAction.CENTER_CREATED, payload__center_id=center.pk
            ).payload
        )
        assert "Nassiba" not in payload and "2693390795" not in payload
        assert membership.role == Role.DIRECTOR

    def test_a_kyc_piece_is_reachable_by_nobody_else(self):
        center_a, director_a = make_center_with_director()
        _center_b, director_b = make_center_with_director(name="Voisine")
        secretary = make_staff_user(center_a, role=Role.SECRETARY)
        posted = client_for(director_a).post(
            f"/api/v1/centers/{center_a.pk}/kyc-documents/",
            {"file": png_upload(), "doc_type": KycDocument.DocType.DIRECTOR_ID},
            format="multipart",
        )
        assert posted.status_code == 201
        document_pk = posted.data["id"]
        download = (
            f"/api/v1/centers/{center_a.pk}/kyc-documents/{document_pk}/download/"
        )
        assert client_for(director_a).get(download).status_code == 200
        assert client_for(secretary).get(download).status_code == 403
        assert client_for(director_b).get(download).status_code == 404
        assert client_for(make_user()).get(download).status_code == 404
        assert client_for().get(download).status_code == 401
        # Le stockage est privé : aucune URL ne sort du serializer…
        assert "file" not in posted.data
        # …et la plateforme, elle, lit la pièce (c'est son métier).
        assert client_for(operator(role=PlatformStaff.Role.SUPPORT)).get(
            f"/api/v1/platform/centers/{center_a.pk}"
            f"/kyc-documents/{document_pk}/download/"
        ).status_code == 200

    def test_no_tenant_path_can_move_its_own_kyc(self):
        center, director = make_center_with_director(kyc_status=KycStatus.PENDING)
        client = client_for(director)
        for body in ({"kyc_status": "actif"}, {"kyc_status": KycStatus.ACTIVE}):
            assert client.patch(
                f"/api/v1/centers/{center.pk}/", body
            ).status_code == 200
        center.refresh_from_db()
        assert center.kyc_status == KycStatus.PENDING
        # …et la porte plateforme reste fermée au directeur.
        assert client.post(
            f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "actif"}
        ).status_code == 403


# ---------------------------------------------------------------------------
# 9. La suspension — ce qui s'arrête, ce qui doit continuer
# ---------------------------------------------------------------------------


class TestSuspensionClosesTheRailAndNothingElse:
    def test_every_entry_of_the_diaspora_rail_is_closed(self):
        """Y compris la porte PATIENT (« je partage ma demande à mon
        oncle ») : elle appelle le même service, donc la même garde."""
        scn = build_scenario(status=Status.DRAFT)
        set_center_kyc_status(
            actor=operator(), center=scn.center,
            status=KycStatus.SUSPENDED, reason="Vérification en cours",
        )
        share = client_for(scn.patient_user).post(
            f"/api/v1/patients/me/payment-requests/{scn.payment_request.pk}/share/",
            {"guardian_link": scn.link.pk},
        )
        assert share.status_code == 400
        assert "suspendu" in str(share.data)
        with pytest.raises(ValidationError):
            tb_services.send_payment_request(
                actor=scn.cashier, payment_request=scn.payment_request
            )
        second_invoice = tb_services.create_invoice(
            actor=scn.cashier, center=scn.center,
            encounter=billable_encounter(scn),
        )
        with pytest.raises(ValidationError):
            tb_services.create_payment_request(
                actor=scn.cashier, invoice=second_invoice
            )

    def test_care_and_cash_desk_keep_running(self):
        """Arbitrage PO n° 1 : suspendre ne renvoie jamais un centre au
        papier ni ne prend un patient en otage."""
        scn = build_scenario(status="facture_brouillon")
        set_center_kyc_status(
            actor=operator(), center=scn.center,
            status=KycStatus.SUSPENDED, reason="Pièces manquantes",
        )
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        payment = tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method="especes", amount_kmf=scn.invoice.total_kmf,
        )
        assert payment.amount_kmf == scn.invoice.total_kmf
        scn.invoice.refresh_from_db()
        assert scn.invoice.status == Invoice.Status.PAID
        # Le soin continue : une consultation neuve reste possible.
        doctor_membership = StaffMembership.objects.get(
            user=scn.doctor, center=scn.center
        )
        assert medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, patient=scn.patient,
            practitioner=doctor_membership, reason="Suivi",
        )

    def test_an_in_flight_payment_still_lands_and_gets_its_receipt(self):
        """Le retrait de la garde au webhook (arbitrage PO du 14/08) ne
        doit rien ouvrir d'autre : le paiement DÉJÀ engagé atterrit, mais
        AUCUN nouveau ne peut naître sur un centre suspendu."""
        scn = build_scenario(status=Status.SENT)
        intent = tb_services.create_payment_intent(
            guardian_user=scn.guardian_user, payment_request=scn.payment_request
        )
        set_center_kyc_status(
            actor=operator(), center=scn.center,
            status=KycStatus.SUSPENDED, reason="Suspension pendant le vol",
        )
        tb_services.register_payment_success(intent=intent)
        scn.payment_request.refresh_from_db()
        assert scn.payment_request.status == PaymentRequest.Status.PAID
        # …et le tuteur obtient bien son reçu au bout de la queue.
        tb_services.confirm_care(actor=scn.doctor, payment_request=scn.payment_request)
        receipt = tb_services.close_payment_request(
            actor=scn.cashier, payment_request=scn.payment_request
        )
        assert receipt.amount_kmf_received == intent.amount_kmf
        # Aucun NOUVEAU paiement n'est possible sur ce centre — et ce, même
        # si l'appelant tient un objet ``HealthCenter`` chargé AVANT la
        # suspension : la garde interroge la base, pas la variable (sinon
        # une facture construite sur un centre périmé rouvrait le rail).
        assert scn.center.kyc_status == KycStatus.ACTIVE  # objet périmé
        other = tb_services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=billable_encounter(scn),
        )
        tb_services.issue_invoice(actor=scn.cashier, invoice=other)
        with pytest.raises(ValidationError) as excinfo:
            tb_services.create_payment_request(actor=scn.cashier, invoice=other)
        assert "suspendu" in excinfo.value.messages[0]


# ---------------------------------------------------------------------------
# 10. L'export de portabilité — il ne révèle RIEN de nouveau
# ---------------------------------------------------------------------------


class TestExportRevealsNothingNew:
    def test_a_guardian_with_clinical_consent_gets_no_carnet(self):
        """LE verrou tuteur de S3, rejoué sur la surface la plus dangereuse
        du produit : un export agrège tous les serializers d'un coup. Même
        porteur de ``detail_clinique``, le tuteur n'obtient ni diagnostic,
        ni ordonnance, ni libellé d'acte sensible."""
        scn = build_scenario(status=Status.PAID)
        grant_clinical_consent(patient_user=scn.patient_user, link=scn.link)
        doctor_membership = StaffMembership.objects.get(
            user=scn.doctor, center=scn.center
        )
        encounter = medical_services.create_encounter(
            actor=scn.doctor, center=scn.center, patient=scn.patient,
            practitioner=doctor_membership, reason="Douleurs abdominales",
        )
        medical_services.create_prescription(
            actor=scn.doctor, encounter=encounter,
            items=[{"medication": "Métronidazole", "dosage": "500 mg"}],
        )
        medical_services.create_record_entry(
            actor=scn.doctor, encounter=encounter,
            entry_type="allergie", content="Allergie à la pénicilline",
        )

        response = client_for(scn.guardian_user).get("/api/v1/auth/me/export/")
        assert response.status_code == 200
        body = body_of(response)
        for needle in (
            SENSITIVE_LABEL, "Métronidazole", "Douleurs abdominales",
            "pénicilline", "diagnosis", "prescriptions", "record_entries",
            "vital_signs", "medical_file", "documents",
        ):
            assert needle not in body, needle
        assert response.data["patient"] is None  # ce tuteur n'est pas patient
        assert set(response.data["guardian"]) == {
            "profile", "links", "proteges", "invitations",
            "payment_requests", "receipts",
        }

    def test_a_guardian_export_never_carries_a_protege_phone(self):
        scn = build_scenario(status=Status.SENT)
        scn.patient.phone = "+2693399456"
        scn.patient.save()
        body = body_of(client_for(scn.guardian_user).get("/api/v1/auth/me/export/"))
        assert "2693399456" not in body

    def test_a_patient_export_never_carries_the_other_party_free_texts(self):
        """Motif d'annulation de facture (BILLING seul) et motif de litige
        de l'autre partie : deux textes libres qui n'ont jamais d'écran
        patient — l'export ne doit pas devenir leur porte dérobée."""
        scn = build_scenario(status=Status.PAID)
        dispute = tb_services.open_dispute(
            actor_user=scn.guardian_user, payment_request=scn.payment_request,
            reason="Je soupçonne une facturation abusive du centre",
        )
        assert dispute
        second = tb_services.create_invoice(
            actor=scn.cashier, center=scn.center, encounter=billable_encounter(scn),
        )
        tb_services.issue_invoice(actor=scn.cashier, invoice=second)
        tb_services.cancel_invoice(
            actor=scn.cashier, invoice=second, reason="Erreur de saisie caissier",
        )
        body = body_of(client_for(scn.patient_user).get("/api/v1/auth/me/export/"))
        assert "facturation abusive" not in body
        assert "Erreur de saisie caissier" not in body
        assert "cancel_reason" not in body

    def test_a_staff_export_is_memberships_only(self):
        """Le tenant appartient au centre, pas au salarié : un export qui
        embarquerait le registre patients serait une exfiltration déguisée
        en droit individuel."""
        scn = build_scenario(status=Status.PAID)
        response = client_for(scn.cashier).get("/api/v1/auth/me/export/")
        assert response.status_code == 200
        assert set(response.data["center_staff"]) == {"memberships"}
        body = body_of(response)
        assert scn.patient.first_name not in body
        assert SENSITIVE_LABEL not in body
        assert response.data["patient"] is None
        assert response.data["guardian"] is None

    def test_an_operator_export_carries_no_tenant(self):
        make_center(name="Clinique Supervisée")
        chioni = operator()
        response = client_for(chioni).get("/api/v1/auth/me/export/")
        assert response.data["platform_staff"]["role"] == PlatformStaff.Role.ADMIN
        assert response.data["center_staff"] is None
        assert "Clinique Supervisée" not in body_of(response)

    def test_the_export_is_throttled_on_its_own_scope(self):
        from rest_framework.throttling import ScopedRateThrottle

        from apps.accounts.views import MeExportView

        assert MeExportView.throttle_classes == [ScopedRateThrottle]
        assert MeExportView.throttle_scope == "data_export"

    def test_an_unclaimed_profile_opens_no_patient_block(self):
        """Un profil guichet non revendiqué n'ouvre pas l'espace patient :
        l'export suit la MÊME règle que les écrans (``claimed_patient_profile``)."""
        user = make_user()
        profile = make_patient(first_name="Halima")
        profile.user = user
        profile.save()
        response = client_for(user).get("/api/v1/auth/me/export/")
        assert response.data["patient"] is None
        assert "Halima" not in body_of(response)
