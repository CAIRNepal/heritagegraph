"""Promote inferred/document graph assertions into the canonical public graph."""

from __future__ import annotations

import logging

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.store import KnowledgeGraphStore

logger = logging.getLogger(__name__)


def promote_ntriples_to_public(ntriples: str, *, store: KnowledgeGraphStore | None = None) -> bool:
    """
    Copy assertion N-Triples into the public graph (additive; does not remove document graph).
    """
    if not getattr(settings, "RDF_KG_PROMOTE_ON_AUTO_ACCEPT", True):
        return True
    public = GraphPartition.PUBLIC.uri()
    kg_store = store or KnowledgeGraphStore()
    return kg_store.insert_ntriples(ntriples, graph_uri=public)


def promote_document_graph_to_public(
    document_id: str, *, store: KnowledgeGraphStore | None = None
) -> bool:
    """Copy all triples from a document ingestion graph into the public graph."""
    source = GraphPartition.DOCUMENT.uri(suffix=document_id)
    target = GraphPartition.PUBLIC.uri()
    if not source or not target:
        return False
    kg_store = store or KnowledgeGraphStore()
    return kg_store.copy_graph(source_graph_uri=source, target_graph_uri=target)
