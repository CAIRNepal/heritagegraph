# SKILLS.md — Feature Capabilities Matrix

> **Purpose:** This file maps every feature in HeritageGraph to the exact files that implement it. When an AI agent needs to work on a feature, it can look up exactly which files to read and modify.

---

## How to Use This File

Each feature is listed with:

- **Status:** `Working` | `Partial` | `Planned` | `Has Issues`
- **Backend files:** Django models, views, serializers, URLs involved
- **Frontend files:** React pages, components, hooks involved
- **Config files:** Docker, env vars, or infra files involved

---

## Authentication & Authorization

### Google OAuth Login — Working

| Layer | Files |
|-------|-------|
| Backend auth class | `heritage_graph/apps/heritage_data/authentication.py` → `GoogleTokenAuthentication` |
| Backend DRF config | `heritage_graph/settings/base.py` → `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES` |
| Frontend NextAuth | `heritage_graph_ui/src/lib/auth.ts` → `authOptions` with Google provider |
| Frontend API route | `heritage_graph_ui/src/app/api/auth/[...nextauth]/route.ts` |
| Frontend session | `heritage_graph_ui/src/app/SessionProvider.tsx` |
| Frontend middleware | `heritage_graph_ui/src/middleware.ts` (currently passthrough) |
| Type definitions | `heritage_graph_ui/types/next-auth.d.ts` |
| Env vars needed | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` |

### User Registration — Working

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `RegisterView`, `SimpleRegisterView` |
| Backend serializer | `heritage_data/serializers.py` → `RegisterSerializer` |
| Backend URL | `POST /api/register/` and `POST /data/register/` |

### JWT Token Management — Working

| Layer | Files |
|-------|-------|
| Obtain token | `POST /api/token/` → SimpleJWT `TokenObtainPairView` |
| Refresh token | `POST /api/token/refresh/` → SimpleJWT `TokenRefreshView` |
| Blacklist token | `POST /data/blacklist/` → `BlacklistTokenView` |

### User Profiles — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `UserProfile` (80+ profile fields) |
| Backend view | `heritage_data/views.py` → `UserProfileDetailView` |
| Backend serializer | `heritage_data/serializers.py` → `UserProfileSerializer` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/account/page.tsx` |
| Frontend component | `heritage_graph_ui/src/components/nav-user.tsx` → auto-init via backend POST |

---

## Heritage Data Contribution

### Legacy Submission Flow — Working (being superseded)

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `Submission` (80+ CharFields) |
| Backend views | `heritage_data/views.py` → `SubmissionCreateView`, `SubmissionFormView` |
| Backend serializer | `heritage_data/serializers.py` → `SubmissionSerializer`, `FullSubmissionSerializer` |
| Frontend form | `heritage_graph_ui/src/app/dashboard/contribute/places/` |

### New Cultural Entity Flow — Working

| Layer | Files |
|-------|-------|
| Backend models | `heritage_data/models.py` → `CulturalEntity`, `Revision`, `Activity` |
| Backend viewset | `heritage_data/views.py` → `CulturalEntityViewSet` |
| Backend serializers | `heritage_data/serializers.py` → `CulturalEntityCreateSerializer`, `CulturalEntityDetailSerializer` |
| Backend URL | `/data/cultural-entities/` (router-registered) |
| Frontend contribute | `heritage_graph_ui/src/app/dashboard/contribute/entity/` |
| Frontend edit | `heritage_graph_ui/src/app/dashboard/contribute/entity/edit/` |
| Frontend revise | `heritage_graph_ui/src/app/dashboard/contribute/entity/revise/` |
| Frontend knowledge | `heritage_graph_ui/src/app/dashboard/knowledge/entity/` |

### CIDOC-CRM Domain Models — Working

| Domain | Backend Model | Backend ViewSet | Frontend Knowledge | Frontend Contribute |
|--------|--------------|-----------------|-------------------|-------------------|
| Persons | `cidoc_data/models.py` → `Person` | `PersonViewSet` | `knowledge/person/` | `contribute/person/` |
| Locations | `cidoc_data/models.py` → `Location` | `LocationViewSet` | `knowledge/location/` | `contribute/location/` |
| Events | `cidoc_data/models.py` → `Event` | `EventViewSet` | `knowledge/event/` | `contribute/event/` |
| Periods | `cidoc_data/models.py` → `HistoricalPeriod` | `HistoricalPeriodViewSet` | `knowledge/period/` | `contribute/period/` |
| Traditions | `cidoc_data/models.py` → `Tradition` | `TraditionViewSet` | `knowledge/tradition/` | `contribute/tradition/` |
| Sources | `cidoc_data/models.py` → `Source` | `SourceViewSet` | `knowledge/source/` | `contribute/source/` |

### Cross-Model Search — Working

| Layer | Files |
|-------|-------|
| Backend view | `cidoc_data/views.py` → `SearchViewSet` |
| Backend URL | `GET /cidoc/search/?q=<query>` |
| Searches across | Person (name, description), Location (name), Event (name) |

---

## Moderation & Curation

### Submission Review — Working

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `SubmissionReviewView` |
| Backend model | `heritage_data/models.py` → `ModerationRecord` |
| Backend permissions | `heritage_data/permissions.py` → `IsReviewer` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/moderate/` |

### Contribution Queue — Working

| Layer | Files |
|-------|-------|
| Backend viewset | `heritage_data/views.py` → `ContributionQueueViewSet` |
| Backend action | `moderate` action (accept/reject with feedback) |
| Backend serializer | `heritage_data/serializers.py` → `ModerateEntitySerializer` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/contributions/` |

### Activity Log — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `Activity` |
| Backend viewset | `heritage_data/views.py` → `ActivityViewSet` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/activity/` |

### Epistemic Review System — Working

A three-persona review workflow for expert-reviewed heritage claims with conflict resolution.

#### Reviewer Roles

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `ReviewerRole` (3 personas: community_reviewer, domain_expert, expert_curator) |
| Backend viewset | `heritage_data/views.py` → `ReviewerRoleViewSet` (my_role, assign actions) |
| Backend serializer | `heritage_data/serializers.py` → `ReviewerRoleSerializer`, `ReviewerRoleAssignSerializer` |
| Backend permissions | `heritage_data/permissions.py` → `IsCommunityReviewer`, `IsDomainExpert`, `IsExpertCurator` |
| Backend URL | `/data/reviewer-roles/`, `/data/reviewer-roles/my_role/`, `/data/reviewer-roles/assign/` |

#### Triaged Review Queue

| Layer | Files |
|-------|-------|
| Backend viewset | `heritage_data/views.py` → `ReviewQueueViewSet` (queue types: all, new_claims, conflicts, flagged, expiring) |
| Backend serializer | `heritage_data/serializers.py` → `ContributionQueueSerializer` (flag_count, has_conflicts, days_in_review) |
| Backend URL | `/data/review-queue/`, `/data/review-queue/queue_counts/` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/review/page.tsx` |

#### Three-Panel Review Workspace

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `ReviewWorkspaceView` (retrieves entity + revisions + activities + flags + prior reviews) |
| Backend serializer | `heritage_data/serializers.py` → `ReviewWorkspaceSerializer` |
| Backend URL | `GET /data/review-workspace/<uuid:entity_id>/` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/review/[id]/page.tsx` |
| Panels | Left: Context (entity state, flags, history) · Middle: Submission (revision data, contributor record) · Right: Decision (verdict, conflict handling, confidence override) |

#### Review Decision Submission

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `SubmitReviewDecisionView` (applies verdict, logs Activity) |
| Backend model | `heritage_data/models.py` → `ReviewDecision` (verdict: accept/accept_with_edits/request_changes/reject/escalate) |
| Backend serializer | `heritage_data/serializers.py` → `ReviewDecisionSerializer`, `ReviewDecisionCreateSerializer` |
| Backend URL | `POST /data/review-workspace/<uuid:entity_id>/decide/` |
| Conflict handling | `supersedes`, `coexist`, `existing_stands`, `refines`, `disputed` |

#### Review Flags

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `ReviewFlag` (types: questionable_source, suspected_duplicate, sensitive_content, low_confidence, stale_review, contradiction, other) |
| Backend viewset | `heritage_data/views.py` → `ReviewFlagViewSet` (resolve action) |
| Backend serializer | `heritage_data/serializers.py` → `ReviewFlagSerializer`, `ReviewFlagCreateSerializer` |
| Backend URL | `/data/review-flags/`, `/data/review-flags/<id>/resolve/` |

#### Conflict Resolution

| Layer | Files |
|-------|-------|
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/conflicts/page.tsx` |
| Backend filter | `ReviewQueueViewSet` with `queue_type=conflicts` |
| Purpose | Dedicated view for entities with competing assertions, links to review workspace |

#### Reviewer Dashboard

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `ReviewerDashboardView` (queue stats, weekly metrics, lifetime impact, domain activity) |
| Backend serializer | `heritage_data/serializers.py` → `ReviewerDashboardSerializer` |
| Backend URL | `GET /data/reviewer-dashboard/` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/curation/dashboard/page.tsx` |

### Edit Suggestions — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `EditSuggestion` |
| Backend viewset | `heritage_data/views.py` → `EditSuggestionViewSet` (approve/reject actions) |

### Version History — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `VersionHistory` |
| Backend view | `heritage_data/views.py` → `VersionListView` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/versionviewer/` |

---

## Gamification & Community

### Leaderboard — Working

| Layer | Files |
|-------|-------|
| Backend view | `heritage_data/views.py` → `LeaderboardView` |
| Backend model | `heritage_data/models.py` → `UserStatistics` (auto-updated via signals) |
| Backend signal | `heritage_data/signals.py` → recalculates on Submission save |
| Frontend component | `heritage_graph_ui/src/components/dashboard/leaderboard-card.tsx` |
| Frontend page | `heritage_graph_ui/src/app/dashboard/leaderboard/` |

### User Statistics — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `UserStatistics` (submissions, approval rate, rank, impact score) |
| Backend view | `heritage_data/views.py` → `UserStatisticsView`, `PersonalLeaderboardStatsView` |
| Frontend component | `heritage_graph_ui/src/components/dashboard/section-cards.tsx` |

### Comments — Working

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `Comment` |
| Backend viewset | `heritage_data/views.py` → `CommentListCreateView`, `CommentDetailView` |
| Frontend component | `heritage_graph_ui/src/components/comment.tsx` (threaded, Reddit-style) |

### Notifications — Partial

| Layer | Files |
|-------|-------|
| Backend model | `heritage_data/models.py` → `Notification` (model exists) |
| Frontend page | `heritage_graph_ui/src/app/dashboard/notification/` |
| Status | Model defined; no backend views or serializers yet |

---

## Visualization

### Graph View — Working

| Layer | Files |
|-------|-------|
| Frontend page | `heritage_graph_ui/src/app/dashboard/graphview/` |
| Libraries | Cytoscape.js, cytoscape-cola, cytoscape-cose-bilkent, React Flow |
| Purpose | Visualize entity relationships as a knowledge graph |

### Data Tables — Working

| Layer | Files |
|-------|-------|
| Component | `heritage_graph_ui/src/components/data-table.tsx` (806 lines, TanStack + dnd-kit) |
| Alt component | `heritage_graph_ui/src/components/data-table-alt.tsx` |
| Features | Sorting, filtering, pagination, column visibility, drag-and-drop rows, drawer detail |

### Landing Page 3D Hero — Working

| Layer | Files |
|-------|-------|
| Page | `heritage_graph_landing/app/page.tsx` |
| Components | `heritage_graph_landing/app/components/ThreeCanvas.tsx`, `HeroBackground.tsx`, `NetworkVisualization.tsx` |
| Libraries | React Three Fiber, drei, three.js |

---

## Infrastructure

### Docker Orchestration — Working

| Feature | Files |
|---------|-------|
| Dev compose | `docker-compose.yml` |
| Prod compose | `docker-compose.prod.yml` |
| Backend Dockerfile | `Dockerfile.backend` (multi-stage, gunicorn) |
| Frontend Dockerfile | `heritage_graph_ui/Dockerfile` (multi-stage, non-root) |
| Landing Dockerfile | `heritage_graph_landing/Dockerfile` |
| Entrypoint | `heritage_graph/entrypoint.sh` (migrate, superuser, start) |
| Make commands | `Makefile` |

### Traefik Reverse Proxy — Working

| Feature | Files |
|---------|-------|
| Static config | `infra/traefik/traefik.yml` |
| Dynamic config | `infra/traefik/traefik-dynamic.yml` (middlewares, security headers) |
| SSL/ACME | `infra/traefik/acme/` (Let's Encrypt storage) |
| Prod override | `docker-compose.prod.yml` (HTTPS redirect, cert resolver) |

### Database Init — Working

| Feature | Files |
|---------|-------|
| Init script | `infra/postgres/init-scripts/01-init-databases.sh` |
| Creates | `heritage_db` database on first boot |

### Health Checks — Working

| Endpoint | File | Used By |
|----------|------|---------|
| `GET /health/` | `heritage_graph/apps/health_check.py` | Docker HEALTHCHECK, Traefik |
| `GET /health/detailed/` | same | Monitoring |
| `GET /health/ready/` | same | K8s readiness probe |
| `GET /health/live/` | same | K8s liveness probe |

### Prometheus Monitoring — Working

| Feature | Files |
|---------|-------|
| Django middleware | `django_prometheus` in `base.py` INSTALLED_APPS + MIDDLEWARE |
| Metrics endpoint | `GET /` (via `django_prometheus.urls`) |

---

## Data Import

### CSV Import Command — Working

| Layer | Files |
|-------|-------|
| Management command | `heritage_data/management/commands/import_csvs.py` |
| Usage | `python manage.py import_csvs /path/to/csvs --user-id 1` |
| Maps | 70+ CSV column labels → Submission model fields |

---

## Planned / Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| CIDOC Artifact model | Planned | Commented out in `cidoc_data/models.py` |
| CIDOC revision models for all entities | Planned | Only PersonRevision is active |
| CIDOC comment models | Planned | Commented out |
| Notification backend API | Planned | Model exists, no views/serializers |
| Reviewer notifications | Planned | Review system exists, notifications not yet wired |
| Frontend route protection | Missing | Middleware is passthrough |
| CIDOC admin registrations | Planned | Entirely commented out |
| Frontend test suite | Planned | No testing framework configured |
| Backend test coverage | Partial | Only cidoc_data has tests |
| Redis caching | Planned | No cache backend configured |
| WebSocket real-time updates | Planned | ASGI configured but no consumers |
| Full-text search (Elasticsearch/Meilisearch) | Planned | Currently using Django ORM `icontains` |
| Review system admin panel | Planned | ReviewerRole assignment via API only, no admin UI yet |