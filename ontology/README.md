# HeritageGraph ontology (LinkML)

**Canonical file**: [`HeritageGraph.yaml`](./HeritageGraph.yaml) — **v1.0.0**, event-centric (CIDOC-CRM + PROV-O).

## What changed in v1.0.0

- **Lifecycle events**: `Production`, `Consecration`, `Enshrinement`, `TransferOfCustody` link tangible heritage to actors, places, and time spans.
- **CulturalEntity umbrella**: high-level `heritage_data` contributions with `CulturalEntityCategoryEnum` (monument, ritual, festival, …).
- **Identity layer**: `EntityCluster` + `HeritageAssertion` for same-referent claims and merge/split audit.
- **LinkedArt / LUX interop**: CIDOC classes after the “interop scaffolding” comment in the YAML (~line 1523) — **not** in `tools/ui-classmap.yaml` (RDF/import only).

## Edit workflow

- Edit **only** `HeritageGraph.yaml` for ontology semantics (`class_uri`, `slot_uri`, enums, induced slots).
- Expose a class in the UI by adding a row to **`tools/ui-classmap.yaml`** (registry key, `apiEndpoint`, category).
- Regenerate snapshots after substantive edits:

```bash
make generate   # full scientific pipeline (registry + SHACL + related artifacts)
# or
make ontology   # UI registry snapshots only (registry.generated.*)
```

The Django schema endpoint (`GET /api/v1/cidoc/schema/registry/`) and the Next.js app consume the materialized registry (`registry.generated.*` as fallback), built from this YAML plus `tools/ui-classmap.yaml`, `tools/contribute-hub.yaml`, and `tools/semantic-patterns.yaml`.

**Documentation**: [`documentation/ontology/ONTOLOGY.md`](../documentation/ontology/ONTOLOGY.md) — full entity table, enums, and contributor form workflow ([`documentation/contribution/FORMS.md`](../documentation/contribution/FORMS.md)).

The repository must not contain a second copy at the repo root (`Heritagegraph.yaml`). CI runs `make ontology-check`, which fails if that file exists.
