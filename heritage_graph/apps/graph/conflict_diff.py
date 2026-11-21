"""
Compute a diff between a project named graph and the main PUBLIC graph.

Returns a lightweight summary (triple counts + conflict URIs) stored as JSON
on the MergeRequest.conflict_diff field.  The full triple details are available
at GET /api/merge-requests/{id}/rdf-diff/ (served live from Oxigraph).
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class GraphDiff:
    """Summary of differences between the project graph and the main graph."""

    added_count: int = 0
    removed_count: int = 0
    conflict_count: int = 0
    added_subjects: list[str] = field(default_factory=list)
    conflicting_triples: list[dict[str, str]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_diff(project_id: str, *, subject_limit: int = 200) -> GraphDiff:
    """
    Compare the project graph with the main graph.

    Algorithm:
    1. Fetch all (s, p, o) from the project named graph.
    2. For each (s, p, o), check whether the same triple exists in PUBLIC.
       - If not, it is "added".
    3. For each (s, p) present in the project graph, check whether PUBLIC has
       a different `o` — these are "conflicts".
    4. removed_count is always 0 for new contributions (projects only add).

    Returns:
        GraphDiff with aggregate counts and a list of unique added subjects.
    """
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.partitions import GraphPartition

    project_graph = GraphPartition.PROJECT.uri(suffix=project_id)
    public_graph = GraphPartition.PUBLIC.uri()
    if not project_graph or not public_graph:
        return GraphDiff()

    engine = get_kg_engine()

    try:
        project_triples = _fetch_triples(engine, project_graph)
    except Exception as exc:
        logger.warning("conflict_diff: could not fetch project graph: %s", exc)
        return GraphDiff()

    if not project_triples:
        return GraphDiff()

    added: list[tuple[str, str, str]] = []
    conflicts: list[dict[str, str]] = []
    added_subjects: set[str] = set()

    for s, p, o in project_triples:
        if not _triple_in_graph(engine, s, p, o, public_graph):
            added.append((s, p, o))
            added_subjects.add(s)
        else:
            # Check if PUBLIC has a different value for the same (s, p)
            public_vals = _values_for_sp(engine, s, p, public_graph)
            if public_vals and o not in public_vals:
                conflicts.append({"subject": s, "predicate": p, "project_value": o, "main_value": public_vals[0]})

    return GraphDiff(
        added_count=len(added),
        removed_count=0,
        conflict_count=len(conflicts),
        added_subjects=list(added_subjects)[:subject_limit],
        conflicting_triples=conflicts[:50],
    )


def _fetch_triples(engine: Any, graph_uri: str) -> list[tuple[str, str, str]]:
    rows = engine.store.select(
        f"SELECT ?s ?p ?o WHERE {{ GRAPH <{graph_uri}> {{ ?s ?p ?o }} }} LIMIT 10000"
    )
    return [(r["s"], r["p"], r["o"]) for r in rows if "s" in r and "p" in r and "o" in r]


def _triple_in_graph(engine: Any, s: str, p: str, o: str, graph_uri: str) -> bool:
    if o.startswith("http://") or o.startswith("https://"):
        q = f"ASK {{ GRAPH <{graph_uri}> {{ <{s}> <{p}> <{o}> }} }}"
    else:
        escaped = o.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        q = f'ASK {{ GRAPH <{graph_uri}> {{ <{s}> <{p}> "{escaped}" }} }}'
    try:
        return bool(engine.store.ask(q))
    except Exception:
        return False


def _values_for_sp(engine: Any, s: str, p: str, graph_uri: str) -> list[str]:
    q = f"SELECT ?o WHERE {{ GRAPH <{graph_uri}> {{ <{s}> <{p}> ?o }} }} LIMIT 5"
    try:
        rows = engine.store.select(q)
        return [r["o"] for r in rows if "o" in r]
    except Exception:
        return []
