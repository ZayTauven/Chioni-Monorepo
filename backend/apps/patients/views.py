"""Patient & guardianship views — one section per AUDIENCE.

Every view declares exactly one hat (permission + queryset helper from
``apps.common.permissions``); a multi-hat user never gains crossed rights
because no queryset here is derived from "any right the user holds".
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError as DrfValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import (
    CenterScopedViewMixin,
    IsGuardian,
    IsPatientSelf,
    IsStaffOfCenter,
    claimed_patient_profile,
    guardian_links_with_scope,
    guardian_profile,
)
from apps.common.phones import normalize_phone
from apps.common.roles import BILLING_ROLES
from apps.medical.models import Consent
from apps.patients.models import GuardianLink, PatientInsurance, PatientProfile
from apps.patients.serializers import (
    CenterClinicalConsentReceiptSerializer,
    CenterClinicalConsentRevokeSerializer,
    CenterClinicalConsentSerializer,
    GuardianInviteSerializer,
    GuardianLinkGuardianSerializer,
    GuardianLinkHistorySerializer,
    GuardianLinkPatientSerializer,
    GuardianLinkStaffRoutingSerializer,
    GuardianProfileSerializer,
    MergeRequestSerializer,
    PatientInsuranceSerializer,
    PatientInsuranceWriteSerializer,
    PatientSelfSerializer,
    PatientStaffCreateSerializer,
    PatientStaffSerializer,
    ProtegeCreateSerializer,
)
from apps.patients.services import (
    _DESK_CLAIMED_REFUSAL,
    accept_link,
    confirm_guardian_link,
    create_guardian_profile,
    create_own_profile,
    create_patient_at_center,
    create_patient_insurance,
    create_protege,
    decline_guardian_link,
    decline_invitation,
    grant_clinical_consent,
    grant_clinical_consent_at_center,
    invite_guardian,
    merge_profiles,
    resolve_desk_consent_link,
    revoke_clinical_consent,
    revoke_clinical_consent_at_center,
    revoke_link,
    update_guardian_profile,
    update_patient_insurance,
    update_patient_profile,
)
from apps.patients.throttling import (
    InviteGuardianPerPhoneThrottle,
    InviteGuardianPerUserThrottle,
)

def center_patients_qs(center):
    """Patients visible to a center: created at its desk or already seen
    there (an encounter anchors the patient into the center's activity).
    Absorbed duplicates are hidden — the registry shows canonical rows."""
    return (
        PatientProfile.objects.filter(
            Q(created_by_center=center) | Q(encounters__center=center)
        )
        .filter(merged_into__isnull=True)
        .distinct()
    )


# ---------------------------------------------------------------------------
# Audience: STAFF of a center (porte C)
# ---------------------------------------------------------------------------


class CenterPatientListCreateView(CenterScopedViewMixin, generics.ListCreateAPIView):
    """GET/POST /centers/{center_pk}/patients/ — desk registry (any staff).

    ``?q=`` searches name/phone. Creation optionally attaches a guardian by
    phone (link ``invitation_envoyee``, initiated_by=centre).
    """

    permission_classes = [IsStaffOfCenter()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PatientStaffCreateSerializer
        return PatientStaffSerializer

    def get_queryset(self):
        qs = center_patients_qs(self.center).order_by("last_name", "first_name")
        query = self.request.query_params.get("q", "").strip()
        if query:
            qs = qs.filter(
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(phone__icontains=query)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        guardian_phone = data.pop("guardian_phone", "")
        guardian_relationship = data.pop("guardian_relationship", None)
        profile, _link = create_patient_at_center(
            actor=request.user,
            center=self.center,
            guardian_phone=guardian_phone or None,
            guardian_relationship=guardian_relationship,
            **data,
        )
        return Response(
            PatientStaffSerializer(profile).data, status=status.HTTP_201_CREATED
        )


class CenterPatientDetailView(CenterScopedViewMixin, generics.RetrieveUpdateAPIView):
    """GET/PATCH /centers/{center_pk}/patients/{pk}/ — scoped: a patient
    never seen by this center answers 404 (cross-tenant IDOR)."""

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PatientStaffSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return center_patients_qs(self.center)

    def perform_update(self, serializer):
        update_patient_profile(
            actor=self.request.user,
            profile=serializer.instance,
            # S4 — the desk edit belongs to THIS tenant's journal (the
            # patient's own edit, from `/patients/me/`, carries no center).
            center=self.center,
            **serializer.validated_data,
        )


class CenterPatientSimilarView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{c}/patients/similar/?last_name=&first_name=&birth_date=&phone=

    S3 (ADR 0016 §2) — duplicate detection at creation time, NON blocking:
    the desk is informed, the desk decides (create anyway, open the
    existing record, or merge). Any staff of the perimeter (same door as
    creation). Candidates come from THIS center's perimeter only.

    Matching rule (deliberately simple): same E.164-normalised phone, OR
    same birth date + approaching last name (``icontains`` — a typo-exact
    engine is out of scope; ``first_name`` refines when provided). At
    least one usable criterion is required (400 per field otherwise).
    Payload = ``PatientStaffSerializer`` (no new data); not audited
    (read of exploitation data, project convention).
    """

    permission_classes = [IsStaffOfCenter()]
    serializer_class = PatientStaffSerializer

    def get_queryset(self):
        params = self.request.query_params
        phone = (params.get("phone") or "").strip()
        last_name = (params.get("last_name") or "").strip()
        first_name = (params.get("first_name") or "").strip()
        raw_birth_date = (params.get("birth_date") or "").strip()

        birth_date = None
        if raw_birth_date:
            try:
                birth_date = parse_date(raw_birth_date)
            except ValueError:
                birth_date = None
            if birth_date is None:
                raise DrfValidationError(
                    {"birth_date": ["Format attendu : AAAA-MM-JJ."]}
                )

        criteria = Q(pk__in=[])
        usable = False
        if phone:
            try:
                normalized = normalize_phone(phone)
            except DjangoValidationError:
                raise DrfValidationError(
                    {"phone": ["Numéro de téléphone invalide."]}
                )
            criteria |= Q(phone=normalized) | Q(phone_alt=normalized)
            usable = True
        if birth_date is not None and last_name:
            name_q = Q(birth_date=birth_date, last_name__icontains=last_name)
            if first_name:
                name_q &= Q(first_name__icontains=first_name)
            criteria |= name_q
            usable = True
        if not usable:
            raise DrfValidationError(
                ["Au moins un critère est requis : téléphone, ou nom + "
                 "date de naissance."]
            )
        return (
            center_patients_qs(self.center)
            .filter(criteria)
            .order_by("last_name", "first_name", "id")
        )


class CenterPatientInsuranceListCreateView(
    CenterScopedViewMixin, generics.ListCreateAPIView
):
    """GET/POST /centers/{c}/patients/{pk}/insurances/ — S3 (ADR 0016 §6).

    Administrative-FINANCIAL data, transversal to centers (ADR 0002): the
    list shows EVERY insurance line of the patient, whatever center typed
    it — an insurance card follows the person. Read: any staff of the
    perimeter; write: billing roles (it is billing data). Patient outside
    this center's perimeter → 404 (URL ref).
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStaffOfCenter(*BILLING_ROLES)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PatientInsuranceWriteSerializer
        return PatientInsuranceSerializer

    def _patient(self):
        return get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )

    def get_queryset(self):
        return PatientInsurance.objects.filter(patient=self._patient())

    def create(self, request, *args, **kwargs):
        patient = self._patient()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        insurance = create_patient_insurance(
            actor=request.user,
            center=self.center,
            patient=patient,
            **serializer.validated_data,
        )
        return Response(
            PatientInsuranceSerializer(insurance).data,
            status=status.HTTP_201_CREATED,
        )


class CenterPatientInsuranceDetailView(
    CenterScopedViewMixin, generics.RetrieveUpdateAPIView
):
    """GET/PATCH /centers/{c}/patients/{pk}/insurances/{insurance_pk}/

    Same audience split as the list (read any staff, write billing).
    Both references travel in the URL: a foreign patient OR an insurance
    line of another patient answers a deterministic 404 (S1 norm).
    """

    lookup_url_kwarg = "insurance_pk"
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsStaffOfCenter(*BILLING_ROLES)()]
        return [IsStaffOfCenter()()]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return PatientInsuranceWriteSerializer
        return PatientInsuranceSerializer

    def get_queryset(self):
        patient = get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )
        return PatientInsurance.objects.filter(patient=patient)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        insurance = self.get_object()
        serializer = PatientInsuranceWriteSerializer(
            insurance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        update_patient_insurance(
            actor=request.user,
            center=self.center,
            insurance=insurance,
            **serializer.validated_data,
        )
        return Response(PatientInsuranceSerializer(insurance).data)


class CenterPatientGuardianLinksView(CenterScopedViewMixin, generics.ListAPIView):
    """GET /centers/{center_pk}/patients/{pk}/guardian-links/ — the ACTIVE
    guardian links of a patient of THIS center, for routing a share.

    Product justification (trou d'API relevé par le frontend) : le partage
    d'une demande de paiement (`POST /centers/{c}/payment-requests/{pk}/share/`)
    exige un ``guardian_link`` que le staff n'avait aucun moyen de connaître.
    C'est le cas Mariama (porte C, patiente sans smartphone) : au guichet, le
    centre doit pouvoir router la demande vers le tuteur qu'ELLE désigne.

    Strict scope: billing roles only; patient resolved through the SAME
    perimeter rule as ``CenterPatientDetailView`` (foreign patient → 404);
    ACTIVE links only (never the history, the revoked, or the pending ones);
    administrative minimum in the payload (no phone, no consent scopes —
    see ``GuardianLinkStaffRoutingSerializer``). This read is not audited
    (project convention: reads never are) — the share ACTION it prepares
    stays fully traced by ``PaymentRequestShare.shared_by`` and the
    ``payment_request.shared`` audit entry.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]
    serializer_class = GuardianLinkStaffRoutingSerializer

    def get_queryset(self):
        patient = get_object_or_404(
            center_patients_qs(self.center), pk=self.kwargs["pk"]
        )
        return (
            GuardianLink.objects.filter(
                patient=patient, status=GuardianLink.Status.ACTIVE
            )
            .select_related("guardian__user")
            .order_by("created_at")
        )


class CenterPatientClinicalConsentView(CenterScopedViewMixin, APIView):
    """POST/DELETE /centers/{c}/patients/{pk}/consents/clinical/ — S2.

    The desk records (POST) or withdraws (DELETE) a clinical consent
    collected on paper or orally — the ONLY consent path for an
    UNCLAIMED patient (audit C.4: nobody could grant `detail_clinique`
    for a porte A/C patient). ADR 0004 addendum documents the model.

    Strict conditions, in refusal order:

    - roles BILLING (the collection happens at the desk);
    - patient in THIS center's perimeter — URL ref → 404 otherwise;
    - patient UNCLAIMED only — a claimed patient manages their own
      consents from their space → explicit 400;
    - ``guardian_link`` (body ref) must be an ACTIVE link of THIS patient
      → one byte-identical 400 for foreign/revoked/non-existent (S1).

    Audited (`consent.granted_by_center` / `consent.revoked_by_center`,
    references only). The claim gate (OTP-1) revokes these consents like
    any other the moment the patient claims their profile.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    def _resolve_patient(self, pk):
        patient = get_object_or_404(center_patients_qs(self.center), pk=pk)
        if patient.is_claimed:
            raise DjangoValidationError(_DESK_CLAIMED_REFUSAL)
        return patient

    @extend_schema(
        request=CenterClinicalConsentSerializer,
        responses=CenterClinicalConsentReceiptSerializer,
    )
    def post(self, request, center_pk, pk):
        patient = self._resolve_patient(pk)
        serializer = CenterClinicalConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = resolve_desk_consent_link(
            patient=patient, link_pk=serializer.validated_data["guardian_link"]
        )
        consent = grant_clinical_consent_at_center(
            actor=request.user,
            center=self.center,
            patient=patient,
            link=link,
            collected_via=serializer.validated_data["collected_via"],
        )
        return Response(
            CenterClinicalConsentReceiptSerializer(consent).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=CenterClinicalConsentRevokeSerializer,
        responses=CenterClinicalConsentReceiptSerializer,
    )
    def delete(self, request, center_pk, pk):
        patient = self._resolve_patient(pk)
        serializer = CenterClinicalConsentRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = resolve_desk_consent_link(
            patient=patient, link_pk=serializer.validated_data["guardian_link"]
        )
        consent = revoke_clinical_consent_at_center(
            actor=request.user, center=self.center, patient=patient, link=link
        )
        return Response(CenterClinicalConsentReceiptSerializer(consent).data)


class CenterPatientMergeView(CenterScopedViewMixin, APIView):
    """POST /centers/{center_pk}/patients/merge/ — absorb a duplicate.

    S1 (arbitrage C.3, défaut PO réversible) : rôles BILLING seulement —
    la fusion est une opération d'administration de dossier au guichet
    (elle déplace des liens de tutelle), pas un geste de soin. Création et
    modification de patient restent ouvertes à tout staff.

    Both profiles must be inside THIS center's perimeter. S1 refusal
    semantics (ADR 0008 addendum): the ids travel in the BODY → an id
    outside the perimeter answers an explicit 400 (same message for
    foreign and non-existent ids — nothing leaks), never a 404.
    """

    permission_classes = [IsStaffOfCenter(*BILLING_ROLES)]

    @extend_schema(request=MergeRequestSerializer, responses=PatientStaffSerializer)
    def post(self, request, center_pk):
        serializer = MergeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scoped = center_patients_qs(self.center)

        def resolve(field):
            profile = scoped.filter(pk=serializer.validated_data[field]).first()
            if profile is None:
                raise DjangoValidationError(
                    "Ce patient n'est pas connu de ce centre : fusion refusée."
                )
            return profile

        source = resolve("source_id")
        target = resolve("target_id")
        canonical = merge_profiles(
            source=source, target=target, actor=request.user, center=self.center
        )
        return Response(PatientStaffSerializer(canonical).data)


# ---------------------------------------------------------------------------
# Audience: the PATIENT themself (porte B)
# ---------------------------------------------------------------------------


class MyPatientProfileView(APIView):
    """GET/POST/PATCH /patients/me/ — my profile.

    POST creates it (porte B, claimed at birth); GET/PATCH require it.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [IsPatientSelf()]

    @extend_schema(responses=PatientSelfSerializer)
    def get(self, request):
        profile = claimed_patient_profile(request.user)
        return Response(PatientSelfSerializer(profile).data)

    @extend_schema(request=PatientSelfSerializer, responses=PatientSelfSerializer)
    def post(self, request):
        serializer = PatientSelfSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = create_own_profile(user=request.user, **serializer.validated_data)
        return Response(
            PatientSelfSerializer(profile).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=PatientSelfSerializer, responses=PatientSelfSerializer)
    def patch(self, request):
        profile = claimed_patient_profile(request.user)
        serializer = PatientSelfSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_patient_profile(
            actor=request.user, profile=profile, **serializer.validated_data
        )
        return Response(PatientSelfSerializer(profile).data)


class MyInsurancesView(generics.ListAPIView):
    """GET /patients/me/insurances/ — my insurance lines, all centers (S3).

    Transversal read (ADR 0002): the rows belong to the patient. Read-only
    from this space in S3 — the desk records the card (billing data)."""

    permission_classes = [IsPatientSelf]
    serializer_class = PatientInsuranceSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return PatientInsurance.objects.filter(patient=profile)


class MyGuardianLinksView(generics.ListAPIView):
    """GET /patients/me/guardians/ — my guardianship links (full history)."""

    permission_classes = [IsPatientSelf]
    serializer_class = GuardianLinkPatientSerializer

    def get_queryset(self):
        profile = claimed_patient_profile(self.request.user)
        return (
            GuardianLink.objects.filter(patient=profile)
            .select_related("guardian__user")
            .order_by("-created_at")
        )


class InviteGuardianView(APIView):
    """POST /patients/me/guardians/invite/ — invite a guardian by phone.

    Throttled on two independent axes (per caller AND per target phone —
    the endpoint sends an SMS to a number typed by the caller, see
    ``apps.patients.throttling``). Door C (desk creation) is deliberately
    NOT throttled: authenticated staff of a KYC-verified center, traced
    responsibility.
    """

    permission_classes = [IsPatientSelf]
    throttle_classes = [InviteGuardianPerUserThrottle, InviteGuardianPerPhoneThrottle]

    @extend_schema(
        request=GuardianInviteSerializer, responses=GuardianLinkPatientSerializer
    )
    def post(self, request):
        serializer = GuardianInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = invite_guardian(
            actor=request.user,
            patient=claimed_patient_profile(request.user),
            phone=serializer.validated_data["phone"],
            relationship=serializer.validated_data["relationship"],
            initiated_by=GuardianLink.InitiatedBy.PATIENT,
        )
        return Response(
            GuardianLinkPatientSerializer(link).data, status=status.HTTP_201_CREATED
        )


class _PatientOwnLinkMixin:
    """Resolve one of MY links or 404 — cross-patient IDOR is invisible."""

    permission_classes = [IsPatientSelf]

    def get_link(self, request, link_pk):
        profile = claimed_patient_profile(request.user)
        return get_object_or_404(
            GuardianLink.objects.filter(patient=profile), pk=link_pk
        )


class PatientRevokeLinkView(_PatientOwnLinkMixin, APIView):
    """POST /patients/me/guardians/{link_pk}/revoke/ — immediate, final."""

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        revoke_link(link=link, actor=request.user)
        return Response(GuardianLinkPatientSerializer(link).data)


class PatientConfirmLinkView(_PatientOwnLinkMixin, APIView):
    """POST /patients/me/guardians/{link_pk}/confirm/ — OTP-1.

    After claiming their profile, the patient confirms a guardianship left
    pending: « Est-ce bien votre proche ? » → the link (re)activates with
    the minimal payments scope only.
    """

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        confirm_guardian_link(patient_user=request.user, link=link)
        return Response(GuardianLinkPatientSerializer(link).data)


class PatientDeclineLinkView(_PatientOwnLinkMixin, APIView):
    """POST /patients/me/guardians/{link_pk}/decline/ — OTP-1.

    The patient refuses a pending guardianship (e.g. a stranger who
    pre-seeded a profile with their phone): the link is revoked, final.
    """

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        decline_guardian_link(patient_user=request.user, link=link)
        return Response(GuardianLinkPatientSerializer(link).data)


class ClinicalConsentView(_PatientOwnLinkMixin, APIView):
    """POST/DELETE /patients/me/guardians/{link_pk}/consents/clinical/

    The PATIENT alone grants (POST) or revokes (DELETE) the
    ``detail_clinique`` scope on one of their active links.
    """

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def post(self, request, link_pk):
        link = self.get_link(request, link_pk)
        grant_clinical_consent(patient_user=request.user, link=link)
        return Response(
            GuardianLinkPatientSerializer(link).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=None, responses=GuardianLinkPatientSerializer)
    def delete(self, request, link_pk):
        link = self.get_link(request, link_pk)
        revoke_clinical_consent(patient_user=request.user, link=link)
        return Response(GuardianLinkPatientSerializer(link).data)


# ---------------------------------------------------------------------------
# Audience: a GUARDIAN (porte A)
# ---------------------------------------------------------------------------


class MyGuardianProfileView(APIView):
    """GET/POST/PATCH /guardian/profile/ — my guardian profile.

    ``IsAuthenticated`` by design (documented exemption of the structural
    guardian test): this endpoint is the space's front desk — it must
    answer « create your profile » to users who have none yet. GET and
    PATCH require the profile to exist (404 otherwise — the same
    information as ``IsGuardian``'s 403, kept consistent with the GET
    contract in place). Field-by-field editability: see
    ``services.update_guardian_profile`` (S2).
    """

    def get_permissions(self):
        return [IsAuthenticated()]

    def _profile_or_404(self, request):
        profile = guardian_profile(request.user)
        if profile is None:
            raise NotFound("Vous n'avez pas encore de profil tuteur.")
        return profile

    @extend_schema(responses=GuardianProfileSerializer)
    def get(self, request):
        profile = self._profile_or_404(request)
        return Response(GuardianProfileSerializer(profile).data)

    @extend_schema(request=GuardianProfileSerializer, responses=GuardianProfileSerializer)
    def post(self, request):
        serializer = GuardianProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = create_guardian_profile(
            user=request.user, **serializer.validated_data
        )
        return Response(
            GuardianProfileSerializer(profile).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=GuardianProfileSerializer, responses=GuardianProfileSerializer)
    def patch(self, request):
        profile = self._profile_or_404(request)
        serializer = GuardianProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        update_guardian_profile(profile=profile, **serializer.validated_data)
        return Response(GuardianProfileSerializer(profile).data)


class ProtegeListCreateView(generics.ListCreateAPIView):
    """GET/POST /guardian/proteges/ — my protégés (administrative view only).

    ``IsGuardian`` (S1): this is a guardian-SPACE endpoint — a brand-new
    guardian with zero links must be able to create their first protégé
    (porte A) and read an empty list. The list queryset still goes through
    ``guardian_links_with_scope`` — the F3 combination (scope × link
    perimeter) — with the minimal payments scope.
    """

    permission_classes = [IsGuardian]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProtegeCreateSerializer
        return GuardianLinkGuardianSerializer

    def get_queryset(self):
        return (
            guardian_links_with_scope(self.request.user, Consent.Scope.PAYMENTS)
            .select_related("patient")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        relationship = data.pop("relationship")
        _profile, link = create_protege(
            guardian_user=request.user, relationship=relationship, **data
        )
        return Response(
            GuardianLinkGuardianSerializer(link).data, status=status.HTTP_201_CREATED
        )


class GuardianInvitationListView(generics.ListAPIView):
    """GET /guardian/invitations/ — links awaiting MY acceptance.

    ``IsGuardian`` (S1): an invitation is not ACTIVE yet, so it carries no
    scope by definition — requiring one would lock a new guardian out of
    their own first invitation.
    """

    permission_classes = [IsGuardian]
    serializer_class = GuardianLinkGuardianSerializer

    def get_queryset(self):
        return (
            GuardianLink.objects.filter(
                guardian=guardian_profile(self.request.user),
                status=GuardianLink.Status.INVITATION_SENT,
            )
            .select_related("patient")
            .order_by("-created_at")
        )


class AcceptInvitationView(APIView):
    """POST /guardian/invitations/{link_pk}/accept/ — open the minimal scope."""

    permission_classes = [IsGuardian]

    @extend_schema(request=None, responses=GuardianLinkGuardianSerializer)
    def post(self, request, link_pk):
        link = get_object_or_404(
            GuardianLink.objects.filter(guardian=guardian_profile(request.user)),
            pk=link_pk,
        )
        accept_link(link=link, guardian_user=request.user)
        return Response(GuardianLinkGuardianSerializer(link).data)


class DeclineInvitationView(APIView):
    """POST /guardian/invitations/{link_pk}/decline/ — refuse the invitation.

    Symmetric of ``accept/``: a link awaiting THIS guardian's acceptance is
    REVOKED (final, consistent with the revoke semantics — a new
    relationship needs a fresh invitation). Someone else's invitation is
    invisible (404); an invitation no longer pending answers 400.
    """

    permission_classes = [IsGuardian]

    @extend_schema(request=None, responses=GuardianLinkGuardianSerializer)
    def post(self, request, link_pk):
        link = get_object_or_404(
            GuardianLink.objects.filter(guardian=guardian_profile(request.user)),
            pk=link_pk,
        )
        decline_invitation(link=link, guardian_user=request.user)
        return Response(GuardianLinkGuardianSerializer(link).data)


class GuardianLinkListView(generics.ListAPIView):
    """GET /guardian/links/ — the guardian's link HISTORY, every status (S2).

    ``IsGuardian`` (space door, S1 norm): this lists the links THEMSELVES
    — lifecycle objects, not scoped data — and a guardian whose last link
    was suspended by the claim gate (`attente_confirmation_titulaire`)
    holds NO active scope, yet is exactly who needs this list: before S2
    their protégé vanished from `/guardian/proteges/` with no explanation.
    The existing `proteges`/`invitations` contracts are untouched — this
    is a separate, additive read.

    Payload: administrative strict minimum (see
    ``GuardianLinkHistorySerializer`` — no phone, no scopes, nothing
    medical).
    """

    permission_classes = [IsGuardian]
    serializer_class = GuardianLinkHistorySerializer

    def get_queryset(self):
        return (
            GuardianLink.objects.filter(
                guardian=guardian_profile(self.request.user)
            )
            .select_related("patient")
            .order_by("-created_at")
        )


class GuardianRevokeLinkView(APIView):
    """POST /guardian/links/{link_pk}/revoke/ — the guardian steps back."""

    permission_classes = [IsGuardian]

    @extend_schema(request=None, responses=GuardianLinkGuardianSerializer)
    def post(self, request, link_pk):
        link = get_object_or_404(
            GuardianLink.objects.filter(guardian=guardian_profile(request.user)),
            pk=link_pk,
        )
        revoke_link(link=link, actor=request.user)
        return Response(GuardianLinkGuardianSerializer(link).data)
