"""
Reverse relation index for GET /cidoc/related/.

Each row is (model, field_name, multivalued, references_domain) where
references_domain is the ontology key of the *target* entity (e.g. "source", "deity").

`EntityRef` rows (see models.EntityRef) augment reverse lookups; use
`rebuild_entityrefs` management command to populate from legacy CharField columns.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .models import (
    ArchitecturalStructure,
    Deity,
    Guthi,
    IconographicObject,
    KumariRetirement,
    KumariSelection,
    KumariTenure,
    Location,
    Person,
    Source,
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

# Ontology registry domain key -> Django model class for the *target* side of a relation
DOMAIN_KEY_TO_TARGET_MODEL: dict[str, type] = {
    "person": Person,
    "location": Location,
    "source": Source,
    "deity": Deity,
    "guthi": Guthi,
    "structure": ArchitecturalStructure,
    "kumari_tenure": KumariTenure,
}


def _parse_relation_ids(raw: Any, multivalued: bool) -> list[int]:
    if raw is None:
        return []
    if isinstance(raw, bool):
        return []
    if isinstance(raw, int):
        return [raw]
    s = str(raw).strip()
    if not s:
        return []
    if multivalued:
        out: list[int] = []
        for part in s.replace(";", ",").split(","):
            part = part.strip()
            if not part:
                continue
            try:
                out.append(int(part))
            except ValueError:
                continue
        return out
    try:
        return [int(s)]
    except ValueError:
        return []


def backfill_entityrefs_from_legacy_columns() -> int:
    """Create EntityRef rows from CharField relation columns listed in CIDOC_RELATION_BACKREFS."""
    from django.contrib.contenttypes.models import ContentType

    from .models import EntityRef

    created = 0
    for model_cls, field_name, multivalued, ref_domain in CIDOC_RELATION_BACKREFS:
        to_model = DOMAIN_KEY_TO_TARGET_MODEL.get(ref_domain)
        if not to_model:
            continue
        to_ct = ContentType.objects.get_for_model(to_model)
        from_ct = ContentType.objects.get_for_model(model_cls)
        for obj in model_cls.objects.all().iterator():
            raw = getattr(obj, field_name, None)
            for tid in _parse_relation_ids(raw, multivalued):
                _, was_created = EntityRef.objects.get_or_create(
                    from_content_type=from_ct,
                    from_object_id=obj.pk,
                    predicate=field_name,
                    to_content_type=to_ct,
                    to_object_id=tid,
                )
                if was_created:
                    created += 1
    return created


def entityref_reverse_ids_by_referrer_model(*, domain: str, raw_id: str) -> dict[type, list[int]]:
    """
    Map referrer model class -> list of PKs that reference (domain, raw_id) via EntityRef.
    """
    from django.contrib.contenttypes.models import ContentType

    from .models import EntityRef

    tgt = DOMAIN_KEY_TO_TARGET_MODEL.get(domain)
    if not tgt:
        return {}
    try:
        pk = int(raw_id)
    except ValueError:
        return {}
    to_ct = ContentType.objects.get_for_model(tgt)
    grouped: dict[type, list[int]] = defaultdict(list)
    for er in (
        EntityRef.objects.filter(to_content_type=to_ct, to_object_id=pk)
        .select_related("from_content_type")
        .iterator()
    ):
        m = er.from_content_type.model_class()
        if m is None or m not in MODEL_ONTOLOGY_DOMAIN_KEY:
            continue
        grouped[m].append(er.from_object_id)
    # dedupe per model
    return {m: sorted(set(ids)) for m, ids in grouped.items()}
