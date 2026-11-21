"""
Multi-factor confidence calibration for heritage KG assertions.

Combines extraction agreement, ontology grounding, SHACL validation, and entity
resolution certainty into a single epistemically meaningful score.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ConfidenceBreakdown:
    """Decomposed confidence factors for auditability and curator trust."""

    extraction_agreement: float      # dual-temperature agreement (0.0–1.0)
    ontology_grounding: float        # predicate/class in allowed ontology (0.0–1.0)
    shacl_validity: float            # passed SHACL layers (0.0–1.0)
    entity_resolution: float         # exact=1.0, fuzzy=scaled, minted=0.6
    ocr_quality: float               # propagated from doc metadata (default 1.0)

    @property
    def composite(self) -> float:
        """
        Weighted geometric mean — conservative: weak links pull score down.
        Weights reflect epistemic priority: extraction < resolution < validation.
        """
        weights = (0.30, 0.15, 0.25, 0.20, 0.10)
        factors = (
            max(self.extraction_agreement, 0.01),
            max(self.ontology_grounding, 0.01),
            max(self.shacl_validity, 0.01),
            max(self.entity_resolution, 0.01),
            max(self.ocr_quality, 0.01),
        )
        product = 1.0
        for w, f in zip(weights, factors, strict=True):
            product *= f**w
        return round(min(1.0, max(0.0, product)), 4)

    def to_dict(self) -> dict[str, float]:
        return {
            "extraction_agreement": self.extraction_agreement,
            "ontology_grounding": self.ontology_grounding,
            "shacl_validity": self.shacl_validity,
            "entity_resolution": self.entity_resolution,
            "ocr_quality": self.ocr_quality,
            "composite": self.composite,
        }


def extraction_agreement_score(
    *,
    exact_match: bool = False,
    fuzzy_ratio: float | None = None,
    single_run_only: bool = False,
    fuzzy_threshold: int = 82,
) -> float:
    if exact_match:
        return 1.0
    if fuzzy_ratio is not None and fuzzy_ratio >= fuzzy_threshold:
        # Partial credit for fuzzy agreement — not full certainty
        return round(0.75 + 0.25 * (fuzzy_ratio - fuzzy_threshold) / (100 - fuzzy_threshold), 3)
    if single_run_only:
        return 0.45
    return 0.5


def ontology_grounding_score(
    *,
    predicate_in_snippet: bool,
    subject_class_known: bool,
    object_class_known: bool,
) -> float:
    score = 0.5
    if predicate_in_snippet:
        score += 0.35
    if subject_class_known:
        score += 0.10
    if object_class_known:
        score += 0.05
    return min(1.0, score)


def shacl_validity_score(*, passed: bool, corrected: bool) -> float:
    if not passed:
        return 0.0
    return 0.92 if corrected else 1.0


def entity_resolution_score(
    *,
    exact_match: bool = False,
    fuzzy_score: float | None = None,
    minted: bool = False,
    coref: bool = False,
) -> float:
    if exact_match or coref:
        return 1.0
    if fuzzy_score is not None and fuzzy_score >= 85:
        return round(0.70 + 0.30 * ((fuzzy_score - 85) / 15), 3)
    if minted:
        return 0.55
    return 0.75


def calibrate(
    extraction_agreement: float,
    ontology_grounding: float,
    shacl_validity: float,
    entity_resolution: float,
    ocr_quality: float = 1.0,
) -> ConfidenceBreakdown:
    return ConfidenceBreakdown(
        extraction_agreement=extraction_agreement,
        ontology_grounding=ontology_grounding,
        shacl_validity=shacl_validity,
        entity_resolution=entity_resolution,
        ocr_quality=ocr_quality,
    )
