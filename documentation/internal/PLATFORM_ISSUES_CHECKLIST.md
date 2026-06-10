# Platform issues — comprehensive checklist

> **Purpose:** Single reference for every *kind* of “issue” HeritageGraph can surface: **curation/review taxonomies** (what reviewers and contributors see), **legacy moderation states**, **fork/public contribution categories**, **known engineering gaps**, and **operational checks**.  
> **Related:** [`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md) (deep detail on engineering items), [`SKILLS.md`](../../SKILLS.md) (feature matrix and planned work), [`AGENTS.md`](../../AGENTS.md) (architecture overview).

---

## How to use this document

| Section | Use when you need to… |
|--------|------------------------|
| [1. Review queue & triage](#1-review-queue--triage-product) | Map UI tabs and API filters (`queue_type`) to semantics. |
| [2. Review flags](#2-review-flag-types-product) | List every flag type curators can raise or filter on. |
| [3. Review decisions](#3-review-decisions-product) | Verdicts, conflict handling, verification, confidence. |
| [4. Entity & contribution lifecycle](#4-entity--contribution-lifecycle-product) | Statuses for `CulturalEntity`, legacy `Submission`, forks, public QR flow. |
| [5. Roles & notifications](#5-reviewer-personas--notification-types) | Personas and notification enums (for future wiring). |
| [6. Known technical issues](#6-known-technical-issues-engineering) | Track known bugs/gotchas from troubleshooting. |
| [7. Planned / partial features](#7-planned--partial-features) | Avoid duplicating work; see what is not built yet. |
| [8. Deployment & security checklist](#8-deployment--security-checklist) | Pre-production and ops verification. |
| [9. QA smoke checklist](#9-qa-smoke-checklist) | Quick regression pass across stacks. |

---

## 1. Review queue & triage (product)

These map to `GET /data/review-queue/?queue_type=<value>` and the triaged review UI (`/curation/review`). Counts: `GET /data/review-queue/queue_counts/`.

| Queue tab (`queue_type`) | Meaning | Implementation note |
|--------------------------|---------|---------------------|
| `all` | Default: entities in review/revision | `status` in `pending_review`, `pending_revision` |
| `new_claims` | Submitted for review, **no** `ReviewDecision` yet | Fresh claims |
| `conflicts` | **Unresolved** `ReviewFlag` with `flag_type=contradiction` | Shown in conflicts flow |
| `flagged` | Any **unresolved** non-contradiction flag | Excludes contradiction-only from this bucket per backend filter |
| `expiring` | `pending_review` and `created_at` older than **14 days** | SLA-style queue |

### Checklist — queue behavior

- [ ] `all` returns expected cardinality vs dashboard
- [ ] `new_claims` excludes entities that already have a decision
- [ ] `conflicts` only lists unresolved contradiction flags
- [ ] `flagged` does not double-count pure contradiction rows with other flags (verify `distinct()` behavior with your data)
- [ ] `expiring` cutoff (14 days) matches product expectation
- [ ] Reviewer domain filter `my_domain=true` respects `ReviewerRole.expertise_areas` when set

---

## 2. Review flag types (product)

Model: `ReviewFlag`. API: `/data/review-flags/`, resolve: `/data/review-flags/<id>/resolve/`.

| `flag_type` value | Label (human-readable) |
|-------------------|------------------------|
| `questionable_source` | Questionable Source |
| `suspected_duplicate` | Suspected Duplicate |
| `sensitive_content` | Sensitive Content |
| `low_confidence` | Low Confidence Score |
| `stale_review` | Stale — In Review Too Long |
| `contradiction` | Contradicts Existing Data |
| `other` | Other |

### Checklist — flags

- [ ] Each type can be created via API with valid `entity` + `flagged_by`
- [ ] Resolve flow sets `is_resolved`, `resolved_by`, `resolved_at`
- [ ] Unresolved `contradiction` drives `conflicts` queue
- [ ] Other unresolved types appear under `flagged` (and not lost when contradiction also exists — verify UX)

---

## 3. Review decisions (product)

Model: `ReviewDecision`. Workspace: `GET /data/review-workspace/<uuid>/`, decide: `POST .../decide/`.

### 3.1 Verdicts (`verdict`)

| Value | Meaning |
|-------|---------|
| `accept` | Publish this assertion |
| `accept_with_edits` | Modify before publishing |
| `request_changes` | Send back to contributor |
| `reject` | Do not publish |
| `escalate` | Beyond reviewer’s domain |

### 3.2 Conflict handling (`conflict_handling`)

| Value | Meaning |
|-------|---------|
| `not_applicable` | No conflict |
| `supersedes` | New claim supersedes existing |
| `coexist` | Both claims coexist (conflicting sources) |
| `existing_stands` | Existing stands; reject new |
| `refines` | New claim refines existing |
| `disputed` | Genuinely contradictory — needs expert |

### 3.3 Verification method (`verification_method`)

| Value | Meaning |
|-------|---------|
| `source_crosscheck` | Source cross-checked |
| `expert_knowledge` | Expert knowledge |
| `field_verification` | Field verification |
| `community_consensus` | Community consensus |

### 3.4 Confidence (`confidence`)

| Value | Meaning |
|-------|---------|
| `certain` | Certain |
| `likely` | Likely |
| `uncertain` | Uncertain |
| `speculative` | Speculative |

### Checklist — decisions

- [ ] Each verdict is allowed only for roles that should have it (see `ReviewerRole` capabilities in code)
- [ ] Conflict handling required when workspace detects overlapping claims (product rule — confirm in UI)
- [ ] Decisions append to `Activity` / history as expected
- [ ] `escalate` routes or notifies per product spec (if notifications not wired — see [§7](#7-planned--partial-features))

---

## 4. Entity & contribution lifecycle (product)

### 4.1 `CulturalEntity.status`

| Value | Meaning |
|-------|---------|
| `draft` | Draft |
| `pending_review` | Pending Review |
| `accepted` | Accepted |
| `rejected` | Rejected |
| `pending_revision` | Pending Revision |
| `merged` | Merged |
| `superseded` | Superseded |

### 4.2 `CulturalEntity.category`

| Value | Meaning |
|-------|---------|
| `monument` | Monument |
| `artifact` | Artifact |
| `ritual` | Ritual |
| `festival` | Festival |
| `tradition` | Tradition |
| `document` | Document |
| `other` | Other |

### 4.3 Legacy `Submission.status`

| Value | Meaning |
|-------|---------|
| `pending` | Pending |
| `accepted` | Accepted |
| `rejected` | Rejected |
| `review` | Review |

### 4.4 Fork (`Fork`)

**Reason tag (`fork_reason_tag`):** `correction`, `translation`, `expansion`, `source_addition`, `dispute`, `other`  
**Status (`fork_status`):** `active`, `merged`, `promoted`, `rejected`

### 4.5 Public contribution (`PublicContribution`)

**Status:** `pending`, `approved`, `rejected`, `incorporated`  
**Contribution type:** `history`, `story`, `tradition`, `memory`, `photo`, `correction`, `other`  
**Source:** `qr_scan`, `web_form`, `mobile_app`, `field_survey`

### Checklist — lifecycle

- [ ] Transitions from draft → pending_review → accepted/rejected match business rules
- [ ] `pending_revision` appears in contribution queue and review queue where expected
- [ ] Fork creates correct `root_entity` / `parent_entity` / `fork_depth`
- [ ] Public contributions land in correct moderation path

---

## 5. Reviewer personas & notification types

### 5.1 `ReviewerRole.role`

| Value | Label |
|-------|-------|
| `community_reviewer` | Community Reviewer |
| `domain_expert` | Domain Expert |
| `expert_curator` | Expert Curator |

**Capability hints in code:** `can_override_confidence`, `can_resolve_conflicts`, `can_manage_roles` (see model).

### 5.2 `Notification.notification_type` (model exists; delivery partial)

| Value | Label |
|-------|-------|
| `submission_update` | Submission Update |
| `comment` | Comment |
| `moderation` | Moderation |
| `suggestion_review` | Edit Suggestion Review |
| `review_decision` | Review Decision |
| `revision` | Revision |
| `reaction` | Reaction |
| `fork` | Fork |
| `general` | General |

### Checklist — roles & notifications

- [ ] Role assignment API (`/data/reviewer-roles/`, `assign`) restricted to appropriate users
- [ ] Notifications UI does not assume backend routes that are not implemented yet

---

## 6. Known technical issues (engineering)

Canonical narratives live in [`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md). Use this checklist to track remediation.

### 6.1 Critical / high impact

- [x] **Dashboard nested `<html>`** — Resolved: document shell is only in `heritage_graph_ui/src/app/layout.tsx`. The dashboard chrome lives in `src/app/(dashboard)/layout.tsx` (no second `<html>`).
- [x] **Duplicate NextAuth config** — `src/app/api/auth/[...nextauth]/route.ts` imports `authOptions` from `src/lib/auth.ts` (single source of truth).
- [x] **Hardcoded API URLs** — Bare `127.0.0.1:8000` removed from tables/widgets; shared helper `src/lib/api-base.ts` (`getPublicApiUrl()`) uses `NEXT_PUBLIC_API_URL` with a localhost fallback when unset (dev). Other call sites already use the env pattern.
- [x] **Middleware passthrough** — `src/middleware.ts` requires a JWT session (via `getToken`) for all non-public paths. Public: `/auth/*`, `/contribute/scan/*`, `/services`. The product UI is at the site root (e.g. `/`), not `/dashboard/*`, so the old path note is obsolete. Requires `NEXTAUTH_SECRET` in all environments using middleware.

### 6.2 Configuration & cleanliness

- [x] **Duplicate `CommonMiddleware`** in `heritage_graph/settings/base.py` — duplicate entry removed.
- [x] **Legacy `clerk_auth.py`** — removed (`apps/heritage_data/clerk_auth.py`); active auth remains in `authentication.py`.
- [x] **`settings.py` vs `settings/`** — `manage.py` now defaults to `DJANGO_SETTINGS_MODULE=settings`, loading `settings/__init__.py` so `DJANGO_ENV` dispatch applies. (Docker/Caddy still uses `heritage_graph.wsgi` with `heritage_graph.settings` on `PYTHONPATH`; same package entrypoint.)
- [x] **WSGI/ASGI vs manage.py** — `manage.py` aligned with the `settings` package dispatch above; `wsgi.py` / `asgi.py` unchanged and remain the production entrypoints.

### 6.3 Data & behavior

- [x] **`UserStatistics` not updated on `CulturalEntity` saves** — `refresh_user_stats()` now aggregates legacy `Submission` + `CulturalEntity` counts; `post_save` on both models updates `UserStats`.
- [ ] **`PersonRevision` on every save** — consider diff before creating revision
- [ ] **`Submission.submission_id`** — collision risk documented; verify acceptable for product

### 6.4 Docker & local dev

- [ ] Google OAuth redirect URIs complete for each environment
- [ ] Frontend volume / `.next` cache staleness understood by team
- [ ] Postgres init scripts only on fresh volume (`docker-compose down -v`)

### 6.5 Frontend env

- [ ] `.env.local` lives next to `heritage_graph_ui/package.json`

---

## 7. Planned / partial features

From [`SKILLS.md`](../../SKILLS.md) — not exhaustive; see file for file-level pointers.

| Item | Typical gap |
|------|-------------|
| Notification backend API | Model exists; views/serializers incomplete |
| Reviewer notifications | Not wired to decision/flag events |
| Frontend route protection | Middleware enforces session on app routes; per-role UI still relies on client guards / API permissions |
| CIDOC Artifact / broader revision models | Planned |
| Redis caching | Not configured (see also `CACHE.md` if present in repo) |
| Full-text search beyond ORM | Planned |
| WebSocket real-time | ASGI without consumers |
| Frontend test suite | Not configured |
| Backend tests | Mostly `cidoc_data` |
| Review admin UI for roles | API-first today |

### Checklist — before claiming “done”

- [ ] Feature has backend + frontend + docs touchpoints if user-facing
- [ ] Auth paths tested for both dev (JWT) and prod (Google) if applicable
- [ ] No new hardcoded secrets or API origins

---

## 8. Deployment & security checklist

Consolidated from [`TROUBLESHOOTING.md`](../../TROUBLESHOOTING.md) deploy section.

- [ ] `.env` from `.env.example` with production values
- [ ] `DJANGO_SECRET_KEY` strong and unique
- [ ] `POSTGRES_PASSWORD` strong
- [ ] Google OAuth + `NEXTAUTH_SECRET` configured
- [ ] `DEBUG=False` in production
- [ ] `ALLOWED_HOSTS` includes production domain(s)
- [ ] `NEXT_PUBLIC_API_URL` is public API origin
- [ ] OAuth redirect URIs for production
- [ ] TLS (e.g. Traefik / Let’s Encrypt) verified
- [ ] Expose only 80/443 as appropriate
- [ ] Database backups scheduled
- [ ] Log rotation configured
- [ ] Health endpoints reachable (`/health/`, `/health/ready/`, etc.)

---

## 9. QA smoke checklist

Run after releases or large merges.

**Backend**

- [ ] `GET /health/` and `GET /health/detailed/` OK
- [ ] `GET /schema/` or `/docs` loads
- [ ] Authenticated sample: `GET /data/cultural-entities/` with Bearer token
- [ ] Review: `GET /data/review-queue/queue_counts/`

**Frontend**

- [ ] Login (Google or dev login) completes
- [ ] Dashboard loads without console hydration errors
- [ ] One contribute flow + one knowledge list page

**Infra (Docker)**

- [ ] `docker compose config --quiet` succeeds
- [ ] Traefik routes: `frontend.localhost`, `backend.localhost` (or your hostnames)

---

## Document maintenance

- When new **flag types**, **queue filters**, **statuses**, or **verdicts** are added to models, update **§1–§4** and bump this note.
- When a **TROUBLESHOOTING** item is fixed, check it off in **§6** and update or remove the entry in `TROUBLESHOOTING.md`.
- When **SKILLS.md** status changes from Planned → Working, reflect in **§7**.

---

*Last aligned with repository models and docs as of internal review; enumerations sourced from `heritage_graph/apps/heritage_data/models.py` and `ReviewQueueViewSet`.*

### Engineering remediation log

| When | What |
|------|------|
| 2026-04 | §6.1–6.3 (partial): duplicate `CommonMiddleware` removed; `clerk_auth.py` removed; `manage.py` → `settings` module; `UserStats` refreshed on `CulturalEntity` save; frontend `getPublicApiUrl()`, middleware session gate, login `callbackUrl`, section-cards uses bearer for `/data/api/user-stats/`. |
