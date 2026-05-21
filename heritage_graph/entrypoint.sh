#!/bin/bash
# ================================================================
# Django Entrypoint Script
# ================================================================
# This script runs database migrations and initializes the Django
# application before starting the server.
# ================================================================

set -e  # Exit on error

# ================================================================
# Logging helpers
# ================================================================
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

log_warn() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [WARN] $1"
}

# ================================================================
# Load .env if present
# ================================================================
if [ -f .env ]; then
    log_info "Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# ================================================================
# Wait for database to be ready
# ================================================================
log_info "Waiting for database to be available..."
max_retries=30
retry_count=0

_db_engine_normalized=$(echo "${DB_ENGINE:-}" | tr '[:upper:]' '[:lower:]')
_use_pg_isready=0

if echo "$_db_engine_normalized" | grep -q 'sqlite'; then
    _use_pg_isready=0
elif echo "$_db_engine_normalized" | grep -Eq 'postgresql|postgis'; then
    _use_pg_isready=1
elif [ -z "$_db_engine_normalized" ] && [ -n "${DB_HOST:-}" ]; then
    # Common Docker layout: Postgres host set but DB_ENGINE injected only in base compose
    _use_pg_isready=1
fi

if [ "$_use_pg_isready" = "1" ]; then
    _db_host="${DB_HOST:-localhost}"
    _db_port="${DB_PORT:-5432}"
    _db_user="${DB_USER:-postgres}"
    while true; do
        if pg_isready -h "$_db_host" -p "$_db_port" -U "$_db_user" >/dev/null 2>&1; then
            log_info "PostgreSQL is accepting connections (${_db_host}:${_db_port})."
            break
        fi
        retry_count=$((retry_count + 1))
        if [ "$retry_count" -ge "$max_retries" ]; then
            log_error "PostgreSQL did not become ready after $max_retries attempts (${_db_host}:${_db_port}). Exiting."
            exit 1
        fi
        log_warn "PostgreSQL not ready (attempt $retry_count/$max_retries). Retrying in 5 seconds..."
        sleep 5
    done
else
    log_info "Non-PostgreSQL engine (or no DB_HOST): running Django bootstrap once (misconfigurations exit immediately)."
    if ! bootstrap_out="$(python -c "import django; django.setup()" 2>&1)"; then
        log_error "Django bootstrap failed during django.setup() — this may be GDAL/settings/import errors, not the database socket. Details:"
        echo "$bootstrap_out" >&2
        exit 1
    fi
    log_info "Django bootstrap OK."
fi

# ================================================================
# Run database migrations
# ================================================================
if [ "${MIGRATION_AUTO_REPAIR:-0}" = "1" ] || [ "${MIGRATION_AUTO_REPAIR:-}" = "true" ]; then
    log_info "MIGRATION_AUTO_REPAIR enabled: checking for admin/users migration order issues..."
    python manage.py repair_migration_history || log_warn "repair_migration_history failed; migrate may still error."
fi
log_info "Running database migrations..."
if python manage.py migrate --noinput; then
    log_info "Database migrations completed successfully."
else
    log_error "Database migrations failed!"
    exit 1
fi

# ================================================================
# Collect static files (production only)
# ================================================================
if [ "${DEBUG}" = "False" ] || [ "${DEBUG}" = "false" ]; then
    log_info "Collecting static files for production..."
    if python manage.py collectstatic --noinput --clear; then
        log_info "Static files collected successfully."
    else
        log_warn "Static files collection failed or had warnings; continuing startup."
    fi
fi

# ================================================================
# Create superuser if credentials are provided
# ================================================================
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    log_info "Checking if superuser exists..."
    python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username="$DJANGO_SUPERUSER_USERNAME").exists():
    User.objects.create_superuser(
        "$DJANGO_SUPERUSER_USERNAME",
        "$DJANGO_SUPERUSER_EMAIL",
        "$DJANGO_SUPERUSER_PASSWORD"
    )
    print("✓ Superuser created successfully.")
else:
    print("✓ Superuser already exists.")
EOF
else
    log_warn "Superuser credentials not provided. Skipping superuser creation."
fi

# ================================================================
# Create health check endpoint (if not already exists)
# ================================================================
log_info "Ensuring health check endpoint is available..."
python manage.py shell <<EOF
from django.urls import reverse
try:
    reverse('health')
    print("✓ Health check endpoint is available.")
except:
    print("⚠ Health check endpoint may not be configured. Consider adding it for production.")
EOF

# ================================================================
# Start the application
# ================================================================
log_info "Starting Django application..."
log_info "Command: $@"
exec "$@"

