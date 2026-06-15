# YAML-driven schema (LinkML) — user & developer guide

This project is moving toward a **YAML-driven ontology** where a single LinkML file defines the “shape” of the domain (classes, fields, enums, RDF URIs), and the backend + UI consume it through a **schema registry API**.

**Canonical ontology file**: `ontology/HeritageGraph.yaml`

**Developers:** For an **end-to-end workflow** (sources of truth, generator, API, Next.js, deploy, CI, troubleshooting), see [YAML schema workflow (developer guide)](guides/developers/yaml-schema-workflow.md).

---

## For decision makers (what this changes, why it matters)

### What problem it solves

Historically, adding/changing a class/field required manual edits across:

- The LinkML YAML ontology
- A separate hand-maintained frontend registry (removed in favor of generation)
- Django models/serializers/endpoints

That created **drift**, slowed delivery, and made it hard for other institutions to reuse/extend the ontology.

### What the new approach enables

- **Single source of truth**: edit `ontology/HeritageGraph.yaml` and regenerate.
- **Faster iteration**: new fields flow into forms and API schema quickly.
- **Reusability**: the ontology can be extended without editing TypeScript by hand (tenant/extension work is planned as a later phase).
- **Interoperability**: RDF URIs (`class_uri`, `slot_uri`) are carried through the system to enable future SPARQL/LOD export.

### What stays the same (in MVP)

- Existing CIDOC CRUD endpoints and typed models remain the **system of record**.
- The UI loads **classes, fields, enums, and select `options`** from the schema registry API (or the committed `registry.generated.*` fallback). Rich layout (sections, column hints) can be driven from LinkML **annotations** on classes/slots and from `tools/ui-classmap.yaml`.

---

## For new users (how to use it)

### When things are working

- The UI loads a schema registry from the backend:
  - `GET /api/v1/cidoc/schema/registry/` (**public**; authentication is not required)
- The payload includes **classes**, **enums**, **`contribute_hub`** (contribute landing copy from `tools/contribute-hub.yaml`), and per-field metadata including RDF `slot_uri` and enum-backed **`options`** for selects.

### If the backend schema API is down

- The UI will fall back to a generated snapshot:
  - `heritage_graph_ui/src/lib/ontology/registry.generated.json`
- You’ll see a non-blocking “fallback snapshot” banner in the dashboard UI.

---

## For developers (how it works)

### Key components

#### Ontology source

- `ontology/HeritageGraph.yaml`: LinkML schema.
  - `classes.*.class_uri`: RDF class URI
  - `slots.*.slot_uri`: RDF predicate URI
  - `enums.*`: controlled vocabularies

#### Generator (offline snapshot)

- `tools/linkml_generate_registry.py`
  - Emits:
    - `heritage_graph_ui/src/lib/ontology/registry.generated.json`
    - `heritage_graph_ui/src/lib/ontology/registry.generated.ts`
  - Purpose: CI/offline fallback, and a predictable “known good” registry.
- `tools/contribute-hub.yaml` — contribute dashboard categories, per-type blurbs, routes, and quick-start keys (merged into the generated registry and API payload).

Run it from repo root:

```bash
make ontology
# or
python3 tools/linkml_generate_registry.py
```

CI / drift check:

```bash
make ontology-check
# or
python3 tools/linkml_generate_registry.py --check
```

#### Backend schema registry API

- **Deep dive:** [Backend schema registry (Django)](backend-schema-registry.md) — DB snapshot vs live YAML build, `rebuild_schema_registry`, degraded mode, ETag behavior.
- Builder (PyYAML-only MVP, no linkml-runtime required):
  - `heritage_graph/apps/cidoc_data/ontology_builder.py`
- Loader/cache:
  - `heritage_graph/apps/cidoc_data/linkml_loader.py`
- Endpoint:
  - `heritage_graph/apps/cidoc_data/views.py` → `OntologySchemaRegistryView`
  - Mounted under both:
    - `/cidoc/schema/registry/`
    - `/api/v1/cidoc/schema/registry/`

Caching:

- Uses `ETag: "<schema_version>"`.
- Honors `If-None-Match` (returns `304 Not Modified`).
- `Cache-Control: private, max-age=<HERITAGEGRAPH_SCHEMA_CACHE_TTL>`.

#### Frontend runtime

- `heritage_graph_ui/src/lib/ontology/registry.generated.ts` — committed snapshot (classes, enums, `contribute_hub`); used before auth / when the API is unavailable.
- `heritage_graph_ui/src/lib/ontology/load-registry.ts` — fetches `GET /api/v1/cidoc/schema/registry/` (optional `Authorization: Bearer`); the dashboard currently triggers this fetch after sign-in, but the endpoint itself allows anonymous `GET`.
- `heritage_graph_ui/src/lib/ontology/OntologyProvider.tsx` — supplies `registry` (including `contribute_hub`) to forms and the contribute dashboard.

Important detail:

- **No hand-maintained `registry.ts`.** Edit LinkML + `tools/ui-classmap.yaml` + `tools/contribute-hub.yaml`, run `make ontology`, commit the updated `registry.generated.*`, and rebuild the backend schema cache (`rebuild_schema_registry`) when deploying.

---

## Editing the ontology (maintainers)

### Common operations

#### Add a new enum value

1. Edit `ontology/HeritageGraph.yaml` under `enums:`.
2. Regenerate:

```bash
make ontology
```

3. Restart backend (so the schema API reloads), refresh UI.

#### Add a new slot to a class

1. Add the slot under `slots:` (include `range`, `description`, and `slot_uri` where possible).
2. Add the slot name to `classes.<ClassName>.slots:` (or `slot_usage:` as needed).
3. Regenerate (`make ontology`) and refresh.

Notes:

- The MVP backend builder supports basic inheritance via `is_a`.
- For **select** fields whose slot `range` is a LinkML enum, the builder attaches **`options`** from the emitted `enums` map so the UI does not depend on a parallel TypeScript enum file.

---

## Configuration (environment variables)

Configured in `.env.example` (do not commit secrets):

- `HERITAGEGRAPH_SCHEMA_PATH` (default: `ontology/HeritageGraph.yaml`)
- `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` (optional; future multi-tenant extensions)
- `HERITAGEGRAPH_SCHEMA_CACHE_TTL` (default: `60`)
- `RDF_ENDPOINT_URL`, `RDF_SYNC_ENABLED` (reserved for the RDF sidecar phase)

---

## Troubleshooting

### Banner: “Ontology schema served from fallback snapshot — it may be stale until the API loads.”

That text appears when the app **could not use a fresh live registry** and fell back to the committed `registry.generated.*` snapshot, **and** marked the load as degraded (`degradedReason === "snapshot"`). Typical causes:

1. **API request failed** (network error, CORS, 401/403/5xx, wrong URL) — the UI catches the error and keeps the bundled snapshot with `degraded: true`.
2. **Backend responded with `degraded: true`** — Django could not build YAML from disk and served a last-known-good `SchemaRegistry` row from the database (still “live” response, but flagged stale).

**What fixes it (check in order):**

| Step | Action |
|------|--------|
| 1 | **Sign in** with Google if you expect the **in-app** live refresh (`OntologyProvider` only calls the API when the session is authenticated). The HTTP endpoint itself does **not** require auth; you can also verify with `curl` without a token. If you are not signed in, the UI stays on the bundled snapshot **without** setting this degraded banner (different state). |
| 2 | Set **`NEXT_PUBLIC_API_URL`** in the Next.js env to your Django API origin (e.g. `http://backend.localhost` or production URL). If it is missing, a different warning applies (`ApiBaseWarning`); if it is wrong, the fetch fails → snapshot banner. |
| 3 | Confirm the backend is **running** and **`GET /api/v1/cidoc/schema/registry/`** returns **200** (with or without `Authorization: Bearer`). Fix TLS, hostname, and reverse-proxy routing (e.g. Traefik) if needed. |
| 4 | In the browser **Network** tab, find the registry request: if **404**, URL prefix is wrong. If **CORS** errors, allow the frontend origin on Django/CORS settings. **401** on this route is unexpected now that the view is public; if you see it, check for a proxy or middleware forcing auth. |
| 5 | After schema or deploy changes on the server, run **`python manage.py rebuild_schema_registry`** so the DB-backed cache is not ancient. |
| 6 | If the API returns **200** with **`"degraded": true`**, fix **YAML** on the server (`HERITAGEGRAPH_SCHEMA_PATH`), then rebuild the registry cache command above. |

**After fixing**, hard-refresh the app or trigger a reload (the provider refetches when the session is ready). The banner should disappear once a **successful** registry response is received with **`degraded: false`**.

See also: [YAML schema workflow — Troubleshooting](guides/developers/yaml-schema-workflow.md#14-troubleshooting) for operators.

### Schema endpoint returns 503

- YAML could not be parsed and there is no last-known-good `SchemaRegistry` row yet.
- Fix the YAML and run:

```bash
cd heritage_graph
python manage.py rebuild_schema_registry
```

---

## Roadmap (what’s planned next)

- **Tenant extensions**: allow institutions to add classes and override labels without changing core YAML.
- **Dynamic entities**: store extension-only classes in a schema-validated JSON store.
- **RDF sidecar sync**: write-through triples to a triplestore for SPARQL/LOD (feature-flagged).

