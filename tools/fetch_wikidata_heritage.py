#!/usr/bin/env python3
"""Freeze the Wikidata subjects listed in data/wikidata/seeds.yaml.

Writes data/wikidata/heritage-snapshot.json: every seed and sweep item, the
items their statements point to (one hop), and the administrative chain above
every place, each classified into a HeritageGraph registry key. Commons images
are frozen with the licence and author the file page states.

The importer reads only the snapshot, never the network, so an import can be
repeated exactly. Wikidata content is CC0; images keep their own licences.

Usage:
    .venv/bin/python tools/fetch_wikidata_heritage.py
"""

from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
import time
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
SEEDS = ROOT / "data" / "wikidata" / "seeds.yaml"
OUT = ROOT / "data" / "wikidata" / "heritage-snapshot.json"

API = "https://www.wikidata.org/w/api.php"
SPARQL = "https://query.wikidata.org/sparql"
COMMONS = "https://commons.wikimedia.org/w/api.php"
UA = {
    "User-Agent": "HeritageGraph-importer/1.0 (https://github.com/CAIRNepal/heritagegraph)"
}

LANGS = ["en", "ne", "new"]
# Wikidata has Latin-script junk under "ne" ("gaijatra" on Pratap Malla).
DEVANAGARI_LANGS = {"ne", "new"}
DEVANAGARI = re.compile("[\u0900-\u097F]")
NEPAL = "Q837"

# Statements the importer turns into edges or fields. Everything else is dropped.
EDGE_PROPS = {
    "P131": "located in the administrative territorial entity",
    "P276": "location",
    "P706": "located in/on physical feature",
    "P361": "part of",
    "P527": "has part(s)",
    "P140": "religion or worldview",
    "P825": "dedicated to",
    "P1049": "worshipped by",
    "P88": "commissioned by",
    "P84": "architect",
    "P170": "creator",
}
VALUE_PROPS = {"P625": "coordinate location", "P18": "image", "P571": "inception"}

# Registry key for an item, decided by what its P31 classes are subclasses of.
# Order matters: the first matching key wins.
CLASS_ROOTS: list[tuple[str, list[str]]] = [
    ("person", ["Q5"]),
    ("deity", ["Q178885", "Q190046", "Q1064555"]),  # deity, bodhisattva, kumari
    (
        "festival",
        ["Q132241", "Q1445650", "Q15275719"],
    ),  # festival, holiday, recurring event
    (
        "tradition",
        ["Q9174", "Q13414953", "Q11639", "Q1792379"],
    ),  # religion, denomination, dance, art genre
    (
        "structure",
        [
            "Q1370598",
            "Q44539",
            "Q180987",
            "Q16560",
            "Q4989906",
            "Q41176",
            "Q174782",
            "Q811979",
        ],
    ),
    (
        "location",
        ["Q56061", "Q486972", "Q82794", "Q39816", "Q1620908"],
    ),  # admin, settlement, region, valley, historical region
]


def get(url: str, **params) -> dict:
    for attempt in range(5):
        r = requests.get(url, params=params, headers=UA, timeout=90)
        if r.status_code in (429, 503):
            time.sleep(5 * (attempt + 1))
            continue
        r.raise_for_status()
        return r.json()
    r.raise_for_status()
    return {}


def sparql(query: str) -> list[dict]:
    data = get(SPARQL, query=query, format="json")
    return data["results"]["bindings"]


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def fetch_entities(ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    ids = sorted(set(ids))
    for i in range(0, len(ids), 50):
        batch = ids[i : i + 50]
        data = get(
            API,
            action="wbgetentities",
            ids="|".join(batch),
            props="labels|descriptions|claims|info",
            languages="|".join(LANGS),
            format="json",
            maxlag=5,
        )
        out.update(data.get("entities", {}))
        time.sleep(0.2)
    return out


def claim_values(entity: dict, prop: str) -> list:
    # Preferred-rank statements are Wikidata's current values; without them a
    # temple's P131 also yields every historical unit it once sat in.
    claims = [
        c
        for c in entity.get("claims", {}).get(prop, [])
        if c.get("rank") != "deprecated"
    ]
    preferred = [c for c in claims if c.get("rank") == "preferred"]
    vals = []
    for c in preferred or claims:
        if any("P582" in q for q in [c.get("qualifiers", {})]):
            continue  # has an end time: no longer true
        snak = c.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        vals.append(snak["datavalue"]["value"])
    return vals


def item_targets(entity: dict, prop: str) -> list[str]:
    return [
        v["id"] for v in claim_values(entity, prop) if isinstance(v, dict) and "id" in v
    ]


def compact(entity: dict) -> dict:
    """Keep the labels, descriptions and statements the importer uses."""
    claims = {p: item_targets(entity, p) for p in EDGE_PROPS}
    claims = {p: v for p, v in claims.items() if v}
    rec = {
        "labels": {
            k: v["value"]
            for k, v in entity.get("labels", {}).items()
            if k not in DEVANAGARI_LANGS or DEVANAGARI.search(v["value"])
        },
        "descriptions": {
            k: v["value"] for k, v in entity.get("descriptions", {}).items()
        },
        "instanceOf": item_targets(entity, "P31"),
        "country": item_targets(entity, "P17"),
        "claims": claims,
        "lastrevid": entity.get("lastrevid"),
    }
    coords = [v for v in claim_values(entity, "P625") if isinstance(v, dict)]
    if coords:
        rec["coord"] = {"lat": coords[0]["latitude"], "lon": coords[0]["longitude"]}
    images = [v for v in claim_values(entity, "P18") if isinstance(v, str)]
    if images:
        rec["image"] = images[0]
    inception = [v for v in claim_values(entity, "P571") if isinstance(v, dict)]
    if inception:
        rec["inception"] = {
            "time": inception[0]["time"],
            "precision": inception[0]["precision"],
        }
    return rec


def classify(all_ids: set[str]) -> dict[str, str]:
    """Registry key per item from its P31/P279* classes."""
    keys: dict[str, str] = {}
    ids = sorted(all_ids)
    for key, roots in CLASS_ROOTS:
        root_values = " ".join(f"wd:{r}" for r in roots)
        for i in range(0, len(ids), 150):
            values = " ".join(f"wd:{q}" for q in ids[i : i + 150])
            rows = sparql(
                f"SELECT DISTINCT ?i WHERE {{ VALUES ?i {{ {values} }} VALUES ?root {{ {root_values} }} "
                f"?i wdt:P31/wdt:P279* ?root . }}"
            )
            for row in rows:
                keys.setdefault(qid(row["i"]["value"]), key)
            time.sleep(0.5)
    return keys


def strip_html(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def fetch_media(files: set[str]) -> dict[str, dict]:
    credits: dict[str, dict] = {}
    names = sorted(files)
    retrieved = dt.date.today().isoformat()
    for i in range(0, len(names), 40):
        batch = names[i : i + 40]
        data = get(
            COMMONS,
            action="query",
            titles="|".join(f"File:{n}" for n in batch),
            prop="imageinfo",
            iiprop="url|extmetadata",
            iiurlwidth=1600,
            format="json",
        )
        for page in data.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                continue
            meta = info.get("extmetadata", {})
            license_name = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
            if not license_name:
                continue  # an image without a stated licence is not used
            name = page["title"].removeprefix("File:")
            credits[name] = {
                "url": (info.get("thumburl") or info.get("url") or "").split("?")[0],
                "file": name,
                "descriptionUrl": info.get("descriptionurl"),
                "license": license_name,
                "licenseUrl": strip_html(meta.get("LicenseUrl", {}).get("value", "")),
                "artist": strip_html(meta.get("Artist", {}).get("value", ""))[:300],
                "source": "Wikimedia Commons",
                "retrieved": retrieved,
            }
        time.sleep(0.3)
    return credits


def main() -> int:
    cfg = yaml.safe_load(SEEDS.read_text())
    seed_keys = {s["qid"]: s["key"] for s in cfg.get("seeds", [])}
    swept: dict[str, str] = {}
    for sweep in cfg.get("sweeps", []):
        rows = sparql(
            f"SELECT DISTINCT ?i WHERE {{ ?i wdt:P31/wdt:P279* wd:{sweep['class']} ; "
            f"wdt:P17 wd:{sweep['country']} . }}"
        )
        for row in rows:
            swept.setdefault(qid(row["i"]["value"]), sweep["key"])
        print(f"sweep {sweep['class']}: {len(rows)} items")

    primary = {**swept, **seed_keys}
    entities = {
        q: compact(e)
        for q, e in fetch_entities(list(primary)).items()
        if "missing" not in e
    }
    print(f"primary items: {len(entities)}")

    # One hop out along edge properties.
    targets = {
        t for e in entities.values() for vs in e["claims"].values() for t in vs
    } - set(entities)
    entities.update(
        {
            q: compact(e)
            for q, e in fetch_entities(list(targets)).items()
            if "missing" not in e
        }
    )

    # Administrative chain above every place, up to the country.
    frontier = {
        t for e in entities.values() for t in e["claims"].get("P131", [])
    } - set(entities)
    for _ in range(5):
        if not frontier:
            break
        fetched = {
            q: compact(e)
            for q, e in fetch_entities(list(frontier)).items()
            if "missing" not in e
        }
        entities.update(fetched)
        frontier = {
            t for e in fetched.values() for t in e["claims"].get("P131", [])
        } - set(entities)
    print(f"items incl. neighbours and admin chain: {len(entities)}")

    keys = classify(set(entities))
    keys.update(primary)  # seeds and sweeps keep the key they were listed under
    # A place outside Nepal (a Bihar district, the British Raj) is only reached
    # through a stray statement; leave it out so no edge points at it.
    for q, e in entities.items():
        if (
            keys.get(q) == "location"
            and q != NEPAL
            and NEPAL not in e["country"]
            and q not in seed_keys
        ):
            keys[q] = None
    for q, e in entities.items():
        e["key"] = keys.get(q)
        e["role"] = (
            "seed" if q in seed_keys else ("sweep" if q in swept else "neighbour")
        )

    media = fetch_media(
        {e["image"] for e in entities.values() if e.get("image") and e["key"]}
    )
    print(f"images with a stated licence: {len(media)}")

    snapshot = {
        "_provenance": {
            "source": "Wikidata",
            "license": "CC0 1.0",
            "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
            "retrieved": dt.date.today().isoformat(),
            "seeds": str(SEEDS.relative_to(ROOT)),
            "generatedBy": "tools/fetch_wikidata_heritage.py",
            "mediaNote": "Images are from Wikimedia Commons under their own licences, recorded per file.",
        },
        "entities": dict(sorted(entities.items())),
        "media": dict(sorted(media.items())),
    }
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1) + "\n")
    counts: dict[str, int] = {}
    for e in entities.values():
        counts[e["key"] or "unclassified"] = (
            counts.get(e["key"] or "unclassified", 0) + 1
        )
    print("by key:", dict(sorted(counts.items(), key=lambda kv: -kv[1])))
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
