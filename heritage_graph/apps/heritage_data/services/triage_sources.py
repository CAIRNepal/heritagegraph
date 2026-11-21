"""Infer worst source_type for CulturalEntity queue triage (spec 006 / research R-002)."""

from __future__ import annotations

import json
from typing import Any

from apps.heritage_data.models import CulturalEntity


def _collect_source_types_from_json(obj: Any, out: set[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if lk in ("source_type", "sourcetype") and isinstance(v, str) and v.strip():
                out.add(v.strip().lower())
            elif lk == "assertions" and isinstance(v, list):
                for item in v:
                    _collect_source_types_from_json(item, out)
            else:
                _collect_source_types_from_json(v, out)
    elif isinstance(obj, list):
        for item in obj:
            _collect_source_types_from_json(item, out)


def worst_source_type_for_entity(entity: CulturalEntity) -> str | None:
    """
    Best-effort: read contributor `source_type` strings from latest/current revision JSON.
    HeritageAssertion GFK uses integer object_id and does not attach UUID CulturalEntity rows.
    """
    rev = entity.current_revision or entity.get_latest_revision()
    if not rev or not rev.data:
        return None
    data = rev.data
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return None
    found: set[str] = set()
    _collect_source_types_from_json(data, found)
    if not found:
        return None
    from apps.heritage_data.services.triage_scoring import (
        DEFAULT_TIER_ORDER_BEST_TO_WORST,
        get_active_triage_policy_dict,
    )

    policy = get_active_triage_policy_dict()
    order = [
        str(x).strip().lower()
        for x in (policy.get("tier_rank_json") or [])
        if str(x).strip()
    ]
    if not order:
        order = list(DEFAULT_TIER_ORDER_BEST_TO_WORST)
    worst = None
    worst_idx = -1
    for st in found:
        try:
            idx = order.index(st)
        except ValueError:
            idx = len(order)  # unknown types treated as worst
        if idx > worst_idx:
            worst_idx = idx
            worst = st
    return worst
