"""S2 adversarial re-check — « Casquettes & parcours ».

Campagne conservée en régression. Cible l'invariant éthique du sprint : un
consentement clinique recueilli au guichet ne doit JAMAIS survivre à la
prise de possession du profil par le titulaire (porte de confirmation,
OTP-1) — y compris sous une COURSE entre la revendication et le POST
consentement guichet.

Chaque test décrit l'attaque en clair (« un centre peut… en faisant… »).
"""

import threading
from types import SimpleNamespace

import pytest
from django.core.exceptions import ValidationError
from django.db import connections

from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import (
    claim_profile,
    confirm_guardian_link,
    grant_clinical_consent_at_center,
)

from .api_helpers import client_for, make_center_with_director, make_staff_user
from .factories import make_guardian, make_link, make_patient, make_user

pytestmark = pytest.mark.django_db

Scope = Consent.Scope
Status = GuardianLink.Status


def _desk_case():
    center, director = make_center_with_director()
    patient = make_patient(created_by_center=center)
    guardian_user = make_user()
    guardian = make_guardian(user=guardian_user)
    link = make_link(guardian=guardian, patient=patient)
    return center, director, patient, guardian_user, link


class TestClaimVsDeskGrantRace:
    """ATTAQUE : le guichet POST un consentement clinique sur un patient non
    revendiqué PENDANT que celui-ci revendique son profil par OTP. La
    revendication suspend le lien et révoque les consentements ACTIFS —
    mais un consentement créé avec des instances chargées AVANT la
    revendication (TOCTOU) échappait à la porte et RESSUSCITAIT « detail
    clinique » à la confirmation du lien, alors que la confirmation ne doit
    restaurer QUE « paiements ». """

    def test_stale_instance_grant_after_claim_cannot_survive_the_gate(self):
        """Modèle déterministe du TOCTOU (READ COMMITTED + aucun verrou de
        ligne = lecture d'instances périmées). Le service reçoit les
        instances chargées AVANT la revendication ; la revendication a
        déjà committé.

        Attendu (après correctif) : le service RELIT sous verrou → voit le
        profil revendiqué → refuse. AUCUN consentement clinique ne peut
        survivre, donc la confirmation ultérieure du lien ne restaure que
        « paiements ». Avant correctif, ce test échoue (le consentement est
        créé et ressuscite)."""
        center, director, patient, _guardian_user, link = _desk_case()

        # Instances « périmées » telles que la vue les a résolues au début
        # de la requête (patient non revendiqué, lien ACTIF).
        stale_patient = PatientProfile.objects.get(pk=patient.pk)
        stale_link = GuardianLink.objects.get(pk=link.pk)

        # La revendication OTP se produit et committe entre la résolution
        # de la vue et l'écriture du consentement.
        titulaire = make_user()
        claim_profile(user=titulaire, profile=patient)

        # Le POST guichet s'exécute avec les instances périmées.
        with pytest.raises(ValidationError):
            grant_clinical_consent_at_center(
                actor=director, center=center, patient=stale_patient,
                link=stale_link, collected_via="papier",
            )

        # Le titulaire confirme le lien : SEUL « paiements » revient.
        stale_link.refresh_from_db()
        assert stale_link.status == Status.PENDING_CLAIMANT_CONFIRMATION
        confirm_guardian_link(patient_user=titulaire, link=stale_link)
        assert Consent.objects.active_scopes(stale_link) == frozenset(
            {Scope.PAYMENTS}
        )
        # Aucun consentement clinique actif nulle part sur ce lien.
        assert not Consent.objects.filter(
            guardian_link=stale_link, scope=Scope.CLINICAL_DETAIL,
            revoked_at__isnull=True,
        ).exists()

    @pytest.mark.django_db(transaction=True)
    def test_real_threads_claim_and_desk_grant_never_leak_clinical(self):
        """Course RÉELLE (threads + commits) : une revendication et un POST
        consentement guichet démarrent ensemble sur le même profil non
        revendiqué. Quel que soit l'ordre gagnant, l'invariant tient : après
        confirmation du lien, la portée effective est EXACTEMENT
        « paiements » — jamais « detail_clinique »."""
        center, director, patient, _guardian_user, link = _desk_case()
        stale_patient = PatientProfile.objects.get(pk=patient.pk)
        stale_link = GuardianLink.objects.get(pk=link.pk)
        titulaire = make_user()

        barrier = threading.Barrier(2, timeout=10)
        errors = []

        def claim():
            try:
                barrier.wait()
                claim_profile(user=titulaire, profile=patient)
            except ValidationError:
                pass
            except Exception as exc:  # pragma: no cover - diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        def desk_grant():
            try:
                barrier.wait()
                grant_clinical_consent_at_center(
                    actor=director, center=center, patient=stale_patient,
                    link=stale_link, collected_via="papier",
                )
            except ValidationError:
                pass
            except Exception as exc:  # pragma: no cover - diagnostic
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=claim),
                   threading.Thread(target=desk_grant)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)

        assert errors == []

        # Le profil a bien été revendiqué ; le lien est suspendu.
        patient.refresh_from_db()
        assert patient.is_claimed
        link.refresh_from_db()
        assert link.status == Status.PENDING_CLAIMANT_CONFIRMATION

        # Le titulaire confirme : jamais de detail_clinique ressuscité.
        confirm_guardian_link(patient_user=titulaire, link=link)
        assert Consent.objects.active_scopes(link) == frozenset({Scope.PAYMENTS})
        assert not Consent.objects.filter(
            guardian_link=link, scope=Scope.CLINICAL_DETAIL,
            revoked_at__isnull=True,
        ).exists()


class TestDeskGrantStillWorksNominally:
    """Le correctif (relecture sous verrou) ne casse pas le chemin nominal."""

    def test_nominal_grant_still_opens_the_clinical_scope(self):
        from apps.common.permissions import IsGuardianWithScope

        center, director, patient, guardian_user, link = _desk_case()
        url = f"/api/v1/centers/{center.pk}/patients/{patient.pk}/consents/clinical/"

        response = client_for(director).post(
            url, {"guardian_link": link.pk, "collected_via": "papier"}
        )

        assert response.status_code == 201, response.content
        assert Scope.CLINICAL_DETAIL in Consent.objects.active_scopes(link)
        permission = IsGuardianWithScope(Scope.CLINICAL_DETAIL)()
        assert permission.has_permission(
            SimpleNamespace(user=guardian_user), view=None
        ) is True
