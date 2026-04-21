"""
RDF / triplestore projection hooks (MR3).

When RDF_SYNC_ENABLED and RDF_ENDPOINT_URL are set, POST SPARQL UPDATE
to the configured store on save/delete of CIDOC MetaData models.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import requests
from django.apps import apps
from django.conf import settings
from django.db.models.signals import post_delete, post_save

logger = logging.getLogger(__name__)

_CONNECTED = False


def rdf_sync_enabled() -> bool:
    return bool(getattr(settings, "RDF_SYNC_ENABLED", False))


def _resource_uri(instance: Any) -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    name = instance.__class__.__name__.lower()
    return f"{base}/{name}/{instance.pk}"


def _label_for(instance: Any) -> str:
    for attr in ("name", "title"):
        v = getattr(instance, attr, None)
        if v:
            return str(v)[:500]
    return str(instance.pk)


def _escape_literal(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _sparql_update(update: str) -> None:
    endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
    if not endpoint or not rdf_sync_enabled():
        return
    try:
        r = requests.post(
            endpoint,
            data=update.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            timeout=45,
        )
        r.raise_for_status()
    except Exception as exc:
        logger.warning("RDF SPARQL update failed: %s", exc)


def queue_entity_projection(instance: Any | None = None, **_kwargs: object) -> None:
    """Upsert minimal triples for one CIDOC record (stub → rdfs:label)."""
    if not rdf_sync_enabled() or instance is None:
        return
    uri = _resource_uri(instance)
    label = _escape_literal(_label_for(instance))
    update = (
        "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n"
        f"INSERT DATA {{ <{uri}> rdfs:label \"{label}\" . }}\n"
    )
    _sparql_update(update)


def _delete_projection(instance: Any) -> None:
    if not rdf_sync_enabled() or instance is None:
        return
    uri = _resource_uri(instance)
    update = f"DELETE WHERE {{ <{uri}> ?p ?o . }}\n"
    _sparql_update(update)


def _is_cidoc_metadata_model(model: type) -> bool:
    from apps.cidoc_data.models import MetaData

    return (
        issubclass(model, MetaData)
        and model is not MetaData
        and not model._meta.abstract
    )


def _on_instance_saved(sender, instance, **kwargs: object) -> None:
    queue_entity_projection(instance)


def _on_instance_deleted(sender, instance, **kwargs: object) -> None:
    _delete_projection(instance)


def connect_signals() -> None:
    """Register RDF hooks once (idempotent). Handlers no-op unless RDF_SYNC_ENABLED."""
    global _CONNECTED
    if _CONNECTED:
        return
    cfg = apps.get_app_config("cidoc_data")
    seen: set[type] = set()
    for model in cfg.get_models():
        if not _is_cidoc_metadata_model(model) or model in seen:
            continue
        seen.add(model)
        post_save.connect(_on_instance_saved, sender=model, weak=False)
        post_delete.connect(_on_instance_deleted, sender=model, weak=False)
    _CONNECTED = True


def project_all_metadata_instances() -> int:
    """Full rebuild: emit INSERT DATA for every MetaData subclass row."""
    if not rdf_sync_enabled():
        return 0
    n = 0
    cfg = apps.get_app_config("cidoc_data")
    for model in cfg.get_models():
        if not _is_cidoc_metadata_model(model):
            continue
        for obj in model.objects.all().iterator():
            queue_entity_projection(obj)
            n += 1
    return n


def is_readonly_sparql_query(q: str) -> bool:
    """Reject obvious write operations for the public SPARQL proxy."""
    s = " ".join((q or "").lower().split())
    if not s:
        return False
    if re.search(r"\b(insert|delete|drop|load|clear|copy|move|add|create)\b", s):
        return False
    return bool(re.search(r"\b(select|ask|construct|describe)\b", s))
