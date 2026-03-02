from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ArchitecturalStructure,
    DataSource,
    Deity,
    Event,
    Festival,
    Guthi,
    HeritageAssertion,
    HistoricalPeriod,
    IconographicObject,
    Location,
    Monument,
    Person,
    PersonRevision,
    RitualEvent,
    Source,
    Tradition,
)


# =====================================================================
# SHARED METADATA MIXIN for all CIDOC domain admin classes
# =====================================================================

class MetaDataMixin:
    """Common config for models inheriting MetaData."""
    readonly_fields = ("created_at",)

    def status_colored(self, obj):
        color_map = {
            "pending_review": "#FFA500",
            "accepted": "#008000",
            "rejected": "#FF0000",
        }
        color = color_map.get(obj.status or "", "#808080")
        return format_html('<b style="color:{};">{}</b>', color, obj.status or "—")
    status_colored.short_description = "Status"

    def contributor_short(self, obj):
        return obj.contributor or "—"
    contributor_short.short_description = "Contributor"


# =====================================================================
# CORE DOMAIN MODELS
# =====================================================================

class PersonRevisionInline(admin.TabularInline):
    model = PersonRevision
    extra = 0
    readonly_fields = ("revision_id", "user", "action", "timestamp")
    fields = ("action", "user", "snapshot", "timestamp")


@admin.register(Person)
class PersonAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "occupation", "birth_date", "death_date", "status_colored", "contributor_short", "created_at")
    list_filter = ("status", "occupation", "created_at")
    search_fields = ("name", "aliases", "occupation", "biography")
    ordering = ("-created_at",)
    list_per_page = 25
    inlines = [PersonRevisionInline]


@admin.register(Location)
class LocationAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "type", "current_status", "coordinates", "status_colored", "contributor_short", "created_at")
    list_filter = ("type", "current_status", "status", "created_at")
    search_fields = ("name", "description", "coordinates")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(Event)
class EventAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "type", "recurrence", "start_date", "status_colored", "contributor_short", "created_at")
    list_filter = ("type", "recurrence", "status", "created_at")
    search_fields = ("name", "description")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(HistoricalPeriod)
class HistoricalPeriodAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "start_year", "end_year", "status_colored", "contributor_short", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("name", "description")
    ordering = ("name",)
    list_per_page = 25


@admin.register(Tradition)
class TraditionAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "type", "status_colored", "contributor_short", "created_at")
    list_filter = ("type", "status", "created_at")
    search_fields = ("name", "description", "associated_materials")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(Source)
class SourceAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("title", "authors_short", "type", "publication_year", "status_colored", "contributor_short", "created_at")
    list_filter = ("type", "status", "created_at")
    search_fields = ("title", "authors")
    ordering = ("-created_at",)
    list_per_page = 25

    def authors_short(self, obj):
        if not obj.authors:
            return "—"
        return (obj.authors[:40] + "...") if len(obj.authors) > 40 else obj.authors
    authors_short.short_description = "Authors"


# =====================================================================
# ONTOLOGY-DRIVEN MODELS
# =====================================================================

@admin.register(Deity)
class DeityAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "religious_tradition", "status_colored", "contributor_short", "created_at")
    list_filter = ("religious_tradition", "status", "created_at")
    search_fields = ("name", "alternate_names", "note")
    ordering = ("name",)
    list_per_page = 25


@admin.register(Guthi)
class GuthiAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "guthi_type", "location", "status_colored", "contributor_short", "created_at")
    list_filter = ("guthi_type", "status", "created_at")
    search_fields = ("name", "location", "managed_structures", "note")
    ordering = ("name",)
    list_per_page = 25


@admin.register(ArchitecturalStructure)
class ArchitecturalStructureAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "structure_type", "architectural_style", "existence_status", "condition", "status_colored", "created_at")
    list_filter = ("structure_type", "architectural_style", "existence_status", "condition", "status", "created_at")
    search_fields = ("name", "location_name", "note")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(RitualEvent)
class RitualEventAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "ritual_type", "date", "location_name", "status_colored", "contributor_short", "created_at")
    list_filter = ("ritual_type", "status", "created_at")
    search_fields = ("name", "performed_by", "location_name", "note")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(Festival)
class FestivalAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "festival_type", "date", "duration", "location_name", "status_colored", "created_at")
    list_filter = ("festival_type", "status", "created_at")
    search_fields = ("name", "location_name", "note")
    ordering = ("name",)
    list_per_page = 25


@admin.register(IconographicObject)
class IconographicObjectAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "object_type", "depicts_deity", "technique", "status_colored", "contributor_short", "created_at")
    list_filter = ("object_type", "status", "created_at")
    search_fields = ("name", "depicts_deity", "technique", "note")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(Monument)
class MonumentAdmin(MetaDataMixin, admin.ModelAdmin):
    list_display = ("name", "monument_type", "existence_status", "location_name", "status_colored", "contributor_short", "created_at")
    list_filter = ("monument_type", "existence_status", "status", "created_at")
    search_fields = ("name", "location_name", "note")
    ordering = ("-created_at",)
    list_per_page = 25


# =====================================================================
# PROVENANCE MODELS
# =====================================================================

@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ("name", "source_type", "author", "publication_year", "created_at")
    list_filter = ("source_type", "created_at")
    search_fields = ("name", "author", "citation")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25


@admin.register(HeritageAssertion)
class HeritageAssertionAdmin(admin.ModelAdmin):
    list_display = ("id_short", "content_type", "asserted_property", "confidence", "reconciliation_colored", "contributed_by", "created_at")
    list_filter = ("confidence", "reconciliation_status", "content_type", "created_at")
    search_fields = ("asserted_property", "asserted_value", "assertion_content", "contributed_by")
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
    list_per_page = 25

    fieldsets = (
        ("Assertion Target", {
            "fields": ("id", "content_type", "object_id"),
        }),
        ("Claim", {
            "fields": ("asserted_property", "asserted_value", "assertion_content"),
        }),
        ("Provenance", {
            "fields": ("source", "source_citation", "contributed_by", "confidence", "data_quality_note"),
        }),
        ("Moderation", {
            "fields": ("reconciliation_status", "supersedes"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
        }),
    )

    def id_short(self, obj):
        return str(obj.id)[:8] + "..."
    id_short.short_description = "ID"

    def reconciliation_colored(self, obj):
        color_map = {
            "pending": "#FFA500",
            "accepted": "#008000",
            "disputed": "#FF0000",
            "superseded": "#808080",
        }
        color = color_map.get(obj.reconciliation_status, "#000000")
        return format_html('<b style="color:{};">{}</b>', color, obj.get_reconciliation_status_display())
    reconciliation_colored.short_description = "Status"


@admin.register(PersonRevision)
class PersonRevisionAdmin(admin.ModelAdmin):
    list_display = ("revision_id", "person", "user", "action", "timestamp")
    list_filter = ("action", "timestamp")
    search_fields = ("person__name", "user")
    ordering = ("-timestamp",)