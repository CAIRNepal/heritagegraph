"""
Map Django model class names to ontology registry `class` keys (tools/ui-classmap.yaml).

LinkML class names differ from Django for a few types (Place→Location, etc.).
"""

from __future__ import annotations

# Django model __name__ → registry key used in registry_jsonschema.byClassKey
DJANGO_MODEL_TO_REGISTRY_CLASS_KEY: dict[str, str] = {
    "Person": "person",
    "Location": "location",
    "Event": "event",
    "HistoricalPeriod": "period",
    "Tradition": "tradition",
    "Source": "source",
    "Deity": "deity",
    "Guthi": "guthi",
    "ArchitecturalStructure": "structure",
    "RitualEvent": "ritual",
    "Festival": "festival",
    "Production": "production",
    "Consecration": "consecration",
    "Enshrinement": "enshrinement",
    "TransferOfCustody": "transfer_of_custody",
    "IconographicObject": "iconography",
    "Monument": "monument",
    "KumariTenure": "kumari_tenure",
    "KumariSelection": "kumari_selection",
    "KumariRetirement": "kumari_retirement",
    "SyncreticRelationship": "syncretism",
    "CasteGroup": "caste_group",
    "CalendarSystem": "calendar",
    "HeritageAssertion": "assertion",
    "EntityCluster": "entity_cluster",
    "DataSource": "data_source",
}


def registry_class_key_for_model(model_class) -> str | None:
    """Return registry class key for a Django model, or None if not mapped."""
    name = getattr(model_class, "__name__", None)
    if not name:
        return None
    return DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.get(name)


def model_for_registry_key(registry_key: str):
    """Inverse of registry_class_key_for_model: registry key → Django model.

    Falls back to matching the lowercased model name (the URI segment used
    when a model has no registry key).
    """
    from django.apps import apps

    key = (registry_key or "").strip().lower()
    if not key:
        return None
    for model_name, reg_key in DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.items():
        if reg_key == key:
            try:
                return apps.get_model("cidoc_data", model_name)
            except LookupError:
                return None
    try:
        return apps.get_model("cidoc_data", key)
    except LookupError:
        return None


def type_scope_for_registry_key(registry_key: str) -> str | None:
    """Map ontology registry key → EntityCluster.type_scope (ContentType.model)."""
    from django.apps import apps
    from django.contrib.contenttypes.models import ContentType

    key = (registry_key or "").strip().lower()
    if not key:
        return None
    for model_name, reg_key in DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.items():
        if reg_key != key:
            continue
        try:
            model = apps.get_model("cidoc_data", model_name)
        except LookupError:
            return None
        if model is None:
            return None
        return ContentType.objects.get_for_model(model, for_concrete_model=True).model
    return None
