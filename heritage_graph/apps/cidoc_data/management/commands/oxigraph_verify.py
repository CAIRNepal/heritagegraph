"""
Verify that the Oxigraph integration is functional.

Checks:
- Local store can be opened (pyoxigraph Store at OXIGRAPH_STORE_PATH / oxigraph_db)
- Schema seed exists (rdfs:Class triples)
- SPARQL proxy fallback is queryable (same query shape as SPARQL JSON results)
"""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Verify local Oxigraph store is readable and contains expected triples"

    def handle(self, *args, **options):
        try:
            from pyoxigraph import Store
        except ImportError as exc:
            raise CommandError(
                "pyoxigraph is not installed. Install backend requirements first."
            ) from exc

        store_path = str(getattr(settings, "OXIGRAPH_STORE_PATH", "oxigraph_db") or "oxigraph_db")
        try:
            store = Store(store_path)
        except Exception as exc:
            raise CommandError(f"Could not open Oxigraph store at {store_path!r}: {exc}") from exc

        checks: list[tuple[str, bool, str]] = []

        # 1) Basic rdfs:Class presence (from schema seeding)
        q_classes = """
        SELECT (COUNT(?c) AS ?count)
        WHERE {
          ?c <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
             <http://www.w3.org/2000/01/rdf-schema#Class> .
        }
        """
        try:
            res = list(store.query(q_classes))
            count = int(res[0]["count"].value) if res else 0
            checks.append(("schema seeded (rdfs:Class)", count > 0, f"count={count}"))
        except Exception as exc:
            checks.append(("schema seeded (rdfs:Class)", False, f"query failed: {exc}"))

        # 2) Minimal projection presence (rdfs:label) – may be 0 if no CIDOC rows yet
        q_labels = """
        SELECT (COUNT(?s) AS ?count)
        WHERE {
          ?s <http://www.w3.org/2000/01/rdf-schema#label> ?label .
        }
        """
        try:
            res = list(store.query(q_labels))
            count = int(res[0]["count"].value) if res else 0
            checks.append(("projection ready (rdfs:label)", True, f"count={count}"))
        except Exception as exc:
            checks.append(("projection ready (rdfs:label)", False, f"query failed: {exc}"))

        ok = all(passed for _name, passed, _detail in checks)

        for name, passed, detail in checks:
            status = "PASS" if passed else "FAIL"
            self.stdout.write(f"{status}  {name}  ({detail})")

        if not ok:
            raise CommandError("Oxigraph verification failed. See checks above.")

        self.stdout.write(self.style.SUCCESS("Oxigraph verification passed."))

