# CONVENTIONS.md — Naming, Files & Code Style

> **Purpose:** Granular rules for file naming, code organization, import ordering, and patterns. AI agents should follow these exactly when generating or modifying code.

---

## 📂 File & Directory Naming

### Backend (Python/Django)

| What | Convention | Example |
|------|-----------|---------|
| App directories | `snake_case` | `heritage_data/`, `cidoc_data/` |
| Python modules | `snake_case.py` | `clerk_auth.py`, `import_csvs.py` |
| Model classes | `PascalCase` | `CulturalEntity`, `UserProfile` |
| Serializer classes | `PascalCase` + `Serializer` | `CulturalEntityCreateSerializer` |
| View classes | `PascalCase` + `View`/`ViewSet` | `SubmissionCreateView`, `PersonViewSet` |
| Permission classes | `PascalCase` + `Is`... | `IsReviewer`, `IsAdminUser` |
| URL patterns | `kebab-case` | `cultural-entities/`, `contribution-queue/` |
| DB table names | `snake_case` (explicit `db_table`) | `cultural_entities`, `version_history` |
| Management commands | `snake_case` | `import_csvs` |
| Test files | `test_<module>.py` or `tests.py` | `tests.py` |
| Signals | `signals.py` in app root | `heritage_data/signals.py` |
| Permissions | `permissions.py` in app root | `heritage_data/permissions.py` |

### Frontend (TypeScript/Next.js)

| What | Convention | Example |
|------|-----------|---------|
| Page routes | `lowercase/` directories | `dashboard/knowledge/entity/` |
| Page files | `page.tsx` (always) | `src/app/dashboard/page.tsx` |
| Layout files | `layout.tsx` | `src/app/dashboard/layout.tsx` |
| shadcn UI components | `kebab-case.tsx` | `src/components/ui/button.tsx` |
| Custom components | `PascalCase.tsx` | `src/components/DataTable.tsx` |
| Dashboard components | in `components/dashboard/` | `app-sidebar.tsx`, `section-cards.tsx` |
| Hooks | `use-kebab-case.ts` | `src/hooks/use-mobile.ts` |
| Utilities | `kebab-case.ts` | `src/lib/utils.ts` |
| Types/interfaces | `PascalCase` in code | `interface SubmissionData {}` |
| Type files | `kebab-case.d.ts` | `types/next-auth.d.ts` |
| Co-located data | `data.tsx` next to page | `knowledge/entity/data.tsx` |
| API routes | `route.ts` | `src/app/api/auth/[...nextauth]/route.ts` |

### Infrastructure

| What | Convention | Example |
|------|-----------|---------|
| Docker compose | `docker-compose.<variant>.yml` | `docker-compose.prod.yml` |
| Dockerfiles | `Dockerfile.<service>` (root) or `Dockerfile` (in-service) | `Dockerfile.backend` |
| Env files | `.env.example` committed, `.env` gitignored | `.env.example` |
| Shell scripts | `kebab-case.sh` or `snake_case.sh` | `entrypoint.sh` |
| Config YAML | `kebab-case.yml` | `traefik-dynamic.yml` |

---

## 🐍 Python Code Style

### Import Order
```python
# 1. Standard library
import os
import uuid
from pathlib import Path

# 2. Third-party packages
from django.db import models
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

# 3. Local imports
from apps.heritage_data.models import CulturalEntity
from apps.heritage_data.permissions import IsReviewer
```
- Enforced by `ruff` (isort-compatible).
- Blank line between each group.

### Model Definition Order
```python
class MyModel(models.Model):
    # 1. Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 2. Foreign keys
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    # 3. Required fields
    name = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=50, choices=TYPE_CHOICES)

    # 4. Optional fields
    description = models.TextField(blank=True, default="")

    # 5. JSON/complex fields
    data = models.JSONField(default=dict, blank=True)

    # 6. Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 7. Meta
    class Meta:
        ordering = ["-created_at"]
        db_table = "my_model"
        verbose_name_plural = "My Models"
        indexes = [
            models.Index(fields=["entity_type", "created_at"]),
        ]

    # 8. __str__
    def __str__(self):
        return self.name

    # 9. Properties
    @property
    def is_active(self):
        return True

    # 10. Instance methods
    def submit_for_review(self):
        pass
```

### ViewSet Method Order
```python
class MyViewSet(viewsets.ModelViewSet):
    # 1. Class attributes
    queryset = MyModel.objects.all()
    serializer_class = MySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["created_at"]

    # 2. get_queryset / get_serializer_class overrides
    def get_queryset(self):
        return super().get_queryset().filter(created_by=self.request.user)

    # 3. Standard CRUD overrides
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # 4. Custom actions
    @action(detail=True, methods=["post"], permission_classes=[IsReviewer])
    def approve(self, request, pk=None):
        pass
```

### Serializer Pattern
```python
class MyCreateSerializer(serializers.ModelSerializer):
    """Used for POST/PUT — write operations."""
    class Meta:
        model = MyModel
        fields = ["name", "entity_type", "data"]

class MyDetailSerializer(serializers.ModelSerializer):
    """Used for GET — read operations with nested relations."""
    created_by = serializers.StringRelatedField()

    class Meta:
        model = MyModel
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]
```

---

## ⚛️ TypeScript/React Code Style

### Component Structure
```tsx
"use client"; // Only if needed

// 1. React imports
import { useState, useEffect } from "react";

// 2. Next.js imports
import { useRouter } from "next/navigation";

// 3. Third-party imports
import { useSession } from "next-auth/react";

// 4. Local imports — UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 5. Local imports — utilities
import { cn } from "@/lib/utils";

// 6. Types/interfaces (at top, before component)
interface DataItem {
  id: string;
  name: string;
  status: "draft" | "pending" | "accepted" | "rejected";
}

interface MyComponentProps {
  items: DataItem[];
  onSelect?: (id: string) => void;
}

// 7. Component (named export)
export function MyComponent({ items, onSelect }: MyComponentProps) {
  // State
  const [selected, setSelected] = useState<string | null>(null);
  const { data: session } = useSession();

  // Effects
  useEffect(() => {
    // ...
  }, []);

  // Handlers
  const handleSelect = (id: string) => {
    setSelected(id);
    onSelect?.(id);
  };

  // Render
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Component</CardTitle>
      </CardHeader>
      <CardContent>
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "cursor-pointer rounded-md p-3",
              selected === item.id && "bg-accent"
            )}
            onClick={() => handleSelect(item.id)}
          >
            {item.name}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### API Fetch Pattern
```tsx
// Always use env var for API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://backend.localhost";

// Authenticated fetch helper
async function apiFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  return res.json();
}
```

### Tailwind CSS Rules
```tsx
// ✅ GOOD — use Tailwind utilities
<div className="flex items-center gap-4 rounded-lg border p-4">

// ✅ GOOD — conditional classes with cn()
<div className={cn("text-sm", isActive && "font-bold text-primary")}>

// ❌ BAD — inline styles
<div style={{ display: "flex", gap: "16px" }}>

// ❌ BAD — custom color values
<div className="text-[#ff6b35]">

// ✅ GOOD — use CSS variables from globals.css
<div className="text-primary">
```

### Form Pattern (with Zod)
```tsx
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["monument", "artifact", "ritual"]),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
```

---

## 🐳 Docker & Compose Conventions

### Service Naming
```yaml
services:
  postgres:     # NOT: db, database, pg, postgresql
  backend:      # NOT: api, django, server
  frontend:     # NOT: web, ui, nextjs, app
  landing:      # NOT: landing-page, marketing
  keycloak:     # NOT: auth, iam, idp
  traefik:      # NOT: proxy, lb, reverse-proxy
```

### Environment Variable Naming
```yaml
# Service-specific prefix
DJANGO_SECRET_KEY:         # Django-specific
DB_NAME:                   # Database
KC_HOSTNAME:               # Keycloak (official KC_ prefix)
KEYCLOAK_ADMIN:            # Keycloak admin
NEXT_PUBLIC_API_URL:       # Next.js public
TRAEFIK_ACME_EMAIL:        # Traefik

# Always provide defaults in compose
environment:
  DEBUG: ${DEBUG:-False}
  DB_HOST: postgres        # Hardcode service names (not env vars)
```

### Label Conventions
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.<service>.rule=Host(`<host>`)"
  - "traefik.http.routers.<service>.entrypoints=web"
  - "traefik.http.services.<service>.loadbalancer.server.port=<port>"
```

---

## 📝 Documentation Conventions

### Markdown Files
| File | Audience | Update When |
|------|----------|-------------|
| `README.md` | Humans (developers, contributors) | Project overview changes |
| `AGENTS.md` | AI agents | New apps, services, or major restructuring |
| `CLAUDE.md` | AI agents | Coding patterns or conventions change |
| `SKILLS.md` | AI agents | Features added, removed, or status changes |
| `ARCHITECTURE.md` | AI agents + humans | System design or data flow changes |
| `CONVENTIONS.md` | AI agents | Style rules change |
| `TROUBLESHOOTING.md` | AI agents + humans | New bugs found or fixed |
| `DEPLOYMENT.md` | Humans (ops/devops) | Deployment process changes |
| `contributing.md` | Humans (contributors) | Contribution process changes |

### Code Comments
```python
# ✅ GOOD — explain WHY, not WHAT
# Auto-create user profile to match Keycloak claims
# because backend needs local user record for FK relationships

# ❌ BAD — obvious from code
# Set name to "admin"
name = "admin"
```

```tsx
// ✅ GOOD — explain business logic
// Only show moderation panel if user is in Reviewers group
// Non-staff users should see their own contributions instead

// ❌ BAD — repeats the code
// Set loading to true
setLoading(true);
```
