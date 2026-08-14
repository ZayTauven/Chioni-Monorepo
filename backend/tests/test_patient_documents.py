"""S3 (ADR 0016 §5) — carnet documents (PatientDocument), PRIVATE diffusion.

The security point n° 1 of the sprint, pinned here:

- the stored file lives under PRIVATE_MEDIA_ROOT, NEVER under MEDIA_ROOT,
  has NO URL (``.url`` raises) and /media/ never serves it;
- serializers expose an id and metadata — no file field, no URL;
- the ONLY read paths are the authenticated download endpoints, which
  replay exactly the list permissions (clinical roles of the producing
  center / the patient, archived excluded patient-side);
- uploads run the ADR 0014 pipeline unchanged: PDF and SVG are refused;
- archiving is correction WITHOUT destruction, final, audited without the
  title (free clinical text).
"""

from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.throttling import ScopedRateThrottle

from apps.audit.models import AuditLog
from apps.audit.services import AuditAction
from apps.medical.models import PatientDocument
from apps.medical.views import CenterPatientDocumentListCreateView

from .api_helpers import (
    Role,
    client_for,
    make_center_with_director,
    make_claimed_patient,
    make_staff_user,
)
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db

#: Exact staff payload of a document row — deliberately NO file, NO url.
STAFF_DOCUMENT_FIELDS = {
    "id", "patient", "doc_type", "title", "source_encounter",
    "archived_at", "created_at",
}

#: Exact patient payload — archived rows never reach it.
PATIENT_DOCUMENT_FIELDS = {
    "id", "center", "center_name", "doc_type", "title",
    "source_encounter", "created_at",
}

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n"
SVG_BYTES = (
    b'<svg xmlns="http://www.w3.org/2000/svg">'
    b'<script>alert("xss")</script></svg>'
)


def png_upload(name="analyse.png"):
    buf = BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def clinical_ctx():
    center, _ = make_center_with_director()
    doctor = make_staff_user(center, role=Role.DOCTOR)
    patient = make_patient(created_by_center=center)
    return center, doctor, patient


def url(center, patient):
    return f"/api/v1/centers/{center.pk}/patients/{patient.pk}/documents/"


def upload_document(center, doctor, patient, title="Résultat NFS", **extra):
    response = client_for(doctor).post(
        url(center, patient),
        {"file": png_upload(), "doc_type": "resultat_biologie",
         "title": title, **extra},
        format="multipart",
    )
    assert response.status_code == 201, response.content
    return PatientDocument.objects.get(pk=response.data["id"])


class TestDocumentUpload:
    def test_doctor_uploads_a_photo_of_a_lab_result(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)
        assert document.center == center
        assert document.uploaded_by == doctor
        assert document.file.name.endswith(".png")

    def test_payload_never_carries_a_file_nor_a_url(self):
        center, doctor, patient = clinical_ctx()
        upload_document(center, doctor, patient)
        listed = client_for(doctor).get(url(center, patient))
        (row,) = listed.data["results"]
        assert set(row.keys()) == STAFF_DOCUMENT_FIELDS
        assert "file" not in row and "url" not in str(row.keys())

    def test_file_lives_under_the_private_root_only(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)
        stored = Path(document.file.path)
        assert stored.exists()
        assert Path(settings.PRIVATE_MEDIA_ROOT) in stored.parents
        assert Path(settings.MEDIA_ROOT) not in stored.parents

    def test_the_private_file_has_no_url_and_media_serves_nothing(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)
        with pytest.raises(ValueError, match="pas d'URL publique"):
            document.file.url
        # Even the hypothetical /media/ path answers 404 — the file is NOT
        # inside MEDIA_ROOT and no route serves the private root.
        probe = client_for(doctor).get(f"/media/{document.file.name}")
        assert probe.status_code == 404

    def test_pdf_is_refused_socle_0014(self):
        """PDF explicitly deferred (ADR 0016 §5): the pipeline only admits
        real JPEG/PNG/WebP."""
        center, doctor, patient = clinical_ctx()
        response = client_for(doctor).post(
            url(center, patient),
            {"file": SimpleUploadedFile(
                "analyse.pdf", PDF_BYTES, content_type="application/pdf"
            ), "doc_type": "resultat_biologie", "title": "PDF"},
            format="multipart",
        )
        assert response.status_code == 400
        assert "formats acceptés JPEG, PNG ou WebP" in str(response.data)
        assert PatientDocument.objects.count() == 0

    def test_svg_is_refused_even_disguised(self):
        center, doctor, patient = clinical_ctx()
        response = client_for(doctor).post(
            url(center, patient),
            {"file": SimpleUploadedFile(
                "imagerie.png", SVG_BYTES, content_type="image/png"
            ), "doc_type": "imagerie", "title": "SVG déguisé"},
            format="multipart",
        )
        assert response.status_code == 400
        assert PatientDocument.objects.count() == 0

    def test_title_and_doc_type_are_required(self):
        center, doctor, patient = clinical_ctx()
        response = client_for(doctor).post(
            url(center, patient), {"file": png_upload()}, format="multipart"
        )
        assert response.status_code == 400
        assert {"doc_type", "title"} <= set(response.data.keys())

    def test_source_encounter_must_be_of_this_center_and_this_patient(self):
        center, doctor, patient = clinical_ctx()
        good = make_encounter(patient=patient, center=center)
        document = upload_document(
            center, doctor, patient, source_encounter=good.pk
        )
        assert document.source_encounter == good

        other_center, _ = make_center_with_director()
        foreign = make_encounter(center=other_center)
        response = client_for(doctor).post(
            url(center, patient),
            {"file": png_upload(), "doc_type": "compte_rendu",
             "title": "CR", "source_encounter": foreign.pk},
            format="multipart",
        )
        assert response.status_code == 400
        assert "n'appartient pas à ce centre" in str(response.data)

        other_patient_encounter = make_encounter(center=center)
        response = client_for(doctor).post(
            url(center, patient),
            {"file": png_upload(), "doc_type": "compte_rendu",
             "title": "CR", "source_encounter": other_patient_encounter.pk},
            format="multipart",
        )
        assert response.status_code == 400
        assert "ne concerne pas ce patient" in str(response.data)

    def test_upload_throttle_scope_applies_to_post_only(self):
        """The strict `uploads` scope (20/h) must never starve the LIST."""
        post_view = CenterPatientDocumentListCreateView()
        post_view.request = SimpleNamespace(method="POST")
        (throttle,) = post_view.get_throttles()
        assert isinstance(throttle, ScopedRateThrottle)
        assert post_view.throttle_scope == "uploads"

        get_view = CenterPatientDocumentListCreateView()
        get_view.request = SimpleNamespace(method="GET")
        assert not any(
            isinstance(t, ScopedRateThrottle) for t in get_view.get_throttles()
        )

    def test_audit_carries_doc_type_never_the_title(self):
        center, doctor, patient = clinical_ctx()
        upload_document(center, doctor, patient, title="Sérologie VIH")
        entry = AuditLog.objects.get(action=AuditAction.PATIENT_DOCUMENT_CREATED)
        assert entry.payload["doc_type"] == "resultat_biologie"
        assert entry.payload["patient_id"] == patient.pk
        assert "Sérologie" not in str(entry.payload)
        assert "VIH" not in str(entry.payload)


class TestDocumentAccessMatrix:
    def test_roles_matrix_on_list_and_download(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)
        download = f"{url(center, patient)}{document.pk}/download/"

        for role in (Role.SECRETARY, Role.CASHIER, Role.DIRECTOR, Role.PHARMACIST):
            staff = make_staff_user(center, role=role)
            assert client_for(staff).get(url(center, patient)).status_code == 403, role
            assert client_for(staff).get(download).status_code == 403, role

        nurse = make_staff_user(center, role=Role.NURSE)
        assert client_for(nurse).get(url(center, patient)).status_code == 200
        assert client_for(nurse).get(download).status_code == 200

    def test_download_streams_the_sanitised_image_with_safe_headers(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)

        response = client_for(doctor).get(
            f"{url(center, patient)}{document.pk}/download/"
        )

        assert response.status_code == 200
        disposition = response.headers["Content-Disposition"]
        assert "attachment" in disposition
        # Neutral name: never the title, never the uuid storage name.
        assert f"document-{document.pk}.png" in disposition
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        content = b"".join(response.streaming_content)
        assert content.startswith(b"\x89PNG")

    def test_producing_center_boundary(self):
        """A document produced by center A is invisible from center B even
        when the patient is inside B's perimeter (carnet boundary)."""
        center_a, doctor_a, patient = clinical_ctx()
        document = upload_document(center_a, doctor_a, patient)

        center_b, _ = make_center_with_director()
        make_encounter(patient=patient, center=center_b)  # B knows the patient
        doctor_b = make_staff_user(center_b, role=Role.DOCTOR)

        listed = client_for(doctor_b).get(url(center_b, patient))
        assert listed.status_code == 200
        assert listed.data["results"] == []
        assert client_for(doctor_b).get(
            f"{url(center_b, patient)}{document.pk}/download/"
        ).status_code == 404

    def test_cross_center_patient_is_404(self):
        center, doctor, _ = clinical_ctx()
        other_center, _ = make_center_with_director()
        foreign_patient = make_patient(created_by_center=other_center)
        assert client_for(doctor).get(
            url(center, foreign_patient)
        ).status_code == 404


class TestDocumentArchive:
    def test_archive_then_staff_sees_the_state_patient_no_longer_sees(self):
        center, doctor, _ = clinical_ctx()
        user = make_user()
        patient = make_claimed_patient(user=user, created_by_center=center)
        document = upload_document(center, doctor, patient)

        before = client_for(user).get("/api/v1/patients/me/documents/")
        assert before.data["count"] == 1
        assert set(before.data["results"][0].keys()) == PATIENT_DOCUMENT_FIELDS

        archived = client_for(doctor).post(
            f"{url(center, patient)}{document.pk}/archive/"
        )
        assert archived.status_code == 200, archived.content
        assert archived.data["archived_at"] is not None

        # Staff list keeps the row (correction state visible)…
        staff_list = client_for(doctor).get(url(center, patient))
        assert staff_list.data["count"] == 1
        assert staff_list.data["results"][0]["archived_at"] is not None
        # …the patient no longer sees it, list AND download.
        after = client_for(user).get("/api/v1/patients/me/documents/")
        assert after.data["count"] == 0
        assert client_for(user).get(
            f"/api/v1/patients/me/documents/{document.pk}/download/"
        ).status_code == 404

    def test_double_archive_is_400_and_unarchiving_is_impossible(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient)
        archive_url = f"{url(center, patient)}{document.pk}/archive/"

        assert client_for(doctor).post(archive_url).status_code == 200
        second = client_for(doctor).post(archive_url)
        assert second.status_code == 400
        assert "déjà archivé" in str(second.data)

        document.refresh_from_db()
        document.archived_at = None
        with pytest.raises(Exception, match="définitif"):
            document.save()

    def test_archive_audit_has_references_never_the_title(self):
        center, doctor, patient = clinical_ctx()
        document = upload_document(center, doctor, patient, title="IRM cérébrale")
        client_for(doctor).post(f"{url(center, patient)}{document.pk}/archive/")
        entry = AuditLog.objects.get(
            action=AuditAction.PATIENT_DOCUMENT_ARCHIVED
        )
        assert entry.payload["document_id"] == document.pk
        assert "IRM" not in str(entry.payload)


class TestPatientDocumentTransversal:
    def test_patient_reads_and_downloads_across_centers(self):
        center_a, doctor_a, _ = clinical_ctx()
        user = make_user()
        patient = make_claimed_patient(user=user, created_by_center=center_a)
        document = upload_document(center_a, doctor_a, patient)

        listed = client_for(user).get("/api/v1/patients/me/documents/")
        assert listed.data["count"] == 1
        assert listed.data["results"][0]["center_name"] == center_a.name

        download = client_for(user).get(
            f"/api/v1/patients/me/documents/{document.pk}/download/"
        )
        assert download.status_code == 200
        assert b"".join(download.streaming_content).startswith(b"\x89PNG")

    def test_another_patients_document_is_a_deterministic_404(self):
        center, doctor, other_patient = clinical_ctx()
        document = upload_document(center, doctor, other_patient)
        user = make_user()
        make_claimed_patient(user=user)
        assert client_for(user).get(
            f"/api/v1/patients/me/documents/{document.pk}/download/"
        ).status_code == 404
