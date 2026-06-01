# HeritageGraph tools

## Full pipeline

Run `make generate` to regenerate all schema-driven artifacts in one command:

```bash
make generate
```

This runs: ontology → viz-config → shacl → serializers → entityrefs → schema-rebuild.

For CI verification (no side-effects):

```bash
make check
```

This runs all `*-check` gates: ontology, viz-config, shacl, serializers, entityrefs, contribute-routes.

---

## `linkml_generate_registry.py`

Regenerates:

- `heritage_graph_ui/src/lib/ontology/registry.generated.json`
- `heritage_graph_ui/src/lib/ontology/registry.generated.ts`

from `ontology/HeritageGraph.yaml`, `tools/ui-classmap.yaml`, `tools/ui-presentation.yaml` (optional slot overrides), **`tools/contribute-hub.yaml`**, and **`tools/semantic-patterns.yaml`**. Used as an offline fallback when the schema API is unavailable.

After changing the ontology or patterns, regenerate the optional SHACL companion used for Fuseki/consistency QA:

```bash
python3 tools/linkml_generate_registry.py
python3 tools/emit_minimal_shacl.py
```

(Output: **`ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`**.)

```bash
# From repo root
python3 tools/linkml_generate_registry.py
# or (part of make generate)
make ontology
# or (from heritage_graph_ui/)
npm run generate:ontology
```

CI gate (optional):

```bash
python3 tools/linkml_generate_registry.py --check
```

---

## `emit_minimal_shacl.py`

Emits **`ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`** from the committed **`registry.generated.json`** snapshot. Run whenever the registry shape changes (`linkml_generate_registry.py` above). Requires no LinkML CLI.

```bash
python3 tools/emit_minimal_shacl.py
```

## `semantic-patterns.yaml`

Defines contributor-facing guided workflows surfaced as **`semantic_patterns`** on the schema registry API (`GET /api/v1/cidoc/schema/registry/`). Patterns are keyed by **`key`** and opened in the Next.js app at **`/contribute/pattern/<key>`**. Coordinate with **`tools/linkml_generate_registry.py`** (`make ontology`) so snapshots stay aligned.



## `ui-mapping.yaml`

Reserved for explicit LinkML range → UI widget overrides (see `specs/004-yaml-driven-schema/research.md` R-002). The MVP mapper lives in `apps/cidoc_data/ontology_builder.py`.
