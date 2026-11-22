"""Run the competency questions and record what each one returns.

The questions live in documentation/research/competency_queries.sparql as
commented blocks headed ``# CQn — title``. Each is run against the store and
reported with its row count and a few sample rows, together with which named
graphs it reads and whether those graphs hold anything: a question that targets
an empty graph returns nothing, and that is reported as such rather than as an
answer.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from apps.graph.kg_engine import get_kg_engine
from django.conf import settings
from django.core.management.base import BaseCommand

QUERIES = (
    Path(settings.BASE_DIR).parent
    / "documentation"
    / "research"
    / "competency_queries.sparql"
)
HEADER = re.compile(r"^# (CQ\d+) — (.+)$")


def parse(text: str) -> list[dict]:
    prefixes = [line for line in text.splitlines() if line.startswith("PREFIX ")]
    out: list[dict] = []
    current = None
    for line in text.splitlines():
        m = HEADER.match(line)
        if m:
            current = {"id": m.group(1), "title": m.group(2), "lines": []}
            out.append(current)
        elif current is not None and line.startswith("# "):
            current["lines"].append(line[2:])
        elif current is not None and line.strip() == "#":
            continue
    for q in out:
        body = "\n".join(q.pop("lines")).strip()
        q["sparql"] = "\n".join(prefixes) + "\n" + body
        q["graphs"] = sorted(set(re.findall(r"GRAPH <([^>]+)>", body)))
    return out


def run() -> dict:
    store = get_kg_engine().store
    populated = {
        r["g"]
        for r in store.select("SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }")
        if r.get("g")
    }
    results = []
    for q in parse(QUERIES.read_text()):
        entry = {
            "id": q["id"],
            "title": q["title"],
            "graphs": {g: g in populated for g in q["graphs"]},
        }
        try:
            rows = store.select(q["sparql"])
            entry["rows"] = len(rows)
            entry["sample"] = rows[:5]
        except Exception as exc:  # report, do not hide, a query that fails
            entry["error"] = str(exc)[:300]
        missing = [g for g, ok in entry["graphs"].items() if not ok]
        if missing:
            entry["note"] = "reads graphs that are empty in this store: " + ", ".join(
                missing
            )
        results.append(entry)
    return {"queries": results}


class Command(BaseCommand):
    help = "Run the competency questions and report what each returns."

    def add_arguments(self, parser):
        parser.add_argument("--output", type=Path, help="Write the JSON report here.")

    def handle(self, *args, **opts):
        report = run()
        if opts["output"]:
            opts["output"].write_text(json.dumps(report, indent=2) + "\n")
        for q in report["queries"]:
            if q.get("error"):
                status = "ERROR"
            elif q["rows"] == 1 and len(q["sample"][0]) <= 3:
                # Aggregates (COUNT, ASK-style) return one row: show the answer.
                status = ", ".join(f"{k}={v}" for k, v in q["sample"][0].items())
            else:
                status = f"{q['rows']} rows"
            note = f"  ({q['note']})" if q.get("note") else ""
            self.stdout.write(f"{q['id']:>5}  {status:>12}  {q['title']}{note}")
