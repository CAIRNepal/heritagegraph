# Phase 3 — Modelling & Assertion Capture

> Covers: Entity contribution forms (DONE), HeritageAssertion capture (DONE), event materialisation (PARTIAL), multi-calendar TimeSpan (TODO).
> Implementation tasks: `IMPLEMENTATION_PLAN.md § 3-A, 3-B`

---

## Feature Spec: Event Materialisation on Field Save

| Field | Value |
|-------|-------|
| Feature | When a contributor sets a date or relationship field, the system materialises the CIDOC event node automatically |
| Status | `[PARTIAL]` — `rdf_signals.py` captures assertions; event node INSERT logic missing |
| Examples | Construction date → `Production` node; deity link → `Enshrinement`; murti activation → `Consecration` |
| Files | `apps/cidoc_data/rdf_signals.py`, `apps/graph/kg_engine/engine.py` (add `materialise_event_node`) |
| Acceptance | After setting `was_produced_by_event` on a Temple, SPARQL `DESCRIBE <temple_uri>` returns a `crm:E12_Production` blank node with `crm:P4_has_time-span` |

---

## Feature Spec: Multi-Calendar TimeSpan

| Field | Value |
|-------|-------|
| Feature | Store dates with calendar system (BS / NS / Gregorian) and precision (year / decade / circa) |
| Status | `[TODO]` |
| Schema | `HeritageGraph.yaml` `TimeSpan` class with `calendar_system`, `date_precision`, `year_offset_from_gregorian` |
| Files | `apps/cidoc_data/timespan.py` (dataclass + RDF emitter), `apps/cidoc_data/models.py` (add `calendar_system`, `date_precision` to `HeritageAssertion`) |
| Frontend | `heritage_graph_ui/src/components/CalendarDatePicker.tsx` |
| Acceptance | Assertion saved as BS 2083 emits `crm:E52_Time-Span` with `hg:calendar_system "bikram_sambat"` and Gregorian equivalent via `year_offset_from_gregorian = -57` |

---

## Process Diagram: Assertion Capture Flow

```mermaid
flowchart TD
    F[Contributor opens entity form\ndriven by ui-classmap.yaml] --> FE[Fill field value\ne.g. architectural_style = Shikhara]

    FE --> SAVE[POST /api/cidoc/assertions/\nasserted_property · asserted_value\nconfidence · source FK]

    SAVE --> VAL{LinkML validation\nrequired fields + ranges}
    VAL -->|invalid| ERR[Return 400 + field errors\nshow inline in form]
    VAL -->|valid| DB[Save HeritageAssertion to DB\nproject named_graph = hg:project/uuid/graph]

    DB --> EVENT{Is this an event-triggering property?}

    EVENT -->|was_produced_by_event\nenshrined_deity\nmakes_deity_present\ncommissioned_by| MAT[materialise_event_node\n in rdf_signals.py\nInsert Production / Enshrinement / Consecration]
    EVENT -->|other property| PLAIN[Direct triple INSERT\nsubject - predicate - value]

    MAT --> PROJ[Write to project named graph\nRDFSyncOutbox INSERT_NT]
    PLAIN --> PROJ

    PROJ --> RECON[Celery: reconcile_async\nGetty AAT + Wikidata lookup\nsave skos:exactMatch back to assertion]

    RECON --> DONE[Assertion committed\nForm shows ✓ with reconciliation badge]

    ERR --> F
```

---

## Sequence: Contribute Temple Entity (Full)

```mermaid
sequenceDiagram
    actor Contributor
    participant UI as Next.js Form
    participant API as Django API
    participant DB
    participant Signal as rdf_signals
    participant Engine as kg_engine
    participant Outbox as RDFSyncOutbox
    participant Worker as Celery
    participant Getty

    Contributor->>UI: Open /contribute/structure
    UI->>API: GET /api/cidoc/schema/structure/
    API-->>UI: field list: name, architectural_style, has_current_location, ...
    UI-->>Contributor: Render form fields

    Contributor->>UI: Fill name, style=Shikhara, date=circa 1427 BS
    Contributor->>UI: Select source: Slusser 1982 archival record
    Contributor->>UI: Set confidence: likely
    Contributor->>UI: Click Save assertion

    UI->>API: POST /api/cidoc/assertions/ with asserted_property, value, source_id, confidence, project_id

    API->>API: LinkML validate required fields and ranges
    API->>DB: HeritageAssertion.objects.create with named_graph for project
    DB-->>Signal: post_save signal fires

    Signal->>Engine: resource_uri_for_instance_from_assertion(assertion)
    Engine-->>Signal: structure URI for bhairabnath-temple

    Signal->>Engine: check if architectural_style is event-triggering — it is not
    Signal->>Outbox: INSERT_NT triple: structure_uri hg:architectural_style hg:Shikhara

    API-->>UI: 201 response with id, asserted_property, reconciliation_status=pending

    Worker->>DB: Pop reconcile_async task
    Worker->>Getty: GET /sparql with label Shikhara type aat
    Getty-->>Worker: aat:300002787 label Shikhara
    Worker->>DB: Set reconciliation_status=reconciled, save exactMatch to outbox
    UI->>UI: Poll status, update badge to reconciled AAT:300002787
```

---

## Wireframe: Temple Contribution Form (`/contribute/structure`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Add Structure                            Project: Bhairabnath 2026 │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Basic Information                                                   │
│  Name *          [Bhairabnath Temple                    ]           │
│  Local name      [भैरबनाथ मन्दिर                        ]           │
│  Existence       [● Extant  ○ Destroyed  ○ Altered]                │
│                                                                      │
│  Classification                                                      │
│  Type *          [Temple ▾]                                         │
│  Architectural   [Shikhara ▾]    ✓ Reconciled: AAT:300002787       │
│  style *                                                             │
│  Syncretic       [Hindu-Buddhist ▾]                                 │
│  tradition                                                           │
│                                                                      │
│  Location *                                                          │
│  [Search or select place...   Taumadhi Tole ×]                     │
│                                                                      │
│  Temporal — Construction                                             │
│  Calendar  [● Gregorian  ○ Bikram Sambat  ○ Nepal Sambat]          │
│  Year      [1427      ]   Precision  [● circa  ○ year  ○ decade]   │
│  ── automatically converted: BS 1484, circa ──                      │
│                                                                      │
│  Associated deity / enshrinement                                     │
│  [Search deity...   Bhairab ×]   [+ Add deity]                     │
│  ⟶ System will create Enshrinement event node automatically         │
│                                                                      │
│  Source *                                                            │
│  [Select source...   Slusser 1982 (archival) ×]                    │
│  Confidence  [● Likely  ○ Confirmed  ○ Speculative]                │
│                                                                      │
│  [Save assertion]                          [Discard]                │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  Saved assertions (8)                                                │
│  ┌──────────────────┬────────────────────┬──────────┬───────────┐  │
│  │ Property         │ Value              │ Conf.    │ Status    │  │
│  ├──────────────────┼────────────────────┼──────────┼───────────┤  │
│  │ name             │ Bhairabnath Temple │ confirmed│ ✓ valid   │  │
│  │ architectural    │ Shikhara           │ likely   │ ✓ recon.  │  │
│  │ has_location     │ Taumadhi Tole      │ confirmed│ ✓ valid   │  │
│  │ construction ~   │ circa 1427 CE      │ likely   │ ✓ valid   │  │
│  │ enshrined_deity  │ Bhairab            │ confirmed│ ✓ event ↗ │  │
│  └──────────────────┴────────────────────┴──────────┴───────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe: CalendarDatePicker Component

```
┌──────────────────────────────────────────────────────┐
│  Date of construction                                 │
│                                                       │
│  Calendar system                                      │
│  [● Gregorian]  [○ Bikram Sambat]  [○ Nepal Sambat]  │
│                                                       │
│  Year     [  1427  ]                                  │
│  Month    [—  (unknown)  ▾]                           │
│  Day      [—  (unknown)  ▾]                           │
│                                                       │
│  Precision                                            │
│  [○ exact year]  [● circa]  [○ decade]  [○ century]  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Stored as:  EDTF "1427~"                       │ │
│  │  Equivalent: BS 1484~ · NS 547~                 │ │
│  │  RDF: crm:E52_Time-Span                         │ │
│  │        hg:calendar_system "gregorian"           │ │
│  │        crm:P82a_begin "1427"^^xsd:gYear         │ │
│  │        hg:date_precision "circa"                │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Process Diagram: Event Node Materialisation

```mermaid
flowchart LR
    A[HeritageAssertion saved\nasserted_property = enshrined_deity\nasserted_value = Bhairab] --> B{property in\nevent_trigger_map?}

    B -->|Yes - enshrined_deity| C[Create Enshrinement event node\nsubject_uri + random UUID]
    B -->|Yes - was_produced_by| D[Create Production event node]
    B -->|Yes - makes_deity_present| E[Create Consecration event node]
    B -->|No| F[Direct triple: subject predicate value]

    C --> C1[INSERT to project named graph:\nhg:enshrinement/uuid a crm:E90_Symbolic_Object\nhg:enshrined_deity hg:deity/bhairab\nhg:enshrined_in_structure hg:structure/bhairabnath]

    D --> D1[INSERT:\nhg:production/uuid a crm:E12_Production\ncrm:P108_has_produced hg:structure/bhairabnath\ncrm:P4_has_time-span hg:timespan/uuid]

    C1 & D1 & E --> G[Write to RDFSyncOutbox\nINSERT_NT operation]
    F --> G
```
