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

Want to add a "Commissioner" field to the Structure form?

1. **LinkML** — In `ontology/HeritageGraph.yaml`, add a slot (e.g. `commissioner`) with `range`, `description`, and `slot_uri` where possible, and list it under `classes.ArchitecturalStructure.slots` (or `slot_usage` as needed).
2. **Django** — Add `commissioner = models.CharField(max_length=200, blank=True)` on the structure model, serializer, and migrations ([Section 12](#12-backend-checklist--django-model-sync)).
3. **Regenerate** — From repo root:

```bash
make generate
```

That runs the full pipeline: ontology → serializers → entityrefs → schema-rebuild. It updates `registry.generated.json`/`.ts`, `serializers.generated.py`, and persists the DB snapshot. Forms and tables that use `OntologyProvider` / `OntologyForm` pick it up after refresh.

Optional: use **slot annotations** (`ui_section`, `ui_order`, etc.) in LinkML for layout; see `heritage_graph/apps/cidoc_data/ontology_builder.py`.

---

## 2. Architecture Overview

HeritageGraph uses a **YAML-driven registry** pattern:

- **LinkML** (`ontology/HeritageGraph.yaml`) defines classes, slots, enums, and RDF URIs.
- **`tools/ui-classmap.yaml`** maps LinkML classes to UI keys, API endpoints, icons, and nav categories.
- **`tools/contribute-hub.yaml`** drives the contribute landing page (categories, copy, routes, quick start).
- **`tools/linkml_generate_registry.py`** + `heritage_graph/apps/cidoc_data/ontology_builder.py` materialize a JSON/TS snapshot (`registry.generated.*`) and the same shape is served by `GET /api/v1/cidoc/schema/registry/`.

The UI reads the effective registry via **`OntologyProvider`** and auto-generates forms, tables, and detail views.

```
   ontology/HeritageGraph.yaml  +  tools/ui-classmap.yaml  +  tools/contribute-hub.yaml
                    │
                    ▼
          ontology_builder.py  /  linkml_generate_registry.py
                    │
                    ├── registry.generated.json  (fallback snapshot)
                    └── Django schema registry API
                                │
              ┌─────────────────┼─────────────────────┐
              │                 │                       │
              ▼                 ▼                       ▼
   ┌──────────────────┐ ┌─────────────────┐  ┌─────────────────────┐
   │  OntologyForm    │ │ Knowledge tables │  │  Record detail view │
   └────────┬─────────┘ └────────┬─────────┘  └─────────────────────┘
            │                    │
            ▼                    ▼
   ┌─────────────────────────────────────────┐
   │  Django REST Framework Backend          │
   │  models.py → serializers.py → views.py │
   └─────────────────────────────────────────┘
```

**Key principle:** Slot **`key`** values in the generated registry **must exactly match** Django model field names because `OntologyForm` sends `{ [field.key]: value }` and DRF's `ModelSerializer` expects those names.

---

## 3. The Ontology Registry (Single Source of Truth)

### Files

| File | Purpose |
|------|---------|
| `ontology/HeritageGraph.yaml` | LinkML schema: classes, slots, enums, URIs |
| `tools/ui-classmap.yaml` | Maps LinkML classes → UI key, `/cidoc/...` endpoint, icon, category |
| `tools/contribute-hub.yaml` | Contribute dashboard: hub categories, intents, quick start |
| `heritage_graph/apps/cidoc_data/ontology_builder.py` | Builds registry payload for API + generator |
| `tools/linkml_generate_registry.py` | Writes `registry.generated.json` / `.ts` (run `make ontology`) |
| `src/lib/ontology/registry.generated.ts` | Committed snapshot; offline / pre-auth baseline |
| `src/lib/ontology/types.ts` | TypeScript interfaces: `OntologyField`, `OntologyColumn`, `OntologyClass`, `ContributeHubPayload` |
| `src/lib/ontology/enums.ts` | Legacy TS enums (optional reference; **select options** come from generated `enums` + inlined `options`) |
| `src/lib/ontology/index.ts` | Barrel re-export |

### Currently Registered Classes

| Key | Label | Category | API Endpoint |
|-----|-------|----------|-------------|
| `entity` | Cultural Entity | tangible | `/data/api/cultural-entities/` |
| `person` | Historical Person | social | `/cidoc/persons/` |
| `location` | Place / Location | spatiotemporal | `/cidoc/locations/` |
| `event` | Historical Event | event | `/cidoc/events/` |
| `period` | Historical Period | spatiotemporal | `/cidoc/historical_periods/` |
| `tradition` | Tradition | conceptual | `/cidoc/traditions/` |
| `source` | Source / Document | provenance | `/cidoc/sources/` |
| `deity` | Deity | conceptual | `/cidoc/deities/` |
| `guthi` | Guthi | social | `/cidoc/guthis/` |
| `structure` | Architectural Structure | tangible | `/cidoc/structures/` |
| `ritual` | Ritual Event | event | `/cidoc/rituals/` |
| `festival` | Festival | event | `/cidoc/festivals/` |
| `iconography` | Iconographic Object | tangible | `/cidoc/iconographic_objects/` |
| `monument` | Monument | tangible | `/cidoc/monuments/` |

---

## 4. How to Add a New Field to an Existing Form

### Step 1 — Edit LinkML (schema)

1. Add a slot under `slots:` in `ontology/HeritageGraph.yaml` (with `range`, `description`, `slot_uri` as appropriate).
2. Add the slot name to `classes.<YourLinkMLClass>.slots` (or `slot_usage` for overrides).
3. Optionally set slot annotations `ui_section`, `ui_order`, `ui_placeholder`, `ui_widget` (see `ontology_builder._slot_ui_overrides`).
4. Run `make generate` and commit the generated files.

### Step 2 — Columns (optional)

By default the builder emits columns from the first fields. To override, use a **class annotation** `ui_columns` (JSON string) on the LinkML class — see `ontology_builder._class_ui_overrides`.

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

### Step 1 — Define the enum in LinkML

In `ontology/HeritageGraph.yaml`, under `enums:`, add `permissible_values` with optional `title` / `description` per value. Set the slot’s `range` to that enum name.

### Step 2 — Regenerate

```bash
make generate
```

The builder emits the enum under `registry.enums` and inlines **`options`** on each `select` field whose range is that enum.

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

Sections group related fields under collapsible accordion headers.

1. Prefer **slot annotations** `ui_section` and `ui_order` on each slot in LinkML (see `ontology_builder`).
2. Alternatively set a **class annotation** `ui_sections` (JSON array) on the LinkML class for full control.
3. Run `make generate`.

When a class has **more than one** section, `OntologyForm` renders a **multi-step flow** (one section per step): progress, step navigation, Next/Previous, and a single Submit on the last step.

### URL steps (`?step=`)

- The active step is reflected in the query string: **`?step=<section_key>`** (the `key` from the class `sections` array, or from slot `ui_section`).
- You may also use a **numeric index** (`?step=0`) for the same section order; the UI normalizes the URL to the canonical section key.
- Invalid or missing `step` values fall back to the **first** section and update the URL accordingly (works with browser Back/Forward).

### Local drafts (new entries only)

- For **new** contributions (no `?id=`), field values are **autosaved** to `localStorage` (debounced) under a key derived from user identity + ontology class key.
- Reloading the page restores the draft once per key (deduped toast).
- **Edit mode** (`?id=`) does not read or write local drafts (server record is the source of truth).
- Successful **Submit** or **Clear** removes the draft for that key.

---

## 7. How to Add a Completely New Entity Type

This is the most involved task. Here's the full checklist:

### Step 1 — LinkML + UI classmap

1. Add a **class** (and its slots) in `ontology/HeritageGraph.yaml`.
2. Add a row to **`tools/ui-classmap.yaml`**: `linkml`, `key` (URL route segment / registry key), `apiEndpoint` (must match `heritage_graph/apps/cidoc_data/urls.py`), `label`, `category`, `icon`, `navigable`.
3. Optionally add **intents** to `tools/contribute-hub.yaml` if the type should appear on the contribute dashboard.
4. Run `make generate`.

### Step 2 — Django

Add `Model`, `Serializer`, `ViewSet`, `router.register(...)`, and migrations.

### Step 3 — Create page stubs (Frontend)

**Knowledge list page** — `src/app/(dashboard)/knowledge/inscription/page.tsx`:

```tsx
"use client";
import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function InscriptionKnowledgePage() {
  const cls = getOntologyClass("inscription")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
```

**Contribute form page** — `src/app/(dashboard)/contribute/inscription/page.tsx`:

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
| `select` | `<Select>` dropdown | Requires `options` array (inline or from `registry.enums`) |
| `url` | `<Input type="url">` | URL input with https:// placeholder |
| `coordinates` | Two `<Input>` (lat/lng) | Side-by-side lat/lng, serialized as `"lat, lng"` string |
| `geo_point` | `GeoPointField` (Leaflet + lat/lng + GPS) | OSM tiles with click-to-set; manual inputs + **Use my GPS**; offline-safe fallback is the lat/lng inputs |
| `edtf_date` | `<Input>` + quick-pick chips | EDTF-style strings plus one-tap chips (e.g. century span, “c. 1200 CE”); refine manually |
| `media` | `<input type="file" capture>` + EXIF | Fieldwork-oriented multi-image picker; **exifr** reads GPS when present (toast hint); wire uploads to your `Media` API when available |
| `boolean` | `Switch` toggle | Native boolean values in the payload |
| `multiselect` | Checkbox group | Multivalued enum slots |
| `relation` | `EntitySearch` | Autocomplete against `relationEndpoint`; multivalued supported |
| `float` | `<Input type="number">` (step any) | Decimal values |

**Client validation:** `OntologyForm` merges **Ajv** (`registry_jsonschema`) errors with required-field checks (`useValidation.ts`). **Server validation:** `ContributionFlowMixin` runs `validate_payload_for_class_drf` on create/update.

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

## 11. Registry-driven forms vs optional custom wizards

**Current default:** Structure, Ritual, and all other CIDOC entity contribute routes use **`ContributeOntologyForm` → `OntologyForm`**, driven by the generated registry (`ontology/HeritageGraph.yaml` + `tools/ui-classmap.yaml`). Multi-section types use the built-in step navigation inside `OntologyForm` when a class defines multiple `sections`.

**OCR on any contribute route:** append **`?ce=<cultural_entity_uuid>`** to a contribute URL (e.g. `/contribute/structure?ce=…`) to mount `HeritageDocumentUpload` inside `OntologyForm` and merge suggestions into empty fields. The **`/contribute/entity`** page uses **`?id=`** for edit mode (CIDOC / wrapper id) and **`?ce=`** specifically for the OCR cultural-entity UUID.

**Optional building blocks** for bespoke flows (new features, not used by default routes today):

| Component | File | Purpose |
|-----------|------|---------|
| `StepWizard` | `src/components/contribute/step-wizard.tsx` | Multi-step container with Back/Next/Submit |
| `StepIndicator` | `src/components/contribute/step-indicator.tsx` | Progress bar |
| `TypePicker` | `src/components/contribute/type-picker.tsx` | Visual card-based type selector |
| `AssertionWrapper` | `src/components/contribute/assertion-wrapper.tsx` | Source + confidence fields |
| `EntitySearch` | `src/components/contribute/entity-search.tsx` | Search-and-link for relations |

Use these when you need provenance-heavy or highly custom UX; keep field definitions in LinkML so the registry remains the contract for validation and API shape.

**Cultural entities** (`contribute/entity`) use the same `OntologyForm` with the `entity` class from the registry (`CulturalEntity` in LinkML, API `/data/api/cultural-entities/`).

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

1. ✅ Slot / field `key` in the generated registry matches `field_name` in Django model
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
| `ontology/HeritageGraph.yaml` + `tools/ui-classmap.yaml` | **Single source of truth** for generated registry |
| `src/lib/ontology/index.ts` | Barrel re-exports |
| `src/components/ontology-form.tsx` | Generic auto-generated contribute form (Ajv, completeness meter, OCR, assist) |
| `src/components/ontology-form/geo-point-field.tsx` | Leaflet map + GPS for `geo_point` |
| `src/components/ontology-form/completeness-meter.tsx` | Required / weighted optional completeness |
| `src/components/ontology-form/step-nav.tsx` | Section stepper (mobile short labels) |
| `src/lib/ontology/form-drafts.ts` | IndexedDB-backed drafts (`idb-keyval`) with localStorage migration |
| `src/lib/ontology/validate-registry-payload.ts` | Ajv validation against `registry_jsonschema` |
| `src/components/pwa-register.tsx` | Registers `/public/sw.js` in production |
| `src/components/knowledge/why-we-believe-panel.tsx` | Public “Why we believe this” assertions panel |
| `src/app/(dashboard)/review/page.tsx` | Reviewer workspace (queue + bulk open) |
| `src/components/ontology-data-table.tsx` | Generic auto-generated knowledge data table |
| `src/components/contribute/step-wizard.tsx` | Multi-step form container |
| `src/components/contribute/step-indicator.tsx` | Step progress bar |
| `src/components/contribute/type-picker.tsx` | Visual type selector cards |
| `src/components/contribute/assertion-wrapper.tsx` | Source + confidence provenance fields |
| `src/components/contribute/entity-search.tsx` | Entity search-and-link component |
| `src/app/(dashboard)/contribute/<domain>/page.tsx` | Per-domain contribute page stubs |
| `src/app/(dashboard)/knowledge/<domain>/page.tsx` | Per-domain knowledge table page stubs |
| `src/app/(dashboard)/knowledge/[domain]/view/[id]/page.tsx` | Generic entity detail/record view |

### Backend (Django API)

| File | Role |
|------|------|
| `heritage_graph/apps/cidoc_data/models.py` | All entity Django models |
| `heritage_graph/apps/cidoc_data/serializers.py` | DRF serializers for all entities |
| `heritage_graph/apps/cidoc_data/views.py` | DRF ViewSets, SPARQL proxy, assist, **CIDOC revert** (`CidocRevertView`), registry validation mixin |
| `heritage_graph/apps/cidoc_data/urls.py` | Router URL registration + `sparql/`, `assist/suggest-field/`, `<resource>/<pk>/revert/` |
| `heritage_graph/apps/cidoc_data/rdf_signals.py` | Optional Oxigraph SPARQL Update on save |
| `heritage_graph/apps/heritage_data/views.py` | `RevisionDiffView` (field diffs + metadata), `RevisionViewSet` (`?entity=` filter) |

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

## 📄 Form Pre-Population from OCR Documents

> **New Feature:** HeritageGraph can automatically extract and pre-fill form fields from uploaded documents (PDFs, images, handwritten notes) using OCR and NER.

When a user uploads a document alongside a contribution form:
1. The OCR pipeline processes the document asynchronously (Tesseract, EasyOCR, TrOCR, Claude Vision)
2. Named Entity Recognition (NER) extracts structured data (persons, locations, dates, artifacts, events, traditions)
3. Extracted entities are mapped to registry field names
4. Form shows extracted values with **confidence badges** (high/medium/low)
5. User can edit extracted text or accept as-is before submitting

**For Developers:**
- Extracted fields are stored in `ExtractedField` Django model (`heritage_graph/apps/document_processing/models.py`)
- API endpoint (TODO Phase 4): `GET /data/documents/<doc_id>/extracted-fields/` returns pre-fill structure
- Frontend integration (TODO Phase 4): Components in `heritage_graph_ui` will fetch and display suggestions
- Field mapping uses registry `key` values to match NER entities to form fields

**See Also:**
- [OCR_INTEGRATION_SUMMARY.md](OCR_INTEGRATION_SUMMARY.md) — Full pipeline architecture and implementation guide
- [AGENTS.md](AGENTS.md) — `📄 OCR & Document Processing Pipeline` section

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
| [OCR_INTEGRATION_SUMMARY.md](OCR_INTEGRATION_SUMMARY.md) | **NEW** OCR document processing — auto-populate forms from documents |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues, debugging tips |
| [contributing.md](contributing.md) | Contributor instructions |

---

## TL;DR — Cheat Sheet

| I want to... | Do this |
|--------------|---------|
| Add a text field | Add LinkML slot + class slots; `make ontology`; Django model |
| Add a dropdown | Add enum to `enums.ts`, reference in field's `options` |
| Add a form section | Add to `sections[]` in the class definition |
| Add a new entity type | Follow [Section 7](#7-how-to-add-a-completely-new-entity-type) (8 steps) |
| See all entity types | Inspect `registry.generated.json` or `tools/ui-classmap.yaml` |
| Change form layout | Edit `sections` and field `order` values |
| Add table column | Add to `columns[]` in the class definition |
| Build a complex wizard | Use `StepWizard` + `TypePicker` components |
