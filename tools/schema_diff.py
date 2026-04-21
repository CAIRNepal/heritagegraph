#!/usr/bin/env python3
"""Schema evolution helper (MR5): compare two ontology YAML files and print slot/class diffs.

Usage:
  python3 tools/schema_diff.py ontology/HeritageGraph.yaml ontology/HeritageGraph.yaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("old_path", type=Path)
    p.add_argument("new_path", type=Path)
    args = p.parse_args()
    old = yaml.safe_load(args.old_path.read_text(encoding="utf-8")) or {}
    new = yaml.safe_load(args.new_path.read_text(encoding="utf-8")) or {}
    old_slots = set((old.get("slots") or {}).keys())
    new_slots = set((new.get("slots") or {}).keys())
    print("Removed slots:", sorted(old_slots - new_slots))
    print("Added slots:", sorted(new_slots - old_slots))
    old_cls = set((old.get("classes") or {}).keys())
    new_cls = set((new.get("classes") or {}).keys())
    print("Removed classes:", sorted(old_cls - new_cls))
    print("Added classes:", sorted(new_cls - old_cls))


if __name__ == "__main__":
    main()
    sys.exit(0)
