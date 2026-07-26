# HeritageGraph ontology (LinkML)

**Canonical file**: [`HeritageGraph.yaml`](./HeritageGraph.yaml) — event-centric (CIDOC-CRM + PROV-O).

Generated companions (do not hand-edit):

| File | Emitted by | Consumed by |
|---|---|---|
| [`HeritageGraph.ttl`](./HeritageGraph.ttl) | `make owl-ttl` | `manage.py rdf_load_tbox` (Oxigraph SCHEMA graph), `apps.graph.kg_engine.quality` |
| [`heritagegraph-crm-bridge.ttl`](./heritagegraph-crm-bridge.ttl) | `make crm-bridge` | loaded into the SCHEMA graph alongside the TBox |
| [`lod/skos-vocabularies.ttl`](./lod/skos-vocabularies.ttl) | `make skos-vocab` | AAT-aligned SKOS concepts (from enum `meaning:` annotations) |
| [`shapes/generated-heritagegraph-minimal-shacl.ttl`](./shapes) | `make shacl` | write-time SHACL validation |

## Upstream merge (0.1.0 draft)

[`upstream/HeritageGraph-0.1.0-upstream.yaml`](./upstream) is the CAIR-Nepal
[heritagegraphontology](https://github.com/CAIRNepal/heritagegraphontology) pre-release
draft. It was **rebased into** the canonical schema by
[`tools/merge_ontology_upgrade.py`](../tools/merge_ontology_upgrade.py) rather than swapped in,
because it drops classes the platform still depends on.

What the merge carries over from the draft:

- PROV-O core (`Entity` / `Activity` / `Agent` mixins) and the generic provenance slots.
- A real structure taxonomy — `Temple`, `Stupa`, `Chaitya`, `Pati`, `Sattal`, `Dharmashala`,
  `DhungeDhara`, `Pokhari`, `Paubha`, `Murti`.
- Deep Kumari modelling — `KumariTenure`, `KumariRole`, `KumariHouse`, the lifecycle events,
  and the `SelectionCriterion` hierarchy (age, lineage, 32 perfections, horoscope,
  physical integrity, fearlessness assessment).
- Enums renamed to drop the `Enum` suffix (`ConditionType`, `ArchitecturalStyle`, …).

What the merge restores on top of it (the draft removed these, but
`tools/ui-classmap.yaml`, `tools/ui-vizmap.yaml` and the Django models still need them):

- Classes `CulturalEntity`, `HeritageAssertion`, `HistoricalPeriod`, `BuddhistMonument`,
  `LivingGoddessTenure` / `LivingGoddessSelection` / `LivingGoddessRetirement`,
  `AssertableEntity`, `Group`, `Set`.
- The `CulturalEntityCategory` enum and the slots those classes need.
- Prefixes the draft dropped but the CRM bridge still emits (`crmdig`, `edm`, `foaf`, `la`,
  `tgn`, `wgs84`, `geonames`, `datacite`, `dct`).
- Enum `meaning:` annotations, which only `emit_skos_vocabularies.py` reads and which the
  draft had reduced from 51 to 5.

The draft's provenance slots supersede older equivalents — `has_provenance_assertion` →
`has_assertion`, `is_about_entity`/`is_about_event` → `is_about`, `was_derived_from_source` →
`documented_in_source`. The PROV-O mixin slots have no Django column, so they are marked
`ui_hidden` in [`tools/ui-presentation.yaml`](../tools/ui-presentation.yaml) to keep them out
of contribute forms while staying in the RDF projection.

## Edit workflow

- Edit **only** `HeritageGraph.yaml` for ontology semantics (`class_uri`, `slot_uri`, enums, induced slots).
- Expose a class in the UI by adding a row to **`tools/ui-classmap.yaml`** (registry key, `apiEndpoint`, category).
- Regenerate snapshots after substantive edits:

```bash
make generate   # full pipeline (registry + viz + SHACL + OWL TBox + bridge + SKOS + serializers)
# or
make ontology   # UI registry snapshots only (registry.generated.*)
```

Verify with `make check` (all `*-check` gates, no side effects).

> A LinkML class name is load-bearing in three places at once: the YAML, the `linkml:` column
> of `tools/ui-classmap.yaml`, and `DJANGO_MODEL_TO_REGISTRY_CLASS_KEY` in
> `apps/cidoc_data/cidoc_registry_keys.py`. If they drift, the class is silently dropped from
> the registry and its fields disappear from forms and RDF projection.

The Django schema endpoint (`GET /api/v1/cidoc/schema/registry/`) and the Next.js app consume the materialized registry (`registry.generated.*` as fallback), built from this YAML plus `tools/ui-classmap.yaml`, `tools/contribute-hub.yaml`, and `tools/semantic-patterns.yaml`.

**Documentation**: [`documentation/ontology/ONTOLOGY.md`](../documentation/ontology/ONTOLOGY.md) — full entity table, enums, and contributor form workflow ([`documentation/contribution/FORMS.md`](../documentation/contribution/FORMS.md)).

The repository must not contain a second copy at the repo root (`Heritagegraph.yaml`). CI runs `make ontology-check`, which fails if that file exists.
