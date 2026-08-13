"""Consent invariants — the ethical core: paying is not knowing everything.

``Consent.objects.active_scopes()`` is THE source of truth for guardian
visibility; these tests pin its behaviour.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.medical.models import Consent
from apps.patients.models import GuardianLink

from .factories import make_link, make_patient

pytestmark = pytest.mark.django_db

Scope = Consent.Scope


class TestDefaultMinimalScope:
    def test_active_link_without_consent_sees_payments_only(self):
        link = make_link()

        scopes = Consent.objects.active_scopes(link)

        assert scopes == frozenset({Scope.PAYMENTS})
        assert not Consent.objects.allows(link, Scope.CLINICAL_DETAIL)

    def test_inactive_link_sees_nothing_at_all(self):
        pending = make_link(status=GuardianLink.Status.INVITATION_SENT)
        revoked = make_link(status=GuardianLink.Status.REVOKED)

        assert Consent.objects.active_scopes(pending) == frozenset()
        assert Consent.objects.active_scopes(revoked) == frozenset()

    def test_explicit_grant_opens_clinical_detail(self):
        link = make_link()
        Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )

        scopes = Consent.objects.active_scopes(link)

        assert Scope.CLINICAL_DETAIL in scopes
        assert Scope.PAYMENTS in scopes  # the floor never disappears

    def test_grant_on_one_link_does_not_leak_to_another(self):
        patient = make_patient()
        trusted = make_link(patient=patient)
        other = make_link(patient=patient)
        Consent.objects.create(
            patient=patient, guardian_link=trusted, scope=Scope.CLINICAL_DETAIL
        )

        assert Consent.objects.allows(trusted, Scope.CLINICAL_DETAIL)
        assert not Consent.objects.allows(other, Scope.CLINICAL_DETAIL)


class TestRevocation:
    def test_revocation_is_effective_immediately(self):
        link = make_link()
        consent = Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )
        assert Consent.objects.allows(link, Scope.CLINICAL_DETAIL)

        consent.revoke()

        assert not Consent.objects.allows(link, Scope.CLINICAL_DETAIL)
        # The minimal floor survives revocation of the extended grant.
        assert Consent.objects.allows(link, Scope.PAYMENTS)

    def test_revoked_consent_row_is_kept_for_traceability(self):
        link = make_link()
        consent = Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )

        consent.revoke()

        consent.refresh_from_db()
        assert consent.revoked_at is not None
        assert Consent.objects.filter(guardian_link=link).count() == 1

    def test_a_new_grant_after_revocation_is_possible(self):
        link = make_link()
        first = Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )
        first.revoke()

        Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )

        assert Consent.objects.allows(link, Scope.CLINICAL_DETAIL)


class TestIntegrity:
    def test_consent_must_match_the_link_patient(self):
        link = make_link()
        stranger = make_patient(first_name="Anfia", last_name="Soilihi")

        with pytest.raises(ValidationError):
            Consent.objects.create(
                patient=stranger, guardian_link=link, scope=Scope.CLINICAL_DETAIL
            )

    def test_no_duplicate_active_grant_for_same_link_and_scope(self):
        from django.db import IntegrityError

        link = make_link()
        Consent.objects.create(
            patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
        )

        with pytest.raises(IntegrityError):
            Consent.objects.create(
                patient=link.patient, guardian_link=link, scope=Scope.CLINICAL_DETAIL
            )
