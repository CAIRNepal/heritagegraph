"""
Agent 4 — Entity Resolution Agent

For each ValidatedAssertion from Agent 3:
  1. Co-reference resolution — "the temple" / "he" → last known URI of matching class
     in the same chunk context.
  2. Transliteration normalisation — "Swayambhu" = "Swayambhunath" = "स्वयम्भू"
     resolved to a single canonical label before any lookup.
  3. Exact SPARQL label lookup — query Oxigraph for rdfs:label match (case-insensitive).
  4. Fuzzy SPARQL lookup — retrieve all labels for the class, rank by rapidfuzz ratio.
  5. URI minting — if no graph match is found, mint hg:entity/<class_slug>-<uuid4>.

Both subject and object are resolved; object resolution is skipped when object_type is
"literal" (or any string synonym), in which case object_uri is None.

Output: EntityResolutionResult(resolved=[ResolvedAssertion, ...])
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from dataclasses import replace

from .types import (
    EntityResolutionResult,
    ResolvedAssertion,
    ShaclValidationResult,
    ValidatedAssertion,
)

logger = logging.getLogger(__name__)

# ── Namespace constants ────────────────────────────────────────────────────────

_HG    = "https://w3id.org/heritagegraph/"
_CRM   = "http://www.cidoc-crm.org/cidoc-crm/"
_RDFS  = "http://www.w3.org/2000/01/rdf-schema#"
_RDF   = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"

# ── CIDOC class label → full URI ───────────────────────────────────────────────

_CLASS_URI: dict[str, str] = {
    "E1_CRM_Entity":             _CRM + "E1_CRM_Entity",
    "E4_Period":                 _CRM + "E4_Period",
    "E5_Event":                  _CRM + "E5_Event",
    "E7_Activity":               _CRM + "E7_Activity",
    "E8_Acquisition":            _CRM + "E8_Acquisition",
    "E12_Production":            _CRM + "E12_Production",
    "E13_Attribute_Assignment":  _CRM + "E13_Attribute_Assignment",
    "E21_Person":                _CRM + "E21_Person",
    "E22_Human-Made_Object":     _CRM + "E22_Human-Made_Object",
    "E28_Conceptual_Object":     _CRM + "E28_Conceptual_Object",
    "E34_Inscription":           _CRM + "E34_Inscription",
    "E39_Actor":                 _CRM + "E39_Actor",
    "E41_Appellation":           _CRM + "E41_Appellation",
    "E42_Identifier":            _CRM + "E42_Identifier",
    "E52_Time-Span":             _CRM + "E52_Time-Span",
    "E53_Place":                 _CRM + "E53_Place",
    "E55_Type":                  _CRM + "E55_Type",
    "E73_Information_Object":    _CRM + "E73_Information_Object",
    "E74_Group":                 _CRM + "E74_Group",
    "LivingGoddessSelection":    _HG + "LivingGoddessSelection",
    "LivingGoddessRetirement":   _HG + "LivingGoddessRetirement",
    "BuddhistMonument":          _HG + "BuddhistMonument",
    "CulturalEntity":            _HG + "CulturalEntity",
    "EntityCluster":             _HG + "EntityCluster",
    "Calendar":                  _HG + "Calendar",
    "I2_Belief":                 _HG + "I2_Belief",
}

# ── Transliteration / alias normalisation map ─────────────────────────────────
# Maps lower-cased name variants to a single canonical display form.
# This is deliberately curated, not auto-generated, so it remains precise.

_TRANSLITERATION_MAP: dict[str, str] = {
    # Swayambhunath
    "swayambhu":        "Swayambhunath",
    "swayambhunath":    "Swayambhunath",
    "swayambhu nath":   "Swayambhunath",
    "स्वयम्भू":         "Swayambhunath",
    "swoyambhu":        "Swayambhunath",
    # Pashupatinath
    "pashupati":        "Pashupatinath",
    "pashupatinath":    "Pashupatinath",
    "पशुपतिनाथ":        "Pashupatinath",
    # Boudhanath
    "boudha":           "Boudhanath",
    "boudhanath":       "Boudhanath",
    "bodhnath":         "Boudhanath",
    "bauddha":          "Boudhanath",
    "baudhanath":       "Boudhanath",
    "बौद्धनाथ":          "Boudhanath",
    # Changu Narayan
    "changu narayan":   "Changu Narayan",
    "changnarayan":     "Changu Narayan",
    "चाँगुनारायण":      "Changu Narayan",
    # Bhaktapur
    "bhadgaon":         "Bhaktapur",
    "bhaktapur":        "Bhaktapur",
    "भक्तपुर":          "Bhaktapur",
    # Lalitpur / Patan
    "patan":            "Lalitpur",
    "lalitpur":         "Lalitpur",
    "ललितपुर":          "Lalitpur",
    # Kathmandu
    "kantipur":         "Kathmandu",
    "kathmandu":        "Kathmandu",
    "काठमाडौँ":          "Kathmandu",
    # Kumari
    "kumari":           "Kumari",
    "living goddess":   "Kumari",
    "देवी":              "Kumari",
    # Lichhavi
    "licchhavi":        "Lichhavi",
    "lichhavi":         "Lichhavi",
    "lichavi":          "Lichhavi",
    # Malla
    "malla":            "Malla",
    # Manadeva
    "manadeva":         "Manadeva",
    "mandeva":          "Manadeva",
    # Amshuverma
    "amshuverma":       "Amshuverma",
    "amsuvarma":        "Amshuverma",
}

# ── Co-reference heuristics ────────────────────────────────────────────────────
# Surface forms that indicate an entity mention is a co-reference to the
# last known entity of that class in the same chunk.

_COREF_TRIGGERS: dict[str, frozenset[str]] = {
    "E22_Human-Made_Object": frozenset({
        "the temple", "the shrine", "the monument", "the structure",
        "the building", "the pagoda", "it", "this",
    }),
    "E21_Person": frozenset({
        "the king", "the ruler", "the person", "the individual",
        "he", "she", "they", "the queen", "the priest",
    }),
    "E53_Place": frozenset({
        "the place", "the location", "the site", "the city",
        "the town", "the village", "there",
    }),
    "E74_Group": frozenset({
        "the group", "the community", "the organization",
        "the institution", "the caste", "they",
    }),
    "E4_Period": frozenset({
        "the period", "the era", "the dynasty", "the reign", "the time",
    }),
}

# Literal object_type synonyms — object is a plain value, no URI needed
_LITERAL_SYNONYMS = frozenset({
    "literal", "xsd:string", "string", "text", "date", "number", "integer",
    "float", "decimal", "boolean", "xsd:date", "xsd:integer", "xsd:decimal",
})

# rapidfuzz threshold for fuzzy entity matching (0–100)
_FUZZY_THRESHOLD = 85


# ── Minimal inline SPARQL client ───────────────────────────────────────────────
# Avoids importing django.conf.settings so this module can run standalone.

class _SparqlClient:
    """Minimal HTTP SPARQL SELECT client for Oxigraph."""

    def __init__(self, base_url: str) -> None:
        self._sparql_url = base_url.rstrip("/") + "/sparql"

    def select(self, sparql: str) -> list[dict[str, str]]:
        import requests
        try:
            resp = requests.get(
                self._sparql_url,
                params={"query": sparql},
                headers={"Accept": "application/sparql-results+json"},
                timeout=15,
            )
            resp.raise_for_status()
            bindings = resp.json().get("results", {}).get("bindings", [])
            return [{k: v.get("value", "") for k, v in row.items()} for row in bindings]
        except Exception:
            logger.debug("SPARQL query failed", exc_info=True)
            return []

    def exact_label_lookup(self, label: str, class_uri: str | None) -> list[str]:
        """Return URIs whose rdfs:label matches label (case-insensitive), optionally filtered by class."""
        escaped = label.replace("\\", "\\\\").replace('"', '\\"')
        class_filter = f"?uri a <{class_uri}> .\n  " if class_uri else ""
        sparql = (
            f"PREFIX rdfs: <{_RDFS}>\n"
            f"SELECT ?uri WHERE {{\n"
            f"  {class_filter}?uri rdfs:label ?lbl .\n"
            f"  FILTER(LCASE(STR(?lbl)) = LCASE(\"{escaped}\"))\n"
            f"}} LIMIT 5"
        )
        rows = self.select(sparql)
        return [r["uri"] for r in rows if r.get("uri")]

    def label_candidates(self, class_uri: str | None) -> list[tuple[str, str]]:
        """Return (uri, label) pairs for all entities of class_uri (up to 500)."""
        class_filter = f"?uri a <{class_uri}> .\n  " if class_uri else ""
        sparql = (
            f"PREFIX rdfs: <{_RDFS}>\n"
            f"SELECT ?uri ?lbl WHERE {{\n"
            f"  {class_filter}?uri rdfs:label ?lbl .\n"
            f"}} LIMIT 500"
        )
        rows = self.select(sparql)
        return [(r["uri"], r["lbl"]) for r in rows if r.get("uri") and r.get("lbl")]


def _get_sparql_client() -> _SparqlClient:
    url = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
    return _SparqlClient(url)


# ── Helper utilities ───────────────────────────────────────────────────────────

def _is_literal(object_type: str) -> bool:
    return object_type.lower() in _LITERAL_SYNONYMS


def _normalize_name(name: str) -> str:
    """Apply transliteration map; return original if no mapping found."""
    key = name.strip().lower()
    return _TRANSLITERATION_MAP.get(key, name.strip())


def _is_coref(name: str, class_label: str) -> bool:
    triggers = _COREF_TRIGGERS.get(class_label, frozenset())
    return name.strip().lower() in triggers


def _class_slug(class_label: str) -> str:
    """E22_Human-Made_Object → e22-human-made-object (URI-safe slug)."""
    return re.sub(r"[^a-z0-9]+", "-", class_label.lower()).strip("-")


def _mint_uri(class_label: str) -> str:
    slug = _class_slug(class_label)
    return f"{_HG}entity/{slug}-{uuid.uuid4()}"


def _fuzzy_best(
    name: str,
    candidates: list[tuple[str, str]],
) -> tuple[str, float] | None:
    """Return (uri, score) for the best fuzzy match, or None if candidates is empty."""
    try:
        from rapidfuzz import fuzz
    except ImportError:
        return None

    best_uri, best_score = "", 0.0
    name_lower = name.lower()
    for uri, lbl in candidates:
        score = fuzz.ratio(name_lower, lbl.lower())
        if score > best_score:
            best_score, best_uri = score, uri

    return (best_uri, best_score) if best_uri else None


# ── Per-entity resolution ──────────────────────────────────────────────────────

def _resolve_entity(
    name: str,
    class_label: str,
    chunk_id: str,
    coref_registry: dict[str, dict[str, str]],
    client: _SparqlClient,
) -> tuple[str, bool, str]:
    """
    Resolve a single entity name to a canonical URI.

    Returns:
        (uri, is_new, note)
    """
    notes: list[str] = []

    # ── 1. Co-reference check ─────────────────────────────────────────────────
    if _is_coref(name, class_label):
        last_uri = coref_registry.get(chunk_id, {}).get(class_label)
        if last_uri:
            return last_uri, False, f"co-ref '{name}' → {last_uri}"
        # No prior entity of this class in this chunk — fall through to normal resolution

    # ── 2. Transliteration normalisation ─────────────────────────────────────
    canonical = _normalize_name(name)
    if canonical != name:
        notes.append(f"transliteration: '{name}' → '{canonical}'")

    # ── 3. Exact label lookup in Oxigraph ─────────────────────────────────────
    class_uri = _CLASS_URI.get(class_label)
    exact_hits = client.exact_label_lookup(canonical, class_uri)
    if not exact_hits and canonical != name:
        # Also try the original spelling
        exact_hits = client.exact_label_lookup(name, class_uri)
    if exact_hits:
        uri = exact_hits[0]
        note = f"exact match '{canonical}' → {uri}"
        if notes:
            note = "; ".join(notes) + "; " + note
        return uri, False, note

    # ── 4. Fuzzy label lookup ─────────────────────────────────────────────────
    candidates = client.label_candidates(class_uri)
    best = _fuzzy_best(canonical, candidates)
    if best:
        best_uri, score = best
        if score >= _FUZZY_THRESHOLD:
            note = f"fuzzy match ({score:.0f}%) '{canonical}' → {best_uri}"
            if notes:
                note = "; ".join(notes) + "; " + note
            return best_uri, False, note

    # ── 5. Mint new URI ───────────────────────────────────────────────────────
    new_uri = _mint_uri(class_label)
    note = f"minted '{canonical}' → {new_uri}"
    if notes:
        note = "; ".join(notes) + "; " + note
    return new_uri, True, note


def _update_coref_registry(
    registry: dict[str, dict[str, str]],
    chunk_id: str,
    class_label: str,
    uri: str,
    is_new: bool,
) -> None:
    """Record the latest resolved URI for a (chunk, class) pair."""
    # Only track non-co-reference resolutions to avoid circular references
    registry.setdefault(chunk_id, {})[class_label] = uri


# ── Public entry point ─────────────────────────────────────────────────────────

def run_entity_resolution(
    shacl_result: ShaclValidationResult,
    *,
    oxigraph_url: str | None = None,
) -> EntityResolutionResult:
    """
    Agent 4 entry point.

    Args:
        shacl_result: Output of Agent 3 (ShaclValidationResult).
        oxigraph_url: Override Oxigraph base URL (defaults to OXIGRAPH_URL env var
                      or http://localhost:7878).

    Returns:
        EntityResolutionResult with one ResolvedAssertion per ValidatedAssertion.
    """
    if oxigraph_url:
        client = _SparqlClient(oxigraph_url)
    else:
        client = _get_sparql_client()

    # co-reference registry: {chunk_id: {class_label: last_uri}}
    coref_registry: dict[str, dict[str, str]] = {}

    resolved: list[ResolvedAssertion] = []
    skipped = 0

    for validated in shacl_result.validated:
        triple = validated.candidate.triple
        chunk_id = validated.candidate.source_chunk_id
        notes: list[str] = []

        try:
            # Resolve subject
            subj_uri, subj_is_new, subj_note = _resolve_entity(
                triple.subject, triple.subject_type, chunk_id, coref_registry, client
            )
            notes.append(f"subject: {subj_note}")
            _update_coref_registry(coref_registry, chunk_id, triple.subject_type, subj_uri, subj_is_new)

            # Resolve object (only if not a literal)
            obj_uri: str | None = None
            obj_is_new = False
            if not _is_literal(triple.object_type):
                obj_uri, obj_is_new, obj_note = _resolve_entity(
                    triple.object, triple.object_type, chunk_id, coref_registry, client
                )
                notes.append(f"object: {obj_note}")
                _update_coref_registry(coref_registry, chunk_id, triple.object_type, obj_uri, obj_is_new)
            else:
                notes.append("object: literal — no URI resolution")

            resolved.append(
                ResolvedAssertion(
                    validated=validated,
                    subject_uri=subj_uri,
                    object_uri=obj_uri,
                    subject_is_new=subj_is_new,
                    object_is_new=obj_is_new,
                    resolution_notes=notes,
                )
            )

        except Exception:
            logger.warning(
                "Entity resolution failed for triple (%s, %s, %s) in chunk %s",
                triple.subject, triple.predicate, triple.object, chunk_id,
                exc_info=True,
            )
            skipped += 1

    new_subjects = sum(1 for r in resolved if r.subject_is_new)
    new_objects = sum(1 for r in resolved if r.object_is_new)
    logger.info(
        "Entity resolution: %d resolved, %d skipped | new subjects=%d new objects=%d",
        len(resolved), skipped, new_subjects, new_objects,
    )

    return EntityResolutionResult(resolved=resolved, skipped_count=skipped)
