"""Vues des relances — une section par AUDIENCE (ADR 0008 / ADR 0023).

**STAFF du centre, et personne d'autre.**

- **file des impayés** et **journalisation d'une relance d'impayé** :
  rôles **BILLING** — c'est une vue d'argent (noms de patients, soldes),
  même casquette que ``stats/finances``, ``cash-journal`` et
  ``invoices/unpaid/`` depuis S1. Un médecin n'a rien à y faire (miroir de
  la segmentation clinique R-API-1, appliqué à l'argent) ;
- **file des rendez-vous manqués** et **journalisation d'une reprise de
  contact** : **tout membre actif** — c'est de l'exploitation, comme la
  file du jour, et c'est la secrétaire qui rappelle.

PATIENT, TUTEUR, EXPLOITANT PLATEFORME, PHARMACIE : **rien**. Aucune route
de ce module ne vit sous ``/patients/me/``, ``/guardian/``, ``/platform/``
ni ``/pharmacy/``, et la sonde structurelle de
``tests/test_adversarial_s3.py``, étendue par S10, refuse qu'il en
apparaisse une. Le tuteur reçoit son SMS de relance — il ne lit jamais la
file de travail d'un centre.

Sémantique des refus (norme S1) : anonyme → 401 ; centre où l'appelant n'a
aucun membership → 404 (``CenterScopedViewMixin``) ; membre sans le rôle
requis → 403 ; une facture ou un rendez-vous d'un AUTRE centre référencé
dans le CORPS → **400 explicite**, byte-identique pour « étranger » et
« inexistant » (rien à sonder).

**Aucune de ces vues n'est gelable et aucune n'est gardée par le KYC**
(décision transverse) : ``apps.crm`` n'importe pas
``require_center_can_administer`` et ne doit jamais l'importer.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status as http_status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.periods import parse_period
from apps.common.permissions import (
    CenterScopedViewMixin,
    IsStaffOfCenter,
    active_membership_qs,
)
from apps.common.roles import BILLING_ROLES
from apps.crm.models import ContactLog
from apps.crm.serializers import (
    ContactLogCreateSerializer,
    ContactLogSerializer,
    MissedAppointmentFollowupSerializer,
    UnpaidFollowupSerializer,
)
from apps.crm.services import (
    log_contact,
    missed_appointment_rows,
    resolve_center_appointment,
    resolve_center_invoice,
    unpaid_followup_rows,
)


class CenterUnpaidFollowupListView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/crm/unpaid-followups/?ordering= — rôles BILLING.

    La file « à relancer » : les impayés, leur ancienneté, ce que
    l'automate a déjà envoyé, le dernier contact humain et son issue, et un
    **booléen** disant si un proche peut recevoir la relance.

    Volontairement **sans fenêtre de dates** (et c'est un écart assumé à la
    lettre du cahier des charges, consigné dans l'addendum de l'ADR) : un
    impayé est un ÉTAT, pas un événement. Une fenêtre par défaut de 30
    jours ferait disparaître de la file de travail la facture de l'an
    dernier que personne n'a réglée — exactement celle qu'il faut voir. Le
    tri, lui, est borné.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]
    serializer_class = UnpaidFollowupSerializer

    #: ``age`` est l'ancienneté : décroissante = les plus vieilles d'abord.
    _ORDERINGS = {
        "-age": ("created_at", "id"),
        "age": ("-created_at", "id"),
        "-balance": ("-balance_kmf_agg", "id"),
        "balance": ("balance_kmf_agg", "id"),
    }

    def get_queryset(self):
        from rest_framework.exceptions import ValidationError as DrfValidationError

        ordering = self.request.query_params.get("ordering", "-age")
        if ordering not in self._ORDERINGS:
            raise DrfValidationError(
                {"ordering": ["Tri inconnu : -age, age, -balance ou balance."]}
            )
        return unpaid_followup_rows(self.center).order_by(*self._ORDERINGS[ordering])


class CenterMissedAppointmentListView(
    CenterScopedViewMixin, generics.ListAPIView
):
    """GET /centers/{c}/crm/missed-appointments/?from=&to= — TOUT staff actif.

    La file « à recontacter ». Fenêtre de jours locaux inclusifs via le
    contrat partagé ``apps.common.periods`` (30 jours par défaut, 366
    maximum) — jamais réécrit ici.

    ``rebooked`` dit si la personne a déjà repris rendez-vous dans ce
    centre : c'est la même garde que celle de l'automate, rendue visible
    pour qu'on ne rappelle pas quelqu'un qui a déjà fait le geste.
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = MissedAppointmentFollowupSerializer

    def get_queryset(self):
        _from_day, _to_day, start, end = parse_period(self.request)
        return missed_appointment_rows(self.center, start=start, end=end)


class CenterContactLogCreateView(CenterScopedViewMixin, APIView):
    """POST /centers/{c}/crm/contacts/ — journaliser un contact HUMAIN.

    Ouvert à **tout membre actif**, SAUF pour le motif ``relance_impaye``
    qui exige les rôles **BILLING** : la casquette suit l'objet, exactement
    comme les deux files ci-dessus. Le contrôle se fait ici, sur la valeur
    du corps, plutôt que par deux endpoints jumeaux — un seul geste
    (« j'ai appelé »), une seule route.

    Le canal ``sms`` est refusé (400) : personne ne compose de message dans
    Chioni, et journaliser un SMS qu'on n'a pas envoyé fausserait la
    cadence de l'automate.
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = ContactLogCreateSerializer

    @extend_schema(
        request=ContactLogCreateSerializer,
        responses={201: ContactLogSerializer},
    )
    def post(self, request, center_pk):
        serializer = ContactLogCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["kind"] == ContactLog.Kind.UNPAID_REMINDER and not (
            active_membership_qs(
                request.user, center=self.center, roles=BILLING_ROLES
            ).exists()
        ):
            raise PermissionDenied(
                "Le suivi des impayés est réservé aux rôles de facturation."
            )
        invoice = appointment = None
        if data.get("invoice"):
            invoice = resolve_center_invoice(self.center, data["invoice"])
            patient = invoice.patient
        else:
            appointment = resolve_center_appointment(
                self.center, data["appointment"]
            )
            patient = appointment.patient
        contact = log_contact(
            actor=request.user,
            center=self.center,
            patient=patient,
            kind=data["kind"],
            channel=data["channel"],
            recipient=data["recipient"],
            invoice=invoice,
            appointment=appointment,
            outcome=data["outcome"],
        )
        return Response(
            ContactLogSerializer(contact).data,
            status=http_status.HTTP_201_CREATED,
        )
