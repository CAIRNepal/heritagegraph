"""Linked Open Data: content negotiation, VoID/DCAT descriptors, resource dereferencing."""

from __future__ import annotations

from html import escape
from pathlib import Path

from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import is_safe_iri
from apps.graph.ontology_config import RDF_PREFIXES
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.views import View
from rdflib import RDF, RDFS, XSD, BNode, Graph, Literal, URIRef


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
        # `<path:path>` accepts `>`, `{`, `}` and whitespace once URL-decoded,
        # and this view queries the store directly -- bypassing the CARE filters
        # that CARESparqlProxyView injects. Without this check a crafted path
        # breaks out of `<...>` and reads across named graphs.
        if not is_safe_iri(uri):
            return HttpResponseNotFound(
                "Invalid resource path.", content_type="text/plain"
            )
        public = GraphPartition.PUBLIC.uri()
        # The store hands back bare strings, so ask for each object's term kind,
        # datatype and language tag too; without them a typed date, an @en label
        # and an IRI-looking string literal all serialize as the same thing.
        sparql = f"""
SELECT ?p ?o ?kind ?dt ?lang WHERE {{
  GRAPH <{public}> {{
    <{uri}> ?p ?o .
  }}
  BIND(IF(isIRI(?o), "iri", IF(isBlank(?o), "bnode", "literal")) AS ?kind)
  BIND(STR(DATATYPE(?o)) AS ?dt)
  BIND(LANG(?o) AS ?lang)
}}
LIMIT 500
"""
        rows = get_kg_engine().query(sparql)
        if not rows:
            return HttpResponseNotFound(
                f"No RDF description found for <{uri}>.",
                content_type="text/plain",
            )
        graph = _rows_to_graph(uri, rows)

        accept = (request.META.get("HTTP_ACCEPT") or "").lower()

        if "application/n-triples" in accept:
            body = graph.serialize(format="nt")
            return HttpResponse(body, content_type="application/n-triples; charset=utf-8")

        if "text/turtle" in accept:
            body = graph.serialize(format="turtle")
            return HttpResponse(body, content_type="text/turtle; charset=utf-8")

        if "application/rdf+xml" in accept:
            try:
                body = graph.serialize(format="xml")
            except Exception:
                # RDF/XML cannot express predicates without an NCName local part.
                return HttpResponse(
                    "This resource has no RDF/XML form; request text/turtle.",
                    status=406,
                    content_type="text/plain",
                )
            return HttpResponse(body, content_type="application/rdf+xml; charset=utf-8")

        if "application/ld+json" in accept or "application/json" in accept:
            body = graph.serialize(format="json-ld", context=_JSONLD_CONTEXT, indent=2)
            return HttpResponse(body, content_type="application/ld+json; charset=utf-8")

        # HTML: 303 See Other → /knowledge/{type}/{id} in the UI
        redirect_url = _html_redirect_url(uri)
        if redirect_url:
            response = HttpResponseRedirect(redirect_url)
            response.status_code = 303
            return response

        html = (
            "<!DOCTYPE html><html><head><title>HeritageGraph Resource</title></head>"
            f"<body><h1>{escape(uri)}</h1><pre>{escape(graph.serialize(format='nt'))}</pre>"
            "<p>Request with <code>Accept: text/turtle</code> for RDF.</p></body></html>"
        )
        return HttpResponse(html, content_type="text/html; charset=utf-8")


_JSONLD_CONTEXT = {
    "rdf": str(RDF),
    "rdfs": str(RDFS),
    "xsd": str(XSD),
}


def _rows_to_graph(subject: str, rows: list[dict[str, str]]) -> Graph:
    """Rebuild exact RDF terms from SELECT rows carrying kind/datatype/lang."""
    graph = Graph()
    graph.bind("rdfs", RDFS)
    graph.bind("hg", RDF_PREFIXES.get("heritageGraph", ""))
    graph.bind("crm", RDF_PREFIXES.get("crm", ""))
    s = URIRef(subject)
    for row in rows:
        p, o = row.get("p"), row.get("o", "")
        if not p:
            continue
        kind = row.get("kind")
        if kind == "iri":
            obj = URIRef(o)
        elif kind == "bnode":
            obj = BNode(o)
        elif row.get("lang"):
            obj = Literal(o, lang=row["lang"])
        elif row.get("dt") and row["dt"] != str(XSD.string):
            # RDF 1.1: xsd:string is the simple literal, so keep it untyped.
            obj = Literal(o, datatype=URIRef(row["dt"]))
        else:
            obj = Literal(o)
        graph.add((s, URIRef(p), obj))
    return graph


def _html_redirect_url(uri: str) -> str | None:
    """
    Derive the UI /knowledge/{type}/{id} URL from a resource IRI.

    Resource IRIs follow: https://cair-nepal.org/heritagegraph/{type}/{slug-or-uuid}
    """
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    if base and uri.startswith(base + "/"):
        remainder = uri[len(base) + 1:]
    elif uri.startswith("https://cair-nepal.org/heritagegraph/"):
        remainder = uri[len("https://cair-nepal.org/heritagegraph/"):]
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
