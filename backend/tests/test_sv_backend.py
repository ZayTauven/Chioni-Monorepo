"""SV — solde de l'inventaire des exceptions, lot backend (hors triggers).

Quatre familles verrouillées ici :

1. **Rétractation RGPD (art. 12)** — la personne annule sa PROPRE demande
   d'effacement `en_attente` ; l'issue est terminale (service + trigger
   PostgreSQL `accounts_erasurerequest_terminal_final`).
2. **`erasure_blockers` bloque sur un litige OUVERT** — anonymiser une
   partie en plein litige rendrait sa résolution impossible.
3. **`hats.is_platform_operator` ne compte que les lignes ACTIVES** —
   cohérence avec `is_center_staff` (dette S4).
4. **TOCTOU `close_encounter` × `create_prescription` fermé** — les deux
   services relisent la consultation sous `select_for_update` : une
   ordonnance ne se glisse plus dans la seconde de la clôture.
"""

import threading

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, connections, transaction
from django.db.utils import DatabaseError
from django.utils import timezone

from apps.accounts.models import ErasureRequest, PlatformStaff
from apps.accounts.services import (
    ERASURE_BLOCKER_OPEN_DISPUTE,
    cancel_erasure_request,
    erasure_blockers,
    process_erasure_request,
    request_erasure,
)
from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.medical.models import Encounter, Prescription
from apps.medical.services import close_encounter, create_prescription
from apps.trustbridge.models import PaymentRequest
from apps.trustbridge.services import open_dispute, resolve_dispute

from .api_helpers import client_for
from .factories import make_encounter, make_platform_staff, make_user
from .trustbridge_helpers import build_scenario

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# 1 — Rétractation RGPD (art. 12)
# ---------------------------------------------------------------------------


class TestErasureRetraction:
    def test_the_person_cancels_their_own_pending_request(self):
        user = make_user()
        client = client_for(user)
        client.post("/api/v1/auth/me/erasure-request/")

        response = client.post("/api/v1/auth/me/erasure-request/cancel/")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "annulee"
        latest = client.get("/api/v1/auth/me/erasure-request/")
        assert latest.data["status"] == "annulee"

    def test_cancel_without_a_pending_request_is_an_explicit_400(self):
        user = make_user()

        response = client_for(user).post(
            "/api/v1/auth/me/erasure-request/cancel/"
        )

        assert response.status_code == 400
        assert "Aucune demande d'effacement en attente" in str(response.data)

    def test_a_cancelled_request_reopens_the_right_to_ask(self):
        user = make_user()
        client = client_for(user)
        client.post("/api/v1/auth/me/erasure-request/")
        client.post("/api/v1/auth/me/erasure-request/cancel/")

        again = client.post("/api/v1/auth/me/erasure-request/")

        assert again.status_code == 201
        assert ErasureRequest.objects.filter(user=user).count() == 2

    def test_cancellation_is_terminal_for_the_operator_too(self):
        """L'exploitant qui traite après la rétractation trouve une demande
        qui n'est plus en attente — le 400 explicite du service."""
        user = make_user()
        erasure_request = request_erasure(user=user)
        cancel_erasure_request(user=user)
        erasure_request.refresh_from_db()
        operator = make_user()

        with pytest.raises(ValidationError, match="déjà été traitée"):
            process_erasure_request(
                actor=operator, erasure_request=erasure_request,
                decision="anonymiser",
            )

    def test_nobody_cancels_somebody_elses_request(self):
        """Le service est ancré sur l'appelant : l'autre compte reçoit le
        400 « aucune demande », jamais la demande d'autrui."""
        owner = make_user()
        request_erasure(user=owner)
        stranger = make_user()

        response = client_for(stranger).post(
            "/api/v1/auth/me/erasure-request/cancel/"
        )

        assert response.status_code == 400
        assert ErasureRequest.objects.get(user=owner).status == "en_attente"

    def test_cancellation_is_audited_references_only(self):
        user = make_user()
        erasure_request = request_erasure(user=user)
        cancel_erasure_request(user=user)

        entry = AuditLog.objects.get(action=AuditAction.ERASURE_CANCELLED)
        assert entry.actor == user
        assert entry.payload == {
            "erasure_request_id": erasure_request.pk, "user_id": user.pk,
        }

    def test_the_terminal_state_holds_against_raw_sql(self):
        """Trigger `accounts_erasurerequest_terminal_final` (socle ADR 0006,
        migration accounts/0007) : hors `en_attente`, le statut ne change
        plus — même pour un UPDATE brut."""
        user = make_user()
        erasure_request = request_erasure(user=user)
        cancel_erasure_request(user=user)

        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE accounts_erasurerequest SET status = %s "
                        "WHERE id = %s",
                        ["en_attente", erasure_request.pk],
                    )
        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.CANCELLED

    def test_the_orm_update_bypass_is_stopped_by_the_database_too(self):
        user = make_user()
        erasure_request = request_erasure(user=user)
        cancel_erasure_request(user=user)

        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                ErasureRequest.objects.filter(pk=erasure_request.pk).update(
                    status=ErasureRequest.Status.PROCESSED
                )
        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.CANCELLED

    def test_the_legitimate_transitions_still_pass(self):
        """Miroir exact : `en_attente` → n'importe quelle issue reste
        libre (le trigger ne gèle que la sortie d'un état terminal)."""
        user = make_user()
        erasure_request = request_erasure(user=user)

        erasure_request.status = ErasureRequest.Status.REFUSED
        erasure_request.processed_at = timezone.now()
        erasure_request.refusal_reason = "Motif rendu à la personne."
        erasure_request.save(
            update_fields=[
                "status", "processed_at", "refusal_reason", "updated_at",
            ]
        )

        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.REFUSED


# ---------------------------------------------------------------------------
# 2 — Un litige ouvert bloque l'effacement
# ---------------------------------------------------------------------------


class TestOpenDisputeBlocksErasure:
    def test_the_opener_of_an_open_dispute_is_blocked(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        open_dispute(
            actor_user=scn.guardian_user, payment_request=scn.payment_request,
            reason="Je conteste ce paiement.",
        )

        assert ERASURE_BLOCKER_OPEN_DISPUTE in erasure_blockers(
            scn.guardian_user
        )

    def test_the_patient_of_the_disputed_request_is_blocked_too(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        open_dispute(
            actor_user=scn.guardian_user, payment_request=scn.payment_request,
            reason="Je conteste ce paiement.",
        )

        assert ERASURE_BLOCKER_OPEN_DISPUTE in erasure_blockers(
            scn.patient.user
        )

    def test_a_resolved_dispute_unblocks(self):
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        dispute = open_dispute(
            actor_user=scn.guardian_user, payment_request=scn.payment_request,
            reason="Je conteste ce paiement.",
        )
        resolve_dispute(
            actor=scn.director, dispute=dispute,
            resolution_note="Malentendu levé au téléphone.",
        )

        assert ERASURE_BLOCKER_OPEN_DISPUTE not in erasure_blockers(
            scn.guardian_user
        )
        assert ERASURE_BLOCKER_OPEN_DISPUTE not in erasure_blockers(
            scn.patient.user
        )

    def test_a_blocked_request_stays_pending_with_the_sentence(self):
        """Même contrat que les trois blockers S4 : l'exploitant reçoit la
        phrase, la demande reste `en_attente` — jamais auto-refusée."""
        scn = build_scenario(status=PaymentRequest.Status.PAID)
        open_dispute(
            actor_user=scn.guardian_user, payment_request=scn.payment_request,
            reason="Je conteste ce paiement.",
        )
        erasure_request = request_erasure(user=scn.guardian_user)
        operator = make_platform_staff(role=PlatformStaff.Role.ADMIN)[0]
        make_platform_staff(role=PlatformStaff.Role.ADMIN)

        with pytest.raises(ValidationError, match="litige"):
            process_erasure_request(
                actor=operator, erasure_request=erasure_request,
                decision="anonymiser",
            )
        erasure_request.refresh_from_db()
        assert erasure_request.status == ErasureRequest.Status.PENDING


# ---------------------------------------------------------------------------
# 3 — hats.is_platform_operator ne compte que l'ACTIF
# ---------------------------------------------------------------------------


class TestPlatformOperatorHatCountsActiveOnly:
    def _hats_of(self, subject):
        request_erasure(user=subject)
        reader, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        response = client_for(reader).get("/api/v1/platform/erasure-requests/")
        rows = response.data["results"]
        (row,) = [r for r in rows if r["user"] == subject.pk]
        return row["hats"]

    def test_an_active_operator_wears_the_hat(self):
        subject, _op = make_platform_staff(role=PlatformStaff.Role.SUPPORT)
        assert self._hats_of(subject)["is_platform_operator"] is True

    def test_a_deactivated_operator_no_longer_wears_it(self):
        """Dette S4 soldée : `hasattr` comptait une ligne désactivée alors
        que `is_center_staff` ne compte que l'actif."""
        subject, _op = make_platform_staff(
            role=PlatformStaff.Role.SUPPORT, is_active=False
        )
        assert self._hats_of(subject)["is_platform_operator"] is False


# ---------------------------------------------------------------------------
# 3 bis — Volumétrie du beat S10 (SV) : le pré-filtre ne requête plus par ligne
# ---------------------------------------------------------------------------


class TestUnpaidReminderBeatVolumetry:
    def test_the_prefilter_is_one_query_per_center(
        self, django_assert_num_queries
    ):
        """4 centres, 4 factures impayées PAS ENCORE dues (fraîches) :
        1 requête pour la liste des centres + 1 requête ANNOTÉE par centre
        (cadence + plafond personne en SQL) — plus jamais 2 requêtes par
        facture. Les factures dues, elles, paient leurs relectures sous
        verrou : c'est la décision qui fait foi, pas de la volumétrie."""
        from apps.crm.services import send_unpaid_invoice_reminders

        for _ in range(4):
            build_scenario(status=PaymentRequest.Status.SENT)

        with django_assert_num_queries(5):
            waves = send_unpaid_invoice_reminders()

        assert waves == 0  # fraîches : aucune vague due, rien d'écrit


# ---------------------------------------------------------------------------
# 3 ter — Nouvelle issue fermée `rdv_fixe` (SV, enrichissement de contrat)
# ---------------------------------------------------------------------------


class TestAppointmentBookedOutcome:
    def test_rdv_fixe_is_journalisable_through_the_api(self):
        """L'issue heureuse d'une reprise de contact entre dans la liste
        fermée : acceptée à l'API (le ChoiceField lit les choix du modèle)
        ET par la contrainte DB régénérée (`contact_log_outcome_is_closed`).
        Le texte libre reste impossible par construction."""
        from apps.crm.models import ContactLog
        from tests.api_helpers import make_center_with_director
        from tests.factories import make_appointment, make_patient

        center, director = make_center_with_director()
        patient = make_patient(created_by_center=center)
        appointment = make_appointment(patient=patient, center=center)

        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/crm/contacts/",
            {
                "kind": "reprise_contact",
                "channel": "appel",
                "recipient": "patient",
                "outcome": "rdv_fixe",
                "appointment": appointment.pk,
            },
        )

        assert response.status_code == 201, response.content
        assert response.data["outcome"] == "rdv_fixe"
        row = ContactLog.objects.get(pk=response.data["id"])
        assert row.outcome == ContactLog.Outcome.APPOINTMENT_BOOKED

    def test_a_free_text_outcome_stays_impossible(self):
        from tests.api_helpers import make_center_with_director
        from tests.factories import make_appointment, make_patient

        center, director = make_center_with_director()
        patient = make_patient(created_by_center=center)
        appointment = make_appointment(patient=patient, center=center)

        response = client_for(director).post(
            f"/api/v1/centers/{center.pk}/crm/contacts/",
            {
                "kind": "reprise_contact",
                "channel": "appel",
                "recipient": "patient",
                "outcome": "le patient a promis de venir lundi",
                "appointment": appointment.pk,
            },
        )

        assert response.status_code == 400
        assert "outcome" in response.data


# ---------------------------------------------------------------------------
# 4 — TOCTOU clôture × ordonnance, fermé sous verrou
# ---------------------------------------------------------------------------


class TestClosureAndPrescriptionSerialise:
    def test_a_closed_encounter_still_refuses_a_prescription(self):
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        encounter = make_encounter(patient=scn.patient, center=scn.center)
        close_encounter(actor=scn.doctor, encounter=encounter)

        with pytest.raises(ValidationError, match="terminée"):
            create_prescription(
                actor=scn.doctor, encounter=encounter,
                items=[{"medication": "Paracétamol 500 mg"}],
            )

    @pytest.mark.django_db(transaction=True)
    def test_the_real_race_never_slips_a_prescription_past_the_closure(self):
        """Deux threads, deux connexions : la clôture et l'ordonnance se
        sérialisent sur le verrou de la consultation. Deux issues légales
        SEULEMENT : l'ordonnance passe AVANT la clôture (les deux
        réussissent), ou la clôture gagne et l'ordonnance est refusée avec
        le 400 explicite. Jamais une ordonnance sur une consultation
        terminée, jamais un crash."""
        scn = build_scenario(status=PaymentRequest.Status.SENT)
        encounter = make_encounter(patient=scn.patient, center=scn.center)

        barrier = threading.Barrier(2, timeout=15)
        outcomes = {}

        def close():
            try:
                barrier.wait()
                close_encounter(actor=scn.doctor, encounter=encounter)
                outcomes["close"] = "ok"
            except ValidationError as exc:
                outcomes["close"] = f"refused:{exc}"
            finally:
                connections.close_all()

        def prescribe():
            try:
                barrier.wait()
                create_prescription(
                    actor=scn.doctor, encounter=encounter,
                    items=[{"medication": "Paracétamol 500 mg"}],
                )
                outcomes["prescribe"] = "ok"
            except ValidationError as exc:
                outcomes["prescribe"] = f"refused:{exc}"
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=close),
            threading.Thread(target=prescribe),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=25)

        assert outcomes["close"] == "ok"
        assert outcomes["prescribe"] == "ok" or "terminée" in outcomes[
            "prescribe"
        ]
        encounter.refresh_from_db()
        assert encounter.status == Encounter.Status.COMPLETED
        prescriptions = Prescription.objects.filter(encounter=encounter)
        if outcomes["prescribe"] == "ok":
            assert prescriptions.count() == 1
        else:
            assert not prescriptions.exists()
