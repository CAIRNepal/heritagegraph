# Backend caching (HeritageGraph)

This project uses **Django’s cache framework** with a small wrapper in `heritage_graph/cache_utils.py`. Defaults are safe for development; production can enable **Redis** for a shared cache across multiple Gunicorn workers.

## What is configured

| Piece | Role |
|--------|------|
| `heritage_graph/settings/caching.py` | Chooses **LocMemCache** (no extra service) or **Redis** when `REDIS_URL` is set. |
| `heritage_graph/settings/base.py` | Assigns `CACHES = build_caches_config()`. |
| `heritage_graph/cache_utils.py` | Key naming, TTLs, `bump_leaderboard_cache()`, `invalidate_review_queue_counts()`. |
| `apps/heritage_data/views.py` | **Leaderboard** and **review queue counts** read through the cache after computing. |
| `apps/heritage_data/signals.py` | Bumps leaderboard version or deletes queue-count keys when related models change. |

### Dependencies

- **Redis backend:** Django’s built-in `django.core.cache.backends.redis.RedisCache` (Django 5.x) requires the **`redis`** PyPI package (listed in `heritage_graph/requirements.txt`).

### Environment variables

| Variable | Meaning |
|----------|---------|
| `REDIS_URL` | If non-empty, use Redis (e.g. `redis://redis:6379/1`). If unset, use in-process LocMemCache. |
| `DJANGO_CACHE_KEY_PREFIX` | Optional prefix for all keys (default `hg`). |

**Why Redis in production:** LocMemCache is **per process**. With Gunicorn `--workers 4`, each worker has its own cache and invalidation in one worker is invisible to others. Redis (or Memcached) gives one shared store.

## Cached endpoints (initial set)

1. **`GET /data/leaderboard/`** (`LeaderboardView`)  
   - Key includes a **version** segment (see below) and normalized `?search=` (max 200 chars, lowercased).  
   - TTL: `LEADERBOARD_CACHE_TTL` (120 seconds), refreshed on writes via signals.

2. **`GET /data/review-queue/queue_counts/`** (`ReviewQueueViewSet.queue_counts`)  
   - Single key `review_queue_counts_key()`.  
   - TTL: `REVIEW_QUEUE_COUNTS_TTL` (30 seconds), plus immediate invalidation when queue-related models change.

## Invalidation strategy

- **Leaderboard:** We do **not** delete every search key. Instead, `bump_leaderboard_cache()` increments a version stored at `heritage:leaderboard:__version__`. All leaderboard keys include that version, so old entries become unreachable and expire naturally.  
- **Queue counts:** `invalidate_review_queue_counts()` calls `cache.delete(...)` on the single counts key.

Signals wired today (see `apps/heritage_data/signals.py`):

- `Submission` create/update/delete → leaderboard bump (create/update also run existing user-stats logic).  
- `CulturalEntity`, `ReviewDecision` → leaderboard bump + queue counts invalidation.  
- `ReviewFlag` → queue counts invalidation.  
- `Revision` → leaderboard bump.

If you add new endpoints or data that must stay fresh, extend these lists or call the same helpers from your write paths.

## How to contribute on top of this

### 1. Add a new cached read

- Prefer **small JSON-serializable payloads** (dict/list), not ORM instances.
- Build keys with `make_cache_key("heritage", "<feature>", ...)` or add a dedicated helper next to `leaderboard_cache_key` in `cache_utils.py`.
- Use `cache.get` / `cache.set` with a documented TTL constant at the top of `cache_utils.py`.
- In **tests**, use `django.test.override_settings` with `CACHES` → `LocMemCache` if needed, or call `cache.clear()`.

### 2. Invalidate when data changes

- **One key:** `cache.delete(your_key)`.
- **Many keys / search variants:** use a **version key** pattern like the leaderboard (`bump_leaderboard_cache()`), or document a short TTL-only approach if stale reads are acceptable.

### 3. Register invalidation in signals or `save()`

- Add receivers in `apps/heritage_data/signals.py` (or the owning app’s `signals.py`, imported from `AppConfig.ready()`).  
- Avoid importing heavy models inside `cache_utils.py` to prevent circular imports.

### 4. Optional: cache decorators

Django provides `cache_page` for **whole responses**; it is less common in DRF than explicit `cache.get/set` because many APIs are user-specific. Use `cache_page` only for truly public, anonymous-safe endpoints.

### 5. Local Docker

`docker-compose.yml` defines a **`redis`** service on the backend network. To use it, set in `.env`:

`REDIS_URL=redis://redis:6379/1`

Leave `REDIS_URL` unset to keep **LocMemCache** (no extra dependency). With Gunicorn **multiple workers**, Redis is recommended so cache invalidation and hits are consistent across processes.

## Operations notes

- **Monitoring:** Cache misses and latency are not logged by default; add logging around `cache.get` if you need visibility during tuning.
- **Security:** Do not put secrets or per-user privileged data in cache keys or values unless you also use **per-user key segments** and appropriate TTLs.
