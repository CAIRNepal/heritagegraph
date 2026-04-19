"""
Build ontology registry payloads from LinkML YAML without requiring linkml-runtime
on the production image (PyYAML only). For SchemaView-based tooling, see
heritage_graph/requirements-dev.txt.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

GENERATOR_VERSION = "0.1.0"


def _load_schema(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _class_inheritance_chain(schema: dict[str, Any], class_name: str) -> list[str]:
    """Root-first order (HumanMadeObject, …, ArchitecturalStructure)."""
    chain: list[str] = []
    seen: set[str] = set()
    current: str | None = class_name
    while current and current not in seen:
        seen.add(current)
        chain.append(current)
        cls = (schema.get("classes") or {}).get(current) or {}
        current = cls.get("is_a")
    return list(reversed(chain))


def _induced_slot_names(schema: dict[str, Any], class_name: str) -> list[str]:
    names: list[str] = []
    for cname in _class_inheritance_chain(schema, class_name):
        cls = (schema.get("classes") or {}).get(cname) or {}
        names.extend(cls.get("slots") or [])
    # preserve order, unique
    out: list[str] = []
    seen: set[str] = set()
    for s in names:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _slot_def(schema: dict[str, Any], slot_name: str) -> dict[str, Any]:
    return ((schema.get("slots") or {}).get(slot_name)) or {}


def _range_to_field_type(range_name: str | None, enum_names: set[str]) -> str:
    if not range_name:
        return "text"
    if range_name in enum_names:
        return "select"
    r = range_name.lower()
    if r in ("integer", "int"):
        return "number"
    if r in ("float", "double", "decimal"):
        return "float"
    if r in ("boolean", "bool"):
        return "boolean"
    if r in ("date", "datetime", "dateordatetime"):
        return "date"
    if r in ("uri", "uriorcurie"):
        return "url"
    # LinkML class as range → relation placeholder
    if r[0:1].isupper() or range_name[0:1].isupper():
        return "relation"
    return "text"


def _enum_payload(schema: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    enums = schema.get("enums") or {}
    enum_names = set(enums.keys())
    for enum_name, enum_def in enums.items():
        rows: list[dict[str, str]] = []
        pvs = (enum_def or {}).get("permissible_values") or {}
        for value, meta in pvs.items():
            if not isinstance(meta, dict):
                meta = {}
            rows.append(
                {
                    "value": str(value),
                    "label": str(meta.get("title") or value).replace("_", " "),
                    "description": str(meta.get("description") or ""),
                }
            )
        if rows:
            out[enum_name] = rows
    return out


# LinkML class → registry key + REST list endpoint (must match cidoc_data/urls.py).
CIDOC_CLASS_META: list[dict[str, Any]] = [
    {
        "linkml": "Person",
        "key": "person",
        "api": "/cidoc/persons/",
        "label": "Person",
        "label_plural": "Persons",
        "navigable": True,
        "category": "social",
        "icon": "user",
    },
    {
        "linkml": "Place",
        "key": "location",
        "api": "/cidoc/locations/",
        "label": "Location",
        "label_plural": "Locations",
        "navigable": True,
        "category": "spatiotemporal",
        "icon": "map-pin",
    },
    {
        "linkml": "HistoricalEvent",
        "key": "event",
        "api": "/cidoc/events/",
        "label": "Event",
        "label_plural": "Events",
        "navigable": True,
        "category": "event",
        "icon": "calendar",
    },
    {
        "linkml": "ReligiousTradition",
        "key": "tradition",
        "api": "/cidoc/traditions/",
        "label": "Tradition",
        "label_plural": "Traditions",
        "navigable": True,
        "category": "conceptual",
        "icon": "sparkles",
    },
    {
        "linkml": "InformationObject",
        "key": "source",
        "api": "/cidoc/sources/",
        "label": "Source",
        "label_plural": "Sources",
        "navigable": True,
        "category": "provenance",
        "icon": "book-open",
    },
    {
        "linkml": "Deity",
        "key": "deity",
        "api": "/cidoc/deities/",
        "label": "Deity",
        "label_plural": "Deities",
        "navigable": True,
        "category": "conceptual",
        "icon": "sun",
    },
    {
        "linkml": "Guthi",
        "key": "guthi",
        "api": "/cidoc/guthis/",
        "label": "Guthi",
        "label_plural": "Guthis",
        "navigable": True,
        "category": "social",
        "icon": "users",
    },
    {
        "linkml": "ArchitecturalStructure",
        "key": "structure",
        "api": "/cidoc/structures/",
        "label": "Architectural Structure",
        "label_plural": "Architectural Structures",
        "navigable": True,
        "category": "tangible",
        "icon": "landmark",
    },
    {
        "linkml": "RitualEvent",
        "key": "ritual",
        "api": "/cidoc/rituals/",
        "label": "Ritual Event",
        "label_plural": "Ritual Events",
        "navigable": True,
        "category": "event",
        "icon": "flame-kindling",
    },
    {
        "linkml": "Festival",
        "key": "festival",
        "api": "/cidoc/festivals/",
        "label": "Festival",
        "label_plural": "Festivals",
        "navigable": True,
        "category": "event",
        "icon": "party-popper",
    },
    {
        "linkml": "IconographicObject",
        "key": "iconography",
        "api": "/cidoc/iconographic_objects/",
        "label": "Iconographic Object",
        "label_plural": "Iconographic Objects",
        "navigable": True,
        "category": "tangible",
        "icon": "image",
    },
    {
        "linkml": "BuddhistMonument",
        "key": "monument",
        "api": "/cidoc/monuments/",
        "label": "Monument",
        "label_plural": "Monuments",
        "navigable": True,
        "category": "tangible",
        "icon": "landmark",
    },
    {
        "linkml": "LivingGoddessTenure",
        "key": "kumari_tenure",
        "api": "/cidoc/kumari_tenures/",
        "label": "Kumari Tenure",
        "label_plural": "Kumari Tenures",
        "navigable": True,
        "category": "event",
        "icon": "crown",
    },
    {
        "linkml": "LivingGoddessSelection",
        "key": "kumari_selection",
        "api": "/cidoc/kumari_selections/",
        "label": "Kumari Selection",
        "label_plural": "Kumari Selections",
        "navigable": True,
        "category": "event",
        "icon": "crown",
    },
    {
        "linkml": "LivingGoddessRetirement",
        "key": "kumari_retirement",
        "api": "/cidoc/kumari_retirements/",
        "label": "Kumari Retirement",
        "label_plural": "Kumari Retirements",
        "navigable": True,
        "category": "event",
        "icon": "crown",
    },
    {
        "linkml": "SyncreticRelationship",
        "key": "syncretism",
        "api": "/cidoc/syncretic_relationships/",
        "label": "Syncretic Relationship",
        "label_plural": "Syncretic Relationships",
        "navigable": True,
        "category": "social",
        "icon": "shuffle",
    },
    {
        "linkml": "CasteGroup",
        "key": "caste_group",
        "api": "/cidoc/caste_groups/",
        "label": "Caste Group",
        "label_plural": "Caste Groups",
        "navigable": True,
        "category": "social",
        "icon": "users",
    },
    {
        "linkml": "CalendarSystem",
        "key": "calendar",
        "api": "/cidoc/calendar_systems/",
        "label": "Calendar System",
        "label_plural": "Calendar Systems",
        "navigable": True,
        "category": "spatiotemporal",
        "icon": "calendar-days",
    },
    {
        "linkml": "HeritageAssertion",
        "key": "assertion",
        "api": "/cidoc/assertions/",
        "label": "Heritage Assertion",
        "label_plural": "Heritage Assertions",
        "navigable": True,
        "category": "provenance",
        "icon": "badge-check",
    },
    {
        "linkml": "DataSource",
        "key": "data_source",
        "api": "/cidoc/data_sources/",
        "label": "Data Source",
        "label_plural": "Data Sources",
        "navigable": False,
        "category": "provenance",
        "icon": "database",
    },
]


def _class_uri(schema: dict[str, Any], linkml_class: str) -> str | None:
    cls = (schema.get("classes") or {}).get(linkml_class) or {}
    return cls.get("class_uri")


def build_classes(schema: dict[str, Any]) -> dict[str, Any]:
    classes_out: dict[str, Any] = {}
    enums = schema.get("enums") or {}
    enum_names = set(enums.keys())
    all_classes = schema.get("classes") or {}

    for meta in CIDOC_CLASS_META:
        linkml = meta["linkml"]
        if linkml not in all_classes:
            continue
        slot_names = _induced_slot_names(schema, linkml)
        fields: list[dict[str, Any]] = []
        slot_usage_root = (all_classes.get(linkml) or {}).get("slot_usage") or {}
        order = 0
        for slot_name in slot_names:
            if slot_name == "id":
                continue
            sdef = _slot_def(schema, slot_name)
            range_name = sdef.get("range")
            field_type = _range_to_field_type(range_name, enum_names)
            usage = slot_usage_root.get(slot_name) or {}
            required = bool(usage.get("required") or sdef.get("required"))
            slot_uri = sdef.get("slot_uri")
            label = sdef.get("title") or slot_name.replace("_", " ").title()
            order += 1
            field: dict[str, Any] = {
                "key": slot_name,
                "label": label,
                "type": field_type,
                "section": "basic",
                "order": order,
                "required": required,
            }
            desc = sdef.get("description")
            if desc:
                field["description"] = desc
            if slot_uri:
                field["slot_uri"] = slot_uri
            if field_type == "relation" and isinstance(range_name, str):
                field["relationTo"] = range_name.lower()
            fields.append(field)

        columns = []
        for f in fields[:8]:
            columns.append(
                {
                    "key": f["key"],
                    "label": f["label"],
                    "sortable": True,
                    "visible": True,
                    "format": "text",
                }
            )

        key = meta["key"]
        classes_out[key] = {
            "key": key,
            "label": meta["label"],
            "labelPlural": meta["label_plural"],
            "description": (all_classes.get(linkml) or {}).get("description") or "",
            "classUri": _class_uri(schema, linkml),
            "icon": meta.get("icon"),
            "apiEndpoint": meta["api"],
            "category": meta["category"],
            "navigable": meta.get("navigable", True),
            "sections": [{"key": "basic", "label": "Basic Information"}],
            "fields": fields,
            "columns": columns,
        }
    return classes_out


def build_registry_document(schema_path: Path) -> dict[str, Any]:
    """Return { 'classes': {...}, 'enums': {...} } from LinkML YAML."""
    schema = _load_schema(schema_path)
    return {
        "classes": build_classes(schema),
        "enums": _enum_payload(schema),
    }


def compute_schema_version(
    schema_path: Path,
    extension_path: Path | None,
    classes_payload: dict[str, Any],
    enums_payload: dict[str, Any],
) -> str:
    h = hashlib.sha256()
    h.update(GENERATOR_VERSION.encode())
    h.update(b"|")
    h.update(schema_path.read_bytes())
    if extension_path and extension_path.is_file():
        h.update(b"|")
        h.update(extension_path.read_bytes())
    h.update(b"|")
    h.update(json.dumps(classes_payload, sort_keys=True).encode())
    h.update(b"|")
    h.update(json.dumps(enums_payload, sort_keys=True).encode())
    return h.hexdigest()[:64]
