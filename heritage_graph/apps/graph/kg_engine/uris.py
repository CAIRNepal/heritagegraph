"""Canonical URI policy for knowledge graph resources."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition


def resource_base() -> str:
    return str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")


def resource_uri_for_instance(instance: Any) -> str:
    segment = instance.__class__.__name__.lower()
    try:
        from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model

        rk = registry_class_key_for_model(instance.__class__)
        if rk:
            segment = str(rk).strip().lower()
    except Exception:
        pass
    return f"{resource_base()}/{segment}/{instance.pk}"


def cultural_entity_uri(entity_id: Any) -> str:
    return f"{resource_base()}/entity/{entity_id}"


def relationship_predicate_uri(prop_suffix: str) -> str:
    suffix = (prop_suffix or "").strip().lstrip("relationship.")
    return f"{resource_base()}/property/{suffix}"


def document_graph_uri(document_id: str) -> str:
    return GraphPartition.DOCUMENT.uri(suffix=str(document_id)) or ""


def label_for_instance(instance: Any) -> str:
    for attr in ("name", "title"):
        value = getattr(instance, attr, None)
        if value:
            return str(value)[:500]
    return str(instance.pk)
