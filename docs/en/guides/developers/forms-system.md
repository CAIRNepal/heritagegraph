# Forms system and ontology (developer summary)

**End-to-end pipeline:** [YAML schema workflow](yaml-schema-workflow.md) — LinkML, `tools/ui-classmap.yaml`, optional `tools/ui-presentation.yaml`, `tools/contribute-hub.yaml`, `make ontology`, Django `GET /api/v1/cidoc/schema/registry/`, `OntologyProvider`, CI.

**Task-level reference (add field, enum, entity type, Django sync):** repository root [`FORMS.md`](https://github.com/CAIRNepal/heritagegraph/blob/main/FORMS.md).

## What drives the contribute UI

| Layer | Role |
|-------|------|
| **`OntologyForm`** | Renders fields from an `OntologyClass` (registry): sections, `?step=` for multi-section classes, validation, POST/PATCH to `apiEndpoint`. |
| **`ContributeOntologyForm`** | Resolves `ontologyKey` via `useOntology()`; shows **`OntologyUnavailablePanel`** if the key is missing. |
| **Registry snapshot** | `registry.generated.json` / `.ts` — offline baseline; must stay in sync (`make ontology-check`). |
| **Live registry** | Authenticated clients fetch the schema API; payload includes **`registry_jsonschema`** for lightweight required-field checks on submit. |

## Validation (current behavior)

- **Client:** `validateRequiredFields` (required, empty values, coordinates, relations, multivalued, **`minimumCardinality` / `maximumCardinality`** when set on fields). Field-level error messages under inputs; optional pass against **`registry_jsonschema`** `required` lists (`validate-registry-payload.ts`).
- **Server:** DRF + model constraints; **`registry_validation.validate_payload_for_class`** can validate against the same JSON Schema bundle when wired into viewsets.

## Field types (high level)

See **`FORMS.md` §8** for the full table. Notable types: `text`, `textarea`, `number`, `float`, `date`, **`edtf_date`**, `select`, **`multiselect`** (checkboxes), **`boolean`** (switch), `url`, `coordinates`, **`geo_point`**, **`relation`** (search; values serialize to API as IDs where applicable).

## Cultural entities

Registry key **`entity`** / LinkML class **`CulturalEntity`** — API **`/data/api/cultural-entities/`** (`heritage_data`). Contribute route uses the same **`OntologyForm`** as CIDOC types (no inline `OntologyClass` in page source).

## Custom wizards

Structure and ritual contribute routes use **`ContributeOntologyForm`** (registry-driven). Optional **`StepWizard`**, **`EntitySearch`**, **`AssertionWrapper`** components remain available for bespoke flows; see **`FORMS.md` §11**.

## Related docs

- [YAML schema workflow](yaml-schema-workflow.md) — architecture, deployment, troubleshooting, CI.
- Root **`ONTOLOGY.md`** — domain-oriented ontology guide (being aligned with YAML-first workflow; **`FORMS.md`** is authoritative for form tasks).
