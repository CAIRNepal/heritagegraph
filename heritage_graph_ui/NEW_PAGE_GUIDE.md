# Creating a New Page (Next.js App Router) — HeritageGraph UI

This repo uses **Next.js 15 App Router** under `heritage_graph_ui/src/app/`.

The main goal is: **pages should be thin** (routing + composition) and most UI logic should live in **reusable components** and **config** so changes happen in one place.

---

## Where to put pages

- **Authenticated app pages** live under:
  - `heritage_graph_ui/src/app/(dashboard)/...`
- **Public / non-dashboard routes** live under:
  - `heritage_graph_ui/src/app/...` (outside `(dashboard)`)

Examples:

- `src/app/(dashboard)/leaderboard/page.tsx`
- `src/app/(dashboard)/knowledge/entity/page.tsx`

---

## The “thin page” pattern (recommended)

Keep `page.tsx` focused on:

- The route and layout
- Page header text (title/description)
- Composing shared components
- Wiring up props/config

Move reusable parts into:

- **Components**: `src/components/...`
- **Configs**: `src/config/...`
- **Lib helpers**: `src/lib/...`
- **Hooks**: `src/hooks/...`

---

## Reusing common dashboard UI (shortcut cards)

The dashboard uses a shared shortcut grid component + shared link config.

- **Edit the links in one place**:
  - `src/config/dashboard-links.ts`
- **Reusable UI**:
  - `src/components/dashboard/shortcut-grid.tsx`

To add a new dashboard shortcut:

1. Open `src/config/dashboard-links.ts`
2. Add a new item to one of:
  - `dashboardQuickActions`
  - `dashboardBrowseCategories`
  - `dashboardCurationShortcuts`
3. The dashboard page will update automatically.

---

## Page styling + animations (one source of truth)

Shared design tokens/animation variants live in:

- `src/lib/design.ts`

Import from `@/lib/design` rather than re-declaring animation objects in every page.

---

## Auth & role gating

If the page requires authentication, prefer using a shared wrapper/component rather than duplicating logic per page.

In this repo there is a shared auth guard component:

- `src/components/require-auth.tsx`

Use it to ensure consistent “sign in” UX instead of each page handling session states differently.

For **high-effort user flows** (especially contribution forms), add **early gating**: middleware and/or a parent layout that wraps `RequireAuth` (see `(dashboard)/contribute/layout.tsx`) so users sign in before starting the form. See `AUTH.md` → “Route-Level Guard”.

---

## Adding the page to navigation

Most dashboard routes should be reachable from the sidebar. Add a nav entry in:

- `heritage_graph_ui/src/components/dashboard/app-sidebar.tsx`

(If that file differs in your branch, search for the existing sidebar component and add the route there.)

---

## Checklist for a new page

- Uses App Router file naming: `.../page.tsx`
- Has a clear `h1` title
- Avoids copy/paste UI: extract repeated patterns into `src/components/*`
- Avoids copy/paste constants: extract into `src/config/*`
- Uses `@/lib/design` for shared visuals/animation variants
- Uses `process.env.NEXT_PUBLIC_API_URL` + `@/lib/api-client` for API calls (no `localhost` fallbacks)

