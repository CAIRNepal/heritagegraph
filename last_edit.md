# last_edit.md — session change log

Running log of edits made by the AI assistant in this working session.
**Updated:** 2026-06-10. Newest entries at the top of each section.
Legend: ✅ verified (tests/audit/curl pass) · 🆕 new file · ✏️ modified · 🗂️ data/runtime (not a file edit)

---

## 0. Status snapshot (current)
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
- 🔴 Museum **LUX-layer toggle + legend** (the one remaining frontend item from §12).
- 🔴 Wikidata/Getty reconciliation · expand gold standard · mint DOI · backend CI ruff/rigor gate (needs lint cleanup / seeded store first) · a11y pass · remaining E501.
