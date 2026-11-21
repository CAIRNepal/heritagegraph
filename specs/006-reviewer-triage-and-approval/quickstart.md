# Quickstart: Reviewer triage and schema extension approval

**Feature dir**: `specs/006-reviewer-triage-and-approval/` · **Branch**: `006-reviewer-triage-and-approval`

## Prerequisites

- Backend and UI env per repo `README` / `AGENTS.md`.
- Users in Django groups: **`Reviewers`** (queue), **`Moderators`** (proposal approve/publish).
- Optional: `HERITAGEGRAPH_SCHEMA_EXTENSION_PATH` pointing to a writable LinkML extension file for publish smoke tests (never commit secrets).

## 1. Apply migrations (after implementation)

```bash
cd heritage_graph
uv run python manage.py migrate
```

## 2. Seed triage policy (after implementation)

Create or update the active `TriagePolicy` row via Django admin or:

```bash
uv run python manage.py seed_triage_policy
```

Defaults should match [spec.md](./spec.md) Assumptions.

## 3. Smoke: review queue triage

1. Sign in as a reviewer (Bearer token in API client or NextAuth session in browser).
2. `GET /api/v1/data/review-queue/?ordering=-triage_priority&queue_type=all`
3. Confirm each item includes `triage_priority`, `triage_breakdown`, `worst_source_tier` (when implemented).
4. Toggle `my_domain=true` for a user with `ReviewerRole.expertise_areas` set — list should filter to matching `category`.
5. Open curation review UI with query params copied — filters and sort should restore.

## 4. Smoke: schema extension proposal

1. As author: `POST /api/v1/data/schema-extension-proposals/` with draft YAML fragment.
2. `POST .../{id}/submit/`
3. As non-moderator: `POST .../{id}/approve/` → expect **403**.
4. As moderator: `POST .../{id}/approve/` then `POST .../{id}/publish/`
5. Verify:
   - `GET .../{id}/audit/` shows chronological immutable entries.
   - Registry payload (`schema_version` / `extension_hash`) changes after publish **and** effective classes reflect merge once [research.md](./research.md) R-006 gap is closed.
6. Run `make ontology-check` (or CI equivalent) if publish writes YAML that participates in committed snapshots.

## 5. Rollback (operator)

Documented procedure: moderator (or platform admin per policy) creates a **revert** proposal or marks rollback in audit; replace extension file with backed-up version; clear `linkml_loader` cache; re-run registry checks.

## 6. Quality gates (before PR)

- `ruff format . && ruff check .` under `heritage_graph/`
- `npm run build` (and typecheck script if separate) under `heritage_graph_ui/`
