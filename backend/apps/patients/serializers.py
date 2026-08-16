"""Patient & guardianship serializers — ONE serializer PER AUDIENCE.

The same PatientProfile is seen through three different windows; mixing
them is how medical secrecy dies. Explicit fields everywhere — never
``fields = "__all__"`` on these models.

Audiences:

- ``PatientStaffSerializer``      → staff of a center (desk registry).
- ``PatientSelfSerializer``       → the patient about themself.
- ``PatientGuardianSerializer``   → a guardian about a protégé: STRICTLY
  administrative (name, claim status). No birth date, no phone, no city,
  and obviously nothing clinical — the payments scope will add amounts and
  generic act natures in phase B, never identity details.
"""

from rest_framework import serializers

from apps.medical.models import Consent
from apps.patients.models import (
    CONTACT_PREFERENCE_FIELDS,
    GuardianLink,
    GuardianProfile,
    PatientContactPreference,
    PatientInsurance,
    PatientProfile,
)

# ---------------------------------------------------------------------------
# Audience: staff of a center (porte C)
# ---------------------------------------------------------------------------


#: S3 (ADR 0016 §1) — extended ADMINISTRATIVE identity, shared verbatim by
#: the staff and self serializers. NEVER added to
#: ``PatientGuardianSerializer`` (frozen by a negative field test).
EXTENDED_IDENTITY_FIELDS = [
    "address", "phone_alt", "national_id",
    "emergency_contact_name", "emergency_contact_phone",
    "emergency_contact_relationship",
]


class PatientStaffSerializer(serializers.ModelSerializer):
    """Desk registry view — identity needed to receive and bill a patient."""

    class Meta:
        model = PatientProfile
        fields = [
            "id", "first_name", "last_name", "birth_date", "sex",
            "phone", "city", *EXTENDED_IDENTITY_FIELDS,
            "claim_status", "created_at",
        ]
        read_only_fields = ["id", "claim_status", "created_at"]


def _mask_phone(phone: str) -> str:
    """Mask a phone for staff display: recognisable, never harvestable.

    Keeps the international prefix and the LAST TWO digits — enough for the
    desk to confirm with the patient (« votre proche au numéro finissant
    par 78 ? »), never enough to reconstruct the number.
    """
    if len(phone) <= 6:
        return "•" * len(phone)
    return f"{phone[:4]}{'•' * (len(phone) - 6)}{phone[-2:]}"


class GuardianLinkStaffRoutingSerializer(serializers.ModelSerializer):
    """ACTIVE guardian links of a patient, for the DESK to route a share.

    Strict administrative minimum (billing staff only): ``id`` (the share
    target), a display name, the relationship. Deliberately NO phone (a
    nameless shadow guardian falls back to a MASKED phone — the desk must
    never harvest diaspora numbers through this route), NO status (only
    active links are ever listed) and NO consent scopes: whether a
    clinical consent exists is the PATIENT's information, and the payments
    scope is implied by the link being shareable at all.
    """

    guardian_name = serializers.SerializerMethodField()

    class Meta:
        model = GuardianLink
        fields = ["id", "guardian_name", "relationship"]
        read_only_fields = fields

    def get_guardian_name(self, link) -> str:
        user = link.guardian.user
        full = f"{user.first_name} {user.last_name}".strip()
        if full:
            return full
        # Same display intent as GuardianLinkPatientSerializer, except the
        # phone fallback is MASKED (the patient knows their guardian's
        # number; the desk has no need for it). The username is never used
        # here: shadow accounts are named « invite-<phone> » (leak).
        if user.phone:
            return _mask_phone(user.phone)
        return f"Tuteur n°{link.guardian_id}"


class CenterClinicalConsentSerializer(serializers.Serializer):
    """POST body of the desk-consent endpoint (S2, ADR 0004 addendum).

    ``guardian_link`` is a plain id: the VIEW resolves it among the
    ACTIVE links of the patient — a foreign/revoked/non-existent id
    answers one explicit 400 (S1 body-ref norm). ``collected_via`` traces
    HOW the consent was collected at the desk.
    """

    guardian_link = serializers.IntegerField(
        error_messages={"required": "Le lien de tutelle est requis."}
    )
    collected_via = serializers.ChoiceField(
        choices=Consent.CollectedVia.choices,
        error_messages={
            "required": "Le mode de recueil est requis (papier ou oral).",
            "invalid_choice": "Mode de recueil invalide : papier ou oral.",
        },
    )


class CenterClinicalConsentRevokeSerializer(serializers.Serializer):
    """DELETE body of the desk-consent endpoint — the link to withdraw from."""

    guardian_link = serializers.IntegerField(
        error_messages={"required": "Le lien de tutelle est requis."}
    )


class CenterClinicalConsentReceiptSerializer(serializers.ModelSerializer):
    """The desk's acknowledgement of the consent it just recorded/withdrew.

    Strict action receipt: link id, scope, collection trace, timestamps.
    No guardian identity, no patient identity — the desk already resolved
    both, nothing new must transit here.
    """

    class Meta:
        model = Consent
        fields = ["guardian_link", "scope", "collected_via", "granted_at", "revoked_at"]
        read_only_fields = fields


class PatientStaffCreateSerializer(serializers.ModelSerializer):
    """Desk creation (porte C) + optional guardian attachment by phone.

    The guardian link starts as ``invitation_envoyee`` — nothing opens
    before the guardian accepts.
    """

    guardian_phone = serializers.CharField(
        max_length=32, required=False, allow_blank=True, write_only=True
    )
    guardian_relationship = serializers.ChoiceField(
        choices=GuardianLink.Relationship.choices, required=False, write_only=True
    )

    class Meta:
        model = PatientProfile
        fields = [
            "first_name", "last_name", "birth_date", "sex", "phone", "city",
            *EXTENDED_IDENTITY_FIELDS,
            "guardian_phone", "guardian_relationship",
        ]


class PatientInsuranceSerializer(serializers.ModelSerializer):
    """An insurance line — read by any staff of the perimeter AND the
    patient (S3, ADR 0016 §6). ``created_by`` stays internal (trace)."""

    class Meta:
        model = PatientInsurance
        fields = [
            "id", "insurer_name", "member_number", "valid_until",
            "notes", "is_active", "created_at",
        ]
        read_only_fields = fields


class PatientInsuranceWriteSerializer(serializers.ModelSerializer):
    """POST/PATCH body — billing roles only (enforced by the view).

    ``is_active`` is declared explicitly with ``default=True``: without it,
    DRF's HTML-form semantics (checkboxes absent = False) would silently
    DEACTIVATE a line created through a multipart/form POST — the model
    default must win when the field is simply not sent.
    """

    is_active = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = PatientInsurance
        fields = [
            "insurer_name", "member_number", "valid_until", "notes",
            "is_active",
        ]
        extra_kwargs = {
            "insurer_name": {
                "error_messages": {
                    "required": "Le nom de l'assureur est requis.",
                    "blank": "Le nom de l'assureur est requis.",
                }
            },
            "member_number": {
                "error_messages": {
                    "required": "Le numéro d'adhérent est requis.",
                    "blank": "Le numéro d'adhérent est requis.",
                }
            },
        }


# ---------------------------------------------------------------------------
# Audience: the patient themself (porte B)
# ---------------------------------------------------------------------------


class PatientSelfSerializer(serializers.ModelSerializer):
    """The patient reads/updates their own identity."""

    class Meta:
        model = PatientProfile
        fields = [
            "id", "first_name", "last_name", "birth_date", "sex",
            "phone", "city", *EXTENDED_IDENTITY_FIELDS,
            "claim_status", "created_at",
        ]
        read_only_fields = ["id", "claim_status", "created_at"]


class GuardianLinkPatientSerializer(serializers.ModelSerializer):
    """The patient sees their guardians and what each link currently opens.

    ``scopes`` comes from ``Consent.objects.active_scopes`` — the single
    source of truth (ADR 0004) — so the patient sees exactly what the
    guardian can see, never a stale reading of consent rows.
    """

    guardian_name = serializers.SerializerMethodField()
    scopes = serializers.SerializerMethodField()

    class Meta:
        model = GuardianLink
        fields = [
            "id", "guardian_name", "relationship", "status",
            "initiated_by", "accepted_at", "revoked_at", "scopes",
        ]
        read_only_fields = fields

    def get_guardian_name(self, link) -> str:
        user = link.guardian.user
        full = f"{user.first_name} {user.last_name}".strip()
        return full or (user.phone or user.username)

    def get_scopes(self, link) -> list:
        return sorted(Consent.objects.active_scopes(link))


class GuardianInviteSerializer(serializers.Serializer):
    """Porte B — the patient invites a guardian by phone."""

    phone = serializers.CharField(
        max_length=32,
        error_messages={"required": "Le numéro de téléphone du tuteur est requis."},
    )
    relationship = serializers.ChoiceField(
        choices=GuardianLink.Relationship.choices,
        error_messages={"required": "Le lien de parenté est requis."},
    )


# ---------------------------------------------------------------------------
# Audience: a guardian (porte A)
# ---------------------------------------------------------------------------


class GuardianProfileSerializer(serializers.ModelSerializer):
    """The guardian about themself (POST create and PATCH update — S2).

    Both writable fields are safe to edit: residence is display/context
    data, and ``preferred_currency`` is NOT consumed by the trustbridge
    quotes (devis are structurally EUR→KMF, frozen on the intent — see
    ``services.update_guardian_profile``). Identity lives on ``User``
    (``PATCH /auth/me/``), never here.
    """

    class Meta:
        model = GuardianProfile
        fields = [
            "id", "country_of_residence", "preferred_currency",
            # S10 lot 1 (ADR 0023 décision 1) — la porte de sortie du
            # tuteur. Elle ne couvre QUE les relances : la notification
            # initiale d'une demande de paiement et le reçu restent
            # inconditionnels (verrouillé par test).
            "payment_reminders",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_country_of_residence(self, value):
        value = value.strip().upper()
        if len(value) != 2 or not (value.isascii() and value.isalpha()):
            raise serializers.ValidationError(
                "Code pays invalide : format ISO à 2 lettres (ex. FR)."
            )
        return value


class PatientContactPreferenceSerializer(serializers.ModelSerializer):
    """Les préférences de contact — forme COMPLÈTE et CONSTANTE (S10 lot 1).

    Sérialise indifféremment une ligne en base ou l'instance non
    sauvegardée rendue par ``services.patient_contact_preferences`` : la
    réponse a toujours les mêmes clés et les mêmes défauts (``True``).
    ``updated_at`` vaut ``null`` tant que rien n'a été exprimé — c'est la
    SEULE différence, et elle est honnête : « personne n'a encore réglé
    ceci » n'est pas la même chose que « la personne a accepté ».

    Le même payload sert le patient et le guichet : il ne contient aucune
    donnée d'identité, aucun contenu, et surtout pas ``updated_by`` — qui
    a réglé la préférence de quelqu'un d'autre n'est pas une information
    que ce module doit rendre.
    """

    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = PatientContactPreference
        fields = [*CONTACT_PREFERENCE_FIELDS, "updated_at"]
        read_only_fields = fields

    def get_updated_at(self, preferences):
        return preferences.updated_at if preferences.pk else None


class PatientContactPreferenceWriteSerializer(serializers.Serializer):
    """Écriture des préférences — les booléens refusables, et EUX SEULS.

    ``Serializer`` nu plutôt que ``ModelSerializer`` : la liste des champs
    acceptés est ainsi la liste de l'ADR, jamais « tout ce que le modèle
    porte ». Un champ ajouté au modèle demain (un canal de sécurité, par
    exemple) n'entre pas dans l'API par accident.

    PATCH (le patient) est partiel ; PUT (le guichet) exige les deux
    valeurs — un formulaire de guichet se remplit en entier, et un PUT
    partiel laisserait croire qu'on a réglé ce qu'on n'a pas touché.
    """

    appointment_reminders = serializers.BooleanField()
    missed_appointment_followup = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Indiquez au moins une préférence à modifier."
            )
        return attrs


class PatientGuardianSerializer(serializers.ModelSerializer):
    """A protégé as seen by their guardian — STRICTLY administrative.

    Name and claim status only. NO birth date, NO phone, NO city, and
    nothing clinical ever transits here: any richer exposure must go
    through a consent-scoped serializer of its own (phase B/C).
    """

    class Meta:
        model = PatientProfile
        fields = ["id", "first_name", "last_name", "claim_status"]
        read_only_fields = fields


class GuardianLinkGuardianSerializer(serializers.ModelSerializer):
    """A guardianship link as seen by the GUARDIAN (protégé embedded)."""

    patient = PatientGuardianSerializer(read_only=True)

    class Meta:
        model = GuardianLink
        fields = [
            "id", "patient", "relationship", "status",
            "initiated_by", "accepted_at",
        ]
        read_only_fields = fields


class GuardianLinkHistorySerializer(serializers.ModelSerializer):
    """S2 — one row of the guardian's link HISTORY (`GET /guardian/links/`).

    ALL statuses appear — the point is `attente_confirmation_titulaire`:
    before S2 a protégé whose profile got claimed simply VANISHED from
    `/guardian/proteges/` with no explanation; this list lets the UI say
    « en attente de confirmation de votre proche ».

    Administrative strict minimum, tighter than the protégés list: a
    display NAME and the link lifecycle — no protégé phone, no claim
    status, no relationship, no consent scopes, nothing medical. A
    non-active row must never become a side window on the protégé.
    """

    protege_display_name = serializers.SerializerMethodField()

    class Meta:
        model = GuardianLink
        fields = ["id", "protege_display_name", "status", "created_at", "revoked_at"]
        read_only_fields = fields

    def get_protege_display_name(self, link) -> str:
        name = f"{link.patient.first_name} {link.patient.last_name}".strip()
        return name or f"Protégé n°{link.patient_id}"


class ProtegeCreateSerializer(serializers.Serializer):
    """Porte A — a guardian registers a protégé (unclaimed profile).

    The guardian typed this identity themselves, so echoing it back to them
    is not a disclosure; it still never becomes readable through OTHER
    guardians' links.
    """

    first_name = serializers.CharField(
        max_length=128, error_messages={"required": "Le prénom est requis."}
    )
    last_name = serializers.CharField(
        max_length=128, error_messages={"required": "Le nom est requis."}
    )
    relationship = serializers.ChoiceField(
        choices=GuardianLink.Relationship.choices,
        error_messages={"required": "Le lien de parenté est requis."},
    )
    birth_date = serializers.DateField(required=False, allow_null=True)
    sex = serializers.ChoiceField(
        choices=PatientProfile.Sex.choices, required=False, allow_blank=True
    )
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    city = serializers.CharField(max_length=128, required=False, allow_blank=True)


class MergeRequestSerializer(serializers.Serializer):
    """Staff merge request — source absorbed into target (both in center scope)."""

    source_id = serializers.IntegerField(
        error_messages={"required": "L'identifiant du profil source est requis."}
    )
    target_id = serializers.IntegerField(
        error_messages={"required": "L'identifiant du profil cible est requis."}
    )
