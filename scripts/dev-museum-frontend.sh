#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"
cd "$ROOT/heritage_graph_ui"
exec npx next dev -H 127.0.0.1 -p 3000
