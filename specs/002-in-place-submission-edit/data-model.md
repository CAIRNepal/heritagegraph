# Data model: In-place submission edit

**Spec**: `specs/002-in-place-submission-edit/spec.md`  
**Plan**: `specs/002-in-place-submission-edit/plan.md`  
**Date**: 2026-04-18

## Scope

- **In scope (P1–P2):** CIDOC-backed contributions edited through **`OntologyForm`**, identified by a **primary key** `id` in the list/detail URLs (same as view page).
- **CulturalEntity wrapper** (`/data/cultural-entities/{entity_id}/`): already has a **dedicated** edit/patch path in the UI; this document still references it where **CulturalEntity** and CIDOC **both** exist.

## Key entities (conceptual)

| Concept | Description |
|--------|-------------|
| **Ontology domain** | A key in the frontend registry (e.g. `person`, `monument`) with `apiEndpoint` such as `/cidoc/persons/`. |
| **Record (CIDOC instance)** | One saved row: person, location, event, etc., with a string **UUID** primary key in URLs in most cases. |
| **Contribute form state** | A flat `Record<fieldKey, value>` mirroring `OntologyField` keys, plus local UI state (current step, touched fields). |
| **Edit mode** | Mutually exclusive with “create”: if `id` (or `recordId`) is present, the form must not POST create; it GET-loads and PATCH-saves. |

## Field mapping: API → form

- **1:1 keys:** For each `OntologyField` with `key` matching a serializer / model attribute, use `formData[field.key] = record[field.key]` with normalization below.
- **Names vs title:** Some models use `name`, others `title` (e.g. Source). The view page already picks `displayName` from `name` or `title`; the form should use the same **ontology field** definitions so each domain only maps what it defines.
- **Coordinates:** If API returns a **string** like `"27.7, 85.3"` and the field is `type: "coordinates"`, parse into `{ lat, lng }` for controlled inputs. If the API returns an object, use it directly.
- **Omitted keys:** `undefined` / `null` / `""` → show empty for optional fields; do not substitute default strings that are not in the stored record.
- **Read-only system fields** (`id`, `contributor`, `status`, `created_at`, …): show in a **read-only** banner or metadata strip in edit mode; do not send in PATCH if the API rejects unknown keys—**or** use a serializer that `read_only`s them (backend reality).

## Field mapping: form → API (PATCH)

- **Partial PATCH:** Start by sending the same field bundle as create where values are **non-empty**; expand to “dirty only” if optimization is needed.
- **Coordinates:** If UI stores an object, serialize to the string format the serializer expects (match existing POST body construction in `OntologyForm`).

## Validation

- **Client:** Same `required` rules as create; if stored record violates **new** stricter rules (regulatory change), show field-level errors per spec edge case—user must be able to fix in-place.
- **Server:** 400 with field errors → surface via `getApiErrorMessage` / toast; do not clear loaded form on failure unless saving succeeded.

## State / workflow

| State | User-visible behavior |
|-------|------------------------|
| `idle_loading` | Spinner / skeleton, **no** empty form. |
| `load_error` | Error message, back link, **no** false “edit” form. |
| `editing` | All mapped fields + “Editing …” with id. |
| `saving` | Disable submit, optional optimistic UI. |
| `save_error` | Toast + keep draft in memory. |
| `save_ok` | Toast, redirect to view or stay per product choice. |

## Relationships (no schema migration expected)

This feature is primarily **read/write shape + permissions**; no new Django model is required for P1. If later **ETag** conflict handling is added, the contract may add optional headers—documented in the OpenAPI file when implemented.

## Authorization (logical)

- **Object-level:** only **contributor** match or **staff** can PATCH/DELETE, per `research.md` R-004. Exact field name on models is typically `contributor` (string username) on CIDOC resources—confirm per model in implementation.

## Out of scope (v1 P1)

- Revising **CulturalEntity** JSON `form_data` through the generic ontology route when the user is on an **Entity**-only view without a cidoc `id`—the **Entity** product area should continue using `PATCH /data/cultural-entities/:id/` (already present in `entity/edit`); unify UX copy only, not a single code path, unless a later spec merges them.
