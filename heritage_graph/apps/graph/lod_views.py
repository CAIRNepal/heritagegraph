"""Linked Open Data: content negotiation, VoID/DCAT descriptors, resource dereferencing."""

from __future__ import annotations

import json
from pathlib import Path

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound
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

        if "application/ld+json" in accept or "application/json" in accept:
            graph = {
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
                    graph.setdefault(key, []).append({"@id": obj}) if isinstance(
                        graph.get(key), list
                    ) else graph.update({key: {"@id": obj}})
                else:
                    graph[key] = obj
            return HttpResponse(
                json.dumps(graph, indent=2),
                content_type="application/ld+json; charset=utf-8",
            )

        lines = [f"<{uri}>"]
        for row in rows[:80]:
            lines.append(f"  <{row.get('p','')}> <{row.get('o','')}> .")
        html = (
            "<!DOCTYPE html><html><head><title>HeritageGraph Resource</title></head>"
            f"<body><h1>{uri}</h1><pre>{chr(10).join(lines)}</pre>"
            "<p>Request with Accept: text/turtle for RDF.</p></body></html>"
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


class VoidDatasetView(View):
    """Serve VoID + DCAT dataset description (static TTL or generated)."""

    permission_classes = []

    def get(self, request, *args, **kwargs):
        path = Path(settings.BASE_DIR).parent / "ontology" / "lod" / "void-dataset.ttl"
        if not path.is_file():
            body = _generated_void_ttl()
            return HttpResponse(body, content_type="text/turtle; charset=utf-8")
        return HttpResponse(
            path.read_text(encoding="utf-8"),
            content_type="text/turtle; charset=utf-8",
        )


def _generated_void_ttl() -> str:
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    public = GraphPartition.PUBLIC.uri() or ""
    sparql = getattr(settings, "RDF_PUBLIC_SPARQL_URL", "") or "/cidoc/sparql/"
    return f"""@prefix void: <http://rdfs.org/ns/void#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<https://w3id.org/heritagegraph/dataset/public>
  a void:Dataset, dcat:Dataset ;
  dcterms:title "HeritageGraph public knowledge graph"@en ;
  dcterms:creator <https://cairnepal.org/> ;
  dcterms:license <https://creativecommons.org/licenses/by/4.0/> ;
  void:uriSpace <{base}/> ;
  void:sparqlEndpoint <{sparql}> ;
  void:subset <{public}> ;
  dcat:distribution [
    a dcat:Distribution ;
    dcterms:format "text/turtle" ;
    dcat:accessURL <https://w3id.org/heritagegraph/dataset/public/dump> ;
  ] .
"""
