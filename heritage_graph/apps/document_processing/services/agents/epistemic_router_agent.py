"""
Agent 5 — Epistemic Routing Agent

Final stage of the KG ingestion pipeline. For each ResolvedAssertion from Agent 4:

  1. Kumari-flag check   — any assertion touching LivingGoddess/KumariTenure classes is
                           unconditionally routed to the expert_curator queue.
  2. Conflict detection  — queries Oxigraph: does <subject_uri> already have a triple for
                           <predicate_uri> with a DIFFERENT value? If yes → CONFLICT.
  3. Confidence routing  — thresholds applied to the numeric confidence_score from Agent 2:
                             ≥ 0.90  → AUTO_ACCEPT  (writes to DB + Oxigraph INSERT)
                             0.70–0.89 → COMMUNITY_REVIEW  (pending, community queue)
                             0.50–0.69 → EXPERT_REVIEW  (pending, domain expert queue)
                             < 0.50   → REJECT  (logged only — no DB write)
  4. DB write            — creates a HeritageAssertion record for every non-rejected route.
  5. Oxigraph INSERT     — for AUTO_ACCEPT, writes the canonical RDF triple plus rdfs:label
                           stubs for any newly minted entities.

This agent requires Django to be configured (it writes to the ORM). Import it from within
Django application code (views, management commands, Celery tasks), not at module start-up.
"""

from __future__ import annotations

import logging
import os
import re
from collections import Counter

from .types import (
    EntityResolutionResult,
    EpistemicRoutingResult,
    ResolvedAssertion,
    RouteDecision,
    RoutedAssertion,
)

logger = logging.getLogger(__name__)

# ── Namespace constants ────────────────────────────────────────────────────────

_HG   = "https://w3id.org/heritagegraph/"
_CRM  = "http://www.cidoc-crm.org/cidoc-crm/"
_RDFS = "http://www.w3.org/2000/01/rdf-schema#"
_RDF  = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"

# ── Confidence thresholds ──────────────────────────────────────────────────────

_THRESHOLD_AUTO_ACCEPT      = 0.90
_THRESHOLD_COMMUNITY_REVIEW = 0.70
_THRESHOLD_EXPERT_REVIEW    = 0.50

# ── Predicate URI resolution (mirrors shacl_agent._predicate_uri) ─────────────

_CRM_PRED_RE = re.compile(r"^P\d+[a-z]?_")
_PROV = "http://www.w3.org/ns/prov#"
_SCHEMA = "https://schema.org/"
_GEO   = "http://www.opengis.net/ont/geosparql#"

_KNOWN_PRED_SHORTCUTS: dict[str, str] = {
    "label":              _RDFS + "label",
    "rdfs:label":         _RDFS + "label",
    "schema:description": _SCHEMA + "description",
    "asWKT":              _GEO + "asWKT",
}


def _predicate_uri(pred: str) -> str:
    pred = pred.strip()
    if pred.startswith("http"):
        return pred
    if _CRM_PRED_RE.match(pred):
        return _CRM + pred
    if pred.startswith("prov:"):
        return _PROV + pred[5:]
    if pred.startswith("hg:"):
        return _HG + pred[3:]
    return _KNOWN_PRED_SHORTCUTS.get(pred, _HG + pred)


# ── Literal type detection ─────────────────────────────────────────────────────

_LITERAL_TYPES = frozenset({
    "literal", "xsd:string", "string", "text", "date",
    "number", "integer", "float", "decimal", "boolean",
    "xsd:date", "xsd:integer", "xsd:decimal",
})


def _is_literal(object_type: str) -> bool:
    return object_type.lower() in _LITERAL_TYPES


# ── Confidence score → categorical label ──────────────────────────────────────

def _confidence_label(score: float) -> str:
    if score >= _THRESHOLD_AUTO_ACCEPT:
        return "certain"
    if score >= _THRESHOLD_COMMUNITY_REVIEW:
        return "likely"
    if score >= _THRESHOLD_EXPERT_REVIEW:
        return "uncertain"
    return "speculative"


# ── Inline SPARQL client (no Django dependency at import time) ─────────────────

class _SparqlClient:
    def __init__(self, base_url: str) -> None:
        self._sparql_url = base_url.rstrip("/") + "/sparql"

    def select(self, sparql: str) -> list[dict[str, str]]:
        import requests
        try:
            resp = requests.get(
                self._sparql_url,
                params={"query": sparql},
                headers={"Accept": "application/sparql-results+json"},
                timeout=10,
            )
            resp.raise_for_status()
            bindings = resp.json().get("results", {}).get("bindings", [])
            return [{k: v.get("value", "") for k, v in row.items()} for row in bindings]
        except Exception:
            logger.debug("SPARQL SELECT failed", exc_info=True)
            return []

    def update(self, sparql: str) -> bool:
        import requests
        try:
            resp = requests.post(
                self._sparql_url,
                data={"update": sparql},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )
            resp.raise_for_status()
            return True
        except Exception:
            logger.warning("SPARQL UPDATE failed", exc_info=True)
            return False


def _get_sparql_client() -> _SparqlClient:
    url = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
    return _SparqlClient(url)


# ── Conflict detection ─────────────────────────────────────────────────────────

def _detect_conflict(
    subject_uri: str,
    pred_uri: str,
    object_uri: str | None,
    object_literal: str | None,
    client: _SparqlClient,
) -> tuple[bool, str]:
    """
    Query Oxigraph for existing triples with the same subject+predicate.
    Returns (conflict, description).
    A conflict is when an existing value differs from the one we are about to assert.
    """
    sparql = (
        f"SELECT ?obj WHERE {{\n"
        f"  <{subject_uri}> <{pred_uri}> ?obj .\n"
        f"}} LIMIT 10"
    )
    rows = client.select(sparql)
    if not rows:
        return False, ""

    existing_values = {r.get("obj", "") for r in rows}

    if object_uri:
        incoming = object_uri
    else:
        incoming = object_literal or ""

    # If every existing value matches incoming — no conflict (idempotent assertion)
    if all(v == incoming for v in existing_values):
        return False, ""

    # At least one existing value differs
    sample = next(iter(existing_values - {incoming}), "")
    return True, (
        f"Existing graph has <{subject_uri}> <{pred_uri}> '{sample}'; "
        f"incoming value is '{incoming}'."
    )


# ── RDF N-Triples helpers ──────────────────────────────────────────────────────

def _nt_iri(uri: str) -> str:
    return f"<{uri}>"


def _nt_literal(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def _build_insert_triples(resolved: ResolvedAssertion, pred_uri: str) -> str:
    """Build N-Triples for SPARQL INSERT DATA for an accepted assertion."""
    triple = resolved.validated.candidate.triple
    lines: list[str] = []

    # Core assertion triple
    if resolved.object_uri:
        obj_nt = _nt_iri(resolved.object_uri)
    else:
        obj_nt = _nt_literal(triple.object)

    lines.append(f"{_nt_iri(resolved.subject_uri)} {_nt_iri(pred_uri)} {obj_nt} .")

    # Label stubs for new entities (avoids blank nodes in graph)
    if resolved.subject_is_new:
        lines.append(
            f"{_nt_iri(resolved.subject_uri)} {_nt_iri(_RDFS + 'label')} "
            f"{_nt_literal(triple.subject)} ."
        )
        lines.append(
            f"{_nt_iri(resolved.subject_uri)} {_nt_iri(_RDF + 'type')} "
            f"{_nt_iri(_CRM + triple.subject_type if not triple.subject_type.startswith('http') else triple.subject_type)} ."
        )

    if resolved.object_uri and resolved.object_is_new:
        lines.append(
            f"{_nt_iri(resolved.object_uri)} {_nt_iri(_RDFS + 'label')} "
            f"{_nt_literal(triple.object)} ."
        )
        lines.append(
            f"{_nt_iri(resolved.object_uri)} {_nt_iri(_RDF + 'type')} "
            f"{_nt_iri(_CRM + triple.object_type if not triple.object_type.startswith('http') else triple.object_type)} ."
        )

    return "\n".join(lines)


def _oxigraph_insert(resolved: ResolvedAssertion, pred_uri: str, client: _SparqlClient) -> bool:
    nt = _build_insert_triples(resolved, pred_uri)
    sparql = f"INSERT DATA {{\n{nt}\n}}"
    return client.update(sparql)


# ── Route determination ────────────────────────────────────────────────────────

def _determine_route(
    resolved: ResolvedAssertion,
    conflict: bool,
    kumari_flagged: bool,
) -> tuple[RouteDecision, str]:
    """Return (route, routing_reason)."""
    score = resolved.validated.candidate.confidence_score

    # Kumari / high-stakes — always expert curator regardless of score
    if kumari_flagged:
        return (
            RouteDecision.EXPERT_CURATOR,
            f"kumari_flag set (score={score:.3f}); routed to expert_curator queue.",
        )

    # Conflict — existing graph contradicts this assertion
    if conflict:
        return (
            RouteDecision.CONFLICT,
            f"Conflict detected with existing Oxigraph triple (score={score:.3f}).",
        )

    # Confidence thresholds
    if score >= _THRESHOLD_AUTO_ACCEPT:
        return (
            RouteDecision.AUTO_ACCEPT,
            f"confidence={score:.3f} ≥ {_THRESHOLD_AUTO_ACCEPT}; auto-accepted.",
        )
    if score >= _THRESHOLD_COMMUNITY_REVIEW:
        return (
            RouteDecision.COMMUNITY_REVIEW,
            f"confidence={score:.3f} in [0.70, 0.90); routed to community review queue.",
        )
    if score >= _THRESHOLD_EXPERT_REVIEW:
        return (
            RouteDecision.EXPERT_REVIEW,
            f"confidence={score:.3f} in [0.50, 0.70); routed to domain expert queue.",
        )

    return (
        RouteDecision.REJECT,
        f"confidence={score:.3f} < {_THRESHOLD_EXPERT_REVIEW}; rejected (logged for retraining).",
    )


# ── DB write ───────────────────────────────────────────────────────────────────

def _write_assertion(
    resolved: ResolvedAssertion,
    route: RouteDecision,
    conflict: bool,
    kumari_flagged: bool,
    routing_reason: str,
    document_id: str | None,
    agent_label: str,
) -> str | None:
    """
    Create a HeritageAssertion record. Returns the UUID string, or None on failure.
    Requires Django ORM to be available.
    """
    from apps.cidoc_data.models import HeritageAssertion

    triple = resolved.validated.candidate.triple
    candidate = resolved.validated.candidate

    reconciliation_status = {
        RouteDecision.AUTO_ACCEPT:      "accepted",
        RouteDecision.COMMUNITY_REVIEW: "pending",
        RouteDecision.EXPERT_REVIEW:    "pending",
        RouteDecision.EXPERT_CURATOR:   "pending",
        RouteDecision.CONFLICT:         "disputed",
    }.get(route, "pending")

    queue_tag = {
        RouteDecision.COMMUNITY_REVIEW: "queue: community_review",
        RouteDecision.EXPERT_REVIEW:    "queue: domain_expert",
        RouteDecision.EXPERT_CURATOR:   "queue: expert_curator",
        RouteDecision.CONFLICT:         "queue: conflict_resolution",
    }.get(route, "")

    quality_parts: list[str] = [routing_reason]
    if queue_tag:
        quality_parts.append(queue_tag)
    if kumari_flagged:
        quality_parts.append("kumari_flag: true")
    if conflict:
        quality_parts.append("conflict: true")

    # Resolution notes from Agent 4
    if resolved.resolution_notes:
        quality_parts.append("resolution: " + " | ".join(resolved.resolution_notes))

    # SHACL validation notes from Agent 3
    if resolved.validated.corrected:
        quality_parts.append(f"shacl_corrected: {resolved.validated.correction_note}")

    source_citation = (
        f"chunk:{candidate.source_chunk_id}"
        + (f" page:{candidate.page_number}" if candidate.page_number is not None else "")
    )

    assertion_content = (
        f"{triple.subject} [{triple.subject_type}] "
        f"—{triple.predicate}→ "
        f"{triple.object} [{triple.object_type}]"
    )

    try:
        obj = HeritageAssertion.objects.create(
            assertion_content=assertion_content,
            asserted_property=triple.predicate,
            asserted_value=triple.object,
            confidence=_confidence_label(candidate.confidence_score),
            confidence_score=round(candidate.confidence_score, 3),
            attributed_to_agent=f"pipeline/{agent_label}/{candidate.extraction_model}",
            reconciliation_status=reconciliation_status,
            source_citation=source_citation,
            data_quality_note="\n".join(quality_parts),
        )
        return str(obj.id)
    except Exception:
        logger.error(
            "Failed to write HeritageAssertion for triple (%s, %s, %s)",
            triple.subject, triple.predicate, triple.object,
            exc_info=True,
        )
        return None


# ── Public entry point ─────────────────────────────────────────────────────────

def run_epistemic_routing(
    resolution_result: EntityResolutionResult,
    *,
    document_id: str | None = None,
    agent_label: str = "5.0",
    oxigraph_url: str | None = None,
) -> EpistemicRoutingResult:
    """
    Agent 5 entry point. Requires Django to be configured.

    Args:
        resolution_result: Output of Agent 4 (EntityResolutionResult).
        document_id: Optional UploadedDocument UUID for traceability.
        agent_label: Version label embedded in attributed_to_agent field.
        oxigraph_url: Override Oxigraph URL (defaults to OXIGRAPH_URL env var
                      or http://localhost:7878).

    Returns:
        EpistemicRoutingResult with one RoutedAssertion per ResolvedAssertion.
    """
    client = _SparqlClient(oxigraph_url or os.environ.get("OXIGRAPH_URL", "http://localhost:7878"))

    routed: list[RoutedAssertion] = []
    counts: Counter[str] = Counter()

    for resolved in resolution_result.resolved:
        triple = resolved.validated.candidate.triple
        pred_uri = _predicate_uri(triple.predicate)

        # ── 1. Kumari flag ────────────────────────────────────────────────────
        kumari_flagged = "kumari_flag" in resolved.validated.checks_passed

        # ── 2. Conflict detection ─────────────────────────────────────────────
        conflict = False
        conflict_desc = ""
        try:
            object_uri   = resolved.object_uri if not _is_literal(triple.object_type) else None
            object_lit   = triple.object if _is_literal(triple.object_type) else None
            conflict, conflict_desc = _detect_conflict(
                resolved.subject_uri, pred_uri, object_uri, object_lit, client
            )
        except Exception:
            logger.debug("Conflict detection failed for chunk %s", resolved.validated.candidate.source_chunk_id, exc_info=True)

        # ── 3. Route decision ─────────────────────────────────────────────────
        route, routing_reason = _determine_route(resolved, conflict, kumari_flagged)
        if conflict_desc:
            routing_reason = f"{routing_reason} {conflict_desc}"

        # ── 4. DB write (skip REJECT) ─────────────────────────────────────────
        db_id: str | None = None
        oxigraph_written = False

        if route != RouteDecision.REJECT:
            db_id = _write_assertion(
                resolved=resolved,
                route=route,
                conflict=conflict,
                kumari_flagged=kumari_flagged,
                routing_reason=routing_reason,
                document_id=document_id,
                agent_label=agent_label,
            )

        # ── 5. Oxigraph INSERT (AUTO_ACCEPT only) ─────────────────────────────
        if route == RouteDecision.AUTO_ACCEPT:
            try:
                oxigraph_written = _oxigraph_insert(resolved, pred_uri, client)
                if not oxigraph_written:
                    logger.warning(
                        "Oxigraph INSERT failed for accepted assertion on %s",
                        resolved.subject_uri,
                    )
            except Exception:
                logger.warning("Oxigraph INSERT raised exception", exc_info=True)

        # Log rejects for retraining dataset
        if route == RouteDecision.REJECT:
            logger.info(
                "REJECTED: (%s, %s, %s) score=%.3f | %s",
                triple.subject,
                triple.predicate,
                triple.object,
                resolved.validated.candidate.confidence_score,
                routing_reason,
            )

        counts[route.value] += 1
        routed.append(
            RoutedAssertion(
                resolved=resolved,
                route=route,
                db_assertion_id=db_id,
                conflict_detected=conflict,
                kumari_flagged=kumari_flagged,
                routing_reason=routing_reason,
                oxigraph_written=oxigraph_written,
            )
        )

    logger.info(
        "Epistemic routing complete: %s",
        " | ".join(f"{k}={v}" for k, v in sorted(counts.items())),
    )
    return EpistemicRoutingResult(routed=routed, counts=dict(counts))
