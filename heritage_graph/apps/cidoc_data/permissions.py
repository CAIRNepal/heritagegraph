from rest_framework import permissions


class CidocObjectEditPermission(permissions.BasePermission):
    """
    Object-level: only the stored `contributor` username, staff, or superuser
    may update or delete a CIDOC model instance.
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
        return contributor == request.user.username
