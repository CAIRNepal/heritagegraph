# Phase 0 — Research: Reviewer triage and schema extension approval

**Feature**: [spec.md](./spec.md) · **Date**: 2026-04-25

## R-001 — Composite triage formula (deterministic)

**Decision**: Implement triage as a **weighted linear score** on normalized components, all computed server-side:

- `age_norm` = min(1.0, days_in_review / S_max) where `S_max` is operator-config (default 30).
- `flags_norm` = min(1.0, unresolved_flag_count / F_max) (default F_max = 10).
- `conflict_boost` = 1.0 if any unresolved `contradiction` flag else 0.0 (applied as multiplicative or additive per weights table in config).
- `source_penalty` = 1.0 - (tier_index / (T-1)) with tiers 0..T-1 from worst..best, or 0 when unknown.

**Formula (default)**:  
`raw = w_age*age_norm + w_flags*flags_norm + w_conflict*conflict_boost + w_source*source_penalty`  
Expose `triage_priority = round(raw * 1000)` for stable integer sort + `triage_breakdown` object with each term and applied weights.

**Rationale**: Matches spec FR-001–FR-003 and FR-015; easy to test; avoids ML.

**Alternatives considered**: ML ranker (rejected: no training data, not spec’d); manual priority field on entity (rejected: stale, extra moderator work).

---

## R-002 — Source trust tier for `CulturalEntity` queue items

**Decision (v1)**: Derive tier from **`HeritageAssertion`** rows whose subject is this `CulturalEntity` (generic FK / asserted subject pattern used in `cidoc_data`), aggregating linked **`DataSource.source_type`** → tier rank per spec assumption (inscription best … web worst). Use **worst (minimum tier)** among cited sources as conservative triage. If no assertions with sources exist, emit **unknown** (lowest tier + UI label).

**Rationale**: Aligns with epistemic model (“claims with sources”) without parsing arbitrary revision JSON shapes per category.

**Alternatives considered**: Parse `Revision.data` for embedded source ids (rejected for v1: inconsistent keys across categories); contributor self-reported tier only (rejected: gameable).

---

## R-003 — Filter / sort / `queue_type` precedence

**Decision**: Apply filters in order: base status filter (`pending_review` / `pending_revision`) → `queue_type` tab (existing semantics) → **new** query filters (`min_triage`, `stale_days`, `max_trust_tier_rank`, etc.) → `my_domain=true` → search. Sorting: default **`-triage_priority`** when `ordering=triage_priority`; retain existing `ordering=created_at|updated_at` with explicit `ordering` param.

**Rationale**: FR-016 requires documented precedence; tab-first preserves current UX mental model.

**Alternatives considered**: Client-only sort (rejected: breaks pagination and consistency).

---

## R-004 — Shareable view state without PII

**Decision**: Encode **only** filter/sort/tab params in URL query string (e.g. `queue_type`, `ordering`, `stale_days`, `my_domain`). Do **not** put contributor name, free-text search, or PII in mandatory share links; if `search` is active, “Copy link” either omits search or uses a server-issued opaque **view id** (optional Phase 2 — v1: omit search from share or show warning).

**Rationale**: FR-008 privacy; simplest v1 is query-only for non-sensitive params.

---

## R-005 — Moderator authorization

**Decision**: Reuse Django **`Moderators`** group (already used in UI `use-user-roles.ts`). DRF permission: `IsAuthenticated` + user in `Moderators` or `is_staff` for approve/reject/publish; authors use `IsAuthenticated` + `Contributors` or `Reviewers` for create/submit as per product policy (default: any authenticated staff-excluded contributor path — align with existing contribution permissions).

**Rationale**: Spec assumption; minimal new security surface.

**Alternatives considered**: New `schema_moderator` flag (deferred).

---

## R-006 — Publish: extension file vs registry merge

**Decision**: On **publish**, write approved LinkML YAML to **`HERITAGEGRAPH_SCHEMA_EXTENSION_PATH`** (atomic replace: temp file + rename). Invalidate **`linkml_loader`** in-process cache. Record **`schema_version`** / **`extension_hash`** from the next successful `build_fresh_payload()` in audit + proposal row.

**Gap acknowledged**: `build_registry_document(schema_path)` today builds from **core YAML only**; extension file is hashed in `compute_schema_version` but may **not** be merged into `classes`/`enums` in the live registry payload. **Implementation must** either (a) extend `ontology_builder` to load and merge extension LinkML via `SchemaView` merge pattern, or (b) materialize a **pre-merged** ephemeral YAML for builder (ops script). **(a)** preferred for single source of truth.

**Rationale**: Spec promises published extensions affect forms/validation; without merge, only hash changes.

**Alternatives considered**: Manual `make ontology` only (rejected: violates “under 2 minutes” moderator story without CI coupling).

---

## R-007 — Proposal conflict detection

**Decision**: On submit/publish, parse proposed LinkML (or JSON patch to schema) and compute **affected slot keys**; block publish if another **submitted** proposal shares any key; warn on **draft** collision.

**Rationale**: Spec edge case “conflicting proposals”.

---

## R-008 — Triage config storage

**Decision**: Store operator-tunable weights + `S_max` + `F_max` + tier order in **`TriagePolicy` singleton model** (one row) or `django-constance` if already in project; else JSON file under settings with validation on load. **Prefer DB table** for audit (“who changed weights when”).

**Rationale**: FR-015 without redeploy; audit trail for policy changes.

**Alternatives considered**: Hardcoded constants only (rejected: fails FR-015).

---

## R-009 — UI surfaces

**Decision**: Extend **`curation/review/page.tsx`** for sort controls, filter chips, triage badges, URL sync; add **`curation/schema-extensions/`** list + detail for proposals; optional breakdown strip on **`curation/review/[id]/page.tsx`**.

**Rationale**: Matches existing curation IA; `/moderate` placeholder not used.

---

## Consolidation

All items that could have been “NEEDS CLARIFICATION” in Technical Context are resolved above. No blocking unknowns remain for Phase 1 artifacts.
