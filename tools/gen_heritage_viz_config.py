#!/usr/bin/env python3
"""
Generate ontology-derived TypeScript and Python artifacts from the canonical schema.

Inputs  (never edit the outputs below — edit these instead):
  ontology/HeritageGraph.yaml   — semantic source of truth (classes, slots, prefixes, enums)
  tools/ui-vizmap.yaml          — presentational config (colors, emojis, hgCategory, predicates)

Outputs (auto-generated — do not edit by hand):
  heritage_graph_ui/src/lib/ontology/__generated__/heritage-viz-config.ts
  heritage_graph_ui/src/lib/ontology/__generated__/enums.ts
  heritage_graph_ui/src/lib/ontology/__generated__/ontology-graph.ts
  heritage_graph/apps/graph/ontology_config.py

Usage:
  python3 tools/gen_heritage_viz_config.py            # regenerate
  python3 tools/gen_heritage_viz_config.py --check    # exit 1 if outputs differ (CI)
  python3 tools/gen_heritage_viz_config.py --dry-run  # print to stdout, write nothing

The --check flag is used in CI to enforce that generated files are committed
alongside schema changes. Prefer:
  1. Edit ontology/HeritageGraph.yaml and/or tools/ui-vizmap.yaml
  2. Run make ontology   (registry + viz + schema graph + forms enums)
  3. Commit all changed generated files together
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import textwrap
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print(
        "PyYAML is required: pip install pyyaml",
        file=sys.stderr,
    )
    sys.exit(2)

# ─── Path constants ────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "ontology" / "HeritageGraph.yaml"
VIZMAP_PATH = ROOT / "tools" / "ui-vizmap.yaml"

OUT_VIZ_TS = (
    ROOT
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "__generated__"
    / "heritage-viz-config.ts"
)
OUT_ENUMS_TS = (
    ROOT
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "__generated__"
    / "enums.ts"
)
OUT_PY = ROOT / "heritage_graph" / "apps" / "graph" / "ontology_config.py"
OUT_ONTOLOGY_GRAPH_TS = (
    ROOT
    / "heritage_graph_ui"
    / "src"
    / "lib"
    / "ontology"
    / "__generated__"
    / "ontology-graph.ts"
)

# ─── YAML helpers ─────────────────────────────────────────────────────────────


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


# ─── Schema accessors ─────────────────────────────────────────────────────────


def _class_uri(schema: dict, class_name: str) -> str:
    """Return class_uri for a LinkML class, or empty string if not found."""
    return (
        (schema.get("classes") or {})
        .get(class_name, {})
        .get("class_uri", "")
        or ""
    )


def _slot_uri(schema: dict, slot_name: str) -> str:
    """Return slot_uri for a LinkML slot, or empty string if not found."""
    return (
        (schema.get("slots") or {})
        .get(slot_name, {})
        .get("slot_uri", "")
        or ""
    )


def _schema_prefixes(schema: dict) -> dict[str, str]:
    return schema.get("prefixes") or {}


def _schema_enums(schema: dict) -> dict[str, Any]:
    return schema.get("enums") or {}


# ─── Validation ───────────────────────────────────────────────────────────────


def _validate_vizmap(schema: dict, vizmap: dict) -> list[str]:
    """Return list of error strings; empty means clean."""
    errors: list[str] = []
    schema_classes = set((schema.get("classes") or {}).keys())
    schema_slots = set((schema.get("slots") or {}).keys())
    schema_prefixes = set(_schema_prefixes(schema).keys())

    # node_types: linkml_class must exist in schema
    for nt in vizmap.get("node_types") or []:
        lc = nt.get("linkml_class", "")
        if lc and lc not in schema_classes:
            errors.append(
                f"node_type '{nt.get('key')}': linkml_class '{lc}' not found in schema classes"
            )
        cat = nt.get("hg_category", "")
        valid_cats = set((vizmap.get("hg_categories") or {}).keys())
        if cat and cat not in valid_cats:
            errors.append(
                f"node_type '{nt.get('key')}': hg_category '{cat}' not in hg_categories"
            )

    # viz_predicates: slot should exist in schema (unless cidoc_note provided)
    for p in vizmap.get("viz_predicates") or []:
        slot = p.get("slot", "")
        if slot and slot not in schema_slots and not p.get("cidoc_note"):
            errors.append(
                f"viz_predicate '{slot}': not found in schema slots and no cidoc_note fallback"
            )

    # core_prefixes: must exist in schema
    for pfx in vizmap.get("core_prefixes") or []:
        if pfx not in schema_prefixes:
            errors.append(
                f"core_prefix '{pfx}' not found in schema prefixes"
            )

    return errors


# ─── CIDOC mapping string ─────────────────────────────────────────────────────


def _cidoc_mapping(key: str, linkml_class: str, schema: dict) -> str:
    """
    Build the cidocMapping display string.
    - If key == linkml_class, return class_uri directly.
    - If key is an alias (Settlement → Place), show 'hg:Key → class_uri'.
    """
    uri = _class_uri(schema, linkml_class)
    if not uri:
        return f"heritageGraph:{key}"
    if key != linkml_class:
        return f"hg:{key} → {uri}"
    return uri


# ─── Source hash (embedded in generated file headers) ────────────────────────


def _source_hash(schema_path: Path, vizmap_path: Path) -> str:
    h = hashlib.sha256()
    h.update(schema_path.read_bytes())
    h.update(vizmap_path.read_bytes())
    return h.hexdigest()[:16]


# ─── TypeScript generation ─────────────────────────────────────────────────────


_TS_BANNER = """\
// AUTO-GENERATED — do not edit by hand.
// Source:  ontology/HeritageGraph.yaml + tools/ui-vizmap.yaml
// Regen:   python3 tools/gen_heritage_viz_config.py
// Hash:    {hash}
//
// This file is the single source of truth for graph-visualization ontology
// config consumed by:
//   - heritage-museum page  (NodeType, NODE_TYPE_CONFIG, RELATION_LABELS)
//   - ForceGraph component  (NODE_TYPE_CONFIG, RELATION_LABELS)
//   - All RDF-aware frontend code (RDF_PREFIXES, HG_CATEGORY_CONFIG)
"""


def _gen_viz_config_ts(schema: dict, vizmap: dict, source_hash: str) -> str:
    node_types = vizmap.get("node_types") or []
    categories = vizmap.get("hg_categories") or {}
    predicates = vizmap.get("viz_predicates") or []
    core_prefix_keys = vizmap.get("core_prefixes") or []
    all_prefixes = _schema_prefixes(schema)
    core_prefixes = {k: all_prefixes[k] for k in core_prefix_keys if k in all_prefixes}

    lines: list[str] = [_TS_BANNER.format(hash=source_hash), ""]

    # ── RDF_PREFIXES ──────────────────────────────────────────────────────────
    lines.append("/** RDF namespace prefixes — derived from ontology/HeritageGraph.yaml. */")
    lines.append("export const RDF_PREFIXES: Readonly<Record<string, string>> = {")
    for k, v in core_prefixes.items():
        lines.append(f'  {k}: "{v}",')
    lines.append("};")
    lines.append("")

    # ── NodeType union ────────────────────────────────────────────────────────
    node_keys = [nt["key"] for nt in node_types]
    union_parts = "\n  | ".join(f"'{k}'" for k in node_keys)
    lines.append(
        "/**\n"
        " * HeritageGraph node types for the knowledge-graph visualization.\n"
        " * Each key maps to a LinkML class in ontology/HeritageGraph.yaml.\n"
        " */"
    )
    lines.append(f"export type NodeType =\n  | {union_parts};")
    lines.append("")

    # ── HgCategory union ──────────────────────────────────────────────────────
    cat_keys = list(categories.keys())
    cat_union = " | ".join(f"'{k}'" for k in cat_keys)
    lines.append(f"export type HgCategory = {cat_union};")
    lines.append("")

    # ── NODE_TYPE_CONFIG ──────────────────────────────────────────────────────
    lines.append("/** Visual configuration for each NodeType in the force-directed graph. */")
    lines.append(
        "export const NODE_TYPE_CONFIG: Record<\n"
        "  NodeType,\n"
        "  { color: string; glowColor: string; emoji: string; label: string;"
        " cidocMapping: string; hgCategory: string }\n"
        "> = {"
    )
    for nt in node_types:
        key = nt["key"]
        linkml_class = nt.get("linkml_class", key)
        cidoc = _cidoc_mapping(key, linkml_class, schema)
        label = nt.get("label", key)
        color = nt["color"]
        glow = nt["glow_color"]
        emoji = nt["emoji"]
        cat = nt["hg_category"]
        lines.append(
            f"  {key}: {{"
            f" color: '{color}', glowColor: '{glow}', emoji: '{emoji}',"
            f" label: '{label}', cidocMapping: '{cidoc}', hgCategory: '{cat}'"
            f" }},"
        )
    lines.append("};")
    lines.append("")

    # ── RDF_CLASS_URI_TO_NODE_TYPE ────────────────────────────────────────────
    # Maps the ontology class IRI (the rdf:type emitted into Oxigraph) back to
    # the canonical NodeType, so the museum can type *live KG* nodes straight
    # from their real rdf:type instead of a hand-written enum. Alias viz types
    # (e.g. SacredSite, Settlement) collapse to their underlying ontology class —
    # the KG does not distinguish them, so neither should a faithful read.
    def _expand_curie(curie: str) -> str:
        if not curie or ":" not in curie:
            return curie
        pfx, local = curie.split(":", 1)
        base = all_prefixes.get(pfx)
        return base + local if base else curie

    class_uri_to_key: dict[str, str] = {}
    for nt in node_types:
        key = nt["key"]
        linkml_class = nt.get("linkml_class", key)
        full = _expand_curie(_class_uri(schema, linkml_class))
        if not full:
            continue
        # Prefer the canonical type (key == linkml_class) on classUri collision.
        if full not in class_uri_to_key or key == linkml_class:
            class_uri_to_key[full] = key
    lines.append(
        "/** Ontology class IRI (rdf:type in the Oxigraph public graph) → canonical NodeType. */"
    )
    lines.append("export const RDF_CLASS_URI_TO_NODE_TYPE: Record<string, NodeType> = {")
    for uri, key in sorted(class_uri_to_key.items()):
        lines.append(f'  "{uri}": "{key}",')
    lines.append("};")
    lines.append("")

    # ── RELATION_LABELS ───────────────────────────────────────────────────────
    lines.append(
        "/**\n"
        " * Human-readable labels for edge predicates in the graph visualization.\n"
        " * Slot URIs are resolved from ontology/HeritageGraph.yaml slots section.\n"
        " */"
    )
    lines.append("export const RELATION_LABELS: Record<string, string> = {")
    for p in predicates:
        slot = p["slot"]
        label = p["label"]
        uri = _slot_uri(schema, slot) or p.get("cidoc_note", f"heritageGraph:{slot}")
        lines.append(f"  {slot}: '{label}',  // {uri}")
    lines.append("};")
    lines.append("")

    # ── HG_CATEGORY_CONFIG ────────────────────────────────────────────────────
    lines.append("/** Color scheme for each domain category in the legend and cluster view. */")
    lines.append(
        "export const HG_CATEGORY_CONFIG: Record<"
        "HgCategory, { color: string; border: string; label: string }> = {"
    )
    for cat_key, cfg in categories.items():
        lines.append(
            f"  {cat_key}: {{ color: '{cfg['color']}', border: '{cfg['border']}', label: '{cfg['label']}' }},"
        )
    lines.append("};")
    lines.append("")

    return "\n".join(lines)


# ─── Enums TypeScript generation ──────────────────────────────────────────────


_ENUMS_BANNER = """\
// AUTO-GENERATED — do not edit by hand.
// Source:  ontology/HeritageGraph.yaml (enums section)
// Regen:   python3 tools/gen_heritage_viz_config.py
// Hash:    {hash}
//
// Controlled vocabularies for select fields in contribution forms.
// Edit permissible_values in the schema, then re-run the generator.
"""


def _gen_enums_ts(schema: dict, source_hash: str) -> str:
    enums = _schema_enums(schema)
    lines: list[str] = [_ENUMS_BANNER.format(hash=source_hash), ""]
    lines.append("export const ontologyEnums = {")

    for enum_name, enum_def in enums.items():
        pvs: dict[str, Any] = (enum_def or {}).get("permissible_values") or {}
        if not pvs:
            continue
        lines.append(f"  {enum_name}: [")
        for pv_name, pv_def in pvs.items():
            pv_def = pv_def or {}
            title = pv_def.get("title", "")
            desc = pv_def.get("description", "")
            # Use title as label if present, else humanize the key
            label = title if title else pv_name
            entry_parts = [f'value: "{pv_name}"', f'label: "{label}"']
            if desc:
                # Escape double quotes in description
                safe_desc = desc.replace('"', '\\"')
                entry_parts.append(f'description: "{safe_desc}"')
            lines.append(f"    {{ {', '.join(entry_parts)} }},")
        lines.append("  ],")
        lines.append("")

    lines.append("} as const;")
    lines.append("")
    lines.append("export type EnumKey = keyof typeof ontologyEnums;")
    lines.append("")
    return "\n".join(lines)


# ─── Python generation ────────────────────────────────────────────────────────


_PY_BANNER = '''\
"""
AUTO-GENERATED — do not edit by hand.
Source:  ontology/HeritageGraph.yaml (prefixes section)
Regen:   python3 tools/gen_heritage_viz_config.py
Hash:    {hash}

Import this module wherever RDF prefix expansion is needed instead of
re-declaring the dict inline (which risks silent drift).

Usage:
    from apps.graph.ontology_config import RDF_PREFIXES
"""
'''


def _gen_py_config(schema: dict, vizmap: dict, source_hash: str) -> str:
    # The backend RDF projection expands CURIEs from this map. It MUST carry the
    # full prefix set declared in the schema — not just the UI ``core_prefixes`` —
    # otherwise CURIEs for crminf/crmsci/crmdig/datacite/time/skos/etc. silently
    # collapse into the heritageGraph namespace (minting incorrect IRIs).
    all_prefixes = _schema_prefixes(schema)

    lines: list[str] = [_PY_BANNER.format(hash=source_hash), ""]
    lines.append("from __future__ import annotations")
    lines.append("")
    lines.append("RDF_PREFIXES: dict[str, str] = {")
    for k, v in all_prefixes.items():
        lines.append(f'    "{k}": "{v}",')
    lines.append("}")
    lines.append("")
    # Convenience inverse map: full URI → prefix
    lines.append("# Inverse map used for compacting IRIs to CURIEs")
    lines.append("URI_TO_PREFIX: dict[str, str] = {v: k for k, v in RDF_PREFIXES.items()}")
    lines.append("")
    lines.append("")
    lines.append("def expand_curie(curie: str) -> str:")
    lines.append('    """Expand a CURIE (e.g. \'crm:E53_Place\') to a full IRI."""')
    lines.append("    curie = (curie or '').strip()")
    lines.append("    if not curie:")
    lines.append("        return curie")
    lines.append("    if curie.startswith((\"http://\", \"https://\")):")
    lines.append("        return curie")
    lines.append("    if ':' not in curie:")
    lines.append("        return RDF_PREFIXES.get('heritageGraph', 'https://w3id.org/heritagegraph/') + curie")
    lines.append("    prefix, rest = curie.split(':', 1)")
    lines.append("    base = RDF_PREFIXES.get(prefix)")
    lines.append("    if not base:")
    lines.append("        return RDF_PREFIXES.get('heritageGraph', 'https://w3id.org/heritagegraph/') + rest")
    lines.append("    return base + rest")
    lines.append("")

    return "\n".join(lines)


# ─── Drift report ─────────────────────────────────────────────────────────────


def _check_drift(path: Path, new_content: str) -> bool:
    """Return True if file content differs from new_content."""
    if not path.is_file():
        return True
    return path.read_text(encoding="utf-8") != new_content


# ─── CLI ──────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if any output differs from committed content (CI gate)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print generated content to stdout; write no files",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=SCHEMA_PATH,
        metavar="PATH",
        help=f"Path to LinkML schema YAML (default: {SCHEMA_PATH.relative_to(ROOT)})",
    )
    parser.add_argument(
        "--vizmap",
        type=Path,
        default=VIZMAP_PATH,
        metavar="PATH",
        help=f"Path to visual map YAML (default: {VIZMAP_PATH.relative_to(ROOT)})",
    )
    args = parser.parse_args(argv)

    schema_path: Path = args.schema
    vizmap_path: Path = args.vizmap

    # ── Load inputs ───────────────────────────────────────────────────────────
    for p in (schema_path, vizmap_path):
        if not p.is_file():
            print(f"ERROR: input file not found: {p}", file=sys.stderr)
            return 2

    schema = _load_yaml(schema_path)
    vizmap = _load_yaml(vizmap_path)

    # ── Validate vizmap against schema ────────────────────────────────────────
    errors = _validate_vizmap(schema, vizmap)
    if errors:
        print("Validation errors in ui-vizmap.yaml:", file=sys.stderr)
        for e in errors:
            print(f"  • {e}", file=sys.stderr)
        return 1

    source_hash = _source_hash(schema_path, vizmap_path)

    # ── Generate content ──────────────────────────────────────────────────────
    sys.path.insert(0, str(ROOT))
    from tools.gen_ontology_graph_ts import generate_ontology_graph_ts

    viz_ts = _gen_viz_config_ts(schema, vizmap, source_hash)
    enums_ts = _gen_enums_ts(schema, source_hash)
    py_cfg = _gen_py_config(schema, vizmap, source_hash)
    ontology_graph_ts = generate_ontology_graph_ts(schema, vizmap, source_hash=source_hash)

    outputs = [
        (OUT_VIZ_TS, viz_ts, "heritage-viz-config.ts"),
        (OUT_ENUMS_TS, enums_ts, "enums.ts"),
        (OUT_ONTOLOGY_GRAPH_TS, ontology_graph_ts, "ontology-graph.ts"),
        (OUT_PY, py_cfg, "ontology_config.py"),
    ]

    # ── Dry-run ───────────────────────────────────────────────────────────────
    if args.dry_run:
        separator = "=" * 72
        for path, content, name in outputs:
            print(f"\n{separator}")
            print(f"# {name} ({path.relative_to(ROOT)})")
            print(separator)
            print(content)
        return 0

    # ── Check mode (CI gate) ──────────────────────────────────────────────────
    if args.check:
        drifted = [
            str(path.relative_to(ROOT))
            for path, content, _ in outputs
            if _check_drift(path, content)
        ]
        if drifted:
            print(
                "ERROR: generated files are out of date with the schema.\n"
                "Run:  python3 tools/gen_heritage_viz_config.py\n"
                "Then commit the updated files alongside your schema changes.\n\n"
                "Drifted files:",
                file=sys.stderr,
            )
            for f in drifted:
                print(f"  {f}", file=sys.stderr)
            return 1
        print("✓ All generated ontology artifacts are up to date.")
        return 0

    # ── Write outputs ─────────────────────────────────────────────────────────
    for path, content, name in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        rel = path.relative_to(ROOT)
        print(f"✓ {rel}")

    print(f"\nSource hash: {source_hash}")
    print("Commit all changed files together with the schema change.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
