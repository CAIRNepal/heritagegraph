# ================================================================
# HeritageGraph Makefile
# ================================================================
# Convenience commands for development and deployment.
# Run `make help` to see available commands.
# ================================================================

.PHONY: help build up down restart logs ps shell-backend shell-frontend migrate collectstatic createsuperuser backup restore clean prod-up prod-down lint test dev dev-backend dev-frontend dev-setup dev-migrate dev-superuser

# Default target
.DEFAULT_GOAL := help

# ================================================================
# PATHS & TOOLS
# ================================================================
# Virtual environment — all dev commands use this Python, not the system one.
VENV_DIR   := .venv
VENV_PY    := $(VENV_DIR)/bin/python
VENV_PIP   := $(VENV_PY) -m pip
BACKEND    := heritage_graph
FRONTEND   := heritage_graph_ui

# ================================================================
# HELP
# ================================================================
help: ## Show this help message
	@echo ""
	@echo "HeritageGraph - Available Commands"
	@echo "=================================="
	@echo ""
	@echo "  LOCAL DEVELOPMENT (no Docker needed):"
	@grep -E '^dev[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[32m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  DOCKER (containerized):"
	@grep -E '^(build|up|down|restart|logs|ps|shell|migrate|makemig|collect|create|prod|backup|restore|clean|prune|setup|health)[a-zA-Z_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ================================================================
# LOCAL DEVELOPMENT (no Docker, SQLite, session auth)
# ================================================================
# These commands run Django + Next.js directly on your machine.
# Uses .venv, SQLite, and session/JWT auth — no Google OAuth or
# PostgreSQL needed.
#
# Quick start:
#   make dev-setup      (once — creates venv, installs deps, migrates)
#   make dev-superuser  (once — creates a login)
#   make dev-backend    (terminal 1)
#   make dev-frontend   (terminal 2)
# ================================================================

# Ensure the venv exists (idempotent)
$(VENV_PY):
	@echo "Creating virtual environment in $(VENV_DIR)..."
	uv venv $(VENV_DIR) --python 3.11
	@echo ""

dev-setup: $(VENV_PY) ## Initial dev setup: create venv, install deps, migrate
	@echo "=== Setting up development environment ==="
	@echo ""
	@echo "1. Installing Python dependencies into $(VENV_DIR)..."
	uv pip install -r $(BACKEND)/requirements.txt --python $(VENV_PY)
	@echo ""
	@echo "2. Running migrations (SQLite)..."
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate
	@echo ""
	@echo "3. Installing frontend dependencies..."
	cd $(FRONTEND) && pnpm install
	@echo ""
	@echo "=== Setup complete! ==="
	@echo ""
	@echo "Next steps:"
	@echo "  make dev-superuser   (create a login)"
	@echo "  make dev-backend     (start Django in terminal 1)"
	@echo "  make dev-frontend    (start Next.js in terminal 2)"
	@echo ""

dev-migrate: $(VENV_PY) ## Run Django migrations (SQLite dev database)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py migrate

dev-makemigrations: $(VENV_PY) ## Create new Django migrations (dev)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py makemigrations

dev-superuser: $(VENV_PY) ## Create a Django superuser for local dev
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py createsuperuser

dev-backend: $(VENV_PY) ## Start Django dev server (port 8000, SQLite, session auth)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py runserver 0.0.0.0:8000

dev-frontend: ## Start Next.js dev server (port 3000, Turbopack)
	cd $(FRONTEND) && NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm dev

dev: ## Start backend + frontend (run in separate terminals instead)
	@echo "=== HeritageGraph — Development Mode ==="
	@echo ""
	@echo "  Backend:  http://localhost:8000  (Django + SQLite)"
	@echo "  Admin:    http://localhost:8000/admin/"
	@echo "  API Docs: http://localhost:8000/docs"
	@echo "  Frontend: http://localhost:3000  (Next.js + Turbopack)"
	@echo ""
	@echo "  Auth: Login at /admin/ or POST /api/token/ {username, password}"
	@echo "  No Google OAuth needed in dev mode."
	@echo ""
	@echo "TIP: Run these in two separate terminals for best experience:"
	@echo "  Terminal 1:  make dev-backend"
	@echo "  Terminal 2:  make dev-frontend"
	@echo ""

dev-shell: $(VENV_PY) ## Open Django shell (dev)
	cd $(BACKEND) && DJANGO_ENV=development ../$(VENV_PY) manage.py shell

# ================================================================
# DEVELOPMENT
# ================================================================
build: ## Build all Docker images
	docker-compose build

up: ## Start all services (development)
	docker-compose up -d

up-build: ## Build and start all services
	docker-compose up -d --build

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## View logs for all services (follow mode)
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-frontend: ## View frontend logs
	docker-compose logs -f frontend

logs-traefik: ## View traefik logs
	docker-compose logs -f traefik

ps: ## Show running services
	docker-compose ps

# ================================================================
# BACKEND COMMANDS
# ================================================================
shell-backend: ## Open Django shell in backend container
	docker-compose exec backend python manage.py shell

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U heritage_user -d heritage_db

migrate: ## Run Django database migrations
	docker-compose exec backend python manage.py migrate

makemigrations: ## Create new Django migrations
	docker-compose exec backend python manage.py makemigrations

collectstatic: ## Collect Django static files
	docker-compose exec backend python manage.py collectstatic --noinput

createsuperuser: ## Create Django superuser
	docker-compose exec backend python manage.py createsuperuser

# ================================================================
# FRONTEND COMMANDS
# ================================================================
shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

# ================================================================
# PRODUCTION
# ================================================================
prod-up: ## Start all services (production mode)
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down: ## Stop production services
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-build: ## Build production images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-logs: ## View production logs
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

prod-ps: ## Show production services status
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

prod-restart: ## Restart production services
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart

# ================================================================
# DATABASE
# ================================================================
backup: ## Backup PostgreSQL database
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U heritage_user heritage_db | gzip > backups/db-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "Backup saved to backups/"

restore: ## Restore database from backup (usage: make restore FILE=backups/db-xxx.sql.gz)
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backups/db-xxx.sql.gz"; exit 1; fi
	gunzip < $(FILE) | docker-compose exec -T postgres psql -U heritage_user -d heritage_db
	@echo "Database restored from $(FILE)"

# ================================================================
# HEALTH CHECKS
# ================================================================
health: ## Check health of all services
	@echo "=== Service Health ==="
	@echo "Backend:"
	@curl -sf http://backend.localhost/health/ 2>/dev/null && echo " ✓ Healthy" || echo " ✗ Unhealthy"
	@echo "Frontend:"
	@curl -sf http://frontend.localhost 2>/dev/null && echo " ✓ Healthy" || echo " ✗ Unhealthy"
	@echo "PostgreSQL:"
	@docker-compose exec -T postgres pg_isready -U heritage_user 2>/dev/null && echo " ✓ Healthy" || echo " ✗ Unhealthy"

# ================================================================
# SETUP
# ================================================================
setup: ## Initial setup (copy env, build, start)
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example"; fi
	@echo "Building and starting services..."
	docker-compose up -d --build
	@echo ""
	@echo "=== HeritageGraph is starting! ==="
	@echo "Frontend:  http://frontend.localhost"
	@echo "Backend:   http://backend.localhost"
	@echo "Dashboard: http://traefik.localhost:8080"
	@echo ""

# ================================================================
# CLEANUP
# ================================================================
clean: ## Remove all containers, volumes, and images
	docker-compose down -v --rmi all
	@echo "Cleaned up all Docker resources"

clean-volumes: ## Remove data volumes only (WARNING: deletes data)
	docker-compose down -v
	@echo "Volumes removed"

prune: ## Docker system prune (free disk space)
	docker system prune -af
	docker volume prune -f
	@echo "Docker system pruned"
