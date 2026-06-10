"""
Shared ontology URI resolution for heritage KG ingestion agents.
"""

from __future__ import annotations

import re
from pathlib import Path

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
HG = "https://w3id.org/heritagegraph/"
PROV = "http://www.w3.org/ns/prov#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
SCHEMA = "https://schema.org/"
GEO = "http://www.opengis.net/ont/geosparql#"
SKOS = "http://www.w3.org/2004/02/skos/core#"
DCT = "http://purl.org/dc/terms/"

CRM_PRED_RE = re.compile(r"^P\d+[a-z]?_")

CLASS_URI: dict[str, str] = {
    "E1_CRM_Entity": CRM + "E1_CRM_Entity",
    "E4_Period": CRM + "E4_Period",
    "E5_Event": CRM + "E5_Event",
    "E7_Activity": CRM + "E7_Activity",
    "E8_Acquisition": CRM + "E8_Acquisition",
    "E12_Production": CRM + "E12_Production",
    "E13_Attribute_Assignment": CRM + "E13_Attribute_Assignment",
    "E21_Person": CRM + "E21_Person",
    "E22_Human-Made_Object": CRM + "E22_Human-Made_Object",
    "E28_Conceptual_Object": CRM + "E28_Conceptual_Object",
    "E34_Inscription": CRM + "E34_Inscription",
    "E39_Actor": CRM + "E39_Actor",
    "E41_Appellation": CRM + "E41_Appellation",
    "E42_Identifier": CRM + "E42_Identifier",
    "E52_Time-Span": CRM + "E52_Time-Span",
    "E53_Place": CRM + "E53_Place",
    "E55_Type": CRM + "E55_Type",
    "E73_Information_Object": CRM + "E73_Information_Object",
    "E74_Group": CRM + "E74_Group",
    "LivingGoddessSelection": HG + "LivingGoddessSelection",
    "LivingGoddessRetirement": HG + "LivingGoddessRetirement",
    "BuddhistMonument": HG + "BuddhistMonument",
    "CulturalEntity": HG + "CulturalEntity",
    "EntityCluster": HG + "EntityCluster",
    "Calendar": HG + "Calendar",
    "I2_Belief": HG + "I2_Belief",
}

KNOWN_PRED_SHORTCUTS: dict[str, str] = {
    "label": RDFS + "label",
    "rdfs:label": RDFS + "label",
    "schema:description": SCHEMA + "description",
    "asWKT": GEO + "asWKT",
    "skos:prefLabel": SKOS + "prefLabel",
    "dct:title": DCT + "title",
}

LITERAL_TYPES = frozenset({
    "literal", "xsd:string", "string", "text", "date", "number", "integer",
    "float", "decimal", "boolean", "xsd:date", "xsd:integer", "xsd:decimal",
    "xsd:float", "xsd:boolean", "edtf", "time-span",
})

# CIDOC inverse → forward predicate correction
INVERSE_MAP: dict[str, str] = {
    CRM + "P108i_was_produced_by": CRM + "P108_was_produced_by",
    CRM + "P14i_performed": CRM + "P14_carried_out_by",
    CRM + "P107i_is_current_or_former_member_of": CRM + "P107_has_current_or_former_member",
    CRM + "P55i_currently_holds": CRM + "P55_has_current_location",
    CRM + "P12i_was_present_at": CRM + "P12_occurred_in_the_presence_of",
    CRM + "P34i_was_assessed_by": CRM + "P34_concerned",
    CRM + "P30i_custody_transferred_through": CRM + "P30_transferred_custody_of",
    CRM + "P4i_is_time-span_of": CRM + "P4_has_time-span",
    CRM + "P9i_forms_part_of": CRM + "P9_consists_of",
    CRM + "P120i_is_occurred_before_by": CRM + "P120_occurs_before",
    CRM + "P53i_is_former_or_current_location_of": CRM + "P53_has_former_or_current_location",
    CRM + "P129i_is_subject_of": CRM + "P129_is_about",
    CRM + "P46i_forms_part_of": CRM + "P46_is_composed_of",
}

# Forward URI → inverse URI (SHACL shapes often declare the inverse form only)
FORWARD_TO_INVERSE: dict[str, str] = {fwd: inv for inv, fwd in INVERSE_MAP.items()}

KUMARI_CLASSES = {
    HG + "LivingGoddessSelection",
    HG + "LivingGoddessRetirement",
    CRM + "E4_Period",
}
KUMARI_PREDICATES = {
    HG + "selected_person",
    HG + "initiated_tenure",
    HG + "ended_tenure_of",
    HG + "supported_by_institution",
    HG + "selection_criteria_met",
}
SYNCRETIC_CLASS = CRM + "E13_Attribute_Assignment"


def predicate_uri(pred: str) -> str:
    pred = pred.strip()
    if pred.startswith("http"):
        return pred
    if CRM_PRED_RE.match(pred):
        return CRM + pred
    if pred.startswith("prov:"):
        return PROV + pred[5:]
    if pred.startswith("hg:"):
        return HG + pred[3:]
    if pred.startswith("skos:"):
        return SKOS + pred[5:]
    if pred.startswith("dct:"):
        return DCT + pred[4:]
    return KNOWN_PRED_SHORTCUTS.get(pred, HG + pred)


def class_uri(class_label: str) -> str:
    if class_label.startswith("http"):
        return class_label
    return CLASS_URI.get(class_label, HG + class_label)


def is_literal_type(object_type: str) -> bool:
    return object_type.lower() in LITERAL_TYPES


def class_slug(class_label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", class_label.lower()).strip("-")


def mint_entity_uri(class_label: str) -> str:
    import uuid

    try:
        from django.conf import settings

        base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "") or "").rstrip("/")
        if base:
            return f"{base}/entity/{class_slug(class_label)}-{uuid.uuid4()}"
    except Exception:
        pass
    return f"{HG}entity/{class_slug(class_label)}-{uuid.uuid4()}"


def default_shapes_path() -> Path:
    """Resolve SHACL shapes file for local dev and Docker (/app/ontology)."""
    import os

    env_path = os.environ.get("HERITAGEGRAPH_SHACL_SHAPES_PATH")
    if env_path:
        return Path(env_path)
    candidates = [
        Path(__file__).resolve().parents[5] / "ontology" / "shapes" / "generated-heritagegraph-minimal-shacl.ttl",
        Path("/app/ontology/shapes/generated-heritagegraph-minimal-shacl.ttl"),
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


def allowed_predicates_from_snippet(ontology_snippet: dict | None) -> frozenset[str]:
    """Extract predicate keys permitted by an ontology snippet (for constrained extraction)."""
    keys: set[str] = set()
    snippet_dict = ontology_snippet if isinstance(ontology_snippet, dict) else {}
    for class_def in snippet_dict.values():
        if not isinstance(class_def, dict):
            continue
        for field in class_def.get("fields") or []:
            fk = field.get("key") or field.get("name", "")
            if fk:
                keys.add(fk)
                keys.add(predicate_uri(fk))
    return frozenset(keys)
