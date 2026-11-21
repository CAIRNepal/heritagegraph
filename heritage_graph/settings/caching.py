"""
Cache backend selection (LocMem vs Redis) driven by environment.

Set REDIS_URL (e.g. redis://redis:6379/1) for a shared cache across
multiple Gunicorn workers. Without it, Django uses in-process LocMemCache
(fine for development and single-worker runs).
"""

from __future__ import annotations

import os


def build_caches_config() -> dict:
    redis_url = os.environ.get("REDIS_URL", "").strip()
    prefix = os.environ.get("DJANGO_CACHE_KEY_PREFIX", "hg")
    if redis_url:
        return {
            "default": {
                "BACKEND": "django.core.cache.backends.redis.RedisCache",
                "LOCATION": redis_url,
                "KEY_PREFIX": prefix,
                "TIMEOUT": 300,
            }
        }
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "heritagegraph",
            "KEY_PREFIX": prefix,
            "TIMEOUT": 300,
        }
    }
