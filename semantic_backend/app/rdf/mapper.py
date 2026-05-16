"""
HeritageGraph ontology-aligned event-centric mappers.

All class and property URIs come from OntologyRegistry (ont.cls / ont.prop),
which reads Heritage.ttl at startup. When the ontology changes, only the
string local-names below need updating — no URIs are hardcoded.

Class→CRM mapping (from Heritage.ttl exact_mappings):
  Temple, ArchitecturalStructure  →  crm:E22_Human-Made_Object
  RitualEvent, Festival           →  crm:E7_Activity
  Deity                           →  crm:E28_Conceptual_Object
  Guthi                           →  crm:E74_Group
  Place                           →  crm:E53_Place
  TransferOfCustody               →  crm:E10_Transfer_of_Custody
  DocumentationActivity           →  crm:E65_Creation
  ConditionAssessment             →  crm:E14_Condition_Assessment
  Production                      →  crm:E12_Production
  Actor                           →  crm:E39_Actor
  TimeSpan                        →  crm:E52_Time-Span
"""
from __future__ import annotations

import uuid
from typing import Any

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import RDF, RDFS, XSD

from app.core.namespaces import bind_prefixes
from app.ontology.registry import ont


# ── URI helpers ──────────────────────────────────────────────────────────────

def _uri(*parts: str) -> URIRef:
    return URIRef("https://heritagegraph.org/" + "/".join(p.strip("/") for p in parts))


def _slug(s: str) -> str:
    return s.lower().replace(" ", "_").replace("/", "_").replace("-", "_")


def _to_date(value: str) -> str:
    """Coerce 'YYYY', 'YYYY-MM', or 'YYYY-MM-DD' → xsd:date ('YYYY-MM-DD')."""
    parts = value.split("-")
    if len(parts) == 1:
        return f"{parts[0]}-01-01"
    if len(parts) == 2:
        return f"{parts[0]}-{parts[1]}-01"
    return value


def _wkt(lat: float | str, lon: float | str) -> str:
    """GeoSPARQL WKT point literal: POINT(lon lat)."""
    return f"POINT({float(lon):.6f} {float(lat):.6f})"


# ── Shared node builders ─────────────────────────────────────────────────────

def _label(g: Graph, subject: URIRef, value: str, lang: str = "ne") -> None:
    """Direct name property + multilingual rdfs:label."""
    g.add((subject, ont.prop("name"),  Literal(value)))
    g.add((subject, RDFS.label,        Literal(value, lang=lang)))


def _timespan(
    g: Graph,
    event_uri: URIRef,
    begin: str | None,
    end:   str | None,
) -> URIRef | None:
    if not begin and not end:
        return None
    ts = _uri("timespan", str(event_uri).rsplit("/", 1)[-1])
    g.add((ts, RDF.type, ont.cls("TimeSpan")))
    if begin:
        g.add((ts, ont.prop("date_earliest"), Literal(_to_date(begin), datatype=XSD.date)))
    if end:
        g.add((ts, ont.prop("date_latest"),   Literal(_to_date(end),   datatype=XSD.date)))
    return ts


def _place(
    g: Graph,
    place_id: str,
    lat: float | str | None = None,
    lon: float | str | None = None,
    name: str | None = None,
    lang: str = "ne",
) -> URIRef:
    place = _uri("place", place_id)
    g.add((place, RDF.type, ont.cls("Place")))
    if name:
        _label(g, place, name, lang)
    if lat is not None and lon is not None:
        g.add((place, ont.prop("place_coordinates"), Literal(_wkt(lat, lon))))
    return place


def _actor(g: Graph, actor_id: str, label: str | None = None) -> URIRef:
    a = _uri("actor", actor_id)
    g.add((a, RDF.type, ont.cls("Actor")))
    if label:
        g.add((a, RDFS.label, Literal(label)))
    return a


# ── Temple ───────────────────────────────────────────────────────────────────

def map_temple(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    """
    Temple → heritageGraph:Temple (subclass of ArchitecturalStructure → HumanMadeObject).
    Construction is expressed via a Production event (was_produced_by_event).
    Current location via has_current_location.
    """
    g   = bind_prefixes(Graph())
    tid = p.get("id") or str(uuid.uuid4())
    uri = _uri("temple", tid)

    g.add((uri, RDF.type, ont.cls("Temple")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    # Architectural style
    if p.get("architectural_style"):
        style = _uri("type", "style", _slug(p["architectural_style"]))
        g.add((style, RDF.type,   ont.cls("ArchitecturalStyleEnum")))
        g.add((style, RDFS.label, Literal(p["architectural_style"])))
        g.add((uri,   ont.prop("has_architectural_style"), style))

    # Current location
    if p.get("place_id"):
        place = _place(
            g, p["place_id"],
            p.get("lat"), p.get("lon"),
            p.get("place_name"), p.get("place_lang", "ne"),
        )
        g.add((uri, ont.prop("has_current_location"), place))

    # Production event (construction)
    begin = p.get("construction_period_begin")
    end   = p.get("construction_period_end")
    if begin or end or p.get("construction_actor_id"):
        prod = _uri("production", tid)
        g.add((prod, RDF.type,                         ont.cls("Production")))
        g.add((prod, ont.prop("produced_object"),       uri))
        g.add((uri,  ont.prop("was_produced_by_event"), prod))

        ts = _timespan(g, prod, begin, end)
        if ts:
            g.add((prod, ont.prop("has_timespan"), ts))

        if p.get("construction_actor_id"):
            actor = _actor(g, p["construction_actor_id"])
            g.add((prod, ont.prop("carried_out_by"), actor))

    # Condition assessment (if inline)
    for assess in p.get("condition_assessments", []):
        ca = map_condition_assessment({**assess, "object_id": tid})
        g += ca[0]
        g.add((uri, ont.prop("has_condition_assessment"), ca[1]))

    return g, uri


# ── ArchitecturalStructure (sub-element of a temple) ─────────────────────────

def map_architectural_structure(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    sid = p.get("id") or str(uuid.uuid4())
    uri = _uri("structure", sid)

    g.add((uri, RDF.type, ont.cls("ArchitecturalStructure")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    if p.get("architectural_style"):
        style = _uri("type", "style", _slug(p["architectural_style"]))
        g.add((style, RDF.type,   ont.cls("ArchitecturalStyleEnum")))
        g.add((style, RDFS.label, Literal(p["architectural_style"])))
        g.add((uri,   ont.prop("has_architectural_style"), style))

    # Link as component of a parent temple
    if p.get("part_of_id"):
        parent = _uri("temple", p["part_of_id"])
        g.add((parent, ont.prop("has_component"), uri))
        g.add((uri,    ont.prop("is_component_of"), parent))

    # Production event
    if p.get("construction_period_begin") or p.get("construction_period_end"):
        prod = _uri("production", sid)
        g.add((prod, RDF.type,                         ont.cls("Production")))
        g.add((prod, ont.prop("produced_object"),       uri))
        g.add((uri,  ont.prop("was_produced_by_event"), prod))
        ts = _timespan(g, prod, p.get("construction_period_begin"), p.get("construction_period_end"))
        if ts:
            g.add((prod, ont.prop("has_timespan"), ts))

    # Materials
    for mat_label in p.get("materials", []):
        mat = _uri("material", _slug(mat_label))
        g.add((mat, RDF.type,   ont.cls("Material")))
        g.add((mat, RDFS.label, Literal(mat_label)))
        g.add((uri, ont.prop("used_materials"), mat))

    return g, uri


# ── RitualEvent ───────────────────────────────────────────────────────────────

def map_ritual(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    rid = p.get("id") or str(uuid.uuid4())
    uri = _uri("ritual", rid)

    g.add((uri, RDF.type, ont.cls("RitualEvent")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    # Ritual type (enum value from RitualTypeEnum)
    if p.get("ritual_type"):
        rt = _uri("type", "ritual", _slug(p["ritual_type"]))
        g.add((rt, RDF.type,   ont.cls("RitualTypeEnum")))
        g.add((rt, RDFS.label, Literal(p["ritual_type"])))
        g.add((uri, ont.prop("ritual_type"), rt))

    ts = _timespan(g, uri, p.get("period_begin"), p.get("period_end"))
    if ts:
        g.add((uri, ont.prop("has_timespan"), ts))

    if p.get("place_id"):
        place = _place(g, p["place_id"], p.get("lat"), p.get("lon"), p.get("place_name"))
        g.add((uri, ont.prop("took_place_at"), place))

    for actor_id in p.get("actor_ids", []):
        g.add((uri, ont.prop("carried_out_by"), _actor(g, actor_id)))

    for actor_id in p.get("participant_ids", []):
        g.add((uri, ont.prop("had_participant"), _actor(g, actor_id)))

    if p.get("festival_id"):
        festival = _uri("festival", p["festival_id"])
        g.add((uri, ont.prop("is_part_of_festival"), festival))

    for deity_id in p.get("deity_ids", []):
        deity = _uri("deity", deity_id)
        g.add((deity, RDF.type, ont.cls("Deity")))
        g.add((uri, ont.prop("invokes_deity"), deity))

    return g, uri


# ── Festival ─────────────────────────────────────────────────────────────────

def map_festival(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    fid = p.get("id") or str(uuid.uuid4())
    uri = _uri("festival", fid)

    g.add((uri, RDF.type, ont.cls("Festival")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    ts = _timespan(g, uri, p.get("period_begin"), p.get("period_end"))
    if ts:
        g.add((uri, ont.prop("has_timespan"), ts))

    if p.get("place_id"):
        place = _place(g, p["place_id"], p.get("lat"), p.get("lon"), p.get("place_name"))
        g.add((uri, ont.prop("took_place_at"), place))

    if p.get("guthi_id"):
        guthi = _uri("guthi", p["guthi_id"])
        g.add((guthi, RDF.type, ont.cls("Guthi")))
        g.add((uri, ont.prop("managed_by_guthi"), guthi))

    for ritual_id in p.get("ritual_ids", []):
        ritual = _uri("ritual", ritual_id)
        g.add((uri, ont.prop("includes_ritual_event"), ritual))

    return g, uri


# ── Deity ─────────────────────────────────────────────────────────────────────

def map_deity(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    did = p.get("id") or str(uuid.uuid4())
    uri = _uri("deity", did)

    g.add((uri, RDF.type, ont.cls("Deity")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    for alias in p.get("aliases", []):
        g.add((uri, RDFS.label, Literal(alias)))

    if p.get("religion"):
        trad = _uri("tradition", _slug(p["religion"]))
        g.add((trad, RDF.type,   ont.cls("ReligiousTradition")))
        g.add((trad, RDFS.label, Literal(p["religion"])))
        g.add((uri,  ont.prop("has_religious_tradition"), trad))

    return g, uri


# ── Guthi ─────────────────────────────────────────────────────────────────────

def map_guthi(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    gid = p.get("id") or str(uuid.uuid4())
    uri = _uri("guthi", gid)

    g.add((uri, RDF.type, ont.cls("Guthi")))
    _label(g, uri, p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    if p.get("guthi_type"):
        gt = _uri("type", "guthi", _slug(p["guthi_type"]))
        g.add((gt, RDF.type,   ont.cls("GuthiTypeEnum")))
        g.add((gt, RDFS.label, Literal(p["guthi_type"])))
        g.add((uri, ont.prop("guthi_type"), gt))

    for member_id in p.get("member_ids", []):
        g.add((uri, ont.prop("has_membership"), _actor(g, member_id)))

    return g, uri


# ── Place ─────────────────────────────────────────────────────────────────────

def map_place(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    pid = p.get("id") or str(uuid.uuid4())
    uri = _place(g, pid, p.get("lat"), p.get("lon"), p["name"], p.get("name_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    if p.get("place_type"):
        g.add((uri, ont.prop("place_type"), Literal(p["place_type"])))

    return g, uri


# ── TransferOfCustody ─────────────────────────────────────────────────────────

def map_custody_event(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    eid = p.get("id") or str(uuid.uuid4())
    uri = _uri("custody_event", eid)

    g.add((uri, RDF.type, ont.cls("TransferOfCustody")))

    ts = _timespan(g, uri, p.get("date"), p.get("date_end"))
    if ts:
        g.add((uri, ont.prop("has_timespan"), ts))

    if p.get("object_id"):
        obj = _uri("temple", p["object_id"])
        g.add((obj, RDF.type, ont.cls("PhysicalHeritageThing")))
        g.add((uri, ont.prop("transferred_object"), obj))

    if p.get("from_actor_id"):
        g.add((uri, ont.prop("transferred_from_actor"), _actor(g, p["from_actor_id"])))

    if p.get("to_actor_id"):
        g.add((uri, ont.prop("transferred_to_actor"), _actor(g, p["to_actor_id"])))

    if p.get("to_guthi_id"):
        guthi = _uri("guthi", p["to_guthi_id"])
        g.add((guthi, RDF.type, ont.cls("Guthi")))
        g.add((uri,   ont.prop("transferred_to_guthi"), guthi))

    if p.get("place_id"):
        place = _place(g, p["place_id"])
        g.add((uri, ont.prop("took_place_at"), place))

    return g, uri


# ── DocumentationActivity ─────────────────────────────────────────────────────

def map_documentation_event(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    eid = p.get("id") or str(uuid.uuid4())
    uri = _uri("documentation", eid)
    info = _uri("document", eid)

    g.add((uri,  RDF.type, ont.cls("DocumentationActivity")))
    g.add((info, RDF.type, ont.cls("InformationObject")))
    g.add((uri,  ont.prop("produced_information_object"), info))

    if p.get("title"):
        _label(g, info, p["title"], p.get("title_lang", "ne"))

    if p.get("note"):
        g.add((uri, ont.prop("note"), Literal(p["note"])))

    ts = _timespan(g, uri, p.get("date"), None)
    if ts:
        g.add((uri, ont.prop("has_timespan"), ts))

    if p.get("actor_id"):
        g.add((uri, ont.prop("carried_out_by"), _actor(g, p["actor_id"])))

    if p.get("source_url"):
        g.add((info, ont.prop("source_url"), Literal(p["source_url"])))

    if p.get("source_citation"):
        g.add((info, ont.prop("source_citation"), Literal(p["source_citation"])))

    for ref_id in p.get("references_ids", []):
        ref = _uri("temple", ref_id)
        g.add((ref, ont.prop("was_documented_by"), uri))

    return g, uri


# ── ConditionAssessment ───────────────────────────────────────────────────────

def map_condition_assessment(p: dict[str, Any]) -> tuple[Graph, URIRef]:
    g   = bind_prefixes(Graph())
    aid = p.get("id") or str(uuid.uuid4())
    uri = _uri("condition", aid)

    g.add((uri, RDF.type, ont.cls("ConditionAssessment")))

    ts = _timespan(g, uri, p.get("date"), None)
    if ts:
        g.add((uri, ont.prop("has_timespan"), ts))

    if p.get("object_id"):
        obj = _uri("temple", p["object_id"])
        g.add((obj, RDF.type, ont.cls("PhysicalHeritageThing")))
        g.add((uri, ont.prop("assessed_object"), obj))

    # ConditionState carries the condition type
    state = _uri("condition_state", aid)
    g.add((state, RDF.type, ont.cls("ConditionState")))
    if p.get("condition"):
        ct = _uri("type", "condition", _slug(p["condition"]))
        g.add((ct, RDF.type,   ont.cls("ConditionTypeEnum")))
        g.add((ct, RDFS.label, Literal(p["condition"])))
        g.add((state, ont.prop("has_condition_type"), ct))
    if p.get("notes"):
        g.add((state, ont.prop("note"), Literal(p["notes"])))
    g.add((uri, ont.prop("assessed_condition_state"), state))

    if p.get("assessor_id"):
        g.add((uri, ont.prop("carried_out_by"), _actor(g, p["assessor_id"])))

    if p.get("confidence"):
        g.add((uri, ont.prop("confidence_score"), Literal(float(p["confidence"]), datatype=XSD.float)))

    return g, uri


# ── Registry ─────────────────────────────────────────────────────────────────

MAPPER_REGISTRY: dict[str, Any] = {
    "temple":                  map_temple,
    "ritual":                  map_ritual,
    "festival":                map_festival,
    "deity":                   map_deity,
    "guthi":                   map_guthi,
    "place":                   map_place,
    "custody_event":           map_custody_event,
    "documentation_event":     map_documentation_event,
    "architectural_structure": map_architectural_structure,
    "condition_assessment":    map_condition_assessment,
}
