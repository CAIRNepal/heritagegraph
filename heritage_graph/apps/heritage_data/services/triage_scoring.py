"""Deterministic review-queue triage scoring (spec 006 / research R-001)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from apps.heritage_data.models import CulturalEntity, TriagePolicy


DEFAULT_TIER_ORDER_BEST_TO_WORST = [
    "inscription",
    "archival",
    "published",
    "field_survey",
    "oral_history",
    "web",
]


@dataclass(frozen=True)
class TriageComponents:
    age_norm: float
    flags_norm: float
    conflict_boost: float
    source_penalty: float
    days_in_review: int
    unresolved_flag_count: int
    has_contradiction: bool
    worst_source_type: str | None
    worst_tier_label: str
    source_rank: int  # 0 = best known tier, higher = worse


def _default_policy_row() -> dict[str, Any]:
    """In-memory defaults when DB has no TriagePolicy yet."""
    return {
        "w_age": Decimal("2.5"),
        "w_flags": Decimal("1.5"),
        "w_conflict": Decimal("3.0"),
        "w_source": Decimal("1.0"),
        "s_max_days": 30,
        "f_max_flags": 10,
        "tier_rank_json": list(DEFAULT_TIER_ORDER_BEST_TO_WORST),
    }


def get_active_triage_policy_dict() -> dict[str, Any]:
    row = TriagePolicy.objects.filter(is_active=True).order_by("-updated_at").first()
    if row is None:
        return _default_policy_row()
    tier = row.tier_rank_json or list(DEFAULT_TIER_ORDER_BEST_TO_WORST)
    return {
        "w_age": row.w_age,
        "w_flags": row.w_flags,
        "w_conflict": row.w_conflict,
        "w_source": row.w_source,
        "s_max_days": max(1, int(row.s_max_days)),
        "f_max_flags": max(1, int(row.f_max_flags)),
        "tier_rank_json": tier,
    }


def compute_triage_components(
    entity: CulturalEntity,
    *,
    worst_source_type: str | None,
    policy: dict[str, Any] | None = None,
) -> TriageComponents:
    policy = policy or get_active_triage_policy_dict()
    s_max = int(policy["s_max_days"])
    f_max = int(policy["f_max_flags"])
    tier_order: list[str] = [
        str(x).strip() for x in (policy.get("tier_rank_json") or []) if str(x).strip()
    ]

    if entity.status == "pending_review":
        from django.utils import timezone

        delta = timezone.now() - entity.created_at
        days_in_review = max(0, delta.days)
    else:
        days_in_review = 0

    age_norm = min(1.0, float(days_in_review) / float(s_max))

    if hasattr(entity, "review_flags"):
        unresolved = [f for f in entity.review_flags.all() if not f.is_resolved]
        unresolved_flag_count = len(unresolved)
        has_contradiction = any(f.flag_type == "contradiction" for f in unresolved)
    else:
        unresolved_flag_count = 0
        has_contradiction = False

    flags_norm = min(1.0, float(unresolved_flag_count) / float(f_max))
    conflict_boost = 1.0 if has_contradiction else 0.0

    if not tier_order:
        tier_order = list(DEFAULT_TIER_ORDER_BEST_TO_WORST)
    # rank: 0 = best (first in list), len-1 = worst in list; unknown = worst+1
    worst_source_type_norm = (worst_source_type or "").strip().lower() or None
    if worst_source_type_norm and worst_source_type_norm in tier_order:
        source_rank = tier_order.index(worst_source_type_norm)
        worst_tier_label = worst_source_type_norm.replace("_", " ").title()
    else:
        source_rank = len(tier_order)
        worst_tier_label = "unknown"

    denom = max(1, len(tier_order))
    source_penalty = float(source_rank) / float(denom)

    return TriageComponents(
        age_norm=age_norm,
        flags_norm=flags_norm,
        conflict_boost=conflict_boost,
        source_penalty=source_penalty,
        days_in_review=days_in_review,
        unresolved_flag_count=unresolved_flag_count,
        has_contradiction=has_contradiction,
        worst_source_type=worst_source_type_norm,
        worst_tier_label=worst_tier_label,
        source_rank=source_rank,
    )


def compute_triage_priority(
    entity: CulturalEntity,
    *,
    worst_source_type: str | None,
    policy: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any]]:
    """
    Return (integer_priority, breakdown_dict).
    Higher integer_priority means "address sooner".
    """
    policy = policy or get_active_triage_policy_dict()
    c = compute_triage_components(
        entity, worst_source_type=worst_source_type, policy=policy
    )

    w_age = float(policy["w_age"])
    w_flags = float(policy["w_flags"])
    w_conflict = float(policy["w_conflict"])
    w_source = float(policy["w_source"])

    raw = (
        w_age * c.age_norm
        + w_flags * c.flags_norm
        + w_conflict * c.conflict_boost
        + w_source * c.source_penalty
    )
    priority = int(round(raw * 1000))

    breakdown = {
        "age_norm": c.age_norm,
        "flags_norm": c.flags_norm,
        "conflict_boost": c.conflict_boost,
        "source_penalty": c.source_penalty,
        "weights": {
            "w_age": w_age,
            "w_flags": w_flags,
            "w_conflict": w_conflict,
            "w_source": w_source,
        },
        "days_in_review": c.days_in_review,
        "unresolved_flag_count": c.unresolved_flag_count,
        "has_contradiction": c.has_contradiction,
        "worst_tier_label": c.worst_tier_label,
        "worst_source_type": c.worst_source_type,
        "tie_breakers": {
            "unresolved_flag_count": c.unresolved_flag_count,
            "created_at": entity.created_at.isoformat(),
            "entity_id": str(entity.entity_id),
        },
    }
    return priority, breakdown


def sort_key_for_entity(
    entity: CulturalEntity,
    *,
    worst_source_type: str | None,
    policy: dict[str, Any] | None = None,
) -> tuple:
    """Deterministic sort key: triage priority desc → flags → created_at asc → entity_id."""
    policy = policy or get_active_triage_policy_dict()
    priority, _ = compute_triage_priority(
        entity, worst_source_type=worst_source_type, policy=policy
    )
    c = compute_triage_components(
        entity, worst_source_type=worst_source_type, policy=policy
    )
    return (
        -priority,
        -c.unresolved_flag_count,
        entity.created_at.timestamp(),
        str(entity.entity_id),
    )
