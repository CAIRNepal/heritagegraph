#!/usr/bin/env python3
"""
Fetch Nepali heritage data from Wikidata and INSERT directly into Oxigraph
via SPARQL 1.1 Update over HTTP. Does not require Django to be running.

Use this if `rebuild_triplestore` is unavailable or the Django stack is down.

Usage:
  python3 scripts/seed_oxigraph_direct.py
  OXIGRAPH_URL=http://localhost:7878 python3 scripts/seed_oxigraph_direct.py
"""

import os
import sys
import urllib.parse
import urllib.request

import requests

OXIGRAPH_URL = os.environ.get("OXIGRAPH_URL", "http://localhost:7878")
SPARQL_URL = OXIGRAPH_URL.rstrip("/") + "/sparql"

HERITAGE_NS = "https://w3id.org/heritagegraph/resource/"
CIDOC_NS = "http://www.cidoc-crm.org/cidoc-crm/"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_QUERY = """
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coords ?inception WHERE {
  ?item wdt:P17 wd:Q837 .
  ?item wdt:P31 ?type .
  VALUES ?type {
    wd:Q839954 wd:Q44613  wd:Q16560  wd:Q570116 wd:Q483453
    wd:Q24354  wd:Q33506  wd:Q108325 wd:Q179049 wd:Q4989906
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


def fetch() -> list[dict]:
    print("Fetching from Wikidata...")
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
    bindings = resp.json()["results"]["bindings"]
    print(f"  {len(bindings)} results from Wikidata")
    return bindings


def escape_literal(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", " ")
        .replace("\r", "")
    )


def build_update(bindings: list[dict]) -> str:
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
        triples.append(
            f'<{local_uri}> <{CIDOC_NS}P1_is_identified_by> "{escape_literal(label)}"@en .'
        )
        triples.append(f'<{local_uri}> <{OWL}sameAs> <{item_uri}> .')
        if desc:
            triples.append(
                f'<{local_uri}> <{RDFS}comment> "{escape_literal(desc)}"@en .'
            )
        if inception:
            triples.append(
                f'<{local_uri}> <{CIDOC_NS}P82a_begin_of_the_begin> "{inception}" .'
            )

        coords_raw = b.get("coords", {}).get("value", "")
        if coords_raw:
            coords_raw = coords_raw.replace("Point(", "").replace(")", "").strip()
            parts = coords_raw.split()
            if len(parts) == 2:
                lng, lat = parts
                triples.append(
                    f'<{local_uri}> <{HERITAGE_NS}latitude> "{lat}" .'
                )
                triples.append(
                    f'<{local_uri}> <{HERITAGE_NS}longitude> "{lng}" .'
                )
        count += 1

    triple_block = "\n  ".join(triples)
    return f"INSERT DATA {{\n  {triple_block}\n}}"


def post_update(sparql: str) -> None:
    data = urllib.parse.urlencode({"update": sparql}).encode()
    req = urllib.request.Request(
        SPARQL_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status not in (200, 204):
            raise RuntimeError(f"Oxigraph returned HTTP {resp.status}")


def count_triples() -> int:
    resp = requests.get(
        SPARQL_URL,
        params={"query": "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }"},
        headers={"Accept": "application/sparql-results+json"},
        timeout=10,
    )
    resp.raise_for_status()
    return int(resp.json()["results"]["bindings"][0]["n"]["value"])


def main() -> None:
    print(f"Target Oxigraph: {OXIGRAPH_URL}")

    try:
        requests.get(OXIGRAPH_URL.rstrip("/") + "/", timeout=5).raise_for_status()
        print("  Oxigraph is up")
    except Exception as e:
        print(f"ERROR: Oxigraph not reachable: {e}")
        print("Run: docker compose up -d oxigraph")
        sys.exit(1)

    bindings = fetch()
    sparql = build_update(bindings)

    print("Posting to Oxigraph...")
    post_update(sparql)

    total = count_triples()
    print(f"\nSUCCESS: Oxigraph now contains {total} triples.")
    print("\nVerify with:")
    print(
        "  curl -s -G http://localhost:8000/cidoc/sparql/ "
        '--data-urlencode "query=SELECT ?label WHERE '
        '{ ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label } LIMIT 20"'
    )


if __name__ == "__main__":
    main()
