# HeritageGraph Ontology Pipeline

## Problem this solves

Before this pipeline, ontology definitions were duplicated across five independent locations with no enforcement mechanism. A namespace URI change, renamed predicate, or new enum value had to be applied manually in each place — silent divergence was the default state.

| Before | File | What was hardcoded |
|---|---|---|
| Heritage Museum & ForceGraph | `heritage-data.ts` | `NodeType`, `NODE_TYPE_CONFIG`, `RELATION_LABELS`, `HG_CATEGORY_CONFIG` |
| Contribution form RDF layer | `form-graph.ts` | `RDF_PREFIXES` |
| Backend triple emitter | `rdf_entity_projection.py` | `RDF_PREFIXES` |
| Contribution forms (selects) | `enums.ts` | All enum permissible values |
| Registry generator | `linkml_generate_registry.py` | (already schema-driven; unchanged) |

---

## Architecture

```
ontology/HeritageGraph.yaml          ← semantic source of truth (classes, slots, enums, prefixes)
tools/ui-vizmap.yaml                 ← presentational config (colors, emojis, hg_category)
        │
        ├── tools/linkml_generate_registry.py   (make ontology — step 1)
        │        ├── registry.generated.json / .ts  →  contribution forms (OntologyForm)
        │        └── consumed by emit_skos_vocabularies.py, SHACL, serializers
        │
        └── tools/gen_heritage_viz_config.py      (make ontology — step 2)
                  │
                  ├── __generated__/heritage-viz-config.ts
                  │        RDF_PREFIXES, NodeType, NODE_TYPE_CONFIG,
                  │        RELATION_LABELS, HG_CATEGORY_CONFIG, HgCategory
                  │        │
                  │        ├── heritage-data.ts  →  Heritage Museum (live KG)
                  │        └── form-graph.ts     →  JSON-LD / contribution forms
                  │
                  ├── __generated__/ontology-graph.ts
                  │        Cytoscape class hierarchy + object-property edges
                  │        │
                  │        └── ontology-graph.ts (re-export)  →  /graphview Ontology tab
                  │
                  ├── __generated__/enums.ts
                  │        ontologyEnums (all permissible_values from schema)
                  │        │
                  │        └── enums.ts (re-export)  →  all form select fields
                  │
                  └── apps/graph/ontology_config.py
                           RDF_PREFIXES dict, expand_curie() helper
                           │
                           └── rdf_entity_projection.py  →  Oxigraph triple store
```

**One command after editing the schema:**

```bash
make ontology
```

This regenerates the registry (forms) and all visualization/backend config files. Commit every changed file under `__generated__/`, `registry.generated.*`, and `ontology_config.py` together with your YAML edit.

The generator reads both YAMLs, validates cross-references, and writes deterministic output. Generated files are committed alongside schema changes so the repo is always self-contained and CI can enforce consistency.

---

## How to make a change

### Add a new entity type (NodeType)

1. Add the class to `ontology/HeritageGraph.yaml`:
   ```yaml
   classes:
     WaterShrine:
       class_uri: heritageGraph:WaterShrine
       description: "Sacred water structure"
   ```
2. Add the visual config to `tools/ui-vizmap.yaml`:
   ```yaml
   node_types:
     - key: WaterShrine
       linkml_class: WaterShrine
       label: Water Shrine
       color: "#0ea5e9"
       glow_color: "#38bdf8"
       emoji: "💧"
       hg_category: tangible
   ```
3. Run the generator and commit all changed files together:
   ```bash
   python3 tools/gen_heritage_viz_config.py
   git add ontology/HeritageGraph.yaml tools/ui-vizmap.yaml \
           heritage_graph_ui/src/lib/ontology/__generated__/ \
           heritage_graph/apps/graph/ontology_config.py
   ```

The new `NodeType` value, its CIDOC mapping, and its visual config will be available in the museum page, ForceGraph, and any other consumer immediately.

### Add a relation predicate to the graph visualization

1. Add the slot to `ontology/HeritageGraph.yaml`:
   ```yaml
   slots:
     constructed_by:
       slot_uri: crm:P14_carried_out_by
       range: Actor
   ```
2. Add the display label to `tools/ui-vizmap.yaml`:
   ```yaml
   viz_predicates:
     - slot: constructed_by
       label: constructed by
   ```
3. Run `python3 tools/gen_heritage_viz_config.py` and commit.

The new predicate is automatically included in `RELATION_LABELS` and in `RELATION_PREDICATES` in the JSON-LD parser (which is derived from `Object.keys(RELATION_LABELS)`).

### Add or change an enum value

Edit `ontology/HeritageGraph.yaml` under the relevant enum:
```yaml
enums:
  ConditionTypeEnum:
    permissible_values:
      Conserved:
        description: "Professionally conserved and stabilized"
```
Run the generator. The new value appears in `__generated__/enums.ts` and in every form select that uses that enum — no other files need changing.

### Add or change a namespace prefix

1. Add the prefix to `ontology/HeritageGraph.yaml`:
   ```yaml
   prefixes:
     skos: "http://www.w3.org/2004/02/skos/core#"
   ```
2. Add it to `core_prefixes` in `tools/ui-vizmap.yaml` to include it in generated output:
   ```yaml
   core_prefixes:
     - skos
   ```
3. Run the generator and commit.

The prefix will appear in `RDF_PREFIXES` in all three generated files (TypeScript viz config, TypeScript form layer, Python backend), keeping all three in sync.

---

## Running the generator

```bash
# Regenerate all outputs (standard usage)
python3 tools/gen_heritage_viz_config.py

# Via npm alias
npm run generate:viz-config

# Dry run — print to stdout, write nothing
python3 tools/gen_heritage_viz_config.py --dry-run

# CI gate — exit 1 if any output differs from committed content
python3 tools/gen_heritage_viz_config.py --check

# Combined check for both generators (registry + viz config)
npm run check:ontology
```

The generator runs automatically before `npm run dev` and `npm run build` via the `predev`/`prebuild` hooks in `package.json`.

---

## CI enforcement

Add this step to catch uncommitted schema drift before it merges:

```yaml
# .github/workflows/ci.yml
- name: Check ontology artifacts are up to date
  run: |
    cd heritage_graph_ui
    npm run check:ontology
```

A PR that edits `HeritageGraph.yaml` or `ui-vizmap.yaml` without regenerating artifacts will fail this check.

---

## File inventory

| File | Authoritative? | Edit directly? |
|---|---|---|
| `ontology/HeritageGraph.yaml` | Yes — semantic source | ✅ |
| `tools/ui-vizmap.yaml` | Yes — presentational source | ✅ |
| `tools/gen_heritage_viz_config.py` | Yes — generator logic | ✅ (to add output targets) |
| `__generated__/heritage-viz-config.ts` | No — auto-generated | ❌ |
| `__generated__/enums.ts` | No — auto-generated | ❌ |
| `apps/graph/ontology_config.py` | No — auto-generated | ❌ |
| `enums.ts` | No — thin re-export | ❌ |
| `form-graph.ts` | Partial — imports `RDF_PREFIXES`; owns form graph logic | ✅ (for graph logic only) |
| `heritage-data.ts` | Partial — imports ontology types; owns JSON-LD parsing | ✅ (for parsing logic only) |
| `rdf_entity_projection.py` | Partial — imports `RDF_PREFIXES`; owns triple projection | ✅ (for projection logic only) |

---

## Design principles

**One edit, all consumers update.** Changing a prefix URI, predicate label, or enum value in the YAML propagates to the heritage museum page, ForceGraph, contribution form JSON-LD layer, contribution form selects, and Oxigraph triple emitter after a single generator run.

**Separation of concerns.** `HeritageGraph.yaml` owns semantic meaning — what things *are*, their CIDOC-CRM class URIs, slot URIs, SKOS exact mappings. `ui-vizmap.yaml` owns presentation — colors, emojis, graph layout categories. Neither file contains the other's concerns.

**Validated join.** The generator validates that every `linkml_class` in `ui-vizmap.yaml` exists in `HeritageGraph.yaml`, every `viz_predicate` slot exists (or has a `cidoc_note` fallback), and every `core_prefix` is declared in the schema. Violations are errors at generation time, not silent bugs at runtime.

**Committed artifacts.** Generated files are committed, not gitignored. This keeps the repository self-contained — no generator run required on fresh clone — and makes schema changes visible in code review as concrete diffs in the generated files.

**Referential integrity by construction.** `RELATION_PREDICATES` in the JSON-LD parser is `Object.keys(RELATION_LABELS)`, where `RELATION_LABELS` is generated from `viz_predicates` in the YAML. Adding a predicate to the YAML automatically includes it in the parser. There is no separate list to keep in sync.

---

## Companion tools

| Tool | Purpose |
|---|---|
| `tools/linkml_generate_registry.py` | Generates `registry.generated.ts/json` — class/field definitions for contribution forms. Separate generator, same schema source. |
| `tools/ui-classmap.yaml` | Maps LinkML classes to API endpoints and registry keys. Complementary to `ui-vizmap.yaml`; consumed by `linkml_generate_registry.py`. |
| `tools/schema_diff.py` | Computes semantic diff between two schema versions. |
| `tools/ui-vizmap.yaml` | Input to this generator; see above. |
