"""Duplicate-merge service: R4 closure and documented re-attachment.

R4 (residual probe in test_hardening.py): a merge cycle CAN exist in the
database via queryset ``update()`` — the service must resolve canonically
with a BOUNDED, cycle-detected ascent and re-verify the target, never loop.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.medical.models import Consent, Encounter, HealthRecordEntry
from apps.patients.models import GuardianLink, PatientProfile
from apps.patients.services import claim_profile, merge_profiles, resolve_canonical

from .api_helpers import (
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
)
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db


def merge_ctx():
    center, director = make_center_with_director()
    return center, director


class TestMergeGuards:
    def test_self_merge_is_refused(self):
        center, director = merge_ctx()
        p = make_patient()
        with pytest.raises(ValidationError, match="lui-même"):
            merge_profiles(source=p, target=p, actor=director, center=center)

    def test_already_absorbed_source_is_refused(self):
        center, director = merge_ctx()
        canonical = make_patient()
        absorbed = make_patient(merged_into=canonical)
        with pytest.raises(ValidationError, match="déjà été absorbé"):
            merge_profiles(
                source=absorbed, target=make_patient(), actor=director, center=center
            )

    def test_two_claimed_profiles_are_never_auto_merged(self):
        center, director = merge_ctx()
        a = make_claimed_patient()
        b = make_claimed_patient()
        with pytest.raises(ValidationError, match="revendiqués"):
            merge_profiles(source=a, target=b, actor=director, center=center)
        a.refresh_from_db()
        assert a.merged_into_id is None

    def test_target_absorbed_elsewhere_is_resolved_to_canonical(self):
        """Merging into an absorbed duplicate silently lands on its
        canonical profile — never a chain."""
        center, director = merge_ctx()
        canonical = make_patient(first_name="Canonique")
        absorbed = make_patient(first_name="Doublon", merged_into=canonical)
        late = make_patient(first_name="Tardif")

        result = merge_profiles(
            source=late, target=absorbed, actor=director, center=center
        )

        assert result == canonical
        late.refresh_from_db()
        assert late.merged_into_id == canonical.pk


class TestR4CycleClosure:
    def build_cycle(self):
        """A<->B built via queryset update — exactly the R4 probe's bypass."""
        a = make_patient(first_name="A")
        b = make_patient(first_name="B")
        a.merged_into = b
        a.save()
        PatientProfile.objects.filter(pk=b.pk).update(merged_into=a.pk)
        return a, b

    def test_resolution_of_a_cycle_fails_cleanly_not_forever(self):
        a, _b = self.build_cycle()
        with pytest.raises(ValidationError, match="cyclique"):
            resolve_canonical(a)

    def test_merge_towards_a_cycle_member_is_refused_cleanly(self):
        a, _b = self.build_cycle()
        center, director = merge_ctx()
        victim = make_patient(first_name="Victime")

        with pytest.raises(ValidationError, match="cyclique"):
            merge_profiles(source=victim, target=a, actor=director, center=center)

        victim.refresh_from_db()
        assert victim.merged_into_id is None  # nothing half-written

    def test_target_resolving_back_to_source_is_refused(self):
        """source→…→target chain where canonical(target) IS the source."""
        center, director = merge_ctx()
        source = make_patient(first_name="Source")
        dup = make_patient(first_name="Dup", merged_into=source)

        with pytest.raises(ValidationError, match="cycle"):
            merge_profiles(source=source, target=dup, actor=director, center=center)

        source.refresh_from_db()
        assert source.merged_into_id is None

    def test_overlong_chain_is_bounded(self):
        head = make_patient(first_name="P0")
        current = head
        for i in range(25):  # > MERGE_MAX_HOPS, built via update() bypass
            nxt = make_patient(first_name=f"P{i + 1}")
            PatientProfile.objects.filter(pk=current.pk).update(merged_into=nxt.pk)
            current = nxt
        head.refresh_from_db()
        with pytest.raises(ValidationError, match="profonde"):
            resolve_canonical(head)


class TestMergeReattachment:
    def test_medical_history_reunites_on_the_canonical_profile(self):
        center, director = merge_ctx()
        source = make_patient(first_name="Doublon")
        target = make_patient(first_name="Canonique")
        make_encounter(patient=source, center=center, reason="Épisode fragmenté")
        HealthRecordEntry.objects.create(
            patient=source, entry_type="allergie", content="Pénicilline"
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        assert Encounter.objects.for_patient(target).count() == 1
        assert HealthRecordEntry.objects.for_patient(target).count() == 1
        assert Encounter.objects.for_patient(source).count() == 0

    def test_guardian_link_and_its_consent_follow_the_canonical_profile(self):
        center, director = merge_ctx()
        source = make_patient()
        target = make_patient()
        _gu, guardian = make_guardian_user()
        link = make_active_link(guardian, source)
        Consent.objects.create(
            patient=source, guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        assert link.patient_id == target.pk
        consent = Consent.objects.get(guardian_link=link)
        assert consent.patient_id == target.pk  # same-patient invariant holds
        assert Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)

    def test_duplicate_link_on_target_gets_the_source_link_revoked(self):
        center, director = merge_ctx()
        source = make_patient()
        target = make_patient()
        _gu, guardian = make_guardian_user()
        source_link = make_active_link(guardian, source)
        target_link = make_active_link(guardian, target)
        Consent.objects.create(
            patient=source, guardian_link=source_link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )

        merge_profiles(source=source, target=target, actor=director, center=center)

        source_link.refresh_from_db()
        target_link.refresh_from_db()
        assert source_link.status == GuardianLink.Status.REVOKED
        assert source_link.patient_id == source.pk  # history untouched
        assert target_link.status == GuardianLink.Status.ACTIVE
        # The clinical consent did NOT silently jump onto the surviving link.
        assert Consent.objects.active_scopes(target_link) == frozenset({"paiements"})

    def test_claimed_user_transfers_when_target_is_unclaimed(self):
        center, director = merge_ctx()
        source = make_claimed_patient()
        claimed_user = source.user
        target = make_patient()

        merge_profiles(source=source, target=target, actor=director, center=center)

        source.refresh_from_db()
        target.refresh_from_db()
        assert target.user == claimed_user
        assert target.claim_status == PatientProfile.ClaimStatus.ACTIVE
        assert source.user is None
        assert source.merged_into_id == target.pk

    def test_user_transfer_revokes_a_link_that_would_become_self_guardianship(self):
        """The guardian created a protégé profile… about themself, then the
        desk merges it with THEIR claimed patient profile: the link must die,
        not become guardian-of-oneself."""
        center, director = merge_ctx()
        guardian_user, guardian = make_guardian_user()
        their_patient_profile = make_claimed_patient(user=guardian_user)
        self_protege = make_patient(first_name="Moi-même")
        link = make_active_link(guardian, self_protege)

        merge_profiles(
            source=their_patient_profile, target=self_protege,
            actor=director, center=center,
        )

        link.refresh_from_db()
        self_protege.refresh_from_db()
        assert self_protege.user == guardian_user
        assert link.status == GuardianLink.Status.REVOKED


class TestUserTransferClaimantGate:
    """Troisième porte de PENDING_CLAIMANT_CONFIRMATION (revue guardian de
    l'incrément notifications, 2026-08-13) : quand la fusion TRANSFÈRE le
    titulaire de la source revendiquée vers la cible, les liens survivants
    de la cible n'ont jamais été confirmés par lui — ils doivent repasser
    par la porte, exactement comme à la revendication OTP. Avant ce
    correctif, un lien ACTIF semé sur la cible non revendiquée gardait sa
    visibilité « paiements » sur le profil fraîchement revendiqué."""

    def test_active_link_on_the_target_is_suspended_by_the_transfer(self):
        center, director = merge_ctx()
        _gu, guardian = make_guardian_user()
        target = make_patient()
        link = make_active_link(guardian, target)
        Consent.objects.create(
            patient=target, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        source = make_claimed_patient()
        titulaire = source.user

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        target.refresh_from_db()
        assert target.user == titulaire
        assert link.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        # Scopes révoqués : plus AUCUNE visibilité tant que le titulaire
        # n'a pas confirmé (le consentement clinique ne ressuscite pas).
        assert Consent.objects.active_scopes(link) == frozenset()

    def test_links_moved_from_the_claimed_source_repass_the_gate_too(self):
        """Sur-confirmation assumée : les liens que le titulaire avait déjà
        confirmés sur la source repassent par la porte sur la cible — un
        écran de confirmation, jamais un accès silencieux."""
        center, director = merge_ctx()
        source = make_claimed_patient()
        _gu, guardian = make_guardian_user()
        source_link = make_active_link(guardian, source)
        target = make_patient()

        merge_profiles(source=source, target=target, actor=director, center=center)

        source_link.refresh_from_db()
        assert source_link.patient_id == target.pk
        assert (
            source_link.status
            == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        )

    def test_merge_between_two_unclaimed_profiles_keeps_the_door_a_link_active(self):
        """Cas Mariama (hors de la troisième porte) : personne ne revendique,
        le tuteur continue de gérer le dossier — le lien reste ACTIF."""
        center, director = merge_ctx()
        _gu, guardian = make_guardian_user()
        source = make_patient()
        link = make_active_link(guardian, source)
        target = make_patient()

        merge_profiles(source=source, target=target, actor=director, center=center)

        link.refresh_from_db()
        assert link.patient_id == target.pk
        assert link.status == GuardianLink.Status.ACTIVE


class TestClaimService:
    def test_claim_revokes_links_where_the_claimer_was_the_guardian(self):
        guardian_user, guardian = make_guardian_user()
        profile = make_patient(first_name="En fait moi")
        link = make_active_link(guardian, profile)

        claim_profile(user=guardian_user, profile=profile)

        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED

    def test_claiming_an_absorbed_profile_is_refused(self):
        canonical = make_patient()
        absorbed = make_patient(merged_into=canonical)
        with pytest.raises(ValidationError, match="canonique"):
            claim_profile(user=make_user(), profile=absorbed)
