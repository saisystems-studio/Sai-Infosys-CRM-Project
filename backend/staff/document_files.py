from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError


MAX_STAFF_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".csv",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "image/jpeg",
    "image/png",
    "image/webp",
}


def validate_staff_document(upload):
    extension = Path(upload.name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"{upload.name}: file type is not supported.")
    if upload.size > MAX_STAFF_DOCUMENT_BYTES:
        raise ValidationError(f"{upload.name}: maximum size is 10 MB.")
    if upload.content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"{upload.name}: file content type is not supported."
        )
    return upload


def staff_document_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return f"staff/documents/{instance.Staff_Id_id}/{uuid4().hex}{extension}"


def delete_media_file_safely(field_file):
    if not field_file or not field_file.name:
        return

    media_root = Path(settings.MEDIA_ROOT).resolve()
    try:
        resolved_path = Path(field_file.path).resolve()
    except (NotImplementedError, ValueError):
        field_file.storage.delete(field_file.name)
        return

    if resolved_path == media_root or media_root not in resolved_path.parents:
        raise ValueError("Refusing to delete a file outside MEDIA_ROOT.")

    field_file.storage.delete(field_file.name)
