# Data model: OCR async pipeline

**Spec**: `specs/001-ocr-async-pipeline/spec.md`  
**Plan**: `specs/001-ocr-async-pipeline/plan.md`

## Existing models (already in `apps.document_processing`)

### `UploadedDocument`

**Purpose**: One row per processed upload; tracks lifecycle + final concatenated `raw_text`.

- **State machine (expected)**:
  - `pending` → (worker picks up) → `processing` → `completed` | `failed`
- **Key fields** (current implementation):
  - `document_type` (classification label used for routing)
  - `classification_confidence`
  - `status`
  - `raw_text` (document-level)
  - `processing_started` / `processing_finished`
  - `error_message`
  - **Links**: `OneToOne` to `heritage_data.Media` (`related_name=ocr_document`)
  - **Optional context links**: `submission` (legacy), `cultural_entity` (new; nullable today)

**Notes**:
- `cultural_entity` exists as an optional pointer, but today OCR triggering is only wired through `Media` save.

### `DocumentPage`

**Purpose**: per-page “best current view” of OCR for multi-page materials.

- Unique on (`document`, `page_number`).

### `OCRResult`

**Purpose**: audit trail for *engine attempts* and comparisons.

- Linked to a `DocumentPage` (not only to a document) so you can support multiple engine passes per page.

### `ExtractedField`

**Purpose**: NER/structuring outputs used for pre-fill.

- `field_name`, `field_value`, `source_entity_type`, `confidence` (+ optional vocabulary score field already present in model)

## `heritage_data.Media` (upload source) — planned adjustment

**Today** (verified): `Media` is:

- `submission = ForeignKey(Submission, required)`  
- `file = FileField(...)`

**Planned** (to unlock `CulturalEntity` uploads while preserving legacy):
- Add nullable `cultural_entity = ForeignKey(CulturalEntity, null=True, blank=True)`
- Make `submission` nullable, **with validation** enforcing exactly one parent:
  - Either `submission` is set, **or** `cultural_entity` is set (never both, never neither on create for OCR uploads)
- Set `media_type` appropriately (likely `"image"` for most OCR file types, even for PDFs—unless you introduce a `"document"` media type; if you do, also update any assumptions in UI and admin)

**Rationale**: keeps `UploadedDocument.media` as the stable join key while allowing modern contributions to attach files.

## Proposed new operational counters (likely needed)

**Vision/budgeting** (implementation detail, but it’s data the product requirements imply):

- Track `claude_vision_invocations` (or equivalent) on `UploadedDocument` and/or the relevant `OCRResult.metadata` rollups, so cost caps are enforceable in code and auditable in admin.

## Permissions and access control (data rules)

- A contributor can read **only** `UploadedDocument` rows whose parent `Media` ultimately belongs to a contribution they own (through `Submission.contributor` or `CulturalEntity.contributor` once wired).
- Staff can read for operations (admin already registered models).

## Retention / cleanup

- Keep `failed` records for debugging, but support periodic cleanup (task skeleton exists: `cleanup_failed_documents`).

## Rollout / migration strategy

- Ship schema changes in reversible migrations.
- If existing `Media` rows are always `submission` non-null, the migration is backwards compatible until new clients start using `cultural_entity` uploads.
- Document a short “data expectations” note in `AGENTS.md` once the upload endpoint lands (per constitution workflow guidance).
