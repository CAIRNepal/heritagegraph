"""
Agent 3 — SHACL Validator Agent

Validates CandidateAssertions against HeritageGraph SHACL shapes with inverse
correction, domain rules, and configurable fail-closed pySHACL validation.
"""

from __future__ import annotations

import logging
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

from .confidence import calibrate, shacl_validity_score
from .config import DEFAULT_CONFIG, PipelineConfig
from .ontology import (
    INVERSE_MAP,
    KUMARI_CLASSES,
    KUMARI_PREDICATES,
    SYNCRETIC_CLASS,
    class_uri,
    default_shapes_path,
    is_literal_type,
    predicate_uri,
)
from .types import (
    CandidateAssertion,
    RejectedAssertion,
    ShaclValidationResult,
    Triple,
    ValidatedAssertion,
)

logger = logging.getLogger(__name__)


class _PropertyConstraint(NamedTuple):
    node_kind: str
    min_count: int


@lru_cache(maxsize=1)
def _load_shapes_index(shapes_path: str) -> dict[str, dict[str, _PropertyConstraint]]:
    try:
        import rdflib

        SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")
        g = rdflib.Graph()
        g.parse(shapes_path, format="turtle")

        index: dict[str, dict[str, _PropertyConstraint]] = {}
        for shape in g.subjects(rdflib.RDF.type, SH.NodeShape):
            target_class = g.value(shape, SH.targetClass)
            if not target_class:
                continue
            class_u = str(target_class)
            index.setdefault(class_u, {})
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
                index[class_u][str(path)] = _PropertyConstraint(
                    node_kind=node_kind, min_count=min_count
                )
        # Alias forward predicates to inverse shape constraints (shapes often use *i form)
        for class_u in list(index.keys()):
            for inv_uri, fwd_uri in INVERSE_MAP.items():
                if inv_uri in index[class_u] and fwd_uri not in index[class_u]:
                    index[class_u][fwd_uri] = index[class_u][inv_uri]

        logger.info("SHACL index loaded: %d target classes from %s", len(index), shapes_path)
        return index
    except Exception:
        logger.warning("Could not load SHACL shapes index", exc_info=True)
        return {}


def _object_is_iri(candidate: CandidateAssertion) -> bool:
    return not is_literal_type(candidate.triple.object_type)


def _run_pyshacl(
    candidate: CandidateAssertion,
    pred_uri: str,
    subject_uri: str,
    shapes_path: str,
    *,
    fail_open: bool,
) -> tuple[bool, str]:
    try:
        import pyshacl
        import rdflib

        from .ontology import HG

        SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")
        g = rdflib.Graph()
        subj_node = rdflib.URIRef(HG + "subject_tmp")
        obj_iri = rdflib.URIRef(HG + "object_tmp")
        obj_lit = rdflib.Literal(candidate.triple.object)

        g.add((subj_node, rdflib.RDF.type, rdflib.URIRef(subject_uri)))
        if _object_is_iri(candidate):
            g.add((subj_node, rdflib.URIRef(pred_uri), obj_iri))
            g.add((
                obj_iri,
                rdflib.RDF.type,
                rdflib.URIRef(class_uri(candidate.triple.object_type)),
            ))
        else:
            g.add((subj_node, rdflib.URIRef(pred_uri), obj_lit))

        conforms, results_graph, _ = pyshacl.validate(
            g,
            shacl_graph=shapes_path,
            shacl_graph_format="turtle",
            inference="none",
            abort_on_first=False,
            allow_infos=False,
            allow_warnings=False,
            meta_shacl=False,
        )
        if conforms:
            return True, ""

        real_violations: list[str] = []
        for result in results_graph.subjects(rdflib.RDF.type, SH.ValidationResult):
            component = results_graph.value(result, SH.sourceConstraintComponent)
            if component == SH.MinCountConstraintComponent:
                continue
            msg = results_graph.value(result, SH.resultMessage)
            path = results_graph.value(result, SH.resultPath)
            real_violations.append(
                f"{str(component).split('#')[-1]} on {str(path).split('/')[-1]}"
                + (f": {msg}" if msg else "")
            )
        if not real_violations:
            return True, ""
        return False, "; ".join(real_violations[:3])
    except Exception as exc:
        logger.debug("pySHACL validation error", exc_info=True)
        if fail_open:
            return True, ""
        return False, f"SHACL validator unavailable: {exc}"


def _update_confidence_after_shacl(
    candidate: CandidateAssertion,
    *,
    passed: bool,
    corrected: bool,
) -> CandidateAssertion:
    bd = candidate.confidence_breakdown or {}
    ext = float(bd.get("extraction_agreement", candidate.confidence_score))
    ont = float(bd.get("ontology_grounding", 0.8))
    ent = float(bd.get("entity_resolution", 1.0))
    ocr = float(bd.get("ocr_quality", 1.0))
    shacl_s = shacl_validity_score(passed=passed, corrected=corrected)
    breakdown = calibrate(ext, ont, shacl_s, ent, ocr)
    return replace(
        candidate,
        confidence_score=breakdown.composite,
        confidence_breakdown=breakdown.to_dict(),
    )


def _validate_one(
    candidate: CandidateAssertion,
    shapes_index: dict[str, dict[str, _PropertyConstraint]],
    shapes_path: str,
    *,
    fail_open: bool,
) -> ValidatedAssertion | RejectedAssertion:
    triple = candidate.triple
    checks: list[str] = []
    corrected = False
    correction_note = ""

    subject_uri = class_uri(triple.subject_type)
    pred_uri = predicate_uri(triple.predicate)

    if pred_uri in INVERSE_MAP:
        forward_pred = INVERSE_MAP[pred_uri]
        corrected_triple = Triple(
            subject=triple.object,
            subject_type=triple.object_type,
            predicate=forward_pred.split("/")[-1],
            object=triple.subject,
            object_type=triple.subject_type,
        )
        candidate = replace(candidate, triple=corrected_triple)
        triple = corrected_triple
        pred_uri = forward_pred
        subject_uri = class_uri(triple.subject_type)
        corrected = True
        correction_note = f"Inverse predicate flipped: {triple.predicate}"
        checks.append("inverse_corrected")

    if subject_uri in KUMARI_CLASSES or pred_uri in KUMARI_PREDICATES:
        checks.append("kumari_flag")

    class_props = shapes_index.get(subject_uri, {})
    if class_props:
        if pred_uri not in class_props:
            return RejectedAssertion(
                candidate=candidate,
                reason=(
                    f"Predicate '{triple.predicate}' not in SHACL shape "
                    f"for '{triple.subject_type}'."
                ),
                violation_type="unknown_predicate",
            )
        checks.append("predicate_known")
        constraint = class_props[pred_uri]
        if constraint.node_kind == "IRI" and not _object_is_iri(candidate):
            return RejectedAssertion(
                candidate=candidate,
                reason=f"'{triple.predicate}' requires IRI object, got literal.",
                violation_type="node_kind",
            )
        if constraint.node_kind == "Literal" and _object_is_iri(candidate):
            corrected_triple = replace(triple, object_type="literal")
            candidate = replace(candidate, triple=corrected_triple)
            triple = corrected_triple
            corrected = True
            correction_note = (correction_note + " | object→literal").strip(" |")
        checks.append("node_kind_ok")
    else:
        checks.append("class_not_in_shapes")

    if subject_uri == SYNCRETIC_CLASS:
        if pred_uri not in (
            "http://www.cidoc-crm.org/cidoc-crm/P140_assigned_attribute_to",
            "http://www.cidoc-crm.org/cidoc-crm/P141_assigned",
        ) and not _object_is_iri(candidate):
            return RejectedAssertion(
                candidate=candidate,
                reason="SyncreticRelationship requires deity IRI objects on P140/P141.",
                violation_type="cross_class",
            )
        checks.append("syncretic_ok")

    shacl_ok, shacl_note = _run_pyshacl(
        candidate, pred_uri, subject_uri, shapes_path, fail_open=fail_open
    )
    if not shacl_ok:
        return RejectedAssertion(
            candidate=candidate,
            reason=shacl_note,
            violation_type="domain_range" if "validator unavailable" not in shacl_note else "validator_error",
        )
    checks.append("pyshacl_ok")

    candidate = _update_confidence_after_shacl(candidate, passed=True, corrected=corrected)

    return ValidatedAssertion(
        candidate=candidate,
        checks_passed=checks,
        corrected=corrected,
        correction_note=correction_note,
    )


def run_shacl_validation(
    candidates: list[CandidateAssertion],
    *,
    config: PipelineConfig | None = None,
) -> ShaclValidationResult:
    """Agent 3 entry point."""
    cfg = config or DEFAULT_CONFIG
    shapes_path = cfg.shacl_shapes_path or str(default_shapes_path())
    shapes_index = _load_shapes_index(shapes_path)
    fail_open = cfg.shacl_fail_open

    validated: list[ValidatedAssertion] = []
    rejected: list[RejectedAssertion] = []

    for candidate in candidates:
        result = _validate_one(
            candidate, shapes_index, shapes_path, fail_open=fail_open
        )
        if isinstance(result, ValidatedAssertion):
            validated.append(result)
        else:
            rejected.append(result)

    logger.info(
        "SHACL validation: %d passed, %d rejected (fail_open=%s)",
        len(validated),
        len(rejected),
        fail_open,
    )
    return ShaclValidationResult(validated=validated, rejected=rejected)
