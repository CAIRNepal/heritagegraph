# Data model: Reviewer triage and schema extension approval

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## 1. Existing entities (read paths)

### `CulturalEntity` (`heritage_data`)

- **Use**: Review queue rows (`ReviewQueueViewSet` queryset).
- **Relevant fields**: `entity_id`, `name`, `description`, `category`, `status`, `contributor`, `created_at`, `updated_at`, fork fields.
- **Relations**: `review_flags`, `review_decisions`, `revisions`, `current_revision`.

### `ReviewFlag`

- **Use**: `flag_type` (`contradiction` vs others), `is_resolved` → `flag_count`, `has_conflicts`, filters.

### `HeritageAssertion` + `DataSource` (`cidoc_data`)

- **Use**: Resolve **source trust tier** for queue item when assertions cite `DataSource` for the entity as subject (see [research.md](./research.md) R-002).

### `ReviewerRole`

- **`expertise_areas`**: JSON list of strings; drives `my_domain=true` filter (already in `ReviewQueueViewSet`).

---

## 2. New / extended conceptual entities

### 2.1 `TriagePolicy` (new model, suggested)

Single-row or versioned rows; if versioned, “active” pointer or `is_active` flag.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `is_active` | Boolean | Only one active if multiple rows |
| `w_age`, `w_flags`, `w_conflict`, `w_source` | Decimal | Bounds validated (e.g. 0–10) |
| `s_max_days`, `f_max_flags` | Positive int | Normalization caps |
| `tier_rank_json` | JSON | Ordered list of `DataSource.source_type` values worst→best or best→worst + display labels |
| `updated_at`, `updated_by` | datetime, FK User | Audit |

**Validation**: Weights non-negative; at least one weight > 0; `s_max_days` ≥ 1.

### 2.2 Queue serializer extensions (derived, not stored)

Returned on each queue row (names illustrative):

| Field | Type | Notes |
| --- | --- | --- |
| `triage_priority` | int | Integer sort key (see research R-001) |
| `triage_breakdown` | object | Per-component values + labels |
| `worst_source_tier` | string | Display tier name |
| `worst_source_type` | string nullable | Raw `DataSource.source_type` if any |

---

## 3. `SchemaExtensionProposal` (new model)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `title` | CharField | Short label |
| `description` | TextField | Author intent |
| `author` | FK User | |
| `status` | CharField | `draft`, `submitted`, `approved`, `rejected`, `published`, `withdrawn` |
| `base_schema_version` | CharField | Captured at submit from registry |
| `proposed_yaml` | TextField | LinkML fragment or full document per policy |
| `submitted_at`, `resolved_at` | datetime nullable | |
| `moderator_comment` | TextField blank | Required on reject; on approve optional + audit still captures |
| `published_schema_version` | CharField nullable | Filled after successful publish |
| `published_extension_hash` | CharField nullable | From payload after publish |
| `conflict_keys` | JSONField default list | Affected slot/class keys for collision detection |

**State transitions**

```text
draft ──submit──► submitted ──approve──► approved ──publish──► published
  │                  │                └──reject──► rejected
  └──withdraw──► withdrawn
submitted ──withdraw──► withdrawn (if policy allows)
published ──operator rollback──► (audit only; proposal row may gain `reverted_at` optional field or new audit action)
```

**Rules**

- `approve` / `reject` / `publish`: moderator only.
- `submit`: author only when `draft`.
- `publish`: only from `approved`, idempotent guard.

---

## 4. `SchemaExtensionAuditEvent` (new model, append-only)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `proposal` | FK `SchemaExtensionProposal` | CASCADE |
| `actor` | FK User | |
| `action` | CharField | e.g. `created`, `submitted`, `approved`, `rejected`, `published`, `withdrawn`, `rollback_marked` |
| `from_status`, `to_status` | CharField nullable | |
| `comment` | TextField blank | |
| `schema_version_snapshot` | CharField nullable | Registry version after publish if applicable |
| `created_at` | datetime | auto_now_add |

**Rules**: No updates/deletes via API; rows are immutable.

---

## 5. Indexes (suggested)

- `SchemaExtensionProposal(status, submitted_at)` — moderator queue.
- `SchemaExtensionProposal(author_id, status)` — author dashboard.
- `SchemaExtensionAuditEvent(proposal_id, created_at)` — timeline.

---

## 6. Validation (business)

- **Publish**: run LinkML parse + structural checks + collision with other `submitted`/`approved` proposals (R-007).
- **Triage**: recompute on read (or cache in queryset annotation with `Subquery` for hot path — implementation detail left to tasks).
