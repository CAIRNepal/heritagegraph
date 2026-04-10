# Auth & roles — developer guide

**Audience:** Developers adding API endpoints, dashboard pages, or navigation that depends on **contributor**, **reviewer**, or **admin** access.

This document complements [AUTH.md](./AUTH.md), which covers login flows (Google OAuth vs dev JWT), tokens, and calling the API. Read AUTH.md first if you are new to how the Bearer token reaches Django.

---

## Table of contents

1. [How authentication is structured](#1-how-authentication-is-structured)
2. [Roles and access boundaries](#2-roles-and-access-boundaries)
3. [Protecting a new endpoint (Django REST Framework)](#3-protecting-a-new-endpoint-django-rest-framework)
4. [Protecting a new Next.js 15 page](#4-protecting-a-new-nextjs-15-page)
5. [Copy-paste patterns (middleware & guards)](#5-copy-paste-patterns-middleware--guards)
6. [Common mistakes](#6-common-mistakes)

---

## 1. How authentication is structured

### 1.1 Request authentication (who is this user?)

Django REST Framework resolves `request.user` using an **authentication class chain** configured per environment in `heritage_graph/settings/development.py` and `production.py`:

| Order (typical) | Class | Purpose |
|-----------------|-------|---------|
| 1 | `GoogleTokenAuthentication` | Production-style: validates Google **ID token** in `Authorization: Bearer …` |
| 2 | `GitHubTokenAuthentication` | Optional secondary (returns `None` if token is not a GitHub token) |
| 3 | `DevSessionAuthentication` | **Development only:** Django session (e.g. after `/admin/` login) |
| 4 | `JWTAuthentication` | SimpleJWT access token from `POST /api/token/` |

**Important:** Authentication only establishes **identity**. It does **not** grant feature access by itself—that is the job of **permission classes** (see below).

Details and diagrams: [AUTH.md — Architecture](./AUTH.md#architecture-overview).

**Sign-in failures and session errors in the UI** (banner, `/auth/login?error=`, token refresh): see [AUTH.md — Errors and Recovery](./AUTH.md#errors-and-recovery-ux).

### 1.2 Authorization (what may this user do?)

HeritageGraph uses **DRF `permission_classes`** on views/viewsets (and `@action(permission_classes=…)` for ad-hoc actions).

There is **no** global `DEFAULT_PERMISSION_CLASSES` “lock” in `settings/base.py`; each view should declare what it needs. If you omit permissions, you may accidentally expose an endpoint—always set them explicitly.

### 1.3 Where role information is exposed to the frontend

- **`GET /api/user/info`** (`CurrentUserView` in `heritage_graph/apps/heritage_data/views.py`) — requires `IsAuthenticated`. Returns:
  - `username`, `email`
  - `groups` — Django auth `Group` names
  - `is_staff`
  - `reviewer_role` — serialized `ReviewerRole` fields (or `null`)

The dashboard hook **`useUserRoles`** (`heritage_graph_ui/src/hooks/use-user-roles.ts`) calls this endpoint and derives booleans used for UI gating.

---

## 2. Roles and access boundaries

The product vocabulary is **contributor**, **reviewer**, and **admin**. In code these map as follows.

### 2.1 Contributor

| Aspect | Implementation |
|--------|----------------|
| **Typical meaning** | Any **authenticated** user who can create or edit **their own** contributions |
| **Backend** | `IsAuthenticated`, plus **object-level** rules (e.g. `IsContributorOrReadOnly` — unsafe methods only if `obj.contributor == request.user`) |
| **Frontend** | `useUserRoles().isContributor` — `true` if the user counts as a reviewer **or** is in the `Contributors` group (see hook implementation) |

Contributors are not a separate Django “role table”; capability is mostly “logged in + ownership / serializer rules.”

### 2.2 Reviewer (and moderator)

| Aspect | Implementation |
|--------|----------------|
| **Reviewer personas (data model)** | `ReviewerRole` with `role` ∈ `community_reviewer`, `domain_expert`, `expert_curator` (`heritage_graph/apps/heritage_data/models.py`) |
| **Backend permission classes** | `IsReviewerOrAdmin`, `IsCommunityReviewer`, `IsDomainExpert`, `IsExpertCurator` (`heritage_graph/apps/heritage_data/permissions.py`) — see [§2.4](#24-permission-class-quick-reference) |
| **Staff shortcut** | Most reviewer permissions treat **`request.user.is_staff` as allowed** (treat as operational bypass for admins/staff) |
| **Frontend** | `useUserRoles().isReviewer` — `isModerator \|\| 'Reviewers' in groups \|\| active reviewer_role` |
| **“Moderator” in UI** | `isModerator` — `is_staff \|\| 'Moderators' in groups` (used for stricter pages like reviewer dashboard) |

### 2.3 Admin

| Aspect | Implementation |
|--------|----------------|
| **Platform admin** | Django **`user.is_staff`** or **`user.is_superuser`** — full Django admin, and DRF `IsAdminUser` / `IsEditor` (staff-only) where applied |
| **DRF** | `IsAdminUser`, `IsEditor` |

For operational setup (groups + optional `ReviewerRole` for superusers), see:

```bash
python manage.py setup_roles --assign-superuser
```

(`heritage_graph/apps/heritage_data/management/commands/setup_roles.py`)

### 2.4 Permission class quick reference

Defined in `heritage_graph/apps/heritage_data/permissions.py`:

| Class | Effect (summary) |
|-------|------------------|
| `IsContributorOrReadOnly` | **Object-level:** SAFE methods allowed; writes only if `obj.contributor == request.user` |
| `IsReviewerOrAdmin` | **View-level:** `is_staff` OR active `reviewer_role` |
| `IsCommunityReviewer` | `is_staff` OR active role in `community_reviewer`, `domain_expert`, `expert_curator` |
| `IsDomainExpert` | `is_staff` OR active role in `domain_expert`, `expert_curator` |
| `IsExpertCurator` | `is_staff` OR active `expert_curator` |
| `IsEditor` | **`is_staff` only** (object-level staff check too) |

DRF built-ins in use elsewhere: `IsAuthenticated`, `IsAuthenticatedOrReadOnly`, `AllowAny`, `IsAdminUser`.

### 2.5 Django Groups vs `ReviewerRole` (critical)

Management command **`setup_roles`** creates groups: **`Contributors`**, **`Reviewers`**, **`Moderators`**.

**Custom DRF permission classes in `permissions.py` do not check Django Group membership** — they check **`is_staff`** and **`ReviewerRole`**.

The **frontend** `useUserRoles` hook **does** use group names for UX (e.g. `Reviewers`, `Moderators`).

**Implication:** A user may be in the `Reviewers` group and see reviewer UI, yet receive **403** from an API that only checks `ReviewerRole`. Keep backend and `/api/user/info` data in sync, or align checks (e.g. add group checks to permissions if product requires it).

---

## 3. Protecting a new endpoint (Django REST Framework)

### Step 1 — Pick the right permission stack

- **Public read, authenticated write:** `IsAuthenticatedOrReadOnly` or method-specific `get_permissions()`.
- **Login required:** `[IsAuthenticated]`.
- **Staff / admin only:** `[IsAdminUser]` or `[IsAuthenticated, IsEditor]`.
- **Reviewer capability:** stack `IsAuthenticated` with the narrowest class: `IsCommunityReviewer`, `IsDomainExpert`, or `IsExpertCurator`.

### Step 2 — Apply to a `ModelViewSet` or `APIView`

**APIView example:**

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.heritage_data.permissions import IsCommunityReviewer


class MyReviewerView(APIView):
    permission_classes = [IsAuthenticated, IsCommunityReviewer]

    def get(self, request):
        return Response({"ok": True})
```

**ViewSet with action-specific permissions** (pattern used in `ReviewerRoleViewSet`):

```python
from rest_framework import viewsets, permissions
from apps.heritage_data.permissions import IsExpertCurator


class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsExpertCurator()]
        return [permissions.IsAuthenticated()]
```

### Step 3 — Object-level permissions

If ownership matters, implement or reuse **`has_object_permission`** (see `IsContributorOrReadOnly`, `IsEditor`).

### Step 4 — Verify with curl

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/your/path/
```

Expect **401** if the token is missing/invalid, **403** if authenticated but not permitted.

---

## 4. Protecting a new Next.js 15 page

Principles:

1. **Never rely on the UI alone** — the API must enforce the same rules (see [§6](#6-common-mistakes)).
2. Prefer **layout-level** session + role loading for whole sections (curation already does this).
3. Use **`useUserRoles`** only under a provider that supplies real data (see curation layout).

### 4.1 Authenticated-only page (client)

See [AUTH.md — Client-side guard](./AUTH.md#client-side-guard): `useSession`, loading state, redirect if `unauthenticated`.

### 4.2 Reviewer- or moderator-only page (client)

Existing pages use **`AccessDenied`** (`heritage_graph_ui/src/components/access-denied.tsx`) with `requiredRole="reviewer" | "moderator"` and **`useUserRoles()`** from `@/hooks/use-user-roles`.

**Important:** The **`UserRolesContext`** is provided by **`heritage_graph_ui/src/app/(dashboard)/curation/layout.tsx`**. Pages under `/curation/...` can call `useUserRoles()` safely. For other route trees, either:

- Add a similar `UserRolesContext.Provider` wrapper in that segment’s `layout.tsx`, or  
- Call `/api/user/info` inside the page with `useSession` (duplicated logic — prefer a provider).

### 4.3 Server Component or route handler

Use `getServerSession(authOptions)` ([AUTH.md — Server Components](./AUTH.md#server-components--api-routes)), then forward `Authorization: Bearer ${session.accessToken}` to Django for server-side fetches. **Role checks on the server** are not centralized in this repo today—either call `/api/user/info` from the server with the same Bearer token or duplicate minimal checks (prefer a small shared helper if you add many routes).

---

## 5. Copy-paste patterns (middleware & guards)

### 5.1 Optional: NextAuth `withAuth` middleware (not currently global)

`heritage_graph_ui/src/middleware.ts` today handles **locale** only. To gate paths at the edge (optional), you can use NextAuth’s middleware (**adjust `matcher`** to your real routes, e.g. dashboard prefix):

```typescript
// Example only — align with your route structure before enabling.
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/api/auth/signin" },
});

export const config = {
  matcher: ["/(dashboard)/:path*"],
};
```

Edge middleware **does not** know Django `ReviewerRole` unless you encode it in the session (not standard here). Use middleware for **authentication**; use **page/layout + API** for **roles**.

### 5.2 Curation-style layout (session + roles provider)

Pattern from `heritage_graph_ui/src/app/(dashboard)/curation/layout.tsx`:

1. `useSession()` — block on `loading`, then require `session` (sign-in card if missing).  
2. `useUserRolesProvider()` — wait for `roles.isLoading`.  
3. Render `children` inside `UserRolesContext.Provider value={roles}`.

### 5.3 Page-level role gate + `AccessDenied`

After hooks have run (see [§6.3](#63-react-hooks-order)), branch:

```tsx
"use client";

import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AccessDenied } from "@/components/access-denied";

export function ReviewerOnlyContent() {
  const { data: session } = useSession();
  const { isReviewer, isLoading } = useUserRoles();

  if (isLoading) return null; // or a spinner
  if (!isReviewer) {
    return <AccessDenied requiredRole="reviewer" userEmail={session?.user?.email} />;
  }
  return <div>…</div>;
}
```

For **moderator-only** UI, use `isModerator` and `requiredRole="moderator"`.

### 5.4 Backend: authenticated fetch helper (client)

```tsx
const API_BASE = process.env.NEXT_PUBLIC_API_URL!;
const token = session?.accessToken;

await fetch(`${API_BASE}/data/your-endpoint/`, {
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});
```

---

## 6. Common mistakes

### 6.1 UI-only protection

**Symptom:** Hidden menu links but API still returns 200 for everyone.  
**Fix:** Add DRF `permission_classes` on every new endpoint. Treat the frontend as a hint for users, not a security boundary.

### 6.2 Assuming Django Groups match backend permissions

**Symptom:** User has `Reviewers` group, sees reviewer pages, but API returns 403.  
**Fix:** Ensure `ReviewerRole` (or staff) is assigned, or extend permission classes to include group checks if product requires groups.

### 6.3 React hooks order

**Symptom:** “Rendered more hooks than during the previous render” or inconsistent state.  
**Fix:** **Never** `return` early (e.g. `<AccessDenied />`) **before** all `useState` / `useEffect` hooks in that component. Either:

- Move the role gate **after** all hooks, or  
- Split into a parent that only renders children when allowed, or  
- Use a small wrapper component for denied state.

### 6.4 Wrong base URL or token

**Symptom:** 401 on all requests.  
**Fix:** Use `NEXT_PUBLIC_API_URL` on the client and `INTERNAL_BACKEND_URL` from server-side fetch ([AUTH.md](./AUTH.md)). Always send `Authorization: Bearer <session.accessToken>`.

### 6.5 Dev vs prod token type

**Symptom:** Works locally, fails in production (or vice versa).  
**Fix:** In dev, NextAuth may store a **SimpleJWT** access token; in production, typically a **Google ID token**. The backend chain supports both when configured—ensure `DJANGO_ENV` and `GOOGLE_CLIENT_ID` match the intended mode ([AUTH.md](./AUTH.md)).

### 6.6 Forgetting `get_permissions()` on custom actions

**Symptom:** A `ViewSet` default is strict, but a custom `@action` is too open.  
**Fix:** Set `permission_classes` on each `@action` that differs from the class default.

---

## Related files (quick index)

| Area | Path |
|------|------|
| DRF permissions | `heritage_graph/apps/heritage_data/permissions.py` |
| `ReviewerRole` model | `heritage_graph/apps/heritage_data/models.py` |
| Current user + groups API | `GET /api/user/info` → `CurrentUserView` |
| Auth class chain | `heritage_graph/settings/development.py`, `production.py` |
| Frontend roles hook | `heritage_graph_ui/src/hooks/use-user-roles.ts` |
| Curation provider + sign-in gate | `heritage_graph_ui/src/app/(dashboard)/curation/layout.tsx` |
| Access denied UI | `heritage_graph_ui/src/components/access-denied.tsx` |
| Group bootstrap | `python manage.py setup_roles` |

---

*Last reviewed: 2026-04-08 — align this document when adding new permission classes or changing `/api/user/info`.*
