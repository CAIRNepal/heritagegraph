"""
Project accepted HeritageAssertion rows into named assertion graphs + PROV metadata.

Self-contained nanopublication pattern (CRMinf + PROV-O + nanopub schema):
  - GRAPH …/graph/assertion/{uuid}  — the asserted triple(s) only
  - GRAPH …/graph/prov/{uuid}       — the nanopub head linking the graphs, the
                                      crminf:I2_Belief, a reified rdf:Statement
                                      (so the full s/p/o is recoverable from the
                                      belief alone), and PROV-O attribution to
                                      IRI agents/sources. Survives export/import.
  - PUBLIC graph                    — same edge for SPARQL museum queries

Replaces the prior design, which used ``prov:specializationOf`` (semantically a
belief is NOT a specialization of the subject entity) and linked the belief to
its assertion graph only by a coincidental shared UUID — neither survived export.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from apps.cidoc_data.rdf_entity_projection import _Triple
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.ontology_config import RDF_PREFIXES
from django.conf import settings

logger = logging.getLogger(__name__)

CRM_INF_I2 = "http://www.cidoc-crm.org/crminf/I2_Belief"
CRMINF_J4_THAT = "http://www.cidoc-crm.org/crminf/J4_that"
PROV_ENTITY = RDF_PREFIXES["prov"] + "Entity"
PROV_AGENT = RDF_PREFIXES["prov"] + "Agent"
PROV_WAS_DERIVED_FROM = RDF_PREFIXES["prov"] + "wasDerivedFrom"
PROV_WAS_ATTRIBUTED_TO = RDF_PREFIXES["prov"] + "wasAttributedTo"
PROV_GENERATED_AT_TIME = RDF_PREFIXES["prov"] + "generatedAtTime"
RDF_TYPE = RDF_PREFIXES["rdf"] + "type"
RDF_STATEMENT = RDF_PREFIXES["rdf"] + "Statement"
RDF_SUBJECT = RDF_PREFIXES["rdf"] + "subject"
RDF_PREDICATE = RDF_PREFIXES["rdf"] + "predicate"
RDF_OBJECT = RDF_PREFIXES["rdf"] + "object"
RDFS_LABEL = RDF_PREFIXES["rdfs"] + "label"
NP = "http://www.nanopub.org/nschema#"
NP_NANOPUBLICATION = NP + "Nanopublication"
NP_HAS_ASSERTION = NP + "hasAssertion"
NP_HAS_PROVENANCE = NP + "hasProvenance"
NP_HAS_PUBLICATION_INFO = NP + "hasPublicationInfo"
XSD_DECIMAL = RDF_PREFIXES["xsd"] + "decimal"
XSD_STRING = RDF_PREFIXES["xsd"] + "string"
XSD_DATE_TIME = RDF_PREFIXES["xsd"] + "dateTime"
HG = RDF_PREFIXES["heritageGraph"]
HG_CONFIDENCE = HG + "confidence_score"
HG_CONFIDENCE_LABEL = HG + "confidence"
HG_RECONCILIATION = HG + "reconciliation_status"
HG_JUSTIFICATION = HG + "justification_note"
HG_ASSERTED_PROPERTY = HG + "asserted_property"
HG_TEMPORAL_EDTF = HG + "temporal_scope_edtf"
DCT_LICENSE = "http://purl.org/dc/terms/license"
DCT_BIBLIO_CITATION = "http://purl.org/dc/terms/bibliographicCitation"
DEFAULT_RESOURCE_LICENSE = "https://creativecommons.org/licenses/by/4.0/"


def _base() -> str:
    return str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")


def agent_uri(name: str) -> str:
    """Mint a stable IRI for a named agent so prov:wasAttributedTo points to a
    prov:Agent resource (not a bare literal)."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return f"{_base()}/agent/{slug or 'unknown'}"


def _provenance_triples(
    assertion: Any,
    *,
    belief_uri: str,
    statement_triples: list[_Triple],
    statement_uri: str,
) -> list[_Triple]:
    """Self-contained PROV/CRMinf description for one belief, plus the nanopub head."""
    aid = assertion.pk
    assertion_graph = GraphPartition.ASSERTION.uri(suffix=str(aid)) or f"{_base()}/graph/assertion/{aid}"
    prov_graph = GraphPartition.PROVENANCE.uri(suffix=str(aid)) or f"{_base()}/graph/prov/{aid}"
    np_uri = f"{_base()}/np/{aid}"

    prov: list[_Triple] = [
        # Nanopublication head — links the assertion graph to its provenance so
        # the structure is recoverable on export (TriG / N-Quads), not by UUID luck.
        _Triple(np_uri, RDF_TYPE, NP_NANOPUBLICATION, None),
        _Triple(np_uri, NP_HAS_ASSERTION, assertion_graph, None),
        _Triple(np_uri, NP_HAS_PROVENANCE, prov_graph, None),
        _Triple(np_uri, NP_HAS_PUBLICATION_INFO, prov_graph, None),
        # The belief and what it is a belief *that* (CRMinf J4) — a reified statement.
        _Triple(belief_uri, RDF_TYPE, CRM_INF_I2, None),
        _Triple(belief_uri, RDF_TYPE, PROV_ENTITY, None),
        _Triple(belief_uri, CRMINF_J4_THAT, statement_uri, None),
        _Triple(belief_uri, HG_ASSERTED_PROPERTY, None, (assertion.asserted_property or "", XSD_STRING)),
        _Triple(belief_uri, DCT_LICENSE, DEFAULT_RESOURCE_LICENSE, None),
    ]
    prov.extend(statement_triples)

    if assertion.source_id:
        prov.append(_Triple(belief_uri, PROV_WAS_DERIVED_FROM, data_source_uri(assertion.source_id), None))
    elif assertion.source_citation:
        # A free-text citation is a bibliographic citation, not a prov:Entity IRI.
        prov.append(
            _Triple(belief_uri, DCT_BIBLIO_CITATION, None, (assertion.source_citation[:2000], XSD_STRING))
        )

    agent = (assertion.attributed_to_agent or assertion.contributed_by or "").strip()
    if agent:
        a_uri = agent_uri(agent)
        prov.append(_Triple(belief_uri, PROV_WAS_ATTRIBUTED_TO, a_uri, None))
        prov.append(_Triple(a_uri, RDF_TYPE, PROV_AGENT, None))
        prov.append(_Triple(a_uri, RDFS_LABEL, None, (agent, XSD_STRING)))

    if assertion.created_at:
        prov.append(
            _Triple(belief_uri, PROV_GENERATED_AT_TIME, None, (assertion.created_at.isoformat(), XSD_DATE_TIME))
        )
    if assertion.confidence:
        prov.append(_Triple(belief_uri, HG_CONFIDENCE_LABEL, None, (assertion.confidence, XSD_STRING)))
    if assertion.confidence_score is not None:
        prov.append(_Triple(belief_uri, HG_CONFIDENCE, None, (str(assertion.confidence_score), XSD_DECIMAL)))
    if assertion.reconciliation_status:
        prov.append(_Triple(belief_uri, HG_RECONCILIATION, None, (assertion.reconciliation_status, XSD_STRING)))
    if getattr(assertion, "justification_note", None):
        prov.append(_Triple(belief_uri, HG_JUSTIFICATION, None, (assertion.justification_note, XSD_STRING)))
    if getattr(assertion, "temporal_scope_edtf", None):
        prov.append(_Triple(belief_uri, HG_TEMPORAL_EDTF, None, (assertion.temporal_scope_edtf, XSD_STRING)))

    return prov


def assertion_uri(assertion_id: Any) -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    return f"{base}/assertion/{assertion_id}"


def resolve_assertion_named_graph(assertion: Any) -> str:
    """Return the named graph IRI where assertion triples should be written.

    Priority order:
    1. assertion.named_graph (explicit override)
    2. assertion.project FK → project named graph (hg:project/{uuid}/graph)
    3. default: GraphPartition.ASSERTION per-assertion graph
    """
    explicit = getattr(assertion, "named_graph", "")
    if explicit:
        return explicit

    project = getattr(assertion, "project", None)
    if project is not None:
        project_id = getattr(project, "pk", None) or getattr(project, "id", None)
        if project_id:
            return GraphPartition.PROJECT.uri(suffix=str(project_id)) or ""

    aid = assertion.pk
    return GraphPartition.ASSERTION.uri(suffix=str(aid)) or f"{_base()}/graph/assertion/{aid}"


def data_source_uri(source_id: Any) -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    return f"{base}/data_source/{source_id}"


def _uri_for_generic(content_type, object_id, *, resource_uri_fn) -> str | None:
    if content_type is None or object_id is None:
        return None
    model = content_type.model_class()
    if model is None:
        return None
    try:
        obj = model.objects.get(pk=object_id)
    except model.DoesNotExist:
        return None
    return resource_uri_fn(obj)


def build_relationship_assertion_triples(
    assertion: Any,
    *,
    subject_uri: str,
    pred_uri: str,
    object_uri: str,
    resource_uri_fn,
) -> tuple[list[Any], list[Any], list[Any]]:
    """
    Return (public_triples, assertion_graph_triples, prov_graph_triples).

    The asserted edge is reified in the prov graph (rdf:Statement) and linked
    from the belief via crminf:J4_that, so the full subject/predicate/object is
    recoverable from the belief alone — including for relationship assertions
    whose object was previously dropped from provenance.
    """
    belief_uri = assertion_uri(assertion.pk)
    statement_uri = f"{belief_uri}#statement"
    public = [_Triple(subject_uri, pred_uri, object_uri, None)]
    assertion_graph = list(public)

    statement_triples = [
        _Triple(statement_uri, RDF_TYPE, RDF_STATEMENT, None),
        _Triple(statement_uri, RDF_SUBJECT, subject_uri, None),
        _Triple(statement_uri, RDF_PREDICATE, pred_uri, None),
        _Triple(statement_uri, RDF_OBJECT, object_uri, None),
    ]
    prov = _provenance_triples(
        assertion,
        belief_uri=belief_uri,
        statement_triples=statement_triples,
        statement_uri=statement_uri,
    )
    return public, assertion_graph, prov


def build_slot_assertion_triples(
    assertion: Any,
    *,
    subject_uri: str,
    pred_uri: str,
    literal_value: str,
    resource_uri_fn,
) -> tuple[list[Any], list[Any], list[Any]]:
    """Literal slot claims (non-relationship asserted_property)."""
    belief_uri = assertion_uri(assertion.pk)
    statement_uri = f"{belief_uri}#statement"
    public = [_Triple(subject_uri, pred_uri, None, (literal_value, XSD_STRING))]
    assertion_graph = list(public)

    statement_triples = [
        _Triple(statement_uri, RDF_TYPE, RDF_STATEMENT, None),
        _Triple(statement_uri, RDF_SUBJECT, subject_uri, None),
        _Triple(statement_uri, RDF_PREDICATE, pred_uri, None),
        _Triple(statement_uri, RDF_OBJECT, None, (literal_value, XSD_STRING)),
    ]
    prov = _provenance_triples(
        assertion,
        belief_uri=belief_uri,
        statement_triples=statement_triples,
        statement_uri=statement_uri,
    )
    return public, assertion_graph, prov
