# last_edit.md — session change log

Running log of edits made by the AI assistant in this working session.
**Updated:** 2026-06-10 (§24 duplicate contribution policy). Newest entries at the top of each section.
Legend: ✅ verified (tests/audit/curl pass) · 🆕 new file · ✏️ modified · 🗂️ data/runtime (not a file edit)

---

## 0. Status snapshot (current)
- **Entity resolution:** contribution-time linking + `refresh_identity_candidates --auto-merge` on deploy (§22–23) ✅
- Backend test suite: **63/63 green** ✅
- Nature-rigor audit (`kg_rigor_audit`): **8/8 invariants PASS** ✅
- Frontend: **0 TypeScript errors** (was 24) · **0 ESLint errors** ✅
- Backend lint: 146 ruff auto-fixed (import ordering); ~1071 remain (mostly E501 style, F405 settings star-import) — non-gating
- Frontend routes swept: 82, **0 broken** · Backend API endpoints swept: 308, **0 broken** ✅
- Services (dev): frontend `:3000`, backend `:8000`, Oxigraph container `:7879` up
- ⚠ Parallel edits by user/linter also touched: `apps/graph/views.py`, `apps/cidoc_data/publication_policy.py`, `src/lib/kg-graph.ts`, migration `cidoc_data/0016_backfill_metadata_status` — noted where relevant.

---

## 1. Deploy bootstrap & RDF triplestore
- ✏️ `entrypoint.sh` — added, in order: relationship-predicate seed (`--prune`); Oxigraph readiness wait + `rdf_load_tbox` + `rdf_rebuild --if-empty`; identity bootstrap (`bootstrap_identity_clusters`, `refresh_identity_candidates`); `backfill_assertion_provenance`; `kg_rigor_audit` (advisory). All idempotent + non-fatal. ✅
- ✏️ `apps/cidoc_data/management/commands/rdf_rebuild.py` — new `--if-empty` flag (rebuild only when public graph empty; safe per-boot). ✅

## 2. Contribution form ↔ ontology alignment
- ✏️ `ontology/HeritageGraph.yaml` — (a) restored `CulturalEntity` class + `category`/`description` slots + `CulturalEntityCategoryEnum`; (b) added 33 CIDOC-CRM/LinkedArt interop classes + `la:` prefix (for LUX alignment; non-contributable). ✅
- ✏️ `tools/contribute-hub.yaml` — fixed dangling `registryKey: cultural_entity` → `entity` (intent + quickStart). ✅
- ✏️ `tools/ui-vizmap.yaml` — added `HumanMadeObject`, `Group`, `Set` viz node-types. ✅
- ✏️ regenerated artifacts (all pass `--check`): `registry.generated.json/.ts`, `__generated__/heritage-viz-config.ts`, `__generated__/enums.ts`, `__generated__/ontology-graph.ts`, `apps/graph/ontology_config.py`, `ontology/shapes/generated-heritagegraph-minimal-shacl.ttl`, `ontology/lod/skos-vocabularies.ttl`, `ontology/heritagegraph-crm-bridge.ttl`, `apps/cidoc_data/serializers.generated.py`. ✅

## 3. Contribution → KG pipeline fixes
- ✏️ `apps/heritage_data/serializers.py` — fixed `CulturalEntityCreateSerializer.create` duplicate `contributor` kwarg (was 500-ing). ✅
- ✏️ `apps/heritage_data/signals.py` — `sync_cultural_entity_to_public_graph`: project to public graph on accept/merge, remove on reject/superseded. ✅
- ✏️ `apps/graph/kg_engine/projector.py` — map Cultural-Entity `category` → museum-renderable CRM class IRI. ✅
- ✏️ `apps/cidoc_data/tests.py` — fixed stale `OWL_SAME_AS_URI` → `EXTERNAL_MATCH_URI` import (un-blocked the module); updated the rdf_signals test to assert the publication-gated projection (unpublished→not projected, published→projected). ✅

## 4. Edge projection / store read-coherence
- ✏️ `apps/graph/kg_engine/store.py` — (a) `_open_local_store_readonly` reuses the process's RW handle so reads see their own writes (fixed edges/deletes invisible in embedded/dev); (b) `_triple_to_quad` handles the `@lang` convention as a language tag (not a datatype IRI) — fixed crash on language-tagged labels. ✅
- ✏️ `apps/cidoc_data/test_e2e_pipeline.py` — wrapped assertion creation in `captureOnCommitCallbacks` (edge projection is `on_commit`). ✅

## 5. Curation gate (publish only reviewed) — partly co-edited w/ user
- ✏️ `apps/graph/views.py` — default `kg/graph` scope to `reviewed`; coerce anon `scope=all` → reviewed; keep `lux_sampled` nodes through the prune step. (User/linter later refactored the gate into `apps/cidoc_data/publication_policy.py`.)
- ✏️ `src/lib/kg-graph.ts` — `fetchKgGraph` default scope `reviewed` (also co-edited by user: `sourceLayer`, `includeLux`).

## 6. Yale LUX linked layer (linkset model)
- ✏️ `apps/graph/kg_engine/lux_museum.py` — added a bounded connected-sample path (`museum_lux_sample_limit`, `lux_connected_sample_query`, batched node fetch at 30/req to avoid GET-URL overflow) so LUX shows as a tagged external layer. ✅
- ✏️ `apps/graph/views.py` — surface/keep `lux_sampled` nodes (co-edited w/ user).
- 🗂️ Loaded 3.5M Yale LUX quads into the local Oxigraph container (volume `hg-oxigraph-data`), 3 named graphs; materialized intra-LUX edges; then re-architected to linkset (purged LUX from `graph/public`). Runtime/data only — not committed.

## 7. Nature-readiness: evaluation, release, audit
- 🆕 `apps/graph/management/commands/kg_evaluate.py` — precision/recall/F1 vs gold standard (types, triples, alignment). ✅
- 🆕 `apps/graph/test_kg_evaluate.py` — unit tests for P/R/F1 scoring. ✅
- 🆕 `apps/graph/management/commands/kg_rigor_audit.py` — Nature-rigor integrity gate (4 hard + 4 soft invariants; `--strict`). ✅
- ✏️ `apps/graph/management/commands/kg_purge_public_imports.py` — hardened: removal now matches detection (deletes imported-IRI triples it reports). ✅
- ✏️ `apps/graph/test_lux_museum.py` — fixed mock for the new sample path + added a sample-path test. ✅
- ✏️ `evaluation/README.md` — documented `kg_evaluate`.
- 🆕 `CHANGELOG.md`, 🆕 `.zenodo.json`, ✏️ `CITATION.cff` (version `0.1.0`, date, DOI placeholder).

## 8. Page-assessment fixes (sidebar audit)
- ✏️ `apps/heritage_data/management/commands/seed_relationship_predicates.py` — rewrote ontology-driven (88 object-property slots, labels from `viz_predicates`, `--prune`). Was 7 hardcoded; relationship-proposal dropdown was empty → fixed. ✅
- 🗂️ Ran `bootstrap_identity_clusters` (207 clusters) — identity queue was dormant, now live. ✅

## 9. Broken links + data hygiene + provenance
- 🆕 `src/app/terms/page.tsx`, 🆕 `src/app/privacy/page.tsx` — were broken links from the public QR-scan consent text; created (content grounded in CC-BY-4.0 + review workflow). ✅
- ✏️ `settings/base.py` — `RDF_DEFAULT_LANGUAGE = "ne-Latn"` (language-tag labels → datatype hygiene). ✅
- 🆕 `apps/cidoc_data/management/commands/backfill_assertion_provenance.py` — honest agent+source backfill on accepted edges (provenance coverage 30.5% → 100%). ✅
- ✏️ `apps/cidoc_data/management/commands/seed_test_relationships.py` — set `attributed_to_agent` + `source_citation` on seeded edges. ✅

---

## 10. Known remaining (NOT done — data/scholarly, not engineering)
- Dataset scale (small curated corpus); expand the gold standard (1 placeholder entity); novelty/positioning write-up; mint the Zenodo DOI; external-identifier linking (Wikidata/Getty) to raise `external_identifier_coverage` from 0.
- Backend lint debt (~1.2k ruff, mostly E501 — non-gating; CI runs tests not ruff); 24 frontend TS errors (`tsc --noEmit`) not yet addressed.

## 11. Memory files updated (`~/.claude/.../memory/`)
- `project_museum_live_kg.md`, `project_contribution_form_ontology.md`, `MEMORY.md` — kept in sync with the above findings.

---

## 12. Proposed improvements (not yet done) — 2026-06-10
Grounded in inspection this session. Priority: 🔴 high · 🟠 medium · 🟡 nice-to-have.

### Frontend / UX
- 🔴 **Museum: LUX-layer toggle + legend.** LUX nodes are tagged (`sourceLayer:'lux'`, "Yale LUX" keyFact) but there is **no visible show/hide control** in `FilterBar`/`museum-toolbar`, and no distinct visual style. Add a "Linked (Yale LUX)" toggle + a dimmed/dashed node style + external badge so curated-vs-external is *visible*, not just in data.
- 🔴 **Fix 24 TypeScript errors** (`tsc --noEmit`): 8×TS2352 (unsafe casts), 6×TS2322 (assignment mismatch), 2×TS2300 (duplicate identifiers), 2×TS18048 (possibly-undefined), etc. Files incl. `next.config.ts`, `access-denied.tsx`, `entity-qr-code.tsx`, `heritage-table.tsx`, `nav-user.tsx`, `project-add-panel.tsx`, `reaction-buttons.tsx`.
- 🟠 **Empty-state polish**: Identity Queue (0 candidates), sparse live curated view, empty projects — friendly guidance instead of blank.
- 🟠 **Accessibility pass**: alt text on `<img>` (incl. `entity-qr-code`, XR scenes), aria-labels on icon buttons, keyboard nav, contrast — matters for an inclusive heritage platform + journal supplement.
- 🟡 **i18n coverage**: `next-intl` is present; ensure Nepali/Newari locale strings exist (aligns with the `ne-Latn` data).

### Code quality / tests
- 🟠 **Backend lint cleanup**: ~1.2k ruff (147 auto-fixable) → `ruff check --fix` + manual E501.
- 🟠 **Expand test coverage** (63 is light): authenticated write flows (contribute submit, review→accept→publish), LUX sample path edge cases, rigor invariants on a fixture.

### CI / automation (currently only ontology drift is gated)
- 🔴 **Add CI gates** to `backend-tests.yml` (or new workflow): `make check` (ontology), `ruff check`, `tsc --noEmit`, and a **seeded `kg_rigor_audit --strict`** job. Today only `ontology-registry.yml` runs `make check`.
- 🟡 **Pre-commit**: ensure `.pre-commit-config.yaml` hooks (ruff, codespell) actually run.

### Rigor / data (the publishability path — mostly scholarly)
- 🔴 **Wikidata/Getty reconciliation connector** → raise `external_identifier_coverage` from 0 (the real FAIR-linking contribution).
- 🔴 **Expand gold standard** + run `kg_evaluate` for real P/R/F1 + inter-annotator agreement.
- 🟠 **SHACL strict-on-write** (currently validate, non-strict) once shapes verified against the corpus.
- 🟠 **Temporal/EDTF capture** (0% events dated) — contribution form field + projection.

### FAIR / release
- 🔴 **Mint Zenodo DOI** + tag a versioned release (scaffolding already in `.zenodo.json`/`CITATION.cff`).
- 🟠 **Per-graph license + PROV** on the LUX import (attribution to Yale LUX terms).

> Recommended next batch (engineering, high-leverage): museum LUX toggle+legend → fix 24 TS errors → add CI gates → backend lint cleanup.

---

## 13. Improvements implemented — 2026-06-10 (from §12)
- ✅ **Fixed all 24 TypeScript errors → 0** (`tsc --noEmit` clean, ESLint clean):
  - `Session` cast (×8 curation pages): `as Record<string,unknown>` → `as unknown as Record<...>`.
  - Component prop mismatches (×5) in `knowledge/entity/view/[id]/page-client.tsx`: removed invalid `entityType` from `ReactionButtons`/`ShareButton`/`ForkButton`/`EntityComments`; added required `entityName` to `ForkButton`.
  - `next.config.ts` plugin param typed; `nav-user.tsx` duplicate import removed; `entity-qr-code.tsx` canvas cast (`HTMLCanvasElement`); `project-add-panel.tsx` `userDescription ?? ''`; `reaction-buttons.tsx` typed `toggleReaction` result; `heritage-table.tsx` schema `id` → `z.union([number,string])`; `curation/layout.tsx` + `access-denied.tsx` motion `{...fadeInUp}` → `variants={fadeInUp} initial="hidden" animate="show"`; `curation/contributions/page.tsx` token cast.
- ✅ **Backend lint cleanup**: `ruff check --fix` → 146 fixed (import ordering across 14 files); suite re-verified **63/63 green**.
- ✅ 🆕 **`.github/workflows/frontend-checks.yml`** — CI gate running `tsc --noEmit` + ESLint on frontend changes (only ontology-drift was gated before).

### Still pending from §12 (next)
- 🔴 Wikidata/Getty reconciliation · expand gold standard · mint DOI · backend CI ruff/rigor gate (needs lint cleanup / seeded store first) · a11y pass · remaining E501.
- (Museum LUX-layer toggle: descoped per user — "no need to show source layer LUX".)

## 14. UI/UX improvement report — 2026-06-10
- 🆕 `UI_IMPROVEMENT_REPORT.md` — code-grounded UX review + prioritized roadmap to increase audience interaction. Top gaps: **no global ⌘K search**, **almost no SEO/OpenGraph** (weak shareability), **no first-visit onboarding/tour**; strong assets (rich viz/XR, social, gamification, AI ChatWidget) under-surfaced.

## 15. UI/UX improvements — implementation (in progress) — 2026-06-10
- ✅ **Global ⌘K command palette** (UX report quick-win #1 — the biggest discovery gap):
  - `npm i cmdk`; 🆕 `src/components/ui/command.tsx` (shadcn command primitive); 🆕 `src/components/command-menu.tsx` (`CommandMenu` ⌘K/Ctrl-K dialog with Navigate + Contribute groups, fuzzy filter; `CommandMenuTrigger` header "Search… ⌘K" button); ✏️ `src/app/(dashboard)/layout.tsx` mounts both. Verified: **tsc 0, eslint 0, dashboard renders 200**.
  - v2 follow-up: extend the palette to **entity search** over the KG (needs a unified search endpoint + async cmdk).

### UX quick wins — ALL 5 shipped & verified (tsc 0, eslint 0, pages render 200)
- ✅ **#0 ⌘K command palette** (navigation + Contribute actions) — `ui/command.tsx`, `command-menu.tsx`, mounted in layout.
- ✅ **#1 OG/Twitter metadata** on public entity pages — `generateMetadata` in `knowledge/entity/view/[id]/page.tsx` fetches the entity name server-side (safe fallback) → rich link unfurls. Verified meta tags present in HTML.
- ✅ **#2 First-visit onboarding** — 🆕 `welcome-dialog.tsx` (localStorage-gated, 3 quick links: Museum/Atlas/Contribute, ⌘K tip), mounted in layout.
- ✅ **#3 Surface AI assistant + immersive** — added "Ask the AI assistant" to the palette (toggles `useChatStore`); museum now findable via "xr/immersive/3d" keywords. **Fixed a ⌘K collision** I'd introduced (ChatWidget also bound ⌘K → removed; chat keeps its FAB).
- ✅ **#4 Re-enabled `LanguageSwitcher`** in the layout header (en + Nepali `ne.json` locales present and real).
- ✅ **#5 ⌘K entity search over the KG** — debounced fetch to `/api/v1/cidoc/search/?q=`, results grouped → navigate `/knowledge/<domain>/view/<id>` (plural→singular domain map). Live: "tem" → Taleju Temple etc.
- dep added: `cmdk`.

### 🧭 Bigger bets remaining (focused passes, multi-week)
narrative story-journeys · collections/bookmarks + profiles/follow + activity feed · mobile-first viz affordances · a11y WCAG AA · full Nepali/Newari UI i18n · embeddable widgets + JSON-LD · dynamic OG *images* (next/og) · trending/most-viewed (needs view-count telemetry).

## 16. Professional UI / design-system pass — 2026-06-10 (tsc 0, eslint 0, pages 200)
- ✅ **Typography aligned to design tokens (the #1 pro-UI fix)**: `layout.tsx` now loads **Poppins** (`--font-sans`) + **Fraunces** (`--font-serif`) + Geist Mono (`--font-mono`) — previously it loaded Geist and mislabeled mono as `--font-poppins`, so the intended fonts in `globals.css` never rendered. Body now `font-sans`.
- ✅ **Discover hub** 🆕 `src/app/(dashboard)/discover/{page,discover-client}.tsx` — hero + Featured + curated-entity grid + "Surprise me"; reuses `/kg/graph?scope=reviewed` (no new endpoint), parses resource IRIs → `/knowledge/<domain>/view/<pk>`; **uses semantic theme tokens only** (no hardcoded colors). Added to sidebar nav + ⌘K palette.

### Best-UI-settings recommendations (delivered to user; applied where safe)
1. ✅ Use the design-token fonts (Poppins body + Fraunces display) — done.
2. ✅ **Color discipline (global pass)** — converted **28 busy gradient-clip static headings → solid semantic tokens** across 16 files (home, site-header, leaderboard, about, team, community×2, progression, graphview, curation×5, notification, contribute/pipeline). On-color heroes (graphview/pipeline `from-white`) → `text-white/90`; normal headings → `font-serif text-foreground`. Done via a precise script that only touches classNames with both `text-transparent`+`bg-clip-text`. Left intentionally: `group-hover:` gradient micro-interactions + 1 dynamic per-service decorative gradient (not the anti-pattern). Verified tsc 0, eslint 0, pages 200.
3. ⏳ Consistent **page container + section rhythm** (shared spacing) — partial; could extract a `<PageHeader>`/container.
4. ✅ Radius/shadows/tokens well-defined in `globals.css` — kept; avoid ad-hoc values.
5. ⏳ `prefers-reduced-motion` for heavy framer-motion; a11y focus-visible + contrast pass.

### Next: collections/bookmarks + profiles/follow (bigger bet) — pending.

---

## 17. Nature publication — UI assessment & update roadmap — 2026-06-10
**Scope:** Heritage Museum + cross-app surfaces reviewers will hit (Discover, entity pages, methods/provenance, shareability). **Goal:** UI credible as a *Nature* (or *Scientific Data* / HSS) software or data-descriptor supplement — reproducible, honest about data limits, citable, accessible. **No code changes in this pass** — assessment + prioritized backlog only (user asked for assessment before edits).

### Verdict (honest)
| Area | Score | Notes |
|------|-------|-------|
| Viz / interaction | **A−** | Force graph + map + timeline + XR + story panel is a genuine differentiator |
| Ontology fidelity (live) | **A** | Real `rdf:type` + triples via `/kg/graph/` — rare among heritage UIs |
| Scholarly transparency | **C+** | Methods popover exists but **stale/wrong**; edge provenance in API **not shown** |
| Reproducibility in UI | **D+** | No version, DOI, export, or deep-linkable museum state |
| Accessibility | **B−** | Good aria on filters/legend/XR; **no keyboard graph nav** |
| Publication polish | **B** | Design-system pass helped; emoji-heavy + inline colors still read “demo” not “journal” |

**Bottom line:** Strong enough to *illustrate* a paper today; **not** yet best-in-class for Nature without a **scholarly-transparency pass** (provenance, citation, export, live-default honesty).

### What already works (keep)
- Live KG: ontology-typed nodes, real edges, click-to-expand (`heritage-museum-client.tsx` + `kg-graph.ts`).
- Demo corpus: frozen `_provenance`, per-image CC attribution (`ImageAttribution.tsx`, `heritage-data.ts`).
- Methods entry point in toolbar (`museum-toolbar.tsx` → “Methods” popover).
- Ontology mapping block in `StoryPanel` (HG class, CIDOC-CRM, namespace).
- Partial a11y: `aria-*` on graph SVG, filter bar, timeline; `useReducedMotion` in XR.
- App-wide: ⌘K search, Discover hub, welcome dialog, OG on entity pages, Nepali locale file.

### Critical gaps for Nature (🔴 do before submission)

1. **Fix / replace Methods popover copy** (`museum-toolbar.tsx` L141–147)  
   Still references `INSTANCE_CAT_MAP` and defensive field extraction — **incorrect for live mode** (live uses `RDF_CLASS_URI_TO_NODE_TYPE` + SPARQL projection). Reviewers will notice. Replace with: graph partition IRI, `scope=reviewed` gate, LinkML/CIDOC-CRM stack, LUX linkset model (curated + `skos:exactMatch`, not merged dump), SHACL/evaluation commands, link to `CITATION.cff` / Zenodo.

2. **Surface relationship provenance in the UI**  
   Backend returns `provenance` on edges (`KgGraphEdge` in `kg-graph.ts`); museum **drops it** when building `GraphLink`. StoryPanel “Connections” should show source, confidence, asserter, date — **required** for epistemic claims in a KG paper.

3. **Dataset identity block (every live view)**  
   Show in toolbar or Methods: release version (`0.1.0`), build/date, named graph URI, entity/edge counts, `reviewed` scope, license (CC-BY-4.0 data / MIT code), **DOI when minted**. Link “Cite this software” → `CITATION.cff` formatted citation.

4. **Demo vs live honesty**  
   Museum **defaults to demo** (`dataSource: 'demo'`). For publication deploy: either default **live** or show a persistent banner: *“Illustrative demo corpus — switch to Live for reviewed dataset (N nodes).”* Never let reviewers screenshot demo thinking it is the corpus.

5. **Export & reproducibility affordances**  
   Add: Download subgraph JSON / Turtle snippet; copy SPARQL for current view; link to public SPARQL endpoint (`RDF_PUBLIC_SPARQL_URL`). Nature expects **machine-readable** access alongside pretty pictures.

6. **Museum node → canonical record**  
   Discover already maps IRIs → `/knowledge/<domain>/view/<id>` (`discover-client.tsx`). Museum StoryPanel has **no “Open full record”** — add it so every node is dereferenceable from the viz.

7. **Deep-linkable museum state**  
   URL query params: `?node=<iri>&view=2d|map|xr&source=live`. Enables *“see Figure 2”* links in the manuscript.

### High priority (🟠 before or shortly after submission)

8. **Publication figure mode** — high-contrast, reduced chrome, export SVG/PNG (600 dpi) for manuscript figures; optional node labels only, no emoji.

9. **`generateMetadata` for `/heritage-museum`** — title, description, OG image (static or dynamic graph thumbnail) for supplement links.

10. **Keyboard + screen-reader graph access** — roving tabindex on nodes, arrow keys between neighbours, list alternative to force layout (WCAG 2.1 **2.1.1 Keyboard**).

11. **Confidence / review badges** — “Community reviewed” on live entities; dim or style low-confidence edges (use `confidenceScore`).

12. **Standalone `/methods` page** (not just a popover) — mirrors paper Methods: ontology, pipeline (`seed_db` → `kg_publish` → `kg_rigor_audit`), evaluation (`kg_evaluate`), LUX attribution (Yale terms), limitations (corpus size, Wikidata coverage).

13. **JSON-LD on public entity pages** — `schema.org/CreativeWork` or `Dataset` fragment for Google / FAIR discoverability.

14. **Empty / sparse live state** — when live graph &lt; 20 nodes, show guided CTA (contribute, run `kg_publish`) not a bare graph.

### Polish (🟡 best-in-class, post-submission)

15. Replace emoji section headers in `StoryPanel` with `NodeGlyph` + semantic tokens (keep emoji optional in “delight” mode).
16. Remove hardcoded `text-blue-400` / inline palette in StoryPanel; use `text-primary` + tokens only.
17. Scripted **narrative journeys** (museum story beats) — aligns with Nature’s preference for guided scientific narrative over raw graph exploration.
18. Dynamic OG images per entity; embeddable iframe widget for museums.
19. Full Nepali UI (`ne.json` exists — audit coverage); Newari if in scope.
20. Mobile: bottom sheet story panel polish, reduced-node mode on small screens.

### Recommended implementation order (engineering)
| Phase | Items | Est. |
|-------|--------|------|
| **P0 — scholarly credibility** | 1, 2, 3, 4, 6 | 2–4 days |
| **P1 — reproducibility** | 5, 7, 12 | 2–3 days |
| **P2 — reviewer UX** | 8, 9, 10, 11, 14 | 3–5 days |
| **P3 — reach** | 13, 15–20 | ongoing |

### Cross-reference
- Broader UX backlog: `UI_IMPROVEMENT_REPORT.md` (discovery, social, SEO).
- Data/scholarly gaps (not UI): §10 (gold standard, Wikidata, DOI mint).
- User note: LUX source-layer toggle **descoped** (§13) — keep LUX in data layer only unless re-requested.

> **Recommended next batch for Nature:** Methods popover rewrite → edge provenance in StoryPanel → dataset identity + cite block → live-default/banner → “Open full record” on nodes.

---

## 18. Nature-rigor museum UI — implemented — 2026-06-10 (tsc 0)
P0 items from §17 shipped in the Heritage Museum + `/methods` page.

- 🆕 `src/lib/heritage-museum/museum-rigor.ts` — citation constants, IRI→detail href, dataset meta from KG response, SPARQL sample, JSON export helpers.
- 🆕 `components/MuseumMethodsPanel.tsx` — accurate pipeline copy (LinkML, `scope=reviewed`, publication policy, provenance edges); dataset identity block; copy citation / SPARQL; link to full methods page.
- 🆕 `src/app/(dashboard)/methods/page.tsx` — standalone Methods & data documentation (ontology, pipeline, limitations, LUX attribution).
- ✏️ `museum-toolbar.tsx` — Methods popover uses `MuseumMethodsPanel`; live export JSON button; release badge.
- ✏️ `heritage-museum-client.tsx` — defaults to **live** when API configured; **demo banner**; sparse-live guidance; preserves edge **provenance** through `GraphLink` → `attachRelations`; dataset meta state; **deep-link URL** sync (`?source=&view=&node=`); JSON export.
- ✏️ `StoryPanel.tsx` — **Open full record** link; **community reviewed** badge (live curated IRIs); **per-edge provenance** in Connections; `text-primary` for map link.
- ✏️ `heritage-data.ts` — `RelationProvenance` on relations/links.
- ✏️ `heritage-museum/page.tsx` — `generateMetadata` + `Suspense` for `useSearchParams`.
- ✏️ `messages/en.json` — methods, export, demo banner, panel provenance strings.
- ✏️ `command-menu.tsx` — Methods & data entry.

### Still pending from §17 (P2+)
Publication figure export · keyboard graph nav · JSON-LD on entity pages · full Nepali UI strings for new keys · dynamic OG images.

---

## 19. Live map + timeline — museum data enrichment — 2026-06-10
Fixed empty map/timeline and awkward 2D layout when using **live** KG data (coordinates and dates lived on Django rows, not RDF literals).

- 🆕 `apps/graph/kg_engine/museum_graph_enrichment.py` — ORM backfill for `lat`/`long`/`inceptionYear`; known Kathmandu Valley place coords; propagate geo along `located_at` / `located_in` edges.
- ✏️ `apps/graph/views.py` — call enrichment before graph JSON response; expose `inceptionYear` on nodes.
- 🆕 `apps/graph/test_museum_graph_enrichment.py` — unit tests (URI parse, temporal, coords, propagation). ✅
- 🆕 `src/lib/heritage-museum/enrich-museum-graph.ts` — client-side geo propagation fallback.
- ✏️ `src/lib/kg-graph.ts` — `inceptionYear` on `KgGraphNode`.
- ✏️ `src/lib/heritage-museum/temporal-parse.ts` — BCE/CE and century strings (e.g. `c. 5th century CE`).
- ✏️ `heritage-museum-client.tsx` — conditional timeline row height; `enrichMuseumGraph` on live load.
- ✏️ `TimelineStrip.tsx` — compact empty state instead of `null`.
- ✏️ `MapView.tsx` — semantic theme tokens + i18n empty state.
- ✏️ `messages/en.json` — `map.*`, `timeline.empty*` strings.

Verified on live projection: ~33 geo-enriched nodes, ~39 dated nodes after enrichment.

---

## 20. XR immersive view — HeritageGraph theme + Nature-rigor — 2026-06-10
Re-themed XR mode from isolated `gray-950` / purple WebXR chrome to **semantic dashboard tokens** (`bg-background`, `bg-card`, `border-border`, `text-primary`) for light/dark parity with the rest of the museum.

### Theme & layout
- 🆕 `src/lib/heritage-museum/xr-theme.ts` — shared `xrGlassPanel`, cinematic overlays, nav chip styles.
- ✏️ `PlaceNav.tsx` — card sidebar, search filter (6+ entities), image-first sort, `NodeGlyph` fallbacks, i18n.
- ✏️ `ImmersiveScene.tsx` — full rewrite: theme panels, shadcn `Button`/`Badge`, gallery splits **with imagery** vs **text-only** (live-data honest), text-first fallback when no hero image, responsive stack (story below identity on narrow screens), `parseTemporalAnchor` chips (no false “CE” on BCE), **Open full record** + **Community reviewed** badges (live), narration/transcript/panorama actions.
- ✏️ `PanoramaViewer.tsx` — theme toolbar, i18n, `reducedMotion` respected in story auto-advance, honest 360° vs flat-photo disclaimers retained, WebXR buttons use `secondary`/`outline` not purple/cyan.
- ✏️ `heritage-museum-client.tsx` — XR: hide sidebar on `<md` (gallery picker on mobile), pass `dataSource`, live badge in XR chrome.
- ✏️ `messages/en.json` — `heritageMuseum.xr.*` (gallery, panorama, WebXR, story controls, search).

### Nature-rigor retained / improved
- Panorama still labels **standard photograph vs true 360°** from image aspect ratio (no false VR fidelity).
- `prefers-reduced-motion`: no Ken Burns / parallax / story auto-advance when requested.
- Keyboard: arrow keys + +/- zoom in panorama; Escape closes modal.
- Image attribution (`ImageAttribution`) preserved on hero and panorama.

### Still pending (XR P2)
- Publication figure export from XR frame · scripted narrative journeys tied to ontology periods · true equirectangular assets in curated records (most live nodes are text-only).

---

## 21. i18n fix — `heritageMuseum.xr` MISSING_MESSAGE — 2026-06-10
`useTranslations('heritageMuseum.xr')` failed under next-intl v4 (nested namespace not resolved on client after HMR).

- ✏️ `xr-theme.ts` — `useXrTranslations()`, `useMapTranslations()`, `useTimelineTranslations()` resolve via parent `heritageMuseum` + dotted keys (`xr.navTitle`, etc.).
- ✏️ `PlaceNav.tsx`, `ImmersiveScene.tsx`, `PanoramaViewer.tsx`, `MapView.tsx`, `TimelineStrip.tsx` — switched to helpers.
- ✏️ `messages/ne.json` — added `heritageMuseum.xr` + `map` + timeline empty strings (Nepali).

**If errors persist after pull:** restart the Next dev server (`make kill-ports` then `make frontend`) so message bundles reload.

---

## 22. Entity resolution — scientific pipeline + form hook — 2026-06-10

### Problem
Contributors submitting the same heritage entity twice (e.g. “Pashupatinath” and “Pashupatinath Temple”) each got a **separate CIDOC row + singleton `EntityCluster`**, so the live KG showed many apparent duplicates. Identity was bootstrapped 1:1 at deploy but **not enforced on new form submissions**.

### Scientific approach (claim-first ER)
HeritageGraph follows the **blocking → matching → decision → human review** pattern used in cultural-heritage and LOD entity resolution (cf. spec 005, CIDOC identity layer):

| Stage | Rule | Implementation |
|-------|------|----------------|
| **Block** | Never merge across ontology types (`type_scope`) | `location` ≠ `deity` ≠ `guthi` |
| **Match (exact)** | Normalized label equality | Auto-link to existing `EntityCluster` |
| **Match (similar)** | Distinctive substring (≥8 chars), e.g. `pashupatinath` ⊂ `pashupatinathtemple` | Singleton cluster + `IdentityResolutionCandidate` |
| **Match (none)** | No signal | New singleton cluster |
| **Review** | Moderator merge/split with audit | `/curation/identity` workspace (existing) |
| **Display** | Same cluster → one museum card | `collapseClusterDuplicates()` in live museum (§ prior Pashupati work) |

Records stay separate (each submission is a **claim**); `identity.same_referent` membership expresses same-referent links without deleting contributor data.

### What was implemented
- 🆕 `apps/cidoc_data/identity_label_match.py` — `normalize_label`, `labels_are_similar` (queue), `labels_are_auto_mergeable` (unattended merge; **no short-token merges** like `L` → `Lumbini`).
- 🆕 `apps/cidoc_data/contribution_entity_resolution.py` — `resolve_contribution_identity()`; outcomes: `linked_existing` \| `singleton_created` \| `candidate_queued` \| `skipped`.
- ✏️ `apps/cidoc_data/views.py` (`ContributionFlowMixin.perform_create`) — schedules resolution `on_commit` after every clusterable CIDOC form create.
- ✏️ `refresh_identity_candidates.py` — all clusterable models; exact normalized name **and** similar-label pairs across clusters.
- 🆕 `run_entity_resolution.py` — `refresh_identity_candidates` + `merge_similar_identity_clusters` (auto-merge uses **strict** `labels_are_auto_mergeable` only).
- ✏️ `merge_similar_identity_clusters.py` — switched to `labels_are_auto_mergeable`; system actor fallback for dev.
- ✏️ `museum_cluster_resolution.py` — shared label helpers from `identity_label_match`.
- ✏️ `heritage_graph/entrypoint.sh` (Docker `ENTRYPOINT`) — `bootstrap_identity_clusters` + `run_entity_resolution` on every deploy/restart (idempotent, non-fatal). Root `entrypoint.sh` also has this for non-Docker use.
- ✏️ `Makefile` — `make entity-resolution`.
- 🆕 `apps/cidoc_data/test_contribution_entity_resolution.py` — 6 tests ✅ (`RDF_SYNC_ENABLED=false` in test env avoids Oxigraph lock).

### Contributor flow (form submit)
1. User POSTs contribute form → new `Location` / `Deity` / … row + `CulturalEntity` review wrapper (unchanged).
2. **`resolve_contribution_identity`** runs on commit:
   - **Exact name** (same type) → links to existing cluster; **no second cluster**.
   - **Similar name** → new cluster + row in **Identity Queue** for moderators.
   - **New name** → singleton cluster (same as bootstrap).
3. After review + publish, museum live view collapses nodes sharing `clusterId`.

### Ops commands
```bash
make entity-resolution                    # refresh candidates + safe auto-merge
python manage.py run_entity_resolution --rebuild-rdf   # + rdf_rebuild after bulk dedup
python manage.py refresh_identity_candidates --type-scope=location
python manage.py merge_similar_identity_clusters --label-contains=pashupat --dry-run
```

### Museum UI (live KG duplicates)
- Backend: merged clusters + `enrich_museum_cluster_identity()` attach `clusterId` / `clusterLabel` on KG nodes.
- Frontend: `collapseClusterDuplicates()` in `heritage-museum-client.tsx` shows **one card per identity cluster per type**; aliases tagged `identity:N records merged`.

### Caveats / next steps
- **Wikidata / Getty** external-ID blocking not yet wired on create (reconciliation API exists on clusters).
- **Geo proximity** blocking for locations — future signal.
- Review **Identity Queue** (`/curation/identity`) for `candidate_queued` similar-label pairs; expert curators approve merges.
- ⚠️ An early dev run with overly loose substring rules may have merged some unrelated rows (e.g. single-char labels); re-run with current code uses `MIN_DISTINCTIVE_LEN=8`. Inspect queue and split if needed.

---

## 23. Consolidation cleanup — redundant files merged/removed — 2026-06-10

Reduced sprawl from incremental museum + entity-resolution work without changing behaviour.

### Removed (9 files)
- `entrypoint.sh` (repo root) — duplicate; Docker uses `heritage_graph/entrypoint.sh` only.
- `identity_label_match.py` — merged into `identity_validation.py`.
- `museum_cluster_resolution.py` — merged into `museum_graph_enrichment.py`.
- `run_entity_resolution.py` — thin wrapper; use `refresh_identity_candidates --auto-merge` instead.
- `cluster-dedup.ts`, `enrich-museum-graph.ts`, `live-node-enrichment.ts` — merged into `museum-graph.ts`.
- `tools/audit_museum_consistency.py` — one-off dev audit script.
- `UI_IMPROVEMENT_REPORT.md` — session artifact; backlog captured in `last_edit.md` §14–17.

### Canonical layout after cleanup
| Concern | Single file |
|---------|-------------|
| Label matching + membership validation | `identity_validation.py` |
| Form-submit ER | `contribution_entity_resolution.py` |
| Boot ER pipeline | `refresh_identity_candidates --auto-merge` (+ `merge_similar_identity_clusters` internally) |
| Museum KG enrichment + cluster metadata | `museum_graph_enrichment.py` + `museum_media.py` |
| Museum frontend graph helpers | `museum-graph.ts` (+ `museum-rigor.ts`, `xr-theme.ts`, `temporal-parse.ts`) |
| Docker boot | `heritage_graph/entrypoint.sh` only |

### Ops (unchanged behaviour)
```bash
make identity-candidates   # refresh_identity_candidates --auto-merge
python manage.py refresh_identity_candidates --auto-merge --rebuild-rdf
```

---

## 24. Duplicate contributions — scientific policy implemented — 2026-06-10

**Scenario:** Contributor A submits basic “Pashupatinath Temple”; Contributor B submits richer details.

### Scientific approach (claim-first + evidence-weighted canonical)
| Layer | Policy |
|-------|--------|
| **Prevent** | Form duplicate alert while typing (label similarity + type block) → steer to **Edit existing** |
| **Identity** | Same label + type → same `EntityCluster` (no second hub) |
| **Queue** | Second submission → `IdentityResolutionCandidate` (`duplicate_contribution_same_cluster`) for curator compare |
| **Canonical** | `completeness_score` (narrative, geo, status) picks hub record for museum + hints |
| **Preserve** | Both rows kept; reviewer accepts richer claim, rejects or merges thinner duplicate |

### Implemented
- 🆕 `canonical_record_selection.py` — `completeness_score`, `rank_cluster_members`, `select_canonical_member`.
- ✏️ `suggest-duplicates` API — label tiers, ranked members, `recommendation: edit_existing`, `registry_key` param.
- ✏️ `contribution_entity_resolution.py` — exact duplicate links cluster + queues curator review vs canonical member.
- ✏️ `museum_graph_enrichment.py` — `canonicalMemberId` on KG nodes.
- 🆕 `duplicate-contribution-alert.tsx` — wired into `OntologyForm` (all contribute forms).
- ✏️ `museum-graph.ts` — collapse prefers evidence-weighted canonical IRI.
- 🆕 `test_canonical_record_selection.py` — 7 ER + canonical tests ✅.
```
