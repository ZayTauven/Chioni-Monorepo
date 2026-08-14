"""PSP reconciliation for the Chioni back-office (S4, ADR 0017 décision 6).

`GET /platform/reconciliation/` — roles ``support`` AND ``admin`` (read).

ADR 0009 wanted the refused webhooks to be « matière à réconciliation »;
until now that matter was only readable by a Django superuser browsing
``AuditLog``. This view is the operator's incident list: every moment a
guardian may have been debited at the provider without a franc reaching a
center, and every intent that died on the way.

Three sources, all already written by ``trustbridge.services``:

- ``payment.webhook_refused`` — a SUCCESS event landing on something that
  can no longer cash in. FOUR distinct cases, each with its own refs:
  the intent is already failed/cancelled (zombie purge), the request is
  no longer ``envoyee``, the invoice was cancelled, the invoice balance
  moved (counter instalment in between). This row is written OUTSIDE the
  rolled-back transaction on purpose — it is the only trace left ;
- ``payment_intent.cancelled`` — the hourly zombie purge
  (``PSP_INTENT_STALE_HOURS``): a 3DS never completed. With a real PSP
  this is also where a provider-side cancellation is owed (addendum
  ADR 0009) ;
- ``payment_intent.failed`` — the provider reported a failure.

**Invariant of the sprint, materialised here**: this is a TECHNICAL
operations view. Ids, statuses, amounts, timestamps, a refusal code — and
nothing else. Not a patient name, not a guardian name, not a care label,
nothing clinical. The payload is NOT passed through: only the keys of
:data:`INCIDENT_REF_FIELDS` are surfaced, so a future service adding a
richer ref to one of these audit entries cannot leak it here by accident.

The center-side mirror (« votre paiement diaspora a été refusé », for the
center and the guardian) is deliberately NOT built in S4 — it is a
legitimate need, consigned as a vigilance in the ADR.
"""

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError as DrfValidationError

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.common.periods import parse_period
from apps.common.permissions import IsPlatformStaff

#: The THREE audited actions that constitute a payment incident.
INCIDENT_ACTIONS = (
    AuditAction.PAYMENT_WEBHOOK_REFUSED,
    AuditAction.PAYMENT_INTENT_CANCELLED,
    AuditAction.PAYMENT_INTENT_FAILED,
)

#: The ONLY payload keys surfaced by this view — an explicit allow-list,
#: never a passthrough. All are ids, status codes or KMF amounts already
#: stored as strings by the audit contract.
INCIDENT_REF_FIELDS = (
    "intent_id",
    "payment_request_id",
    "invoice_id",
    "intent_status",
    "request_status",
    "intent_kmf",
    "balance_kmf",
)

#: Closed vocabulary of incident codes, derived DETERMINISTICALLY from the
#: action and the refusal refs. This is what ``?reason=`` filters on: the
#: operator reasons in incidents, not in audit action names.
INCIDENT_INTENT_FAILED = "intent_failed"
INCIDENT_INTENT_STALE_CANCELLED = "intent_stale_cancelled"
INCIDENT_WEBHOOK_INVOICE_CANCELLED = "webhook_invoice_cancelled"
INCIDENT_WEBHOOK_BALANCE_CHANGED = "webhook_balance_changed"
INCIDENT_WEBHOOK_REQUEST_NOT_PAYABLE = "webhook_request_not_payable"
INCIDENT_WEBHOOK_INTENT_NOT_PAYABLE = "webhook_intent_not_payable"

#: ``code → Q`` — the filter side of the vocabulary. Kept next to the
#: derivation below so the two can never drift apart (a test asserts that
#: every code filters exactly the rows it labels).
INCIDENT_FILTERS = {
    INCIDENT_INTENT_FAILED: Q(action=AuditAction.PAYMENT_INTENT_FAILED),
    INCIDENT_INTENT_STALE_CANCELLED: Q(
        action=AuditAction.PAYMENT_INTENT_CANCELLED
    ),
    INCIDENT_WEBHOOK_INVOICE_CANCELLED: Q(
        action=AuditAction.PAYMENT_WEBHOOK_REFUSED,
        payload__refusal="invoice_cancelled",
    ),
    INCIDENT_WEBHOOK_BALANCE_CHANGED: Q(
        action=AuditAction.PAYMENT_WEBHOOK_REFUSED,
        payload__refusal="balance_changed",
    ),
    INCIDENT_WEBHOOK_REQUEST_NOT_PAYABLE: Q(
        action=AuditAction.PAYMENT_WEBHOOK_REFUSED,
        payload__has_key="request_status",
    ),
    INCIDENT_WEBHOOK_INTENT_NOT_PAYABLE: (
        Q(action=AuditAction.PAYMENT_WEBHOOK_REFUSED)
        & ~Q(payload__has_key="request_status")
        & ~Q(payload__has_key="refusal")
    ),
}


def incident_code(entry):
    """The incident code of one audit row — pure, no query.

    Mirrors :data:`INCIDENT_FILTERS` exactly. The four webhook refusals
    are told apart by the refs their service put on them: ``refusal``
    (invoice cancelled / balance changed), ``request_status`` (the request
    left ``envoyee``), and by elimination the intent that was already
    failed or cancelled when the success landed.
    """
    if entry.action == AuditAction.PAYMENT_INTENT_FAILED:
        return INCIDENT_INTENT_FAILED
    if entry.action == AuditAction.PAYMENT_INTENT_CANCELLED:
        return INCIDENT_INTENT_STALE_CANCELLED
    payload = entry.payload or {}
    refusal = payload.get("refusal")
    if refusal == "invoice_cancelled":
        return INCIDENT_WEBHOOK_INVOICE_CANCELLED
    if refusal == "balance_changed":
        return INCIDENT_WEBHOOK_BALANCE_CHANGED
    if "request_status" in payload:
        return INCIDENT_WEBHOOK_REQUEST_NOT_PAYABLE
    return INCIDENT_WEBHOOK_INTENT_NOT_PAYABLE


class ReconciliationIncidentSerializer(serializers.ModelSerializer):
    """One payment incident — technical references, nothing else.

    ``center``/``center_name`` are the TENANT (the operator's perimeter by
    definition). ``center`` is null for incidents audited before S4 lot 2:
    the column did not exist and the log is append-only (ADR 0006) — the
    row still shows, honestly, without a tenant.
    """

    center = serializers.IntegerField(source="center_id", read_only=True)
    center_name = serializers.SerializerMethodField()
    incident = serializers.SerializerMethodField()
    refs = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "created_at", "action", "incident",
            "center", "center_name", "refs",
        ]
        read_only_fields = fields

    def get_center_name(self, entry) -> str | None:
        return entry.center.name if entry.center_id else None

    def get_incident(self, entry) -> str:
        return incident_code(entry)

    def get_refs(self, entry) -> dict:
        payload = entry.payload or {}
        return {
            field: payload.get(field)
            for field in INCIDENT_REF_FIELDS
            if field in payload
        }


class PlatformReconciliationView(generics.ListAPIView):
    """GET /platform/reconciliation/?from=&to=&reason=&center= — support+admin.

    Read-only, most recent first, paginated. Filters:

    - ``from``/``to`` — inclusive local Comoros days (shared contract,
      30 j default, 366 max, 400 per field on anything impossible);
    - ``reason`` — one of :data:`INCIDENT_FILTERS`; unknown → 400 per
      field, never a silent « no filter »;
    - ``center`` — a tenant id. Non-numeric → 400 per field; unknown id →
      an empty page (the platform's perimeter IS every center, so there is
      no cross-tenant probe to protect against here).
    """

    # Declared as a class attribute: the structural guard-rail reads
    # ``permission_classes`` and refuses a view that would only override
    # ``get_permissions()`` (it would silently inherit DRF's
    # ``IsAuthenticated`` default — every patient in the country).
    permission_classes = [IsPlatformStaff()]
    serializer_class = ReconciliationIncidentSerializer

    @extend_schema(responses=ReconciliationIncidentSerializer(many=True))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        _from_day, _to_day, start, end = parse_period(self.request)
        qs = (
            AuditLog.objects.filter(
                action__in=INCIDENT_ACTIONS,
                created_at__gte=start,
                created_at__lt=end,
            )
            .select_related("center")
            .order_by("-created_at", "-id")
        )
        params = self.request.query_params
        reason = (params.get("reason") or "").strip()
        if reason:
            if reason not in INCIDENT_FILTERS:
                raise DrfValidationError({"reason": ["Motif d'incident inconnu."]})
            qs = qs.filter(INCIDENT_FILTERS[reason])
        raw_center = (params.get("center") or "").strip()
        if raw_center:
            if not raw_center.isdigit():
                raise DrfValidationError(
                    {"center": ["Identifiant de centre invalide."]}
                )
            qs = qs.filter(center_id=int(raw_center))
        return qs
