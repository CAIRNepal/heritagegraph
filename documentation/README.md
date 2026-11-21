# HeritageGraph documentation

Canonical topic guides live here. The repository root keeps a short index in [`DOCS.md`](../DOCS.md) plus agent-oriented files (`AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`).

## Start here

| Doc | Topic |
|-----|--------|
| [`SYSTEM_OVERVIEW.md`](SYSTEM_OVERVIEW.md) | Plain-language map of the whole system |
| [`FEATURE_WALKTHROUGH.md`](FEATURE_WALKTHROUGH.md) | Demo walkthrough (forms, graph, 3D) |
| [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Known issues and debugging |

## By topic

### Testing

| Doc | Topic |
|-----|--------|
| [`testing/TESTING.md`](testing/TESTING.md) | E2E suite, validation, manual checklist |
| [`../tests/README.md`](../tests/README.md) | Runner scripts (`tests/` folder) |

### Knowledge graph & RDF

| Doc | Topic |
|-----|--------|
| [`knowledge-graph/RDF_ENGINE.md`](knowledge-graph/RDF_ENGINE.md) | Oxigraph engine, projection, SPARQL API, entrypoint bootstrap |
| [`knowledge-graph/PIPELINE.md`](knowledge-graph/PIPELINE.md) | Ingestion → museum/atlas pipeline & SOTA roadmap |

### Contribution & ontology

| Doc | Topic |
|-----|--------|
| [`contribution/FORMS.md`](contribution/FORMS.md) | Registry-driven forms, identity resolution, RDF projection |
| [`contribution/KNOWLEDGE_PAGES.md`](contribution/KNOWLEDGE_PAGES.md) | `/knowledge/*` tabular pages — purpose, matrix, verification |
| [`ontology/ONTOLOGY.md`](ontology/ONTOLOGY.md) | LinkML v1.0.0 registry (26 types), lifecycle events, CulturalEntity, LUX interop |

### Auth & API

| Doc | Topic |
|-----|--------|
| [`auth/AUTH.md`](auth/AUTH.md) | NextAuth + Google OAuth + Django verification |
| [`auth/AUTH_GUIDE.md`](auth/AUTH_GUIDE.md) | Adding a new OAuth provider |
| [`auth/AUTH_ROLES_DEVELOPER_GUIDE.md`](auth/AUTH_ROLES_DEVELOPER_GUIDE.md) | Roles & permissions |
| [`api/VERSIONING.md`](api/VERSIONING.md) | `/api/v1/...` versioning |

### Deployment & operations

| Doc | Topic |
|-----|--------|
| [`deployment/DEPLOYMENT.md`](deployment/DEPLOYMENT.md) | Production Docker + Traefik + TLS |
| [`deployment/DOKPLOY.md`](deployment/DOKPLOY.md) | Dokploy runbook |
| [`deployment/deploy_on_coolify.md`](deployment/deploy_on_coolify.md) | Coolify runbook |

### Performance, search, i18n

| Doc | Topic |
|-----|--------|
| [`performance/CACHING.md`](performance/CACHING.md) | Django cache + optional Redis (+ strategy appendix) |
| [`performance/SEARCH.md`](performance/SEARCH.md) | PostgreSQL search strategy |
| [`i18n/TRANSLATION.md`](i18n/TRANSLATION.md) | Translation workflow |

### Pipelines (suspended / future)

| Doc | Topic |
|-----|--------|
| [`pipelines/OCR.md`](pipelines/OCR.md) | OCR document pipeline (suspended) |

### Developer conventions

| Doc | Topic |
|-----|--------|
| [`developer/CONVENTIONS.md`](developer/CONVENTIONS.md) | Naming and code style |
| [`developer/SKILLS.md`](developer/SKILLS.md) | Feature → files capability matrix |

## MkDocs static site

Build from repo root (see [`ARCHIVED.md`](ARCHIVED.md)):

```bash
pip install -r requirements.txt   # includes mkdocs + material theme
make docs-build                     # → ./site/
make docs-serve                     # http://localhost:8001
```

[`mkdocs.yml`](../mkdocs.yml) uses `docs_dir: documentation` — the nav mirrors the table above.

## Maintenance

| Doc | Topic |
|-----|--------|
| [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) | Known limitations / consolidation record |
| [`internal/`](internal/) | Historical planning notes (not user-facing) |
| [`ARCHIVED.md`](ARCHIVED.md) | Legacy Sphinx site + MkDocs notes |

## Spec Kit

Feature specifications: [`../specs/`](../specs/) (e.g. identity layer, reviewer triage, YAML schema).

---

*Docs aligned with current codebase: `(dashboard)` route group, Oxigraph + identity bootstrap, suspended OCR, `tests/` E2E runners, `documentation/` layout (June 2026).*
