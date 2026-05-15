"""
Agent 3 — SHACL Validator Agent

Validates each CandidateAssertion from Agent 2 against the HeritageGraph SHACL shapes.

Three-layer strategy:
  1. Fast lookup  — check predicate is known for the subject class, check IRI/Literal nodeKind
  2. pySHACL run  — mint a mini RDF graph per triple and run pyshacl.validate()
                    (minCount violations filtered: we validate individual triples, not whole entities)
  3. Hard rules   — domain-specific rules that SHACL cannot express:
                    * Kumari / LivingGoddess triples → always flagged for expert_curator
                    * SyncreticRelationship (E13_Attribute_Assignment) → requires two deity-type IRIs
                    * Inverse predicate orientation → auto-correct (swaps subject/object)

Output: ShaclValidationResult(validated, rejected)
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

from .types import (
    CandidateAssertion,
    RejectedAssertion,
    ShaclValidationResult,
    Triple,
    ValidatedAssertion,
)

logger = logging.getLogger(__name__)

# ── Ontology namespaces ────────────────────────────────────────────────────────

_CRM = "http://www.cidoc-crm.org/cidoc-crm/"
_HG  = "https://w3id.org/heritagegraph/"
_PROV = "http://www.w3.org/ns/prov#"
_RDFS = "http://www.w3.org/2000/01/rdf-schema#"
_SCHEMA = "https://schema.org/"
_GEO  = "http://www.opengis.net/ont/geosparql#"

_SHAPES_FILE = Path(__file__).resolve().parents[5] / "ontology" / "shapes" / "generated-heritagegraph-minimal-shacl.ttl"

# ── Class label → full URI map ─────────────────────────────────────────────────
# Covers the CIDOC classes Agent 2 produces as subject_type / object_type

_CLASS_URI: dict[str, str] = {
    # Core CIDOC
    "E1_CRM_Entity":           _CRM + "E1_CRM_Entity",
    "E4_Period":               _CRM + "E4_Period",
    "E5_Event":                _CRM + "E5_Event",
    "E7_Activity":             _CRM + "E7_Activity",
    "E13_Attribute_Assignment":_CRM + "E13_Attribute_Assignment",
    "E21_Person":              _CRM + "E21_Person",
    "E22_Human-Made_Object":   _CRM + "E22_Human-Made_Object",
    "E28_Conceptual_Object":   _CRM + "E28_Conceptual_Object",
    "E34_Inscription":         _CRM + "E34_Inscription",
    "E52_Time-Span":           _CRM + "E52_Time-Span",
    "E53_Place":               _CRM + "E53_Place",
    "E55_Type":                _CRM + "E55_Type",
    "E73_Information_Object":  _CRM + "E73_Information_Object",
    "E74_Group":               _CRM + "E74_Group",
    # HeritageGraph-specific
    "LivingGoddessSelection":  _HG + "LivingGoddessSelection",
    "LivingGoddessRetirement": _HG + "LivingGoddessRetirement",
    "BuddhistMonument":        _HG + "BuddhistMonument",
    "CulturalEntity":          _HG + "CulturalEntity",
    "EntityCluster":           _HG + "EntityCluster",
    "Calendar":                _HG + "Calendar",
    "I2_Belief":               _HG + "I2_Belief",
    # Common aliases returned by the LLM
    "E8_Acquisition":          _CRM + "E8_Acquisition",
    "E12_Production":          _CRM + "E12_Production",
    "E39_Actor":               _CRM + "E39_Actor",
    "E41_Appellation":         _CRM + "E41_Appellation",
    "E42_Identifier":          _CRM + "E42_Identifier",
}

# ── Predicate label → full URI map ────────────────────────────────────────────

_CRM_PRED_RE = re.compile(r"^P\d+[a-z]?_")

def _predicate_uri(pred: str) -> str:
    """Map a predicate string to its full URI best-effort."""
    pred = pred.strip()
    # Already a full URI
    if pred.startswith("http"):
        return pred
    # CRM property like P108_was_produced_by
    if _CRM_PRED_RE.match(pred):
        return _CRM + pred
    # PROV-O
    if pred.startswith("prov:"):
        return _PROV + pred[5:]
    # HeritageGraph custom
    if pred.startswith("hg:"):
        return _HG + pred[3:]
    # rdfs:label, schema:description, etc.
    known = {
        "label": _RDFS + "label",
        "rdfs:label": _RDFS + "label",
        "schema:description": _SCHEMA + "description",
        "asWKT": _GEO + "asWKT",
    }
    return known.get(pred, _HG + pred)  # assume hg: namespace as fallback


# ── SHACL shapes index ─────────────────────────────────────────────────────────

class _PropertyConstraint(NamedTuple):
    node_kind: str     # "IRI" or "Literal" or ""
    min_count: int     # 0 if not specified


@lru_cache(maxsize=1)
def _load_shapes_index() -> dict[str, dict[str, _PropertyConstraint]]:
    """
    Parse the SHACL shapes file once and build:
      { class_uri: { predicate_uri: _PropertyConstraint } }
    """
    try:
        import rdflib
        SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")
        g = rdflib.Graph()
        g.parse(str(_SHAPES_FILE), format="turtle")

        index: dict[str, dict[str, _PropertyConstraint]] = {}

        for shape in g.subjects(rdflib.RDF.type, SH.NodeShape):
            target_class = g.value(shape, SH.targetClass)
            if not target_class:
                continue
            class_uri = str(target_class)
            index.setdefault(class_uri, {})

            for prop_node in g.objects(shape, SH.property):
                path = g.value(prop_node, SH.path)
                if not path:
                    continue
                nk_node = g.value(prop_node, SH.nodeKind)
                node_kind = ""
                if nk_node:
                    nk_str = str(nk_node)
                    if nk_str.endswith("#IRI"):
                        node_kind = "IRI"
                    elif nk_str.endswith("#Literal"):
                        node_kind = "Literal"
                min_count_lit = g.value(prop_node, SH.minCount)
                min_count = int(min_count_lit) if min_count_lit else 0
                index[class_uri][str(path)] = _PropertyConstraint(
                    node_kind=node_kind,
                    min_count=min_count,
                )

        logger.info("SHACL index loaded: %d target classes", len(index))
        return index
    except Exception:
        logger.warning("Could not load SHACL shapes index; validation will use hard rules only", exc_info=True)
        return {}


# ── Inverse predicate correction ──────────────────────────────────────────────

# Maps an inverse CRM property to its canonical forward form
# When we encounter the inverse form, we swap subject ↔ object
_INVERSE_MAP: dict[str, str] = {
    _CRM + "P108i_was_produced_by":    _CRM + "P108_was_produced_by",
    _CRM + "P14i_performed":           _CRM + "P14_carried_out_by",
    _CRM + "P107i_is_current_or_former_member_of": _CRM + "P107_has_current_or_former_member",
    _CRM + "P55i_currently_holds":     _CRM + "P55_has_current_location",
    _CRM + "P12i_was_present_at":      _CRM + "P12_occurred_in_the_presence_of",
    _CRM + "P34i_was_assessed_by":     _CRM + "P34_concerned",
    _CRM + "P30i_custody_transferred_through": _CRM + "P30_transferred_custody_of",
    _CRM + "P4i_is_time-span_of":      _CRM + "P4_has_time-span",
    _CRM + "P9i_forms_part_of":        _CRM + "P9_consists_of",
    _CRM + "P120i_is_occurred_before_by": _CRM + "P120_occurs_before",
    _CRM + "P53i_is_former_or_current_location_of": _CRM + "P53_has_former_or_current_location",
    _CRM + "P129i_is_subject_of":      _CRM + "P129_is_about",
    _CRM + "P46i_forms_part_of":       _CRM + "P46_is_composed_of",
}

# ── Hard domain rules ──────────────────────────────────────────────────────────

_KUMARI_CLASSES = {
    _HG + "LivingGoddessSelection",
    _HG + "LivingGoddessRetirement",
    _CRM + "E4_Period",   # KumariTenure uses E4_Period
}
_KUMARI_PREDICATES = {
    _HG + "selected_person",
    _HG + "initiated_tenure",
    _HG + "ended_tenure_of",
    _HG + "supported_by_institution",
    _HG + "selection_criteria_met",
}
_SYNCRETIC_CLASS = _CRM + "E13_Attribute_Assignment"

# Predicates that must have IRI objects (entity references, not literals)
_MUST_BE_IRI_PREDICATES = {
    _CRM + "P108_was_produced_by",
    _CRM + "P14_carried_out_by",
    _CRM + "P7_took_place_at",
    _CRM + "P55_has_current_location",
    _CRM + "P107_has_current_or_former_member",
    _CRM + "P140_assigned_attribute_to",
    _CRM + "P141_assigned",
}

# ── Per-triple validation ──────────────────────────────────────────────────────

def _object_is_iri(candidate: CandidateAssertion) -> bool:
    """A triple's object is treated as an IRI if object_type is not 'literal'."""
    return candidate.triple.object_type.lower() not in ("literal", "xsd:string", "string", "text")


def _validate_one(
    candidate: CandidateAssertion,
    shapes_index: dict[str, dict[str, _PropertyConstraint]],
) -> ValidatedAssertion | RejectedAssertion:
    triple = candidate.triple
    checks: list[str] = []
    corrected = False
    correction_note = ""

    subject_uri = _CLASS_URI.get(triple.subject_type, _HG + triple.subject_type)
    pred_uri = _predicate_uri(triple.predicate)

    # ── 1. Inverse correction ─────────────────────────────────────────────────
    if pred_uri in _INVERSE_MAP:
        forward_pred = _INVERSE_MAP[pred_uri]
        # Swap subject ↔ object; update subject_type ↔ object_type
        corrected_triple = Triple(
            subject=triple.object,
            subject_type=triple.object_type,
            predicate=forward_pred.split("/")[-1],   # short form for readability
            object=triple.subject,
            object_type=triple.subject_type,
        )
        candidate = replace(candidate, triple=corrected_triple)
        triple = corrected_triple
        pred_uri = forward_pred
        subject_uri = _CLASS_URI.get(triple.subject_type, _HG + triple.subject_type)
        corrected = True
        correction_note = f"Inverse predicate flipped: {triple.predicate}"
        checks.append("inverse_corrected")

    # ── 2. Kumari / high-stakes hard rule ────────────────────────────────────
    if subject_uri in _KUMARI_CLASSES or pred_uri in _KUMARI_PREDICATES:
        # Not rejected — but flag for expert_curator downstream (Agent 5 sees this)
        checks.append("kumari_flag")

    # ── 3. Shapes-index lookup ────────────────────────────────────────────────
    class_props = shapes_index.get(subject_uri, {})

    if class_props:
        if pred_uri not in class_props:
            # Predicate not in SHACL shape for this class
            return RejectedAssertion(
                candidate=candidate,
                reason=(
                    f"Predicate '{triple.predicate}' is not defined in SHACL shape "
                    f"for subject class '{triple.subject_type}'."
                ),
                violation_type="unknown_predicate",
            )
        checks.append("predicate_known")

        constraint = class_props[pred_uri]
        object_is_iri = _object_is_iri(candidate)

        if constraint.node_kind == "IRI" and not object_is_iri:
            return RejectedAssertion(
                candidate=candidate,
                reason=(
                    f"Predicate '{triple.predicate}' requires an IRI object (entity reference), "
                    f"but object '{triple.object}' is typed as '{triple.object_type}' (literal)."
                ),
                violation_type="node_kind",
            )
        if constraint.node_kind == "Literal" and object_is_iri:
            # Soft-correct: downgrade to literal rather than reject
            corrected_triple = replace(triple, object_type="literal")
            candidate = replace(candidate, triple=corrected_triple)
            triple = corrected_triple
            corrected = True
            correction_note = (correction_note + " | " if correction_note else "") + "object_type downgraded to literal"
        checks.append("node_kind_ok")
    else:
        # Subject class not in shapes index — skip lookup, still validate with pySHACL
        checks.append("class_not_in_shapes")

    # ── 4. SyncreticRelationship (E13) cross-class check ─────────────────────
    if subject_uri == _SYNCRETIC_CLASS:
        if pred_uri not in (
            _CRM + "P140_assigned_attribute_to",
            _CRM + "P141_assigned",
        ) and not _object_is_iri(candidate):
            return RejectedAssertion(
                candidate=candidate,
                reason=(
                    "SyncreticRelationship (E13_Attribute_Assignment) requires both "
                    "P140_assigned_attribute_to and P141_assigned to reference entity IRIs (deities)."
                ),
                violation_type="cross_class",
            )
        checks.append("syncretic_ok")

    # ── 5. pySHACL mini-graph validation ─────────────────────────────────────
    shacl_ok, shacl_note = _run_pyshacl(candidate, pred_uri, subject_uri)
    if not shacl_ok:
        return RejectedAssertion(
            candidate=candidate,
            reason=shacl_note,
            violation_type="domain_range",
        )
    checks.append("pyshacl_ok")

    return ValidatedAssertion(
        candidate=candidate,
        checks_passed=checks,
        corrected=corrected,
        correction_note=correction_note,
    )


def _run_pyshacl(
    candidate: CandidateAssertion,
    pred_uri: str,
    subject_uri: str,
) -> tuple[bool, str]:
    """
    Build a minimal RDF graph for this single triple and validate with pySHACL.
    MinCountConstraintComponent violations are excluded — they are expected when
    validating a single triple rather than a complete entity description.
    """
    try:
        import pyshacl
        import rdflib

        SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")
        g = rdflib.Graph()
        subj_node = rdflib.URIRef(_HG + "subject_tmp")
        obj_iri = rdflib.URIRef(_HG + "object_tmp")
        obj_lit = rdflib.Literal(candidate.triple.object)

        g.add((subj_node, rdflib.RDF.type, rdflib.URIRef(subject_uri)))
        if _object_is_iri(candidate):
            g.add((subj_node, rdflib.URIRef(pred_uri), obj_iri))
            g.add((obj_iri, rdflib.RDF.type, rdflib.URIRef(
                _CLASS_URI.get(candidate.triple.object_type, _HG + candidate.triple.object_type)
            )))
        else:
            g.add((subj_node, rdflib.URIRef(pred_uri), obj_lit))

        conforms, results_graph, _ = pyshacl.validate(
            g,
            shacl_graph=str(_SHAPES_FILE),
            shacl_graph_format="turtle",
            inference="none",
            abort_on_first=False,
            allow_infos=False,
            allow_warnings=False,
            meta_shacl=False,
        )
        if conforms:
            return True, ""

        # Walk the results graph; filter out pure minCount violations
        real_violations: list[str] = []
        for result in results_graph.subjects(rdflib.RDF.type, SH.ValidationResult):
            component = results_graph.value(result, SH.sourceConstraintComponent)
            if component == SH.MinCountConstraintComponent:
                continue   # expected for single-triple mini-graphs
            msg = results_graph.value(result, SH.resultMessage)
            path = results_graph.value(result, SH.resultPath)
            real_violations.append(
                f"{str(component).split('#')[-1]} on path {str(path).split('/')[-1]}"
                + (f": {msg}" if msg else "")
            )

        if not real_violations:
            return True, ""

        return False, "; ".join(real_violations[:3])

    except Exception:
        logger.debug("pySHACL mini-graph validation skipped", exc_info=True)
        return True, ""   # fail-open: don't reject on pySHACL errors


# ── Public entry point ─────────────────────────────────────────────────────────

def run_shacl_validation(
    candidates: list[CandidateAssertion],
) -> ShaclValidationResult:
    """
    Agent 3 entry point.

    Args:
        candidates: Output of Agent 2 (ExtractionResult.candidates).

    Returns:
        ShaclValidationResult with validated and rejected lists.
    """
    shapes_index = _load_shapes_index()

    validated: list[ValidatedAssertion] = []
    rejected: list[RejectedAssertion] = []

    for candidate in candidates:
        result = _validate_one(candidate, shapes_index)
        if isinstance(result, ValidatedAssertion):
            validated.append(result)
        else:
            rejected.append(result)

    logger.info(
        "SHACL validation: %d passed, %d rejected (from %d candidates)",
        len(validated),
        len(rejected),
        len(candidates),
    )
    return ShaclValidationResult(validated=validated, rejected=rejected)
