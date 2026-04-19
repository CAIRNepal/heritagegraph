#!/usr/bin/env python3
"""Emit registry.generated.json + registry.generated.ts from ontology/HeritageGraph.yaml."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = ROOT / "ontology" / "HeritageGraph.yaml"
DEFAULT_JSON = ROOT / "heritage_graph_ui" / "src" / "lib" / "ontology" / "registry.generated.json"
DEFAULT_TS = ROOT / "heritage_graph_ui" / "src" / "lib" / "ontology" / "registry.generated.ts"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--out-json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--out-ts", type=Path, default=DEFAULT_TS)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if outputs differ from regenerated content",
    )
    args = parser.parse_args()

    sys.path.insert(0, str(ROOT / "heritage_graph"))

    from apps.cidoc_data.ontology_builder import (
        build_registry_document,
        compute_schema_version,
    )

    schema_path = args.schema
    if not schema_path.is_file():
        print(f"Schema not found: {schema_path}", file=sys.stderr)
        sys.exit(2)

    doc = build_registry_document(schema_path)
    classes = doc["classes"]
    enums = doc["enums"]
    version = compute_schema_version(schema_path, None, classes, enums)
    payload = {
        "schema_version": version,
        "tenant_id": None,
        "degraded": False,
        "classes": classes,
        "enums": enums,
    }

    text = json.dumps(payload, indent=2) + "\n"
    if args.check:
        if not args.out_json.is_file():
            sys.exit(1)
        existing = args.out_json.read_text(encoding="utf-8")
        if existing != text:
            sys.exit(1)
        return

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(text, encoding="utf-8")

    ts_literal = json.dumps(payload)
    args.out_ts.write_text(
        "// AUTO-GENERATED — do not edit by hand. Run: python3 tools/linkml_generate_registry.py\n"
        f"export const generatedOntologyRegistry = {ts_literal} as const;\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.out_json} and {args.out_ts}")


if __name__ == "__main__":
    main()
