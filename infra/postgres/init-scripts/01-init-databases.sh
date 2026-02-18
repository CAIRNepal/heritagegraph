#!/bin/bash
# ================================================================
# PostgreSQL Init Script
# ================================================================
# Creates additional databases needed by the application.
# This script runs automatically when the PostgreSQL container
# starts for the first time.
# ================================================================

set -e

# Create heritage_db for Django if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create heritage database for Django
    SELECT 'CREATE DATABASE heritage_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'heritage_db')\gexec

    -- Create heritage user if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heritage_user') THEN
            CREATE USER heritage_user WITH PASSWORD 'changeme';
        END IF;
    END
    \$\$;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE heritage_db TO heritage_user;
    GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

    -- Log completion
    SELECT 'Database initialization completed successfully.' AS status;
EOSQL

echo "============================================"
echo "PostgreSQL databases initialized successfully"
echo "============================================"
