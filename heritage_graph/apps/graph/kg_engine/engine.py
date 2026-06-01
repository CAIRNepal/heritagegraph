"""
HeritageGraph Knowledge Graph Engine — unified Oxigraph orchestration.

All contribution, merge, and agent-promotion paths should go through this module.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.projector import tripleset_for_cultural_entity, tripleset_for_metadata
from apps.graph.kg_engine.promotion import promote_document_graph_to_public, promote_ntriples_to_public
from apps.graph.kg_engine.queries import fetch_neighborhood, fetch_type_counts
from apps.graph.kg_engine.store import KnowledgeGraphStore, StoreStats
from apps.graph.kg_engine.uris import (
    label_for_instance,
    relationship_predicate_uri,
    resource_uri_for_instance,
)

logger = logging.getLogger(__name__)


@dataclass
class PublishResult:
    subject_uri: str
    triple_count: int
    stored: bool
    shacl_conforms: bool | None = None
    shacl_report: str = ""


class KnowledgeGraphEngine:
    def __init__(self, store: KnowledgeGraphStore | None = None) -> None:
        self.store = store or KnowledgeGraphStore()

    def enabled(self) -> bool:
        return bool(getattr(settings, "RDF_SYNC_ENABLED", False))

    def publish_metadata_instance(self, instance: Any) -> PublishResult:
        triples, managed, uri = tripleset_for_metadata(instance)
        stored = self.publish_slot_projection(
            subject_uri=uri,
            triples=triples,
            managed_predicate_iris=managed,
        )
        return PublishResult(
            subject_uri=uri,
            triple_count=len(triples),
            stored=stored,
        )

    def publish_cultural_entity(self, entity: Any) -> PublishResult:
        triples, managed, uri = tripleset_for_cultural_entity(entity)
        stored = self.publish_slot_projection(
            subject_uri=uri,
            triples=triples,
            managed_predicate_iris=managed,
        )
        return PublishResult(
            subject_uri=uri,
            triple_count=len(triples),
            stored=stored,
        )

    def publish_slot_projection(
        self,
        *,
        subject_uri: str,
        triples: list[Any],
        managed_predicate_iris: set[str],
        graph: GraphPartition = GraphPartition.PUBLIC,
    ) -> bool:
        if not self.enabled():
            return False
        graph_uri = graph.uri()
        conforms, report = self._validate_shacl(triples)
        if conforms is False and getattr(settings, "RDF_SHACL_STRICT_ON_WRITE", False):
            logger.error("SHACL blocked publish for <%s>", subject_uri)
            return False

        ok = self._store_replace(
            subject_uri=subject_uri,
            triples=triples,
            managed_predicate_iris=managed_predicate_iris,
            graph_uri=graph_uri,
            skip_shacl=True,
        )
        if not ok:
            from apps.graph.kg_engine.outbox import enqueue_replace_slot

            enqueue_replace_slot(
                subject_uri=subject_uri,
                graph_uri=graph_uri,
                managed_predicate_iris=managed_predicate_iris,
                triples=triples,
                error="store replace failed",
            )
        return ok

    def publish_relationship(
        self, *, subject_uri: str, pred_suffix: str, object_uri: str
    ) -> bool:
        if not self.enabled():
            return False
        pred_uri = relationship_predicate_uri(pred_suffix)
        graph_uri = GraphPartition.PUBLIC.uri()
        return self.store.upsert_object_triple(
            subject_uri=subject_uri,
            pred_uri=pred_uri,
            object_uri=object_uri,
            graph_uri=graph_uri,
        )

    def delete_resource(self, uri: str, graph: GraphPartition = GraphPartition.PUBLIC) -> bool:
        if not self.enabled():
            return False
        graph_uri = graph.uri()
        ok = self.store.delete_subject(subject_uri=uri, graph_uri=graph_uri)
        if not ok:
            from apps.graph.kg_engine.outbox import enqueue_delete_subject

            enqueue_delete_subject(
                subject_uri=uri, graph_uri=graph_uri, error="delete failed"
            )
        return ok

    def promote_agent_ntriples(self, ntriples: str) -> bool:
        return promote_ntriples_to_public(ntriples, store=self.store)

    def promote_document(self, document_id: str) -> bool:
        return promote_document_graph_to_public(document_id, store=self.store)

    def rebuild_public_graph(self) -> int:
        from apps.cidoc_data.models import MetaData
        from django.apps import apps as django_apps

        if not self.enabled():
            return 0
        count = 0
        cfg = django_apps.get_app_config("cidoc_data")
        for model in cfg.get_models():
            if (
                not issubclass(model, MetaData)
                or model is MetaData
                or model._meta.abstract
            ):
                continue
            for obj in model.objects.all().iterator():
                result = self.publish_metadata_instance(obj)
                if result.stored:
                    count += 1
        return count

    def load_schema_tbox(self, ontology_path: Path | None = None) -> bool:
        from django.core.management import call_command

        call_command(
            "rdf_load_tbox",
            ontology_path=str(ontology_path) if ontology_path else "",
        )
        return True

    def stats(self) -> StoreStats:
        return self.store.stats(
            public_graph_uri=GraphPartition.PUBLIC.uri(),
            schema_graph_uri=GraphPartition.SCHEMA.uri(),
        )

    def neighborhood(self, subject_uri: str, *, limit: int = 50) -> list[dict[str, str]]:
        return fetch_neighborhood(subject_uri, limit=limit, store=self.store)

    def type_histogram(self) -> list[dict[str, str]]:
        return fetch_type_counts(store=self.store)

    def query(self, sparql: str) -> list[dict[str, str]]:
        return self.store.select(sparql)

    def _store_replace(
        self,
        *,
        subject_uri: str,
        triples: list[Any],
        managed_predicate_iris: set[str],
        graph_uri: str | None,
        skip_shacl: bool,
    ) -> bool:
        del skip_shacl
        endpoint = str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        if endpoint:
            return self.store.replace_managed_triples(
                subject_uri=subject_uri,
                managed_predicate_iris=managed_predicate_iris,
                triples=triples,
                graph_uri=graph_uri,
            )
        return self.store.local_replace_managed_triples(
            subject_uri=subject_uri,
            managed_predicate_iris=managed_predicate_iris,
            triples=triples,
            graph_uri=graph_uri,
        )

    def _validate_shacl(self, triples: list[Any]) -> tuple[bool | None, str]:
        if not getattr(settings, "RDF_SHACL_VALIDATE_ON_WRITE", False):
            return None, ""
        from apps.cidoc_data.shacl_validate import validate_projection_triples

        conforms, report = validate_projection_triples(triples)
        if not conforms:
            logger.warning("SHACL validation failed:\n%s", report[:2000])
        return conforms, report


@lru_cache(maxsize=1)
def get_kg_engine() -> KnowledgeGraphEngine:
    return KnowledgeGraphEngine()


# Convenience aliases used by legacy rdf_publish / signals
def publish_metadata(instance: Any) -> bool:
    return get_kg_engine().publish_metadata_instance(instance).stored


def publish_cultural_entity(entity: Any) -> bool:
    return get_kg_engine().publish_cultural_entity(entity).stored
