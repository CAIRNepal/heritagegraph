# Feature Specification: Reviewer triage and schema extension approval

**Feature Branch**: `006-reviewer-triage-and-approval`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "P1 Reviewer Triage and Schema Extension Approval — from platform next-steps checklist (P0-independent slice): composite reviewer triage scoring (age, conflicts, source tier, flags) with queue sort/filter UX; moderator-only schema extension proposal, review, approval, publish, and audit; expose My Domain and sort controls. Grounded in [docs/platform-next-steps-checklist.md](../../docs/platform-next-steps-checklist.md) and [docs/platform-epistemic-status-2026.md](../../docs/platform-epistemic-status-2026.md)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reviewer sees a prioritized review queue (Priority: P1)

A reviewer opens the main review queue for contributions awaiting review. Each row shows a **composite triage priority** (higher means “address sooner”) together with **plain-language badges** for how long the item has waited, how many unresolved flags apply, whether contradictions are flagged, and the **trust tier** of the strongest cited evidence attached to that contribution (or “unknown” when evidence is missing).

The reviewer can switch the queue to **sort by triage priority** (default), by oldest-first, or by most recently updated. They can apply **filters**: only items with open contradictions, only items stale beyond a configured day threshold, only items whose primary cited sources are below a configured trust tier, and **only items in my domain of expertise** (when their profile lists expertise areas).

**Why this priority**: Reviewer throughput and fairness depend on surfacing risk and age; without a shared priority signal, high-risk or stale work can sit behind noisy low-risk queues.

**Independent Test**: A reviewer with no other features enabled can open the queue, confirm ordering and badges match documented rules on a fixed fixture set, and confirm filters narrow the list as expected.

**Acceptance Scenarios**:

1. **Given** a queue with at least one item with open contradiction flags and one without, **When** the reviewer enables the “contradictions only” filter, **Then** only items with open contradiction flags appear.
2. **Given** a queue with items of different ages and flag counts, **When** the reviewer sorts by triage priority, **Then** the displayed priority order matches the documented deterministic formula for the same inputs (same inputs always produce the same order).
3. **Given** a domain expert with expertise areas configured, **When** they enable “My domain only”, **Then** only contributions whose category or declared domain overlaps their expertise areas appear (and when none overlap, the list is empty with a clear explanation).

---

### User Story 2 - Moderator approves or rejects a schema extension before it affects production (Priority: P1)

A contributor or reviewer **drafts** a schema extension (for example: add a slot, add an enum value, or add a small class) and **submits** it for review. The proposal enters a **submitted** state visible in a moderator-facing list.

A moderator opens a proposal and sees a **human-readable summary of changes** against the current production schema (what classes/slots/enums change, what breaks for existing records if applicable). They **approve** or **reject** with a required short rationale. On **approve**, the system **publishes** the extension so that generated schema artifacts used by forms and validation reflect the new version, and records **who approved, when, and which schema version** resulted. On **reject**, production schema is unchanged and the author is notified with the rationale.

Non-moderators can draft and submit proposals but **cannot** approve, reject, or publish.

**Why this priority**: Uncontrolled schema drift breaks trust and tooling; a gated path aligns with the platform’s claims-first and registry-driven intent without requiring ad-hoc file edits on servers.

**Independent Test**: With two accounts (moderator and non-moderator), verify that only the moderator can move a proposal from submitted to approved/published, and that every transition leaves an audit entry.

**Acceptance Scenarios**:

1. **Given** a logged-in user who is not in the moderator role, **When** they attempt to approve a submitted proposal, **Then** the action is denied and production schema remains unchanged.
2. **Given** a submitted proposal and a logged-in moderator, **When** the moderator rejects with a comment, **Then** the proposal shows rejected status, the comment is stored, no new production schema version is linked to that proposal, and the author can see the outcome.
3. **Given** a submitted proposal and a logged-in moderator, **When** the moderator approves with a comment, **Then** the proposal moves to approved then published, a new production schema version identifier is recorded on the proposal, and an audit entry captures moderator, timestamp, and outcome.

---

### User Story 3 - Reviewer shares a filtered, sorted queue view with a colleague (Priority: P2)

A reviewer adjusts filters, sort, and optional “My domain” mode so the queue reflects how they are triaging today. They copy an **application-generated share link** and a colleague opening it sees the **same filter and sort interpretation** (permissions permitting), so triage conversations align on the same slice of work.

**Why this priority**: Review is often collaborative; shareable state reduces back-and-forth and mistakes about “which tab are you on?”.

**Independent Test**: Two reviewers open the same shared link; both see the same filter/sort semantics; items they are not allowed to see remain hidden per access rules.

**Acceptance Scenarios**:

1. **Given** a reviewer has set filters and sort, **When** they copy the share link and open it in a fresh session (still authenticated), **Then** the queue restores the same filter and sort selections.
2. **Given** a shared link includes “My domain only”, **When** a different reviewer opens it, **Then** the filter applies to **their** expertise areas (not the original author’s), and the UI states this clearly to avoid confusion.

---

### Edge Cases

- **No reviewer profile**: “My domain only” is disabled or shows guidance to complete expertise areas first.
- **Missing or incomplete evidence**: Source tier shows “unknown” or lowest tier; triage still computes from age and flags without blocking the row.
- **Ties in priority**: Deterministic tie-breaker (for example: higher flag count, then older `created_at`, then stable record identifier) so order never flickers between refreshes.
- **Conflicting proposals**: Two submitted proposals touching the same slot; moderators see a warning and cannot publish the second until the first is withdrawn, rejected, or superseded by a revised proposal.
- **Stale submitted proposal**: After a long idle period, the moderator UI warns that the base schema may have changed and prompts re-validation or withdraw before approve.
- **Emergency rollback**: Operators can mark a published extension as **reverted** in audit (separate from day-to-day approve/reject); product policy defines who may invoke rollback (documented as moderator-only unless org policy assigns platform admin).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compute and expose a **composite triage priority** for each contribution in the review queue, combining at minimum: time waiting for review, count of unresolved review flags, presence of open contradiction-type flags, and **source trust tier** derived from cited sources attached to the contribution.
- **FR-002**: The system MUST expose a **breakdown** of the composite score (which factors contributed and their relative weights) to reviewers and moderators in the queue and on the review detail view, using plain language labels.
- **FR-003**: The triage formula MUST be **deterministic**: identical inputs for a contribution at a point in time yield the same priority and breakdown.
- **FR-004**: The platform MUST define an ordered **source trust tier mapping** from existing source categories to tiers (highest to lowest), maintained in a single configurable policy; the UI MUST show the tier name, not only the raw category.
- **FR-005**: Reviewers MUST be able to **sort** the queue by triage priority (default), oldest waiting first, and most recently updated first.
- **FR-006**: Reviewers MUST be able to **filter** the queue by: open contradictions only; stale beyond N days (N configurable by operators); low trust tier at or below a chosen threshold; existing queue slices (e.g. all / conflicts / flagged) where already present.
- **FR-007**: Domain experts MUST be able to enable **“My domain only”** so the queue restricts to contributions matching their configured expertise areas; the UI MUST explain what “my domain” means and when it is unavailable.
- **FR-008**: Filter and sort selections MUST be **restorable from a shareable view reference** generated by the application, without embedding private contributor payload in that reference.
- **FR-009**: Users without the moderator role MUST NOT be able to approve, reject, or publish schema extension proposals.
- **FR-010**: Users with appropriate author permissions MUST be able to **create** and **submit** schema extension proposals; moderators MUST be able to **approve**, **reject**, and **publish**; authors MUST be able to **withdraw** drafts and, while policy allows, **withdraw** a submitted proposal before any moderator decision.
- **FR-011**: Every state change on a schema extension proposal (draft → submitted → approved/rejected → published, plus withdraw) MUST append an **immutable audit entry** with actor, timestamp, prior state, new state, and optional comment where policy requires comments.
- **FR-012**: On publish, the system MUST associate the proposal with a **production schema version identifier** and retain a permanent link between that identifier and the approved change set for traceability.
- **FR-013**: The moderator review screen MUST show a **change summary** understandable without reading raw schema source (classes/slots/enums affected, cardinality or value changes, and compatibility notes).
- **FR-014**: The system MUST block publish when automated checks detect **fatal conflicts** with the current production schema (for example duplicate slot keys or illegal removals) and MUST surface actionable errors to the moderator and author.
- **FR-015**: Operators MUST be able to adjust triage **weights** and stale-day threshold without code changes (configuration or admin UI), within safe bounds documented for moderators.
- **FR-016**: The review queue MUST continue to support existing tab semantics (e.g. all vs conflicts) **in combination** with the new filters without ambiguous precedence; documented precedence resolves combinations.

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new env vars MUST be added to `.env.example`.
- **C-002**: Frontend network calls MUST use `process.env.NEXT_PUBLIC_*` configuration (no hardcoded localhost URLs).
- **C-003**: Protected API calls MUST use `Authorization: Bearer <accessToken>` sourced from NextAuth session.
- **C-004**: The implementation MUST remain compatible with repository quality gates (ruff for Python; TS build/typecheck for frontend) for touched code.

### Key Entities *(include if feature involves data)*

- **Contribution queue item**: A contribution awaiting review; attributes relevant to triage include time waiting, category/domain, unresolved flags, contradiction flags, and linked sources for trust tier inference.
- **Triage score breakdown**: Derived explanation of the composite priority: normalized age component, flag and contradiction components, source tier component, applied weights, and tie-breaker keys used for ordering.
- **Source trust policy**: Ordered mapping from source category labels to trust tiers; operator-tunable with audit when changed.
- **Schema extension proposal**: Title, description, author, proposed change set against a known base schema version, status (draft, submitted, approved, rejected, published, withdrawn), moderator decision comment when required, linked published schema version when applicable.
- **Schema extension audit entry**: Immutable log row for proposal transitions including actor, timestamps, from-status, to-status, optional comment, and optional link to resulting schema version identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a controlled evaluation with a labeled set of 50 queue items, **at least 90%** of items rated “must review this week” by a moderator appear in the **top 10** when sorted by triage priority, compared to the platform’s **previous default queue ordering** before this feature ships.
- **SC-002**: For items with open contradiction flags, **median time from entering the queue to first reviewer action** improves by **30%** over a four-week baseline period after launch (same staffing levels).
- **SC-003**: **100%** of production schema extensions shipped during a release window are traceable to an **approved and published** proposal with a linked schema version identifier (zero undocumented production-only schema edits in that window).
- **SC-004**: Moderators report **at least 80%** agreement on a 5-point usefulness scale that the proposal diff summary is “clear enough to decide without reading raw schema alone” (survey after first month).
- **SC-005**: For a typical small extension (single slot or enum addition), moderators complete **approve-to-published** in **under 2 minutes** of active work in usability tests (excluding author wait time).

## Assumptions

- **Source categories** map to trust tiers in this default order (highest to lowest): inscription; archival; published; field survey; oral history; web. Items with no mapped source use the lowest tier for triage purposes and are labeled “unknown” in the UI.
- **Composite priority** is a weighted sum of normalized components (age, unresolved flag count, contradiction presence, inverse trust tier); default weights favor contradictions and age slightly over raw flag volume; operators can tune weights within documented min/max.
- **Moderator role** aligns with the existing **Moderators** group used in the product today; reviewers remain distinct from moderators for approval actions.
- **Publishing** writes through the platform’s existing operator-configured extension mechanism so generated schema artifacts and validation stay aligned; rollback is rare and operator-governed.
- **Identity layer** (entity clusters, merge/split) is out of scope for this feature; triage applies to the existing contribution review queue only.
- **“My domain”** uses the same notion of expertise areas already associated with reviewer profiles where available.

## Dependencies

- Existing contribution review queue and review workspace (list + per-item review).
- Existing role separation between reviewers and moderators.
- Existing optional schema extension path used for versioning and registry generation in operations.

## Out of Scope

- Identity resolution workspace, locking canonical identity clusters, duplicate-cluster prevention (depends on the identity-layer program).
- Competing-truth or multi-cluster narrative UI.
- Contributor hub navigation reframe (Describe / Record / Claim / Verify) and global basic/advanced mode.
- Automated generation of serializers from LinkML (separate tooling initiative).
