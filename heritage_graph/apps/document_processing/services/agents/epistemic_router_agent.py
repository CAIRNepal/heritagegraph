"""
Agent 5 — Epistemic Routing Agent

Kumari-flag routing, conflict detection, provenance-weighted confidence thresholds,
HeritageAssertion DB writes, and PROV-O named-graph Oxigraph inserts.
"""

from __future__ import annotations

import logging
import os
from collections import Counter

from .config import DEFAULT_CONFIG, PipelineConfig
from .ontology import RDF, RDFS, class_uri, is_literal_type, predicate_uri
from .provenance import build_prov_ntriples, document_graph_uri
from .sparql import SparqlClient, nt_iri, nt_literal
from .types import (
    EntityResolutionResult,
    EpistemicRoutingResult,
    ResolvedAssertion,
    RoutedAssertion,
    RouteDecision,
)

logger = logging.getLogger(__name__)


def _confidence_label(score: float, cfg: PipelineConfig) -> str:
    if score >= cfg.threshold_auto_accept:
        return "certain"
    if score >= cfg.threshold_community_review:
        return "likely"
    if score >= cfg.threshold_expert_review:
        return "uncertain"
    return "speculative"


def _detect_conflict(
    subject_uri: str,
    pred_uri: str,
    object_uri: str | None,
    object_literal: str | None,
    client: SparqlClient,
) -> tuple[bool, str]:
    existing = client.existing_objects(subject_uri, pred_uri)
    if not existing:
        return False, ""

    incoming = object_uri or object_literal or ""
    if all(v == incoming for v in existing):
        return False, ""

    sample = next(iter(existing - {incoming}), "")
    return True, (
        f"Existing <{subject_uri}> <{pred_uri}> '{sample}'; incoming '{incoming}'."
    )


def _build_assertion_ntriples(resolved: ResolvedAssertion, pred_uri: str) -> str:
    triple = resolved.validated.candidate.triple
    if resolved.object_uri:
        obj_nt = nt_iri(resolved.object_uri)
    else:
        obj_nt = nt_literal(triple.object)

    lines = [
        f"{nt_iri(resolved.subject_uri)} {nt_iri(pred_uri)} {obj_nt} .",
    ]
    if resolved.subject_is_new:
        lines.append(
            f"{nt_iri(resolved.subject_uri)} {nt_iri(RDFS + 'label')} "
            f"{nt_literal(triple.subject)} ."
        )
        subj_type = class_uri(triple.subject_type)
        lines.append(
            f"{nt_iri(resolved.subject_uri)} {nt_iri(RDF + 'type')} {nt_iri(subj_type)} ."
        )
    if resolved.object_uri and resolved.object_is_new:
        lines.append(
            f"{nt_iri(resolved.object_uri)} {nt_iri(RDFS + 'label')} "
            f"{nt_literal(triple.object)} ."
        )
        obj_type = class_uri(triple.object_type)
        lines.append(
            f"{nt_iri(resolved.object_uri)} {nt_iri(RDF + 'type')} {nt_iri(obj_type)} ."
        )
    return "\n".join(lines)


def _determine_route(
    resolved: ResolvedAssertion,
    conflict: bool,
    kumari_flagged: bool,
    cfg: PipelineConfig,
) -> tuple[RouteDecision, str]:
    score = resolved.validated.candidate.confidence_score

    if kumari_flagged:
        return (
            RouteDecision.EXPERT_CURATOR,
            f"kumari_flag (score={score:.3f}) → expert_curator.",
        )
    if conflict:
        return (
            RouteDecision.CONFLICT,
            f"Conflict with existing graph (score={score:.3f}).",
        )
    if score >= cfg.threshold_auto_accept:
        return RouteDecision.AUTO_ACCEPT, f"confidence={score:.3f} ≥ {cfg.threshold_auto_accept}"
    if score >= cfg.threshold_community_review:
        return (
            RouteDecision.COMMUNITY_REVIEW,
            f"confidence={score:.3f} in [{cfg.threshold_community_review}, {cfg.threshold_auto_accept})",
        )
    if score >= cfg.threshold_expert_review:
        return (
            RouteDecision.EXPERT_REVIEW,
            f"confidence={score:.3f} in [{cfg.threshold_expert_review}, {cfg.threshold_community_review})",
        )
    return RouteDecision.REJECT, f"confidence={score:.3f} < {cfg.threshold_expert_review}"


def _write_assertion(
    resolved: ResolvedAssertion,
    route: RouteDecision,
    conflict: bool,
    kumari_flagged: bool,
    routing_reason: str,
    document_id: str | None,
    agent_label: str,
    cfg: PipelineConfig,
) -> str | None:
    from apps.cidoc_data.models import HeritageAssertion

    triple = resolved.validated.candidate.triple
    candidate = resolved.validated.candidate

    reconciliation_status = {
        RouteDecision.AUTO_ACCEPT: "accepted",
        RouteDecision.COMMUNITY_REVIEW: "pending",
        RouteDecision.EXPERT_REVIEW: "pending",
        RouteDecision.EXPERT_CURATOR: "pending",
        RouteDecision.CONFLICT: "disputed",
    }.get(route, "pending")

    queue_tag = {
        RouteDecision.COMMUNITY_REVIEW: "queue: community_review",
        RouteDecision.EXPERT_REVIEW: "queue: domain_expert",
        RouteDecision.EXPERT_CURATOR: "queue: expert_curator",
        RouteDecision.CONFLICT: "queue: conflict_resolution",
    }.get(route, "")

    quality_parts = [routing_reason]
    if document_id:
        quality_parts.append(f"document_id: {document_id}")
    if queue_tag:
        quality_parts.append(queue_tag)
    if kumari_flagged:
        quality_parts.append("kumari_flag: true")
    if conflict:
        quality_parts.append("conflict: true")
    if candidate.confidence_breakdown:
        bd = candidate.confidence_breakdown
        quality_parts.append(
            "confidence_factors: "
            + ", ".join(f"{k}={v:.3f}" for k, v in bd.items() if k != "composite")
        )
    if resolved.resolution_notes:
        quality_parts.append("resolution: " + " | ".join(resolved.resolution_notes))
    if resolved.validated.corrected:
        quality_parts.append(f"shacl_corrected: {resolved.validated.correction_note}")

    source_citation = (
        f"chunk:{candidate.source_chunk_id}"
        + (f" page:{candidate.page_number}" if candidate.page_number is not None else "")
    )

    assertion_content = (
        f"{triple.subject} [{triple.subject_type}] "
        f"—{triple.predicate}→ {triple.object} [{triple.object_type}]"
    )

    try:
        obj = HeritageAssertion.objects.create(
            assertion_content=assertion_content,
            asserted_property=triple.predicate,
            asserted_value=triple.object,
            confidence=_confidence_label(candidate.confidence_score, cfg),
            confidence_score=round(candidate.confidence_score, 3),
            attributed_to_agent=f"pipeline/{agent_label}",
            reconciliation_status=reconciliation_status,
            source_citation=source_citation,
            data_quality_note="\n".join(quality_parts),
        )
        return str(obj.id)
    except Exception:
        logger.error(
            "Failed to write HeritageAssertion for (%s, %s, %s)",
            triple.subject,
            triple.predicate,
            triple.object,
            exc_info=True,
        )
        return None


def run_epistemic_routing(
    resolution_result: EntityResolutionResult,
    *,
    document_id: str | None = None,
    agent_label: str = "5.1",
    oxigraph_url: str | None = None,
    config: PipelineConfig | None = None,
) -> EpistemicRoutingResult:
    """Agent 5 entry point. Requires Django ORM."""
    cfg = config or DEFAULT_CONFIG
    url = oxigraph_url or cfg.oxigraph_url or os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
    client = SparqlClient(url)

    graph_uri = document_graph_uri(document_id) if document_id and cfg.provenance_named_graph else None

    routed: list[RoutedAssertion] = []
    counts: Counter[str] = Counter()

    for resolved in resolution_result.resolved:
        triple = resolved.validated.candidate.triple
        pred_uri = predicate_uri(triple.predicate)
        kumari_flagged = "kumari_flag" in resolved.validated.checks_passed

        conflict = False
        conflict_desc = ""
        try:
            obj_uri = resolved.object_uri if not is_literal_type(triple.object_type) else None
            obj_lit = triple.object if is_literal_type(triple.object_type) else None
            conflict, conflict_desc = _detect_conflict(
                resolved.subject_uri, pred_uri, obj_uri, obj_lit, client
            )
        except Exception:
            logger.debug("Conflict detection failed", exc_info=True)

        route, routing_reason = _determine_route(resolved, conflict, kumari_flagged, cfg)
        if conflict_desc:
            routing_reason = f"{routing_reason} {conflict_desc}"

        db_id: str | None = None
        oxigraph_written = False

        if route != RouteDecision.REJECT:
            db_id = _write_assertion(
                resolved,
                route,
                conflict,
                kumari_flagged,
                routing_reason,
                document_id,
                agent_label,
                cfg,
            )

        if route == RouteDecision.AUTO_ACCEPT:
            try:
                nt = _build_assertion_ntriples(resolved, pred_uri)
                if cfg.write_prov_triples and document_id and db_id:
                    if resolved.object_uri:
                        obj_nt = nt_iri(resolved.object_uri)
                    else:
                        obj_nt = nt_literal(triple.object)
                    nt = build_prov_ntriples(
                        document_id=document_id,
                        assertion_id=db_id,
                        subject_uri=resolved.subject_uri,
                        pred_uri=pred_uri,
                        object_nt=obj_nt,
                        agent_label=agent_label,
                        confidence_composite=resolved.validated.candidate.confidence_score,
                    )
                oxigraph_written = client.insert_data(nt, graph_uri=graph_uri)
                if oxigraph_written and cfg.promote_to_public_graph:
                    try:
                        from apps.graph.kg_engine.promotion import (
                            promote_ntriples_to_public,
                        )

                        promote_ntriples_to_public(nt)
                    except Exception:
                        logger.warning(
                            "Public graph promotion failed", exc_info=True
                        )
            except Exception:
                logger.warning("Oxigraph INSERT failed", exc_info=True)

        if route == RouteDecision.REJECT:
            logger.info(
                "REJECTED: (%s, %s, %s) score=%.3f",
                triple.subject,
                triple.predicate,
                triple.object,
                resolved.validated.candidate.confidence_score,
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
                provenance_graph_uri=graph_uri,
            )
        )

    logger.info(
        "Epistemic routing: %s",
        " | ".join(f"{k}={v}" for k, v in sorted(counts.items())),
    )
    return EpistemicRoutingResult(routed=routed, counts=dict(counts))
