"""
Build ontology registry payloads from LinkML YAML using LinkML's `SchemaView`.

This builder materializes a frontend-friendly "registry" document consumed by
the schema registry API and the Next.js UI.

UI-facing class metadata (key, endpoint, icon, labels) lives in YAML at
`tools/ui-classmap.yaml` so it can evolve without touching TS/Python code.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

try:
    from linkml_runtime.utils.schemaview import SchemaView  # type: ignore

    _HAS_LINKML = True
except Exception:
    # Allow running in environments without LinkML deps. In that case, we fall back
    # to a minimal PyYAML builder (sufficient for serving the UI registry).
    SchemaView = None  # type: ignore
    _HAS_LINKML = False

GENERATOR_VERSION = "0.2.0"


def build_registry_jsonschema_blob(classes: dict[str, Any]) -> dict[str, Any]:
    """
    Draft-07 style JSON Schemas per ontology class key for client/server validation (MT1).
    Keys match registry field `key` values sent to DRF.
    """

    def _prop_schema(field: dict[str, Any]) -> dict[str, Any]:
        ft = field.get("type") or "text"
        if ft in ("text", "textarea", "date", "select", "url"):
            return {"type": "string"}
        if ft == "number":
            return {"type": "integer"}
        if ft == "float":
            return {"type": "number"}
        if ft == "boolean":
            return {"type": "boolean"}
        if ft == "multiselect":
            return {"type": "array", "items": {"type": "string"}}
        if ft == "coordinates":
            return {"type": "string"}
        if ft == "relation":
            return {"type": ["string", "number", "integer"]}
        return {}

    by_key: dict[str, Any] = {}
    for class_key, cls in classes.items():
        fields = cls.get("fields") or []
        properties: dict[str, Any] = {}
        required: list[str] = []
        for f in fields:
            fk = f.get("key")
            if not fk:
                continue
            ps = _prop_schema(f)
            if ps:
                properties[fk] = ps
            if f.get("required"):
                required.append(fk)
        by_key[class_key] = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": True,
        }
    return {"version": 1, "byClassKey": by_key}


def _load_schema(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_ui_presentation(path: Path) -> dict[str, Any]:
    """Optional tools/ui-presentation.yaml — presentation-only overrides keyed by slot name."""
    if not path.is_file():
        return {}
    raw = _load_schema(path) or {}
    return raw if isinstance(raw, dict) else {}


def _load_ui_classmap(path: Path) -> list[dict[str, Any]]:
    raw = _load_schema(path) or {}
    classes = raw.get("classes") or []
    if not isinstance(classes, list):
        raise ValueError("tools/ui-classmap.yaml: 'classes' must be a list")
    out: list[dict[str, Any]] = []
    for row in classes:
        if not isinstance(row, dict):
            continue
        if not row.get("linkml") or not row.get("key") or not row.get("apiEndpoint"):
            continue
        out.append(row)
    return out


def load_contribute_hub_payload(path: Path) -> dict[str, Any]:
    """Load contribute landing metadata from tools/contribute-hub.yaml (optional file)."""
    if not path.is_file():
        return {
            "hubCategories": [],
            "intents": [],
            "quickStart": [],
        }
    raw = _load_schema(path) or {}
    hub_categories = raw.get("hubCategories") or []
    intents = raw.get("intents") or []
    quick_start = raw.get("quickStart") or []
    if not isinstance(hub_categories, list):
        raise ValueError("tools/contribute-hub.yaml: 'hubCategories' must be a list")
    if not isinstance(intents, list):
        raise ValueError("tools/contribute-hub.yaml: 'intents' must be a list")
    if not isinstance(quick_start, list):
        raise ValueError("tools/contribute-hub.yaml: 'quickStart' must be a list")
    return {
        "hubCategories": hub_categories,
        "intents": intents,
        "quickStart": [str(x) for x in quick_start],
    }


def _class_inheritance_chain(schema: dict[str, Any], class_name: str) -> list[str]:
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
    out: list[str] = []
    seen: set[str] = set()
    for s in names:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _slot_def(schema: dict[str, Any], slot_name: str) -> dict[str, Any]:
    return ((schema.get("slots") or {}).get(slot_name)) or {}


def _range_to_field_type(range_name: str | None, *, enum_names: set[str], sv: SchemaView) -> str:
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
    # LinkML class as range → relation
    if _HAS_LINKML and sv and sv.get_class(range_name, strict=False):
        return "relation"
    return "text"


def _enum_payload(sv: SchemaView) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    for enum_name in sv.all_enums().keys():
        enum_def = sv.get_enum(enum_name)
        if not enum_def:
            continue
        pvs = enum_def.permissible_values or {}
        rows: list[dict[str, str]] = []
        for value, pv in pvs.items():
            title = getattr(pv, "title", None) if pv is not None else None
            desc = getattr(pv, "description", None) if pv is not None else None
            rows.append(
                {
                    "value": str(value),
                    "label": str(title or value).replace("_", " "),
                    "description": str(desc or ""),
                }
            )
        if rows:
            out[enum_name] = rows
    return out


def _enum_payload_pyyaml(schema: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    enums = schema.get("enums") or {}
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


def _slot_required_for_class(sv: SchemaView, class_name: str, slot_name: str) -> bool:
    # Prefer slot_usage.required when present, else slot.required
    cls = sv.get_class(class_name, strict=True)
    if cls and cls.slot_usage and slot_name in cls.slot_usage:
        usage = cls.slot_usage[slot_name]
        if getattr(usage, "required", None) is not None:
            return bool(usage.required)
    slot = sv.induced_slot(slot_name, class_name=class_name)
    if slot and getattr(slot, "required", None) is not None:
        return bool(slot.required)
    return False


def _slot_ui_overrides(slot: Any) -> dict[str, Any]:
    ann = getattr(slot, "annotations", None) or {}
    out: dict[str, Any] = {}
    for k in ("ui_section", "ui_order", "ui_placeholder", "ui_widget"):
        if k in ann and ann[k] is not None:
            out[k] = str(getattr(ann[k], "value", ann[k]))
    return out


def _coerce_annotation_value(v: Any) -> Any:
    if v is None:
        return None
    return getattr(v, "value", v)


def _class_ui_overrides(cls: Any) -> dict[str, Any]:
    ann = getattr(cls, "annotations", None) or {}
    out: dict[str, Any] = {}
    for k in (
        "ui_key",
        "ui_label",
        "ui_labelPlural",
        "ui_apiEndpoint",
        "ui_icon",
        "ui_category",
        "ui_navigable",
        "ui_sections",
        "ui_columns",
    ):
        if k in ann and ann[k] is not None:
            out[k] = _coerce_annotation_value(ann[k])
    return out


def _maybe_parse_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    s = value.strip()
    if not s:
        return value
    if not (s.startswith("{") or s.startswith("[")):
        return value
    try:
        return json.loads(s)
    except Exception:
        return value


def _maybe_attach_enum_options(
    field: dict[str, Any],
    *,
    range_name: str | None,
    enums: dict[str, list[dict[str, str]]],
) -> None:
    if field.get("type") != "select" or not isinstance(range_name, str):
        return
    rows = enums.get(range_name)
    if not rows:
        return
    field["options"] = [dict(row) for row in rows]
    field["enum_range"] = range_name


def build_classes(
    *, sv: SchemaView, ui_classmap_path: Path, enums: dict[str, list[dict[str, str]]]
) -> dict[str, Any]:
    classes_out: dict[str, Any] = {}
    enum_names = set(sv.all_enums().keys())
    ui_rows = _load_ui_classmap(ui_classmap_path)
    presentation_path = ui_classmap_path.parent / "ui-presentation.yaml"
    pres = _load_ui_presentation(presentation_path)
    linkml_to_ui: dict[str, dict[str, Any]] = {
        row["linkml"]: row for row in ui_rows if isinstance(row.get("linkml"), str)
    }

    for meta in ui_rows:
        linkml = meta["linkml"]
        if not sv.get_class(linkml, strict=False):
            continue

        linkml_cls = sv.get_class(linkml, strict=True)
        induced = sv.class_induced_slots(linkml)
        fields: list[dict[str, Any]] = []
        order = 0
        for slot in induced:
            if not slot or slot.name == "id":
                continue
            order += 1
            range_name = getattr(slot, "range", None)
            field_type = _range_to_field_type(range_name, enum_names=enum_names, sv=sv)
            required = _slot_required_for_class(sv, linkml, slot.name)
            slot_uri = getattr(slot, "slot_uri", None)
            label = getattr(slot, "title", None) or slot.name.replace("_", " ").title()
            desc = getattr(slot, "description", None)
            multivalued = bool(getattr(slot, "multivalued", False))

            min_c = getattr(slot, "minimum_cardinality", None)
            max_c = getattr(slot, "maximum_cardinality", None)
            if linkml_cls and linkml_cls.slot_usage and slot.name in linkml_cls.slot_usage:
                su = linkml_cls.slot_usage[slot.name]
                if getattr(su, "minimum_cardinality", None) is not None:
                    min_c = su.minimum_cardinality
                if getattr(su, "maximum_cardinality", None) is not None:
                    max_c = su.maximum_cardinality

            field: dict[str, Any] = {
                "key": slot.name,
                "label": str(label),
                "type": field_type,
                "section": "basic",
                "order": order,
                "required": required,
                "multivalued": multivalued,
            }
            if desc:
                field["description"] = str(desc)
            if slot_uri:
                field["slot_uri"] = str(slot_uri)
            if field_type == "relation" and isinstance(range_name, str):
                # Default relationTo is the LinkML class; UI will use registry mapping for endpoints.
                field["relationTo"] = range_name
                related = linkml_to_ui.get(range_name)
                if related and related.get("apiEndpoint"):
                    field["relationEndpoint"] = related["apiEndpoint"]

            ui = _slot_ui_overrides(slot)
            file_slot = (pres.get("slots") or {}).get(slot.name) or {}
            if isinstance(file_slot, dict):
                for k in ("ui_section", "ui_order", "ui_placeholder", "ui_widget"):
                    if file_slot.get(k) is not None:
                        ui[k] = str(file_slot[k])
            if "ui_section" in ui:
                field["section"] = ui["ui_section"]
            if "ui_order" in ui:
                try:
                    field["order"] = int(ui["ui_order"])
                except ValueError:
                    pass
            if "ui_placeholder" in ui:
                field["placeholder"] = ui["ui_placeholder"]
            if "ui_widget" in ui:
                field["type"] = ui["ui_widget"]

            _maybe_attach_enum_options(field, range_name=range_name, enums=enums)

            if min_c is not None:
                try:
                    field["minimumCardinality"] = int(min_c)
                except (TypeError, ValueError):
                    pass
            if max_c is not None:
                try:
                    field["maximumCardinality"] = int(max_c)
                except (TypeError, ValueError):
                    pass

            fields.append(field)

        # Default columns: first 8 non-relational fields by order
        columns: list[dict[str, Any]] = []
        for f in fields:
            if len(columns) >= 8:
                break
            columns.append(
                {
                    "key": f["key"],
                    "label": f["label"],
                    "sortable": True,
                    "visible": True,
                    "format": "text",
                }
            )

        cls = linkml_cls
        class_uri = getattr(cls, "class_uri", None) if cls else None
        ui_cls = _class_ui_overrides(cls) if cls else {}
        key = str(ui_cls.get("ui_key") or meta["key"])
        classes_out[key] = {
            "key": key,
            "label": str(ui_cls.get("ui_label") or meta.get("label") or key.replace("_", " ").title()),
            "labelPlural": str(
                ui_cls.get("ui_labelPlural")
                or meta.get("labelPlural")
                or f"{key.replace('_', ' ').title()}s"
            ),
            "description": str(getattr(cls, "description", "") or ""),
            "classUri": str(class_uri) if class_uri else None,
            "icon": str(ui_cls.get("ui_icon") or meta.get("icon") or ""),
            "apiEndpoint": str(ui_cls.get("ui_apiEndpoint") or meta["apiEndpoint"]),
            "category": str(ui_cls.get("ui_category") or meta.get("category") or ""),
            "navigable": bool(
                ui_cls.get("ui_navigable")
                if ui_cls.get("ui_navigable") is not None
                else meta.get("navigable", True)
            ),
            "sections": _maybe_parse_json(ui_cls.get("ui_sections"))
            if ui_cls.get("ui_sections")
            else [{"key": "basic", "label": "Basic Information"}],
            "fields": fields,
            "columns": _maybe_parse_json(ui_cls.get("ui_columns"))
            if ui_cls.get("ui_columns")
            else columns,
        }
    return classes_out


def build_classes_pyyaml(
    *,
    schema: dict[str, Any],
    ui_classmap_path: Path,
    enums: dict[str, list[dict[str, str]]],
) -> dict[str, Any]:
    classes_out: dict[str, Any] = {}
    schema_enums = schema.get("enums") or {}
    enum_names = set(schema_enums.keys())
    classes = schema.get("classes") or {}
    ui_rows = _load_ui_classmap(ui_classmap_path)
    presentation_path = ui_classmap_path.parent / "ui-presentation.yaml"
    pres = _load_ui_presentation(presentation_path)
    linkml_to_ui: dict[str, dict[str, Any]] = {
        row["linkml"]: row for row in ui_rows if isinstance(row.get("linkml"), str)
    }

    for meta in ui_rows:
        linkml = meta["linkml"]
        if linkml not in classes:
            continue
        slot_names = _induced_slot_names(schema, linkml)
        slot_usage_root = (classes.get(linkml) or {}).get("slot_usage") or {}

        fields: list[dict[str, Any]] = []
        order = 0
        for slot_name in slot_names:
            if slot_name == "id":
                continue
            order += 1
            sdef = _slot_def(schema, slot_name)
            usage = slot_usage_root.get(slot_name) or {}
            range_name = sdef.get("range")
            field_type = "select" if range_name in enum_names else "text"
            if isinstance(range_name, str) and range_name in classes:
                field_type = "relation"
            required = bool(usage.get("required") or sdef.get("required"))
            slot_uri = sdef.get("slot_uri")
            label = sdef.get("title") or slot_name.replace("_", " ").title()
            desc = sdef.get("description")
            multivalued = bool(sdef.get("multivalued", False))

            min_c = usage.get("minimum_cardinality")
            if min_c is None:
                min_c = sdef.get("minimum_cardinality")
            max_c = usage.get("maximum_cardinality")
            if max_c is None:
                max_c = sdef.get("maximum_cardinality")

            field: dict[str, Any] = {
                "key": slot_name,
                "label": str(label),
                "type": field_type,
                "section": "basic",
                "order": order,
                "required": required,
                "multivalued": multivalued,
            }
            if desc:
                field["description"] = str(desc)
            if slot_uri:
                field["slot_uri"] = str(slot_uri)
            if field_type == "relation" and isinstance(range_name, str):
                field["relationTo"] = range_name
                related = linkml_to_ui.get(range_name)
                if related and related.get("apiEndpoint"):
                    field["relationEndpoint"] = related["apiEndpoint"]

            _maybe_attach_enum_options(field, range_name=range_name, enums=enums)

            if min_c is not None:
                try:
                    field["minimumCardinality"] = int(min_c)
                except (TypeError, ValueError):
                    pass
            if max_c is not None:
                try:
                    field["maximumCardinality"] = int(max_c)
                except (TypeError, ValueError):
                    pass

            file_slot = (pres.get("slots") or {}).get(slot_name) or {}
            if isinstance(file_slot, dict):
                if file_slot.get("ui_section") is not None:
                    field["section"] = str(file_slot["ui_section"])
                if file_slot.get("ui_order") is not None:
                    try:
                        field["order"] = int(file_slot["ui_order"])
                    except (TypeError, ValueError):
                        pass
                if file_slot.get("ui_placeholder") is not None:
                    field["placeholder"] = str(file_slot["ui_placeholder"])
                if file_slot.get("ui_widget") is not None:
                    field["type"] = str(file_slot["ui_widget"])
                    _maybe_attach_enum_options(field, range_name=range_name, enums=enums)

            fields.append(field)

        columns: list[dict[str, Any]] = []
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

        class_def = classes.get(linkml) or {}
        class_uri = class_def.get("class_uri")
        key = meta["key"]
        classes_out[key] = {
            "key": key,
            "label": meta.get("label") or key.replace("_", " ").title(),
            "labelPlural": meta.get("labelPlural") or f"{key.replace('_', ' ').title()}s",
            "description": str(class_def.get("description") or ""),
            "classUri": str(class_uri) if class_uri else None,
            "icon": meta.get("icon"),
            "apiEndpoint": meta["apiEndpoint"],
            "category": meta.get("category"),
            "navigable": bool(meta.get("navigable", True)),
            "sections": [{"key": "basic", "label": "Basic Information"}],
            "fields": fields,
            "columns": columns,
        }
    return classes_out


def build_registry_document(schema_path: Path) -> dict[str, Any]:
    """Return { 'classes': {...}, 'enums': {...} } from LinkML YAML."""
    ui_classmap_path = schema_path.parent.parent / "tools" / "ui-classmap.yaml"
    if _HAS_LINKML and SchemaView is not None:
        sv = SchemaView(str(schema_path))
        enums = _enum_payload(sv)
        return {
            "classes": build_classes(sv=sv, ui_classmap_path=ui_classmap_path, enums=enums),
            "enums": enums,
        }
    schema = _load_schema(schema_path)
    enums = _enum_payload_pyyaml(schema)
    return {
        "classes": build_classes_pyyaml(
            schema=schema, ui_classmap_path=ui_classmap_path, enums=enums
        ),
        "enums": enums,
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
    ui_classmap_path = schema_path.parent.parent / "tools" / "ui-classmap.yaml"
    if ui_classmap_path.is_file():
        h.update(b"|")
        h.update(ui_classmap_path.read_bytes())
    contribute_hub_path = schema_path.parent.parent / "tools" / "contribute-hub.yaml"
    if contribute_hub_path.is_file():
        h.update(b"|")
        h.update(contribute_hub_path.read_bytes())
    ui_pres_path = schema_path.parent.parent / "tools" / "ui-presentation.yaml"
    if ui_pres_path.is_file():
        h.update(b"|")
        h.update(ui_pres_path.read_bytes())
    if extension_path and extension_path.is_file():
        h.update(b"|")
        h.update(extension_path.read_bytes())
    h.update(b"|")
    h.update(json.dumps(classes_payload, sort_keys=True).encode())
    h.update(b"|")
    h.update(json.dumps(enums_payload, sort_keys=True).encode())
    return h.hexdigest()[:64]
