# Quickstart: Identity Layer (development verification)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**: [contracts/openapi-identity-layer.v1.yaml](./contracts/openapi-identity-layer.v1.yaml)

## Prerequisites

- Backend env from [`.env.example`](../../.env.example) (Google auth vars for protected calls).
- `DJANGO_ENV=development`, database migrated.

## 1. Apply schema changes

After implementation lands:

```bash
cd heritage_graph
uv run python manage.py migrate
```

## 2. Bootstrap singleton clusters

Idempotent seed of one `EntityCluster` + one accepted membership assertion per existing CIDOC entity (see [data-model.md](./data-model.md)):

```bash
uv run python manage.py bootstrap_identity_clusters
```

Re-run should report **skipped** for already-bootstrapped rows (FR-010).

## 3. Health check (FR-011)

Run the documented management command or SQL from the implementation runbook (expected: **zero** entities missing active membership in supported classes).

## 4. Exercise API (curl)

Replace `TOKEN` and host with your dev values. Versioned base:

`{API_ORIGIN}/api/v1/cidoc/`

```bash
# List clusters (public read if viewset allows AllowAny on list — align with product)
curl -sS "${API_ORIGIN}/api/v1/cidoc/entity-clusters/?type_scope=person" | jq .

# Create membership assertion (reviewer token)
curl -sS -X POST "${API_ORIGIN}/api/v1/cidoc/assertions/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": <person_content_type_id>,
    "object_id": <person_pk>,
    "asserted_property": "identity.same_referent",
    "entity_cluster": "<cluster-uuid>",
    "reconciliation_status": "accepted",
    "confidence": "likely"
  }'

# Merge cluster B into A (moderator / expert curator token)
curl -sS -X POST "${API_ORIGIN}/api/v1/cidoc/entity-clusters/<A-uuid>/merge/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"source_cluster_id":"<B-uuid>","reason":"Duplicate PN Shah","expected_version":0}'

# Identity summary for a knowledge subject (public read)
curl -sS "${API_ORIGIN}/api/v1/cidoc/identity-summary/?entity_type=person&entity_id=1" | jq .

# Split: partition active member integer IDs into groups (one new cluster per group)
curl -sS -X POST "${API_ORIGIN}/api/v1/cidoc/entity-clusters/<cluster-uuid>/split/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason":"bad merge","expected_version":1,"groups":[[1],[2]]}'

# Refresh heuristic identity candidates (Person + Location name match)
uv run python manage.py refresh_identity_candidates
```

### UI routes (implemented)

- Reviewer queue: `/curation/identity` (tabs by candidate `status`).
- Workspace: `/curation/identity/<candidateId>` (resolve + expert lock/unlock when applicable).
- Knowledge provenance tab loads identity summary beside assertions.

## 5. Ontology / registry

After LinkML and generator updates:

```bash
make ontology-check
```

Must pass in CI ([`.github/workflows/ontology-registry.yml`](../../.github/workflows/ontology-registry.yml)).

## 6. Frontend workspace (manual)

- Sign in as reviewer → **Curation → Identity queue** (`/curation/identity`) or open a candidate workspace.
- Confirm Bearer calls use `session.accessToken` ([constitution](../../.specify/memory/constitution.md)).

## 7. Automated tests (post-implementation)

- Pytest: merge/split round-trip (SC-004), audit row count (SC-003), lock denial for reviewer (US5).
- Optional Playwright: two-click claim drill-down (SC-002).
