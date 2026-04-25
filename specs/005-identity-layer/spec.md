# Feature Specification: Identity Layer (Claim-First)

**Feature Branch**: `005-identity-layer`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Claim-first identity layer for HeritageGraph: `EntityCluster` anchors, membership expressed as provenance-bearing assertions (same-referent), derived canonical membership, merge/split audit trail, APIs with reviewer vs moderator permissions, bootstrap of existing entities into singleton clusters, ontology/registry alignment, Identity Resolution Workspace UI (three-panel reviewer flow), knowledge-page canonical label and aliases, and competing-identities presentation when conflicts exist. Grounded in [docs/platform-epistemic-status-2026.md](../../docs/platform-epistemic-status-2026.md) and [docs/platform-next-steps-checklist.md](../../docs/platform-next-steps-checklist.md)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reviewer resolves name variants into one canonical identity (Priority: P1)

A reviewer investigating two heritage records that clearly refer to the same real-world person (for example, full formal name versus a common abbreviation) records an explicit **same-referent** claim linking each entity row to a shared **identity cluster**, with source, confidence, and optional citation. The system forms or joins an **EntityCluster**, preserves provenance, and surfaces the claim in the existing “why we believe” style of evidence so downstream users see *why* the records were unified.

**Why this priority**: Without this slice there is no first-class identity layer; it is the minimum viable path from “many rows, many names” to “one referent, many claims.”

**Independent Test**: Create two person records and one resolution action; verify both records resolve to one cluster in the reviewer workspace and that the membership claim appears as evidence on at least one public knowledge view.

**Acceptance Scenarios**:

1. **Given** two distinct records of the same heritage class and no prior cluster link, **When** a reviewer submits an accepted same-referent claim for each row against a new cluster, **Then** both rows share one cluster and each claim shows source and confidence.
2. **Given** one row already in cluster A and a second row unclustered, **When** the reviewer links the second row to cluster A with an accepted claim, **Then** the second row joins A without losing prior claims on the first row.

---

### User Story 2 - Viewer sees canonical label and aliases (Priority: P2)

A reader opens a heritage entity on a knowledge page. If the entity participates in an identity cluster, they see the **canonical display name** for the cluster, a concise list of **other entity rows treated as aliases** (with their own titles), and a path to open the underlying **membership claims** (same-referent assertions) so trust is visible, not hidden.

**Why this priority**: Anchors only help if the public surface explains *which* name is canonical and *which* alternates are grouped.

**Independent Test**: With Story 1 data in place, open the entity page as an anonymous or signed-in reader and confirm canonical label, alias list, and claim drill-down without using the reviewer workspace.

**Acceptance Scenarios**:

1. **Given** an entity with at least one accepted membership claim to cluster C, **When** a viewer opens the entity knowledge page, **Then** they see C’s canonical label and at least one alias or “no additional aliases” state is explicit.
2. **Given** multiple accepted membership claims with different sources, **When** the viewer expands identity evidence, **Then** they can reach each claim in at most two navigational steps from the main entity summary.

---

### User Story 3 - Moderator splits an incorrectly merged cluster (Priority: P2)

A moderator discovers that two records were merged in error. They **split** the cluster so that each affected entity returns to a distinct cluster (or a documented target layout), prior alias visibility is restored, and an **append-only audit entry** captures who acted, why, and the before/after shape of clusters and affected claims.

**Why this priority**: Identity mistakes are costly; reversibility and audit are non-negotiable for trust.

**Independent Test**: Merge A+B in Story 1, then split; verify entity pages and audit trail reflect the pre-merge layout for a scripted scenario.

**Acceptance Scenarios**:

1. **Given** cluster C containing entities E1 and E2 via accepted claims, **When** a moderator runs an authorized split for C, **Then** each entity ends in a separate cluster (or the split outcome defined in release notes) and no silent deletion of historical claims occurs—supersession or new claims reflect the correction.
2. **Given** a split completes successfully, **When** an auditor inspects the cluster audit log, **Then** they find exactly one new entry for that split with actor, timestamp, reason, and structured before/after payload.

---

### User Story 4 - Reviewer triages an unresolved-identity queue (Priority: P3)

A reviewer opens the **Identity Resolution Workspace**: a queue of **candidate pairs or small groups** produced by rule-based signals (for example, similar titles, shared relationship neighbors, contributor flags). For each item they can **accept** (materialize claims), **reject**, **defer**, or **create a new cluster** without leaving the workspace. Layout follows the established three-panel pattern: **context** (entities and cluster summary), **evidence** (signals and existing assertions), **decision** (actions and required rationale where policy demands it).

**Why this priority**: Scale requires triage; the queue makes Story 1 repeatable at volume.

**Independent Test**: Seed or simulate five candidates; process two accepts and one reject; verify queue counts and resulting clusters/assertions.

**Acceptance Scenarios**:

1. **Given** a populated candidate queue, **When** the reviewer accepts a candidate, **Then** the corresponding membership claims exist in **accepted** state and the item leaves the active queue (or moves to a “resolved” tab).
2. **Given** a candidate the reviewer marks as deferred, **When** they return later, **Then** the item is still available with prior notes intact.

---

### User Story 5 - Moderator locks a canonical cluster (Priority: P3)

A moderator **locks** a cluster whose canonical label is considered settled (for example, after community process). Further merges into that cluster require moderator override; reviewers see a clear **locked** state and cannot complete merge actions without elevated permission.

**Why this priority**: Prevents churn and vandalism on high-profile identities.

**Independent Test**: Lock cluster, attempt merge as reviewer (blocked), complete merge as moderator (allowed), verify audit.

**Acceptance Scenarios**:

1. **Given** cluster C is locked, **When** a reviewer attempts to merge another entity into C, **Then** the action is refused with an explanation referencing lock policy.
2. **Given** cluster C is locked, **When** a moderator performs an allowed override merge, **Then** an audit entry records lock override explicitly.

---

### User Story 6 - Competing identities surfaced clearly (Priority: P3)

When two **accepted** membership claims would place the same entity in conflicting cluster memberships, or when two clusters both claim overlapping evidence in a way the product marks as conflict, the UI shows a **competing identities** view: grouped alternatives, each with sources and confidence, ordered by a documented **source-weighting** policy so reviewers and readers understand disagreement—not a single silent winner.

**Why this priority**: Matches the platform’s claims-first epistemology; avoids false certainty.

**Independent Test**: Create conflicting accepted claims in a test dataset; open entity page and workspace; verify both sides visible and policy-labeled.

**Acceptance Scenarios**:

1. **Given** conflicting active accepted claims for one entity’s cluster membership, **When** a viewer opens the knowledge page, **Then** they see a competing-identities section instead of a single canonical line until a moderator resolves per policy.
2. **Given** the same conflict, **When** a reviewer opens the workspace, **Then** the conflict appears in the queue or a dedicated conflicts tab with both cluster candidates listed.

---

### Edge Cases

- **Locked cluster**: Merge or label change attempts by non-moderators are refused; moderator overrides are audited.
- **Superseded claims**: Only non-superseded, accepted claims participate in derived membership; superseded chains remain visible for history.
- **Withdrawn or disputed claims**: Disputed claims do not establish canonical membership; UI shows dispute state where relevant.
- **Bootstrap re-run**: Running the one-time bootstrap process twice does not duplicate clusters or orphan entities.
- **Cross-class linkage attempt**: Linking a `Person` row to a cluster scoped to `Place` (or mixed-type cluster) is rejected with a clear validation message (v1: clusters are single–heritage-class scope).
- **Empty or single-entity cluster**: After split, singleton clusters remain valid; canonical label rules still apply.
- **Concurrent merges**: Last-writer-wins is insufficient; system defines deterministic conflict behavior (e.g., reject second merge if cluster changed since load) and surfaces it to the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an **EntityCluster** record representing a stable identity anchor with a human-readable **canonical label**, a **type scope** identifying which heritage class the cluster applies to (one class per cluster in v1), optional notes, created/updated timestamps, and a **locked** flag modifiable only by moderators.
- **FR-002**: The system MUST represent **membership of an entity in a cluster** only through **assertions**: each membership is a claim that a specific entity row **has the same real-world referent as** the cluster (same-referent membership), carrying **source**, **confidence**, **citation**, **contributor attribution**, **reconciliation status**, and optional **supersedes** linkage to a prior membership claim, using the **same confidence and reconciliation labels** as other heritage claims in the product.
- **FR-003**: The system MUST **derive** each entity’s **current cluster membership** from assertions that are **accepted**, **not superseded**, and **not in a terminal withdrawn state** defined in release documentation; if multiple competing such claims exist, the system enters the competing-identities state of FR-016 instead of silently picking a winner.
- **FR-004**: The system MUST define a **published tie-break** when multiple acceptable claims exist without logical conflict (for example: prefer highest editorial tier, then newest accepted moderator action); tie-break rules MUST appear in reviewer help copy.
- **FR-005**: The system MUST persist an **append-only ClusterAuditEvent** (or equivalent name) for merge, split, lock, unlock, and moderator override actions, storing actor identity, timestamp, action type, free-text **reason** when required by policy, machine-readable **before** and **after** snapshots, and references to affected cluster IDs and affected assertion IDs.
- **FR-006**: The system MUST NOT allow update or delete of audit events through standard APIs (append-only).
- **FR-007**: Reviewers MUST be able to create, supersede, and reconcile **membership assertions** for entities within their scope; moderators MUST be able to merge clusters, split clusters, lock, unlock, and override locks where policy allows.
- **FR-008**: The system MUST expose a **read API** for cluster metadata, derived members of a cluster, derived cluster for an entity, and filtered lists of membership assertions (including filters by entity, cluster, class scope, and reconciliation status).
- **FR-009**: The system MUST expose **commands** (via the same API surface as other write operations) for **merge cluster**, **split cluster**, **lock**, **unlock**, each validating permissions, cluster class scope, and lock state before committing.
- **FR-010**: On first rollout, the system MUST run an **idempotent bootstrap** that creates exactly one cluster per existing heritage entity row (within supported classes) and one **accepted** foundational membership assertion per row, without deleting or rewriting existing entity display fields.
- **FR-011**: After bootstrap, a **health report** MUST show zero supported-class entities lacking an active derived cluster membership (runbook defines the query).
- **FR-012**: The public **heritage ontology** artifact used for contributor and generated forms MUST include **EntityCluster** and the **same-referent membership** predicate semantics so labels, help text, and validation stay aligned with how clusters and membership claims are stored and validated in the live system.
- **FR-013**: The **Identity Resolution Workspace** MUST list candidate identity pairs or groups from **rule-based signals** only in v1 (similar titles, shared neighbors, contributor flags); it MUST support accept, reject, defer, and create-new-cluster flows.
- **FR-014**: The workspace MUST use a **three-panel** layout: context, evidence, decision—consistent with the existing curation review experience (same information architecture expectations: left context, center evidence, right actions).
- **FR-015**: Knowledge pages for clustered entities MUST show **canonical cluster label**, **alias entities**, and **drill-down to membership claims** as in User Story 2.
- **FR-016**: The system MUST surface **competing identities** per User Story 6 whenever competing accepted active claims exist for the same entity’s cluster membership.
- **FR-017**: Source-weighted ordering for competing views MUST use an explicit **tier list** (for example: inscriptions and archival registers above unsourced community notes) published to reviewers; weights MUST be adjustable without code change where the product already stores such tiers for sources.
- **FR-018**: All successful **merge** and **split** operations MUST produce **at least one** audit event satisfying FR-005 and FR-006 (100% coverage of those operations).

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new env vars MUST be added to `.env.example`.
- **C-002**: Frontend network calls MUST use `process.env.NEXT_PUBLIC_*` configuration (no hardcoded localhost URLs).
- **C-003**: Protected API calls MUST use `Authorization: Bearer <accessToken>` sourced from NextAuth session.
- **C-004**: The implementation MUST remain compatible with repository quality gates (ruff for Python; TS build/typecheck for frontend) for touched code.

### Key Entities *(include if feature involves data)*

- **EntityCluster**: Identity anchor; canonical label; type scope (single heritage class); lock; notes; timestamps; no authoritative inline member list—membership is always derived from assertions.
- **SameReferentMembership (assertion view)**: Assertion record whose subject is a concrete entity row and whose predicate is the fixed same-referent membership type, pointing at a cluster; includes provenance, confidence, reconciliation, supersession chain.
- **ClusterAuditEvent**: Append-only log of merge, split, lock, unlock, override; structured before/after payloads.
- **CandidateIdentityGroup**: Ephemeral or materialized queue item representing suggested duplicate resolution work; stores signal scores and status (open, accepted, rejected, deferred).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing with trained reviewers, **median** time to complete a standard two-entity merge (open workspace → submit → verify) is **under 3 minutes** for scripted fixtures.
- **SC-002**: On entity pages with two or more active membership claims, **100%** of test users in moderated sessions reach an individual claim within **two clicks** from the identity summary (success threshold: ≥90% of participants without moderator hint).
- **SC-003**: **100%** of successful merge and split operations in integration tests leave a corresponding **audit record** retrievable in one query.
- **SC-004**: For a documented **split round-trip** scenario (merge then split), entity-level alias visibility matches the pre-merge baseline **with zero manual database repair** in automated tests.
- **SC-005**: After bootstrap, automated health checks report **zero** missing active memberships for entities in supported classes.
- **SC-006**: Identity-related schema changes cannot ship unless they pass the **same automated registry consistency checks** already required for other ontology-driven heritage forms (no regressions; new classes appear in contributor-facing registry).
- **SC-007**: On a curated **gold set** of at least 20 conflicting identity fixtures, the competing-identities view presents both sides distinctly in **≥95%** of cases (human labeling pass/fail).

## Assumptions

- **Single-class clusters in v1**: A cluster never mixes, for example, a `Person` and a `Place`; cross-class “same referent” is out of scope.
- **Membership is stored as structured heritage claims** compatible with the platform’s existing claim records (confidence levels, reconciliation states, source linkage, supersession). A separate dedicated storage shape for membership-only rows is out of scope unless planning discovers a hard constraint.
- **Roles**: “Reviewer” maps to users who may create or reconcile membership assertions under existing reviewer-or-admin rules; “Moderator” maps to expert curator (or equivalent) plus staff for merge, split, lock, and override.
- **Candidate generation** is rule-based only; machine-learned entity linking is explicitly out of scope for v1.
- **UI stack** reuses the project’s established dashboard patterns and component library; no redesign of global navigation is required beyond adding entry points to the new workspace.
- **Contribution fork lineage** (`CulturalEntity` forks) remains orthogonal; this feature does not redefine fork merge semantics.
- **Geospatial or date-type upgrades** (PostGIS, EDTF) are unrelated and out of scope.
- **Dependencies**: Existing assertion listing on knowledge pages, review dashboard authentication, and source tier metadata (where already modeled) are leveraged rather than reinvented.
