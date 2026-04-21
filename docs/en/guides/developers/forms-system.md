# Forms System & Ontology (summary)

**End-to-end YAML → UI pipeline:** see the comprehensive guide [YAML schema workflow](yaml-schema-workflow.md) (sources of truth, `make ontology`, Django registry API, `OntologyProvider`, deployment, CI).

The repository root [`FORMS.md`](https://github.com/CAIRNepal/heritagegraph/blob/main/FORMS.md) is the detailed, task-oriented reference for fields, enums, and Django sync.

This page will eventually merge `FORMS.md` and `ONTOLOGY.md` into a single MkDocs chapter. Until then, use:

- [YAML schema workflow](yaml-schema-workflow.md) — architecture and operations
- `FORMS.md` — how to add fields, enums, and entity types step by step

Key concepts to include in a future merge:
- Field registry and types
- How to add a new entity type
- Mapping LinkML/schema to the generated registry
- CIDOC-CRM alignment and provenance via PROV-O
