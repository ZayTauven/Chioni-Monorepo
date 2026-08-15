"""Dev command ``seed_demo`` — the demo stage for the three spaces.

Contract under test:

- one run builds the WHOLE scenario through the legal write paths only:
  KYC-active center, staff, tariffs, claimed patient, ACTIVE
  patient-initiated guardian link, a second link parked behind the
  claimant-confirmation gate, a SENT payment request shared with the
  active guardian, a draft invoice, carnet entries and a prescription;
- the command is IDEMPOTENT: a second run duplicates nothing;
- DEBUG=False refuses to run (published demo password — dev only).

NB: the test runner forces ``DEBUG=False`` (``setup_test_environment``),
so nominal cases opt back in with ``override_settings(DEBUG=True)``.
"""

from decimal import Decimal
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import ErasureRequest, PlatformStaff
from apps.billing import services as billing_services
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.centers.models import (
    HealthCenter,
    KycDocument,
    StaffMembership,
    TariffItem,
)
from apps.common.models import ActCategory
from apps.medical.models import (
    Consent,
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    VitalSigns,
)
from apps.patients.models import (
    GuardianLink,
    GuardianProfile,
    PatientInsurance,
    PatientProfile,
)
from apps.support.models import SupportMessage, SupportTicket
from apps.trustbridge.models import Invoice, PaymentRequest, PaymentRequestShare

pytestmark = pytest.mark.django_db

User = get_user_model()
Role = StaffMembership.Role


def run_command():
    out = StringIO()
    call_command("seed_demo", stdout=out)
    return out.getvalue()


class TestSeedDemoScenario:
    @override_settings(DEBUG=True)
    def test_creates_center_staff_and_tariffs(self):
        run_command()

        center = HealthCenter.objects.get(name="Clinique Ylang")
        assert center.type == HealthCenter.Type.PRIVATE_CLINIC
        assert center.island == HealthCenter.Island.NGAZIDJA
        assert center.kyc_status == HealthCenter.KycStatus.ACTIVE

        admin = User.objects.get(username="admin")
        assert admin.is_superuser

        memberships = {
            m.role: m
            for m in StaffMembership.objects.for_center(center).select_related("user")
        }
        assert set(memberships) == {
            Role.DIRECTOR, Role.DOCTOR, Role.SECRETARY, Role.CASHIER
        }
        assert all(m.is_active for m in memberships.values())
        assert memberships[Role.DIRECTOR].user.username == "directeur.demo"
        assert memberships[Role.DOCTOR].user.username == "medecin.demo"
        # Staff log in with the shared demo password (staff screen / admin).
        assert memberships[Role.CASHIER].user.check_password("ChioniDemo!2026")

        tariffs = {
            t.code: t for t in TariffItem.objects.for_center(center)
        }
        assert tariffs["CONS01"].price_kmf == Decimal("5000")
        assert tariffs["CONS01"].generic_category == ActCategory.CONSULTATION
        assert tariffs["ANAL01"].price_kmf == Decimal("15000")
        assert tariffs["ANAL01"].generic_category == ActCategory.ANALYSES_EXAMENS
        assert tariffs["MEDI01"].price_kmf == Decimal("8000")
        assert tariffs["MEDI01"].generic_category == ActCategory.MEDICAMENTS
        assert tariffs["ECHO01"].price_kmf == Decimal("12000")
        assert tariffs["ECHO01"].generic_category == ActCategory.ACTE_TECHNIQUE

    @override_settings(DEBUG=True)
    def test_patient_is_claimed_and_links_hold_the_right_states(self):
        run_command()

        patient_user = User.objects.get(username="patient.demo")
        assert patient_user.phone == "+2693440001"
        assert patient_user.phone_verified_at is not None
        assert patient_user.check_password("ChioniDemo!2026")
        profile = patient_user.patient_profile
        assert profile.claim_status == PatientProfile.ClaimStatus.ACTIVE
        assert profile.first_name == "Anfia"

        # Nassim — patient-initiated invitation, accepted: ACTIVE, and the
        # link carries exactly the minimal payments scope.
        link1 = GuardianLink.objects.get(
            guardian__user__username="tuteur.demo", patient=profile
        )
        assert link1.status == GuardianLink.Status.ACTIVE
        assert link1.initiated_by == GuardianLink.InitiatedBy.PATIENT
        assert Consent.objects.active_scopes(link1) == frozenset(
            {Consent.Scope.PAYMENTS}
        )

        # Rachida — door-A creator whose link was suspended by the claim:
        # the claimant-confirmation gate, with ZERO visibility meanwhile.
        link2 = GuardianLink.objects.get(
            guardian__user__username="tuteur2.demo", patient=profile
        )
        assert (
            link2.status == GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION
        )
        assert Consent.objects.active_scopes(link2) == frozenset()

        guardian = GuardianProfile.objects.get(user__username="tuteur.demo")
        assert guardian.country_of_residence == "FR"
        assert guardian.preferred_currency == "EUR"

    @override_settings(DEBUG=True)
    def test_money_scenario_is_sent_and_a_draft_invoice_remains(self):
        run_command()

        center = HealthCenter.objects.get(name="Clinique Ylang")
        payment_request = PaymentRequest.objects.get(invoice__center=center)
        assert payment_request.status == PaymentRequest.Status.SENT
        assert payment_request.invoice.total_kmf == Decimal("20000.00")
        assert payment_request.invoice.status == Invoice.Status.ISSUED

        share = PaymentRequestShare.objects.get(payment_request=payment_request)
        assert (
            share.guardian_link.guardian.user.username == "tuteur.demo"
        )

        draft = Invoice.objects.get(center=center, status=Invoice.Status.DRAFT)
        assert draft.total_kmf == Decimal("20000.00")  # écho + médicaments
        assert Encounter.objects.for_center(center).count() == 2

    @override_settings(DEBUG=True)
    def test_health_record_and_prescription_are_seeded(self):
        run_command()

        profile = User.objects.get(username="patient.demo").patient_profile
        entries = HealthRecordEntry.objects.for_patient(profile)
        assert entries.count() == 2
        assert set(entries.values_list("entry_type", flat=True)) == {
            HealthRecordEntry.EntryType.HISTORY,
            HealthRecordEntry.EntryType.CURRENT_TREATMENT,
        }
        prescription = Prescription.objects.get(encounter__patient=profile)
        assert prescription.items.count() == 2

    @override_settings(DEBUG=True)
    def test_enriched_record_is_seeded(self):
        """S3 (ADR 0016) — medical file, one vital-signs set, one PRIVATE
        document, one insurance, extended identity on the demo patient."""
        run_command()

        profile = User.objects.get(username="patient.demo").patient_profile
        assert profile.address  # extended identity, edited by the patient
        assert profile.emergency_contact_phone == "+33612345678"

        medical_file = PatientMedicalFile.objects.get(patient=profile)
        assert medical_file.blood_group == PatientMedicalFile.BloodGroup.O_POS

        vitals = VitalSigns.objects.for_patient(profile).get()
        assert vitals.systolic_bp == 152

        document = PatientDocument.objects.for_patient(profile).get()
        assert document.doc_type == PatientDocument.DocType.LAB_RESULT
        assert document.archived_at is None
        with pytest.raises(ValueError):
            document.file.url  # private diffusion: no public URL, ever

        insurance = PatientInsurance.objects.get(patient=profile)
        assert insurance.is_active is True

    @override_settings(DEBUG=True)
    def test_platform_hat_and_kyc_file_are_seeded(self):
        """S4 (ADR 0017) — the fourth space is demonstrable: one Chioni
        operator (WITHOUT any Django admin flag) and one KYC piece on the
        demo center, stored privately."""
        run_command()

        operator = PlatformStaff.objects.get(user__username="plateforme.demo")
        assert operator.role == PlatformStaff.Role.ADMIN
        assert operator.is_active
        # The whole point of the sprint: the hat is a row, not a flag.
        assert not operator.user.is_staff and not operator.user.is_superuser
        assert operator.user.check_password("ChioniDemo!2026")

        center = HealthCenter.objects.get(name="Clinique Ylang")
        document = KycDocument.objects.for_center(center).get()
        assert document.doc_type == KycDocument.DocType.TRADE_REGISTER
        assert document.archived_at is None
        with pytest.raises(ValueError):
            document.file.url  # private diffusion: no public URL, ever

    @override_settings(DEBUG=True)
    def test_a_pending_erasure_request_waits_in_the_back_office(self):
        """S4 lot 3 (ADR 0017 §7) — the RGPD queue has something real to
        show, deposited by the guardian whose link is parked behind the
        claimant-confirmation gate (processing it touches no money)."""
        run_command()

        erasure_request = ErasureRequest.objects.get()
        assert erasure_request.user.username == "tuteur2.demo"
        assert erasure_request.status == ErasureRequest.Status.PENDING
        assert erasure_request.processed_at is None
        assert erasure_request.refusal_reason == ""

    @override_settings(DEBUG=True)
    def test_the_demo_tenant_has_a_live_saas_contract(self):
        """S5 (ADR 0018) — une offre et un abonnement ACTIF : la démo du
        gel administratif est une ÉTAPE (suspendre depuis l'espace
        plateforme), jamais l'état de départ."""
        run_command()

        plan = SubscriptionPlan.objects.get(code="ESSENTIEL")
        assert plan.price_kmf == Decimal("25000")
        assert plan.included_staff == 10 and plan.included_practitioners == 3

        center = HealthCenter.objects.get(name="Clinique Ylang")
        subscription = CenterSubscription.objects.get(center=center)
        assert subscription.plan_id == plan.pk
        assert subscription.status == CenterSubscription.Status.ACTIVE
        assert subscription.is_frozen is False
        assert subscription.current_period_end is not None
        assert subscription.status_reason == ""

    @override_settings(DEBUG=True)
    def test_the_demo_tenant_has_a_saas_invoice_half_settled(self):
        """S5 lot 2 (ADR 0018 décision 4) — le cas le plus parlant : une
        facture « A- » émise, un virement partiel enregistré, un solde
        restant visible des deux côtés. Émise par les VRAIS services : la
        période, l'échéance et le curseur sont ceux de la production."""
        run_command()

        subscription = CenterSubscription.objects.get(
            center__name="Clinique Ylang"
        )
        invoice = SubscriptionInvoice.objects.get(subscription=subscription)
        assert invoice.number == "A-000001"
        assert invoice.amount_kmf == Decimal("25000")
        assert invoice.status == SubscriptionInvoice.Status.ISSUED
        assert invoice.plan_code == "ESSENTIEL"
        # L'émission entretient le curseur de période (lot 1 le posait à la
        # main : depuis le lot 2, c'est la facture qui fait foi).
        assert subscription.current_period_end == invoice.period_end
        assert invoice.due_date > invoice.period_start

        (payment,) = SubscriptionPayment.objects.filter(invoice=invoice)
        assert payment.amount_kmf == Decimal("10000")
        assert payment.method == SubscriptionPayment.Method.TRANSFER
        assert not hasattr(payment, "reversal")
        assert billing_services.subscription_invoice_balance_kmf(
            invoice
        ) == Decimal("15000.00")

    @override_settings(DEBUG=True)
    def test_the_support_channel_has_an_open_ticket_and_two_messages(self):
        """S5 lot 3 (ADR 0018 décision 5) — le cas le plus parlant : c'est
        la SECRÉTAIRE qui ouvre (pas le directeur), et Chioni a déjà
        répondu. Le contenu de démo ne nomme aucun patient : le seed montre
        l'usage attendu."""
        run_command()

        center = HealthCenter.objects.get(name="Clinique Ylang")
        ticket = SupportTicket.objects.for_center(center).get()
        assert ticket.status == SupportTicket.Status.OPEN
        assert ticket.opened_by.username == "secretaire.demo"
        assert ticket.category == SupportTicket.Category.BUG

        first, second = ticket.messages.all()
        assert first.author_side == SupportMessage.Side.CENTER
        assert second.author_side == SupportMessage.Side.CHIONI
        assert second.author.username == "support.demo"
        for message in (first, second):
            assert "Anfia" not in message.body and "Saïd" not in message.body

    @override_settings(DEBUG=True)
    def test_a_support_operator_stands_beside_the_admin(self):
        """S5 lot 3 (ADR 0018 décision 6) — la seconde casquette du
        back-office, sans laquelle l'arbitrage « le support répond aux
        tickets » n'est pas démontrable."""
        run_command()

        support = PlatformStaff.objects.get(user__username="support.demo")
        assert support.role == PlatformStaff.Role.SUPPORT
        assert support.is_active
        assert not support.user.is_staff and not support.user.is_superuser
        assert PlatformStaff.objects.count() == 2

    @override_settings(DEBUG=True)
    def test_recap_output_names_the_accounts_and_the_demo_flow(self):
        output = run_command()

        assert "ChioniDemo!2026" in output
        for username in (
            "admin", "directeur.demo", "medecin.demo", "secretaire.demo",
            "caissier.demo", "patient.demo", "tuteur.demo", "tuteur2.demo",
            "plateforme.demo", "support.demo",
        ):
            assert username in output
        assert "simulate_psp_payment --latest" in output
        assert "20 000 KMF" in output
        # S5 — l'abonnement du tenant est lisible dans le récapitulatif…
        assert "Essentiel" in output and "25 000 KMF/mois" in output
        # …et sa facture SaaS avec son solde restant (lot 2).
        assert "A-000001" in output and "15 000 KMF" in output


class TestSeedDemoIdempotence:
    @override_settings(DEBUG=True)
    def test_running_twice_duplicates_nothing(self):
        run_command()
        counts = self._counts()
        output = run_command()
        assert self._counts() == counts
        # The recap still prints in full on a re-run.
        assert "ChioniDemo!2026" in output

    @staticmethod
    def _counts():
        return {
            "users": User.objects.count(),
            "centers": HealthCenter.objects.count(),
            "memberships": StaffMembership.objects.count(),
            "tariffs": TariffItem.objects.count(),
            "patients": PatientProfile.objects.count(),
            "guardians": GuardianProfile.objects.count(),
            "links": GuardianLink.objects.count(),
            "encounters": Encounter.objects.count(),
            "invoices": Invoice.objects.count(),
            "payment_requests": PaymentRequest.objects.count(),
            "shares": PaymentRequestShare.objects.count(),
            "record_entries": HealthRecordEntry.objects.count(),
            "prescriptions": Prescription.objects.count(),
            # S3 (ADR 0016) — enriched record tables.
            "medical_files": PatientMedicalFile.objects.count(),
            "vital_signs": VitalSigns.objects.count(),
            "documents": PatientDocument.objects.count(),
            "insurances": PatientInsurance.objects.count(),
            # S4 (ADR 0017) — tenant lifecycle tables.
            "platform_staff": PlatformStaff.objects.count(),
            "kyc_documents": KycDocument.objects.count(),
            "erasure_requests": ErasureRequest.objects.count(),
            # S5 (ADR 0018) — abonnement SaaS et sa facturation.
            "plans": SubscriptionPlan.objects.count(),
            "subscriptions": CenterSubscription.objects.count(),
            "saas_invoices": SubscriptionInvoice.objects.count(),
            "saas_payments": SubscriptionPayment.objects.count(),
            # S5 lot 3 (ADR 0018 décision 5) — le canal de support.
            "support_tickets": SupportTicket.objects.count(),
            "support_messages": SupportMessage.objects.count(),
        }


class TestSeedDemoGuards:
    @override_settings(DEBUG=False)
    def test_refuses_to_run_when_debug_is_false(self):
        with pytest.raises(CommandError, match="DEBUG"):
            call_command("seed_demo")
        # Nothing was written before the guard fired.
        assert User.objects.count() == 0
        assert HealthCenter.objects.count() == 0
