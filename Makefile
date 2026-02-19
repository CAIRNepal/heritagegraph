# ================================================================
# HeritageGraph Makefile
# ================================================================
# Convenience commands for development and deployment.
# Run `make help` to see available commands.
# ================================================================

.PHONY: help build up down restart logs ps shell-backend shell-frontend migrate collectstatic createsuperuser backup restore clean prod-up prod-down lint test

# Default target
.DEFAULT_GOAL := help

# ================================================================
# HELP
# ================================================================
help: ## Show this help message
	@echo ""
	@echo "HeritageGraph - Available Commands"
	@echo "=================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

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
