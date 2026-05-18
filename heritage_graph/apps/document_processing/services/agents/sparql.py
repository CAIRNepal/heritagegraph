"""
Secure SPARQL client for Oxigraph — parameterized literals, injection-safe IRIs.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from .ontology import RDFS

logger = logging.getLogger(__name__)

# Only allow http(s) URIs and known heritagegraph/cidoc prefixes in dynamic IRIs
_SAFE_URI_RE = re.compile(
    r"^https?://[\w\-.%/:?#&=+~]+$"
)


def escape_sparql_string(value: str) -> str:
    """Escape a string for use inside SPARQL double-quoted literals."""
    return (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )


def validate_uri(uri: str) -> str:
    """Reject malformed or adversarial URIs before embedding in SPARQL."""
    uri = uri.strip()
    if not uri:
        raise ValueError("Empty URI")
    if ">" in uri or "<" in uri or "\n" in uri:
        raise ValueError("URI contains illegal characters")
    if not _SAFE_URI_RE.match(uri):
        raise ValueError(f"URI failed safety check: {uri[:80]}")
    return uri


def nt_iri(uri: str) -> str:
    return f"<{validate_uri(uri)}>"


def nt_literal(value: str, lang: str | None = None) -> str:
    escaped = escape_sparql_string(value)
    if lang:
        return f'"{escaped}"@{lang}'
    return f'"{escaped}"'


class SparqlClient:
    """HTTP SPARQL client for Oxigraph with safe query construction."""

    def __init__(self, base_url: str, *, timeout: int = 15) -> None:
        self._sparql_url = base_url.rstrip("/") + "/sparql"
        self._timeout = timeout

    def select(self, sparql: str) -> list[dict[str, str]]:
        import requests

        try:
            resp = requests.get(
                self._sparql_url,
                params={"query": sparql},
                headers={"Accept": "application/sparql-results+json"},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            bindings = resp.json().get("results", {}).get("bindings", [])
            return [{k: v.get("value", "") for k, v in row.items()} for row in bindings]
        except Exception:
            logger.debug("SPARQL SELECT failed", exc_info=True)
            return []

    def update(self, sparql: str) -> bool:
        import requests

        try:
            resp = requests.post(
                self._sparql_url,
                data={"update": sparql},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            return True
        except Exception:
            logger.warning("SPARQL UPDATE failed", exc_info=True)
            return False

    def exact_label_lookup(
        self,
        label: str,
        class_uri: str | None = None,
        *,
        limit: int = 5,
    ) -> list[str]:
        escaped = escape_sparql_string(label)
        class_filter = ""
        if class_uri:
            class_filter = f"  ?uri a <{validate_uri(class_uri)}> .\n"
        sparql = (
            f"PREFIX rdfs: <{RDFS}>\n"
            f"SELECT ?uri WHERE {{\n"
            f"{class_filter}"
            f"  ?uri rdfs:label ?lbl .\n"
            f'  FILTER(LCASE(STR(?lbl)) = LCASE("{escaped}"))\n'
            f"}} LIMIT {int(limit)}"
        )
        rows = self.select(sparql)
        return [r["uri"] for r in rows if r.get("uri")]

    def label_candidates(
        self,
        class_uri: str | None = None,
        *,
        limit: int = 500,
    ) -> list[tuple[str, str]]:
        class_filter = ""
        if class_uri:
            class_filter = f"  ?uri a <{validate_uri(class_uri)}> .\n"
        sparql = (
            f"PREFIX rdfs: <{RDFS}>\n"
            f"SELECT ?uri ?lbl WHERE {{\n"
            f"{class_filter}"
            f"  ?uri rdfs:label ?lbl .\n"
            f"}} LIMIT {int(limit)}"
        )
        rows = self.select(sparql)
        return [(r["uri"], r["lbl"]) for r in rows if r.get("uri") and r.get("lbl")]

    def existing_objects(
        self,
        subject_uri: str,
        pred_uri: str,
        *,
        limit: int = 10,
    ) -> set[str]:
        subj = validate_uri(subject_uri)
        pred = validate_uri(pred_uri)
        sparql = (
            f"SELECT ?obj WHERE {{\n"
            f"  <{subj}> <{pred}> ?obj .\n"
            f"}} LIMIT {int(limit)}"
        )
        rows = self.select(sparql)
        return {r.get("obj", "") for r in rows}

    def insert_data(self, ntriples: str, *, graph_uri: str | None = None) -> bool:
        if graph_uri:
            graph = validate_uri(graph_uri)
            sparql = f"INSERT DATA {{ GRAPH <{graph}> {{\n{ntriples}\n}} }}"
        else:
            sparql = f"INSERT DATA {{\n{ntriples}\n}}"
        return self.update(sparql)
