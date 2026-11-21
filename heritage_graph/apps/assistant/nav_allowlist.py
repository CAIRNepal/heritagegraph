from __future__ import annotations

import re

# Exact in-app paths that are always safe
_ALLOWED_EXACT: frozenset[str] = frozenset(
    {
        "/",
        "/contribute",
        "/about",
        "/graphview",
        "/curation/review",
        "/community/contributors",
        "/knowledge/monument",
        "/knowledge/festival",
        "/knowledge/entity",
        "/knowledge/person",
        "/knowledge/location",
        "/knowledge/event",
        "/knowledge/tradition",
        "/knowledge/source",
    }
)

_ALLOWED_PATH_RE = re.compile(r"^/[-_a-zA-Z0-9/%.~]{1,198}$")


def sanitize_nav_path(candidate: str | None) -> str | None:
    """Return a safe in-app path or None.

    Rejects external URLs, path traversal, and other open redirects.
    """
    if not candidate or not isinstance(candidate, str):
        return None
    t = candidate.strip()
    if not t.startswith("/"):
        t = f"/{t}"
    if ".." in t or "//" in t or " " in t or "\n" in t or "\r" in t or "\t" in t:
        return None
    if not _ALLOWED_PATH_RE.match(t):
        return None
    if t in _ALLOWED_EXACT:
        return t
    if t.startswith("/knowledge/"):
        return t
    if t.startswith("/contribute/") or t == "/contribute":
        return t
    if t.startswith("/curation/") or t.startswith("/community/"):
        return t
    return None
