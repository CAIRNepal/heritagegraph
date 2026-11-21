# Feature Specification: In-Place Submission Edit

**Feature Branch**: `002-in-place-submission-edit`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "When I as an authenticated user click the edit button, it takes me to a new form that feels like submitting from scratch (possibly still updating the older record). I want to edit the submission in-place, such as inline or text-over-edit, instead of starting from scratch. Alternatively, the existing full-form style is acceptable if every field is pre-filled in a clear, production-ready way."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit with full current values visible (Priority: P1)

An authenticated user opens the edit experience for a contribution they are allowed to change. The screen clearly indicates they are **editing an existing submission**, and every field (or every logical section) shows the **current saved values** for that submission—not empty defaults, not placeholder-only states that hide prior content.

**Why this priority**: This removes the "starting over" feeling and prevents accidental data loss or confusion about whether changes apply to the original record.

**Independent Test**: For any editable submission, open edit and confirm that required and optional fields display the same values the user (or the system) last had stored, without the user re-entering them.

**Acceptance Scenarios**:

1. **Given** a user has a previously saved contribution with data in multiple fields, **When** they choose Edit, **Then** all those fields are populated with the stored values from that submission.
2. **Given** a user opens edit, **When** the screen loads, **Then** the interface clearly shows they are editing that specific submission (for example, title or identifier and an explicit "edit" context), not creating an unrelated new item.
3. **Given** a user makes a small change to one field and saves, **When** save completes, **Then** only the updated submission is affected; unchanged fields remain as they were before the edit (unless the user explicitly cleared a field the product allows to be empty).

---

### User Story 2 - Frictionless correction without retyping (Priority: P2)

A user who only needs to fix a typo or update one section can do so without re-filling the entire form from memory. Long or complex forms remain usable because the user sees the full context of what is already on file.

**Why this priority**: Reduces error rate and abandonment; matches expectations for "edit" in a serious production product.

**Independent Test**: Change a single field, save, and confirm that all other fields retain their prior values and that the user was not required to re-enter them.

**Acceptance Scenarios**:

1. **Given** a long contribution form, **When** the user edits and saves, **Then** the product does not require the user to re-enter fields they did not intend to change, except where the product has explicit validation that cannot be satisfied with stored values.
2. **Given** optional sections were left blank in the original submission, **When** the user opens edit, **Then** those sections still appear empty (or clearly marked as not provided), not filled with incorrect defaults.

---

### User Story 3 - Favorable in-place or inline experience where offered (Priority: P3)

Where the product offers an in-place, inline, or "edit in context" pattern (e.g., editing text directly in a list or detail view), that experience still loads the **same authoritative current values** as the full form path, and save behavior is consistent with the full form (no conflicting copies of the truth).

**Why this priority**: Improves speed and perceived quality; optional if the first release only improves full-form pre-fill, but the design should not fork inconsistent behavior.

**Independent Test**: If inline edit exists, compare one field's value between inline and full form for the same submission; they must match at load and after save.

**Acceptance Scenarios**:

1. **Given** the product supports inline or section-level editing, **When** the user opens that mode, **Then** the value shown is the current stored value for that field on that submission.
2. **Given** the user saves from an inline or section editor, **When** they later open the full form view, **Then** the updated value appears there as well (single consistent record).

### Edge Cases

- What happens when the submission cannot be loaded (network error, not found, or no permission)? The user sees a clear message and a safe way back; no partial or misleading empty form presented as "edit."
- What happens if another session or user updates the same submission while the first user is editing? The product defines predictable behavior: either a conflict notice with a choice to refresh, or last-save-wins, consistently applied and communicated.
- What happens for submissions with file uploads or media? Previously attached items are visible and identifiable; replacing or removing attachments follows explicit controls and confirm where destructive.
- What happens when validation rules have changed since the original submission? The user can still access their data, with any new invalid states explained and fixable in the same edit flow.
- How does the product handle very long text or many repeating entries? The edit experience supports scrolling, sectioning, or expansion without hiding existing content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST, when the user starts an "edit" action for an existing contribution they are allowed to change, load and display the current stored values for that contribution across all fields and sections the edit flow supports.
- **FR-002**: The system MUST make it obvious that the user is **editing** a specific existing submission, not creating a new unrelated submission, unless the user explicitly chooses "duplicate" or a similar create-new action.
- **FR-003**: The system MUST not present empty form defaults in place of stored data for fields that already have values, except where a field is legitimately empty in the stored record.
- **FR-004**: The system MUST allow the user to save changes such that only intended modifications are required; the user MUST NOT be forced to re-enter every field to complete a valid save, except where business rules require confirmation or missing mandatory data that is absent from storage.
- **FR-005**: The system MUST preserve field values the user does not change during an edit session (same logical submission, no silent reset of unmodified fields).
- **FR-006**: If the product offers a full multi-step or long form for edit, the system MUST pre-fill all steps/sections for which data exists before the user advances, or load them on demand with correct values when a step is shown.
- **FR-007**: If the product offers in-place, inline, or section-level editing in addition to or instead of a full-page form, the system MUST use the same authoritative current values and produce the same outcome after save as the equivalent full-form path for the same field.
- **FR-008**: The system MUST handle load failures, permission denials, and not-found cases without showing a blank form that could be mistaken for a successful empty edit.
- **FR-009**: The system MUST show previously attached files or media (or their absence) in a way that lets the user understand what is already on record before they add or change attachments.
- **FR-010**: The system MUST provide appropriate feedback on save (success, validation errors, or conflict) so the user knows whether the submission in front of them matches what was stored.

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new environment variables MUST be added to `.env.example`.
- **C-002**: Frontend network configuration MUST use `process.env.NEXT_PUBLIC_*` (no hardcoded `http://localhost` URLs).
- **C-003**: Protected operations MUST use the platform’s standard authenticated request pattern (Bearer token from the interactive session, per project conventions).
- **C-004**: The implementation MUST remain compatible with repository quality gates (Python and TypeScript checks for touched code).

### Key Entities *(include if feature involves data)*

- **Editable submission**: A contribution record the authenticated user (or an authorized role) may change, with a stable identity and a set of stored field values, attachments, and status.
- **Edit session (conceptual)**: The user’s path from opening edit through saving or abandoning, including which values were loaded and which were changed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing with representative users, at least 90% successfully complete an edit (change at least one field and save) without reporting that they felt they had to "start the form from scratch" or re-enter data they had already provided.
- **SC-002**: For a sample of edited submissions, 100% show pre-filled values matching the last saved stored state for those fields at the moment the edit screen completed loading (excluding intentional clears by the user).
- **SC-003**: Median time to make a single-field correction (open edit, change one field, save) is at least 40% lower than the baseline of re-entering the same field from a blank or default-heavy form, measured in a controlled task.
- **SC-004**: After release, support or feedback volume specifically about "edit loses my data" or "edit feels like a new form" decreases by 50% relative to the prior period (or stays zero in small deployments).
- **SC-005**: Fewer than 2% of completed edit saves result in user-reported "wrong version" or duplicate-submission confusion in a pilot window.

## Assumptions

- "Submission" means the product’s main heritage contribution or entity workflow that already supports create and update on the server side; this feature is primarily about the **editing user experience and loading of existing state**, not the initial definition of the data model.
- Users who may edit are authenticated; authorization (only owner vs staff) follows existing product rules and is not expanded here unless a gap is discovered during planning.
- Pre-fill is driven by the authoritative stored record for that submission; draft autosave, if any, is integrated without contradicting the stored truth at load.
- A first release may deliver production-grade full-form pre-fill first, with in-place/inline patterns phased in, as long as P1 and P2 acceptance criteria are met.
- Optional modules (OCR, imports) that suggest values are out of scope except where their outputs are already stored as part of the submission; those values appear like any other field when present.
