"""
Load and cache the effective ontology registry from LinkML YAML (see ontology_builder).
"""

from __future__ import annotations

import logging
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_CACHE: dict[str, Any] | None = None
_CACHE_VERSION: str | None = None


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()[:64]


def _schema_path() -> Path:
    raw = getattr(settings, "HERITAGEGRAPH_SCHEMA_PATH", None) or ""
    p = Path(raw) if raw else Path(settings.BASE_DIR) / "ontology" / "HeritageGraph.yaml"
    return p


def _extension_path() -> Path | None:
    raw = getattr(settings, "HERITAGEGRAPH_SCHEMA_EXTENSION_PATH", None) or ""
    if not raw.strip():
        return None
    p = Path(raw)
    return p if p.is_file() else None


def build_fresh_payload() -> dict[str, Any]:
    # Import lazily so the schema endpoint can still serve last-known-good DB rows
    # even when LinkML dependencies are not installed in the runtime environment.
    from apps.cidoc_data.ontology_builder import (
        build_registry_document,
        build_registry_jsonschema_blob,
        compute_schema_version,
        load_contribute_hub_payload,
    )

    schema_path = _schema_path()
    if not schema_path.is_file():
        raise FileNotFoundError(f"HeritageGraph schema not found: {schema_path}")
    ext = _extension_path()
    doc = build_registry_document(schema_path, extension_path=ext)
    classes = doc["classes"]
    enums = doc["enums"]
    version = compute_schema_version(schema_path, ext, classes, enums)
    ui_classmap_path = Path(settings.BASE_DIR).parent / "tools" / "ui-classmap.yaml"
    contribute_hub_path = Path(settings.BASE_DIR).parent / "tools" / "contribute-hub.yaml"
    core_parts = [schema_path.read_bytes(), b"\n"]
    if ui_classmap_path.is_file():
        core_parts.append(ui_classmap_path.read_bytes())
    if contribute_hub_path.is_file():
        core_parts.extend((b"\n", contribute_hub_path.read_bytes()))
    ui_pres_path = Path(settings.BASE_DIR).parent / "tools" / "ui-presentation.yaml"
    if ui_pres_path.is_file():
        core_parts.extend((b"\n", ui_pres_path.read_bytes()))
    core_hash = hashlib.sha256(b"".join(core_parts)).hexdigest()[:64]
    contribute_hub = load_contribute_hub_payload(contribute_hub_path)
    registry_jsonschema = build_registry_jsonschema_blob(classes)
    return {
        "schema_version": version,
        "core_hash": core_hash,
        "extension_hash": _sha256_file(ext) if ext else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tenant_id": None,
        "degraded": False,
        "classes": classes,
        "enums": enums,
        "contribute_hub": contribute_hub,
        "registry_jsonschema": registry_jsonschema,
    }


def get_effective_registry_payload(*, tenant=None) -> dict[str, Any]:
    """
    Return API registry document. Single-tenant: *tenant* ignored.
    Uses in-process cache; invalidates when schema_version changes.
    """
    global _CACHE, _CACHE_VERSION
    try:
        fresh = build_fresh_payload()
    except Exception as exc:
        logger.exception("Failed to build ontology registry from YAML: %s", exc)
        return _last_known_good_or_raise()

    if _CACHE is not None and fresh["schema_version"] == _CACHE_VERSION:
        return _CACHE

    _CACHE = fresh
    _CACHE_VERSION = fresh["schema_version"]
    return fresh


def _last_known_good_or_raise() -> dict[str, Any]:
    from apps.cidoc_data.models import SchemaRegistry

    row = SchemaRegistry.objects.order_by("-created_at").first()
    if row and row.registry_json:
        payload = dict(row.registry_json)
        payload.setdefault("degraded", True)
        return payload
    raise RuntimeError("No schema cache available and YAML load failed")


def invalidate_registry_cache() -> None:
    global _CACHE, _CACHE_VERSION
    _CACHE = None
    _CACHE_VERSION = None
