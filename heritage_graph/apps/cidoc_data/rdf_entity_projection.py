"""
Build RDF triple projections for CIDOC MetaData rows using the LinkML-derived registry.

Each triple is justified by registry metadata (slot_uri / class_uri) and stored fields.
Spec 007 moderated ``relationship.*`` edges live in another predicate namespace,
so they survive slot-based refreshes.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# Generated from ontology/HeritageGraph.yaml (prefixes section).
# To change a namespace: edit the schema, run python3 tools/gen_heritage_viz_config.py.
from apps.graph.ontology_config import RDF_PREFIXES  # noqa: E402

RDF_TYPE_URI = RDF_PREFIXES["rdf"] + "type"
# External-authority identity links use skos:exactMatch rather than owl:sameAs.
# owl:sameAs forces full bidirectional property identity under OWL reasoning
# ("sameAs disease"): a consumer that also loads Wikidata/Getty would conflate
# our entity with the entire external description. skos:exactMatch is the
# cultural-heritage LOD norm for cross-dataset concept equivalence.
EXTERNAL_MATCH_URI = RDF_PREFIXES["skos"] + "exactMatch"

INSERT_PREFIX_LINES = """PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
"""


@dataclass(frozen=True)
class _Triple:
    subj: str
    pred: str
    obj_uri: str | None
    literal: tuple[str, str] | None


def iris_from_external_identifiers(data: dict | None) -> list[str]:
    """
    Harvest http(s) IRIs from EntityCluster.external_identifiers (flat dict).

    Non-LOD values are skipped; RDF only emits well-formed http(s) IRIs.
    """
    if not isinstance(data, dict):
        return []
    out: set[str] = set()
    for v in data.values():
        if isinstance(v, str):
            u = v.strip()
            if u.startswith(("http://", "https://")):
                out.add(u)
    return sorted(out)


def tripleset_from_owl_sameas(
    subject_uri: str, object_iris: list[str]
) -> list[_Triple]:
    return [
        _Triple(subject_uri, EXTERNAL_MATCH_URI, uri, None)
        for uri in sorted(set(object_iris))
    ]


def expand_curie(curie: str) -> str:
    """Expand a CURIE like crm:P3_has_note or return a bare http(s) URI."""
    raw = (curie or "").strip()
    if not raw:
        return raw
    if raw.startswith(("http://", "https://")):
        return raw
    if ":" not in raw:
        return (
            RDF_PREFIXES.get("heritageGraph", "https://w3id.org/heritagegraph/") + raw
        )
    prefix, _, local = raw.partition(":")
    base = RDF_PREFIXES.get(prefix)
    if not base:
        logger.debug("Unknown RDF prefix %r in CURIE %r", prefix, curie)
        return RDF_PREFIXES["heritageGraph"] + local
    return base + local


def _escape_literal_lexical(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _parse_relation_scalar_or_list(raw: Any, *, multivalued: bool) -> list[int | str]:
    if raw is None:
        return []
    if isinstance(raw, bool):
        return []
    if isinstance(raw, int):
        return [raw]
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        if multivalued:
            out: list[int | str] = []
            for part in s.replace(";", ",").split(","):
                p = part.strip()
                if not p:
                    continue
                try:
                    out.append(int(p))
                except ValueError:
                    continue
            return out
        try:
            return [int(s)]
        except ValueError:
            return []
    if isinstance(raw, list):
        parsed: list[int | str] = []
        for item in raw:
            if isinstance(item, dict):
                pid = item.get("id")
                if pid is not None:
                    parsed.append(pid)  # type: ignore[arg-type]
            elif isinstance(item, int):
                parsed.append(item)
            elif isinstance(item, str) and item.strip():
                try:
                    parsed.append(int(item.strip()))
                except ValueError:
                    pass
        return parsed
    return []


def django_field_raw_value(instance: Any, field_key: str) -> Any:
    try:
        f = instance._meta.get_field(field_key)
    except Exception:
        return getattr(instance, field_key, None)

    try:
        if getattr(f, "many_to_many", False):
            if instance.pk is None:
                return []
            return list(getattr(instance, field_key).values_list("pk", flat=True))

        if getattr(f, "is_relation", False) and not getattr(f, "auto_created", False):
            rel = getattr(instance, field_key, None)
            if rel is not None:
                return rel.pk
            return getattr(instance, f"{field_key}_id", None)

        return getattr(instance, field_key, None)
    except Exception:
        return getattr(instance, field_key, None)


def _literal_for_registry_field(ft: str, value: Any) -> tuple[str, str] | None:
    if value is None:
        return None
    if ft == "boolean":
        xsd = RDF_PREFIXES["xsd"]
        if isinstance(value, bool):
            return ("true" if value else "false", xsd + "boolean")
        if isinstance(value, str) and value.lower() in {"true", "false", "1", "0"}:
            norm = value.lower() in {"true", "1"}
            return ("true" if norm else "false", xsd + "boolean")
        return (str(value), xsd + "boolean")
    if ft in ("number", "float"):
        xsd = RDF_PREFIXES["xsd"]
        try:
            if ft == "float":
                fv = float(value)
                sv = repr(fv) if isinstance(fv, float) else str(fv)
                return (sv, xsd + "double")
            iv = int(value)
            return (str(iv), xsd + "integer")
        except (TypeError, ValueError):
            sv = str(value).strip()
            return (sv, xsd + "string") if sv else None
    if ft in ("multiselect",):
        if isinstance(value, list):
            s = "; ".join(str(x) for x in value if str(x).strip())
            return (s, "") if s else None
        s = str(value).strip()
        return (s, "") if s else None

    s = str(value).strip()
    if not s:
        return None

    geo_dt = RDF_PREFIXES["geo"] + "wktLiteral"

    # EWKT from GeoDjango: "SRID=4326;POINT (85 27)" / POLYGON / LINESTRING / …
    ewkt = re.match(r"^SRID=\d+;\s*(.*)$", s, re.DOTALL)
    if ewkt:
        return (ewkt.group(1).strip(), geo_dt)

    # Bare WKT for any geometry type (not just POINT).
    if re.match(
        r"^(POINT|MULTIPOINT|LINESTRING|MULTILINESTRING|POLYGON|MULTIPOLYGON|"
        r"GEOMETRYCOLLECTION)\s*[ZM]*\s*\(",
        s,
        re.IGNORECASE,
    ):
        return (s, geo_dt)

    # Legacy "lon, lat" pair → a WKT POINT.
    coords = s.lstrip("(").rstrip(")").split(",")
    if len(coords) == 2:
        try:
            x_coord, y_coord = float(coords[0].strip()), float(coords[1].strip())
            return (f"POINT({x_coord} {y_coord})", geo_dt)
        except ValueError:
            pass

    return (s, "")


def _wkt_from_point_column(instance: Any) -> str | None:
    """WKT ``POINT(lon lat)`` from the model's ``point`` column, or None.

    The serializers fold the form's latitude/longitude pair into ``point``:
    a ``"<lat>, <lng>"`` CharField (see ``_latlng_to_point_charfield``) or a
    GeoDjango Point (x=lon, y=lat). NOTE the order difference: the CharField is
    lat-first while WKT is lon-first — do not feed the raw column through
    ``_literal_for_registry_field``, whose legacy pair branch assumes lon-first.
    """
    point = getattr(instance, "point", None)
    if point is None:
        return None
    if hasattr(point, "x") and hasattr(point, "y"):
        try:
            return f"POINT({float(point.x)} {float(point.y)})"
        except (TypeError, ValueError):
            return None
    text = str(point).strip()
    if not text:
        return None
    m = re.search(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", text, re.IGNORECASE)
    if m:
        return f"POINT({m.group(1)} {m.group(2)})"
    parts = text.lstrip("(").rstrip(")").split(",")
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0].strip()), float(parts[1].strip())
        except ValueError:
            return None
        if abs(lat) <= 90 and abs(lon) <= 180:
            return f"POINT({lon} {lat})"
    return None


# LinkML class names used as relation ranges vs Django model class names.
LINKML_RELATION_RANGE_TO_MODEL: dict[str, str] = {
    "Place": "Location",
    "HistoricalEvent": "Event",
    "ReligiousTradition": "Tradition",
    "InformationObject": "Source",
}


def _target_model_class(relation_to: str) -> Any:
    from apps.cidoc_data import models as cidoc_models

    model_name = LINKML_RELATION_RANGE_TO_MODEL.get(relation_to, relation_to)
    return getattr(cidoc_models, model_name, None)


def _default_language() -> str:
    """Optional BCP-47 language tag applied to natural-language labels.

    Off by default — set ``RDF_DEFAULT_LANGUAGE`` (e.g. ``"ne"`` or ``"en"``)
    to emit ``rdfs:label`` as a language-tagged literal instead of a plain one.
    """
    from django.conf import settings

    return str(getattr(settings, "RDF_DEFAULT_LANGUAGE", "") or "").strip()


def _label_literal(text: str) -> tuple[str, str]:
    """A label literal, language-tagged when configured, else plain (xsd:string)."""
    lang = _default_language()
    return (text, f"@{lang}") if lang else (text, "")


def _triple_to_line(t: _Triple) -> str:
    sub = f"<{t.subj}>"
    pred = f"<{t.pred}>"
    if t.obj_uri:
        return f"  {sub} {pred} <{t.obj_uri}> ."
    if t.literal:
        lexical, datatype = t.literal
        escaped = _escape_literal_lexical(lexical)
        if datatype.startswith("@"):
            return f'  {sub} {pred} "{escaped}"{datatype} .'
        if not datatype:
            return f'  {sub} {pred} "{escaped}" .'
        geo_wkt = RDF_PREFIXES["geo"] + "wktLiteral"
        if datatype == geo_wkt:
            return f'  {sub} {pred} "{escaped}"^^geo:wktLiteral .'
        xsd_dt = RDF_PREFIXES["xsd"]
        if datatype.startswith(xsd_dt):
            lt = datatype.removeprefix(xsd_dt)
            return f'  {sub} {pred} "{escaped}"^^xsd:{lt} .'
        return f'  {sub} {pred} "{escaped}"^^<{datatype}> .'
    return ""


def build_entity_projection(
    *,
    subject_uri: str,
    label_text: str,
    instance: Any,
    registry_class_entry: dict[str, Any],
    resource_uri_fn,
) -> tuple[list[_Triple], set[str]]:
    """
    Produce RDF triples and the set of predicate IRIs OWNED by CIDOC-slot projection.

    Relationship assertion predicates (007) MUST NOT appear in ``predicates`` —
    callers must not DELETE those when clearing slot projection.
    """
    triples: list[_Triple] = []
    predicates: set[str] = {RDF_PREFIXES["rdfs"] + "label", RDF_TYPE_URI}

    if label_text.strip():
        triples.append(
            _Triple(
                subject_uri,
                RDF_PREFIXES["rdfs"] + "label",
                None,
                _label_literal(label_text),
            )
        )

    curi_class = registry_class_entry.get("classUri")
    if curi_class:
        type_uri = expand_curie(str(curi_class))
        triples.append(_Triple(subject_uri, RDF_TYPE_URI, type_uri, None))

    for field in registry_class_entry.get("fields") or ():
        slot_uri_curie = field.get("slot_uri")
        if not slot_uri_curie:
            continue

        fk = field.get("key")
        ft = field.get("type") or "text"

        if ft in ("media",):
            continue

        slot_uri_full = expand_curie(str(slot_uri_curie))

        raw = django_field_raw_value(instance, fk)
        predicates.add(slot_uri_full)

        if ft == "geo_point":
            # The registry geo slot (e.g. `place_coordinates`) has no matching
            # Django column — coordinates live in the `point` column that the
            # serializers write. Without this, contributed geometry never
            # reaches RDF and SPARQL/LOD consumers see no location at all.
            wkt = None
            if isinstance(raw, str) and re.match(
                r"^(SRID=\d+;)?\s*(POINT|MULTIPOINT|LINESTRING|MULTILINESTRING|"
                r"POLYGON|MULTIPOLYGON|GEOMETRYCOLLECTION)\b",
                raw.strip(),
                re.IGNORECASE,
            ):
                # Explicit (E)WKT only — bare "a, b" pairs are ambiguous
                # (legacy strings are lat-first, WKT is lon-first).
                lit = _literal_for_registry_field("text", raw)
                if lit and lit[1] == RDF_PREFIXES["geo"] + "wktLiteral":
                    wkt = lit[0]
            if not wkt:
                wkt = _wkt_from_point_column(instance)
            if wkt:
                triples.append(
                    _Triple(
                        subject_uri,
                        slot_uri_full,
                        None,
                        (wkt, RDF_PREFIXES["geo"] + "wktLiteral"),
                    )
                )
            continue

        if ft == "relation":
            rel_to = field.get("relationTo") or ""
            multivalued = bool(field.get("multivalued"))
            tgt_model = _target_model_class(str(rel_to)) if rel_to else None

            ids = _parse_relation_scalar_or_list(raw, multivalued=multivalued)
            if not ids or tgt_model is None:
                continue

            for rid in ids:
                try:
                    obj = tgt_model.objects.get(pk=rid)
                except Exception:
                    continue
                obj_uri = resource_uri_fn(obj)
                triples.append(_Triple(subject_uri, slot_uri_full, obj_uri, None))
            continue

        lit = _literal_for_registry_field(str(ft), raw)
        if not lit:
            continue
        triples.append(_Triple(subject_uri, slot_uri_full, None, lit))

    return triples, predicates


def sparql_insert_for_triples(
    triples: list[_Triple], *, graph_uri: str | None = None
) -> str:
    if not triples:
        lines = INSERT_PREFIX_LINES + "INSERT DATA { }\n"
        return lines
    inner_lines = [_triple_to_line(t) for t in triples]
    inner_lines = [ln for ln in inner_lines if ln]
    inner = "\n".join(inner_lines)
    if graph_uri:
        block = f"INSERT DATA {{\n  GRAPH <{graph_uri}> {{\n{inner}\n  }}\n}}\n"
    else:
        block = f"INSERT DATA {{\n{inner}\n}}\n"
    return INSERT_PREFIX_LINES + block


def sparql_delete_subject_predicates(
    subject_uri: str,
    predicates_iris: set[str],
    *,
    graph_uri: str | None = None,
) -> str:
    deletes: list[str] = []
    for pred in sorted(predicates_iris):
        if graph_uri:
            deletes.append(
                f"DELETE WHERE {{ GRAPH <{graph_uri}> {{ "
                f"<{subject_uri}> <{pred}> ?o . }} }};\n"
            )
        else:
            deletes.append(f"DELETE WHERE {{ <{subject_uri}> <{pred}> ?o . }};\n")
    return "".join(deletes)


def tripleset_owl_sameas_for_metadata_instance(
    instance: Any, *, resource_uri_fn
) -> tuple[list[_Triple], set[str]]:
    """
    skos:exactMatch triples from the single active identity cluster's external
    identifiers (see EXTERNAL_MATCH_URI — function name is legacy).
    """
    from apps.cidoc_data import identity_services
    from apps.cidoc_data.models import EntityCluster
    from django.contrib.contenttypes.models import ContentType

    managed: set[str] = {EXTERNAL_MATCH_URI}
    ct = ContentType.objects.get_for_model(instance.__class__, for_concrete_model=False)
    cluster_ids = identity_services.cluster_distinct_ids_for_subject(ct, instance.pk)
    subj_uri = resource_uri_fn(instance)

    # Competing memberships: do not emit sameAs until resolved to one cluster.
    if len(cluster_ids) != 1:
        return tripleset_from_owl_sameas(subj_uri, []), managed

    cluster = (
        EntityCluster.objects.filter(pk=cluster_ids[0], merged_into__isnull=True)
        .only("external_identifiers")
        .first()
    )
    if cluster is None:
        return tripleset_from_owl_sameas(subj_uri, []), managed

    uris = iris_from_external_identifiers(cluster.external_identifiers)
    return tripleset_from_owl_sameas(subj_uri, uris), managed


def tripleset_for_metadata_instance(
    instance: Any, *, resource_uri_fn, label_fn
) -> tuple[list[_Triple], set[str]]:
    """
    Return (triples, managed_predicate_iris) for one MetaData row.

    Used by SPARQL remote updates and by the local Oxigraph fast path.
    """
    from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
    from apps.cidoc_data.linkml_loader import get_effective_registry_payload

    subj_uri = resource_uri_fn(instance)
    label = label_fn(instance)

    label_lit = _label_literal(label)
    triples: list[_Triple] = [
        _Triple(subj_uri, RDF_PREFIXES["rdfs"] + "label", None, label_lit)
    ]
    managed: set[str] = {RDF_PREFIXES["rdfs"] + "label"}

    ck = registry_class_key_for_model(instance.__class__)

    try:
        payload = get_effective_registry_payload()
    except Exception:
        payload = {}

    cls_def = (payload.get("classes") or {}).get(ck) if ck else None
    if cls_def:
        extra, preds = build_entity_projection(
            subject_uri=subj_uri,
            label_text=label,
            instance=instance,
            registry_class_entry=cls_def,
            resource_uri_fn=resource_uri_fn,
        )

        extras_no_dup_label: list[_Triple] = []
        for t in extra:
            if t.pred == RDF_PREFIXES["rdfs"] + "label" and t.literal == label_lit:
                continue
            extras_no_dup_label.append(t)

        triples.extend(extras_no_dup_label)
        managed = preds | managed

    same_triples, same_managed = tripleset_owl_sameas_for_metadata_instance(
        instance,
        resource_uri_fn=resource_uri_fn,
    )
    triples.extend(same_triples)
    managed |= same_managed

    from apps.graph.kg_engine.museum_media import representation_triples_for_instance

    museum_triples, museum_managed = representation_triples_for_instance(
        instance,
        subj_uri,
    )
    for subj, pred, lit in museum_triples:
        if lit is None:
            continue
        if pred == RDF_PREFIXES["rdfs"] + "comment" and any(
            t.pred == pred and t.literal == lit for t in triples
        ):
            continue
        triples.append(_Triple(subj, pred, None, lit))
    managed |= museum_managed

    if not any(t.pred == RDF_TYPE_URI and t.obj_uri for t in triples):
        type_curie = None
        if cls_def:
            type_curie = cls_def.get("classUri")
        if not type_curie:
            type_curie = f"heritageGraph:{instance.__class__.__name__}"
        type_uri = expand_curie(str(type_curie))
        triples.insert(0, _Triple(subj_uri, RDF_TYPE_URI, type_uri, None))
        managed.add(RDF_TYPE_URI)

    return triples, managed


def projection_for_metadata_instance(
    instance: Any, *, resource_uri_fn, label_fn
) -> tuple[str, set[str]]:
    """Return (sparql_update_document, managed_predicate_iris)."""
    triples, managed = tripleset_for_metadata_instance(
        instance, resource_uri_fn=resource_uri_fn, label_fn=label_fn
    )
    return sparql_insert_for_triples(triples), managed


def project_entity_to_rdf(entity) -> tuple[str, set[str]] | None:
    """
    Promote a merged ``CulturalEntity`` into the public RDF graph.

    Uses revision payload when a CIDOC row is referenced; otherwise emits a
    minimal heritageGraph entity resource from the cultural entity fields.
    """
    from apps.heritage_data.models import Revision

    revision = (
        Revision.objects.filter(entity_id=entity.entity_id)
        .order_by("-revision_number")
        .first()
    )
    data = revision.data if revision and isinstance(revision.data, dict) else {}

    model_name = (data.get("_cidoc_model") or "").strip()
    cidoc_id = data.get("_cidoc_id")
    if model_name and cidoc_id is not None:
        try:
            from django.apps import apps

            model = apps.get_model("cidoc_data", model_name)
            instance = model.objects.filter(pk=cidoc_id).first()
            if instance is not None:
                from apps.cidoc_data.rdf_publish import cultural_entity_uri

                uri = cultural_entity_uri(entity.entity_id)
                return projection_for_metadata_instance(
                    instance,
                    resource_uri_fn=lambda _i: uri,
                    label_fn=lambda i: getattr(i, "name", None)
                    or getattr(i, "title", None)
                    or str(entity.entity_id),
                )
        except Exception:
            logger.exception(
                "CIDOC RDF projection failed for cultural entity %s",
                entity.entity_id,
            )

    from apps.cidoc_data.rdf_publish import cultural_entity_uri

    uri = cultural_entity_uri(entity.entity_id)
    label = (entity.name or str(entity.entity_id)).strip()
    type_uri = RDF_PREFIXES.get("heritageGraph", "https://w3id.org/heritagegraph/") + (
        entity.category or "Entity"
    )
    triples = [
        _Triple(uri, RDF_TYPE_URI, type_uri, None),
        _Triple(uri, RDF_PREFIXES["rdfs"] + "label", None, (label, "xsd:string")),
    ]
    if entity.description:
        triples.append(
            _Triple(
                uri,
                RDF_PREFIXES["rdfs"] + "comment",
                None,
                (entity.description[:2000], "xsd:string"),
            )
        )
    return sparql_insert_for_triples(triples), {RDF_TYPE_URI}
