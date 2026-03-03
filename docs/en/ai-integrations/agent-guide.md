# AI Agents Guide (migration from AGENTS.md)

This page provides a condensed orientation for AI agents and integrators working with HeritageGraph.

## What HeritageGraph is

- Full-stack platform to preserve and publish cultural heritage as linked open data.
- Backend: Django REST Framework. Frontend: Next.js 15 dashboard, Next.js 14 landing.
- Auth: NextAuth v4 with Google OAuth in production; Credentials/SimpleJWT in development.

## Key conventions for agents

- Read `AGENTS.md` in the repository root for the full agent-oriented instructions.
- Avoid committing secrets; use environment variables from `.env.example`.
- New features should use the `CulturalEntity` → `Revision` → `Activity` workflow not the legacy `Submission`.

## Useful endpoints (summary)

- Health: `/health/`, `/health/detailed/`, `/health/ready/`, `/health/live/`
- API docs: `/docs`, `/redoc/`, `/schema/`
- Heritage data: `/data/submissions/`, `/data/cultural-entities/`, `/data/review/`
- CIDOC data: `/cidoc/persons/`, `/cidoc/events/`, etc.

## Where to look in the codebase

- Backend apps live in `heritage_graph/apps/` (`heritage_data`, `cidoc_data`).
- Frontend app code lives under `heritage_graph_ui/src/app/`.
- Important files: `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `FORMS.md`, `AUTH.md`.

This guide will be expanded and linked into the main MkDocs site. For the canonical agent instructions, read `AGENTS.md` in the repository root.
