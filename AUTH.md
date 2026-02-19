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
10. [Common Pitfalls](#common-pitfalls)
11. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Architecture Overview

```
┌─────────────┐   Google OAuth   ┌──────────────┐
│  Browser     │ ◄──────────────► │  Google      │
│  (Next.js)   │                  │  OAuth 2.0   │
└──────┬───────┘                  └──────────────┘
       │
       │  NextAuth handles the OAuth flow
       │  and stores Google's id_token in a JWT cookie
       │
       ▼
┌──────────────┐  Bearer <id_token>  ┌──────────────────┐
│  Next.js     │ ──────────────────► │  Django (DRF)    │
│  Frontend    │                     │  Backend         │
│  (port 3000) │ ◄────────────────── │  (port 8000)     │
└──────────────┘   JSON response     └──────────────────┘
```

**How it works:**

1. User clicks "Sign In with Google" → NextAuth opens Google consent screen.
2. Google returns an **ID token** (JWT signed by Google).
3. NextAuth stores this token in a secure, HTTP-only cookie as `session.accessToken`.
4. Every API call to Django sends `Authorization: Bearer <google_id_token>`.
5. Django's `GoogleTokenAuthentication` class verifies the token against Google's public keys, then auto-creates/syncs the Django `User` + `UserProfile`.

---

## Environment Variables

### Frontend (`heritage_graph_ui/.env.local`)

| Variable | Purpose | Example |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `12345.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-xxxxx` |
| `NEXTAUTH_URL` | Canonical URL of the frontend | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret for signing NextAuth JWTs | `openssl rand -base64 32` |
| `INTERNAL_BACKEND_URL` | Django backend URL (server-side calls) | `http://localhost:8000` |

### Backend (`heritage_graph/.env` or root `.env`)

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | **Must match** the frontend's value — used to verify token audience |

> ⚠️ The same `GOOGLE_CLIENT_ID` must be set on **both** frontend and backend.

---

## Key Files at a Glance

| File | What it does |
|---|---|
| `heritage_graph_ui/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler — OAuth flow, JWT & session callbacks |
| `heritage_graph_ui/src/lib/auth.ts` | `authOptions` config (importable for server-side `getServerSession`) |
| `heritage_graph_ui/src/app/SessionProvider.tsx` | Client wrapper — provides `SessionProvider` + `ThemeProvider` |
| `heritage_graph_ui/src/app/layout.tsx` | Root layout — wraps everything in `NextAuthSessionProvider` |
| `heritage_graph_ui/types/next-auth.d.ts` | TypeScript augmentations for `Session`, `JWT`, and `User` |
| `heritage_graph/apps/heritage_data/authentication.py` | Django `GoogleTokenAuthentication` class |
| `heritage_graph/settings/base.py` | DRF config — sets default auth class |

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

### Server-Side Guard (Middleware)

Create or update `heritage_graph_ui/src/middleware.ts`:

```ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/' },  // redirect here if not authenticated
});

// Protect specific routes
export const config = {
  matcher: ['/dashboard/:path*'],
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

The `GoogleTokenAuthentication` class in `heritage_graph/apps/heritage_data/authentication.py` does the following:

1. Extracts the Bearer token from the `Authorization` header.
2. Calls `google.oauth2.id_token.verify_oauth2_token()` to verify signature, expiry, issuer, and audience (`GOOGLE_CLIENT_ID`).
3. Checks that the issuer is `accounts.google.com` and the email is verified.
4. Auto-creates a Django `User` (username = email) and `UserProfile` via `get_or_create`.
5. Returns `(user, None)` — DRF then sets `request.user` for the view.

**What this means for your Django views:**

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_protected_view(request):
    # request.user is a Django User object (auto-created from Google token)
    return Response({
        'message': f'Hello, {request.user.email}!',
        'user_id': request.user.id,
    })
```

All DRF views automatically use `GoogleTokenAuthentication` (configured globally in `settings/base.py`). You do **not** need to add any authentication class per-view unless you want to override.

---

## TypeScript Types for Session

The session object is type-augmented in `types/next-auth.d.ts`:

```ts
// What's available on session
session.accessToken       // string | undefined — Google ID token
session.user.name         // string | null      — full name
session.user.email        // string | null      — email
session.user.username     // string | null      — same as email
session.user.image        // string | null      — Google avatar URL
```

If you add new fields to the session, update **both**:
1. `types/next-auth.d.ts` — type declarations
2. `src/app/api/auth/[...nextauth]/route.ts` — `jwt()` and `session()` callbacks

---

## Sign In / Sign Out

### Trigger Sign In

```tsx
import { signIn } from 'next-auth/react';

// Basic
<Button onClick={() => signIn('google')}>Sign In with Google</Button>

// With redirect
<Button onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
  Sign In
</Button>
```

### Trigger Sign Out

```tsx
import { signOut } from 'next-auth/react';

<Button onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</Button>
```

### Existing Component

The project ships `AuthButtons` (`src/components/AuthButtons.tsx`) which handles both states. Import and use it:

```tsx
import AuthButtons from '@/components/AuthButtons';

// Shows "Sign In" button when logged out, user avatar when logged in
<AuthButtons />
```

> **Note:** `AuthButtons` uses `SidebarFooter` and `NavUser`, which depend on sidebar context. Use it inside `SidebarProvider` (e.g., dashboard) or within a try-catch guarded component.

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
┌─────────────────────────────────────────────────────────────────┐
│  NEED                      │  USE                              │
├─────────────────────────────────────────────────────────────────┤
│  Read user in client comp  │  useSession()                     │
│  Read user in server comp  │  getServerSession(authOptions)    │
│  Protect a client page     │  useSession() + redirect          │
│  Protect server routes     │  middleware.ts with withAuth()    │
│  Call Django from browser  │  Bearer ${session.accessToken}    │
│  Call Django from server   │  Bearer ${session.accessToken}    │
│                            │  + INTERNAL_BACKEND_URL           │
│  Trigger login             │  signIn('google')                 │
│  Trigger logout            │  signOut({ callbackUrl: '/' })    │
│  Add new session fields    │  next-auth.d.ts + route.ts cbs   │
│  Protect Django view       │  @permission_classes([IsAuth…])   │
└─────────────────────────────────────────────────────────────────┘
```
