# ================================================================
# HeritageGraph Makefile
# ================================================================
# Run `make` or `make help` to see all commands.
# ================================================================

.PHONY: ontology ontology-check viz-config viz-config-check shacl shacl-check \
        crm-bridge crm-bridge-check skos-vocab skos-vocab-check \
        serializers serializers-check entityrefs entityrefs-check contribute-routes-check \
        registry-alignment registry-alignment-check \
        schema-rebuild identity-candidates schema-diff test-e2e \
        rdf-rebuild rdf-diagnose rdf-load-tbox kg-publish kg-verify \
        generate check \
        help setup superuser backend frontend landing landing-install dev-local kill-ports \
        museum-backend museum-frontend museum-dev \
        reset-dev-db migrate migrations shell seed seed-reset \
        docs-build docs-serve docs-clean \
        docker-up docker-up-build docker-down docker-build \
        docker-logs docker-ps docker-shell docker-migrate \
        prod-up prod-down prod-build prod-logs \
        backup restore clean prune \
        auth-dev auth-google auth-github auth-all auth-status auth-setup auth-add-github

.DEFAULT_GOAL := help

# ================================================================
# PATHS
# ================================================================
VENV_DIR  := .venv
VENV_PY   := $(VENV_DIR)/bin/python
BACKEND   := heritage_graph
FRONTEND  := heritage_graph_ui
LANDING   := heritage_graph_landing

# Node — prefer mise install if present, else directory of `node` on PATH
MISE_NODE := $(HOME)/.local/share/mise/installs/node/22.22.0/bin
NODE_BIN  := $(shell test -f $(MISE_NODE)/node && echo $(MISE_NODE) || dirname $$(command -v node 2>/dev/null || echo /usr/bin/node))
NODE_PATH := PATH=$(NODE_BIN):$$PATH

# ================================================================
# ONTOLOGY / SCHEMA REGISTRY (specs/004-yaml-driven-schema)
# ================================================================
ontology: ## Regenerate registry + museum/graph/forms viz artifacts from HeritageGraph.yaml
	python3 tools/linkml_generate_registry.py
	python3 tools/gen_heritage_viz_config.py

ontology-check:
	@test ! -f "$(CURDIR)/Heritagegraph.yaml" || (echo "ERROR: Remove repo-root Heritagegraph.yaml — canonical ontology is ontology/HeritageGraph.yaml" >&2 && exit 1)
	python3 tools/linkml_generate_registry.py --check
	python3 tools/gen_heritage_viz_config.py --check

viz-config: ## Regenerate viz-config, enums, ontology-graph.ts, ontology_config.py
	python3 tools/gen_heritage_viz_config.py

viz-config-check: ## CI: fail if viz/namespace artifacts are out of date
	python3 tools/gen_heritage_viz_config.py --check

shacl: ## Regenerate minimal SHACL from registry.generated.json (run after ontology)
	python3 tools/emit_minimal_shacl.py

shacl-check: ## CI: fail if generated SHACL TTL is out of date
	python3 tools/emit_minimal_shacl.py --check

owl-ttl: ## Regenerate ontology/HeritageGraph.ttl (OWL TBox) from HeritageGraph.yaml
	python3 tools/emit_owl_ttl.py

owl-ttl-check: ## CI: fail if the OWL TBox TTL is out of date
	python3 tools/emit_owl_ttl.py --check

crm-bridge: ## Emit CIDOC-CRM alignment bridge + disjointness TBox (subClassOf/disjointWith)
	python3 tools/emit_crm_bridge.py

crm-bridge-check: ## CI: fail if the CRM bridge TTL is out of date
	python3 tools/emit_crm_bridge.py --check

skos-vocab-check: ## CI: fail if the SKOS vocabulary TTL is out of date
	python3 tools/emit_skos_vocabularies.py --check

contribute-routes-check: ## CI: contribute-hub intents map to Next.js pages
	python3 tools/verify_contribute_intent_routes.py

serializers: ## Regenerate serializers.generated.py from HeritageGraph.yaml
	python3 tools/generate_serializers.py

serializers-check: ## CI: fail if serializers.generated.py is out of date
	python3 tools/generate_serializers.py --check

entityrefs: $(VENV_PY) ## Rebuild EntityRef edges from legacy CharField relation columns
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rebuild_entityrefs

entityrefs-check: $(VENV_PY) ## CI: fail if any CharField relation values lack EntityRef rows
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rebuild_entityrefs --check

registry-alignment: $(VENV_PY) ## Report registry slots vs Django fields that do not line up
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py report_registry_alignment

registry-alignment-check: $(VENV_PY) ## CI: fail if the alignment report is out of date
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py report_registry_alignment --check

schema-rebuild: $(VENV_PY) ## Persist ontology registry snapshot to DB (SchemaRegistry)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rebuild_schema_registry

rdf-rebuild: $(VENV_PY) ## Reproject curated corpus into the public RDF graph
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rdf_rebuild --purge-imports

kg-publish: $(VENV_PY) ## Full KG publish pipeline (rebuild + verify + quality report)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_publish

kg-verify: $(VENV_PY) ## Verify KG store consistency and publication gates
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_verify

kg-quality-report: $(VENV_PY) ## JSON KG quality metrics (Phase 1 evaluation)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_quality_report

rdf-export-dump: $(VENV_PY) ## Export public/schema RDF dumps to ontology/lod/dumps
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rdf_export_dump

skos-vocab: ## Emit AAT-aligned SKOS controlled vocabularies from HeritageGraph.yaml enums
	python3 tools/emit_skos_vocabularies.py

kg-inference: $(VENV_PY) ## Materialize OWL-RL into graph/inferred
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_materialize_inference

kg-nanopubs: $(VENV_PY) ## Export TriG nanopublications per assertion
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_export_nanopubs

kg-linkset: $(VENV_PY) ## Export VoID linkset TTL
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_export_linkset

kg-rdfstar: $(VENV_PY) ## Export RDF-star annotation TriG
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py kg_export_rdfstar

rdf-diagnose: $(VENV_PY) ## Report RDF sync config and triple counts
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rdf_diagnose

rdf-load-tbox: $(VENV_PY) ## Load ontology/HeritageGraph.ttl into the schema named graph
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rdf_load_tbox

rdf-drain-outbox: $(VENV_PY) ## Retry failed knowledge graph writes
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py rdf_drain_outbox

identity-candidates: $(VENV_PY) ## Refresh identity candidates + auto-merge duplicate clusters
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py refresh_identity_candidates --auto-merge

test-e2e: $(VENV_PY) ## Run full platform E2E + integration test suite (RDF sync on)
	DJANGO_ENV=development RDF_SYNC_ENABLED=true ./tests/run_e2e.sh -v 1

schema-diff: ## Compare two ontology YAML files: OLD=ontology/HeritageGraph.yaml NEW=/path/to/new.yaml
	@if [ -z "$(OLD)" ] || [ -z "$(NEW)" ]; then \
		echo "Usage: make schema-diff OLD=ontology/HeritageGraph.yaml NEW=/path/to/new.yaml"; \
		exit 1; \
	fi
	python3 tools/schema_diff.py $(OLD) $(NEW)

generate: ontology viz-config shacl owl-ttl crm-bridge skos-vocab serializers entityrefs schema-rebuild registry-alignment ## Full pipeline from ontology/HeritageGraph.yaml
	@echo "==> Full ontology pipeline complete (registry, viz, SHACL, CRM bridge, SKOS, serializers, entityrefs, DB snapshot, alignment report)"

check: ontology-check shacl-check owl-ttl-check crm-bridge-check skos-vocab-check serializers-check entityrefs-check contribute-routes-check registry-alignment-check ## CI: verify all generated files are up to date (no side-effects)
	@echo "==> All ontology pipeline checks passed"

# ================================================================
# HELP
# ================================================================
help:
	@echo ""
	@echo "  HeritageGraph — quick reference"
	@echo "  ================================"
	@echo ""
	@echo "  \033[1mFIRST TIME SETUP\033[0m"
	@echo "    make setup          Install deps, venv and run migrations (run once)"
	@echo "    make superuser      Create a Django admin login"
	@echo ""
	@echo "  \033[1mPIPELINE\033[0m  (schema-driven UI/DB — run after ontology changes)"
	@echo "    make generate       Full pipeline: ontology → viz → shacl → serializers → entityrefs → schema-rebuild"
	@echo "    make check          CI: verify all generated artifacts are up to date (no side-effects)"
	@echo "    make viz-config     Regenerate atlas enums + RDF_PREFIXES (gen_heritage_viz_config.py)"
	@echo "    make shacl          Regenerate ontology/shapes/generated-heritagegraph-minimal-shacl.ttl"
	@echo "    make schema-rebuild Persist ontology registry snapshot to DB (SchemaRegistry)"
	@echo "    make identity-candidates Refresh IdentityResolutionCandidate pairs (same-name)"
	@echo "    make test-e2e         Full platform E2E (health, KG, identity, RDF, museum)"
	@echo "    make schema-diff    Compare two ontology YAML files: OLD=... NEW=..."
	@echo ""
	@echo "  \033[1mDAILY USE\033[0m  (local dev — open one terminal per service)"
	@echo "    make ontology       Regenerate registry.generated.* from ontology/HeritageGraph.yaml"
	@echo "    make ontology-check Fail if registry.generated.* is out of date (CI)"
	@echo "    make serializers    Regenerate serializers.generated.py from HeritageGraph.yaml"
	@echo "    make serializers-check Fail if serializers.generated.py is out of date (CI)"
	@echo "    make entityrefs     Rebuild EntityRef edges from legacy CharField columns"
	@echo "    make entityrefs-check Fail if any relation CharField values lack EntityRef rows (CI)"
	@echo "    make backend        Django API        →  http://localhost:8000"
	@echo "    make frontend       Main app (UI)     →  http://localhost:3000"
	@echo "    make landing        Marketing site    →  http://localhost:3001"
	@echo "    make dev-local      Print URLs + env reminder for all three"
	@echo "    make kill-ports     Free ports 8000, 3000, 3001"
	@echo ""
	@echo "  \033[1mDOCS\033[0m"
	@echo "    make docs-build     Build MkDocs site  →  ./site/"
	@echo "    make docs-serve     Serve MkDocs (live) →  http://localhost:8001"
	@echo "    make docs-clean     Remove generated ./site/"
	@echo ""
	@echo "  \033[1mDJANGO UTILS\033[0m"
	@echo "    make migrate        Apply pending migrations"
	@echo "    make migrations     Create new migration files"
	@echo "    make shell          Open Django interactive shell"
	@echo "    make reset-dev-db   Reset local SQLite DB (development only)"
	@echo "    make seed           Load sample heritage data"
	@echo "    make seed-reset     Flush DB and re-seed from scratch"
	@echo ""
	@echo "  \033[1mDOCKER\033[0m"
	@echo "    make docker-up      Start all services"
	@echo "    make docker-down    Stop all services"
	@echo "    make docker-build   Build Docker images"
	@echo "    make docker-logs    Tail logs from all containers"
	@echo "    make docker-ps      List running containers"
	@echo "    make docker-shell   Django shell inside container"
	@echo "    make docker-migrate Run migrations inside container"
	@echo ""
	@echo "  \033[1mPRODUCTION\033[0m"
	@echo "    make prod-up        Start production services"
	@echo "    make prod-down      Stop production services"
	@echo "    make prod-build     Build production images"
	@echo "    make prod-logs      View production logs"
	@echo ""
	@echo "  \033[1mAUTHENTICATION\033[0m  (Next.js uses Google sign-in only)"
	@echo "    make auth-setup     Write .env.local with Google OAuth (+ NextAuth)"
	@echo "    make auth-google    Alias for auth-setup"
	@echo "    make auth-status    Show whether Google OAuth vars are present"
	@echo ""
	@echo "  \033[1mCLEANUP\033[0m"
	@echo "    make backup         Backup PostgreSQL (Docker)"
	@echo "    make restore        Restore PostgreSQL  FILE=backups/xxx.sql.gz"
	@echo "    make clean          Remove all Docker containers, volumes & images"
	@echo "    make prune          Free disk space (Docker system prune)"
	@echo ""

# ================================================================
# FIRST TIME SETUP
# ================================================================
$(VENV_PY):
	@echo "==> Creating Python virtual environment..."
	uv venv $(VENV_DIR) --python 3.11

setup: $(VENV_PY) ## Install all deps, create venv, run migrations
	@echo "==> Installing Python packages..."
	uv pip install -r $(BACKEND)/requirements.txt --python $(VENV_PY)
	@echo "==> Running Django migrations..."
	@# Dev uses SQLite by default. If an old db.sqlite3 exists, it can contain
	@# migration history from a previous auth/user-model configuration and break migrate.
	@if [ -f "$(BACKEND)/db.sqlite3" ]; then \
		backup="$(BACKEND)/db.sqlite3.bak-$$(date +%Y%m%d-%H%M%S)"; \
		echo "==> Found existing $(BACKEND)/db.sqlite3"; \
		echo "==> Backing it up to $$backup (then creating a fresh dev DB)..."; \
		mv "$(BACKEND)/db.sqlite3" "$$backup"; \
	fi
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate
	@echo "==> Installing frontend packages..."
	cd $(FRONTEND) && $(NODE_PATH) npm ci
	@echo "==> Installing landing page packages..."
	cd $(LANDING) && $(NODE_PATH) npm install
	@echo ""
	@echo "  Done!  Next:"
	@echo "    make superuser   — create an admin login"
	@echo "    make dev-local   — see URLs for backend + app + landing"
	@echo "    make backend     — Django (terminal 1)"
	@echo "    make frontend    — main UI (terminal 2)"
	@echo "    make landing     — marketing site (terminal 3, optional)"
	@echo ""

superuser: $(VENV_PY) ## Create a Django admin login
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py createsuperuser

# ================================================================
# DAILY USE
# ================================================================
backend: $(VENV_PY) ## Start Django dev server on http://localhost:8000
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py runserver 0.0.0.0:8000

frontend: ## Start main Next.js app on http://localhost:3000
	cd $(FRONTEND) && $(NODE_PATH) NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev

museum-backend: $(VENV_PY) ## Django for Heritage Museum (local KG + remote LUX reads)
	cd $(BACKEND) && DJANGO_ENV=development \
		RDF_LUX_QUERY_URL=$${RDF_LUX_QUERY_URL:-https://semihyumusak.com.tr/oxigraph/query} \
		RDF_LUX_LABEL_MATCH_LIMIT=$${RDF_LUX_LABEL_MATCH_LIMIT:-8} \
		../$(VENV_PY) manage.py runserver 0.0.0.0:8000

museum-frontend: ## Next.js for Heritage Museum on http://localhost:3000
	cd $(FRONTEND) && $(NODE_PATH) NEXT_PUBLIC_API_URL=http://localhost:8000 \
		npx next dev -H 127.0.0.1 -p 3000

museum-dev: ## Show Heritage Museum dev URLs (run museum-backend + museum-frontend in two terminals)
	@echo ""
	@echo "  Heritage Museum — local visualization"
	@echo "  ====================================="
	@echo "    Terminal 1:  make museum-backend"
	@echo "    Terminal 2:  make museum-frontend"
	@echo ""
	@echo "    Museum UI:   http://localhost:3000/heritage-museum"
	@echo "    API graph:   http://localhost:8000/api/v1/cidoc/kg/graph/?include_lux=linked"
	@echo ""
	@echo "  In the museum toolbar: switch Data source → Live, then explore the graph."
	@echo "  Demo mode works without sign-in; Live uses your local curated KG + linked Yale LUX."
	@echo ""

landing: ## Start marketing landing on http://localhost:3001 (links to app on :3000)
	cd $(LANDING) && $(NODE_PATH) NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run dev

landing-install: ## npm install inside heritage_graph_landing only
	cd $(LANDING) && $(NODE_PATH) npm install

dev-local: ## Show local dev URLs and env hints
	@echo ""
	@echo "  HeritageGraph — local development"
	@echo "  =================================="
	@echo "    Backend (Django):     http://localhost:8000     make backend"
	@echo "    Main app (dashboard): http://localhost:3000     make frontend"
	@echo "    Landing (marketing): http://localhost:3001    make landing"
	@echo ""
	@echo "  Landing needs NEXT_PUBLIC_APP_URL (default in \`make landing\` is http://localhost:3000)."
	@echo "  Copy $(LANDING)/.env.example → $(LANDING)/.env.local if you override ports or hosts."
	@echo "  With Docker + Traefik: landing → http://landing.localhost , app → http://frontend.localhost"
	@echo ""

# ================================================================
# DOCS
# ================================================================
docs-build: $(VENV_PY) ## Build MkDocs site locally (output -> site/)
	@echo "==> Building MkDocs site to ./site"
	$(VENV_PY) -m mkdocs build

docs-serve: $(VENV_PY) ## Serve MkDocs locally for live dev (http://localhost:8001)
	@echo "==> Serving MkDocs (live) on http://localhost:8001"
	$(VENV_PY) -m mkdocs serve -a 0.0.0.0:8001

docs-clean: ## Remove generated site/ directory
	@echo "==> Removing ./site directory"
	rm -rf site/

kill-ports: ## Kill any process on ports 8000, 3000, and 3001
	@lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "  ✓ port 8000 cleared" || echo "  — port 8000 was free"
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✓ port 3000 cleared" || echo "  — port 3000 was free"
	@lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "  ✓ port 3001 cleared" || echo "  — port 3001 was free"

# ================================================================
# DJANGO UTILS
# ================================================================
migrate: $(VENV_PY) ## Apply pending Django migrations
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate

reset-dev-db: ## Reset local SQLite db (development only) by backing up db.sqlite3
	@mkdir -p $(BACKEND)
	@if [ -f "$(BACKEND)/db.sqlite3" ]; then \
		backup="$(BACKEND)/db.sqlite3.bak-$$(date +%Y%m%d-%H%M%S)"; \
		echo "==> Backing up $(BACKEND)/db.sqlite3 to $$backup"; \
		mv "$(BACKEND)/db.sqlite3" "$$backup"; \
	else \
		echo "==> No $(BACKEND)/db.sqlite3 found (nothing to reset)"; \
	fi
	@echo "==> Running migrations to create a fresh dev DB..."
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate

migrations: $(VENV_PY) ## Create new Django migration files
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py makemigrations

shell: $(VENV_PY) ## Open Django interactive shell
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py shell

seed: $(VENV_PY) ## Load sample heritage data from CSV fixtures
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py seed_db

seed-reset: $(VENV_PY) ## Flush DB then re-seed from scratch
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py seed_db --flush

# ================================================================
# DOCKER
# ================================================================
docker-build: ## Build all Docker images
	docker-compose build

docker-up: ## Start all services in Docker
	docker-compose up -d

docker-up-build: ## Rebuild images and start all services
	docker-compose up -d --build

docker-down: ## Stop all Docker services
	docker-compose down

docker-logs: ## Tail logs from all Docker containers
	docker-compose logs -f

docker-ps: ## List running Docker containers
	docker-compose ps

docker-shell: ## Open Django shell inside backend container
	docker-compose exec backend python manage.py shell

docker-migrate: ## Run migrations inside backend container
	docker-compose exec backend python manage.py migrate

# ================================================================
# PRODUCTION
# ================================================================
prod-up: ## Start production services
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down: ## Stop production services
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-build: ## Build production images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-logs: ## View production logs
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# ================================================================
# AUTHENTICATION — Provider Management
# ================================================================
# Creates / updates .env.local in heritage_graph_ui/ for OAuth config.
# Google OAuth is the primary (required) auth provider.
# GitHub OAuth is a secondary provider (ready for later use).
#
# Google mode (default): Google OAuth → Google ID token
# All mode:              Google + GitHub, user picks on sign-in page
# ================================================================

FRONTEND_ENV := $(FRONTEND)/.env.local

# Helper: ensure NEXTAUTH basics exist
define ensure_nextauth_base
	@grep -q '^NEXTAUTH_URL=' $(FRONTEND_ENV) 2>/dev/null || echo 'NEXTAUTH_URL=http://localhost:3000' >> $(FRONTEND_ENV)
	@grep -q '^NEXTAUTH_SECRET=' $(FRONTEND_ENV) 2>/dev/null || echo "NEXTAUTH_SECRET=$$(openssl rand -base64 32)" >> $(FRONTEND_ENV)
	@grep -q '^NEXT_PUBLIC_API_URL=' $(FRONTEND_ENV) 2>/dev/null || echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' >> $(FRONTEND_ENV)
	@grep -q '^INTERNAL_BACKEND_URL=' $(FRONTEND_ENV) 2>/dev/null || echo 'INTERNAL_BACKEND_URL=http://localhost:8000' >> $(FRONTEND_ENV)
endef

auth-dev: ## Removed — use auth-setup (Google required for /auth/login)
	@echo ""
	@echo "  The Next.js app signs users in with Google only."
	@echo "  Run: make auth-setup GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=..."
	@echo "  Django API testing can still use POST /api/token/ (JWT)."
	@echo ""
	@exit 1

auth-google: auth-setup ## Alias for auth-setup (Google OAuth)

auth-github: ## Removed — frontend no longer registers GitHub with NextAuth
	@echo ""
	@echo "  GitHub OAuth is not enabled in heritage_graph_ui. Use Google (make auth-setup)."
	@echo ""
	@exit 1

auth-all: ## Same as auth-setup (GitHub combo target retained for old scripts)
	@if [ -n "$(GITHUB_ID)" ] || [ -n "$(GITHUB_SECRET)" ]; then \
		echo "Note: GITHUB_* is ignored — the UI uses Google sign-in only."; \
	fi
	@$(MAKE) auth-setup GOOGLE_CLIENT_ID=$(GOOGLE_CLIENT_ID) GOOGLE_CLIENT_SECRET=$(GOOGLE_CLIENT_SECRET)

auth-setup: ## Configure Google OAuth (primary auth — REQUIRED)
	@echo "==> Configuring Google OAuth (primary auth)..."
	@if [ -z "$(GOOGLE_CLIENT_ID)" ] || [ -z "$(GOOGLE_CLIENT_SECRET)" ]; then \
		echo ""; \
		echo "  Usage: make auth-setup GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy"; \
		echo ""; \
		echo "  Get credentials from: https://console.cloud.google.com/apis/credentials"; \
		echo "  Set callback URL to:  http://localhost:3000/api/auth/callback/google"; \
		echo ""; \
		exit 1; \
	fi
	@rm -f $(FRONTEND_ENV)
	@echo '# Auth: Google OAuth (primary)' > $(FRONTEND_ENV)
	@echo 'NEXTAUTH_URL=http://localhost:3000' >> $(FRONTEND_ENV)
	@echo "NEXTAUTH_SECRET=$$(openssl rand -base64 32)" >> $(FRONTEND_ENV)
	@echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' >> $(FRONTEND_ENV)
	@echo 'INTERNAL_BACKEND_URL=http://localhost:8000' >> $(FRONTEND_ENV)
	@echo "GOOGLE_CLIENT_ID=$(GOOGLE_CLIENT_ID)" >> $(FRONTEND_ENV)
	@echo "GOOGLE_CLIENT_SECRET=$(GOOGLE_CLIENT_SECRET)" >> $(FRONTEND_ENV)
	@echo ""
	@echo "  ✓ Auth: Google OAuth configured"
	@echo "  Also set GOOGLE_CLIENT_ID in heritage_graph/.env for backend verification"
	@echo ""

auth-add-github: auth-github ## Deprecated alias

auth-status: ## Show Google OAuth configuration in frontend .env.local
	@echo ""
	@echo "  Auth (Next.js — Google only)"
	@echo "  ============================"
	@if [ -f $(FRONTEND_ENV) ]; then \
		echo "  Frontend env: $(FRONTEND_ENV)"; \
		if grep -q '^GOOGLE_CLIENT_ID=' $(FRONTEND_ENV) 2>/dev/null; then \
			echo "  ✓ Google OAuth:  configured"; \
		else \
			echo "  ✗ Google OAuth:  missing — run 'make auth-setup'"; \
		fi; \
	else \
		echo "  No .env.local — run 'make auth-setup'"; \
	fi
	@echo ""

# ================================================================
# BACKUP / RESTORE (Docker PostgreSQL)
# ================================================================
backup: ## Backup PostgreSQL database
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U heritage_user heritage_db | gzip > backups/db-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "Backup saved to backups/"

restore: ## Restore database  usage: make restore FILE=backups/db-xxx.sql.gz
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backups/db-xxx.sql.gz"; exit 1; fi
	gunzip < $(FILE) | docker-compose exec -T postgres psql -U heritage_user -d heritage_db
	@echo "Restored from $(FILE)"

# ================================================================
# CLEANUP
# ================================================================
clean: ## Remove all Docker containers, volumes and images
	docker-compose down -v --rmi all
	@echo "All Docker resources removed."

prune: ## Free disk space with Docker system prune
	docker system prune -af
	docker volume prune -f
	@echo "Docker pruned."
