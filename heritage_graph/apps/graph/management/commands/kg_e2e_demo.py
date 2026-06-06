"""
End-to-end proof that the pipeline produces a *connected, ontology-typed* graph:
create two real entities + one accepted relationship.* assertion, then confirm
both appear as typed nodes AND the edge appears in the museum's graph projection
(`fetch_graph_projection`). Cleans up afterwards unless --keep.

Usage:  python manage.py kg_e2e_demo          # create, verify, clean up
        python manage.py kg_e2e_demo --keep    # leave the demo data in place
"""

from __future__ import annotations

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.cidoc_data.models import HeritageAssertion, Location, Person
from apps.cidoc_data.rdf_publish import resource_uri_for_instance
from apps.graph.kg_engine.engine import get_kg_engine
from apps.graph.kg_engine.queries import fetch_graph_projection

TAG = "kg-e2e-test"


class Command(BaseCommand):
    help = "Create→project→read round-trip test proving the live KG stays connected."

    def add_arguments(self, parser):
        parser.add_argument("--keep", action="store_true", help="Do not delete the demo data.")

    def handle(self, *args, **opts):
        engine = get_kg_engine()
        ok, warn, err = self.style.SUCCESS, self.style.WARNING, self.style.ERROR

        if not engine.enabled():
            self.stdout.write(err("RDF_SYNC_ENABLED is off — enable it before running this test."))
            return

        person = Person.objects.create(name=f"[{TAG}] Demo Person")
        location = Location.objects.create(name=f"[{TAG}] Demo Location")
        assertion = HeritageAssertion.objects.create(
            content_type=ContentType.objects.get_for_model(Person),
            object_id=person.pk,
            object_content_type=ContentType.objects.get_for_model(Location),
            object_object_id=location.pk,
            asserted_property="relationship.associated_with",
            reconciliation_status="accepted",
            contributed_by=TAG,
            assertion_content="kg_e2e_demo round-trip test",
        )

        subj_uri = resource_uri_for_instance(person)
        obj_uri = resource_uri_for_instance(location)
        self.stdout.write(f"subject = {subj_uri}")
        self.stdout.write(f"object  = {obj_uri}")

        def check() -> tuple[bool, bool, bool]:
            proj = fetch_graph_projection(node_limit=2000, edge_limit=10000)
            node_ids = {r.get("s") for r in proj["nodes"]}
            has_s = subj_uri in node_ids
            has_o = obj_uri in node_ids
            has_edge = any(
                e.get("s") == subj_uri and e.get("o") == obj_uri for e in proj["edges"]
            )
            return has_s, has_o, has_edge

        has_s, has_o, has_edge = check()
        if not has_edge:
            # Entity/assertion projection may run on_commit; force a rebuild and retry.
            self.stdout.write(warn("edge not visible yet — running rebuild and retrying…"))
            engine.rebuild_public_graph()
            has_s, has_o, has_edge = check()

        self.stdout.write(f"  subject node present : {ok('yes') if has_s else err('NO')}")
        self.stdout.write(f"  object  node present : {ok('yes') if has_o else err('NO')}")
        self.stdout.write(f"  edge present         : {ok('yes') if has_edge else err('NO')}")

        if has_s and has_o and has_edge:
            self.stdout.write(ok("\n✓ PIPELINE OK — contribution→Oxigraph→read produces a connected, typed graph."))
        else:
            self.stdout.write(
                err(
                    "\n✗ Pipeline broken at the marked step. If nodes are present but the edge "
                    "is not, run `python manage.py kg_verify` and check the store-target section."
                )
            )

        if opts["keep"]:
            self.stdout.write(warn(f"\n--keep set: demo data retained (tag '{TAG}'). Remove with the seed --clear pattern."))
            return
        assertion.delete()
        person.delete()
        location.delete()
        self.stdout.write("\nCleaned up demo data.")
