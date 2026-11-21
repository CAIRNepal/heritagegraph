# HeritageGraph — Comprehensive UI/UX Audit (2026-06-11)

Grounded in the actual codebase (`heritage_graph_ui/`). References exact tokens,
components, and class strings.

## Snapshot of what exists (evidence)
- **Tokens** (`src/app/globals.css`): primary `#1e4e8c`, full light/dark, `--radius: 0.625rem`, shadow scale, `--font-sans: Poppins`, `--font-serif: Fraunces`.
- **Component lib**: shadcn/ui "new-york", 40+ primitives. Button variants are token-based (`bg-primary … shadow-xs`, sizes h-8/h-9/h-10, `rounded-md`). Card = `rounded-xl border py-6 shadow-sm`.
- **But two competing card systems**: `glassCard` (`bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 rounded-2xl shadow-lg`) used on most dashboard surfaces, vs shadcn Card (`rounded-xl shadow-sm`). Plus `heroGradient` (`from-blue-600 via-sky-500 to-cyan-500 opacity-95`).
- **Color sprawl**: 12 distinct gradient hues across components — blue ×88, amber ×37, violet ×20, gray ×15, orange ×14, emerald ×12, yellow ×6, sky ×4, rose ×4, purple ×3, red ×2. That is a rainbow, not a palette.
- **Radius chaos**: `rounded-md` (buttons/tokens) + `rounded-xl` (cards) + `rounded-2xl` (glassCard) + `rounded-full` (hero CTAs) all coexist.
- **Navigation**: ~35 sidebar items across ~5 groups — very heavy IA.
- **Motion**: framer-motion (`fadeInUp`, `staggerContainer`, `scaleIn`), `useReducedMotion` respected on home.
- **Recently added**: ⌘K command palette, Discover hub, Poppins/Fraunces wiring, color-discipline pass on 28 headings.

---

## 1. Visual Design Assessment (scores /10)

| Category | Score | Why |
|---|---|---|
| Visual hierarchy | 5 | Hero is strong, but every section uses the same 2xl glass card + gradient heading → flat emphasis; nothing recedes. |
| Color palette consistency | 3 | 12 hues in gradients; `glassCard` hardcodes `border-blue-200` instead of `--border`. Brand reads "blue + everything." |
| Typography system | 6 | Now Poppins + Fraunces (fixed), good pairing — but no type *scale* discipline (h2 hardcoded `text-2xl` everywhere; no display/overline/caption tiers). |
| Font pairing & readability | 7 | Poppins body + Fraunces display is a credible pairing; line-length/`leading` mostly fine. |
| White space | 5 | `space-y-8` sections are OK, but glass cards + gradients fill space; little "calm." |
| Alignment & spacing | 5 | Inconsistent radii (md/xl/2xl/full) and shadows (xs/sm/lg) signal no system. |
| Component consistency | 4 | Two card languages (glass vs shadcn), pill hero buttons vs rounded-md elsewhere. |
| Iconography | 7 | Tabler set, consistent; good. Gradient icon tiles are a bit 2021. |
| Brand identity | 5 | Blue + glass + gradients is generic "dashboard template," not a distinctive heritage brand. |
| Professional appearance | 5 | Competent but template-y; rainbow gradients undercut it. |
| Trust & credibility | 6 | Provenance/CC-BY/review messaging helps; visual polish is the limiter. |
**Visual average ≈ 5.3/10.**

## 2. UX Assessment + friction points

| Category | Score | Notes |
|---|---|---|
| Navigation structure | 4 | **35 sidebar items** — overwhelming; no progressive disclosure. |
| User journey | 5 | New Discover hub helps; but home → 5 stacked sections is undirected. |
| Information architecture | 4 | Curation, contribute, community, knowledge all flattened in one rail. |
| Ease of use | 6 | ⌘K palette is a big win; forms are registry-driven and consistent. |
| Cognitive load | 4 | Gradient noise + 35 nav items + dense dashboards. |
| Accessibility | 5 | `focus-visible:ring-[3px]` good; but `<img>` without alt (QR, XR), color-only status, no audited contrast on gradient text. |
| Mobile responsiveness | 6 | 443 responsive utilities; but the heavy sidebar + globe/graph are desktop-first. |
| Form usability | 7 | Ontology-driven forms, validation, draft saving — solid. |
| Search experience | 7 | ⌘K entity search (new) is strong; no in-page search on list views. |
| Error handling | 7 | `getApiErrorMessage`, toasts, error states present. |
| Loading states | 7 | Skeletons used (`ProjectCardSkeleton`, Discover). |
| Empty states | 4 | Mostly bare ("No results"); Identity Queue empty; little guidance. |

**Top friction points:** (1) 35-item sidebar; (2) gradient/visual noise raising cognitive load; (3) undirected home (5 equal sections); (4) empty states without next-step guidance; (5) desktop-first heavy viz on mobile; (6) inconsistent component language erodes "is this finished?" confidence.

## 3. Benchmark comparison
- **Linear** — ruthless restraint: 1 accent, near-zero gradients, tight 8px grid, keyboard-first (you now have ⌘K — extend it). *Adopt:* collapse nav to ~7 items + command-driven everything; kill gradients.
- **Stripe** — calm neutrals + one brand, a real type scale, subtle depth. *Adopt:* a documented type scale and elevation system; remove glass.
- **OpenAI** — minimalist, generous whitespace, mono-accent, content-first. *Adopt:* whitespace + single accent; let content breathe.
- **Vercel** — black/white + geist, crisp 1px borders, no shadows-as-decoration. *Adopt:* border-driven separation over heavy shadows/glass.
- **Notion** — soft neutral surfaces, content density done calmly, great empty states. *Adopt:* helpful empty states with CTAs.
- **Apple** — typographic hierarchy + restraint + intentional motion. *Adopt:* Fraunces display tier used sparingly for hero moments only.
**Missing across the board:** restraint, a single accent, a documented scale, and emptiness as a feature.

## 4. Modern-trends audit
- ✅ Design tokens, dark mode, shadcn, framer-motion, ⌘K, AI ChatWidget (AI-native), reduced-motion.
- ⚠️ **Glassmorphism overused** — `glassCard` on nearly every surface (2021 trend; now reads dated). Use sparingly (overlays only).
- ⚠️ **Gradient-everything** — section gradients + gradient icon tiles + (former) gradient headings. 2020–2021 aesthetic.
- ❌ Micro-interactions shallow (hover scale only); no optimistic UI polish, no skeleton→content cross-fades, no focus choreography.
- ❌ No motion system (durations/easings ad-hoc).
**Outdated patterns:** glass-on-everything, multi-stop gradient surfaces, gradient icon chips, pill CTAs mixed with square inputs.

## 5. Component-level analysis (problem → why amateur → fix)
- **Navbar/site-header**: thin; title was gradient-clipped (fixed → Fraunces solid). *Fix:* add breadcrumbs + the ⌘K trigger is good; keep header to title + search + user.
- **Sidebar**: 35 items, flat. *Amateur:* dumps every route. *Fix:* 6–7 primary items, group the rest under "More"/role-gated; collapsible sections; active-state with a 2px accent bar (Linear).
- **Hero (home)**: `glassCard` + `heroGradient` + `rounded-full` white CTAs. *Amateur:* template gradient + pill buttons clash with square inputs. *Fix:* solid `bg-primary` (or a single subtle gradient), `rounded-md` buttons matching the system, Fraunces headline.
- **Cards**: two systems (glass vs shadcn). *Fix:* one Card — `rounded-xl border bg-card shadow-xs`, no glass; reserve elevation for hover.
- **Buttons**: shadcn variants are good; *Fix:* stop overriding to `rounded-full`/custom white; use `variant="secondary"` on dark heroes.
- **Tables** (`heritage-table`): functional (TanStack). *Fix:* sticky header, zebra off, more row padding (h-12), right-align numerics, muted column headers.
- **Forms**: strong. *Fix:* group fields in `fieldset`, inline validation, sticky submit bar.
- **Search bar**: ⌘K is great; add a visible search on list pages.
- **Filters** (museum/atlas): present; *Fix:* consistent chip styling, "clear all".
- **Modals/Dialogs**: shadcn dialog (good); the new Welcome dialog is on-pattern.
- **Footer**: minimal/clean — fine.

## 6. Frontend engineering
- **CSS/Tailwind**: tokens good; but hardcoded `border-blue-200`, `from-blue-*` everywhere violate the token system (your own CLAUDE.md says colors live in globals.css). *Fix:* lint rule / sweep to semantic tokens (started — 28 headings done).
- **Component reuse**: `glassCard`/`heroGradient` shared (good intent, wrong aesthetic). Extract `<PageHeader>`, `<SectionHeading>`, one `<StatCard>`.
- **Responsiveness**: solid utility coverage; viz is desktop-first.
- **A11y**: add alt text, aria-labels on icon buttons, audit contrast of `text-blue-100` on gradients, prefers-reduced-motion everywhere (only home has it).
- **Performance**: good (dynamic imports for XR/globe). Watch framer-motion on long lists.
- **Animation quality**: centralize a motion system (tokens for duration/easing); add layout animations + skeleton cross-fades.

## 7. Conversion & trust
- **5-second impression**: "competent academic dashboard," not "elite startup." Gradient hero + glass + dense sidebar read template/student-made.
- **Makes it look academic/prototype**: rainbow gradients; 35-item nav; gradient-clipped headings (fixed); inconsistent radii; glass everywhere; emoji in copy.
- **Fix**: one accent, neutral surfaces, Fraunces display for one hero line, restraint, real empty states, consistent radius/shadow.

## 8. Redesign roadmap
**Critical (must fix) — top 20:** 1 collapse sidebar to ~7 items; 2 single accent (kill 11 of 12 hues); 3 one card system (drop glass); 4 one radius scale; 5 one shadow/elevation scale; 6 remove gradient section overlays; 7 replace gradient icon tiles with tinted-token chips; 8 align button radius (no pills); 9 type scale tokens; 10 use Fraunces only for display; 11 alt text + aria labels; 12 contrast audit; 13 reduced-motion everywhere; 14 real empty states; 15 sticky table headers + padding; 16 home: one primary CTA, not five equal sections; 17 semantic tokens sweep (no `blue-200`); 18 consistent focus rings; 19 mobile sidebar→drawer + bottom-nav; 20 dark-mode contrast pass on tinted surfaces.
**High-impact (top 20):** breadcrumbs; ⌘K everywhere (done); command-first nav; PageHeader component; StatCard; hover elevation only; 8px spacing grid; section overlines; quiet table; inline form validation; skeleton→content cross-fade; optimistic reactions; entity hero pages; related-entity rails; trending; saved/bookmarks; profile pages; activity feed; onboarding (done); motion tokens.
**World-class:** Linear-style command-driven everything + keyboard map; Stripe-grade docs/empty states; Apple display typography moments on entity pages; Vercel border-driven minimalism; OpenAI whitespace + mono-accent; subtle scroll-linked motion on the museum.

## 9. Design system proposal
- **Color**: 1 brand (keep `#1e4e8c` primary) + 1 accent (a warm heritage gold, used <5%), neutral gray ramp, semantic success/warn/error. Ban ad-hoc `from-*` hues. *Why:* one accent = perceived focus + premium.
- **Type scale**: display (Fraunces 36/44), h1 30, h2 24, h3 20, body 16/15, small 13, overline 11 caps. *Why:* a scale reads "designed."
- **Spacing**: strict 4/8 grid (4,8,12,16,24,32,48,64). *Why:* rhythm = polish.
- **Radius**: sm 6, md 8 (default), lg 12, full only for avatars/pills-as-tags. Collapse to 2 tiers. *Why:* consistency.
- **Shadows/elevation**: 3 levels only (`xs` rest, `sm` raised, `md` overlay); no shadow-lg on static cards. *Why:* restraint = quality.
- **Buttons**: primary (solid), secondary (tonal), ghost, link — all `rounded-md` h-9; no custom white pills.
- **Cards**: `bg-card border rounded-lg p-5 shadow-xs`, hover `shadow-sm`. One component.
- **Motion**: durations 120/200/320ms, ease `cubic-bezier(0.2,0,0,1)`; reduced-motion respected; layout + cross-fade.

## 10. Final verdict
- Current UI: **58/100**
- UX: **62/100**
- Visual maturity: **52/100**
- Enterprise readiness: **55/100**
- Startup launch readiness: **60/100**

**To look like a top-tier SV startup built by an elite team:** impose *restraint and a system*. Concretely: (1) one accent + neutrals (delete the rainbow), (2) one card/radius/shadow scale (delete glass), (3) a real type scale with Fraunces for sparse display moments, (4) collapse the 35-item nav to ~7 + command-driven navigation, (5) a motion system, (6) world-class empty states + entity hero pages, (7) a11y + mobile drawer. The bones (tokens, shadcn, dark mode, ⌘K, AI, dynamic viz) are already strong — the gap is *editing*, not building.
