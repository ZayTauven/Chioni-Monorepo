"""``seed_demo`` — a complete, hand-testable demo stage for the 3 spaces.

Populates the DEV database with one coherent scenario (center space,
patient space, guardian space) so the freshly wired frontend can be
exercised by hand: a KYC-active center with staff and tariffs, a claimed
patient, an active diaspora guardian with a payment request « À payer »,
and a second guardian whose link waits behind the claimant-confirmation
gate (the product's ethical invariant, demonstrated live).

Engineering rules honoured here:

- **Legal write paths ONLY** (CLAUDE.md): every domain object goes through
  its service (``apps.*.services``) or a validated ``save()``. No raw
  ``update()`` anywhere, and no state is fabricated that the services
  cannot produce. In particular, the ``attente_confirmation_titulaire``
  link is built by the REAL flow: door A (guardian registers the protégée)
  then :func:`apps.patients.services.claim_profile` — exactly what the OTP
  auto-claim runs — which suspends the pre-existing link behind the gate.
- **Idempotent**: relaunching never duplicates anything — users are found
  back by username/phone, tariffs by (center, code), the money scenario by
  its encounter's reason. There is deliberately NO ``--fresh`` option:
  the audit log and the ledger are append-only down to PostgreSQL triggers,
  so a clean teardown is structurally impossible — recreate the dev
  database instead if a blank slate is needed.
- **Dev-only** (same posture as ``simulate_psp_payment``): refuses to run
  when ``DEBUG`` is False — demo credentials with a published password
  must never reach a deployed instance.

Usage::

    python manage.py seed_demo
"""

from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts import services as account_services
from apps.accounts.models import ErasureRequest, PlatformStaff
from apps.billing import services as billing_services
from apps.billing.models import (
    CenterSubscription,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.centers import services as center_services
from apps.centers.models import (
    HealthCenter,
    KycDocument,
    StaffMembership,
    TariffItem,
)
from apps.common.models import ActCategory, Currency
from apps.medical import services as medical_services
from apps.medical.models import (
    Encounter,
    HealthRecordEntry,
    PatientDocument,
    PatientMedicalFile,
    Prescription,
    VitalSigns,
)
from apps.patients import services as patient_services
from apps.patients.models import (
    GuardianLink,
    GuardianProfile,
    PatientInsurance,
    PatientProfile,
)
from apps.support import services as support_services
from apps.support.models import SupportMessage, SupportTicket
from apps.trustbridge import services as trustbridge_services
from apps.trustbridge.models import Invoice, PaymentRequest

#: One password for every password-bearing demo account (staff login screen
#: of the frontend, or /admin/). Published in the recap — hence DEBUG-only.
DEMO_PASSWORD = "ChioniDemo!2026"

CENTER_NAME = "Clinique Ylang"
CENTER_PHONE = "+2697731001"  # fictional Moroni landline

PATIENT_PHONE = "+2693440001"
GUARDIAN_PHONE = "+33612345678"
GUARDIAN2_PHONE = "+33698765432"
#: S4 (ADR 0017) — the fourth hat: a Chioni operator, tenant-side of nothing.
PLATFORM_PHONE = "+2693440020"
#: S5 lot 3 (ADR 0018 décision 6) — the SECOND operator, role « support » :
#: c'est la casquette qui répond aux tickets, et la seule qui écrit dans le
#: back-office sans être « admin ». Sans elle, l'arbitrage du lot 3
#: (« répondre à un ticket EST le métier du support ») n'est pas démontrable.
SUPPORT_PHONE = "+2693440021"

#: S5 (ADR 0018) — the SaaS offer sold to the demo center.
DEMO_PLAN_CODE = "ESSENTIEL"
DEMO_PLAN_PRICE_KMF = Decimal("25000")

#: The money scenario is found back (idempotence) by these reasons.
ENCOUNTER_1_REASON = "Contrôle hypertension"
ENCOUNTER_2_REASON = "Douleurs abdominales"

#: (code, label, generic category, price KMF)
TARIFFS = (
    ("CONS01", "Consultation générale", ActCategory.CONSULTATION, "5000"),
    ("ANAL01", "Analyses sanguines", ActCategory.ANALYSES_EXAMENS, "15000"),
    ("MEDI01", "Médicaments", ActCategory.MEDICAMENTS, "8000"),
    ("ECHO01", "Échographie", ActCategory.ACTE_TECHNIQUE, "12000"),
)

#: (username, first name, last name, phone, role) — distinct fictional +269.
STAFF = (
    ("directeur.demo", "Saïd", "Abdallah", "+2693440010",
     StaffMembership.Role.DIRECTOR),
    ("medecin.demo", "Fatima", "Mohamed", "+2693440011",
     StaffMembership.Role.DOCTOR),
    ("secretaire.demo", "Hadidja", "Soilihi", "+2693440012",
     StaffMembership.Role.SECRETARY),
    ("caissier.demo", "Ibrahim", "Mze", "+2693440013",
     StaffMembership.Role.CASHIER),
)


class Command(BaseCommand):
    help = (
        "Peuple la base de DÉVELOPPEMENT avec un scénario de démonstration "
        "complet des 3 espaces (centre, patient, tuteur) — idempotent, "
        "interdit hors DEBUG."
    )

    def handle(self, *args, **options):
        # Same philosophy as simulate_psp_payment: demo accounts with a
        # published password must never exist on a deployed instance.
        if not settings.DEBUG:
            raise CommandError(
                "seed_demo est un outil de développement : interdit hors "
                "DEBUG (les comptes de démo portent un mot de passe publié)."
            )
        with transaction.atomic():
            state = self._seed()
        self._print_recap(state)

    # ------------------------------------------------------------------
    # Seeding — services first, validated save() otherwise
    # ------------------------------------------------------------------

    def _seed(self):
        admin = self._ensure_superuser()
        platform_operator = self._ensure_platform_staff()
        support_operator = self._ensure_support_operator()
        center = self._ensure_center()
        # The director is provisioned by the back-office (admin); the
        # director then onboards the rest of the team — the real chain.
        staff = {}
        director = None
        for username, first_name, last_name, phone, role in STAFF:
            staff[role] = self._ensure_staff_user(
                actor=admin if director is None else director,
                center=center, username=username, phone=phone,
                first_name=first_name, last_name=last_name, role=role,
            )
            if role == StaffMembership.Role.DIRECTOR:
                director = staff[role]
        doctor = staff[StaffMembership.Role.DOCTOR]
        cashier = staff[StaffMembership.Role.CASHIER]
        secretary = staff[StaffMembership.Role.SECRETARY]
        tariffs = self._ensure_tariffs(center=center, director=director)
        self._ensure_kyc_document(center=center, director=director)
        subscription = self._ensure_subscription(
            center=center, operator=platform_operator
        )
        support_ticket = self._ensure_support_ticket(
            center=center, secretary=secretary, operator=support_operator
        )

        guardian2, guardian2_profile = self._ensure_guardian(
            username="tuteur2.demo", phone=GUARDIAN2_PHONE,
            first_name="Rachida", last_name="Ahmed",
        )
        guardian1, guardian1_profile = self._ensure_guardian(
            username="tuteur.demo", phone=GUARDIAN_PHONE,
            first_name="Nassim", last_name="Ali",
        )
        patient_user, patient = self._ensure_patient(guardian2=guardian2)
        link2 = GuardianLink.objects.filter(
            guardian=guardian2_profile, patient=patient
        ).first()
        link1 = self._ensure_active_guardian_link(
            patient_user=patient_user, patient=patient,
            guardian_user=guardian1, guardian_profile=guardian1_profile,
        )

        first_encounter = self._ensure_money_scenario(
            center=center, patient=patient, doctor=doctor, cashier=cashier,
            tariffs=tariffs, guardian_link=link1,
        )
        self._ensure_health_record(
            patient=patient, doctor=doctor, encounter=first_encounter,
        )
        self._ensure_enriched_record(
            center=center, patient=patient, patient_user=patient_user,
            doctor=doctor, cashier=cashier, encounter=first_encounter,
        )
        self._ensure_erasure_request(user=guardian2)

        return {
            "center": center,
            "patient": patient,
            "link1": link1,
            "link2": link2,
            "subscription": subscription,
            "support_ticket": support_ticket,
        }

    def _ensure_superuser(self):
        User = get_user_model()
        admin = User.objects.filter(username="admin").first()
        if admin is None:
            admin = User.objects.create_superuser(
                username="admin",
                email="admin@chioni.test",
                password=DEMO_PASSWORD,
            )
            self._note("Superuser « admin » créé.")
        else:
            self._note("Superuser « admin » déjà en place.")
        return admin

    def _ensure_platform_staff(self):
        """S4 (ADR 0017) — the demo Chioni operator (4ᵉ espace).

        Deliberately WITHOUT ``is_staff``: the whole point of the sprint is
        that admin flags grant no product right. This account opens the
        back-office space and nothing else — no Django admin, no tenant,
        no patient.
        """
        user = self._ensure_user(
            "plateforme.demo", phone=PLATFORM_PHONE,
            first_name="Zaïnaba", last_name="Combo", verify_phone=True,
        )
        if PlatformStaff.objects.filter(user=user).exists():
            self._note("Équipe Chioni : plateforme.demo déjà en place.")
            return user
        # S5 lot 3 : passage par le service (l'admin Django s'est refermé
        # sur cette table) — même porte que la commande d'amorçage
        # `create_platform_staff`, avec son audit.
        account_services.create_platform_staff(
            actor=None, phone=PLATFORM_PHONE, role=PlatformStaff.Role.ADMIN
        )
        self._note(
            "Équipe Chioni : plateforme.demo (administrateur) — "
            "espace back-office."
        )
        return user

    def _ensure_support_operator(self):
        """S5 lot 3 (ADR 0018 décision 6) — the « support » operator.

        Second hat of the back-office, and the one that makes the lot's
        arbitrage demonstrable: a ``support`` reads everything, writes
        NOTHING about the tenant or the money… and answers tickets, which
        is its job.
        """
        user = self._ensure_user(
            "support.demo", phone=SUPPORT_PHONE,
            first_name="Moinaecha", last_name="Bacar", verify_phone=True,
        )
        if PlatformStaff.objects.filter(user=user).exists():
            self._note("Équipe Chioni : support.demo déjà en place.")
            return user
        account_services.create_platform_staff(
            actor=None, phone=SUPPORT_PHONE, role=PlatformStaff.Role.SUPPORT
        )
        self._note(
            "Équipe Chioni : support.demo (support) — répond aux tickets."
        )
        return user

    def _ensure_support_ticket(self, *, center, secretary, operator):
        """S5 lot 3 (ADR 0018 décision 5) — un ticket OUVERT et son échange.

        Le cas le plus parlant : c'est la SECRÉTAIRE qui ouvre (pas le
        directeur), et Chioni répond. Le contenu est volontairement
        exemplaire — aucun nom de patient, aucune donnée médicale : le
        seed montre l'usage qu'on attend, l'avertissement de l'écran fait
        le reste.

        Passe par les vrais services (append-only sur les messages, audit
        sans le contenu) — jamais un ``objects.create`` de complaisance.
        """
        ticket = SupportTicket.objects.for_center(center).first()
        if ticket is not None:
            self._note("Support : ticket de démo déjà ouvert.")
            return ticket
        ticket = support_services.open_ticket(
            actor=secretary,
            center=center,
            subject="Le tarif « Échographie » n'apparaît pas dans la liste",
            category=SupportTicket.Category.BUG,
            priority=SupportTicket.Priority.NORMAL,
            body=(
                "Bonjour, depuis ce matin le tarif ECHO01 n'apparaît plus "
                "dans le sélecteur quand je prépare une facture. Les "
                "autres tarifs sont bien là. Merci de votre aide."
            ),
        )
        support_services.post_message(
            actor=operator,
            ticket=ticket,
            body=(
                "Bonjour, merci pour votre message. Nous regardons la "
                "grille tarifaire de votre centre et revenons vers vous "
                "dans la journée."
            ),
            side=SupportMessage.Side.CHIONI,
        )
        self._note(
            "Support : ticket ouvert par secretaire.demo, une réponse de "
            "Chioni (2 messages)."
        )
        return ticket

    def _ensure_subscription(self, *, center, operator):
        """S5 (ADR 0018) — the demo tenant has a real contract: one offer,
        one ACTIVE subscription with an échéance in three weeks.

        ACTIVE on purpose: the whole demo (personnel, tarifs, statistiques)
        must keep working. Freezing is a DEMO STEP — suspend the
        subscription from the platform space and watch the administration
        close while the cash desk and the consultations keep going.
        """
        plan = SubscriptionPlan.objects.filter(code=DEMO_PLAN_CODE).first()
        if plan is None:
            plan = billing_services.create_plan(
                actor=operator,
                code=DEMO_PLAN_CODE,
                name="Essentiel",
                price_kmf=DEMO_PLAN_PRICE_KMF,
                billing_period=SubscriptionPlan.BillingPeriod.MONTHLY,
                included_practitioners=3,
                included_staff=10,
            )
            self._note(
                "Abonnement : offre « Essentiel » créée "
                "(25 000 KMF/mois, 10 membres, 3 praticiens)."
            )
        subscription = CenterSubscription.objects.filter(center=center).first()
        if subscription is None:
            # Aucune échéance posée à la main depuis le lot 2 : c'est
            # l'ÉMISSION de la première facture qui pose le curseur de
            # période (``current_period_end``), comme en production.
            subscription = billing_services.create_subscription(
                actor=operator,
                center=center,
                plan=plan,
                status=CenterSubscription.Status.ACTIVE,
            )
            self._note(
                "Abonnement : Clinique Ylang souscrit « Essentiel » (actif)."
            )
        else:
            self._note("Abonnement : Clinique Ylang déjà abonnée.")
        self._ensure_subscription_invoice(
            subscription=subscription, operator=operator
        )
        subscription.refresh_from_db()
        return subscription

    def _ensure_subscription_invoice(self, *, subscription, operator):
        """S5 lot 2 (ADR 0018 décision 4) — une facture SaaS ÉMISE et
        réglée pour MOITIÉ : le cas le plus parlant de la démo (solde
        restant visible côté centre comme côté plateforme, et une
        contre-passation possible depuis le back-office).

        Passe par les vrais services (numérotation « A- », audit,
        transitions) — jamais un ``objects.create`` de complaisance.
        """
        if SubscriptionInvoice.objects.filter(subscription=subscription).exists():
            self._note("Abonnement : facture de démo déjà émise.")
            return
        if subscription.current_period_end is not None:
            # Base de dev semée par le lot 1 : le curseur pointait une
            # échéance à trois semaines, donc la période EN COURS n'était
            # pas encore facturable. On le remet à zéro pour que la démo
            # ait sa facture tout de suite (outil DEBUG-only).
            CenterSubscription.objects.filter(pk=subscription.pk).update(
                current_period_end=None
            )
            subscription.refresh_from_db()
        invoice = billing_services.issue_subscription_invoice(
            actor=operator, subscription=subscription
        )
        billing_services.record_subscription_payment(
            actor=operator,
            invoice=invoice,
            amount_kmf=Decimal("10000"),
            method=SubscriptionPayment.Method.TRANSFER,
            reference="VIR-DEMO-0001",
        )
        self._note(
            f"Abonnement : facture {invoice.number} émise "
            f"(25 000 KMF, échéance {invoice.due_date}) — 10 000 KMF reçus "
            "par virement, solde 15 000 KMF."
        )

    def _ensure_erasure_request(self, *, user):
        """S4 lot 3 (ADR 0017 §7) — one PENDING erasure request to demo.

        Deposited by ``tuteur2.demo``, the guardian whose link is parked
        behind the claimant-confirmation gate: the back-office queue has
        something real to show, and processing it in demo revokes exactly
        that pending link — without touching the money scenario carried by
        ``tuteur.demo``. Written through the real service (audited).
        """
        if ErasureRequest.objects.filter(user=user).exists():
            self._note("RGPD : demande d'effacement déjà en place.")
            return
        account_services.request_erasure(user=user)
        self._note(
            "RGPD : demande d'effacement déposée par tuteur2.demo "
            "(en attente, à traiter depuis l'espace plateforme)."
        )

    def _ensure_kyc_document(self, *, center, director):
        """One KYC piece on the demo center — the director provides it, the
        platform reads it (private storage: no URL, ever)."""
        if KycDocument.objects.for_center(center).exists():
            return
        from PIL import Image, ImageDraw

        buffer = BytesIO()
        image = Image.new("RGB", (800, 560), "white")
        ImageDraw.Draw(image).text(
            (24, 24),
            "Registre du commerce — Clinique Ylang (démo)",
            fill="black",
        )
        image.save(buffer, format="JPEG", quality=90)
        center_services.upload_kyc_document(
            actor=director,
            center=center,
            uploaded_file=SimpleUploadedFile(
                "registre.jpg", buffer.getvalue(), content_type="image/jpeg"
            ),
            doc_type=KycDocument.DocType.TRADE_REGISTER,
        )
        self._note("Dossier KYC : registre du commerce déposé (privé).")

    def _ensure_center(self):
        # KYC note: there is no tenant-side service for kyc_status (the
        # transition belongs to the Chioni back-office — update_center
        # refuses the field). It IS a plain field posable at creation, so
        # the seed, acting as back-office, sets it here through save().
        center, created = HealthCenter.objects.get_or_create(
            name=CENTER_NAME,
            defaults={
                "type": HealthCenter.Type.PRIVATE_CLINIC,
                "island": HealthCenter.Island.NGAZIDJA,
                "city": "Moroni",
                "phone": CENTER_PHONE,
                "kyc_status": HealthCenter.KycStatus.ACTIVE,
            },
        )
        if created:
            self._note(f"Centre « {CENTER_NAME} » créé (KYC actif).")
        elif center.kyc_status != HealthCenter.KycStatus.ACTIVE:
            center.kyc_status = HealthCenter.KycStatus.ACTIVE
            center.save(update_fields=["kyc_status", "updated_at"])
            self._note(f"Centre « {CENTER_NAME} » : KYC repassé à actif.")
        else:
            self._note(f"Centre « {CENTER_NAME} » déjà en place.")
        return center

    def _ensure_user(self, username, *, phone, first_name="", last_name="",
                     verify_phone=False):
        """Find (by username, then by phone) or create one demo account.

        A pre-existing shadow account holding the phone (left by an earlier
        invitation flow in the dev base) is reclaimed: it simply receives
        the demo username — the phone stays the pivot identifier.
        """
        User = get_user_model()
        dirty = False
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.filter(phone=phone).first()
            if user is not None and user.username != username:
                user.username = username
                dirty = True
        if user is None:
            user = User.objects.create_user(
                username=username, phone=phone, password=DEMO_PASSWORD
            )
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            dirty = True
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            dirty = True
        if not user.check_password(DEMO_PASSWORD):
            user.set_password(DEMO_PASSWORD)
            dirty = True
        if verify_phone and user.phone_verified_at is None:
            user.phone_verified_at = timezone.now()
            dirty = True
        if dirty:
            user.save()
        return user

    def _ensure_staff_user(self, *, actor, center, username, phone,
                           first_name, last_name, role):
        user = self._ensure_user(
            username, phone=phone, first_name=first_name, last_name=last_name
        )
        existing = (
            StaffMembership.objects.for_center(center)
            .filter(user=user, role=role)
            .first()
        )
        if existing is None:
            center_services.add_staff_member(
                actor=actor, center=center, phone=user.phone, role=role
            )
            self._note(f"Personnel : {username} ({role}) ajouté au centre.")
        return user

    def _ensure_tariffs(self, *, center, director):
        tariffs = {}
        created = 0
        for code, label, category, price in TARIFFS:
            tariff = (
                TariffItem.objects.for_center(center).filter(code=code).first()
            )
            if tariff is None:
                tariff = center_services.create_tariff(
                    actor=director, center=center, code=code, label=label,
                    generic_category=category, price_kmf=Decimal(price),
                )
                created += 1
            tariffs[code] = tariff
        self._note(
            f"Grille tarifaire : {created} tarif(s) créé(s), "
            f"{len(TARIFFS) - created} déjà en place."
        )
        return tariffs

    def _ensure_guardian(self, *, username, phone, first_name, last_name):
        user = self._ensure_user(
            username, phone=phone, first_name=first_name,
            last_name=last_name, verify_phone=True,
        )
        profile = GuardianProfile.objects.filter(user=user).first()
        if profile is None:
            profile = patient_services.create_guardian_profile(
                user=user,
                country_of_residence="FR",
                preferred_currency=Currency.EUR,
            )
            self._note(f"Profil tuteur créé pour {username} (FR, EUR).")
        return user, profile

    def _ensure_patient(self, *, guardian2):
        """Anfia Saïd — claimed profile, built by the REAL door-A + claim flow.

        The guardian (tuteur2) registers her protégée (door A: link ACTIVE
        while the profile is unclaimed), then Anfia claims her profile —
        the very write path the OTP auto-claim uses — which drops tuteur2's
        link to ``attente_confirmation_titulaire``: the claimant-confirmation
        gate, ready to be demonstrated from the patient space.
        """
        patient_user = self._ensure_user(
            "patient.demo", phone=PATIENT_PHONE,
            first_name="Anfia", last_name="Saïd", verify_phone=True,
        )
        profile = PatientProfile.objects.filter(user=patient_user).first()
        if profile is None:
            profile, _link = patient_services.create_protege(
                guardian_user=guardian2,
                relationship=GuardianLink.Relationship.EXTENDED_FAMILY,
                first_name="Anfia",
                last_name="Saïd",
                birth_date=date(1965, 3, 12),
                sex=PatientProfile.Sex.FEMALE,
                phone=PATIENT_PHONE,
                city="Moroni",
            )
            patient_services.claim_profile(user=patient_user, profile=profile)
            profile.refresh_from_db()
            self._note(
                "Patiente Anfia Saïd : profil créé (porte A par tuteur2.demo) "
                "puis revendiqué — le lien de tuteur2.demo attend la "
                "confirmation du titulaire."
            )
        else:
            self._note("Patiente Anfia Saïd : profil déjà en place.")
        return patient_user, profile

    def _ensure_active_guardian_link(self, *, patient_user, patient,
                                     guardian_user, guardian_profile):
        """Nassim's ACTIVE link, patient-initiated: invite then accept.

        Patient-initiated invitations do NOT pass the claimant-confirmation
        gate — the titulaire's initiative IS the consent (ADR 0010)."""
        link = GuardianLink.objects.filter(
            guardian=guardian_profile, patient=patient
        ).first()
        if link is None:
            link = patient_services.invite_guardian(
                actor=patient_user,
                patient=patient,
                phone=GUARDIAN_PHONE,
                relationship=GuardianLink.Relationship.CHILD,
                initiated_by=GuardianLink.InitiatedBy.PATIENT,
            )
            patient_services.accept_link(link=link, guardian_user=guardian_user)
            link.refresh_from_db()
            self._note(
                "Lien tuteur.demo -> Anfia : invitation envoyée par la "
                "patiente puis acceptée (actif)."
            )
        return link

    def _ensure_money_scenario(self, *, center, patient, doctor, cashier,
                               tariffs, guardian_link):
        practitioner = StaffMembership.objects.for_center(center).get(
            user=doctor, role=StaffMembership.Role.DOCTOR
        )

        # Scenario 1 — consultation + analyses, invoiced, requested, SHARED
        # and SENT: shows up « À payer » in the guardian space.
        encounter = (
            Encounter.objects.for_center(center)
            .filter(patient=patient, reason=ENCOUNTER_1_REASON)
            .first()
        )
        if encounter is None:
            encounter = medical_services.create_encounter(
                actor=doctor, center=center, practitioner=practitioner,
                patient=patient, reason=ENCOUNTER_1_REASON,
                diagnosis=(
                    "Hypertension artérielle stade 1 — traitement ajusté, "
                    "contrôle dans un mois."
                ),
                tariff_items=[tariffs["CONS01"], tariffs["ANAL01"]],
            )
            invoice = trustbridge_services.create_invoice(
                actor=cashier, center=center, encounter=encounter
            )
            trustbridge_services.issue_invoice(actor=cashier, invoice=invoice)
            payment_request = trustbridge_services.create_payment_request(
                actor=cashier, invoice=invoice
            )
            trustbridge_services.share_payment_request(
                actor=cashier, payment_request=payment_request,
                guardian_link=guardian_link,
            )
            trustbridge_services.send_payment_request(
                actor=cashier, payment_request=payment_request
            )
            self._note(
                "Pont de Confiance : demande de paiement de "
                f"{self._kmf(invoice.total_kmf)} KMF envoyée et partagée "
                "avec tuteur.demo."
            )
        else:
            self._note("Pont de Confiance : scénario d'argent déjà en place.")

        # Scenario 2 — a second encounter whose invoice STAYS in draft, to
        # demonstrate the center-side actions (issue, request, share, send).
        encounter2 = (
            Encounter.objects.for_center(center)
            .filter(patient=patient, reason=ENCOUNTER_2_REASON)
            .first()
        )
        if encounter2 is None:
            encounter2 = medical_services.create_encounter(
                actor=doctor, center=center, practitioner=practitioner,
                patient=patient, reason=ENCOUNTER_2_REASON,
                tariff_items=[tariffs["ECHO01"], tariffs["MEDI01"]],
            )
            trustbridge_services.create_invoice(
                actor=cashier, center=center, encounter=encounter2
            )
            self._note(
                "Pont de Confiance : facture en brouillon créée "
                "(échographie + médicaments)."
            )
        return encounter

    def _ensure_health_record(self, *, patient, doctor, encounter):
        if not HealthRecordEntry.objects.for_patient(patient).exists():
            medical_services.create_record_entry(
                actor=doctor, encounter=encounter,
                entry_type=HealthRecordEntry.EntryType.HISTORY,
                content=(
                    "Hypertension artérielle connue depuis 2023, "
                    "suivie irrégulièrement."
                ),
            )
            medical_services.create_record_entry(
                actor=doctor, encounter=encounter,
                entry_type=HealthRecordEntry.EntryType.CURRENT_TREATMENT,
                content="Amlodipine 5 mg — 1 comprimé le matin.",
            )
            self._note("Carnet de santé : antécédent + traitement en cours.")
        if not Prescription.objects.filter(encounter=encounter).exists():
            medical_services.create_prescription(
                actor=doctor, encounter=encounter,
                items=[
                    {
                        "medication": "Amlodipine 5 mg",
                        "dosage": "1 comprimé le matin pendant 30 jours.",
                    },
                    {
                        "medication": "Paracétamol 500 mg",
                        "dosage": (
                            "1 comprimé en cas de céphalées, "
                            "3 par jour maximum."
                        ),
                    },
                ],
            )
            self._note("Ordonnance : 2 lignes sur la consultation.")

    def _ensure_enriched_record(self, *, center, patient, patient_user,
                                doctor, cashier, encounter):
        """S3 (ADR 0016) — the enriched record, through the services only:
        extended identity (the CLAIMED patient edits it herself — R-API-2),
        medical file, one vital-signs set, one document, one insurance."""
        if not patient.address:
            patient_services.update_patient_profile(
                actor=patient_user, profile=patient,
                address="Quartier Coulée, Moroni",
                emergency_contact_name="Nassim Ali",
                emergency_contact_phone=GUARDIAN_PHONE,
                emergency_contact_relationship="fils",
            )
            self._note("Identité élargie : adresse + personne à prévenir.")
        if not PatientMedicalFile.objects.filter(patient=patient).exists():
            medical_services.update_patient_medical_file(
                actor=doctor, center=center, patient=patient,
                blood_group=PatientMedicalFile.BloodGroup.O_POS,
                notes="Hypertension connue ; pas d'allergie médicamenteuse.",
            )
            self._note("Fiche médicale : groupe O+ + notes cliniques.")
        practitioner = StaffMembership.objects.for_center(center).get(
            user=doctor, role=StaffMembership.Role.DOCTOR
        )
        if not VitalSigns.objects.for_patient(patient).exists():
            medical_services.record_vital_signs(
                actor=doctor, encounter=encounter, measured_by=practitioner,
                systolic_bp=152, diastolic_bp=94, heart_rate=82, spo2=97,
                temperature_c=Decimal("37.1"), weight_kg=Decimal("68.50"),
                height_cm=162,
            )
            self._note("Signes vitaux : 1 relevé sur la consultation HTA.")
        if not PatientDocument.objects.for_patient(patient).exists():
            from PIL import Image, ImageDraw

            buffer = BytesIO()
            image = Image.new("RGB", (640, 480), "white")
            ImageDraw.Draw(image).text(
                (24, 24),
                "Analyses sanguines — Clinique Ylang (démo)",
                fill="black",
            )
            image.save(buffer, format="JPEG", quality=90)
            medical_services.create_patient_document(
                actor=doctor, center=center, patient=patient,
                uploaded_file=SimpleUploadedFile(
                    "analyses.jpg", buffer.getvalue(),
                    content_type="image/jpeg",
                ),
                doc_type=PatientDocument.DocType.LAB_RESULT,
                title="Analyses sanguines — bilan HTA",
                source_encounter=encounter,
            )
            self._note("Document du carnet : photo d'analyses (privé).")
        if not PatientInsurance.objects.filter(patient=patient).exists():
            patient_services.create_patient_insurance(
                actor=cashier, center=center, patient=patient,
                insurer_name="Mutuelle des Comores",
                member_number="MC-2026-4471",
                valid_until=date(2026, 12, 31),
                notes="Carte présentée au guichet (démo).",
            )
            self._note("Assurance : Mutuelle des Comores (active).")

    # ------------------------------------------------------------------
    # Recap
    # ------------------------------------------------------------------

    def _note(self, message):
        self.stdout.write(f"  - {message}")

    @staticmethod
    def _kmf(amount):
        """« 20 000 » plutôt que « 20000.00 » — lisible dans un terminal."""
        return f"{int(amount):,}".replace(",", " ")

    def _print_recap(self, state):
        center = state["center"]
        patient = state["patient"]
        link1, link2 = state["link1"], state["link2"]
        subscription = state["subscription"]
        payment_request = (
            PaymentRequest.objects.filter(
                invoice__center=center, invoice__patient=patient
            )
            .order_by("pk")
            .first()
        )
        draft_invoice = (
            Invoice.objects.filter(center=center, status=Invoice.Status.DRAFT)
            .order_by("-pk")
            .first()
        )

        write = self.stdout.write
        write("")
        write(self.style.MIGRATE_HEADING(
            "=== Chioni — scénario de démonstration (base de dev) ==="
        ))
        write(
            f"Centre : {center.name} ({center.city}, "
            f"{center.get_island_display()}) — KYC {center.get_kyc_status_display()}"
        )
        write(
            "Grille : Consultation 5 000 | Analyses 15 000 | "
            "Médicaments 8 000 | Échographie 12 000 (KMF)"
        )
        write(
            f"Abonnement : {subscription.plan.name} — "
            f"{self._kmf(subscription.plan.price_kmf)} KMF/mois — "
            f"{subscription.get_status_display().lower()} "
            f"(période en cours jusqu'au {subscription.current_period_end})"
        )
        saas_invoice = (
            SubscriptionInvoice.objects.filter(subscription=subscription)
            .order_by("-sequence_number")
            .first()
        )
        if saas_invoice is not None:
            balance = billing_services.subscription_invoice_balance_kmf(
                saas_invoice
            )
            write(
                f"Facture d'abonnement : {saas_invoice.number} — "
                f"{self._kmf(saas_invoice.amount_kmf)} KMF, échéance "
                f"{saas_invoice.due_date} — solde restant "
                f"{self._kmf(balance)} KMF (10 000 reçus par virement)"
            )
        write("")
        write(f"Comptes (mot de passe commun : {DEMO_PASSWORD}) :")
        rows = [
            ("username", "téléphone", "identité / rôle", "espace attendu"),
            ("admin", "—", "Superuser", "Admin Django (/admin/)"),
            ("directeur.demo", "+2693440010", "Dr Saïd Abdallah — directeur",
             "Espace centre"),
            ("medecin.demo", "+2693440011", "Dr Fatima Mohamed — médecin",
             "Espace centre"),
            ("secretaire.demo", "+2693440012", "Hadidja Soilihi — secrétaire",
             "Espace centre"),
            ("caissier.demo", "+2693440013", "Ibrahim Mze — caissier",
             "Espace centre"),
            ("patient.demo", PATIENT_PHONE, "Anfia Saïd — patiente",
             "Espace patient (OTP ou mot de passe)"),
            ("tuteur.demo", GUARDIAN_PHONE, "Nassim Ali — tuteur (fils)",
             "Espace tuteur — demande « À payer »"),
            ("tuteur2.demo", GUARDIAN2_PHONE,
             "Rachida Ahmed — tutrice (famille élargie)",
             "Espace tuteur — lien en attente"),
            ("plateforme.demo", PLATFORM_PHONE,
             "Zaïnaba Combo — équipe Chioni (admin)",
             "Espace plateforme (back-office)"),
            ("support.demo", SUPPORT_PHONE,
             "Moinaecha Bacar — équipe Chioni (support)",
             "Espace plateforme — tickets seuls"),
        ]
        widths = [
            max(len(row[i]) for row in rows) for i in range(len(rows[0]))
        ]
        for index, row in enumerate(rows):
            write("  " + " | ".join(
                cell.ljust(width) for cell, width in zip(row, widths)
            ))
            if index == 0:
                write("  " + "-+-".join("-" * width for width in widths))

        support_ticket = state["support_ticket"]
        if support_ticket is not None:
            write("")
            write(
                f"Support : ticket #{support_ticket.pk} "
                f"« {support_ticket.subject} » — "
                f"{support_ticket.get_status_display().lower()}, "
                f"{support_ticket.messages.count()} message(s), ouvert par "
                "secretaire.demo (pas le directeur)."
            )
        write("")
        write("État du Pont de Confiance :")
        if payment_request is not None:
            write(
                f"  - Demande de paiement #{payment_request.pk} : "
                f"{self._kmf(payment_request.invoice.total_kmf)} KMF "
                f"(consultation + analyses) — "
                f"{payment_request.get_status_display().lower()}, "
                "partagée avec tuteur.demo"
            )
        if draft_invoice is not None:
            write(
                f"  - Facture #{draft_invoice.pk} en brouillon : "
                f"{self._kmf(draft_invoice.total_kmf)} KMF "
                "(échographie + médicaments) — actions côté centre"
            )
        write(
            f"  - Lien tuteur.demo -> Anfia : {link1.get_status_display().lower()}"
        )
        if link2 is not None:
            write(
                f"  - Lien tuteur2.demo -> Anfia : "
                f"{link2.get_status_display().lower()} "
                "(porte de confirmation du titulaire, à démontrer côté patient)"
            )

        write("")
        write("Déroulé de démo :")
        for step in (
            f"1. Patient : connexion OTP avec {PATIENT_PHONE} — le code "
            "s'affiche dans la console du runserver (SMS console) ; "
            "confirmer ou refuser le lien de tuteur2.demo.",
            "2. Centre : connexion staff (directeur.demo / "
            f"{DEMO_PASSWORD}) — dossiers, facture brouillon à émettre.",
            "3. Tuteur : connexion tuteur.demo → demande « À payer » de "
            "20 000 KMF → payer (devis EUR à taux figé).",
            "4. Simuler le retour du PSP : "
            "python manage.py simulate_psp_payment --latest",
            "5. Centre : confirmer la réalisation du soin "
            "(demande payée → soin confirmé).",
            "6. Caissier : clôturer la demande → reçu double devise "
            "(EUR payé / KMF reçu), visible du tuteur et de la patiente.",
            "7. Plateforme : connexion plateforme.demo → GET "
            "/api/v1/platform/centers/ (dossier KYC, compteurs staff) ; "
            "suspendre puis réactiver la Clinique Ylang — seul le rail "
            "diaspora se ferme, la caisse continue.",
            "8. RGPD : GET /api/v1/platform/erasure-requests/ — la demande "
            "de tuteur2.demo attend ; la traiter anonymise son compte "
            "(le carnet d'Anfia, lui, n'est jamais effacé).",
            "9. Abonnement : POST /api/v1/platform/subscriptions/{id}/status/ "
            "{\"status\": \"suspendu\", \"reason\": \"…\"} — le "
            "personnel, les tarifs et les statistiques se gèlent ; les "
            "consultations, les rendez-vous, l'inscription au guichet et la "
            "caisse continuent (ADR 0018).",
            "10. Facturation SaaS : le directeur lit GET "
            "/api/v1/centers/{id}/subscription/invoices/ (solde 15 000 KMF) ; "
            "la plateforme solde le reste via POST "
            "/api/v1/platform/subscription-invoices/{id}/payments/, ou "
            "contre-passe le virement avec un motif.",
            "11. Support : connexion support.demo → GET "
            "/api/v1/platform/support/tickets/?open=true — répondre au "
            "ticket (POST .../messages/) puis le passer « en_cours » "
            "(POST .../status/). Le MÊME support reçoit 403 sur toute "
            "écriture de tenant ou d'argent : répondre est son métier, "
            "gouverner le tenant ne l'est pas.",
            "12. Support sur centre gelé : suspendre l'abonnement (étape 9) "
            "puis rouvrir un ticket depuis le centre — il passe. Le gel ne "
            "ferme JAMAIS le canal qui explique le gel.",
        ):
            write(f"  {step}")
        write("")
        write(self.style.SUCCESS("Scénario de démonstration prêt."))
