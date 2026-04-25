# HeritageGraph: Platform next steps (checklist)

Prioritized by **dependency** (foundational gates and data models before large UI bets).  
**Status narrative and evidence:** [platform-epistemic-status-2026.md](platform-epistemic-status-2026.md).

**Legend:** `- [x]` = materially present in repo today · `- [ ]` = not done / partial treated as not done

---

## -[x] P0 — Trust and correctness (schema and validation)

- **LinkML → committed registry snapshots** — `make ontology` / `make ontology-check`; CI in `.github/workflows/ontology-registry.yml`.
- **Optional API payload validation** against generated JSON Schema — `heritage_graph/apps/cidoc_data/registry_validation.py` + `ContributionFlowMixin` usage in views.
- **CI gate: registry field keys vs Django model fields** (per class or global script).  
  - *Why:* Prevents silent form/API drift; complements manual checklist in `FORMS.md`.  
  - *Area:* DevOps / Backend
- **CI or codegen: enum / choices alignment** (LinkML enums ↔ Django `choices`).  
  - *Area:* DevOps / Backend
- **Classmap / router parity check** (`tools/ui-classmap.yaml` ↔ `cidoc_data/urls.py` or registered routes).  
  - *Area:* DevOps

---

## -[x] P0 — Identity layer (unblocks “PN Shah” scale)

**Spec:** [specs/005-identity-layer/spec.md](../specs/005-identity-layer/spec.md)

- [x] **`EntityCluster` Django model** — `canonical_label`, `type_scope`, `locked`, `version`, `merged_into`; in `cidoc_data/models.py`.
- [x] **`HeritageAssertion` linked to clusters** — `entity_cluster` FK + `IDENTITY_SAME_REFERENT_PROPERTY` predicate; membership derived from assertions.
- [x] **`IdentityResolutionCandidate`** — rule-based reviewer queue suggestions with `left`/`right` sides, status, and notes.
- [x] **`ClusterAuditEvent`** — append-only audit trail for merge, split, lock, unlock, and lock-override actions.
- [x] **API + permissions** — `EntityClusterViewSet` with `merge`, `split`, `lock`, `unlock` actions; `IsExpertCurator` gating; `IdentityCandidateViewSet` for queue.
- [x] **Identity resolution workspace UI** — `/curation/identity/` (queue) + `/curation/identity/[candidateId]` (per-candidate workspace).  
  - *Area:* UI / Backend

---

## -[x] P1 — Reviewer and moderator UX

- [x] **Review queue with triage tabs** — `/curation/review/` with all / new_claims / conflicts / flagged / expiring filters; `TriagePolicy` weights; `triage_priority` + `triage_breakdown` per row.
- [x] **Three-panel review workspace** — `/curation/review/[id]` with claim, source, and decision panels; `ReviewDecision` and `ReviewFlag` models.
- [x] **Identity resolution workspace** — `/curation/identity/` + `/curation/identity/[candidateId]`; backed by `IdentityResolutionCandidate` + `identity_services`.
- [x] **Reviewer triage scoring** — `review-queue/triage-policy/` endpoint exposes active `TriagePolicy` weights; `queue_counts` endpoint for badge counts.
- [x] **Moderator-only actions** — cluster lock/unlock (`IsExpertCurator`), schema extension approval lifecycle (`SchemaExtensionProposal`: submit/withdraw/approve/reject/publish) at `/curation/schema-extensions/`.  
  - *Area:* Backend / UI

---

## -[x] P1 — Contributor and knowledge UI

- [x] **Contribute hub YAML** — intents, categories, difficulty in `tools/contribute-hub.yaml`.
- [x] **Ontology-driven forms** — `OntologyForm` + registry (`FORMS.md`); contribute routes for all 19 CIDOC entity types.
- [x] **"Why we believe" assertions panel** on knowledge views — `why-we-believe-panel.tsx`.
- [ ] **Reframe navigation around Describe / Record / Claim / Verify** (copy + IA; may map to existing routes).  
  - *Area:* UI / Content
- [ ] **Contributor basic vs advanced mode** — hide optional slots, assertion jargon, and long sections until toggled.  
  - *Note:* Intent `difficulty` exists but is not a global mode.  
  - *Area:* UI
- [ ] **Competing truth view** — surface multiple clusters or conflicting assertion chains with source weighting (extends current panel).  
  - *Depends on:* Identity layer + assertion UX design.  
  - *Area:* UI / Backend

---

## -[x] P1 — Serialization and codegen (reduce manual drift)

- **Generate DRF serializers (or validators) from LinkML** — `make serializers` / `make serializers-check`; `tools/generate_serializers.py` + `BaseRegistrySerializer` mixin in `serializers.py`; generated stubs in `serializers.generated.py`.  
  - *Area:* Backend / Tooling
- **Document or automate "new entity" checklist** — `docs/new-entity-checklist.md` — 12-step guide: Model + Serializer + ViewSet + Router + migration + classmap row + hub intent + tests.  
  - *Area:* Docs / DevOps

---

## P2 — Data platform and scale

*Plan:* [`/home/nabin2004/.windsurf/plans/p2-data-platform-scale-4dfc2f.md`](../../.windsurf/plans/p2-data-platform-scale-4dfc2f.md)*

- [ ] **Migrate coordinates to PostGIS (`PointField`)** — replace `coordinates CharField` on `Location`, `ArchitecturalStructure`, `Monument`; keep `coordinates_legacy`; data migration; requires PostGIS + GDAL.  
  - *Area:* Backend / DB / UI (map widgets)
- [ ] **EDTF-aware date storage** — `EDTFSerializerField` validator + attach to key date CharFields (`birth_date`, `start_date`, `construction_date`, `date_earliest/latest`); no migration.  
  - *Area:* Backend / Ontology
- [ ] **Standardize relations via EntityRef** — `post_save` signals to keep `EntityRef` in sync automatically; `rebuild_entityrefs --check` for CI; `make entityrefs` target.  
  - *Area:* Backend / Migrations
- [ ] **Graph / search performance pass** — migration `0010_perf_indexes.py` for high-traffic fields; N+1 fix on `IdentityCandidateViewSet`.  
  - *Area:* Backend
- [ ] **Cluster merge conflict protocol** — `detect_merge_conflict()` in `identity_services.py`; auto-lock + create `IdentityResolutionCandidate` on conflict for non-curators; `GET conflict-check/` pre-flight action on `EntityClusterViewSet`.  
  - *Depends on:* Entity clusters ✓  
  - *Area:* Product / Backend

---

## P2 — Narrative and query layer (research / product)

- **Query-time synthesis / “best available graph”** — documented API or read model; confidence thresholds as query params.  
  - *Area:* Backend / Research

---

## Quick reference: owner tags


| Tag          | Typical work                                 |
| ------------ | -------------------------------------------- |
| **Backend**  | Django models, APIs, migrations, validation  |
| **UI**       | Next.js app, components, IA                  |
| **Ontology** | `ontology/HeritageGraph.yaml`, generator     |
| **DevOps**   | GitHub Actions, `Makefile`, release checks   |
| **Spec**     | `specs/` updates before large schema changes |


---

*Keep this file updated when closing items; link PRs in commit messages or team changelog as your convention prefers.*