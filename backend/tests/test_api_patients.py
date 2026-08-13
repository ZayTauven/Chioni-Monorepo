"""Patients & guardianship API — the three doors, consents, medical secrecy.

Matrix per endpoint: anonymous → 401 ; wrong hat → 403/404 ; cross-center
IDOR → 404 ; cross-patient IDOR → 404 ; guardian payloads NEVER carry
clinical or intimate identity fields (asserted on FIELDS, not status codes);
revocation is effective immediately.
"""

import pytest

from apps.audit.models import AuditLog
from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientProfile

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_center, make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db

#: The ONLY fields a guardian may see about a protégé (administrative).
GUARDIAN_PATIENT_FIELDS = {"id", "first_name", "last_name", "claim_status"}
GUARDIAN_LINK_FIELDS = {"id", "patient", "relationship", "status",
                        "initiated_by", "accepted_at"}


# ---------------------------------------------------------------------------
# Porte C — desk creation by center staff
# ---------------------------------------------------------------------------


class TestDoorCDeskRegistry:
    def test_anonymous_is_401(self):
        center = make_center()
        assert client_for().get(f"/api/v1/centers/{center.pk}/patients/").status_code == 401

    def test_staff_creates_a_patient_at_the_desk(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)

        response = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/patients/",
            {"first_name": "Mariama", "last_name": "Ahamada",
             "phone": "+2693312345", "city": "Mitsamiouli"},
        )

        assert response.status_code == 201, response.content
        profile = PatientProfile.objects.get(pk=response.data["id"])
        assert profile.claim_status == PatientProfile.ClaimStatus.UNCLAIMED
        assert profile.created_by_center == center
        assert profile.created_by_user == secretary

    def test_desk_creation_with_guardian_attaches_an_invitation(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)

        response = client_for(secretary).post(
            f"/api/v1/centers/{center.pk}/patients/",
            {"first_name": "Ali", "last_name": "Soilihi",
             "guardian_phone": "+33612345678", "guardian_relationship": "enfant"},
        )

        assert response.status_code == 201, response.content
        link = GuardianLink.objects.get(patient_id=response.data["id"])
        assert link.status == GuardianLink.Status.INVITATION_SENT
        assert link.initiated_by == GuardianLink.InitiatedBy.CENTER
        assert link.guardian.user.phone == "+33612345678"
        # Nothing opens before acceptance — not even the payments scope.
        assert Consent.objects.active_scopes(link) == frozenset()

    def test_registry_only_shows_patients_of_this_center(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.SECRETARY)
        mine = make_patient(first_name="Anfia", created_by_center=center_a)
        make_patient(first_name="Étrangère", created_by_center=center_b)

        response = client_for(staff_a).get(f"/api/v1/centers/{center_a.pk}/patients/")

        assert [p["id"] for p in response.data["results"]] == [mine.pk]

    def test_a_patient_seen_through_an_encounter_enters_the_perimeter(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(first_name="Vue ici")
        make_encounter(patient=patient, center=center)

        response = client_for(staff).get(f"/api/v1/centers/{center.pk}/patients/{patient.pk}/")

        assert response.status_code == 200

    def test_cross_center_patient_detail_is_404(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.SECRETARY)
        foreign = make_patient(created_by_center=center_b)

        response = client_for(staff_a).get(
            f"/api/v1/centers/{center_a.pk}/patients/{foreign.pk}/"
        )

        assert response.status_code == 404

    def test_guardian_hat_cannot_use_the_desk(self):
        center, _ = make_center_with_director()
        guardian_user, _ = make_guardian_user()
        response = client_for(guardian_user).get(
            f"/api/v1/centers/{center.pk}/patients/"
        )
        assert response.status_code == 404  # the center itself is invisible


# ---------------------------------------------------------------------------
# Porte B — the patient's own space
# ---------------------------------------------------------------------------


class TestDoorBPatientSelf:
    def test_anonymous_is_401(self):
        assert client_for().get("/api/v1/patients/me/").status_code == 401

    def test_user_without_profile_gets_403_on_read(self):
        assert client_for(make_user()).get("/api/v1/patients/me/").status_code == 403

    def test_create_then_read_my_profile(self):
        user = make_user()
        client = client_for(user)

        created = client.post(
            "/api/v1/patients/me/",
            {"first_name": "Anfia", "last_name": "Soilihi", "city": "Moroni"},
        )
        assert created.status_code == 201, created.content
        assert created.data["claim_status"] == "actif"

        read = client.get("/api/v1/patients/me/")
        assert read.status_code == 200
        assert read.data["first_name"] == "Anfia"

    def test_double_creation_is_refused_in_french(self):
        user = make_user()
        client = client_for(user)
        client.post("/api/v1/patients/me/", {"first_name": "A", "last_name": "B"})
        again = client.post("/api/v1/patients/me/", {"first_name": "A", "last_name": "B"})
        assert again.status_code == 400
        assert "déjà un profil patient" in str(again.data)

    def test_patch_updates_my_identity(self):
        profile = make_claimed_patient()
        response = client_for(profile.user).patch(
            "/api/v1/patients/me/", {"city": "Fomboni"}
        )
        assert response.status_code == 200
        profile.refresh_from_db()
        assert profile.city == "Fomboni"

    def test_staff_hat_alone_cannot_enter_the_patient_space(self):
        center, director = make_center_with_director()
        assert client_for(director).get("/api/v1/patients/me/").status_code == 403


# ---------------------------------------------------------------------------
# Porte A — guardian space
# ---------------------------------------------------------------------------


class TestDoorAGuardian:
    def test_anonymous_is_401(self):
        assert client_for().get("/api/v1/guardian/proteges/").status_code == 401

    def test_create_guardian_profile_then_a_protege(self):
        user = make_user()
        client = client_for(user)

        profile = client.post("/api/v1/guardian/profile/", {"country_of_residence": "FR"})
        assert profile.status_code == 201

        protege = client.post(
            "/api/v1/guardian/proteges/",
            {"first_name": "Mariama", "last_name": "Ahamada",
             "relationship": "parent", "city": "Mitsamiouli"},
        )
        assert protege.status_code == 201, protege.content
        assert protege.data["status"] == "actif"
        assert protege.data["patient"]["claim_status"] == "non_revendique"

    def test_without_guardian_profile_the_space_is_403(self):
        assert client_for(make_user()).get("/api/v1/guardian/proteges/").status_code == 403

    def test_protege_payload_is_strictly_administrative(self):
        """Field-level assertion: no phone, no birth_date, no city, nothing
        clinical — whatever the link's consent level."""
        guardian_user, guardian = make_guardian_user()
        patient = make_claimed_patient(birth_date="1950-03-15", phone="+2693312345")
        link = make_active_link(guardian, patient)
        # Even WITH full clinical consent, this administrative payload stays flat.
        Consent.objects.create(
            patient=patient, guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL
        )

        response = client_for(guardian_user).get("/api/v1/guardian/proteges/")

        assert response.status_code == 200
        (row,) = response.data["results"]
        assert set(row.keys()) == GUARDIAN_LINK_FIELDS
        assert set(row["patient"].keys()) == GUARDIAN_PATIENT_FIELDS
        forbidden = {"birth_date", "phone", "city", "diagnosis", "reason", "sex"}
        assert forbidden.isdisjoint(row["patient"].keys())

    def test_guardian_only_lists_their_own_proteges(self):
        guardian_user_a, guardian_a = make_guardian_user()
        _guardian_user_b, guardian_b = make_guardian_user()
        mine = make_patient(first_name="Mien")
        make_active_link(guardian_a, mine)
        make_active_link(guardian_b, make_patient(first_name="Autre"))

        response = client_for(guardian_user_a).get("/api/v1/guardian/proteges/")

        assert [r["patient"]["id"] for r in response.data["results"]] == [mine.pk]

    def test_pending_invitation_is_not_a_protege_yet(self):
        guardian_user, guardian = make_guardian_user()
        patient = make_patient()
        GuardianLink.objects.create(
            guardian=guardian, patient=patient,
            relationship=GuardianLink.Relationship.CHILD,
            status=GuardianLink.Status.INVITATION_SENT,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )

        proteges = client_for(guardian_user).get("/api/v1/guardian/proteges/")
        invitations = client_for(guardian_user).get("/api/v1/guardian/invitations/")

        assert proteges.data["results"] == []
        assert len(invitations.data["results"]) == 1

    def test_accepting_an_invitation_opens_the_minimal_scope(self):
        patient = make_claimed_patient()
        invite = client_for(patient.user).post(
            "/api/v1/patients/me/guardians/invite/",
            {"phone": "+33698765432", "relationship": "enfant"},
        )
        assert invite.status_code == 201
        link = GuardianLink.objects.get(pk=invite.data["id"])
        guardian_user = link.guardian.user

        accept = client_for(guardian_user).post(
            f"/api/v1/guardian/invitations/{link.pk}/accept/"
        )

        assert accept.status_code == 200
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE
        assert Consent.objects.active_scopes(link) == frozenset({"paiements"})

    def test_accepting_someone_elses_invitation_is_404(self):
        patient = make_claimed_patient()
        client_for(patient.user).post(
            "/api/v1/patients/me/guardians/invite/",
            {"phone": "+33698765432", "relationship": "enfant"},
        )
        link = GuardianLink.objects.get(patient=patient)
        intruder_user, _ = make_guardian_user()

        response = client_for(intruder_user).post(
            f"/api/v1/guardian/invitations/{link.pk}/accept/"
        )

        assert response.status_code == 404
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.INVITATION_SENT


# ---------------------------------------------------------------------------
# Links & revocation — patient side, guardian side, immediate effect
# ---------------------------------------------------------------------------


class TestLinkLifecycle:
    def test_patient_sees_their_links_with_effective_scopes(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        response = client_for(patient.user).get("/api/v1/patients/me/guardians/")

        (row,) = response.data["results"]
        assert row["id"] == link.pk
        assert row["scopes"] == ["paiements"]

    def test_patient_revokes_a_link_effect_is_immediate(self):
        patient = make_claimed_patient()
        guardian_user, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        before = client_for(guardian_user).get("/api/v1/guardian/proteges/")
        assert len(before.data["results"]) == 1

        revoke = client_for(patient.user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/revoke/"
        )
        assert revoke.status_code == 200

        after = client_for(guardian_user).get("/api/v1/guardian/proteges/")
        assert after.data["results"] == []  # immediate — no cache, no grace

    def test_patient_cancels_a_sent_invitation_via_revoke(self):
        """« Annulation d'invitation » (frontend) : ``revoke/`` fonctionne
        AUSSI sur un lien encore en ``invitation_envoyee`` — verrouillé ici
        (la machine à états du modèle le permet, ce test l'atteste)."""
        patient = make_claimed_patient()
        invite = client_for(patient.user).post(
            "/api/v1/patients/me/guardians/invite/",
            {"phone": "+33698765431", "relationship": "enfant"},
        )
        assert invite.status_code == 201, invite.content
        link = GuardianLink.objects.get(pk=invite.data["id"])
        assert link.status == GuardianLink.Status.INVITATION_SENT

        response = client_for(patient.user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/revoke/"
        )

        assert response.status_code == 200, response.content
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED
        assert link.revoked_at is not None
        # The would-be guardian no longer sees any pending invitation.
        invitations = client_for(link.guardian.user).get(
            "/api/v1/guardian/invitations/"
        )
        assert invitations.data["results"] == []

    def test_guardian_revokes_their_own_link(self):
        patient = make_claimed_patient()
        guardian_user, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        response = client_for(guardian_user).post(
            f"/api/v1/guardian/links/{link.pk}/revoke/"
        )

        assert response.status_code == 200
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED

    def test_cross_patient_link_revocation_is_404(self):
        """IDOR inter-patients: I cannot revoke (nor discover) someone
        else's link."""
        patient_a = make_claimed_patient()
        patient_b = make_claimed_patient()
        _gu, guardian_b = make_guardian_user()
        foreign_link = make_active_link(guardian_b, patient_b)

        response = client_for(patient_a.user).post(
            f"/api/v1/patients/me/guardians/{foreign_link.pk}/revoke/"
        )

        assert response.status_code == 404
        foreign_link.refresh_from_db()
        assert foreign_link.status == GuardianLink.Status.ACTIVE

    def test_cross_guardian_link_revocation_is_404(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        other_guardian_user, _ = make_guardian_user()

        response = client_for(other_guardian_user).post(
            f"/api/v1/guardian/links/{link.pk}/revoke/"
        )

        assert response.status_code == 404
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE


# ---------------------------------------------------------------------------
# Consents — the patient ALONE drives detail_clinique
# ---------------------------------------------------------------------------


class TestClinicalConsent:
    def test_patient_grants_then_revokes_clinical_detail(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        client = client_for(patient.user)

        granted = client.post(
            f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/"
        )
        assert granted.status_code == 201
        assert Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)
        assert sorted(granted.data["scopes"]) == ["detail_clinique", "paiements"]

        revoked = client.delete(
            f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/"
        )
        assert revoked.status_code == 200
        assert not Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)
        assert revoked.data["scopes"] == ["paiements"]

    def test_guardian_cannot_grant_consent_to_themselves(self):
        """The consent endpoint lives in the PATIENT space only: the
        guardian's hat gets 403 (no claimed patient profile), and a guardian
        who ALSO happens to be a patient elsewhere gets 404 (not their link)."""
        patient = make_claimed_patient()
        guardian_user, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)

        pure_guardian = client_for(guardian_user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/"
        )
        assert pure_guardian.status_code == 403

        make_claimed_patient(user=guardian_user)  # multi-hat: also a patient
        multi_hat = client_for(guardian_user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/"
        )
        assert multi_hat.status_code == 404  # someone else's link stays invisible
        assert not Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)

    def test_consent_on_an_invitation_link_is_refused(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = GuardianLink.objects.create(
            guardian=guardian, patient=patient,
            relationship=GuardianLink.Relationship.CHILD,
            status=GuardianLink.Status.INVITATION_SENT,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )

        response = client_for(patient.user).post(
            f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/"
        )

        assert response.status_code == 400
        assert not Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)

    def test_revoking_the_link_kills_the_clinical_consent_at_api_level(self):
        patient = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        client = client_for(patient.user)
        client.post(f"/api/v1/patients/me/guardians/{link.pk}/consents/clinical/")

        client.post(f"/api/v1/patients/me/guardians/{link.pk}/revoke/")

        link.refresh_from_db()
        assert Consent.objects.active_scopes(link) == frozenset()


# ---------------------------------------------------------------------------
# Guardian declines an invitation — symmetric of accept, revoke semantics
# ---------------------------------------------------------------------------


class TestGuardianDeclineInvitation:
    def _invitation(self):
        patient = make_claimed_patient()
        invite = client_for(patient.user).post(
            "/api/v1/patients/me/guardians/invite/",
            {"phone": "+33698765432", "relationship": "enfant"},
        )
        assert invite.status_code == 201, invite.content
        return patient, GuardianLink.objects.get(pk=invite.data["id"])

    def test_guardian_declines_their_invitation(self):
        _patient, link = self._invitation()
        guardian_user = link.guardian.user

        response = client_for(guardian_user).post(
            f"/api/v1/guardian/invitations/{link.pk}/decline/"
        )

        assert response.status_code == 200, response.content
        assert response.data["status"] == GuardianLink.Status.REVOKED
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED
        assert link.revoked_at is not None
        # Gone from the pending invitations list, nothing ever opened.
        invitations = client_for(guardian_user).get("/api/v1/guardian/invitations/")
        assert invitations.data["results"] == []
        assert Consent.objects.active_scopes(link) == frozenset()
        # Audited like the other link transitions (references only).
        entry = AuditLog.objects.filter(
            action="guardian_link.revoked", object_id=str(link.pk)
        ).latest("created_at")
        assert entry.actor == guardian_user
        assert entry.payload["reason"] == "invitation_declined"

    def test_declining_twice_is_400(self):
        _patient, link = self._invitation()
        client = client_for(link.guardian.user)
        url = f"/api/v1/guardian/invitations/{link.pk}/decline/"
        assert client.post(url).status_code == 200
        again = client.post(url)
        assert again.status_code == 400
        assert "n'est plus en attente" in str(again.data)

    def test_declining_an_already_accepted_link_is_400(self):
        _patient, link = self._invitation()
        client = client_for(link.guardian.user)
        assert (
            client.post(f"/api/v1/guardian/invitations/{link.pk}/accept/").status_code
            == 200
        )
        response = client.post(f"/api/v1/guardian/invitations/{link.pk}/decline/")
        assert response.status_code == 400
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.ACTIVE  # untouched

    def test_declining_someone_elses_invitation_is_404(self):
        _patient, link = self._invitation()
        intruder_user, _ = make_guardian_user()

        response = client_for(intruder_user).post(
            f"/api/v1/guardian/invitations/{link.pk}/decline/"
        )

        assert response.status_code == 404
        link.refresh_from_db()
        assert link.status == GuardianLink.Status.INVITATION_SENT


# ---------------------------------------------------------------------------
# Staff share routing — GET /centers/{c}/patients/{pk}/guardian-links/
# ---------------------------------------------------------------------------

#: The ONLY fields the desk sees of a link: the share target, a display
#: name, the relationship — no phone, no scopes, no status/history.
STAFF_ROUTING_LINK_FIELDS = {"id", "guardian_name", "relationship"}


class TestStaffGuardianLinkDiscovery:
    """Routing a payment-request share at the desk (cas Mariama, porte C):
    billing staff list the patient's ACTIVE links to target the guardian
    the PATIENT designates — nothing more (no phone, no consent scopes)."""

    def _scene(self):
        center, _ = make_center_with_director()
        secretary = make_staff_user(center, role=Role.SECRETARY)
        patient = make_patient(created_by_center=center)
        return center, secretary, patient

    @staticmethod
    def _url(center, patient):
        return f"/api/v1/centers/{center.pk}/patients/{patient.pk}/guardian-links/"

    def test_anonymous_is_401(self):
        center, _secretary, patient = self._scene()
        assert client_for().get(self._url(center, patient)).status_code == 401

    def test_foreign_center_staff_is_404(self):
        center, _secretary, patient = self._scene()
        other_center, _ = make_center_with_director()
        outsider = make_staff_user(other_center, role=Role.SECRETARY)
        assert (
            client_for(outsider).get(self._url(center, patient)).status_code == 404
        )

    def test_clinical_role_is_403(self):
        center, _secretary, patient = self._scene()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        assert client_for(doctor).get(self._url(center, patient)).status_code == 403

    def test_patient_of_another_center_is_404(self):
        center, secretary, _patient = self._scene()
        other_center, _ = make_center_with_director()
        foreign_patient = make_patient(created_by_center=other_center)
        assert (
            client_for(secretary).get(self._url(center, foreign_patient)).status_code
            == 404
        )

    def test_every_billing_role_is_allowed(self):
        center, _secretary, patient = self._scene()
        for role in (Role.DIRECTOR, Role.SECRETARY, Role.CASHIER):
            staff = make_staff_user(center, role=role)
            response = client_for(staff).get(self._url(center, patient))
            assert response.status_code == 200, role

    def test_only_active_links_with_the_minimal_payload(self):
        center, secretary, patient = self._scene()
        # ACTIVE — the only row that must come back.
        active_user = make_user()
        active_user.first_name, active_user.last_name = "Nassim", "Abdou"
        active_user.save(update_fields=["first_name", "last_name"])
        _gu, active_guardian = make_guardian_user(user=active_user)
        active_link = make_active_link(active_guardian, patient)
        # Every non-active status must stay invisible.
        _gu2, invited_guardian = make_guardian_user()
        GuardianLink.objects.create(
            guardian=invited_guardian, patient=patient,
            relationship=GuardianLink.Relationship.CHILD,
            status=GuardianLink.Status.INVITATION_SENT,
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        _gu3, revoked_guardian = make_guardian_user()
        make_active_link(revoked_guardian, patient).revoke()
        _gu4, pending_guardian = make_guardian_user()
        GuardianLink.objects.create(
            guardian=pending_guardian, patient=patient,
            relationship=GuardianLink.Relationship.SIBLING,
            status=GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION,
            initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
        )

        response = client_for(secretary).get(self._url(center, patient))

        assert response.status_code == 200, response.content
        (row,) = response.data["results"]
        assert row["id"] == active_link.pk
        assert set(row.keys()) == STAFF_ROUTING_LINK_FIELDS
        assert row["guardian_name"] == "Nassim Abdou"
        assert row["relationship"] == GuardianLink.Relationship.CHILD
        # No scopes: whether a clinical consent exists is the PATIENT's
        # information, never the desk's.
        assert "scopes" not in row
        assert "status" not in row

    def test_no_phone_leak_even_for_a_nameless_shadow_guardian(self):
        """The Mariama case: the guardian is a shadow account known by phone
        only. The desk gets a MASKED display name — the full number never
        transits (nor the « invite-<phone> » username)."""
        center, secretary, patient = self._scene()
        shadow_user = make_user(phone="+33698000001")
        _gu, guardian = make_guardian_user(user=shadow_user)
        make_active_link(guardian, patient)

        response = client_for(secretary).get(self._url(center, patient))

        assert response.status_code == 200
        raw = response.content.decode("utf-8")
        assert "+33698000001" not in raw
        assert "33698000001" not in raw
        assert "98000001" not in raw  # no long identifying substring either
        (row,) = response.data["results"]
        assert row["guardian_name"].endswith("01")  # recognisable at the desk
        assert "•" in row["guardian_name"]

    def test_full_clinical_consent_changes_nothing_in_the_payload(self):
        center, secretary, patient = self._scene()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        Consent.objects.create(
            patient=patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )

        response = client_for(secretary).get(self._url(center, patient))

        (row,) = response.data["results"]
        assert set(row.keys()) == STAFF_ROUTING_LINK_FIELDS


# ---------------------------------------------------------------------------
# Merge endpoint — staff only, same center
# ---------------------------------------------------------------------------


class TestMergeEndpoint:
    def test_staff_merges_two_desk_duplicates(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        source = make_patient(first_name="Mariama", created_by_center=center)
        target = make_patient(first_name="Mariama", created_by_center=center)

        response = client_for(staff).post(
            f"/api/v1/centers/{center.pk}/patients/merge/",
            {"source_id": source.pk, "target_id": target.pk},
        )

        assert response.status_code == 200, response.content
        source.refresh_from_db()
        assert source.merged_into_id == target.pk

    def test_merge_with_a_foreign_profile_is_an_explicit_400(self):
        """S1 refusal semantics (ADR 0008 addendum): the ids travel in the
        BODY → 400 explicite, same message for foreign and non-existent
        profiles (no cross-tenant existence oracle) — nothing merged."""
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.SECRETARY)
        mine = make_patient(created_by_center=center_a)
        foreign = make_patient(created_by_center=center_b)

        response = client_for(staff_a).post(
            f"/api/v1/centers/{center_a.pk}/patients/merge/",
            {"source_id": mine.pk, "target_id": foreign.pk},
        )

        assert response.status_code == 400
        assert "n'est pas connu de ce centre" in str(response.data)
        mine.refresh_from_db()
        assert mine.merged_into_id is None

        unknown = client_for(staff_a).post(
            f"/api/v1/centers/{center_a.pk}/patients/merge/",
            {"source_id": mine.pk, "target_id": 999999},
        )
        assert unknown.status_code == 400
        assert unknown.data == response.data  # rien ne distingue les deux

    def test_merge_is_reserved_to_billing_roles(self):
        """S1 (arbitrage C.3) : la fusion déplace des liens de tutelle —
        opération d'administration du dossier, rôles BILLING seuls. Le
        soignant garde la création/modification de patient, pas la fusion."""
        center, _ = make_center_with_director()
        p1 = make_patient(created_by_center=center)
        p2 = make_patient(created_by_center=center)
        for role in (Role.DOCTOR, Role.NURSE, Role.MIDWIFE, Role.PHARMACIST):
            refused = client_for(make_staff_user(center, role=role)).post(
                f"/api/v1/centers/{center.pk}/patients/merge/",
                {"source_id": p1.pk, "target_id": p2.pk},
            )
            assert refused.status_code == 403, role
        p1.refresh_from_db()
        assert p1.merged_into_id is None

    def test_patient_or_guardian_hat_cannot_merge(self):
        center, _ = make_center_with_director()
        p1 = make_patient(created_by_center=center)
        p2 = make_patient(created_by_center=center)
        patient = make_claimed_patient()

        response = client_for(patient.user).post(
            f"/api/v1/centers/{center.pk}/patients/merge/",
            {"source_id": p1.pk, "target_id": p2.pk},
        )

        assert response.status_code == 404  # center invisible to that hat
