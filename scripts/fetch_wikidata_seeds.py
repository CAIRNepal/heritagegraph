#!/usr/bin/env python3
"""
Fetch ~35 real Nepali cultural heritage sites from Wikidata and write to
heritage_graph/fixtures/monuments.csv (overwriting the placeholder data).

Usage:  python3 scripts/fetch_wikidata_seeds.py
Requires: requests  (pip install requests)
"""

import csv
import sys
from pathlib import Path

import requests

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

QUERY = """
SELECT DISTINCT
  ?item ?itemLabel ?itemDescription ?coords ?inception ?wikidataId ?typeLabel
WHERE {
  ?item wdt:P17 wd:Q837 .
  ?item wdt:P31 ?type .
  VALUES ?type {
    wd:Q839954   wd:Q44613    wd:Q16560    wd:Q570116   wd:Q483453
    wd:Q24354    wd:Q33506    wd:Q12280    wd:Q108325   wd:Q179049
    wd:Q4989906  wd:Q1081138  wd:Q17515
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
    if not name or name.startswith("Q"):
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
        "description": (
            desc[:500]
            if desc
            else f"Nepali cultural heritage site. Wikidata: {wikidata_id}"
        ),
        "construction_date": inception,
        "location_name": "Nepal",
        "coordinates": coords,
        "existence_status": "Extant",
    }


def write_csv(rows: list[dict], path: Path) -> int:
    fieldnames = [
        "name",
        "monument_type",
        "description",
        "construction_date",
        "location_name",
        "coordinates",
        "existence_status",
    ]
    seen: set[str] = set()
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


def main() -> None:
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
        print(f"\nSUCCESS: {count} real Nepali heritage monuments ready to load.")
        print("\nNext step:")
        print("  docker compose exec backend python manage.py seed_db --flush")


if __name__ == "__main__":
    main()
