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
