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
from apps.cidoc_data.identity_services import _active_membership_qs
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
    """A record's own coordinates, else its name in the gazetteer table."""
    own = recorded_coords(instance)
    if own:
        return own
    label = getattr(instance, "name", None) or getattr(instance, "title", None)
    return _KNOWN_PLACE_COORDS.get(_normalize_place_key(str(label) if label else ""))


def recorded_coords(instance: Any) -> tuple[str, str] | None:
    """Coordinates stored on the record itself (point or legacy fields)."""
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


def _load_instances(keys: list[tuple[str, int]]) -> dict[tuple[str, int], Any]:
    """All rows for (registry segment, pk) pairs, one query per model."""
    from django.apps import apps

    by_segment: dict[str, set[int]] = {}
    for segment, pk in keys:
        by_segment.setdefault(segment, set()).add(pk)
    out: dict[tuple[str, int], Any] = {}
    for segment, pks in by_segment.items():
        model_name = _REGISTRY_KEY_TO_MODEL.get(segment)
        if not model_name:
            continue
        try:
            model = apps.get_model("cidoc_data", model_name)
            qs = model.objects.filter(pk__in=pks)
            if any(f.name == "source" for f in model._meta.get_fields()):
                qs = qs.select_related("source")
            for row in qs:
                out[(segment, row.pk)] = row
        except Exception:
            continue
    return out


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


def enrich_museum_cluster_identity(
    nodes: dict[str, dict[str, Any]],
    instances: dict[tuple[str, int], Any] | None = None,
) -> None:
    """Attach clusterId / clusterLabel for museum UI deduplication.

    Memberships come from one query rather than one per node, and a cluster
    with a single member is its own canonical record without ranking: with
    every authority import in a singleton cluster, per-node lookups made this
    the slowest step of the graph endpoint.
    """
    keys = {iri: parse_resource_uri(n.get("id")) for iri, n in nodes.items()}
    if instances is None:
        instances = _load_instances([k for k in keys.values() if k])
    subject_iri: dict[tuple[int, Any], str] = {}
    for iri, key in keys.items():
        instance = instances.get(key) if key else None
        if instance is None:
            continue
        ct = ContentType.objects.get_for_model(instance.__class__, for_concrete_model=False)
        subject_iri[(ct.id, str(instance.pk))] = iri

    first_membership: dict[str, Any] = {}
    members_per_cluster: dict[Any, int] = {}
    for mem in _active_membership_qs().select_related(
        "entity_cluster", "entity_cluster__merged_into"
    ):
        members_per_cluster[mem.entity_cluster_id] = members_per_cluster.get(mem.entity_cluster_id, 0) + 1
        iri = subject_iri.get((mem.content_type_id, str(mem.object_id)))
        if iri and iri not in first_membership:
            first_membership[iri] = mem

    from apps.cidoc_data.canonical_record_selection import (
        _load_member_instance,
        select_canonical_member,
    )
    from apps.cidoc_data.rdf_publish import resource_uri_for_instance

    for iri, mem in first_membership.items():
        node = nodes[iri]
        cluster = _resolve_cluster(mem.entity_cluster)
        node["clusterId"] = str(cluster.id)
        node["clusterLabel"] = cluster.canonical_label
        node["typeScope"] = cluster.type_scope
        if cluster.id == mem.entity_cluster_id and members_per_cluster.get(cluster.id) == 1:
            node["canonicalMemberId"] = iri
            continue
        canonical = select_canonical_member(cluster)
        if canonical and canonical.get("entity_id") is not None:
            ct_canon = ContentType.objects.get(model=canonical["entity_type"])
            canon_obj = _load_member_instance(ct_canon, int(canonical["entity_id"]))
            if canon_obj is not None:
                node["canonicalMemberId"] = resource_uri_for_instance(canon_obj)


def record_source(instance: Any) -> dict[str, Any] | None:
    """Where a record's own content came from, for the "Sources" line on a page.

    Edges carry provenance per assertion; the record itself only has its
    MetaData evidence fields, which are not projected to RDF.
    """
    source = getattr(instance, "source", None) if getattr(instance, "source_id", None) else None
    citation = (getattr(instance, "source_citation", "") or "").strip()
    if source is None and not citation:
        return None
    return {
        "name": getattr(source, "name", None),
        "url": getattr(source, "url", None) or None,
        "citation": citation or None,
        "contributor": getattr(instance, "contributor", None) or None,
        "status": getattr(instance, "status", None) or None,
    }


def enrich_museum_graph_nodes(
    nodes: dict[str, dict[str, Any]],
    edges: list[dict[str, Any]],
) -> None:
    """Mutate *nodes* in place: ORM geo/temporal/narrative/media + coordinate propagation."""
    from apps.graph.kg_engine.museum_media import media_bundle_for_resource

    keys = [k for k in (parse_resource_uri(n.get("id")) for n in nodes.values()) if k]
    instances = _load_instances(keys)
    # Where each point comes from. Only "record" is the record's own location;
    # the reader is told when a point is a gazetteer guess or borrowed.
    for node in nodes.values():
        if node.get("lat") is not None and node.get("long") is not None:
            node["coordinateSource"] = "record"
    for node in nodes.values():
        parsed = parse_resource_uri(node.get("id"))
        if not parsed:
            continue
        segment, pk = parsed
        instance = instances.get(parsed)
        if instance is not None:
            if node.get("lat") is None or node.get("long") is None:
                own = recorded_coords(instance)
                if own:
                    node["lat"], node["long"] = own
                    node["coordinateSource"] = "record"
            if not node.get("inceptionYear"):
                hint = temporal_hint_from_instance(instance)
                if hint:
                    node["inceptionYear"] = hint
            node["recordSource"] = record_source(instance)

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
            node["coordinateSource"] = "gazetteer"

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
    # A record with no location of its own may borrow the point of what
    # contains it (object -> structure -> place), iterated to a fixpoint along
    # chains. Only that way round: a district must not take a temple's point.
    # Borrowed points are marked, so they are never shown as the record's own.
    changed = True
    while changed:
        changed = False
        for edge in location_edges:
            src, tgt = edge["source"], edge["target"]
            tgt_coords = coord_by_id.get(tgt)
            if tgt_coords and src not in coord_by_id:
                coord_by_id[src] = tgt_coords
                nodes[src]["lat"], nodes[src]["long"] = tgt_coords
                nodes[src]["coordinateSource"] = "inherited"
                nodes[src]["coordinateFrom"] = tgt
                changed = True

    enrich_museum_cluster_identity(nodes, instances)
