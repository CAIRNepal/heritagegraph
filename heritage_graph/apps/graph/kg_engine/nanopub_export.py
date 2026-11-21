"""Export accepted assertions as nanopublication-style TriG bundles."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from apps.graph.kg_engine.assertion_projection import assertion_uri, data_source_uri
from apps.graph.kg_engine.engine import (
    resource_uri_for_instance_from_assertion,
    resource_uri_for_object_assertion,
)
from apps.graph.kg_engine.partitions import GraphPartition
from django.conf import settings


def _hash_manifest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def nanopub_trig_for_assertion(assertion: Any) -> str:
    """Single nanopublication as TriG (assertion / provenance / publication info graphs)."""
    from apps.cidoc_data.assertion_validation import is_relationship_property
    from apps.graph.kg_engine.uris import relationship_predicate_uri

    aid = assertion.pk
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    np_id = assertion_uri(aid)
    prov_graph = GraphPartition.PROVENANCE.uri(suffix=str(aid)) or f"{base}/graph/prov/{aid}"
    pub_graph = f"{base}/graph/pubinfo/{aid}"
    assertion_graph = GraphPartition.ASSERTION.uri(suffix=str(aid)) or f"{base}/graph/assertion/{aid}"

    lines = [
        "@prefix np: <http://www.nanopub.org/nschema#> .",
        "@prefix prov: <http://www.w3.org/ns/prov#> .",
        "@prefix dct: <http://purl.org/dc/terms/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        f"<{np_id}> a np:Nanopublication ;",
        f"  np:hasAssertionGraph <{assertion_graph}> ;",
        f"  np:hasProvenanceGraph <{prov_graph}> ;",
        f"  np:hasPublicationInfoGraph <{pub_graph}> .",
        "",
        f"<{assertion_graph}> {{",
    ]

    if is_relationship_property(assertion.asserted_property):
        subj = resource_uri_for_instance_from_assertion(assertion)
        obj = resource_uri_for_object_assertion(assertion)
        if subj and obj:
            raw = assertion.asserted_property or ""
            suffix = raw[len("relationship.") :] if "relationship." in raw else raw
            pred = relationship_predicate_uri(suffix)
            lines.append(f"  <{subj}> <{pred}> <{obj}> .")
    lines.append("}")
    lines.append("")
    lines.append(f"<{prov_graph}> {{")
    lines.append(f"  <{np_id}> a <http://www.cidoc-crm.org/crminf/I2_Belief> .")
    if assertion.source_id:
        lines.append(f"  <{np_id}> prov:wasDerivedFrom <{data_source_uri(assertion.source_id)}> .")
    agent = (assertion.attributed_to_agent or assertion.contributed_by or "").strip()
    if agent:
        lines.append(f'  <{np_id}> prov:wasAttributedTo "{agent}" .')
    if assertion.created_at:
        lines.append(
            f'  <{np_id}> prov:generatedAtTime "{assertion.created_at.isoformat()}"^^xsd:dateTime .'
        )
    lines.append("}")
    lines.append("")

    manifest = json.dumps(
        {"assertion_id": str(aid), "reconciliation": assertion.reconciliation_status},
        sort_keys=True,
    )
    digest = _hash_manifest(manifest)
    lines.extend(
        [
            f"<{pub_graph}> {{",
            f'  <{pub_graph}> dct:creator "HeritageGraph" ;',
            '  dct:license <https://creativecommons.org/licenses/by/4.0/> ;',
            f'  dct:identifier "{digest}"^^xsd:string .',
            "}",
            "",
        ]
    )
    return "\n".join(lines)


def nanopub_retraction_trig(old_assertion: Any, new_assertion: Any) -> str:
    """Retraction nanopub: new pubinfo graph carries npx:supersedes pointer to old nanopub URI."""
    aid_old = old_assertion.pk
    aid_new = new_assertion.pk
    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    np_old = assertion_uri(aid_old)
    np_new = assertion_uri(aid_new)
    pub_graph = f"{base}/graph/pubinfo/{aid_new}"

    lines = [
        "@prefix np: <http://www.nanopub.org/nschema#> .",
        "@prefix npx: <http://purl.org/nanopub/x/> .",
        "@prefix prov: <http://www.w3.org/ns/prov#> .",
        "@prefix dct: <http://purl.org/dc/terms/> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        f"<{np_new}> a np:Nanopublication ;",
        f"  np:hasPublicationInfoGraph <{pub_graph}> .",
        "",
        f"<{pub_graph}> {{",
        f'  <{pub_graph}> dct:creator "HeritageGraph" ;',
        f"  npx:supersedes <{np_old}> .",
        "}",
        "",
    ]
    return "\n".join(lines)


def export_nanopubs(output_dir: Path) -> int:
    from apps.cidoc_data.models import HeritageAssertion

    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for assertion in HeritageAssertion.objects.filter(
        reconciliation_status="accepted"
    ).iterator():
        body = nanopub_trig_for_assertion(assertion)
        path = output_dir / f"nanopub-{assertion.pk}.trig"
        path.write_text(body, encoding="utf-8")
        count += 1
    return count
