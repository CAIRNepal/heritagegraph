"""IRI maps and import constants for the DANAM NQ materializer."""

from __future__ import annotations

RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"
RDFS_SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso"
SKOS_ALT_LABEL = "http://www.w3.org/2004/02/skos/core#altLabel"
OWL_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs"
DCTERMS_IDENTIFIER = "http://purl.org/dc/terms/identifier"
GEO_AS_WKT = "http://www.opengis.net/ont/geosparql#asWKT"
CRM_P55 = "http://www.cidoc-crm.org/cidoc-crm/P55_has_current_location"
CRM_E53_PLACE = "http://www.cidoc-crm.org/cidoc-crm/E53_Place"
CRMINF_I2_BELIEF = "http://www.cidoc-crm.org/extensions/crminf/I2_Belief"
PROV_WAS_DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom"
PROV_WAS_INFLUENCED_BY = "http://www.w3.org/ns/prov#wasInfluencedBy"
PROV_GENERATED_AT = "http://www.w3.org/ns/prov#generatedAtTime"

HG = "https://w3id.org/heritagegraph/"
HG_EXISTENCE_STATUS = f"{HG}existenceStatus"
HG_HAS_ASSERTION = f"{HG}hasAssertion"
HG_ASSERTS_ABOUT = f"{HG}assertsAbout"
HG_CONFIDENCE_SCORE = f"{HG}confidenceScore"
HG_DATA_SOURCE = f"{HG}DataSource"

# RDF type IRI → (Django model name, structure_type choice or None for Place)
STRUCTURE_TYPE_BY_RDF: dict[str, tuple[str, str]] = {
    f"{HG}ArchitecturalStructure": ("ArchitecturalStructure", "Other"),
    f"{HG}ReligiousStructure": ("ArchitecturalStructure", "Temple"),
    f"{HG}WaterStructure": ("ArchitecturalStructure", "Pokhari"),
    f"{HG}DhungeDhara": ("ArchitecturalStructure", "DhungeDhara"),
    f"{HG}Stupa": ("ArchitecturalStructure", "Stupa"),
    f"{HG}Chaitya": ("ArchitecturalStructure", "Chaitya"),
}

STRUCTURE_RDF_TYPES = frozenset(STRUCTURE_TYPE_BY_RDF.keys())

# Corpus DataSource IRIs → seed metadata for L1 DataSource rows
CORPUS_DATA_SOURCES: dict[str, dict[str, str]] = {
    "https://data.cair-nepal.org/heritagegraph/source/openstreetmap": {
        "name": "OpenStreetMap (DANAM corpus)",
        "source_type": "web",
        "url": "https://www.openstreetmap.org/",
        "citation": (
            "© OpenStreetMap contributors (ODbL 1.0). "
            "Materialized via danam-heritagegraph.nq L1 ETL."
        ),
        "license_uri": "https://opendatacommons.org/licenses/odbl/",
        "license_short": "ODbL 1.0",
    },
    "https://data.cair-nepal.org/heritagegraph/source/wikidata": {
        "name": "Wikidata (DANAM corpus)",
        "source_type": "web",
        "url": "https://www.wikidata.org/",
        "citation": (
            "Wikidata factual statements (CC0 1.0). "
            "Materialized via danam-heritagegraph.nq L1 ETL."
        ),
        "license_uri": "https://creativecommons.org/publicdomain/zero/1.0/",
        "license_short": "CC0 1.0",
    },
    "https://data.cair-nepal.org/heritagegraph/source/unesco-whc": {
        "name": "UNESCO World Heritage Centre (DANAM corpus)",
        "source_type": "published",
        "url": "https://whc.unesco.org/",
        "citation": (
            "UNESCO WHC descriptive content — reuse per UNESCO terms. "
            "Materialized via danam-heritagegraph.nq L1 ETL."
        ),
        "license_uri": "https://whc.unesco.org/",
        "license_short": "UNESCO terms",
    },
    "https://data.cair-nepal.org/heritagegraph/source/cair-curated-intangible": {
        "name": "CAIR curated intangible (DANAM corpus)",
        "source_type": "field_survey",
        "url": "https://cair-nepal.org/",
        "citation": (
            "CAIR-Nepal curated intangible heritage (CC BY 4.0 + CARE stewardship). "
            "Materialized via danam-heritagegraph.nq L1 ETL."
        ),
        "license_uri": "https://creativecommons.org/licenses/by/4.0/",
        "license_short": "CC BY 4.0 + CARE",
    },
}

IMPORT_CONTRIBUTOR = "danam_import"
IMPORT_STATUS = "accepted"
DEFAULT_LOCATION_TYPE = "monument"
DEFAULT_LOCATION_STATUS = "preserved"

# Prefer Nepali/Devanagari labels when choosing a display name.
PREFERRED_LABEL_LANGS = ("ne", "new", "hi", "en")
