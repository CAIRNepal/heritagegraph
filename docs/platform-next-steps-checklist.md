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

**Spec (draft):** [specs/005-identity-layer/spec.md](../specs/005-identity-layer/spec.md)

- `**EntityCluster` (or equivalent) Django model** — canonical label, notes, audit fields, optional lock.  
  - *Area:* Backend / Spec
- **Link assertions and/or entities to clusters** — e.g. M2M, generic relations, or typed FKs as per final spec.  
  - *Area:* Backend
- `**IdentityResolutionAssertion` (or reuse `HeritageAssertion` with typed predicate)** — explicit “same referent” claims with provenance.  
  - *Area:* Backend / Ontology
- **Merge / split audit trail** (JSONField or append-only log).  
  - *Area:* Backend
- **API + permissions** for cluster CRUD and merge/split (reviewer vs moderator).  
  - *Area:* Backend

---

## -[X] P1 — Reviewer and moderator UX

- **Review queue with triage tabs** (e.g. all / conflicts / forks) — dashboard review and curation pages.
- **Three-panel review workspace + conflict handling fields** — curation review detail UI.
- **Identity resolution workspace** — merge/split clusters, link aliases, queue unresolved identities.  
  - *Why:* Depends on P0 identity models.  
  - *Area:* UI / Backend
- **Reviewer triage scoring** (priority, age, conflict count, source tier).  
  - *Area:* Backend / UI
- **Moderator-only actions** — lock canonical cluster, schema extension approval, duplicate-cluster prevention (policy + UI).  
  - *Area:* Backend / UI

---

## -[X] P1 — Contributor and knowledge UI

- **Contribute hub YAML** — intents, categories, difficulty in `tools/contribute-hub.yaml`.
- **Ontology-driven forms** — `OntologyForm` + registry (`FORMS.md`).
- **“Why we believe” assertions panel** on knowledge views — `why-we-believe-panel.tsx`.
- **Reframe navigation around Describe / Record / Claim / Verify** (copy + IA; may map to existing routes).  
  - *Area:* UI / Content
- **Contributor basic vs advanced mode** — hide optional slots, assertion jargon, and long sections until toggled.  
  - *Note:* Intent `difficulty` exists but is not a global mode.  
  - *Area:* UI
- **Competing truth view** — surface multiple clusters or conflicting assertion chains with source weighting (extends current panel).  
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

- **Migrate coordinates to PostGIS (or typed geometry)** — replace string `coordinates` where still `CharField` in `cidoc_data` models.  
  - *Area:* Backend / DB / UI (map widgets)
- **EDTF-aware date storage** — beyond UI quick-picks; queryable ranges.  
  - *Area:* Backend / Ontology
- **Standardize relations** — prefer FK / GenericFK patterns over legacy string relation columns where they remain.  
  - *Area:* Backend / Migrations
- **Graph / search performance pass** — indexes, N+1 audits on assertion and knowledge endpoints at 10k+ scale.  
  - *Area:* Backend
- **Cluster merge conflict protocol** — when two reviewers disagree; escalate to moderator.  
  - *Depends on:* Entity clusters.  
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