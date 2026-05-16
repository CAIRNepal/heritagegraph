"""JSON-LD → rdflib.Graph parser.

The @context is auto-generated from the OntologyRegistry so it always reflects
whatever is declared in the project's OWL file.
"""
import json

from rdflib import Graph

from app.ontology.registry import ont


def _build_context() -> dict:
    """Generate a JSON-LD context from the loaded ontology + standard prefixes."""
    ctx: dict = {
        # Standard namespaces always present
        "rdf":    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "rdfs":   "http://www.w3.org/2000/01/rdf-schema#",
        "xsd":    "http://www.w3.org/2001/XMLSchema#",
        "prov":   "http://www.w3.org/ns/prov#",
        "hg":     "https://heritagegraph.org/",
        # Project ontology namespace (auto-discovered from OWL file)
        ont.prefix_name: ont.namespace,
    }
    # Expand every class and property as a convenience alias
    ctx.update(ont.jsonld_context)
    return ctx


def parse_jsonld(payload: dict | str) -> Graph:
    """Parse a JSON-LD payload into an rdflib Graph.

    If the payload carries no @context, the ontology-derived context is injected
    automatically. If it has a partial context, the ontology context is merged in
    (payload values win on conflict).
    """
    if isinstance(payload, str):
        payload = json.loads(payload)

    ontology_ctx = _build_context()

    if "@context" not in payload:
        payload = {"@context": ontology_ctx, **payload}
    elif isinstance(payload["@context"], dict):
        # Merge: ontology defaults, payload overrides
        payload = {**payload, "@context": {**ontology_ctx, **payload["@context"]}}
    # If @context is a URI string, leave it alone (external context doc)

    g = Graph()
    g.parse(data=json.dumps(payload), format="json-ld")
    return g
