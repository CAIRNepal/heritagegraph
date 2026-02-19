# CLAUDE.md — Coding Conventions & AI Agent Style Guide

> **Purpose:** This file tells AI coding agents exactly how to write code in this project — what patterns to follow, what to avoid, and how to stay consistent with the existing codebase.

---

## 🎯 Project Identity

- **Project:** HeritageGraph — Cultural Heritage Linked Open Data platform
- **Organization:** CAIR-Nepal
- **Stack:** Django REST Framework + Next.js 15 + NextAuth v4 + Google OAuth + Traefik + PostgreSQL
- **Branch strategy:** Work from `v1` branch

---

## 🐍 Backend (Django REST Framework)

### Python Version & Tooling
- **Python:** 3.13
- **Formatter:** `ruff` (configured in pyproject.toml) — replaces black/isort
- **Linting:** `ruff` — run `ruff check .` and `ruff format .`
- **Package manager:** `pip` with `requirements.txt` (no Poetry/PDM)
- **WSGI server:** `gunicorn` in production, `runserver` in dev

### Django Settings Pattern
```python
# Settings are split across files:
# settings/__init__.py reads DJANGO_ENV and dispatches
# Always import shared config:
from .base import *  # noqa: F403
```
- **Never modify `base.py`** for environment-specific config. Use `development.py` or `production.py`.
- **All secrets** must come from `os.environ.get()` in production. Use `django-environ` for `.env` loading.

### Model Conventions
```python
# Use UUID primary keys for new models
import uuid
from django.db import models

class MyModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "my_model"  # explicit table name, snake_case
```
- New models should follow the `CulturalEntity` / `Revision` / `Activity` pattern (not the legacy `Submission` flat-field pattern).
- Use `JSONField` for flexible/extensible data — not 80+ CharFields.
- Always set `db_table` explicitly in `Meta`.
- Always add `created_at` and `updated_at` timestamps.

### Serializer Conventions
```python
from rest_framework import serializers

class MySerializer(serializers.ModelSerializer):
    class Meta:
        model = MyModel
        fields = "__all__"  # or explicit list
        read_only_fields = ["id", "created_at", "updated_at"]
```
- Nest related serializers for read operations.
- Use separate serializers for create vs. read when shapes differ.
- Validate in `validate_<field>()` methods or `validate()` for cross-field logic.

### View Conventions
```python
from rest_framework import viewsets, permissions

class MyViewSet(viewsets.ModelViewSet):
    queryset = MyModel.objects.all()
    serializer_class = MySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
```
- Prefer `ModelViewSet` for CRUD resources.
- Use `@action(detail=True/False)` for custom endpoints on viewsets.
- Use permission classes, not inline `if request.user` checks.
- Override `get_queryset()` to filter by user when needed.

### URL Conventions
```python
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"my-resources", MyViewSet, basename="my-resource")
# basename uses singular with hyphens
```
- Register viewsets with the router in `apps/<app>/urls.py`.
- The app URLs are included in root `urls.py` with a prefix.

### Permissions Pattern
```python
# Define in apps/<app>/permissions.py
from rest_framework.permissions import BasePermission

class IsReviewer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_staff or request.user.groups.filter(name="Reviewers").exists()
```

### Signals Pattern
```python
# Define in apps/<app>/signals.py
# Import in apps/<app>/apps.py in ready()
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=MyModel)
def handle_my_model_save(sender, instance, created, **kwargs):
    pass
```

### Error Handling
- Return proper DRF `Response` objects with status codes.
- Use `serializer.is_valid(raise_exception=True)` pattern.
- Log errors to console via Python `logging` module.

---

## ⚛️ Frontend (Next.js 15)

### Framework & Language
- **Next.js:** 15.5 with App Router and Turbopack
- **React:** 19.1
- **Language:** TypeScript (`.tsx`) — avoid `.jsx` for new files
- **Package manager:** `npm` (not yarn/pnpm for this app)

### File Naming
```
src/app/dashboard/knowledge/entity/page.tsx    # Page routes
src/components/ui/button.tsx                    # shadcn components (lowercase)
src/components/DataTable.tsx                    # Custom components (PascalCase)
src/hooks/use-mobile.ts                        # Hooks (kebab-case, use- prefix)
src/lib/utils.ts                               # Utilities (kebab-case)
```

### Component Pattern
```tsx
"use client"; // Only when needed (interactivity, hooks, browser APIs)

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAction}>Click</Button>
    </div>
  );
}
```
- Use named exports (not default exports) for components.
- Use `"use client"` only when the component needs client-side features.
- Define `interface` for props (not `type`).
- Destructure props in function signature.

### Styling Rules
- **Tailwind CSS v4** — use utility classes exclusively.
- **Colors are managed in `globals.css`** via CSS variables (tweakcn). **Never add custom colors directly to components.**
- Use `cn()` from `@/lib/utils` to merge Tailwind classes:
```tsx
import { cn } from "@/lib/utils";
<div className={cn("base-classes", conditional && "conditional-classes")} />
```

### shadcn/ui Usage
```bash
# Add new components via CLI:
npx shadcn@latest add <component-name>
```
- Style: **"new-york"** variant
- All shadcn primitives live in `src/components/ui/`
- Import as: `import { Button } from "@/components/ui/button"`
- Do not modify shadcn primitives directly — wrap them in custom components instead.

### API Calls Pattern
```tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export function MyDataComponent() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!session?.accessToken) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/data/endpoint/`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then(setData);
  }, [session]);

  return <div>{/* render data */}</div>;
}
```
- **Use `process.env.NEXT_PUBLIC_API_URL`** — never hardcode `http://localhost:8000`.
- Always pass `Authorization: Bearer <accessToken>` for protected endpoints.
- Use `useSession()` from `next-auth/react` to get the token.

### Authentication Pattern
- Auth is handled by NextAuth v4 with Google OAuth provider.
- Config in `src/lib/auth.ts` — **this is the source of truth**.
- Session includes: `session.accessToken`, `session.user.username`, `session.user.email`.
- The `accessToken` is a Google ID token, verified by Django via `google-auth`.
- Type augmentations in `types/next-auth.d.ts`.

### Routing
- All authenticated pages are under `/dashboard/`.
- Knowledge domain pages: `/dashboard/knowledge/<domain>/` with co-located `data.tsx` files.
- Contribute pages: `/dashboard/contribute/<domain>/`.
- Layouts: root `layout.tsx` (providers) and `dashboard/layout.tsx` (sidebar).

---

## 🐳 Docker Conventions

### Dockerfile Patterns
- Multi-stage builds: `dependencies` → `builder` → `runner`.
- Non-root users: `django` (UID 1000) for backend, `nextjs` (UID 1001) for frontend.
- Always include `HEALTHCHECK` instructions.
- Use Alpine base images where possible.

### Docker Compose
- Service names: lowercase, single word (`postgres`, `backend`, `frontend`, `traefik`).
- All env vars use `${VAR:-default}` syntax with fallbacks.
- Internal services use `expose`, not `ports` (Traefik handles external routing).
- Networks: `proxy` (Traefik-routed) and `backend` (internal).

### Environment Variables
- **Naming:** `UPPER_SNAKE_CASE`
- **Frontend public vars:** prefix with `NEXT_PUBLIC_`
- **Django vars:** prefix with `DJANGO_` for Django-specific, `DB_` for database
- **Google OAuth vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

## 📝 General Rules

### Git
- Commit messages: imperative tense (`Add feature`, not `Added feature`)
- Branch from `v1`
- Never commit: `.env`, `node_modules/`, `__pycache__/`, `.next/`

### Documentation
- Update `AGENTS.md` when adding new apps, models, or major features.
- Update `SKILLS.md` when adding new capabilities.
- Update `ARCHITECTURE.md` when changing service topology.

### When Adding a New Django App
1. Create app: `python manage.py startapp <name>` inside `apps/`
2. Register in `base.py` → `INSTALLED_APPS`
3. Add URLs to root `urls.py`
4. Add models, serializers, views, permissions, signals
5. Create and run migrations
6. Document in `AGENTS.md`

### When Adding a New Frontend Page
1. Create directory under `src/app/dashboard/<section>/`
2. Add `page.tsx` (and optionally `data.tsx` for local data)
3. Add navigation link in `src/components/dashboard/app-sidebar.tsx`
4. Use existing layout (dashboard layout provides sidebar)
5. Document in `AGENTS.md`

### When Adding a New API Endpoint
1. Add view/viewset in the appropriate app
2. Register in app's `urls.py` (router or path)
3. Add serializer if needed
4. Add permissions if needed
5. Document in `AGENTS.md` API section
