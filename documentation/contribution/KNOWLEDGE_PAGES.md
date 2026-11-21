# Knowledge list pages — purpose, status, and verification

> **Audience:** contributors, reviewers, and developers validating that tabular `/knowledge/*` pages show accepted heritage data correctly.

Each navigable ontology class in `tools/ui-classmap.yaml` maps to a **list route** (`/knowledge/<key>`), a **DRF list API**, and usually a **contribute form**. This document records whether those pages fulfill their intended purpose (browse accepted records after review, link to detail views, and connect to the contribution pipeline).

**Related:** [`FORMS.md`](FORMS.md) (forms and registry), [`../testing/TESTING.md`](../testing/TESTING.md) (E2E commands).

---

## Intended purpose

| Layer | What users expect |
|-------|-------------------|
| **Contribute** | `POST` creates `pending_review` CIDOC row + `CulturalEntity` wrapper |
| **Review** | Reviewer `decide` → `accepted` on both wrapper and linked CIDOC row |
| **Knowledge table** | Browse **approved** rows; open detail view; optional All/Pending tabs for staff workflow |
| **Detail view** | `/knowledge/<domain>/view/<id>` loads the same record from the list API |
| **KG / museum** | Accepted rows also project to Oxigraph (separate from table UI) |

---

## How tables load data

| Component | Role |
|-----------|------|
| [`GenericDataTable`](../../heritage_graph_ui/src/components/generic-data-table/generic-data-table.tsx) | Server pagination (`limit`/`offset`, default 20, max 100), debounced `?search=`, status tab → query params |
| [`columns.tsx`](../../heritage_graph_ui/src/components/generic-data-table/columns.tsx) | Hand-tuned columns for 14 “primary” domains |
| [`[domain]/page.tsx`](../../heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/page.tsx) | Fallback list for other registry keys (status column + auto fields) |
| [`[domain]/view/[id]/page-client.tsx`](../../heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx) | Generic detail view |

**List API visibility** (`apps/cidoc_data/list_visibility.py`):

- **Default (Approved tab):** published catalog only — `accepted`, `merged`, `published`, or legacy null/empty status.
- **`?status=pending_review`:** owner sees own pending rows; staff sees all.
- **`?mine=1`:** authenticated contributor’s rows (any status).
- **Staff + `?all=1`:** full table (All tab).

**Status tabs (All / Pending / Approved / Rejected):**

- Enabled on all contribution-backed tables except **browse-only** domains (`assertion`, `entity_cluster`).
- Default tab is **Approved** (no extra query param — backend published default).
- Tabs drive **server-side** filters via `statusQueryParamsForTab()` in the UI.

**In-place edits:** PATCH on a published CIDOC row resets `status=pending_review`, appends a `Revision`, and re-queues the linked `CulturalEntity` for review (`ContributionFlowMixin.perform_update`).

---

## Page matrix (26 navigable types)

| Registry key | List URL | Table implementation | List API | Contribute | Purpose status |
|--------------|----------|----------------------|----------|------------|----------------|
| `person` | `/knowledge/person` | Static `personTableConfig` | `/cidoc/persons/` | `/contribute/person` | **OK** — browse + status tabs |
| `location` | `/knowledge/location` | Static `locationTableConfig` | `/cidoc/locations/` | `/contribute/location` | **OK** |
| `event` | `/knowledge/event` | Static `eventTableConfig` | `/cidoc/events/` | `/contribute/event` | **OK** |
| `tradition` | `/knowledge/tradition` | Static `traditionTableConfig` | `/cidoc/traditions/` | `/contribute/tradition` | **OK** |
| `source` | `/knowledge/source` | Static `sourceTableConfig` | `/cidoc/sources/` | `/contribute/source` | **OK** |
| `deity` | `/knowledge/deity` | Static `deityTableConfig` | `/cidoc/deities/` | `/contribute/deity` | **OK** |
| `guthi` | `/knowledge/guthi` | Static `guthiTableConfig` | `/cidoc/guthis/` | `/contribute/guthi` | **OK** |
| `structure` | `/knowledge/structure` | Static `structureTableConfig` | `/cidoc/structures/` | `/contribute/structure` | **OK** (custom detail view at `structure/view/[id]`) |
| `ritual` | `/knowledge/ritual` | Static `ritualTableConfig` | `/cidoc/rituals/` | `/contribute/ritual` | **OK** |
| `festival` | `/knowledge/festival` | Static `festivalTableConfig` | `/cidoc/festivals/` | `/contribute/festival` | **OK** |
| `iconography` | `/knowledge/iconography` | Static `iconographyTableConfig` | `/cidoc/iconographic_objects/` | `/contribute/iconography` | **OK** |
| `monument` | `/knowledge/monument` | Static `monumentTableConfig` | `/cidoc/monuments/` | `/contribute/monument` | **OK** |
| `period` | `/knowledge/period` | Static `historicalPeriodTableConfig` | `/cidoc/historical_periods/` | `/contribute/period` | **OK** |
| `entity` | `/knowledge/entity` | Static `culturalEntityTableConfig` | `/data/api/cultural-entities/` | `/contribute/entity` | **OK** — accepted-only for non-staff |
| `production` | `/knowledge/production` | Generic `[domain]` | `/cidoc/productions/` | `/contribute/production` | **OK** (empty until contributions) |
| `consecration` | `/knowledge/consecration` | Generic | `/cidoc/consecrations/` | `/contribute/consecration` | **OK** |
| `enshrinement` | `/knowledge/enshrinement` | Generic | `/cidoc/enshrinements/` | `/contribute/enshrinement` | **OK** |
| `transfer_of_custody` | `/knowledge/transfer_of_custody` | Generic | `/cidoc/transfers_of_custody/` | `/contribute/transfer-of-custody` | **OK** |
| `kumari_tenure` | `/knowledge/kumari_tenure` | Generic | `/cidoc/kumari_tenures/` | `/contribute/kumari-tenure` | **OK** |
| `kumari_selection` | `/knowledge/kumari_selection` | Generic | `/cidoc/kumari_selections/` | `/contribute/kumari-selection` | **OK** |
| `kumari_retirement` | `/knowledge/kumari_retirement` | Generic | `/cidoc/kumari_retirements/` | `/contribute/kumari-retirement` | **OK** |
| `syncretism` | `/knowledge/syncretism` | Generic | `/cidoc/syncretic_relationships/` | `/contribute/syncretism` | **OK** |
| `caste_group` | `/knowledge/caste_group` | Generic | `/cidoc/caste_groups/` | `/contribute/caste-group` | **OK** |
| `calendar` | `/knowledge/calendar` | Generic | `/cidoc/calendar_systems/` | `/contribute/calendar` | **OK** |
| `assertion` | `/knowledge/assertion` | Generic (no status tabs) | `/cidoc/assertions/` | `/contribute/assertion` | **Browse-only** — provenance edges, not a contribution catalog |
| `entity_cluster` | `/knowledge/entity_cluster` | Generic (no status tabs) | `/cidoc/entity-clusters/` | `/contribute/entity-proposal` | **Browse-only** — identity anchors, not direct entity forms |

All list APIs were smoke-tested (HTTP 200 + paginated `results`) in `apps.cidoc_data.test_knowledge_list_apis`.

---

## Accepted data visibility (critical path)

After reviewer acceptance:

1. `CulturalEntity.status` → `accepted`
2. Linked CIDOC row (`_cidoc_model` / `_cidoc_id` on revision) → `status=accepted` via `_sync_linked_cidoc_status()` in `heritage_graph/apps/heritage_data/models.py`
3. **CIDOC tables** — row appears under the **Approved** tab (`status=accepted`)
4. **Entity table** — row returned by `/data/api/cultural-entities/` for non-staff
5. **Detail links** — `culturalEntityViewHref()` routes CIDOC-backed entities to `/knowledge/<domain>/view/<cidoc_id>` when revision metadata is present

Automated coverage: `PlatformContributionReviewAcceptE2ETest` in `apps/graph/test_platform_e2e.py`, `validate_contribution_pipeline` management command.

---

## Known limitations

| Limitation | Impact |
|------------|--------|
| **Tab badge counts** | Server-paginated tables show total count for the active tab only (not per-tab totals). |
| **Staff All tab** | Requires staff session + `?all=1`; non-staff All tab still shows published catalog only. |
| **Generic columns** | Fallback pages show status + up to four scalar registry fields — less rich than hand-tuned `columns.tsx` pages. |
| **Assertion / entity_cluster** | No workflow status tabs; intended for provenance and identity browsing, not post-review entity catalogs. |
| **Staff vs contributor** | Staff sees all cultural entities in `/knowledge/entity`; contributors see accepted only. |
| **No headless UI test** | Table rendering is verified via API smoke + list-visibility tests; use manual browser check after deploy. |

---

## Verification commands

```bash
# All knowledge list APIs (26 navigable keys)
cd heritage_graph && DJANGO_ENV=development python manage.py test \
  apps.cidoc_data.test_knowledge_list_apis -v2

# Published-by-default list + retrieve visibility + published-edit re-review
cd heritage_graph && DJANGO_ENV=development python manage.py test \
  apps.cidoc_data.test_list_visibility -v2

# Full contribution → accept → list visibility
make test-e2e

# Pipeline command (location/structure/person + graph/atlas rules)
cd heritage_graph && DJANGO_ENV=development python manage.py validate_contribution_pipeline
```

### Manual UI checklist

1. Sign in → open `/knowledge/location` (or `ritual`, `entity`).
2. Confirm **Approved** tab is selected by default.
3. After a reviewed contribution, confirm the row appears with `status` accepted.
4. Click the name → detail view loads without error.
5. For `/knowledge/production` (generic page), confirm table renders and **Approved** tab works when data exists.

---

## File index

| File | Role |
|------|------|
| `heritage_graph_ui/src/app/(dashboard)/knowledge/*/page.tsx` | Static list stubs (14 domains) |
| `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/page.tsx` | Generic list fallback |
| `heritage_graph_ui/src/components/generic-data-table/columns.tsx` | Table configs + columns |
| `heritage_graph/apps/heritage_data/views.py` | `CulturalEntityViewSet` (accepted filter on list) |
| `heritage_graph/apps/cidoc_data/views.py` | `ContributionFlowMixin` + CIDOC ViewSets |
| `tools/ui-classmap.yaml` | Registry keys, `apiEndpoint`, `navigable` |
| `apps/cidoc_data/test_knowledge_list_apis.py` | CI smoke test for list APIs |

*Last verified: June 2026 — 26/26 list APIs OK, review-accept → CIDOC status sync, default Approved tab.*
