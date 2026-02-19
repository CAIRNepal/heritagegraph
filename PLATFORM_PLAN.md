# HeritageGraph Platform Plan

> A CivicDB-style contributing platform for cultural heritage data, built on an event-centric LinkML ontology aligned with CIDOC-CRM and PROV-O.

---

## 1. Vision

HeritageGraph is a **community-driven knowledge platform** where researchers, conservationists, community members, and cultural practitioners contribute structured cultural heritage data. Every contribution is a **provenance-tracked assertion** — not just a database entry — enabling scholarly citation, conflict resolution, and transparent data lineage.

**Inspiration:** CivicDB's model of community-sourced, expert-reviewed civic data — adapted for Nepal's cultural heritage domain.

---

## 2. Core Platform Principles

### Progressive Disclosure
Contributors never see the full ontology. They interact through **contribution intents** ("I want to record a structure") that map to guided multi-step forms assembling the underlying CIDOC-CRM classes invisibly.

### Assertion-First Architecture
Every contribution silently creates a `HeritageAssertion` wrapping the contributed data with source, confidence, author, and timestamp. This is the foundation for conflict resolution, versioning, and scholarly provenance.

### Event-Centric Data Model
All relationships flow through events. A temple is not "built by King X" — rather, a `Production` event links the temple, the king, and a timespan. This aligns with CIDOC-CRM's event-based reasoning.

### Search-and-Link, Not Free Text
Relational fields (deity, Guthi, place) always search existing records first. Free text only if nothing matches, which then queues a new record creation. This prevents duplicate entities.

---

## 3. Contribution Intents

```
"I want to..."
├── 🏛️ Record a Structure / Monument
├── 🔥 Document a Ritual or Festival
├── ✨ Add a Deity
├── 🏘️ Register a Guthi Organization
├── 📋 Submit a Field Survey / Condition Report
├── 📚 Add a Source / Document
├── 👤 Record a Historical Person
└── 🗺️ Add a Place / Location
```

Each maps to a **guided multi-step form** with an assertion wrapper.

---

## 4. Implementation Phases

### Phase 1 — Foundation (Current Sprint)

**Backend — Provenance Models:**
- `HeritageAssertion` model — source, confidence, author, timestamp
- `DataSource` model — citation, URL, type, language
- Add `assertion` FK to all existing cidoc_data models
- API endpoints for assertion CRUD and conflict detection

**Frontend — Contribution Hub Redesign:**
- Redesign `/dashboard/contribute` as intent-based card picker with icons
- Multi-step form wizard component (replaces single-page ontology-form)
- Assertion wrapper component (source + confidence — bottom of every form)
- Step indicator / progress bar component

**Frontend — Structure Form (Priority):**
- Step 1: Structure type (visual card picker)
- Step 2: Identity (name, multilingual, existence status)
- Step 3: Location (map picker + place name)
- Step 4: Construction (maps to Production event)
- Step 5: Condition (maps to ConditionAssessment)
- Step 6: Relationships (deity, Guthi, elements — search-and-link)

### Phase 2 — Record Pages & Events

**Frontend — Record Pages:**
- Structure detail page with tabs (About, Events, Network, Claims)
- Timeline view for linked events
- Claims tab showing provenance assertions

**Frontend — Ritual/Festival Forms:**
- Ritual type picker (grouped categories)
- Temporal fields (recurrence, lunar tithi, calendar system)
- Route builder for procession rituals
- Performer/Guthi linking

### Phase 3 — Advanced Features

- Syncretic relationship forms with theological caveats
- Living Goddess (Kumari) tenure tracking
- Calendar conversion (Gregorian ↔ Nepal Sambat ↔ Vikram Sambat)
- ~~Conflict detection and reconciliation UI~~ ✅ Implemented (triaged review queue + conflict resolution page)
- ~~Expert verification workflow~~ ✅ Implemented (3-persona reviewer roles + three-panel review workspace)
- Mobile-first field survey mode
- Reviewer notifications (review system backend exists, notification wiring planned)

---

## 5. Data Flow Architecture

```
Contributor fills form
        │
        ▼
┌─────────────────────┐
│  Multi-Step Wizard   │  (progressive disclosure)
│  + Assertion Wrapper │  (source, confidence, author)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  API: POST /cidoc/   │  Entity data + assertion metadata
│  structures/         │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Django Backend      │
│  ├─ Create entity    │
│  ├─ Create assertion │
│  ├─ Check conflicts  │
│  └─ Queue for review │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Moderation Queue    │  Curator reviews
│  /curation/          │
└─────────────────────┘
```

---

## 6. Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Form engine | Custom multi-step wizard | Generic ontology-form is too flat for progressive disclosure |
| State management | React useState + step index | Simple, no external state library needed |
| Map component | Leaflet via react-leaflet | Free, OSM tiles, good for pin-dropping |
| Calendar conversion | Client-side utility | Nepal Sambat/Vikram Sambat offset computation |
| Conflict detection | Backend query on save | Check existing assertions for same entity+property |
| Mobile field surveys | Responsive wizard + camera API | Same codebase, mobile-optimized layout |

---

## 7. File Structure (New Files)

```
heritage_graph/apps/cidoc_data/
├── models.py                    # + HeritageAssertion, DataSource models
├── serializers.py               # + nested assertion serializers
├── views.py                     # + assertion-aware viewsets
└── urls.py                      # + assertion endpoints

heritage_graph_ui/src/
├── components/
│   ├── contribute/
│   │   ├── step-wizard.tsx          # Multi-step form container
│   │   ├── step-indicator.tsx       # Progress bar
│   │   ├── assertion-wrapper.tsx    # Source + confidence fields
│   │   ├── type-picker.tsx          # Visual card-based type selector
│   │   ├── location-picker.tsx      # Map pin-drop component
│   │   ├── entity-search.tsx        # Search-and-link for relations
│   │   └── calendar-display.tsx     # Multi-calendar date display
│   └── records/
│       ├── record-page.tsx          # Tabbed entity detail page
│       ├── event-timeline.tsx       # Vertical timeline of events
│       ├── claims-panel.tsx         # Assertion provenance viewer
│       └── network-graph.tsx        # Cytoscape entity graph
├── app/dashboard/contribute/
│   ├── page.tsx                     # Redesigned intent-based hub
│   ├── structure/page.tsx           # Multi-step structure form
│   ├── ritual/page.tsx              # Multi-step ritual form
│   ├── deity/page.tsx               # Multi-step deity form
│   └── guthi/page.tsx               # Multi-step Guthi form
└── lib/ontology/
    ├── enums.ts                     # + new enum values
    └── registry.ts                  # Updated with new fields
```

---

## 8. API Contracts (Phase 1)

### POST /cidoc/structures/ (enhanced)
```json
{
  "name": "Pashupatinath Temple",
  "structure_type": "Temple",
  "architectural_style": "Pagoda",
  "location_name": "Kathmandu",
  "coordinates": "27.7104, 85.3488",
  "existence_status": "Extant",
  "condition": "Good",
  "construction_date": "c. 1692 CE",
  "assertion": {
    "source_type": "book",
    "source_citation": "Slusser, Nepal Mandala, 1982",
    "source_url": "",
    "confidence": "likely",
    "data_quality_note": ""
  }
}
```

### GET /cidoc/structures/{id}/ (enhanced response)
```json
{
  "id": 1,
  "name": "Pashupatinath Temple",
  "structure_type": "Temple",
  "assertions": [
    {
      "id": 1,
      "property": "construction_date",
      "value": "c. 1692 CE",
      "source_citation": "Slusser, Nepal Mandala, 1982",
      "confidence": "likely",
      "contributed_by": "user@example.com",
      "created_at": "2025-03-15T10:30:00Z",
      "reconciliation_status": "accepted"
    }
  ],
  "linked_events": [...],
  "linked_deities": [...],
  "linked_guthis": [...]
}
```

---

## 9. Success Metrics

- Contributors can submit a complete structure record in < 5 minutes
- Every assertion has a source and confidence level
- Zero duplicate entities from form submissions (search-and-link)
- Moderation queue processes submissions within 48 hours
- Record pages show complete provenance for every claim
