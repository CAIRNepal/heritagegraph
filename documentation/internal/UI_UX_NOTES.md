# UI/UX notes (internal)

> Merged from UI_UX_REVIEW_localhost_3000.md and UI_UX_AUDIT_ALL_PAGES.md. Not user-facing.

---

# UI/UX Review — `http://localhost:3000/` (Dashboard Home)

> Scope: Review based on the actual page composition and components in `heritage_graph_ui` (dashboard home `/`).  
> Focus: usability, clarity, perceived reliability, and production-readiness.

## First impression (first 3–5 seconds)

- **Feels “designed” and modern** (gradient hero, glass cards, icons, motion).
- **But it reads like a marketing landing page inside a dashboard**, not an operational tool UI. That reduces perceived seriousness/reliability.
- It communicates “go somewhere/do something” more than it communicates **system state** (what changed, what needs attention, what’s next).

## What works well (keep)

- **Clear primary CTAs**: “New Contribution” and “Explore Knowledge Graph” are obvious and appropriately prominent.
- **Chunked information architecture**: Quick Actions, Browse by Category, Curation & Review sections are easy to scan.
- **Consistent interaction pattern**: card = clickable, icon + title + description, arrow affordance.
- **Strong application shell**: sticky header + persistent sidebar makes it feel like a real product environment.
- **Credibility anchors**: footer has CAIR-Nepal branding + GitHub + contact links (good trust signals).

## What is extremely good (standout)

- **Task-oriented homepage structure**: Quick Actions + Category shortcuts + Curation shortcuts is an effective “jumping off” layout for returning users.
- **Role-aware navigation** in the sidebar (moderator/reviewer/platform admin gating) is a major reliability signal *when it behaves predictably*.
- **Sidebar scroll-to-top affordance** is rare and genuinely useful for long nav lists.

## What is good but could be improved

- **Hero section**: visually strong, but it’s doing more aesthetic work than product work.
  - Improve by adding 1–2 high-signal operational items: **pending reviews**, **your drafts**, **last activity**, **system status**, etc.
- **Motion/animation**: fine when subtle; current usage risks feeling “demo-ish.”
  - Reduce animation count/duration; avoid multiple hover scales across the whole page.
- **Section headings**: clear but repetitive in gradient emphasis.
  - Keep gradients as accents; avoid making every heading “special.”
- **Glassmorphism**: can feel premium, but is fragile.
  - Any contrast slip (especially in dark mode) quickly reads as unprofessional/unreliable.
- **Header controls cluster** (progress badge, notifications, auth, theme):
  - Useful, but can become visually noisy.
  - Add tooltips/labels, ensure distinct states, and tighten spacing.

## What is bad (usability issues, confusion, hierarchy)

- **Navigation-heavy, state-light**: the homepage doesn’t answer core dashboard questions:
  - What changed since my last visit?
  - What is blocked or needs review?
  - What is the next recommended action?
  - Is my work saved / synced / approved?
- **Perceived reliability hit from debug behavior**:
  - The home page performs a backend call to a `testthelogin` endpoint and logs to console. This reads like prototype scaffolding.
  - It also falls back to `http://localhost:8000` if env isn’t set, which can cause real “it’s broken” experiences in non-local environments.
- **Overuse of gradients + glass + hover scale**:
  - Too many “effects” makes it harder to see what matters most. Everything competes for attention.
- **Sidebar density**:
  - The knowledgebase list is long; for new users it’s intimidating and hurts findability (high cognitive load).
- **Typography hierarchy inside cards isn’t tight**:
  - Titles/descriptions across sections feel similarly weighted, so users can’t quickly rank importance/urgency.

## What should be removed (unnecessary / distracting / harmful)

- **Remove the homepage “test login” fetch + console logging**. It’s actively harmful to trust and can create noisy failures.
- **Remove redundant decorative layers** that don’t convey meaning (multiple hero “orbs,” hover overlays on everything).
- If “Browse by Category” mirrors the sidebar 1:1, **remove or shrink it** to only the top 3–5 most-used categories.

## Specific UI/UX issues (layout, spacing, typography, color, responsiveness, accessibility)

### Layout & spacing

- The page is airy with many large sections and generous spacing. Looks nice, but increases scrolling before users see “work state.”
- Action: add an above-the-fold status panel; compress or collapse one navigation-heavy section.

### Typography & hierarchy

- Heavy hero styling (very bold, large, gradient emphasis) reads marketing-first.
- Action: reduce hero weight and shift emphasis to operational metrics and “next actions.”

### Color & contrast

- White text on bright gradients + translucent surfaces is easy to get wrong for accessibility.
- Action: run contrast checks on hero badge text and buttons; consider a darker overlay behind text.

### Responsiveness

- “Browse by Category” becomes many small targets on mobile (`grid-cols-2`), increasing mis-taps.
- Action: use a short list, or horizontally scrollable chips with larger tap targets on small screens.

### Accessibility

- Card-as-link UX needs strong focus styles and keyboard navigation clarity.
- Motion should respect `prefers-reduced-motion`.
- Action: ensure visible focus rings on all clickable cards/links; implement reduced-motion behavior for major animations.

### Feedback states

- The home page itself is mostly static navigation; the app shell has “live” elements (notifications/progression).
- Action: if key panels fail to load, show a small, non-alarming status indicator so users don’t assume the whole platform is unstable.

## Trust & reliability signals (credible, safe, professional?)

### Positive signals

- CAIR-Nepal logo + outbound links (GitHub, organization site, email) increase legitimacy.
- Role-based navigation suggests real access control and governance.

### Negative signals

- Prototype smells (console logging, `testthelogin` endpoint) reduce professional credibility.
- Marketing copy inside an authenticated dashboard can feel like filler rather than function.
- Too many gradients/effects can read as “template UI,” not a stable tool used daily.

## Suggestions to feel more reliable, polished, production-ready (high impact)

- **Replace hero paragraph with operational content**:
  - Pending reviews, your drafts, last submission status, “needs attention,” system status.
- **Add a “Today / Next actions” panel** above the fold:
  - Max 3 items, each with a clear CTA. This instantly raises usability and maturity.
- **Reduce effects density**:
  - Use gradients as accents; make most surfaces neutral/stable; remove most hover scaling.
- **Tighten navigation**:
  - Sidebar: collapse knowledgebase or add a “More…” section; consider a nav search.
  - Homepage: avoid mirroring full sidebar; show only the most-used destinations.
- **Kill debug behavior on `/`**:
  - Remove test fetch/logging; ensure API base URL never silently falls back in production; surface failures only when actionable.
- **Accessibility polish pass**:
  - Improve focus visibility on glass backgrounds; implement reduced-motion; verify contrast in both themes.


---

# UI/UX Robustness Audit — All Pages

> Scope: All `page.tsx` / `page-client.tsx` routes in:
> - `heritage_graph_ui/src/app/**`
> - `heritage_graph_landing/src/app/**`
>
> Goal: Make the product feel **robust, credible, and production-ready** (states, consistency, accessibility, and trust signals).

## Global findings (top 10, prioritized)

1) **Hardcoded API fallbacks (`http://localhost:8000`, `http://backend.localhost`) are widespread**
   - **Why it hurts**: production misconfig can silently “work” against localhost or fail in confusing ways.
   - **Fix**: centralize API base resolution in one helper, **remove localhost fallbacks**, and fail fast with a clear UI banner/toast.

2) **Console logs + debug-only behavior are present in real user routes**
   - **Why it hurts**: “prototype smell,” noisy failures, and users/devtools showing instability.
   - **Fix**: add an ESLint rule to block `console.*` in production builds and replace with user-facing errors + optional telemetry.

3) **Auth/permissions gating is inconsistent**
   - **Why it hurts**: users see blank/partial screens or generic errors when they actually need to sign in / request access.
   - **Fix**: shared `RequireAuth` + `RequireRole` wrappers with consistent messaging and CTAs.

4) **Loading/error/empty states are inconsistent and often not actionable**
   - **Why it hurts**: “Error.” without next steps feels unreliable.
   - **Fix**: standard `StatePanel` (loading/empty/error) with **Retry**, **Go back**, and **Report issue** link.

5) **Accessibility gaps: non-semantic clickable rows/divs, missing labels, focus clarity**
   - **Fix**: use `<button>`/`<a>` for interactive elements, add proper `<Label htmlFor>` for inputs, ensure visible focus rings, and add `aria-label` for icon-only buttons.

6) **Reduced-motion support is inconsistent**
   - **Fix**: one animation helper that auto-disables heavy motion under `prefers-reduced-motion`.

7) **Visual consistency drift due to repeated copy-pasted “hero/section” patterns**
   - **Fix**: extract shared `PageHero`, `PageSectionTitle`, `PageContainer`, and “glass card” wrappers.

8) **Table-only pages lack page-level context**
   - **Fix**: enforce per-page `h1`, short description, and consistent padding/breadcrumb/help links.

9) **Trust/provenance/status is not consistently surfaced across record views**
   - **Fix**: standard “Record status / provenance / confidence / sources” panel across all view pages.

10) **Responsive risks on dense tables and multi-panel screens**
   - **Fix**: stack panels on mobile, make tabs scrollable, and add card-layout fallbacks for tables under `md`.

---

## Per-page recommendations

### `/` — `heritage_graph_ui/src/app/(dashboard)/page.tsx`
- **Auth clarity**: if unauthenticated, show a clear “Sign in” CTA or “Guest mode” copy (avoid silently generic UI).
- **A11y**: ensure card links have strong focus styles and meaningful accessible names.
- **Consistency**: keep this page as the baseline; extract shared hero/section components to reduce drift.

### `/auth/login` — `heritage_graph_ui/src/app/auth/login/page.tsx`
- **Consistency**: match app shell visuals (centered card, consistent typography).
- **Callback safety**: keep sanitization consistent across auth entrypoints.

### `/auth/login` — `heritage_graph_ui/src/app/auth/login/page-client.tsx`
- **A11y**: add visible labels (not placeholders-only) for username/password.
- **Clarity**: explain Dev auth vs Google OAuth (when each applies).
- **Supportability**: add “Copy error details” + link to common fixes (auth guide).

### `/auth/error` — `heritage_graph_ui/src/app/auth/error/page.tsx`
- **Fallback UX**: use a consistent loading card and `role="status"`.

### `/auth/error` — `heritage_graph_ui/src/app/auth/error/page-client.tsx`
- **Trust**: show raw error code in a copyable block for support.
- **Navigation**: ensure “Home” doesn’t send unauthenticated users into a redirect loop.

### `/services` — `heritage_graph_ui/src/app/services/page.tsx`
- **Hardcoded URLs**: remove `http://localhost*`/`backend.localhost`/Keycloak placeholders or gate behind dev-only.
- **Design drift**: rebuild with the current design system (shadcn, `glassCard`) or remove from prod routes.

### `/contribute/scan/[id]` — `heritage_graph_ui/src/app/contribute/scan/[id]/page.tsx`
- **Trust-killer**: `/terms` and `/privacy` links appear missing—either implement pages or remove links.
- **Bug**: errors are set but not rendered; show an error panel + retry.
- **A11y**: add labels for contact inputs; add privacy/retention copy if collecting email/phone.

### `/community/contributors` — `heritage_graph_ui/src/app/(dashboard)/community/contributors/page.tsx`
- **Remove localhost fallback** and centralize API base.
- **A11y**: icon-only pagination needs `aria-label`.
- **Empty state**: add “Clear search” CTA when filters produce no results.

### `/community/organizations` — `heritage_graph_ui/src/app/(dashboard)/community/organizations/page.tsx`
- **Auth gating**: when signed out, show “Sign in to create/join”.
- **Validation**: show inline validation (not toast-only).
- **A11y**: clickable cards must be keyboard reachable.

### `/leaderboard` — `heritage_graph_ui/src/app/(dashboard)/leaderboard/page.tsx`
- **API base**: remove localhost fallback.
- **Consistency**: use shadcn `Button` for retry.
- **Perf**: consider virtualization for large lists; honor reduced motion.

### `/progression` — `heritage_graph_ui/src/app/(dashboard)/progression/page.tsx`
- **Auth story**: either make public safely or show “Sign in for personalized progression”.
- **Reduced motion**: progress animations should respect user preference.
- **Copy density**: collapse long explanations into “Learn more”.

### `/team` — `heritage_graph_ui/src/app/(dashboard)/team/page.tsx`
- **Security/trust**: ensure external links are `https://` (not `http://`).
- **Recovery**: add retry for contributor fetch errors.
- **Reduced motion**: disable pulse effects under reduced-motion.

### `/notification` — `heritage_graph_ui/src/app/(dashboard)/notification/page.tsx`
- **Auth clarity**: explicit sign-in prompt if unauthenticated.
- **A11y**: clickable `<li>` needs keyboard support or use `<button>/<a>`.
- **Pagination**: remove `href="#"` and use real buttons/routes.

### `/account` — `heritage_graph_ui/src/app/(dashboard)/account/page.tsx`
- **Critical trust issue**: hardcoded user/devices data should not appear in production UI.
- **Implementation**: wire to real session/profile data or gate behind “Not implemented” messaging.

### `/platform-admin` — `heritage_graph_ui/src/app/(dashboard)/platform-admin/page.tsx`
- **Redirect UX**: add a small loading skeleton while redirecting.

### `/platform-admin/users` — `heritage_graph_ui/src/app/(dashboard)/platform-admin/users/page.tsx`
- **403 handling**: show explicit “Forbidden” panel with next steps.
- **Loading**: use skeleton rows (reduces layout shift).

### `/platform-admin/users/[id]` — `heritage_graph_ui/src/app/(dashboard)/platform-admin/users/[id]/page.tsx`
- **Error recovery**: show the failure reason + retry, not just “no user”.
- **UX**: after role changes, show inline confirmation + updated badge.

### `/users/[slug]` — `heritage_graph_ui/src/app/(dashboard)/users/[slug]/page.tsx`
- **A11y**: icon-only actions need `aria-label`.
- **Empty tabs**: hide “Coming soon” tabs or show a clear placeholder panel.
- **Upload validation**: add file size/type constraints + user feedback.

### `/graphview` — `heritage_graph_ui/src/app/(dashboard)/graphview/page.tsx`
- **Good**: loader uses `role="status"`. Consider skeleton toolbar to reduce jump.

### `/moderate` — `heritage_graph_ui/src/app/(dashboard)/moderate/page.tsx`
- **Missing context**: add title, description, and permission gating.
- **States**: add page-level loading/error/empty if table component doesn’t.

### `/infobox` — `heritage_graph_ui/src/app/(dashboard)/infobox/page.tsx`
- **Production risk**: looks like a mock (“Banana”)—remove/gate behind dev flag.
- **A11y**: tabs should be buttons with keyboard interaction, not clickable list items.

### `/versionviewer` — `heritage_graph_ui/src/app/(dashboard)/versionviewer/page.tsx`
- **Clarity**: add “What is this?” explanation; “version viewer” is ambiguous.
- **Robustness**: ensure import target exists and has error boundaries.

### `/test` — `heritage_graph_ui/src/app/(dashboard)/test/page.tsx` and `page-client.tsx`
- **Remove from production** or gate behind env flag.
- Replace `alert()` with toast if kept for demos; align styling with app theme.

---

## Knowledge base list pages (table-only)

These pages are mostly “render a table and nothing else,” which feels thin/fragile and hurts usability:
- `/knowledge/entity` — `heritage_graph_ui/src/app/(dashboard)/knowledge/entity/page.tsx`
- `/knowledge/person` — `.../knowledge/person/page.tsx`
- `/knowledge/location` — `.../knowledge/location/page.tsx`
- `/knowledge/event` — `.../knowledge/event/page.tsx`
- `/knowledge/period` — `.../knowledge/period/page.tsx`
- `/knowledge/tradition` — `.../knowledge/tradition/page.tsx`
- `/knowledge/source` — `.../knowledge/source/page.tsx`
- `/knowledge/structure` — `.../knowledge/structure/page.tsx`
- `/knowledge/monument` — `.../knowledge/monument/page.tsx`
- `/knowledge/festival` — `.../knowledge/festival/page.tsx`
- `/knowledge/iconography` — `.../knowledge/iconography/page.tsx`
- `/knowledge/deity` — `.../knowledge/deity/page.tsx`
- `/knowledge/ritual` — `.../knowledge/ritual/page.tsx`
- `/knowledge/guthi` — `.../knowledge/guthi/page.tsx`

**Fix for all of them**
- Add a consistent `h1` + 1–2 line description (“what is this list?”).
- Provide “How to contribute” and “What do these statuses mean?” links.
- Ensure consistent page-level loading/error/empty states (don’t rely on the table alone).

---

## Knowledge base view pages (dynamic `[id]`)

### `/knowledge/entity/view/[id]` — `heritage_graph_ui/src/app/(dashboard)/knowledge/entity/view/[id]/page-client.tsx`
- Centralize API base (remove localhost fallback).
- Improve error state to distinguish **unauthenticated** vs **not found** vs **server error**, and add Retry.
- Render objects as readable panels (collapsible JSON with copy) instead of raw `JSON.stringify`.

### `/knowledge/[domain]/view/[id]` — `heritage_graph_ui/src/app/(dashboard)/knowledge/[domain]/view/[id]/page-client.tsx`
- Sticky action bar: ensure it doesn’t cover content on small screens; add `scroll-margin-top`.
- Add clearer explanations when reactions/forks/comments are disabled (with CTA to create a proper cultural entity).
- Replace plain paragraph errors with a consistent error panel + retry.

### `/knowledge/structure/view/[id]` — `heritage_graph_ui/src/app/(dashboard)/knowledge/structure/view/[id]/page-client.tsx`
- Unify env var usage (`NEXT_PUBLIC_API_*`): it currently differs from the rest.
- Remove console error logs; show UI-only error with retry.
- Hide “Coming Soon” tabs (or clearly gate them) to avoid dead ends.

---

## Curation pages

### `/curation/dashboard` — `heritage_graph_ui/src/app/(dashboard)/curation/dashboard/page.tsx`
- Ensure reviewer/moderator terminology matches actual permissions.
- Add “Request reviewer access” CTA when denied.

### `/curation/activity` — `heritage_graph_ui/src/app/(dashboard)/curation/activity/page.tsx`
- Add sticky filters or jump navigation for long timelines.
- Centralize API base (remove localhost fallback).

### `/curation/contributions` — `heritage_graph_ui/src/app/(dashboard)/curation/contributions/page.tsx`
- **Misleading counts**: tab counts are computed from current results, not total; fix before relying on it.
- Add role gating and 403 handling.
- Ensure clickable table rows are keyboard accessible.

### `/curation/review` — `heritage_graph_ui/src/app/(dashboard)/curation/review/page.tsx`
- Make tabs horizontally scrollable on mobile.
- Prefer skeleton list over a single spinner.

### `/curation/review/[id]` — `heritage_graph_ui/src/app/(dashboard)/curation/review/[id]/page.tsx`
- Enforce required conflict resolution before allowing submit when conflicts exist.
- Add confirm dialogs for destructive actions (merge/promote/reject).
- Implement mobile layout (panel tabs) for the 3-panel workspace.

### `/curation/conflicts` — `heritage_graph_ui/src/app/(dashboard)/curation/conflicts/page.tsx`
- Use real links/buttons (keyboard access) for list items.
- Put Retry in a consistent place.

### `/curation/qr-contributions` — `heritage_graph_ui/src/app/(dashboard)/curation/qr-contributions/page.tsx`
- Role check before showing contributor emails; minimize sensitive data by default.
- Fix action handler state flow (avoid stale state when approving/rejecting).

### `/curation/forks` — `heritage_graph_ui/src/app/(dashboard)/curation/forks/page.tsx`
- Add role gating and 403 UI.
- Improve large-tree performance (collapse/virtualize) and add `aria-expanded` semantics.

---

## Contribute pages

Most contribute routes rely heavily on shared form components. The “robustness” win is mostly **standardizing UX and guardrails**:

- Add consistent page headers (“What you’re submitting”, “What happens next”).
- Provide save/progress affordances, clear required-field marking, and inline validation (not toast-only).
- Decide and communicate whether submissions are allowed while signed out (and provide consistent “Sign in to submit” UX if required).
- Ensure date/coordinates fields are structured (avoid free-text where it matters).

Notable high-impact pages:

### `/contribute/entity/edit` and `/contribute/entity/revise`
- Stop passing full JSON via URL query strings (fragile). Prefer entity ID + refetch.
- Remove debug logs; add inline parse/validation error panel.

### `/contribute/structure` and `/contribute/ritual` (page-client wizards)
- Add reduced-motion support.
- Add step change announcements for screen readers.
- Validate date formats and coordinate formats with examples and inline errors.

### `/contribute/caste-group` and Kumari-related routes
- Add sensitivity/provenance guidance and moderation expectations.
- Consider stricter role gating and explicit privacy notices.

---

## Community: reviewer request

### `/community/reviewer-request` — `heritage_graph_ui/src/app/(dashboard)/community/reviewer-request/page.tsx`
- Add `h1` + short explanation; ensure clear post-submit confirmation and next steps.

---

## Landing app (`heritage_graph_landing`)

### `/` — `heritage_graph_landing/src/app/page.tsx`
- Add `aria-expanded`/`aria-controls` for the filter panel toggle.
- Ensure “API down” states include a **Retry** button.

### `/view/[resource]/[id]` — `heritage_graph_landing/src/app/view/[resource]/[id]/page.tsx`
- Improve invalid resource UX (“Back to discovery” CTA).
- Show error type (404 vs 500) and render JSON in structured, collapsible sections.
- Add warning if “Open in app” requires login.

