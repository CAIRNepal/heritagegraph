"""N-Triples line formatting for RDF dumps."""

from __future__ import annotations


def format_nt_line(subject: str, predicate: str, obj: str) -> str:
    if obj.startswith("http://") or obj.startswith("https://"):
        return f"<{subject}> <{predicate}> <{obj}> ."
    escaped = obj.replace("\\", "\\\\").replace('"', '\\"')
    return f'<{subject}> <{predicate}> "{escaped}" .'


def dump_graph_ntriples(graph_uri: str) -> bytes:
    """Exact N-Triples for one named graph, from the triplestore's serialiser.

    :func:`format_nt_line` drops datatypes and language tags and does not
    escape newlines; use this for anything published (dumps, deposits).
    Local stores are dumped by pyoxigraph; a remote Oxigraph through its Graph
    Store endpoint next to ``/query``.
    """
    import requests
    from apps.graph.kg_engine.engine import get_kg_engine
    from apps.graph.kg_engine.store import _open_local_store_readonly

    store = get_kg_engine().store
    endpoint = store._query_endpoint()
    if endpoint:
        resp = requests.get(
            endpoint.rsplit("/", 1)[0] + "/store",
            params={"graph": graph_uri},
            headers={"Accept": "application/n-triples"},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.content
    from pyoxigraph import NamedNode, RdfFormat

    local = _open_local_store_readonly(store._local_store_path())
    return (
        local.dump(format=RdfFormat.N_TRIPLES, from_graph=NamedNode(graph_uri)) or b""
    )


def ntriples_to_nquads(ntriples: bytes, graph_uri: str) -> bytes:
    """Put each N-Triples statement into ``graph_uri``."""
    out = []
    for line in ntriples.decode("utf-8").splitlines():
        line = line.strip()
        if line:
            out.append(f"{line[:-1].rstrip()} <{graph_uri}> .\n")
    return "".join(out).encode("utf-8")
