# ONTOLOGY.md — HeritageGraph Ontology & Form System Guide

> **Audience:** Developers, researchers, and AI agents who need to understand, modify, or extend the ontology-driven form system in HeritageGraph.  
> **Last Updated:** June 2026 — **Ontology v1.0.0** (event-centric, CIDOC-CRM + PROV-O). **UI registry is generated** from LinkML + `tools/ui-classmap.yaml` + `tools/contribute-hub.yaml` + **`tools/semantic-patterns.yaml`** (semantic workflows; see `registry.generated.*`). Step-by-step form tasks: [`../contribution/FORMS.md`](../contribution/FORMS.md). Registry workflow: this guide §7 and [`../developer/CONVENTIONS.md`](../developer/CONVENTIONS.md).

---

## Table of Contents

1. [Overview — How It All Connects](#1-overview--how-it-all-connects)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Source of Truth Files](#3-source-of-truth-files)
4. [Ontology → Frontend Mapping](#4-ontology--frontend-mapping)
5. [Registered Entity Types](#5-registered-entity-types)
6. [Controlled Vocabularies (Enums)](#6-controlled-vocabularies-enums)
7. [How to Make Changes](#7-how-to-make-changes)
   - [7.1 Add a Field to an Existing Entity](#71-add-a-field-to-an-existing-entity)
   - [7.2 Add a New Enum (Dropdown)](#72-add-a-new-enum-dropdown)
   - [7.3 Add a New Entity Type](#73-add-a-new-entity-type)
   - [7.4 Add a Relation Field (Entity Linking)](#74-add-a-relation-field-entity-linking)
   - [7.5 Add a New Form Section](#75-add-a-new-form-section)
   - [7.6 Add to the Contribute Dashboard](#76-add-to-the-contribute-dashboard)
8. [Field Type Reference](#8-field-type-reference)
9. [OntologyClass Interface](#9-ontologyclass-interface)
10. [OntologyField Interface](#10-ontologyfield-interface)
11. [Ontology ↔ Backend Model Alignment](#11-ontology--backend-model-alignment)
12. [Data Flow: Form → API → Database](#12-data-flow-form--api--database)
13. [CIDOC-CRM Alignment Reference](#13-cidoc-crm-alignment-reference)
14. [PROV-O Provenance Layer](#14-prov-o-provenance-layer)
15. [Troubleshooting & Common Mistakes](#15-troubleshooting--common-mistakes)
16. [File Map](#16-file-map)

---

## 1. Overview — How It All Connects

HeritageGraph uses a **YAML-driven, registry-based UI**: LinkML (`ontology/HeritageGraph.yaml`) plus **`tools/ui-classmap.yaml`** (and optional **`tools/ui-presentation.yaml`**, **`tools/contribute-hub.yaml`**, **`tools/semantic-patterns.yaml`**) materialize a JSON registry consumed by the Next.js app. Committed **`registry.generated.json`** / **`.ts`** provide an offline baseline; signed-in clients can refresh from **`GET /api/v1/cidoc/schema/registry/`** (payload includes **`contribute_hub`**, **`semantic_patterns`**, **`registry_jsonschema`**, plus **classes** / **enums**).

```
ontology/HeritageGraph.yaml (LinkML)   ← Canonical ontology (classes, slots, enums)
        │
        ├── tools/ui-classmap.yaml     ← Registry keys, labels, apiEndpoint, nav
        ├── tools/ui-presentation.yaml ← Optional slot-level UI overrides
        ├── tools/contribute-hub.yaml  ← Contribute landing intents
        ├── tools/semantic-patterns.yaml ← Guided semantic workflows (`semantic_patterns` in API)
        ▼
tools/linkml_generate_registry.py  +  heritage_graph ... ontology_builder.py
        │
        ├── registry.generated.json / .ts   ← Snapshot (commit after make ontology)
        └── Django SchemaRegistry + schema API (optional DB cache)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (heritage_graph_ui/src/lib/ontology/)                 │
│                                                                 │
│  types.ts, OntologyProvider, OntologyForm, tables, detail views │
│  Payload may include registry_jsonschema for validation hints   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼  (POST/GET via Bearer token)
┌─────────────────────────────────────────────────────────────────┐
│  Backend — cidoc_data, heritage_data, …                         │
│                                                                 │
│  models.py       → Django models (field keys must match registry)│
│  serializers.py  → DRF serializers                               │
│  urls.py         → Routes must match each class’s apiEndpoint   │
└─────────────────────────────────────────────────────────────────┘
```

**Golden rule:** Each registry field **`key`** must match the Django model field name for that entity type, and **`apiEndpoint`** must match the registered URL (CIDOC under `cidoc_data/urls.py`; cultural entities under `heritage_data`).

**Do not** add a second ontology file at the repo root named `Heritagegraph.yaml` — CI **`make ontology-check`** rejects it.

---

## 2. Architecture Diagram

```
                    ┌──────────────────────────────┐
                    │  ontology/HeritageGraph.yaml  │
                    │  LinkML + classmap + hub +    │
                    │   semantic_patterns.yaml      │
                    └───────────┬───────────────────┘
                                │
                    ┌───────────▼───────────────────┐
                    │  registry.generated.* + API    │
                    │  (classes, enums, jsonschema,  │
                    │   contribute_hub, semantic_patterns) │
                    └───────────┬───────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                      │
   ┌──────▼──────┐    ┌────────▼────────┐    ┌────────▼────────┐
   │  OntologyProvider │  OntologyForm   │    │  Django models  │
   │  + types.ts      │  tables / views │    │  cidoc + heritage│
   └──────────────────┴────────┬────────┘    └────────┬────────┘
                               │                      │
                    ┌──────────▼──────────┐    ┌──────▼──────────┐
                    │  Next.js (dashboard)│    │  DRF API        │
                    │  route group       │    │  /cidoc/, /data/│
                    └─────────────────────┘    └─────────────────┘
```

---

## 3. Source of Truth Files

| File | Location | Purpose |
|------|----------|---------|
| **HeritageGraph.yaml** | `ontology/HeritageGraph.yaml` | Canonical LinkML — classes, slots, enums, URIs |
| **ui-classmap.yaml** | `tools/ui-classmap.yaml` | Maps each exposed LinkML class → registry `key`, `apiEndpoint`, labels |
| **ui-presentation.yaml** | `tools/ui-presentation.yaml` | Optional per-slot UI overrides (`ui_section`, `ui_widget`, …) |
| **contribute-hub.yaml** | `tools/contribute-hub.yaml` | Contribute landing intents and copy |
| **semantic-patterns.yaml** | `tools/semantic-patterns.yaml` | Guided multi-step workflows; merged as `semantic_patterns` on registry API |
| **registry.generated.*** | `heritage_graph_ui/src/lib/ontology/` | **Generated** registry + `registry_jsonschema` + embedded hub/patterns snapshot — run `make ontology` |
| **minimal SHACL (generated)** | `ontology/shapes/generated-heritagegraph-minimal-shacl.ttl` | Optional QA shapes — run `python3 tools/emit_minimal_shacl.py` after registry regen |
| **HeritageGraph.ttl** | `ontology/HeritageGraph.ttl` | OWL/Turtle TBox for linked-data consumers; generated by `make owl-ttl` |
| **types.ts** | `heritage_graph_ui/src/lib/ontology/types.ts` | TypeScript interfaces for registry payloads (`SemanticPattern`, hub rows, …) |

### Relationship between ontology YAML and the registry

| HeritageGraph.yaml concept | Registry / UI |
|---|---|
| `classes:` / induced slots | `OntologyClass.fields[]` from generator |
| `enums:` | `enums` map + inlined `options` on `select` fields |
| `class_uri` | `classUri` on `OntologyClass` |
| `slot_usage` (required, cardinality) | `required`, `minimumCardinality`, `maximumCardinality` on `OntologyField` |
| LinkML class range | `type: "relation"`, `relationEndpoint` from classmap |

---

## 4. Ontology → Frontend Mapping

When translating from `HeritageGraph.yaml` to the frontend registry, follow these rules:

| YAML construct | Frontend mapping | Notes |
|---|---|---|
| `ArchitecturalStructure` class | `OntologyClass` with `key: "structure"` | From `ontology_builder.py` + `ui-classmap.yaml` |
| `name` slot with `slot_uri: rdfs:label` | Label field on the form | Slot key matches Django field name |
| `note` slot with `slot_uri: crm:P3_has_note` | Text / textarea field | Same |
| `has_current_location` slot with `range: Place` | `type: "relation"`, `relationTo: "location"` | `relationEndpoint` from classmap |
| `ArchitecturalStyle` enum | `type: "select"` with inlined `options` + entry in `registry.enums` | Define enum in LinkML `enums:` |
| `multivalued: true` in YAML | `multivalued: true` on `OntologyField` | Multiselect / multi-relation as configured |
| `required: true` in `slot_usage` | `required: true` (and cardinality) on `OntologyField` | Also `minimumCardinality` / `maximumCardinality` when set |

---

## 5. Registered entity types

The exposed class list, registry keys, and API paths are defined in **`tools/ui-classmap.yaml`** (materialized into `registry.generated.*` by `make ontology`). Django model ↔ registry key mapping lives in **`heritage_graph/apps/cidoc_data/cidoc_registry_keys.py`**.

### 5.1 CulturalEntity (heritage_data workflow)

`CulturalEntity` is the high-level contribution umbrella for monuments, festivals, rituals, traditions, and artifacts reviewed via **`heritage_data`** (`/data/api/cultural-entities/`). It is **not** a CIDOC subclass form — contributors pick a domain category from **`CulturalEntityCategory`** (`monument`, `artifact`, `ritual`, `festival`, `tradition`, `document`, `other`) before entering the review workflow. Typed CIDOC records (structures, festivals, productions, etc.) are separate registry entries under **`cidoc_data`**.

### 5.2 Navigable (sidebar, knowledge tables, contribute forms)

| Registry Key | Label | Category | LinkML Class | Django Model | API Endpoint |
|---|---|---|---|---|---|
| `entity` | Cultural Entity | tangible | `CulturalEntity` | `CulturalEntity` | `/data/api/cultural-entities/` |
| `person` | Historical Person | social | `Person` | `Person` | `/cidoc/persons/` |
| `location` | Place / Location | spatiotemporal | `Place` | `Location` | `/cidoc/locations/` |
| `event` | Historical Event | event | `HistoricalEvent` | `Event` | `/cidoc/events/` |
| `period` | Historical Period | spatiotemporal | `HistoricalPeriod` | `HistoricalPeriod` | `/cidoc/historical_periods/` |
| `tradition` | Tradition | conceptual | `ReligiousTradition` | `Tradition` | `/cidoc/traditions/` |
| `source` | Source / Document | provenance | `InformationObject` | `Source` | `/cidoc/sources/` |
| `deity` | Deity | conceptual | `Deity` | `Deity` | `/cidoc/deities/` |
| `guthi` | Guthi | social | `Guthi` | `Guthi` | `/cidoc/guthis/` |
| `structure` | Architectural Structure | tangible | `ArchitecturalStructure` | `ArchitecturalStructure` | `/cidoc/structures/` |
| `iconography` | Iconographic Object | tangible | `IconographicObject` | `IconographicObject` | `/cidoc/iconographic_objects/` |
| `monument` | Monument | tangible | `BuddhistMonument` | `Monument` | `/cidoc/monuments/` |
| `ritual` | Ritual Event | event | `RitualEvent` | `RitualEvent` | `/cidoc/rituals/` |
| `festival` | Festival | event | `Festival` | `Festival` | `/cidoc/festivals/` |
| `production` | Production Event | event | `Production` | `Production` | `/cidoc/productions/` |
| `consecration` | Consecration | event | `Consecration` | `Consecration` | `/cidoc/consecrations/` |
| `enshrinement` | Enshrinement | event | `Enshrinement` | `Enshrinement` | `/cidoc/enshrinements/` |
| `transfer_of_custody` | Transfer of Custody | event | `TransferOfCustody` | `TransferOfCustody` | `/cidoc/transfers_of_custody/` |
| `calendar` | Calendar System | spatiotemporal | `CalendarSystem` | `CalendarSystem` | `/cidoc/calendar_systems/` |
| `syncretism` | Syncretic Relationship | conceptual | `SyncreticRelationship` | `SyncreticRelationship` | `/cidoc/syncretic_relationships/` |
| `kumari_tenure` | Kumari Tenure | kumari | `LivingGoddessTenure` | `KumariTenure` | `/cidoc/kumari_tenures/` |
| `kumari_selection` | Kumari Selection | kumari | `LivingGoddessSelection` | `KumariSelection` | `/cidoc/kumari_selections/` |
| `kumari_retirement` | Kumari Retirement | kumari | `LivingGoddessRetirement` | `KumariRetirement` | `/cidoc/kumari_retirements/` |
| `caste_group` | Caste Group | social | `CasteGroup` | `CasteGroup` | `/cidoc/caste_groups/` |
| `assertion` | Heritage Assertion | provenance | `HeritageAssertion` | `HeritageAssertion` | `/cidoc/assertions/` |
| `entity_cluster` | Entity Cluster | provenance | `EntityCluster` | `EntityCluster` | `/cidoc/entity-clusters/` |

### 5.3 Non-navigable registry entries

| Registry Key | Label | LinkML Class | Django Model | API Endpoint | Purpose |
|---|---|---|---|---|---|
| `data_source` | Data Source | `DataSource` | `DataSource` | `/cidoc/data_sources/` | Structured provenance catalog (relation target; no contribute route) |

### 5.4 LinkML-only classes (no registry / no forms)

These exist in **`ontology/HeritageGraph.yaml`** for relation ranges, RDF projection, or external interop. They are **absent from `tools/ui-classmap.yaml`**, so no contribute or knowledge routes are generated.

| Group | Examples | Role |
|---|---|---|
| Relation targets | `Material`, `Technique`, `TimeSpan`, `ConditionAssessment` | Slots on production, structure, and event forms |
| Documentation (unexposed) | `DocumentationActivity` | Defined in LinkML; no ViewSet in `cidoc_data/urls.py` yet |
| CIDOC / LinkedArt interop | `Acquisition`, `Birth`, `Death`, `CuratedHolding`, `DigitalObject`, `Inscription`, `Move`, `Modification`, … | Yale **LUX** crosswalk scaffolding (`la:` prefix); typed RDF import only |

The interop block starts at the “CIDOC-CRM / LinkedArt interop scaffolding” comment in `HeritageGraph.yaml` (~line 1523). Do **not** add these to `ui-classmap.yaml` unless you are implementing full CRUD and serializers.

### 5.5 Tangible heritage class hierarchy (LinkML)

Event-centric modeling ties tangible objects to lifecycle events (`Production`, `Consecration`, `Enshrinement`, `TransferOfCustody`):

```
HumanMadeObject
├── ArchitecturalStructure  → registry key `structure` (Temple, Stupa, Chaitya, Pati, … via StructureTypeEnum)
├── IconographicObject      → registry key `iconography` (Paubha, Murti)
└── BuddhistMonument        → registry key `monument` (Stupa, Chaitya subclasses)
```

### 5.6 UI categories

| Category Key | Label | Registry keys |
|---|---|---|
| `tangible` | Tangible Heritage | entity, structure, iconography, monument |
| `conceptual` | Conceptual Entities | deity, tradition, syncretism |
| `event` | Events & Rituals | event, ritual, festival, production, consecration, enshrinement, transfer_of_custody |
| `kumari` | Kumari tradition | kumari_tenure, kumari_selection, kumari_retirement |
| `social` | Social Organizations | person, guthi, caste_group |
| `spatiotemporal` | Spaces & Time | location, period, calendar |
| `provenance` | Sources & Provenance | source, assertion, entity_cluster |

---

## 6. Controlled Vocabularies (Enums)

**Authoritative definitions** are LinkML `enums:` blocks in **`ontology/HeritageGraph.yaml`**. After `make ontology`, permissible values appear in the registry API as **`registry.enums`** and as **`options`** on each `select` field. The table below summarizes major enums; see the YAML for the full set.

Generated enums: `heritage_graph_ui/src/lib/ontology/__generated__/enums.ts` (from `make ontology`). `enums.ts` at the parent folder remains for **legacy / supplemental** UI-only lists — prefer LinkML for anything that must match Django `choices` and server validation.

| Enum Key | Values | Used By | Ontology Source |
|---|---|---|---|
| `CulturalEntityCategory` | monument, artifact, ritual, festival, tradition, document, other | Cultural entity contribute | `CulturalEntityCategory` |
| `ConditionType` | Good, Damaged, Ruined, Restored | Structure condition | `ConditionType` |
| `ExistenceStatus` | Extant, PartiallyExtant, Destroyed, Lost, Hypothetical, Unknown | Structure/Monument status | `ExistenceStatus` |
| `RitualType` | 19 values (NityaPuja → ProcessionalMovement) | Ritual type | `RitualType` |
| `DatePrecision` | Exact, Year, Decade, Century, Circa | TimeSpan precision | `DatePrecision` |
| `ArchitecturalStyle` | Pagoda, Shikhara, Dome, Chaitya, Stupa | Structure style | `ArchitecturalStyle` |
| `GuthiType` | SiGuthi → RajGuthi (8 types) | Guthi classification | `GuthiType` |
| `SyncreticType` | Equivalence, Appropriation, Fusion, Historical | Syncretic relationship type | `SyncreticType` |
| `LocationTypeEnum` | city, village, region, temple, monument, museum, archaeological_site | Place type | Custom |
| `SourceTypeEnum` | book, journal, archive, thesis, web, field_note, oral_history, inscription | Source material type | Custom |
| `TraditionCategoryEnum` | ritual, dance, storytelling, craft, music, festival | Tradition category | Custom |
| `EventTypeEnum` | festival, ritual, historical, ceremony | Event classification | Custom |
| `RecurrenceEnum` | annual, biennial, monthly, one_time | Event frequency | Custom |
| `ReligiousTraditionEnum` | Hindu, Buddhist, Syncretic, Jain, Animist, Other | Deity/calendar tradition | `ReligiousTradition` |
| `CustodianTypeEnum` | government, academic, community, museum, private, religious | Data custodian type | Custom |
| `DataCiteResourceTypeEnum` | Dataset, Text, Image, Audio, Interview, PhysicalObject, Collection | Source resource type | DataCite |
| `IdentifierTypeEnum` | DOI, ISBN, Handle, URL, LocalArchiveID, ISSN | Persistent ID type | DataCite |
| `VerificationMethodEnum` | cross_check, expert_review, field_visit, archival_comparison, oral_testimony | Verification method | Custom |
| `DocumentationMethodEnum` | 8 methods (photographic_survey → drone_survey) | Documentation activity | Custom |
| `FestivalTypeEnum` | ChariotFestival, MaskedDance, Jatra, Other | Festival classification | Ontology |
| `StructureTypeEnum` | 9 types (Temple → Other) | Structure classification | Ontology subclasses |
| `IconographicObjectTypeEnum` | Paubha, Murti, Other | Iconographic object type | Ontology subclasses |
| `MonumentTypeEnum` | Stupa, Chaitya, Other | Monument type | Ontology subclasses |

---

## 7. How to Make Changes

> **Authoritative procedure:** [`contribution/FORMS.md`](../contribution/FORMS.md) (add fields, enums, sections, new entity types, Django checklist).  
> **Do not** hand-edit per-class TypeScript registries — edit **LinkML** and **`tools/ui-classmap.yaml`**, then **`make ontology`**.

### 7.1 Add a Field to an Existing Entity

**Scenario:** Add a `patron_deity` relation from Guthi to Deity.

Follow **`contribution/FORMS.md` §4**. In short:

1. **LinkML** — Add the slot under `slots:` in `ontology/HeritageGraph.yaml`, attach it to the Guthi class, set `range` (e.g. to the Deity class) and any `slot_usage` / UI annotations.
2. **Django** — Add `patron_deity` on the model, serializer, and migrations; keep the **Python field name identical** to the registry slot key.
3. **Regenerate** — `make ontology` and commit `registry.generated.json` / `registry.generated.ts`.

The registry **shape** for such a field looks like this (generated — do not paste into TypeScript by hand):

```typescript
{
  key: "patron_deity",
  label: "Patron Deity",
  type: "relation",
  section: "function",
  order: 2,
  relationTo: "deity",
  relationEndpoint: "/cidoc/deities/",
  description: "Primary deity this Guthi serves",
},
```

Example **Django** side:

```python
# heritage_graph/apps/cidoc_data/models.py
class Guthi(CIDOCBaseModel):
    # ... existing fields ...
    patron_deity = models.ForeignKey("Deity", null=True, blank=True, on_delete=models.SET_NULL)
```

After migrate + registry refresh, the contribute form, table, and detail views pick up the field via **`OntologyProvider`**.

---

### 7.2 Add a New Enum (Dropdown)

**Scenario:** Add `MaterialTypeEnum` for construction materials.

Use **`contribution/FORMS.md` §5**:

1. Add the enum under `enums:` in `ontology/HeritageGraph.yaml` (`permissible_values` with optional titles/descriptions).
2. Set the slot’s `range` to that enum name.
3. Run `make ontology`.
4. Add matching Django **`choices`** on the model field (string values must match LinkML `text` keys exactly).

Avoid defining production dropdowns **only** in hand-edited `enums.ts`; that bypasses the YAML-driven pipeline and drifts from the API.

---

### 7.3 Add a New Entity Type

**Scenario:** Add an “Inscription” (or any new CIDOC-backed type).

Use the full checklist in **`contribution/FORMS.md` §7**. Summary:

1. **LinkML** — New class in `ontology/HeritageGraph.yaml` (URI, slots, enums).
2. **`tools/ui-classmap.yaml`** — Map the LinkML class name to a registry **`key`**, **`apiEndpoint`**, labels, **`category`**, **`navigable`**, icon, etc. (see the `entity` → `CulturalEntity` row for a non-`/cidoc/` example).
3. **`tools/contribute-hub.yaml`** — Add a hub intent if contributors should see a card (copy, route, difficulty).
4. **`make ontology`** — Commit updated `registry.generated.*`.
5. **Next.js** — Thin route under `heritage_graph_ui/src/app/(dashboard)/contribute/<segment>/page.tsx` that loads `getOntologyClass("<key>")` and renders **`OntologyForm`** (see **`contribution/FORMS.md`** for the template).
6. **Django** — Model, serializer, `ViewSet`, `urls.py` registration; URL path must match the classmap **`apiEndpoint`**.

Knowledge tables and generic **`[domain]/view/[id]`** flows use the same registry key — no duplicate field lists in TypeScript.

---

### 7.4 Add a Relation Field (Entity Linking)

Declare a slot in **LinkML** whose **`range`** is another ontology class (e.g. Deity). The builder sets **`type: "relation"`**, **`relationTo`**, and **`relationEndpoint`** from **`ui-classmap.yaml`**. Example registry fragment:

```typescript
{
  key: "invokes_deity",
  label: "Invokes Deity",
  type: "relation",
  section: "participation",
  order: 2,
  relationTo: "deity",
  relationEndpoint: "/cidoc/deities/",
  multivalued: true,
  description: "Deity invoked or made present through ritual",
},
```

The form uses **`EntitySearch`** against `relationEndpoint`.

---

### 7.5 Add a New Form Section

See **`contribution/FORMS.md` §6**. Prefer slot annotations **`ui_section`** / **`ui_order`** in LinkML, or a class annotation **`ui_sections`**, then **`make ontology`**. Multi-section classes use the built-in step flow inside **`OntologyForm`**.

---

### 7.6 Add to the Contribute Dashboard

**Intent cards and categories** are driven by **`tools/contribute-hub.yaml`**. Edit that file, run **`make ontology`** (or `python3 tools/linkml_generate_registry.py`), and deploy so the embedded hub payload matches the app. The runtime contribute landing page consumes this data via **`contribute_hub`** on the ontology registry — do not hand-edit a large `contributionIntents` array in a page file unless you are intentionally overriding the hub for a one-off experiment.

**Semantic workflows (“patterns”)** are separate: define them in **`tools/semantic-patterns.yaml`** (see existing `patterns:` entries). They are merged server-side (`linkml_loader.build_fresh_payload`) into **`semantic_patterns`** on `GET /api/v1/cidoc/schema/registry/`, bundled in `registry.generated.*`, and rendered on **`/contribute`** plus detail pages **`/contribute/pattern/<key>`**. Steps usually deep-link into normal **`OntologyForm`** routes or **`/contribute/relationship-proposal`** (`linkQuery` on a step supplies URL hints for entity types / IDs).

---

## 8. Field Type Reference

| Type | Renders As | When to Use | Example |
|---|---|---|---|
| `text` | Single-line input | Short strings, names, dates as text | Name, aliases, "c. 1200 CE" |
| `textarea` | Multi-line textarea | Long descriptions, notes, transcriptions | Biography, route description |
| `number` | Number input | Integer values | Year offset, start year |
| `float` | Number input (decimal) | Decimal values | Confidence score (0.0–1.0) |
| `date` | Date picker | ISO dates | Last known existence date |
| `select` | Dropdown | Pick one from enum | Structure type, ritual type |
| `multiselect` | Checkbox group | Pick many from enum | Multivalued enum slots |
| `boolean` | Toggle (`Switch`) | Yes/no flags | Feature flags, booleans |
| `url` | URL input | Web links | Digital source URL |
| `coordinates` | Lat/Long inputs | GPS positions | Legacy combined coordinate string |
| `geo_point` | Lat/Long inputs | Point geometry | When the builder maps a geo slot to `geo_point` |
| `edtf_date` | Text (EDTF-friendly) | Imprecise historical dates | Extended date/time textual encoding |
| `relation` | Entity search autocomplete | Link to another entity | Deity → Structure, Ritual → Festival |

---

## 9. OntologyClass Interface

```typescript
interface OntologyClass {
  key: string;            // Machine key ("structure", "deity")
  label: string;          // Human label ("Architectural Structure")
  labelPlural: string;    // Plural ("Architectural Structures")
  description: string;    // From ontology description
  classUri?: string;      // CIDOC-CRM URI ("crm:E22_Human-Made_Object")
  parentClass?: string;   // Inheritance ("structure" → "monument")
  icon?: string;          // Lucide icon name
  apiEndpoint: string;    // Django API route ("/cidoc/structures/")
  fields: OntologyField[];    // Form fields
  columns: OntologyColumn[];  // Data table columns
  sections?: { key, label, description? }[];  // Form section groupings
  navigable?: boolean;    // Show in sidebar/nav? (default: false)
  category?: string;      // "tangible"|"conceptual"|"event"|"social"|"spatiotemporal"|"provenance"
}
```

---

## 10. OntologyField Interface

```typescript
interface OntologyField {
  key: string;            // Must match Django model field name exactly
  label: string;          // Human-readable label
  type: FieldType;        // "text"|"textarea"|"select"|"relation"|...
  description?: string;   // Help text below the field
  required?: boolean;     // Form validation
  options?: Array<{ value, label, description? }>;  // For select/multiselect
  relationTo?: string;    // For relation: related class registry key
  relationEndpoint?: string;  // For relation: API endpoint for search
  multivalued?: boolean;  // Accept multiple values
  section?: string;       // Section key for grouping
  order?: number;         // Sort order within section
  placeholder?: string;   // Input placeholder text
  defaultValue?: any;     // Default value
  minimumCardinality?: number;  // From LinkML (optional)
  maximumCardinality?: number;  // From LinkML (optional; unbounded may be omitted)
}
```

---

## 11. Ontology ↔ Backend Model Alignment

Every frontend entity class must have a corresponding Django model, serializer, ViewSet, and URL route.

### Checklist for adding a new entity:

| Step | File | What to do |
|---|---|---|
| 1 | `cidoc_data/models.py` | Add Django model with fields matching registry `key` values |
| 2 | `cidoc_data/serializers.py` | Add `ModelSerializer` |
| 3 | `cidoc_data/views.py` | Add `ModelViewSet` |
| 4 | `cidoc_data/urls.py` | Register with router: `router.register(r'endpoint', ViewSet)` |
| 5 | Run migrations | `python manage.py makemigrations cidoc_data && python manage.py migrate` |
| 6 | `ontology/HeritageGraph.yaml` | LinkML class, slots, enums |
| 7 | `tools/ui-classmap.yaml` | Registry `key`, `apiEndpoint`, nav metadata |
| 8 | `tools/contribute-hub.yaml` | Hub intent card (if the type should appear on `/contribute`) |
| 9 | `make ontology` | Regenerate `registry.generated.*` |
| 10 | `heritage_graph_ui/.../(dashboard)/contribute/<route>/page.tsx` | Thin `OntologyForm` page |

### Key field name mapping rules:

- Registry `key` → Django model field name → API JSON key (all identical)
- `coordinates` fields serialize as `"lat,long"` strings
- `select` field `value` must match Django `choices` tuple first element
- `relation` fields typically map to `ForeignKey` or `ManyToManyField` in Django

---

## 12. Data Flow: Form → API → Database

```
User fills form
      │
      ▼
OntologyForm component reads class definition from registry
      │
      ▼
Collects field values, validates required fields
      │
      ▼
POST to apiEndpoint (e.g., /cidoc/structures/)
with Authorization: Bearer <session.accessToken>
      │
      ▼
Django REST Framework serializer validates & saves
      │
      ▼
PostgreSQL (prod) / SQLite (dev) stores the data
      │
      ▼
Knowledge table fetches via GET to same apiEndpoint
```

---

## 13. CIDOC-CRM Alignment Reference

The ontology is fully aligned with CIDOC-CRM (ISO 21127). Key mappings:

| HeritageGraph Class | CIDOC-CRM Class | Role |
|---|---|---|
| ArchitecturalStructure | E22 Human-Made Object | Physical heritage objects |
| Temple, Stupa, Chaitya | E22 (subclassed) | Domain-specific subtypes |
| Deity | E28 Conceptual Object | Divine concepts (not physical) |
| Person | E21 Person | Actors who perform activities |
| Guthi | E74 Group | Social organizations |
| Place | E53 Place | Geographic locations |
| TimeSpan | E52 Time-Span | Temporal extents |
| Production | E12 Production | Object creation events |
| RitualEvent | E7 Activity | Intentional activities |
| Consecration | E7 Activity | Ritual activation events |
| Enshrinement | E7 Activity | Deity installation events |
| TransferOfCustody | E10 Transfer of Custody | Stewardship changes |
| ConditionAssessment | E14 Condition Assessment | Condition evaluations |
| InformationObject (`source` registry key) | E73 Information Object | Contributed sources / documents |
| DataSource (`data_source` lookup) | E73 Information Object | Structured provenance catalog (relation target) |
| HeritageAssertion | CRMinf I2 Belief | Propositional claims |
| SyncreticRelationship | E13 Attribute Assignment | Syncretic equivalence claims |

**Key properties (slots):**

| HeritageGraph Slot | CIDOC-CRM Property | Meaning |
|---|---|---|
| `name` | `rdfs:label` | Primary label |
| `note` | `P3 has note` | Free-text description |
| `has_current_location` | `P55 has current location` | Current location |
| `was_produced_by_event` | `P108i was produced by` | Production link |
| `carried_out_by` | `P14 carried out by` | Actor who performed event |
| `has_timespan` | `P4 has time-span` | Temporal extent |
| `took_place_at` | `P7 took place at` | Event location |
| `depicts_deity` | `P62 depicts` | Iconographic depiction |
| `enshrined_deity` | `P12 occurred in the presence of` | Deity installed |
| `invokes_deity` | `P12 occurred in the presence of` | Deity invoked |

---

## 14. PROV-O Provenance Layer

HeritageGraph implements assertion-level provenance using PROV-O:

```
HeritageAssertion (prov:Entity / crminf:I2_Belief)
  ├── assertion_content       → prov:value (the claim text)
  ├── asserted_property       → what property is being claimed
  ├── asserted_value           → the claimed value
  ├── was_derived_from_source → prov:wasDerivedFrom → DataSource
  ├── was_attributed_to_agent → prov:wasAttributedTo → Person
  ├── generated_at_time        → prov:generatedAtTime (ISO datetime)
  ├── confidence_score         → 0.0–1.0 reliability
  ├── reconciliation_status    → confirmed | conflicting | unverified
  └── supersedes_assertion     → prov:invalidated (version chain)
```

This means **every factual claim** about a heritage entity can be traced back to:
- **Who** said it (agent)
- **When** they said it (timestamp)
- **Where** they got it (source)
- **How confident** we are (score)
- **Whether it conflicts** with other claims (reconciliation)

---

## 15. Troubleshooting & Common Mistakes

### Form field doesn't appear

- ✅ Confirm the slot is listed on the LinkML class and **`make ontology`** was run
- ✅ Check `ui_section` / class `ui_sections` matches a section key on the class
- ✅ Check `ui_order` / ordering so the field isn’t hidden on another step

### Dropdown shows empty

- ✅ Check `type: "select"` in the generated registry for that slot
- ✅ Confirm the slot `range` is a LinkML enum and **`registry.enums`** / inlined **`options`** are present after regeneration
- ✅ If you only edited `__generated__/enums.ts` or legacy `enums.ts`, regenerate from YAML instead — hand edits do not update the API snapshot

### API call returns 404

- ✅ Check `apiEndpoint` matches the Django URL route **exactly** (including trailing slash)
- ✅ Check the ViewSet is registered in `cidoc_data/urls.py`
- ✅ Check the backend is running

### Field saves but doesn't load on edit

- ✅ Check the Django serializer includes the field in `Meta.fields`
- ✅ Check the field `key` exactly matches the model field name (case-sensitive)

### Relation field autocomplete doesn't search

- ✅ Check `relationEndpoint` is correct (must be a valid API endpoint)
- ✅ Check the related entity's ViewSet supports search/list

### Entity doesn't show in sidebar

- ✅ Check `navigable: true` is set on the class
- ✅ Check `category` is set to a valid category key

### New contribute page shows blank

- ✅ Check `getOntologyClass("your_key")` uses the same key as **`tools/ui-classmap.yaml`**
- ✅ Check the file is under `src/app/(dashboard)/contribute/<segment>/page.tsx`
- ✅ Check **`tools/contribute-hub.yaml`** intent `route` matches the real URL path

---

## 16. File Map

```
heritage_graph_ui/
└── src/
    ├── lib/ontology/
    │   ├── types.ts                 # TypeScript interfaces
    │   ├── registry.generated.json  # Committed snapshot (make ontology)
    │   ├── registry.generated.ts    # TS export of snapshot + helpers
    │   ├── load-registry.ts         # Fetch registry from schema API
    │   ├── OntologyProvider.tsx     # Runtime registry + degraded mode
    │   ├── __generated__/enums.ts   # Generated from LinkML (make ontology)
    │   ├── enums.ts                 # Legacy / supplemental enums
    │   └── index.ts                 # Barrel export
    │
    ├── components/
    │   ├── ontology-form.tsx        # Form driven by OntologyClass
    │   ├── ontology-form/           # Step nav + progress bar
    │   └── contribute/              # EntitySearch, assertion wrapper, …
    │
    └── app/(dashboard)/
        ├── contribute/              # OntologyForm routes + pattern/[slug]/ wizard
        └── knowledge/
            └── [domain]/            # Tables + generic record view

tools/
├── ui-classmap.yaml       # LinkML class → registry key, apiEndpoint, nav
├── ui-presentation.yaml   # Optional slot UI overrides
├── contribute-hub.yaml    # Contribute landing intents
├── semantic-patterns.yaml # Guided semantic workflows → registry.semantic_patterns
├── linkml_generate_registry.py
└── emit_minimal_shacl.py  # Writes ontology/shapes/generated-heritagegraph-minimal-shacl.ttl

ontology/
├── HeritageGraph.yaml     # Canonical LinkML (source of truth)
├── shapes/
│   └── generated-heritagegraph-minimal-shacl.ttl  # Regenerate via emit_minimal_shacl.py
└── HeritageGraph.ttl      # OWL/Turtle TBox (generated by `make owl-ttl`)

heritage_graph/apps/cidoc_data/
├── ontology_builder.py    # Registry payload + jsonschema blob + semantic_patterns loader
├── rdf_entity_projection.py  # Triple materialization from registry slots (optional RDF_SYNC)
├── rdf_signals.py         # Signals → SPARQL / Oxigraph (+ spec 007 relationship edges)
├── models.py              # Django models (field keys match registry)
├── serializers.py
├── views.py               # ViewSets + OntologySchemaRegistryView
└── urls.py

heritage_graph/apps/heritage_data/   # Cultural entities API (e.g. /data/api/cultural-entities/)
```

---

> **See also:** [../contribution/FORMS.md](../contribution/FORMS.md) for detailed form mechanics, [../../AGENTS.md](../../AGENTS.md) for full project context, [../../ARCHITECTURE.md](../../ARCHITECTURE.md) for system design.
