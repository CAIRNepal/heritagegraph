"""SHACL validation hook — called before every ingest when validate_on_ingest=True."""
from pathlib import Path

import pyshacl
from rdflib import Graph

from app.core.config import settings

_shapes_cache: Graph | None = None


def _load_shapes() -> Graph:
    global _shapes_cache
    if _shapes_cache is None:
        _shapes_cache = Graph()
        shapes_dir = Path(settings.shapes_dir)
        for ttl in shapes_dir.glob("*.ttl"):
            _shapes_cache.parse(str(ttl), format="turtle")
    return _shapes_cache


def reload_shapes() -> None:
    """Force re-read of shape files (useful after hot-reload)."""
    global _shapes_cache
    _shapes_cache = None


def validate_graph(data_graph: Graph) -> tuple[bool, str]:
    """
    Returns (conforms, human-readable report).
    Raises nothing — callers decide how to handle failures.
    """
    shapes = _load_shapes()
    conforms, _, report_text = pyshacl.validate(
        data_graph,
        shacl_graph=shapes,
        inference="rdfs",
        abort_on_first=False,
        meta_shacl=False,
    )
    return conforms, report_text
