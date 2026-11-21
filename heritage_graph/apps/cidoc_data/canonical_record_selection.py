"""
Evidence-weighted canonical record selection within an EntityCluster.

Scientific policy (heritage ER + epistemic review):
1. Prefer **published / accepted** records over drafts.
2. Prefer **higher completeness** (fields, narrative, geo, media signals).
3. Tie-break by stable record id (deterministic).

Used by duplicate hints, museum display, and duplicate-contribution review.
"""

from __future__ import annotations

from typing import Any

from django.contrib.contenttypes.models import ContentType

from .cidoc_registry_keys import registry_class_key_for_model
from .identity_services import active_memberships_for_cluster, entity_display_title


def _text_len(instance: Any, *attrs: str) -> int:
    total = 0
    for attr in attrs:
        v = getattr(instance, attr, None)
        if v and str(v).strip():
            total += len(str(v).strip())
    return total


def completeness_score(instance: Any) -> float:
    """Heuristic richness score for comparing contributor records (same cluster)."""
    score = 0.0
    score += min(_text_len(instance, "name", "title") / 40.0, 8.0)
    score += min(_text_len(instance, "description") / 120.0, 25.0)

    point = getattr(instance, "point", None)
    coords = getattr(instance, "coordinates_legacy", None)
    if point is not None or (coords and str(coords).strip()):
        score += 12.0

    status = (getattr(instance, "status", None) or "").strip().lower()
    if status in ("published", "accepted"):
        score += 40.0
    elif status in ("pending_review", "in_review"):
        score += 8.0

    for attr in ("note", "aliases", "historical_significance"):
        v = getattr(instance, attr, None)
        if v and str(v).strip():
            score += 4.0

    return round(score, 2)


def _load_member_instance(content_type: ContentType, object_id: int) -> Any | None:
    model = content_type.model_class()
    if not model:
        return None
    try:
        return model.objects.get(pk=object_id)
    except model.DoesNotExist:
        return None


def rank_cluster_members(cluster) -> list[dict[str, Any]]:
    """Return cluster members sorted best-first with completeness scores."""
    ranked: list[dict[str, Any]] = []
    for row in active_memberships_for_cluster(cluster).select_related("content_type"):
        if not row.content_type_id or not row.object_id:
            continue
        ct = row.content_type
        obj = _load_member_instance(ct, int(row.object_id))
        title = entity_display_title(obj) if obj else f"{ct.model}#{row.object_id}"
        registry_key = registry_class_key_for_model(ct.model_class()) if ct.model_class() else None
        score = completeness_score(obj) if obj else 0.0
        ranked.append(
            {
                "entity_type": ct.model,
                "entity_id": row.object_id,
                "display_title": title,
                "registry_key": registry_key,
                "completeness_score": score,
                "status": getattr(obj, "status", None) if obj else None,
                "membership_assertion_id": str(row.id),
            }
        )
    ranked.sort(
        key=lambda m: (
            -float(m["completeness_score"]),
            str(m["entity_id"]),
        )
    )
    return ranked


def select_canonical_member(cluster) -> dict[str, Any] | None:
    """Best record to treat as canonical hub for this identity cluster."""
    ranked = rank_cluster_members(cluster)
    return ranked[0] if ranked else None
