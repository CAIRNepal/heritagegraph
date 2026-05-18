"""
Unified orchestrator for the 5-agent heritage KG ingestion pipeline.

Provides failure isolation per stage, structured telemetry, and idempotent
re-runs when document text is unchanged.
"""

from __future__ import annotations

import logging
from typing import Any

from .config import DEFAULT_CONFIG, PipelineConfig
from .doc_intelligence import run_doc_intelligence
from .entity_resolution_agent import run_entity_resolution
from .epistemic_router_agent import run_epistemic_routing
from .extraction_agent import run_extraction
from .provenance import mint_pipeline_run_id
from .shacl_agent import run_shacl_validation
from .telemetry import PipelineMetrics, stage_timer
from .types import PipelineResult

logger = logging.getLogger(__name__)


def run_kg_ingestion_pipeline(
    *,
    text: str,
    document_id: str | None = None,
    config: PipelineConfig | None = None,
    document_metadata: dict[str, Any] | None = None,
    skip_epistemic_db: bool = False,
) -> PipelineResult:
    """
    Execute the full 5-agent pipeline with per-stage failure isolation.

    Args:
        text: OCR-extracted document text.
        document_id: UploadedDocument UUID for provenance named graphs.
        config: Pipeline configuration (defaults to env-based DEFAULT_CONFIG).
        document_metadata: Optional UploadedDocument.metadata for OCR quality hints.
        skip_epistemic_db: If True, run agents 1–4 only (no Django ORM writes).

    Returns:
        PipelineResult with partial outputs if a stage fails.
    """
    cfg = config or DEFAULT_CONFIG
    meta = document_metadata or {}
    run_id = mint_pipeline_run_id()
    metrics = PipelineMetrics(pipeline_run_id=run_id, document_id=document_id)
    result = PipelineResult(pipeline_run_id=run_id)

    ocr_quality = float(meta.get("ocr_confidence") or meta.get("mean_ocr_confidence") or 1.0)
    ocr_quality = max(0.0, min(1.0, ocr_quality))

    # ── Agent 1 ───────────────────────────────────────────────────────────────
    with stage_timer(metrics, "doc_intelligence") as stage:
        try:
            di_result = run_doc_intelligence(
                text=text,
                use_ollama=cfg.use_ollama_classification,
                chunk_max_tokens=cfg.chunk_max_tokens,
                chunk_overlap=cfg.chunk_overlap_tokens,
                ocr_quality_estimate=ocr_quality,
                document_metadata=meta,
            )
            result.doc_intelligence = di_result
            stage.output_count = len(di_result.chunks)
            stage.metadata = {
                "heritage_doc_type": di_result.heritage_doc_type.value,
                "language": di_result.detected_language,
            }
        except Exception as exc:
            stage.error_count = 1
            result.errors.append(f"doc_intelligence: {exc}")
            logger.exception("Agent 1 failed")
            result.metrics = metrics.to_dict()
            return result

    # ── Agent 2 ───────────────────────────────────────────────────────────────
    with stage_timer(metrics, "extraction", input_count=len(result.doc_intelligence.chunks)) as stage:
        try:
            ex_result = run_extraction(
                result.doc_intelligence,
                min_confidence=cfg.min_extraction_confidence,
                config=cfg,
            )
            result.extraction = ex_result
            stage.output_count = len(ex_result.candidates)
            stage.metadata = {"rejected_count": ex_result.rejected_count}
        except Exception as exc:
            stage.error_count = 1
            result.errors.append(f"extraction: {exc}")
            logger.exception("Agent 2 failed")
            result.metrics = metrics.to_dict()
            return result

    # ── Agent 3 ───────────────────────────────────────────────────────────────
    with stage_timer(
        metrics, "shacl_validation", input_count=len(result.extraction.candidates)
    ) as stage:
        try:
            shacl_result = run_shacl_validation(
                result.extraction.candidates,
                config=cfg,
            )
            result.shacl = shacl_result
            stage.output_count = len(shacl_result.validated)
            stage.metadata = {"rejected_count": len(shacl_result.rejected)}
        except Exception as exc:
            stage.error_count = 1
            result.errors.append(f"shacl_validation: {exc}")
            logger.exception("Agent 3 failed")
            result.metrics = metrics.to_dict()
            return result

    # ── Agent 4 ───────────────────────────────────────────────────────────────
    with stage_timer(
        metrics, "entity_resolution", input_count=len(result.shacl.validated)
    ) as stage:
        try:
            er_result = run_entity_resolution(
                result.shacl,
                oxigraph_url=cfg.oxigraph_url,
                config=cfg,
            )
            result.entity_resolution = er_result
            stage.output_count = len(er_result.resolved)
            stage.metadata = {"skipped_count": er_result.skipped_count}
        except Exception as exc:
            stage.error_count = 1
            result.errors.append(f"entity_resolution: {exc}")
            logger.exception("Agent 4 failed")
            result.metrics = metrics.to_dict()
            return result

    # ── Agent 5 ───────────────────────────────────────────────────────────────
    if skip_epistemic_db:
        result.metrics = metrics.to_dict()
        return result

    with stage_timer(
        metrics, "epistemic_routing", input_count=len(result.entity_resolution.resolved)
    ) as stage:
        try:
            routing_result = run_epistemic_routing(
                result.entity_resolution,
                document_id=document_id,
                agent_label=f"pipeline/5.1/{cfg.ollama_model}",
                oxigraph_url=cfg.oxigraph_url,
                config=cfg,
            )
            result.epistemic_routing = routing_result
            stage.output_count = len(routing_result.routed)
            stage.metadata = {"counts": routing_result.counts}
        except Exception as exc:
            stage.error_count = 1
            result.errors.append(f"epistemic_routing: {exc}")
            logger.exception("Agent 5 failed")

    result.metrics = metrics.to_dict()
    return result
