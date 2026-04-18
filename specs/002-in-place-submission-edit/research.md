# Research: In-place submission edit (pre-filled contribute flow)

**Feature**: `specs/002-in-place-submission-edit/spec.md`  
**Plan**: `specs/002-in-place-submission-edit/plan.md`  
**Date**: 2026-04-18

## R-001 — Load source of truth for the edit form

**Decision:** When the contribute route is opened in **edit mode**, load the record with **GET** to the same **detail URL** the view page uses: `{NEXT_PUBLIC_API_URL}{ontologyClass.apiEndpoint}{id}/` with `Accept: application/json` and **Bearer** on the session when available.

**Rationale:** The view page already uses this as the source of display truth (`page-client.tsx` in `knowledge/[domain]/view/[id]/`). Reusing it guarantees **parity** between what the user saw and what they edit (satisfies FR-001, FR-003, SC-002). Avoids large JSON in query strings and avoids duplicating “guess the endpoint” logic.

**Alternatives considered:**
- **URL-encoded JSON** (as in `contribute/entity/edit`) for ontology pages — *rejected* for primary path: size limits, refresh fragility, and desync if data changed server-side.
- **Dedicated “edit DTO” endpoint** — *deferred* unless serializer read/write divergence forces it (YAGNI).

## R-002 — URL and routing: how the contribute page knows the record id

**Decision:** Use **one** of these (pick one in implementation, document in AGENTS when fixed):

- **A (recommended):** `router.push(\`/contribute/${ontologyClass.key}?id=${id}\`)` from the view page, and have `OntologyForm` read `useSearchParams().get("id")`.
- **B:** Dynamic segment `contribute/[domain]/[id]/edit` — *more RESTful* but requires new route files for each domain or a catch-all layout.

**Rationale:** A query parameter requires minimal route churn: existing `contribute/person/page.tsx` wrappers stay as thin `OntologyForm` hosts; only the form and the **Edit** link change.

**Alternatives considered:** Path-only `contribute/person?...` is already a single page; nested dynamic routes add boilerplate for ~20 domains.

## R-003 — Create vs update HTTP method

**Decision:** **POST** for **new** submissions; **PATCH** (preferred) for **partial** updates, **PUT** only if a given serializer requires full body.

**Rationale:** DRF `ModelViewSet` exposes `partial_update` via PATCH; the form can send the same field set as create (or only dirty fields, if optimized later). Matches user expectation of “saving” without recreating a row.

**Alternatives considered:** “Submit again with POST to a duplicate endpoint” — *rejected*; that produces duplicate review queue items / entities.

## R-004 — Authorization for PATCH (and DELETE)

**Decision:** Implement **`IsAuthenticated`** for `update`, `partial_update`, and `destroy` on CIDOC `ContributionFlowMixin` viewsets, plus an **object-level** permission: allow if `request.user.username` matches the instance’s `contributor` (and optionally staff/superuser). For **create**, keep `IsAuthenticated`. For **read**, keep public read as today unless product requires private drafts (out of spec scope).

**Rationale:** Today `get_permissions` returns `AllowAny()` for non-create actions (`cidoc_data/views.py`), which is **not** production-appropriate for editing once the UI exposes edit. Tightening permissions is a **prerequisite** for a trustworthy edit feature, not an optional hardening.

**Alternatives considered:**
- **AllowAny** + only UI hides Edit — *rejected*: API remains abusable.
- **Duplicate** permission classes per viewset — *rejected*: use a shared `CIDOCObjectEditorPermission` or DRF 3.14+ style hooks once to avoid drift.

## R-005 — Legacy `Submission` / `form-submit` and heritage table

**Decision:** This plan **focuses** on the **ontology-driven OIDOC contribute** path (`OntologyForm` + knowledge view). Legacy **`SubmissionViewSet` / `SubmissionDetailView`**, if their “Edit” affordances are similarly broken, should be a **follow-up task** once verified in UI; map fields from `GET /data/.../submissions/:id/` similarly.

**Rationale:** The user-reported “Edit from knowledge view” is implemented in the ontology view client; the spec’s “submission” language maps to “contribution record” broadly—implementation prioritizes the broken link we can trace in code.

**Alternatives considered:** One mega-PR for all forms — *rejected*: scope control; same patterns apply to legacy when prioritized.

## R-006 — P3 true “in-line” / text-on-view edit

**Decision:** **Defer** to a later iteration: implement shared **`useOntologyRecord(ontologyClass, id)`** and **`submitOntologyPatch`** helpers first. Inline controls on the view page can call the same functions without forking data rules.

**Rationale:** P1/P2 in the spec are about **pre-fill** and **save semantics**; inline UX is an additive shell.

**Alternatives considered:** Build inline first — *rejected*: double implementation risk before the core load/save path is stable.

## R-007 — Concurrent edits (spec edge case)

**Decision:** **MVP: last write wins** with a **post-save** confirmation toast. **Stretch:** return `ETag` / `updated_at` and send `If-Match` on PATCH; on **412** show “Record changed—reload or overwrite.”

**Rationale:** Matches low-effort, predictable behavior; can upgrade without changing the public UI contract of “edit and save.”

**Alternatives considered:** Operational transform / locking — *out of scope* for v1.
