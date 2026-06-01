# OCR Integration Implementation Summary

## Overview
HeritageGraph now has infrastructure in place for document OCR processing. Two major phases completed:
- **Phase 0 (Infrastructure)**: Celery + Redis async task system configured
- **Phase 1 (Data Models)**: Document processing models and signals set up

## What Was Done

### Phase 0: Infrastructure Setup ✅

**Dependencies Added:**
- `celery==5.3.6` and `redis==5.0.1` (main requirements.txt)
- `requirements-ocr.txt` with heavy deps: pytesseract, easyocr, transformers, torch, trocr, anthropic, etc.

**Django Configuration:**
- Celery configured in [heritage_graph/settings/base.py](../heritage_graph/settings/base.py):
  - `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` point to Redis
  - Serialization: JSON (safe for all data types)
  - Task time limits: 30min hard / 25min soft
- Development mode: `CELERY_TASK_ALWAYS_EAGER = True` (tasks run synchronously for easier debugging)
- Created [heritage_graph/celery_app.py](../heritage_graph/celery_app.py) app initialization
- Updated [heritage_graph/__init__.py](../heritage_graph/__init__.py) to load Celery on startup

**Docker Setup:**
- Added Redis service to docker-compose.yml (port 6379 internal)
- Added ocr-worker service: runs Celery worker with full OCR dependencies
- Updated Dockerfile.backend with 4-stage multi-stage build:
  - `base-builder`: Dependencies wheel building
  - `ocr-builder`: OCR-specific heavy dependencies
  - `runtime-lean`: Backend service (no OCR) — smaller image
  - `ocr-worker`: Full OCR worker with tesseract, torch, etc.

**Environment Variables Added (.env.example):**
- `CELERY_BROKER_URL`: Redis connection
- `CELERY_RESULT_BACKEND`: Redis result storage
- `OCR_ENABLED`: Enable/disable pipeline
- `TESSERACT_PATH`: Path to tesseract binary
- `ANTHROPIC_API_KEY`: Claude Vision API key
- `OCR_CONFIDENCE_THRESHOLD`, `OCR_MAX_PAGES_PER_DOCUMENT`, etc.

### Phase 1: Data Models & Document Processing App ✅

**App Created:** [heritage_graph/apps/document_processing/](../heritage_graph/apps/document_processing/)

**Models:**
1. **UploadedDocument** (`models.py`)
   - Central record for each uploaded document
   - Fields: document_type (PDF digital/scanned, image print/handwritten/inscription), status (pending/processing/completed/failed)
   - Tracks: classification_confidence, raw_text, processing_started/finished, error_message
   - Links to: Media (upload source), Submission (legacy), CulturalEntity (new workflow)
   - Indexes: status + created_at, document_type for fast filtering

2. **DocumentPage** (`models.py`)
   - Represents individual pages after splitting
   - Per-page OCR text + aggregated confidence score
   - Unique constraint: document + page_number

3. **OCRResult** (`models.py`)
   - Engine-specific results (audit trail)
   - Fields: engine (pdfplumber/tesseract/easyocr/trocr/claude_vision), text, confidence, metadata (JSONField)
   - Enables comparing outputs from multiple engines for same page

4. **ExtractedField** (`models.py`)
   - NER-extracted structured entities
   - Fields: field_name, field_value, source_entity_type (PERSON/LOCATION/DATE/etc.)
   - Scores: confidence (OCR) + vocabulary_match_score (Wikidata/AAT cross-check)
   - Used by frontend to pre-fill forms with "confidence badges"

**Celery Tasks** (`tasks.py`)
- Skeleton tasks (TODO implementations):
  - `classify_and_route_document()`: Main pipeline entry, determines engine routing
  - `extract_text_pdfplumber()`: Digital PDFs (direct text, no OCR)
  - `extract_text_tesseract()`: Printed Devanagari primary
  - `extract_text_easyocr_fallback()`: Mixed scripts, fallback on low confidence
  - `extract_text_trocr()`: Handwritten HTR
  - `vision_rescue_task()`: Claude Vision for hard inscriptions
  - `extract_structured_fields()`: NER extraction
  - `map_fields_to_form()`: Map entities to form fields
  - `cleanup_failed_documents()`: Periodic cleanup task

**Signal Handlers** (`signals.py`)
- Triggers on Media creation
- Auto-creates UploadedDocument + queues classify_and_route_document task
- Defensive: won't break if OCR init fails (catches exception)

**Admin Interface** (`admin.py`)
- Registered all 4 models in Django admin
- Features:
  - Color-coded badges for status/document_type
  - Inline search, filters, sorting
  - Bulk actions: "Retry OCR" (re-queue failed docs), "Delete results"
  - Fieldsets: collapse advanced fields for cleaner UI
  - Readonly fields for audit audit (id, timestamps, results)

**App Registration:**
- Added `apps.document_processing` to `INSTALLED_APPS` in base.py
- Signal handlers auto-registered in `apps.DocumentProcessingConfig.ready()`

**Database:**
- 4 models × 4 tables created (verified with `python manage.py check`)
- Migrations created and applied to SQLite/PostgreSQL

---

## Architecture Overview

```
User uploads document (PDF/image via heritage_graph_ui)
    ↓
POST /data/api/form-submit/ or /data/cultural-entities/
    ↓
Media model created (save file to storage)
    ↓
Signal: post_save on Media
    ↓
on_media_upload() handler:
  1. Check if file is document type (.pdf, .jpg, etc.)
  2. Create UploadedDocument (status='pending')
  3. Queue Celery task: classify_and_route_document.delay(doc_id)
    ↓
[Async / Development: runs immediately]
[Production: goes to Redis queue, Celery worker picks up]
    ↓
classify_and_route_document task:
  1. Load UploadedDocument by ID
  2. Read Media file
  3. Determine document_type + confidence (classifier logic — TODO)
  4. Route to engine tasks:
     - PDF digital → extract_text_pdfplumber
     - PDF scanned / Printed image → extract_text_tesseract (primary)
     - Printed + low confidence → extract_text_easyocr_fallback
     - Handwritten → extract_text_trocr
     - Stone inscription → vision_rescue_task
    ↓
Engine tasks (example: Tesseract):
  1. extract_text_tesseract(doc_id):
       - Load image from Media file
       - Run Tesseract with config: --oem 1 --psm 3 -l deva+eng
       - For each page: create DocumentPage + OCRResult
       - Get confidence scores
       - If confidence < threshold: queue extract_text_easyocr_fallback
       - Set UploadedDocument.raw_text = concatenated pages
    ↓
extract_structured_fields task:
  1. Load raw_text from UploadedDocument
  2. Call Instructor + Claude to extract entities:
     - PERSON: name, dates, roles, relation to heritage
     - LOCATION: name, coordinates, heritage significance
     - DATE: ranges, historical periods
     - ARTIFACT: type, material, dimensions
     - EVENT: name, date, participants
     - TRADITION: name, cultural significance
     - etc.
  3. For each entity: create ExtractedField with confidence + vocabulary_score
  4. Set document.status = 'completed'
    ↓
map_fields_to_form task:
  1. Load ExtractedFields for document
  2. Map to form fields (e.g., PERSON with name → person_name field)
  3. Generate pre-populate structure for frontend
    ↓
API (DRF) — also mirrored under `/api/v1/data/...` (recommended):
  POST   /data/ocr-documents/upload/              (multipart: `file` + `cultural_entity_id` or `submission_id`)
  GET    /data/ocr-documents/<uuid>/              (status)
  GET    /data/ocr-documents/<uuid>/suggestions/  (map of `ExtractedField` suggestions)
  POST   /data/ocr-documents/<uuid>/retry/        (staff: requeue)
    ↓
Frontend (MVP in `heritage_graph_ui`):
  `HeritageDocumentUpload` uploads + polls, then "Apply" merges suggestions into **empty** form fields
```

---

## Current Limitations / TODO

The unified pipeline in `apps.document_processing.services.pipeline` is a **v1** implementation: it is end-to-end wired (upload → process → `ExtractedField` rows → API), but some engines are still best-effort or intentionally lightweight.

1. **Classify/routing** is heuristic (PDF digital vs scanned vs image types) — can be improved with stronger signals and fixtures.
2. **EasyOCR** is not used on the “lean” path yet; `requirements-ocr.txt` includes it for worker experiments.
3. **TrOCR** is not wired; handwriting currently follows the Tesseract/raster path (`services/htr.py` v1).
4. **NER** is currently heuristic (`services/ner.py`) rather than instructor/LLM-structured extraction.
5. **Monitoring/metrics** beyond structured logs in tasks/services is still open.

### To Complete Phase 5 (Monitoring)
1. Add task status endpoint (admin only)
2. Add logging/metrics for engine performance

### To Complete Phase 6 (Testing)
1. Unit tests for each component
2. Fixtures with real test documents
3. Manual end-to-end test on dev

---

## How to Continue

### To test the current setup:
```bash
# Terminal 1: Start Redis
docker run --rm -p 6379:6379 redis:7-alpine

# Terminal 2: Start Celery worker (with eager mode in dev)
cd heritage_graph
source .venv/bin/activate
celery -A heritage_graph worker -l debug

# Terminal 3: Test task in Django shell
python heritage_graph/manage.py shell
>>> from apps.document_processing.models import UploadedDocument
>>> from apps.document_processing.tasks import classify_and_route_document
>>> # Upload a Media file, then:
>>> doc = UploadedDocument.objects.first()
>>> classify_and_route_document.delay(str(doc.id))
```

### To add Tesseract support:
```bash
# macOS
brew install tesseract

# Ubuntu
sudo apt-get install tesseract-ocr tesseract-ocr-nep tesseract-ocr-script-deva

# Then implement classifier.py and extract_text_tesseract() task
```

### To run with Docker:
```bash
docker-compose up -d redis ocr-worker
# Backend will connect to Redis at redis:6379
# ocr-worker will process tasks from the queue
```

---

## Files Modified/Created

**Created:**
- `heritage_graph/celery_app.py` — Celery app initialization
- `heritage_graph/__init__.py` — Celery setup on Django startup
- `heritage_graph/apps/document_processing/` — New app (5 files)
  - `models.py` — 4 data models
  - `tasks.py` — Celery task skeletons
  - `signals.py` — OCR trigger on Media upload
  - `admin.py` — Django admin interface
  - `apps.py` — App config + signal registration
  - `migrations/0001_initial.py` — Database schema
- `requirements-ocr.txt` — OCR dependencies (separate from main)

**Modified:**
- `requirements.txt` — Added celery, redis
- `heritage_graph/settings/base.py` — Added Celery config + document_processing to INSTALLED_APPS
- `heritage_graph/settings/development.py` — Added CELERY_TASK_ALWAYS_EAGER for dev
- `.env.example` — Added CELERY_* and OCR_* variables
- `docker-compose.yml` — Added redis + ocr-worker services, updated backend target
- `Dockerfile.backend` — Multi-stage build with runtime-lean + ocr-worker targets

---

## Next Session

Harden the v1 pipeline: improve `classifier.py` accuracy, add EasyOCR fallback where Tesseract is weak, wire optional TrOCR in the worker image, and expand `ner.py` from heuristics toward schema-guided extraction.
