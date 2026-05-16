"""
Pre-built SPARQL query templates aligned with the Heritage.ttl ontology
(namespace https://w3id.org/heritagegraph/).

All class and property local names reference Heritage.ttl terms.  The
OntologyRegistry provides the PREFIX declaration at runtime so queries stay
valid even if the namespace URI changes.
"""
from app.ontology.registry import ont


def _base_prefixes() -> str:
    return f"""\
{ont.sparql_prefix}
PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:     <http://www.w3.org/2001/XMLSchema#>
PREFIX prov:    <http://www.w3.org/ns/prov#>
PREFIX hg:      <https://heritagegraph.org/>
"""


# ── Temples with current location ────────────────────────────────────────────

def TEMPLES_WITH_LOCATION() -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?temple ?name ?coordinates
WHERE {{
  GRAPH ?g {{
    ?temple a {p}:Temple ;
            {p}:name ?name .
    OPTIONAL {{
      ?temple {p}:has_current_location ?place .
      ?place  {p}:place_coordinates ?coordinates .
    }}
  }}
}}
ORDER BY ?name
"""


# ── Activities (rituals / festivals) at a place ───────────────────────────────

def ACTIVITIES_AT_PLACE(place_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?activity ?type ?name ?begin ?end
WHERE {{
  GRAPH ?g {{
    {{ ?activity a {p}:RitualEvent . BIND({p}:RitualEvent AS ?type) }}
    UNION
    {{ ?activity a {p}:Festival .    BIND({p}:Festival    AS ?type) }}
    ?activity {p}:took_place_at <{place_uri}> ;
              {p}:name ?name .
    OPTIONAL {{
      ?activity {p}:has_timespan ?ts .
      OPTIONAL {{ ?ts {p}:date_earliest ?begin . }}
      OPTIONAL {{ ?ts {p}:date_latest   ?end   . }}
    }}
  }}
}}
ORDER BY ?begin
"""


# ── Custody chain for a movable object ───────────────────────────────────────

def CUSTODY_CHAIN(object_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?event ?toActor ?toActorLabel ?date
WHERE {{
  GRAPH ?g {{
    ?event a {p}:TransferOfCustody ;
           {p}:transferred_object <{object_uri}> .
    OPTIONAL {{
      ?event {p}:transferred_to_actor ?toActor .
      OPTIONAL {{ ?toActor rdfs:label ?toActorLabel . }}
    }}
    OPTIONAL {{
      ?event {p}:has_timespan ?ts .
      ?ts {p}:date_earliest ?date .
    }}
  }}
}}
ORDER BY ?date
"""


# ── All events within a time range (xsd:date) ────────────────────────────────

def EVENTS_IN_TIMERANGE(start: str, end: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?event ?type ?name ?begin
WHERE {{
  GRAPH ?g {{
    ?event {p}:has_timespan ?ts .
    ?ts    {p}:date_earliest ?begin .
    FILTER (?begin >= "{start}-01-01"^^xsd:date
         && ?begin <= "{end}-12-31"^^xsd:date)
    ?event a ?type .
    OPTIONAL {{ ?event {p}:name ?name . }}
  }}
}}
ORDER BY ?begin
"""


# ── PROV-O provenance for any entity ─────────────────────────────────────────

def PROVENANCE_FOR_ENTITY(entity_uri: str) -> str:
    return _base_prefixes() + f"""
SELECT ?graph ?activity ?agent ?generated ?source
WHERE {{
  GRAPH ?prov_g {{
    ?graph prov:wasGeneratedBy  ?activity ;
           prov:wasAttributedTo ?agent ;
           prov:generatedAtTime ?generated .
    OPTIONAL {{ ?graph prov:wasDerivedFrom ?source . }}
  }}
  FILTER EXISTS {{
    GRAPH ?graph {{ <{entity_uri}> ?p ?o . }}
  }}
}}
ORDER BY ?generated
"""


# ── Condition history for a temple / object ───────────────────────────────────

def CONDITION_HISTORY(object_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?assessment ?conditionState ?date ?notes
WHERE {{
  GRAPH ?g {{
    ?assessment a {p}:ConditionAssessment ;
                {p}:assessed_object <{object_uri}> .
    OPTIONAL {{ ?assessment {p}:assessed_condition_state ?conditionState . }}
    OPTIONAL {{ ?assessment rdfs:comment ?notes . }}
    OPTIONAL {{
      ?assessment {p}:has_timespan ?ts .
      ?ts {p}:date_earliest ?date .
    }}
  }}
}}
ORDER BY DESC(?date)
"""


# ── Members of a Guthi ────────────────────────────────────────────────────────

def GUTHI_MEMBERS(guthi_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?member ?memberLabel
WHERE {{
  GRAPH ?g {{
    <{guthi_uri}> {p}:has_membership ?member .
    OPTIONAL {{ ?member rdfs:label ?memberLabel . }}
  }}
}}
"""


# ── Activities an actor carried out ──────────────────────────────────────────

def ACTOR_ACTIVITIES(actor_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?activity ?type ?name ?begin
WHERE {{
  GRAPH ?g {{
    ?activity {p}:carried_out_by <{actor_uri}> .
    ?activity a ?type .
    OPTIONAL {{ ?activity {p}:name ?name . }}
    OPTIONAL {{
      ?activity {p}:has_timespan ?ts .
      ?ts {p}:date_earliest ?begin .
    }}
  }}
}}
ORDER BY ?begin
"""


# ── Rituals within a festival ─────────────────────────────────────────────────

def FESTIVAL_RITUALS(festival_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT ?ritual ?name ?ritualType ?begin
WHERE {{
  GRAPH ?gf {{ <{festival_uri}> {p}:includes_ritual_event ?ritual . }}
  OPTIONAL {{ GRAPH ?gr {{ ?ritual {p}:name ?name . }} }}
  OPTIONAL {{ GRAPH ?gr2 {{ ?ritual {p}:ritual_type ?ritualType . }} }}
  OPTIONAL {{
    GRAPH ?gr3 {{
      ?ritual {p}:has_timespan ?ts .
      ?ts {p}:date_earliest ?begin .
    }}
  }}
}}
ORDER BY ?begin
"""


# ── Deities invoked by a festival's rituals ───────────────────────────────────

def FESTIVAL_DEITIES(festival_uri: str) -> str:
    p = ont.prefix_name
    return _base_prefixes() + f"""
SELECT DISTINCT ?deity ?deityName
WHERE {{
  GRAPH ?gf {{ <{festival_uri}> {p}:includes_ritual_event ?ritual . }}
  GRAPH ?gr {{ ?ritual {p}:invokes_deity ?deity . }}
  OPTIONAL {{ GRAPH ?gd {{ ?deity {p}:name ?deityName . }} }}
}}
"""
