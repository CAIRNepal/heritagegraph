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


def _parse_number_token(s: str) -> int | float:
    s = str(s).strip()
    if "." in s:
        return float(s)
    return int(s)


def build_registry_jsonschema_blob(classes: dict[str, Any]) -> dict[str, Any]:
    """
    JSON Schemas per ontology class key for client/server validation (MT1).
    Keys match registry field `key` values sent to DRF.

    Field dict may carry optional constraints: pattern, minLength, maxLength,
    minimum, maximum, jsonSchemaExtras (object merged into the property schema).
    Class dict may carry jsonSchemaAllOf (list of JSON Schema subschemas).
    """

    def _prop_schema(field: dict[str, Any]) -> dict[str, Any]:
        ft = field.get("type") or "text"
        ps: dict[str, Any]
        if ft in ("text", "textarea", "date", "select", "url", "edtf_date"):
            ps = {"type": "string"}
        elif ft == "number":
            ps = {"type": "integer"}
        elif ft == "float":
            ps = {"type": "number"}
        elif ft == "boolean":
            ps = {"type": "boolean"}
        elif ft == "multiselect":
            ps = {"type": "array", "items": {"type": "string"}}
        elif ft in ("coordinates",):
            ps = {"type": "string"}
        elif ft == "geo_point":
            ps = {
                "anyOf": [
                    {
                        "type": "object",
                        "properties": {
                            "lat": {"type": ["string", "number"]},
                            "lng": {"type": ["string", "number"]},
                        },
                        "additionalProperties": False,
                    },
                    {"type": "string"},
                ]
            }
        elif ft == "relation":
            ps = {"type": ["string", "number", "integer", "object", "array"]}
        elif ft in ("media",):
            ps = {"type": ["string", "array", "object"]}
        else:
            ps = {"type": "string"}

        if ft == "select":
            opts = field.get("options") or []
            if isinstance(opts, list) and opts:
                enum_vals = [
                    o.get("value")
                    for o in opts
                    if isinstance(o, dict) and o.get("value") is not None
                ]
                if enum_vals:
                    # Required selects must match vocabulary; optional may be blank/null.
                    if field.get("required"):
                        ps["enum"] = enum_vals
                    else:
                        ps["anyOf"] = [
                            {"type": "string", "enum": enum_vals},
                            {"type": "string", "maxLength": 0},
                            {"type": "null"},
                        ]

        if field.get("pattern"):
            ps["pattern"] = str(field["pattern"])
        for src, dst in (
            ("minLength", "minLength"),
            ("maxLength", "maxLength"),
            ("minimum", "minimum"),
            ("maximum", "maximum"),
        ):
            if field.get(src) is not None:
                try:
                    ps[dst] = (
                        int(field[src])
                        if dst in ("minLength", "maxLength")
                        else field[src]
                    )
                except (TypeError, ValueError):
                    ps[dst] = field[src]

        extras = field.get("jsonSchemaExtras")
        if isinstance(extras, dict):
            merged = dict(ps)
            merged.update(extras)
            ps = merged
        return ps

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
        schema_obj: dict[str, Any] = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": True,
        }
        all_of = cls.get("jsonSchemaAllOf")
        if isinstance(all_of, list) and all_of:
            schema_obj["allOf"] = all_of
        by_key[class_key] = schema_obj
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


def load_semantic_patterns_payload(path: Path) -> list[dict[str, Any]]:
    """Load semantic workflow patterns from tools/semantic-patterns.yaml."""
    if not path.is_file():
        return []
    raw = _load_schema(path) or {}
    patterns = raw.get("patterns") or []
    if not isinstance(patterns, list):
        raise ValueError("tools/semantic-patterns.yaml: 'patterns' must be a list")
    out: list[dict[str, Any]] = []
    for row in patterns:
        if isinstance(row, dict) and row.get("key"):
            out.append(row)
    return out


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


def _range_to_field_type(
    range_name: str | None, *, enum_names: set[str], sv: SchemaView
) -> str:
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
    # Geometry ranges get the lat/lng widget. The API's coordinate contract is
    # the `latitude`/`longitude` pair (serializers fold it into the `point`
    # column), so a plain text box here silently loses the value.
    if r == "wktliteral":
        return "geo_point"
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


def _is_truthy(value: Any) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _slot_ui_overrides(slot: Any) -> dict[str, Any]:
    ann = getattr(slot, "annotations", None) or {}
    out: dict[str, Any] = {}
    for k in (
        "ui_hidden",
        "ui_section",
        "ui_order",
        "ui_placeholder",
        "ui_help",
        "ui_example",
        "ui_widget",
        "ui_inline_authoring",
        "ui_pattern",
        "ui_min_length",
        "ui_max_length",
        "ui_minimum",
        "ui_maximum",
        "ui_weight",
        "ui_json_schema_extras",
        "ui_json_schema_rule",
    ):
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
        "ui_json_schema_allOf",
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
        json_schema_all_of_extra: list[dict[str, Any]] = []
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
            if (
                linkml_cls
                and linkml_cls.slot_usage
                and slot.name in linkml_cls.slot_usage
            ):
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
                    rk = related.get("key")
                    if rk:
                        field["relationRegistryKey"] = str(rk)

            ui = _slot_ui_overrides(slot)
            file_slot = (pres.get("slots") or {}).get(slot.name) or {}
            if isinstance(file_slot, dict):
                for k in (
                    "ui_hidden",
                    "ui_section",
                    "ui_order",
                    "ui_placeholder",
                    "ui_help",
                    "ui_example",
                    "ui_widget",
                    "ui_inline_authoring",
                    "ui_pattern",
                    "ui_min_length",
                    "ui_max_length",
                    "ui_minimum",
                    "ui_maximum",
                    "ui_weight",
                    "ui_json_schema_extras",
                    "ui_json_schema_rule",
                ):
                    if file_slot.get(k) is not None:
                        ui[k] = str(file_slot[k])
            # Ontology-only slots (e.g. the PROV-O mixins) carry no Django column,
            # so surfacing them as form inputs would offer fields that cannot save.
            if _is_truthy(ui.get("ui_hidden", "")):
                continue
            if "ui_section" in ui:
                field["section"] = ui["ui_section"]
            if "ui_order" in ui:
                try:
                    field["order"] = int(ui["ui_order"])
                except ValueError:
                    pass
            if "ui_placeholder" in ui:
                field["placeholder"] = ui["ui_placeholder"]
            if "ui_help" in ui:
                field["help"] = ui["ui_help"]
            if "ui_example" in ui:
                field["example"] = ui["ui_example"]
            if "ui_widget" in ui:
                field["type"] = ui["ui_widget"]
            if ui.get("ui_inline_authoring"):
                v = str(ui["ui_inline_authoring"]).lower()
                field["inlineAuthoring"] = v in ("1", "true", "yes", "on")

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

            if "ui_pattern" in ui:
                field["pattern"] = str(ui["ui_pattern"])
            if "ui_min_length" in ui:
                try:
                    field["minLength"] = int(ui["ui_min_length"])
                except (TypeError, ValueError):
                    pass
            if "ui_max_length" in ui:
                try:
                    field["maxLength"] = int(ui["ui_max_length"])
                except (TypeError, ValueError):
                    pass
            if "ui_minimum" in ui:
                try:
                    field["minimum"] = _parse_number_token(ui["ui_minimum"])
                except (TypeError, ValueError):
                    pass
            if "ui_maximum" in ui:
                try:
                    field["maximum"] = _parse_number_token(ui["ui_maximum"])
                except (TypeError, ValueError):
                    pass
            if "ui_weight" in ui:
                try:
                    field["ui_weight"] = int(ui["ui_weight"])
                except (TypeError, ValueError):
                    pass
            if "ui_json_schema_extras" in ui:
                parsed_ex = _maybe_parse_json(ui["ui_json_schema_extras"])
                if isinstance(parsed_ex, dict):
                    field["jsonSchemaExtras"] = parsed_ex
            if "ui_json_schema_rule" in ui:
                rule = _maybe_parse_json(ui["ui_json_schema_rule"])
                if isinstance(rule, dict):
                    json_schema_all_of_extra.append(rule)

            slot_pattern = getattr(slot, "pattern", None)
            if slot_pattern and "pattern" not in field:
                field["pattern"] = str(slot_pattern)
            for s_attr, f_key in (
                ("minimum_value", "minimum"),
                ("maximum_value", "maximum"),
            ):
                raw_sv = getattr(slot, s_attr, None)
                if raw_sv is not None and f_key not in field:
                    try:
                        field[f_key] = (
                            float(raw_sv)
                            if isinstance(raw_sv, str) and "." in str(raw_sv)
                            else raw_sv
                        )
                    except (TypeError, ValueError):
                        field[f_key] = raw_sv

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
        all_of_parts: list[Any] = []
        raw_class_all = ui_cls.get("ui_json_schema_allOf")
        if raw_class_all is not None:
            parsed_ca = (
                _maybe_parse_json(raw_class_all)
                if isinstance(raw_class_all, str)
                else raw_class_all
            )
            if isinstance(parsed_ca, list):
                all_of_parts.extend(parsed_ca)
        all_of_parts.extend(json_schema_all_of_extra)

        cls_entry: dict[str, Any] = {
            "key": key,
            "label": str(
                ui_cls.get("ui_label")
                or meta.get("label")
                or key.replace("_", " ").title()
            ),
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
        if all_of_parts:
            cls_entry["jsonSchemaAllOf"] = all_of_parts
        classes_out[key] = cls_entry
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
            # Mirror the SchemaView path: ontology-only slots never reach the form.
            _pres_slot = (pres.get("slots") or {}).get(slot_name) or {}
            _hidden = _pres_slot.get("ui_hidden") if isinstance(_pres_slot, dict) else None
            if _hidden is None:
                _hidden = (sdef.get("annotations") or {}).get("ui_hidden")
            if _hidden is not None and _is_truthy(_hidden):
                continue
            range_name = sdef.get("range")
            if range_name in enum_names:
                field_type = "select"
            elif isinstance(range_name, str) and range_name in classes:
                field_type = "relation"
            else:
                r = (range_name or "").lower()
                if r in ("integer", "int"):
                    field_type = "number"
                elif r in ("float", "double", "decimal"):
                    field_type = "float"
                elif r in ("boolean", "bool"):
                    field_type = "boolean"
                elif r in ("date", "datetime", "dateordatetime"):
                    field_type = "date"
                elif r in ("uri", "uriorcurie"):
                    field_type = "url"
                elif r == "wktliteral":
                    field_type = "geo_point"
                else:
                    field_type = "text"
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
                    rk = related.get("key")
                    if rk:
                        field["relationRegistryKey"] = str(rk)

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
                    _maybe_attach_enum_options(
                        field, range_name=range_name, enums=enums
                    )
                if file_slot.get("ui_inline_authoring") is not None:
                    v = str(file_slot["ui_inline_authoring"]).lower()
                    field["inlineAuthoring"] = v in ("1", "true", "yes", "on")
                if file_slot.get("ui_pattern") is not None:
                    field["pattern"] = str(file_slot["ui_pattern"])
                for fk_yaml, fk_field in (
                    ("ui_min_length", "minLength"),
                    ("ui_max_length", "maxLength"),
                ):
                    if file_slot.get(fk_yaml) is not None:
                        try:
                            field[fk_field] = int(file_slot[fk_yaml])
                        except (TypeError, ValueError):
                            pass
                if file_slot.get("ui_minimum") is not None:
                    try:
                        field["minimum"] = _parse_number_token(
                            str(file_slot["ui_minimum"])
                        )
                    except (TypeError, ValueError):
                        pass
                if file_slot.get("ui_maximum") is not None:
                    try:
                        field["maximum"] = _parse_number_token(
                            str(file_slot["ui_maximum"])
                        )
                    except (TypeError, ValueError):
                        pass
                if file_slot.get("ui_weight") is not None:
                    try:
                        field["ui_weight"] = int(file_slot["ui_weight"])
                    except (TypeError, ValueError):
                        pass
                if file_slot.get("ui_json_schema_extras") is not None:
                    parsed_ex = _maybe_parse_json(
                        str(file_slot["ui_json_schema_extras"])
                    )
                    if isinstance(parsed_ex, dict):
                        field["jsonSchemaExtras"] = parsed_ex

            pat = sdef.get("pattern")
            if pat and "pattern" not in field:
                field["pattern"] = str(pat)

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
            "labelPlural": meta.get("labelPlural")
            or f"{key.replace('_', ' ').title()}s",
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


def _deep_merge_class_registry(
    b_cls: dict[str, Any], o_cls: dict[str, Any]
) -> dict[str, Any]:
    """Merge two UI registry class dicts (extension overlay wins on conflicts)."""
    out = dict(b_cls)
    for k, v in o_cls.items():
        if (
            k == "fields"
            and isinstance(out.get("fields"), list)
            and isinstance(v, list)
        ):
            by_key: dict[str, Any] = {}
            for f in out["fields"]:
                if isinstance(f, dict) and f.get("key"):
                    by_key[str(f["key"])] = f
            for f in v:
                if isinstance(f, dict) and f.get("key"):
                    by_key[str(f["key"])] = f
            out["fields"] = list(by_key.values())
        elif isinstance(out.get(k), dict) and isinstance(v, dict):
            merged = dict(out[k])
            merged.update(v)
            out[k] = merged
        else:
            out[k] = v
    return out


def merge_extension_registry_overlay(
    doc: dict[str, Any], extension_path: Path | None
) -> dict[str, Any]:
    """
    Merge a YAML registry overlay (classes/enums) from extension_path into doc.
    Overlay file uses the same shape as registry fragments (classes/enums dicts).
    """
    if extension_path is None or not extension_path.is_file():
        return doc
    try:
        overlay = yaml.safe_load(extension_path.read_text())
    except Exception:
        return doc
    if not isinstance(overlay, dict):
        return doc
    classes = dict(doc.get("classes") or {})
    enums = dict(doc.get("enums") or {})
    if isinstance(overlay.get("classes"), dict):
        for ck, cv in overlay["classes"].items():
            if ck not in classes:
                classes[ck] = cv
            elif isinstance(classes[ck], dict) and isinstance(cv, dict):
                classes[ck] = _deep_merge_class_registry(classes[ck], cv)
            else:
                classes[ck] = cv
    if isinstance(overlay.get("enums"), dict):
        for ek, ev in overlay["enums"].items():
            if ek not in enums:
                enums[ek] = ev
            elif isinstance(enums[ek], dict) and isinstance(ev, dict):
                enums[ek] = {**enums[ek], **ev}
            else:
                enums[ek] = ev
    return {"classes": classes, "enums": enums}


def build_registry_document(
    schema_path: Path, extension_path: Path | None = None
) -> dict[str, Any]:
    """Return { 'classes': {...}, 'enums': {...} } from LinkML YAML, optional registry overlay merge."""
    ui_classmap_path = schema_path.parent.parent / "tools" / "ui-classmap.yaml"
    if _HAS_LINKML and SchemaView is not None:
        sv = SchemaView(str(schema_path))
        enums = _enum_payload(sv)
        doc = {
            "classes": build_classes(
                sv=sv, ui_classmap_path=ui_classmap_path, enums=enums
            ),
            "enums": enums,
        }
    else:
        schema = _load_schema(schema_path)
        enums = _enum_payload_pyyaml(schema)
        doc = {
            "classes": build_classes_pyyaml(
                schema=schema, ui_classmap_path=ui_classmap_path, enums=enums
            ),
            "enums": enums,
        }
    return merge_extension_registry_overlay(doc, extension_path)


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
