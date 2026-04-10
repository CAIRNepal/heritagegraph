# Caching Strategy (No Redis) — HeritageGraph

**Audience:** CTO / Engineering leadership  
**Goal:** Reduce latency and database load for fetch-heavy, high-read pages (leaderboard, knowledge browse/view, review queues, discovery endpoints) without introducing Redis.

---

## Executive Summary

HeritageGraph’s slow pages are primarily a symptom of **repeated expensive database work** (aggregation, joins, counts, revision lookups) and **lack of coherent caching boundaries** across Django/DRF and the frontend. We can achieve meaningful performance gains by layering caching in four places—**query**, **API response**, **materialized/summary tables**, and **HTTP/browser**—using only existing infrastructure:

- **PostgreSQL**: precomputed summary tables/materialized views, and optionally Django’s database-backed cache.
- **Filesystem**: shared file-based cache for multi-worker deployments.
- **In-process memory**: micro-caches inside each Gunicorn worker for ultra-hot keys.
- **HTTP caching semantics**: `ETag` / `Last-Modified`, `Cache-Control`, and `Vary` (especially for auth).

This approach is pragmatic: it improves performance quickly, remains operationally simple, and preserves a clean upgrade path to Redis later if scale demands it.

---

## 1) Problem Analysis

### Why pages are slow today

Common causes in fetch-heavy Django/DRF systems (and consistent with HeritageGraph’s usage patterns):

- **Repeated identical queries per request**
  - The same expensive computation (counts, leaderboard aggregation, “latest revision”) is executed multiple times across serializers, nested relationships, and list endpoints.
- **N+1 query patterns**
  - List endpoints serialize related objects (profiles, statistics, revisions) without adequate `select_related()` / `prefetch_related()`.
- **High-cost aggregates computed on-demand**
  - Leaderboards, progression metrics, queue counts, and discovery facets often require `COUNT`, grouping, filtering, and sorting across large tables.
- **No shared caching boundary**
  - Frontend frequently re-fetches data (navigation, tab switches, page revisits), and the backend recomputes results each time.
- **Token-authenticated traffic complicates caching**
  - Many endpoints are authenticated; naive “public cache” can leak user-specific data unless keys vary properly.

### Categorize data by volatility

Define caching TTLs and invalidation per data class:

- **Static (days–weeks TTL)**
  - Ontology metadata, help/config endpoints, rarely-changing “about” content.
- **Semi-static (minutes–hours TTL)**
  - Knowledge browse lists (persons/locations/events), discovery counts, contributor directories, organization lists.
- **Dynamic (seconds–minutes TTL)**
  - Leaderboards, review queue counts, dashboard stats, “my notifications”, “my role”, activity logs.
- **Strictly user-specific (very short TTL or conditional caching)**
  - “Me” endpoints, permissions/roles, personalized queues, user stats tied to current user.

---

## 2) Caching Strategy (WITHOUT Redis)

### Why not Redis (now)

**Reasons to avoid Redis for the current phase:**

- **Ops complexity**: introduces a new always-on stateful service (backup, monitoring, persistence choices, upgrades).
- **Cost and reliability surface area**: one more component to secure and keep healthy.
- **Good-enough alternatives exist** for current scale: Postgres can store precomputed results; filesystem cache works across workers; HTTP caching reduces redundant fetches.

**Trade-offs (accepted):**

- **Less ideal under horizontal scaling**: in-process caches don’t share across pods/hosts; filesystem caches require shared volume to be truly global.
- **Higher latency vs Redis** for cache reads if using DB cache (still often far cheaper than recomputing aggregates).
- **Invalidation complexity** increases for computed artifacts (materialized views / summary tables).

### Layered caching: where it should occur

We should use multiple layers with clear ownership.

#### A) Query-level caching (DB work reduction)

**Goal:** Make each request cheaper even when cache misses occur.

- Use `select_related()` / `prefetch_related()` consistently on list endpoints.
- Avoid repeated aggregates inside serializers; compute once in the view and pass via serializer context.
- Use database indexes for common filters/sorts (queue filters, status fields, created_at).

**Micro-cache (in-process) for ultra-hot reads:**

- Store small, safe, global-only values (e.g., “queue counts”) for 5–30 seconds per worker.
- Never store user-specific payloads in per-worker caches unless key includes user id and TTL is short.

#### B) API-level response caching (DRF / Django cache)

**Goal:** Cache the full JSON response for expensive endpoints with clear TTLs and safe variation.

Recommended cache backends (no Redis):

- **Filesystem cache** (`FileBasedCache`): works across multiple Gunicorn workers on the same host/container volume.
- **Database cache** (`DatabaseCache`): centralized, uses Postgres; simplest to share across multiple backend instances (but adds DB load).
- **LocMem cache**: fastest but per-process only; use for tiny TTL micro-caches.

Rule of thumb:

- Use **file-based** cache if the backend runs as multiple Gunicorn workers on a single host and can share a volume.
- Use **DB cache** if you need cross-instance sharing and can accept some extra Postgres writes/reads.

#### C) View/page-level caching (Django view cache)

**Goal:** Cache entire DRF responses via decorators for endpoints with stable request shapes.

- Use `cache_page()` for safe endpoints.
- Use `@vary_on_headers("Authorization")` when the same URL returns different results depending on auth token.
  - For endpoints that are effectively public but allow optional auth, prefer **two separate endpoints** (`/public/...` vs `/me/...`) so caching remains clean and safe.

#### D) HTTP caching (client/browser/proxies)

**Goal:** Avoid hitting the backend at all on repeat fetches.

- Add **`ETag`** and/or **`Last-Modified`** for semi-static resources.
- Add `Cache-Control` and `Vary` headers.
- For authenticated endpoints, be conservative:
  - `Cache-Control: private, max-age=30` for user-specific but safe-to-cache-in-browser payloads.
  - `Cache-Control: no-store` for sensitive endpoints (tokens, anything with high-risk data).

---

## 3) Implementation Plan (Rollout)

### Phase 0 — Baseline & prioritization (1–2 days)

- Identify top endpoints by:
  - request volume (frontend pages like leaderboard, knowledge lists)
  - p95 latency
  - DB time (slow query logs / Django query count)
- Confirm which endpoints are:
  - **public** vs **authenticated**
  - **user-specific** vs **global**

Deliverable: a shortlist of 5–10 endpoints to optimize first (e.g., leaderboard, contributors, discovery counts, knowledge list/view).

### Phase 1 — Cheap wins (2–5 days)

1) **Reduce N+1 and repeated work**
- Add `select_related/prefetch_related`.
- Move aggregates out of serializers.

2) **Add response caching for safe endpoints**
- Apply caching to endpoints that are global and semi-static:
  - leaderboard (global)
  - contributor directory (global)
  - knowledge list endpoints (global)
  - discovery counts (global)

3) **Add HTTP caching headers**
- For list/view endpoints: enable conditional GET behavior (ETag) so clients revalidate cheaply.

### Phase 2 — Precompute expensive aggregates (1–2 weeks)

For endpoints dominated by aggregation cost, caching the response helps, but **precomputing** is often the bigger win.

**Targets (examples):**
- Leaderboard ranking (top N contributors)
- Progression metrics (counts per status/time window)
- Review queue counts per queue type
- Discovery facet counts (per CIDOC type, search term)

**Approach options (no Redis):**

- **Option A — Summary tables (recommended for frequent updates)**
  - Maintain tables such as `leaderboard_snapshot`, `queue_counts_snapshot`, etc.
  - Refresh via periodic job (cron / management command) plus event-triggered refresh on writes.
- **Option B — PostgreSQL materialized views (recommended for read-heavy, batch refresh)**
  - `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a schedule.
  - Requires unique index on the materialized view for concurrent refresh.

Deliverable: at least one high-impact endpoint served from a precomputed artifact, with measured reduction in DB time.

### Phase 3 — Standardize cache primitives (2–4 days)

- Add a small internal “caching utilities” module:
  - Key naming conventions
  - TTL constants by data class (static/semi/dynamic)
  - Safe helpers: `cache_get_or_set_json()`, `build_cache_key(request, ...)`
- Add consistent response headers:
  - `X-Cache: hit|miss|bypass`
  - `Cache-Control` / `Vary`

### Phase 4 — Expand coverage + harden invalidation (ongoing)

- Expand caching to additional endpoints based on measured wins.
- Add invalidation hooks tied to model writes (signals) for the specific cached artifacts.
- Add monitoring dashboards and alerting thresholds.

---

## 4) Code-Level Examples (Django/DRF)

> The examples below are intentionally “boring” and built on Django’s standard primitives to minimize risk and operational overhead.

### 4.1 Configure a non-Redis cache backend

**File-based cache (good default on a single host with multiple Gunicorn workers):**

```python
# heritage_graph/settings/base.py (or better: production.py / development.py)
import os

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": os.environ.get("DJANGO_CACHE_DIR", "/tmp/django-cache"),
        "TIMEOUT": 300,  # default; override per-key where needed
        "OPTIONS": {"MAX_ENTRIES": 200_000},
    }
}
```

**Database cache (centralized, shared across instances; adds DB load):**

```python
# settings
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
        "TIMEOUT": 300,
        "OPTIONS": {"MAX_ENTRIES": 200_000},
    }
}

# one-time
# python manage.py createcachetable django_cache
```

**Recommendation:** start with **file-based** in production if the backend is co-located and has a shared volume; otherwise use **DB cache**.

### 4.2 Cache an expensive global DRF endpoint (response caching)

```python
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.response import Response
from rest_framework.views import APIView

@method_decorator(cache_page(60 * 5), name="dispatch")
class LeaderboardView(APIView):
    authentication_classes = []  # if truly public
    permission_classes = []

    def get(self, request):
        data = build_leaderboard_payload()  # expensive
        response = Response(data)
        response["Cache-Control"] = "public, max-age=300"
        return response
```

### 4.3 Cache an authenticated endpoint safely (vary by auth)

If the endpoint returns **different output per user**, either:
- do **not** response-cache server-side, or
- ensure cache keys vary by user identity, not just URL.

For endpoints where auth changes the response shape, use `Vary`:

```python
from django.utils.decorators import method_decorator
from django.views.decorators.vary import vary_on_headers
from django.views.decorators.cache import cache_page
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

@method_decorator(vary_on_headers("Authorization"), name="dispatch")
@method_decorator(cache_page(30), name="dispatch")
class MyRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = {"role": get_role_for_user(request.user)}
        response = Response(data)
        response["Cache-Control"] = "private, max-age=30"
        return response
```

**Important trade-off:** `vary_on_headers("Authorization")` can explode cardinality if many distinct tokens hit the same endpoint. Prefer instead to:
- split endpoints into `/public/...` and `/me/...`, and/or
- cache per-user with a stable user id key.

### 4.4 Per-user key caching with `cache.get_or_set()`

```python
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

class MyStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        key = f"user:{request.user.id}:stats:v1"
        data = cache.get_or_set(key, lambda: compute_stats(request.user), timeout=60)

        response = Response(data)
        response["Cache-Control"] = "private, max-age=60"
        return response
```

### 4.5 Add cache hit/miss visibility via headers

```python
from django.core.cache import cache
from rest_framework.response import Response

def cached_json_response(key: str, compute, ttl: int) -> Response:
    value = cache.get(key)
    if value is not None:
        resp = Response(value)
        resp["X-Cache"] = "hit"
        return resp

    value = compute()
    cache.set(key, value, ttl)
    resp = Response(value)
    resp["X-Cache"] = "miss"
    return resp
```

---

## 5) Cache Invalidation Strategy

Caching is only valuable if invalidation is predictable and safe. We will use a **hybrid** strategy:

### 5.1 TTL-first for most endpoints

- Static: 24h–7d
- Semi-static: 5–60 min
- Dynamic: 10–120 sec
- User-specific: 10–60 sec (unless strong invalidation exists)

This prevents “stuck forever” bugs and simplifies ops.

### 5.2 Event-driven invalidation for critical artifacts

For caches that must reflect writes quickly (leaderboard, queue counts), invalidate on writes:

- On `Submission`, `CulturalEntity`, `Revision`, `ReviewDecision`, `ReviewFlag` changes:
  - delete known global keys:
    - `leaderboard:v1`
    - `review_queue_counts:v1`
  - delete per-user keys as needed:
    - `user:{id}:stats:v1`

**Pattern: signals (with guard rails):**

```python
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import CulturalEntity, ReviewDecision

@receiver([post_save, post_delete], sender=CulturalEntity)
def invalidate_entity_caches(sender, instance, **kwargs):
    cache.delete("leaderboard:v1")
    cache.delete("review_queue_counts:v1")
```

Guard rails:
- Keep invalidation lists small and explicit.
- Prefer deleting a small set of “top-level” keys over complex per-object graphs.

### 5.3 Avoid race conditions / stampedes

Common failure mode: cache miss causes many workers to recompute simultaneously.

Mitigations without Redis:
- Use `cache.get_or_set()` where supported.
- Use “stale-while-revalidate” behavior at the app layer:
  - Store `{value, computed_at}`; serve stale for a short window while one worker refreshes.
- For expensive recompute jobs: refresh in background via management command schedule.

### 5.4 Partial updates

If a write only affects part of a cached list:
- Prefer invalidating the whole list unless the cache is extremely large.
- For large caches, move to summary tables/materialized views so reads are always consistent.

---

## 6) Performance & Scalability Considerations

### Expected improvements (typical ranges)

- **Leaderboard / heavy aggregates**: 5–50× faster on cache hit; DB load drops proportionally.
- **Knowledge list endpoints**: 2–10× faster via query optimization + response caching.
- **Discovery counts**: significant improvement if moved to precomputed artifacts.

### Limitations of non-Redis caching

- **LocMem caches** don’t share between Gunicorn workers → lower hit rate.
- **File-based cache** shares on a single host but not across hosts unless a shared volume exists.
- **DB cache** can become self-defeating if it adds too much write/read pressure to Postgres.

### When this approach starts to break down

Consider a distributed cache (Redis) when:

- Backend runs on **multiple hosts/containers** and cache hit rate suffers due to no shared cache.
- Cache table or file cache becomes hot and adds measurable overhead.
- You need advanced features: distributed locks, pub/sub invalidation, large keyspace, eviction policies tuned for workload.

---

## 7) Monitoring & Reliability

### What to measure

- **Cache effectiveness**
  - hit rate per endpoint/key class
  - miss rate and recompute time
- **Backend health**
  - p95/p99 latency per endpoint
  - DB query count/time per request (sampling)
  - Postgres CPU/IO, slow query logs

### How to implement hit/miss tracking (no new infra required)

- Add `X-Cache` response header on cached endpoints (`hit|miss|bypass`).
- Log structured entries for cache events:
  - key prefix, ttl, hit/miss, compute duration

If you already have centralized logs, this becomes a dashboard; if not, it’s still queryable in container logs.

### Fallback mechanisms

- If cache backend errors:
  - **fail open** for read endpoints: compute fresh and return response.
  - **fail closed** only for endpoints where stale data is unacceptable (rare).
- Always set reasonable timeouts and catch cache backend exceptions.

---

## 8) Future Upgrade Path (to Redis)

Design choices to keep migration small:

- Keep caching behind a thin wrapper (`cached_json_response`, stable key naming).
- Keep invalidation centralized (one module listing keys to delete).
- Avoid relying on backend-specific features (e.g., filesystem-only semantics).

Migration steps:

1) Introduce Redis service and switch `CACHES["default"]["BACKEND"]` to `django-redis`.
2) Keep keys/TTLs/invalidation the same.
3) Add distributed locking for stampede control (optional but recommended).
4) Remove DB cache table or filesystem cache volume once stable.

---

## Appendix: Practical Cache Policy (Suggested Defaults)

- **Leaderboard (global)**: `public`, TTL 60–300s, invalidate on relevant writes.
- **Discovery counts (global)**: TTL 5–30 min, or serve from materialized view refreshed every 5–15 min.
- **Knowledge lists (global)**: TTL 5–30 min, add ETag for cheap revalidation.
- **Review queue counts (global)**: TTL 10–30s, prefer precomputed snapshot updated on writes.
- **User stats (per-user)**: `private`, TTL 30–120s, invalidate on user’s contributions/reviews.

