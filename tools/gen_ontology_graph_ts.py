"""Generate Cytoscape schema-graph TypeScript from HeritageGraph.yaml + ui-vizmap.yaml."""

from __future__ import annotations

import json
import textwrap
from typing import Any


def _expand_curie(curie: str, prefixes: dict[str, str]) -> str:
    curie = (curie or "").strip()
    if not curie:
        return curie
    if curie.startswith(("http://", "https://")):
        return curie
    if ":" not in curie:
        return prefixes.get("heritageGraph", "https://w3id.org/heritagegraph/") + curie
    prefix, rest = curie.split(":", 1)
    base = prefixes.get(prefix)
    if not base:
        return prefixes.get("heritageGraph", "https://w3id.org/heritagegraph/") + rest
    return base + rest


def _ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _hg_category_for_class(
    class_name: str, schema: dict[str, Any], vizmap: dict[str, Any]
) -> str:
    linkml_to_hg: dict[str, str] = {}
    for entry in vizmap.get("node_types") or []:
        lk = entry.get("linkml_class") or entry.get("key")
        if lk:
            linkml_to_hg[str(lk)] = str(entry.get("hg_category") or "tangible")

    classes = schema.get("classes") or {}
    current = class_name
    visited: set[str] = set()
    while current and current not in visited:
        visited.add(current)
        if current in linkml_to_hg:
            return linkml_to_hg[current]
        spec = classes.get(current)
        if not isinstance(spec, dict):
            break
        current = spec.get("is_a") or ""
    spec = classes.get(class_name) or {}
    class_uri = str(spec.get("class_uri") or "")
    if any(
        token in class_uri
        for token in (
            "E7_",
            "E12_",
            "E5_",
            "E6_",
            "RitualEvent",
            "Festival",
            "Consecration",
            "Enshrinement",
            "Production",
            "TransferOfCustody",
        )
    ):
        return "event"
    if class_name.endswith("Event") or class_name.endswith("Activity"):
        return "event"
    return "tangible"


def _schema_view_category(class_name: str, hg_category: str, vizmap: dict[str, Any]) -> str:
    overrides = vizmap.get("schema_category_overrides") or {}
    if class_name in overrides:
        return str(overrides[class_name])
    mapping = vizmap.get("schema_category_map") or {
        "tangible": "tangible",
        "conceptual": "conceptual",
        "event": "event",
        "spatial": "spatial",
        "temporal": "spatial",
        "actor": "social",
        "provenance": "provenance",
    }
    if class_name.startswith("LivingGoddess"):
        return "kumari"
    return str(mapping.get(hg_category, "tangible"))


def _class_nodes(schema: dict[str, Any], vizmap: dict[str, Any]) -> list[dict[str, Any]]:
    prefixes = schema.get("prefixes") or {}
    classes = schema.get("classes") or {}
    nodes: list[dict[str, Any]] = []
    for name, spec in sorted(classes.items()):
        if not isinstance(spec, dict):
            continue
        hg_cat = _hg_category_for_class(name, schema, vizmap)
        category = _schema_view_category(name, hg_cat, vizmap)
        class_uri = spec.get("class_uri") or ""
        cidoc = class_uri if class_uri else name
        node: dict[str, Any] = {
            "id": name,
            "label": name,
            "category": category,
            "cidocMapping": cidoc,
            "description": (spec.get("description") or "").strip() or name,
        }
        parent = spec.get("is_a")
        if parent:
            node["parent"] = str(parent)
        nodes.append(node)
    return nodes


def _enum_nodes(schema: dict[str, Any]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    enums = schema.get("enums") or {}
    for enum_name, enum_def in sorted(enums.items()):
        if not isinstance(enum_def, dict):
            continue
        nodes.append(
            {
                "id": enum_name,
                "label": enum_name,
                "category": "enum",
                "cidocMapping": f"heritageGraph:{enum_name}",
                "description": (enum_def.get("description") or f"Enumeration {enum_name}").strip(),
            }
        )
        for pv_name, pv_def in sorted((enum_def.get("permissible_values") or {}).items()):
            if not isinstance(pv_def, dict):
                continue
            member_id = f"{enum_name}_{pv_name}"
            nodes.append(
                {
                    "id": member_id,
                    "label": pv_name,
                    "category": "enum",
                    "cidocMapping": f"heritageGraph:{enum_name}#{pv_name}",
                    "description": (pv_def.get("description") or pv_name).strip(),
                    "parent": enum_name,
                }
            )
    return nodes


def _object_property_edges(schema: dict[str, Any]) -> list[tuple[str, str, str]]:
    classes = set((schema.get("classes") or {}).keys())
    enums = set((schema.get("enums") or {}).keys())
    slots = schema.get("slots") or {}
    edges: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    def add_edge(src: str, label: str, tgt: str) -> None:
        if tgt not in classes and tgt not in enums:
            return
        key = (src, label, tgt)
        if key in seen:
            return
        seen.add(key)
        edges.append(key)

    for class_name, spec in (schema.get("classes") or {}).items():
        if not isinstance(spec, dict):
            continue
        for slot_name in spec.get("slots") or []:
            slot_def = slots.get(slot_name) or {}
            if not isinstance(slot_def, dict):
                continue
            ranges: list[str] = []
            if slot_def.get("range"):
                ranges.append(str(slot_def["range"]).strip())
            for item in slot_def.get("any_of") or []:
                if isinstance(item, dict) and item.get("range"):
                    ranges.append(str(item["range"]).strip())
            for rng in ranges:
                if rng in ("string", "integer", "float", "boolean", "date", "datetime", "uri"):
                    continue
                add_edge(class_name, slot_name, rng)

    return sorted(edges, key=lambda t: (t[0], t[1], t[2]))


def generate_ontology_graph_ts(
    schema: dict[str, Any],
    vizmap: dict[str, Any],
    *,
    source_hash: str,
) -> str:
    """Return TypeScript source for __generated__/ontology-graph.ts."""
    nodes = _class_nodes(schema, vizmap) + _enum_nodes(schema)
    is_a_edges = [
        (n["id"], n["parent"])
        for n in nodes
        if n.get("parent") and n["parent"] in {x["id"] for x in nodes}
    ]
    op_edges = _object_property_edges(schema)

    categories = vizmap.get("schema_view_categories") or {
        "tangible": {"bg": "#3b82f6", "border": "#2563eb", "text": "#fff", "label": "Tangible Heritage"},
        "conceptual": {"bg": "#8b5cf6", "border": "#7c3aed", "text": "#fff", "label": "Conceptual Entities"},
        "event": {"bg": "#f59e0b", "border": "#d97706", "text": "#fff", "label": "Events"},
        "social": {"bg": "#10b981", "border": "#059669", "text": "#fff", "label": "Social / Actors"},
        "spatial": {"bg": "#06b6d4", "border": "#0891b2", "text": "#fff", "label": "Spatiotemporal"},
        "provenance": {"bg": "#ec4899", "border": "#db2777", "text": "#fff", "label": "Provenance"},
        "kumari": {"bg": "#ef4444", "border": "#dc2626", "text": "#fff", "label": "Living Goddess"},
        "enum": {"bg": "#94a3b8", "border": "#64748b", "text": "#fff", "label": "Enumerations"},
        "external": {"bg": "#78716c", "border": "#57534e", "text": "#fff", "label": "External (CRM/AAT)"},
    }

    lines: list[str] = [
        "// AUTO-GENERATED — do not edit by hand.",
        "// Source:  ontology/HeritageGraph.yaml + tools/ui-vizmap.yaml",
        "// Regen:   python3 tools/gen_heritage_viz_config.py  (or: make ontology)",
        f"// Hash:    {source_hash}",
        "//",
        "// Cytoscape schema graph (/graphview → Ontology tab).",
        "",
        "export type OntologyCategory =",
        "  | 'tangible'",
        "  | 'conceptual'",
        "  | 'event'",
        "  | 'social'",
        "  | 'spatial'",
        "  | 'provenance'",
        "  | 'kumari'",
        "  | 'enum'",
        "  | 'external';",
        "",
        "export interface OntologyNode {",
        "  id: string;",
        "  label: string;",
        "  category: OntologyCategory;",
        "  cidocMapping: string;",
        "  description: string;",
        "  parent?: string;",
        "}",
        "",
        "export interface OntologyEdge {",
        "  id: string;",
        "  source: string;",
        "  target: string;",
        "  label: string;",
        "  edgeType: 'is_a' | 'object_property';",
        "}",
        "",
        "export interface OntologyGraphData {",
        "  nodes: OntologyNode[];",
        "  edges: OntologyEdge[];",
        "}",
        "",
        "export const CATEGORY_COLORS: Record<",
        "  OntologyCategory,",
        "  { bg: string; border: string; text: string; label: string }",
        "> = {",
    ]
    for key, colors in categories.items():
        lines.append(
            f"  {key}: {{ bg: {_ts_string(colors['bg'])}, border: {_ts_string(colors['border'])}, "
            f"text: {_ts_string(colors['text'])}, label: {_ts_string(colors['label'])} }},"
        )
    lines.append("};")
    lines.append("")
    lines.append("const NODES: OntologyNode[] = [")
    for node in nodes:
        parts = [
            f"id: {_ts_string(node['id'])}",
            f"label: {_ts_string(node['label'])}",
            f"category: {_ts_string(node['category'])}",
            f"cidocMapping: {_ts_string(node['cidocMapping'])}",
            f"description: {_ts_string(node['description'])}",
        ]
        if node.get("parent"):
            parts.append(f"parent: {_ts_string(node['parent'])}")
        lines.append(f"  {{ {', '.join(parts)} }},")
    lines.append("];")
    lines.append("")

    lines.append("const IS_A_EDGES: OntologyEdge[] = [")
    for child, parent in is_a_edges:
        lines.append(
            f"  {{ id: {_ts_string(f'isa__{child}__{parent}')}, source: {_ts_string(child)}, "
            f"target: {_ts_string(parent)}, label: 'is_a', edgeType: 'is_a' }},"
        )
    lines.append("];")
    lines.append("")

    lines.append("const PROPERTY_EDGES: OntologyEdge[] = [")
    for i, (src, label, tgt) in enumerate(op_edges):
        lines.append(
            f"  {{ id: {_ts_string(f'op_{i}')}, source: {_ts_string(src)}, "
            f"target: {_ts_string(tgt)}, label: {_ts_string(label)}, edgeType: 'object_property' }},"
        )
    lines.append("];")
    lines.append("")

    lines.extend(
        [
            "export function getOntologyGraphData(): OntologyGraphData {",
            "  return { nodes: NODES, edges: [...IS_A_EDGES, ...PROPERTY_EDGES] };",
            "}",
            "",
            "export function getNodeById(id: string): OntologyNode | undefined {",
            "  return NODES.find((n) => n.id === id);",
            "}",
            "",
            "export function getNodesByCategory(c: OntologyCategory): OntologyNode[] {",
            "  return NODES.filter((n) => n.category === c);",
            "}",
            "",
            "export function getEdgesForNode(nodeId: string): OntologyEdge[] {",
            "  return [...IS_A_EDGES, ...PROPERTY_EDGES].filter(",
            "    (e) => e.source === nodeId || e.target === nodeId,",
            "  );",
            "}",
            "",
            "export function getOntologyStats() {",
            "  const data = getOntologyGraphData();",
            "  const hgNodes = data.nodes.filter((n) => n.category !== 'external');",
            "  return {",
            "    totalClasses: hgNodes.length,",
            "    objectProperties: data.edges.filter((e) => e.edgeType === 'object_property').length,",
            "    hierarchyEdges: data.edges.filter((e) => e.edgeType === 'is_a').length,",
            "    categories: new Set(data.nodes.map((n) => n.category)).size,",
            "    externalClasses: data.nodes.filter((n) => n.category === 'external').length,",
            "    enumMembers: data.nodes.filter((n) => n.parent?.includes('Enum')).length,",
            "  };",
            "}",
            "",
        ]
    )
    return "\n".join(lines)
