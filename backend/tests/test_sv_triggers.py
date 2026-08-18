"""SV — les triggers PostgreSQL en bloc (extension du socle ADR 0006).

Le candidat n° 1 nommé par cinq revues successives : les gardes ORM
(``AppendOnlyModel``, invariants dans ``save()``) arrêtent tous les chemins
Django, mais un SQL brut, une autre connexion ou un bug futur passaient
encore. Ce fichier prouve, table par table, que la BASE refuse désormais —
et, tout aussi important, que **chaque chemin légitime passe encore** :
délivrer une ordonnance, sortir un hospitalisé, régler une facture SaaS,
décider un congé, purger un justificatif au titre du RGPD, incrémenter la
série comptable, corriger la fiche d'un équipement réformé.

Patron (``test_hardening.TestDatabaseTriggersHold``) : l'UPDATE/DELETE brut
part par ``connection.cursor()``, le refus attendu est
``django.db.utils.DatabaseError`` — la preuve que l'arbitre est PostgreSQL,
pas Python. Le ``transaction.atomic()`` imbriqué DANS le ``pytest.raises``
est obligatoire (l'échec marque la transaction ; sans lui, les assertions
suivantes liraient une connexion morte). Pour les modèles NON append-only,
le contournement ``Model.objects.filter(pk=…).update(…)`` est testé aussi :
il doit être arrêté par la BASE (``DatabaseError``), jamais par
``AppendOnlyError`` (qui, lui, protège déjà les modèles append-only avant
même d'atteindre la base).

RÈGLE D'OR du lot, vérifiée par les tests « le chemin légitime passe » :
un trigger est le MIROIR d'un invariant ORM/service existant, jamais un
invariant nouveau.
"""

from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection, transaction
from django.db.utils import DatabaseError
from django.utils import timezone

from apps.accounting import services as accounting_services
from apps.accounting.models import AccountingExportSeries
from apps.billing import services as billing_services
from apps.billing.models import SubscriptionInvoice, SubscriptionPayment
from apps.common.geo import Island
from apps.crm.models import ContactLog
from apps.equipment.models import Equipment
from apps.hrm import services as hrm_services
from apps.hrm.models import LeaveRequest
from apps.inpatient import services as inpatient_services
from apps.inpatient.models import BedAssignment, Stay, StayDayBilling
from apps.medical import services as medical_services
from apps.medical.models import PatientDocument, Prescription, VitalSigns
from apps.pharmacy.models import (
    AvailabilityRequest,
    AvailabilityRequestItem,
    AvailabilityRequestRecipient,
    AvailabilityResponse,
    AvailabilityResponseLine,
    PharmacyDocument,
)
from apps.support.models import SupportMessage

from .factories import (
    make_bed,
    make_center,
    make_encounter,
    make_equipment,
    make_equipment_report,
    make_invoice,
    make_leave,
    make_employment,
    make_patient,
    make_pharmacy,
    make_platform_staff,
    make_prescription,
    make_staff,
    make_stay,
    make_subscription_invoice,
    make_support_ticket,
    make_tariff,
    make_user,
)

pytestmark = pytest.mark.django_db

_seq = iter(range(1, 10_000))


def _refused(sql, params, fragment):
    """Un ordre SQL brut refusé PAR LA BASE (jamais par Python)."""
    with pytest.raises(DatabaseError, match=fragment):
        with transaction.atomic():
            with connection.cursor() as cur:
                cur.execute(sql, params)


def _jpeg(name="piece.jpg"):
    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (80, 60), "white").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


# ---------------------------------------------------------------------------
# medical — relevés, documents du carnet, délivrance
# ---------------------------------------------------------------------------


class TestMedicalTriggersHold:
    def _vitals(self):
        center = make_center()
        staff = make_staff(center=center)
        encounter = make_encounter(center=center, practitioner=staff)
        medical_services.record_vital_signs(
            actor=staff.user, encounter=encounter, measured_by=staff,
            systolic_bp=120, diastolic_bp=80,
        )
        return VitalSigns.objects.get(encounter=encounter)

    def test_raw_sql_update_on_vital_signs_is_blocked(self):
        vitals = self._vitals()
        _refused(
            "UPDATE medical_vitalsigns SET systolic_bp = 240 WHERE id = %s",
            [vitals.id], "append-only",
        )
        vitals.refresh_from_db()
        assert vitals.systolic_bp == 120

    def test_raw_sql_delete_on_vital_signs_is_blocked(self):
        vitals = self._vitals()
        _refused(
            "DELETE FROM medical_vitalsigns WHERE id = %s",
            [vitals.id], "append-only",
        )
        assert VitalSigns.objects.filter(pk=vitals.pk).exists()

    def _document(self):
        center = make_center()
        staff = make_staff(center=center)
        patient = make_patient()
        document = medical_services.create_patient_document(
            actor=staff.user, center=center, patient=patient,
            uploaded_file=_jpeg(),
            doc_type=PatientDocument.DocType.LAB_RESULT,
            title="Analyses sanguines",
        )
        return staff, document

    def test_raw_sql_delete_on_patient_document_is_blocked(self):
        _staff, document = self._document()
        _refused(
            "DELETE FROM medical_patientdocument WHERE id = %s",
            [document.id], "se supprime jamais",
        )
        assert PatientDocument.objects.filter(pk=document.pk).exists()

    def test_un_archiving_a_patient_document_is_blocked_by_the_base(self):
        staff, document = self._document()
        medical_services.archive_patient_document(
            actor=staff.user, document=document
        )
        _refused(
            "UPDATE medical_patientdocument SET archived_at = NULL WHERE id = %s",
            [document.id], "definitif",
        )
        # Le contournement ORM est arrêté par la BASE aussi (modèle non
        # append-only : ``update()`` compile en UPDATE nu).
        with pytest.raises(DatabaseError, match="definitif"):
            with transaction.atomic():
                PatientDocument.objects.filter(pk=document.pk).update(
                    archived_at=None
                )
        document.refresh_from_db()
        assert document.is_archived

    def test_the_merge_reanchoring_path_still_passes(self):
        """La fusion de doublons ré-ancre ``patient_id`` légitimement
        (``merge_profiles``) : le trigger ne gèle QUE l'archivage."""
        _staff, document = self._document()
        target = make_patient(first_name="Anfia")
        document.patient = target
        document.save(update_fields=["patient", "updated_at"])
        document.refresh_from_db()
        assert document.patient_id == target.pk

    def _delivered(self):
        center = make_center()
        staff = make_staff(center=center)
        encounter = make_encounter(center=center, practitioner=staff)
        prescription = make_prescription(encounter=encounter)
        medical_services.deliver_prescription(
            actor=staff.user, prescription=prescription
        )
        prescription.refresh_from_db()
        # Le chemin légitime (emise → delivree) vient de passer SOUS le
        # trigger : la preuve du miroir exact.
        assert prescription.status == Prescription.Status.DELIVERED
        return prescription

    def test_a_delivered_prescription_never_goes_back(self):
        prescription = self._delivered()
        _refused(
            "UPDATE medical_prescription SET status = 'emise' WHERE id = %s",
            [prescription.id], "definitive",
        )
        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                Prescription.objects.filter(pk=prescription.pk).update(
                    status=Prescription.Status.ISSUED
                )
        prescription.refresh_from_db()
        assert prescription.status == Prescription.Status.DELIVERED


# ---------------------------------------------------------------------------
# billing — règlements SaaS append-only, facture d'abonnement gelée
# ---------------------------------------------------------------------------


class TestBillingTriggersHold:
    def _paid_invoice(self):
        invoice = make_subscription_invoice(amount_kmf="25000")
        operator_user, _ = make_platform_staff()
        payment = billing_services.record_subscription_payment(
            actor=operator_user, invoice=invoice,
            amount_kmf=Decimal("5000"),
            method=SubscriptionPayment.Method.TRANSFER,
        )
        return invoice, operator_user, payment

    def test_raw_sql_update_on_subscription_payment_is_blocked(self):
        _invoice, _operator, payment = self._paid_invoice()
        _refused(
            "UPDATE billing_subscriptionpayment SET amount_kmf = 1 WHERE id = %s",
            [payment.id], "append-only",
        )
        payment.refresh_from_db()
        assert payment.amount_kmf == Decimal("5000.00")

    def test_raw_sql_delete_on_subscription_payment_reversal_is_blocked(self):
        _invoice, operator_user, payment = self._paid_invoice()
        reversal = billing_services.reverse_subscription_payment(
            actor=operator_user, payment=payment,
            reason="Virement non parvenu.",
        )
        _refused(
            "DELETE FROM billing_subscriptionpaymentreversal WHERE id = %s",
            [reversal.id], "append-only",
        )

    def test_raw_sql_cannot_rewrite_a_frozen_invoice_field(self):
        invoice = make_subscription_invoice(amount_kmf="25000")
        _refused(
            "UPDATE billing_subscriptioninvoice SET amount_kmf = 1 WHERE id = %s",
            [invoice.id], "figes",
        )
        invoice.refresh_from_db()
        assert invoice.amount_kmf == Decimal("25000.00")

    def test_the_orm_bypass_on_frozen_fields_is_stopped_by_the_base(self):
        invoice = make_subscription_invoice()
        with pytest.raises(DatabaseError, match="figes"):
            with transaction.atomic():
                SubscriptionInvoice.objects.filter(pk=invoice.pk).update(
                    plan_code="AUTRE"
                )

    def test_the_invoice_workflow_still_moves(self):
        """Le gel porte sur montants/rattachements, jamais le workflow —
        miroir exact de ``_FROZEN_FIELDS`` (sinon aucune facture ne
        pourrait être réglée)."""
        invoice = make_subscription_invoice()
        invoice.status = SubscriptionInvoice.Status.PAID
        invoice.save(update_fields=["status", "updated_at"])
        invoice.refresh_from_db()
        assert invoice.status == SubscriptionInvoice.Status.PAID


# ---------------------------------------------------------------------------
# support — le fil est une trace, une trace éditable n'est pas une trace
# ---------------------------------------------------------------------------


class TestSupportTriggersHold:
    def _message(self):
        ticket = make_support_ticket()
        return SupportMessage.objects.create(
            ticket=ticket, author=make_user(),
            author_side=SupportMessage.Side.CENTER,
            body="Le sélecteur de tarifs reste vide.",
        )

    def test_raw_sql_update_on_support_message_is_blocked(self):
        message = self._message()
        _refused(
            "UPDATE support_supportmessage SET body = 'X' WHERE id = %s",
            [message.id], "append-only",
        )
        message.refresh_from_db()
        assert message.body.startswith("Le sélecteur")

    def test_raw_sql_delete_on_support_message_is_blocked(self):
        message = self._message()
        _refused(
            "DELETE FROM support_supportmessage WHERE id = %s",
            [message.id], "append-only",
        )
        assert SupportMessage.objects.filter(pk=message.pk).exists()


# ---------------------------------------------------------------------------
# inpatient — séjours terminaux, historique des lits, lots de facturation
# ---------------------------------------------------------------------------


class TestInpatientTriggersHold:
    def _discharged(self):
        center = make_center()
        staff = make_staff(center=center)
        bed = make_bed(center=center)
        stay = make_stay(center=center, bed=bed)
        assignment = stay.bed_assignments.get()
        inpatient_services.discharge_stay(actor=staff.user, stay=stay)
        stay.refresh_from_db()
        assignment.refresh_from_db()
        # Le chemin légitime (en_cours → sortie, libération du lit) vient de
        # passer SOUS les triggers : la preuve du miroir exact.
        assert stay.status == Stay.Status.DISCHARGED
        assert assignment.released_at is not None
        return stay, assignment

    def test_a_closed_stay_never_changes_state(self):
        stay, _assignment = self._discharged()
        _refused(
            "UPDATE inpatient_stay SET status = 'en_cours' WHERE id = %s",
            [stay.id], "ne change plus",
        )
        with pytest.raises(DatabaseError, match="ne change plus"):
            with transaction.atomic():
                Stay.objects.filter(pk=stay.pk).update(
                    status=Stay.Status.IN_PROGRESS
                )
        stay.refresh_from_db()
        assert stay.status == Stay.Status.DISCHARGED

    def test_a_bed_assignment_history_is_never_rewritten(self):
        center = make_center()
        bed = make_bed(center=center)
        other_bed = make_bed(room=bed.room)
        stay = make_stay(center=center, bed=bed)
        assignment = stay.bed_assignments.get()
        _refused(
            "UPDATE inpatient_bedassignment SET bed_id = %s WHERE id = %s",
            [other_bed.id, assignment.id], "reecrit",
        )
        assignment.refresh_from_db()
        assert assignment.bed_id == bed.pk

    def test_a_release_is_definitive_at_every_level(self):
        _stay, assignment = self._discharged()
        released_at = assignment.released_at
        # (a) SQL brut : ni réouverture, ni re-datation.
        _refused(
            "UPDATE inpatient_bedassignment SET released_at = NULL WHERE id = %s",
            [assignment.id], "definitive",
        )
        _refused(
            "UPDATE inpatient_bedassignment SET released_at = %s WHERE id = %s",
            [released_at + timedelta(hours=2), assignment.id], "definitive",
        )
        # (b) contournement ORM : arrêté par la BASE.
        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                BedAssignment.objects.filter(pk=assignment.pk).update(
                    released_at=None
                )
        # (c) l'ORM ALIGNÉ (correctif de ce lot) : re-dater via save() est
        # refusé en Python, avant même la base.
        assignment.refresh_from_db()
        assignment.released_at = released_at + timedelta(minutes=5)
        with pytest.raises(ValidationError, match="définitive"):
            assignment.save()
        assignment.refresh_from_db()
        assert assignment.released_at == released_at

    def test_raw_sql_on_a_stay_day_billing_batch_is_blocked(self):
        stay = make_stay()
        billing = StayDayBilling(
            stay=stay, center=stay.center, tariff=make_tariff(stay.center),
            days=2, idempotency_key=f"sv-triggers-{next(_seq)}",
            billed_by=make_user(),
        )
        billing.save()
        _refused(
            "UPDATE inpatient_staydaybilling SET days = 9 WHERE id = %s",
            [billing.id], "append-only",
        )
        _refused(
            "DELETE FROM inpatient_staydaybilling WHERE id = %s",
            [billing.id], "append-only",
        )
        billing.refresh_from_db()
        assert billing.days == 2


# ---------------------------------------------------------------------------
# hrm — décision de congé scellée, justificatif jamais supprimé, purge RGPD
# ---------------------------------------------------------------------------


class TestHrmTriggersHold:
    def test_a_decided_leave_is_sealed_by_the_base(self):
        approved = make_leave(status=LeaveRequest.Status.APPROVED)
        decided_by_id = approved.decided_by_id
        _refused(
            "UPDATE hrm_leaverequest SET status = 'demande' WHERE id = %s",
            [approved.id], "definitive",
        )
        _refused(
            "UPDATE hrm_leaverequest SET decided_by_id = NULL WHERE id = %s",
            [approved.id], "definitive",
        )
        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                LeaveRequest.objects.filter(pk=approved.pk).update(
                    status=LeaveRequest.Status.CANCELLED
                )
        approved.refresh_from_db()
        assert approved.status == LeaveRequest.Status.APPROVED
        assert approved.decided_by_id == decided_by_id

    def test_the_dates_reliquat_stays_open_as_written_down(self):
        """Miroir, jamais plus : les DATES d'un congé décidé restent libres
        au niveau base (reliquat assumé de l'ADR 0020 addendum 3 — la sonde
        exécutable vit dans ``test_adversarial_s7.py``)."""
        approved = make_leave(status=LeaveRequest.Status.APPROVED)
        moved = LeaveRequest.objects.filter(pk=approved.pk).update(
            start_date=timezone.localdate() + timedelta(days=100),
            end_date=timezone.localdate() + timedelta(days=110),
        )
        assert moved == 1

    def test_the_legal_decision_still_passes(self):
        pending = make_leave()  # demande
        hrm_services.decide_leave(
            actor=make_user(), leave=pending, approve=True
        )
        pending.refresh_from_db()
        assert pending.status == LeaveRequest.Status.APPROVED

    def _certificate(self):
        employment = make_employment()
        leave = hrm_services.request_leave(
            actor=employment.user, employment=employment,
            leave_type=LeaveRequest.Type.SICK,
            start_date=timezone.localdate() + timedelta(days=3),
            end_date=timezone.localdate() + timedelta(days=5),
        )
        document = hrm_services.upload_leave_document(
            actor=employment.user, leave=leave, uploaded_file=_jpeg()
        )
        return employment, document

    def test_a_leave_document_is_never_deleted(self):
        _employment, document = self._certificate()
        _refused(
            "DELETE FROM hrm_leavedocument WHERE id = %s",
            [document.id], "supprime",
        )

    def test_archiving_is_final_but_the_rgpd_purge_still_passes(self):
        """LE test qui compte : la purge RGPD fait un UPDATE légitime du
        champ ``file`` (octets effacés, ligne conservée) — le trigger ne
        doit JAMAIS la bloquer."""
        employment, document = self._certificate()
        hrm_services.archive_leave_document(
            actor=make_user(), document=document
        )
        _refused(
            "UPDATE hrm_leavedocument SET archived_at = NULL WHERE id = %s",
            [document.id], "definitif",
        )
        purged = hrm_services.purge_leave_documents_of(
            actor=None, user=employment.user
        )
        assert purged == 1
        document.refresh_from_db()
        assert not document.file
        assert document.is_archived  # la ligne reste, orpheline d'octets


# ---------------------------------------------------------------------------
# pharmacy — ce qui est parti au réseau est figé, les pièces s'archivent
# ---------------------------------------------------------------------------


class TestPharmacyTriggersHold:
    def _network(self):
        pharmacy = make_pharmacy()
        prescription = make_prescription()
        request = AvailabilityRequest.objects.create(
            center=prescription.encounter.center,
            prescription=prescription,
            created_by=make_user(),
            island=Island.NGAZIDJA,
            city="Moroni",
            expires_at=timezone.now() + timedelta(hours=48),
        )
        item = AvailabilityRequestItem.objects.create(
            request=request, medication="Amlodipine 5 mg"
        )
        recipient = AvailabilityRequestRecipient.objects.create(
            request=request, pharmacy=pharmacy
        )
        response = AvailabilityResponse.objects.create(
            recipient=recipient, responded_by=make_user()
        )
        line = AvailabilityResponseLine.objects.create(
            response=response, item=item, is_available=True
        )
        return item, recipient, response, line

    def test_raw_sql_update_on_a_request_item_is_blocked(self):
        item, _recipient, _response, _line = self._network()
        _refused(
            "UPDATE pharmacy_availabilityrequestitem SET medication = 'X' WHERE id = %s",
            [item.id], "append-only",
        )
        item.refresh_from_db()
        assert item.medication == "Amlodipine 5 mg"

    def test_raw_sql_delete_on_a_recipient_is_blocked(self):
        _item, recipient, _response, _line = self._network()
        _refused(
            "DELETE FROM pharmacy_availabilityrequestrecipient WHERE id = %s",
            [recipient.id], "append-only",
        )

    def test_raw_sql_update_on_a_response_is_blocked(self):
        _item, _recipient, response, _line = self._network()
        _refused(
            "UPDATE pharmacy_availabilityresponse SET comment = 'X' WHERE id = %s",
            [response.id], "append-only",
        )

    def test_raw_sql_update_on_a_response_line_is_blocked(self):
        _item, _recipient, _response, line = self._network()
        _refused(
            "UPDATE pharmacy_availabilityresponseline SET is_available = false WHERE id = %s",
            [line.id], "append-only",
        )
        line.refresh_from_db()
        assert line.is_available is True

    def _piece(self):
        return PharmacyDocument.objects.create(
            pharmacy=make_pharmacy(),
            doc_type=PharmacyDocument.DocType.PHARMACY_LICENCE,
            file="pharmacy_documents/sv-licence.jpg",
            uploaded_by=make_user(),
        )

    def test_a_pharmacy_piece_is_never_deleted(self):
        piece = self._piece()
        _refused(
            "DELETE FROM pharmacy_pharmacydocument WHERE id = %s",
            [piece.id], "supprime",
        )

    def test_un_archiving_a_pharmacy_piece_is_blocked(self):
        piece = self._piece()
        piece.archived_at = timezone.now()
        piece.archived_by = make_user()
        piece.save(update_fields=["archived_at", "archived_by", "updated_at"])
        _refused(
            "UPDATE pharmacy_pharmacydocument SET archived_at = NULL WHERE id = %s",
            [piece.id], "definitif",
        )
        with pytest.raises(DatabaseError, match="definitif"):
            with transaction.atomic():
                PharmacyDocument.objects.filter(pk=piece.pk).update(
                    archived_at=None
                )
        piece.refresh_from_db()
        assert piece.is_archived


# ---------------------------------------------------------------------------
# crm — la cadence se calcule en comptant des lignes immuables
# ---------------------------------------------------------------------------


class TestCrmTriggersHold:
    def _contact(self):
        invoice = make_invoice()
        return ContactLog.objects.create(
            center=invoice.center, patient=invoice.patient,
            kind=ContactLog.Kind.UNPAID_REMINDER,
            channel=ContactLog.Channel.CALL,
            recipient=ContactLog.Recipient.PATIENT,
            invoice=invoice,
            outcome=ContactLog.Outcome.NO_ANSWER,
            created_by=make_user(),
        )

    def test_raw_sql_update_on_a_contact_is_blocked(self):
        contact = self._contact()
        _refused(
            "UPDATE crm_contactlog SET outcome = 'joint' WHERE id = %s",
            [contact.id], "append-only",
        )
        contact.refresh_from_db()
        assert contact.outcome == ContactLog.Outcome.NO_ANSWER

    def test_raw_sql_delete_on_a_contact_is_blocked(self):
        contact = self._contact()
        _refused(
            "DELETE FROM crm_contactlog WHERE id = %s",
            [contact.id], "append-only",
        )
        assert ContactLog.objects.filter(pk=contact.pk).exists()


# ---------------------------------------------------------------------------
# accounting — la pièce signée ne bouge plus, la série ne recule jamais
# ---------------------------------------------------------------------------


class TestAccountingTriggersHold:
    def _export(self):
        center = make_center()
        actor = make_user()
        today = timezone.localdate()
        export = accounting_services.generate_accounting_export(
            actor=actor, center=center,
            period_start=today - timedelta(days=1), period_end=today,
        )
        return center, actor, export

    def test_raw_sql_update_on_an_export_is_blocked(self):
        _center, _actor, export = self._export()
        _refused(
            "UPDATE accounting_accountingexport SET net_kmf = 999999 WHERE id = %s",
            [export.id], "append-only",
        )
        export.refresh_from_db()
        assert export.net_kmf == Decimal("0.00")

    def test_raw_sql_delete_on_an_export_is_blocked(self):
        _center, _actor, export = self._export()
        _refused(
            "DELETE FROM accounting_accountingexport WHERE id = %s",
            [export.id], "append-only",
        )

    def test_the_series_counter_never_goes_backwards(self):
        center, actor, _export = self._export()
        series = AccountingExportSeries.objects.get(center=center)
        assert series.last_number == 1
        _refused(
            "UPDATE accounting_accountingexportseries SET last_number = 0 WHERE id = %s",
            [series.id], "monotone",
        )
        with pytest.raises(DatabaseError, match="recule"):
            with transaction.atomic():
                AccountingExportSeries.objects.filter(pk=series.pk).update(
                    last_number=0
                )
        series.refresh_from_db()
        assert series.last_number == 1
        # Le chemin légitime — l'incrément sous verrou — passe encore : la
        # deuxième pièce prend le numéro 2.
        today = timezone.localdate()
        second = accounting_services.generate_accounting_export(
            actor=actor, center=center,
            period_start=today, period_end=today,
        )
        assert second.sequence_number == 2


# ---------------------------------------------------------------------------
# equipment — le constat est immuable, la réforme est définitive
# ---------------------------------------------------------------------------


class TestEquipmentTriggersHold:
    def test_raw_sql_on_a_report_is_blocked(self):
        report = make_equipment_report()
        _refused(
            "UPDATE equipment_equipmentreport SET description = 'X' WHERE id = %s",
            [report.id], "append-only",
        )
        _refused(
            "DELETE FROM equipment_equipmentreport WHERE id = %s",
            [report.id], "append-only",
        )
        report.refresh_from_db()
        assert report.description != "X"

    def test_a_decommissioned_equipment_never_comes_back(self):
        reformed = make_equipment(status=Equipment.Status.DECOMMISSIONED)
        _refused(
            "UPDATE equipment_equipment SET status = 'en_service' WHERE id = %s",
            [reformed.id], "definitive",
        )
        with pytest.raises(DatabaseError, match="definitive"):
            with transaction.atomic():
                Equipment.objects.filter(pk=reformed.pk).update(
                    status=Equipment.Status.OUT_OF_ORDER
                )
        reformed.refresh_from_db()
        assert reformed.status == Equipment.Status.DECOMMISSIONED

    def test_correcting_the_sheet_of_a_decommissioned_equipment_still_passes(self):
        """Miroir exact de l'ORM : seule la sortie de l'état ``reforme`` est
        gelée — corriger l'emplacement ou les notes d'un réformé reste
        permis (l'inventaire raconte son histoire, on peut l'annoter)."""
        reformed = make_equipment(status=Equipment.Status.DECOMMISSIONED)
        assert Equipment.objects.filter(pk=reformed.pk).update(
            location="Réserve du sous-sol"
        ) == 1
        reformed.refresh_from_db()
        assert reformed.location == "Réserve du sous-sol"
        assert reformed.status == Equipment.Status.DECOMMISSIONED

    def test_the_legal_state_machine_still_moves(self):
        equipment = make_equipment()  # en_service
        equipment.status = Equipment.Status.OUT_OF_ORDER
        equipment.save()
        equipment.refresh_from_db()
        assert equipment.status == Equipment.Status.OUT_OF_ORDER
