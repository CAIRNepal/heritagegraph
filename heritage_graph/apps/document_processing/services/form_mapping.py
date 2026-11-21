from __future__ import annotations

from .ner import ExtractedNerItem


def map_ner_to_form_suggestions(
    items: list[ExtractedNerItem],
) -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = {}
    for it in items:
        out[it.field_name] = {
            "value": it.field_value,
            "confidence": it.confidence,
            "entityType": it.source_entity_type,
        }
    return out
