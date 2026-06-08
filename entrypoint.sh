#!/bin/sh
set -e

#!/bin/sh
set -e

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

python manage.py migrate --noinput

if [ -z "$DJANGO_SUPERUSER_USERNAME" ] || [ -z "$DJANGO_SUPERUSER_EMAIL" ] || [ -z "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Superuser env vars not set. Skipping superuser creation."
else
  echo "Creating superuser if it does not exist..."
  python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username="$DJANGO_SUPERUSER_USERNAME").exists():
    User.objects.create_superuser(
        "$DJANGO_SUPERUSER_USERNAME",
        "$DJANGO_SUPERUSER_EMAIL",
        "$DJANGO_SUPERUSER_PASSWORD"
    )
    print("Superuser created.")
else:
    print("Superuser already exists.")
EOF
fi

# ── Knowledge-graph triplestore bootstrap ──────────────────────────────────
# A fresh Oxigraph volume starts empty, so the live Heritage Museum
# (/api/v1/cidoc/kg/graph/) returns nothing until the public graph is projected
# from PostgreSQL. Load the TBox (idempotent) and rebuild the public graph only
# if it is empty (--if-empty). This is a no-op on subsequent boots once the
# store is populated. Failures here must NEVER block API startup — the data
# lives in PostgreSQL and can always be re-projected later.
if [ "${RDF_SYNC_ENABLED:-true}" = "true" ]; then
  OX_URL="${OXIGRAPH_URL:-http://oxigraph:7878}"
  echo "Waiting for Oxigraph at ${OX_URL} (up to 30s)..."
  i=0
  until curl -sf -o /dev/null "${OX_URL}/query?query=ASK%7B%7D" || [ "$i" -ge 30 ]; do
    i=$((i + 1)); sleep 1
  done
  echo "Bootstrapping RDF triplestore (TBox + public graph if empty)..."
  python manage.py rdf_load_tbox || echo "rdf_load_tbox failed (continuing; data is safe in PostgreSQL)."
  python manage.py rdf_rebuild --if-empty || echo "rdf_rebuild failed (continuing; data is safe in PostgreSQL)."
else
  echo "RDF_SYNC_ENABLED is not 'true'; skipping triplestore bootstrap."
fi

exec "$@"
