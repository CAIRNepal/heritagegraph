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

from apps.graph.kg_engine.lux_museum import (
    fetch_federated_neighborhood,
    fetch_museum_projection_with_lux,
)
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.projector import (
    tripleset_for_cultural_entity,
    tripleset_for_metadata,
)
from apps.graph.kg_engine.promotion import (
    promote_document_graph_to_public,
    promote_ntriples_to_public,
)
from apps.graph.kg_engine.queries import (
    fetch_graph_projection,
    fetch_neighborhood,
    fetch_type_counts,
)
from apps.graph.kg_engine.store import KnowledgeGraphStore, StoreStats
from apps.graph.kg_engine.uris import (
    relationship_predicate_uri,
    resource_uri_for_instance,
)
from django.conf import settings

logger = logging.getLogger(__name__)

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
HG = "https://w3id.org/heritagegraph/"
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"

# Map property names → (CRM class IRI, linking predicate IRI, event slug)
# Used by materialise_event_node to decide which event type to insert.
EVENT_TRIGGER_MAP: dict[str, tuple[str, str, str]] = {
    "was_produced_by": (CRM + "E12_Production", CRM + "P108_has_produced", "production"),
    "enshrined_deity": (CRM + "E90_Symbolic_Object", HG + "enshrined_in_structure", "enshrinement"),
    "makes_deity_present": (CRM + "E90_Symbolic_Object", HG + "enshrined_in_structure", "consecration"),
    "commissioned_by": (CRM + "E12_Production", CRM + "P108_has_produced", "production"),
}


def resource_uri_for_instance_from_assertion(assertion: Any) -> str | None:
    inst = django_instance_from_assertion(assertion, as_object=False)
    return resource_uri_for_instance(inst) if inst else None


def resource_uri_for_object_assertion(assertion: Any) -> str | None:
    inst = django_instance_from_assertion(assertion, as_object=True)
    return resource_uri_for_instance(inst) if inst else None


def django_instance_from_assertion(assertion: Any, *, as_object: bool = False) -> Any | None:
    if as_object:
        ct_id = assertion.object_content_type_id
        pk = assertion.object_object_id
    else:
        ct_id = assertion.content_type_id
        pk = assertion.object_id
    if ct_id is None or pk is None:
        return None
    from django.contrib.contenttypes.models import ContentType

    ct = ContentType.objects.get(pk=ct_id)
    model = ct.model_class()
    if model is None:
        return None
    try:
        return model.objects.get(pk=pk)
    except model.DoesNotExist:
        return None


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

    def _ensure_public_resource(self, instance: Any) -> None:
        """Project subject/object if missing rdf:type in the public graph (avoids dangling edges)."""
        if not self.enabled() or instance is None:
            return
        from apps.cidoc_data.publication_policy import is_published_for_rdf

        if not is_published_for_rdf(instance):
            return
        from apps.graph.ontology_config import RDF_PREFIXES

        uri = resource_uri_for_instance(instance)
        public = GraphPartition.PUBLIC.uri()
        if not public:
            return
        rdf_type = RDF_PREFIXES["rdf"] + "type"
        rows = self.store.select(
            f"SELECT ?t WHERE {{ GRAPH <{public}> {{ <{uri}> <{rdf_type}> ?t }} }} LIMIT 1"
        )
        if rows:
            return
        self.publish_metadata_instance(instance)

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

    def _purge_legacy_property_edges(
        self, *, subject_uri: str, object_uri: str, suffix: str, raw: str
    ) -> None:
        """Remove deprecated ``{base}/property/…`` edges left by older projection code."""
        from apps.graph.kg_engine.uris import legacy_property_predicate_uri

        public_graph = GraphPartition.PUBLIC.uri()
        if not public_graph:
            return
        candidates = {
            legacy_property_predicate_uri(suffix),
            legacy_property_predicate_uri(raw),
            legacy_property_predicate_uri(f"relationship.{suffix}"),
        }
        for pred_uri in candidates:
            sparql = (
                f"DELETE WHERE {{ GRAPH <{public_graph}> {{ "
                f"<{subject_uri}> <{pred_uri}> <{object_uri}> . }} }}\n"
            )
            self.store.update(sparql)

    def publish_assertion(self, assertion: Any) -> bool:
        """Project an accepted HeritageAssertion to public + assertion + prov graphs."""
        if not self.enabled():
            return False
        from apps.cidoc_data.assertion_validation import is_relationship_property
        from apps.graph.kg_engine.assertion_projection import (
            build_relationship_assertion_triples,
            build_slot_assertion_triples,
        )

        if assertion.reconciliation_status != "accepted":
            return self.unpublish_assertion(assertion)

        from apps.cidoc_data.publication_policy import (
            is_curated_assertion,
            is_published_for_rdf,
        )

        if not is_curated_assertion(assertion):
            return self.unpublish_assertion(assertion)

        subj_inst = django_instance_from_assertion(assertion, as_object=False)
        if not subj_inst:
            return False
        obj_inst = django_instance_from_assertion(assertion, as_object=True)
        if obj_inst is not None and not is_published_for_rdf(obj_inst):
            return self.unpublish_assertion(assertion)
        if not is_published_for_rdf(subj_inst):
            return self.unpublish_assertion(assertion)
        self._ensure_public_resource(subj_inst)
        subj_uri = resource_uri_for_instance(subj_inst)

        if is_relationship_property(assertion.asserted_property):
            obj_inst = django_instance_from_assertion(assertion, as_object=True)
            if not obj_inst:
                return False
            self._ensure_public_resource(obj_inst)
            obj_uri = resource_uri_for_instance(obj_inst)
            if not obj_uri:
                return False
            raw = assertion.asserted_property or ""
            suffix = raw[len("relationship.") :] if "relationship." in raw else raw
            pred_uri = relationship_predicate_uri(suffix)
            self._purge_legacy_property_edges(
                subject_uri=subj_uri,
                object_uri=obj_uri,
                suffix=suffix,
                raw=raw,
            )
            public, assertion_triples, prov_triples = build_relationship_assertion_triples(
                assertion,
                subject_uri=subj_uri,
                pred_uri=pred_uri,
                object_uri=obj_uri,
                resource_uri_fn=resource_uri_for_instance,
            )
        else:
            prop = (assertion.asserted_property or "").strip()
            if not prop or not (assertion.asserted_value or "").strip():
                return False
            pred_uri = relationship_predicate_uri(prop)
            public, assertion_triples, prov_triples = build_slot_assertion_triples(
                assertion,
                subject_uri=subj_uri,
                pred_uri=pred_uri,
                literal_value=assertion.asserted_value,
                resource_uri_fn=resource_uri_for_instance,
            )

        public_graph = GraphPartition.PUBLIC.uri()
        assertion_graph = GraphPartition.ASSERTION.uri(suffix=str(assertion.pk))
        prov_graph = GraphPartition.PROVENANCE.uri(suffix=str(assertion.pk))

        conforms, _ = self._validate_shacl(public)
        if conforms is False and getattr(settings, "RDF_SHACL_STRICT_ON_WRITE", False):
            return False

        ok_pub = True
        if public and public_graph:
            edge = public[0]
            if edge.obj_uri:
                ok_pub = self.store.upsert_object_triple(
                    subject_uri=edge.subj,
                    pred_uri=edge.pred,
                    object_uri=edge.obj_uri,
                    graph_uri=public_graph,
                )
            elif edge.literal:
                lex, dtype = edge.literal
                ok_pub = self.store.upsert_literal_triple(
                    subject_uri=edge.subj,
                    pred_uri=edge.pred,
                    lexical=lex,
                    datatype=dtype or "",
                    graph_uri=public_graph,
                )

        ok_assert = self.store.replace_named_graph_triples(
            graph_uri=assertion_graph or "",
            triples=assertion_triples,
        )
        ok_prov = self.store.replace_named_graph_triples(
            graph_uri=prov_graph or "",
            triples=prov_triples,
        )

        if getattr(settings, "RDF_SNAPSHOT_ON_PUBLISH", False) and public_graph:
            snap = GraphPartition.SNAPSHOT.uri(suffix=str(assertion.pk))
            if snap:
                self.store.replace_named_graph_triples(graph_uri=snap, triples=public)

        return bool(ok_pub and ok_assert and ok_prov)

    def materialise_event_node(self, assertion: Any) -> bool:
        """
        INSERT a CIDOC event blank-node into the project (or assertion) named graph
        when an assertion's property is an event-triggering predicate.

        Triggered by: was_produced_by, enshrined_deity, makes_deity_present, commissioned_by.

        Returns True if triples were written, False otherwise.
        """
        if not self.enabled():
            return False

        prop = (getattr(assertion, "asserted_property", "") or "").strip()
        if prop not in EVENT_TRIGGER_MAP:
            return False

        crm_class_iri, link_pred_iri, event_slug = EVENT_TRIGGER_MAP[prop]

        subj_uri = resource_uri_for_instance_from_assertion(assertion)
        if not subj_uri:
            return False

        import uuid as _uuid_mod
        from apps.graph.kg_engine.assertion_projection import resolve_assertion_named_graph
        from apps.cidoc_data.rdf_entity_projection import _Triple

        event_id = _uuid_mod.uuid4()
        event_uri = f"{HG}{event_slug}/{event_id}"

        triples: list[_Triple] = [
            _Triple(event_uri, RDF_TYPE, crm_class_iri, None),
            _Triple(event_uri, link_pred_iri, subj_uri, None),
        ]

        # Link the object entity (e.g. the deity) when present.
        obj_uri = resource_uri_for_object_assertion(assertion)
        if obj_uri:
            triples.append(_Triple(event_uri, HG + "enshrined_deity", obj_uri, None))

        # Attach TimeSpan when calendar fields are present.
        from apps.cidoc_data.timespan import (
            timespan_from_assertion,
            timespan_uri_for_assertion,
        )

        ts = timespan_from_assertion(assertion)
        if ts is not None:
            ts_uri = timespan_uri_for_assertion(assertion.pk)
            crm_p4 = CRM + "P4_has_time-span"
            triples.append(_Triple(event_uri, crm_p4, ts_uri, None))
            for s, p, o_uri, lit in ts.to_rdf_triples(timespan_uri=ts_uri):
                triples.append(_Triple(s, p, o_uri, lit))  # type: ignore[arg-type]

        target_graph = resolve_assertion_named_graph(assertion)
        if not target_graph:
            return False

        ok = self.store.replace_named_graph_triples(
            graph_uri=target_graph,
            triples=triples,
        )
        if ok:
            logger.info(
                "materialise_event_node: inserted %s node %s for assertion %s",
                event_slug,
                event_uri,
                assertion.pk,
            )
        return ok

    def unpublish_assertion(self, assertion: Any) -> bool:
        """Remove assertion triples from all graphs when not accepted."""
        if not self.enabled():
            return False
        from apps.cidoc_data.assertion_validation import is_relationship_property

        assertion_graph = GraphPartition.ASSERTION.uri(suffix=str(assertion.pk))
        prov_graph = GraphPartition.PROVENANCE.uri(suffix=str(assertion.pk))
        snap_graph = GraphPartition.SNAPSHOT.uri(suffix=str(assertion.pk))
        if assertion_graph:
            self.store.clear_named_graph(assertion_graph)
        if prov_graph:
            self.store.clear_named_graph(prov_graph)
        if snap_graph:
            self.store.clear_named_graph(snap_graph)

        if is_relationship_property(assertion.asserted_property):
            subj_uri = resource_uri_for_instance_from_assertion(assertion)
            obj_uri = resource_uri_for_object_assertion(assertion)
            if subj_uri and obj_uri:
                raw = assertion.asserted_property or ""
                suffix = raw[len("relationship.") :] if "relationship." in raw else raw
                pred_uri = relationship_predicate_uri(suffix)
                public_graph = GraphPartition.PUBLIC.uri()
                if public_graph:
                    from apps.graph.kg_engine.uris import legacy_property_predicate_uri

                    for ghost in {
                        pred_uri,
                        legacy_property_predicate_uri(suffix),
                        legacy_property_predicate_uri(raw),
                        legacy_property_predicate_uri(f"relationship.{suffix}"),
                    }:
                        sparql = (
                            f"DELETE WHERE {{ GRAPH <{public_graph}> {{ "
                            f"<{subj_uri}> <{ghost}> <{obj_uri}> . }} }}\n"
                        )
                        self.store.update(sparql)
        return True

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

    def rebuild_public_graph(self, *, include_unpublished: bool = False) -> int:
        from apps.cidoc_data.models import MetaData
        from apps.cidoc_data.publication_policy import is_published_for_rdf
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
                uri = resource_uri_for_instance(obj)
                if not include_unpublished and not is_published_for_rdf(obj):
                    self.delete_resource(uri)
                    continue
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

    def neighborhood(
        self, subject_uri: str, *, limit: int = 50, include_lux: bool = False
    ) -> list[dict[str, str]]:
        if include_lux:
            return fetch_federated_neighborhood(
                subject_uri, limit=limit, store=self.store, include_lux=True
            )
        return fetch_neighborhood(subject_uri, limit=limit, store=self.store)

    def type_histogram(self) -> list[dict[str, str]]:
        return fetch_type_counts(store=self.store)

    def graph(
        self,
        *,
        node_limit: int = 600,
        edge_limit: int = 3000,
        include_lux: bool = False,
    ) -> dict[str, list[dict[str, str]]]:
        """Whole public-graph projection (typed nodes + real edges) for the museum."""
        if include_lux:
            return fetch_museum_projection_with_lux(
                store=self.store, node_limit=node_limit, edge_limit=edge_limit
            )
        return fetch_graph_projection(
            store=self.store, node_limit=node_limit, edge_limit=edge_limit
        )

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
