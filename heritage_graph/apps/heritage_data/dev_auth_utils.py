"""Shared dev-auth gate (no DRF imports — safe for authentication.py)."""

from __future__ import annotations

import os

from django.conf import settings


def dev_auth_enabled() -> bool:
    return settings.DEBUG and os.environ.get("HERITAGEGRAPH_DEV_AUTH", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
