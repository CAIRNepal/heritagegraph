# Quickstart: YAML-driven schema (004-yaml-driven-schema)

**Feature**: `specs/004-yaml-driven-schema/spec.md`  
**Plan**: `specs/004-yaml-driven-schema/plan.md`

This document is a **verification guide** for developers once implementation tasks exist. Commands are **illustrative** until the Makefile/npm script names are added in implementation.

## Prerequisites

- Python 3.13, `heritage_graph` venv with Django dependencies **plus** LinkML (`pip install linkml linkml-runtime` — to be pinned in requirements or `requirements-dev.txt` during implementation).
- Node.js for `heritage_graph_ui` (same as repo).
- `NEXT_PUBLIC_API_URL` set in `heritage_graph_ui/.env.local` (see `heritage_graph_ui/.env.example`).

## One-command regeneration (target state)

From repo root (after `tools/` scripts land):

```bash
# Illustrative — final name may be `make ontology` or `npm run generate:ontology`
./tools/linkml_generate_registry.py ontology/HeritageGraph.yaml \
  --out-json heritage_graph_ui/src/lib/ontology/registry.generated.json \
  --out-ts heritage_graph_ui/src/lib/ontology/registry.generated.ts
```

**Expected:** Generated files are **committed** as CI fallback; contributors must not edit them by hand (FR-011).

## Backend: run schema endpoint locally

```bash
cd heritage_graph
export DJANGO_SETTINGS_MODULE=settings
python manage.py runserver 0.0.0.0:8000
```

**Verify (after implementation):**

```bash
curl -sS -H "Authorization: Bearer <token>" \
  "$NEXT_PUBLIC_API_URL/api/v1/cidoc/schema/registry/" | jq '.schema_version, .classes | keys | length'
```

- Response must include **`schema_version`** and a **`classes`** object keyed by ontology class keys.
- Repeat request with `If-None-Match` from prior **`ETag`** — expect **304** when unchanged (per `research.md` R-005).

## Frontend: runtime registry

1. Start UI with API pointing at local Django.
2. Open contribute flow for any ontology class — form fields should match schema API (not hardcoded `registry.ts` for migrated classes).
3. Stop Django — UI should show **degraded** banner and still load **read-only** from generated snapshot.

## RDF sidecar (Phase P3)

When enabled:

```bash
# Illustrative — depends on chosen triplestore
curl -sS "$RDF_ENDPOINT_URL/sparql" \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode 'query=SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }'
```

Create/update an entity via Django API; within SC-007 lag, confirm triples use **`class_uri` / `slot_uri`** from LinkML.

## Documentation checklist (for implementers)

When closing the feature, confirm updates to:

- [ ] `FORMS.md` — YAML-first workflow
- [ ] `ARCHITECTURE.md` — diagram + data flow
- [ ] `AGENTS.md` — paths and “no hand-edit generated registry”
- [ ] `API_VERSIONING.md` — new routes
- [ ] `.env.example` — new variables (C-001)
