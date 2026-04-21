"""Validate API payloads against `registry_jsonschema` (MT1)."""

from __future__ import annotations

from typing import Any

import jsonschema


def validate_payload_for_class(
    *,
    class_key: str,
    payload: dict[str, Any],
    registry_jsonschema: dict[str, Any] | None,
) -> None:
    """
    Raise jsonschema.ValidationError if payload does not match the generated schema.
    Skip if no schema bundle is present.
    """
    if not registry_jsonschema:
        return
    bundle = registry_jsonschema.get("byClassKey") or {}
    schema = bundle.get(class_key)
    if not schema:
        return
    jsonschema.validate(instance=payload, schema=schema)
