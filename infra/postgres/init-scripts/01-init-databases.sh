#!/bin/bash
# ================================================================
# PostgreSQL Init Script
# ================================================================
# Creates additional databases needed by the application.
# This script runs automatically when the PostgreSQL container
# starts for the first time.
# ================================================================

set -e

# Use env var for heritage_user password, fall back to 'changeme'
HERITAGE_PW="${HERITAGE_DB_PASSWORD:-changeme}"

# Create heritage_db for Django if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create heritage database for Django
    SELECT 'CREATE DATABASE heritage_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'heritage_db')\gexec

    -- Create heritage user if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heritage_user') THEN
            CREATE USER heritage_user WITH PASSWORD '${HERITAGE_PW}';
        END IF;
    END
    \$\$;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE heritage_db TO heritage_user;
    GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;

    -- Log completion
    SELECT 'Database initialization completed successfully.' AS status;
EOSQL

# In PostgreSQL 15+, GRANT ALL ON DATABASE no longer includes schema CREATE.
# We must connect to heritage_db and grant schema usage + create permissions.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "heritage_db" <<-EOSQL
    GRANT ALL ON SCHEMA public TO heritage_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO heritage_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO heritage_user;
EOSQL

echo "============================================"
echo "PostgreSQL databases initialized successfully"
echo "============================================"
