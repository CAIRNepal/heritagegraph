# Feature Specification: Entity & Relationship Contribution Proposals (007)

**Feature Branch**: `007-entity-relationship-proposals`  
**Created**: 2026-05-04  
**Status**: Draft  
**Extends**: [specs/005-identity-layer/spec.md](../005-identity-layer/spec.md), [specs/004-yaml-driven-schema/spec.md](../004-yaml-driven-schema/spec.md)  
**Pattern**: Moderator-gated proposal lifecycle aligned with [SchemaExtensionProposal](../../heritage_graph/apps/heritage_data/models.py) (Spec 006)

## Summary

Contributors submit **EntityProposal** and **RelationshipProposal** records that moderators approve or reject. Approved proposals materialize canonical **`EntityCluster`** rows plus **`HeritageAssertion`** membership rows (identity.same_referent), or binary **`HeritageAssertion`** relationship rows (`relationship.<predicate>`), preserving separation of raw CIDOC rows, canonical identities, and reified claims.

## Functional Requirements

- **FR-007-001**: Authenticated users MAY create and edit draft proposals they author; only drafts are editable.
- **FR-007-002**: Authors MAY submit proposals (`draft` → `submitted`) and withdraw (`draft|submitted` → `withdrawn`).
- **FR-007-003**: Users in Django group **Moderators** or staff MAY approve or reject submitted proposals; rejection requires moderator comment.
- **FR-007-004**: On **EntityProposal** approval, the system MUST create or link **`EntityCluster`** per proposal intent (`new_cluster` vs `link_existing`) and create accepted **`HeritageAssertion`** membership rows for each anchored CIDOC record with explicit **`DataSource`** when provided.
- **FR-007-005**: On **RelationshipProposal** approval, the system MUST create an accepted **`HeritageAssertion`** with subject and object **GenericFK** to CIDOC instances, `asserted_property = relationship.<code>`, required primary **`DataSource`**, optional **`supporting_sources`** M2M, **`temporal_scope_edtf`**, and **`confidence`** aligned with existing assertion enums.
- **FR-007-006**: **`RelationshipPredicate`** codes constitute the controlled vocabulary; assertions referencing predicates MUST satisfy structural validation (object present, primary source present).
- **FR-007-007**: **`EntityCluster`** MAY carry **`curated_aliases`** (JSON list) and **`external_identifiers`** (JSON object, e.g. Wikidata QID) populated from approved entity proposals.
- **FR-007-008**: Append-only audit events MUST record lifecycle transitions for each proposal type (mirror schema extension audit).
- **FR-007-009**: Discovery endpoint SHOULD suggest duplicate **`EntityCluster`** candidates by substring match over **`canonical_label`** (Phase 2 contributor UX).

## Non-goals (v1)

- Auto-merge of clusters without moderator approval  
- SPARQL full reconciliation with Wikidata  
- Legacy **`Submission`** rows as anchor endpoints (CIDOC-only v1)

## Confidence Mapping

Proposal UX MAY display “Established / Probable / Speculative”; stored values remain **`certain` / `likely` / `speculative`** (`uncertain` reserved). Document mapping in reviewer help copy.
