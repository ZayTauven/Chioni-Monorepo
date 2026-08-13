"""Uploads — hardened pipeline (apps/common/uploads.py), logo and avatar API.

The upload gate is an attack surface: these tests pin every rule of the
pipeline (real-format whitelist, size/dimension caps, EXIF strip, uuid
renaming) and the permission matrix of the two endpoints (director-only
logo, self-only avatar), plus the no-orphan replacement contract.
"""

from io import BytesIO
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from PIL.ExifTags import GPS, IFD

from apps.audit.models import AuditLog
from apps.common.uploads import MAX_UPLOAD_BYTES, process_image_upload

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .factories import make_user

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Image builders
# ---------------------------------------------------------------------------


def image_bytes(fmt="PNG", size=(64, 64), color="red", **save_kwargs):
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def upload(content, name="photo.png", content_type="image/png"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def jpeg_with_gps_exif():
    """A JPEG carrying a Make tag and a GPS IFD (latitude) — the metadata
    a phone photo leaks and the pipeline must strip."""
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    gps = exif.get_ifd(IFD.GPSInfo)
    gps[GPS.GPSLatitudeRef] = "N"
    gps[GPS.GPSLatitude] = (11.0, 42.0, 0.0)
    buf = BytesIO()
    Image.new("RGB", (64, 64), "blue").save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


SVG_BYTES = (
    b'<svg xmlns="http://www.w3.org/2000/svg">'
    b'<script>alert("xss")</script></svg>'
)


# ---------------------------------------------------------------------------
# The pipeline itself
# ---------------------------------------------------------------------------


class TestProcessImageUpload:
    def test_svg_is_refused_even_with_image_extension_and_content_type(self):
        """SVG = scriptable XML (stored XSS). Neither the .png name nor the
        image/png content-type may smuggle it through: content decides."""
        with pytest.raises(ValidationError):
            process_image_upload(upload(SVG_BYTES, name="logo.png"))
        with pytest.raises(ValidationError):
            process_image_upload(
                upload(SVG_BYTES, name="logo.svg", content_type="image/svg+xml")
            )

    def test_png_disguised_as_jpg_is_accepted_and_stored_by_real_format(self):
        """Extension lies are ignored: PNG bytes named « photo.jpg » are
        stored under a uuid name with the REAL extension .png."""
        result = process_image_upload(
            upload(image_bytes("PNG"), name="photo.jpg", content_type="image/jpeg")
        )
        assert result.name.endswith(".png")
        assert Image.open(BytesIO(result.read())).format == "PNG"

    def test_client_filename_never_survives(self):
        result = process_image_upload(
            upload(image_bytes("PNG"), name="../../evil name!.png")
        )
        stem = result.name.rsplit(".", 1)[0]
        assert "/" not in result.name and "\\" not in result.name
        assert len(stem) == 32 and all(c in "0123456789abcdef" for c in stem)

    def test_gif_is_refused(self):
        with pytest.raises(ValidationError):
            process_image_upload(upload(image_bytes("GIF"), name="anim.gif"))

    def test_garbage_bytes_are_refused(self):
        with pytest.raises(ValidationError):
            process_image_upload(upload(b"\x00\x01not-an-image", name="x.png"))

    def test_oversized_file_is_refused(self):
        blob = b"x" * (MAX_UPLOAD_BYTES + 1)
        with pytest.raises(ValidationError, match="2 Mo"):
            process_image_upload(upload(blob, name="big.png"))

    def test_oversized_dimensions_are_refused(self):
        too_wide = image_bytes("PNG", size=(2049, 10))
        with pytest.raises(ValidationError, match="2048"):
            process_image_upload(upload(too_wide))

    def test_2048_square_is_accepted(self):
        result = process_image_upload(upload(image_bytes("PNG", size=(2048, 1))))
        assert result.name.endswith(".png")

    def test_webp_is_accepted(self):
        result = process_image_upload(
            upload(image_bytes("WEBP"), name="pic.webp", content_type="image/webp")
        )
        assert result.name.endswith(".webp")

    def test_exif_gps_is_stripped_by_reencode(self):
        source = jpeg_with_gps_exif()
        # Sanity: the input really carries GPS metadata.
        parsed = Image.open(BytesIO(source))
        assert dict(parsed.getexif().get_ifd(IFD.GPSInfo))

        result = process_image_upload(
            upload(source, name="photo.jpg", content_type="image/jpeg")
        )
        cleaned = Image.open(BytesIO(result.read()))
        assert not dict(cleaned.getexif()), "EXIF survived the re-encode"
        assert not dict(cleaned.getexif().get_ifd(IFD.GPSInfo))


# ---------------------------------------------------------------------------
# Center logo endpoint
# ---------------------------------------------------------------------------


def logo_url(center):
    return f"/api/v1/centers/{center.pk}/logo/"


def post_logo(client, center, name="logo.png"):
    return client.post(
        logo_url(center), {"file": upload(image_bytes(), name=name)},
        format="multipart",
    )


class TestCenterLogo:
    def test_anonymous_is_401(self):
        center, _ = make_center_with_director()
        assert post_logo(client_for(), center).status_code == 401

    def test_director_uploads_logo(self):
        center, director = make_center_with_director()
        response = post_logo(client_for(director), center)
        assert response.status_code == 200, response.content
        assert response.data["logo"].startswith("http")
        center.refresh_from_db()
        assert center.logo.name.startswith(f"centers/{center.pk}/logo/")
        assert Path(center.logo.path).exists()
        assert AuditLog.objects.filter(
            action="center.updated", payload__fields="logo"
        ).count() == 1

    def test_cashier_is_403(self):
        center, _ = make_center_with_director()
        cashier = make_staff_user(center, role=Role.CASHIER)
        assert post_logo(client_for(cashier), center).status_code == 403

    def test_foreign_center_is_404_even_for_a_director_elsewhere(self):
        center, _ = make_center_with_director()
        _other, other_director = make_center_with_director(name="Autre")
        assert post_logo(client_for(other_director), center).status_code == 404

    def test_svg_upload_is_400(self):
        center, director = make_center_with_director()
        response = client_for(director).post(
            logo_url(center), {"file": upload(SVG_BYTES, name="logo.png")},
            format="multipart",
        )
        assert response.status_code == 400

    def test_replacement_leaves_no_orphan_file(self):
        center, director = make_center_with_director()
        client = client_for(director)
        assert post_logo(client, center).status_code == 200
        center.refresh_from_db()
        first_path = Path(center.logo.path)
        assert first_path.exists()

        assert post_logo(client, center).status_code == 200
        center.refresh_from_db()
        second_path = Path(center.logo.path)
        assert second_path.exists()
        assert not first_path.exists(), "previous logo file orphaned on disk"
        assert first_path != second_path

    def test_delete_removes_field_and_file(self):
        center, director = make_center_with_director()
        client = client_for(director)
        post_logo(client, center)
        center.refresh_from_db()
        path = Path(center.logo.path)

        response = client.delete(logo_url(center))
        assert response.status_code == 200
        assert response.data == {"logo": None}
        center.refresh_from_db()
        assert not center.logo
        assert not path.exists()

    def test_delete_without_logo_is_400(self):
        center, director = make_center_with_director()
        assert client_for(director).delete(logo_url(center)).status_code == 400

    def test_delete_is_director_only(self):
        center, director = make_center_with_director()
        post_logo(client_for(director), center)
        cashier = make_staff_user(center, role=Role.CASHIER)
        assert client_for(cashier).delete(logo_url(center)).status_code == 403

    def test_logo_exposed_in_center_detail_and_auth_me(self):
        center, director = make_center_with_director()
        client = client_for(director)
        detail = client.get(f"/api/v1/centers/{center.pk}/")
        assert detail.data["logo"] is None

        post_logo(client, center)
        detail = client.get(f"/api/v1/centers/{center.pk}/")
        assert detail.data["logo"].startswith("http")

        me = client.get("/api/v1/auth/me/")
        assert me.data["staff_memberships"][0]["center"]["logo"].startswith("http")


# ---------------------------------------------------------------------------
# User avatar endpoint
# ---------------------------------------------------------------------------

AVATAR_URL = "/api/v1/auth/me/avatar/"


def post_avatar(client):
    return client.post(
        AVATAR_URL, {"file": upload(image_bytes())}, format="multipart"
    )


class TestUserAvatar:
    def test_anonymous_is_401(self):
        assert post_avatar(client_for()).status_code == 401

    def test_any_authenticated_user_sets_their_own_avatar(self):
        user = make_user()
        response = post_avatar(client_for(user))
        assert response.status_code == 200, response.content
        assert response.data["avatar"].startswith("http")
        user.refresh_from_db()
        assert user.avatar.name.startswith(f"avatars/{user.pk}/")

    def test_avatar_lands_on_own_account_only(self):
        """The endpoint carries no target id: two users uploading in
        parallel each touch their own row, nothing else."""
        alice, omar = make_user(), make_user()
        post_avatar(client_for(alice))
        omar.refresh_from_db()
        assert not omar.avatar

    def test_replacement_leaves_no_orphan_file(self):
        user = make_user()
        client = client_for(user)
        post_avatar(client)
        user.refresh_from_db()
        first_path = Path(user.avatar.path)
        assert first_path.exists()

        post_avatar(client)
        user.refresh_from_db()
        assert Path(user.avatar.path).exists()
        assert not first_path.exists(), "previous avatar file orphaned on disk"

    def test_delete_removes_field_and_file(self):
        user = make_user()
        client = client_for(user)
        post_avatar(client)
        user.refresh_from_db()
        path = Path(user.avatar.path)

        response = client.delete(AVATAR_URL)
        assert response.status_code == 200
        assert response.data == {"avatar": None}
        user.refresh_from_db()
        assert not user.avatar
        assert not path.exists()

    def test_delete_without_avatar_is_400(self):
        assert client_for(make_user()).delete(AVATAR_URL).status_code == 400

    def test_avatar_exposed_in_me_and_staff_directory(self):
        center, director = make_center_with_director()
        nurse = make_staff_user(center, role=Role.NURSE)
        post_avatar(client_for(nurse))

        me = client_for(nurse).get("/api/v1/auth/me/")
        assert me.data["avatar"].startswith("http")

        staff = client_for(director).get(f"/api/v1/centers/{center.pk}/staff/")
        by_id = {row["user"]["id"]: row for row in staff.data["results"]}
        assert by_id[nurse.pk]["user"]["avatar"].startswith("http")
        assert by_id[director.pk]["user"]["avatar"] is None

    def test_missing_file_field_is_400(self):
        response = client_for(make_user()).post(AVATAR_URL, {}, format="multipart")
        assert response.status_code == 400
