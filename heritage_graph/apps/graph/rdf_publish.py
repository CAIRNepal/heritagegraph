"""
Backward-compatible RDF publication facade.

New code should use ``apps.graph.kg_engine``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition


def public_graph_uri() -> str | None:
    return GraphPartition.PUBLIC.uri()


def persist_slot_projection(
    *,
    subject_uri: str,
    triples: list[Any],
    managed_predicate_iris: set[str],
) -> bool:
    return get_kg_engine().publish_slot_projection(
        subject_uri=subject_uri,
        triples=triples,
        managed_predicate_iris=managed_predicate_iris,
    )


def persist_relationship_triple(*, subject_uri: str, pred_uri: str, object_uri: str) -> bool:
    suffix = pred_uri.rsplit("/property/", 1)[-1] if "/property/" in pred_uri else pred_uri
    return get_kg_engine().publish_relationship(
        subject_uri=subject_uri,
        pred_suffix=suffix,
        object_uri=object_uri,
    )


def delete_subject_from_store(*, uri: str) -> bool:
    return get_kg_engine().delete_resource(uri)


def persist_cultural_entity_projection(entity: Any) -> bool:
    return get_kg_engine().publish_cultural_entity(entity).stored


def default_shapes_path() -> Path:
    from django.conf import settings

    env_path = getattr(settings, "HERITAGEGRAPH_SHACL_SHAPES_PATH", "") or ""
    if env_path:
        return Path(env_path)
    base = Path(settings.BASE_DIR).parent
    return base / "ontology" / "shapes" / "generated-heritagegraph-minimal-shacl.ttl"
