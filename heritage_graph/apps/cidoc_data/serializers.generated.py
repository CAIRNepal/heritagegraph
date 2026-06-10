# AUTO-GENERATED — do not edit by hand.
# Run: python3 tools/generate_serializers.py   (or: make serializers)
#
# Contains DRF serializer stubs for every CIDOC entity mapped in
# cidoc_registry_keys.DJANGO_MODEL_TO_REGISTRY_CLASS_KEY, excluding the
# handful of models whose serializers are hand-written in serializers.py.
#
# Each stub inherits BaseRegistrySerializer which automatically validates
# inbound payloads against the LinkML-derived JSON Schema at runtime.

from __future__ import annotations

from .models import (
    ArchitecturalStructure,
    CalendarSystem,
    CasteGroup,
    Consecration,
    Deity,
    Enshrinement,
    Event,
    Festival,
    Guthi,
    HistoricalPeriod,
    IconographicObject,
    KumariRetirement,
    KumariSelection,
    KumariTenure,
    Location,
    Monument,
    Person,
    Production,
    RitualEvent,
    Source,
    SyncreticRelationship,
    Tradition,
    TransferOfCustody,
)
from .serializers import BaseRegistrySerializer


class ArchitecturalStructureGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for ArchitecturalStructure (registry key: structure)."""

    class Meta:
        model = ArchitecturalStructure
        fields = "__all__"


class CalendarSystemGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for CalendarSystem (registry key: calendar)."""

    class Meta:
        model = CalendarSystem
        fields = "__all__"


class CasteGroupGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for CasteGroup (registry key: caste_group)."""

    class Meta:
        model = CasteGroup
        fields = "__all__"


class ConsecrationGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Consecration (registry key: consecration)."""

    class Meta:
        model = Consecration
        fields = "__all__"


class DeityGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Deity (registry key: deity)."""

    class Meta:
        model = Deity
        fields = "__all__"


class EnshrinementGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Enshrinement (registry key: enshrinement)."""

    class Meta:
        model = Enshrinement
        fields = "__all__"


class EventGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Event (registry key: event)."""

    class Meta:
        model = Event
        fields = "__all__"


class FestivalGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Festival (registry key: festival)."""

    class Meta:
        model = Festival
        fields = "__all__"


class GuthiGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Guthi (registry key: guthi)."""

    class Meta:
        model = Guthi
        fields = "__all__"


class HistoricalPeriodGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for HistoricalPeriod (registry key: period)."""

    class Meta:
        model = HistoricalPeriod
        fields = "__all__"


class IconographicObjectGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for IconographicObject (registry key: iconography)."""

    class Meta:
        model = IconographicObject
        fields = "__all__"


class KumariRetirementGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for KumariRetirement (registry key: kumari_retirement)."""

    class Meta:
        model = KumariRetirement
        fields = "__all__"


class KumariSelectionGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for KumariSelection (registry key: kumari_selection)."""

    class Meta:
        model = KumariSelection
        fields = "__all__"


class KumariTenureGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for KumariTenure (registry key: kumari_tenure)."""

    class Meta:
        model = KumariTenure
        fields = "__all__"


class LocationGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Location (registry key: location)."""

    class Meta:
        model = Location
        fields = "__all__"


class MonumentGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Monument (registry key: monument)."""

    class Meta:
        model = Monument
        fields = "__all__"


class PersonGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Person (registry key: person)."""

    class Meta:
        model = Person
        fields = "__all__"


class ProductionGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Production (registry key: production)."""

    class Meta:
        model = Production
        fields = "__all__"


class RitualEventGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for RitualEvent (registry key: ritual)."""

    class Meta:
        model = RitualEvent
        fields = "__all__"


class SourceGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Source (registry key: source)."""

    class Meta:
        model = Source
        fields = "__all__"


class SyncreticRelationshipGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for SyncreticRelationship (registry key: syncretism)."""

    class Meta:
        model = SyncreticRelationship
        fields = "__all__"


class TraditionGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for Tradition (registry key: tradition)."""

    class Meta:
        model = Tradition
        fields = "__all__"


class TransferOfCustodyGeneratedSerializer(BaseRegistrySerializer):
    """Auto-generated serializer stub for TransferOfCustody (registry key: transfer_of_custody)."""

    class Meta:
        model = TransferOfCustody
        fields = "__all__"

