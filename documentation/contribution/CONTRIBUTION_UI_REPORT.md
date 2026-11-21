# HeritageGraph — Contribution UI Report & Functionality Verification

> **Scope:** Every frontend surface involved in contributing, reviewing, and publishing
> heritage knowledge — what each one calls, whether it works against the de-fragmented
> backend pipeline (see [CONTRIBUTION_FLOW.md](CONTRIBUTION_FLOW.md) §9), and the fixes
> applied. Status date: 2026-06-12.
>
> **Verification method:** every flow was exercised against a live dev server
> (`runserver` + `X-Dev-User` header auth) using the **exact payloads the UI sends**,
> plus a full `npm run build` (type check) of the frontend and the backend test suite
> (110 tests). Evidence lines in §2 are captured verbatim from that run.

---

## 1. Inventory — contribution & curation surfaces

### 1a. Contributor-facing

| Surface | Route | File | Backend calls |
|---|---|---|---|
| Contribute hub | `/contribute` | `src/app/(dashboard)/contribute/page-client.tsx` | None (ontology registry via `OntologyProvider`) |
| Per-domain forms (~44) | `/contribute/<domain>` | `src/app/(dashboard)/contribute/<domain>/page.tsx` → `ontology-form.tsx` | `POST {apiEndpoint}` (new) · `GET/PATCH {apiEndpoint}{id}/` (edit) |
| CulturalEntity form | `/contribute/entity[ /edit \| /revise ]` | `src/app/(dashboard)/contribute/entity/*` | `POST /data/api/cultural-entities/` · `PATCH .../{id}/` · `POST .../{id}/create_revision/` |
| My contributions | `/contribute/my-contributions` | `src/app/(dashboard)/contribute/my-contributions/page-client.tsx` | `GET /data/api/cultural-entities/my_contributions/` |
| QR public scan | `/contribute/scan/<id>` (public) | `src/app/contribute/scan/[id]/page.tsx` | entity lookups · `POST /data/api/public-contributions/` (AllowAny) |
| Knowledge edit button | `/knowledge/<domain>/view/<id>` | `src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx` | navigates to `/contribute/<domain>?id=<id>` |

### 1b. Reviewer/curator-facing

| Surface | Route | File | Backend calls |
|---|---|---|---|
| Curation dashboard | `/curation/dashboard` | `curation/dashboard/page.tsx` | `GET /data/api/reviewer-dashboard/` |
| Contribution queue | `/curation/contributions` | `curation/contributions/page.tsx` | `GET /data/contribution-queue/` + `queue-counts/` · `POST .../{id}/moderate` `{action}` |
| Epistemic review queue | `/curation/review` | `curation/review/page.tsx` | `GET /data/api/review-queue/` + `queue_counts/` |
| Review workspace | `/curation/review/<id>` | `curation/review/[id]/page.tsx` | `GET /data/api/review-workspace/{id}/` · `POST .../decide/` (verdict payload) · fork actions |
| QR curation | `/curation/qr-contributions` | `curation/qr-contributions/page.tsx` | `GET /data/api/public-contributions/` + `stats/` · `POST .../{id}/review/` `{status, review_notes, target_type?}` |

### 1c. Status vocabulary used by the UI

- **Wrapper statuses** (My Contributions, queues): `draft`, `pending_review`,
  `pending_revision`, `accepted`, `merged`, `rejected`, `superseded` — matches backend
  raw values; unchanged by the canonical-status work (which translates at the boundary
  and additionally exposes `canonical_status`).
- **QR statuses**: `pending`, `approved`, `rejected`, `incorporated`; serializer now also
  returns `canonical_status` (`approved`/`incorporated` → `accepted`).
- The UI does not yet consume `canonical_status` anywhere (no breakage; see §4).

---

## 2. Functionality verification matrix (evidence from live API run)

| # | Flow (UI payload) | Result | Evidence (captured) |
|---|---|---|---|
| 1 | Submit structured form → `POST /api/v1/cidoc/persons/` | ✅ | `HTTP 201 \| id=84 status=pending_review` |
| 2 | My Contributions list | ✅ | `HTTP 200 \| smoke_status=pending_review canonical=pending_review` |
| 3 | Reviewer accepts via `moderate {action:"accept"}` | ✅ | `HTTP 200 \| Entity accepted successfully`; anon `GET person → status=accepted` |
| 4 | Edit published record (`PATCH`, form payload) | ✅ staged | `HTTP 200 \| response_name=UI-SMOKE Person EDITED` (proposal) |
| 4b | Live row during re-review | ✅ stays published | `GET → status=accepted name=UI-SMOKE Person` (unchanged) |
| 4c | Wrapper requeued for review | ✅ | `wrapper_status=pending_review` |
| 5 | Reviewer **rejects** the staged edit | ✅ content survives | `GET → status=accepted name=UI-SMOKE Person` |
| 6 | Create CulturalEntity (entity form payload) | ✅ | `HTTP 201` (note: create response omits `entity_id`; UI doesn't need it) |
| 6b | **Revise after "changes requested"** (`create_revision` on `pending_revision`) | ✅ **fixed** | was `HTTP 400` (guard allowed only rejected/draft); now `HTTP 201 \| revision_number=2` |
| 7 | Anonymous QR submission (scan-page payload) | ✅ | `HTTP 201 \| id=c428053f…` |
| 7b | QR review `incorporated` + `target_type:"Monument"` | ✅ **new UI** | `HTTP 200 \| promoted_entity_id=3375b05e…` |
| 7c | QR row after promotion | ✅ | `status=incorporated canonical=accepted promoted_entity=3375b05e…` |
| 7d | Invalid `target_type` | ✅ rolls back | `HTTP 400 \| Unknown CIDOC type 'NotAType'.`; row `status=pending` |
| 8 | Legacy `POST /data/submissions/`, `/data/form-submit/` | ✅ retired | `HTTP 410 \| The legacy flat-field submission path is retired…` |
| 8c | Legacy archive remains readable | ✅ | `GET /data/submissions/ → HTTP 200` |

Frontend: `npm run build` (Next.js 15 / Turbopack, includes type check) — **passes**.
Backend: `manage.py test apps` — **110/110 pass** (incl. the new revise regression test).

---

## 3. Findings & fixes applied

### 3.1 ❌→✅ Edit-published flow told the user their edit was live (HIGH)
`ontology-form.tsx` PATCHed a published record, ignored the response, toasted
*"updated successfully!"* and navigated back to the published view. Under staged-revision
semantics the published version (correctly) doesn't change until a reviewer approves —
so the message was wrong and the unchanged page looked like a bug.
**Fix** (`src/components/ontology-form.tsx`): edit mode now branches on the loaded
record's publication state. For published records the toast reads **"edit submitted for
review — the published version stays live until a reviewer approves your changes"** with
a *Track it* action to My Contributions; unpublished records keep the plain
"updated successfully" (those genuinely update in place).

### 3.2 ❌→✅ QR promotion had no UI (HIGH)
The backend's Phase-2 promotion (`target_type` on the review endpoint) was unreachable:
the dialog sent only `{status, review_notes}` and dropped `promoted_entity_id`.
**Fix** (`curation/qr-contributions/page.tsx`):
- "Promote to structured record" select in the review dialog (hidden for *Reject*),
  offering the 12 CIDOC types the backend accepts (`PROMOTION_TARGETS`).
- `target_type` sent when chosen; success toast deep-links to
  `/curation/review/<promoted_entity_id>`; backend `PromotionError` (400) surfaces
  in the dialog.
- `promoted_entity` added to the `PublicContribution` interface; promoted rows show a
  clickable **Promoted** badge.

### 3.3 ❌→✅ "Revise" button 400'd for changes-requested items (MEDIUM, pre-existing)
My Contributions shows *Revise* for `rejected` **and** `pending_revision`, but the
backend `create_revision` guard only allowed `rejected`/`draft` — the
request-changes → revise loop was broken.
**Fix** (`heritage_graph/apps/heritage_data/views.py` `create_revision`): guard widened
to `{rejected, draft, pending_revision}`; regression test
`test_revise_after_changes_requested` added in `apps/cidoc_data/test_pipeline_phases.py`.

### 3.4 ❌→✅ QR quick-action buttons reviewed the wrong row (found during fix 3.2)
The table's quick ✓/✗ buttons did `setSelectedContribution(c); handleReview();` —
`handleReview` read the **previous** `selectedContribution` from state (React batching),
so quick actions hit the wrong contribution or no-oped.
**Fix:** `handleReview(contribution?, action?)` takes explicit arguments; quick buttons
call `handleReview(c, 'approved' | 'rejected')` directly.

### 3.5 Post-review hardening (max-effort code review, 2026-06-12)
A 13-finding review of this work surfaced four issues that were fixed immediately
(regression-tested; suite now 113 tests):
1. **Accept could resurrect a rejected proposal** — `accept_contribution` applied the
   *newest* revision; after a rejected staged edit, an idempotent re-accept would have
   published the rejected content. Now applies `current_revision` (what the reviewer
   actually saw; staging sets it, rejection restores it).
2. **Staged-review toast lied for the `entity` class** — CulturalEntity edits are
   applied in place by the backend; the staged-review messaging is now gated to CIDOC
   endpoints only (`isCulturalEntityEndpoint`).
3. **Wrapper names went stale after accepted renames** — accept now syncs the wrapper's
   `name`/`description` from the applied revision.
4. **Unknown statuses silently published** — `to_canonical_status` now returns
   `UNKNOWN_STATUS` for out-of-vocabulary values; the publication gate withholds them
   (default-deny + warning log), with curator transitions allowed for recovery.
Remaining open findings from that review (DELETE bypasses staging, admin-edit bypass,
promoted-draft edit permission for non-staff reviewers, revision-number race,
registry-driven promotion targets, wrapper-creation dedup) are tracked in §4.

### 3.6 Verified fine — no action needed
- `data:` payload key in the revise form is **correct** (`RevisionCreateSerializer`
  expects `data`); an earlier suspicion of a `form_data:` mismatch was a false positive.
- No frontend code calls the retired `/data/submissions` / `/data/form-submit` writes.
- QR scan-page payload matches `PublicContributionCreateSerializer` exactly.
- My Contributions status mapping matches backend raw values.
- `/contribute/entity/edit` PATCHes the CulturalEntity viewset (unchanged semantics).

---

## 4. Remaining recommendations (out of scope this round)

1. **Adopt `canonical_status`** in UI status checks (My Contributions counts/badges, QR
   filters) instead of hardcoded raw-value lists, via one shared helper.
2. **Shared API types** — `Contribution`, `Revision`, `PublicContribution` interfaces are
   re-declared per page; extract to `src/lib/types/` to keep response-shape changes from
   silently diverging.
3. **Unified review surface** — contribution queue (`/moderate`), review workspace
   (`/decide/`), and QR (`/review/`) are three payload dialects for one decision; fold the
   QR queue into the main review queue once promotion adoption is established
   (CONTRIBUTION_FLOW.md §9, Phase-3 end-state).
4. **Registry-driven promotion targets** — `PROMOTION_TARGETS` is a curated hardcoded
   list; derive it from `/cidoc/schema/registry/` so new ontology classes appear
   automatically.
5. **Return `entity_id` from CulturalEntity create** so the entity form can deep-link to
   the created record instead of navigating to the generic list.
6. **Stage or staff-gate DELETE of published CIDOC rows** — destroy currently bypasses
   the "published content never vanishes without review" invariant.
7. **Move the staging invariant to the model/service layer** so Django admin and
   management commands cannot edit published rows in place.
8. **Promoted-draft edit permission** — promotion sets `contributor="qr:<name>"`, so a
   non-staff promoting reviewer cannot edit the draft they created
   (`CidocObjectEditPermission`); record the reviewer as an editable co-contributor.
9. **Lock revision-number allocation** (`select_for_update` or retry) — concurrent
   staged edits to the same record can race to the same `revision_number` and 500.
