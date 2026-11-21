# Data model: YAML-driven schema registry (004-yaml-driven-schema)

**Date**: 2026-04-19  
**Spec**: `spec.md` | **Plan**: `plan.md`

## Logical entities

### OntologySource (file / artifact)

| Field | Description |
|-------|-------------|
| `path` | Filesystem path to core LinkML YAML (canonical repo path TBD). |
| `content_hash` | SHA-256 of file bytes for versioning. |

### TenantExtension (optional file or DB row, Phase B)

| Field | Description |
|-------|-------------|
| `tenant_id` | FK to `Tenant` when multi-tenant; null in single-tenant mode. |
| `extension_yaml` or `config` | LinkML extension fragment or YAML with `extends`, `slot_overrides`, `ui_overrides`. |
| `content_hash` | Hash for merge cache invalidation. |

### EffectiveSchema (computed, not necessarily a DB table)

| Field | Description |
|-------|-------------|
| `schema_version` | Hash of inputs + generator version (exposed to clients). |
| `merged_linkml` | `SchemaView`-compatible merged schema (in-memory; optionally persisted JSON for debugging). |
| `registry_payload` | JSON matching frontend `OntologyRegistry`: `{ classes, enums }` plus UI merge. |
| `json_schemas` | Per-class or global JSON Schema for client validation (optional nested object). |

### SchemaRegistry (persistent cache — Django)

Recommended fields (names illustrative):

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | PK |
| `schema_version` | CharField | Unique; content hash |
| `core_hash` | CharField | Hash of core YAML |
| `extension_hash` | CharField | Nullable; hash of tenant extension |
| `tenant` | FK nullable | Phase B; null = global default |
| `registry_json` | JSONField | Full effective registry payload |
| `jsonschema_blob` | JSONField | Optional; or store path to artifact |
| `created_at` / `updated_at` | DateTime | Audit |

**Purpose:** Fast cold start, audit trail, optional “last known good” when YAML parse fails (FR-007).

### DynamicOntologyEntity (tenant extension classes)

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | PK |
| `tenant` | FK | Required when multi-tenant; else omitted or default row |
| `class_key` | CharField | Matches ontology class key (e.g., `collection`) |
| `class_uri` | CharField | Denormalized from schema for RDF |
| `uri` | CharField | Unique per tenant — entity URI |
| `data` | JSONField | Slot values; validated against merged schema |
| `created_at` / `updated_at` | DateTime | Standard |

**Relationships:** Optional FKs to `User` for contributor if matching existing `MetaData` patterns.

### RDFSyncState (optional, for P3)

| Field | Description |
|-------|-------------|
| `entity_ref` | Generic FK or `(content_type_id, object_id)` to typed or dynamic row |
| `last_synced_version` | `schema_version` or row revision |
| `status` | pending / ok / error |
| `error_message` | Last failure (truncated) |

## Existing entities (unchanged role)

- **`Person`, `ArchitecturalStructure`, …** in `cidoc_data.models` — remain **system of record** for core CIDOC CRUD; serializers gain optional validation against induced slots from LinkML where feasible.
- **Revisions** (`*Revision` models) — continue; RDF sync may key off post-save signals after revision commit.

## Validation rules (from spec)

- **Unknown keys** on dynamic entities: reject in strict mode once schema is authoritative.
- **Removed slot** with legacy DB data: preserve in JSON; hide from form; surface in admin or “extra fields” (edge case in spec).
- **Slot type change:** generation/load must **fail closed** with migration-required error (spec edge case).

## State transitions

- **YAML parse error:** serve last `SchemaRegistry` row for tenant (FR-007); log alert; do not crash worker.
- **Extension invalid:** refuse merge for that tenant only; other tenants unaffected.
