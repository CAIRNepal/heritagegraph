# HeritageGraph — Feature Walkthrough (Presentation Guide)

> **Purpose:** A demo-ready, *detailed* walkthrough of HeritageGraph's headline
> functionalities — the **contribution form**, the **graph visualization** surfaces, and the
> **3D / immersive** experiences. For each feature you get: the **stack**, the **data flow**,
> **how it works step by step**, **why that stack was chosen**, and **talking points**.
>
> Pairs with [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) (the architecture map). Use this
> doc to drive a live demo or a slide deck.

---

## Contents

1. [The frontend stack (shared foundation)](#0-the-frontend-stack-shared-foundation)
2. [Feature map — what to demo](#feature-map--the-five-surfaces)
3. [Contribution Form](#1-the-contribution-form--knowledge-in-graph-out)
4. [Graph View (global network)](#2-graph-view-global--the-whole-knowledge-graph)
5. [Entity Neighborhood](#3-entity-neighborhood--one-thing-and-its-world)
6. [Heritage Museum (immersive + 3D panorama)](#4-heritage-museum--the-immersive-story-driven-experience)
7. [Atlas (3D globe)](#5-atlas--heritage-in-space-and-time-3d-globe)
8. [Suggested demo flow](#suggested-demo-flow--6-minutes)
9. [Technology cheat-sheet (Q&A)](#technology-cheat-sheet-for-qa)

---

## 0. The frontend stack (shared foundation)

Every feature below sits on the same foundation, so it's worth stating once.

| Layer | Choice | Version | Why this choice |
|-------|--------|---------|-----------------|
| Framework | **Next.js (App Router)** | 15.5 | File-based routing, React Server Components, route-group layouts, built-in code-splitting. The App Router lets us keep heavy visual code in *client islands* while the shell stays light. |
| UI runtime | **React** | 19.1 | Industry standard; concurrent features; huge ecosystem. |
| Auth | **NextAuth v4** + Google OAuth | 4.24 | Session handling on the edge; the **Google ID token** is forwarded to Django as a Bearer token — no separate auth server to run. |
| Styling | **Tailwind CSS v4** + **shadcn/ui** ("new-york") | 4.1 | Utility-first = consistent design with no bespoke CSS; shadcn gives accessible primitives we wrap, not fork. Colors live in `globals.css` (tweakcn variables). |
| Client state | **Zustand** | 5.0 | Tiny, hook-based store. Used heavily by the Atlas (camera, filters, timeline) where Redux would be overkill. |
| Validation | **Zod** | 4.0 | Schema validation shared between form payloads and the ontology registry schema. |
| Toasts / feedback | **Sonner** | 2.0 | Lightweight notifications (`toast.success/error`). |
| Animation | **Framer Motion** | 12.x | Step transitions in forms, story-panel motion. |
| Graph rendering | **Cytoscape.js** & **D3** | 3.33 / 7.9 | Two tools for two jobs — see §2 and §4. |
| 3D | **Three.js** & **Cesium + Resium** | 0.184 / 1.123 | 360° panoramas vs. a 3D globe — see §4 and §5. |

### Cross-cutting patterns (the same everywhere)

- **Ontology-registry codegen is the backbone.** The backend's LinkML schema is generated
  into `registry.generated.json/.ts` (consumed at runtime by
  [OntologyProvider](../heritage_graph_ui/src/lib/ontology/OntologyProvider.tsx)) and into a
  visualization config (`tools/gen_heritage_viz_config.py` → `heritage-viz-config`) that
  drives node colors, icons, and relation labels. **One schema → forms *and* visualizations.**
- **Heavy/visual surfaces are `dynamic(..., { ssr: false })`.** Cytoscape, Cesium, and the
  Three.js panorama never run on the server and never block first paint — they load as a lazy
  client island with a loading fallback.
- **API calls carry the Bearer token.** `process.env.NEXT_PUBLIC_API_URL` + `Authorization:
  Bearer <session.accessToken>` via a shared `apiFetchJson` / `fetchAllPages` helper that
  handles pagination and aborts.
- **Demo-first, live-on-demand.** The richest visual surfaces (Atlas, Museum) ship a curated
  **demo corpus** so they look great instantly, with a one-click **toggle to the live CIDOC
  graph**. Great for presentations — never a blank screen.

---

## Feature map — the five surfaces

| # | Feature | Route | Renderer | Data source | One-liner |
|---|---------|-------|----------|-------------|-----------|
| 1 | **Contribution Form** | `/contribute/<domain>` | React + ontology registry | REST (CIDOC / cultural-entities) | Ontology-driven wizard that turns knowledge into valid graph data |
| 2 | **Graph View** (global) | `/graphview` | Cytoscape.js | REST: all CIDOC types + accepted assertions | The whole knowledge graph as an explorable network |
| 3 | **Entity Neighborhood** | `/knowledge/<domain>/view/<id>/graph` | D3 | KG neighborhood endpoint | One entity and everything connected to it |
| 4 | **Heritage Museum** | `/heritage-museum` | D3 + Three.js + Web Speech | Demo corpus / live toggle | Guided, story-driven, 360° museum tour of the graph |
| 5 | **Atlas** | `/atlas` | Cesium + Resium | Demo corpus / live toggle | Heritage placed in space *and* time on a 3D Earth |

---

## 1. The Contribution Form — "knowledge in, graph out"

**Code:** [ontology-form.tsx](../heritage_graph_ui/src/components/ontology-form.tsx) ·
wrapper [ContributeOntologyForm.tsx](../heritage_graph_ui/src/components/contribute/ContributeOntologyForm.tsx) ·
registry [OntologyProvider.tsx](../heritage_graph_ui/src/lib/ontology/OntologyProvider.tsx)

### Stack
React client component · ontology registry (`registry.generated.ts` + live merge) · shadcn
form primitives · Framer Motion (step transitions) · Zod (registry-schema validation) ·
Sonner (feedback) · `localStorage` (draft autosave).

### The core idea
The form is **not hand-coded per domain**. There are ~30 contribution domains (Person,
Festival, Monument, Deity, Guthi, Kumari tenure/selection/retirement, Caste group, Calendar,
Syncretism, …) and **every one of them renders from the same component**, driven by the
ontology registry:

```
LinkML schema (backend, source of truth)
        │  codegen (build step)
        ▼
registry.generated.json / .ts ──────────────┐
        │                                     │  merged at runtime
        ▼                                     ▼
OntologyProvider (static baseline)  +  live registry fetch (GET schema/registry)
        │
        ▼
ontologyClass = { key, apiEndpoint, sections[], fields[] }
        │
        ▼
ontology-form.tsx renders → fields, steps, types, validation, JSON-LD preview
```

`OntologyProvider` always has a **static baseline** (so the form works instantly and even
offline), then merges a live registry when authenticated; if the live fetch fails it runs in a
labeled **degraded mode** (`snapshot` / `unauthenticated` / …) instead of breaking.

### Step-by-step flow (what happens as a contributor uses it)

1. **Resolve the domain** — the route (`/contribute/festival`) maps to an `ontologyClass` in
   the registry, which carries its `apiEndpoint` (e.g. `/api/v1/cidoc/festivals/`) and its
   `sections[]` / `fields[]`.
2. **Render the wizard** — fields are grouped into **sections**; the current step is driven by
   `?step=` in the URL (`resolveOntologyFormStep`), so steps are deep-linkable and the back
   button works. A **progress bar** + **completeness meter** show how far along they are.
3. **Render typed fields from the schema** — text, textarea, select/enum, switch, checkbox,
   **entity-search** (link to an existing graph entity via that field's `relationEndpoint`),
   and a **geo-point** field with a map for coordinates.
4. **Autosave drafts** — on every change, `saveOntologyFormDraft` writes to `localStorage`
   under a per-class key; on return, the draft is restored with a toast ("Restored your
   draft").
5. **Live JSON-LD / graph preview** — `deriveFormGraph(formData)` turns the entries into a
   small graph (root entity + linked `@id` references), and `formGraphToJsonLd` renders the
   **actual RDF triples** the contribution will produce
   ([form-graph-preview.tsx](../heritage_graph_ui/src/components/ontology-form/form-graph-preview.tsx)).
   The contributor *sees the graph they are building.*
6. **Validate** — required-field checks per section (can't skip ahead with gaps) plus
   `validatePayloadAgainstRegistrySchema` against the registry's JSON-Schema before submit.
7. **Submit** — `buildOntologyFormPayload(fields, formData)` shapes the payload; the form
   `POST`s (or `PUT`s in edit mode) to `${NEXT_PUBLIC_API_URL}${apiEndpoint}` with the Bearer
   token, clears the draft, toasts success, and navigates (or calls `onContributionCreated`
   for modal flows).

### What happens server-side after submit

```
POST /api/v1/cidoc/<type>/   (structured CIDOC domains)
   └─ or /api/v1/data/cultural-entities/   (the CulturalEntity + Revision workflow)
        → PostgreSQL (system of record)
        → review workflow: draft → pending_review → accepted
        → on accept: kg_engine projects the row into Oxigraph → queryable in the graph views
```

### Why this stack / approach
- **Registry-driven = scale + consistency.** 30 domains, one form component. A new ontology
  class ships a new form with **zero new UI code**; the data model and UI can't drift.
- **Static baseline + live merge = resilience.** The form never hard-depends on a network
  call; degraded modes are explicit, not silent failures.
- **Entity-linking, not free text.** Linking to existing entities is what makes the output a
  *graph*, not a flat record.
- **JSON-LD preview demystifies linked data** for non-technical contributors — they watch
  triples form as they type.

### Talking points
- "One form, every heritage domain — because the form is generated from the same ontology the
  graph uses."
- "Drafts survive refreshes; steps are deep-linkable; required fields are enforced per step."
- "Quality is guarded by human review — nothing reaches the public graph unreviewed."

---

## 2. Graph View (global) — "the whole knowledge graph"

**Code:** [graphview/](../heritage_graph_ui/src/app/%28dashboard%29/graphview/) ·
data builder [instance-graph.ts](../heritage_graph_ui/src/lib/instance-graph.ts)

### Stack
**Cytoscape.js** 3.33 + layout plugins **cose-bilkent** (force-directed) and **cola**,
dynamically imported with **SSR disabled**. Node colors/icons come from the generated viz
config.

### Data flow (this is the important detail)
The global graph is **assembled client-side from REST**, not a single graph query:

```
fetchInstanceGraphData(API_BASE, token):
   ├─ Promise.allSettled over ~14 CIDOC type endpoints (paginated):
   │     /api/v1/cidoc/{structures,deities,persons,locations,events,rituals,
   │      festivals,guthis,monuments,iconographic_objects,historical_periods,
   │      traditions,sources}/            → become NODES
   └─ /api/v1/cidoc/assertions/?reconciliation_status=accepted   → become EDGES
fetchForkEdges(API_BASE, token):
   └─ /api/v1/data/cultural-entities/      → contribution-lineage edges
        ▼
   nodes + edges → Cytoscape elements → cose-bilkent / cola layout
```

`Promise.allSettled` means one slow or failing endpoint never breaks the whole graph; there's
a 30s abort guard, and pagination is followed automatically (`fetchAllPages`).

### How it works
- Loaded behind `dynamic(() => import('./graphview-client'), { ssr: false })` with a
  "Loading graph…" fallback — the ~heavy Cytoscape bundle never touches the server.
- The layout plugins are registered once (`cytoscape.use(coseBilkent); cytoscape.use(cola)`).
- Interaction: clicking a node calls `node.closedNeighborhood()` and toggles `highlighted` /
  `faded` classes to focus its immediate connections; pan/zoom for exploration.

### Why this stack
- **Cytoscape over D3 here** — for a large, general, interactive network you want a mature
  graph engine with built-in pan/zoom, selection, and *pluggable* layout algorithms
  (cose-bilkent/cola) rather than hand-writing a force simulation.
- **REST assembly over a live SPARQL dump** — reuses the same authenticated, paginated CIDOC
  endpoints the rest of the app uses, keeps the edge set governed (only
  `reconciliation_status=accepted` assertions become edges), and degrades gracefully per type.

### Talking points
- "This is the product made visible — the knowledge graph in one screen."
- "Edges are only *accepted* assertions, so the graph reflects reviewed knowledge."
- "It's resilient by construction: each entity type loads independently."

---

## 3. Entity Neighborhood — "one thing and its world"

**Route:** `/knowledge/<domain>/view/<id>/graph`

### Stack
D3 force layout, backed by the KG engine's **neighborhood endpoint**
(`GET /cidoc/kg/neighborhood/?uri=…`), which reads inbound/outbound edges from **Oxigraph
(SPARQL)**.

### Flow & how it works
From any entity's detail page, this view centers *that* entity and pulls its direct
relationships. Unlike the global view, this is a **focused, single-entity query** against the
published graph — ideal for drill-down: list → entity page → its neighborhood → click a
neighbor → repeat.

### Why this approach
A neighborhood is a small, bounded query — exactly what a graph store answers well — so here we
hit the **SPARQL-backed KG engine** directly instead of assembling from REST. It demonstrates
that the UI is powered by a *live* graph, not a static export.

### Talking points
- "Natural way to explore: start at one monument, walk its connections outward."
- "Powered by a live SPARQL query against the published knowledge graph."

---

## 4. Heritage Museum — the immersive, story-driven experience

**Code:** [heritage-museum/](../heritage_graph_ui/src/app/%28dashboard%29/heritage-museum/) ·
also a standalone app at [visual_story_museum_kg/](../visual_story_museum_kg/)

This is the **showpiece** — it turns the knowledge graph into a guided, cinematic tour.

### Stack
**D3** (glowing force graph) · **Three.js** (360° panorama) · **Web Speech API**
(`SpeechSynthesis` narration) · Framer Motion (overlays) · generated viz config (node
colors/icons/relation labels). Data: a **demo corpus by default**, with a **live toggle** to
`fetchInstanceGraphData` (the same REST builder as Graph View).

### What the audience sees → how each piece works

1. **Glowing knowledge graph** — `ForceGraph.tsx` / `KnowledgeGraph.tsx` run a **D3 force
   simulation** in SVG, with per-node-type **glow filters** (`feGaussianBlur` + `feMerge`) and
   **radial gradients** from `NODE_TYPE_CONFIG`. D3 (not Cytoscape) is chosen here precisely
   because we want fine-grained, bespoke visuals.
2. **Filter bar + timeline strip** — narrow the corpus by type and move through eras.
3. **Story panel ("beats")** — `storyBeats.ts::buildBeats(node)` turns an entity's data into a
   sequence of narrative **beats**; `StoryPanel` auto-advances each beat (~10s) with
   `requestAnimationFrame`, with pause/resume and progress.
4. **360° immersive panorama (the in-browser 3D)** — `xr/PanoramaViewer.tsx` uses **Three.js**
   to texture a spherical photo onto the *inside* of a sphere; the user looks around a heritage
   site. `xr/ImmersiveScene.tsx` orchestrates it (`dynamic(..., { ssr: false })`) with a
   storytelling overlay and `PlaceNav` to move between places.
5. **Narration** — `useNarration` wraps the browser's **`SpeechSynthesisUtterance`** (en-GB
   voice) to read the story aloud — no external TTS service, no server cost.
6. **MandalaLoader** — a culturally themed loading animation that sets the tone.

### Data flow
```
demo corpus (fetchHeritageDemoData) ──► default view (instant, curated)
                       │  user toggles "live"
                       ▼
fetchInstanceGraphData(API_BASE, token) ──► same REST-built graph as /graphview
                       │
                       ▼
   D3 force graph  +  story beats  +  (on select) Three.js panorama + narration
```

### Why this stack
- **D3 over Cytoscape here** — the museum is about *bespoke aesthetics* (glow, gradients,
  story choreography), which is exactly D3's sweet spot of low-level control.
- **Three.js for panoramas** — WebGL in the browser renders a 360° sphere with zero server
  render cost and works on any modern device.
- **Web Speech API for narration** — built into the browser; no API keys, no latency, no bill.
- **Demo-first** — guarantees a beautiful, reliable demo regardless of live data state.

### Talking points
- "Heritage deserves storytelling, not tables — this is the public, emotional face of the
  data."
- "All the 3D and narration run *in the browser* — Three.js + Web Speech — so it's free to
  serve and works offline-ish."
- "Same graph, two audiences: researchers use Graph View; the public gets the Museum."

---

## 5. Atlas — heritage in space *and* time (3D globe)

**Code:** [atlas/](../heritage_graph_ui/src/app/%28dashboard%29/atlas/) ·
globe [components/globe.tsx](../heritage_graph_ui/src/app/%28dashboard%29/atlas/components/globe.tsx) ·
store [hooks/use-atlas-store.ts](../heritage_graph_ui/src/app/%28dashboard%29/atlas/hooks/use-atlas-store.ts)

### Stack
**CesiumJS** 1.123 (open-source 3D-geospatial engine) via **Resium** 1.18 (React bindings) ·
**Zustand** store for camera/filters/timeline/FX · generated ontology colors. Data: **demo
corpus by default**, **live CIDOC graph on demand** (`use-atlas-data-source` → the same
`fetchInstanceGraphData`).

### What the audience sees
A photorealistic, spinnable **3D Earth** with heritage entities pinned at their real
coordinates; a **timeline** filters by era, a **city-jump bar** flies the camera to a place, a
**spotlight** highlights selected entities, and clicking a pin opens an **entity panel** with
provenance.

### How it works
- **Cesium assets** (workers, widgets, terrain) are copied into `public/` at build time
  (`copy-cesium-assets.mjs`, wired into `predev`/`prebuild`/`postinstall`); a
  `cesium-assets-gate` confirms they're present before the globe renders. The
  `cesium-base-url` side-effect import runs **before** Cesium resolves its worker URLs.
- **Rendering** — Resium's `<Viewer>` + `<Entity>` + camera controllers; pins are colored by
  **ontology class** (`colorForOntologyClass`), with distance-based label scaling so the globe
  stays readable.
- **Temporal dimension** — `atlas-time-extents.ts` + `temporalGlobeAlpha` /
  `entityExistedAtYear` fade entities in and out as you **scrub the timeline** — heritage
  appears and disappears across history.
- **State** — a single **Zustand** store holds camera handles, active filters, the timeline
  year, FX presets, and the demo/live load token; selectors use `useShallow` to avoid
  re-renders.
- **Polish** — reduced-motion support (`atlasPrefersReducedMotion`), keyboard shortcuts
  (`use-atlas-shortcuts`), fullscreen, an error boundary, optional sound + telemetry.

### Data flow
```
demo corpus (ATLAS_DUMMY_ENTITIES) ──► default globe
                  │  user requests "live"
                  ▼
fetchInstanceGraphData(API_BASE, token) ──► entities with coordinates + time extents
                  ▼
Zustand store ──► Cesium <Entity> pins (colored by class, faded by year)
```

### Why this stack
- **Cesium over a 2D map (Mapbox/Leaflet)** — heritage is global and *temporal*; a true 3D
  globe with a **time dimension** shows *where* **and** *when*, which a flat map can't.
- **Cesium is open-source and self-hostable** — assets ship in our own `public/`, no
  proprietary map dependency or per-tile billing.
- **Resium** keeps the imperative Cesium API declarative and React-friendly.
- **Zustand** — the globe has lots of fast-changing UI state (camera, year, filters); a tiny
  store keeps that fluid without Redux ceremony.

### Talking points
- "Two dimensions the network graph can't show: **geography and time**."
- "Scrub the timeline and watch sites appear across centuries — the demo's 'wow' moment."
- "Fully open-source 3D; assets are self-hosted, nothing proprietary."

---

## Suggested demo flow (≈ 6 minutes)

1. **Contribute** (1.5 min) — open `/contribute/festival`, fill two steps, show the
   completeness meter, the **entity-search** link, and the **live JSON-LD preview** ("this is
   the graph you're building"). Mention entity-linking and draft autosave.
2. **Graph View** (1 min) — open `/graphview`, pan/zoom, click a node to focus its
   neighborhood. "This is the whole knowledge graph — edges are *accepted* assertions."
3. **Entity Neighborhood** (0.5 min) — from one entity's page, open its `/graph` to show the
   live SPARQL-backed drill-down.
4. **Heritage Museum** (1.5 min) — open `/heritage-museum`, let a **story beat** play, enter a
   **360° panorama**, let the **narration** speak. "Same data, public storytelling — all in
   the browser."
5. **Atlas** (1.5 min) — open `/atlas`, fly to a city, **scrub the timeline** across eras.
   Close on the 3D globe.

> Tip: both Atlas and the Museum default to the **demo corpus**, so the demo always looks
> great. Flip the **live toggle** only if you want to show real contributed data.

---

## Technology cheat-sheet (for Q&A)

| Surface | Renderer | State | Data source | Why this choice |
|---------|----------|-------|-------------|-----------------|
| Contribution form | React + ontology registry | local component + drafts | REST (CIDOC / cultural-entities) | One schema → every form; UI can't drift from the ontology |
| Graph View (global) | **Cytoscape.js** (+ cose-bilkent, cola) | client | REST: all CIDOC types + accepted assertions | Mature graph engine, pluggable layouts, resilient per-type loading |
| Neighborhood | **D3** | client | KG neighborhood (SPARQL) | Bounded query → answered best by the graph store |
| Heritage Museum | **D3** + **Three.js** | React state | demo / live toggle | Bespoke visuals + in-browser 360°, zero server render cost |
| Narration | **Web Speech API** | — | story beats | Built into the browser; no external TTS |
| Atlas | **Cesium** + **Resium** | **Zustand** | demo / live toggle | Open-source 3D globe with a real time dimension |

**Recurring engineering decisions, in one line each:**
- **SSR-off dynamic imports** for Cytoscape / Cesium / Three.js → heavy code never blocks first
  paint.
- **Ontology-registry codegen** → forms *and* visualization colors/labels come from one source.
- **Demo-first, live-on-demand** → reliable demos, real data one click away.
- **Bearer-token REST + governed edges** → the UI shows only reviewed, accepted knowledge.
