"""
Compatibility re-export module.

Oxigraph-specific code lives in `apps.graph.oxigraph.*` for readability.
Keep this file so existing imports (`from apps.graph.client import graph_client`)
continue to work.
"""

from apps.graph.oxigraph.client_oxigraph import (  # noqa: F401
    OxigraphClient,
    get_graph_client,
    graph_client,
)

