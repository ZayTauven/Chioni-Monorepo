"""The director's audit journal — READ-ONLY (S4, ADR 0017 décision 5).

`GET /centers/{c}/audit-log/` — **DIRECTOR ONLY**. The tenant finally gets
the traceability of its own house (who changed a role, who cancelled an
invoice, who cashed in what, who opened a dispute) without gaining an eye
on its patients' care.

Three rules govern this module, and each is tested:

1. **Whitelist, never blacklist.** :data:`DIRECTOR_JOURNAL_ACTIONS` lists
   the actions a director may read. Anything else — a new action added by
   a future sprint, a clinical action, a consent — is INVISIBLE by
   default. A blacklist would leak every future action until someone
   remembers to add it; the invariant must fail closed.
2. **Nothing clinical, no consent.** ``encounter.*``, ``prescription.*``,
   ``health_record_entry.*``, ``vital_signs.*``, ``patient_document.*``,
   ``patient_medical_file.*``, ``consent.*`` — and, since S6, ``stay.*``
   plus ``bed.assigned``/``bed.released`` — are excluded ON PURPOSE
   (they DO carry a center since S4 — the whitelist is what protects
   them). A non-caring director has no business knowing which patient
   received which care, not even through metadata: the S3 clinical
   segmentation would be hollowed out by a journal line.
3. **References only, never a resolved name** (ADR 0007). The payload is
   rendered as stored — ids, codes, amounts. The single exception is
   ``actor_display``, and it is resolved ONLY for a member of THIS center
   (a name the director already reads in `GET /centers/{c}/staff/`);
   every other actor — a patient, a guardian, a Chioni operator, a system
   job — stays an id, or null.

Period contract: ``?from=&to=`` inclusive local Comoros days, 30 by
default, 366 maximum — the shared ``apps.common.periods`` helper, same as
the piloting stats.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import StaffMembership
from apps.common.periods import parse_period
from apps.common.permissions import CenterScopedViewMixin, IsStaffOfCenter

DIRECTOR = StaffMembership.Role.DIRECTOR


#: THE whitelist (ADR 0017 décision 5). Exploitation only — grouped by
#: family so an addition is a conscious act, not a copy-paste.
DIRECTOR_JOURNAL_ACTIONS = frozenset(
    {
        # Personnel — role changes are the director's own responsibility.
        AuditAction.STAFF_CREATED,
        AuditAction.STAFF_UPDATED,
        AuditAction.STAFF_DEACTIVATED,
        AuditAction.STAFF_REACTIVATED,
        # The tenant itself, and its KYC file (the director may already
        # read the last decision's motive on the center record).
        AuditAction.CENTER_CREATED,
        AuditAction.CENTER_UPDATED,
        AuditAction.CENTER_KYC_CHANGED,
        AuditAction.KYC_DOCUMENT_UPLOADED,
        AuditAction.KYC_DOCUMENT_ARCHIVED,
        # The price grid — money-adjacent configuration.
        AuditAction.TARIFF_CREATED,
        AuditAction.TARIFF_UPDATED,
        # …et la structure physique d'hébergement (S6, ADR 0019 décision 6).
        # Ajout CONSCIENT et strictement limité à la CONFIGURATION : déclarer
        # une chambre ou un lit est de l'exploitation, au même titre qu'un
        # tarif — le directeur répond du parc de son établissement. Les
        # actions de SÉJOUR et d'occupation (``stay.*``, ``bed.assigned``,
        # ``bed.released``) disent quel patient occupe quel lit et combien de
        # temps : c'est clinique, elles restent hors liste (voir
        # ``DIRECTOR_JOURNAL_EXCLUDED``).
        AuditAction.ROOM_CREATED,
        AuditAction.BED_CREATED,
        # …et l'ORGANISATION du travail (S7, ADR 0020 invariant 4). Même
        # ajout conscient, strictement limité à la CONFIGURATION : déclarer
        # un service, une fonction ou un jour férié est de l'exploitation,
        # au même titre qu'un tarif. Les LIBELLÉS n'y sont jamais (les
        # payloads ne portent que des ids) et tout ce qui décrit une
        # PERSONNE — dossier RH, feuille de présence, justificatifs —
        # reste hors liste (voir ``DIRECTOR_JOURNAL_EXCLUDED``).
        AuditAction.HRM_DEPARTMENT_CREATED,
        AuditAction.HRM_DEPARTMENT_UPDATED,
        AuditAction.HRM_JOB_TITLE_CREATED,
        AuditAction.HRM_JOB_TITLE_UPDATED,
        AuditAction.HOLIDAY_CREATED,
        AuditAction.HOLIDAY_DELETED,
        # Les congés : demande et décision. C'est l'exploitation dont le
        # directeur répond (il décide), et le payload ne porte **jamais le
        # type** — seulement des ids, un nombre de journées et un code de
        # statut (ADR 0020 invariant 4 : un motif de congé est de la même
        # classe qu'un diagnostic).
        AuditAction.LEAVE_REQUESTED,
        AuditAction.LEAVE_DECIDED,
        # The SaaS subscription of THIS center (S5, ADR 0018 invariant 6).
        # A conscious addition: opening a contract, changing an offer or
        # freezing the administration are exploitation events of his own
        # center — the director must be able to see when, and by whom.
        # The motive of a freeze is NOT here (payloads carry
        # ``has_reason``); he reads it on `GET /centers/{c}/subscription/`.
        # ``subscription_plan.*`` (the offer catalogue) is transverse and
        # deliberately absent: it belongs to no tenant.
        AuditAction.SUBSCRIPTION_CREATED,
        AuditAction.SUBSCRIPTION_PLAN_CHANGED,
        AuditAction.SUBSCRIPTION_STATUS_CHANGED,
        # …et sa facturation (S5 lot 2). C'est l'argent de SON centre :
        # ce que Chioni lui a facturé, ce qu'elle a enregistré comme reçu,
        # ce qu'elle a annulé ou contre-passé. Les motifs n'y sont jamais
        # (payloads ``has_reason``) — ils se lisent sur la facture.
        AuditAction.SUBSCRIPTION_INVOICE_ISSUED,
        AuditAction.SUBSCRIPTION_INVOICE_CANCELLED,
        AuditAction.SUBSCRIPTION_PAYMENT_RECORDED,
        AuditAction.SUBSCRIPTION_PAYMENT_REVERSED,
        # …et le canal de support de SON centre (S5 lot 3, ADR 0018
        # invariant 6). Ajout CONSCIENT : savoir que sa secrétaire a
        # signalé une anomalie et où en est le dossier est de
        # l'exploitation. Le CONTENU n'y est jamais (les payloads ne
        # portent que des ids, la catégorie et les codes de statut) — le
        # directeur lit le fil sur `GET /centers/{c}/support/tickets/`,
        # dans le périmètre de lecture qui est le sien.
        AuditAction.SUPPORT_TICKET_OPENED,
        AuditAction.SUPPORT_TICKET_STATUS_CHANGED,
        AuditAction.SUPPORT_MESSAGE_POSTED,
        AuditAction.SUPPORT_ATTACHMENT_UPLOADED,
        # Invoicing and the diaspora payment request lifecycle.
        AuditAction.INVOICE_CREATED,
        AuditAction.INVOICE_ISSUED,
        AuditAction.INVOICE_CANCELLED,
        AuditAction.PAYMENT_REQUEST_CREATED,
        AuditAction.PAYMENT_REQUEST_SENT,
        AuditAction.PAYMENT_REQUEST_SHARED,
        AuditAction.PAYMENT_REQUEST_UNSHARED,
        AuditAction.CARE_CONFIRMED,
        AuditAction.PATIENT_CARE_ACKNOWLEDGED,
        AuditAction.PAYMENT_REQUEST_CLOSED,
        # Money in, on both rails. ``payment.webhook_refused`` is here as
        # a MONEY action of this center's own invoices (« paiements » in
        # the ADR's enumeration) — it is not the deferred « miroir côté
        # centre », which is an explained screen/notification for the
        # center and the guardian and stays out of S4.
        AuditAction.PAYMENT_INTENT_CREATED,
        AuditAction.PAYMENT_INTENT_FAILED,
        AuditAction.PAYMENT_INTENT_CANCELLED,
        AuditAction.PAYMENT_WEBHOOK_REFUSED,
        AuditAction.PAYMENT_RECORDED,
        AuditAction.CASH_PAYMENT_RECORDED,
        AuditAction.CASH_PAYMENT_REVERSED,
        # Disagreements about money.
        AuditAction.DISPUTE_OPENED,
        AuditAction.DISPUTE_RESOLVED,
        # Record administration at the desk: a merge MOVES guardianship
        # links and reunites a carnet — the director answers for it.
        AuditAction.PATIENT_MERGED,
    }
)

#: Deliberately ABSENT, and why — kept as executable documentation so the
#: exclusion test names what it protects (the constant itself is never
#: used to filter: the whitelist above is the only gate).
DIRECTOR_JOURNAL_EXCLUDED = frozenset(
    {
        # Clinical sphere (S3 segmentation) — never, at any granularity.
        AuditAction.ENCOUNTER_CREATED,
        AuditAction.ENCOUNTER_CLOSED,
        AuditAction.PRESCRIPTION_CREATED,
        AuditAction.RECORD_ENTRY_CREATED,
        AuditAction.VITAL_SIGNS_RECORDED,
        AuditAction.PATIENT_DOCUMENT_CREATED,
        AuditAction.PATIENT_DOCUMENT_ARCHIVED,
        AuditAction.PATIENT_MEDICAL_FILE_UPDATED,
        # Hospitalisation (S6, ADR 0019 décision 6) — l'inverse exact de
        # ``room.created``/``bed.created``, qui sont dans la liste blanche :
        # une admission, une sortie, une annulation, une assignation de lit
        # et des journées facturées disent QUEL PATIENT occupe QUEL LIT et
        # COMBIEN DE TEMPS. C'est la donnée la plus lourde du carnet (« a-t-il
        # été hospitalisé, et combien de jours ? ») : un directeur non
        # soignant n'a pas à la lire, fût-ce en métadonnée.
        AuditAction.STAY_ADMITTED,
        AuditAction.STAY_DISCHARGED,
        AuditAction.STAY_CANCELLED,
        AuditAction.STAY_DAYS_BILLED,
        AuditAction.BED_ASSIGNED,
        AuditAction.BED_RELEASED,
        # RH (S7, ADR 0020 invariant 4) — le miroir exact de
        # ``hrm_department.*`` / ``holiday.*``, qui sont dans la liste
        # blanche : ces cinq-là décrivent une PERSONNE, pas une
        # organisation.
        #
        # ``attendance.recorded`` est nommément exclue par l'ADR : la
        # volumétrie est quotidienne, et un journal daté « qui était absent
        # quel jour » serait un instrument de surveillance individuelle —
        # exactement ce que l'arbitrage PO n° 2 refuse d'inventer. Le
        # directeur lit la feuille elle-même (`hrm/attendance/`), qui est
        # son outil ; il n'a pas besoin d'un second registre horodaté des
        # corrections.
        #
        # ``employment.*`` et ``leave.cancelled`` ne sont pas dans
        # l'énumération de l'ADR, et la liste blanche est fail-closed : ils
        # restent dehors. Précédent ``patient_profile.created`` — le
        # registre lui-même est lisible par sa propre route, une trace
        # datée « qui a ouvert le dossier de qui » est un objet différent
        # et plus intrusif. Réouvrable sur demande.
        #
        # Les deux actions de justificatif sont les plus sensibles du
        # module : un journal disant « telle personne a déposé une pièce ce
        # jour-là » est un signal sur sa santé, alors même que le type du
        # congé n'y figure pas.
        AuditAction.ATTENDANCE_RECORDED,
        AuditAction.EMPLOYMENT_CREATED,
        AuditAction.EMPLOYMENT_UPDATED,
        AuditAction.LEAVE_CANCELLED,
        AuditAction.LEAVE_DOCUMENT_UPLOADED,
        AuditAction.LEAVE_DOCUMENT_ARCHIVED,
        # Consents — who opened what to whom is between the patient and
        # their guardian; the desk records them, the director does not
        # supervise them.
        AuditAction.CONSENT_GRANTED,
        AuditAction.CONSENT_REVOKED,
        AuditAction.CONSENT_GRANTED_BY_CENTER,
        AuditAction.CONSENT_REVOKED_BY_CENTER,
        # Individual record-keeping and guardianship: not named by the
        # ADR's exploitation list. The registry itself is readable at
        # `/centers/{c}/patients/` — a dated « who registered whom »
        # trail is a different, more intrusive object. Reopen on demand.
        AuditAction.PATIENT_CREATED,
        AuditAction.PATIENT_UPDATED,
        AuditAction.PATIENT_INSURANCE_CREATED,
        AuditAction.PATIENT_INSURANCE_UPDATED,
    }
)


class AuditLogEntrySerializer(serializers.ModelSerializer):
    """One journal line — references only (ADR 0007).

    ``payload`` is rendered AS STORED: the audit contract already forbids
    PII and clinical text in it, and the whitelist keeps clinical actions
    out entirely. ``target_type`` is the ``app_label.model`` of the
    generic target (a code, never a URL), so the frontend can label the
    line without a second call.
    """

    actor = serializers.IntegerField(source="actor_id", read_only=True)
    actor_display = serializers.SerializerMethodField()
    target_type = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "created_at", "action", "actor", "actor_display",
            "target_type", "object_id", "payload",
        ]
        read_only_fields = fields

    def get_actor_display(self, entry) -> str | None:
        """A name ONLY for a member of this center — else ``null``.

        The map is built once per page by the view from the center's
        memberships (active or not: a deactivated member's past actions
        must stay readable). A patient, a guardian, a Chioni operator or a
        system job is never named here: the director would be reading an
        identity they have no other way to see.
        """
        return (self.context.get("actor_names") or {}).get(entry.actor_id)

    def get_target_type(self, entry) -> str | None:
        content_type = entry.content_type
        if content_type is None:
            return None
        return f"{content_type.app_label}.{content_type.model}"


class CenterAuditLogView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/audit-log/?action=&from=&to= — DIRECTOR ONLY.

    Not « any billing role »: the journal aggregates personnel decisions,
    money and dispute history. It is the tenant's own accountability tool,
    and accountability has one holder.

    Refusals: foreign center → 404 (queryset scoping, unchanged) ; member
    without the director hat → 403 ; ``?action=`` outside the whitelist →
    400 ``{"action": ["Action inconnue."]}`` — the SAME message for a typo
    and for a deliberately excluded clinical action (no oracle telling the
    director what exists but is hidden).
    """

    permission_classes = [IsStaffOfCenter(DIRECTOR)]
    serializer_class = AuditLogEntrySerializer

    def get_queryset(self):
        _from_day, _to_day, start, end = parse_period(self.request)
        qs = (
            AuditLog.objects.filter(
                center=self.center,
                action__in=DIRECTOR_JOURNAL_ACTIONS,
                created_at__gte=start,
                created_at__lt=end,
            )
            .select_related("content_type")
            .order_by("-created_at", "-id")
        )
        action = (self.request.query_params.get("action") or "").strip()
        if action:
            if action not in DIRECTOR_JOURNAL_ACTIONS:
                raise DrfValidationError({"action": ["Action inconnue."]})
            qs = qs.filter(action=action)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["actor_names"] = getattr(self, "_actor_names", {})
        return context

    def _resolve_actor_names(self, page):
        """Names for the actors of THIS page that are staff of THIS center.

        ONE extra query per page, and structurally leak-free: the source
        is ``StaffMembership.for_center(self.center)`` — an actor outside
        it simply has no entry in the map.
        """
        actor_ids = {entry.actor_id for entry in page if entry.actor_id}
        if not actor_ids:
            return {}
        rows = (
            StaffMembership.objects.for_center(self.center)
            .filter(user_id__in=actor_ids)
            .select_related("user")
        )
        names = {}
        for membership in rows:
            user = membership.user
            names[user.pk] = (
                f"{user.first_name} {user.last_name}".strip() or user.username
            )
        return names

    @extend_schema(responses=AuditLogEntrySerializer(many=True))
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        rows = page if page is not None else list(queryset)
        # Resolved BEFORE serialisation: the serializer reads the map from
        # its context, so the whole page costs one query, never one per row.
        self._actor_names = self._resolve_actor_names(rows)
        serializer = self.get_serializer(rows, many=True)
        response = (
            self.get_paginated_response(serializer.data)
            if page is not None
            else Response({"results": serializer.data})
        )
        # Honesty about the gap (ADR 0017 décision 5): entries written
        # before S4 lot 2 carry no center and can never be back-filled
        # (append-only, ORM + DB trigger). The journal says where it
        # starts instead of pretending to be complete.
        first = (
            AuditLog.objects.filter(center=self.center)
            .order_by("created_at", "id")
            .values_list("created_at", flat=True)
            .first()
        )
        response.data["journal_starts_at"] = first
        return response
