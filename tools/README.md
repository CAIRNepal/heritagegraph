# HeritageGraph tools

## `linkml_generate_registry.py`

Regenerates:

- `heritage_graph_ui/src/lib/ontology/registry.generated.json`
- `heritage_graph_ui/src/lib/ontology/registry.generated.ts`

from `ontology/HeritageGraph.yaml`, `tools/ui-classmap.yaml`, `tools/ui-presentation.yaml` (optional slot overrides), and `tools/contribute-hub.yaml`. Used as an offline fallback when the schema API is unavailable.

```bash
# From repo root
python3 tools/linkml_generate_registry.py
# or
make ontology
# or (from heritage_graph_ui/)
npm run generate:ontology
```

CI gate (optional):

```bash
python3 tools/linkml_generate_registry.py --check
```

## `ui-mapping.yaml`

Reserved for explicit LinkML range → UI widget overrides (see `specs/004-yaml-driven-schema/research.md` R-002). The MVP mapper lives in `apps/cidoc_data/ontology_builder.py`.
