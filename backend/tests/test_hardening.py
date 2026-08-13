"""Regression suite of the hardening pass (ex-``test_adversarial_models.py``).

Each probe below used to PROVE a weakness found by the adversarial review
(chioni-health-data-guardian). The model layer has been hardened (C1, C2,
E1, E2, E4, M2, M3, M4, M6, M7, M8 — see ADR 0005/0006/0007): the same
probes now assert that the protections HOLD.

Deliberately NOT fixed at the model layer (kept as documented probes at
the bottom, ``TestServiceLevelInvariantsStillOpen``): the status state
machines (M5) and the flow-level reconciliations (F2, F3) — invariants to
be imposed at the service/API layer in the next session.

Run: backend/.venv/Scripts/python.exe -m pytest tests/test_hardening.py -v
"""

from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, transaction
from django.db.utils import DatabaseError, IntegrityError

from apps.audit.models import AuditLog
from apps.common.models import ActCategory, AppendOnlyError
from apps.medical.models import ActPerformed, Consent
from apps.patients.models import GuardianLink, PatientProfile
from apps.trustbridge.models import (
    Invoice,
    InvoiceLine,
    LedgerEntry,
    LedgerTransaction,
    PaymentIntent,
    PaymentRequest,
    PaymentRequestShare,
    Receipt,
    _ledger_window_open,
    _open_ledger_window,
)

from .factories import (
    make_act,
    make_center,
    make_encounter,
    make_guardian,
    make_invoice,
    make_ledger_tx,
    make_link,
    make_patient,
    make_payment_request,
    make_tariff,
    make_user,
)

pytestmark = pytest.mark.django_db

Account = LedgerEntry.Account
Direction = LedgerEntry.Direction


def balanced_entries():
    return [
        {"account": Account.GUARDIAN_FUNDS, "direction": Direction.DEBIT,
         "amount": Decimal("50.00"), "currency": "EUR"},
        {"account": Account.DUE_TO_CENTER, "direction": Direction.CREDIT,
         "amount": Decimal("50.00"), "currency": "EUR"},
    ]


def issue_receipt(pr, center, **overrides):
    kwargs = {
        "payment_request": pr,
        "center": center,
        "ledger_transaction": make_ledger_tx(payment_request=pr),
        "amount_eur_paid": Decimal("50.00"),
        "amount_kmf_received": Decimal("24000.00"),
        "exchange_rate": Decimal("480.000000"),
    }
    kwargs.update(overrides)
    return Receipt.issue(**kwargs)


# ---------------------------------------------------------------------------
# C1 — bulk_create(update_conflicts=True) can no longer rewrite a ledger row
# ---------------------------------------------------------------------------

class TestAppendOnlyBypassesClosed:
    def test_bulk_create_update_conflicts_can_no_longer_mutate_a_ledger_row(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())
        entry = tx.entries.first()
        original = entry.amount

        # On LedgerEntry the E4 lock fires first (no write outside record())
        # — either way the INSERT ... ON CONFLICT DO UPDATE is refused.
        with pytest.raises(AppendOnlyError):
            LedgerEntry.objects.bulk_create(
                [LedgerEntry(
                    id=entry.id, transaction=tx, account=entry.account,
                    direction=entry.direction, amount=Decimal("999999.99"),
                    currency=entry.currency,
                )],
                update_conflicts=True,
                update_fields=["amount"],
                unique_fields=["id"],
            )
        entry.refresh_from_db()
        assert entry.amount == original

    def test_bulk_create_update_conflicts_is_refused_on_every_append_only_table(self):
        # AuditLog has no E4 window: this isolates the C1 guard itself.
        entry = AuditLog.log(actor=None, action="consent.granted")

        with pytest.raises(AppendOnlyError, match="update_conflicts"):
            AuditLog.objects.bulk_create(
                [AuditLog(id=entry.id, action="consent.rewritten")],
                update_conflicts=True,
                update_fields=["action"],
                unique_fields=["id"],
            )
        entry.refresh_from_db()
        assert entry.action == "consent.granted"


# ---------------------------------------------------------------------------
# C2 — DB belt: PostgreSQL triggers block raw SQL UPDATE/DELETE
# ---------------------------------------------------------------------------

class TestDatabaseTriggersHold:
    def test_raw_sql_update_on_ledger_entry_is_blocked(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())
        entry = tx.entries.first()

        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE trustbridge_ledgerentry SET amount = %s WHERE id = %s",
                        [Decimal("1.00"), entry.id],
                    )
        entry.refresh_from_db()
        assert entry.amount == Decimal("50.00")

    def test_raw_sql_delete_on_ledger_transaction_is_blocked(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "DELETE FROM trustbridge_ledgertransaction WHERE id = %s",
                        [tx.id],
                    )
        assert LedgerTransaction.objects.filter(pk=tx.pk).exists()

    def test_raw_sql_update_on_receipt_is_blocked(self):
        receipt = issue_receipt(make_payment_request(), make_center())

        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE trustbridge_receipt SET amount_eur_paid = %s WHERE id = %s",
                        [Decimal("9999.00"), receipt.id],
                    )
        receipt.refresh_from_db()
        assert receipt.amount_eur_paid == Decimal("50.00")

    def test_raw_sql_update_on_audit_log_is_blocked(self):
        entry = AuditLog.log(actor=None, action="consent.granted")

        with pytest.raises(DatabaseError, match="append-only"):
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        "UPDATE audit_auditlog SET action = %s WHERE id = %s",
                        ["consent.rewritten", entry.id],
                    )
        entry.refresh_from_db()
        assert entry.action == "consent.granted"


# ---------------------------------------------------------------------------
# E4 — LedgerEntry creation is locked to LedgerTransaction.record()
# ---------------------------------------------------------------------------

class TestLedgerBalanceIsAStructuralConstraint:
    def test_direct_manager_create_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError, match="record()"):
            LedgerEntry.objects.create(
                transaction=tx, account=Account.DUE_TO_CENTER,
                direction=Direction.CREDIT, amount=Decimal("100000.00"),
                currency="EUR",
            )
        assert tx.entries.count() == 2  # no orphan, unbalanced credit slipped in

    def test_direct_instance_save_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError, match="record()"):
            LedgerEntry(
                transaction=tx, account=Account.DUE_TO_CENTER,
                direction=Direction.CREDIT, amount=Decimal("100000.00"),
                currency="EUR",
            ).save()

    def test_direct_bulk_create_is_refused(self):
        tx = LedgerTransaction.record(description="x", entries=balanced_entries())

        with pytest.raises(AppendOnlyError, match="record()"):
            LedgerEntry.objects.bulk_create([
                LedgerEntry(
                    transaction=tx, account=Account.DUE_TO_CENTER,
                    direction=Direction.CREDIT, amount=Decimal("1.00"),
                    currency="EUR",
                ),
            ])

    def test_record_remains_the_single_legal_path(self):
        tx = LedgerTransaction.record(description="légal", entries=balanced_entries())
        assert tx.entries.count() == 2


# ---------------------------------------------------------------------------
# E1 — PaymentRequestShare: no cross-patient sharing, ever
# ---------------------------------------------------------------------------

class TestSharedWithCrossPatientClosed:
    def test_add_with_a_guardian_of_another_patient_is_refused(self):
        pr = make_payment_request()  # invoice belongs to patient X
        stranger_patient = make_patient(first_name="Anfia", last_name="Soilihi")
        stranger_link = make_link(patient=stranger_patient)  # guardian of Y

        # .add() validates inside Django's internal atomic(savepoint=False):
        # a savepoint wrapper keeps the test transaction usable afterwards.
        with pytest.raises(ValidationError, match="patient facturé"):
            with transaction.atomic():
                pr.shared_with.add(stranger_link)
        assert stranger_link not in pr.shared_with.all()
        assert pr.shares.count() == 0

    def test_direct_share_create_cross_patient_is_refused(self):
        pr = make_payment_request()
        stranger_link = make_link(patient=make_patient(first_name="Anfia"))

        with pytest.raises(ValidationError, match="patient facturé"):
            PaymentRequestShare.objects.create(
                payment_request=pr, guardian_link=stranger_link
            )

    def test_sharing_with_the_invoiced_patients_guardian_works(self):
        pr = make_payment_request()
        link = make_link(patient=pr.invoice.patient)
        agent = make_user()

        share = PaymentRequestShare.objects.create(
            payment_request=pr, guardian_link=link, shared_by=agent
        )

        assert link in pr.shared_with.all()
        assert share.shared_at is not None
        assert share.shared_by == agent

    def test_duplicate_share_is_refused(self):
        pr = make_payment_request()
        link = make_link(patient=pr.invoice.patient)
        pr.shared_with.add(link)

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                PaymentRequestShare.objects.create(
                    payment_request=pr, guardian_link=link
                )


# ---------------------------------------------------------------------------
# M7 — GuardianLink.save() re-imposes clean(): no self-guardianship
# ---------------------------------------------------------------------------

class TestSelfGuardianshipClosed:
    def test_create_refuses_guardian_of_their_own_patient_profile(self):
        user = make_user()
        patient = make_patient()
        patient.user = user
        patient.claim_status = PatientProfile.ClaimStatus.ACTIVE
        patient.save()
        guardian = make_guardian(user=user)

        with pytest.raises(ValidationError, match="propre profil patient"):
            GuardianLink.objects.create(
                guardian=guardian, patient=patient,
                relationship=GuardianLink.Relationship.OTHER,
                status=GuardianLink.Status.ACTIVE,
                initiated_by=GuardianLink.InitiatedBy.GUARDIAN,
            )
        assert not GuardianLink.objects.filter(
            guardian=guardian, patient=patient
        ).exists()


# ---------------------------------------------------------------------------
# M6 — merge guards: no self-merge, no cycles, canonical targets only
# ---------------------------------------------------------------------------

class TestMergeCyclesClosed:
    def test_self_merge_is_refused(self):
        p = make_patient()
        p.merged_into = p

        with pytest.raises(ValidationError, match="lui-même"):
            p.save()

    def test_mutual_merge_cycle_is_refused(self):
        a = make_patient(first_name="A")
        b = make_patient(first_name="B")
        a.merged_into = b
        a.save()  # fine: b is canonical

        b.merged_into = a
        with pytest.raises(ValidationError, match="canonique"):
            b.save()

    def test_merge_into_an_absorbed_duplicate_is_refused(self):
        canonical = make_patient(first_name="Canonique")
        absorbed = make_patient(first_name="Doublon", merged_into=canonical)
        late_duplicate = make_patient(first_name="Tardif")

        late_duplicate.merged_into = absorbed
        with pytest.raises(ValidationError, match="canonique"):
            late_duplicate.save()

    def test_merge_into_a_canonical_profile_works(self):
        canonical = make_patient()
        duplicate = make_patient(merged_into=canonical)

        assert duplicate in canonical.merged_duplicates.all()

    def test_db_constraint_blocks_self_merge_even_via_queryset_update(self):
        p = make_patient()

        with pytest.raises(IntegrityError, match="no_self_merge"):
            with transaction.atomic():
                PatientProfile.objects.filter(pk=p.pk).update(merged_into=p.pk)


# ---------------------------------------------------------------------------
# M3 — Receipt: positive amounts, structurally reconciled with the ledger
# ---------------------------------------------------------------------------

class TestReceiptIntegrityClosed:
    def test_non_positive_amounts_and_negative_fees_are_refused(self):
        pr = make_payment_request()
        center = make_center()

        with pytest.raises(ValidationError, match="> 0"):
            issue_receipt(
                pr, center,
                amount_eur_paid=Decimal("-100.00"),
                amount_kmf_received=Decimal("0.00"),
                fees_eur=Decimal("-5.00"),
            )
        with pytest.raises(ValidationError, match="frais"):
            issue_receipt(pr, center, fees_eur=Decimal("-0.01"))
        assert Receipt.objects.count() == 0

    def test_db_constraints_also_block_a_direct_save(self):
        pr = make_payment_request()
        center = make_center()
        tx = make_ledger_tx(payment_request=pr)

        with pytest.raises(IntegrityError, match="receipt_amount_eur_paid_positive"):
            with transaction.atomic():
                Receipt(
                    payment_request=pr, center=center, ledger_transaction=tx,
                    sequence_number=1,
                    amount_eur_paid=Decimal("-100.00"),
                    amount_kmf_received=Decimal("24000.00"),
                    exchange_rate=Decimal("480.000000"),
                ).save()

    def test_receipt_is_structurally_linked_to_its_closing_transaction(self):
        pr = make_payment_request()
        receipt = issue_receipt(pr, make_center())

        # The FK exists and is populated: the receipt's numbers can be
        # reconciled against the ledger, not merely asserted.
        assert any(
            f.name for f in Receipt._meta.get_fields()
            if getattr(f, "related_model", None) is LedgerTransaction
        )
        assert receipt.ledger_transaction.payment_request_id == pr.pk

    def test_a_transaction_tied_to_another_payment_request_is_refused(self):
        pr = make_payment_request()
        other_pr = make_payment_request()
        foreign_tx = make_ledger_tx(payment_request=other_pr)

        with pytest.raises(ValidationError, match="autre demande"):
            issue_receipt(pr, make_center(), ledger_transaction=foreign_tx)


# ---------------------------------------------------------------------------
# M2 — revoking the link kills its consents; a revoked link is FINAL
# ---------------------------------------------------------------------------

class TestLinkRevocationClosed:
    def test_revoke_cascades_to_active_consents(self):
        link = make_link()
        consent = Consent.objects.create(
            patient=link.patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        assert Consent.objects.allows(link, Consent.Scope.CLINICAL_DETAIL)

        link.revoke()

        link.refresh_from_db()
        consent.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED
        assert link.revoked_at is not None
        assert consent.revoked_at is not None  # the grant itself was revoked
        assert Consent.objects.active_scopes(link) == frozenset()

    def test_revoked_link_cannot_be_reactivated(self):
        link = make_link()
        link.revoke()

        link.status = GuardianLink.Status.ACTIVE
        with pytest.raises(ValidationError, match="définitif"):
            link.save()

    def test_stale_clinical_consent_can_no_longer_revive(self):
        """The original probe end to end: revoke the LINK, then try to flip
        it back to ACTIVE hoping the old clinical grant springs back. Dead
        at both levels now — the consent row was revoked by the cascade AND
        the reactivation itself is refused."""
        link = make_link()
        Consent.objects.create(
            patient=link.patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )

        link.revoke()

        link.status = GuardianLink.Status.ACTIVE
        with pytest.raises(ValidationError):
            link.save()
        link.refresh_from_db()
        assert Consent.objects.active_scopes(link) == frozenset()
        assert not Consent.objects.active().filter(guardian_link=link).exists()


# ---------------------------------------------------------------------------
# M4 — an invoice out of DRAFT is frozen (amounts and lines)
# ---------------------------------------------------------------------------

class TestInvoiceFrozenOutsideDraft:
    def test_issued_invoice_amounts_are_frozen(self):
        invoice = make_invoice()  # issued by the factory
        original = invoice.total_kmf

        invoice.total_kmf = Decimal("1.00")
        with pytest.raises(ValidationError, match="figés"):
            invoice.save()
        invoice.refresh_from_db()
        assert invoice.total_kmf == original

    def test_lines_cannot_be_added_to_an_issued_invoice(self):
        invoice = make_invoice()
        act = make_act(encounter=invoice.encounter)

        with pytest.raises(ValidationError, match="brouillon"):
            InvoiceLine.objects.create(invoice=invoice, act=act)

    def test_lines_of_an_issued_invoice_cannot_be_modified_or_deleted(self):
        invoice = make_invoice()
        line = invoice.lines.first()

        line.amount_kmf = Decimal("1.00")
        with pytest.raises(ValidationError, match="brouillon"):
            line.save()
        with pytest.raises(ValidationError, match="supprimées"):
            line.delete()

    def test_status_transition_itself_stays_possible(self):
        invoice = make_invoice()

        invoice.status = Invoice.Status.PAID
        invoice.save(update_fields=["status", "updated_at"])

        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.PAID

    def test_draft_invoice_remains_freely_editable(self):
        invoice = make_invoice(status=Invoice.Status.DRAFT)
        act = make_act(encounter=invoice.encounter)

        InvoiceLine.objects.create(invoice=invoice, act=act)
        invoice.recompute_total()

        assert invoice.lines.count() == 2


# ---------------------------------------------------------------------------
# M8 — ledger transactions carry their center (reporting / reconciliation)
# ---------------------------------------------------------------------------

class TestLedgerTransactionCenter:
    def test_record_stamps_the_center_from_the_payment_request(self):
        pr = make_payment_request()

        tx = LedgerTransaction.record(
            description="paiement fléché", entries=balanced_entries(),
            payment_request=pr,
        )

        assert tx.center_id == pr.invoice.center_id

    def test_for_center_filters_transactions(self):
        pr_a = make_payment_request()
        pr_b = make_payment_request()
        tx_a = make_ledger_tx(payment_request=pr_a)
        make_ledger_tx(payment_request=pr_b)

        scoped = LedgerTransaction.objects.for_center(pr_a.invoice.center)

        assert list(scoped) == [tx_a]


# ---------------------------------------------------------------------------
# E2 — generic category: the ONLY care info under the `paiements` scope
# ---------------------------------------------------------------------------

class TestGenericCategorySnapshots:
    def test_category_snapshots_from_tariff_to_act_and_invoice_line(self):
        encounter = make_encounter()
        tariff = make_tariff(encounter.center, label="Sérologie VIH")
        tariff.generic_category = ActCategory.ANALYSES_EXAMENS
        tariff.save()
        act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)
        invoice = make_invoice(
            encounter=encounter, with_lines=False, status=Invoice.Status.DRAFT
        )
        line = InvoiceLine.objects.create(invoice=invoice, act=act)

        # The guardian-visible nature is generic; the sensitive label stays
        # a distinct field, gated behind the `detail_clinique` scope.
        assert act.generic_category == ActCategory.ANALYSES_EXAMENS
        assert line.generic_category == ActCategory.ANALYSES_EXAMENS
        assert line.label == "Sérologie VIH"
        assert line.generic_category != line.label

    def test_later_tariff_category_change_does_not_alter_the_act(self):
        encounter = make_encounter()
        tariff = make_tariff(encounter.center)
        act = ActPerformed.objects.create(encounter=encounter, tariff_item=tariff)
        frozen = act.generic_category

        tariff.generic_category = ActCategory.HOSPITALISATION
        tariff.save()

        act.refresh_from_db()
        assert act.generic_category == frozen


# ---------------------------------------------------------------------------
# Deliberately NOT fixed at the model layer — invariants for the service
# layer (next session). These probes DOCUMENT the current permissive state;
# they do not claim a protection that does not exist.
# ---------------------------------------------------------------------------

class TestServiceLevelInvariantsStillOpen:
    def test_M5_status_machines_are_not_enforced_at_model_level(self):
        """Invariant à imposer au niveau service : une PaymentRequest payée
        ne doit pas pouvoir revenir en brouillon. Le modèle l'accepte
        aujourd'hui — la machine à états vivra dans la couche service."""
        pr = make_payment_request(status=PaymentRequest.Status.PAID)

        pr.status = PaymentRequest.Status.DRAFT
        pr.save()  # accepted today — service layer will forbid it

        pr.refresh_from_db()
        assert pr.status == PaymentRequest.Status.DRAFT

    def test_F2_payment_intent_can_succeed_without_any_ledger_trace(self):
        """Invariant à imposer au niveau service : un PaymentIntent SUCCEEDED
        doit être indissociable d'une LedgerTransaction. Le modèle ne le
        force pas — le service webhook PSP écrira les deux atomiquement."""
        pr = make_payment_request()

        intent = PaymentIntent.objects.create(
            payment_request=pr,
            idempotency_key="stripe-evt-orphan",
            amount_eur=Decimal("50.00"),
            exchange_rate=Decimal("480.000000"),
            amount_kmf=Decimal("24000.00"),
            status=PaymentIntent.Status.SUCCEEDED,
        )

        assert intent.status == PaymentIntent.Status.SUCCEEDED
        assert pr.ledger_transactions.count() == 0  # no trace — service to fix

    def test_F3_receipt_amounts_are_linked_but_not_summed_against_the_ledger(self):
        """Invariant à imposer au niveau service : les montants du reçu
        doivent ÉGALER les écritures de sa transaction de clôture. Le modèle
        garantit désormais le lien structurel (M3) mais pas l'égalité des
        sommes — le service d'émission la vérifiera."""
        pr = make_payment_request()
        tx = make_ledger_tx(payment_request=pr, amount="50.00")

        receipt = Receipt.issue(
            payment_request=pr, center=make_center(),
            ledger_transaction=tx,
            amount_eur_paid=Decimal("120.00"),  # ≠ 50.00 recorded in the ledger
            amount_kmf_received=Decimal("57600.00"),
            exchange_rate=Decimal("480.000000"),
        )

        ledger_eur = tx.entries.filter(
            account=Account.GUARDIAN_FUNDS, currency="EUR"
        ).first()
        assert receipt.amount_eur_paid != ledger_eur.amount  # tolerated today


# ---------------------------------------------------------------------------
# Contre-verification residuals (chioni-health-data-guardian, 2e passe).
# The M2/M4/M6/E1 guards were added in save()/clean(); Django's
# QuerySet.update()/bulk_update() bypass save() entirely. R1/R2/R3 are now
# CLOSED at the DB level (validation triggers, migrations patients/0002 and
# trustbridge/0003 — ADR 0006): those probes assert the bypass is BLOCKED,
# with a PostgreSQL error (DatabaseError), not a Python one. R4/R5/R6 stay
# documented-open (accepted residuals, service layer to close them) and
# PASS because they assert the CURRENT permissive behaviour.
# ---------------------------------------------------------------------------

class TestResidualUpdateBypassesStillOpen:
    def test_R1_cross_patient_share_via_queryset_update_is_blocked(self):
        """CLOSED (trigger trustbridge_paymentrequestshare_same_patient):
        a legit share queryset-updated towards a stranger's guardian link is
        refused by the database itself — the same-patient rule no longer
        depends on save()/bulk_create() being on the code path."""
        pr = make_payment_request()
        legit = make_link(patient=pr.invoice.patient)
        share = PaymentRequestShare.objects.create(
            payment_request=pr, guardian_link=legit
        )
        stranger_link = make_link(patient=make_patient(first_name="Y"))

        with pytest.raises(DatabaseError, match="patient facture"):
            with transaction.atomic():
                PaymentRequestShare.objects.filter(pk=share.pk).update(
                    guardian_link=stranger_link
                )

        share.refresh_from_db()
        assert share.guardian_link_id == legit.id
        assert stranger_link not in pr.shared_with.all()

    def test_R2_revoked_link_reactivation_via_queryset_update_is_blocked(self):
        """CLOSED (trigger patients_guardianlink_revoked_final): .update()
        can no longer flip a revoked link back to ACTIVE — REVOKED is final
        at the database level too."""
        link = make_link()
        link.revoke()

        with pytest.raises(DatabaseError, match="definitif"):
            with transaction.atomic():
                GuardianLink.objects.filter(pk=link.pk).update(
                    status=GuardianLink.Status.ACTIVE, revoked_at=None
                )

        link.refresh_from_db()
        assert link.status == GuardianLink.Status.REVOKED
        assert Consent.objects.active_scopes(link) == frozenset()

    def test_R3_issued_invoice_mutation_via_queryset_update_is_blocked(self):
        """CLOSED (trigger trustbridge_invoice_frozen_outside_draft):
        outside DRAFT, total_kmf and the encounter/center/patient anchors are
        frozen by the database; only the status transition stays free."""
        invoice = make_invoice()  # ISSUED
        original = invoice.total_kmf

        with pytest.raises(DatabaseError, match="figes"):
            with transaction.atomic():
                Invoice.objects.filter(pk=invoice.pk).update(
                    total_kmf=Decimal("999999.00")
                )
        invoice.refresh_from_db()
        assert invoice.total_kmf == original

        # The status-only transition remains possible through raw update too.
        Invoice.objects.filter(pk=invoice.pk).update(status=Invoice.Status.PAID)
        invoice.refresh_from_db()
        assert invoice.status == Invoice.Status.PAID

    def test_M6_merge_cycle_built_via_queryset_update(self):
        """no_self_merge is a DB constraint (holds), but the 'canonical target
        only' guard is save()-only: .update() builds an A<->B cycle (neither
        row self-merged), so canonical resolution would loop forever."""
        a = make_patient(first_name="A")
        b = make_patient(first_name="B")
        a.merged_into = b
        a.save()
        PatientProfile.objects.filter(pk=b.pk).update(merged_into=a.pk)
        a.refresh_from_db(); b.refresh_from_db()
        assert a.merged_into_id == b.id and b.merged_into_id == a.id

    def test_receipt_direct_create_skips_issue_coherence_check(self):
        """issue() checks the closing tx belongs to the same payment_request,
        but that check is Python-only: a direct create() with a foreign-PR
        ledger tx (and a mismatched payment_request) is stored. DB positivity
        constraints still hold; the coherence one does not exist."""
        pr = make_payment_request()
        other_pr = make_payment_request()
        foreign_tx = make_ledger_tx(payment_request=other_pr)

        receipt = Receipt.objects.create(
            payment_request=pr, center=make_center(),
            ledger_transaction=foreign_tx, sequence_number=1,
            amount_eur_paid=Decimal("50.00"),
            amount_kmf_received=Decimal("24000.00"),
            exchange_rate=Decimal("480.000000"),
        )
        assert receipt.ledger_transaction.payment_request_id == other_pr.pk
        assert receipt.payment_request_id == pr.pk

    def test_E4_private_write_window_is_importable(self):
        """The E4 write-window helper is module-private (underscore) but
        importable: opening it lets a caller post a single UNBALANCED
        LedgerEntry outside record(). The DB triggers do not catch this (they
        block UPDATE/DELETE, not INSERT). E4 stops accidents, not a determined
        caller — a Python-level guard limit, kept explicit here."""
        tx = LedgerTransaction.objects.create(description="manuelle")
        with _open_ledger_window():
            LedgerEntry.objects.create(
                transaction=tx, account=Account.DUE_TO_CENTER,
                direction=Direction.CREDIT, amount=Decimal("100000.00"),
                currency="EUR",
            )
        assert tx.entries.count() == 1  # unbalanced credit, no counterpart


class TestContreVerificationGuardsThatHold:
    """Guards that correctly survived the second adversarial pass."""

    def test_E1_set_is_validated_like_add(self):
        pr = make_payment_request()
        stranger_link = make_link(patient=make_patient(first_name="Y"))
        with pytest.raises(ValidationError):
            with transaction.atomic():
                pr.shared_with.set([stranger_link])
        assert pr.shares.count() == 0

    def test_E4_window_closes_after_an_exception_inside_it(self):
        assert not _ledger_window_open()
        with pytest.raises(RuntimeError):
            with _open_ledger_window():
                raise RuntimeError("boom")
        assert not _ledger_window_open()
