from apps.graph.models import PartnerInstitution, RDFSyncOutbox
from django.contrib import admin


@admin.register(RDFSyncOutbox)
class RDFSyncOutboxAdmin(admin.ModelAdmin):
    list_display = ("operation", "subject_uri", "attempts", "processed_at", "created_at")
    list_filter = ("operation", "processed_at")
    readonly_fields = ("created_at",)


@admin.register(PartnerInstitution)
class PartnerInstitutionAdmin(admin.ModelAdmin):
    list_display = ("name", "country_code", "ror_id", "is_active", "graph_partition_suffix")
    list_filter = ("is_active", "country_code")
    search_fields = ("name", "ror_id")
