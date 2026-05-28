"""Build a scoped graph payload for a contributor project dossier."""

from __future__ import annotations

from apps.heritage_data.models import CulturalEntity, Project, Revision


def _revision_edges(entity_ids: set[str]) -> list[dict]:
    """Infer edges from revision JSON when both endpoints are in the project."""
    edges: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    revisions = Revision.objects.filter(entity_id__in=entity_ids).only(
        "entity_id", "data"
    )
    for rev in revisions:
        data = rev.data if isinstance(rev.data, dict) else {}
        source = str(rev.entity_id)
        for key, value in data.items():
            if not isinstance(key, str):
                continue
            lower = key.lower()
            if "id" not in lower and "entity" not in lower and "reference" not in lower:
                continue
            targets: list[str] = []
            if isinstance(value, str) and value in entity_ids:
                targets.append(value)
            elif isinstance(value, dict) and str(value.get("id", "")) in entity_ids:
                targets.append(str(value["id"]))
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and item in entity_ids:
                        targets.append(item)
                    elif isinstance(item, dict) and str(item.get("id", "")) in entity_ids:
                        targets.append(str(item["id"]))
            for target in targets:
                if target == source:
                    continue
                edge_key = (source, target, key)
                if edge_key in seen:
                    continue
                seen.add(edge_key)
                edges.append(
                    {
                        "id": f"rev-{source}-{target}-{key}",
                        "source": source,
                        "target": target,
                        "label": key.replace("_", " "),
                        "edgeType": "relation",
                    }
                )
    return edges


def build_project_graph_payload(project: Project) -> dict:
    """
    Return ``{ nodes, edges, isDemo }`` for Cytoscape (project-scoped only).
    """
    links = list(
        project.entities.select_related("entity").order_by("added_at")
    )
    entity_ids = {str(link.entity_id) for link in links}

    nodes: list[dict] = []
    for link in links:
        ent: CulturalEntity = link.entity
        nodes.append(
            {
                "id": str(ent.entity_id),
                "label": ent.name or str(ent.entity_id),
                "category": ent.category or "other",
                "entityType": ent.category or "CulturalEntity",
                "description": (ent.description or "")[:500],
                "apiEndpoint": "/data/cultural-entities/",
                "roleInProject": link.role_in_project or "",
                "status": ent.status,
                "rawData": {
                    "entity_id": str(ent.entity_id),
                    "name": ent.name,
                    "category": ent.category,
                    "status": ent.status,
                },
            }
        )

    for asset in project.assets.select_related("media").order_by("created_at"):
        nodes.append(
            {
                "id": f"asset-{asset.id}",
                "label": asset.caption or asset.role or "Evidence",
                "category": "evidence",
                "entityType": "ProjectAsset",
                "description": asset.media_type or "",
                "apiEndpoint": "",
                "roleInProject": asset.role,
                "status": asset.ocr_status,
                "rawData": {
                    "asset_id": str(asset.id),
                    "media_type": asset.media_type,
                },
            }
        )

    edges = _revision_edges(entity_ids)

    entities = CulturalEntity.objects.filter(entity_id__in=entity_ids).only(
        "entity_id", "parent_entity_id", "root_entity_id"
    )
    for ent in entities:
        if ent.parent_entity_id and str(ent.parent_entity_id) in entity_ids:
            edges.append(
                {
                    "id": f"fork-{ent.parent_entity_id}-{ent.entity_id}",
                    "source": str(ent.parent_entity_id),
                    "target": str(ent.entity_id),
                    "label": "fork",
                    "edgeType": "fork",
                }
            )

    return {"nodes": nodes, "edges": edges, "isDemo": False}
