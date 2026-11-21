from rest_framework import permissions

from .care_validation import ACCESS_TIER_SENSITIVE


class CidocObjectEditPermission(permissions.BasePermission):
    """
    Object-level: only the stored `contributor` username, staff, or superuser
    may update or delete a CIDOC model instance. Rows promoted from anonymous
    QR contributions (``contributor="qr:<name>"``) are curatable by any active
    reviewer — the field visitor has no account, and the promoting reviewer
    must be able to verify/complete the draft.
    Unauthenticated users are always denied; pair with `IsAuthenticated` for writes.
    """

    message = "You do not have permission to edit this contribution."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        contributor = getattr(obj, "contributor", None)
        if contributor in (None, ""):
            return request.user.is_staff
        if str(contributor).startswith("qr:"):
            role = getattr(request.user, "reviewer_role", None)
            return bool(role and role.is_active)
        return contributor == request.user.username


class CAREAccessPermission(permissions.BasePermission):
    """
    Enforces CARE / TK label access tiers on DataSource objects.

    - `sensitive_indigenous` objects are only visible to authenticated staff
      or users whose group includes "Reviewers" or "Moderators".
    - All other tiers pass through (additional enforcement happens at the
      SPARQL proxy layer for triple-level filtering).
    """

    message = "This source is restricted by CARE / Traditional Knowledge access controls."

    def has_object_permission(self, request, view, obj):
        tier = getattr(obj, "access_tier", "public")
        if tier != ACCESS_TIER_SENSITIVE:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        return user.groups.filter(name__in=["Reviewers", "Moderators"]).exists()


class DataSourceUploadPermission(permissions.BasePermission):
    """Authenticated users may upload; unauthenticated users may only read public sources."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated
