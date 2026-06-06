"""
AUTO-GENERATED — do not edit by hand.
Source:  ontology/HeritageGraph.yaml (prefixes section)
Regen:   python3 tools/gen_heritage_viz_config.py
Hash:    ea79a7e7423bd520

Import this module wherever RDF prefix expansion is needed instead of
re-declaring the dict inline (which risks silent drift).

Usage:
    from apps.graph.ontology_config import RDF_PREFIXES
"""


from __future__ import annotations

RDF_PREFIXES: dict[str, str] = {
    "heritageGraph": "https://w3id.org/heritagegraph/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "owl": "http://www.w3.org/2002/07/owl#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "dcterms": "http://purl.org/dc/terms/",
    "dct": "http://purl.org/dc/terms/",
    "geo": "http://www.opengis.net/ont/geosparql#",
    "time": "http://www.w3.org/2006/time#",
    "wgs84": "http://www.w3.org/2003/01/geo/wgs84_pos#",
    "aat": "http://vocab.getty.edu/aat/",
    "tgn": "http://vocab.getty.edu/tgn/",
    "wikidata": "http://www.wikidata.org/entity/",
    "schema": "https://schema.org/",
    "dbo": "http://dbpedia.org/ontology/",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "prov": "http://www.w3.org/ns/prov#",
    "crm": "http://www.cidoc-crm.org/cidoc-crm/",
    "crmsci": "http://www.cidoc-crm.org/crmsci/",
    "crmdig": "http://www.cidoc-crm.org/crmdig/",
    "crminf": "http://www.cidoc-crm.org/crminf/",
    "rico": "https://www.ica.org/standards/RiC/ontology#",
    "datacite": "http://purl.org/spar/datacite/",
    "edm": "http://www.europeana.eu/schemas/edm/",
    "geonames": "https://www.geonames.org/ontology#",
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
