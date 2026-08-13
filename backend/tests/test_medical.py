"""Medical model invariants: tariff snapshots and patient-scoped querysets."""

from decimal import Decimal

import pytest

from apps.medical.models import ActPerformed, Encounter, HealthRecordEntry

from .factories import make_act, make_center, make_encounter, make_patient, make_tariff

pytestmark = pytest.mark.django_db


class TestActSnapshot:
    def test_act_freezes_label_and_price_at_creation(self):
        encounter = make_encounter()
        tariff = make_tariff(
            encounter.center, label="Consultation générale", price_kmf="7500"
        )

        act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)

        assert act.label_snapshot == "Consultation générale"
        assert act.price_kmf_snapshot == Decimal("7500")

    def test_later_tariff_change_does_not_alter_the_act(self):
        encounter = make_encounter()
        tariff = make_tariff(encounter.center, price_kmf="7500")
        act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)

        tariff.price_kmf = Decimal("12000")
        tariff.label = "Consultation générale (nouveau tarif)"
        tariff.save()

        act.refresh_from_db()
        assert act.price_kmf_snapshot == Decimal("7500")
        assert act.label_snapshot == "Consultation générale"


class TestPatientScoping:
    def test_for_patient_only_returns_the_owner_record(self):
        mariama = make_patient()
        other = make_patient(first_name="Anfia", last_name="Soilihi")
        make_encounter(patient=mariama)
        make_encounter(patient=other)
        HealthRecordEntry.objects.create(
            patient=mariama,
            entry_type=HealthRecordEntry.EntryType.ALLERGY,
            content="Allergie à la pénicilline",
        )

        assert Encounter.objects.for_patient(mariama).count() == 1
        assert Encounter.objects.for_patient(other).count() == 1
        assert HealthRecordEntry.objects.for_patient(other).count() == 0

    def test_health_record_is_transversal_to_centers(self):
        # The record belongs to the PATIENT: encounters from two different
        # centers land in the same patient-scoped queryset.
        mariama = make_patient()
        center_a = make_center(name="Clinique Salama")
        center_b = make_center(name="Hôpital El-Maarouf")
        make_encounter(patient=mariama, center=center_a)
        make_encounter(patient=mariama, center=center_b)

        encounters = Encounter.objects.for_patient(mariama)

        assert encounters.count() == 2
        assert set(e.center_id for e in encounters) == {center_a.pk, center_b.pk}

    def test_acts_are_reachable_by_patient_through_their_encounter(self):
        act = make_act()
        other_patient = make_patient(first_name="Anfia", last_name="Soilihi")

        assert act in ActPerformed.objects.for_patient(act.encounter.patient)
        assert ActPerformed.objects.for_patient(other_patient).count() == 0
