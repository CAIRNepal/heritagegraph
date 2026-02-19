# FORMS.md — How Forms Work in HeritageGraph

> **Audience:** Developers, AI agents, and contributors who need to add, modify, or understand forms in HeritageGraph.

---

## Table of Contents

1. [Quick Start — Add a Field in 2 Minutes](#1-quick-start--add-a-field-in-2-minutes)
2. [Architecture Overview](#2-architecture-overview)
3. [The Ontology Registry (Single Source of Truth)](#3-the-ontology-registry-single-source-of-truth)
4. [How to Add a New Field to an Existing Form](#4-how-to-add-a-new-field-to-an-existing-form)
5. [How to Add a New Enum (Dropdown Options)](#5-how-to-add-a-new-enum-dropdown-options)
6. [How to Add a New Form Section](#6-how-to-add-a-new-form-section)
7. [How to Add a Completely New Entity Type](#7-how-to-add-a-completely-new-entity-type)
8. [Field Type Reference](#8-field-type-reference)
9. [OntologyClass Interface — Full Reference](#9-ontologyclass-interface--full-reference)
10. [OntologyField Interface — Full Reference](#10-ontologyfield-interface--full-reference)
11. [Custom Wizard Forms vs Auto-Generated Forms](#11-custom-wizard-forms-vs-auto-generated-forms)
12. [Backend Checklist — Django Model Sync](#12-backend-checklist--django-model-sync)
13. [File Map](#13-file-map)
14. [Troubleshooting](#14-troubleshooting)
15. [Related Documentation](#15-related-documentation)

---

## 1. Quick Start — Add a Field in 2 Minutes

Want to add a "Commissioner" field to the Structure form? **One edit, zero component changes:**

**File:** `heritage_graph_ui/src/lib/ontology/registry.ts`

Find the `architecturalStructure` definition and add to the `fields` array:

```typescript
{ 
  key: "commissioner",           // Must match Django model field name
  label: "Commissioned By",      // Human-readable label shown on form
  type: "text",                  // Input type (see Field Type Reference)
  section: "architecture",       // Which form section to group into
  order: 3,                      // Sort order within section
  placeholder: "e.g., King Pratap Malla",
  description: "Person or entity who commissioned the structure"
},
```

That's it. The form, data table, and detail view **all update automatically**.

> ⚠️ **Backend sync required:** You must also add `commissioner = models.CharField(max_length=200, blank=True)` to the Django model and run `makemigrations` + `migrate`. See [Section 12](#12-backend-checklist--django-model-sync).

---

## 2. Architecture Overview

HeritageGraph uses a **registry-driven** pattern. A single TypeScript file defines every entity type, its fields, dropdown options, and API endpoint. The UI components read from this registry and auto-generate forms, tables, and detail views.

```
                  ┌───────────────────────────────────────┐
                  │     src/lib/ontology/registry.ts      │
                  │  ┌─────────────────────────────────┐  │
                  │  │  OntologyClass definitions      │  │
                  │  │  (fields, sections, columns,    │  │
                  │  │   apiEndpoint, enums)            │  │
                  │  └──────────┬──────────────────────┘  │
                  └─────────────┼──────────────────────────┘
                                │
              ┌─────────────────┼─────────────────────┐
              │                 │                       │
              ▼                 ▼                       ▼
   ┌──────────────────┐ ┌─────────────────┐  ┌─────────────────────┐
   │  OntologyForm    │ │ OntologyData    │  │  Record Detail View │
   │  (Auto-generated │ │ Table (Auto-gen │  │  (Auto-generated    │
   │   contribute     │ │  knowledge      │  │   entity view with  │
   │   form)          │ │  listing)       │  │   sections)         │
   └────────┬─────────┘ └────────┬────────┘  └─────────────────────┘
            │                    │
            │   POST payload     │   GET list
            ▼                    ▼
   ┌─────────────────────────────────────────┐
   │  Django REST Framework Backend          │
   │  models.py → serializers.py → views.py │
   │  (fields must match registry keys)      │
   └─────────────────────────────────────────┘
```

**Key principle:** The `key` values in the registry (e.g., `construction_date`, `structure_type`) **must exactly match** the Django model field names because `OntologyForm` sends `{ [field.key]: value }` and DRF's `ModelSerializer` expects those names.

---

## 3. The Ontology Registry (Single Source of Truth)

### Files

| File | Purpose |
|------|---------|
| `src/lib/ontology/types.ts` | TypeScript interfaces: `OntologyField`, `OntologyColumn`, `OntologyClass` |
| `src/lib/ontology/enums.ts` | Controlled vocabularies (dropdown options for `select` fields) |
| `src/lib/ontology/registry.ts` | **THE registry** — all 13 entity class definitions |
| `src/lib/ontology/index.ts` | Barrel re-export |

### Currently Registered Classes

| Key | Label | Category | API Endpoint |
|-----|-------|----------|-------------|
| `person` | Person | social | `/cidoc/persons/` |
| `location` | Place | spatiotemporal | `/cidoc/locations/` |
| `event` | Event | event | `/cidoc/events/` |
| `period` | Historical Period | spatiotemporal | `/cidoc/historical_periods/` |
| `tradition` | Tradition | conceptual | `/cidoc/traditions/` |
| `source` | Source | provenance | `/cidoc/sources/` |
| `deity` | Deity | conceptual | `/cidoc/deities/` |
| `guthi` | Guthi | social | `/cidoc/guthis/` |
| `structure` | Architectural Structure | tangible | `/cidoc/structures/` |
| `ritual` | Ritual Event | event | `/cidoc/rituals/` |
| `festival` | Festival | event | `/cidoc/festivals/` |
| `iconography` | Iconographic Object | tangible | `/cidoc/iconographic_objects/` |
| `monument` | Monument | tangible | `/cidoc/monuments/` |

---

## 4. How to Add a New Field to an Existing Form

### Step 1 — Edit the registry (Frontend)

Open `src/lib/ontology/registry.ts`, find the entity definition, and add to its `fields` array:

```typescript
// Example: adding "restoration_date" to architecturalStructure
const architecturalStructure: OntologyClass = {
  // ...existing properties...
  fields: [
    // ...existing fields...
    
    // ➕ ADD THIS:
    { 
      key: "restoration_date",       // Must match Django field name
      label: "Last Restoration",
      type: "text",
      section: "status",             // Groups into the "Status & Condition" section
      order: 3,                      // After "condition" (order: 2)
      placeholder: "e.g., 2015 CE, after 2015 earthquake",
      description: "Date of most recent restoration"
    },
  ],
};
```

### Step 2 — Add to columns (Optional)

If you want it visible in the knowledge data table, add to the `columns` array:

```typescript
columns: [
  // ...existing columns...
  { key: "restoration_date", label: "Restored", sortable: true, visible: true },
],
```

### Step 3 — Add Django model field (Backend)

Open `heritage_graph/apps/cidoc_data/models.py`:

```python
class ArchitecturalStructure(MetaData):
    # ...existing fields...
    restoration_date = models.CharField(max_length=100, blank=True)
```

### Step 4 — Run migrations

```bash
cd heritage_graph
python manage.py makemigrations cidoc_data
python manage.py migrate
```

### What auto-updates:
- ✅ Contribute form — field appears in the correct section
- ✅ Knowledge data table — column shows if added to `columns`
- ✅ Detail view page — field renders in the correct section
- ✅ API serializer — included automatically (uses `fields = '__all__'`)

---

## 5. How to Add a New Enum (Dropdown Options)

### Step 1 — Define the enum in `enums.ts`

Open `src/lib/ontology/enums.ts` and add:

```typescript
export const ontologyEnums = {
  // ...existing enums...

  // ➕ ADD THIS:
  CalendarSystemEnum: [
    { value: "Nepal_Sambat", label: "Nepal Sambat", description: "Nepal's indigenous calendar" },
    { value: "Bikram_Sambat", label: "Bikram Sambat", description: "Vikrama calendar used in Nepal" },
    { value: "CE", label: "Common Era (CE)", description: "Gregorian calendar" },
    { value: "Buddhist", label: "Buddhist Calendar" },
  ],
} as const;
```

### Step 2 — Use it in a field definition

```typescript
{ 
  key: "calendar_system",
  label: "Calendar System",
  type: "select",                              // ← Must be "select" for dropdowns
  options: ontologyEnums.CalendarSystemEnum,    // ← Reference the enum
  section: "temporal",
  order: 4,
},
```

### Step 3 — Add Django model choices (Backend)

```python
# In models.py
CALENDAR_SYSTEM_CHOICES = [
    ('Nepal_Sambat', 'Nepal Sambat'),
    ('Bikram_Sambat', 'Bikram Sambat'),
    ('CE', 'Common Era'),
    ('Buddhist', 'Buddhist Calendar'),
]

class YourModel(MetaData):
    calendar_system = models.CharField(
        max_length=30, 
        choices=CALENDAR_SYSTEM_CHOICES, 
        blank=True
    )
```

> ⚠️ **Important:** The `value` strings in the frontend enum **must exactly match** the first element of each Django `choices` tuple.

---

## 6. How to Add a New Form Section

Sections group related fields under collapsible accordion headers. To add one:

### Edit the entity definition in `registry.ts`:

```typescript
const architecturalStructure: OntologyClass = {
  // ...
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "architecture", label: "Architecture" },
    { key: "status", label: "Status & Condition" },
    { key: "location", label: "Location" },
    
    // ➕ ADD THIS:
    { key: "cultural", label: "Cultural Significance", description: "Associations with deities and rituals" },
  ],
  fields: [
    // ...existing fields...
    
    // ➕ Fields in the new section:
    { key: "primary_deity", label: "Primary Deity", type: "text", section: "cultural", order: 1 },
    { key: "ritual_significance", label: "Ritual Significance", type: "textarea", section: "cultural", order: 2 },
  ],
};
```

The `OntologyForm` renders each section as an `AccordionItem`. Sections with no fields are automatically hidden.

---

## 7. How to Add a Completely New Entity Type

This is the most involved task. Here's the full checklist:

### Step 1 — Define the OntologyClass (Frontend)

Add to `src/lib/ontology/registry.ts`:

```typescript
const inscription: OntologyClass = {
  key: "inscription",                              // URL-safe key (used in routes)
  label: "Inscription",                            // Singular label
  labelPlural: "Inscriptions",                     // Plural label
  description: "Ancient stone or copper inscriptions recording historical events",
  classUri: "crm:E34_Inscription",                 // CIDOC-CRM class (optional)
  icon: "file-text",                               // Lucide icon name
  apiEndpoint: "/cidoc/inscriptions/",             // Must match Django URL
  category: "tangible",                            // For sidebar grouping
  navigable: true,                                 // Show in navigation
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "content", label: "Content & Language" },
    { key: "location", label: "Location" },
  ],
  fields: [
    nameField("Inscription Name"),
    descriptionField(),
    { key: "inscription_type", label: "Type", type: "select", section: "basic", order: 3, required: true, options: [
      { value: "Stone", label: "Stone Inscription" },
      { value: "Copper", label: "Copper Plate" },
      { value: "PalmLeaf", label: "Palm Leaf" },
    ]},
    { key: "language", label: "Language", type: "text", section: "content", order: 1, placeholder: "e.g., Sanskrit, Newari" },
    { key: "script", label: "Script", type: "text", section: "content", order: 2, placeholder: "e.g., Lichhavi, Ranjana" },
    { key: "date_text", label: "Date on Inscription", type: "text", section: "content", order: 3 },
    { key: "location_name", label: "Current Location", type: "text", section: "location", order: 1 },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "location", order: 2, placeholder: "Lat, Long" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "inscription_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "language", label: "Language", sortable: true, visible: true },
    { key: "location_name", label: "Location", sortable: true, visible: true },
  ],
};
```

### Step 2 — Register it in the export

In the same file, add to the `ontologyClasses` object:

```typescript
export const ontologyClasses: Record<string, OntologyClass> = {
  // ...existing entries...
  inscription,     // ➕ ADD
};
```

### Step 3 — Create page stubs (Frontend)

**Knowledge list page** — `src/app/dashboard/knowledge/inscription/page.tsx`:

```tsx
"use client";
import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function InscriptionKnowledgePage() {
  const cls = getOntologyClass("inscription")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
```

**Contribute form page** — `src/app/dashboard/contribute/inscription/page.tsx`:

```tsx
"use client";
import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeInscriptionPage() {
  const cls = getOntologyClass("inscription")!;
  return <OntologyForm ontologyClass={cls} />;
}
```

### Step 4 — Django model (Backend)

In `heritage_graph/apps/cidoc_data/models.py`:

```python
class Inscription(MetaData):
    """Stone or copper plate inscription."""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    inscription_type = models.CharField(max_length=30)
    language = models.CharField(max_length=100, blank=True)
    script = models.CharField(max_length=100, blank=True)
    date_text = models.CharField(max_length=100, blank=True)
    location_name = models.CharField(max_length=200, blank=True)
    coordinates = models.CharField(max_length=50, blank=True, help_text="Lat, Long")
    note = models.TextField(blank=True)

    def __str__(self):
        return self.name
```

### Step 5 — Serializer (Backend)

In `heritage_graph/apps/cidoc_data/serializers.py`:

```python
class InscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inscription
        fields = '__all__'
```

### Step 6 — ViewSet (Backend)

In `heritage_graph/apps/cidoc_data/views.py`:

```python
class InscriptionViewSet(viewsets.ModelViewSet):
    queryset = Inscription.objects.all()
    serializer_class = InscriptionSerializer
```

### Step 7 — URL route (Backend)

In `heritage_graph/apps/cidoc_data/urls.py`:

```python
router.register(r'inscriptions', InscriptionViewSet)
```

### Step 8 — Migration (Backend)

```bash
cd heritage_graph
python manage.py makemigrations cidoc_data
python manage.py migrate
```

### Step 9 — Add assertion support (Optional)

To let `HeritageAssertion` (provenance tracking) reference this new model, add it to the assertion patching loop in `models.py`:

```python
for _model in [
    # ...existing models...
    Inscription,  # ➕ ADD
]:
    if not hasattr(_model, 'assertions'):
        GenericRelation(...)
```

### Summary — What You Created:

| What | How | Auto-generated? |
|------|-----|----------------|
| Contribute form | OntologyForm reads `inscription` from registry | ✅ Automatic |
| Data table | OntologyDataTable reads `inscription` from registry | ✅ Automatic |
| Detail view | Generic `[domain]/view/[id]` page works automatically | ✅ Automatic |
| API endpoint | Manual Django model + serializer + viewset + URL | ❌ Manual |
| Page stubs | 3-line files per page | ❌ Manual (could be dynamic) |

---

## 8. Field Type Reference

| Type | HTML Rendering | Notes |
|------|---------------|-------|
| `text` | `<Input type="text">` | Default for most fields |
| `textarea` | `<Textarea>` | Multi-line text, renders with 4 rows |
| `number` | `<Input type="number">` | Stores as `number`, `null` when empty |
| `date` | `<Input type="text">` | Text input (heritage dates are often imprecise strings like "c. 1200 CE") |
| `select` | `<Select>` dropdown | Requires `options` array (inline or from `ontologyEnums`) |
| `url` | `<Input type="url">` | URL input with https:// placeholder |
| `coordinates` | Two `<Input>` (lat/lng) | Renders as side-by-side lat/lng, serialized as `"lat, lng"` string |
| `boolean` | `<Input type="text">` | Not yet implemented as a toggle — falls back to text |
| `multiselect` | `<Input type="text">` | Not yet implemented — falls back to text |
| `relation` | `<Input type="text">` | Not yet implemented — falls back to text. Use `EntitySearch` in custom wizards |
| `float` | `<Input type="text">` | Not yet implemented — falls back to text |

### Field Properties

```typescript
{
  key: string;           // Required — must match Django model field name
  label: string;         // Required — human-readable label
  type: FieldType;       // Required — see table above
  required?: boolean;    // If true, OntologyForm validates before submit
  section?: string;      // Groups field into a section (default: "basic")
  order?: number;        // Sort order within section (default: 99)
  description?: string;  // Help text shown below the label
  placeholder?: string;  // Placeholder text in the input
  options?: Array<{      // Required for type: "select"
    value: string;
    label: string;
    description?: string;
  }>;
  defaultValue?: any;    // Default value (not yet wired in OntologyForm)
  relationTo?: string;   // For type: "relation" — target entity key
  relationEndpoint?: string;  // For type: "relation" — API search endpoint
  multivalued?: boolean; // Whether field accepts multiple values
}
```

---

## 9. OntologyClass Interface — Full Reference

```typescript
interface OntologyClass {
  key: string;               // URL-safe identifier (e.g., "structure", "deity")
  label: string;             // Singular display name (e.g., "Architectural Structure")
  labelPlural: string;       // Plural display name (e.g., "Architectural Structures")
  description: string;       // One-line description
  classUri?: string;         // CIDOC-CRM class URI (e.g., "crm:E22_Human-Made_Object")
  parentClass?: string;      // Key of parent class for inheritance
  icon?: string;             // Lucide icon name
  apiEndpoint: string;       // DRF API path (e.g., "/cidoc/structures/")
  category?: string;         // Grouping: tangible | conceptual | event | social | spatiotemporal | provenance
  navigable?: boolean;       // Whether to show in navigation menus
  sections?: Array<{         // Form section groupings
    key: string;
    label: string;
    description?: string;
  }>;
  fields: OntologyField[];   // Field definitions (see above)
  columns: OntologyColumn[]; // Table column definitions
}
```

---

## 10. OntologyField Interface — Full Reference

See the `OntologyField` definition in `src/lib/ontology/types.ts`.

Each field maps to:
- A **form input** in `OntologyForm` (via the `FieldRenderer` switch)
- A **table cell** in `OntologyDataTable` (if listed in `columns`)
- A **detail row** in the generic record view page
- A **Django model field** in `models.py`
- A **serializer field** in `serializers.py` (auto-included via `fields = '__all__'`)

---

## 11. Custom Wizard Forms vs Auto-Generated Forms

HeritageGraph has **two form systems**:

### A) Auto-Generated Forms (`OntologyForm`)

- Used by most entity types (Person, Location, Event, Period, etc.)
- Reads from the registry, renders all fields in accordion sections
- Single-page form with one Submit button
- Page stub is 3 lines of code

**Good for:** Simple entity types with flat fields.

### B) Custom Wizard Forms (Step-by-step)

- Used by Structure (`contribute/structure/page.tsx`) and Ritual (`contribute/ritual/page.tsx`)
- Multi-step wizards with progressive disclosure
- Use `StepWizard`, `TypePicker`, `AssertionWrapper`, `EntitySearch` components
- Handcrafted UI with step validation
- Support provenance (assertion) data on submit

**Good for:** Complex entities that benefit from guided, step-by-step input.

### Shared Wizard Components

| Component | File | Purpose |
|-----------|------|---------|
| `StepWizard` | `src/components/contribute/step-wizard.tsx` | Multi-step container with Back/Next/Submit |
| `StepIndicator` | `src/components/contribute/step-indicator.tsx` | Progress bar |
| `TypePicker` | `src/components/contribute/type-picker.tsx` | Visual card-based type selector |
| `AssertionWrapper` | `src/components/contribute/assertion-wrapper.tsx` | Source + confidence fields |
| `EntitySearch` | `src/components/contribute/entity-search.tsx` | Search-and-link for relations |

### When to use which?

| Scenario | Use |
|----------|-----|
| Simple entity, flat fields, quick contribution | `OntologyForm` (auto-generated) |
| Complex entity, many sections, relational fields, provenance tracking | Custom wizard |
| Quick prototyping of a new entity type | `OntologyForm` first, then upgrade to wizard |

---

## 12. Backend Checklist — Django Model Sync

Every registry field needs a corresponding Django model field. Here's the sync checklist:

### Field type mapping (Frontend → Backend)

| Frontend Type | Django Field | Notes |
|--------------|-------------|-------|
| `text` | `CharField(max_length=200, blank=True)` | |
| `textarea` | `TextField(blank=True)` | |
| `number` | `IntegerField(null=True, blank=True)` | |
| `float` | `FloatField(null=True, blank=True)` | |
| `date` | `CharField(max_length=100, blank=True)` | Text because heritage dates are imprecise |
| `select` | `CharField(max_length=30, choices=CHOICES, blank=True)` | Add choices tuple |
| `url` | `URLField(blank=True)` | |
| `coordinates` | `CharField(max_length=50, blank=True)` | Stored as "lat, lng" string |
| `boolean` | `BooleanField(default=False)` | |
| `relation` | `ForeignKey(Model, ...)` or `CharField` | FK not yet wired in generic form |

### Sync validation

When adding a field, verify:

1. ✅ `field.key` in `registry.ts` matches `field_name` in Django model
2. ✅ `select` options `value` strings match Django `choices` first-element strings
3. ✅ `required: true` fields have `blank=False` (or no `blank=True`) in Django
4. ✅ Run `makemigrations` + `migrate` after model changes
5. ✅ Serializer uses `fields = '__all__'` (auto-includes new fields)

### Quick command reference

```bash
# After changing models.py:
cd heritage_graph
python manage.py makemigrations cidoc_data
python manage.py migrate

# Verify the field appears in the API schema:
# Visit http://backend.localhost/docs/ and check the endpoint
```

---

## 13. File Map

### Frontend (Form System)

| File | Role |
|------|------|
| `src/lib/ontology/types.ts` | TypeScript interfaces for the ontology type system |
| `src/lib/ontology/enums.ts` | Controlled vocabularies (dropdown options) |
| `src/lib/ontology/registry.ts` | **Single source of truth** — all entity class definitions |
| `src/lib/ontology/index.ts` | Barrel re-exports |
| `src/components/ontology-form.tsx` | Generic auto-generated contribute form |
| `src/components/ontology-data-table.tsx` | Generic auto-generated knowledge data table |
| `src/components/contribute/step-wizard.tsx` | Multi-step form container |
| `src/components/contribute/step-indicator.tsx` | Step progress bar |
| `src/components/contribute/type-picker.tsx` | Visual type selector cards |
| `src/components/contribute/assertion-wrapper.tsx` | Source + confidence provenance fields |
| `src/components/contribute/entity-search.tsx` | Entity search-and-link component |
| `src/app/dashboard/contribute/<domain>/page.tsx` | Per-domain contribute page stubs |
| `src/app/dashboard/knowledge/<domain>/page.tsx` | Per-domain knowledge table page stubs |
| `src/app/dashboard/knowledge/[domain]/view/[id]/page.tsx` | Generic entity detail/record view |

### Backend (Django API)

| File | Role |
|------|------|
| `heritage_graph/apps/cidoc_data/models.py` | All entity Django models |
| `heritage_graph/apps/cidoc_data/serializers.py` | DRF serializers for all entities |
| `heritage_graph/apps/cidoc_data/views.py` | DRF ViewSets for all entities |
| `heritage_graph/apps/cidoc_data/urls.py` | Router URL registration |

---

## 14. Troubleshooting

### "Form submits but field data is missing in the API response"

**Cause:** The `key` in the registry field doesn't match the Django model field name.

**Fix:** Ensure the registry `key` (e.g., `construction_date`) exactly matches the model's field name:
```python
construction_date = models.CharField(...)  # Must match key
```

### "Dropdown options not saving correctly"

**Cause:** The `value` strings in `ontologyEnums` don't match Django `choices` values.

**Fix:** Make them identical:
```typescript
// Frontend
{ value: "SiGuthi", label: "Si Guthi" }
```
```python
# Backend
('SiGuthi', 'Si Guthi')  # First element must match frontend value
```

### "New field doesn't appear on the form"

**Cause:** Field is missing from the `fields` array in the registry, or it has `section` pointing to a non-existent section key.

**Fix:** Ensure the field's `section` value matches one of the entries in the `sections` array.

### "API returns 400 Bad Request with field errors"

**Cause:** Required field validation mismatch between frontend and backend.

**Fix:** If a field is `required: true` in the registry, it needs `blank=False` (default) in Django. If a Django field has `blank=True`, the registry field should not be `required: true`.

### "New entity type shows 404 on API calls"

**Cause:** Missing URL registration in `urls.py`.

**Fix:** Ensure `router.register(r'your_endpoint', YourViewSet)` is in `heritage_graph/apps/cidoc_data/urls.py`, and the `apiEndpoint` in the registry matches (e.g., `/cidoc/your_endpoint/`).

---

## 15. Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview and getting started |
| [AGENTS.md](AGENTS.md) | AI agent instructions — project overview, critical rules, API summary |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design diagrams — network, auth flow, data models |
| [AUTH.md](AUTH.md) | Authentication system — NextAuth + Google OAuth + Django token verification |
| [CLAUDE.md](CLAUDE.md) | Coding conventions for Python/Django and TypeScript/Next.js |
| [CONVENTIONS.md](CONVENTIONS.md) | Naming rules, import ordering, file organization |
| [SKILLS.md](SKILLS.md) | Feature capability matrix with file-level mappings |
| [PLATFORM_PLAN.md](PLATFORM_PLAN.md) | Contributing platform vision and phased roadmap |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker deployment, production config, SSL |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues, debugging tips |
| [contributing.md](contributing.md) | Contributor instructions |

---

## TL;DR — Cheat Sheet

| I want to... | Do this |
|--------------|---------|
| Add a text field | Add to `fields[]` in `registry.ts` + Django model |
| Add a dropdown | Add enum to `enums.ts`, reference in field's `options` |
| Add a form section | Add to `sections[]` in the class definition |
| Add a new entity type | Follow [Section 7](#7-how-to-add-a-completely-new-entity-type) (8 steps) |
| See all entity types | Check `ontologyClasses` export in `registry.ts` |
| Change form layout | Edit `sections` and field `order` values |
| Add table column | Add to `columns[]` in the class definition |
| Build a complex wizard | Use `StepWizard` + `TypePicker` components |
