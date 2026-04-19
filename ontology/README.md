# HeritageGraph ontology (LinkML)

**Canonical file**: [`HeritageGraph.yaml`](./HeritageGraph.yaml)

- Edit **only** this YAML for ontology semantics (`class_uri`, `slot_uri`, enums, induced slots).
- Regenerate UI snapshots after substantive edits:

```bash
make ontology
```

The Django schema endpoint (`GET /api/v1/cidoc/schema/registry/`) and the Next.js app merge these semantics into the hand-tuned baseline in `heritage_graph_ui/src/lib/ontology/registry.ts`.

If you maintain a duplicate `Heritagegraph.yaml` at the repository root for tooling compatibility, treat **`ontology/HeritageGraph.yaml`** as authoritative and sync copies deliberately.
