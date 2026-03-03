# ================================================================
# HeritageGraph Makefile
# ================================================================
# Run `make` or `make help` to see all commands.
# ================================================================

.PHONY: help setup superuser backend frontend kill-ports \
        migrate migrations shell seed seed-reset \
        docker-up docker-up-build docker-down docker-build \
        docker-logs docker-ps docker-shell docker-migrate \
        prod-up prod-down prod-build prod-logs \
        backup restore clean prune

.DEFAULT_GOAL := help

# ================================================================
# PATHS
# ================================================================
VENV_DIR  := .venv
VENV_PY   := $(VENV_DIR)/bin/python
BACKEND   := heritage_graph
FRONTEND  := heritage_graph_ui

# Node — resolved from mise or system PATH
MISE_NODE := $(HOME)/.local/share/mise/installs/node/22.22.0/bin
NODE_BIN  := $(shell test -f $(MISE_NODE)/node && echo $(MISE_NODE) || dirname $$(which node 2>/dev/null || echo /usr/bin/node))
PNPM      := $(NODE_BIN)/pnpm
NODE_PATH := PATH=$(NODE_BIN):$$PATH

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
	@echo "  \033[1mDAILY USE\033[0m  (open two terminals)"
	@echo "    make backend        Start Django      →  http://localhost:8000"
	@echo "    make frontend       Start Next.js     →  http://localhost:3000"
	@echo "    make kill-ports     Kill processes on ports 8000 & 3000"
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
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate
	@echo "==> Installing frontend packages..."
	cd $(FRONTEND) && $(NODE_PATH) $(PNPM) install
	@echo ""
	@echo "  Done!  Next:"
	@echo "    make superuser   — create an admin login"
	@echo "    make backend     — start Django  (terminal 1)"
	@echo "    make frontend    — start Next.js (terminal 2)"
	@echo ""

superuser: $(VENV_PY) ## Create a Django admin login
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py createsuperuser

# ================================================================
# DAILY USE
# ================================================================
backend: $(VENV_PY) ## Start Django dev server on http://localhost:8000
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py runserver 0.0.0.0:8000

frontend: ## Start Next.js dev server on http://localhost:3000
	cd $(FRONTEND) && $(NODE_PATH) NEXT_PUBLIC_API_URL=http://localhost:8000 $(PNPM) dev

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

kill-ports: ## Kill any process on ports 8000 and 3000
	@lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "  ✓ port 8000 cleared" || echo "  — port 8000 was free"
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✓ port 3000 cleared" || echo "  — port 3000 was free"

# ================================================================
# DJANGO UTILS
# ================================================================
migrate: $(VENV_PY) ## Apply pending Django migrations
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
