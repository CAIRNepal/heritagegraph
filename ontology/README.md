# HeritageGraph ontology (LinkML)

**Canonical file**: [`HeritageGraph.yaml`](./HeritageGraph.yaml)

- Edit **only** this YAML for ontology semantics (`class_uri`, `slot_uri`, enums, induced slots).
- Regenerate UI snapshots after substantive edits:

```bash
make generate
```

(`make ontology` only refreshes UI registry snapshots; `make generate` is the full scientific pipeline.)

The Django schema endpoint (`GET /api/v1/cidoc/schema/registry/`) and the Next.js app consume the materialized registry (`registry.generated.*` as fallback), built from this YAML plus `tools/ui-classmap.yaml` and `tools/contribute-hub.yaml`.

The repository must not contain a second copy at the repo root (`Heritagegraph.yaml`). CI runs `make ontology-check`, which fails if that file exists.
