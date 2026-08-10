"""License stratification for HeritageGraph LOD layers (Nature / FAIR methods).

Third-party corpora retain their upstream licenses. The curated overlay
(Postgres → ``graph/public``) is published under CC BY 4.0 unless a row's
``access_tier`` or CARE/TK labels withhold it.
"""

from __future__ import annotations

# Corpus source IRI → license metadata used by L1 DataSource seed + Methods UI.
LICENSE_MATRIX: dict[str, dict[str, str]] = {
    "https://data.cair-nepal.org/heritagegraph/source/openstreetmap": {
        "short_name": "ODbL 1.0",
        "uri": "https://opendatacommons.org/licenses/odbl/",
        "note": (
            "OpenStreetMap contributors. Share-Alike applies to the OSM-derived "
            "database subset; attribution required."
        ),
    },
    "https://data.cair-nepal.org/heritagegraph/source/wikidata": {
        "short_name": "CC0 1.0",
        "uri": "https://creativecommons.org/publicdomain/zero/1.0/",
        "note": "Wikidata factual data is CC0; sitelinks/media may differ.",
    },
    "https://data.cair-nepal.org/heritagegraph/source/unesco-whc": {
        "short_name": "UNESCO terms",
        "uri": "https://whc.unesco.org/",
        "note": (
            "UNESCO World Heritage Centre descriptive content — verify reuse "
            "terms per page; do not treat as CC BY by default."
        ),
    },
    "https://data.cair-nepal.org/heritagegraph/source/cair-curated-intangible": {
        "short_name": "CC BY 4.0 + CARE",
        "uri": "https://creativecommons.org/licenses/by/4.0/",
        "note": (
            "CAIR-Nepal curated intangible heritage. Living traditions may carry "
            "TK Labels / community authority-to-control constraints (CARE)."
        ),
    },
    "heritagegraph.curated.overlay": {
        "short_name": "CC BY 4.0",
        "uri": "https://creativecommons.org/licenses/by/4.0/",
        "note": (
            "HeritageGraph curated assertions in graph/public after review. "
            "Sensitive rows use access_tier / care_labels and are excluded from "
            "public SPARQL via the CARE proxy."
        ),
    },
    "heritagegraph.software": {
        "short_name": "MIT",
        "uri": "https://opensource.org/licenses/MIT",
        "note": "Platform source code (see CITATION.cff / LICENSE).",
    },
}

# Predicates the L1 materializer intentionally consumes (everything else → reject audit).
L1_CONSUMED_PREDICATES: frozenset[str] = frozenset(
    {
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://www.w3.org/2000/01/rdf-schema#label",
        "http://www.w3.org/2000/01/rdf-schema#seeAlso",
        "http://www.w3.org/2004/02/skos/core#altLabel",
        "http://www.w3.org/2002/07/owl#sameAs",
        "http://purl.org/dc/terms/identifier",
        "http://www.opengis.net/ont/geosparql#asWKT",
        "http://www.cidoc-crm.org/cidoc-crm/P55_has_current_location",
        "http://www.cidoc-crm.org/cidoc-crm/P3_has_note",
        "http://www.w3.org/ns/prov#wasDerivedFrom",
        "http://www.w3.org/ns/prov#wasInfluencedBy",
        "http://www.w3.org/ns/prov#generatedAtTime",
        "https://w3id.org/heritagegraph/existenceStatus",
        "https://w3id.org/heritagegraph/hasAssertion",
        "https://w3id.org/heritagegraph/assertsAbout",
        "https://w3id.org/heritagegraph/confidenceScore",
    }
)
