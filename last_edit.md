# last_edit.md — change log

> Recreated 2026-06-11 (prior file was removed by parallel work). Tracks UI/UX
> design-system enforcement following `UI_AUDIT.md`.

## Design-system enforcement pass (2026-06-11)

Goal: act on `UI_AUDIT.md` — collapse to one card language + a single accent,
remove the multi-hue "rainbow," and use semantic tokens instead of hardcoded
`blue-*`/glass. Done one fix at a time, each verified (tsc 0, eslint 0, pages 200).

### Fix 1 — one card language + restrained hero (`src/lib/design.ts`)
- `glassCard`: `bg-white/80 … backdrop-blur-sm border-blue-200 rounded-2xl shadow-lg`
  → `bg-card text-card-foreground border border-border rounded-xl shadow-xs`.
  No glassmorphism, no hardcoded colour, one card radius. Propagates app-wide
  (every dashboard surface that imports `glassCard`).
- `heroGradient`: 3-stop `from-blue-600 via-sky-500 to-cyan-500` →
  single-hue `from-primary to-accent rounded-xl`.
- Home hero (`(dashboard)/page.tsx`): inline 3-stop rainbow overlay → `from-primary to-accent`.

### Fix 2 — main dashboard cards de-rainbowed (`components/dashboard/shortcut-grid.tsx`)
- Replaced per-item rainbow gradient icon tiles (`bg-gradient-to-br ${item.gradient}`,
  white icons, `rounded-2xl shadow-md/lg`) with a single-accent tinted chip:
  `bg-primary/10 text-primary rounded-lg`.
- Removed gradient-clip hover headings (`group-hover:bg-clip-text from-blue-600 to-sky-500`);
  titles now `text-foreground` → hover `text-primary`. Body copy → `text-muted-foreground`.
- Removed the per-item gradient hover overlay. (Note: the `gradient` field stays in
  `config/dashboard-links.ts` — it is still read by `curation/dashboard`, so not dead.)

### Fix 3 — token consistency on shared chrome
- `command-menu.tsx` ⌘K trigger: `border-blue-200 … bg-white/60` glass → `border-border bg-muted/50 hover:bg-muted`.
- `app-sidebar.tsx` scroll-to-top button: `bg-blue-500/90 text-white` → `bg-primary/90 text-primary-foreground`.

### Incidental — fixed 2 TS errors introduced by parallel work (kept tsc at 0)
- `generic-data-table.tsx:97`: `useServerListMode` made generic (`<T>(config: DataTableConfig<T>)`).
- `knowledge/[domain]/page.tsx:78`: typed the `cell` callback `row` param.

### Fix 4 — curation reviewer dashboard de-rainbowed (`curation/dashboard/page.tsx`)
- Tokenized body text via batch `replace_all`: `text-blue-900 dark:text-blue-100` → `text-foreground`;
  `text-blue-600/500/700 dark:text-blue-*` → `text-muted-foreground`.
- Stat tiles + quick-nav tiles: rainbow gradient icon chips (`bg-gradient-to-br ${gradient}`,
  white icons, `rounded-2xl shadow-lg`) → `bg-primary/10 text-primary rounded-lg`; removed the
  per-tile gradient hover overlays.
- Page-header hero: 3-stop `from-blue-600 via-sky-500 to-cyan-500` → `from-primary to-accent`.
- Gradient-clip hover headings → `group-hover:text-primary`. "Try Again" gradient button →
  default primary Button. Activity rows: `border-blue-100 / hover:bg-blue-50` → `border-border / hover:bg-accent/40`.
- Remaining blue is intentional: the inline `gradient:` array keys are now unused (dead, harmless),
  and two detail/activity status colours stay semantic.

### Fix 5 — about + AI-pipeline pages to single accent
- `about/page.tsx`: heroes already use `heroGradient` (now single-hue) and tiles use
  `ShortcutGrid` (now primary chips), so only hero text + white CTAs needed work:
  `text-blue-100` → `text-white/90`; CTA `text-blue-700 hover:bg-blue-50` → `text-primary hover:bg-white/90`.
- `contribute/pipeline/page-client.tsx` (was violet/purple-themed): hero rainbow
  `from-violet-600 via-purple-500 to-fuchsia-500` → `from-primary to-accent`; gradient
  Run/Running buttons → default primary Button; tab triggers' violet active state → `bg-primary`;
  step-number badge `bg-gradient-to-br ${agent.color}` → `bg-primary`; running spinner/badge,
  running-state borders, table headers/rows, selected-doc highlight, TabsList glass → tokens.
  Kept emerald=complete / red=failed status colours (semantic). Dead `color:` step keys remain (harmless).
- `services/page.tsx` SKIPPED — dev-only page (`notFound()` in production, never user-facing).

## Deploy fix — Contribute hub empty in production (2026-06-11)

Symptom (dev.heritagegraph.xyz): "Contribution types could not be loaded … the loaded
registry has no contribute hub data (often an old server snapshot)."

Root cause: the API builds the ontology registry fresh from YAML per request
(`get_effective_registry_payload` → `build_fresh_payload`), but **falls back to the
latest `SchemaRegistry` DB row when that build raises**. On the server that fallback
row is a stale snapshot from before `contribute_hub` existed, and nothing in the deploy
refreshed it. (`tools/contribute-hub.yaml` and `linkml`/`PyYAML` ARE in the current
image — `COPY ./tools` + requirements — so a fresh build serves it correctly.)

Fix (makes it self-heal on every deploy):
- `apps/cidoc_data/management/commands/rebuild_schema_registry.py`: made idempotent +
  contribute_hub-aware — only writes a new snapshot when the latest row is out of date
  or lacks `contribute_hub`; added `--force`; logs `contribute_hub=present|EMPTY`.
- `heritage_graph/entrypoint.sh`: run `rebuild_schema_registry` on boot (after migrations,
  before KG bootstrap; non-fatal) so the DB fallback is always current.
- Verified locally: `--force` → "rebuilt … (contribute_hub=present)"; plain run → "already current (no snapshot created)".

Immediate remediation on the running server (admin): in the backend container run
`python manage.py rebuild_schema_registry --force`. If it prints `contribute_hub=EMPTY`,
the running image predates `tools/contribute-hub.yaml` → rebuild/redeploy the backend image.

---

## Contribution pipeline — layman-usability overhaul (2026-06-11, in progress)

Plan: `~/.claude/plans/unified-whistling-pearl.md`. P0 (form UX) + entry-point
consolidation done; research-grade entity presentation + globalization pending.

### WS1 — Form layman UX (done, verified tsc/eslint 0)
- Ontology content: added plain-language `description` + `ui_help`/`ui_example` annotations on
  jargon slots in `ontology/HeritageGraph.yaml` (`has_provenance_assertion`, `has_timespan`,
  `existence_status`, `was_produced_by_event`, `carried_out_by`, `invokes_deity`).
- Registry builder: `apps/cidoc_data/ontology_builder.py` now surfaces `ui_help`→`help` and
  `ui_example`→`example` (min/max/pattern already flowed). Added `help`/`example` to TS
  `OntologyField` and regenerated `registry.generated.{json,ts}`.
- Form rendering (`ontology-form.tsx`): new `FieldHelpHint` "What's this?" popover (plain help
  first, CIDOC URI as a secondary expert detail); inline "Example: …" + constraint hints
  ("3–200 characters", "Between 0 and 1").
- Dates: new `src/lib/ontology/date-format.ts` — locale-neutral quick-picks (overridable via
  `NEXT_PUBLIC_DATE_QUICKPICKS`) + plain-language format legend. Replaced the Nepal-only EDTF
  chips ("Malla period", "NS 1140"); plain `date` slots now get the same help (were bare inputs).
- Validation (`useValidation.ts`): friendlier required/cardinality messages (with examples) +
  client-side length/range/pattern enforcement.

### WS3.1 — Contribute hub consolidated to 4 intents (done, /contribute 200)
- `contribute/page-client.tsx`: added a primary 4-card chooser — Add a heritage entity (80% path,
  scrolls to the full type browser), Link/fix an identity, Propose a relationship (was not
  surfaced anywhere before), Run a project. Generic hero copy (was "Preserve Nepal's…"),
  single-hue hero, tokenized all leftover `blue-*`.

### WS3.2 — After-submit feedback loop (done; /contribute/my-contributions 200)
- Backend: `MyContributionSerializer` (extends list serializer) adds the Activity review timeline
  + `latest_feedback`; `CulturalEntityViewSet.my_contributions` prefetches `activities__user` and
  uses it. (`apps/heritage_data/serializers.py`, `views.py`.)
- Frontend: new `/contribute/my-contributions` page — "what happens next" explainer, status badges
  (plain-language: Pending review / Changes requested / Published / Not accepted), reviewer-note
  callout, expandable per-item history, Revise CTA for rejected/changes. Sidebar link added.
  Form success toast now explains the lifecycle + "Track it" action → My contributions.

### WS3.3 — Project-entity status sync (done)
- `_project_rdf_merge` (`signals.py`): on merge, non-published linked entities are set to
  `merged` so the contributor UI and public graph agree (fixed "in graph but shows draft").

### WS4 (P1) — Research-grade entity presentation (done; tsc/eslint 0)
- `ExternalIdentifiers` component — Wikidata/Getty/VIAF/GeoNames/LoC/GND + LUX `externalUri` as
  linked badges; rendered in `entity-metadata-grid` ("Linked data identifiers" section).
- `ImageCredit` caption (artist + license, linked) under the atlas `entity-panel` image; museum
  MediaViewer already had `ImageAttribution`.
- `ConfidenceIndicator` (visual bar + label, handles named + numeric) replaces the text-only
  confidence badge in `why-we-believe-panel`; `CitationText` linkifies URLs/DOIs in citations.
- `CiteEntityDialog` — "Cite" button in the knowledge view header → BibTeX / RIS / JSON-LD
  (schema.org) with copy + CC-BY 4.0 attribution.
- Verified: `apps.cidoc_data.test_e2e_pipeline` passes; django check clean; registry rebuilt.

### WS2 (P2) — Config-driven geography (done; tsc/eslint 0, /atlas 200)
- New `src/lib/map-config.ts`: `MAP_DEFAULT` (lat/lon/zoom) + `GLOBE_DEFAULT_HEIGHT` from
  `NEXT_PUBLIC_MAP_DEFAULT_LAT/LON/ZOOM` + `NEXT_PUBLIC_GLOBE_DEFAULT_HEIGHT`; **default is a
  neutral world view** (no Nepal baked in).
- Atlas globe home/reset camera (`globe.tsx`) and the contribute geo-point picker
  (`geo-point-field.tsx`) now use `MAP_DEFAULT` instead of the hardcoded Kathmandu fallback.
- Backend timezone (`settings/base.py`): `TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE","UTC")`;
  `CELERY_TIMEZONE = TIME_ZONE`. Default UTC; set per deployment.
- Documented `atlas-place-coords.ts` (gazetteer) and `atlas-cities.ts` (city presets) as
  *demo* backfill / configurable sample data — not global constraints.

### Tail (done)
- WS3.4: `CulturalEntityViewSet.perform_create` falls back to notifying staff when there are no
  active reviewers, so submissions never sit silently. (e2e test + check pass.)
- WS4.5: type-aware emphasis — `entity-metadata-grid` shows a "Highlights" box of the top
  ui_weight≥5 fields; added `ui_weight` to signature slots (`has_timespan` 8, `invokes_deity` 8,
  `existence_status` 7, `carried_out_by` 6). Registry regenerated (24 ui_weight entries) + snapshot rebuilt.
- WS4.6: knowledge view shows the full linked-data identifier set; the atlas panel surfaces the
  external (LUX) record link. Projecting the full `external_identifiers` dict into the atlas/museum
  (Oxigraph) layer is a backend RDF-projection enhancement, deferred as a data-pipeline item
  (not UI) — the JSONField isn't currently emitted as owl:sameAs triples.

## Bugfix — Cultural Entity create 400 "Form Data: This field is required" (2026-06-11)
- Cause (pre-existing, not from this work): `/contribute/entity` (the canonical CulturalEntity
  create page — `/contribute/cultural-entity` redirects here) uses the generic ontology form,
  which POSTs a flat payload. But the `entity` class endpoint is `/data/api/cultural-entities/`,
  whose serializer requires a `form_data` wrapper. Flat payload → 400.
- Fix (`ontology-form.tsx handleSubmit`): when the endpoint is the cultural-entities endpoint,
  send `{...payload, form_data: payload}` (revision snapshot) for both create (POST) and edit
  (PATCH); CIDOC `/cidoc/` endpoints stay flat. Verified: wrapped body `is_valid=True`; flat body
  reproduces the exact `form_data required` error. tsc/eslint 0; /contribute/entity 200.

## Bugfix — Cultural Entity "Pending" tab always empty (2026-06-11)
- Symptom: a just-submitted entity (e.g. Pashupatinath, status=pending_review) appeared in
  notifications but not on the Cultural Entity page, even under its "Pending" tab.
- Cause: the knowledge list uses server-side status tabs (Pending → ?status=pending_review),
  but `CulturalEntityViewSet.get_queryset` hard-filtered to `accepted` for all non-staff, so
  the param could only ever yield empty.
- Fix (`views.py get_queryset`): for the list action, an authenticated contributor requesting a
  non-accepted tab (status≠accepted, or all=1) now also sees THEIR OWN non-accepted rows
  (`Q(status="accepted") | Q(contributor=user)`); staff see all; anon/others see accepted only.
  Verified via APIRequestFactory: owner's Pending tab shows the entity; other users + anon do not.

## STATUS: contribution-pipeline overhaul complete (WS1–WS4 + tail). tsc/eslint 0,
## /contribute + /contribute/my-contributions + /atlas 200, django check clean, e2e pass.

---

### Deliberately NOT changed (semantic, not amateur)
- Progression/rank/tier gradients (`progression/page.tsx`, `progression-widgets.tsx`,
  `rank-avatar.tsx`): bronze→diamond tier colours are legitimate gamification semantics.
  The audit's design system permits semantic colour; flattening these to one accent
  would hurt the tier UX. Left as-is.

### Verified
- `tsc --noEmit` → 0 errors. `eslint src --quiet` → 0 errors.
- Pages render 200: `/`, `/leaderboard`, `/contribute`, `/about`.

### Remaining (optional follow-ups from the audit)
- Larger bets: collapse the ~35-item sidebar to ~7 + progressive disclosure;
  type scale + spacing tokens; a11y AA pass; mobile sidebar drawer.
- Long-tail: progression/rank gradients are intentionally kept (semantic tiers).
