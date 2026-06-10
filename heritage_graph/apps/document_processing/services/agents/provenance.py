"""
PROV-O provenance modeling for heritage KG ingestion assertions.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from .ontology import HG, PROV, RDF, RDFS
from .sparql import nt_iri, nt_literal


def document_graph_uri(document_id: str) -> str:
    """Named graph URI for all triples derived from one uploaded document."""
    return f"{HG}graph/document/{document_id}"


def assertion_activity_uri(assertion_id: str) -> str:
    return f"{HG}activity/extraction/{assertion_id}"


def build_prov_ntriples(
    *,
    document_id: str,
    assertion_id: str,
    subject_uri: str,
    pred_uri: str,
    object_nt: str,
    agent_label: str,
    confidence_composite: float,
) -> str:
    """
    Build PROV-O activity + attribution triples for an accepted assertion.
    Links extraction activity to the document and the generated triple.
    """
    activity = assertion_activity_uri(assertion_id)
    doc_uri = f"{HG}document/{document_id}"
    now = datetime.now(UTC).isoformat()
    lines = [
        f"{nt_iri(activity)} {nt_iri(RDF + 'type')} {nt_iri(PROV + 'Activity')} .",
        f"{nt_iri(activity)} {nt_iri(PROV + 'wasAssociatedWith')} "
        f"{nt_literal(agent_label)} .",
        f"{nt_iri(activity)} {nt_iri(PROV + 'startedAtTime')} {nt_literal(now)} .",
        f"{nt_iri(activity)} {nt_iri(PROV + 'used')} {nt_iri(doc_uri)} .",
        f"{nt_iri(subject_uri)} {nt_iri(pred_uri)} {object_nt} .",
        f"{nt_iri(activity)} {nt_iri(PROV + 'generated')} "
        f"{nt_iri(subject_uri)} .",
        f"{nt_iri(activity)} {nt_iri(RDFS + 'comment')} "
        f'{nt_literal(f"confidence={confidence_composite:.3f}")} .',
    ]
    return "\n".join(lines)


def mint_pipeline_run_id() -> str:
    return str(uuid.uuid4())
