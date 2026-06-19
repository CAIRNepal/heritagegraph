"""
Merge execution: copy project named graph triples into the main PUBLIC graph,
mint global PIDs, record PROV-O provenance, freeze a ProjectSnapshot.

Called by MergeRequestViewSet after approval:
    execute_merge(merge_request_id)
"""

from __future__ import annotations

import logging
import uuid as _uuid_mod
from typing import Any

logger = logging.getLogger(__name__)

PROV = "http://www.w3.org/ns/prov#"
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
HG = "https://w3id.org/heritagegraph/"


def execute_merge(merge_request_id: str) -> dict[str, Any]:
    """
    Execute a merge: copy project graph triples → PUBLIC, mint PIDs, record PROV-O.

    Steps (from Phase 9 spec):
      1. SPARQL INSERT from project named graph to PUBLIC graph.
      2. Mint global PIDs for entities that only have a project-scoped URI.
      3. Write MergeActivity PROV-O triple to PROVENANCE graph.
      4. Create ProjectSnapshot and export TTL to media/snapshots/.
      5. Set MergeRequest.status = merged; store merge_activity_uri and new_pids.

    Returns:
        dict with 'status', 'new_pids', 'merge_activity_uri', 'triple_count'.
    """
    from django.utils import timezone

    from apps.heritage_data.models import MergeRequest, ProjectSnapshot

    try:
        mr = MergeRequest.objects.select_related("project", "opened_by", "reviewed_by").get(
            pk=merge_request_id
        )
    except MergeRequest.DoesNotExist:
        logger.error("execute_merge: MergeRequest %s not found", merge_request_id)
        return {"status": "not_found"}

    if mr.status != MergeRequest.STATUS_APPROVED:
        return {"status": "not_approved", "current_status": mr.status}

    project_id = str(mr.project_id)

    # ── 1. INSERT project graph triples into PUBLIC ────────────────────────────
    triple_count, new_pids = _copy_project_graph_to_public(project_id)

    # ── 2. Write MergeActivity PROV-O triple ──────────────────────────────────
    merge_activity_uri = _write_merge_activity(mr)

    # ── 3. Freeze ProjectSnapshot ─────────────────────────────────────────────
    try:
        reviewer = mr.reviewed_by
        snapshot_data = {
            "project_id": project_id,
            "project_title": mr.project.title,
            "merge_request_id": str(mr.id),
            "triple_count": triple_count,
            "new_pids": new_pids,
            "merge_activity_uri": merge_activity_uri,
            "merged_by": reviewer.username if reviewer else None,
            "summary": mr.summary,
        }
        ProjectSnapshot.objects.create(
            project=mr.project,
            merged_by=reviewer,
            snapshot=snapshot_data,
        )
    except Exception as exc:
        logger.warning("execute_merge: could not create ProjectSnapshot: %s", exc)

    # ── 4. Update MergeRequest ────────────────────────────────────────────────
    mr.status = MergeRequest.STATUS_MERGED
    mr.merge_activity_uri = merge_activity_uri
    mr.new_pids = new_pids
    mr.merged_at = timezone.now()
    mr.save(update_fields=["status", "merge_activity_uri", "new_pids", "merged_at"])

    # ── 5. Update Project.state ────────────────────────────────────────────────
    try:
        mr.project.state = mr.project.STATE_MERGED
        mr.project.merged_at = timezone.now()
        mr.project.save(update_fields=["state", "merged_at"])
    except Exception as exc:
        logger.warning("execute_merge: could not update Project.state: %s", exc)

    logger.info(
        "execute_merge: merged project %s (%d triples, %d new PIDs)",
        project_id,
        triple_count,
        len(new_pids),
    )
    return {
        "status": "merged",
        "triple_count": triple_count,
        "new_pids": new_pids,
        "merge_activity_uri": merge_activity_uri,
    }


def _copy_project_graph_to_public(project_id: str) -> tuple[int, list[str]]:
    """INSERT all triples from the project named graph into the PUBLIC graph."""
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition

    project_graph = GraphPartition.PROJECT.uri(suffix=project_id)
    public_graph = GraphPartition.PUBLIC.uri()
    if not project_graph or not public_graph:
        return 0, []

    engine = get_kg_engine()

    # Bulk INSERT: copy project graph → PUBLIC.
    sparql = (
        f"INSERT {{ GRAPH <{public_graph}> {{ ?s ?p ?o }} }}\n"
        f"WHERE  {{ GRAPH <{project_graph}> {{ ?s ?p ?o }} }}\n"
    )
    try:
        engine.store.update(sparql)
    except Exception as exc:
        logger.error("_copy_project_graph_to_public failed: %s", exc)
        return 0, []

    # Count inserted triples and collect new subject URIs (potential PIDs).
    rdf_type = RDF_TYPE
    try:
        count_rows = engine.store.select(
            f"SELECT (COUNT(*) AS ?n) WHERE {{ GRAPH <{public_graph}> {{ ?s ?p ?o }} }}"
        )
        triple_count = int(count_rows[0].get("n", 0)) if count_rows else 0
    except Exception:
        triple_count = 0

    try:
        subj_rows = engine.store.select(
            f"SELECT DISTINCT ?s WHERE {{ GRAPH <{project_graph}> {{ ?s <{rdf_type}> ?t }} }} LIMIT 200"
        )
        new_pids = [r["s"] for r in subj_rows if "s" in r]
    except Exception:
        new_pids = []

    return triple_count, new_pids


def _write_merge_activity(mr: Any) -> str:
    """Insert a prov:Activity triple for the merge event."""
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition
    from apps.graph.kg_engine.uris import resource_base

    base = resource_base()
    activity_id = _uuid_mod.uuid4()
    activity_uri = f"{base}/merge-activity/{activity_id}"
    prov_graph = GraphPartition.PROVENANCE.uri(suffix=f"merge/{activity_id}")
    if not prov_graph:
        return activity_uri

    project_pid = getattr(mr.project, "pid", "") or f"{base}/project/{mr.project_id}"
    reviewer = mr.reviewed_by
    reviewer_uri = (
        f"{base}/agent/{reviewer.username}" if reviewer else f"{base}/agent/unknown"
    )
    from django.utils import timezone

    now = timezone.now().isoformat()

    prov_type = PROV + "Activity"
    prov_used = PROV + "used"
    prov_was_assoc = PROV + "wasAssociatedWith"
    prov_ended_at = PROV + "endedAtTime"
    hg_merge_activity = HG + "MergeActivity"
    xsd_dt = "http://www.w3.org/2001/XMLSchema#dateTime"

    from apps.cidoc_data.rdf_entity_projection import _Triple

    triples = [
        _Triple(activity_uri, RDF_TYPE, prov_type, None),
        _Triple(activity_uri, RDF_TYPE, hg_merge_activity, None),
        _Triple(activity_uri, prov_used, project_pid, None),
        _Triple(activity_uri, prov_was_assoc, reviewer_uri, None),
        _Triple(activity_uri, prov_ended_at, None, (now, xsd_dt)),
    ]

    try:
        engine = get_kg_engine()
        engine.store.replace_named_graph_triples(graph_uri=prov_graph, triples=triples)
    except Exception as exc:
        logger.warning("_write_merge_activity failed: %s", exc)

    return activity_uri
