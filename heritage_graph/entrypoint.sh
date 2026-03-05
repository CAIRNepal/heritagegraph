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
while ! python -c "import django; django.setup(); from django.db import connection; connection.ensure_connection()" 2>&1; do
    retry_count=$((retry_count + 1))
    if [ $retry_count -ge $max_retries ]; then
        log_error "Failed to connect to database after $max_retries attempts. Exiting."
        exit 1
    fi
    log_warn "Database connection failed (attempt $retry_count/$max_retries). Retrying in 5 seconds..."
    sleep 5
done
log_info "Database is ready!"

# ================================================================
# Run database migrations
# ================================================================
log_info "Running database migrations..."
python manage.py migrate --noinput
if [ $? -eq 0 ]; then
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
    python manage.py collectstatic --noinput --clear
    if [ $? -eq 0 ]; then
        log_info "Static files collected successfully."
    else
        log_warn "Static files collection had warnings, but continuing..."
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

