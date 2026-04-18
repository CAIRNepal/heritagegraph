# Quickstart: validate OCR async pipeline (dev + docker)

**Feature plan**: `specs/001-ocr-async-pipeline/plan.md`

## Prereqs

- Google OAuth + NextAuth working enough to obtain a browser session (or use an alternate dev token flow if you already use it in this environment).
- Backend environment variables for Celery/Redis and OCR feature flags (see `.env.example` for names like `OCR_ENABLED`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`).

## Local dev (Django)

> Note: `heritage_graph/settings/development.py` sets `CELERY_TASK_ALWAYS_EAGER = True`, so many tasks will run **inline** in the web process (useful for debugging, not representative of production async).

1. Start Redis (if you want a real broker even in dev):
   - `docker run --rm -p 6379:6379 redis:7-alpine`
2. Run migrations (if not already):
   - `cd heritage_graph && python manage.py migrate`
3. Run the backend:
   - `cd heritage_graph && python manage.py runserver 0.0.0.0:8000`
4. Trigger an upload that creates `heritage_data.Media` and thus `document_processing.UploadedDocument` (this is the current hook point).

**What to look for in logs**:
- `Document uploaded: ...` from `apps.document_processing.signals`
- A transition from `pending` → `processing` in `classify_and_route_document` (once implemented)

## Docker (closer to production: separate worker)

From repo root:

- `docker compose up -d redis ocr-worker backend`

Then confirm:
- `GET /health/` and `GET /health/ready/` on the backend route you use in your environment
- worker logs show Celery processing when a document is uploaded

## API checks (after endpoints exist)

**Recommended (versioned) base** (per `API_VERSIONING.md`):

- `https://<backend-host>/api/v1/data/...`

Use:

- `Authorization: Bearer <accessToken>`

**Minimal manual test flow (intended end state)**:

1. Upload a document through the new contributor upload endpoint (to be implemented per plan).
2. Poll processing status from the OCR document resource endpoint.
3. Fetch suggestions JSON for pre-fill when status is `completed`.

## Common failure modes

- Upload creates `Media` but OCR doesn’t start:
  - `OCR_ENABLED` is false, file extension not treated as a document, or the upload path didn’t create `Media` the signal listens to.
- Task runs but nothing changes:
  - Engine tasks are still TODO (current repo state) — the queue path may execute but does not yet persist pages/results.
