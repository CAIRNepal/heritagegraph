#!/usr/bin/env bash
# Start Django + Next.js for Heritage Museum visualization (local curated + remote LUX).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DJANGO_ENV=development
export RDF_LUX_QUERY_URL="${RDF_LUX_QUERY_URL:-https://semihyumusak.com.tr/oxigraph/query}"
export RDF_LUX_LABEL_MATCH_LIMIT="${RDF_LUX_LABEL_MATCH_LIMIT:-8}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

mkdir -p "$ROOT/.dev-logs"

echo "==> Backend  http://localhost:8000"
cd "$ROOT/heritage_graph"
exec ../.venv/bin/python manage.py runserver 0.0.0.0:8000
