from rest_framework import permissions


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
