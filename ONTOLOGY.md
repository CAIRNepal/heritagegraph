# ONTOLOGY.md — HeritageGraph Ontology & Form System Guide

> **Audience:** Developers, researchers, and AI agents who need to understand, modify, or extend the ontology-driven form system in HeritageGraph.  
> **Last Updated:** February 2026 (aligned with `ontology/HeritageGraph.yaml` v1.0.0)

---

## Table of Contents

1. [Overview — How It All Connects](#1-overview--how-it-all-connects)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Source of Truth Files](#3-source-of-truth-files)
4. [Ontology → Frontend Mapping](#4-ontology--frontend-mapping)
5. [Registered Entity Types (24 total)](#5-registered-entity-types-24-total)
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

HeritageGraph uses a **registry-driven architecture** where a single TypeScript file (`registry.ts`) defines every entity type. The entire UI — forms, data tables, detail views, and navigation — auto-generates from this registry.

```
HeritageGraph.yaml (LinkML)        ← Canonical ontology (classes, slots, enums)
        │
        ▼
Heritage.ttl (OWL/Turtle)          ← Generated OWL for linked-data consumers
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (heritage_graph_ui/src/lib/ontology/)                 │
│                                                                 │
│  types.ts     → TypeScript interfaces (OntologyField, etc.)     │
│  enums.ts     → Controlled vocabularies (dropdown options)      │
│  registry.ts  → Entity class definitions (fields, sections...)  │
│  index.ts     → Barrel re-export                                │
│                                                                 │
│  ↓ auto-generates ↓                                             │
│                                                                 │
│  OntologyForm     → Contribute forms                            │
│  OntologyDataTable → Knowledge tables                           │
│  Detail views     → Entity detail pages                         │
│  Contribute page  → Dashboard intent cards                      │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼  (POST/GET via Bearer token)
┌─────────────────────────────────────────────────────────────────┐
│  Backend (heritage_graph/apps/cidoc_data/)                      │
│                                                                 │
│  models.py       → Django models (must match field keys)        │
│  serializers.py  → DRF serializers                              │
│  views.py        → ViewSets + search                            │
│  urls.py         → API routes (must match apiEndpoint)          │
└─────────────────────────────────────────────────────────────────┘
```

**Golden rule:** The field `key` in the registry **must exactly match** the Django model field name, and `apiEndpoint` must match the URL route registered in `urls.py`.

---

## 2. Architecture Diagram

```
                    ┌──────────────────────────────┐
                    │  ontology/HeritageGraph.yaml  │
                    │  (LinkML — 2060 lines)        │
                    │  40+ classes, 100+ slots      │
                    └───────────┬───────────────────┘
                                │  derived from
                    ┌───────────▼───────────────────┐
                    │  ontology/Heritage.ttl         │
                    │  (OWL/Turtle — 5190 lines)     │
                    └───────────┬───────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                      │
   ┌──────▼──────┐    ┌────────▼────────┐    ┌────────▼────────┐
   │  enums.ts   │    │  registry.ts    │    │  Django models  │
   │  22 enums   │───▶│  24 classes     │    │  cidoc_data     │
   │  dropdowns  │    │  fields/cols    │    │  heritage_data  │
   └─────────────┘    └────────┬────────┘    └────────┬────────┘
                               │                      │
                    ┌──────────▼──────────┐    ┌──────▼──────────┐
                    │  OntologyForm       │    │  DRF Serializer │
                    │  auto-generates UI  │───▶│  API ViewSet    │
                    └─────────────────────┘    └─────────────────┘
```

---

## 3. Source of Truth Files

| File | Location | Purpose | Lines |
|------|----------|---------|-------|
| **HeritageGraph.yaml** | `ontology/HeritageGraph.yaml` | Canonical LinkML schema — classes, slots, enums, prefixes | ~2060 |
| **Heritage.ttl** | `ontology/Heritage.ttl` | Generated OWL/Turtle for linked-data consumers | ~5190 |
| **types.ts** | `heritage_graph_ui/src/lib/ontology/types.ts` | TypeScript interfaces (`OntologyField`, `OntologyClass`, etc.) | ~103 |
| **enums.ts** | `heritage_graph_ui/src/lib/ontology/enums.ts` | Controlled vocabularies for `select` fields | ~230 |
| **registry.ts** | `heritage_graph_ui/src/lib/ontology/registry.ts` | All 24 entity class definitions with fields, sections, columns | ~900 |
| **index.ts** | `heritage_graph_ui/src/lib/ontology/index.ts` | Barrel export | ~17 |

### Relationship between ontology YAML and frontend registry

| HeritageGraph.yaml concept | Frontend equivalent |
|---|---|
| `classes:` block | `OntologyClass` in `registry.ts` |
| `slots:` block | `OntologyField` in each class's `fields` array |
| `enums:` block | Entry in `ontologyEnums` in `enums.ts` |
| `class_uri` | `classUri` property on `OntologyClass` |
| `is_a` (inheritance) | `parentClass` property on `OntologyClass` |
| `slot_usage` (required, range) | `required`, `options`, `relationTo` on `OntologyField` |

---

## 4. Ontology → Frontend Mapping

When translating from `HeritageGraph.yaml` to the frontend registry, follow these rules:

| YAML construct | Frontend mapping | Example |
|---|---|---|
| `ArchitecturalStructure` class | `const architecturalStructure: OntologyClass` with `key: "structure"` | `registry.ts` |
| `name` slot with `slot_uri: rdfs:label` | `nameField("Structure Name")` | Every class |
| `note` slot with `slot_uri: crm:P3_has_note` | `noteField()` | Every class |
| `has_current_location` slot with `range: Place` | `{ type: "relation", relationTo: "location" }` | Structures |
| `ArchitecturalStyleEnum` enum | `ontologyEnums.ArchitecturalStyleEnum` in `enums.ts` | Structure form |
| `multivalued: true` in YAML | `multivalued: true` on `OntologyField` | Ritual deity links |
| `required: true` in `slot_usage` | `required: true` on `OntologyField` | Name fields |

---

## 5. Registered Entity Types (24 total)

### Navigable (show in sidebar & contribute dashboard)

| Registry Key | Label | Category | Ontology Class | CIDOC-CRM URI | API Endpoint |
|---|---|---|---|---|---|
| `person` | Person | social | `Person` | `crm:E21_Person` | `/cidoc/persons/` |
| `location` | Place | spatiotemporal | `Place` | `crm:E53_Place` | `/cidoc/locations/` |
| `event` | Event | event | `HistoricalEvent` | `crm:E5_Event` | `/cidoc/events/` |
| `period` | Historical Period | spatiotemporal | `—` | `crm:E4_Period` | `/cidoc/historical_periods/` |
| `tradition` | Tradition | conceptual | `—` | `crm:E55_Type` | `/cidoc/traditions/` |
| `source` | Source | provenance | `DataSource` | `crm:E73_Information_Object` | `/cidoc/sources/` |
| `deity` | Deity | conceptual | `Deity` | `crm:E28_Conceptual_Object` | `/cidoc/deities/` |
| `guthi` | Guthi | social | `Guthi` | `crm:E74_Group` | `/cidoc/guthis/` |
| `structure` | Architectural Structure | tangible | `ArchitecturalStructure` | `crm:E22_Human-Made_Object` | `/cidoc/structures/` |
| `ritual` | Ritual Event | event | `RitualEvent` | `crm:E7_Activity` | `/cidoc/rituals/` |
| `festival` | Festival | event | `Festival` | `crm:E7_Activity` | `/cidoc/festivals/` |
| `iconography` | Iconographic Object | tangible | `IconographicObject` | `crm:E22_Human-Made_Object` | `/cidoc/iconographic_objects/` |
| `monument` | Monument | tangible | `BuddhistMonument` | `heritageGraph:BuddhistMonument` | `/cidoc/monuments/` |
| `calendar` | Calendar System | spatiotemporal | `CalendarSystem` | `time:Calendar` | `/cidoc/calendar_systems/` |
| `syncretism` | Syncretic Relationship | conceptual | `SyncreticRelationship` | `crm:E13_Attribute_Assignment` | `/cidoc/syncretic_relationships/` |
| `kumari_tenure` | Living Goddess Tenure | event | `LivingGoddessTenure` | `crm:E4_Period` | `/cidoc/kumari_tenures/` |
| `kumari_selection` | Living Goddess Selection | event | `LivingGoddessSelection` | `heritageGraph:LivingGoddessSelection` | `/cidoc/kumari_selections/` |
| `kumari_retirement` | Living Goddess Retirement | event | `LivingGoddessRetirement` | `heritageGraph:LivingGoddessRetirement` | `/cidoc/kumari_retirements/` |
| `documentation` | Documentation Activity | provenance | `DocumentationActivity` | `crm:E7_Activity` | `/cidoc/documentation_activities/` |
| `caste_group` | Caste Group | social | `CasteGroup` | `crm:E74_Group` | `/cidoc/caste_groups/` |
| `assertion` | Heritage Assertion | provenance | `HeritageAssertion` | `crminf:I2_Belief` | `/cidoc/assertions/` |

### Non-navigable (used as lookup/reference types)

| Registry Key | Label | Ontology Class | Purpose |
|---|---|---|---|
| `material` | Material | `Material` | Physical substances used in construction/ritual |
| `technique` | Technique | `Technique` | Craft methods used in production |
| `religious_tradition` | Religious Tradition | `ReligiousTradition` | Reference for tradition dropdowns |

### Categories

| Category Key | Label | Icon | Entities |
|---|---|---|---|
| `tangible` | Tangible Heritage | landmark | structure, iconography, monument, material, technique |
| `conceptual` | Conceptual Entities | lightbulb | deity, tradition, syncretism, religious_tradition |
| `event` | Events & Rituals | calendar | event, ritual, festival, kumari_tenure, kumari_selection, kumari_retirement |
| `social` | Social Organizations | users | person, guthi, caste_group |
| `spatiotemporal` | Spaces & Time | map | location, period, calendar |
| `provenance` | Sources & Provenance | book-open | source, documentation, assertion |

---

## 6. Controlled Vocabularies (Enums)

All enums live in `heritage_graph_ui/src/lib/ontology/enums.ts`. Each is an array of `{ value, label, description? }`.

| Enum Key | Values | Used By | Ontology Source |
|---|---|---|---|
| `ConditionTypeEnum` | Good, Damaged, Ruined, Restored | Structure condition | `ConditionTypeEnum` |
| `ExistenceStatusEnum` | Extant, PartiallyExtant, Destroyed, Lost, Hypothetical, Unknown | Structure/Monument status | `ExistenceStatusEnum` |
| `RitualTypeEnum` | 19 values (NityaPuja → ProcessionalMovement) | Ritual type | `RitualTypeEnum` |
| `DatePrecisionEnum` | Exact, Year, Decade, Century, Circa | TimeSpan precision | `DatePrecisionEnum` |
| `ArchitecturalStyleEnum` | Pagoda, Shikhara, Dome, Chaitya, Stupa | Structure style | `ArchitecturalStyleEnum` |
| `GuthiTypeEnum` | SiGuthi → RajGuthi (8 types) | Guthi classification | `GuthiTypeEnum` |
| `SyncreticTypeEnum` | Equivalence, Appropriation, Fusion, Historical | Syncretic relationship type | `SyncreticTypeEnum` |
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

### 7.1 Add a Field to an Existing Entity

**Scenario:** Add a "patron_deity" field to the Guthi form.

**Step 1 — Edit `registry.ts`:**

Find the `guthi` definition and add to its `fields` array:

```typescript
{
  key: "patron_deity",             // Must match Django model field name
  label: "Patron Deity",           // Human-readable label
  type: "relation",                // Field type (see Section 8)
  section: "function",             // Which section to place it in
  order: 2,                        // Sort order within section
  relationTo: "deity",             // Related ontology class key
  relationEndpoint: "/cidoc/deities/",  // API endpoint for search
  description: "Primary deity this Guthi serves"
},
```

**Step 2 — Django model** (if new field):

```python
# heritage_graph/apps/cidoc_data/models.py
class Guthi(CIDOCBaseModel):
    # ... existing fields ...
    patron_deity = models.ForeignKey('Deity', null=True, blank=True, on_delete=models.SET_NULL)
```

**Step 3 — Serializer + migration:**

```bash
cd heritage_graph
python manage.py makemigrations cidoc_data
python manage.py migrate
```

Add the field to the serializer's `Meta.fields` list if needed.

**That's it.** The form, table, and detail view all update automatically.

---

### 7.2 Add a New Enum (Dropdown)

**Scenario:** Add a "MaterialTypeEnum" for construction materials.

**Step 1 — Edit `enums.ts`:**

Add inside the `ontologyEnums` object:

```typescript
MaterialTypeEnum: [
  { value: "stone", label: "Stone", description: "Natural stone (brick, slate, marble)" },
  { value: "wood", label: "Wood", description: "Timber construction material" },
  { value: "brick", label: "Brick", description: "Fired clay brick" },
  { value: "metal", label: "Metal", description: "Bronze, copper, iron" },
  { value: "terracotta", label: "Terracotta", description: "Unglazed ceramic" },
],
```

**Step 2 — Use it in a field:**

```typescript
{
  key: "primary_material",
  label: "Primary Material",
  type: "select",
  options: ontologyEnums.MaterialTypeEnum,
  section: "architecture",
  order: 4,
},
```

**Step 3 — Django model:**

Add corresponding `choices` tuple to the Django model field.

---

### 7.3 Add a New Entity Type

**Scenario:** Add an "Inscription" entity for stone/copper-plate inscriptions.

**Step 1 — Define the class in `registry.ts`:**

```typescript
const inscription: OntologyClass = {
  key: "inscription",
  label: "Inscription",
  labelPlural: "Inscriptions",
  description: "Stone or copper-plate inscription with epigraphic content",
  classUri: "crm:E34_Inscription",
  icon: "file-text",                    // Lucide icon name
  apiEndpoint: "/cidoc/inscriptions/",  // Must match Django URL
  category: "tangible",                 // Category group
  navigable: true,                      // Show in sidebar/nav
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "content", label: "Epigraphic Content" },
    { key: "location", label: "Location" },
  ],
  fields: [
    nameField("Inscription Name"),
    { key: "script", label: "Script", type: "text", section: "content", order: 1,
      placeholder: "e.g., Lichhavi Brahmi, Ranjana", description: "Writing system used" },
    { key: "language", label: "Language", type: "text", section: "content", order: 2,
      placeholder: "e.g., Sanskrit, Nepal Bhasa" },
    { key: "transcription", label: "Transcription", type: "textarea", section: "content", order: 3,
      description: "Full transcription of the inscription text" },
    { key: "date_earliest", label: "Date", type: "text", section: "basic", order: 2,
      placeholder: "e.g., 464 CE (Lichhavi)" },
    { key: "location_name", label: "Location", type: "text", section: "location", order: 1 },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "location", order: 2 },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "script", label: "Script", sortable: true, visible: true, format: "badge" },
    { key: "language", label: "Language", sortable: true, visible: true },
    { key: "date_earliest", label: "Date", sortable: true, visible: true },
  ],
};
```

**Step 2 — Register it:**

Add to the `ontologyClasses` export:

```typescript
export const ontologyClasses: Record<string, OntologyClass> = {
  // ... existing entries ...
  inscription,
};
```

**Step 3 — Create the contribute page:**

Create `heritage_graph_ui/src/app/dashboard/contribute/inscription/page.tsx`:

```tsx
"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeInscriptionPage() {
  const cls = getOntologyClass("inscription")!;
  return <OntologyForm ontologyClass={cls} />;
}
```

**Step 4 — Add to contribute dashboard (optional):**

Edit `heritage_graph_ui/src/app/dashboard/contribute/page.tsx` — add an entry to `contributionIntents`:

```typescript
{
  key: "inscription",
  label: "Record an Inscription",
  description: "Stone or copper-plate inscriptions with transcription and dating.",
  icon: "📜",
  category: "Tangible Heritage",
  route: "/dashboard/contribute/inscription",
  difficulty: "advanced",
  gradient: "from-blue-500 to-sky-600",
},
```

**Step 5 — Django backend:**

1. Add model in `heritage_graph/apps/cidoc_data/models.py`
2. Add serializer in `serializers.py`
3. Add ViewSet in `views.py`
4. Register route in `urls.py` → `router.register(r'inscriptions', InscriptionViewSet)`
5. Run `makemigrations` + `migrate`

**Step 6 — Knowledge page** (auto-generated):

Create `heritage_graph_ui/src/app/dashboard/knowledge/inscription/page.tsx` following the same pattern as other knowledge pages.

---

### 7.4 Add a Relation Field (Entity Linking)

Relation fields let users link entities together (e.g., "this ritual invokes deity X").

```typescript
{
  key: "invokes_deity",              // Django field name
  label: "Invokes Deity",            // Form label
  type: "relation",                  // Must be "relation"
  section: "participation",          // Form section
  order: 2,
  relationTo: "deity",               // Registry key of the related class
  relationEndpoint: "/cidoc/deities/", // API endpoint for autocomplete search
  multivalued: true,                 // Allow linking multiple entities
  description: "Deity invoked or made present through ritual"
},
```

The `EntitySearch` component renders an autocomplete dropdown that calls the related API endpoint.

---

### 7.5 Add a New Form Section

Sections visually group fields in the form. Add to the `sections` array:

```typescript
sections: [
  { key: "basic", label: "Basic Information" },
  { key: "provenance", label: "Provenance & Sources" },       // ← new
  { key: "status", label: "Status & Condition", description: "Current physical state" },
],
```

Then set `section: "provenance"` on any field you want in that group.

---

### 7.6 Add to the Contribute Dashboard

The contribute page at `/dashboard/contribute/` shows intent cards grouped by category.

Edit `heritage_graph_ui/src/app/dashboard/contribute/page.tsx`:

```typescript
// Add to the contributionIntents array
{
  key: "your_entity",               // Unique key
  label: "Your Label",              // Card title
  description: "Description...",    // Card description
  icon: "🏛️",                      // Emoji icon
  category: "Tangible Heritage",    // Category group header
  route: "/dashboard/contribute/your-entity",  // Must match page route
  difficulty: "beginner",           // beginner | intermediate | advanced
  gradient: "from-blue-500 to-sky-500",       // Tailwind gradient
},
```

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
| `multiselect` | Multi-select | Pick many from enum | _(not yet fully implemented)_ |
| `boolean` | Checkbox | Yes/no flags | `is_critical_for_festival` |
| `url` | URL input | Web links | Digital source URL |
| `coordinates` | Lat/Long input | GPS positions | Structure coordinates |
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
| 6 | `ontology/enums.ts` | Add any new enums |
| 7 | `ontology/registry.ts` | Add `OntologyClass` definition |
| 8 | `contribute/<key>/page.tsx` | Create contribute page |
| 9 | `contribute/page.tsx` | Add intent card |

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
| DataSource | E73 Information Object | Documentary sources |
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

- ✅ Check `section` matches a key in the class's `sections` array
- ✅ Check `order` is set (fields without order sort unpredictably)
- ✅ Check the class is exported in `ontologyClasses` in `registry.ts`

### Dropdown shows empty

- ✅ Check `type: "select"` is set
- ✅ Check `options: ontologyEnums.YourEnum` points to an existing enum
- ✅ Check the enum is properly exported from `enums.ts`

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

- ✅ Check `getOntologyClass("your_key")` uses the correct registry key
- ✅ Check the file is at `contribute/your-route/page.tsx`
- ✅ Check the contribute dashboard card's `route` matches the page path

---

## 16. File Map

```
heritage_graph_ui/
└── src/
    ├── lib/ontology/
    │   ├── types.ts              # TypeScript interfaces
    │   ├── enums.ts              # 22 controlled vocabularies
    │   ├── registry.ts           # 24 entity class definitions
    │   └── index.ts              # Barrel export
    │
    ├── components/
    │   ├── ontology-form.tsx     # Auto-generates forms from registry
    │   └── contribute/
    │       ├── step-wizard.tsx   # Multi-step wizard container
    │       ├── step-indicator.tsx # Wizard progress bar
    │       ├── type-picker.tsx   # Card-based type selector
    │       ├── entity-search.tsx # Autocomplete entity linker
    │       └── assertion-wrapper.tsx # Provenance fields
    │
    └── app/dashboard/
        ├── contribute/
        │   ├── page.tsx          # Contribute dashboard (21 intent cards)
        │   ├── person/page.tsx   # Person form
        │   ├── deity/page.tsx    # Deity form
        │   ├── structure/page.tsx # Structure wizard
        │   ├── ritual/page.tsx   # Ritual wizard
        │   ├── festival/page.tsx # Festival form
        │   ├── guthi/page.tsx    # Guthi form
        │   ├── location/page.tsx # Place form
        │   ├── source/page.tsx   # Source form
        │   ├── event/page.tsx    # Event form
        │   ├── period/page.tsx   # Period form
        │   ├── tradition/page.tsx # Tradition form
        │   ├── iconography/page.tsx # Iconographic object form
        │   ├── monument/page.tsx # Monument form
        │   ├── calendar/page.tsx # Calendar system form
        │   ├── syncretism/page.tsx # Syncretic relationship form
        │   ├── kumari-tenure/page.tsx    # Living Goddess tenure form
        │   ├── kumari-selection/page.tsx  # Living Goddess selection form
        │   ├── kumari-retirement/page.tsx # Living Goddess retirement form
        │   ├── documentation/page.tsx    # Documentation activity form
        │   ├── caste-group/page.tsx      # Caste group form
        │   └── assertion/page.tsx        # Heritage assertion form
        │
        └── knowledge/
            └── [domain]/page.tsx  # Auto-generated data tables

ontology/
├── HeritageGraph.yaml   # Canonical LinkML schema (source of truth)
└── Heritage.ttl         # Generated OWL/Turtle

heritage_graph/apps/cidoc_data/
├── models.py            # Django models (must match field keys)
├── serializers.py       # DRF serializers
├── views.py             # ViewSets + search
└── urls.py              # API route registration
```

---

> **See also:** [FORMS.md](./FORMS.md) for detailed form mechanics, [AGENTS.md](./AGENTS.md) for full project context, [ARCHITECTURE.md](./ARCHITECTURE.md) for system design.
