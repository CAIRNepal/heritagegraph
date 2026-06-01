#!/usr/bin/env python3
"""
Emit a conservative SHACL shape snippet from registry.generated.json.

Run after regenerating the registry snapshot:
    make ontology && make shacl
    # or: python3 tools/linkml_generate_registry.py && python3 tools/emit_minimal_shacl.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REG = ROOT / "heritage_graph_ui" / "src" / "lib" / "ontology" / "registry.generated.json"
DEFAULT_OUT = ROOT / "ontology" / "shapes" / "generated-heritagegraph-minimal-shacl.ttl"

TTL_PREFIXES = """@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix crm: <http://www.cidoc-crm.org/cidoc-crm/> .
@prefix hg: <https://w3id.org/heritagegraph/shacl#> .

"""


def expand_curie(curie: str) -> str:
    raw = (curie or "").strip()
    if raw.startswith(("http://", "https://")):
        return raw
    prefix, sep, rest = raw.partition(":")
    if not sep:
        return f"https://w3id.org/heritagegraph/{rest}"
    table = {
        "crm": "http://www.cidoc-crm.org/cidoc-crm/",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "heritageGraph": "https://w3id.org/heritagegraph/",
        "owl": "http://www.w3.org/2002/07/owl#",
        "geo": "http://www.opengis.net/ont/geosparql#",
        "prov": "http://www.w3.org/ns/prov#",
        "skos": "http://www.w3.org/2004/02/skos/core#",
        "dct": "http://purl.org/dc/terms/",
        "schema": "https://schema.org/",
        "aat": "http://vocab.getty.edu/aat/",
        "wikidata": "http://www.wikidata.org/entity/",
        "rico": "https://www.ica.org/standards/RiC/ontology#",
    }
    base = table.get(prefix, "https://w3id.org/heritagegraph/")
    return f"{base}{rest}"


def build_shacl_ttl(*, reg_path: Path) -> str:
    if not reg_path.is_file():
        raise FileNotFoundError(f"Registry snapshot not found: {reg_path}")

    data = json.loads(reg_path.read_text(encoding="utf-8"))
    classes = data.get("classes") or {}

    chunks: list[str] = []
    for cls_key in sorted(classes.keys()):
        cd = classes[cls_key]
        curi = cd.get("classUri") or ""
        if not curi:
            continue
        fields = cd.get("fields") or []

        tgt = expand_curie(str(curi))
        shape_iri = f"hg:{cls_key}Shape"
        props: list[str] = []

        for field in fields:
            su = field.get("slot_uri")
            if not su:
                continue
            pred = expand_curie(str(su))
            ft = field.get("type") or ""
            req = bool(field.get("required"))
            minc_raw = field.get("minimumCardinality")
            min_count = (
                1
                if req
                else (
                    int(minc_raw)
                    if isinstance(minc_raw, int) and int(minc_raw) > 0
                    else 0
                )
            )

            lines_inner = [
                "    sh:property [",
                f"      sh:path <{pred}> ;",
            ]
            if ft == "relation":
                lines_inner.append("      sh:nodeKind sh:IRI ;")
            else:
                lines_inner.append("      sh:nodeKind sh:Literal ;")
            if min_count > 0:
                lines_inner.append(f"      sh:minCount {min_count} ;")
            lines_inner.append("    ] ;")
            props.append("\n".join(lines_inner))

        if not props:
            continue

        block = [f"{shape_iri} a sh:NodeShape ;"]
        block.append(f'  rdfs:label "Shape for registry class {cls_key}" ;')
        block.append(f"  sh:targetClass <{tgt}> ;")
        block.extend(props)

        last = block[-1].rstrip().rstrip(";")
        block[-1] = last + " ."
        chunks.append("\n".join(block))

    if not chunks:
        return TTL_PREFIXES + "# No classUri entries produced shapes in this snapshot.\n"
    return TTL_PREFIXES + "\n\n".join(chunks) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REG)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if output file differs from regenerated content",
    )
    args = parser.parse_args()

    try:
        combined = build_shacl_ttl(reg_path=args.registry)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    if args.check:
        if not args.out.is_file():
            print(f"Missing {args.out} — run: make shacl", file=sys.stderr)
            return 1
        existing = args.out.read_text(encoding="utf-8")
        if existing != combined:
            print(f"Stale {args.out} — run: make shacl", file=sys.stderr)
            return 1
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(combined, encoding="utf-8")
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
