"""Museum graph enrichment — geo + temporal hints from Django ORM and known places.

The SPARQL projection surfaces rdf:type, labels, and WKT literals when present.
Many curated records still carry coordinates and dates only on Django rows (or as
human-readable century strings not yet reified in RDF). This module backfills
``lat``, ``long``, and ``inceptionYear`` on graph API nodes and propagates place
coordinates along location edges so map/timeline views work on live data.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from apps.cidoc_data.cidoc_registry_keys import DJANGO_MODEL_TO_REGISTRY_CLASS_KEY
from apps.cidoc_data.identity_services import active_memberships_for_subject
from apps.cidoc_data.models import EntityCluster
from apps.graph.kg_engine.uris import resource_base
from django.contrib.contenttypes.models import ContentType

_POINT_RE = re.compile(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)
_LOCATION_PRED_RE = re.compile(
    r"(location|located|place_at|took_place_at|has_current_location|residence|form_of)",
    re.IGNORECASE,
)

# Well-known Kathmandu Valley heritage sites (WGS84). Used when DB point fields
# are empty but the place label matches a canonical site name.
# Mirrored client-side in heritage_graph_ui/src/lib/atlas-place-coords.ts.
_KNOWN_PLACE_COORDS: dict[str, tuple[str, str]] = {
    "kathmandu durbar square": ("27.7042", "85.3076"),
    "patan durbar square": ("27.6729", "85.3265"),
    "bhaktapur durbar square": ("27.6721", "85.4298"),
    "pashupatinath": ("27.7104", "85.3486"),
    "pashupatinath temple": ("27.7104", "85.3486"),
    "boudhanath": ("27.7215", "85.3620"),
    "boudhanath stupa": ("27.7215", "85.3620"),
    "swayambhunath": ("27.7149", "85.2903"),
    "changu narayan": ("27.7164", "85.4277"),
    "changu narayan temple": ("27.7164", "85.4277"),
    "hanuman dhoka": ("27.7047", "85.3073"),
    "kathmandu valley": ("27.7172", "85.3240"),
    "basantapur": ("27.7047", "85.3073"),
    "basantapur tower": ("27.7047", "85.3073"),
    "taleju temple precinct": ("27.7045", "85.3078"),
    # Valley settlements + national heritage anchors.
    "kathmandu": ("27.7172", "85.3240"),
    "patan": ("27.6766", "85.3250"),
    "lalitpur": ("27.6766", "85.3250"),
    "bhaktapur": ("27.6710", "85.4298"),
    "kirtipur": ("27.6717", "85.2783"),
    "thimi": ("27.6800", "85.3833"),
    "madhyapur thimi": ("27.6800", "85.3833"),
    "sankhu": ("27.7167", "85.5167"),
    "nuwakot durbar": ("27.9167", "85.1667"),
    "lumbini": ("27.4833", "83.2756"),
    "janakpur": ("26.7288", "85.9266"),
    "gorkha": ("28.0000", "84.6333"),
    "pokhara": ("28.2096", "83.9856"),
    "mustang": ("28.9985", "83.8473"),
}

_REGISTRY_KEY_TO_MODEL: dict[str, str] = {
    v: k for k, v in DJANGO_MODEL_TO_REGISTRY_CLASS_KEY.items()
}


def _normalize_place_key(label: str | None) -> str:
    return re.sub(r"\s+", " ", (label or "").strip().lower())


def parse_resource_uri(iri: str | None) -> tuple[str, int] | None:
    """Return (registry_segment, pk) for a curated resource IRI, or None."""
    if not iri:
        return None
    base = resource_base().rstrip("/") + "/"
    if not str(iri).startswith(base):
        return None
    tail = str(iri)[len(base) :]
    if "/" not in tail:
        return None
    segment, pk_raw = tail.split("/", 1)
    try:
        return segment.strip().lower(), int(pk_raw)
    except ValueError:
        return None


def _coords_from_point_field(point: Any) -> tuple[str, str] | None:
    if point is None:
        return None
    # GeoDjango Point: x=lon, y=lat
    if hasattr(point, "x") and hasattr(point, "y"):
        try:
            return str(point.y), str(point.x)
        except Exception:
            pass
    text = str(point).strip()
    if not text:
        return None
    m = _POINT_RE.search(text)
    if m:
        return m.group(2), m.group(1)
    parts = text.lstrip("(").rstrip(")").split(",")
    if len(parts) == 2:
        try:
            lat = float(parts[0].strip())
            lng = float(parts[1].strip())
            if abs(lat) <= 90 and abs(lng) <= 180:
                return str(lat), str(lng)
        except ValueError:
            pass
    return None


def coords_from_instance(instance: Any) -> tuple[str, str] | None:
    for attr in ("point", "coordinates_legacy", "place_coordinates"):
        raw = getattr(instance, attr, None)
        if attr == "point":
            hit = _coords_from_point_field(raw)
            if hit:
                return hit
        elif raw:
            text = str(raw).strip()
            m = _POINT_RE.search(text)
            if m:
                return m.group(2), m.group(1)
            parts = text.split(",")
            if len(parts) == 2:
                try:
                    lat = float(parts[0].strip())
                    lng = float(parts[1].strip())
                    if abs(lat) <= 90 and abs(lng) <= 180:
                        return str(lat), str(lng)
                except ValueError:
                    pass
    label = getattr(instance, "name", None) or getattr(instance, "title", None)
    key = _normalize_place_key(str(label) if label else "")
    if key in _KNOWN_PLACE_COORDS:
        return _KNOWN_PLACE_COORDS[key]
    return None


def temporal_hint_from_instance(instance: Any) -> str | None:
    for attr in (
        "construction_date",
        "start_date",
        "start_year",
        "birth_date",
        "inception_date",
    ):
        raw = getattr(instance, attr, None)
        if raw and str(raw).strip():
            return str(raw).strip()
    return None


def _load_instance(segment: str, pk: int) -> Any | None:
    model_name = _REGISTRY_KEY_TO_MODEL.get(segment)
    if not model_name:
        return None
    try:
        from django.apps import apps

        model = apps.get_model("cidoc_data", model_name)
        return model.objects.filter(pk=pk).first()
    except Exception:
        return None


def _comment_is_sparse(comment: str | None, label: str | None) -> bool:
    text = (comment or "").strip()
    if not text:
        return True
    if len(text) < 120:
        return True
    if label and text.lower() == label.strip().lower():
        return True
    return False


def _apply_media_bundle(node: dict[str, Any], bundle) -> None:
    from apps.graph.kg_engine.museum_media import MuseumMediaBundle

    if not isinstance(bundle, MuseumMediaBundle):
        return
    if bundle.comment and _comment_is_sparse(node.get("comment"), node.get("label")):
        node["comment"] = bundle.comment
        node["narrativeSource"] = bundle.narrative_source
    if bundle.image_url and not node.get("imageUrl"):
        node["imageUrl"] = bundle.image_url
    if bundle.images:
        existing = list(node.get("images") or [])
        for url in bundle.images:
            if url not in existing:
                existing.append(url)
        node["images"] = existing
        if not node.get("imageUrl"):
            node["imageUrl"] = existing[0]
    if bundle.image_credits:
        credits = dict(node.get("imageCredits") or {})
        credits.update(bundle.image_credits)
        node["imageCredits"] = credits
    if bundle.image_source:
        node["imageSource"] = bundle.image_source


def _resolve_cluster(cluster: EntityCluster) -> EntityCluster:
    """Follow merged_into chain to the active canonical cluster."""
    seen: set[uuid.UUID] = set()
    current = cluster
    while current.merged_into_id and current.merged_into_id not in seen:
        seen.add(current.id)
        nxt = current.merged_into
        if nxt is None:
            break
        current = nxt
    return current


def enrich_museum_cluster_identity(nodes: dict[str, dict[str, Any]]) -> None:
    """Attach clusterId / clusterLabel for museum UI deduplication."""
    for node in nodes.values():
        parsed = parse_resource_uri(node.get("id"))
        if not parsed:
            continue
        segment, pk = parsed
        instance = _load_instance(segment, pk)
        if instance is None:
            continue
        ct = ContentType.objects.get_for_model(
            instance.__class__,
            for_concrete_model=False,
        )
        mem = (
            active_memberships_for_subject(ct, instance.pk)
            .select_related("entity_cluster", "entity_cluster__merged_into")
            .first()
        )
        if not mem or not mem.entity_cluster_id:
            continue
        cluster = _resolve_cluster(mem.entity_cluster)
        node["clusterId"] = str(cluster.id)
        node["clusterLabel"] = cluster.canonical_label
        node["typeScope"] = cluster.type_scope
        from apps.cidoc_data.canonical_record_selection import (
            _load_member_instance,
            select_canonical_member,
        )
        from apps.cidoc_data.rdf_publish import resource_uri_for_instance

        canonical = select_canonical_member(cluster)
        if canonical and canonical.get("entity_id") is not None:
            ct_canon = ContentType.objects.get(model=canonical["entity_type"])
            canon_obj = _load_member_instance(ct_canon, int(canonical["entity_id"]))
            if canon_obj is not None:
                node["canonicalMemberId"] = resource_uri_for_instance(canon_obj)


def enrich_museum_graph_nodes(
    nodes: dict[str, dict[str, Any]],
    edges: list[dict[str, Any]],
) -> None:
    """Mutate *nodes* in place: ORM geo/temporal/narrative/media + coordinate propagation."""
    from apps.graph.kg_engine.museum_media import media_bundle_for_resource

    for node in nodes.values():
        parsed = parse_resource_uri(node.get("id"))
        if not parsed:
            continue
        segment, pk = parsed
        instance = _load_instance(segment, pk)
        if instance is not None:
            if node.get("lat") is None or node.get("long") is None:
                coords = coords_from_instance(instance)
                if coords:
                    node["lat"], node["long"] = coords
            if not node.get("inceptionYear"):
                hint = temporal_hint_from_instance(instance)
                if hint:
                    node["inceptionYear"] = hint

        bundle = media_bundle_for_resource(
            segment,
            pk,
            label=node.get("label"),
            instance=instance,
        )
        _apply_media_bundle(node, bundle)

    # Label-based coords for place nodes without ORM rows (e.g. label-only stubs).
    for node in nodes.values():
        if node.get("lat") is not None and node.get("long") is not None:
            continue
        key = _normalize_place_key(node.get("label"))
        if key in _KNOWN_PLACE_COORDS:
            lat, lng = _KNOWN_PLACE_COORDS[key]
            node["lat"], node["long"] = lat, lng

    coord_by_id: dict[str, tuple[str, str]] = {}
    for iri, node in nodes.items():
        lat, lng = node.get("lat"), node.get("long")
        if lat is not None and lng is not None:
            coord_by_id[iri] = (str(lat), str(lng))

    location_edges = [
        edge
        for edge in edges
        if _LOCATION_PRED_RE.search(str(edge.get("predicateLocal") or ""))
        and edge.get("source")
        and edge.get("target")
    ]
    # Iterate to fixpoint so coordinates flow along chained location edges
    # (object → structure → place) regardless of edge ordering.
    changed = True
    while changed:
        changed = False
        for edge in location_edges:
            src, tgt = edge["source"], edge["target"]
            src_coords = coord_by_id.get(src)
            tgt_coords = coord_by_id.get(tgt)
            if src_coords and tgt not in coord_by_id:
                coord_by_id[tgt] = src_coords
                nodes[tgt]["lat"], nodes[tgt]["long"] = src_coords
                changed = True
            elif tgt_coords and src not in coord_by_id:
                coord_by_id[src] = tgt_coords
                nodes[src]["lat"], nodes[src]["long"] = tgt_coords
                changed = True

    enrich_museum_cluster_identity(nodes)
