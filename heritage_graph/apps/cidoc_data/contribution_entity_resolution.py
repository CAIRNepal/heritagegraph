"""
Contribution-time entity resolution (claim-first).

Scientific pipeline (blocking → matching → decision):
1. **Block** on ontology type (`type_scope`) — never merge a deity with a location.
2. **Match** on normalized label against active `EntityCluster` canonical labels + aliases.
3. **Decide**:
   - *exact* → attach `identity.same_referent` membership to the existing cluster (no new cluster).
   - *similar* → singleton cluster + `IdentityResolutionCandidate` for moderator review.
   - *none* → singleton cluster (bootstrap-equivalent).

Each CIDOC row remains a separate curated record; identity links express same-referent claims.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from .identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from .identity_validation import label_match_tier, normalize_label
from .identity_services import (
    active_memberships_for_cluster,
    active_memberships_for_subject,
    entity_display_title,
)
from .identity_validation import assertable_model_names
from .models import EntityCluster, HeritageAssertion, IdentityResolutionCandidate

logger = logging.getLogger(__name__)

AUTO_LINK_CONTRIBUTOR = "contribution_entity_resolution"


@dataclass(frozen=True)
class ResolutionResult:
    outcome: str  # linked_existing | singleton_created | candidate_queued | skipped
    cluster_id: str | None = None
    candidate_id: str | None = None
    matched_label: str | None = None
    detail: str = ""


def _is_clusterable(instance: Any) -> bool:
    ct = ContentType.objects.get_for_model(
        instance.__class__,
        for_concrete_model=True,
    )
    return ct.model in assertable_model_names()


def _cluster_labels(cluster: EntityCluster) -> list[str]:
    labels = [cluster.canonical_label]
    for alias in cluster.curated_aliases or []:
        if alias and alias not in labels:
            labels.append(str(alias))
    return labels


def _find_best_cluster(
    label: str,
    type_scope: str,
) -> tuple[EntityCluster | None, str | None, str | None]:
    """
    Return (cluster, matched_label, tier) for the best active cluster match.
    tier is 'exact' or 'similar'.
    """
    best: EntityCluster | None = None
    best_tier: str | None = None
    best_label: str | None = None
    best_len = 10**9

    qs = EntityCluster.objects.filter(
        merged_into__isnull=True,
        type_scope=type_scope,
    ).order_by("canonical_label")

    for cluster in qs.iterator(chunk_size=200):
        for cand_label in _cluster_labels(cluster):
            tier = label_match_tier(label, cand_label)
            if tier is None:
                continue
            if best_tier == "exact" and tier != "exact":
                continue
            if tier == "exact" or best_tier != "exact":
                clen = len(cluster.canonical_label or "")
                if (
                    best is None
                    or (tier == "exact" and best_tier != "exact")
                    or (tier == best_tier and clen < best_len)
                ):
                    best = cluster
                    best_tier = tier
                    best_label = cand_label
                    best_len = clen
    return best, best_label, best_tier


def _create_membership(
    *,
    instance: Any,
    cluster: EntityCluster,
    contributed_by: str,
    assertion_content: str,
    confidence: str = "certain",
) -> HeritageAssertion:
    ct = ContentType.objects.get_for_model(
        instance.__class__,
        for_concrete_model=True,
    )
    ha = HeritageAssertion(
        content_type=ct,
        object_id=instance.pk,
        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
        asserted_value="",
        assertion_content=assertion_content,
        entity_cluster=cluster,
        reconciliation_status="accepted",
        confidence=confidence,
        contributed_by=contributed_by,
    )
    ha.full_clean()
    ha.save()
    return ha


def _create_singleton_cluster(
    *,
    instance: Any,
    label: str,
    contributed_by: str,
) -> EntityCluster:
    ct = ContentType.objects.get_for_model(
        instance.__class__,
        for_concrete_model=True,
    )
    cluster = EntityCluster.objects.create(
        canonical_label=label[:500],
        type_scope=ct.model,
        locked=False,
        note="",
    )
    _create_membership(
        instance=instance,
        cluster=cluster,
        contributed_by=contributed_by,
        assertion_content="Singleton cluster on contribution",
    )
    return cluster


def _queue_candidate(
    *,
    left_ct: ContentType,
    left_id: int,
    right_ct: ContentType,
    right_id: int,
    signal_scores: dict[str, Any],
) -> IdentityResolutionCandidate | None:
    left_id, right_id = (
        (left_id, right_id) if left_id <= right_id else (right_id, left_id)
    )
    left_ct, right_ct = (
        (left_ct, right_ct) if left_id <= right_id else (right_ct, left_ct)
    )
    exists = IdentityResolutionCandidate.objects.filter(
        left_content_type=left_ct,
        left_object_id=left_id,
        right_content_type=right_ct,
        right_object_id=right_id,
        status="open",
    ).exists()
    if exists:
        return None
    return IdentityResolutionCandidate.objects.create(
        left_content_type=left_ct,
        left_object_id=left_id,
        right_content_type=right_ct,
        right_object_id=right_id,
        signal_scores=signal_scores,
        status="open",
        notes="",
    )


def _representative_member_id(cluster: EntityCluster) -> tuple[ContentType | None, int | None]:
    row = (
        active_memberships_for_cluster(cluster)
        .select_related("content_type")
        .order_by("object_id")
        .first()
    )
    if not row or not row.content_type_id or not row.object_id:
        return None, None
    return row.content_type, int(row.object_id)


@transaction.atomic
def resolve_contribution_identity(
    instance: Any,
    *,
    contributed_by: str | None = None,
) -> ResolutionResult:
    """
    Resolve identity for a newly saved clusterable CIDOC row.

    Safe to call multiple times — skips when an active membership already exists.
    """
    if not _is_clusterable(instance):
        return ResolutionResult(
            outcome="skipped",
            detail=f"{instance.__class__.__name__} is not clusterable",
        )

    ct = ContentType.objects.get_for_model(
        instance.__class__,
        for_concrete_model=True,
    )
    if active_memberships_for_subject(ct, instance.pk).exists():
        mem = active_memberships_for_subject(ct, instance.pk).first()
        cid = str(mem.entity_cluster_id) if mem and mem.entity_cluster_id else None
        return ResolutionResult(
            outcome="skipped",
            cluster_id=cid,
            detail="Active membership already exists",
        )

    label = entity_display_title(instance)
    if not normalize_label(label):
        return ResolutionResult(
            outcome="skipped",
            detail="Empty label — cannot resolve",
        )

    actor = (contributed_by or AUTO_LINK_CONTRIBUTOR).strip()[:200]
    match, matched_label, tier = _find_best_cluster(label, ct.model)

    if match and tier == "exact":
        from .canonical_record_selection import select_canonical_member

        _create_membership(
            instance=instance,
            cluster=match,
            contributed_by=actor,
            assertion_content=(
                f"Auto-linked on contribution (exact label match: {matched_label!r})"
            ),
            confidence="certain",
        )
        canonical = select_canonical_member(match)
        cand: IdentityResolutionCandidate | None = None
        if canonical and int(canonical["entity_id"]) != int(instance.pk):
            rep_ct = ContentType.objects.get(model=canonical["entity_type"])
            cand = _queue_candidate(
                left_ct=ct,
                left_id=int(instance.pk),
                right_ct=rep_ct,
                right_id=int(canonical["entity_id"]),
                signal_scores={
                    "rule": "duplicate_contribution_same_cluster",
                    "submitted_label": label,
                    "canonical_label": match.canonical_label,
                    "canonical_member_id": canonical["entity_id"],
                    "canonical_completeness": canonical.get("completeness_score"),
                    "tier": tier,
                    "policy": "reviewer_compare_and_accept_richer",
                },
            )
        logger.info(
            "Entity resolution: linked %s#%s → cluster %s (%s)",
            ct.model,
            instance.pk,
            match.id,
            matched_label,
        )
        return ResolutionResult(
            outcome="linked_existing",
            cluster_id=str(match.id),
            candidate_id=str(cand.id) if cand else None,
            matched_label=matched_label,
            detail=(
                "Exact label match — linked to existing cluster"
                + ("; duplicate review queued" if cand else "")
            ),
        )

    cluster = _create_singleton_cluster(
        instance=instance,
        label=label,
        contributed_by=actor,
    )

    if match and tier == "similar":
        rep_ct, rep_id = _representative_member_id(match)
        cand: IdentityResolutionCandidate | None = None
        if rep_ct and rep_id is not None:
            cand = _queue_candidate(
                left_ct=ct,
                left_id=int(instance.pk),
                right_ct=rep_ct,
                right_id=rep_id,
                signal_scores={
                    "rule": "contribution_similar_label",
                    "submitted_label": label,
                    "matched_label": matched_label,
                    "matched_cluster_id": str(match.id),
                    "tier": tier,
                },
            )
        logger.info(
            "Entity resolution: singleton %s for %s#%s; similar to cluster %s",
            cluster.id,
            ct.model,
            instance.pk,
            match.id,
        )
        return ResolutionResult(
            outcome="candidate_queued",
            cluster_id=str(cluster.id),
            candidate_id=str(cand.id) if cand else None,
            matched_label=matched_label,
            detail="Similar label — singleton + identity candidate queued",
        )

    logger.info(
        "Entity resolution: new singleton cluster %s for %s#%s (%s)",
        cluster.id,
        ct.model,
        instance.pk,
        label,
    )
    return ResolutionResult(
        outcome="singleton_created",
        cluster_id=str(cluster.id),
        detail="No match — new singleton cluster",
    )
