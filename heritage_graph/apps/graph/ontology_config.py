"""
AUTO-GENERATED — do not edit by hand.
Source:  ontology/HeritageGraph.yaml (prefixes section)
Regen:   python3 tools/gen_heritage_viz_config.py
Hash:    050ddfcf579ee919

Import this module wherever RDF prefix expansion is needed instead of
re-declaring the dict inline (which risks silent drift).

Usage:
    from apps.graph.ontology_config import RDF_PREFIXES
"""


from __future__ import annotations

RDF_PREFIXES: dict[str, str] = {
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "owl": "http://www.w3.org/2002/07/owl#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
    "heritageGraph": "https://w3id.org/heritagegraph/",
    "geo": "http://www.opengis.net/ont/geosparql#",
    "prov": "http://www.w3.org/ns/prov#",
}

# Inverse map used for compacting IRIs to CURIEs
URI_TO_PREFIX: dict[str, str] = {v: k for k, v in RDF_PREFIXES.items()}


def expand_curie(curie: str) -> str:
    """Expand a CURIE (e.g. 'crm:E53_Place') to a full IRI."""
    curie = (curie or '').strip()
    if not curie:
        return curie
    if curie.startswith(("http://", "https://")):
        return curie
    if ':' not in curie:
        return RDF_PREFIXES.get('heritageGraph', 'https://w3id.org/heritagegraph/') + curie
    prefix, rest = curie.split(':', 1)
    base = RDF_PREFIXES.get(prefix)
    if not base:
        return RDF_PREFIXES.get('heritageGraph', 'https://w3id.org/heritagegraph/') + rest
    return base + rest
