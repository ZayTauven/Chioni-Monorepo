"""Hardened image-upload pipeline — the ONE gate for every uploaded file.

An upload endpoint is an attack surface: files are attacker-controlled bytes
that will later be SERVED back to browsers and embedded in receipts/invoices.
Every image reaching a Chioni ``ImageField`` (center logo, user avatar) MUST
go through :func:`process_image_upload`. Rules, each enforced below:

1. **Real-format whitelist — JPEG / PNG / WebP only, never SVG.** SVG is
   scriptable XML: served inline it executes JavaScript (stored XSS). GIF is
   also excluded (no use case, animation vector). The format is what Pillow
   DECODES from the bytes — never the file extension nor the client
   ``Content-Type``, both attacker-chosen.
2. **Content verification by Pillow** — ``Image.open()`` + ``verify()`` on
   the actual bytes. A polyglot or corrupt file that does not parse as one of
   the allowed formats is refused with a single generic French message.
3. **Size cap: 2 MB**, checked FIRST (before any parsing — cheapest refusal,
   no attacker bytes are ever decoded past this point).
4. **Dimension cap: 2048×2048**, read from the image HEADER (``Image.open``
   is lazy: ``.size`` needs no pixel decode), so a decompression bomb —
   a tiny file declaring enormous dimensions — is refused before its pixels
   are ever allocated.
5. **Metadata strip by re-encode.** The image is re-encoded from pixels into
   a fresh buffer: EXIF (GPS position of the phone that took the photo…),
   ICC, XMP and any trailing payload smuggled after the image data never
   reach disk. ``exif_transpose`` is applied FIRST so stripping the
   orientation tag does not visually rotate the photo; ``info.clear()`` +
   ``exif=b""`` close the plugin-specific carry-over paths (WebP re-emits
   ``info["exif"]``/``info["icc_profile"]`` silently).
6. **Filename re-normalisation** — the stored name is ``uuid4().hex`` plus
   the extension deduced from the REAL decoded format. The client-supplied
   name (path traversal, ``.svg`` double extensions, reserved names) never
   touches the filesystem.

Animated inputs (animated WebP) keep only their first frame — a logo or an
avatar is a still image by contract.
"""

from io import BytesIO
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

#: Rule 3 — refuse anything bigger before parsing a single byte.
MAX_UPLOAD_BYTES = 2 * 1024 * 1024

#: Rule 4 — logos and avatars never need more; bombs declare much more.
MAX_DIMENSION = 2048

#: Rule 1 — decoded Pillow format → safe storage extension. Closed list:
#: anything absent (SVG, GIF, TIFF, BMP…) is refused whatever its name says.
ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}

#: One generic refusal for unreadable/forbidden content — the uploader gets
#: the accepted formats, never a parser stack trace.
INVALID_IMAGE_ERROR = (
    "Image invalide : formats acceptés JPEG, PNG ou WebP (2 Mo maximum)."
)


def process_image_upload(uploaded_file):
    """Validate, sanitise and re-encode an uploaded image.

    Returns a :class:`~django.core.files.base.ContentFile` carrying the
    re-encoded bytes and a ``uuid4`` name (safe extension included) — ready
    to hand to ``ImageField.save()``. Raises Django ``ValidationError``
    (French message) on any rule violation.
    """
    # Rule 3 — size first: cheapest check, nothing attacker-controlled is
    # parsed for an oversized file.
    if uploaded_file.size > MAX_UPLOAD_BYTES:
        raise ValidationError("L'image dépasse la taille maximale de 2 Mo.")

    # Rule 1 + 2 — identify by CONTENT. Pillow sniffs magic bytes and picks
    # the decoder; extension and Content-Type play no role here.
    try:
        uploaded_file.seek(0)
        probe = Image.open(uploaded_file)
        detected_format = probe.format
        width, height = probe.size
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError(INVALID_IMAGE_ERROR)

    if detected_format not in ALLOWED_FORMATS:
        # SVG lands here too: Pillow has no SVG decoder, so an SVG upload is
        # an UnidentifiedImageError above — this branch catches decodable
        # but non-whitelisted formats (GIF, BMP, TIFF…).
        raise ValidationError(INVALID_IMAGE_ERROR)

    # Rule 4 — header dimensions, BEFORE any pixel decode (bombs stop here).
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise ValidationError(
            f"L'image dépasse {MAX_DIMENSION}×{MAX_DIMENSION} pixels."
        )

    # Rule 2 — structural integrity check. verify() consumes the object, so
    # the image is re-opened afterwards for the re-encode.
    try:
        probe.verify()
        uploaded_file.seek(0)
        image = Image.open(uploaded_file)
        # Rule 5 — apply the EXIF orientation to the PIXELS before the tag
        # is stripped (otherwise phone photos would show sideways).
        image = ImageOps.exif_transpose(image)
        image = _normalise_mode(image, detected_format)
        # Close the silent metadata carry-over: some encoders (WebP) re-emit
        # info["exif"] / info["icc_profile"] unless removed. Transparency is
        # already in the pixels after _normalise_mode, so nothing needed
        # for a faithful save remains in info.
        image.info.clear()
        buffer = BytesIO()
        save_kwargs = {"quality": 90} if detected_format in ("JPEG", "WEBP") else {}
        image.save(buffer, format=detected_format, exif=b"", **save_kwargs)
    except ValidationError:
        raise
    except Exception:
        # Truncated stream, decoder error mid-pixels… — same generic refusal.
        raise ValidationError(INVALID_IMAGE_ERROR)

    # Rule 6 — uuid name + extension from the DECODED format. A PNG uploaded
    # as « photo.jpg » is stored as « <uuid>.png »: disk truth = bytes truth.
    name = f"{uuid4().hex}{ALLOWED_FORMATS[detected_format]}"
    return ContentFile(buffer.getvalue(), name=name)


def _normalise_mode(image, detected_format):
    """Convert pixel modes the target encoder cannot write.

    - JPEG has no alpha channel: palette/alpha modes become RGB;
    - WebP encodes RGB/RGBA only: palette modes become RGBA (alpha kept);
    - PNG: palette images are expanded to RGBA so their transparency lives
      in the PIXELS — ``info["transparency"]`` is metadata and rule 5 clears
      ``info`` before saving.
    """
    if detected_format == "JPEG":
        if image.mode not in ("RGB", "L"):
            return image.convert("RGB")
    elif detected_format == "WEBP":
        if image.mode not in ("RGB", "RGBA"):
            return image.convert("RGBA")
    elif detected_format == "PNG":
        if image.mode == "P":
            return image.convert("RGBA")
    return image


def media_url(request, filefield):
    """Absolute URL of a stored media file, or ``None`` when empty.

    Serializers exposing ``logo`` / ``avatar`` all answer the same shape:
    a fully-qualified URL the frontend can drop into ``<img src>`` (falls
    back to the relative ``MEDIA_URL`` path when no request is available,
    e.g. in shell usage).
    """
    if not filefield:
        return None
    url = filefield.url
    return request.build_absolute_uri(url) if request is not None else url


def replace_file(instance, field_name, content):
    """Point ``field_name`` at ``content`` and delete the previous file.

    No-orphan contract: the model row is saved FIRST (the DB now references
    the new file), then the previous physical file is removed from storage.
    If the delete itself failed, the worst case is one stale file — never a
    row pointing at a missing one. Callers run inside a service transaction;
    storage writes are not transactional anyway, so ordering is the only
    protection that exists — hence this single shared implementation.
    """
    field = getattr(instance, field_name)
    old_name = field.name if field else ""
    field.save(content.name, content, save=True)  # writes file + model row
    if old_name:
        field.storage.delete(old_name)


def clear_file(instance, field_name):
    """Empty ``field_name`` and physically delete its file (no orphans).

    Returns True when there was a file to remove, False otherwise.
    """
    field = getattr(instance, field_name)
    if not field:
        return False
    old_name = field.name
    setattr(instance, field_name, "")
    update_fields = [field_name]
    # TimeStampedModel rows keep their auto_now column honest; plain models
    # (User is an AbstractUser without updated_at) just skip it.
    if any(f.name == "updated_at" for f in instance._meta.fields):
        update_fields.append("updated_at")
    instance.save(update_fields=update_fields)
    field.storage.delete(old_name)
    return True
