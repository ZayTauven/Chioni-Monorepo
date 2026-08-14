"""S2 — clinical consent collected AT THE DESK (porte C, ADR 0004 addendum).

Audit C.4: an UNCLAIMED patient could never grant `detail_clinique` (the
consent endpoints require ``IsPatientSelf``) and the center had no way to
record a consent collected on paper or orally. The new endpoint closes
that hole; these tests lock its strict conditions AND the ethical
invariant: a desk-collected consent DIES the moment the patient takes
possession of their profile (claim gate OTP-1 — every door).
"""

from types import SimpleNamespace

import pytest

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.common.permissions import IsGuardianWithScope, guardian_links_with_scope
from apps.medical.models import Consent
from apps.patients.models import GuardianLink
from apps.patients.services import claim_profile, merge_profiles

from .api_helpers import (
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import make_center, make_guardian, make_link, make_patient, make_user

pytestmark = pytest.mark.django_db

Role = StaffMembership.Role
Scope = Consent.Scope

CLAIMED_REFUSAL = "Ce patient gère lui-même ses consentements depuis son espace."
LINK_REFUSAL = "Ce lien de tutelle n'est pas un lien actif de ce patient."


def consent_url(center, patient):
    return f"/api/v1/centers/{center.pk}/patients/{patient.pk}/consents/clinical/"


def make_desk_case():
    """Center + director + unclaimed desk patient + guardian with an
    ACTIVE link. Returns (center, director, patient, guardian_user, link)."""
    center, director = make_center_with_director()
    patient = make_patient(created_by_center=center)
    guardian_user = make_user()
    guardian = make_guardian(user=guardian_user)
    link = make_link(guardian=guardian, patient=patient)
    return center, director, patient, guardian_user, link


class TestPermissions:
    @pytest.mark.parametrize("role", [Role.DIRECTOR, Role.SECRETARY, Role.CASHIER])
    def test_billing_roles_may_record(self, role):
        center, _director, patient, _g, link = make_desk_case()
        staff = make_staff_user(center, role=role)

        response = client_for(staff).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        assert response.status_code == 201, response.content

    @pytest.mark.parametrize(
        "role", [Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST]
    )
    def test_non_billing_roles_are_403(self, role):
        center, _director, patient, _g, link = make_desk_case()
        staff = make_staff_user(center, role=role)

        response = client_for(staff).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        assert response.status_code == 403

    def test_non_member_of_the_center_sees_nothing(self):
        center, _director, patient, _g, link = make_desk_case()
        outsider = make_staff_user(make_center(name="Autre Clinique"))

        response = client_for(outsider).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        assert response.status_code == 404

    def test_anonymous_401(self):
        center, _director, patient, _g, _link = make_desk_case()
        assert client_for().post(consent_url(center, patient), {}).status_code == 401


class TestStrictConditions:
    def test_patient_of_another_center_is_invisible(self):
        center, director, _p, _g, _l = make_desk_case()
        foreign_patient = make_patient(created_by_center=make_center(name="Ailleurs"))

        response = client_for(director).post(
            consent_url(center, foreign_patient),
            {"guardian_link": 1, "collected_via": "papier"},
        )

        assert response.status_code == 404

    def test_claimed_patient_is_refused_explicitly_on_post_and_delete(self):
        center, director, _p, _g, _l = make_desk_case()
        claimed = make_claimed_patient(created_by_center=center)
        client = client_for(director)

        post = client.post(
            consent_url(center, claimed),
            {"guardian_link": 1, "collected_via": "papier"},
        )
        delete = client.delete(consent_url(center, claimed), {"guardian_link": 1})

        assert post.status_code == 400
        assert CLAIMED_REFUSAL in str(post.data)
        assert delete.status_code == 400
        assert CLAIMED_REFUSAL in str(delete.data)

    def test_bad_link_refusals_are_byte_identical(self):
        """S1 body-ref norm: foreign link, revoked link, pending link and
        NON-EXISTENT link answer the exact same body — nothing to probe."""
        center, director, patient, _g, _link = make_desk_case()
        other_patient = make_patient(
            first_name="Anfia", last_name="Soilihi", created_by_center=center
        )
        foreign_link = make_link(patient=other_patient)
        revoked_link = make_link(
            guardian=make_guardian(), patient=patient
        )
        revoked_link.revoke()
        pending_link = make_link(
            guardian=make_guardian(), patient=patient,
            status=GuardianLink.Status.INVITATION_SENT,
        )
        client = client_for(director)

        responses = [
            client.post(
                consent_url(center, patient),
                {"guardian_link": pk, "collected_via": "papier"},
            )
            for pk in (foreign_link.pk, revoked_link.pk, pending_link.pk, 999999)
        ]

        for response in responses:
            assert response.status_code == 400
        bodies = {response.content for response in responses}
        assert len(bodies) == 1  # byte-identical
        assert LINK_REFUSAL in str(responses[0].data)

    def test_collected_via_is_required_and_validated(self):
        center, director, patient, _g, link = make_desk_case()
        client = client_for(director)

        missing = client.post(
            consent_url(center, patient), {"guardian_link": link.pk}
        )
        invalid = client.post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "sms"},
        )

        assert missing.status_code == 400 and "collected_via" in missing.data
        assert invalid.status_code == 400 and "collected_via" in invalid.data

    def test_guardian_link_is_required(self):
        center, director, patient, _g, _link = make_desk_case()

        response = client_for(director).post(
            consent_url(center, patient), {"collected_via": "papier"}
        )

        assert response.status_code == 400
        assert "guardian_link" in response.data


class TestGrantAtDesk:
    def test_grant_records_the_collection_trace(self):
        center, director, patient, _g, link = make_desk_case()

        response = client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "oral"},
        )

        assert response.status_code == 201, response.content
        assert response.data == {
            "guardian_link": link.pk,
            "scope": "detail_clinique",
            "collected_via": "oral",
            "granted_at": response.data["granted_at"],
            "revoked_at": None,
        }
        consent = Consent.objects.get(guardian_link=link)
        assert consent.collected_by == director
        assert consent.collected_via == Consent.CollectedVia.ORAL

    def test_grant_really_opens_the_clinical_door_to_the_guardian(self):
        """End-to-end at the current API surface: ``active_scopes`` is THE
        source of truth, so the scoped permission AND the F3 queryset
        helper must both open after the desk collection."""
        center, director, patient, guardian_user, link = make_desk_case()
        permission = IsGuardianWithScope(Scope.CLINICAL_DETAIL)()
        request = SimpleNamespace(user=guardian_user)
        assert permission.has_permission(request, view=None) is False

        client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        assert Scope.CLINICAL_DETAIL in Consent.objects.active_scopes(link)
        assert permission.has_permission(request, view=None) is True
        assert link in guardian_links_with_scope(guardian_user, Scope.CLINICAL_DETAIL)

    def test_double_grant_is_refused(self):
        center, director, patient, _g, link = make_desk_case()
        client = client_for(director)
        client.post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        second = client.post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "oral"},
        )

        assert second.status_code == 400
        assert "déjà accordé" in str(second.data)

    def test_grant_is_audited_with_references_only(self):
        center, director, patient, _g, link = make_desk_case()

        client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )

        entry = AuditLog.objects.get(action=AuditAction.CONSENT_GRANTED_BY_CENTER)
        assert entry.actor == director
        assert entry.payload["link_id"] == link.pk
        assert entry.payload["patient_id"] == patient.pk
        assert entry.payload["center_id"] == center.pk
        assert entry.payload["collected_via"] == "papier"
        # References only — never the patient's identity (ADR 0007).
        assert patient.first_name not in str(entry.payload)
        assert patient.last_name not in str(entry.payload)


class TestRevokeAtDesk:
    def _granted_case(self):
        center, director, patient, guardian_user, link = make_desk_case()
        client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )
        return center, director, patient, guardian_user, link

    def test_delete_revokes_and_closes_the_clinical_door(self):
        center, director, patient, guardian_user, link = self._granted_case()

        response = client_for(director).delete(
            consent_url(center, patient), {"guardian_link": link.pk}
        )

        assert response.status_code == 200, response.content
        assert response.data["revoked_at"] is not None
        assert Consent.objects.active_scopes(link) == frozenset({Scope.PAYMENTS})
        permission = IsGuardianWithScope(Scope.CLINICAL_DETAIL)()
        assert permission.has_permission(
            SimpleNamespace(user=guardian_user), view=None
        ) is False

    def test_delete_without_active_clinical_consent_is_400(self):
        center, director, patient, _g, link = make_desk_case()

        response = client_for(director).delete(
            consent_url(center, patient), {"guardian_link": link.pk}
        )

        assert response.status_code == 400
        assert "Aucun consentement clinique actif" in str(response.data)

    def test_revoke_is_audited(self):
        center, director, patient, _g, link = self._granted_case()

        client_for(director).delete(
            consent_url(center, patient), {"guardian_link": link.pk}
        )

        entry = AuditLog.objects.get(action=AuditAction.CONSENT_REVOKED_BY_CENTER)
        assert entry.payload["link_id"] == link.pk
        assert entry.payload["center_id"] == center.pk


class TestClaimGateInvariant:
    """L'invariant éthique (OTP-1) : le patient qui revendique reprend TOUT
    contrôle — un consentement recueilli par le centre n'y survit JAMAIS,
    quelle que soit la porte d'arrivée du titulaire."""

    def test_desk_consent_dies_at_otp_claim(self):
        center, director, patient, guardian_user, link = make_desk_case()
        client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )
        assert Consent.objects.allows(link, Scope.CLINICAL_DETAIL)

        claim_profile(user=make_user(), profile=patient)

        link.refresh_from_db()
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert Consent.objects.active_scopes(link) == frozenset()
        consent = Consent.objects.get(guardian_link=link)
        assert consent.revoked_at is not None
        permission = IsGuardianWithScope(Scope.CLINICAL_DETAIL)()
        assert permission.has_permission(
            SimpleNamespace(user=guardian_user), view=None
        ) is False

    def test_confirming_the_link_never_resurrects_the_desk_consent(self):
        """After the claim, the patient may confirm the LINK — but that
        only restores the minimal payments scope, never the clinical one:
        the desk-collected consent stays dead."""
        from apps.patients.services import confirm_guardian_link

        center, director, patient, _g, link = make_desk_case()
        client_for(director).post(
            consent_url(center, patient),
            {"guardian_link": link.pk, "collected_via": "oral"},
        )
        titulaire = make_user()
        claim_profile(user=titulaire, profile=patient)
        link.refresh_from_db()

        confirm_guardian_link(patient_user=titulaire, link=link)

        assert Consent.objects.active_scopes(link) == frozenset({Scope.PAYMENTS})

    def test_desk_consent_dies_when_the_link_merges_onto_a_claimed_target(self):
        """Deuxième porte : la fusion déplace le lien (et son consentement)
        vers une cible REVENDIQUÉE → suspension + révocation."""
        center, director, source, _g, link = make_desk_case()
        client_for(director).post(
            consent_url(center, source),
            {"guardian_link": link.pk, "collected_via": "papier"},
        )
        target = make_claimed_patient(created_by_center=center)

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        assert link.patient_id == target.pk
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert Consent.objects.active_scopes(link) == frozenset()
        assert Consent.objects.get(guardian_link=link).revoked_at is not None

    def test_desk_consent_dies_when_the_titulaire_transfers_by_merge(self):
        """Troisième porte : la cible NON revendiquée porte le consentement
        guichet ; la fusion lui transfère le titulaire de la source → les
        liens survivants de la cible sont suspendus, le consentement meurt."""
        center, director = make_center_with_director()
        target = make_patient(created_by_center=center)
        link = make_link(guardian=make_guardian(), patient=target)
        client_for(director).post(
            consent_url(center, target),
            {"guardian_link": link.pk, "collected_via": "oral"},
        )
        source = make_claimed_patient(
            first_name="Anfia", last_name="Soilihi", created_by_center=center
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        assert Consent.objects.active_scopes(link) == frozenset()
        assert Consent.objects.get(guardian_link=link).revoked_at is not None

    def test_no_desk_write_path_reaches_a_claimed_profile(self):
        """Closing the loop: once claimed, the ONLY consent paths are the
        patient's own endpoints — the desk gets its explicit 400 on both
        verbs (already asserted) and the SERVICE guard holds for direct
        callers too."""
        from django.core.exceptions import ValidationError

        from apps.patients.services import grant_clinical_consent_at_center

        center, director, patient, _g, link = make_desk_case()
        claim_profile(user=make_user(), profile=patient)
        link.refresh_from_db()

        with pytest.raises(ValidationError, match="gère lui-même"):
            grant_clinical_consent_at_center(
                actor=director, center=center, patient=patient, link=link,
                collected_via="papier",
            )
