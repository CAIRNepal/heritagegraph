"""
KG-quality metrics — makes the five guarantees measurable (Part 7).

Two tiers:
  * schema-level metrics    — computable from the generated ontology artifacts
                              alone (no triplestore needed): CRM-bridge coverage,
                              external-alignment density, axiom counts;
  * instance-level metrics  — computed over the live Oxigraph store + Postgres:
                              namespace integrity, type/temporal coverage,
                              datatype hygiene, provenance coverage, consistency.

Every metric degrades gracefully (returns ``None``) when the store is empty or
unavailable, so the command runs in any environment.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from django.conf import settings

from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.ontology_config import RDF_PREFIXES

logger = logging.getLogger(__name__)

RDF_TYPE = RDF_PREFIXES["rdf"] + "type"
CRM = RDF_PREFIXES["crm"]
HG = RDF_PREFIXES["heritageGraph"]
# The full CIDOC-CRM family counts as CRM coverage (core CRM + CRMinf/sci/dig).
CRM_FAMILY = tuple(
    RDF_PREFIXES[k] for k in ("crm", "crminf", "crmsci", "crmdig") if k in RDF_PREFIXES
)
_REPO_ROOT = Path(settings.BASE_DIR).parent
_ONTOLOGY = _REPO_ROOT / "ontology"


# ───────────────────────── schema-level (no store needed) ──────────────────────


def _load_schema_graph() -> Any:
    """Heritage.ttl ∪ CRM bridge ∪ SKOS vocab as one rdflib graph."""
    import rdflib

    g = rdflib.Graph()
    for name in ("Heritage.ttl", "heritagegraph-crm-bridge.ttl", "lod/skos-vocabularies.ttl"):
        p = _ONTOLOGY / name
        if p.is_file():
            try:
                g.parse(str(p), format="turtle")
            except Exception:
                logger.debug("quality: failed to parse %s", p, exc_info=True)
    return g


def _instance_type_iris() -> set[str]:
    """The class IRIs that instances actually receive as rdf:type (registry classUri)."""
    out: set[str] = set()
    try:
        from apps.cidoc_data.linkml_loader import get_effective_registry_payload
        from apps.cidoc_data.rdf_entity_projection import expand_curie

        payload = get_effective_registry_payload() or {}
    except Exception:
        return out
    for cls in (payload.get("classes") or {}).values():
        cu = (cls or {}).get("classUri")
        if cu:
            out.add(expand_curie(str(cu)))
    return out


def crm_bridge_coverage() -> dict[str, Any]:
    """Fraction of instance types that entail a CIDOC-CRM superclass.

    A type is covered if it is itself a ``crm:`` IRI or reaches one through the
    transitive ``rdfs:subClassOf`` closure of (Heritage.ttl ∪ bridge)."""
    from rdflib import RDFS, URIRef

    types = _instance_type_iris()
    if not types:
        return {"value": None, "covered": 0, "total": 0}

    g = _load_schema_graph()
    parents: dict[str, set[str]] = {}
    for s, _, o in g.triples((None, RDFS.subClassOf, None)):
        parents.setdefault(str(s), set()).add(str(o))

    def reaches_crm(start: str) -> bool:
        if start.startswith(CRM_FAMILY):
            return True
        seen, stack = {start}, [start]
        while stack:
            for parent in parents.get(stack.pop(), ()):
                if parent.startswith(CRM_FAMILY):
                    return True
                if parent not in seen:
                    seen.add(parent)
                    stack.append(parent)
        return False

    covered = sorted(t for t in types if reaches_crm(t))
    uncovered = sorted(t for t in types if t not in covered)
    return {
        "value": round(len(covered) / len(types), 4),
        "covered": len(covered),
        "total": len(types),
        "uncovered_types": uncovered[:20],
    }


def external_alignment_density() -> dict[str, Any]:
    """Count of class-level external authority links by SKOS match strength."""
    from rdflib import URIRef
    from rdflib.namespace import SKOS

    g = _load_schema_graph()
    out = {"exactMatch": 0, "closeMatch": 0, "broadMatch": 0, "by_authority": {}}
    authorities = {
        "getty_aat": "vocab.getty.edu/aat",
        "getty_tgn": "vocab.getty.edu/tgn",
        "wikidata": "wikidata.org",
        "europeana_edm": "europeana.eu/schemas/edm",
        "geonames": "geonames.org",
        "schema_org": "schema.org",
        "dbpedia": "dbpedia.org",
    }
    for prop, key in ((SKOS.exactMatch, "exactMatch"), (SKOS.closeMatch, "closeMatch"), (SKOS.broadMatch, "broadMatch")):
        for _, _, o in g.triples((None, prop, None)):
            out[key] += 1
            for name, frag in authorities.items():
                if frag in str(o):
                    out["by_authority"][name] = out["by_authority"].get(name, 0) + 1
    return out


def schema_axiom_counts() -> dict[str, Any]:
    from rdflib import OWL, RDFS

    g = _load_schema_graph()
    crm_subclass = sum(
        1 for _, _, o in g.triples((None, RDFS.subClassOf, None)) if str(o).startswith(CRM)
    )
    return {
        "disjointness_axioms": len(set(g.triples((None, OWL.disjointWith, None)))),
        "crm_subclass_bridges": crm_subclass,
        "declared_prefixes": len(RDF_PREFIXES),
    }


# ───────────────────────── instance-level (over the store) ─────────────────────


def _count(engine: Any, sparql: str) -> int | None:
    try:
        rows = engine.query(sparql)
    except Exception:
        return None
    if not rows:
        return 0
    val = next(iter(rows[0].values()), "0")
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def namespace_integrity(engine: Any) -> dict[str, Any]:
    """Predicates/types in PUBLIC whose namespace is NOT a declared prefix value.

    Target = 0. This is the regression guard for the namespace-collapse class of
    bugs: any stray IRI here means a CURIE expanded into the wrong namespace."""
    public = GraphPartition.PUBLIC.uri()
    if not public:
        return {"violations": None, "offending": []}
    declared = tuple(RDF_PREFIXES.values())
    q = (
        f"SELECT DISTINCT ?p WHERE {{ GRAPH <{public}> {{ ?s ?p ?o }} }}"
    )
    try:
        rows = engine.query(q)
    except Exception:
        return {"violations": None, "offending": []}
    offending = sorted(
        r["p"] for r in rows if r.get("p") and not str(r["p"]).startswith(declared)
    )
    return {"violations": len(offending), "offending": offending[:25]}


def type_coverage(engine: Any) -> dict[str, Any]:
    public = GraphPartition.PUBLIC.uri()
    subjects = _count(engine, f"SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {{ GRAPH <{public}> {{ ?s ?p ?o }} }}")
    typed = _count(engine, f"SELECT (COUNT(DISTINCT ?s) AS ?n) WHERE {{ GRAPH <{public}> {{ ?s <{RDF_TYPE}> ?t }} }}")
    value = round(typed / subjects, 4) if subjects else None
    return {"value": value, "typed_subjects": typed, "total_subjects": subjects}


def dangling_edges(engine: Any) -> int | None:
    public = GraphPartition.PUBLIC.uri()
    return _count(
        engine,
        f"""SELECT (COUNT(*) AS ?n) WHERE {{ GRAPH <{public}> {{
  ?s a ?st . ?s ?p ?o .
  FILTER(isIRI(?o)) FILTER(?p != <{RDF_TYPE}>)
  FILTER NOT EXISTS {{ GRAPH <{public}> {{ ?o a ?ot }} }}
}} }}""",
    )


def datatype_hygiene(engine: Any) -> dict[str, Any]:
    """% of literals carrying a datatype or language tag (xsd:string counts)."""
    public = GraphPartition.PUBLIC.uri()
    total = _count(engine, f"SELECT (COUNT(*) AS ?n) WHERE {{ GRAPH <{public}> {{ ?s ?p ?o FILTER(isLiteral(?o)) }} }}")
    tagged = _count(
        engine,
        f"""SELECT (COUNT(*) AS ?n) WHERE {{ GRAPH <{public}> {{ ?s ?p ?o
  FILTER(isLiteral(?o)) FILTER(datatype(?o) != <{RDF_PREFIXES['xsd']}string> || lang(?o) != "") }} }}""",
    )
    # Plain literals are xsd:string in RDF 1.1, so "typed-or-tagged" is the
    # meaningful hygiene signal; report both.
    return {"literals": total, "datatyped_or_langtagged": tagged}


def temporal_validity(engine: Any) -> dict[str, Any]:
    """Events with a time-span; assertions with EDTF temporal scope."""
    public = GraphPartition.PUBLIC.uri()
    p4 = CRM + "P4_has_time-span"
    e5 = CRM + "E5_Event"
    events = _count(engine, f"SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{ GRAPH <{public}> {{ ?e a <{e5}> }} }}")
    events_dated = _count(
        engine,
        f"SELECT (COUNT(DISTINCT ?e) AS ?n) WHERE {{ GRAPH <{public}> {{ ?e a <{e5}> ; <{p4}> ?ts }} }}",
    )
    try:
        from apps.cidoc_data.models import HeritageAssertion

        assertions = HeritageAssertion.objects.filter(reconciliation_status="accepted").count()
        with_edtf = (
            HeritageAssertion.objects.filter(reconciliation_status="accepted")
            .exclude(temporal_scope_edtf="")
            .count()
        )
    except Exception:
        assertions = with_edtf = None
    return {
        "events_with_timespan": events_dated,
        "events_total": events,
        "event_dating_coverage": round(events_dated / events, 4) if events else None,
        "accepted_assertions": assertions,
        "assertions_with_edtf": with_edtf,
        "assertion_temporal_coverage": (
            round(with_edtf / assertions, 4) if assertions else None
        ),
    }


def provenance_coverage(engine: Any) -> dict[str, Any]:
    """Accepted relationship edges whose belief carries an IRI agent + source."""
    try:
        from apps.cidoc_data.models import HeritageAssertion

        qs = HeritageAssertion.objects.filter(
            asserted_property__startswith="relationship.",
            reconciliation_status="accepted",
        )
        total = qs.count()
        attributed = qs.exclude(attributed_to_agent="").exclude(contributed_by="").count()
        sourced = qs.filter(source__isnull=False).count() + qs.exclude(source_citation="").count()
    except Exception:
        return {"value": None, "accepted_edges": None}
    return {
        "accepted_edges": total,
        "with_agent": attributed,
        "with_source": min(sourced, total) if total else 0,
        "value": round(attributed / total, 4) if total else None,
    }


def consistency(engine: Any) -> dict[str, Any]:
    """Class-disjointness violations under the OWL-RL closure (Part 4 detector)."""
    try:
        from apps.graph.kg_engine.inference import materialize_inferred_graph

        report = materialize_inferred_graph(store=engine.store)
    except Exception:
        return {"violations": None}
    return {
        "violations": report.consistency_violations,
        "sample": report.violations or [],
        "inferred_triples": report.inferred_triples,
        "novelty_rate": report.novelty_rate,
    }


def shacl_conformance() -> dict[str, Any]:
    return {
        "validate_on_write": bool(getattr(settings, "RDF_SHACL_VALIDATE_ON_WRITE", False)),
        "strict_on_write": bool(getattr(settings, "RDF_SHACL_STRICT_ON_WRITE", False)),
    }


def build_quality_report(engine: Any) -> dict[str, Any]:
    """The five guarantees, each backed by concrete metrics."""
    return {
        "correctness": {
            "namespace_integrity": namespace_integrity(engine),
            "crm_bridge_coverage": crm_bridge_coverage(),
            "dangling_edges": dangling_edges(engine),
            "datatype_hygiene": datatype_hygiene(engine),
        },
        "consistency": {
            **consistency(engine),
            "axioms": schema_axiom_counts(),
            "shacl": shacl_conformance(),
        },
        "completeness": {
            "type_coverage": type_coverage(engine),
            "external_alignment": external_alignment_density(),
        },
        "provenance_coverage": provenance_coverage(engine),
        "temporal_validity": temporal_validity(engine),
    }
