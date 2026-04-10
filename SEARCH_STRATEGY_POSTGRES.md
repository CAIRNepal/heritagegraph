# End-to-End Search Strategy (PostgreSQL-first) — HeritageGraph

**Audience:** CTO / Engineering leadership  
**Goal:** Deliver a robust, fast, and maintainable search experience across knowledge objects (CIDOC + CulturalEntity), users/contributors, and public discovery—using PostgreSQL as the primary search engine.

---

## Executive Summary

HeritageGraph already has “search-like” functionality, but it is mostly implemented as `__icontains` across multiple fields and models (e.g., `/cidoc/search/`, landing discovery counts). This approach does not scale well: it produces sequential scans, weak relevance ranking, and expensive repeated `COUNT()` queries for facets.

This document proposes a pragmatic search architecture:

- **PostgreSQL Full-Text Search (FTS)** for relevance-ranked, indexed search across text fields.
- **Trigram indexing (`pg_trgm`)** for autocomplete/suggestions and tolerant matching.
- **A unified, versioned search API** (Django/DRF) that supports query, facets, filters, sorting, pagination, and suggestions.
- **A “search document” abstraction** (either per-model `tsvector` columns or a dedicated `search_document` table) to avoid cross-model ORMs doing heavy work at request time.
- **Caching** for hot queries and facet counts (using the no-Redis approach already adopted).
- A **clear upgrade path** to Elasticsearch/OpenSearch when PostgreSQL becomes the bottleneck.

---

## 1) Search Requirements & Use Cases

### Primary search scenarios

- **Global knowledge search**
  - Search across: CIDOC records (persons, locations, events, traditions, monuments, rituals, etc.) and Heritage Data `CulturalEntity` (new workflow).
  - Results should show: title/name, type, short summary, location hint, status/published, and deep link.
- **Discovery search (marketing/landing)**
  - Public search with type tabs (monuments/persons/deities/...) and facet counts.
  - Performance and fast “perceived speed” are critical.
- **User search**
  - Search for contributors/users by username/full name and optionally organization.
  - Used by leaderboard/contributor directory and admin experiences.
- **Leaderboard search**
  - Filter by name/institution; eventually support “top contributors in last 30 days” and similar.

### Search feature types (what we must support)

- **Full-text search**
  - Relevance-ranked matching across multiple text fields.
  - Phrase and prefix behavior for short queries.
- **Filtering (facets)**
  - `type` (resource): persons, locations, events, monuments, cultural_entities, users, …
  - `status` (published vs pending_review/draft/rejected)
  - Optional domain filters (category, country, time period) as the data model supports them.
- **Sorting**
  - `relevance` (default)
  - `newest` (created_at/updated_at)
  - `popularity` (when signals exist: views, reactions, shares)
- **Autocomplete / suggestions**
  - Query completion for names/titles.
  - “Did you mean?” for common misspellings (later).

### Non-goals (for phase 1)

- Complex semantic search, embeddings, or vector search.
- Cross-language morphological analysis beyond what Postgres dictionaries support.
- Highly personalized ranking (keep it simple initially).

---

## 2) Database Search Strategy (PostgreSQL-focused)

### Key design decision: how to represent “searchable documents”

We have two pragmatic options; choose based on time-to-deliver and model complexity.

#### Option A (fastest to ship): per-model FTS (`tsvector`) columns + indexes

Add a generated `search_vector` to each major searchable model (CIDOC models + CulturalEntity + UserProfile/Contributor).

Pros:
- Minimal new tables.
- Strong performance for single-model search endpoints.

Cons:
- Cross-model “global search” still requires multiple queries or a UNION strategy.

#### Option B (recommended for unified global search): a dedicated `search_document` table

Create a table that stores a normalized document per entity:

- `resource` (persons/locations/monuments/cultural_entities/users/…)
- `object_id` (PK as text/uuid)
- `title`
- `summary`
- `tsv` (`tsvector`)
- `updated_at`
- optional ranking signals (popularity_score, recency_boost)

Pros:
- One indexed table to query for global search.
- Easier to implement facets and consistent ranking.
- Keeps DRF API stable even if models evolve.

Cons:
- Requires background refresh strategy (signals or scheduled jobs).

**Recommendation:** Start with **Option B** for global search + keep Option A for certain high-traffic single-model endpoints where needed.

---

### PostgreSQL full-text search (FTS) primitives

- Use `to_tsvector(config, text)` to build the vector.
- Use `plainto_tsquery` for user-entered queries in phase 1 (safe and simple).
- Use `websearch_to_tsquery` to support quotes and `-term` later.
- Use `ts_rank_cd` (cover density ranking) for relevance ordering.

**Ranking model (phase 1):**
\[
score = 0.80 \cdot text\_rank + 0.15 \cdot recency\_boost + 0.05 \cdot popularity\_boost
\]

Where:
- `text_rank`: `ts_rank_cd(tsv, query)`
- `recency_boost`: e.g., `1 / (1 + age_in_days)`
- `popularity_boost`: normalized (0..1) from reactions/shares/views (if tracked)

Keep these weights configurable in application settings.

---

### Autocomplete / suggestions strategy (Postgres)

For typeahead suggestions, FTS can feel “too heavy” and doesn’t naturally do prefix matching on raw names. Use trigram indexing:

- Enable extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- Use `gin (title gin_trgm_ops)` on normalized `title`/`name` columns in `search_document`.
- Query using `ILIKE` with prefix or `similarity(title, :q)` ordering.

**Recommendation:**
- If `len(q) < 3`: do prefix match only.
- If `len(q) >= 3`: use trigram similarity.

---

### Indexing strategy

For `search_document`:

- **GIN index on `tsv`** for FTS:
  - `CREATE INDEX ... ON search_document USING GIN(tsv);`
- **B-tree indexes** for filters/sorting:
  - `(resource)`, `(is_published)`, `(updated_at)`, `(status)` if stored.
- **GIN trigram index** for suggestions:
  - `CREATE INDEX ... ON search_document USING GIN(title gin_trgm_ops);`
- **Partial indexes** where helpful:
  - e.g., only for published docs: `WHERE is_published = true`

For existing CIDOC models (if keeping Option A):
- Add `search_vector` + GIN index per model.

---

### Schema changes (proposed)

**New table (recommended): `search_document`**

Minimal fields:
- `id` (UUID)
- `resource` (text enum-like)
- `object_pk` (text) — store model PK as string (uuid/int)
- `title` (text)
- `summary` (text, optional)
- `tsv` (tsvector)
- `status` (text, optional)
- `is_published` (boolean)
- `updated_at` (timestamp)
- `popularity_score` (numeric, default 0)

**Refresh strategy:**
- On writes: invalidate/update the corresponding row.
- Nightly: full rebuild job as safety net (ensures consistency).

---

### Performance for large datasets

Key constraints:
- Keep search queries index-driven (GIN for `tsv`, GIN trigram for suggestions).
- Limit payload size and fields returned from the DB.
- Use stable pagination (keyset) for deep paging if needed.

Phase 1 pagination:
- Offset pagination is acceptable up to moderate sizes and shallow browsing.
Phase 2:
- Keyset pagination for “infinite scroll” experiences and large result sets.

---

## 3) API Design (Django/DRF)

### Endpoint set (versioned)

Create a stable, versioned set (examples):

- `GET /data/search/` (global search; authenticated optional)
- `GET /data/search/suggest/` (autocomplete suggestions)
- `GET /cidoc/search/` (keep existing; mark as legacy; migrate UI to `/data/search/`)
- `GET /cidoc/discovery/` (public discovery; upgrade implementation under the hood)

### `GET /data/search/` contract

Query params:
- `q` (string, required)
- `resource` (multi): `persons,locations,monuments,cultural_entities,users,...`
- `status` (optional): `accepted,pending_review,...`
- `published` (bool; default true for public callers)
- `sort`: `relevance|newest|popularity`
- `page`, `page_size`
- `facets` (bool): whether to include facet counts in response

Response shape:

```json
{
  "q": "pashupati",
  "page": 1,
  "page_size": 20,
  "count": 123,
  "facets": {
    "resource": { "monuments": 54, "persons": 21, "deities": 48 },
    "status": { "accepted": 110, "pending_review": 13 }
  },
  "results": [
    {
      "resource": "monuments",
      "id": "123",
      "title": "Pashupatinath Temple",
      "summary": "…",
      "status": "accepted",
      "is_published": true,
      "updated_at": "2026-04-10T10:12:00Z",
      "score": 0.812,
      "url": "/knowledge/monument/view/123"
    }
  ]
}
```

### Query execution strategy

- Use Postgres FTS against `search_document.tsv`.
- Apply filters before sorting where possible.
- Fetch only needed columns (title/summary/id/resource/status/updated_at/score).
- `facets=true` should:
  - compute counts from `search_document` (fast with indexes), and/or
  - return cached facet results for hot query/resource combinations.

### Caching considerations (search-specific)

Search caching must be conservative:
- Cache **public**, **global** search results for common queries with short TTL (e.g., 30–120s).
- Cache **facet counts** more aggressively than results (e.g., 2–10 minutes), because they are expensive and less sensitive.
- Do not cache user-specific results globally.

Recommended cache keys:
- `search:v1:results:{hash(q,filters,sort,page,page_size)}`
- `search:v1:facets:{hash(q,filters)}`

Add headers:
- `X-Cache: hit|miss|bypass`
- `Cache-Control: public, max-age=60` for public endpoints where safe.

### Response size optimization

- Keep result items compact; do not embed full entity payloads.
- Provide deep links and minimal highlights; fetch entity details on click.

---

## 4) UI/UX Search Experience (Next.js)

### Global search bar behavior

- **Location:** top nav (dashboard) and landing header (public).
- **Debounce:** 150–250ms for suggestions, 300–500ms for full search.
- **Keyboard support:** `↑/↓` to navigate suggestions, `Enter` to submit.
- **History:** store recent queries client-side (localStorage), show last 5.

### Suggestions (typeahead)

- Show top 5–10 suggestions:
  - Title + resource badge + short location hint (if available)
- If API errors:
  - show non-blocking “Suggestions unavailable” and allow full search submit.

### Filters and facets UI

Start simple:
- Resource/type tabs or chips
- Status filter (published/accepted only by default; reviewers can see all)
- Sort dropdown (Relevance/Newest/Popularity)

Facets behavior:
- Show counts next to each resource tab.
- Update counts when query changes; use cached facet responses.

### Result layout and hierarchy

- Grouped or blended results:
  - Phase 1: blended list sorted by relevance, with resource badge.
  - Phase 2: optional grouped sections (Monuments/Persons/Deities) for broad queries.
- Each result card:
  - Title (highlight matched terms if feasible)
  - Summary snippet
  - Metadata: resource, updated_at, location hint, status (if user can see)

### Empty/loading/error states

- **Loading:** skeleton rows + “Searching…”
- **Empty:** show “No results for ‘q’”, propose:
  - spelling tips
  - broadening filters
  - resource suggestions (e.g., switch to “All types”)
- **Error:** show a retry CTA; keep query in input.

### Make it feel fast

- Optimistic UI: keep previous results visible while fetching new results (“stale-while-revalidate” on the client).
- Prefetch details for the top result on hover/focus (optional).

---

## 5) Performance & Scalability

### High query volume strategies

- Keep the hot path index-only or index-driven.
- Cache facets and common queries.
- Rate limit `/suggest/` more aggressively than full search.
- Enforce `page_size` max (e.g., 50) and require pagination.

### Pagination vs infinite scroll

- **Pagination**: predictable, easier to cache, avoids runaway queries.
- **Infinite scroll**: better UX for exploration but needs keyset pagination to avoid slow offsets.

Recommendation:
- Phase 1: pagination.
- Phase 2: keyset pagination for infinite scroll on specific pages.

### When Postgres search becomes a bottleneck

Indicators:
- `tsvector` GIN indexes become large and memory pressure rises.
- p95 search latency increases due to IO or CPU.
- Autocomplete query volume dominates.
- Need multi-field, multi-language analyzers, complex boosting, or typo tolerance at scale.

At that point, move to Elasticsearch/OpenSearch.

---

## 6) Relevance & Ranking

### Phase 1 ranking (simple and good)

- `ts_rank_cd` + modest recency boost.
- Popularity boost only if a stable signal exists.

### Improving relevance over time

- Log clicked results (anonymized/aggregated) to learn:
  - which resources users intend for common queries
  - common zero-result queries
- Add synonyms / normalization:
  - e.g., “Pashupati” ~ “Pashupatinath”
- Add per-resource boosting:
  - For short queries, boost exact title matches.
- Add “field weighting”:
  - Title/name weight > aliases > description.

---

## 7) Monitoring & Continuous Improvements

### What to track

- Search latency (p50/p95/p99) per endpoint.
- DB time and query plans for worst offenders.
- Cache hit rate for facets and results.
- Query volume and top queries.
- No-result rate and “refine then click” patterns.

### Instrumentation plan (minimal new infra)

- Structured logs per search request:
  - `q_hash`, `resource_filters`, `latency_ms`, `db_ms`, `result_count`, `cache_hit`
- Sample slow searches and store:
  - query text (or hashed), filters, execution time, query plan (periodic).

### Continuous improvement loop

- Weekly review:
  - top no-result queries
  - top slow queries
  - top queries with low click-through
- Ship small improvements:
  - synonyms, better snippets, better default filters, better suggestions.

---

## 8) Future Upgrade Path (Elasticsearch/OpenSearch)

### When to migrate

Move off Postgres search when:
- You need advanced typo tolerance, multi-lingual analyzers, heavy boosting, or near-real-time indexing at high throughput.
- Search traffic materially impacts primary OLTP workload.

### Migration strategy (minimize churn)

Design now so the API remains stable:
- Keep `/data/search/` and `/data/search/suggest/` response shapes stable.
- Keep `search_document` as the canonical “document shape”; it becomes the indexing input for ES.

Incremental migration:
1) Add an asynchronous indexer that mirrors `search_document` into ES.
2) Shadow-read: compare Postgres vs ES results for a subset of traffic.
3) Switch reads to ES gradually (feature flag).
4) Keep Postgres FTS as fallback until stable.

---

## Appendix: Current State (Observed) and Key Gaps

- `cidoc_data` currently exposes:
  - `/cidoc/search/` implemented via `icontains` OR filters across multiple models.
  - `/cidoc/discovery/` computes counts per type via repeated `.count()` queries and returns up to 100 results.
- `heritage_data` leaderboard and contributors implement “search” via **in-memory filtering** after building full result sets, which will not scale.

**Immediate wins:**
- Replace `icontains` search with indexed Postgres FTS.
- Move leaderboard/user directory search to DB-backed filtering (and/or precomputed snapshots).
- Cache discovery facet counts and/or compute them from `search_document` with proper indexing.

