"""Partner institution API (multi-site pilot)."""

from apps.graph.models import PartnerInstitution
from apps.graph.partner_serializers import PartnerInstitutionSerializer
from rest_framework import permissions, viewsets


class PartnerInstitutionViewSet(viewsets.ModelViewSet):
    queryset = PartnerInstitution.objects.filter(is_active=True)
    serializer_class = PartnerInstitutionSerializer
    # Reading is public; listing an institution as a partner is staff work.
    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]
    search_fields = ["name", "country_code", "ror_id"]
