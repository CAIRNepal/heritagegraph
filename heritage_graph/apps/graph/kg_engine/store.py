"""Oxigraph read/write adapter (HTTP endpoint or local pyoxigraph)."""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from django.conf import settings

from apps.graph.client import graph_client

logger = logging.getLogger(__name__)

# A pyoxigraph RocksDB store takes an exclusive lock and is safe to share across
# threads, so cache one handle per path instead of re-opening on every read/write.
# Re-opening per call caused silent lock contention (writes dropped while a read
# handle was open). Only used for the embedded dev fallback; production uses the
# Oxigraph HTTP endpoint.
_LOCAL_STORE_CACHE: dict[str, Any] = {}
_LOCAL_READONLY_CACHE: dict[str, Any] = {}
_LOCAL_STORE_LOCK = threading.Lock()


def _open_local_store(path: str):
    """Read-write embedded store (exclusive lock; one writer process at a time)."""
    store = _LOCAL_STORE_CACHE.get(path)
    if store is not None:
        return store
    with _LOCAL_STORE_LOCK:
        store = _LOCAL_STORE_CACHE.get(path)
        if store is None:
            from pyoxigraph import Store

            store = Store(path)
            _LOCAL_STORE_CACHE[path] = store
        return store


def _open_local_store_readonly(path: str):
    """Read-only handle — safe alongside runserver or other CLI readers."""
    store = _LOCAL_READONLY_CACHE.get(path)
    if store is not None:
        return store
    with _LOCAL_STORE_LOCK:
        store = _LOCAL_READONLY_CACHE.get(path)
        if store is None:
            from pyoxigraph import Store

            store = Store.read_only(path)
            _LOCAL_READONLY_CACHE[path] = store
        return store


@dataclass
class StoreStats:
    total_triples: int
    public_triples: int
    schema_triples: int
    source: str


class KnowledgeGraphStore:
    """Low-level triplestore operations."""

    def select(self, sparql: str, *, timeout_s: int = 30) -> list[dict[str, str]]:
        endpoint = self._query_endpoint()
        if endpoint:
            return self._remote_select(endpoint, sparql, timeout_s=timeout_s)
        return self._local_select(sparql, read_only=True)

    def iter_named_graph_triples(
        self, graph_uri: str, *, limit: int | None = None
    ) -> Iterator[tuple[str, str, str]]:
        """Yield (subject, predicate, object) from a named graph; object is IRI or literal string."""
        if not graph_uri:
            return
        endpoint = self._query_endpoint()
        if endpoint:
            sparql = f"SELECT ?s ?p ?o WHERE {{ GRAPH <{graph_uri}> {{ ?s ?p ?o }} }}"
            if limit is not None:
                sparql += f" LIMIT {int(limit)}"
            for row in self.select(sparql):
                s, p, o = row.get("s"), row.get("p"), row.get("o")
                if s and p and o is not None:
                    yield s, p, o
            return
        if not self._local_available():
            return
        try:
            from pyoxigraph import NamedNode

            store = _open_local_store_readonly(self._local_store_path())
            graph_name = NamedNode(graph_uri)
            count = 0
            from pyoxigraph import Literal, NamedNode

            for quad in store.quads_for_pattern(None, None, None, graph_name):
                s = quad.subject.value
                p = quad.predicate.value
                obj = quad.object
                if isinstance(obj, NamedNode):
                    o = obj.value
                elif isinstance(obj, Literal):
                    o = obj.value
                else:
                    o = str(obj)
                yield s, p, o
                count += 1
                if limit is not None and count >= limit:
                    break
        except OSError as exc:
            logger.warning(
                "Cannot read local Oxigraph at %s (%s). Stop runserver or set RDF_QUERY_URL.",
                self._local_store_path(),
                exc,
            )
        except Exception:
            logger.debug("iter_named_graph_triples failed", exc_info=True)

    def iter_named_graph_terms(
        self, graph_uri: str, *, limit: int | None = None
    ) -> "Iterator[tuple[str, str, dict]]":
        """Yield (subject, predicate, object_term) preserving RDF term kind.

        ``object_term`` is ``{"kind": "uri"|"literal"|"bnode", "value": str,
        "datatype": str|None, "lang": str|None}``. Unlike
        :meth:`iter_named_graph_triples`, this does NOT stringify objects, so a
        reasoner cannot mistake a literal that happens to start with ``http``
        for an IRI, and datatypes/language tags survive.
        """
        if not graph_uri:
            return
        if not self._query_endpoint() and self._local_available():
            try:
                from pyoxigraph import BlankNode, Literal, NamedNode

                store = _open_local_store_readonly(self._local_store_path())
                graph_name = NamedNode(graph_uri)
                count = 0
                for quad in store.quads_for_pattern(None, None, None, graph_name):
                    obj = quad.object
                    if isinstance(obj, NamedNode):
                        term = {"kind": "uri", "value": obj.value, "datatype": None, "lang": None}
                    elif isinstance(obj, BlankNode):
                        term = {"kind": "bnode", "value": obj.value, "datatype": None, "lang": None}
                    elif isinstance(obj, Literal):
                        term = {
                            "kind": "literal",
                            "value": obj.value,
                            "datatype": obj.datatype.value if obj.datatype else None,
                            "lang": obj.language,
                        }
                    else:
                        term = {"kind": "literal", "value": str(obj), "datatype": None, "lang": None}
                    yield quad.subject.value, quad.predicate.value, term
                    count += 1
                    if limit is not None and count >= limit:
                        break
                return
            except OSError as exc:
                logger.warning("Cannot read local Oxigraph at %s (%s).", self._local_store_path(), exc)
                return
            except Exception:
                logger.debug("iter_named_graph_terms (local) failed", exc_info=True)
                return
        # Remote SPARQL fallback: ``?o`` typing is not exposed by the simplified
        # select(), so classify conservatively (well-formed IRI vs literal).
        for s, p, o in self.iter_named_graph_triples(graph_uri, limit=limit):
            is_iri = o.startswith(("http://", "https://")) and not any(
                ch in o for ch in " \t\n\"<>{}|\\^`"
            )
            yield s, p, {
                "kind": "uri" if is_iri else "literal",
                "value": o,
                "datatype": None,
                "lang": None,
            }

    def update(self, sparql_update: str, *, timeout_s: int = 45) -> bool:
        endpoint = self._update_endpoint()
        if endpoint:
            return self._remote_update(endpoint, sparql_update, timeout_s=timeout_s)
        return self._local_update(sparql_update)

    def replace_managed_triples(
        self,
        *,
        subject_uri: str,
        managed_predicate_iris: set[str],
        triples: list[Any],
        graph_uri: str | None,
    ) -> bool:
        from apps.cidoc_data.rdf_entity_projection import (
            INSERT_PREFIX_LINES,
            sparql_delete_subject_predicates,
            sparql_insert_for_triples,
        )

        delete_fragment = sparql_delete_subject_predicates(
            subject_uri, managed_predicate_iris, graph_uri=graph_uri
        )
        insert_fragment = sparql_insert_for_triples(triples, graph_uri=graph_uri)
        # The insert fragment carries a PREFIX prologue. Concatenated after the
        # DELETE operations it would land mid-update-sequence, which the Oxigraph
        # HTTP server rejects ("expected CREATE, DELETE, INSERT"). Hoist the
        # single prologue to the front so the combined update is valid SPARQL.
        if insert_fragment.startswith(INSERT_PREFIX_LINES):
            insert_fragment = insert_fragment[len(INSERT_PREFIX_LINES):]
        combined = INSERT_PREFIX_LINES + delete_fragment + insert_fragment
        return self.update(combined)

    def upsert_literal_triple(
        self,
        *,
        subject_uri: str,
        pred_uri: str,
        lexical: str,
        datatype: str = "",
        graph_uri: str | None,
    ) -> bool:
        escaped = lexical.replace("\\", "\\\\").replace('"', '\\"')
        if datatype:
            obj = f'"{escaped}"^^<{datatype}>'
        else:
            obj = f'"{escaped}"'
        if graph_uri:
            sparql = (
                f"DELETE WHERE {{ GRAPH <{graph_uri}> {{ "
                f"<{subject_uri}> <{pred_uri}> ?o . }} }};\n"
                f"INSERT DATA {{ GRAPH <{graph_uri}> {{ "
                f"<{subject_uri}> <{pred_uri}> {obj} . }} }}\n"
            )
        else:
            sparql = (
                f"DELETE WHERE {{ <{subject_uri}> <{pred_uri}> ?o . }};\n"
                f"INSERT DATA {{ <{subject_uri}> <{pred_uri}> {obj} . }}\n"
            )
        return self.update(sparql)

    def upsert_object_triple(
        self,
        *,
        subject_uri: str,
        pred_uri: str,
        object_uri: str,
        graph_uri: str | None,
    ) -> bool:
        if graph_uri:
            sparql = (
                f"DELETE WHERE {{ GRAPH <{graph_uri}> {{ "
                f"<{subject_uri}> <{pred_uri}> <{object_uri}> . }} }};\n"
                f"INSERT DATA {{ GRAPH <{graph_uri}> {{ "
                f"<{subject_uri}> <{pred_uri}> <{object_uri}> . }} }}\n"
            )
        else:
            sparql = (
                f"DELETE WHERE {{ <{subject_uri}> <{pred_uri}> <{object_uri}> . }};\n"
                f"INSERT DATA {{ <{subject_uri}> <{pred_uri}> <{object_uri}> . }}\n"
            )
        return self.update(sparql)

    def delete_subject(self, *, subject_uri: str, graph_uri: str | None) -> bool:
        if graph_uri:
            sparql = f"DELETE WHERE {{ GRAPH <{graph_uri}> {{ <{subject_uri}> ?p ?o . }} }}\n"
        else:
            sparql = f"DELETE WHERE {{ <{subject_uri}> ?p ?o . }}\n"
        return self.update(sparql)

    def clear_named_graph(self, graph_uri: str) -> bool:
        """Remove all triples from a named graph (Oxigraph-safe)."""
        if not graph_uri:
            return False
        sparql = f"DELETE WHERE {{ GRAPH <{graph_uri}> {{ ?s ?p ?o . }} }}\n"
        ok = self.update(sparql)
        if ok:
            return True
        # Graph may not exist yet — treat as empty.
        return True

    def replace_named_graph_triples(
        self, *, graph_uri: str, triples: list[Any]
    ) -> bool:
        """Replace entire contents of a named graph with the given triples."""
        from apps.cidoc_data.rdf_entity_projection import (
            INSERT_PREFIX_LINES,
            sparql_insert_for_triples,
        )

        if not graph_uri:
            return False
        self.clear_named_graph(graph_uri)
        if not triples:
            return True
        insert_fragment = sparql_insert_for_triples(triples, graph_uri=graph_uri)
        if insert_fragment.startswith(INSERT_PREFIX_LINES):
            insert_fragment = insert_fragment[len(INSERT_PREFIX_LINES) :]
        return self.update(INSERT_PREFIX_LINES + insert_fragment)

    def insert_ntriples(self, ntriples: str, *, graph_uri: str | None) -> bool:
        body = (ntriples or "").strip()
        if not body:
            return True
        if graph_uri:
            sparql = f"INSERT DATA {{ GRAPH <{graph_uri}> {{\n{body}\n}} }}\n"
        else:
            sparql = f"INSERT DATA {{\n{body}\n}}\n"
        return self.update(sparql)

    def copy_graph(
        self, *, source_graph_uri: str, target_graph_uri: str, subject_uri: str | None = None
    ) -> bool:
        """Copy triples from one named graph into another (optional subject filter)."""
        if subject_uri:
            where = (
                f"GRAPH <{source_graph_uri}> {{ <{subject_uri}> ?p ?o . }} "
                f"BIND(<{subject_uri}> AS ?s)"
            )
            insert = f"GRAPH <{target_graph_uri}> {{ ?s ?p ?o . }}"
            sparql = f"INSERT {{ {insert} }} WHERE {{ {where} }}\n"
        else:
            sparql = (
                f"INSERT {{ GRAPH <{target_graph_uri}> {{ ?s ?p ?o . }} }} "
                f"WHERE {{ GRAPH <{source_graph_uri}> {{ ?s ?p ?o . }} }}\n"
            )
        return self.update(sparql)

    def stats(self, *, public_graph_uri: str | None, schema_graph_uri: str | None) -> StoreStats:
        total = 0
        public = 0
        schema = 0
        source = "unknown"

        # Count triples in the default graph AND all named graphs; a bare
        # `{ ?s ?p ?o }` only matches the default graph, which under-reports the
        # total since HeritageGraph data lives in named graphs (public, schema…).
        rows = self.select(
            "SELECT (COUNT(*) AS ?c) WHERE { "
            "{ ?s ?p ?o } UNION { GRAPH ?g { ?s ?p ?o } } }"
        )
        if rows:
            total = int(rows[0].get("c", 0) or 0)
            source = "sparql"

        if public_graph_uri:
            rows = self.select(
                f"SELECT (COUNT(*) AS ?c) WHERE {{ GRAPH <{public_graph_uri}> {{ ?s ?p ?o }} }}"
            )
            if rows:
                public = int(rows[0].get("c", 0) or 0)

        if schema_graph_uri:
            rows = self.select(
                f"SELECT (COUNT(*) AS ?c) WHERE {{ GRAPH <{schema_graph_uri}> {{ ?s ?p ?o }} }}"
            )
            if rows:
                schema = int(rows[0].get("c", 0) or 0)

        return StoreStats(
            total_triples=total,
            public_triples=public,
            schema_triples=schema,
            source=source,
        )

    def health(self) -> bool:
        if self._update_endpoint() or self._query_endpoint():
            return graph_client.health()
        return self._local_available()

    def _query_endpoint(self) -> str:
        return (
            str(getattr(settings, "RDF_QUERY_URL", "") or "").strip()
            or str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()
        )

    def _update_endpoint(self) -> str:
        return str(getattr(settings, "RDF_ENDPOINT_URL", "") or "").strip()

    def _remote_select(
        self, endpoint: str, sparql: str, *, timeout_s: int
    ) -> list[dict[str, str]]:
        import requests

        base = endpoint.replace("/update", "").replace("/sparql", "").rstrip("/")
        for url in (f"{base}/query", endpoint, f"{base}/sparql"):
            try:
                resp = requests.get(
                    url,
                    params={"query": sparql},
                    headers={"Accept": "application/sparql-results+json"},
                    timeout=timeout_s,
                )
                resp.raise_for_status()
                bindings = resp.json().get("results", {}).get("bindings", [])
                return [{k: v.get("value", "") for k, v in row.items()} for row in bindings]
            except Exception:
                continue
        return []

    def _remote_update(self, endpoint: str, sparql: str, *, timeout_s: int) -> bool:
        import requests

        base = endpoint.replace("/update", "").replace("/sparql", "").rstrip("/")
        for url in (endpoint, f"{base}/update", f"{base}/sparql"):
            try:
                resp = requests.post(
                    url,
                    data=sparql.encode("utf-8"),
                    headers={"Content-Type": "application/sparql-update"},
                    timeout=timeout_s,
                )
                resp.raise_for_status()
                return True
            except Exception as exc:
                logger.warning("SPARQL update failed at %s: %s", url, exc)
        return False

    def _local_available(self) -> bool:
        try:
            import pyoxigraph  # noqa: F401
        except ImportError:
            return False
        return True

    def _local_store_path(self) -> str:
        return str(getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db") or "oxigraph_db")

    def _local_select(self, sparql: str, *, read_only: bool = True) -> list[dict[str, str]]:
        if not self._local_available():
            return []
        path = self._local_store_path()
        try:
            store = (
                _open_local_store_readonly(path)
                if read_only
                else _open_local_store(path)
            )
            result = store.query(sparql)
            # pyoxigraph 0.5.x: a QuerySolution is not convertible via dict();
            # iterate the result's variables and index each solution by Variable.
            variables = list(getattr(result, "variables", []) or [])
            bindings = []
            for sol in result:
                row: dict[str, str] = {}
                for var in variables:
                    term = sol[var]
                    if term is None:
                        continue
                    key = getattr(var, "value", str(var).lstrip("?"))
                    row[key] = getattr(term, "value", str(term))
                bindings.append(row)
            return bindings
        except OSError as exc:
            logger.warning(
                "Local SPARQL SELECT failed (%s). Stop Django runserver or use Oxigraph HTTP.",
                exc,
            )
            return []
        except Exception:
            logger.debug("Local SPARQL SELECT failed", exc_info=True)
            return []

    def _local_update(self, sparql: str) -> bool:
        if not self._local_available():
            return False
        try:
            store = _open_local_store(self._local_store_path())
            store.update(sparql)
            return True
        except Exception:
            logger.warning("Local SPARQL UPDATE failed", exc_info=True)
            return False

    def _triple_to_quad(self, t: Any, *, graph_uri: str | None):
        try:
            from pyoxigraph import Literal, NamedNode, Quad
        except ImportError:
            return None

        from apps.cidoc_data.rdf_entity_projection import RDF_PREFIXES

        graph_name = NamedNode(graph_uri) if graph_uri else None
        sub = NamedNode(t.subj)
        pred = NamedNode(t.pred)
        if t.obj_uri:
            return Quad(sub, pred, NamedNode(t.obj_uri), graph_name)
        if not t.literal:
            return None
        lexical, datatype = t.literal
        geo_wkt = RDF_PREFIXES["geo"] + "wktLiteral"
        if not datatype:
            return Quad(sub, pred, Literal(lexical), graph_name)
        if datatype == geo_wkt:
            return Quad(sub, pred, Literal(lexical, datatype=NamedNode(geo_wkt)), graph_name)
        return Quad(sub, pred, Literal(lexical, datatype=NamedNode(datatype)), graph_name)

    def local_replace_named_graph(self, graph_uri: str, triples: list[Any]) -> bool:
        """Replace all triples in a named graph using pyoxigraph quads (local store only)."""
        if not self._local_available() or not graph_uri:
            return False
        try:
            from pyoxigraph import NamedNode
        except ImportError:
            return False
        store = _open_local_store(self._local_store_path())
        graph_name = NamedNode(graph_uri)
        try:
            for q in list(store.quads_for_pattern(None, None, None, graph_name)):
                store.remove(q)
        except Exception:
            pass
        for triple in triples:
            quad = self._triple_to_quad(triple, graph_uri=graph_uri)
            if quad is None:
                continue
            try:
                store.add(quad)
            except Exception as exc:
                logger.warning("Local quad insert failed: %s", exc)
                return False
        return True

    def local_replace_managed_triples(
        self,
        *,
        subject_uri: str,
        managed_predicate_iris: set[str],
        triples: list[Any],
        graph_uri: str | None,
    ) -> bool:
        if not self._local_available():
            return False
        try:
            from pyoxigraph import NamedNode
        except ImportError:
            return False

        store = _open_local_store(self._local_store_path())
        graph_name = NamedNode(graph_uri) if graph_uri else None
        sub = NamedNode(subject_uri)
        for pred_iri in sorted(managed_predicate_iris):
            pn = NamedNode(pred_iri)
            try:
                for q in store.quads_for_pattern(sub, pn, None, graph_name):
                    store.remove(q)
            except Exception:
                pass

        for triple in triples:
            quad = self._triple_to_quad(triple, graph_uri=graph_uri)
            if quad is None:
                continue
            try:
                store.add(quad)
            except Exception as exc:
                logger.warning("Local quad insert failed: %s", exc)
                return False
        return True
