# HeritageGraph — Contribution Flow, Endpoints & De-fragmentation Plan

> **Scope:** How a contribution travels from a form to the knowledge graph, every endpoint
> involved, how it surfaces in "browse by type" pages, the QR-code path, Oxigraph storage —
> and the de-fragmentation plan. Status date: 2026-06-12.
>
> **Update 2026-06-12 — the de-fragmentation plan (§9) is implemented.** Phases 0–4
> landed: accepted-lineage publication (published records never vanish or change during
> re-review), transactional RDF projection (`transaction.on_commit`), a canonical status
> vocabulary with an enforced transition table (`apps/cidoc_data/canonical_status.py`),
> a real ContentType FK replacing the `_cidoc_model`/`_cidoc_id` string back-link
> (still written for compatibility), QR promotion into the structured pipeline, and the
> retirement of the legacy `Submission` write path (read-only archive, 410 on writes).
> Tests: `apps.cidoc_data.test_pipeline_phases` + extended `test_e2e_pipeline`.
> Frontend audit & live verification of every contribution UI surface:
> [CONTRIBUTION_UI_REPORT.md](CONTRIBUTION_UI_REPORT.md).

---

## 0. The headline: four parallel contribution paths

This was the root of the "fragmented" feeling. The paths were built at different times, use
different models and status vocabularies. After de-fragmentation, A/B/C all flow through
the **same accept gate** into the graph; D is a read-only archive.

| Path | Entry (UI) | Backing model(s) | Auto-flows to graph? |
|------|------------|------------------|----------------------|
| **A. Structured CIDOC form** (primary) | `/contribute/<domain>` | `cidoc_data.MetaData` subclasses **+** a `heritage_data.CulturalEntity` wrapper | ✅ on accept |
| **B. CulturalEntity / Revision** | review queue | `CulturalEntity` + `Revision` | ✅ (it *is* A's wrapper) |
| **C. QR public contribution** | `/contribute/scan/<id>` | `heritage_data.PublicContribution` | ✅ promoted on review (`target_type`) → rides Path A |
| **D. Legacy `Submission`** | — (write path retired) | `heritage_data.Submission` | ❌ read-only archive; POST → 410 |

---

## 1. Path A — the primary structured flow (form → graph)

### 1a. Submission (HTTP POST)
The ontology-driven form POSTs to the CIDOC endpoint declared in the registry
(`ontologyClass.apiEndpoint`):

```
POST /api/v1/cidoc/<type>/      # e.g. /api/v1/cidoc/festivals/, /api/v1/cidoc/caste_groups/
```

`ContributionFlowMixin.perform_create` (`apps/cidoc_data/views.py`):
1. **Requires authentication.**
2. Validates the payload against the LinkML **`registry_jsonschema`** for that class.
3. Saves the **CIDOC row**: `contributor=<username>`, **`status="pending_review"`**.
4. Creates a **`CulturalEntity`** wrapper (`status="pending_review"`) — the review-queue item.
5. Creates **`Revision` #1** whose JSON `data` includes the fields **plus `_cidoc_model` and
   `_cidoc_id`** (the back-link to the CIDOC row).
6. Logs an **`Activity`** ("submitted") and fires **`Notification`s** to the contributor and
   every active reviewer.

### 1b. Review / acceptance
A reviewer accepts the `CulturalEntity`. `CulturalEntity.accept_contribution()`
(`apps/heritage_data/models.py`), atomically:
1. Guards the move with the canonical transition table (`IllegalStatusTransition` → 400).
2. `CulturalEntity.status = "accepted"`; `current_revision` **and** `accepted_revision`
   point at the reviewed revision (the head of the accepted lineage).
3. Resolves the CIDOC row via the real FK (`cidoc_content_type`/`cidoc_object_id`;
   the legacy `_cidoc_model`/`_cidoc_id` JSON back-link is a logged fallback that
   heals the FK), **applies the accepted revision's fields to the row**, and sets its
   `status="accepted"`. Every resolution failure logs at ERROR — never silent.

### 1b′. Editing a published record (staged revisions)
`PATCH /api/v1/cidoc/<type>/<id>/` on a published row **never edits it in place**:
- The accepted content stays live in browse **and** in the public graph.
- The proposal is appended as a new `Revision`; the wrapper returns to
  `pending_review` pointing at it (this is what the reviewer sees).
- **Accept** applies the staged revision to the CIDOC row and re-projects it.
- **Reject** restores the wrapper to `accepted`/`accepted_revision`; the row and the
  graph were never touched. (Rejecting a wrapper with *no* pending edit is a curator
  **withdrawal** and unpublishes the row.)

### 1c. Publication to the graph (automatic, signal-driven, transactional)
Saving the CIDOC row → `post_save` → `rdf_signals.queue_entity_projection`
(`apps/cidoc_data/rdf_signals.py`):
- The store write is deferred to **`transaction.on_commit`** — a rolled-back save can
  never leave ghost triples in Oxigraph (deletes capture the IRI before commit).
- Checks **`is_published_for_rdf(instance)`** (see §3).
- **Published** → projects triples (`rdf:type`, `rdfs:label`, slot values, `owl:sameAs`) into the
  Oxigraph **public named graph** via `kg_engine`.
- **Not published** → *removes* the subject from the public graph.

**→ A contribution enters the knowledge graph exactly when a reviewer accepts it.** Until then
it lives only in PostgreSQL.

---

## 2. How it appears in "Browse by type" pages

`/knowledge/<domain>` reads the same CIDOC list endpoint the form posts to:

```
GET /api/v1/cidoc/<type>/        # server-paginated, status tabs
```

Server-side visibility (`apps/cidoc_data/list_visibility.py`):
- **Public default:** only published — `status ∈ {accepted, merged, published}` **or** legacy
  `null`/empty (seed corpus). Pending/rejected never leak.
- **`?status=<x>`** explicit filter (withheld statuses → owner or staff only).
- **`?mine=1`** the contributor's own rows (any status).
- **staff + `?all=1`** the full curation table.

The table defaults to the **"approved"** tab, so a contribution appears in browse **only after
acceptance** — consistent with the graph.

---

## 3. Publication gate & canonical status (single source of truth)

`apps/cidoc_data/canonical_status.py` defines **one** vocabulary; every legacy raw value
maps onto it at the boundary (`to_canonical_status`), and review decisions are guarded
by an explicit transition table (`can_transition`):

```python
CanonicalStatus: draft → pending_review → accepted | rejected   (+ superseded)
# raw → canonical: approved/incorporated/merged/published → accepted,
#                  pending/pending_revision → pending_review,
#                  null/empty → None (legacy curated corpus, published),
#                  anything else → UNKNOWN_STATUS (withheld + logged; default-deny)
```

Serializers expose the unified value as `canonical_status` (CulturalEntity,
PublicContribution) while DB values stay model-specific — no data migration needed.

`apps/cidoc_data/publication_policy.py` derives the gate from the canonical vocabulary
and governs both browse and graph projection:

```python
PUBLISHED_STATUSES = {"accepted", "merged", "published"}   # raw values, for query filters
WITHHELD_STATUSES  = {"pending_review", "draft", "rejected", "pending_revision", "superseded"}
# null/empty status == legacy curated corpus == treated as published
```

---

## 4. Oxigraph storage

- **System of record = PostgreSQL.** Oxigraph stores only the *published* projection.
- Triggers: `post_save`/`post_delete` on every CIDOC `MetaData` model; a `HeritageAssertion`
  `post_save` for relationship **edges**.
- Entity → triples in the **public named graph** (`…/graph/public`).
- Relationship edge: accepted `HeritageAssertion` with `asserted_property="relationship.<P>"` →
  one edge triple, gated by `is_curated_assertion` (excludes test-seed contributors).
- Failures → **`RDFSyncOutbox`** retry. Full reproject: `make rdf-rebuild`.
- Dev uses embedded pyoxigraph; prod uses the HTTP Oxigraph service.

---

## 5. Path C — QR contribution (now promoted into the pipeline)

`PublicContribution` model + `PublicContributionViewSet`:
- **Submit (anonymous):** `POST /api/v1/data/public-contributions/` is **`AllowAny`** — a QR scan
  at a site lets the public send `content`, `contributor_name`, `entity_reference_id`/
  `entity_name`, GPS, `submitted_via="qr_scan"`. UI: `/contribute/scan/<id>`. (Unchanged.)
- Statuses map onto the canonical vocabulary (`approved`/`incorporated` → `accepted`),
  exposed as `canonical_status`.
- **Review:** `POST /api/v1/data/public-contributions/<id>/review/` (reviewer/admin).
  Passing **`target_type`** (a CIDOC model name, e.g. `"Monument"`) with an
  `approved`/`incorporated` decision runs **promotion**
  (`apps/heritage_data/qr_promotion.py`), atomically with the status change:
  1. Creates the **CIDOC row** (`status="pending_review"`, `contributor="qr:<name>"`),
     pre-filled from the note's name/content.
  2. Creates the **`CulturalEntity` wrapper** (FK-linked) + **Revision #1** whose data
     carries full provenance back to the field observation: `_public_contribution_id`,
     `_contributor_name`, `_source` (qr_scan), GPS, `_contributed_at`.
  3. Links `PublicContribution.promoted_entity` → the wrapper and returns
     `promoted_entity_id` in the review response.
  The promoted record then rides the **same accept→publish gate as Path A** — the
  curator verifies/edits in the normal review queue instead of re-entering by hand.
- Curation UI: `/curation/qr-contributions`.

---

## 6. Endpoint reference (contribution-related)

### Structured CIDOC (Path A) — base `/api/v1/cidoc/`
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/cidoc/<type>/` (persons, festivals, caste_groups, monuments, deities, guthis, structures, rituals, …) | GET | Browse-by-type (published default; `?status`,`?mine`,`?all`) |
| `/cidoc/<type>/` | POST | Submit (auth) → `pending_review` |
| `/cidoc/<type>/<id>/` | GET | View one record |
| `/cidoc/<type>/<id>/` | PATCH/PUT | Edit published → resets to `pending_review` |
| `/cidoc/contribute/<type>/` (structures, rituals, deities, guthis) | GET/POST | Assertion-aware variants |
| `/cidoc/assertions/` | GET/POST | Relationship assertions (graph **edges**); `?reconciliation_status=accepted` |
| `/cidoc/schema/registry/` | GET | Ontology registry that drives the forms |
| `/cidoc/kg/stats/`, `/cidoc/kg/neighborhood/`, `/cidoc/kg/query/`, `/cidoc/kg/graph/` | GET/POST | Knowledge-graph read surface |

### Review / queues (Path B) — base `/api/v1/data/`
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/data/cultural-entities/` | GET/POST | CulturalEntity CRUD |
| `/data/contribution-queue/`, `/data/contribution-queue/queue-counts/` | GET | Pending contributions |
| `/data/review-queue/` | GET | Triaged epistemic review queue |
| `/data/review-flags/`, `/data/reviewer-roles/`, `/data/reviewer-roles/assign/` | various | Flags & reviewer roles |
| `/data/revisions/`, `/data/activities/`, `/data/notifications/` | GET | Versions, audit, alerts |

### QR (Path C) — base `/api/v1/data/`
| Endpoint | Method | Permission | Purpose |
|----------|--------|-----------|---------|
| `/data/public-contributions/` | POST | **AllowAny** | Anonymous QR submission |
| `/data/public-contributions/` | GET | reviewer | List queue (`?status=`) |
| `/data/public-contributions/<id>/review/` | POST | reviewer | approve / reject / incorporate; **`target_type` → promote into Path A** (returns `promoted_entity_id`) |

### Legacy / other
`/data/submissions/` (Path D — **read-only archive**; POST/PUT/PATCH/DELETE and
`/data/form-submit/` return **410 Gone**) · `/data/projects/…` (project-based contribution) ·
`/api/v1/document-processing/…` (uploads/ingestion — **OCR currently suspended**).

---

## 7. End-to-end sequence diagrams

### 7a. Path A — structured contribution (the happy path)

```
Contributor        Frontend (form)        Django API                 Postgres                 Signals / kg_engine        Oxigraph
    |                    |                     |                          |                          |                        |
    |  fill form         |                     |                          |                          |                        |
    |───────────────────>|                     |                          |                          |                        |
    |  submit            |  POST /api/v1/cidoc/<type>/                     |                          |                        |
    |                    |────────────────────>| perform_create           |                          |                        |
    |                    |                     |  validate vs registry     |                          |                        |
    |                    |                     |  CIDOC row (pending)──────>| insert MetaData          |                        |
    |                    |                     |  CulturalEntity (pending)─>| insert + Revision#1      |                        |
    |                    |                     |                          |  (_cidoc_model/_cidoc_id)  |                        |
    |                    |                     |  Activity + Notifications─>|                          |                        |
    |                    |  201 Created        |                          | post_save(MetaData)───────>| is_published? NO       |
    |                    |<────────────────────|                          |                          |  -> delete_projection  |  (nothing public)
    |                    |                     |                          |                          |                        |
    |                    |                     |   ... later, a reviewer accepts in /curation ...     |                        |
Reviewer ──── POST accept ───> CulturalEntity.accept_contribution()  (atomic, transition-guarded)    |
    |                    |                     |  status=accepted ────────>| update CulturalEntity    |                        |
    |                    |                     |  resolve CIDOC row via FK |  (+ accepted_revision)    |                        |
    |                    |                     |  apply staged revision ──>|                          |                        |
    |                    |                     |  CIDOC row status=accepted>| update MetaData          |                        |
    |                    |                     |                          | post_save(MetaData)───────>| is_published? YES      |
    |                    |                     |                          |                          |  project triples ──────>| INSERT into graph/public
    |                    |                     |                          |                          |                        |
    |  browse /knowledge/<type>  ── GET /api/v1/cidoc/<type>/ (published) ─> now visible             |  /cidoc/kg/* now returns it
```

### 7b. Path C — QR contribution (promoted into Path A)

```
Public (QR scan)     Frontend /contribute/scan/<id>     Django API                  Postgres
     |                        |                              |                            |
     |  scan + write note     |                              |                            |
     |───────────────────────>|  POST /api/v1/data/public-contributions/ (AllowAny)       |
     |                        |─────────────────────────────>| create PublicContribution──>| insert (status=pending)
     |                        |  201                          |                            |
     |                        |                              |                            |
Reviewer ── POST /public-contributions/<id>/review/ {status, target_type: "Monument"}     |
     |                        |                              | promote_public_contribution (atomic with status change)
     |                        |                              |  CIDOC row (pending_review)─>| insert MetaData
     |                        |                              |  CulturalEntity (FK-linked)─>| insert + Revision#1
     |                        |                              |    (provenance: _public_contribution_id, GPS, _source)
     |                        |                              |  promoted_entity ──────────>| link back to contribution
     |                        |                              |                            |
     |          ... from here it IS Path A: review queue → accept → graph (see 7a) ...
```

---

## 8. Fragmentation issues — status after de-fragmentation

1. **Double write** — ✅ *mitigated (Phase 3a)*: the wrapper now carries a real
   `cidoc_content_type`/`cidoc_object_id` FK (indexed; backfilled by migration
   `heritage_data.0027`); the JSON back-link is still written for compatibility but is
   only a logged, self-healing fallback. A broken link **logs at ERROR** instead of
   silently skipping publication. The two-model double write itself remains (see
   Phase 3 end-state below).
2. **Multiple review surfaces** — ⚠️ *reduced*: legacy `Submission` moderation is gone
   (write path retired); `ContributionQueueViewSet` and `ReviewQueueViewSet` both apply
   the same canonical transition guard. Folding them into one queue is still open.
3. **QR is an island** — ✅ *fixed (Phase 2)*: reviewer promotion (`target_type`)
   creates the CIDOC row + wrapper + provenance revision; QR notes reach the graph
   through the same accept gate.
4. **Status-vocabulary drift** — ✅ *fixed (Phase 1)*: one canonical enum + transition
   table in `apps/cidoc_data/canonical_status.py`; raw values translate at the boundary
   and surface as `canonical_status`.

---

## 9. De-fragmentation plan — implemented 2026-06-12

What landed, by phase (tests: `apps.cidoc_data.test_pipeline_phases`, plus the
extended `apps.cidoc_data.test_e2e_pipeline` / `test_list_visibility`):

### Phase 0 — Correctness (landed first; prerequisites for everything else)
- **Accepted-lineage publication:** editing a published CIDOC record stages the
  proposal as a `Revision` (wrapper → `pending_review`) and **never** touches the live
  row, so accepted content stays in browse and in the public graph during re-review.
  Accept applies the staged revision to the row; reject restores the wrapper to its
  `accepted_revision` (new FK on `CulturalEntity`). Rejecting a wrapper with no
  pending edit = curator **withdrawal** (unpublishes).
- **Transactional projection:** all Oxigraph writes from signals are deferred to
  `transaction.on_commit`; rollbacks can no longer leave ghost triples.
- **No silent failures:** CIDOC-row resolution on accept/reject logs every failure
  mode at ERROR; `perform_create` writes CIDOC row + wrapper + Revision #1 atomically
  (no more orphaned, unreviewable rows); notifications are best-effort only.

### Phase 1 — Canonical status vocabulary ✅
`apps/cidoc_data/canonical_status.py`: `CanonicalStatus` enum, `to_canonical_status()`
boundary mapping (DB values unchanged), `ALLOWED_TRANSITIONS` + `can_transition()`
enforced by `accept_contribution`/`reject_contribution` (`IllegalStatusTransition` →
HTTP 400). Serializers expose `canonical_status`.

### Phase 2 — QR rides the same pipeline ✅
`apps/heritage_data/qr_promotion.py` + `target_type` on the review endpoint (see §5).
Status change and promotion commit atomically; invalid `target_type` rolls back the
whole decision.

### Phase 3a — Real FK replaces the string back-link ✅
`CulturalEntity.cidoc_content_type/cidoc_object_id` (GenericForeignKey, indexed),
set on create/staging/promotion, backfilled from revision JSON (migration 0027),
self-healing when legacy rows resolve via JSON. **End-state (3 final) still open:**
collapse the double write entirely — CIDOC-canonical, with `CulturalEntity`/`Revision`
as a thin review/versioning side-table, one review queue, one accept action; long term,
`HeritageAssertion` (crminf:I2_Belief) becomes the atomic unit of knowledge.

### Phase 4 — Legacy `Submission` write path retired ✅
`SubmissionViewSet` is a read-only archive; POST/PUT/PATCH/DELETE and
`/data/form-submit/` return **410 Gone** pointing at the structured endpoints. The
model/table stay for audit; full deletion can follow once stats/leaderboard consumers
are migrated (see `documentation/TECHNICAL_DEBT.md`).

### Acceptance criteria for "de-fragmented"
- ✅ One status vocabulary across all entry points (`canonical_status`).
- ⚠️ One review queue / one accept action — one accept action (`accept_contribution`,
  guarded) is done; folding `ContributionQueueViewSet` + `ReviewQueueViewSet` into one
  queue surface is the remaining UI/API consolidation.
- ✅ QR submissions reach the graph via the same gate (no manual re-entry).
- ✅ The `_cidoc_model`/`_cidoc_id` string back-link is no longer load-bearing (real FK,
  backfilled + self-healing); it is still *written* for compatibility and can be dropped
  with the Phase-3 end-state.
- ✅ Pipeline tests cover the QR path, edit-during-review, reject-restore, withdrawal,
  and legacy-410 (`apps.cidoc_data.test_pipeline_phases`).
