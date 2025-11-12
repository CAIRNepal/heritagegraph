# heritage_data/permissions.py
from rest_framework import permissions

class IsContributorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.contributor == request.user


class IsReviewerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_staff
            or request.user.groups.filter(name="Reviewers").exists()
        )

class IsContributorOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow contributors of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions are only allowed to the contributor
        return obj.contributor == request.user

class IsEditor(permissions.BasePermission):
    """
    Permission to only allow editors (staff users) to access
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_staff
    
    def has_object_permission(self, request, view, obj):
        return request.user and request.user.is_staff