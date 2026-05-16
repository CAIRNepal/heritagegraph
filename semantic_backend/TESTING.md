# HeritageGraph Semantic Backend — Step-by-Step Testing Guide

This guide walks through the full system in a single continuous flow.
Every step builds on the previous one. Run commands in order.

The story we build: **Pashupatinath Temple** → its deity, its guthi, its
festival (Maha Shivaratri), its morning puja ritual, its earthquake damage
assessment, a historical custody transfer, and a 3D documentation survey.
By the end, the graph connects all of these and you can query across them.

---

## Step 0 — Start the Services

```bash
cd /path/to/heritagegraph/semantic_backend

# Terminal 1 — Oxigraph (graph database, persists data in data/oxigraph/)
mkdir -p data/oxigraph
./oxigraph serve --location data/oxigraph --bind 0.0.0.0:7878

# Terminal 2 — FastAPI (hot-reload enabled)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Services:**

| Service | URL |
|---|---|
| FastAPI API | http://localhost:8001 |
| Swagger UI (interactive) | http://localhost:8001/docs |
| Oxigraph SPARQL console | http://localhost:7878 |

---

## Step 1 — Verify Everything Is Up

```bash
curl http://localhost:8001/health
```

**Expected:**
```json
{"status": "ok", "oxigraph": true}
```

If `"oxigraph": false` → Oxigraph is not running. Go back to Step 0.

---

## Step 2 — Ingest a Place

A **Place** is a dependency for temples, rituals, and festivals.
We create Deopatan first so later entities can reference it by ID.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "place",
    "payload": {
      "id":         "deopatan",
      "name":       "Deopatan, Kathmandu",
      "lat":        27.7108,
      "lon":        85.3487,
      "place_type": "sacred district",
      "note":       "Ancient sacred area on the banks of the Bagmati river. Home of Pashupatinath."
    },
    "agent_id": "cair_nepal",
    "source":   "field-survey"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 6`

> **What was stored:**
> - `hg:place/deopatan` typed as `heritageGraph:Place`
> - `heritageGraph:name` + `rdfs:label` literals
> - `heritageGraph:place_coordinates` as WKT point `POINT(85.348700 27.710800)`
> - `heritageGraph:note` + `heritageGraph:place_type`

---

## Step 3 — Ingest the Deity

The deity will be linked to the temple and invoked in the ritual.
Create it before the ritual so the URI exists in the graph.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "deity",
    "payload": {
      "id":       "pashupatinath_deity",
      "name":     "Pashupatinath",
      "aliases":  ["Shiva", "Mahadev", "Pashupati", "Lord of Animals"],
      "religion": "Shaivism",
      "note":     "Supreme deity of Nepal. Protector of all living beings."
    },
    "agent_id": "cair_nepal",
    "source":   "field-survey"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 11`

> Aliases become `rdfs:label` triples. Religion creates a `heritageGraph:ReligiousTradition` node.

---

## Step 4 — Ingest the Guthi

A **Guthi** manages the temple and organises the festival.
Create it before the festival references it.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "guthi",
    "payload": {
      "id":         "pashupati_area_dev_trust",
      "name":       "Pashupatinath Area Development Trust",
      "guthi_type": "TempleGuthi",
      "note":       "Government body managing Pashupatinath temple complex since 1987.",
      "member_ids": ["chairman_padt", "secretary_padt", "bhatt_priest_1"]
    },
    "agent_id": "cair_nepal",
    "source":   "institutional-record"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 16`

> `member_ids` creates three `heritageGraph:Actor` nodes each with an `rdfs:label`.
> `guthi_type` creates a `heritageGraph:GuthiTypeEnum` node.

---

## Step 5 — Ingest the Temple

Now create the **Temple**, linking it to the place created in Step 2.
The construction dates are expressed through a `heritageGraph:Production` event.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "temple",
    "payload": {
      "id":                        "pashupatinath",
      "name":                      "Pashupatinath Temple",
      "note":                      "UNESCO World Heritage Site. Principal Shaiva shrine of Nepal.",
      "architectural_style":       "Pagoda",
      "place_id":                  "deopatan",
      "lat":                       27.7108,
      "lon":                       85.3487,
      "place_name":                "Deopatan, Kathmandu",
      "construction_period_begin": "0400",
      "construction_period_end":   "0600",
      "construction_actor_id":     "licchavi_dynasty"
    },
    "agent_id": "cair_nepal",
    "source":   "historical-record"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 21`, `"entity_uri": "https://heritagegraph.org/temple/pashupatinath"`

> The temple now has:
> - type + name + note
> - `heritageGraph:has_architectural_style` → Getty AAT URI for Pagoda
> - `heritageGraph:has_current_location` → `hg:place/deopatan` (with name + WKT)
> - `heritageGraph:was_produced_by_event` → a `heritageGraph:Production` event
> - The Production event has a `heritageGraph:TimeSpan` with `date_earliest: 0400-01-01`

---

## Step 6 — Ingest an Architectural Structure

A **sub-element** of the temple — the iconic two-tiered golden roof.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "architectural_structure",
    "payload": {
      "id":                        "pashupatinath_main_tower",
      "name":                      "Main Pagoda Tower of Pashupatinath",
      "note":                      "Two-tiered pagoda roof covered in gold. Houses the Shivalinga.",
      "architectural_style":       "Pagoda",
      "part_of_id":                "pashupatinath",
      "construction_period_begin": "0400",
      "construction_period_end":   "0600",
      "materials":                 ["stone", "gilded copper", "carved wood", "silver"]
    },
    "agent_id": "cair_nepal",
    "source":   "architectural-survey"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 27`

> `part_of_id` creates `heritageGraph:has_component` (parent → child) and
> `heritageGraph:is_component_of` (child → parent) links.
> Each material becomes a `heritageGraph:Material` node (4 materials = 8 triples).

---

## Step 7 — Ingest the Ritual

The daily **morning puja** at Pashupatinath. Links to the place (Step 2)
and invokes the deity (Step 3).

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "ritual",
    "payload": {
      "id":          "nitya_puja_pashupatinath",
      "name":        "Nitya Puja at Pashupatinath",
      "ritual_type": "NityaPuja",
      "note":        "Daily morning ritual bathing and worship of the Shivalinga. Performed by Bhat priests from South India.",
      "period_begin": "0600",
      "place_id":    "deopatan",
      "actor_ids":   ["bhat_priests"],
      "deity_ids":   ["pashupatinath_deity"],
      "festival_id": "maha_shivaratri"
    },
    "agent_id": "cair_nepal",
    "source":   "field-observation"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 16`

> `festival_id` creates a link `heritageGraph:is_part_of_festival → hg:festival/maha_shivaratri`
> (the festival will be ingested in the next step — forward references are fine in RDF).

---

## Step 8 — Ingest the Festival

**Maha Shivaratri** — the most important festival at Pashupatinath.
References the guthi (Step 4), place (Step 2), and ritual (Step 7).

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "festival",
    "payload": {
      "id":           "maha_shivaratri",
      "name":         "Maha Shivaratri",
      "note":         "Great Night of Shiva. Largest Hindu pilgrimage festival in Nepal. Over 1 million pilgrims attend annually.",
      "period_begin": "0700",
      "place_id":     "deopatan",
      "guthi_id":     "pashupati_area_dev_trust",
      "ritual_ids":   ["nitya_puja_pashupatinath"]
    },
    "agent_id": "cair_nepal",
    "source":   "field-observation"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 10`

> The graph now forms a chain:
> `Festival → includes_ritual_event → Ritual → invokes_deity → Deity`
> `Festival → managed_by_guthi → Guthi`
> `Festival → took_place_at → Place ← has_current_location ← Temple`

---

## Step 9 — Record a Condition Assessment

After the **2015 Gorkha earthquake**, document the temple's damage.
Then record its restoration in 2019.

**Assessment 1 — Damage (April 2015):**
```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "condition_assessment",
    "payload": {
      "id":          "assess_pashupatinath_2015",
      "object_id":   "pashupatinath",
      "date":        "2015-04-25",
      "condition":   "Damaged",
      "notes":       "Minor cracks in the outer boundary walls. Main sanctum and pagoda roof structurally intact. Peripheral shrines collapsed.",
      "assessor_id": "dept_archaeology_nepal",
      "confidence":  0.95
    },
    "agent_id": "cair_nepal",
    "source":   "field-survey"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 16`

**Assessment 2 — Restoration (June 2019):**
```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "condition_assessment",
    "payload": {
      "id":          "assess_pashupatinath_2019",
      "object_id":   "pashupatinath",
      "date":        "2019-06-10",
      "condition":   "Restored",
      "notes":       "Full restoration completed. Peripheral shrines rebuilt with traditional techniques. Gold plating on pagoda roof renewed.",
      "assessor_id": "dept_archaeology_nepal",
      "confidence":  0.98
    },
    "agent_id": "cair_nepal",
    "source":   "restoration-report"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 16`

> Each assessment creates:
> `ConditionAssessment → assessed_object → hg:object/pashupatinath`
> `ConditionAssessment → assessed_condition_state → ConditionState → has_condition_type → Damaged/Restored`

---

## Step 10 — Record a Custody Transfer

Document that a sacred manuscript was transferred from a private family
to the National Archives.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "custody_event",
    "payload": {
      "id":            "custody_ranjana_manuscript_1923",
      "date":          "1923-01-01",
      "date_end":      "1923-12-31",
      "object_id":     "ranjana_manuscript_vol3",
      "from_actor_id": "shrestha_private_family",
      "to_actor_id":   "national_archives_nepal",
      "place_id":      "deopatan"
    },
    "agent_id": "cair_nepal",
    "source":   "archival-record"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 14`

> Custody events use `hg:object/` URIs for the transferred object — not `hg:temple/`.
> Both `date` and `date_end` produce a TimeSpan with two date triples.

---

## Step 11 — Record a Documentation Event

A CAIR-Nepal 3D photogrammetric survey, citing the temple and its structure.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/entity \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "documentation_event",
    "payload": {
      "id":              "doc_survey_pashupatinath_2020",
      "title":           "Photogrammetric Survey of Pashupatinath Temple Complex 2020",
      "note":            "High-resolution 3D point cloud and textured mesh of the entire temple complex.",
      "date":            "2020-03-15",
      "actor_id":        "cair_nepal",
      "source_url":      "https://cair-nepal.org/projects/pashupatinath-3d-2020",
      "source_citation": "CAIR-Nepal (2020). Pashupatinath Photogrammetric Survey. Technical Report.",
      "references_ids":  ["pashupatinath", "pashupatinath_main_tower"]
    },
    "agent_id": "cair_nepal",
    "source":   "cair-nepal.org"
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 16`

> `references_ids` creates `heritageGraph:was_documented_by` links from each entity to this event.
> 2 references + source_url + source_citation + note account for the extra triples.

---

## Step 12 — Batch Ingest (Multiple Entities at Once)

Add three more deities in a single API call.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "entities": [
      {
        "entity_type": "deity",
        "payload": {
          "id":      "ganesh",
          "name":    "Ganesh",
          "aliases": ["Ganapati", "Vinayaka", "Elephant God"],
          "religion":"Hinduism",
          "note":    "God of beginnings and remover of obstacles. Worshipped first in all rituals."
        },
        "agent_id": "cair_nepal", "source": "batch-seed"
      },
      {
        "entity_type": "deity",
        "payload": {
          "id":      "kumari",
          "name":    "Kumari",
          "aliases": ["Living Goddess", "Taleju Bhawani"],
          "religion":"Shakta",
          "note":    "Living goddess incarnated in a prepubescent girl. Worshipped in Kathmandu Valley."
        },
        "agent_id": "cair_nepal", "source": "batch-seed"
      },
      {
        "entity_type": "place",
        "payload": {
          "id":   "kathmandu_durbar_square",
          "name": "Kathmandu Durbar Square",
          "lat":  27.7045,
          "lon":  85.3069,
          "note": "Historical royal palace complex. UNESCO World Heritage Site."
        },
        "agent_id": "cair_nepal", "source": "batch-seed"
      }
    ]
  }' | python3 -m json.tool
```

**Expected:**
```json
{"ingested": 3, "failed": 0, "results": [...], "errors": []}
```

---

## Step 13 — Raw JSON-LD Ingest

Ingest the Swayambhunath stupa directly as JSON-LD, bypassing the entity mapper.
This is useful for importing from external LOD sources.

```bash
curl -s -X POST http://localhost:8001/api/v1/ingest/jsonld \
  -H "Content-Type: application/json" \
  -d '{
    "@context": {
      "heritageGraph": "https://w3id.org/heritagegraph/",
      "hg":            "https://heritagegraph.org/",
      "xsd":           "http://www.w3.org/2001/XMLSchema#"
    },
    "@id":   "hg:temple/swayambhunath",
    "@type": "heritageGraph:Temple",
    "heritageGraph:name": "Swayambhunath",
    "heritageGraph:has_current_location": {
      "@id":   "hg:place/swayambhu_hill",
      "@type": "heritageGraph:Place",
      "heritageGraph:name": "Swayambhu Hill, Kathmandu",
      "heritageGraph:place_coordinates": "POINT(85.290543 27.714924)"
    },
    "heritageGraph:was_produced_by_event": {
      "@id":   "hg:production/swayambhunath",
      "@type": "heritageGraph:Production",
      "heritageGraph:has_timespan": {
        "@id":   "hg:timespan/swayambhunath_production",
        "@type": "heritageGraph:TimeSpan",
        "heritageGraph:date_earliest": {
          "@value": "0460-01-01",
          "@type":  "xsd:date"
        }
      }
    }
  }' | python3 -m json.tool
```

**Expected:** `"triple_count": 8`

> The `@context` is automatically enriched with all 273 terms from Heritage.ttl
> at the server side — you only need to declare the terms you actually use.

---

## Step 14 — Query: List All Temples

Retrieve every temple with its name and coordinates.

```bash
curl -s http://localhost:8001/api/v1/query/temples | python3 -m json.tool
```

**Expected:** 2+ rows — Pashupatinath and Swayambhunath.

---

## Step 15 — Query: Activities at a Place

What rituals and festivals happen at Deopatan?

```bash
curl -s "http://localhost:8001/api/v1/query/activities?place_id=deopatan" \
  | python3 -m json.tool
```

**Expected:** 2 rows — Nitya Puja and Maha Shivaratri.

> This query uses a `UNION` across `heritageGraph:RitualEvent` and
> `heritageGraph:Festival` so it catches both types.

---

## Step 16 — Query: Condition History

What has the condition of Pashupatinath been over time?

```bash
curl -s http://localhost:8001/api/v1/query/conditions/pashupatinath \
  | python3 -m json.tool
```

**Expected:** 2 rows — Damaged (2015) and Restored (2019), ordered most recent first.

---

## Step 17 — Query: Custody Chain

Who has held custody of the Ranjana manuscript?

```bash
curl -s http://localhost:8001/api/v1/query/custody/ranjana_manuscript_vol3 \
  | python3 -m json.tool
```

**Expected:** 1 row — transfer from Shrestha family to National Archives in 1923.

---

## Step 18 — Query: Events in a Time Range

What heritage events occurred between 1900 and 2020?

```bash
curl -s "http://localhost:8001/api/v1/query/events?start=1900&end=2020" \
  | python3 -m json.tool
```

**Expected:** Events matching any entity with `date_earliest` in that range —
the documentation survey (2020), condition assessments (2015, 2019), custody event (1923).

---

## Step 19 — Query: Provenance

Who ingested the Pashupatinath temple data, when, and from what source?

```bash
curl -s http://localhost:8001/api/v1/query/provenance/temple/pashupatinath \
  | python3 -m json.tool
```

**Expected:** 1 row — agent `cair_nepal`, source `historical-record`, timestamp of ingestion.

> Provenance is stored automatically in a separate named graph
> (`hg:graph/prov/<uuid>`) on every ingest.

---

## Step 20 — Query: Guthi Members

Who are the members of the Pashupati Area Development Trust?

```bash
curl -s http://localhost:8001/api/v1/query/guthi/pashupati_area_dev_trust/members \
  | python3 -m json.tool
```

**Expected:** 3 rows — chairman, secretary, and priest actor nodes.

---

## Step 21 — Query: Actor Activities

What activities has CAIR Nepal carried out?

```bash
curl -s http://localhost:8001/api/v1/query/actor/cair_nepal/activities \
  | python3 -m json.tool
```

**Expected:** 1 row — the documentation event from Step 11.

---

## Step 22 — Query: Festival Rituals

What rituals make up Maha Shivaratri?

```bash
curl -s http://localhost:8001/api/v1/query/festival/maha_shivaratri/rituals \
  | python3 -m json.tool
```

**Expected:** 1 row — Nitya Puja at Pashupatinath.

---

## Step 23 — Query: Festival Deities

Which deities are invoked during Maha Shivaratri?

```bash
curl -s http://localhost:8001/api/v1/query/festival/maha_shivaratri/deities \
  | python3 -m json.tool
```

**Expected:** 1 row — Pashupatinath (Shiva).

> This query joins across two named graphs:
> festival graph → `includes_ritual_event` → ritual graph → `invokes_deity` → deity.

---

## Step 24 — Raw SPARQL Query

Use the SPARQL passthrough to write your own query. Find every temple
and its current location coordinates:

```bash
curl -s -X POST http://localhost:8001/api/v1/query/sparql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "PREFIX hg: <https://w3id.org/heritagegraph/> SELECT ?temple ?name ?coords WHERE { GRAPH ?g { ?temple a hg:Temple ; hg:name ?name . OPTIONAL { ?temple hg:has_current_location ?place . ?place hg:place_coordinates ?coords . } } } ORDER BY ?name"
  }' | python3 -m json.tool
```

**Alternatively, use the Oxigraph UI at http://localhost:7878** — paste this into
the SPARQL console and run it interactively.

Count all triples across all named graphs:
```bash
curl -s -X POST http://localhost:7878/sparql \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  --data "SELECT (COUNT(*) AS ?total) WHERE { GRAPH ?g { ?s ?p ?o } }" \
  | python3 -m json.tool
```

List all named graphs (one data + one provenance per ingest):
```bash
curl -s -X POST http://localhost:7878/sparql \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  --data "SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } } ORDER BY ?g" \
  | python3 -m json.tool
```

---

## Step 25 — SHACL Validation (Without Storing)

Validate a payload against the SHACL shapes before committing it.

**Valid payload — should pass:**
```bash
curl -s -X POST http://localhost:8001/api/v1/validate/jsonld \
  -H "Content-Type: application/json" \
  -d '{
    "@context": {
      "heritageGraph": "https://w3id.org/heritagegraph/",
      "hg":            "https://heritagegraph.org/"
    },
    "@id":   "hg:temple/changu_narayan",
    "@type": "heritageGraph:Temple",
    "heritageGraph:name": "Changu Narayan Temple"
  }' | python3 -m json.tool
```

**Expected:** `"valid": true`

**Invalid payload — Temple with no name (violates MinCount shape):**
```bash
curl -s -X POST http://localhost:8001/api/v1/validate/jsonld \
  -H "Content-Type: application/json" \
  -d '{
    "@context": {
      "heritageGraph": "https://w3id.org/heritagegraph/",
      "hg":            "https://heritagegraph.org/"
    },
    "@id":   "hg:temple/unnamed",
    "@type": "heritageGraph:Temple"
  }' | python3 -m json.tool
```

**Expected:** `"valid": false` with a SHACL violation report explaining the missing `heritageGraph:name`.

**Invalid ConditionAssessment — missing assessed_object:**
```bash
curl -s -X POST http://localhost:8001/api/v1/validate/jsonld \
  -H "Content-Type: application/json" \
  -d '{
    "@context": {"heritageGraph": "https://w3id.org/heritagegraph/", "hg": "https://heritagegraph.org/"},
    "@id":   "hg:condition/orphan",
    "@type": "heritageGraph:ConditionAssessment"
  }' | python3 -m json.tool
```

**Expected:** `"valid": false` — `assessed_object` is required.

---

## Step 26 — Validate Raw Turtle

Validate a hand-written Turtle snippet:

```bash
curl -s -X POST http://localhost:8001/api/v1/validate/turtle \
  -H "Content-Type: application/json" \
  -d '{
    "turtle": "@prefix hg: <https://w3id.org/heritagegraph/> . @prefix ex: <https://heritagegraph.org/> . ex:temple/bhimsen a hg:Temple ; hg:name \"Bhimsen Temple\" ."
  }' | python3 -m json.tool
```

**Expected:** `"valid": true`, `"triple_count": 2`

---

## Step 27 — Reload SHACL Shapes

If you edit `shapes/heritage.ttl`, apply the changes without restarting:

```bash
curl -s -X POST http://localhost:8001/api/v1/validate/reload-shapes \
  | python3 -m json.tool
```

**Expected:** `{"message": "SHACL shapes reloaded"}`

---

## Step 28 — What Each Step Built (Full Graph Summary)

After running Steps 2–13, your knowledge graph contains:

| Entity | URI | Connected to |
|---|---|---|
| Place — Deopatan | `hg:place/deopatan` | Temple, Ritual, Festival, Custody |
| Place — KDS | `hg:place/kathmandu_durbar_square` | (ready for future entities) |
| Deity — Pashupatinath | `hg:deity/pashupatinath_deity` | Ritual (invoked by) |
| Deity — Ganesh | `hg:deity/ganesh` | (ready) |
| Deity — Kumari | `hg:deity/kumari` | (ready) |
| Guthi — PADT | `hg:guthi/pashupati_area_dev_trust` | Festival (manages), 3 members |
| Temple | `hg:temple/pashupatinath` | Place, Production, Structure |
| Temple | `hg:temple/swayambhunath` | Place, Production |
| Structure | `hg:structure/pashupatinath_main_tower` | Temple (component of) |
| Ritual | `hg:ritual/nitya_puja_pashupatinath` | Place, Deity, Festival |
| Festival | `hg:festival/maha_shivaratri` | Place, Guthi, Ritual |
| Condition (Damaged) | `hg:condition/assess_pashupatinath_2015` | Object (temple) |
| Condition (Restored) | `hg:condition/assess_pashupatinath_2019` | Object (temple) |
| Custody | `hg:custody_event/custody_ranjana_...` | Object (manuscript), 2 actors |
| Documentation | `hg:documentation/doc_survey_...` | Temple, Structure |

Every ingest also created a PROV-O provenance named graph recording:
who ingested it, when, and from what source.

---

## Enum Reference

| Field | Allowed values |
|---|---|
| `architectural_style` | `Pagoda` `Shikhara` `Dome` `Chaitya` `Stupa` |
| `ritual_type` | `NityaPuja` `Abhisheka` `Homa` `Jatra` `ChariotProcession` `MaskedPerformance` |
| `guthi_type` | `SiGuthi` `JatraGuthi` `PujaGuthi` `TempleGuthi` `NashaGuthi` `SanaGuthi` `SanGuthi` `RajGuthi` |
| `condition` | `Good` `Damaged` `Ruined` `Restored` |

---

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| `"oxigraph": false` on `/health` | Oxigraph not running | `./oxigraph serve --location data/oxigraph --bind 0.0.0.0:7878` |
| `400 Unknown entity type` | Wrong value in `entity_type` | Use one of: `temple` `ritual` `festival` `deity` `guthi` `place` `custody_event` `documentation_event` `architectural_structure` `condition_assessment` |
| `422 SHACL validation failed` | Required field missing | Add `name` to most entities; `object_id` to assessments; `assessed_object` + `assessed_condition_state` are both required |
| `500 Internal Server Error` | Crash in mapper — check uvicorn console | Usually a missing required field or wrong type (e.g. string instead of number for `lat`) |
| `0 rows` from query | Entity not yet ingested, or wrong ID in URL | Verify the `id` in the payload matches the ID segment in the URL |
| `KeyError` in ontology registry | Class/property name in mapper doesn't match Heritage.ttl | Run `/validate/reload-shapes` and check the class list in registry startup logs |
