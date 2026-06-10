# HeritageGraph Demo Execution Plan
**Status: STOP BUILDING. START FINISHING.**
**Goal: One working demo with real Nepali data. Nothing else ships first.**

---

## The Exact Demo You Are Shipping

A visitor opens the app, logs in with Google, clicks **Knowledge → Monuments**, sees a table of **30+ real Nepali heritage sites** pulled from Wikidata (Pashupatinath, Boudhanath, Swayambhunath, Patan Durbar Square, etc.), clicks one row, sees its detail page, then an instructor runs a live SPARQL query in the terminal that returns those same records from Oxigraph. That is the entire demo. It takes under 3 minutes.

If that is not working, nothing else matters.

---

## Three Blockers Standing Between You and That Demo

### Blocker 1: The Docker Stack Is Not Running

**Evidence:** `docker ps` shows Airflow containers, not HeritageGraph containers.

**Exact fix:**
```bash
cd /home/nabin2004/Desktop/heritagegraph

# Copy the example env if .env doesn't exist
cp .env.example .env 2>/dev/null || true

# Make sure port 8000 is free (Airflow uses 8080 — no conflict)
sudo lsof -i :8000 -i :7878 -i :3000

# Start only the services the demo needs — skip Traefik/Keycloak/Prometheus
docker compose up -d postgres oxigraph backend frontend
```

**Done when:**
```bash
curl -s http://localhost:8000/health/ | python3 -m json.tool
# → {"status": "ok", ...}

curl -s http://localhost:7878/
# → any 200 response (Oxigraph root page)

curl -s http://localhost:3000/ | head -5
# → HTML from Next.js
```

---

### Blocker 2: Only 8 Fake Monument Records Exist

**Evidence:** `wc -l heritage_graph/fixtures/monuments.csv` → 9 lines (header + 8 rows). The data is hand-written placeholder text, not real Wikidata records.

**Exact fix:** Run the seed script in Section 4 of this document. It fetches 35 real Nepali heritage sites from `query.wikidata.org`, writes them to `heritage_graph/fixtures/monuments.csv` and `structures.csv`, then loads them into Django.

**Done when:**
```bash
docker compose exec backend python manage.py shell -c \
  "from apps.cidoc_data.models import Monument; print(Monument.objects.count())"
# → 35 or more
```

---

### Blocker 3: RDF_SYNC_ENABLED=false — Oxigraph Is Empty

**Evidence:** `grep RDF_SYNC_ENABLED heritage_graph/settings/base.py` → defaults to `false`. The SPARQL endpoint at `/cidoc/sparql/` will return zero results even after seeding.

**Exact fix:** Add two lines to the `backend` service in `docker-compose.yml` under `environment:`:
```yaml
RDF_SYNC_ENABLED: "true"
RDF_ENDPOINT_URL: "http://oxigraph:7878"
```
Then run the triplestore rebuild:
```bash
docker compose up -d --force-recreate backend
docker compose exec backend python manage.py rebuild_triplestore
```

**Done when:**
```bash
curl -s -G http://localhost:8000/cidoc/sparql/ \
  --data-urlencode "query=SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }" \
  | python3 -m json.tool
# → "n": {"value": "90+", ...}
```

---

## Stop Doing This Until The Demo Ships

The following files, features, and concerns are **frozen**. Do not open them, do not fix them, do not think about them.

**Apps — do not touch:**
- `heritage_graph/apps/assistant/` — the AI chat assistant
- `heritage_graph/apps/document_processing/` — OCR pipeline
- Everything touching `identity_services`, `EntityCluster`, `IdentityCandidate`

**Frontend pages — do not touch:** *(routes below used `/dashboard/` prefix historically; current app uses site-root paths, e.g. `/contribute/`, `/curation/review/`, `/graphview/`, `/atlas/` — see `ARCHITECTURE.md`)*
- `/contribute/` (all contribute routes)
- `/curation/review/`
- `/moderate/` (legacy)
- `/leaderboard/`
- `/progression/`
- `/graphview/`
- `/atlas/` (Cesium 3D globe)
- `/community/`

**Infrastructure — do not touch:**
- `docker-compose-coolify.yml`
- `docker-compose-dokploy.yml`
- `docker-compose.fuseki.yml`
- `Dockerfile.keycloak`
- `keycloak/` directory
- `infra/traefik/` — Traefik config is fine as-is

**Tools — do not touch:**
- `tools/generate_relation_backrefs.py`
- `tools/generate_serializers.py`
- `tools/emit_minimal_shacl.py`
- `tools/linkml_generate_registry.py`
- `heritage_graph/apps/cidoc_data/shacl_validate.py`

**Documentation — do not open:**
- `ARCHITECTURE.md`, `AGENTS.md`, `SKILLS.md`, `API_VERSIONING.md`, `AUTH.md`,
  `AUTH_GUIDE.md`, `CACHE.md`, `CONVENTIONS.md`, `FORMS.md`, `FUSEKI.md`,
  `OCR_PIPELINE.md`, `TRANSLATION.md`, `TROUBLESHOOTING.md`,
  `UI_UX_AUDIT_ALL_PAGES.md`, `NPJ_HS_PAPER_PLAN.md`

---

## Step-by-Step Execution

### Step 0 — Verify the .env file

```bash
# Check that your docker-compose .env has these minimum values
grep -E "POSTGRES_PASSWORD|DJANGO_SECRET_KEY|GOOGLE_CLIENT" .env || \
  echo "MISSING — edit .env before continuing"
```

The `.env` must contain at minimum:
```
POSTGRES_DB=heritage_db
POSTGRES_USER=heritage_user
POSTGRES_PASSWORD=changeme
DJANGO_SECRET_KEY=any-random-50-char-string
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
RDF_SYNC_ENABLED=true
RDF_ENDPOINT_URL=http://oxigraph:7878
RDF_RESOURCE_BASE_URI=https://w3id.org/heritagegraph/resource/
```

**Done when:** `grep RDF_SYNC_ENABLED .env` → `RDF_SYNC_ENABLED=true`

---

### Step 1 — Start the minimal stack

```bash
cd /home/nabin2004/Desktop/heritagegraph
docker compose up -d postgres oxigraph backend frontend
docker compose logs -f backend | grep -m1 "Starting gunicorn\|Listening at"
```

Wait for the backend to say it's listening, then Ctrl-C the log follow.

**Done when:**
```bash
curl -sf http://localhost:8000/health/ > /dev/null && echo "BACKEND UP"
curl -sf http://localhost:7878/ > /dev/null && echo "OXIGRAPH UP"
```
Both print their respective message.

---

### Step 2 — Run migrations

```bash
docker compose exec backend python manage.py migrate --run-syncdb
```

**Done when:** last line contains `No migrations to apply.` or a list of applied migrations with no errors.

---

### Step 3 — Fetch real Wikidata data and write fixtures

Save the script below to `/home/nabin2004/Desktop/heritagegraph/scripts/fetch_wikidata_seeds.py` and run it:

```bash
mkdir -p scripts
python3 scripts/fetch_wikidata_seeds.py
```

The script is in **Section 4** of this document.

**Done when:**
```bash
wc -l heritage_graph/fixtures/monuments.csv
# → 36 (header + 35 rows)
```

---

### Step 4 — Load fixtures into Django

```bash
docker compose exec backend python manage.py seed_db --flush
```

**Done when:**
```bash
docker compose exec backend python manage.py shell -c \
  "from apps.cidoc_data.models import Monument,ArchitecturalStructure; \
   print('Monuments:', Monument.objects.count(), \
         '| Structures:', ArchitecturalStructure.objects.count())"
# → Monuments: 35 | Structures: 10+
```

---

### Step 5 — Push data to Oxigraph triplestore

```bash
docker compose exec backend python manage.py rebuild_triplestore
```

**Done when:**
```bash
curl -s -G http://localhost:8000/cidoc/sparql/ \
  --data-urlencode "query=SELECT ?s ?label WHERE { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label } LIMIT 10" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(b['label']['value']) for b in d['results']['bindings']]"
# → prints 10 heritage entity names
```

---

### Step 6 — Verify the frontend shows real data

1. Open `http://localhost:3000` in the browser
2. Sign in with Google
3. Navigate to **Knowledge → Monuments**
4. Confirm the table shows 30+ rows with real names (Pashupatinath, Boudhanath, etc.)

**Done when:** You can see at least 30 rows in the table. No errors in browser console that say `Failed to fetch` or `401 Unauthorized`.

If the table is empty but the API has data, check:
```bash
curl -s http://localhost:8000/cidoc/monuments/?format=json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('count:', d.get('count', len(d)))"
```

---

### Step 7 — Run the live SPARQL demo query

This is the query you run during the demo presentation:

```bash
curl -s -G http://localhost:8000/cidoc/sparql/ \
  --data-urlencode "query=
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT ?entity ?label WHERE {
  ?entity rdf:type ?type ;
          rdfs:label ?label .
}
ORDER BY ?label
LIMIT 30
" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for b in d['results']['bindings']:
    print(b['label']['value'])
print('---')
print('Total results:', len(d['results']['bindings']))
"
```

**Done when:** The output lists 30 real Nepali heritage site names.

---

## Section 4: Wikidata Seed Script

Save this file to `scripts/fetch_wikidata_seeds.py`:

```python
#!/usr/bin/env python3
"""
Fetch ~35 real Nepali cultural heritage sites from Wikidata and write to
heritage_graph/fixtures/monuments.csv (overwriting the placeholder data).

Usage:  python3 scripts/fetch_wikidata_seeds.py
Requires: requests (pip install requests)
"""

import csv
import json
import sys
import time
from pathlib import Path

import requests

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# Fetch Nepali heritage monuments, temples, stupas, palaces, and manuscripts
QUERY = """
SELECT DISTINCT
  ?item ?itemLabel ?itemDescription ?coords ?inception ?wikidataId ?typeLabel
WHERE {
  ?item wdt:P17 wd:Q837 .
  ?item wdt:P31 ?type .
  VALUES ?type {
    wd:Q839954   # archaeological site
    wd:Q44613    # monastery
    wd:Q16560    # palace
    wd:Q570116   # tourist attraction (heritage)
    wd:Q483453   # stupa
    wd:Q24354    # temple
    wd:Q33506    # museum
    wd:Q12280    # bridge (historic)
    wd:Q108325   # pagoda
    wd:Q179049   # shrine
    wd:Q4989906  # monument
    wd:Q1081138  # dharahara (tower)
    wd:Q17515    # UNESCO World Heritage Site
  }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q28640 }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ne" .
  }
  OPTIONAL { ?item wdt:P625 ?coords }
  OPTIONAL { ?item wdt:P571 ?inception }
  BIND(REPLACE(STR(?item), ".*/(Q[0-9]+)$", "$1") AS ?wikidataId)
}
ORDER BY ?itemLabel
LIMIT 60
"""

HEADERS = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "HeritageGraph-Demo-Seeder/1.0 (CAIR-Nepal research project)",
}


def fetch_wikidata() -> list[dict]:
    print("Fetching from Wikidata... (may take 10-15 seconds)")
    resp = requests.get(
        WIKIDATA_SPARQL,
        params={"query": QUERY},
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    bindings = resp.json()["results"]["bindings"]
    print(f"  Got {len(bindings)} results from Wikidata")
    return bindings


def parse_coords(coords_val: str) -> str:
    """Convert 'Point(85.3 27.7)' to '27.7, 85.3'"""
    if not coords_val:
        return ""
    coords_val = coords_val.replace("Point(", "").replace(")", "").strip()
    parts = coords_val.split()
    if len(parts) == 2:
        lng, lat = parts
        return f"{lat}, {lng}"
    return coords_val


def to_row(b: dict) -> dict:
    name = b.get("itemLabel", {}).get("value", "").strip()
    if not name or name.startswith("Q"):  # skip items with no English label
        return {}
    desc = b.get("itemDescription", {}).get("value", "").strip()
    coords_raw = b.get("coords", {}).get("value", "")
    coords = parse_coords(coords_raw)
    inception_raw = b.get("inception", {}).get("value", "")
    inception = inception_raw[:10] if inception_raw else ""
    wikidata_id = b.get("wikidataId", {}).get("value", "")
    monument_type = b.get("typeLabel", {}).get("value", "Heritage Site")
    return {
        "name": name,
        "monument_type": monument_type,
        "description": desc[:500] if desc else f"Nepali cultural heritage site. Wikidata: {wikidata_id}",
        "construction_date": inception,
        "location_name": "Nepal",
        "coordinates": coords,
        "existence_status": "Extant",
    }


def write_csv(rows: list[dict], path: Path) -> int:
    fieldnames = [
        "name", "monument_type", "description",
        "construction_date", "location_name", "coordinates", "existence_status",
    ]
    seen = set()
    unique_rows = []
    for r in rows:
        if r and r["name"] and r["name"] not in seen:
            seen.add(r["name"])
            unique_rows.append(r)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique_rows)
    return len(unique_rows)


def main():
    repo_root = Path(__file__).resolve().parent.parent
    fixtures_dir = repo_root / "heritage_graph" / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    try:
        bindings = fetch_wikidata()
    except requests.RequestException as e:
        print(f"ERROR: Could not reach Wikidata: {e}")
        print("Check your internet connection. The fixtures were NOT updated.")
        sys.exit(1)

    rows = [to_row(b) for b in bindings]
    count = write_csv(rows, fixtures_dir / "monuments.csv")
    print(f"  Wrote {count} monuments to heritage_graph/fixtures/monuments.csv")

    if count < 30:
        print(f"WARNING: Only {count} rows written. Expected 30+.")
        print("Wikidata may have returned fewer results — run again or check the query.")
    else:
        print(f"SUCCESS: {count} real Nepali heritage monuments ready to load.")
        print("")
        print("Next: docker compose exec backend python manage.py seed_db --flush")


if __name__ == "__main__":
    main()
```

### Direct Oxigraph Loader (alternative — bypasses Django)

If `rebuild_triplestore` is too slow or broken, use this script to POST data **directly** into Oxigraph over HTTP. Save to `scripts/seed_oxigraph_direct.py`:

```python
#!/usr/bin/env python3
"""
Fetch Nepali heritage data from Wikidata and INSERT directly into Oxigraph
via SPARQL 1.1 Update over HTTP. Does not require Django to be running.

Usage: python3 scripts/seed_oxigraph_direct.py
       OXIGRAPH_URL=http://localhost:7878 python3 scripts/seed_oxigraph_direct.py
"""

import os
import sys
import time
import urllib.parse
import urllib.request

import requests

OXIGRAPH_URL = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
SPARQL_UPDATE_URL = OXIGRAPH_URL.rstrip("/") + "/sparql"

HERITAGE_NS  = "https://w3id.org/heritagegraph/resource/"
CIDOC_NS     = "http://www.cidoc-crm.org/cidoc-crm/"
RDFS         = "http://www.w3.org/2000/01/rdf-schema#"
WD_ENTITY    = "http://www.wikidata.org/entity/"
OWL          = "http://www.w3.org/2002/07/owl#"

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_QUERY = """
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?inception WHERE {
  ?item wdt:P17 wd:Q837 .
  ?item wdt:P31 ?type .
  VALUES ?type {
    wd:Q839954 wd:Q44613 wd:Q16560 wd:Q570116 wd:Q483453
    wd:Q24354  wd:Q33506 wd:Q108325 wd:Q179049 wd:Q4989906
    wd:Q17515
  }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q28640 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ne" . }
  OPTIONAL { ?item wdt:P625 ?coords }
  OPTIONAL { ?item wdt:P571 ?inception }
}
ORDER BY ?itemLabel
LIMIT 50
"""


def fetch():
    resp = requests.get(
        WIKIDATA_SPARQL,
        params={"query": WIKIDATA_QUERY},
        headers={
            "Accept": "application/sparql-results+json",
            "User-Agent": "HeritageGraph-Demo/1.0 (CAIR-Nepal)",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["results"]["bindings"]


def escape_literal(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", "")


def build_update(bindings: list) -> str:
    triples = []
    count = 0
    for b in bindings:
        label = b.get("itemLabel", {}).get("value", "").strip()
        if not label or label.startswith("Q"):
            continue
        item_uri = b.get("item", {}).get("value", "")
        wikidata_id = item_uri.split("/")[-1] if item_uri else f"item{count}"
        local_uri = f"{HERITAGE_NS}monument/{wikidata_id}"

        desc = b.get("itemDescription", {}).get("value", "")[:400]
        inception = b.get("inception", {}).get("value", "")[:10]

        triples.append(f'<{local_uri}> <{RDFS}label> "{escape_literal(label)}"@en .')
        triples.append(f'<{local_uri}> <{CIDOC_NS}P1_is_identified_by> "{escape_literal(label)}"@en .')
        triples.append(f'<{local_uri}> <{OWL}sameAs> <{item_uri}> .')
        if desc:
            triples.append(f'<{local_uri}> <{RDFS}comment> "{escape_literal(desc)}"@en .')
        if inception:
            triples.append(f'<{local_uri}> <{CIDOC_NS}P82a_begin_of_the_begin> "{inception}" .')

        coords_raw = b.get("coords", {}).get("value", "")
        if coords_raw:
            coords_raw = coords_raw.replace("Point(", "").replace(")", "").strip()
            parts = coords_raw.split()
            if len(parts) == 2:
                lng, lat = parts
                triples.append(f'<{local_uri}> <{HERITAGE_NS}latitude> "{lat}" .')
                triples.append(f'<{local_uri}> <{HERITAGE_NS}longitude> "{lng}" .')

        count += 1

    triple_block = "\n  ".join(triples)
    return f"INSERT DATA {{\n  {triple_block}\n}}"


def post_update(sparql: str) -> None:
    data = urllib.parse.urlencode({"update": sparql}).encode()
    req = urllib.request.Request(
        SPARQL_UPDATE_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status not in (200, 204):
            raise RuntimeError(f"Oxigraph returned HTTP {resp.status}")


def verify_count() -> int:
    check_query = "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }"
    resp = requests.get(
        SPARQL_UPDATE_URL,
        params={"query": check_query},
        headers={"Accept": "application/sparql-results+json"},
        timeout=10,
    )
    resp.raise_for_status()
    return int(resp.json()["results"]["bindings"][0]["n"]["value"])


def main():
    print(f"Target: {OXIGRAPH_URL}")

    # Check Oxigraph is up
    try:
        requests.get(OXIGRAPH_URL.rstrip("/") + "/", timeout=5).raise_for_status()
    except Exception as e:
        print(f"ERROR: Oxigraph not reachable at {OXIGRAPH_URL}: {e}")
        print("Run: docker compose up -d oxigraph")
        sys.exit(1)

    print("Fetching from Wikidata...")
    bindings = fetch()
    print(f"  {len(bindings)} results from Wikidata")

    sparql = build_update(bindings)
    print("Posting to Oxigraph...")
    post_update(sparql)

    total = verify_count()
    print(f"SUCCESS: Oxigraph now contains {total} triples.")


if __name__ == "__main__":
    main()
```

Run it:
```bash
pip install requests
python3 scripts/seed_oxigraph_direct.py
```

---

## Section 5: Demo Shot List — Under 3 Minutes

This is the exact sequence for a live demo. Rehearse it twice before showing anyone.

**00:00 — SHOT 1: The login screen**
> Browser opens at `http://localhost:3000`. The HeritageGraph landing page is visible. Presenter clicks "Sign in with Google."

**00:20 — SHOT 2: Authenticated dashboard**
> Google OAuth completes. Presenter lands on the dashboard home. Point to the left sidebar and say: "This is a knowledge graph platform for Nepal's cultural heritage."

**00:35 — SHOT 3: Navigate to Monuments**
> Presenter clicks **Knowledge** → **Monuments** in the sidebar.
> The table loads with 35 rows. Real names: Pashupatinath Temple, Boudhanath Stupa, Swayambhunath, Patan Durbar Square, Bhaktapur Durbar Square, Changu Narayan, etc.
> Point to the table: "Every row is a real Nepali cultural heritage site, sourced from Wikidata and stored in a CIDOC-CRM knowledge graph."

**01:00 — SHOT 4: Click one record**
> Presenter clicks a monument row to open the detail page.
> Show the name, description, coordinates, construction date. Point to coordinates: "These are geocoded from Wikidata — 27.7° N, 85.3° E — inside the Kathmandu Valley."

**01:20 — SHOT 5: The SPARQL endpoint**
> Switch to a terminal already open.
> Run:
```bash
curl -s -G http://localhost:8000/cidoc/sparql/ \
  --data-urlencode "query=SELECT ?label WHERE { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label } LIMIT 20" \
  | python3 -c "import sys,json; [print(b['label']['value']) for b in json.load(sys.stdin)['results']['bindings']]"
```
> Output scrolls: Boudhanath Stupa, Changu Narayan Temple, Dakshinkali Temple...
> Say: "This is a live SPARQL query against Oxigraph. The same triplestore can be federated with Wikidata, DBpedia, or any SPARQL endpoint."

**02:30 — SHOT 6: The contribution form (optional, only if it works)**
> Navigate to **Contribute → Monument**. Show the form exists. Do not submit anything. Say: "Contributions go through a review workflow before entering the knowledge graph."

**02:45 — DONE**
> Return to the monument table. The demo is complete.

**If anything breaks during the demo:** Stay on the monument table (Shot 3). That is the core claim. The SPARQL terminal (Shot 5) is second priority. Everything else is optional.

---

## Final Checklist (Print and Cross Off)

```
ENVIRONMENT
[ ] .env file has all required variables (see Step 0)
[ ] RDF_SYNC_ENABLED=true in .env
[ ] RDF_ENDPOINT_URL=http://oxigraph:7878 in .env

SERVICES
[ ] postgres container is healthy
[ ] oxigraph container is healthy  (curl http://localhost:7878/ → 200)
[ ] backend container is healthy   (curl http://localhost:8000/health/ → {"status":"ok"})
[ ] frontend container is up       (http://localhost:3000 loads)

DATA
[ ] monuments.csv has 35+ rows of real Wikidata data
[ ] python manage.py seed_db --flush ran with no errors
[ ] Monument.objects.count() >= 35
[ ] python manage.py rebuild_triplestore ran with no errors
[ ] SPARQL query returns 20+ results

FRONTEND
[ ] Can log in with Google OAuth
[ ] /knowledge/monument table loads with 35+ rows
[ ] Clicking one row opens detail page
[ ] No 401/403 errors in browser network tab
[ ] No "Failed to fetch" errors in browser console

SPARQL DEMO QUERY
[ ] Terminal command runs and prints monument names
[ ] At least 20 results visible

REHEARSAL
[ ] Demo run-through completed at least once end-to-end
[ ] Total time under 3 minutes
[ ] Shot 3 (monument table) works on its own if everything else breaks
```

---

## What Success Looks Like

On the day of the demo, someone who knows nothing about this project watches you:
1. Log in
2. See 35 real Nepali monuments in a table
3. Click one
4. Watch a SPARQL query return real data in a terminal

That is the definition of done. Everything else in this repository is for after.
