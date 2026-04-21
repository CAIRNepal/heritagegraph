#!/usr/bin/env python3
"""
MT6 — Emit a suggested relation_backrefs table from LinkML + ui-classmap.

The Django module heritage_graph/apps/cidoc_data/relation_backrefs.py is still
authoritative at runtime; run this after ontology changes to diff suggestions:

  python3 tools/generate_relation_backrefs.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "heritage_graph"))

from apps.cidoc_data.ontology_builder import (  # noqa: E402
    build_registry_document,
)


def main() -> None:
    schema = ROOT / "ontology" / "HeritageGraph.yaml"
    doc = build_registry_document(schema)
    classes = doc["classes"]
    print("# Suggested rows (model, field_name, multivalued, references_domain)")
    for _key, cls in sorted(classes.items()):
        for f in cls.get("fields") or []:
            if f.get("type") != "relation":
                continue
            rt = f.get("relationTo")
            if not rt:
                continue
            target = None
            for tk, tc in classes.items():
                # registry keys are ui keys; relationTo is LinkML class name
                if tc.get("label") and rt in str(tc):
                    pass
            print(
                f"# {cls.get('key')}.{f.get('key')} -> {rt} (map LinkML class to Django model manually)"
            )


if __name__ == "__main__":
    main()
