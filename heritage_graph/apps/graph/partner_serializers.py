from apps.graph.models import PartnerInstitution
from rest_framework import serializers


class PartnerInstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerInstitution
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
