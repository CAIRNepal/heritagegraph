# Wireframes & Diagrams

> Derived from `docs/en/plan.md` (12-phase LOD workflow) and `docs/en/IMPLEMENTATION_PLAN.md` (grounded tasks).
> All diagrams use [Mermaid](https://mermaid.js.org/) — rendered in GitHub, MkDocs, and most markdown viewers.

---

## Files in this folder

| File | Phases | Contents |
|------|--------|----------|
| [00-system-overview.md](./00-system-overview.md) | All | C4 context diagram, container diagram, master end-to-end process, ER overview |
| [01-identity-auth.md](./01-identity-auth.md) | Phase 0 | Google OAuth sequence, ORCID linking sequence, account page wireframe, role resolution flowchart |
| [02-project-management.md](./02-project-management.md) | Phase 1 | Project PID sequence, projects dashboard wireframe, new project form wireframe, project workspace wireframe |
| [03-ingest-datasource.md](./03-ingest-datasource.md) | Phase 2 | File ingest pipeline process diagram, upload sequence, DataSource upload wireframe, IIIF viewer wireframe |
| [04-contribute-assert.md](./04-contribute-assert.md) | Phase 3 | Assertion capture flowchart, full contribute sequence, temple form wireframe, CalendarDatePicker wireframe, event materialisation diagram |
| [05-validation-reconciliation.md](./05-validation-reconciliation.md) | Phases 4–5 | Validation pipeline flowchart, reconciliation pipeline flowchart, SHACL sequence, validation status panel wireframe, duplicate detection wireframe |
| [06-merge-request-review.md](./06-merge-request-review.md) | Phases 7–9 | MergeRequest state machine, open-MR sequence, review+approve sequence, merge request form wireframe, reviewer diff view wireframe, post-merge notification wireframe |
| [07-lod-publication.md](./07-lod-publication.md) | Phases 10–11 | LOD publication pipeline, full LOD publication sequence, SPARQL explorer wireframe, entity dereference page wireframe, CARE SPARQL proxy flowchart |
| [08-maintenance-supersession.md](./08-maintenance-supersession.md) | Phase 12 | Supersession state diagram, supersession sequence, assertion history wireframe, re-reconciliation beat task flowchart, curator alert panel wireframe |
| [09-feature-specs.md](./09-feature-specs.md) | All | Complete feature specs with code skeletons for all `[TODO]` items + all 4 paper evaluation scripts |

---

## Quick reference: diagram types used

| Symbol | Meaning |
|--------|---------|
| `flowchart TD/LR` | Process flow diagram |
| `sequenceDiagram` | Sequence diagram (actor ↔ system interactions) |
| `stateDiagram-v2` | State machine |
| `erDiagram` | Entity-relationship diagram |
| `C4Context` / `C4Container` | C4 architecture diagrams |
| ASCII `┌─┐│└─┘` | UI wireframes |

---

## Status legend (from IMPLEMENTATION_PLAN.md)

| Tag | Meaning |
|-----|---------|
| `[DONE]` | Code exists and works |
| `[PARTIAL]` | Scaffolded but incomplete |
| `[TODO]` | Not yet built — has a feature spec in `09-feature-specs.md` |
