---
description: "Task list for OCR async pipeline (heritage documents)"
---

# Tasks: OCR async pipeline (heritage documents)

**Input**: Design documents from `specs/001-ocr-async-pipeline/`

**Prerequisites**:
- `specs/001-ocr-async-pipeline/plan.md`
- `specs/001-ocr-async-pipeline/spec.md`
- (Available) `specs/001-ocr-async-pipeline/research.md`
- (Available) `specs/001-ocr-async-pipeline/data-model.md`
- (Available) `specs/001-ocr-async-pipeline/contracts/openapi-ocr-documents.v1.yaml`
- (Available) `specs/001-ocr-async-pipeline/quickstart.md`

**Tests**: Not explicitly requested in `spec.md` (no TDD requirement). This task list focuses on implementation + manual validation using `specs/001-ocr-async-pipeline/quickstart.md` and `docker compose` bring-up.

**Organization**: Phases follow Speckit conventions: Setup → Foundational (blocking) → user stories in priority order → Polish.

## Constitution Gates (apply to all tasks)

Reference `/.specify/memory/constitution.md` while executing tasks:

- **Secrets/config**: do not commit secrets; add/extend env var names in `.env.example` (and only document values that are non-secret).
- **Auth contract**: any protected Next.js fetches use `Authorization: Bearer ${session.accessToken}`; API base via `process.env.NEXT_PUBLIC_*` (no hardcoded `http://localhost:*` URLs in UI code).
- **Quality gates**: ruff for touched Python; front-end typecheck/build scripts for touched TS.
- **Deployability**: if schema/URLs change, include migration + include URL wiring + user-visible backwards compatibility for legacy clients where applicable.

## Phase 1: Setup (shared infrastructure + alignment)

**Purpose**: Align local/docker execution with the existing `redis` + `ocr-worker` topology and the documented OCR environment variables.

- [x] T001 Verify the Celery app wiring in `heritage_graph/celery_app.py` and the imported Celery autoload in `heritage_graph/__init__.py` still matches how workers should start in `Dockerfile.backend` and `docker-compose.yml`
- [x] T002 [P] Verify OCR-related environment variables in `.env.example` and cross-check the names you will read from settings in `heritage_graph/settings/development.py` and `heritage_graph/settings/production.py` (no env-specific surprises hidden in `heritage_graph/settings/base.py`)
- [x] T003 [P] Verify `OCR_ENABLED` and Celery/Redis settings are read consistently in `heritage_graph/settings/base.py` and that `heritage_graph/settings/development.py`’s `CELERY_TASK_ALWAYS_EAGER` behavior is understood for dev vs `ocr-worker` in docker
- [x] T004 [P] Verify the `ocr-worker` service in `docker-compose.yml` points at the `ocr-worker` build target in `Dockerfile.backend` and uses a Celery autodiscover-friendly app module path
- [x] T005 [P] Verify the heavy dependency split still makes sense: `heritage_graph/requirements.txt` vs `heritage_graph/requirements-ocr.txt` and how the worker image installs the OCR stack
- [x] T006 [P] Verify existing operational documentation in `OCR_INTEGRATION_SUMMARY.md` matches the intended runtime (update later in polish if the implementation changes behavior materially)

## Phase 2: Foundational (blocking prerequisites for all user stories)

**Purpose**: Unblock the modern `CulturalEntity` workflow from creating `heritage_data.Media` rows, wire permissions + routing for OCR read APIs, and make uploads safe (guardrails) before any engine work.

**⚠️ CRITICAL**: No user story can be “real” in production until `Media` can be attached to a `CulturalEntity` and OCR APIs exist for polling results.

- [x] T007 Extend `heritage_graph/apps/heritage_data/models.py` `Media` to support `CulturalEntity` attachments by adding `cultural_entity` FK (nullable) and making `submission` nullable with `clean()` validation enforcing exactly one parent for OCR/document uploads
- [x] T008 Add django migration in `heritage_graph/apps/heritage_data/migrations/` for the `Media` model change (reversible, with a short data expectation note in the migration if needed)
- [x] T009 Update `heritage_graph/apps/heritage_data/admin.py` `MediaAdmin` (and any inlines) to include `cultural_entity` in list/search where appropriate
- [x] T010 [P] Add new OCR guard settings (max upload bytes, max pages, time bounds) in `heritage_graph/settings/development.py` and `heritage_graph/settings/production.py` reading from environment variables documented in `.env.example`
- [x] T011 Add/extend `UploadedDocument` fields in `heritage_graph/apps/document_processing/models.py` to support operational caps/audit (e.g., vision call counter, user-safe `error_code` if you split user vs staff error details) + add migration in `heritage_graph/apps/document_processing/migrations/`
- [x] T012 Update `heritage_graph/apps/document_processing/signals.py` `on_media_upload` to: respect `OCR_ENABLED`, set `UploadedDocument.submission` / `UploadedDocument.cultural_entity` from the parent on `heritage_data.Media` when available, and avoid double-creating `UploadedDocument` rows
- [x] T013 [P] Create `heritage_graph/apps/document_processing/permissions.py` with a permission that allows contributors to access only their own `UploadedDocument` via the owning `Media` (either `Submission.contributor` or `CulturalEntity.contributor`) and a staff permission for requeue
- [x] T014 [P] Implement upload + read serializers in a new `heritage_graph/apps/document_processing/serializers.py` (multipart upload to create `heritage_data.Media` + return `uploaded_document_id`, plus serializers for `GET` status and suggestions payloads aligned with `specs/001-ocr-async-pipeline/contracts/openapi-ocr-documents.v1.yaml`)
- [x] T015 Replace placeholder `heritage_graph/apps/document_processing/views.py` with a `ModelViewSet` (or dedicated upload view) implementing: `GET` status, `GET` suggestions, and `POST` requeue; ensure queryset scoping in `get_queryset()` in `heritage_graph/apps/document_processing/views.py`
- [x] T016 Add `DefaultRouter` registration in a new `heritage_graph/apps/document_processing/urls.py` and register the routes under `data/ocr-documents/` (or equivalent) using `DefaultRouter` patterns
- [x] T017 Wire document processing URLs in `heritage_graph/urls.py` for both legacy and versioned includes (`data/` and `api/v1/data/`) by adding `include("apps.document_processing.urls")` alongside the existing `apps.heritage_data.urls` includes
- [x] T018 [P] Add a multipart upload endpoint implementation (likely `@action` on the viewset in `heritage_graph/apps/document_processing/views.py`) that creates a `heritage_data.Media` row for `cultural_entity_id` and triggers the existing `post_save` signal path
- [x] T019 Harden `heritage_graph/apps/document_processing/admin.py` admin action `retry_failed_documents` to use staff-safe throttling, reset the correct fields, and log structured context without leaking PII in `heritage_graph/apps/document_processing/admin.py` (and consider removing inline hex colors in favor of theme-friendly admin display—optional but recommended)

**Checkpoint**: Uploading a document for a `CulturalEntity` can create `heritage_data.Media` + `document_processing.UploadedDocument`, and authorized users can `GET` OCR status via API routes wired in `heritage_graph/urls.py`.

---

## Phase 3: User Story 1 - Upload a heritage document and get extracted text/fields (Priority: P1) 🎯 MVP

**Goal**: A contributor uploads a supported file and background processing produces non-empty `raw_text` + `ExtractedField` records retrievable from the API.

**Independent Test**: Use `specs/001-ocr-async-pipeline/quickstart.md` + a sample PDF/image, confirm `pending → processing → completed` and the suggestions endpoint returns JSON.

- [x] T020 [P] [US1] Implement PDF text extraction and page materialization in `heritage_graph/apps/document_processing/services/pdf.py` (writes `DocumentPage` + `OCRResult` rows idempotently)
- [x] T021 [P] [US1] Implement raster OCR + PDF-page rasterization in `heritage_graph/apps/document_processing/services/raster_ocr.py` (Tesseract + fallback strategy per `specs/001-ocr-async-pipeline/research.md`, writes `OCRResult` per engine)
- [x] T022 [P] [US1] Implement the handwritten (HTR) path in `heritage_graph/apps/document_processing/services/htr.py` (isolated import surface so lean runtime doesn’t import torch)
- [x] T023 [P] [US1] Implement vision rescue in `heritage_graph/apps/document_processing/services/vision_rescue.py` with a hard per-document cap persisted on `heritage_graph/apps/document_processing/models.py` fields and audit metadata in `OCRResult.metadata` JSON in `heritage_graph/apps/document_processing/models.py`
- [x] T024 [P] [US1] Implement a routing classifier in `heritage_graph/apps/document_processing/services/classifier.py` that sets `UploadedDocument.document_type` + `classification_confidence` before enqueueing the correct engine path
- [x] T025 [P] [US1] Add shared persistence helpers in `heritage_graph/apps/document_processing/persistence.py` to upsert `DocumentPage` rows, append `OCRResult`, and compute stable per-page `confidence` in `heritage_graph/apps/document_processing/models.py` fields
- [x] T026 [P] [US1] Implement structured extraction in `heritage_graph/apps/document_processing/services/ner.py` + mapping in `heritage_graph/apps/document_processing/services/form_mapping.py` that populates `ExtractedField` rows in `heritage_graph/apps/document_processing/models.py` (and never marks `UploadedDocument` completed if extraction is empty due to a hard error)
- [x] T027 [US1] Replace TODO skeletons in `heritage_graph/apps/document_processing/tasks.py` by calling the new services, chaining tasks, ensuring failures set `status=failed` with a user-safe message, and that retries don’t duplicate pages
- [x] T028 [P] [US1] Pin/adjust heavy deps in `heritage_graph/requirements-ocr.txt` and ensure the worker image installs any required system packages in `Dockerfile.backend` (tesseract languages, poppler, etc.) consistent with the chosen libraries
- [x] T029 [P] [US1] Reconcile public contract vs implementation by updating the machine-readable spec in `specs/001-ocr-async-pipeline/contracts/openapi-ocr-documents.v1.yaml` once the real DRF route names/fields are finalized (keep `/api/v1/...` alignment per `API_VERSIONING.md`)

**Checkpoint**: A successful upload run produces:
- `UploadedDocument.status=completed` with non-empty `raw_text` (when the source has extractable text content)
- ≥1 `ExtractedField` for typical fixtures (or explicit `failed` with user-safe error when the source is unusable)

---

## Phase 4: User Story 2 - Review extracted fields and decide what to keep (Priority: P2)

**Goal**: Contributors can see confidence-weighted suggestions and editor-controlled values, ensuring suggestions do not clobber user edits (per `spec.md`).

**Independent Test**: Load suggestions, verify confidence UI, type into fields, refresh suggestions, confirm user-typed values remain unless explicitly reset.

- [x] T030 [P] [US2] Add an OCR uploader + status poller client component in `heritage_graph_ui/src/components/ocr/heritage-document-upload.tsx` (wrap shadcn primitives; no direct edits under `heritage_graph_ui/src/components/ui/*`)
- [x] T031 [P] [US2] Add a polling hook in `heritage_graph_ui/src/hooks/use-heritage-ocr-suggestions.ts` that calls the versioned API base in `process.env.NEXT_PUBLIC_API_URL` and sends `Authorization: Bearer ${session.accessToken}` in `heritage_graph_ui/src/hooks/use-heritage-ocr-suggestions.ts`
- [x] T032 [US2] Integrate upload + “apply suggestions” into `heritage_graph_ui/src/app/(dashboard)/contribute/entity/page.tsx` (only apply to empty `form_data` fields; never overwrite user-entered values without explicit user action) 
- [x] T033 [P] [US2] Mirror the same integration in `heritage_graph_ui/src/app/(dashboard)/contribute/entity/edit/page.tsx` and `heritage_graph_ui/src/app/(dashboard)/contribute/entity/revise/page.tsx` to keep flows consistent
- [x] T034 [US2] Add user-visible confidence presentation using `heritage_graph_ui/src/components/ui/badge.tsx` (via a small wrapper in `heritage_graph_ui/src/components/ocr/ocr-suggestion-badge.tsx` if needed) and ensure no custom hex colors are introduced outside `heritage_graph_ui/src/app/globals.css` tokens

**Checkpoint**: Suggestions render as non-authoritative pre-fill, with editing behavior verified on at least the primary entity contribute page in `heritage_graph_ui/src/app/(dashboard)/contribute/entity/page.tsx`.

---

## Phase 5: User Story 3 - Staff can monitor and re-run processing (Priority: P3)

**Goal**: Staff can monitor outcomes and trigger retries with an auditable trail (admin is partially present; add API + hardening as needed).

**Independent Test**: As staff, requeue a failed doc from admin and/or the secured API action; confirm a new run updates timestamps and outputs without duplicating audit rows incorrectly.

- [x] T035 [P] [US3] Expose a staff-only `requeue`/`retry` path on the DRF viewset in `heritage_graph/apps/document_processing/views.py` matching `POST /data/ocr-documents/{id}/...` in `specs/001-ocr-async-pipeline/contracts/openapi-ocr-documents.v1.yaml` and enforce permissions from `heritage_graph/apps/document_processing/permissions.py`
- [x] T036 [US3] Improve `UploadedDocument` operational dashboards in `heritage_graph/apps/document_processing/admin.py` (filters, readonly audit fields, safer bulk actions) without logging sensitive content
- [x] T037 [US3] Add structured server logging helpers (document id, task name, engine, duration, failure class) in `heritage_graph/apps/document_processing/tasks.py` / services under `heritage_graph/apps/document_processing/services/` (never log tokens, minimize PII)

**Checkpoint**: Staff can retry a failed `UploadedDocument` in under 2 minutes of navigation time (per `spec.md` SC-004) using `heritage_graph/apps/document_processing/admin.py` and/or the `POST` retry in `heritage_graph/apps/document_processing/views.py`.

---

## Phase 6: Polish & cross-cutting concerns

**Purpose**: Rollout safety, documentation currency, and repo hygiene.

- [x] T038 [P] Update `OCR_INTEGRATION_SUMMARY.md` to match the now-real upload + API surfaces and the `CulturalEntity` attach behavior via `heritage_data.Media` in `heritage_graph/apps/heritage_data/models.py`
- [x] T039 [P] Update `AGENTS.md` OCR section with the final endpoints (legacy + versioned) and the attach model behavior (as required by the constitution for workflow doc updates)
- [x] T040 [P] If service topology or ports change, update `ARCHITECTURE.md` in the repo root (only if the docker topology or routing meaningfully changes)
- [x] T041 Run the manual bring-up in `specs/001-ocr-async-pipeline/quickstart.md` against `docker compose` and dev settings, and adjust `specs/001-ocr-async-pipeline/quickstart.md` if the steps drift
- [x] T042 [P] Run ruff on touched python paths in `heritage_graph/` and run the repo’s TypeScript build/typecheck for touched `heritage_graph_ui/` files (per project scripts)

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → can start immediately
- **Foundational (Phase 2)** → **blocks** all user stories
- **User stories**:
  - **US1 (P1)** can start only after Foundational
  - **US2 (P2)** can start only after **US1 API** exists, but most UI can be built in parallel once upload + `GET` endpoints are stable
  - **US3 (P3)** is mainly operational hardening; can be parallelized with US2 once retry/status endpoints are stable
- **Polish (Phase 6)** last

### User story dependencies

- **US1** depends on Foundational completion (T007–T018)
- **US2** depends on US1’s `GET` endpoints and meaningful `ExtractedField` output, but is UI-only once contracts are stable
- **US3** depends on US1’s processing lifecycle being real (at least to failed/completed) and the retry path existing

## Parallel example: US1 (engines)

```bash
# These can be implemented in parallel in separate service modules:
# - services/pdf.py
# - services/raster_ocr.py
# - services/htr.py
# - services/vision_rescue.py
# - services/classifier.py
# Then wire sequentially in tasks.py.
```

## Implementation strategy

### MVP first (ship US1)

1. Complete Phase 1–2
2. Complete US1 (Phase 3) until `GET` status + `GET` suggestions are meaningful
3. Stop and validate on a real PDF + a real image fixture

### Incremental delivery

1. Add US2 (Phase 4) to make suggestions usable in the `CulturalEntity` contribute UX
2. Add US3 (Phase 5) to operationalize review/retry
3. Finish polish (Phase 6)

## Notes

- The biggest repo-specific risk is **the `CulturalEntity` file attach gap**; the Foundational tasks must land before any meaningful OCR milestone.
- If any endpoint shape changes, update:
  - `heritage_graph/apps/document_processing/urls.py`
  - `specs/001-ocr-async-pipeline/contracts/openapi-ocr-documents.v1.yaml`
  - `AGENTS.md` and `OCR_INTEGRATION_SUMMARY.md` as needed
