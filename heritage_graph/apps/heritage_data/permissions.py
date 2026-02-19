# heritage_data/permissions.py
from rest_framework import permissions


class IsContributorOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow contributors of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.contributor == request.user


class IsReviewerOrAdmin(permissions.BasePermission):
    """
    Any reviewer role (community, domain expert, or expert curator) or staff.
    """
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        return hasattr(request.user, 'reviewer_role') and request.user.reviewer_role.is_active


class IsEditor(permissions.BasePermission):
    """
    Permission to only allow editors (staff users) to access.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_staff

    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_staff


class IsCommunityReviewer(permissions.BasePermission):
    """
    Community reviewer — can approve clear cases, flag for expert, request changes.
    Cannot override confidence scores or resolve theological conflicts.
    """
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        if not hasattr(request.user, 'reviewer_role'):
            return False
        return (
            request.user.reviewer_role.is_active
            and request.user.reviewer_role.role in (
                'community_reviewer', 'domain_expert', 'expert_curator'
            )
        )


class IsDomainExpert(permissions.BasePermission):
    """
    Domain expert — can verify claims, adjust confidence, reconcile conflicts.
    """
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        if not hasattr(request.user, 'reviewer_role'):
            return False
        return (
            request.user.reviewer_role.is_active
            and request.user.reviewer_role.role in ('domain_expert', 'expert_curator')
        )


class IsExpertCurator(permissions.BasePermission):
    """
    Expert curator — full access including reconciliation, supersession,
    data export, manages Verification records, assigns reviewer roles.
    """
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        if not hasattr(request.user, 'reviewer_role'):
            return False
        return (
            request.user.reviewer_role.is_active
            and request.user.reviewer_role.role == 'expert_curator'
        )