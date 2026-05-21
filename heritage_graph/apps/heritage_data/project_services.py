"""Project workspace helpers: transitions, OCR caps, asset OCR lifecycle."""

from __future__ import annotations

import logging
import pathlib

from django.conf import settings

logger = logging.getLogger(__name__)
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.document_processing.services.ocr_settings import get_ocr_settings

from .models import Project, ProjectMembership

# Allowed state transitions (from state -> set of target states).
_PROJECT_TRANSITIONS = {
    Project.STATE_DRAFT: {Project.STATE_IN_REVIEW, Project.STATE_WITHDRAWN},
    Project.STATE_IN_REVIEW: {
        Project.STATE_APPROVED,
        Project.STATE_NEEDS_REVISION,
        Project.STATE_WITHDRAWN,
    },
    Project.STATE_NEEDS_REVISION: {Project.STATE_IN_REVIEW, Project.STATE_WITHDRAWN},
    Project.STATE_APPROVED: {Project.STATE_MERGED, Project.STATE_WITHDRAWN},
    Project.STATE_MERGED: set(),
    Project.STATE_WITHDRAWN: {Project.STATE_DRAFT},
}

_CONTRIBUTOR_TARGETS = {
    Project.STATE_IN_REVIEW,
    Project.STATE_WITHDRAWN,
    Project.STATE_DRAFT,
}

_REVIEWER_TARGETS = {Project.STATE_APPROVED, Project.STATE_NEEDS_REVISION}

_MERGE_TARGETS = {Project.STATE_MERGED}


def user_can_review_project(user, project: Project) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if user.groups.filter(name="Reviewers").exists():
        return True
    return project.memberships.filter(
        user=user,
        role=ProjectMembership.ROLE_DOMAIN_EXPERT,
    ).exists()


def user_can_merge_project(user, project: Project) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    return user.groups.filter(name="Moderators").exists()


def user_can_edit_project(user, project: Project) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or project.owner_id == user.id:
        return True
    return project.memberships.filter(
        user=user,
        role__in=[ProjectMembership.ROLE_OWNER, ProjectMembership.ROLE_EDITOR],
    ).exists()


def user_can_view_project(user, project: Project) -> bool:
    if project.visibility == Project.VISIBILITY_PUBLIC:
        return True
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or project.owner_id == user.id:
        return True
    return project.memberships.filter(user=user).exists()


def can_transition_project(user, project: Project, target: str) -> bool:
    allowed = _PROJECT_TRANSITIONS.get(project.state, set())
    if target not in allowed:
        return False
    if target in _REVIEWER_TARGETS:
        return user_can_review_project(user, project)
    if target in _MERGE_TARGETS:
        return user_can_merge_project(user, project)
    if target in _CONTRIBUTOR_TARGETS:
        return user_can_edit_project(user, project)
    return False


def validate_project_for_review(project: Project) -> list[str]:
    """Return human-readable blockers preventing transition to ``in_review``."""
    errors: list[str] = []
    abstract = (project.abstract or "").strip()
    if not abstract:
        errors.append("Abstract is required before submission.")
    if not project.assets.exists():
        errors.append("At least one evidence asset is required.")
    if not project.entities.exists():
        errors.append("At least one ontology entity must be linked.")

    busy_ocr = False
    assets = (
        project.assets.select_related("media").select_related("media__ocr_document").all()
    )
    for asset in assets:
        if get_asset_ocr_status(asset.media) in ("pending", "processing"):
            busy_ocr = True
            break
    if busy_ocr:
        errors.append("Wait for all OCR jobs to finish before submitting.")

    return errors


def get_allowed_project_transitions(user, project: Project) -> list[str]:
    candidates = _PROJECT_TRANSITIONS.get(project.state, set())
    return sorted(
        t for t in candidates if can_transition_project(user, project, t)
    )


def project_ocr_starts_today(project: Project) -> int:
    from apps.document_processing.models import UploadedDocument

    today = timezone.localdate()
    return UploadedDocument.objects.filter(
        project=project,
        created_at__date=today,
    ).exclude(status="failed").count()


def assert_project_ocr_quota(project: Project) -> None:
    from rest_framework.exceptions import ValidationError

    limit = get_ocr_settings().max_runs_per_project_per_day
    if project_ocr_starts_today(project) >= limit:
        raise ValidationError(
            f"This project has reached the daily OCR limit ({limit} runs per day)."
        )


def is_document_media_file(file_field) -> bool:
    from apps.document_processing.signals import is_document_type

    return is_document_type(file_field)


def infer_media_type_from_filename(filename: str) -> str:
    name = (filename or "").lower()
    if any(name.endswith(ext) for ext in (".mp3", ".wav", ".ogg", ".m4a", ".flac")):
        return "audio"
    if any(name.endswith(ext) for ext in (".mp4", ".webm", ".mov", ".avi", ".mkv")):
        return "video"
    return "image"


def get_asset_ocr_status(media) -> str:
    if not hasattr(media, "ocr_document"):
        if getattr(media, "ocr_deferred", False) and is_document_media_file(media.file):
            return "not_started"
        return "not_applicable"
    return media.ocr_document.status


def sniff_upload_main_type(uploaded_file) -> str | None:
    """Best-effort MIME from first chunk (python-magic when available)."""
    head = uploaded_file.read(8192)
    uploaded_file.seek(0)
    try:
        import magic

        raw = magic.from_buffer(head, mime=True)
        if isinstance(raw, str):
            return raw.split(";")[0].strip().lower()
    except Exception:
        pass
    return _mime_from_magic_bytes(head)


def _mime_from_magic_bytes(buf: bytes) -> str | None:
    if buf.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(buf) >= 8 and buf.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if buf.startswith(b"RIFF") and len(buf) >= 12 and buf[8:12] == b"WEBP":
        return "image/webp"
    if buf.startswith(b"%PDF"):
        return "application/pdf"
    if len(buf) >= 2 and (buf.startswith(b"\xff\xfb") or buf.startswith(b"\xff\xfa")):
        return "audio/mpeg"
    if buf.startswith(b"ID3") or buf.startswith(b"\xff\xf3"):
        return "audio/mpeg"
    if len(buf) >= 12 and b"ftyp" in buf[:32]:
        return "video/mp4"
    return None


ALLOWED_PROJECT_ASSET_EXTENSIONS = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp3", ".mp4"}
)
ALLOWED_PROJECT_ASSET_MIME = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "audio/mpeg",
        "video/mp4",
    }
)


def validate_project_asset_file(upload_file) -> None:
    """Security-oriented checks for multipart project asset uploads."""
    from rest_framework.exceptions import ValidationError

    max_bytes = int(
        getattr(
            settings,
            "PROJECT_ASSET_UPLOAD_MAX_BYTES",
            getattr(settings, "OCR_MAX_FILE_BYTES", 50 * 1024 * 1024),
        )
    )
    size = getattr(upload_file, "size", None)
    if size is not None and size > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise ValidationError(f"File exceeds server limit ({mb} MB).")

    name = (getattr(upload_file, "name", "") or "").lower()
    ext = pathlib.Path(name).suffix.lower()
    if ext and ext not in ALLOWED_PROJECT_ASSET_EXTENSIONS:
        raise ValidationError(
            "Unsupported file extension. Allowed: .jpg, .jpeg, .png, .webp, .pdf, .mp3, .mp4."
        )

    detected = sniff_upload_main_type(upload_file)
    ext_mime = _extension_to_mime(ext) if ext else None
    if detected and ext_mime and detected != ext_mime:
        raise ValidationError(
            "File content does not match the claimed extension.",
        )

    mime = detected or ext_mime
    if mime is None or mime not in ALLOWED_PROJECT_ASSET_MIME:
        raise ValidationError(
            "Unsupported or unclear file type. Upload JPEG, PNG, WebP, PDF, MP3, or MP4."
        )


def _extension_to_mime(ext: str) -> str | None:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
    }.get(ext)


def queue_ocr_for_media(*, media, project: Project | None = None) -> str:
    """Create UploadedDocument if needed and queue OCR. Returns document id."""
    from apps.document_processing.models import UploadedDocument
    from apps.document_processing.tasks import classify_and_route_document

    if not getattr(settings, "OCR_ENABLED", True):
        raise ValueError("OCR is disabled on this server.")

    doc = UploadedDocument.objects.filter(media=media).first()
    if doc is None:
        doc = UploadedDocument.objects.create(
            media=media,
            document_type="image_print",
            status="pending",
            project=project,
        )
    elif project and doc.project_id is None:
        doc.project = project
        doc.save(update_fields=["project", "updated_at"])

    if doc.status in ("pending", "processing"):
        classify_and_route_document.delay(str(doc.id))
        return str(doc.id)

    if doc.status == "completed":
        return str(doc.id)

    doc.status = "pending"
    doc.error_message = ""
    doc.user_safe_error = ""
    doc.save(update_fields=["status", "error_message", "user_safe_error", "updated_at"])
    classify_and_route_document.delay(str(doc.id))
    return str(doc.id)


def build_merge_snapshot_payload(project: Project) -> dict:
    return {
        "project_id": str(project.id),
        "slug": project.slug,
        "title": project.title,
        "abstract": project.abstract or "",
        "entity_ids": [
            str(pk) for pk in project.entities.values_list("entity_id", flat=True)
        ],
    }


def notify_project_review_webhook(project: Project) -> None:
    url = (getattr(settings, "REVIEW_WEBHOOK_URL", None) or "").strip()
    if not url:
        return
    try:
        import requests

        requests.post(
            url,
            json={
                "project_id": str(project.id),
                "slug": project.slug,
                "title": project.title,
            },
            timeout=5,
        )
    except Exception as exc:
        logger.warning("Review webhook failed for %s: %s", project.slug, exc)
