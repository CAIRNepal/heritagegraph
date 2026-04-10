# AUTH.md — Authentication Guide for Developers

> **Audience:** Any developer adding a new feature, page, or API call that needs to know who the user is, protect a route, or talk to the Django backend on behalf of a logged-in user.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Variables](#environment-variables)
3. [Key Files at a Glance](#key-files-at-a-glance)
4. [Frontend: Reading the Session](#frontend-reading-the-session)
   - [Client Components (`'use client'`)](#client-components-use-client)
   - [Server Components / API Routes](#server-components--api-routes)
5. [Protecting a Page or Route](#protecting-a-page-or-route)
   - [Client-Side Guard](#client-side-guard)
   - [Server-Side Guard (Middleware)](#server-side-guard-middleware)
6. [Calling the Django Backend](#calling-the-django-backend)
   - [From a Client Component](#from-a-client-component)
   - [From a Server Component / Route Handler](#from-a-server-component--route-handler)
7. [Backend: How Django Verifies the Token](#backend-how-django-verifies-the-token)
8. [TypeScript Types for Session](#typescript-types-for-session)
9. [Sign In / Sign Out](#sign-in--sign-out)
10. [Errors and Recovery (UX)](#errors-and-recovery-ux)
11. [Common Pitfalls](#common-pitfalls)
12. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Architecture Overview

The **Next.js dashboard** (`heritage_graph_ui`) supports **Google sign-in only**. NextAuth registers `GoogleProvider` when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set; there is no GitHub or username/password provider in the UI.

The **Django API** still accepts multiple token types depending on `settings` (Google userinfo verification first, then optional GitHub, session, then SimpleJWT). For day-to-day product use, assume the browser sends a **Google OAuth access token** (and refresh flow) from NextAuth.

| Layer | Role |
|--------|------|
| **NextAuth** | OAuth redirect with Google; JWT session cookie; optional refresh of access token |
| **Django** | Verifies `Authorization: Bearer …` via `GoogleTokenAuthentication` when `GOOGLE_CLIENT_ID` is set on the backend |

### Sign-in flow (Google only)

```
┌─────────────┐   Google OAuth   ┌──────────────┐
│  Browser     │ ◄──────────────► │  Google      │
│  (Next.js)   │                  │  OAuth 2.0   │
└──────┬───────┘                  └──────────────┘
       │
       │  NextAuth completes OAuth and stores tokens in an encrypted session cookie
       │
       ▼
┌──────────────┐  Bearer <google access token>  ┌──────────────────┐
│  Next.js     │ ─────────────────────────────► │  Django (DRF)    │
│  Frontend    │                                 │  Backend         │
│  (port 3000) │ ◄────────────────────────────── │  (port 8000)     │
└──────────────┘   JSON response                └──────────────────┘
```

**How it works:**

1. User opens `/auth/login` (or is redirected from a protected route). The app redirects to Google (or shows configuration help if OAuth env vars are missing).
2. After Google returns, NextAuth runs a **server-side handshake**: `GET /data/api/testme/` with the token before the session is created. Failures map to clear `?error=` codes on `/auth/login`.
3. `session.accessToken` is the Google token used for API calls. NextAuth refreshes it while a refresh token is available.
4. Django verifies the token (see `apps/heritage_data/authentication.py`) and attaches `request.user`.

**API-only / automation:** You can still obtain a SimpleJWT access token with `POST /api/token/` against Django; that path does not use the Next.js login page.

---

## Environment Variables

### Next.js (`heritage_graph_ui`)

| Variable | Required? | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | **Yes** (for any working sign-in) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **Yes** | Google OAuth client secret |
| `NEXTAUTH_URL` | Yes | Canonical origin (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `INTERNAL_BACKEND_URL` | Yes in Docker | Server-side URL to Django (`http://backend:8000` in compose) |
| `NEXT_PUBLIC_API_URL` | Yes | Browser-visible API origin |

If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are missing, `/auth/login` explains that Google is not configured (see `missingGoogleOAuthConfigMessage` in `src/lib/auth-errors.ts`).

### Production checklist

Same Google **client ID** on Next.js and Django; `DJANGO_ENV=production` on the API host; HTTPS-ready `NEXTAUTH_URL` and authorized redirect URIs in Google Cloud Console (`…/api/auth/callback/google`).

---

## Key Files at a Glance

| File | What it does |
|---|---|
| `heritage_graph_ui/src/app/api/auth/[...nextauth]/route.ts` | NextAuth HTTP handler |
| `heritage_graph_ui/src/lib/auth.ts` | `authOptions` config (importable for server-side `getServerSession`) |
| `heritage_graph_ui/src/app/auth/login/page.tsx` | Google-only sign-in (configuration + `?error=` handling) |
| `heritage_graph_ui/src/app/auth/error/page.tsx` | NextAuth `pages.error` — maps provider/configuration errors to copy |
| `heritage_graph_ui/src/lib/auth-errors.ts` | User-facing strings for URL errors, session errors, and NextAuth codes |
| `heritage_graph_ui/src/components/auth-session-monitor.tsx` | Banner when `session.error` is set (e.g. token refresh failure) |
| `heritage_graph_ui/src/app/SessionProvider.tsx` | Client wrapper — `SessionProvider` + `ThemeProvider` + session error monitor |
| `heritage_graph_ui/src/app/layout.tsx` | Root layout — wraps everything in `NextAuthSessionProvider` |
| `heritage_graph_ui/types/next-auth.d.ts` | TypeScript augmentations for `Session`, `JWT`, and `User` |
| `heritage_graph/apps/heritage_data/authentication.py` | Both auth backends: `DevSessionAuthentication` + `GoogleTokenAuthentication` |
| `heritage_graph/settings/development.py` | Dev: session + SimpleJWT auth classes |
| `heritage_graph/settings/production.py` | Prod: Google OAuth auth class |
| `heritage_graph/settings/base.py` | Shared DRF config (auth classes set per-environment) |

---

## Frontend: Reading the Session

### Client Components (`'use client'`)

Use the `useSession()` hook from `next-auth/react`:

```tsx
'use client';

import { useSession } from 'next-auth/react';

export default function MyFeature() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'unauthenticated') return <p>Please sign in.</p>;

  // User is authenticated
  const userName = session?.user?.name;
  const userEmail = session?.user?.email;
  const username = session?.user?.username; // email-based username
  const token = session?.accessToken;       // Google ID token for API calls

  return <h1>Welcome, {userName}!</h1>;
}
```

**`status` values:**
| Value | Meaning |
|---|---|
| `'loading'` | Session is being fetched (show spinner) |
| `'authenticated'` | User is logged in — `session` is available |
| `'unauthenticated'` | No active session — prompt sign-in |

### Server Components / API Routes

Use `getServerSession()` from `next-auth`:

```ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // session.accessToken — Google ID token
  // session.user.email  — user's email
  return Response.json({ user: session.user });
}
```

---

## Protecting a Page or Route

### Client-Side Guard

Wrap your page component with a session check:

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');  // redirect to landing
    }
  }, [status, router]);

  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'unauthenticated') return null;

  return <div>Secret content here</div>;
}
```

### Route-Level Guard (recommended for contribution forms)

For flows where users can spend time entering data (e.g. `/contribute/*`), prefer a route-level guard so users are redirected **before** the page renders.

In this repo, `heritage_graph_ui/src/middleware.ts` enforces login for:

- `/contribute/*` (all contribution surfaces, including QR scan contribution routes)
- `/curation/*`, `/platform-admin/*`, and other authenticated areas

This prevents the “fill a long form → fail at submit because you’re logged out” experience.

### Server-Side Guard (Middleware)

Create or update `heritage_graph_ui/src/middleware.ts`:

```ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/' },  // redirect here if not authenticated
});

// Protect authenticated app routes (no /dashboard URL prefix)
export const config = {
  matcher: ['/((?!api|_next|auth).*)'],
};
```

> This automatically redirects unauthenticated users before the page even renders.

---

## Calling the Django Backend

### From a Client Component

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function MyDataComponent() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;

    const fetchData = async () => {
      const res = await fetch('http://localhost:8000/data/submissions/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.results);
      }
    };

    fetchData();
  }, [status, session]);

  return <pre>{JSON.stringify(items, null, 2)}</pre>;
}
```

**Key pattern:**
```ts
headers: {
  Authorization: `Bearer ${session.accessToken}`,
}
```

### From a Server Component / Route Handler

```ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://localhost:8000';
  const res = await fetch(`${backendUrl}/data/submissions/`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const data = await res.json();
  return Response.json(data);
}
```

> **Tip:** Use `INTERNAL_BACKEND_URL` for server-side calls (Docker networking: `http://backend:8000`). Use `http://localhost:8000` only for client-side `fetch`.

---

## Backend: How Django Verifies the Token

DRF tries a **chain** of classes (order is in `settings/development.py` and `settings/production.py`). The first implementation that accepts the `Authorization: Bearer` token wins.

### `GoogleTokenAuthentication` (what the Next.js app uses)

1. Reads the Bearer token and calls Google’s **userinfo** endpoint; a 200 response proves the token is valid for Google.
2. Requires a verified email, then `get_or_create`s `User` + `UserProfile`.
3. If `GOOGLE_CLIENT_ID` is unset on Django, this class skips itself so JWT or session auth can run.

### Other classes in the chain

**Development** also registers `GitHubTokenAuthentication`, `DevSessionAuthentication`, and `JWTAuthentication`. **Production** registers GitHub + JWT after Google. Use JWT or session when debugging APIs without the browser OAuth flow.

### What this means for your Django views

Treat `request.user` the same regardless of how the user authenticated:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_protected_view(request):
    # request.user is a Django User object — works in both dev and prod
    return Response({
        'message': f'Hello, {request.user.email}!',
        'user_id': request.user.id,
    })
```

Auth classes are configured globally per-environment. You do **not** need to add any authentication class per-view unless you want to override.

---

## TypeScript Types for Session

The session object is type-augmented in `types/next-auth.d.ts`:

```ts
// What's available on session
session.accessToken       // string | undefined — Google OAuth access token for API calls
session.user.name         // string | null      — full name
session.user.email        // string | null      — email
session.user.username     // string | null      — same as email
session.user.image        // string | null      — Google avatar URL
session.error             // string | optional — e.g. RefreshAccessTokenError
session.errorDescription  // string | optional — safe UI copy for session.error
```

If you add new fields to the session, update **both**:
1. `types/next-auth.d.ts` — type declarations
2. `src/lib/auth.ts` — `jwt()` and `session()` callbacks

---

## Sign In / Sign Out

### Trigger Sign In

Always pass the Google provider id (the app does not register other providers):

```tsx
import { signIn } from 'next-auth/react';

<Button onClick={() => signIn('google')}>Sign In with Google</Button>

<Button onClick={() => signIn('google', { callbackUrl: '/' })}>
  Sign In
</Button>
```

`signIn()` with no provider id is not used in this codebase; prefer `/auth/login?callbackUrl=…` for redirects from guards.

### Trigger Sign Out

```tsx
import { signOut } from 'next-auth/react';

<Button onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</Button>
```

### Existing Components

- `AuthSection` (`src/components/AuthButtons.tsx`) — standalone Google sign-in / user menu for public or simple layouts.
- Dashboard sidebar uses `NavUser` + similar patterns; call `signIn('google', …)` consistently.

---

## Errors and Recovery (UX)

Sign-in and session maintenance now fail **loudly** with actionable copy instead of only logging to the server console.

### Backend handshake during OAuth (`signIn` callback)

After Google returns tokens, NextAuth calls Django `GET /data/api/testme/` with `Authorization: Bearer <token>` before the session is finalized.

| Result | What the user sees |
|--------|---------------------|
| `401` / `403` | Redirect to `/auth/login?error=BACKEND_REJECTED` with guidance (matching OAuth client IDs, `DJANGO_ENV`, etc.) |
| `5xx` | `?error=BACKEND_UNAVAILABLE` |
| Network failure from Next.js → Django | `?error=BACKEND_UNREACHABLE` (check `INTERNAL_BACKEND_URL` in Docker) |
| Other non-success HTTP | `?error=BACKEND_SYNC` |

Profile enrichment (`GET /data/api/user/me/`) is **best-effort**: if it fails, sign-in still succeeds and the failure is logged.

### NextAuth and configuration errors

- Custom **`pages.error`** is `/auth/error`. Query param `error` uses [NextAuth’s documented values](https://next-auth.js.org/configuration/pages) (`Configuration`, `OAuthCallback`, …), mapped to readable text in `src/lib/auth-errors.ts`.
- **`/auth/login`** reads the same `error` query param (HeritageGraph codes and NextAuth codes). If automatic redirect to Google fails, the page shows a **Try again** button and any message from `signIn(..., { redirect: false })`.

### Session token refresh (Google)

When Google’s refresh token exchange fails, the JWT carries `error: 'RefreshAccessTokenError'` and the session exposes `session.error` / `session.errorDescription`. **`AuthSessionMonitor`** renders a top-of-screen alert with **Sign in again** (calls `signOut` → `/auth/login`).

If the access token expires and cannot be refreshed, **`AccessTokenExpiredError`** uses the same banner pattern.

### Post-login API “ping”

Components that sync the Django user after OAuth (e.g. `AuthButtons`, `NavUser`) use **`GET /data/api/testthelogin`** (authenticated list endpoint). Failures surface as an inline alert or `toast` with the message from `getApiErrorMessage()` — not only `console.error`.

---

## Common Pitfalls

### 1. "useSidebar must be used within a SidebarProvider"

**Cause:** `NavUser` (used by `AuthButtons`) calls `useSidebar()`, which requires `<SidebarProvider>`.

**Fix:** Only use `AuthButtons` inside layouts wrapped with `SidebarProvider` (like `dashboard/layout.tsx`). For standalone pages, create a simpler auth button that doesn't depend on sidebar context.

### 2. Token expired / "Invalid Google token"

Google ID tokens expire after ~1 hour. NextAuth automatically refreshes the session cookie, but if a long-lived tab has a stale token, the backend will reject it.

**Fix:** Re-fetch the session before making API calls, or handle 401 responses by calling `signIn('google')` again.

### 3. `GOOGLE_CLIENT_ID` mismatch

If the frontend and backend use different `GOOGLE_CLIENT_ID` values, token verification will fail with an "audience mismatch" error.

**Fix:** Ensure the **same** `GOOGLE_CLIENT_ID` is set in both `.env.local` (frontend) and the backend environment.

### 4. `NEXTAUTH_SECRET` not set

Without this, NextAuth can't sign/verify its JWT cookies. Sessions will silently fail.

**Fix:** Generate a secret: `openssl rand -base64 32` and set it in `.env.local`.

### 5. CORS issues on API calls

Client-side `fetch` to `localhost:8000` may fail due to CORS if the Django backend doesn't allow the frontend origin.

**Fix:** Ensure Django's CORS settings include `http://localhost:3000` (dev) or the production frontend URL.

---

## Quick Reference Cheat Sheet

```
┌────────────────────────────────────────────────────────────────────────┐
│  NEED                       │  USE                                    │
├────────────────────────────────────────────────────────────────────────┤
│  Read user in client comp   │  useSession()                           │
│  Read user in server comp   │  getServerSession(authOptions)          │
│  Protect a client page      │  useSession() + redirect                │
│  Protect app routes         │  middleware.ts (pathRequiresLogin)     │
│  Call Django from browser   │  Bearer ${session.accessToken}          │
│  Call Django from server    │  Bearer + INTERNAL_BACKEND_URL          │
│  Trigger login              │  signIn('google', …) or /auth/login    │
│  Trigger logout             │  signOut({ callbackUrl: '/' })          │
│  Add new session fields     │  next-auth.d.ts + auth.ts callbacks     │
│  Protect Django view        │  @permission_classes([IsAuthenticated]) │
│  Local OAuth env            │  make auth-setup (see Makefile)       │
└────────────────────────────────────────────────────────────────────────┘
```
