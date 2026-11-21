"""Validate API payloads against `registry_jsonschema` (MT1)."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import jsonschema
from jsonschema import Draft202012Validator
from rest_framework.exceptions import ValidationError as DRFValidationError


def coerce_for_jsonschema(value: Any) -> Any:
    """Coerce DRF/Python values to JSON-schema-friendly types."""
    if value is None:
        return None
    # DRF ModelSerializer FK fields become model instances in validated_data.
    try:
        from django.db.models import Model

        if isinstance(value, Model):
            return value.pk
    except Exception:
        pass
    if isinstance(value, Decimal):
        return float(value)
    # DRF's PrimaryKeyRelatedField hands back the raw pk, so a relation to a
    # UUID-pk model (DataSource, HeritageAssertion) yields a UUID object. The
    # DRF renderer copes with that; `json.dumps` into a JSONField does not.
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if isinstance(value, dict):
        return {k: coerce_for_jsonschema(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [coerce_for_jsonschema(v) for v in value]
    return value


def drop_null_properties(payload: dict[str, Any]) -> dict[str, Any]:
    """Omit null-valued keys so optional unset fields pass Draft 2020-12 schemas."""
    return {k: v for k, v in payload.items() if v is not None}


def _merge_drf_errors(errors: dict[str, Any], path: tuple, message: str) -> None:
    if not path:
        errors.setdefault("non_field_errors", []).append(message)
        return
    key = str(path[0])
    if len(path) == 1:
        if key in errors and isinstance(errors[key], list):
            errors[key].append(message)
        elif key in errors:
            errors[key] = [errors[key], message]
        else:
            errors[key] = message
        return
    rest = ".".join(str(p) for p in path[1:])
    compound = f"{key}.{rest}"
    errors.setdefault(compound, []).append(message)


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
    jsonschema.validate(instance=drop_null_properties(coerce_for_jsonschema(payload)), schema=schema)


def validate_payload_for_class_drf(
    *,
    class_key: str,
    payload: dict[str, Any],
    registry_jsonschema: dict[str, Any] | None,
) -> None:
    """
    Validate payload; raise rest_framework.exceptions.ValidationError with field keys.
    No-op when schema or class_key entry is missing.
    """
    if not registry_jsonschema:
        return
    bundle = registry_jsonschema.get("byClassKey") or {}
    schema = bundle.get(class_key)
    if not schema:
        return

    validator = Draft202012Validator(schema)
    collected: dict[str, Any] = {}
    for err in validator.iter_errors(drop_null_properties(coerce_for_jsonschema(payload))):
        path = tuple(err.absolute_path)
        _merge_drf_errors(collected, path, err.message)

    if not collected:
        return

    # Normalize list values to single strings where only one message
    flat: dict[str, Any] = {}
    for k, v in collected.items():
        if isinstance(v, list) and len(v) == 1:
            flat[k] = v[0]
        else:
            flat[k] = v
    raise DRFValidationError(flat)
