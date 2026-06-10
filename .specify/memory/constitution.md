<!--
Sync Impact Report
- Version change: (template) → 0.1.0
- Modified principles: Replaced template placeholders with HeritageGraph principles (P1–P5)
- Added sections: Security_Data_Compatibility, Workflow_Quality_Gates
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/checklist-template.md
- Follow-up TODOs: None
-->

# HeritageGraph Constitution

## Core Principles

### I. Secrets & configuration are environment-driven (NON-NEGOTIABLE)

- Secrets MUST NOT be committed to the repository (including `.env` files).
- Production secrets/config MUST come from environment variables.
- Django environment-specific behavior MUST live in `heritage_graph/settings/development.py` or
  `heritage_graph/settings/production.py` (do not put env-specific configuration into
  `heritage_graph/settings/base.py`).
- Frontend network/config MUST use `process.env.NEXT_PUBLIC_*` variables (do not hardcode
  `http://localhost:*`).

### II. Follow the established stack and project conventions

- Backend MUST follow Django REST Framework patterns used in this repo:
  - Prefer `ModelViewSet` for CRUD resources.
  - Use `DefaultRouter` registrations in `apps/<app>/urls.py`.
  - Use explicit permissions classes (no inline `if request.user` checks).
  - New models SHOULD use UUID primary keys, explicit `db_table`, and timestamps.
- Frontend MUST follow Next.js App Router + TypeScript conventions:
  - New components SHOULD be named exports (avoid default exports for new components).
  - `"use client"` MUST only be used when needed (hooks, interactivity, browser APIs).
  - shadcn/ui primitives in `src/components/ui/` MUST NOT be modified directly—wrap instead.
  - Tailwind colors MUST be managed via CSS variables in `globals.css` (no custom hex colors in
    component files).

### III. Authentication and API contracts must match the platform

- The UI MUST use NextAuth (Google OAuth) as the source of truth for interactive login.
- Frontend API calls to protected endpoints MUST pass `Authorization: Bearer <accessToken>` using
  `session.accessToken`.
- Django API authentication in production MUST assume Google-issued tokens (verified server-side);
  do not add alternative auth flows without an explicit migration plan.

### IV. Quality gates apply to every change (NON-NEGOTIABLE)

- For any changed Python code, the change MUST be compatible with the repo’s ruff workflow:
  - Run `ruff format .` and `ruff check .` (or ensure CI-equivalent checks would pass).
- For any changed TypeScript/Next.js code, the change MUST typecheck/build under the project’s
  configured scripts (or CI-equivalent checks).
- Changes MUST include appropriate error handling and status codes for APIs (DRF `Response`,
  `serializer.is_valid(raise_exception=True)` patterns).

### V. Deployability and operations are part of the definition of done

- Docker service conventions MUST be respected (service naming, env var fallbacks, internal `expose`
  vs external routing through Traefik, and health/readiness endpoints where applicable).
- Breaking changes MUST include a migration/rollout plan (data migrations, API versioning,
  backwards-compatibility window, and documentation updates).

## Security_Data_Compatibility

- User data and tokens MUST be handled as sensitive: avoid logging raw tokens and PII.
- Database schema changes MUST be expressed as Django migrations; migrations MUST be reversible when
  feasible (or explicitly documented when not).
- Public or client-facing API changes SHOULD follow the repository’s API versioning conventions and
  be documented.
- Any new environment variables MUST be documented in `.env.example` (names in UPPER_SNAKE_CASE;
  public frontend vars prefixed with `NEXT_PUBLIC_`).

## Workflow_Quality_Gates

- Work MUST be based on the `v1` branch strategy.
- Commit messages MUST be imperative tense (e.g., “Add …”, “Fix …”).
- Do not commit generated or local artifacts (e.g., `.env`, `node_modules/`, `__pycache__/`,
  `.next/`).
- Documentation MUST be updated when changes impact it:
  - `AGENTS.md` when adding new apps/models/major features or changing documented workflows.
  - `ARCHITECTURE.md` when service topology or major data flows change.
  - `documentation/developer/SKILLS.md` when adding new capabilities or automation expectations.

## Governance

This constitution governs how work is performed in this repository. In case of conflict, it
supersedes templates and ad-hoc practices.

- Amendments MUST include:
  - A clear statement of what changed and why.
  - Updates to dependent templates/docs (or an explicit justification for deferring them).
  - A version bump following SemVer:
    - MAJOR: backwards-incompatible governance changes (principle removals/redefinitions)
    - MINOR: new principles/sections or materially stronger constraints
    - PATCH: clarifications, wording, typo fixes
- Compliance is reviewed continuously:
  - Every PR/review MUST consider these principles, especially secrets/config, auth contract, and
    quality gates.

**Version**: 0.1.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-18
