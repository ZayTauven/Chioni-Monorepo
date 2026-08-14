"""S3 (ADR 0016 §2) — duplicate detection at the desk (`patients/similar/`).

NON-blocking search: the desk is informed, the desk decides. Contract:

- same E.164-normalised phone (whatever the spelling, ``phone_alt``
  included) OR same birth date + approaching last name (icontains);
- candidates come from THIS center's perimeter only, tombstones hidden;
- any staff role; refusal semantics per field (400), no criterion → 400;
- payload = the staff serializer, nothing new.
"""

import pytest

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_staff_user,
)
from .factories import make_encounter, make_patient
from .test_patient_identity_s3 import STAFF_PATIENT_FIELDS

pytestmark = pytest.mark.django_db


def url(center):
    return f"/api/v1/centers/{center.pk}/patients/similar/"


def ids(response):
    return [row["id"] for row in response.data["results"]]


class TestSimilarMatching:
    def test_same_phone_matches_whatever_the_spelling(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        match = make_patient(phone="+2693312345", created_by_center=center)
        make_patient(phone="+2693999999", created_by_center=center)

        response = client_for(staff).get(url(center), {"phone": "2693312345"})

        assert response.status_code == 200, response.content
        assert ids(response) == [match.pk]
        assert set(response.data["results"][0].keys()) == STAFF_PATIENT_FIELDS

    def test_phone_alt_matches_too(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        match = make_patient(
            phone="+2693999998", phone_alt="+2693312345", created_by_center=center
        )

        response = client_for(staff).get(url(center), {"phone": "+2693312345"})

        assert ids(response) == [match.pk]

    def test_birth_date_plus_approaching_name_matches(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        match = make_patient(
            last_name="Ahamada", birth_date="1965-03-12", created_by_center=center
        )
        # Same name, other birth date → not a candidate.
        make_patient(
            last_name="Ahamada", birth_date="1990-01-01", created_by_center=center
        )
        # Same birth date, unrelated name → not a candidate.
        make_patient(
            last_name="Soilihi", birth_date="1965-03-12", created_by_center=center
        )

        response = client_for(staff).get(
            url(center), {"last_name": "ahamada", "birth_date": "1965-03-12"}
        )

        assert ids(response) == [match.pk]

    def test_first_name_refines_the_name_criterion(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        match = make_patient(
            first_name="Mariama", last_name="Ahamada",
            birth_date="1965-03-12", created_by_center=center,
        )
        make_patient(
            first_name="Fatima", last_name="Ahamada",
            birth_date="1965-03-12", created_by_center=center,
        )

        response = client_for(staff).get(
            url(center),
            {"last_name": "Ahamada", "birth_date": "1965-03-12",
             "first_name": "maria"},
        )

        assert ids(response) == [match.pk]

    def test_perimeter_and_tombstones(self):
        """Foreign-center patients and absorbed duplicates never appear."""
        center, _ = make_center_with_director()
        other_center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        mine = make_patient(phone="+2693312345", created_by_center=center)
        make_patient(phone="+2693312345", created_by_center=other_center)
        make_patient(
            phone="+2693312345", created_by_center=center, merged_into=mine
        )

        response = client_for(staff).get(url(center), {"phone": "+2693312345"})

        assert ids(response) == [mine.pk]

    def test_a_patient_seen_through_an_encounter_is_a_candidate(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        seen = make_patient(phone="+2693312345")
        make_encounter(patient=seen, center=center)

        response = client_for(staff).get(url(center), {"phone": "+2693312345"})

        assert ids(response) == [seen.pk]


class TestSimilarRefusals:
    def test_no_usable_criterion_is_400(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)

        assert client_for(staff).get(url(center)).status_code == 400
        # Birth date alone (no last name, no phone) is not usable either.
        response = client_for(staff).get(url(center), {"birth_date": "1965-03-12"})
        assert response.status_code == 400
        # Last name alone: approaching-name search without the birth date
        # would scan the whole registry — refused.
        assert client_for(staff).get(
            url(center), {"last_name": "Ahamada"}
        ).status_code == 400

    def test_invalid_phone_is_400_per_field(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        response = client_for(staff).get(url(center), {"phone": "12"})
        assert response.status_code == 400
        assert "phone" in response.data

    def test_invalid_birth_date_is_400_per_field(self):
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        for raw in ("1965-13-45", "pas-une-date"):
            response = client_for(staff).get(
                url(center), {"birth_date": raw, "last_name": "Ahamada"}
            )
            assert response.status_code == 400, raw
            assert "birth_date" in response.data

    def test_any_staff_role_may_search_foreign_center_is_404(self):
        center, _ = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        assert client_for(cashier).get(
            url(center), {"phone": "+2693312345"}
        ).status_code == 200

        other_center, _ = make_center_with_director()
        assert client_for(cashier).get(
            url(other_center), {"phone": "+2693312345"}
        ).status_code == 404

    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert client_for().get(url(center)).status_code == 401
