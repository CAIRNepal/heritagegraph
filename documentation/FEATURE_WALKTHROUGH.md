# HeritageGraph — Feature Walkthrough (Presentation Guide)

> **Purpose:** A demo-ready, plain-language walkthrough of HeritageGraph's headline
> functionalities — the **contribution form**, the **graph visualization** surfaces, and the
> **3D / immersive** experiences. For each feature: *what the audience sees*, *how it works
> under the hood*, *the technology*, and *talking points / why it matters*.
>
> Pairs with [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) (the architecture map). Use this
> doc to drive a live demo or slide deck.

---

## At a glance — the five surfaces to demo

| # | Feature | Route | Tech | One-liner |
|---|---------|-------|------|-----------|
| 1 | **Contribution Form** | `/contribute/<domain>` | React + ontology registry | Ontology-driven, multi-step form that turns a person's knowledge into valid graph data |
| 2 | **Graph View** (global) | `/graphview` | Cytoscape.js | The whole knowledge graph as an explorable network |
| 3 | **Entity Neighborhood** | `/knowledge/<domain>/view/<id>/graph` | D3 / SPARQL | One entity and everything connected to it |
| 4 | **Heritage Museum** (immersive) | `/heritage-museum` | D3 + Three.js + narration | A guided, story-driven, 360° museum tour of the graph |
| 5 | **Atlas** (3D globe) | `/atlas` | Cesium + Resium | Heritage placed in space *and* time on a 3D Earth |

---

## 1. The Contribution Form — "knowledge in, graph out"

**Component:** [ontology-form.tsx](../heritage_graph_ui/src/components/ontology-form.tsx)
· wrapper [ContributeOntologyForm.tsx](../heritage_graph_ui/src/components/contribute/ContributeOntologyForm.tsx)

### What the audience sees
A clean, **multi-step (wizard) form** for a chosen heritage domain — Person, Festival,
Monument, Deity, Guthi, Kumari tenure, and ~25 more. A progress bar and step navigation
across the top, a **completeness meter**, inline help, and a live preview of the structured
record being built.

### How it works (the key idea)
The form is **not hand-coded per domain**. It is *generated* from the **ontology registry**:

```
LinkML schema registry (backend)
        │  codegen
        ▼
registry.generated.json / .ts  (shipped to the frontend)
        │  read at runtime
        ▼
ontology-form.tsx  →  renders fields, sections, types, validation
```

So when the ontology gains a new class or field, the form updates **automatically** — no
new UI code. One source of truth drives both the backend serializers and the frontend form.

### Features worth showing live
- **Multi-step sections** with progress + completeness meter (`progress-bar`, `step-nav`,
  `completeness-meter`).
- **Typed fields** rendered from the schema: text, textarea, select/enum, switch, checkbox,
  **entity search** (link to existing graph entities, not free text), and a **geo-point
  field** for coordinates.
- **Draft autosave & resume** — work is saved locally (`form-drafts.ts`,
  `contribute-resume.ts`) so a half-finished contribution survives a refresh.
- **Live JSON-LD / graph preview** — `deriveFormGraph` + `formGraphToJsonLd` show the
  contributor the actual RDF *triples* their form will produce
  ([form-graph-preview.tsx](../heritage_graph_ui/src/components/ontology-form/form-graph-preview.tsx)).
- **Client-side validation against the registry schema**
  (`validatePayloadAgainstRegistrySchema`, `validateRequiredFields`) before submit.

### What happens on submit
```
Form data → POST /api/v1/… (Bearer token)
          → CulturalEntity + Revision (PostgreSQL — system of record)
          → enters the review workflow (draft → pending_review → accepted)
          → on accept, projected into the Oxigraph knowledge graph
```

### Talking points (why it matters)
- **Ontology-driven = scalable & consistent.** Domain experts evolve the schema; the form
  follows. No drift between data model and UI.
- **Entity-linking, not free text.** Linking to existing entities is what makes it a *graph*,
  not a spreadsheet.
- **Contributors see the graph they're building** (JSON-LD preview) — demystifies "linked
  data" for non-technical users.
- **Quality is guarded by the review workflow** — every contribution is human-reviewed
  before it reaches the public graph.

---

## 2. Graph View (global) — "the whole knowledge graph"

**Route:** [/graphview](../heritage_graph_ui/src/app/(dashboard)/graphview/) ·
client [graphview-client.tsx](../heritage_graph_ui/src/app/(dashboard)/graphview/graphview-client.tsx)

### What the audience sees
An interactive **network diagram**: nodes are heritage entities (people, places, events,
monuments…), edges are CIDOC-CRM relationships. Pan, zoom, click a node to highlight its
**neighborhood**, fade the rest, and inspect details.

### How it works
- Rendered with **Cytoscape.js**, loaded **dynamically with SSR off** (`next/dynamic`) so the
  heavy graph engine never blocks the initial page.
- Layout engines: **cose-bilkent** (force-directed) and **cola** are registered as plugins
  (`cytoscape.use(...)`) for organic, readable arrangements.
- Data comes from the backend: `fetchInstanceGraphData` (the entities + relationships) and
  `fetchForkEdges` (contribution lineage), against `NEXT_PUBLIC_API_URL`.
- Interaction: clicking calls `node.closedNeighborhood()` and toggles `highlighted` / `faded`
  classes to focus attention.

### Talking points
- **This is the product made visible** — the value proposition of a knowledge graph in one
  screen.
- **Performance-conscious**: lazy-loaded, client-only, so the rest of the app stays fast.
- **Fork edges** show provenance/lineage — who built on whose contribution.

---

## 3. Entity Neighborhood — "one thing and its world"

**Route:** `/knowledge/<domain>/view/<id>/graph` (e.g.
[knowledge/entity/view/[id]/graph](../heritage_graph_ui/src/app/(dashboard)/knowledge/entity/view/))

### What the audience sees
From any entity's detail page, a focused mini-graph showing *that* entity at the center and
its directly connected entities and relationships.

### How it works
Backed by the **KG engine's neighborhood endpoint** (`GET /cidoc/kg/neighborhood/?uri=…`),
which returns inbound/outbound edges in the public graph from **Oxigraph (SPARQL)**. Rendered
as a D3 force layout with type-colored nodes.

### Talking points
- Demonstrates the **SPARQL-backed graph** powering the UI — not a static dump, a live query.
- Natural drill-down path: browse list → entity page → its graph → click a neighbor → repeat.

---

## 4. Heritage Museum — the immersive, story-driven experience

**Route:** [/heritage-museum](../heritage_graph_ui/src/app/(dashboard)/heritage-museum/)
· also a standalone app in [visual_story_museum_kg/](../visual_story_museum_kg/)

This is the **showpiece**: it turns the knowledge graph into a guided, cinematic tour.

### What the audience sees
1. A glowing **force-directed graph** of heritage entities (type-colored, with glow filters).
2. A **filter bar** and a **timeline strip** to move through eras.
3. A **story panel** that narrates each entity as a sequence of **"beats"** (auto-advancing
   slides, ~10s each, pause/resume).
4. Click an entity with a panorama → enter an **immersive 360° scene**.

### How it works
- **Graph rendering:** `ForceGraph.tsx` / `KnowledgeGraph.tsx` use **D3** force simulation
  with SVG glow filters and radial gradients per node type (`NODE_TYPE_CONFIG`).
- **Storytelling:** `storyBeats.ts` (`buildBeats`) turns an entity's data into narrative
  beats; `StoryPanel` + `TimelineStrip` auto-advance with `requestAnimationFrame`.
- **360° panorama (the 3D part):** `xr/PanoramaViewer.tsx` uses **Three.js** to map a
  spherical photo onto the inside of a sphere — the user looks around a heritage site.
  `xr/ImmersiveScene.tsx` orchestrates it (dynamically imported, SSR off) with a
  **storytelling overlay** and `PlaceNav` for moving between places.
- **Narration:** the browser's **Web Speech API** (`SpeechSynthesisUtterance`) reads the
  story text aloud (en-GB voice) — no external TTS service needed.
- **MandalaLoader** — a themed loading animation that sets the cultural tone.

### Talking points
- **Heritage deserves storytelling, not just tables.** This is the emotional, public-facing
  face of the data.
- **All 3D/narration runs in the browser** — Three.js + Web Speech API, zero server cost,
  works offline-ish.
- **Same data, two audiences:** researchers use Graph View; the public gets the Museum.
- Performance: panorama and immersive scene are **lazy-loaded client components**, so they
  only cost when entered.

---

## 5. Atlas — heritage in space *and* time (3D globe)

**Route:** [/atlas](../heritage_graph_ui/src/app/(dashboard)/atlas/) ·
globe [components/globe.tsx](../heritage_graph_ui/src/app/(dashboard)/atlas/components/globe.tsx)

### What the audience sees
A photorealistic **3D Earth** you can spin and zoom, with heritage entities pinned at their
real coordinates. A **timeline** filters what's shown by era, a **city jump bar** flies the
camera to a place, and a **spotlight** mode highlights selected entities. Clicking a pin opens
an **entity panel** with provenance.

### How it works
- Built on **CesiumJS** (the open-source 3D-geospatial engine) via **Resium** (its React
  bindings) — `Viewer`, `Entity`, camera controllers.
- Cesium's static assets (workers, widgets) are copied into `public/` at build time
  (`copy-cesium-assets.mjs`, run in `predev`/`prebuild`/`postinstall`); a `cesium-assets-gate`
  ensures they're present before render.
- **Temporal dimension:** `atlas-time-extents.ts` + `temporalGlobeAlpha` fade entities in/out
  as you scrub the **timeline** — heritage appears/disappears across history.
- Entity pins are colored by **ontology class** (`colorForOntologyClass`); labels use
  distance-based scaling so the globe stays readable.
- **Accessibility/perf:** respects reduced-motion (`atlasPrefersReducedMotion`), keyboard
  shortcuts (`use-atlas-shortcuts`), fullscreen, and an error boundary.
- Data is the same heritage graph, served with coordinates + time extents from the backend.

### Talking points
- **Two extra dimensions the network graph can't show: geography + time.** Where and *when*.
- **Open-source 3D** (Cesium) — no proprietary map dependency; assets self-hosted.
- Scrubbing the timeline to watch sites appear across centuries is the **"wow" moment** of the
  demo.

---

## Suggested demo flow (≈ 6 minutes)

1. **Contribute** (1.5 min) — open `/contribute/festival`, fill a couple of steps, show the
   completeness meter, the entity-search link, and the **live JSON-LD preview** ("this is the
   graph you're building"). Mention entity-linking and draft autosave.
2. **Graph View** (1 min) — open `/graphview`, pan/zoom, click a node to focus its
   neighborhood. "This is the whole knowledge graph."
3. **Entity Neighborhood** (0.5 min) — from one entity's page, open its `/graph` to show the
   SPARQL-backed drill-down.
4. **Heritage Museum** (1.5 min) — open `/heritage-museum`, let a story beat play, enter a
   **360° panorama**, let the narration speak. "Same data, public storytelling."
5. **Atlas** (1.5 min) — open `/atlas`, fly to a city, **scrub the timeline** to show
   heritage across eras. Close on the 3D globe.

---

## Technology cheat-sheet (for Q&A)

| Surface | Library | Why this choice |
|---------|---------|-----------------|
| Contribution form | React + generated ontology registry | One schema source → forms never drift from the ontology |
| Global graph | **Cytoscape.js** (+ cose-bilkent, cola) | Mature graph rendering + good layout plugins; lazy-loaded |
| Neighborhood / museum graph | **D3** force simulation | Fine-grained control over visuals (glow, gradients, beats) |
| 3D globe | **Cesium** + **Resium** | Open-source, accurate 3D geospatial + time-dynamic entities |
| 360° immersive | **Three.js** | Browser-native WebGL panorama, no server render cost |
| Narration | **Web Speech API** | Built into the browser; zero external TTS dependency |
| Data source | Django REST + **Oxigraph SPARQL** | Postgres is system of record; the graph is queried live |

All heavy/visual surfaces are **dynamically imported with SSR disabled**, so they load on
demand and never slow the core app.
