"""Run a federated SPARQL demo query (HG local store + Wikidata + Getty)."""

from __future__ import annotations

from django.core.management.base import BaseCommand


DEMO_QUERY = """
# HeritageGraph local graph (if loaded) + Wikidata label for a known temple Q3196273
SELECT ?label ?style ?coord WHERE {
  SERVICE <https://query.wikidata.org/sparql> {
    wd:Q3196273 rdfs:label ?label .
    FILTER(LANG(?label) = "en")
    OPTIONAL { wd:Q3196273 wdt:P625 ?coord }
    OPTIONAL { wd:Q3196273 wdt:P149 ?style }
  }
}
LIMIT 5
"""


class Command(BaseCommand):
    help = "Execute federation demo SPARQL (Wikidata SERVICE) for papers and smoke tests."

    def handle(self, *args, **options):
        from apps.graph.kg_engine.engine import get_kg_engine

        engine = get_kg_engine()
        self.stdout.write(self.style.MIGRATE_HEADING("Federation demo (Wikidata SERVICE)"))
        if not engine.store._query_endpoint():
            self.stdout.write(
                self.style.WARNING(
                    "Embedded pyoxigraph cannot execute SPARQL SERVICE. "
                    "Set RDF_QUERY_URL to an Oxigraph/Jena HTTP endpoint, or paste the query below "
                    "into https://query.wikidata.org or a federating Fuseki."
                )
            )
            self.stdout.write(DEMO_QUERY)
            return
        try:
            rows = engine.query(DEMO_QUERY)
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"Query failed: {exc}"))
            self.stdout.write("Paste into a federating SPARQL client:")
            self.stdout.write(DEMO_QUERY)
            return
        for row in rows:
            self.stdout.write(str(row))
        if not rows:
            self.stdout.write(
                "No bindings. If the endpoint blocks SERVICE, run the query in Wikidata Query Service."
            )
