"""
Stable external namespaces only.

NCHLOD class/property URIs come from app.ontology.registry (ont.cls / ont.prop)
so they always track the OWL file — do NOT add NCHLOD aliases here.
"""
from rdflib import Graph, Namespace
from rdflib.namespace import RDF, RDFS, XSD, OWL  # noqa: F401 – re-exported

PROV   = Namespace("http://www.w3.org/ns/prov#")
HG     = Namespace("https://heritagegraph.org/")          # data instance URIs
SKOS   = Namespace("http://www.w3.org/2004/02/skos/core#")
DCTERMS = Namespace("http://purl.org/dc/terms/")


def bind_prefixes(g: Graph) -> Graph:
    """Bind well-known prefixes + the project ontology namespace to a graph."""
    from app.ontology.registry import ont  # late import — registry may not be ready yet

    g.bind(ont.prefix_name, ont.namespace)
    g.bind("prov",    PROV)
    g.bind("hg",      HG)
    g.bind("skos",    SKOS)
    g.bind("dcterms", DCTERMS)
    g.bind("rdfs",    RDFS)
    return g
