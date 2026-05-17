"""Project workspace helpers: transitions, OCR caps, asset OCR lifecycle."""

from __future__ import annotations

from django.conf import settings
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
