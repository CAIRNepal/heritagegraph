"""
Application-level cache helpers (keys, TTLs, invalidation).

Use ``django.core.cache.cache`` only through helpers here where possible
so key shapes stay consistent. See CACHE.md for extending the cache layer.
"""

from __future__ import annotations

from django.core.cache import cache

LEADERBOARD_CACHE_TTL = 120
REVIEW_QUEUE_COUNTS_TTL = 30

_LEADERBOARD_VERSION_KEY = "heritage:leaderboard:__version__"


def make_cache_key(*parts: str) -> str:
    return ":".join(str(p) for p in parts if p is not None and str(p) != "")


def _leaderboard_version() -> int:
    v = cache.get(_LEADERBOARD_VERSION_KEY)
    return int(v) if v is not None else 0


def leaderboard_cache_key(search: str) -> str:
    normalized = (search or "").strip().lower()[:200] or "__all__"
    return make_cache_key("heritage", "leaderboard", str(_leaderboard_version()), normalized)


def review_queue_counts_key() -> str:
    return make_cache_key("heritage", "review_queue", "counts")


def bump_leaderboard_cache() -> None:
    """Invalidate all leaderboard responses by rotating a version segment in keys."""
    v = _leaderboard_version()
    cache.set(_LEADERBOARD_VERSION_KEY, v + 1, timeout=None)


def invalidate_review_queue_counts() -> None:
    cache.delete(review_queue_counts_key())
