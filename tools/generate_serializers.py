#!/usr/bin/env python3
"""
Emit heritage_graph/apps/cidoc_data/serializers.generated.py from ontology/HeritageGraph.yaml.

Usage:
    python3 tools/generate_serializers.py          # write file
    python3 tools/generate_serializers.py --check  # exit 1 if out of date (CI)

Each class in DJANGO_MODEL_TO_REGISTRY_CLASS_KEY gets a serializer stub that
inherits BaseRegistrySerializer so runtime JSON Schema validation is automatic.
Classes with hand-written specialised logic (EntityCluster, HeritageAssertion,
DataSource, PersonRevision) are intentionally skipped — they live in serializers.py.
"""

from __future__ import annotations

import argparse
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = (
    ROOT / "heritage_graph" / "apps" / "cidoc_data" / "serializers.generated.py"
)

# Models whose serializers are hand-written in serializers.py and must NOT be
# overridden by generated stubs.
SKIP_MODELS: frozenset[str] = frozenset(
    {
        "EntityCluster",
        "HeritageAssertion",
        "DataSource",
        "PersonRevision",
    }
)

HEADER = textwrap.dedent(
    """\
    # AUTO-GENERATED — do not edit by hand.
    # Run: python3 tools/generate_serializers.py   (or: make serializers)
    #
    # Contains DRF serializer stubs for every CIDOC entity mapped in
    # cidoc_registry_keys.DJANGO_MODEL_TO_REGISTRY_CLASS_KEY, excluding the
    # handful of models whose serializers are hand-written in serializers.py.
    #
    # Each stub inherits BaseRegistrySerializer which automatically validates
    # inbound payloads against the LinkML-derived JSON Schema at runtime.

    from __future__ import annotations

    from .models import (
    {model_imports}
    )
    from .serializers import BaseRegistrySerializer

    """
)

STUB_TMPL = textwrap.dedent(
    """\
    class {name}GeneratedSerializer(BaseRegistrySerializer):
        \"\"\"Auto-generated serializer stub for {name} (registry key: {key}).\"\"\"

        class Meta:
            model = {name}
            fields = "__all__"

    """
)


def build_source(registry_key_map: dict[str, str]) -> str:
    """Return the full Python source for serializers.generated.py."""
    stubs: list[str] = []
    model_names: list[str] = []

    for model_name, registry_key in sorted(registry_key_map.items()):
        if model_name in SKIP_MODELS:
            continue
        model_names.append(model_name)
        stubs.append(STUB_TMPL.format(name=model_name, key=registry_key))

    model_imports = "\n".join(f"    {m}," for m in sorted(model_names))
    header = HEADER.format(model_imports=model_imports)
    return header + "\n".join(stubs)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if the output file differs from what would be generated",
    )
    args = parser.parse_args()

    sys.path.insert(0, str(ROOT / "heritage_graph"))

    from apps.cidoc_data.cidoc_registry_keys import DJANGO_MODEL_TO_REGISTRY_CLASS_KEY

    source = build_source(DJANGO_MODEL_TO_REGISTRY_CLASS_KEY)

    if args.check:
        if not args.out.is_file():
            print(
                f"MISSING: {args.out} — run `make serializers` to generate it.",
                file=sys.stderr,
            )
            sys.exit(1)
        existing = args.out.read_text(encoding="utf-8")
        if existing != source:
            print(
                f"OUT OF DATE: {args.out} — run `make serializers` to regenerate.",
                file=sys.stderr,
            )
            sys.exit(1)
        print(f"OK: {args.out} is up to date.")
        return

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(source, encoding="utf-8")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
