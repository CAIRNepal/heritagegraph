"""
Celery task definitions for OCR and document processing.

The production pipeline is orchestrated in `apps.document_processing.services.pipeline`.
Kept task entrypoints are stable for admin actions and existing `.delay()` call sites.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import UploadedDocument
from .services.pipeline import process_uploaded_document

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE TASK
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def classify_and_route_document(self, document_id: str):
    """
    Main entry point: Classifies document type and routes to appropriate OCR engine.
    
    This task:
    1. Loads the UploadedDocument
    2. Runs classifier to determine document type
    3. Delegates to engine-specific task (tesseract, easyocr, trocr, etc.)
    4. Updates document status
    
    Args:
        document_id: UUID of UploadedDocument
    """
    try:
        logger.info("Starting document processing for %s", document_id)
        process_uploaded_document(document_id=document_id)
    except UploadedDocument.DoesNotExist:
        logger.error("UploadedDocument %s not found", document_id)
        raise
    except Exception as exc:
        logger.error("Error in classify_and_route_document: %s", exc, exc_info=True)
        raise


# ──────────────────────────────────────────────────────────────────────────────
# ENGINE-SPECIFIC TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=0)
def extract_text_pdfplumber(self, document_id: str):
    # Legacy entrypoint: route through unified pipeline
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_tesseract(self, document_id: str):
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_easyocr_fallback(self, document_id: str):
    """
    Fallback OCR engine: runs when Tesseract confidence is too low.
    EasyOCR handles mixed scripts better than Tesseract.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def extract_text_trocr(self, document_id: str):
    """
    Extract handwritten text using Microsoft TrOCR (transformer-based HTR).
    Best for handwritten notes, donor records, field documentation.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def vision_rescue_task(self, document_id: str, page_number: int = None):
    """
    Claude Vision rescue: Send difficult inscriptions/low-confidence pages to Claude.
    Per-document cap: max 1 Vision call per document (cost control).
    
    Args:
        document_id: UUID of UploadedDocument
        page_number: Specific page to rescue (None = full document rescue)
    """
    process_uploaded_document(document_id=document_id)


# ──────────────────────────────────────────────────────────────────────────────
# POST-PROCESSING TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=0)
def extract_structured_fields(self, document_id: str):
    """
    NER extraction: Parse raw OCR text and extract named entities.
    Uses Instructor + Claude to structure entities into form-ready fields.
    
    Args:
        document_id: UUID of UploadedDocument
    """
    # NER is executed inside the unified pipeline today.
    process_uploaded_document(document_id=document_id)


@shared_task(bind=True, max_retries=0)
def map_fields_to_form(self, document_id: str, submission_type: str = 'cultural_entity'):
    """
    Map NER-extracted fields to contribution form structure.
    Enables form pre-population with confidence badges.
    
    Args:
        document_id: UUID of UploadedDocument
        submission_type: 'submission' (legacy) or 'cultural_entity' (new)
    """
    process_uploaded_document(document_id=document_id)


# ──────────────────────────────────────────────────────────────────────────────
# KG INGESTION PIPELINE TASK
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=0)
def run_kg_pipeline(self, document_id: str):
    """
    Run the 5-agent KG ingestion pipeline on an OCR-completed document.

    Writes incremental progress to UploadedDocument.metadata so the frontend
    can poll for per-agent status and final assertion results.
    """
    try:
        doc = UploadedDocument.objects.get(pk=document_id)
    except UploadedDocument.DoesNotExist:
        logger.error("UploadedDocument %s not found for KG pipeline", document_id)
        return

    def _save_meta(update: dict):
        meta = doc.metadata or {}
        meta.update(update)
        doc.metadata = meta
        doc.save(update_fields=["metadata", "updated_at"])

    def _set_agent(agent: str, status: str):
        meta = doc.metadata or {}
        meta.setdefault("agent_status", {})[agent] = status
        doc.metadata = meta
        doc.save(update_fields=["metadata", "updated_at"])

    _save_meta({
        "pipeline_status": "running",
        "pipeline_started_at": timezone.now().isoformat(),
        "pipeline_error": None,
        "agent_status": {
            "doc_intelligence": "pending",
            "extraction": "pending",
            "shacl_validation": "pending",
            "entity_resolution": "pending",
            "epistemic_routing": "pending",
        },
        "agent_results": {},
        "assertions": [],
    })

    try:
        from .services.agents import (
            run_doc_intelligence,
            run_entity_resolution,
            run_epistemic_routing,
            run_extraction,
            run_shacl_validation,
        )
        from .services.agents.provenance import mint_pipeline_run_id

        text = doc.raw_text
        if not text:
            raise ValueError("Document has no extracted text — run OCR first.")

        meta = doc.metadata
        meta["pipeline_run_id"] = mint_pipeline_run_id()

        # ── Agent 1 — Document Intelligence ────────────────────────────────────
        _set_agent("doc_intelligence", "running")
        di_result = run_doc_intelligence(
            text=text,
            document_metadata=meta,
        )
        meta["agent_status"]["doc_intelligence"] = "complete"
        meta.setdefault("agent_results", {})["doc_intelligence"] = {
            "heritage_doc_type": di_result.heritage_doc_type.value,
            "heritage_doc_type_confidence": di_result.heritage_doc_type_confidence,
            "detected_language": di_result.detected_language,
            "chunk_count": len(di_result.chunks),
            "ontology_class_keys": list(di_result.ontology_snippet.keys()),
            "ocr_quality_estimate": di_result.ocr_quality_estimate,
        }
        doc.save(update_fields=["metadata", "updated_at"])

        # ── Agent 2 — Extraction ────────────────────────────────────────────────
        _set_agent("extraction", "running")
        ex_result = run_extraction(di_result)
        meta["agent_status"]["extraction"] = "complete"
        meta["agent_results"]["extraction"] = {
            "candidate_count": len(ex_result.candidates),
            "rejected_count": ex_result.rejected_count,
        }
        doc.save(update_fields=["metadata", "updated_at"])

        # ── Agent 3 — SHACL Validation ──────────────────────────────────────────
        _set_agent("shacl_validation", "running")
        shacl_result = run_shacl_validation(ex_result.candidates)
        meta["agent_status"]["shacl_validation"] = "complete"
        meta["agent_results"]["shacl_validation"] = {
            "validated_count": len(shacl_result.validated),
            "rejected_count": len(shacl_result.rejected),
            "rejection_reasons": [
                {
                    "subject": r.candidate.triple.subject,
                    "predicate": r.candidate.triple.predicate,
                    "reason": r.reason,
                    "violation_type": r.violation_type,
                }
                for r in shacl_result.rejected[:20]
            ],
        }
        doc.save(update_fields=["metadata", "updated_at"])

        # ── Agent 4 — Entity Resolution ─────────────────────────────────────────
        _set_agent("entity_resolution", "running")
        er_result = run_entity_resolution(shacl_result)
        meta["agent_status"]["entity_resolution"] = "complete"
        meta["agent_results"]["entity_resolution"] = {
            "resolved_count": len(er_result.resolved),
            "skipped_count": er_result.skipped_count,
        }
        doc.save(update_fields=["metadata", "updated_at"])

        # ── Agent 5 — Epistemic Router ──────────────────────────────────────────
        _set_agent("epistemic_routing", "running")
        routing_result = run_epistemic_routing(
            er_result,
            document_id=str(doc.id),
            agent_label="pipeline/5.1/ollama",
        )
        meta["agent_status"]["epistemic_routing"] = "complete"
        meta["agent_results"]["epistemic_routing"] = {
            "counts": routing_result.counts,
        }
        meta["assertions"] = [
            {
                "subject": ra.resolved.validated.candidate.triple.subject,
                "subject_type": ra.resolved.validated.candidate.triple.subject_type,
                "predicate": ra.resolved.validated.candidate.triple.predicate,
                "object": ra.resolved.validated.candidate.triple.object,
                "object_type": ra.resolved.validated.candidate.triple.object_type,
                "subject_uri": ra.resolved.subject_uri,
                "object_uri": ra.resolved.object_uri,
                "confidence_score": float(ra.resolved.validated.candidate.confidence_score),
                "confidence_breakdown": ra.resolved.validated.candidate.confidence_breakdown,
                "route": ra.route.value,
                "kumari_flagged": ra.kumari_flagged,
                "conflict_detected": ra.conflict_detected,
                "db_assertion_id": str(ra.db_assertion_id) if ra.db_assertion_id else None,
                "provenance_graph_uri": ra.provenance_graph_uri,
            }
            for ra in routing_result.routed
        ]
        meta["pipeline_status"] = "complete"
        meta["pipeline_finished_at"] = timezone.now().isoformat()
        doc.save(update_fields=["metadata", "updated_at"])
        logger.info("KG pipeline completed for %s", document_id)

    except Exception as exc:
        logger.error("KG pipeline failed for %s: %s", document_id, exc, exc_info=True)
        meta = doc.metadata or {}
        meta["pipeline_status"] = "failed"
        meta["pipeline_error"] = str(exc)
        doc.metadata = meta
        doc.save(update_fields=["metadata", "updated_at"])
        raise


# ──────────────────────────────────────────────────────────────────────────────
# UTILITY TASKS
# ──────────────────────────────────────────────────────────────────────────────

@shared_task
def cleanup_failed_documents(days_old: int = 30):
    """
    Periodic cleanup: Delete old failed document processing records.
    Can be scheduled with Celery Beat.
    
    Args:
        days_old: Delete records older than this many days
    """
    cutoff = timezone.now() - timedelta(days=days_old)
    deleted_count, _ = UploadedDocument.objects.filter(
        status='failed',
        created_at__lt=cutoff
    ).delete()
    
    logger.info(f"Deleted {deleted_count} old failed documents")
    return deleted_count
