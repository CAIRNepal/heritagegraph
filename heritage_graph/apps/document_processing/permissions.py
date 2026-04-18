# apps/document_processing/permissions.py
from __future__ import annotations

from apps.heritage_data.permissions import IsEditor
from rest_framework import permissions


def uploaded_document_owner(user, obj) -> bool:
    """
    Return True if `user` owns the parent contribution object for this OCR document.
    """
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_staff", False):
        return True

    if (
        obj.submission_id
        and obj.submission
        and obj.submission.contributor_id == user.id
    ):
        return True
    if (
        obj.cultural_entity_id
        and obj.cultural_entity
        and obj.cultural_entity.contributor_id == user.id
    ):
        return True
    return False


class IsStaffOrDocumentOwner(permissions.BasePermission):
    """
    Staff can access any UploadedDocument; authenticated users can access their own.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return uploaded_document_owner(request.user, obj)


class CanRequeueOcrDocument(permissions.BasePermission):
    """Only staff (IsEditor) may trigger retries/requeues."""

    def has_permission(self, request, view):
        return IsEditor().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        return IsEditor().has_object_permission(request, view, obj)
