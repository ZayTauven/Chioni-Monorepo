"""S4 (ADR 0017, décisions 2 & 3) — onboarding du tenant et dossier KYC.

What is pinned here:

- a tenant is BORN by the platform, center + first director in ONE
  transaction, the director as a SHADOW account (no password ever
  transmitted), the center « en_attente » whatever the payload says;
- the KYC state machine is explicit and closed, the motive is MANDATORY
  on a suspension, the motive is visible to the platform and to the
  DIRECTOR of the concerned center — and to nobody else;
- KYC pieces ride the ADR 0014 pipeline (PDF/SVG refused) and the ADR
  0016 §5 private storage (no URL, download by authenticated endpoint
  only), archiving is final;
- the audit carries references and status codes — NEVER the motive.
"""

from io import BytesIO
from pathlib import Path

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.throttling import ScopedRateThrottle

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.centers.models import HealthCenter, KycDocument, StaffMembership
from apps.centers.views import CenterKycDocumentListCreateView

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .factories import make_center, make_platform_staff, make_user

pytestmark = pytest.mark.django_db

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n"
SVG_BYTES = (
    b'<svg xmlns="http://www.w3.org/2000/svg">'
    b'<script>alert("xss")</script></svg>'
)


def png_upload(name="registre.png"):
    buf = BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def operator(role="admin"):
    user, _op = make_platform_staff(role=role)
    return user


CENTER_BODY = {
    "name": "Clinique El-Maarouf",
    "type": "clinique_privee",
    "island": "ngazidja",
    "city": "Moroni",
    "director_phone": "+2693390001",
    "director_first_name": "Saïd",
    "director_last_name": "Abdallah",
}


# ---------------------------------------------------------------------------
# Décision 2 — onboarding of the tenant
# ---------------------------------------------------------------------------


class TestCenterOnboarding:
    def test_admin_creates_a_center_and_its_first_director(self):
        response = client_for(operator()).post(
            "/api/v1/platform/centers/", CENTER_BODY
        )
        assert response.status_code == 201, response.content

        center = HealthCenter.objects.get(name="Clinique El-Maarouf")
        assert center.kyc_status == HealthCenter.KycStatus.PENDING
        membership = StaffMembership.objects.get(center=center)
        assert membership.role == Role.DIRECTOR
        assert membership.is_active
        assert membership.user.phone == "+2693390001"
        assert response.data["director"]["id"] == membership.pk
        assert response.data["director_active_count"] == 1

    def test_the_director_is_a_shadow_account_claimed_by_otp(self):
        client_for(operator()).post("/api/v1/platform/centers/", CENTER_BODY)
        director = StaffMembership.objects.get().user
        assert not director.has_usable_password()
        assert director.phone_verified_at is None
        # …and nothing password-shaped ever transits the response.
        response = client_for(operator()).get("/api/v1/platform/centers/")
        assert "password" not in response.content.decode().lower()

    def test_a_center_can_never_be_born_already_active(self):
        """A creation that could self-activate the diaspora rail would
        hollow out the whole verification."""
        response = client_for(operator()).post(
            "/api/v1/platform/centers/", {**CENTER_BODY, "kyc_status": "actif"}
        )
        assert response.status_code == 201
        assert response.data["kyc_status"] == "en_attente"

    def test_creation_is_atomic_when_the_director_phone_is_invalid(self):
        response = client_for(operator()).post(
            "/api/v1/platform/centers/",
            {**CENTER_BODY, "director_phone": "12"},
        )
        assert response.status_code == 400
        # No orphan tenant: a center without a director is a locked-out one.
        assert HealthCenter.objects.count() == 0
        assert StaffMembership.objects.count() == 0

    def test_creation_is_audited_without_any_free_text(self):
        client_for(operator()).post("/api/v1/platform/centers/", CENTER_BODY)
        entry = AuditLog.objects.get(action=AuditAction.CENTER_CREATED)
        assert entry.payload["kyc_status"] == "en_attente"
        assert "name" not in entry.payload
        assert "El-Maarouf" not in str(entry.payload)
        assert AuditLog.objects.filter(action=AuditAction.STAFF_CREATED).exists()

    def test_two_centers_may_share_a_name_and_similarity_only_informs(self):
        client = client_for(operator())
        client.post("/api/v1/platform/centers/", CENTER_BODY)
        second = client.post(
            "/api/v1/platform/centers/",
            {
                **CENTER_BODY, "island": "ndzuwani", "city": "Mutsamudu",
                "director_phone": "+2693390002",
            },
        )
        assert second.status_code == 201  # never blocking
        similar = client.get(
            "/api/v1/platform/centers/similar/?name=El-Maarouf"
        )
        assert similar.status_code == 200
        assert similar.data["count"] == 2

    def test_similar_requires_at_least_one_criterion(self):
        response = client_for(operator()).get("/api/v1/platform/centers/similar/")
        assert response.status_code == 400
        assert "Au moins un critère" in str(response.data)

    def test_similar_refuses_an_unknown_island_per_field(self):
        response = client_for(operator()).get(
            "/api/v1/platform/centers/similar/?name=X&island=mayotte"
        )
        assert response.status_code == 400
        assert "island" in response.data

    def test_list_filter_refuses_an_unknown_kyc_status_per_field(self):
        response = client_for(operator()).get(
            "/api/v1/platform/centers/?kyc_status=valide"
        )
        assert response.status_code == 400
        assert "kyc_status" in response.data

    def test_unknown_center_in_the_url_is_404(self):
        client = client_for(operator())
        assert client.get("/api/v1/platform/centers/99999/").status_code == 404
        assert (
            client.post("/api/v1/platform/centers/99999/kyc/", {"status": "actif"})
            .status_code == 404
        )


class TestDirectorRescuePath:
    def test_admin_seeds_a_director_on_an_orphan_center(self):
        center = make_center()
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/directors/",
            {"phone": "+2693390055", "first_name": "Hadidja"},
        )
        assert response.status_code == 201, response.content
        membership = StaffMembership.objects.get(center=center)
        assert membership.role == Role.DIRECTOR
        assert not membership.user.has_usable_password()

    def test_seeding_the_same_director_twice_is_a_clean_400(self):
        admin = client_for(operator())
        created = admin.post("/api/v1/platform/centers/", CENTER_BODY)
        center_pk = created.data["id"]
        response = admin.post(
            f"/api/v1/platform/centers/{center_pk}/directors/",
            {"phone": CENTER_BODY["director_phone"]},
        )
        assert response.status_code == 400
        assert "déjà ce rôle" in str(response.data)


# ---------------------------------------------------------------------------
# Décision 3 — the KYC state machine
# ---------------------------------------------------------------------------


class TestKycTransitions:
    def test_pending_to_active_opens_the_center(self):
        center = make_center(kyc_status=HealthCenter.KycStatus.PENDING)
        admin = operator()
        response = client_for(admin).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "actif"}
        )
        assert response.status_code == 200, response.content
        center.refresh_from_db()
        assert center.kyc_status == HealthCenter.KycStatus.ACTIVE
        assert center.kyc_updated_by == admin
        assert center.kyc_updated_at is not None

    def test_suspension_requires_a_motive(self):
        center = make_center()
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "suspendu"}
        )
        assert response.status_code == 400
        assert "motif est obligatoire" in str(response.data)
        center.refresh_from_db()
        assert center.kyc_status == HealthCenter.KycStatus.ACTIVE

    def test_suspension_stores_the_motive(self):
        center = make_center()
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "suspendu", "reason": "Licence sanitaire expirée."},
        )
        assert response.status_code == 200
        center.refresh_from_db()
        assert center.kyc_reason == "Licence sanitaire expirée."
        assert response.data["kyc_reason"] == "Licence sanitaire expirée."

    def test_impossible_transitions_are_refused_explicitly(self):
        center = make_center(kyc_status=HealthCenter.KycStatus.ACTIVE)
        client = client_for(operator())
        response = client.post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "en_attente"},
        )
        assert response.status_code == 400
        assert "Transition KYC refusée" in str(response.data)

    def test_setting_the_same_status_is_refused_not_silently_applied(self):
        center = make_center()
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/", {"status": "actif"}
        )
        assert response.status_code == 400
        assert "déjà" in str(response.data)

    def test_suspended_can_come_back_to_active(self):
        center = make_center(kyc_status=HealthCenter.KycStatus.SUSPENDED)
        response = client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "actif", "reason": "Licence renouvelée."},
        )
        assert response.status_code == 200
        center.refresh_from_db()
        assert center.kyc_status == HealthCenter.KycStatus.ACTIVE

    def test_the_audit_carries_the_codes_never_the_motive(self):
        center = make_center()
        client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "suspendu", "reason": "Fraude signalée par un tuteur."},
        )
        entry = AuditLog.objects.get(action=AuditAction.CENTER_KYC_CHANGED)
        assert entry.payload["old_status"] == "actif"
        assert entry.payload["kyc_status"] == "suspendu"
        assert entry.payload["has_reason"] is True
        assert "Fraude" not in str(entry.payload)

    def test_the_tenant_still_cannot_move_its_own_kyc(self):
        """Double lock kept from day one: the serializer field is read-only
        AND ``update_center`` pops it."""
        center, director = make_center_with_director(kyc_status="en_attente")
        response = client_for(director).patch(
            f"/api/v1/centers/{center.pk}/", {"kyc_status": "actif"}
        )
        assert response.status_code == 200
        center.refresh_from_db()
        assert center.kyc_status == HealthCenter.KycStatus.PENDING

    def test_the_admin_field_is_read_only(self):
        """ADR 0017 — the Django admin stops being a parallel, unaudited
        door to the diaspora rail."""
        from apps.centers.admin import HealthCenterAdmin

        for field in ("kyc_status", "kyc_reason", "kyc_updated_at",
                      "kyc_updated_by"):
            assert field in HealthCenterAdmin.readonly_fields


class TestKycMotiveVisibility:
    def test_the_director_of_the_center_reads_the_motive(self):
        center, director = make_center_with_director()
        client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "suspendu", "reason": "Pièces manquantes."},
        )
        response = client_for(director).get(f"/api/v1/centers/{center.pk}/")
        assert response.data["kyc_status"] == "suspendu"
        assert response.data["kyc_reason"] == "Pièces manquantes."

    def test_other_staff_of_the_center_never_read_the_motive(self):
        center, _director = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        client_for(operator()).post(
            f"/api/v1/platform/centers/{center.pk}/kyc/",
            {"status": "suspendu", "reason": "Pièces manquantes."},
        )
        response = client_for(cashier).get(f"/api/v1/centers/{center.pk}/")
        assert response.data["kyc_status"] == "suspendu"  # the STATE is shared
        assert response.data["kyc_reason"] is None  # the free text is not
        assert "Pièces manquantes" not in response.content.decode()

    def test_a_director_elsewhere_never_reads_another_center_motive(self):
        center_a, _ = make_center_with_director()
        _center_b, director_b = make_center_with_director()
        make_staff_user(center_a, role=Role.DOCTOR)
        # director_b is added as a doctor in center_a: staff there, not
        # director there — the motive must stay closed.
        from apps.centers.models import StaffMembership as SM

        SM.objects.create(user=director_b, center=center_a, role=Role.DOCTOR)
        client_for(operator()).post(
            f"/api/v1/platform/centers/{center_a.pk}/kyc/",
            {"status": "suspendu", "reason": "Motif confidentiel."},
        )
        response = client_for(director_b).get(f"/api/v1/centers/{center_a.pk}/")
        assert response.data["kyc_reason"] is None


# ---------------------------------------------------------------------------
# Décision 3 — KYC supporting documents
# ---------------------------------------------------------------------------


def upload_kyc(center, director, doc_type="registre_commerce", **extra):
    return client_for(director).post(
        f"/api/v1/centers/{center.pk}/kyc-documents/",
        {"file": png_upload(), "doc_type": doc_type, **extra},
        format="multipart",
    )


class TestKycDocuments:
    def test_director_uploads_and_platform_reads(self):
        center, director = make_center_with_director()
        response = upload_kyc(center, director)
        assert response.status_code == 201, response.content
        document = KycDocument.objects.get()
        assert document.center == center
        assert document.uploaded_by == director

        listed = client_for(operator("support")).get(
            f"/api/v1/platform/centers/{center.pk}/kyc-documents/"
        )
        assert listed.data["count"] == 1
        assert set(listed.data["results"][0]) == {
            "id", "center", "doc_type", "uploaded_by", "archived_at",
            "created_at",
        }

    def test_the_file_lives_in_the_private_root_and_has_no_url(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        document = KycDocument.objects.get()
        stored = Path(document.file.path)
        assert stored.exists()
        assert Path(settings.PRIVATE_MEDIA_ROOT) in stored.parents
        with pytest.raises(ValueError):
            document.file.url

    def test_no_payload_ever_carries_the_file(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        for client, url in (
            (client_for(director), f"/api/v1/centers/{center.pk}/kyc-documents/"),
            (
                client_for(operator()),
                f"/api/v1/platform/centers/{center.pk}/kyc-documents/",
            ),
        ):
            body = client.get(url).content.decode()
            assert "file" not in body and "/media/" not in body

    def test_both_audiences_download_through_the_authenticated_endpoint(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        document = KycDocument.objects.get()
        for client, url in (
            (
                client_for(director),
                f"/api/v1/centers/{center.pk}/kyc-documents/"
                f"{document.pk}/download/",
            ),
            (
                client_for(operator("support")),
                f"/api/v1/platform/centers/{center.pk}/kyc-documents/"
                f"{document.pk}/download/",
            ),
        ):
            response = client.get(url)
            assert response.status_code == 200, url
            assert response["X-Content-Type-Options"] == "nosniff"
            assert (
                f"kyc-{document.pk}.png" in response["Content-Disposition"]
            )
            # The uuid storage name never leaks in the header.
            assert Path(document.file.name).name not in (
                response["Content-Disposition"]
            )

    def test_only_the_director_of_the_center_touches_the_kyc_file(self):
        center, _director = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        cashier = make_staff_user(center, role=Role.CASHIER)
        for user in (doctor, cashier):
            response = client_for(user).get(
                f"/api/v1/centers/{center.pk}/kyc-documents/"
            )
            assert response.status_code == 403

    def test_a_foreign_director_gets_a_plain_404(self):
        center, _director = make_center_with_director()
        _other, foreign_director = make_center_with_director()
        response = client_for(foreign_director).get(
            f"/api/v1/centers/{center.pk}/kyc-documents/"
        )
        assert response.status_code == 404

    def test_a_document_of_another_center_is_404_by_url(self):
        center_a, director_a = make_center_with_director()
        center_b, director_b = make_center_with_director()
        upload_kyc(center_b, director_b)
        foreign = KycDocument.objects.get()
        response = client_for(director_a).get(
            f"/api/v1/centers/{center_a.pk}/kyc-documents/{foreign.pk}/download/"
        )
        assert response.status_code == 404

    def test_pdf_and_svg_are_refused_like_everywhere_else(self):
        center, director = make_center_with_director()
        for name, payload, content_type in (
            ("registre.pdf", PDF_BYTES, "application/pdf"),
            ("registre.svg", SVG_BYTES, "image/svg+xml"),
            ("registre.png", SVG_BYTES, "image/png"),  # lying extension
        ):
            response = client_for(director).post(
                f"/api/v1/centers/{center.pk}/kyc-documents/",
                {
                    "file": SimpleUploadedFile(name, payload, content_type),
                    "doc_type": "registre_commerce",
                },
                format="multipart",
            )
            assert response.status_code == 400, name
            assert "JPEG, PNG ou WebP" in str(response.data)
        assert KycDocument.objects.count() == 0

    def test_an_unknown_doc_type_is_refused_by_the_serializer(self):
        center, director = make_center_with_director()
        response = upload_kyc(center, director, doc_type="passeport")
        assert response.status_code == 400
        assert "doc_type" in response.data

    def test_upload_carries_the_strict_uploads_throttle(self):
        view = CenterKycDocumentListCreateView()
        view.request = type("R", (), {"method": "POST"})()
        throttles = view.get_throttles()
        assert any(isinstance(t, ScopedRateThrottle) for t in throttles)
        assert view.throttle_scope == "uploads"

    def test_archiving_is_final_and_audited(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        document = KycDocument.objects.get()
        url = (
            f"/api/v1/centers/{center.pk}/kyc-documents/{document.pk}/archive/"
        )
        first = client_for(director).post(url)
        assert first.status_code == 200
        assert first.data["archived_at"] is not None
        second = client_for(director).post(url)
        assert second.status_code == 400
        assert "déjà archivée" in str(second.data)

        document.refresh_from_db()
        document.archived_at = None
        with pytest.raises(Exception) as excinfo:
            document.save(update_fields=["archived_at"])
        assert "définitif" in str(excinfo.value)

        entry = AuditLog.objects.get(action=AuditAction.KYC_DOCUMENT_ARCHIVED)
        assert entry.payload["center_id"] == center.pk

    def test_an_archived_piece_stays_readable_by_both_audiences(self):
        """Verifying WHAT was archived is part of correcting the error, and
        a KYC decision must stay auditable against its pieces."""
        center, director = make_center_with_director()
        upload_kyc(center, director)
        document = KycDocument.objects.get()
        client_for(director).post(
            f"/api/v1/centers/{center.pk}/kyc-documents/"
            f"{document.pk}/archive/"
        )
        listed = client_for(operator()).get(
            f"/api/v1/platform/centers/{center.pk}/kyc-documents/"
        )
        assert listed.data["count"] == 1
        assert (
            client_for(operator()).get(
                f"/api/v1/platform/centers/{center.pk}/kyc-documents/"
                f"{document.pk}/download/"
            ).status_code == 200
        )

    def test_upload_is_audited_without_a_file_name(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        entry = AuditLog.objects.get(action=AuditAction.KYC_DOCUMENT_UPLOADED)
        assert entry.payload["doc_type"] == "registre_commerce"
        assert "registre.png" not in str(entry.payload)

    def test_the_document_count_of_a_center_ignores_archived_pieces(self):
        center, director = make_center_with_director()
        upload_kyc(center, director)
        upload_kyc(center, director, doc_type="licence_sante")
        document = KycDocument.objects.order_by("pk").first()
        client_for(director).post(
            f"/api/v1/centers/{center.pk}/kyc-documents/"
            f"{document.pk}/archive/"
        )
        response = client_for(operator()).get(
            f"/api/v1/platform/centers/{center.pk}/"
        )
        assert response.data["kyc_document_count"] == 1


class TestPlatformCounters:
    def test_counters_reflect_the_tenant_headcount(self):
        center, _director = make_center_with_director()
        make_staff_user(center, role=Role.DOCTOR)
        inactive = make_staff_user(center, role=Role.NURSE)
        StaffMembership.objects.filter(user=inactive).update(is_active=False)
        make_user()  # unrelated account

        response = client_for(operator("support")).get(
            f"/api/v1/platform/centers/{center.pk}/"
        )
        assert response.data["staff_active_count"] == 2
        assert response.data["director_active_count"] == 1
