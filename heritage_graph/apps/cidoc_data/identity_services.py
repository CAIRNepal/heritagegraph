"""Identity layer: derived membership, merge/split/lock, and summary helpers."""

from __future__ import annotations

import uuid
from functools import reduce
from operator import or_
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .identity_constants import (
    CLUSTER_AUDIT_ACTION_LOCK,
    CLUSTER_AUDIT_ACTION_LOCK_OVERRIDE_MERGE,
    CLUSTER_AUDIT_ACTION_MERGE,
    CLUSTER_AUDIT_ACTION_SPLIT,
    CLUSTER_AUDIT_ACTION_UNLOCK,
    IDENTITY_SAME_REFERENT_PROPERTY,
    SOURCE_TYPE_CONFLICT_ORDER,
)
from .models import (
    ClusterAuditEvent,
    EntityCluster,
    HeritageAssertion,
    IdentityResolutionCandidate,
)

_ERR_VERSION = {"expected_version": "Cluster changed; refresh and retry."}


def _superseded_assertion_ids():
    return HeritageAssertion.objects.exclude(supersedes_id__isnull=True).values_list(
        "supersedes_id", flat=True
    )


def _active_membership_qs():
    """Active same_referent rows not superseded by a successor."""
    return HeritageAssertion.objects.filter(
        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
        reconciliation_status="accepted",
        entity_cluster__isnull=False,
    ).exclude(id__in=_superseded_assertion_ids())


def active_memberships_for_cluster(cluster: EntityCluster):
    """Accepted, non-superseded membership rows for this cluster."""
    return _active_membership_qs().filter(entity_cluster=cluster)


def active_memberships_for_subject(content_type: ContentType, object_id: int):
    return _active_membership_qs().filter(
        content_type=content_type,
        object_id=object_id,
    )


def cluster_distinct_ids_for_subject(
    content_type: ContentType, object_id: int
) -> list[uuid.UUID]:
    return list(
        active_memberships_for_subject(content_type, object_id)
        .values_list("entity_cluster_id", flat=True)
        .distinct()
    )


def subject_has_identity_conflict(content_type: ContentType, object_id: int) -> bool:
    return len(cluster_distinct_ids_for_subject(content_type, object_id)) > 1


def source_type_rank(source_type: str | None) -> int:
    if not source_type:
        return len(SOURCE_TYPE_CONFLICT_ORDER) + 10
    try:
        return SOURCE_TYPE_CONFLICT_ORDER.index(source_type)
    except ValueError:
        return len(SOURCE_TYPE_CONFLICT_ORDER) + 5


def entity_display_title(instance) -> str:
    for attr in ("name", "title"):
        v = getattr(instance, attr, None)
        if v:
            return str(v)[:500]
    return str(instance.pk)


def cluster_members_payload(cluster: EntityCluster) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in active_memberships_for_cluster(cluster).select_related("content_type"):
        ct = row.content_type
        if not ct or not row.object_id:
            continue
        model = ct.model_class()
        if not model:
            continue
        try:
            obj = model.objects.get(pk=row.object_id)
        except model.DoesNotExist:
            title = f"missing#{row.object_id}"
        else:
            title = entity_display_title(obj)
        out.append(
            {
                "entity_type": ct.model,
                "entity_id": row.object_id,
                "display_title": title,
                "membership_assertion_id": str(row.id),
            }
        )
    return out


def build_identity_summary(content_type: ContentType, object_id: int) -> dict[str, Any]:
    """Knowledge UI: canonical label, aliases, competing flag, ordered clusters."""
    cluster_ids = cluster_distinct_ids_for_subject(content_type, object_id)
    competing = len(cluster_ids) > 1

    memberships = list(
        active_memberships_for_subject(content_type, object_id).select_related(
            "entity_cluster", "source"
        )
    )

    def sort_key(m: HeritageAssertion) -> tuple[int, str]:
        st = m.source.source_type if m.source_id else None
        return (source_type_rank(st), str(m.id))

    memberships.sort(key=sort_key)

    clusters_meta: list[dict[str, Any]] = []
    seen: set[uuid.UUID] = set()
    for m in memberships:
        cid = m.entity_cluster_id
        if not cid or cid in seen:
            continue
        seen.add(cid)
        c = m.entity_cluster
        clusters_meta.append(
            {
                "cluster_id": str(c.id),
                "canonical_label": c.canonical_label,
                "locked": c.locked,
                "members": cluster_members_payload(c),
            }
        )

    canonical_label: str | None = None
    primary_cluster_id: str | None = None
    if len(cluster_ids) == 1:
        c = EntityCluster.objects.get(pk=cluster_ids[0])
        canonical_label = c.canonical_label
        primary_cluster_id = str(c.id)

    alias_titles: list[str] = []
    if len(cluster_ids) == 1:
        c = EntityCluster.objects.get(pk=cluster_ids[0])
        for m in active_memberships_for_cluster(c):
            if m.content_type_id == content_type.id and m.object_id == object_id:
                continue
            if not m.content_type_id:
                continue
            model = m.content_type.model_class()
            if model:
                try:
                    o = model.objects.get(pk=m.object_id)
                    alias_titles.append(entity_display_title(o))
                except model.DoesNotExist:
                    pass

    assertion_ids = [str(m.id) for m in memberships]

    return {
        "entity_type": content_type.model,
        "entity_id": object_id,
        "competing": competing,
        "canonical_label": canonical_label,
        "primary_cluster_id": primary_cluster_id,
        "alias_titles": alias_titles,
        "membership_assertion_ids": assertion_ids,
        "source_type_order": list(SOURCE_TYPE_CONFLICT_ORDER),
        "clusters": clusters_meta,
    }


def _write_audit(
    *,
    actor,
    action: str,
    reason: str,
    before: dict[str, Any],
    after: dict[str, Any],
    cluster_ids: list[uuid.UUID],
    assertion_ids: list[uuid.UUID],
    related_cluster: EntityCluster | None,
) -> ClusterAuditEvent:
    return ClusterAuditEvent.objects.create(
        action=action,
        actor=actor,
        reason=reason,
        before_state=before,
        after_state=after,
        affected_cluster_ids=[str(x) for x in cluster_ids],
        affected_assertion_ids=[str(x) for x in assertion_ids],
        related_cluster=related_cluster,
    )


def _save_new_membership_row(
    *,
    old: HeritageAssertion,
    entity_cluster: EntityCluster,
    assertion_content: str,
    contributed_by: str,
) -> HeritageAssertion:
    dup = HeritageAssertion(
        content_type=old.content_type,
        object_id=old.object_id,
        asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
        asserted_value=old.asserted_value,
        assertion_content=assertion_content,
        entity_cluster=entity_cluster,
        source_id=old.source_id,
        source_citation=old.source_citation,
        contributed_by=contributed_by or old.contributed_by,
        confidence=old.confidence,
        data_quality_note=old.data_quality_note,
        reconciliation_status="accepted",
        supersedes=old,
    )
    dup.full_clean()
    dup.save()
    return dup


@transaction.atomic
def lock_cluster(
    *,
    actor,
    cluster: EntityCluster,
    reason: str,
    expected_version: int,
) -> EntityCluster:
    if cluster.version != expected_version:
        raise ValidationError(_ERR_VERSION)
    if cluster.locked:
        raise ValidationError({"locked": "Cluster is already locked."})
    before = {"locked": cluster.locked, "version": cluster.version}
    cluster.locked = True
    cluster.version += 1
    cluster.save(update_fields=["locked", "version", "updated_at"])
    _write_audit(
        actor=actor,
        action=CLUSTER_AUDIT_ACTION_LOCK,
        reason=reason,
        before=before,
        after={"locked": cluster.locked, "version": cluster.version},
        cluster_ids=[cluster.id],
        assertion_ids=[],
        related_cluster=cluster,
    )
    return cluster


@transaction.atomic
def unlock_cluster(
    *,
    actor,
    cluster: EntityCluster,
    reason: str,
    expected_version: int,
) -> EntityCluster:
    if cluster.version != expected_version:
        raise ValidationError(_ERR_VERSION)
    if not cluster.locked:
        raise ValidationError({"locked": "Cluster is not locked."})
    before = {"locked": cluster.locked, "version": cluster.version}
    cluster.locked = False
    cluster.version += 1
    cluster.save(update_fields=["locked", "version", "updated_at"])
    _write_audit(
        actor=actor,
        action=CLUSTER_AUDIT_ACTION_UNLOCK,
        reason=reason,
        before=before,
        after={"locked": cluster.locked, "version": cluster.version},
        cluster_ids=[cluster.id],
        assertion_ids=[],
        related_cluster=cluster,
    )
    return cluster


@transaction.atomic
def merge_clusters(
    *,
    actor,
    target: EntityCluster,
    source: EntityCluster,
    reason: str,
    expected_version: int,
    lock_override: bool,
    is_expert_curator: bool,
) -> EntityCluster:
    if target.id == source.id:
        raise ValidationError("Cannot merge a cluster into itself.")
    if target.type_scope != source.type_scope:
        raise ValidationError("Clusters must share the same type_scope.")
    if source.merged_into_id:
        raise ValidationError("Source cluster is already merged.")
    if source.locked:
        raise ValidationError("Cannot merge a locked source cluster.")
    if target.version != expected_version:
        raise ValidationError(_ERR_VERSION)
    if target.locked and not lock_override:
        raise PermissionDenied("Target cluster is locked.")
    if target.locked and lock_override and not is_expert_curator:
        raise PermissionDenied("lock_override requires expert curator or staff.")

    action = (
        CLUSTER_AUDIT_ACTION_LOCK_OVERRIDE_MERGE
        if target.locked and lock_override
        else CLUSTER_AUDIT_ACTION_MERGE
    )

    new_assertion_ids: list[uuid.UUID] = []
    old_rows = list(active_memberships_for_cluster(source))
    before = {
        "target": str(target.id),
        "source": str(source.id),
        "target_version": expected_version,
        "source_memberships": [str(r.id) for r in old_rows],
    }
    actor_label = ""
    if hasattr(actor, "email") and actor.email:
        actor_label = actor.email
    elif hasattr(actor, "username"):
        actor_label = str(actor.username)

    for old in old_rows:
        old.reconciliation_status = "superseded"
        old.save(update_fields=["reconciliation_status", "updated_at"])
        merge_note = old.assertion_content or f"Merged into cluster {target.id}"
        dup = _save_new_membership_row(
            old=old,
            entity_cluster=target,
            assertion_content=merge_note,
            contributed_by=actor_label,
        )
        new_assertion_ids.append(dup.id)

    source.merged_into = target
    source.save(update_fields=["merged_into", "updated_at"])
    target.version += 1
    target.save(update_fields=["version", "updated_at"])

    after = {
        "target": str(target.id),
        "target_version": target.version,
        "new_assertions": [str(x) for x in new_assertion_ids],
    }
    _write_audit(
        actor=actor,
        action=action,
        reason=reason,
        before=before,
        after=after,
        cluster_ids=[target.id, source.id],
        assertion_ids=new_assertion_ids,
        related_cluster=target,
    )
    return target


@transaction.atomic
def split_cluster_by_groups(
    *,
    actor,
    cluster: EntityCluster,
    reason: str,
    expected_version: int,
    groups: list[list[int]],
) -> tuple[list[EntityCluster], ClusterAuditEvent]:
    """
    Each inner list is object_ids that share a new cluster after split.
    Must partition exactly the set of active member object_ids.
    """
    if cluster.version != expected_version:
        raise ValidationError(_ERR_VERSION)
    if cluster.locked:
        raise PermissionDenied("Cannot split a locked cluster.")

    active_rows = list(active_memberships_for_cluster(cluster))
    by_oid = {r.object_id: r for r in active_rows if r.object_id is not None}
    all_ids = set(by_oid.keys())
    flat: list[int] = []
    for g in groups:
        flat.extend(g)
    if set(flat) != all_ids or len(flat) != len(all_ids):
        raise ValidationError(
            "groups must partition active member ids (no dupes or omissions)."
        )

    model = ContentType.objects.get(model=cluster.type_scope).model_class()
    if not model:
        raise ValidationError("Unknown type_scope for cluster.")

    new_clusters: list[EntityCluster] = []
    new_assertion_ids: list[uuid.UUID] = []
    mem_ids = [str(r.id) for r in active_rows]
    before = {"cluster": str(cluster.id), "memberships": mem_ids}
    actor_label = ""
    if hasattr(actor, "email") and actor.email:
        actor_label = actor.email
    elif hasattr(actor, "username"):
        actor_label = str(actor.username)

    for group in groups:
        labels: list[str] = []
        for oid in group:
            try:
                obj = model.objects.get(pk=oid)
                labels.append(entity_display_title(obj))
            except model.DoesNotExist:
                labels.append(f"{cluster.type_scope}#{oid}")
        label = " / ".join(labels)[:500]
        nc = EntityCluster.objects.create(
            canonical_label=label or "Split cluster",
            type_scope=cluster.type_scope,
            locked=False,
            note="",
        )
        new_clusters.append(nc)
        for oid in group:
            old = by_oid.get(oid)
            if not old:
                continue
            old.reconciliation_status = "superseded"
            old.save(update_fields=["reconciliation_status", "updated_at"])
            dup = _save_new_membership_row(
                old=old,
                entity_cluster=nc,
                assertion_content=f"Split from cluster {cluster.id}",
                contributed_by=actor_label,
            )
            new_assertion_ids.append(dup.id)

    cluster.version += 1
    cluster.save(update_fields=["version", "updated_at"])

    after = {
        "original_cluster": str(cluster.id),
        "new_clusters": [str(c.id) for c in new_clusters],
    }
    ev = _write_audit(
        actor=actor,
        action=CLUSTER_AUDIT_ACTION_SPLIT,
        reason=reason,
        before=before,
        after=after,
        cluster_ids=[cluster.id] + [c.id for c in new_clusters],
        assertion_ids=new_assertion_ids,
        related_cluster=cluster,
    )
    return new_clusters, ev


def conflicting_subject_assertion_ids() -> list[uuid.UUID]:
    """Assertion IDs for subjects with competing identity (US6)."""
    dup_rows = (
        HeritageAssertion.objects.filter(
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            reconciliation_status="accepted",
            entity_cluster__isnull=False,
        )
        .exclude(id__in=_superseded_assertion_ids())
        .values("content_type_id", "object_id")
        .annotate(n=Count("entity_cluster_id", distinct=True))
        .filter(n__gt=1)
    )
    pairs = list(dup_rows)
    if not pairs:
        return []
    q = reduce(
        or_,
        (
            Q(content_type_id=p["content_type_id"], object_id=p["object_id"])
            for p in pairs
        ),
    )
    return list(
        HeritageAssertion.objects.filter(q)
        .filter(
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            reconciliation_status="accepted",
            entity_cluster__isnull=False,
        )
        .exclude(id__in=_superseded_assertion_ids())
        .values_list("id", flat=True)
    )


@transaction.atomic
def resolve_identity_candidate(
    *,
    actor,
    candidate: IdentityResolutionCandidate,
    resolution: str,
    notes: str,
    target_cluster_id: uuid.UUID | None,
) -> tuple[IdentityResolutionCandidate, list[uuid.UUID]]:
    """Accept (link both sides to cluster), reject, or defer a candidate."""
    if candidate.status != "open":
        raise ValidationError("This candidate is no longer open.")

    created_ids: list[uuid.UUID] = []
    if resolution == "defer":
        candidate.status = "deferred"
        candidate.notes = notes or candidate.notes
        candidate.resolved_by = actor
        candidate.resolved_at = timezone.now()
        uf = ["status", "notes", "resolved_by", "resolved_at", "updated_at"]
        candidate.save(update_fields=uf)
        return candidate, created_ids

    if resolution == "reject":
        candidate.status = "rejected"
        candidate.notes = notes or candidate.notes
        candidate.resolved_by = actor
        candidate.resolved_at = timezone.now()
        uf = ["status", "notes", "resolved_by", "resolved_at", "updated_at"]
        candidate.save(update_fields=uf)
        return candidate, created_ids

    if resolution != "accept":
        raise ValidationError({"resolution": "Use accept, reject, or defer."})

    if not target_cluster_id:
        raise ValidationError({"target_cluster_id": "Required for accept."})

    try:
        target = EntityCluster.objects.get(pk=target_cluster_id)
    except EntityCluster.DoesNotExist:
        raise ValidationError({"target_cluster_id": "Cluster not found."}) from None
    if target.type_scope != candidate.left_content_type.model:
        raise ValidationError("target_cluster type_scope does not match candidate.")
    if candidate.right_content_type.model != candidate.left_content_type.model:
        raise ValidationError("Candidate sides must share the same entity type.")

    actor_label = ""
    if hasattr(actor, "email") and actor.email:
        actor_label = actor.email
    elif hasattr(actor, "username"):
        actor_label = str(actor.username)

    res_msg = f"Resolved candidate {candidate.id} to cluster {target.id}"
    for ct, oid in (
        (candidate.left_content_type, candidate.left_object_id),
        (candidate.right_content_type, candidate.right_object_id),
    ):
        existing = active_memberships_for_subject(ct, oid).first()
        if existing and existing.entity_cluster_id == target.id:
            continue
        if existing:
            existing.reconciliation_status = "superseded"
            existing.save(update_fields=["reconciliation_status", "updated_at"])
            dup = _save_new_membership_row(
                old=existing,
                entity_cluster=target,
                assertion_content=res_msg,
                contributed_by=actor_label,
            )
            created_ids.append(dup.id)
        else:
            dup = HeritageAssertion(
                content_type=ct,
                object_id=oid,
                asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
                asserted_value="",
                assertion_content=res_msg,
                entity_cluster=target,
                contributed_by=actor_label,
                reconciliation_status="accepted",
            )
            dup.full_clean()
            dup.save()
            created_ids.append(dup.id)

    candidate.status = "accepted"
    candidate.notes = notes or candidate.notes
    candidate.resolved_by = actor
    candidate.resolved_at = timezone.now()
    candidate.save(
        update_fields=["status", "notes", "resolved_by", "resolved_at", "updated_at"]
    )
    return candidate, created_ids
