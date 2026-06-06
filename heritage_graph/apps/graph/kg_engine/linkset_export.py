"""Generate VoID linksets for external authority reconciliation."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings


def build_linkset_ttl() -> str:
    from apps.cidoc_data.models import EntityCluster

    base = str(getattr(settings, "RDF_RESOURCE_BASE_URI", "")).rstrip("/")
    dataset = "https://w3id.org/heritagegraph/dataset/public"
    lines = [
        "@prefix void: <http://rdfs.org/ns/void#> .",
        "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
        "@prefix dct: <http://purl.org/dc/terms/> .",
        "",
        f"<{dataset}/linkset/wikidata> a void:Linkset ;",
        f"  void:target <https://www.wikidata.org/> ;",
        "  dct:title \"HeritageGraph → Wikidata\"@en ;",
        "  void:subjectsTarget ?hg ;",
        "  void:objectsTarget ?wd .",
        "",
    ]

    from apps.cidoc_data import identity_services
    from apps.graph.kg_engine.uris import resource_uri_for_instance

    link_lines: list[str] = []
    for cluster in EntityCluster.objects.filter(merged_into__isnull=True).iterator():
        ext = cluster.external_identifiers or {}
        if not isinstance(ext, dict):
            continue
        member_uris: list[str] = []
        for row in identity_services.active_memberships_for_cluster(cluster):
            ct = getattr(row, "content_type", None)
            oid = getattr(row, "object_id", None)
            if ct is None or oid is None:
                continue
            model = ct.model_class()
            if model is None:
                continue
            try:
                obj = model.objects.get(pk=oid)
                member_uris.append(resource_uri_for_instance(obj))
            except model.DoesNotExist:
                continue
        if not member_uris:
            member_uris = [f"{base}/cluster/{cluster.id}"]
        for _key, iri in ext.items():
            if not iri or not str(iri).startswith("http"):
                continue
            for hg_uri in member_uris:
                link_lines.append(f"<{hg_uri}> skos:exactMatch <{iri}> .")

    if link_lines:
        lines.append(f"<{dataset}/linkset/assertions> {{")
        lines.extend(f"  {ln}" for ln in link_lines[:5000])
        lines.append("}")
        lines.append("")

    lines.append(f"<{dataset}/linkset/wikidata> void:linkPredicate skos:exactMatch .")
    return "\n".join(lines) + "\n"


def write_linkset(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(build_linkset_ttl(), encoding="utf-8")
    return path
