from __future__ import annotations

from apps.cidoc_data.views import (
    _DISCOVERY_TYPE_MAP,
    _discovery_row,
    _filtered_discovery_queryset,
)

DEFAULT_PER_TYPE = 2
MAX_SOURCES = 24
DEFAULT_MAX_CONTEXT_CHARS = 12_000


def build_graph_context(
    user_query: str,
    *,
    per_type: int = DEFAULT_PER_TYPE,
    max_chars: int = DEFAULT_MAX_CONTEXT_CHARS,
) -> tuple[str, list[dict[str, str]]]:
    """
    Public-facing discovery text + lightweight source list for the assistant (no auth).
    """
    if not (user_query or "").strip():
        return "", []
    q = user_query.strip()
    chunks: list[str] = []
    sources: list[dict[str, str]] = []

    for type_key, (model, fields) in _DISCOVERY_TYPE_MAP.items():
        qs = _filtered_discovery_queryset(model, fields, q)[:per_type]
        for obj in qs:
            row = _discovery_row(obj, type_key)
            name = (row.get("name") or "").strip()
            summary = (row.get("summary") or "").strip()
            if not (name or summary):
                continue
            line = (
                f"- [{type_key}] {name}: {summary}"
                if summary
                else f"- [{type_key}] {name}"
            )
            chunks.append(line)
            if len(sources) < MAX_SOURCES:
                excerpt = (summary or "")[:300]
                sources.append(
                    {
                        "id": str(row.get("id", "")),
                        "type": f"graph_{type_key}"[:48],
                        "title": (name or type_key)[:200],
                        "excerpt": excerpt,
                    }
                )
    if not chunks:
        msg = (
            "No public graph excerpts matched the latest user turn "
            "(empty query or no match)."
        )
        return (msg, [])

    header = "Public knowledge excerpts (retrieved; may be incomplete):\n"
    body = "\n".join(chunks)
    text = f"{header}{body}"
    if len(text) > max_chars:
        text = f"{text[: max_chars - 1]}…"
    return text, sources
