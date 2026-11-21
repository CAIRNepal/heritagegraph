# Feature Specification: OCR Async Pipeline

**Feature Branch**: `001-ocr-async-pipeline`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "OCR pipeline for heritage documents with async processing, Check what is existing progress now and then create OCR pipeline for heritage documents with async processing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a heritage document and get extracted text/fields (Priority: P1)

A contributor uploads a heritage-related document (PDF or image) during a contribution flow and expects the system to automatically process it in the background, producing extracted text and suggested structured fields that can be used to pre-fill the contribution form.

**Why this priority**: This is the core user value—reduce manual typing and improve accuracy by leveraging document content.

**Independent Test**: Upload a supported document and observe that it transitions through processing states and produces viewable extracted text plus a set of extracted fields with confidence scores.

**Acceptance Scenarios**:

1. **Given** a signed-in contributor uploads a supported document, **When** the upload completes, **Then** the system creates a processing record and begins background processing without blocking the contribution flow.
2. **Given** a document is being processed, **When** processing completes successfully, **Then** extracted text and extracted fields are available for retrieval and review.
3. **Given** processing fails for a document, **When** the contributor (or staff) checks the document status, **Then** the system shows a failure status and a user-safe error message plus a retry option for staff.

---

### User Story 2 - Review extracted fields and decide what to keep (Priority: P2)

A contributor sees suggested fields (e.g., person names, places, dates) with confidence levels and can accept, edit, or discard suggestions before final submission.

**Why this priority**: Humans remain the authority; suggestions must be reviewable and editable to prevent incorrect data from entering the knowledge base.

**Independent Test**: Retrieve extracted fields for a processed document and verify that each field includes a value and confidence, and that users can edit values before final submit.

**Acceptance Scenarios**:

1. **Given** extracted fields are available, **When** a contributor reviews them, **Then** each suggestion shows a confidence indicator and an editable value.
2. **Given** a contributor changes suggested values, **When** they proceed to submit, **Then** the submission uses the contributor-edited values (not the original suggestion).

---

### User Story 3 - Staff can monitor and re-run processing (Priority: P3)

An administrator or reviewer monitors processing outcomes, inspects an audit trail of extraction runs, and can re-run processing for failed or low-confidence documents.

**Why this priority**: Operational support is necessary for reliability, especially during rollout and while improving extraction quality.

**Independent Test**: As staff, filter processing records by status, view details for one document, and trigger a retry that results in a new/updated processing outcome.

**Acceptance Scenarios**:

1. **Given** staff access, **When** they open the processing admin view, **Then** they can filter by status/type and drill into details.
2. **Given** a failed document, **When** staff triggers a retry, **Then** processing resumes and the status updates accordingly.

### Edge Cases

- What happens when a user uploads a very large PDF (many pages) or an unusually high-resolution image?
- What happens when a user uploads a file that is not a supported document type, or the file is corrupted?
- How does the system handle mixed-language documents (e.g., Nepali + English) and pages with very low contrast?
- What happens when background processing is disabled or temporarily unavailable?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically create a document-processing record when a supported document is uploaded as part of a contribution workflow.
- **FR-002**: System MUST process documents asynchronously so that uploads and primary contribution flows do not block on extraction.
- **FR-003**: System MUST expose document processing status with at least: pending, processing, completed, failed.
- **FR-004**: System MUST store extracted plain text for each processed document and make it retrievable for review.
- **FR-005**: System MUST produce extracted structured fields suitable for form pre-fill, where each extracted field includes a value, a field identifier/name, an entity category (e.g., person/location/date), and a confidence score.
- **FR-006**: System MUST support at least these document categories for routing purposes: digital PDF (text-based), scanned PDF/image (printed), handwritten image, and inscription/very low confidence image.
- **FR-007**: System MUST provide an auditable history of extraction runs per document, including which extraction approach was used and the outputs/confidence produced.
- **FR-008**: System MUST provide staff tooling to view processing records, filter by status/type, and re-run processing for a document.
- **FR-009**: System MUST enforce guardrails to control cost and resource usage, including a maximum number of pages processed per document and a capped number of “vision rescue” attempts per document.
- **FR-010**: System MUST allow processing to be enabled/disabled via configuration without requiring code changes.
- **FR-011**: System MUST provide a programmatic way to retrieve extracted fields for a document in a form-pre-fill structure.
- **FR-012**: System MUST ensure that extracted suggestions do not overwrite contributor-entered values without explicit contributor action.
- **FR-013**: System MUST record failures with a user-safe error summary and a staff-visible error detail for debugging.

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new env vars MUST be added to `.env.example`.
- **C-002**: Frontend network calls MUST use `process.env.NEXT_PUBLIC_*` configuration (no hardcoded localhost URLs).
- **C-003**: Protected API calls MUST use `Authorization: Bearer <accessToken>` sourced from NextAuth session.
- **C-004**: The implementation MUST remain compatible with repository quality gates (ruff for Python; TS build/typecheck for frontend) for touched code.

### Key Entities *(include if feature involves data)*

- **Document Processing Record**: Represents one uploaded document’s extraction lifecycle (status, classification, timestamps, extracted text).
- **Page Result**: Represents extraction results per page (text, confidence), where applicable.
- **Extraction Run Result**: Represents an auditable output from a specific extraction approach (text output, confidence, metadata).
- **Extracted Field Suggestion**: Represents a suggested form field value with confidence and provenance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Contributors can upload a supported document and continue their workflow without waiting for extraction to finish.
- **SC-002**: At least 90% of successfully processed documents produce non-empty extracted text retrievable for review.
- **SC-003**: For a representative test set, at least 70% of high-confidence extracted field suggestions are accepted as-is (without edits) by contributors.
- **SC-004**: Staff can identify and retry failed documents in under 2 minutes using the administrative tooling.
- **SC-005**: The system prevents runaway processing by enforcing page limits and capped rescue attempts for every document.

## Assumptions

- Existing background job infrastructure and a document-processing data model already exist in the codebase; this feature focuses on completing the pipeline behavior and making outputs usable in contribution flows.
- Initial rollout targets a bounded set of document types common to heritage contributions (PDFs and common image formats).
- Contributors remain responsible for final correctness; extracted fields are suggestions, not authoritative data.
- Processing may be disabled in some environments (e.g., local development) and must degrade gracefully without breaking uploads.
