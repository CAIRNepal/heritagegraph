#!/usr/bin/env python3
"""Verify tools/contribute-hub.yaml intent routes map to contribute pages."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRIBUTE_UI = ROOT / "heritage_graph_ui" / "src" / "app" / "(dashboard)" / "contribute"
HUB_PATH = ROOT / "tools" / "contribute-hub.yaml"

# Hub route segment → filesystem segment under contribute/
ROUTE_SEGMENT_ALIASES: dict[str, str] = {
    "cultural-entity": "entity",
}


def segment_from_route(route: str) -> str | None:
    prefix = "/contribute/"
    if not route.startswith(prefix):
        return None
    rest = route[len(prefix) :].strip("/")
    if not rest or "/" in rest:
        return None
    return rest


def main() -> None:
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        print("verify_contribute_intent_routes: PyYAML required", file=sys.stderr)
        sys.exit(2)

    if not HUB_PATH.is_file():
        print(f"Missing {HUB_PATH}", file=sys.stderr)
        sys.exit(2)

    hub = yaml.safe_load(HUB_PATH.read_text(encoding="utf-8"))
    intents = hub.get("intents") if isinstance(hub, dict) else None
    if not isinstance(intents, list):
        print("contribute-hub.yaml: missing intents list", file=sys.stderr)
        sys.exit(2)

    errors: list[str] = []
    for row in intents:
        if not isinstance(row, dict):
            continue
        route = row.get("route")
        key = row.get("registryKey")
        if not isinstance(route, str):
            errors.append(f"intent {key!r}: invalid route")
            continue
        seg = segment_from_route(route)
        if seg is None:
            errors.append(f"intent {key!r}: unsupported route {route!r} (expected single /contribute/<segment>)")
            continue
        fs_seg = ROUTE_SEGMENT_ALIASES.get(seg, seg)
        page = CONTRIBUTE_UI / fs_seg / "page.tsx"
        if not page.is_file():
            errors.append(f"intent {key!r}: route {route} → missing {page.relative_to(ROOT)}")

    if errors:
        print("verify_contribute_intent_routes: FAIL", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    print("verify_contribute_intent_routes: ok")


if __name__ == "__main__":
    main()
