# Coding Conventions (Backend & Frontend)

This page condenses the most important guidelines from `CLAUDE.md` and `CONVENTIONS.md` for contributors.

## Backend (Django)

- Python version: 3.13. Use `ruff` for formatting and linting.
- New models: use UUID primary keys, `created_at` / `updated_at`, and explicit `db_table`.
- Prefer `CulturalEntity`/`Revision`/`Activity` for new data models.
- Use `ModelViewSet` and DRF `@action` for custom endpoints.

## Frontend (Next.js + TypeScript)

- Next.js 15, React 19. Use TypeScript for all new components.
- Use named exports and props `interface` for components.
- Use Tailwind CSS utilities; manage colors in `globals.css` via tweakcn.
- Use `use client` only when necessary.

## API and Docs

- Use `@extend_schema()` to document critical endpoints for `drf-spectacular`.
- Keep API examples and embed an OpenAPI snapshot under `docs/static/openapi.json`.

## Git & PRs

- Branch from `v1`. Use imperative commit messages. Include tests for backend changes.

This page will be expanded with examples and links to the full `CLAUDE.md` content.
