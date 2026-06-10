# Research: OCR async pipeline (heritage documents)

**Feature**: `specs/001-ocr-async-pipeline/spec.md`  
**Plan**: `specs/001-ocr-async-pipeline/plan.md`  
**Date**: 2026-04-18

## R-001 — Async execution model (Celery + Redis + worker)

**Decision**: Use the existing Celery/Redis approach and the dedicated `ocr-worker` service to execute OCR off the request thread; keep the lean API image and heavy OCR stack in the worker build.

**Rationale**: The repository already has production-oriented wiring and a multi-stage backend Dockerfile separating “lean runtime” from “OCR worker”.

**Alternatives considered**:
- In-process synchronous OCR in the web app (rejected: blocks requests, bloats API image, hard to scale).
- External managed OCR-only SaaS (rejected for v1: cost + data residency + integration complexity; can be revisited for specific engines).

## R-002 — Engine routing: digital text vs scan vs handwriting vs “rescue”

**Decision**:
- If PDF has extractable text with reasonable coverage → treat as `pdf_digital` and extract via direct text extraction first.
- If PDF is image-only (or text extraction is empty/low-signal) → treat as `pdf_scanned` and run raster OCR.
- If raster OCR confidence is low → run multi-script fallback OCR.
- If classified as likely handwritten → route to the handwritten path.
- If still low quality / low contrast inscriptions → allow a capped “vision rescue” pass with strict audit metadata.

**Rationale**: The engine list is already encoded as an audit model (`OCRResult.engine` choices) and task skeletons; this routing matches the intended heritage material mix (printed Devanagari + English, scans, inscriptions).

**Alternatives considered**:
- Single OCR engine for everything (rejected: fails on mixed script + difficult media).
- Always use “vision” for hard cases (rejected: cost + latency; must be capped).

## R-003 — NER + “form pre-fill” output shape

**Decision**: Produce `ExtractedField` rows (already modeled) and expose a read API that returns a JSON object of `{ fieldKey: { value, confidence, entityType, evidence? } }` for the UI to render as suggestions.

**Rationale**: The database already has `ExtractedField` with `field_name`, `field_value`, `source_entity_type`, and `confidence`. This maps cleanly to “suggestion objects” for shadcn form controls.

**Alternatives considered**:
- Return raw only and let the client parse (rejected: duplicates logic, weak audit story).
- Store pre-fill only in `Revision` JSON (rejected: couples OCR to revision writes and complicates re-runs/retries).

## R-004 — Guardrails: pages, file size, vision budget, timeouts

**Decision** (initial defaults, tune with metrics):
- Enforce max pages per document and max file size (reject early with a clear user-facing error).
- Enforce max “vision rescue” invocations per document and persist the count in an auditable way.
- Set Celery time limits consistent with `settings` expectations; OCR tasks should checkpoint per page where feasible.

**Rationale**: The spec’s success criteria explicitly require preventing runaway processing; the repo already documents related env controls in [`documentation/pipelines/OCR.md`](../../documentation/pipelines/OCR.md) and [`.env.example`](../../.env.example).

**Alternatives considered**:
- Unlimited pages with best-effort (rejected: operational risk, poor UX for huge PDFs).

## R-005 — Integration gap: `CulturalEntity` contributions need a real upload path

**Decision**: Extend the contribution model so a `FileField` upload can be associated with a `CulturalEntity` (while preserving legacy `Submission` media). Keep `UploadedDocument` attached to `Media` via the existing one-to-one relationship to minimize redesign.

**Rationale (verified in code)**: `apps.document_processing` triggers OCR on `post_save` for `heritage_data.Media`, but `Media` currently has a **required** `submission` FK, while `CulturalEntity` create/update serializers accept JSON `form_data` and do not support multipart uploads. Without a new attach point, OCR will not run for the modern flow.

**Alternatives considered**:
- Store documents only as `Submission` attachments forever (rejected: conflicts with “use CulturalEntity for new work” project guidance).
- Replace `Media` entirely (rejected: high churn vs incremental FK extension).
