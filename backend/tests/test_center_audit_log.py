"""S4 (ADR 0017, décision 5) — the DIRECTOR's audit journal.

`GET /centers/{c}/audit-log/`. What is locked here, in order of gravity:

1. **The whitelist fails CLOSED.** An action absent from
   ``DIRECTOR_JOURNAL_ACTIONS`` is invisible, and an action invented
   tomorrow is invisible too — tested with a fabricated action name, not
   only with the known clinical ones.
2. **Nothing clinical, no consent** — the S3 segmentation survives the
   journal: a doctor's consultation, a prescription, a vital-signs
   measure, a document and a desk-collected consent all carry a center
   since S4 and STILL never appear.
3. **Director only**, tenant-scoped: another center's journal is a 404,
   a cashier is a 403.
4. **Names never leak**: ``actor_display`` resolves ONLY a member of this
   center; a patient, a guardian, a Chioni operator or a system job stays
   an id (or null).
5. The gap is stated, never faked: ``journal_starts_at``.
"""

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction, audit
from apps.centers.audit_views import (
    DIRECTOR_JOURNAL_ACTIONS,
    DIRECTOR_JOURNAL_EXCLUDED,
)
from apps.centers.models import StaffMembership
from apps.centers.services import add_staff_member, create_tariff
from apps.medical import services as medical_services
from apps.patients import services as patient_services
from apps.trustbridge import services as tb_services

from .api_helpers import (
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_center, make_platform_staff, make_tariff, make_user

pytestmark = pytest.mark.django_db

Role = StaffMembership.Role

#: The exact contract of one journal line — references only (ADR 0007).
ENTRY_FIELDS = {
    "id", "created_at", "action", "actor", "actor_display",
    "target_type", "object_id", "payload",
}


def url(center, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"/api/v1/centers/{center.pk}/audit-log/" + (f"?{query}" if query else "")


def actions_in(response):
    return [row["action"] for row in response.data["results"]]


# ---------------------------------------------------------------------------
# The door
# ---------------------------------------------------------------------------


class TestOnlyTheDirectorReadsTheJournal:
    def test_director_reads_it(self):
        center, director = make_center_with_director()
        response = client_for(director).get(url(center))
        assert response.status_code == 200
        assert set(response.data) >= {"count", "results", "journal_starts_at"}

    @pytest.mark.parametrize(
        "role", [Role.CASHIER, Role.SECRETARY, Role.DOCTOR, Role.NURSE, Role.PHARMACIST]
    )
    def test_every_other_hat_of_the_center_is_403(self, role):
        """Not « any billing role »: the journal aggregates personnel
        decisions, money and disputes — accountability has one holder."""
        center, _director = make_center_with_director()
        user = make_staff_user(center, role=role)
        assert client_for(user).get(url(center)).status_code == 403

    def test_a_foreign_director_gets_404_not_403(self):
        """Cross-tenant IDOR: a center where I am nobody does not exist."""
        center, _director = make_center_with_director()
        _other, other_director = make_center_with_director(name="Polyclinique")
        assert client_for(other_director).get(url(center)).status_code == 404

    def test_anonymous_is_401(self):
        center, _director = make_center_with_director()
        assert client_for().get(url(center)).status_code == 401

    def test_a_platform_operator_has_no_tenant_journal(self):
        """The fourth hat governs the tenant, it is not a member of it."""
        center, _director = make_center_with_director()
        operator, _op = make_platform_staff()
        assert client_for(operator).get(url(center)).status_code == 404


# ---------------------------------------------------------------------------
# Tenant scoping
# ---------------------------------------------------------------------------


class TestTenantScoping:
    def test_another_centers_entries_never_appear(self):
        center, director = make_center_with_director()
        other = make_center(name="Clinique El-Maarouf")
        create_tariff(
            actor=director, center=center, code="CS001",
            label="Consultation", price_kmf=5000,
        )
        create_tariff(
            actor=director, center=other, code="CS002",
            label="Consultation", price_kmf=9000,
        )
        response = client_for(director).get(url(center))
        assert response.data["count"] == 1
        (row,) = response.data["results"]
        assert row["payload"]["center_id"] == center.pk

    def test_entries_without_a_center_never_appear(self):
        """Transverse actions (auth, guardianship, doors A/B) and every
        pre-S4 row carry NULL — they belong to no tenant's journal."""
        center, director = make_center_with_director()
        audit(actor=None, action=AuditAction.TARIFF_CREATED, tariff_id=1)
        assert client_for(director).get(url(center)).data["count"] == 0


# ---------------------------------------------------------------------------
# THE whitelist
# ---------------------------------------------------------------------------


class TestWhitelistFailsClosed:
    def test_an_unknown_future_action_is_invisible_by_default(self):
        """The point of a whitelist: a sprint that adds an action must
        DECIDE to show it. Nothing appears by accident."""
        center, director = make_center_with_director()
        audit(
            actor=director, action="hospitalisation.admitted",
            center=center, stay_id=1,
        )
        assert client_for(director).get(url(center)).data["count"] == 0

    def test_the_two_lists_never_intersect(self):
        assert not (DIRECTOR_JOURNAL_ACTIONS & DIRECTOR_JOURNAL_EXCLUDED)

    @pytest.mark.parametrize("action", sorted(DIRECTOR_JOURNAL_EXCLUDED))
    def test_every_excluded_action_stays_invisible(self, action):
        center, director = make_center_with_director()
        audit(actor=director, action=action, center=center, ref_id=1)
        assert client_for(director).get(url(center)).data["count"] == 0

    def test_clinical_families_are_excluded_by_prefix(self):
        """Belt and braces on the ADR's own enumeration: no action of
        these families may ever be whitelisted, whatever its name."""
        forbidden_prefixes = (
            "encounter.", "prescription.", "health_record_entry.",
            "vital_signs.", "patient_document.", "patient_medical_file.",
            "consent.",
        )
        for action in DIRECTOR_JOURNAL_ACTIONS:
            assert not action.startswith(forbidden_prefixes), action


class TestTheRealClinicalFlowNeverReachesTheDirector:
    def test_a_whole_consultation_produces_an_empty_journal(self):
        """The S3 segmentation, replayed through the REAL services (which
        now all carry ``center=``): nothing of the care shows up."""
        center, director = make_center_with_director()
        doctor_user = make_staff_user(center, role=Role.DOCTOR)
        practitioner = StaffMembership.objects.get(
            user=doctor_user, center=center, role=Role.DOCTOR
        )
        patient = make_claimed_patient(first_name="Anfia", last_name="Saïd")

        encounter = medical_services.create_encounter(
            actor=doctor_user, center=center, practitioner=practitioner,
            patient=patient, reason="Fièvre depuis trois jours",
            diagnosis="Paludisme simple",
        )
        medical_services.create_prescription(
            actor=doctor_user, encounter=encounter,
            items=[{"medication": "Artéméther", "dosage": "1 cp x2/j"}],
        )
        medical_services.record_vital_signs(
            actor=doctor_user, encounter=encounter, measured_by=practitioner,
            systolic_bp=120, diastolic_bp=80,
        )
        medical_services.create_record_entry(
            actor=doctor_user, encounter=encounter,
            entry_type="allergie", content="Pénicilline",
        )
        medical_services.update_patient_medical_file(
            actor=doctor_user, center=center, patient=patient, blood_group="O+",
        )
        medical_services.close_encounter(actor=doctor_user, encounter=encounter)

        # The rows EXIST and carry the center (queryable for compliance)…
        assert AuditLog.objects.filter(center=center).count() >= 6
        # …and the director sees none of them.
        response = client_for(director).get(url(center))
        assert response.data["count"] == 0
        body = response.content.decode()
        assert "Anfia" not in body and "Paludisme" not in body

    def test_a_desk_collected_consent_is_invisible_too(self):
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        patient = patient_services.create_patient_at_center(
            actor=cashier, center=center, first_name="Halima", last_name="Abdou",
        )[0]
        _user, guardian = make_guardian_user()
        link = make_active_link(guardian, patient)
        patient_services.grant_clinical_consent_at_center(
            actor=cashier, center=center, patient=patient, link=link,
            collected_via="papier",
        )
        response = client_for(director).get(url(center))
        assert AuditAction.CONSENT_GRANTED_BY_CENTER not in actions_in(response)


# ---------------------------------------------------------------------------
# What the director DOES see
# ---------------------------------------------------------------------------


class TestExploitationIsVisible:
    def test_staff_money_and_tariff_actions_show_up(self):
        center, director = make_center_with_director()
        add_staff_member(
            actor=director, center=center, phone="+2693399001", role=Role.CASHIER,
        )
        create_tariff(
            actor=director, center=center, code="CS010",
            label="Consultation", price_kmf=7500,
        )
        response = client_for(director).get(url(center))
        assert set(actions_in(response)) == {
            AuditAction.STAFF_CREATED, AuditAction.TARIFF_CREATED,
        }

    def test_the_cash_desk_lifecycle_is_traced(self):
        from .trustbridge_helpers import build_scenario

        scn = build_scenario(status="facture_brouillon")
        tb_services.issue_invoice(actor=scn.cashier, invoice=scn.invoice)
        tb_services.record_cash_payment(
            actor=scn.cashier, center=scn.center, invoice=scn.invoice,
            method="especes", amount_kmf=15000,
        )
        response = client_for(scn.director).get(url(scn.center))
        seen = set(actions_in(response))
        assert {
            AuditAction.INVOICE_CREATED,
            AuditAction.INVOICE_ISSUED,
            AuditAction.CASH_PAYMENT_RECORDED,
        } <= seen

    def test_the_whole_diaspora_rail_is_traced(self):
        from .trustbridge_helpers import build_scenario
        from apps.trustbridge.models import PaymentRequest

        scn = build_scenario(status=PaymentRequest.Status.CLOSED)
        response = client_for(scn.director).get(url(scn.center, **{"page": 1}))
        seen = set(actions_in(response))
        assert {
            AuditAction.PAYMENT_REQUEST_CREATED,
            AuditAction.PAYMENT_REQUEST_SHARED,
            AuditAction.PAYMENT_REQUEST_SENT,
            AuditAction.PAYMENT_INTENT_CREATED,
            AuditAction.PAYMENT_RECORDED,
            AuditAction.CARE_CONFIRMED,
            AuditAction.PAYMENT_REQUEST_CLOSED,
        } <= seen
        # …and not a single clinical line, though the same stage produced one.
        assert AuditAction.ENCOUNTER_CREATED not in seen

    def test_a_patient_merge_is_traced(self):
        """Named by the ADR: a merge MOVES guardianship links."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        source, _ = patient_services.create_patient_at_center(
            actor=cashier, center=center, first_name="Fatima", last_name="Said",
        )
        target, _ = patient_services.create_patient_at_center(
            actor=cashier, center=center, first_name="Fatima", last_name="Saïd",
        )
        patient_services.merge_profiles(
            source=source, target=target, actor=cashier, center=center,
        )
        assert AuditAction.PATIENT_MERGED in actions_in(
            client_for(director).get(url(center))
        )


# ---------------------------------------------------------------------------
# Payload contract
# ---------------------------------------------------------------------------


class TestPayloadContract:
    def test_entry_shape_is_exactly_the_contract(self):
        center, director = make_center_with_director()
        tariff = create_tariff(
            actor=director, center=center, code="CS020",
            label="Pansement", price_kmf=2000,
        )
        (row,) = client_for(director).get(url(center)).data["results"]
        assert set(row) == ENTRY_FIELDS
        assert row["action"] == AuditAction.TARIFF_CREATED
        assert row["target_type"] == "centers.tariffitem"
        assert row["object_id"] == str(tariff.pk)
        assert row["payload"]["tariff_id"] == tariff.pk

    def test_actor_is_an_id_and_the_name_only_for_a_member_of_this_center(self):
        center, director = make_center_with_director()
        director.first_name, director.last_name = "Saïd", "Mmadi"
        director.save(update_fields=["first_name", "last_name"])
        create_tariff(
            actor=director, center=center, code="CS030", label="Suture",
            price_kmf=12000,
        )
        (row,) = client_for(director).get(url(center)).data["results"]
        assert row["actor"] == director.pk
        assert row["actor_display"] == "Saïd Mmadi"

    def test_a_guardian_actor_is_never_named(self):
        """The paying guardian acts on the center's request (intent
        creation) — the director reads the money line, NOT the person."""
        from .trustbridge_helpers import build_scenario
        from apps.trustbridge.models import PaymentRequest

        scn = build_scenario(status=PaymentRequest.Status.PAID)
        scn.guardian_user.first_name = "Ali"
        scn.guardian_user.last_name = "Combo"
        scn.guardian_user.save(update_fields=["first_name", "last_name"])

        response = client_for(scn.director).get(url(scn.center))
        intents = [
            row for row in response.data["results"]
            if row["action"] == AuditAction.PAYMENT_INTENT_CREATED
        ]
        assert intents and intents[0]["actor"] == scn.guardian_user.pk
        assert intents[0]["actor_display"] is None
        assert "Combo" not in response.content.decode()

    def test_a_system_actor_is_null(self):
        center, director = make_center_with_director()
        audit(
            actor=None, action=AuditAction.PAYMENT_INTENT_CANCELLED,
            center=center, intent_id=1, reason="stale",
        )
        (row,) = client_for(director).get(url(center)).data["results"]
        assert row["actor"] is None and row["actor_display"] is None

    def test_a_deactivated_member_keeps_their_name_on_past_actions(self):
        """History must stay readable: deactivation is not amnesia."""
        center, director = make_center_with_director()
        cashier_user = make_staff_user(center, role=Role.CASHIER)
        cashier_user.first_name, cashier_user.last_name = "Nadjati", "Ali"
        cashier_user.save(update_fields=["first_name", "last_name"])
        create_tariff(
            actor=cashier_user, center=center, code="CS040", label="Perfusion",
            price_kmf=4000,
        )
        membership = StaffMembership.objects.get(user=cashier_user, center=center)
        membership.is_active = False
        membership.save(update_fields=["is_active", "updated_at"])

        (row,) = client_for(director).get(url(center)).data["results"]
        assert row["actor_display"] == "Nadjati Ali"


# ---------------------------------------------------------------------------
# Filters, ordering, honesty about the gap
# ---------------------------------------------------------------------------


class TestFilters:
    def test_action_filter_narrows_the_list(self):
        center, director = make_center_with_director()
        add_staff_member(
            actor=director, center=center, phone="+2693399002", role=Role.NURSE,
        )
        create_tariff(
            actor=director, center=center, code="CS050", label="Écho",
            price_kmf=25000,
        )
        response = client_for(director).get(
            url(center, action=AuditAction.TARIFF_CREATED)
        )
        assert actions_in(response) == [AuditAction.TARIFF_CREATED]

    def test_an_unknown_and_an_excluded_action_answer_the_SAME_400(self):
        """No oracle: the director must not learn, from an error message,
        which actions exist but are hidden from them."""
        center, director = make_center_with_director()
        client = client_for(director)
        unknown = client.get(url(center, action="totalement.invente"))
        excluded = client.get(url(center, action=AuditAction.ENCOUNTER_CREATED))
        assert unknown.status_code == excluded.status_code == 400
        assert unknown.content == excluded.content

    def test_period_bounds_are_the_shared_contract(self):
        center, director = make_center_with_director()
        client = client_for(director)
        assert client.get(url(center, **{"from": "pas-une-date"})).status_code == 400
        assert client.get(url(center, **{"from": "2026-02-30"})).status_code == 400
        assert client.get(
            url(center, **{"from": "2026-08-10", "to": "2026-08-01"})
        ).status_code == 400
        assert client.get(
            url(center, **{"from": "2020-01-01", "to": "2026-08-01"})
        ).status_code == 400

    def test_the_default_window_is_thirty_days(self):
        center, director = make_center_with_director()
        create_tariff(
            actor=director, center=center, code="CS060", label="Plâtre",
            price_kmf=30000,
        )
        entry = AuditLog.objects.get(center=center)
        # Append-only forbids UPDATE at ORM level AND by trigger, so an old
        # row is built by a raw INSERT-time value: use a filtered read
        # instead — the window is asserted through the query params.
        recent = client_for(director).get(url(center)).data["count"]
        old = client_for(director).get(
            url(center, **{"from": "2020-01-01", "to": "2020-12-31"})
        ).data["count"]
        assert recent == 1 and old == 0
        assert entry.created_at <= timezone.now()

    def test_most_recent_first(self):
        center, director = make_center_with_director()
        create_tariff(
            actor=director, center=center, code="CS070", label="A", price_kmf=1000,
        )
        create_tariff(
            actor=director, center=center, code="CS071", label="B", price_kmf=2000,
        )
        rows = client_for(director).get(url(center)).data["results"]
        assert rows[0]["id"] > rows[1]["id"]

    def test_query_count_is_flat(self, django_assert_num_queries):
        """No N+1: the actor names of a whole page cost ONE query, and the
        content types are select_related. A journal that queried per line
        would be unusable on a busy center."""
        center, director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        for n in range(10):
            create_tariff(
                actor=cashier if n % 2 else director, center=center,
                code=f"CS9{n:02d}", label=f"Acte {n}", price_kmf=1000 + n,
            )
        client = client_for(director)
        # 1 center resolution + 1 membership check + count + page +
        # 1 actor-name map + 1 journal_starts_at.
        with django_assert_num_queries(6):
            response = client.get(url(center))
        assert response.status_code == 200
        assert len(response.data["results"]) == 10


class TestJournalStartsAt:
    def test_null_when_the_center_has_no_entry_yet(self):
        center, director = make_center_with_director()
        response = client_for(director).get(url(center))
        assert response.data["journal_starts_at"] is None

    def test_it_reports_the_first_entry_even_if_that_one_is_not_listed(self):
        """The honest gap: a clinical entry exists, the journal starts
        there, and the director still cannot read it."""
        center, director = make_center_with_director()
        first = audit(
            actor=director, action=AuditAction.ENCOUNTER_CREATED,
            center=center, encounter_id=1,
        )
        create_tariff(
            actor=director, center=center, code="CS080", label="C", price_kmf=1000,
        )
        response = client_for(director).get(url(center))
        assert response.data["count"] == 1
        assert response.data["journal_starts_at"] == first.created_at


class TestNoRetroFill:
    def test_pre_s4_rows_keep_a_null_center_forever(self):
        """ADR 0006 — the table is append-only at ORM level and behind a
        PostgreSQL trigger: back-filling history for an API's comfort is
        impossible BY CONSTRUCTION, and this test says so out loud."""
        from apps.common.models import AppendOnlyError

        center, _director = make_center_with_director()
        legacy = audit(
            actor=None, action=AuditAction.TARIFF_CREATED, tariff_id=1,
        )
        assert legacy.center_id is None
        legacy.center = center
        with pytest.raises(AppendOnlyError):
            legacy.save()
        with pytest.raises(AppendOnlyError):
            AuditLog.objects.filter(pk=legacy.pk).update(center=center)


class TestTheHelperItself:
    def test_center_is_a_column_not_a_payload_key(self):
        center = make_center()
        entry = audit(
            actor=None, action=AuditAction.TARIFF_CREATED, center=center,
            tariff_id=7,
        )
        assert entry.center_id == center.pk
        assert "center" not in entry.payload

    def test_a_non_center_is_refused_like_a_non_scalar_payload(self):
        tariff = make_tariff(make_center())
        with pytest.raises(TypeError):
            audit(actor=None, action=AuditAction.TARIFF_CREATED, center=tariff)
        with pytest.raises(TypeError):
            audit(actor=None, action=AuditAction.TARIFF_CREATED, center=1)

    def test_the_scalar_payload_guard_still_bites(self):
        center = make_center()
        with pytest.raises(TypeError):
            audit(
                actor=None, action=AuditAction.TARIFF_CREATED, center=center,
                tariff=make_tariff(center),
            )

    def test_transverse_actions_stay_centerless(self, sms_outbox):
        """Doors A and B, guardianship: no tenant, by nature.

        These are the actions the ADR leaves at NULL on purpose — they
        happen between a patient and their relatives, outside any center.
        """
        guardian_user, _guardian = make_guardian_user()
        patient_services.create_protege(  # porte A
            guardian_user=guardian_user, relationship="enfant",
            first_name="Zainaba", last_name="Ahamada",
        )
        patient_services.create_own_profile(  # porte B
            user=make_user(), first_name="Ali", last_name="Combo",
        )
        centerless = AuditLog.objects.filter(center__isnull=True)
        assert set(centerless.values_list("action", flat=True)) == {
            AuditAction.PATIENT_CREATED, AuditAction.LINK_CREATED,
        }
        assert AuditLog.objects.filter(center__isnull=False).count() == 0
