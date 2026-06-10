# HeritageGraph — Documentation Index

A map of all project documentation. Start with [README.md](README.md) for setup.

**Canonical guides** live under [`documentation/`](documentation/).

---

## Start here / overview

| Doc | What it covers |
|-----|----------------|
| [README.md](README.md) | Project intro, quick start, key commands |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, topology, auth flow, data models, Docker |
| [documentation/SYSTEM_OVERVIEW.md](documentation/SYSTEM_OVERVIEW.md) | Plain-language system map |
| [documentation/FEATURE_WALKTHROUGH.md](documentation/FEATURE_WALKTHROUGH.md) | Demo walkthrough |
| [documentation/README.md](documentation/README.md) | Full documentation hub |

## Ontology & knowledge graph

| Doc | What it covers |
|-----|----------------|
| [documentation/ontology/ONTOLOGY.md](documentation/ontology/ONTOLOGY.md) | LinkML v1.0.0 — 26 registry types, lifecycle events, CulturalEntity, LUX interop |
| [ontology/README.md](ontology/README.md) | Canonical YAML edit workflow (`make generate` / `make ontology`) |
| [documentation/knowledge-graph/RDF_ENGINE.md](documentation/knowledge-graph/RDF_ENGINE.md) | KG engine (Oxigraph), SPARQL API |
| [documentation/knowledge-graph/PIPELINE.md](documentation/knowledge-graph/PIPELINE.md) | KG pipeline ingestion → display |

## Contribution & forms

| Doc | What it covers |
|-----|----------------|
| [documentation/contribution/FORMS.md](documentation/contribution/FORMS.md) | Registry-driven contribution forms |
| [documentation/contribution/KNOWLEDGE_PAGES.md](documentation/contribution/KNOWLEDGE_PAGES.md) | `/knowledge/*` tabular browse pages (26 types) |

## Authentication & roles

| Doc | What it covers |
|-----|----------------|
| [documentation/auth/AUTH.md](documentation/auth/AUTH.md) | NextAuth + Google OAuth + Django |
| [documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md](documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md) | Roles & permissions |
| [documentation/auth/AUTH_GUIDE.md](documentation/auth/AUTH_GUIDE.md) | Adding a new OAuth provider |

## API

| Doc | What it covers |
|-----|----------------|
| [documentation/api/VERSIONING.md](documentation/api/VERSIONING.md) | `/api/v1/...` versioning |

## Deployment & operations

| Doc | What it covers |
|-----|----------------|
| [documentation/deployment/DEPLOYMENT.md](documentation/deployment/DEPLOYMENT.md) | Production Docker + Traefik + TLS |
| [documentation/deployment/DOKPLOY.md](documentation/deployment/DOKPLOY.md) | Dokploy runbook |
| [documentation/deployment/deploy_on_coolify.md](documentation/deployment/deploy_on_coolify.md) | Coolify runbook |
| [documentation/TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md) | Known issues, debugging |

## Performance, search & i18n

| Doc | What it covers |
|-----|----------------|
| [documentation/performance/CACHING.md](documentation/performance/CACHING.md) | Backend caching |
| [documentation/performance/SEARCH.md](documentation/performance/SEARCH.md) | PostgreSQL search |
| [documentation/i18n/TRANSLATION.md](documentation/i18n/TRANSLATION.md) | i18n workflow |

## Document processing

| Doc | What it covers |
|-----|----------------|
| [documentation/pipelines/OCR.md](documentation/pipelines/OCR.md) | OCR pipeline — **suspended** |

## Testing & quality

| Doc | What it covers |
|-----|----------------|
| [documentation/testing/TESTING.md](documentation/testing/TESTING.md) | E2E tests, validation, manual checklist |
| [tests/README.md](tests/README.md) | E2E runner scripts (repo-root `tests/`) |

## Developer conventions & agents

| Doc | What it covers |
|-----|----------------|
| [CLAUDE.md](CLAUDE.md) | Coding conventions (Python/Django, TypeScript/Next.js) |
| [documentation/developer/CONVENTIONS.md](documentation/developer/CONVENTIONS.md) | Naming, imports, style |
| [AGENTS.md](AGENTS.md) | Master guide for AI coding agents |
| [documentation/developer/SKILLS.md](documentation/developer/SKILLS.md) | Feature capability matrix |

## Project meta

| Doc | What it covers |
|-----|----------------|
| [LICENSE](LICENSE) | MIT license |
| [CITATION.cff](CITATION.cff) | How to cite HeritageGraph |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

## Maintenance & internal

| Doc | What it covers |
|-----|----------------|
| [documentation/TECHNICAL_DEBT.md](documentation/TECHNICAL_DEBT.md) | Known limitations |
| [documentation/internal/](documentation/internal/) | Historical planning notes |
