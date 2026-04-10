"""
Reverse relation index for GET /cidoc/related/.

Each row is (model, field_name, multivalued, references_domain) where
references_domain is the ontology key of the *target* entity (e.g. "source", "deity").

Keep in sync with:
  - heritage_graph_ui/src/lib/ontology/registry.ts (relation fields: relationTo)
  - Django columns on models in apps.cidoc_data.models

When new relation CharField/TextField columns are added to models, add a row here.
Fields that exist only in the frontend registry but not in the ORM must not be listed.
"""

from .models import (
    IconographicObject,
    KumariRetirement,
    KumariSelection,
    KumariTenure,
    SyncreticRelationship,
)

# (model_class, field_name, multivalued, references_domain_key)
CIDOC_RELATION_BACKREFS: list[tuple[type, str, bool, str]] = [
    (IconographicObject, "depicts_deity", True, "deity"),
    (SyncreticRelationship, "assigned_to_deity", False, "deity"),
    (SyncreticRelationship, "assigned_equivalent", True, "deity"),
    (SyncreticRelationship, "documented_in_source", False, "source"),
    (KumariTenure, "had_participant", False, "person"),
    (KumariTenure, "embodied_deity", False, "deity"),
    (KumariTenure, "residence_structure", False, "structure"),
    (KumariTenure, "supported_by_institution", True, "guthi"),
    (KumariSelection, "selected_person", False, "person"),
    (KumariSelection, "initiated_tenure", False, "kumari_tenure"),
    (KumariSelection, "took_place_at", False, "location"),
    (KumariRetirement, "ended_tenure_of", False, "kumari_tenure"),
    (KumariRetirement, "took_place_at", False, "location"),
]

# Referrer model class -> ontology domain key (for grouping API results)
MODEL_ONTOLOGY_DOMAIN_KEY: dict[type, str] = {
    IconographicObject: "iconography",
    SyncreticRelationship: "syncretism",
    KumariTenure: "kumari_tenure",
    KumariSelection: "kumari_selection",
    KumariRetirement: "kumari_retirement",
}

# Plural labels for API display_type (aligned with ontology registry)
REFERRED_GROUP_LABELS: dict[str, str] = {
    "iconography": "Iconographic Objects",
    "syncretism": "Syncretic Relationships",
    "kumari_tenure": "Living Goddess Tenures",
    "kumari_selection": "Living Goddess Selections",
    "kumari_retirement": "Living Goddess Retirements",
}
