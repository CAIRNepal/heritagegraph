# Entity & relationship proposals (007)

Contributor **entity proposals** and **relationship proposals** are moderator-gated workflows that materialize canonical **`EntityCluster`** membership (`identity.same_referent`) and binary **`HeritageAssertion`** rows (`relationship.<code>`), without collapsing raw CIDOC data into “facts.”

## Spec kit (this feature)

| Document | Description |
| -------- | ----------- |
| [spec.md](./spec.md) | Requirements and scope |
| [data-model.md](./data-model.md) | Schema / ER overview |
| [quickstart.md](./quickstart.md) | Migrate, seed predicates, API smoke checks |
| [contracts/openapi-knowledge-graph-proposals.v1.yaml](./contracts/openapi-knowledge-graph-proposals.v1.yaml) | OpenAPI sketch |

## Related specs

| Spec | Link |
| ---- | ---- |
| Identity layer (clusters + same-referent) | [../005-identity-layer/spec.md](../005-identity-layer/spec.md) · [data-model.md](../005-identity-layer/data-model.md) |
| YAML-driven schema / RDF direction | [../004-yaml-driven-schema/spec.md](../004-yaml-driven-schema/spec.md) |
| Reviewer triage / moderator patterns | [../006-reviewer-triage-and-approval/spec.md](../006-reviewer-triage-and-approval/spec.md) |

## Platform context (markdown)

| Document | Link |
| -------- | ---- |
| Epistemic framing | [../../docs/platform-epistemic-status-2026.md](../../docs/platform-epistemic-status-2026.md) |
| Roadmap checklist | [../../docs/platform-next-steps-checklist.md](../../docs/platform-next-steps-checklist.md) |
| Agent / API index | [../../AGENTS.md](../../AGENTS.md) |

## Implementation map

| Area | Location |
| ---- | -------- |
| Proposal lifecycle + materialization | `heritage_graph/apps/heritage_data/services/kg_proposals.py` |
| Proposal models | `heritage_graph/apps/heritage_data/models.py` |
| Predicates + assertion schema | `heritage_graph/apps/cidoc_data/models.py` |
| `relationship.*` validation | `heritage_graph/apps/cidoc_data/assertion_validation.py` |
| RDF hook for accepted relationships | `heritage_graph/apps/cidoc_data/rdf_signals.py` |

## Operations

```bash
cd heritage_graph && python manage.py migrate
python manage.py seed_relationship_predicates
```

Use the Django **`Moderators`** group (same gate as schema extension proposals).

## UI routes (`heritage_graph_ui`)

- `/contribute/entity-proposal` — draft / submit entity proposals  
- `/contribute/relationship-proposal` — draft / submit relationship proposals  
- `/curation/kg-proposals` — approve or reject submitted proposals  

Moderators also see **KG proposals** in the sidebar under Verify and a shortcut from `/curation/identity` when applicable.
