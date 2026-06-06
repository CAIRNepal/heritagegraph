"""
Export provenance as RDF-star style quoted triples (TriG annotation syntax).

Oxigraph 0.3+ supports RDF 1.2 quoted triples in TriG; we emit a conservative
annotation block per assertion for tools that consume RDF-star.
"""

from __future__ import annotations

from pathlib import Path

from apps.graph.kg_engine.assertion_projection import assertion_uri
from apps.graph.kg_engine.engine import (
    resource_uri_for_instance_from_assertion,
    resource_uri_for_object_assertion,
)
from apps.graph.kg_engine.partitions import GraphPartition
from apps.graph.kg_engine.uris import relationship_predicate_uri


def export_rdfstar_trig(output_path: Path) -> int:
    from apps.cidoc_data.assertion_validation import is_relationship_property
    from apps.cidoc_data.models import HeritageAssertion

    prov_base = GraphPartition.PROVENANCE.uri(suffix="") or ""
    lines = [
        "@prefix crminf: <http://www.cidoc-crm.org/crminf/> .",
        "@prefix prov: <http://www.w3.org/ns/prov#> .",
        "",
        "<https://w3id.org/heritagegraph/graph/annotations> {",
    ]
    count = 0
    for assertion in HeritageAssertion.objects.filter(
        reconciliation_status="accepted",
        asserted_property__startswith="relationship.",
    ).iterator():
        subj = resource_uri_for_instance_from_assertion(assertion)
        obj = resource_uri_for_object_assertion(assertion)
        if not subj or not obj:
            continue
        raw = assertion.asserted_property or ""
        suffix = raw[len("relationship.") :] if "relationship." in raw else raw
        pred = relationship_predicate_uri(suffix)
        belief = assertion_uri(assertion.pk)
        # RDF 1.2 quoted-triple annotation (TriG)
        lines.append(f"  << <{subj}> <{pred}> <{obj}> >>")
        lines.append(f"    prov:wasAttributedTo \"{assertion.contributed_by or 'unknown'}\" ;")
        lines.append(f"    crminf:J2_concluded_that \"{assertion.crminf_conclusion or assertion.confidence}\" ;")
        lines.append(f"    prov:wasDerivedBy <{belief}> .")
        count += 1
    lines.append("}")
    lines.append("")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    return count
