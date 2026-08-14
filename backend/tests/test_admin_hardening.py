"""S4 (ADR 0017, décision 4) — the Django admin stops being a back-office.

**There was no admin test at all before this file** — a direct coverage
hole: every ``ModelAdmin`` in the project could be relaxed (or a new app
could ship a writable one) without a single red light. What is locked
here:

1. every sensitive model's admin refuses add, change AND delete — the
   three, on the ``ModelAdmin`` itself and on its inlines ;
2. **registry closure**: every model registered in
   ``admin.site._registry`` is either sensitive-and-read-only, or listed
   in :data:`WRITABLE_BY_DESIGN` with a written reason. A new app's admin
   fails this test until someone decides which side it belongs to —
   that is the whole point (« sinon le durcissement se perdra à la
   première app nouvelle ») ;
3. it holds END TO END through the real admin site, not only through the
   permission methods: a Django SUPERUSER gets 403 on the add/change
   views ;
4. the lot 1 KYC read-only block is not broken by lot 2.

Deliberately NOT tested, because deliberately NOT implemented: tenant
isolation inside the admin. A Django admin is transverse by nature; the
parade is that nothing sensitive is writable there (see
``apps/common/admin.py``).
"""

import pytest
from django.contrib import admin

from apps.common.admin import AppendOnlyAdminMixin, ReadOnlyAdminMixin

from .factories import make_user

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# The two lists that make this file a closure, not a spot check
# ---------------------------------------------------------------------------

#: Models whose admin MUST be read-only (add + change + delete refused).
#: Money, medical data, consents, guardianship, identity — everything with
#: a service invariant, a state machine, a ledger or an audit entry.
SENSITIVE_MODELS = {
    # Money (ADR 0006/0009/0015)
    "trustbridge.Invoice",
    "trustbridge.PaymentRequest",
    "trustbridge.PaymentIntent",
    "trustbridge.LedgerTransaction",
    "trustbridge.LedgerEntry",
    "trustbridge.Dispute",
    "trustbridge.CashPayment",
    "trustbridge.CashPaymentReversal",
    "trustbridge.CashReceipt",
    "trustbridge.Receipt",
    # Medical + consents (ADR 0002/0004/0016) — S3 admins and the
    # ConsentAdmin SV.2 debt are soldés here
    "medical.Encounter",
    "medical.ActPerformed",
    "medical.Prescription",
    "medical.HealthRecordEntry",
    "medical.Consent",
    "medical.PatientMedicalFile",
    "medical.VitalSigns",
    "medical.PatientDocument",
    # Patient identity and guardianship (ADR 0008 R-API-2, OTP-1)
    "patients.PatientProfile",
    "patients.GuardianProfile",
    "patients.GuardianLink",
    "patients.PatientInsurance",
    # Tenant configuration that is money-adjacent or evidence
    "centers.TariffItem",
    "centers.KycDocument",
    # RGPD (S4 lot 3, ADR 0007/0017 §7) — a change form here would flip a
    # request to « traitée » WITHOUT anonymising anything.
    "accounts.ErasureRequest",
    # The trail itself (append-only, ORM + PostgreSQL trigger)
    "audit.AuditLog",
}

#: Models whose admin stays WRITABLE — each with the reason it is not a
#: back-office door but a last-resort bootstrap. Any new entry here is a
#: conscious decision, reviewable in a diff.
WRITABLE_BY_DESIGN = {
    "accounts.User": "Django auth management (password reset, deactivation).",
    "accounts.PlatformStaff": (
        "Bootstrap of the back-office itself: the FIRST Chioni operator "
        "can only be born here, and this is the emergency revocation lever "
        "(ADR 0017 lot 1)."
    ),
    "centers.HealthCenter": (
        "Tenant profile (name, address, contact) — not sensitive. The KYC "
        "block IS read-only, asserted separately below."
    ),
    "centers.StaffMembership": (
        "Rescue bootstrap of a tenant locked out of its own space "
        "(ADR 0017 décision 4). The platform API is now the normal path."
    ),
    "scheduling.Appointment": (
        "Appointments are OPERATING data, explicitly not on the sensitive "
        "list (ADR 0013: no AuditLog, no money, nothing clinical)."
    ),
}

#: Admins registered by our DEPENDENCIES, not by Chioni. Reviewed and
#: accepted; their behaviour is not ours to assert (a library may harden
#: or relax its own admin between versions). Listed so the closure below
#: still fails on a NEW third-party admin — that is a decision too.
THIRD_PARTY_REVIEWED = {
    "auth.Group": "Django permission groups — no product data.",
    "token_blacklist.OutstandingToken": (
        "SimpleJWT bookkeeping (refresh tokens). No PII beyond the user FK; "
        "the library governs its own form."
    ),
    "token_blacklist.BlacklistedToken": (
        "SimpleJWT emergency revocation: blacklisting a stolen refresh "
        "token by hand is a legitimate admin act."
    ),
}


def _label(model):
    return f"{model._meta.app_label}.{model.__name__}"


def _registry():
    return {_label(model): model_admin for model, model_admin in admin.site._registry.items()}


def _permissions(model_admin, request):
    """The three answers, whatever the signature flavour of the class."""
    return {
        "add": model_admin.has_add_permission(request),
        "change": model_admin.has_change_permission(request),
        "delete": model_admin.has_delete_permission(request),
    }


@pytest.fixture
def admin_request(rf):
    request = rf.get("/admin/")
    request.user = make_user()
    request.user.is_staff = request.user.is_superuser = True
    request.user.save(update_fields=["is_staff", "is_superuser"])
    return request


# ---------------------------------------------------------------------------
# 1 — every sensitive admin refuses the three writes
# ---------------------------------------------------------------------------


class TestSensitiveAdminsAreReadOnly:
    @pytest.mark.parametrize("label", sorted(SENSITIVE_MODELS))
    def test_no_add_no_change_no_delete(self, label, admin_request):
        model_admin = _registry().get(label)
        assert model_admin is not None, f"{label} is not registered in the admin"
        assert _permissions(model_admin, admin_request) == {
            "add": False, "change": False, "delete": False
        }, label

    @pytest.mark.parametrize("label", sorted(SENSITIVE_MODELS))
    def test_object_level_answers_are_refused_too(self, label, admin_request):
        """``has_change_permission(request, obj)`` is the signature Django
        uses on a change form: a mixin that only covered the obj-less call
        would let the form render."""
        model_admin = _registry()[label]
        assert model_admin.has_change_permission(admin_request, obj=None) is False
        assert model_admin.has_delete_permission(admin_request, obj=None) is False

    @pytest.mark.parametrize("label", sorted(SENSITIVE_MODELS))
    def test_inlines_are_read_only_too(self, label, admin_request):
        """An editable inline on a read-only parent would be a side door."""
        model_admin = _registry()[label]
        for inline_cls in getattr(model_admin, "inlines", []):
            inline = inline_cls(model_admin.model, admin.site)
            assert inline.has_add_permission(admin_request, None) is False, inline_cls
            assert inline.has_change_permission(admin_request, None) is False, inline_cls
            assert inline.has_delete_permission(admin_request, None) is False, inline_cls


# ---------------------------------------------------------------------------
# 2 — registry closure: a new app cannot slip through
# ---------------------------------------------------------------------------


class TestRegistryClosure:
    def test_every_registered_model_took_a_side(self):
        """THE test that keeps the hardening alive.

        Any model registered in the admin must be either sensitive (and
        then read-only, asserted above) or explicitly listed as writable
        with a reason. A new app that registers a ``ModelAdmin`` fails
        here until a human decides — the durcissement cannot rot by
        omission.
        """
        known = (
            SENSITIVE_MODELS | set(WRITABLE_BY_DESIGN) | set(THIRD_PARTY_REVIEWED)
        )
        unclassified = sorted(set(_registry()) - known)
        assert not unclassified, (
            "Ces modèles sont enregistrés dans l'admin sans décision : "
            f"{unclassified}. Ajoutez-les à SENSITIVE_MODELS (et rendez "
            "leur admin read-only), à WRITABLE_BY_DESIGN avec un motif, ou "
            "à THIRD_PARTY_REVIEWED s'ils viennent d'une dépendance."
        )

    def test_the_lists_do_not_overlap(self):
        assert not (SENSITIVE_MODELS & set(WRITABLE_BY_DESIGN))
        assert not (SENSITIVE_MODELS & set(THIRD_PARTY_REVIEWED))
        assert not (set(WRITABLE_BY_DESIGN) & set(THIRD_PARTY_REVIEWED))

    def test_writable_by_design_admins_really_are_writable(self, admin_request):
        """Symmetry: if one of these silently became read-only, the rescue
        path documented in the ADR would be gone without anyone noticing."""
        registry = _registry()
        for label in WRITABLE_BY_DESIGN:
            model_admin = registry[label]
            assert model_admin.has_change_permission(admin_request) is True, label


# ---------------------------------------------------------------------------
# 3 — end to end through the real admin site (a superuser is refused)
# ---------------------------------------------------------------------------


class TestTheRealAdminRefusesASuperuser:
    @pytest.fixture
    def admin_client(self, client):
        user = make_user()
        user.is_staff = user.is_superuser = True
        user.set_password("admin-pass")
        user.save()
        client.force_login(user)
        return client

    @pytest.mark.parametrize(
        "path",
        [
            "/admin/medical/consent/add/",
            "/admin/medical/encounter/add/",
            "/admin/patients/guardianlink/add/",
            "/admin/trustbridge/invoice/add/",
            "/admin/trustbridge/cashpayment/add/",
            "/admin/centers/tariffitem/add/",
            "/admin/audit/auditlog/add/",
        ],
    )
    def test_add_views_are_403(self, admin_client, path):
        assert admin_client.get(path).status_code == 403

    def test_change_view_of_a_consent_is_read_only(self, admin_client):
        """The most sensitive object of the product: granting a clinical
        scope by hand would bypass the patient, the claimant-confirmation
        gate and the audit trail."""
        from apps.medical.models import Consent

        from .api_helpers import make_active_link, make_guardian_user
        from .factories import make_patient

        _user, guardian = make_guardian_user()
        patient = make_patient()
        link = make_active_link(guardian, patient)
        consent = Consent.objects.create(
            patient=patient, guardian_link=link, scope=Consent.Scope.CLINICAL_DETAIL
        )

        response = admin_client.get(f"/admin/medical/consent/{consent.pk}/change/")
        # Django serves the object in VIEW mode (200) and refuses the POST.
        assert response.status_code == 200
        posted = admin_client.post(
            f"/admin/medical/consent/{consent.pk}/change/",
            {"patient": patient.pk, "guardian_link": link.pk, "scope": "paiements"},
        )
        assert posted.status_code == 403
        consent.refresh_from_db()
        assert consent.scope == Consent.Scope.CLINICAL_DETAIL


# ---------------------------------------------------------------------------
# 4 — the shared mixins, and the lot 1 KYC block that must not regress
# ---------------------------------------------------------------------------


class TestSharedMixins:
    def test_append_only_covers_add_which_it_did_not_before(self):
        """Before S4 the trustbridge mixin covered change/delete only and
        every consumer re-declared ``has_add_permission`` by hand."""
        assert issubclass(AppendOnlyAdminMixin, ReadOnlyAdminMixin)
        for mixin in (ReadOnlyAdminMixin, AppendOnlyAdminMixin):
            probe = mixin()
            assert probe.has_add_permission(None) is False
            assert probe.has_add_permission(None, None) is False  # inline signature
            assert probe.has_change_permission(None) is False
            assert probe.has_delete_permission(None) is False

    def test_trustbridge_admins_consume_the_shared_mixin(self):
        """Identity, not duplication: the money admins must inherit from
        ``apps.common.admin``, never re-declare a local copy."""
        from apps.trustbridge import admin as tb_admin

        for name in (
            "PaymentIntentAdmin", "LedgerTransactionAdmin", "LedgerEntryAdmin",
            "CashPaymentAdmin", "CashPaymentReversalAdmin", "CashReceiptAdmin",
            "ReceiptAdmin",
        ):
            assert issubclass(getattr(tb_admin, name), AppendOnlyAdminMixin), name
        for name in ("InvoiceAdmin", "PaymentRequestAdmin", "DisputeAdmin"):
            assert issubclass(getattr(tb_admin, name), ReadOnlyAdminMixin), name
        # The old local mixin is gone — no second definition to drift.
        assert "AppendOnlyAdminMixin" not in vars(tb_admin) or (
            vars(tb_admin)["AppendOnlyAdminMixin"] is AppendOnlyAdminMixin
        )


class TestKycBlockStaysReadOnlyFromLot1:
    def test_health_center_admin_keeps_its_four_kyc_readonly_fields(self):
        model_admin = _registry()["centers.HealthCenter"]
        assert set(model_admin.readonly_fields) >= {
            "kyc_status", "kyc_reason", "kyc_updated_at", "kyc_updated_by",
        }
