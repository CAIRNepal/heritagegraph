from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ExtractedNerItem:
    field_name: str
    field_value: str
    source_entity_type: str
    confidence: float


YEAR_RE = re.compile(r"\b(1[0-9]{3}|2[0-9]{3})\b")


def naive_extract(*, text: str) -> list[ExtractedNerItem]:
    """
    v1: deterministic, local extraction for MVPs. Replaceable with a real NER model later.
    """
    t = (text or "").strip()
    if not t:
        return []

    items: list[ExtractedNerItem] = []
    for m in YEAR_RE.finditer(t):
        year = m.group(0)
        items.append(
            ExtractedNerItem(
                field_name="date_year_hint",
                field_value=year,
                source_entity_type="DATE",
                confidence=0.45,
            )
        )

    # If text looks like a short title, capture first line
    first_line = t.splitlines()[0].strip() if t else ""
    if 1 < len(first_line) <= 160:
        items.append(
            ExtractedNerItem(
                field_name="title_line_hint",
                field_value=first_line,
                source_entity_type="OTHER",
                confidence=0.3,
            )
        )

    return items
