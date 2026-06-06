# HeritageGraph — Documentation Index

A map of all project documentation. Start with [README.md](README.md) for setup, then use the
section that matches your goal. Canonical topic docs live at the repository root; specialized
and historical material is organized under [`documentation/`](documentation/).

---

## 🧭 Start here / overview
| Doc | What it covers |
|-----|----------------|
| [README.md](README.md) | Project intro, quick start, key commands |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, network topology, auth flow, data models, Docker lifecycle |
| [documentation/SYSTEM_OVERVIEW.md](documentation/SYSTEM_OVERVIEW.md) | Plain-language map of the whole system and *why* each choice was made |
| [documentation/FEATURE_WALKTHROUGH.md](documentation/FEATURE_WALKTHROUGH.md) | Demo-oriented walkthrough of the form, graph views, and 3D surfaces |

## 🕸️ Ontology & knowledge graph
| Doc | What it covers |
|-----|----------------|
| [ONTOLOGY.md](ONTOLOGY.md) | CIDOC-CRM mapping, LinkML registry, SHACL, namespaces |
| [RDF_KG_ENGINE.md](RDF_KG_ENGINE.md) | The knowledge-graph engine (Oxigraph): projection, partitions, SPARQL API |
| [KG_PIPELINE.md](KG_PIPELINE.md) | Full KG pipeline ingestion→display, SOTA assessment & roadmap |

## 📝 Contribution & forms
| Doc | What it covers |
|-----|----------------|
| [FORMS.md](FORMS.md) | Registry-driven contribution forms — add fields, enums, sections, entity types |

## 🔐 Authentication & roles
| Doc | What it covers |
|-----|----------------|
| [AUTH.md](AUTH.md) | **Canonical** — using auth in features (NextAuth + Google OAuth + Django verification) |
| [documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md](documentation/auth/AUTH_ROLES_DEVELOPER_GUIDE.md) | Roles & permissions — contributor / reviewer / staff, DRF guards |
| [documentation/auth/AUTH_GUIDE.md](documentation/auth/AUTH_GUIDE.md) | How to add a new OAuth provider |

## 🔌 API
| Doc | What it covers |
|-----|----------------|
| [API_VERSIONING.md](API_VERSIONING.md) | API versioning scheme (`/api/v1/...`) and the stable contract |

## 🚀 Deployment & operations
| Doc | What it covers |
|-----|----------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | **Canonical** — production Docker + Traefik + Let's Encrypt, SSL, backups |
| [documentation/deployment/DOKPLOY.md](documentation/deployment/DOKPLOY.md) | Dokploy platform runbook |
| [documentation/deployment/deploy_on_coolify.md](documentation/deployment/deploy_on_coolify.md) | Coolify platform runbook |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues, gotchas, debugging, deploy checklist |

## ⚡ Performance, search & i18n
| Doc | What it covers |
|-----|----------------|
| [CACHE.md](CACHE.md) | Backend caching (Django cache framework; optional Redis) |
| [SEARCH_STRATEGY_POSTGRES.md](SEARCH_STRATEGY_POSTGRES.md) | PostgreSQL-based search strategy |
| [TRANSLATION.md](TRANSLATION.md) | Translation / i18n workflow |

## 📄 Document processing
| Doc | What it covers |
|-----|----------------|
| [OCR_PIPELINE.md](OCR_PIPELINE.md) | OCR document-processing pipeline — **⚠️ suspended (future functionality)** |

## ✅ Testing & quality
| Doc | What it covers |
|-----|----------------|
| [TESTING_AND_VALIDATION.md](TESTING_AND_VALIDATION.md) | How to run and reason about tests and validation |

## 🛠️ Developer conventions & agents
| Doc | What it covers |
|-----|----------------|
| [CLAUDE.md](CLAUDE.md) | Coding conventions for Python/Django and TypeScript/Next.js |
| [CONVENTIONS.md](CONVENTIONS.md) | Naming, import ordering, code style |
| [AGENTS.md](AGENTS.md) | Master guide for AI coding agents |
| [SKILLS.md](SKILLS.md) | Feature → files capability matrix |

## 📦 Project meta
| Doc | What it covers |
|-----|----------------|
| [LICENSE](LICENSE) | MIT license (code, ontology, data) |
| [CITATION.cff](CITATION.cff) | How to cite HeritageGraph |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

## 🗄️ Maintenance & internal
| Doc | What it covers |
|-----|----------------|
| [documentation/TECHNICAL_DEBT.md](documentation/TECHNICAL_DEBT.md) | Known limitations / consolidation record (reviewer-facing) |
| [documentation/internal/](documentation/internal/) | Historical planning, design-exploration, and strategy notes (not user-facing) |
