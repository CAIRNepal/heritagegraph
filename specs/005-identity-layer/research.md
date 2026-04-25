# Research: Identity Layer (Claim-First)

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-25

## R-001 — Storing same-referent membership

**Decision**: Extend `HeritageAssertion` with a nullable **foreign key** `entity_cluster` → `EntityCluster`. For membership rows, set `asserted_property` to a **single stable literal** (e.g. `identity.same_referent`, max 100 chars), keep `content_type` + `object_id` as the **subject entity**, and set `entity_cluster` to the target cluster. Use existing `asserted_value` / `assertion_content` only for optional human-readable notes; do **not** encode the cluster UUID only in `asserted_value` (avoids drift and simplifies queries).

**Rationale**: Matches spec FR-002 (claim-first, provenance on the same row as other assertions). FK gives referential integrity, indexable joins, and clear ORM queries for “all members of cluster C” and “cluster for entity E.”

**Alternatives considered**:

- **Cluster ID only in `asserted_value`**: No FK; easier migration sketch but weak integrity and awkward filtering.
- **Separate `IdentityResolutionAssertion` model**: Clearer domain typing but duplicates provenance/confidence/reconciliation and diverges from spec assumption unless implementation uncovers a hard blocker (e.g. circular import or serializer explosion)—deferred.

---

## R-002 — Merge and split semantics

**Decision**:

- **Merge (source cluster S into target T)**: Require moderator permission. After validation (same `type_scope`, S ≠ T, neither locked unless override), **repoint** every **accepted, non-superseded** membership assertion with `entity_cluster=S` to `entity_cluster=T` **via supersession**: create a new assertion row pointing at T with `supersedes` = old id, mark old row `reconciliation_status=superseded` (or keep old accepted and add parallel policy—prefer **supersede** for audit clarity). Mark S as **retired** with `merged_into` FK → T (retain row for historical FK references). Append **ClusterAuditEvent** with full before/after snapshot.
- **Split**: From cluster T containing entities {E1…En}, moderator chooses split plan (e.g. each entity gets a new singleton cluster). For each entity leaving T: supersede its membership assertion on T and create new accepted membership on a **new** cluster (or pre-created singleton). Retire or keep T depending on remaining members. Always append audit.

**Rationale**: Preserves append-only audit (FR-005, FR-006) and aligns with existing `supersedes` on `HeritageAssertion`.

**Alternatives considered**:

- **In-place UPDATE of assertion.cluster_id**: Loses fine-grained history unless every change is logged separately; supersede chain is clearer for heritage curation.

---

## R-003 — Predicate constant and filtering

**Decision**: Define `IDENTITY_SAME_REFERENT_PROPERTY = "identity.same_referent"` in one module (e.g. `cidoc_data.identity_constants`). All list/detail filters for “membership assertions” use `asserted_property=identity.same_referent` **and** `entity_cluster__isnull=False`. Optional: DB **partial index** on `(asserted_property, entity_cluster_id)` where property equals literal (if DB supports expression indexes; else composite index on columns).

**Rationale**: Keeps predicate discoverable and avoids magic strings across views, serializers, and UI.

---

## R-004 — Permissions mapping

**Decision**:

- **Create / PATCH membership assertions** (including supersede flows initiated by reviewers): `IsAuthenticated` + `IsReviewerOrAdmin` (align with existing `HeritageAssertionViewSet` update rules for reconciliation).
- **Merge, split, lock, unlock, cluster CRUD destructive paths, moderator override on locked cluster**: `IsAuthenticated` + `IsExpertCurator` (maps to “moderator” in spec; staff already allowed in `IsExpertCurator`).

**Rationale**: Matches [heritage_graph/apps/heritage_data/permissions.py](../../heritage_graph/apps/heritage_data/permissions.py) and spec FR-007.

---

## R-005 — Source weighting for competing identities (FR-017)

**Decision**: **v1** — Published **ordinal ranking** of `DataSource.source_type` categories (archival, inscription, published, field_survey, oral_history, web, …) in a single backend module constant `SOURCE_TYPE_CONFLICT_ORDER` (documented in reviewer help). Assertions carrying an inline citation without `DataSource` rank lowest unless reviewer policy says otherwise.

**Rationale**: `DataSource` today has categories but no numeric trust field; satisfies “published tier list” and “adjustable” path later via DB field or admin config without blocking MVP.

**Alternatives considered**:

- **Add `trust_weight` on `DataSource`**: Better long-term; optional follow-up migration after v1.

---

## R-006 — Candidate queue implementation

**Decision**: **Materialized** `IdentityResolutionCandidate` model: `left_content_type`, `left_object_id`, `right_content_type`, `right_object_id`, `signal_scores` JSON, `status` (open/accepted/rejected/deferred), `notes`, `created_at`, `updated_at`, optional `resolved_by`, `resolved_at`. Populate via **management command** `refresh_identity_candidates` (deterministic rules: normalized title similarity, shared neighbors where cheap) plus **on-demand** API trigger for moderators.

**Rationale**: Supports US4 and FR-013 without requiring a real-time graph DB; reuses Django patterns.

---

## R-007 — Optimistic concurrency for merge/split

**Decision**: Add `version` (`PositiveIntegerField`, default 0) on `EntityCluster`; increment on each successful mutating operation; clients send `If-Match` or body field `expected_version`; server rejects with **409** if mismatch.

**Rationale**: Satisfies edge case “reject second merge if cluster changed since load” without long DB locks.

---

## R-008 — Ontology / registry alignment

**Decision**: Add `EntityCluster` class and document the membership predicate in [ontology/HeritageGraph.yaml](../../ontology/HeritageGraph.yaml); extend [heritage_graph/apps/cidoc_data/cidoc_registry_keys.py](../../heritage_graph/apps/cidoc_data/cidoc_registry_keys.py); add `ui-classmap` / contribute-hub entries only if cluster appears in contributor flows in v1 (minimum: reviewer-only might omit hub row—product choice: **include** read-only cluster in registry for consistency). Run `make ontology-check` in CI.

**Rationale**: FR-012 and existing pipeline expectations.

---

## Resolved checklist

| Topic | Status |
| --- | --- |
| Membership storage | Resolved (R-001) |
| Merge/split history | Resolved (R-002) |
| Predicate / query | Resolved (R-003) |
| Permissions | Resolved (R-004) |
| Source tiers | Resolved (R-005) |
| Candidate queue | Resolved (R-006) |
| Concurrency | Resolved (R-007) |
| LinkML / registry | Resolved (R-008) |

No remaining **NEEDS CLARIFICATION** items for planning.
