# Contributing to HeritageGraph

Thanks for your interest in contributing! HeritageGraph is a CAIR-Nepal open-source project
(MIT licensed — see [LICENSE](LICENSE)). This guide covers how to get set up and the
conventions we follow.

## Getting started

1. **Fork & branch.** Work from the `v1` branch: `git switch v1`.
2. **Run the stack** (Docker is the fastest path):
   ```bash
   cp .env.example .env
   make setup        # or: docker compose up --build
   ```
   For local (non-Docker) backend/frontend setup, see [README.md](README.md).

## Conventions

- **Backend:** Python 3.12, Django REST Framework, formatted/linted with `ruff`
  (`ruff check .` / `ruff format .`). See [CLAUDE.md](CLAUDE.md) and
  [documentation/developer/CONVENTIONS.md](documentation/developer/CONVENTIONS.md).
- **Frontend:** Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui. Named exports, `.tsx`,
  Tailwind utilities only (colors via `globals.css`).
- **Ontology changes:** edit `ontology/HeritageGraph.yaml` and (for new UI types)
  `tools/ui-classmap.yaml`, then run `make generate` and commit all regenerated files
  together. See [`documentation/ontology/ONTOLOGY.md`](documentation/ontology/ONTOLOGY.md).
  CI (`make check`) enforces consistency.

## Before you open a PR

- Run platform E2E: `make test-e2e` (or `./tests/run_e2e.sh`).
- Run backend unit tests: `cd heritage_graph && python manage.py test apps.cidoc_data`.
- Run `make check` (ontology/registry/serializer/SHACL consistency).
- Ensure migrations are committed: `python manage.py makemigrations --check`.
- Keep commits focused; use imperative commit messages (e.g. "Add reviewer queue filter").

## Where things live

See [DOCS.md](DOCS.md) for the full documentation index — architecture, ontology, auth, forms,
deployment, and testing guides.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs actual behavior, and environment
details. Security-sensitive reports should be sent privately to the maintainers.
