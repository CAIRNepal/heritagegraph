#!/usr/bin/env python3
"""
Emit SKOS ConceptSchemes for every LinkML enum, with Getty AAT alignment.

The enum ``permissible_values`` in ontology/HeritageGraph.yaml carry ``meaning``
(e.g. ``aat:300004829``) and ``broad_mappings`` (e.g. ``aat:300069290``). Those
are the controlled-vocabulary anchors that make the graph interoperable with the
Getty AAT. Reading them from the *registry* loses them (the registry drops
``meaning``), so this generator reads the YAML directly.

Output: ontology/lod/skos-vocabularies.ttl — a published SKOS vocabulary that is
loaded into the SCHEMA graph by ``manage.py rdf_load_tbox``. Each enum value
becomes a ``skos:Concept`` in a per-enum ``skos:ConceptScheme`` and, where the
schema gives a Getty mapping, a ``skos:exactMatch`` / ``skos:broadMatch`` link.
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
OUT = ROOT / "ontology" / "lod" / "skos-vocabularies.ttl"

AAT = "http://vocab.getty.edu/aat/"
HG = "https://w3id.org/heritagegraph/"


def _expand(curie: str, prefixes: dict[str, str]) -> str:
    raw = (curie or "").strip()
    if not raw or raw.startswith(("http://", "https://")):
        return raw
    if ":" not in raw:
        return HG + raw
    pfx, _, local = raw.partition(":")
    base = prefixes.get(pfx)
    return (base + local) if base else ""


def _esc(text: str) -> str:
    return str(text).replace("\\", "\\\\").replace('"', '\\"')


def generate(schema: dict) -> str:
    prefixes: dict[str, str] = schema.get("prefixes") or {}
    enums: dict[str, dict] = schema.get("enums") or {}

    lines = [
        "# AUTO-GENERATED — do not edit by hand.",
        "# Source:  ontology/HeritageGraph.yaml (enums section)",
        "# Regen:   python3 tools/emit_skos_vocabularies.py",
        "#",
        "# AAT-aligned SKOS controlled vocabularies for HeritageGraph enums.",
        "",
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
        "@prefix crm:  <http://www.cidoc-crm.org/cidoc-crm/> .",
        "@prefix aat:  <http://vocab.getty.edu/aat/> .",
        "@prefix hg:   <https://w3id.org/heritagegraph/> .",
        "",
    ]

    for enum_name, enum_def in enums.items():
        enum_def = enum_def or {}
        scheme = f"{HG}vocab/{enum_name}"
        enum_uri = _expand(enum_def.get("enum_uri", ""), prefixes)
        if enum_uri:
            lines.append(f"<{scheme}> a skos:ConceptScheme ;")
            lines.append(f'  skos:prefLabel "{enum_name}"@en ;')
            lines.append(f"  skos:relatedMatch <{enum_uri}> .")
        else:
            lines.append(f"<{scheme}> a skos:ConceptScheme ;")
            lines.append(f'  skos:prefLabel "{enum_name}"@en .')

        for value, pv in (enum_def.get("permissible_values") or {}).items():
            pv = pv or {}
            concept = f"{scheme}/{value}"
            props = [f"  skos:inScheme <{scheme}>"]
            props.append(f'  skos:prefLabel "{value}"@en')
            desc = pv.get("description")
            if desc:
                props.append(f'  skos:definition "{_esc(desc)}"@en')

            meaning = _expand(pv.get("meaning", ""), prefixes)
            if meaning.startswith(AAT):
                props.append(f"  skos:exactMatch <{meaning}>")
            elif meaning.startswith(HG) and meaning != concept:
                props.append(f"  skos:exactMatch <{meaning}>")
            for bm in pv.get("broad_mappings") or []:
                target = _expand(bm, prefixes)
                if target:
                    props.append(f"  skos:broadMatch <{target}>")

            lines.append(f"<{concept}> a skos:Concept ;")
            for p in props[:-1]:
                lines.append(p + " ;")
            lines.append(props[-1] + " .")
            lines.append("")

    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Exit 1 if output is stale (CI gate)")
    args = parser.parse_args(argv)

    schema = yaml.safe_load(SCHEMA_PATH.read_text(encoding="utf-8")) or {}
    content = generate(schema)

    if args.check:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != content:
            print("ERROR: ontology/lod/skos-vocabularies.ttl is out of date. Run: python3 tools/emit_skos_vocabularies.py", file=sys.stderr)
            return 1
        print("✓ SKOS vocabularies TTL is up to date.")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(content, encoding="utf-8")
    n_exact = content.count("skos:exactMatch")
    n_broad = content.count("skos:broadMatch")
    print(f"✓ {OUT.relative_to(ROOT)}  ({n_exact} exactMatch, {n_broad} broadMatch)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
