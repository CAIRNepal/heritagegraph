from __future__ import annotations

from typing import Any

from ..models import TabularImportJob, UploadedDocument


def build_ingestion_compile_preview(*, document: UploadedDocument) -> dict[str, Any]:
    """
    Server-side semantic sketch for supervised ingestion (entity-level, not RDF).

    Uses persisted ``ingestion_review_state.field_decisions`` when present.
    """
    state = document.ingestion_review_state or {}
    field_decisions = state.get("field_decisions") or {}

    entities: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    validation_errors: list[str] = []

    doc_node_id = f"doc-{document.id}"

    entities.append(
        {
            "id": doc_node_id,
            "kind": "document",
            "label": (document.media.file.name.rsplit("/", 1)[-1] if document.media.file else "Document"),
            "entity_type": "DOCUMENT",
        }
    )

    rows = list(document.extracted_fields.all().order_by("-confidence"))
    if not rows:
        validation_errors.append("No extracted fields — run OCR/NER or map columns before preview.")

    counts_by_entity_type: dict[str, int] = {}

    prev_ef_id: str | None = None
    for row in rows:
        d = field_decisions.get(str(row.id)) or {}
        edited = (d.get("edited_value") or "").strip()
        raw_val = (row.field_value or "").strip()
        label = edited or raw_val or row.field_name
        uncertain = bool(d.get("uncertain"))
        linked = d.get("linked") if isinstance(d.get("linked"), dict) else None

        if uncertain and not linked:
            validation_errors.append(
                f'Extracted "{row.field_name}" marked uncertain — resolve or link before ingest.'
            )

        ef_id = f"ef-{row.id}"
        et = row.source_entity_type or "OTHER"
        counts_by_entity_type[et] = counts_by_entity_type.get(et, 0) + 1

        entities.append(
            {
                "id": ef_id,
                "kind": "extracted_field",
                "field_name": row.field_name,
                "label": label[:500],
                "entity_type": et,
                "confidence": float(row.confidence),
                "uncertain": uncertain,
                "linked": linked,
            }
        )

        relations.append(
            {
                "source": doc_node_id,
                "target": ef_id,
                "label": "extracted_from",
                "confidence": float(row.confidence),
            }
        )

        if prev_ef_id:
            relations.append(
                {
                    "source": prev_ef_id,
                    "target": ef_id,
                    "label": "reading_order",
                    "confidence": 0.35,
                }
            )
        prev_ef_id = ef_id

    provenance = document.provenance if isinstance(document.provenance, dict) else {}

    return {
        "document_id": str(document.id),
        "entities": entities,
        "relations": relations,
        "validation_errors": validation_errors,
        "counts_by_entity_type": counts_by_entity_type,
        "provenance": provenance,
    }


def tabular_compile_preview(*, job: TabularImportJob) -> dict[str, Any]:
    """Build compile preview for a tabular import job using mapping + staged rows."""
    mapping = job.column_mapping if isinstance(job.column_mapping, dict) else {}
    rows = job.staged_rows if isinstance(job.staged_rows, list) else []
    validation_errors = list(job.validation_errors or []) if job.validation_errors else []

    entities: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []

    tab_id = f"tabular-{job.id}"
    entities.append(
        {
            "id": tab_id,
            "kind": "tabular_job",
            "label": job.source_filename or "Spreadsheet import",
            "entity_type": "IMPORT",
        }
    )

    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        rid = f"row-{job.id}-{i}"
        label_parts = [str(row.get(k, "")) for k in sorted(row.keys())[:3]]
        label = " · ".join(p for p in label_parts if p) or f"Row {i + 1}"
        entities.append(
            {
                "id": rid,
                "kind": "tabular_row",
                "row_index": i,
                "label": label[:300],
                "entity_type": "ROW",
                "cells": row,
            }
        )
        relations.append({"source": tab_id, "target": rid, "label": "contains_row", "confidence": 1.0})

    return {
        "tabular_job_id": str(job.id),
        "mapping": mapping,
        "entities": entities,
        "relations": relations,
        "validation_errors": validation_errors,
        "row_count": len(rows),
    }
