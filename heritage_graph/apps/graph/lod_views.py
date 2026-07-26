"""Linked Open Data: content negotiation, VoID/DCAT descriptors, resource dereferencing."""

from __future__ import annotations

import json
from pathlib import Path

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.views import View


def _resource_path_from_request(path: str) -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    segment = (path or "").strip("/")
    if not segment:
        return base
    return f"{base}/{segment}"


class LodResourceView(View):
    """
    Dereference ``/lod/resource/<path>`` → canonical resource IRI.

    Content negotiation via Accept: Turtle, application/ld+json, or HTML fallback.
    """

    def get(self, request, path: str, *args, **kwargs):
        uri = _resource_path_from_request(path)
        public = GraphPartition.PUBLIC.uri()
        sparql = f"""
SELECT ?p ?o WHERE {{
  GRAPH <{public}> {{
    <{uri}> ?p ?o .
  }}
}}
LIMIT 500
"""
        rows = get_kg_engine().query(sparql)
        if not rows:
            return HttpResponseNotFound(
                f"No RDF description found for <{uri}>.",
                content_type="text/plain",
            )

        accept = (request.META.get("HTTP_ACCEPT") or "").lower()

        if "text/turtle" in accept or "application/n-triples" in accept:
            body = _rows_to_turtle(uri, rows)
            return HttpResponse(body, content_type="text/turtle; charset=utf-8")

        if "application/rdf+xml" in accept:
            body = _rows_to_rdfxml(uri, rows)
            return HttpResponse(body, content_type="application/rdf+xml; charset=utf-8")

        if "application/ld+json" in accept or "application/json" in accept:
            graph: dict = {
                "@context": {
                    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
                },
                "@id": uri,
            }
            for row in rows:
                pred = row.get("p", "")
                obj = row.get("o", "")
                key = pred.rsplit("/", 1)[-1].rsplit("#", 1)[-1]
                if obj.startswith("http"):
                    if isinstance(graph.get(key), list):
                        graph[key].append({"@id": obj})
                    else:
                        graph[key] = {"@id": obj}
                else:
                    graph[key] = obj
            return HttpResponse(
                json.dumps(graph, indent=2),
                content_type="application/ld+json; charset=utf-8",
            )

        # HTML: 303 See Other → /knowledge/{type}/{id} in the UI
        redirect_url = _html_redirect_url(uri)
        if redirect_url:
            response = HttpResponseRedirect(redirect_url)
            response.status_code = 303
            return response

        lines = [f"<{uri}>"]
        for row in rows[:80]:
            lines.append(f"  <{row.get('p', '')}> <{row.get('o', '')}> .")
        html = (
            "<!DOCTYPE html><html><head><title>HeritageGraph Resource</title></head>"
            f"<body><h1>{uri}</h1><pre>{chr(10).join(lines)}</pre>"
            "<p>Request with <code>Accept: text/turtle</code> for RDF.</p></body></html>"
        )
        return HttpResponse(html, content_type="text/html; charset=utf-8")


def _rows_to_turtle(subject: str, rows: list[dict[str, str]]) -> str:
    lines = ["@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .", ""]
    for row in rows:
        p, o = row.get("p", ""), row.get("o", "")
        if o.startswith("http"):
            lines.append(f"<{subject}> <{p}> <{o}> .")
        else:
            escaped = o.replace("\\", "\\\\").replace('"', '\\"')
            lines.append(f'<{subject}> <{p}> "{escaped}" .')
    return "\n".join(lines) + "\n"


def _rows_to_rdfxml(subject: str, rows: list[dict[str, str]]) -> str:
    """Serialize SPARQL rows as RDF/XML (conservative, no rdflib dependency)."""
    from xml.sax.saxutils import escape as _esc

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
        f'  <rdf:Description rdf:about="{_esc(subject)}">',
    ]
    for row in rows:
        p, o = row.get("p", ""), row.get("o", "")
        if not p:
            continue
        if o.startswith("http"):
            parts.append(f'    <rdf:type rdf:resource="{_esc(o)}" />' if p.endswith("type") else
                         f'    <p rdf:resource="{_esc(o)}" xmlns:p="{_esc(p)}" />')
        else:
            parts.append(f"    <p xmlns:p=\"{_esc(p)}\">{_esc(o)}</p>")
    parts += ["  </rdf:Description>", "</rdf:RDF>"]
    return "\n".join(parts) + "\n"


def _html_redirect_url(uri: str) -> str | None:
    """
    Derive the UI /knowledge/{type}/{id} URL from a resource IRI.

    Resource IRIs follow: https://w3id.org/heritagegraph/{type}/{slug-or-uuid}
    """
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    if base and uri.startswith(base + "/"):
        remainder = uri[len(base) + 1:]
    elif uri.startswith("https://w3id.org/heritagegraph/"):
        remainder = uri[len("https://w3id.org/heritagegraph/"):]
    else:
        return None

    parts = remainder.split("/", 1)
    if len(parts) != 2:
        return None
    rdf_type, rdf_id = parts
    # Skip internal graph partitions — only redirect entity types
    if rdf_type in {"graph", "project", "merge-activity", "agent", "dataset"}:
        return None
    return f"/knowledge/{rdf_type}/{rdf_id}"


class VoidDatasetView(View):
    """Serve VoID + DCAT dataset description — prefers the static file, falls back to live generation."""

    def get(self, request, *args, **kwargs):
        path = Path(settings.BASE_DIR).parent / "ontology" / "lod" / "void-dataset.ttl"
        if path.is_file():
            body = path.read_text(encoding="utf-8")
        else:
            from apps.graph.kg_engine.void_generator import generate_void_dcat

            body = generate_void_dcat()
        return HttpResponse(body, content_type="text/turtle; charset=utf-8")
