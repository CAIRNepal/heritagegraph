# Architecture — System Design & Data Flow

This is a condensed migration of `ARCHITECTURE.md` summarizing system topology, data models, authentication flow, and frontend architecture.

## System components

- Traefik: reverse proxy and TLS termination
- Backend: Django REST Framework (port 8000)
- Frontend: Next.js 15 dashboard (port 3000)
- Landing: Next.js 14 marketing site (port 3000)
- PostgreSQL: primary data store

## Network & routing

- Docker networks: `proxy` (traefik), `backend` (internal)
- Hostnames in development use `*.localhost` (frontend.localhost, backend.localhost)

## Authentication flow (summary)

- Production: NextAuth Google flow → browser receives Google ID token → API calls include `Authorization: Bearer <id_token>` → Django verifies token and auto-creates users.
- Development: Credentials flow → `POST /api/token/` returns SimpleJWT tokens → use `Authorization: Bearer <access>`.

## Data models

- Legacy: `Submission` model (flat fields) — used by older forms.
- New: `CulturalEntity` → `Revision` (JSONField) → `Activity` workflow — preferred for new features.
- CIDOC-CRM structured models in `cidoc_data` for person/location/event domains.

## Frontend app structure

- `src/app/dashboard/` contains knowledge, contribute, curation, community, and graphview sections.
- Use `useSession()` for client auth and `getServerSession()` on server components.

For the full original file with diagrams and detailed flow charts, see `ARCHITECTURE.md` in the repository root. This page is meant for quick orientation; deeper architectural decisions and diagrams remain in the canonical file until fully migrated.
