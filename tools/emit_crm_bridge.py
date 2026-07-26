#!/usr/bin/env python3
"""
Emit the CIDOC-CRM alignment bridge + disjointness TBox from HeritageGraph.yaml.

WHY THIS EXISTS
---------------
The LinkML ``gen-owl`` export (ontology/HeritageGraph.ttl) mints a fresh
``heritageGraph:`` class for every class and wires the *local* subclass tree,
but it does **not** assert the ``rdfs:subClassOf`` links to the CIDOC-CRM
classes named in each class's ``class_uri`` / ``broad_mappings``, and it drops
all ``disjoint_with`` declarations. The net effect is that a Temple instance can
never be entailed to be a ``crm:E22_Human-Made_Object`` and no inconsistency can
ever be detected.

This generator closes both gaps. It reads the canonical YAML and emits:

  * ``rdfs:subClassOf``  heritage class → CRM class            (class_uri, when CRM)
  * ``rdfs:subClassOf``  heritage class → CRM class            (broad_mappings, when CRM)
  * ``skos:exactMatch``  heritage class → external authority   (exact_mappings)
  * ``skos:broadMatch``  heritage class → external authority   (broad_mappings, non-CRM/AAT)
  * ``owl:disjointWith`` heritage class ↔ heritage class       (disjoint_with)

Design choices a reviewer should note:
  * CRM links use ``rdfs:subClassOf`` (sound, upward entailment only) — never
    ``owl:equivalentClass``, which would falsely make every E22/E55/E7 an
    instance of our specialised classes.
  * External-authority links (schema.org, Wikidata, DBpedia, AAT) use SKOS
    mapping properties, not ``owl:equivalentClass``, so OWL-RL reasoning does
    not conflate our entities with the full external description.

Output: ontology/heritagegraph-crm-bridge.ttl  (loaded into the SCHEMA graph
alongside HeritageGraph.ttl by ``manage.py rdf_load_tbox``).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "ontology" / "HeritageGraph.yaml"
OUT = ROOT / "ontology" / "heritagegraph-crm-bridge.ttl"

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
CRM_FAMILY_PREFIXES = ("crm", "crmsci", "crmdig", "crminf")


def _expand(curie: str, prefixes: dict[str, str]) -> str:
    raw = (curie or "").strip()
    if not raw:
        return ""
    if raw.startswith(("http://", "https://")):
        return raw
    if ":" not in raw:
        return prefixes.get("heritageGraph", "https://w3id.org/heritagegraph/") + raw
    pfx, _, local = raw.partition(":")
    base = prefixes.get(pfx)
    return (base + local) if base else ""


def _is_crm_family(curie: str) -> bool:
    return (curie or "").split(":", 1)[0] in CRM_FAMILY_PREFIXES


def _is_aat(curie: str) -> bool:
    return (curie or "").startswith("aat:")


def generate(schema: dict) -> str:
    prefixes: dict[str, str] = schema.get("prefixes") or {}
    classes: dict[str, dict] = schema.get("classes") or {}
    hg = prefixes.get("heritageGraph", "https://w3id.org/heritagegraph/")

    def class_iri(name: str) -> str:
        return f"{hg}{name}"

    subclass: list[tuple[str, str]] = []
    exact: list[tuple[str, str]] = []
    broad: list[tuple[str, str]] = []
    close: list[tuple[str, str]] = []
    disjoint_pairs: set[tuple[str, str]] = set()

    for cname, cdef in classes.items():
        cdef = cdef or {}
        if cdef.get("union_of"):
            # union pseudo-classes are not first-class CRM types; skip bridging.
            continue
        subj = class_iri(cname)

        # class_uri → CRM superclass (only when it points at the CRM family and
        # is not just the local heritageGraph class node itself).
        cu = cdef.get("class_uri") or ""
        if _is_crm_family(cu):
            crm_iri = _expand(cu, prefixes)
            if crm_iri:
                subclass.append((subj, crm_iri))

        # broad_mappings → subClassOf (CRM) or skos:broadMatch (AAT/other)
        for bm in cdef.get("broad_mappings") or []:
            target = _expand(bm, prefixes)
            if not target:
                continue
            if _is_crm_family(bm):
                subclass.append((subj, target))
            else:
                broad.append((subj, target))

        # exact_mappings → skos:exactMatch (external authorities; not owl:equivalentClass)
        for em in cdef.get("exact_mappings") or []:
            target = _expand(em, prefixes)
            if not target:
                continue
            if _is_crm_family(em):
                subclass.append((subj, target))
            else:
                exact.append((subj, target))

        # close_mappings → skos:closeMatch (CRM family → subClassOf instead)
        for cm in cdef.get("close_mappings") or []:
            target = _expand(cm, prefixes)
            if not target:
                continue
            if _is_crm_family(cm):
                subclass.append((subj, target))
            else:
                close.append((subj, target))

        # disjoint_with → owl:disjointWith (canonical unordered pair, dedup)
        for dw in cdef.get("disjoint_with") or []:
            if dw in classes:
                a, b = sorted((cname, dw))
                disjoint_pairs.add((a, b))

    lines: list[str] = [
        "# AUTO-GENERATED — do not edit by hand.",
        "# Source:  ontology/HeritageGraph.yaml",
        "# Regen:   python3 tools/emit_crm_bridge.py",
        "#",
        "# CIDOC-CRM alignment bridge + disjointness axioms. Loaded into the SCHEMA",
        "# named graph so OWL-RL/RDFS reasoning can (a) entail CRM supertypes for",
        "# every heritage class and (b) detect class-disjointness violations.",
        "",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix owl:  <http://www.w3.org/2002/07/owl#> .",
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
        "@prefix hg:   <https://w3id.org/heritagegraph/> .",
        "@prefix crm:  <http://www.cidoc-crm.org/cidoc-crm/> .",
        "",
        "# ── rdfs:subClassOf → CIDOC-CRM (sound upward entailment) ──────────────",
    ]
    for s, o in _dedup(subclass):
        lines.append(f"<{s}> rdfs:subClassOf <{o}> .")

    lines.append("")
    lines.append("# ── skos:exactMatch → external authorities ────────────────────────────")
    for s, o in _dedup(exact):
        lines.append(f"<{s}> skos:exactMatch <{o}> .")

    lines.append("")
    lines.append("# ── skos:closeMatch → external authorities (EDM / GeoNames / schema.org) ──")
    for s, o in _dedup(close):
        lines.append(f"<{s}> skos:closeMatch <{o}> .")

    lines.append("")
    lines.append("# ── skos:broadMatch → external authorities ────────────────────────────")
    for s, o in _dedup(broad):
        lines.append(f"<{s}> skos:broadMatch <{o}> .")

    lines.append("")
    lines.append("# ── owl:disjointWith (class-level consistency constraints) ────────────")
    for a, b in sorted(disjoint_pairs):
        lines.append(f"<{hg}{a}> owl:disjointWith <{hg}{b}> .")

    lines.append("")
    return "\n".join(lines)


def _dedup(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for p in pairs:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return sorted(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Exit 1 if output is stale (CI gate)")
    args = parser.parse_args(argv)

    schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8")) or {}
    content = generate(schema)

    if args.check:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != content:
            print("ERROR: ontology/heritagegraph-crm-bridge.ttl is out of date. Run: python3 tools/emit_crm_bridge.py", file=sys.stderr)
            return 1
        print("✓ CRM bridge TTL is up to date.")
        return 0

    OUT.write_text(content, encoding="utf-8")
    n_sub = content.count("rdfs:subClassOf")
    n_dis = content.count("owl:disjointWith")
    print(f"✓ {OUT.relative_to(ROOT)}  ({n_sub} subClassOf, {n_dis} disjointWith)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
