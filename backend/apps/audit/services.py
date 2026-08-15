"""Audit service — the ONE entry point for journalising sensitive actions.

Every service touching money, medical data, consents, patient identity or
staff roles MUST call :func:`audit` (finding M1: the AuditLog existed but
nothing wrote to it). Views never call ``AuditLog.log`` directly — they go
through the domain services, which audit as part of the same transaction.

ADR 0007 — payload contract: identifiers and references ONLY (pks, codes,
counts, amounts as strings). NEVER a name, a phone number, a diagnosis or
any other PII/clinical text: the payload must stay meaningful after the
actor's account is anonymised, and must never leak medical secrets to
whoever reads the log. A light structural guard below rejects non-scalar
values so nobody can dump a model instance "for convenience".
"""

from decimal import Decimal

from apps.audit.models import AuditLog
from apps.centers.models import HealthCenter

#: Value types allowed inside an audit payload (scalars only — ADR 0007).
_SCALAR_TYPES = (str, int, bool, float, Decimal, type(None))


class AuditAction:
    """Catalogue of audited actions — use these constants, never raw strings.

    Keeping the catalogue closed makes the audit trail queryable and lets
    tests assert exhaustively that each sensitive service writes its entry.
    """

    # Authentication — phone + OTP SMS (ADR 0010). Payload contract: NEVER
    # the code, NEVER a clear phone number. Reference the user when one
    # exists; otherwise `phone_ref` (keyed pseudonymous hash) correlates
    # entries without storing PII (ADR 0007).
    OTP_REQUESTED = "auth.otp_requested"
    OTP_VERIFIED = "auth.otp_verified"
    OTP_FAILED = "auth.otp_failed"
    ACCOUNT_CREATED = "auth.account_created"
    ACCOUNT_ACTIVATED = "auth.account_activated"

    # RGPD — right to erasure (S4 lot 3, ADR 0007 implemented by ADR 0017
    # décision 7). Payload contract, stricter than usual: references and
    # BOOLEANS only. The refusal motive is free operator text written FOR
    # the person concerned — it lives on the ``ErasureRequest`` row and is
    # rendered to them, NEVER journalised (same class as a dispute reason).
    # Counts of anonymised objects are fine; a name, a phone, an old
    # username or an e-mail would defeat the whole point of the action.
    ERASURE_REQUESTED = "erasure.requested"
    ERASURE_PROCESSED = "erasure.processed"
    ERASURE_REFUSED = "erasure.refused"
    USER_ANONYMIZED = "user.anonymized"

    # Patient identity
    PATIENT_CREATED = "patient_profile.created"
    PATIENT_CLAIMED = "patient_profile.claimed"
    PATIENT_MERGED = "patient_profile.merged"
    PATIENT_UPDATED = "patient_profile.updated"

    # Guardianship
    LINK_CREATED = "guardian_link.created"
    LINK_ACCEPTED = "guardian_link.accepted"
    LINK_REVOKED = "guardian_link.revoked"
    # OTP-1 — a claim suspends every surviving link until the patient
    # confirms (or declines) it; the declarative phone never opens a live
    # link without the titulaire's explicit consent.
    LINK_PENDING_CONFIRMATION = "guardian_link.pending_confirmation"
    LINK_CONFIRMED = "guardian_link.confirmed"
    LINK_DECLINED = "guardian_link.declined"

    # Consents
    CONSENT_GRANTED = "consent.granted"
    CONSENT_REVOKED = "consent.revoked"
    # S2 (ADR 0004 addendum) — clinical consent collected AT THE DESK for
    # an UNCLAIMED patient (paper form or orally, porte C). Payload:
    # references + the collection mode code only — never any content.
    CONSENT_GRANTED_BY_CENTER = "consent.granted_by_center"
    CONSENT_REVOKED_BY_CENTER = "consent.revoked_by_center"

    # Center staff & money-adjacent configuration
    STAFF_CREATED = "staff.membership_created"
    STAFF_DEACTIVATED = "staff.membership_deactivated"
    # Role change and/or shadow-account identity edit by the director
    # (payload refs: old_role/role + comma-joined changed fields).
    STAFF_UPDATED = "staff.membership_updated"
    # Reactivation of a deactivated membership (director only, S1) — the
    # symmetric of STAFF_DEACTIVATED; the row is unique per
    # (user, center, role) so reactivating can never create a duplicate.
    STAFF_REACTIVATED = "staff.membership_reactivated"
    CENTER_UPDATED = "center.updated"
    TARIFF_CREATED = "tariff.created"
    TARIFF_UPDATED = "tariff.updated"

    # Tenant lifecycle, driven by the Chioni platform (S4, ADR 0017).
    # Payload contract: references and STATUS CODES only — the KYC decision
    # motive (free text typed by an operator) lives on the HealthCenter row,
    # NEVER in this payload (same class as a dispute or cancellation reason).
    CENTER_CREATED = "center.created"
    CENTER_KYC_CHANGED = "center.kyc_changed"
    KYC_DOCUMENT_UPLOADED = "kyc_document.uploaded"
    KYC_DOCUMENT_ARCHIVED = "kyc_document.archived"

    # Abonnement SaaS Chioni → centre (S5, ADR 0018 décisions 2 & 3).
    # Payload contract: references, status codes and the plan's price ONLY.
    # The MOTIVE of a suspension/termination is free operator text: it
    # lives on the ``CenterSubscription`` row (read by the platform and by
    # the director of the center concerned) and NEVER in this payload —
    # same rule as ``kyc_reason`` and ``Invoice.cancel_reason``.
    #
    # The three ``subscription.*`` actions carry their ``center`` and ARE
    # whitelisted in the director's journal (ADR 0018 invariant 6): a
    # change of plan or a suspension is an exploitation event of his own
    # center, and he answers for it. The two ``subscription_plan.*`` ones
    # are platform-wide (``center=None``) — they concern the offer
    # catalogue, not a tenant, so no journal ever shows them.
    SUBSCRIPTION_PLAN_CREATED = "subscription_plan.created"
    SUBSCRIPTION_PLAN_UPDATED = "subscription_plan.updated"
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_PLAN_CHANGED = "subscription.plan_changed"
    SUBSCRIPTION_STATUS_CHANGED = "subscription.status_changed"

    # Facturation SaaS Chioni → centre (S5 lot 2, ADR 0018 décision 4).
    # Registre SÉPARÉ du ledger des soins : ces quatre actions ne décrivent
    # JAMAIS l'argent d'un patient. Payload: references, amounts, currency,
    # status codes — **jamais** le motif d'une annulation ni celui d'une
    # contre-passation (ils vivent sur la ligne, lus par Chioni et par le
    # directeur du centre concerné). Les quatre portent leur ``center`` et
    # sont dans la liste blanche du journal du directeur : c'est l'argent de
    # SON centre, il doit le voir.
    SUBSCRIPTION_INVOICE_ISSUED = "subscription_invoice.issued"
    SUBSCRIPTION_INVOICE_CANCELLED = "subscription_invoice.cancelled"
    SUBSCRIPTION_PAYMENT_RECORDED = "subscription_payment.recorded"
    SUBSCRIPTION_PAYMENT_REVERSED = "subscription_payment.reversed"

    # Module Support centre → Chioni (S5 lot 3, ADR 0018 décision 5).
    # Payload contract, and it is THE parade (b) of the décision: **jamais
    # le contenu**. Ni l'objet du ticket, ni le corps d'un message, ni un
    # nom de fichier — seulement des ids, le code de catégorie, les codes
    # de statut et le côté (« centre » / « chioni »). Un ticket est du
    # texte libre écrit par un humain pressé : s'il y glisse une donnée
    # patient, elle ne doit surtout pas être recopiée dans le journal
    # immuable que le directeur du centre lit.
    # Les quatre portent leur ``center`` et sont dans la liste blanche du
    # journal du directeur : ce sont les demandes de SON centre.
    SUPPORT_TICKET_OPENED = "support_ticket.opened"
    SUPPORT_TICKET_STATUS_CHANGED = "support_ticket.status_changed"
    SUPPORT_MESSAGE_POSTED = "support_ticket.message_posted"
    SUPPORT_ATTACHMENT_UPLOADED = "support_ticket.attachment_uploaded"

    # Équipe Chioni elle-même (S5 lot 3, ADR 0018 décision 6) — la 4ᵉ
    # casquette se gère désormais par API auditée, l'admin Django est
    # refermé. Actions TRANSVERSES (``center=None``) : elles ne concernent
    # aucun tenant, donc aucun journal de directeur ne les montre.
    PLATFORM_STAFF_CREATED = "platform_staff.created"
    PLATFORM_STAFF_UPDATED = "platform_staff.updated"

    # Patient administrative-financial data (S3, ADR 0016) — payloads:
    # ids and comma-joined FIELD NAMES only, never an insurer name or a
    # member number.
    PATIENT_INSURANCE_CREATED = "patient_insurance.created"
    PATIENT_INSURANCE_UPDATED = "patient_insurance.updated"

    # Medical data production
    ENCOUNTER_CREATED = "encounter.created"
    # Closure of a consultation (clinical roles, S1) : « terminee » —
    # a closed encounter refuses new prescriptions and record entries.
    ENCOUNTER_CLOSED = "encounter.closed"
    PRESCRIPTION_CREATED = "prescription.created"
    RECORD_ENTRY_CREATED = "health_record_entry.created"
    # S3 (ADR 0016) — enriched patient record. Payload contract: ids,
    # doc_type codes and FIELD NAMES only — NEVER a measured value, a
    # document title, a blood group or any clinical text (ADR 0007).
    PATIENT_MEDICAL_FILE_UPDATED = "patient_medical_file.updated"
    VITAL_SIGNS_RECORDED = "vital_signs.recorded"
    PATIENT_DOCUMENT_CREATED = "patient_document.created"
    PATIENT_DOCUMENT_ARCHIVED = "patient_document.archived"

    # Trust Bridge — money (phase B). Payloads: references, amounts and
    # currencies ONLY — never an act label (ADR 0005/0007).
    INVOICE_CREATED = "invoice.created"
    INVOICE_ISSUED = "invoice.issued"
    # Cancellation of a DRAFT/ISSUED invoice without any active cash-in
    # (S1, ADR 0015 addendum). Payload: references only — the mandatory
    # cancellation reason lives on the Invoice row, NEVER in this payload.
    INVOICE_CANCELLED = "invoice.cancelled"
    PAYMENT_REQUEST_CREATED = "payment_request.created"
    PAYMENT_REQUEST_SENT = "payment_request.sent"
    PAYMENT_REQUEST_SHARED = "payment_request.shared"
    PAYMENT_REQUEST_UNSHARED = "payment_request.unshared"
    PAYMENT_INTENT_CREATED = "payment_intent.created"
    PAYMENT_INTENT_FAILED = "payment_intent.failed"
    # Zombie intents purge (ADR 0009 addendum) — system actor, reason ref.
    PAYMENT_INTENT_CANCELLED = "payment_intent.cancelled"
    # A SUCCESS webhook refused because the intent/request can no longer
    # cash in (late webhook after purge, dispute, double payment attempt):
    # the provider may have really debited — this row is the reconciliation
    # evidence (references + statuses only, written OUTSIDE the rolled-back
    # transaction).
    PAYMENT_WEBHOOK_REFUSED = "payment.webhook_refused"
    PAYMENT_RECORDED = "payment.recorded"
    # Caisse du centre (ADR 0015) — counter cash-ins and their reversals.
    # Payload contract: references and amounts only — NEVER the reversal
    # reason text (free text stays visible to the center, not in the log).
    CASH_PAYMENT_RECORDED = "cash_payment.recorded"
    CASH_PAYMENT_REVERSED = "cash_payment.reversed"
    CARE_CONFIRMED = "payment_request.care_confirmed"
    PATIENT_CARE_ACKNOWLEDGED = "payment_request.patient_acknowledged"
    PAYMENT_REQUEST_CLOSED = "payment_request.closed"
    DISPUTE_OPENED = "dispute.opened"
    DISPUTE_RESOLVED = "dispute.resolved"


def audit(*, actor, action, target=None, center=None, **refs):
    """Write one immutable audit entry.

    ``actor``  — the ``User`` performing the action (None for system jobs).
    ``action`` — a constant from :class:`AuditAction`.
    ``target`` — optional model instance the action applies to.
    ``center`` — the ``HealthCenter`` the action belongs to, or None
                 (S4 — ADR 0017 décision 5). It is a COLUMN, not a payload
                 key: it is the only reference the director's journal
                 filters on and it must be indexable. Passing anything else
                 than a ``HealthCenter``/None is refused here rather than
                 deep inside the ORM, in the same spirit as the payload
                 guard below.
    ``refs``   — scalar references only (pks, codes, counts). Values are
                 normalised to JSON-safe scalars; anything richer is refused
                 so PII/clinical payloads cannot happen by accident.
    """
    if center is not None and not isinstance(center, HealthCenter):
        raise TypeError(
            "AuditLog «center» must be a HealthCenter instance or None "
            f"(got {type(center).__name__}) — it is a column, not a payload "
            "reference."
        )
    payload = {}
    for key, value in refs.items():
        if not isinstance(value, _SCALAR_TYPES):
            raise TypeError(
                f"AuditLog payload «{key}» must be a scalar reference "
                f"(got {type(value).__name__}) — ADR 0007: identifiers only, "
                "never objects, PII or clinical data."
            )
        payload[key] = str(value) if isinstance(value, Decimal) else value
    return AuditLog.log(
        actor=actor, action=action, target=target, center=center, **payload
    )
