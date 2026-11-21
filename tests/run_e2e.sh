#!/usr/bin/env bash
# Run platform E2E tests from repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV_PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$VENV_PY" ]]; then
  VENV_PY="$(command -v python3)"
fi

export DJANGO_ENV="${DJANGO_ENV:-development}"
export RDF_SYNC_ENABLED="${RDF_SYNC_ENABLED:-true}"
export PYTHONPATH="${ROOT}:${ROOT}/heritage_graph:${PYTHONPATH:-}"

exec "$VENV_PY" "${ROOT}/tests/run_platform_e2e.py" "$@"
