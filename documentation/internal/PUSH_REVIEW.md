# Pre-push review (2026-04-10)

## Summary

This change set is primarily an **authentication + session hardening** pass across `heritage_graph_ui`, plus a **public-browsing / selective route gating** adjustment in `middleware.ts`. The landing site gets a small but good refactor to use a shared `apiFetch` helper.

High-level diff surface:

- **~59 files changed** (mostly `heritage_graph_ui`)
- **New files**: `heritage_graph_ui/src/lib/api-client.ts`, `heritage_graph_ui/src/lib/auth-errors.ts`, `heritage_graph_ui/src/components/auth-session-monitor.tsx`, `heritage_graph_ui/src/app/auth/error/*`, `heritage_graph_landing/src/lib/api-fetch.ts`
- **New Django migration**: `heritage_graph/apps/heritage_data/migrations/0012_merge_0005_reviewer_role_request_0011_backfill_fork_lineage.py` (merge-only)
- **Untracked local DB backups**: `heritage_graph/db.sqlite3.bak-*` (should not be committed)

## What looks good

- **Clearer auth error UX**: new `/auth/error` page and shared mapping (`src/lib/auth-errors.ts`) should reduce “silent failure” sign-in issues.
- **Dev-friendly auth**: `CredentialsProvider` added when Google auth isn’t enabled, using Django SimpleJWT (`POST /api/token/`). That aligns with the repo’s “dev vs prod auth differs” guidance.
- **Session expiry handling**: `AuthSessionMonitor` surfaces `session.error` and gives a clear “Sign in again” path.
- **Consistent fetch/error formatting**:
  - UI: `src/lib/api-client.ts` introduces `ApiError`/`NetworkError` and message normalization.
  - Landing: `src/lib/api-fetch.ts` + adoption in discovery + record view pages reduces duplicated error parsing.

## Must-check / potential issues (high signal)

- **Backend handshake endpoint changed**:
  - In `heritage_graph_ui/src/lib/auth.ts`, the sign-in backend “handshake” now calls `GET /data/api/testme/` (previously `/data/testme/`).
  - Verify the Django backend actually exposes **`/data/api/testme/`** in all environments (docker + local). If not, OAuth sign-in will reliably redirect with `?error=BACKEND_SYNC`/`BACKEND_UNAVAILABLE`.

- **Middleware route gating assumptions** (`heritage_graph_ui/src/middleware.ts`):
  - `pathRequiresLogin()` protects a list of prefixes (curation, platform-admin, contribute edit/revise, etc.).
  - Double-check route spelling: e.g. `/notification` vs `/notifications` (if the page route differs, it may not gate correctly).
  - Reminder: this gate is **UI-only**; API permissions still must enforce auth (you already note this in the middleware docstring).

- **Login flow behavior** (`heritage_graph_ui/src/app/auth/login/page-client.tsx`):
  - You’re doing an auto-start sign-in using `signIn(undefined, { redirect: false })` when unauthenticated and no `?error=` is present, then falling back to manual buttons.
  - This is reasonable, but watch for edge cases:
    - If “default provider” isn’t what you expect, it could bounce users unexpectedly.
    - Ensure it doesn’t cause a loop between `/auth/login` and `/api/auth/signin` in dev when credentials auth is intended.

## Pre-push blockers (tooling/CI)

### 1) `heritage_graph_ui` lint currently fails

Running `npm run lint` in `heritage_graph_ui` reports **many errors**, including:

- **React Hooks rules-of-hooks violations** in curation pages (conditional hooks)
- **`React` is not defined** errors (`no-undef`) in several `.tsx` files
- **Unused imports/vars** in multiple files, including one in the files you edited:
  - `heritage_graph_ui/src/lib/auth.ts`: `_e`, `_d` assigned but never used

If you have CI that runs `npm run lint`, this PR/branch is **not push-ready** until lint is either fixed or scoped/disabled appropriately.

### 2) `heritage_graph_landing` lint is blocked by an old ESLint

`npm run lint` in `heritage_graph_landing` fails with:

- “older version of ESLint installed (6.4.0) … upgrade to ESLint 7+”

If CI lints the landing app, this will fail regardless of your code changes until dependencies are updated.

### 3) Backend `ruff` not runnable in current environment

`ruff` isn’t available in the current Python environment (`No module named ruff`), so backend lint status is unknown from this check.

## Files to avoid committing

- **Do not commit** local backups:
  - `heritage_graph/db.sqlite3.bak-20260408-*`

(They’re currently untracked, so they won’t be pushed unless explicitly added.)

## Recommended quick test plan (before pushing)

- **Auth (prod-like)**:
  - With Google enabled: sign in, confirm you land on `callbackUrl` from middleware redirect.
  - Break backend temporarily and confirm you see a readable error (`BACKEND_UNREACHABLE`/`BACKEND_UNAVAILABLE`) and can retry.

- **Auth (dev)**:
  - With Google disabled: sign in with credentials, verify token expiry behavior and that protected routes redirect to `/auth/login`.

- **Route gating**:
  - Confirm `/curation/*`, `/platform-admin/*`, and the contribute edit/revise pages are blocked without a session.
  - Confirm public browsing pages remain accessible.

- **Landing API**:
  - Test discovery + record view pages to confirm `apiFetch` error messages are sensible.

