"""
Celery tasks for DataSource ingest pipeline.

Each task is a skeleton that routes to the appropriate post-processing step
based on source_type. Yellow tasks in the Phase 2 flow diagram.

Dispatch order (fired from DataSourceViewSet.perform_create):
  image / archival  → generate_iiif_manifest
  pdf               → run_ocr_pipeline_for_source
  oral_history      → create_transcription_stub
  field_survey      → map_columns_to_properties
  *                 → emit_datasource_rdf  (always, chained from above)
"""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


def _get_source(pk: str):
    from .models import DataSource

    return DataSource.objects.filter(pk=pk).first()


def _mark_status(source, status: str):
    type(source).objects.filter(pk=source.pk).update(ingest_status=status)
    source.ingest_status = status


# ──────────────────────────────────────────────────────────────────────────────
# IIIF manifest generation (image, archival)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_iiif_manifest(self, data_source_id: str):
    """Build a minimal IIIF Presentation v3 manifest for an image/archival source."""
    source = _get_source(data_source_id)
    if source is None:
        logger.warning("generate_iiif_manifest: DataSource %s not found", data_source_id)
        return

    _mark_status(source, "processing")
    try:
        file_url = source.iiif_manifest_url or (
            source.uploaded_file.url if source.uploaded_file else None
        )
        manifest = {
            "@context": "http://iiif.io/api/presentation/3/context.json",
            "id": f"https://w3id.org/heritagegraph/source/{data_source_id}/manifest",
            "type": "Manifest",
            "label": {"none": [source.name]},
            "items": [],
        }
        if file_url:
            canvas_id = f"https://w3id.org/heritagegraph/source/{data_source_id}/canvas/1"
            manifest["items"].append(
                {
                    "id": canvas_id,
                    "type": "Canvas",
                    "items": [
                        {
                            "id": f"{canvas_id}/page",
                            "type": "AnnotationPage",
                            "items": [
                                {
                                    "id": f"{canvas_id}/page/anno",
                                    "type": "Annotation",
                                    "motivation": "painting",
                                    "body": {"id": file_url, "type": "Image"},
                                    "target": canvas_id,
                                }
                            ],
                        }
                    ],
                }
            )

        type(source).objects.filter(pk=source.pk).update(
            iiif_manifest=manifest, ingest_status="ready"
        )
        logger.info("IIIF manifest generated for DataSource %s", data_source_id)
    except Exception as exc:
        _mark_status(source, "failed")
        logger.exception("generate_iiif_manifest failed for %s", data_source_id)
        raise self.retry(exc=exc)

    emit_datasource_rdf.delay(data_source_id)


# ──────────────────────────────────────────────────────────────────────────────
# OCR pipeline (pdf)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_ocr_pipeline_for_source(self, data_source_id: str):
    """Route a PDF DataSource through the OCR pipeline."""
    source = _get_source(data_source_id)
    if source is None:
        return

    _mark_status(source, "processing")
    try:
        # Delegate to document_processing if the file was also stored as an
        # UploadedDocument; otherwise mark ready and let the curator upload manually.
        from apps.document_processing.models import UploadedDocument

        doc = UploadedDocument.objects.filter(
            media_id=str(data_source_id)
        ).first()
        if doc is not None:
            from apps.document_processing.tasks import classify_and_route_document

            classify_and_route_document.delay(str(doc.pk))
        else:
            # No UploadedDocument: flag as ready so the curator can link manually.
            _mark_status(source, "ready")
    except Exception as exc:
        _mark_status(source, "failed")
        logger.exception("run_ocr_pipeline_for_source failed for %s", data_source_id)
        raise self.retry(exc=exc)

    emit_datasource_rdf.delay(data_source_id)


# ──────────────────────────────────────────────────────────────────────────────
# Transcription stub (oral_history)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def create_transcription_stub(self, data_source_id: str):
    """Create a placeholder transcription record for an oral history source."""
    source = _get_source(data_source_id)
    if source is None:
        return

    _mark_status(source, "processing")
    try:
        if not source.note:
            type(source).objects.filter(pk=source.pk).update(
                note="[Transcription pending — attach transcript text here]",
                ingest_status="ready",
            )
        else:
            _mark_status(source, "ready")
        logger.info("Transcription stub created for DataSource %s", data_source_id)
    except Exception as exc:
        _mark_status(source, "failed")
        logger.exception("create_transcription_stub failed for %s", data_source_id)
        raise self.retry(exc=exc)

    emit_datasource_rdf.delay(data_source_id)


# ──────────────────────────────────────────────────────────────────────────────
# Column mapping (field_survey)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def map_columns_to_properties(self, data_source_id: str):
    """Map CSV/spreadsheet columns to ontology properties via ui-classmap.yaml."""
    source = _get_source(data_source_id)
    if source is None:
        return

    _mark_status(source, "processing")
    try:
        # Stub: full implementation requires tabular import engine
        _mark_status(source, "ready")
        logger.info("Column mapping stub completed for DataSource %s", data_source_id)
    except Exception as exc:
        _mark_status(source, "failed")
        logger.exception("map_columns_to_properties failed for %s", data_source_id)
        raise self.retry(exc=exc)

    emit_datasource_rdf.delay(data_source_id)


# ──────────────────────────────────────────────────────────────────────────────
# Archival metadata extraction
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2)
def extract_archival_metadata(self, data_source_id: str):
    """Extract archival_location + date from a scanned archival document."""
    source = _get_source(data_source_id)
    if source is None:
        return

    _mark_status(source, "processing")
    try:
        # Stub: will call the document processing pipeline when enabled
        _mark_status(source, "ready")
        logger.info("Archival metadata stub completed for DataSource %s", data_source_id)
    except Exception as exc:
        _mark_status(source, "failed")
        logger.exception("extract_archival_metadata failed for %s", data_source_id)
        raise self.retry(exc=exc)

    emit_datasource_rdf.delay(data_source_id)


# ──────────────────────────────────────────────────────────────────────────────
# RDF emission (all types)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3, default_retry_delay=15)
def emit_datasource_rdf(self, data_source_id: str):
    """Write DataSource type triple to the RDF outbox: source_pid rdf:type hg:XxxDataset."""
    from django.conf import settings

    if not getattr(settings, "RDF_SYNC_ENABLED", False):
        return

    source = _get_source(data_source_id)
    if source is None or not source.pid:
        return

    try:
        from apps.graph.kg_engine.outbox import enqueue_insert_nt
        from apps.graph.kg_engine.partitions import GraphPartition
        from apps.graph.kg_engine.uris import resource_base

        base = resource_base()
        rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        prov = "http://www.w3.org/ns/prov#"
        hg = f"{base}/"
        dct = "http://purl.org/dc/terms/"
        hg_class = source.hg_class

        ntriples = (
            f"<{source.pid}> <{rdf}type> <{prov}Entity> .\n"
            f"<{source.pid}> <{rdf}type> <{hg}{hg_class}> .\n"
            f'<{source.pid}> <{dct}title> "{source.name}" .\n'
        )
        if source.datacite_creator:
            ntriples += (
                f'<{source.pid}> <{dct}creator> "{source.datacite_creator}" .\n'
            )
        if source.datacite_identifier:
            ntriples += (
                f'<{source.pid}> <{dct}identifier> "{source.datacite_identifier}" .\n'
            )

        graph_uri = GraphPartition.PROVENANCE.uri(suffix=f"source/{data_source_id}")
        enqueue_insert_nt(graph_uri=graph_uri, ntriples=ntriples, error="")
        logger.info("DataSource RDF enqueued for %s (%s)", data_source_id, hg_class)
    except Exception as exc:
        logger.exception("emit_datasource_rdf failed for %s", data_source_id)
        raise self.retry(exc=exc)


# ──────────────────────────────────────────────────────────────────────────────
# Assertion reconciliation (Getty AAT + Wikidata)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def reconcile_assertion_async(self, assertion_id: str):
    """
    Look up the asserted_value in Getty AAT and Wikidata; write skos:exactMatch
    to the alignment graph when a high-confidence match is found.

    Dispatched from rdf_signals._on_assertion_saved for non-relationship
    assertions that have a non-empty asserted_value.
    """
    try:
        from apps.graph.reconciliation.service import reconcile_assertion

        result = reconcile_assertion(assertion_id)
        logger.info("reconcile_assertion_async(%s): %s", assertion_id, result)
    except Exception as exc:
        logger.exception("reconcile_assertion_async failed for %s", assertion_id)
        raise self.retry(exc=exc)


def dispatch_ingest_task(source) -> None:
    """Fire the appropriate Celery task for a newly created DataSource."""
    sid = str(source.pk)
    dispatch_map = {
        "image": generate_iiif_manifest,
        "archival": extract_archival_metadata,
        "pdf": run_ocr_pipeline_for_source,
        "oral_history": create_transcription_stub,
        "field_survey": map_columns_to_properties,
    }
    task = dispatch_map.get(source.source_type)
    if task is not None:
        task.delay(sid)
    else:
        # For published/inscription/web sources just emit RDF immediately
        emit_datasource_rdf.delay(sid)
