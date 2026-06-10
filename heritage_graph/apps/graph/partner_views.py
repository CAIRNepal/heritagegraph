"""Partner institution API (multi-site pilot)."""

from apps.graph.models import PartnerInstitution
from apps.graph.partner_serializers import PartnerInstitutionSerializer
from rest_framework import permissions, viewsets


class PartnerInstitutionViewSet(viewsets.ModelViewSet):
    queryset = PartnerInstitution.objects.filter(is_active=True)
    serializer_class = PartnerInstitutionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    search_fields = ["name", "country_code", "ror_id"]
