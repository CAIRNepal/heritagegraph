import json

from apps.cidoc_data.cidoc_registry_keys import registry_class_key_for_model
from apps.cidoc_data.identity_constants import IDENTITY_SAME_REFERENT_PROPERTY
from apps.cidoc_data.linkml_loader import get_effective_registry_payload
from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Deity,
    EntityCluster,
    Event,
    HeritageAssertion,
    HistoricalPeriod,
    IconographicObject,
    Location,
    Person,
    Source,
    SyncreticRelationship,
    Tradition,
)
from apps.cidoc_data.rdf_entity_projection import (
    EXTERNAL_MATCH_URI,
    RDF_TYPE_URI,
    expand_curie,
    iris_from_external_identifiers,
    tripleset_for_metadata_instance,
)
from apps.cidoc_data.rdf_signals import _resource_uri, rdf_sync_enabled
from apps.heritage_data.models import CulturalEntity
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


class ArchitecturalStructureLocationFkTest(TestCase):
    def test_has_current_location_optional_fk(self):
        loc = Location.objects.create(
            name="Inline Loc",
            type="temple",
            current_status="preserved",
        )
        s = ArchitecturalStructure.objects.create(
            name="Structure A",
            structure_type="Temple",
            has_current_location=loc,
        )
        s.refresh_from_db()
        self.assertEqual(s.has_current_location_id, loc.pk)


class PersonModelTest(TestCase):
    def test_create_person(self):
        p = Person.objects.create(
            title="Lord Shiva",
            description="Protector",
            contributor="me",
            status="pending",
            name="Mahadev",
            aliases="Shiv",
            birth_date="Unknown",
            death_date="Unknown",
            occupation="Destroyer and Protector",
            biography="Lives in Kailash Mountain",
        )
        self.assertEqual(str(p), "Mahadev")
        self.assertEqual(p.aliases, "Shiv")

    def test_person_blank_fields(self):
        p = Person.objects.create(name="Shiva")
        self.assertEqual(p.name, "Shiva")


class LocationModelTest(TestCase):
    def test_create_location(self):
        loc = Location.objects.create(
            title="Pashupatinath",
            name="Pashupatinath Temple",
            type="temple",
            current_status="preserved",
            coordinates_legacy="27.7104, 85.3482",
        )
        self.assertEqual(str(loc), "Pashupatinath Temple")
        self.assertEqual(loc.type, "temple")

    def test_invalid_location_type(self):
        loc = Location(
            name="FakePlace", type="invalid_type", current_status="preserved"
        )
        with self.assertRaises(ValidationError):
            loc.full_clean()


class EventModelTest(TestCase):
    def test_create_event(self):
        e = Event.objects.create(
            name="Royal Massacre",
            type="historical",
            description="A tragic event",
            start_date="Jestha 19",
            end_date="Jestha 19",
            recurrence="one_time",
        )
        self.assertEqual(str(e), "Royal Massacre")
        self.assertEqual(e.type, "historical")

    def test_invalid_event_type(self):
        e = Event(
            name="Weird Event",
            type="nonsense",
            description="No idea",
            recurrence="annual",
        )
        with self.assertRaises(ValidationError):
            e.full_clean()


class HistoricalPeriodTest(TestCase):
    def test_create_period(self):
        hp = HistoricalPeriod.objects.create(
            name="Lichhavi Era",
            start_year="c. 400 CE",
            end_year="c. 750 CE",
            description="Influential Nepali kingdom",
        )
        self.assertEqual(str(hp), "Lichhavi Era (c. 400 CE - c. 750 CE)")
        self.assertTrue(hp.created_at is not None)


class TraditionTest(TestCase):
    def test_create_tradition(self):
        t = Tradition.objects.create(
            name="Sati Pratha",
            type="ritual",
            description="Old banned practice",
            associated_materials="",
        )
        self.assertEqual(str(t), "Sati Pratha")
        self.assertEqual(t.type, "ritual")

    def test_invalid_tradition_type(self):
        t = Tradition(name="Strange", type="invalid", description="Nope")
        with self.assertRaises(ValidationError):
            t.full_clean()


class SourceTest(TestCase):
    def test_create_source(self):
        s = Source.objects.create(
            title="History of Nepal",
            authors="John Doe, Jane Smith",
            publication_year="1998",
            type="book",
            digital_link="https://example.com/book",
            archive_location="National Archive",
        )
        self.assertEqual(str(s), "History of Nepal")
        self.assertEqual(s.type, "book")

    def test_invalid_source_type(self):
        s = Source(title="Bad Source", authors="Someone", type="invalid")
        with self.assertRaises(ValidationError):
            s.full_clean()


###################################################################################################  # noqa: E501
##                                       RELATIONSHIPS TESTING                                   ##  # noqa: E501
###################################################################################################  # noqa: E501


class RelatedEntitiesApiTest(APITestCase):
    def test_related_requires_domain_and_id(self):
        res = self.client.get("/cidoc/related/", {})
        self.assertEqual(res.status_code, 400)

    def test_related_unknown_group(self):
        res = self.client.get(
            "/cidoc/related/",
            {"domain": "source", "id": "1", "group": "not_a_real_group"},
        )
        self.assertEqual(res.status_code, 400)

    def test_related_source_via_syncretism(self):
        src = Source.objects.create(
            title="Ref Book",
            authors="A",
            type="book",
        )
        SyncreticRelationship.objects.create(
            name="Equivalence claim",
            documented_in_source=str(src.pk),
        )
        res = self.client.get(
            "/cidoc/related/",
            {"domain": "source", "id": str(src.pk)},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["entity_id"], str(src.pk))
        self.assertEqual(body["total_related"], 1)
        self.assertEqual(len(body["groups"]), 1)
        g0 = body["groups"][0]
        self.assertEqual(g0["domain_key"], "syncretism")
        self.assertEqual(len(g0["results"]), 1)
        self.assertEqual(g0["results"][0]["name"], "Equivalence claim")

    def test_related_deity_via_iconography(self):
        deity = Deity.objects.create(name="Test Deity")
        IconographicObject.objects.create(
            name="Test Object",
            depicts_deity=str(deity.pk),
        )
        res = self.client.get(
            "/cidoc/related/",
            {"domain": "deity", "id": str(deity.pk)},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["total_related"], 1)
        self.assertEqual(body["groups"][0]["domain_key"], "iconography")

    def test_related_pagination_and_group_filter(self):
        src = Source.objects.create(
            title="Multi",
            authors="B",
            type="journal",
        )
        SyncreticRelationship.objects.create(
            name="First",
            documented_in_source=str(src.pk),
        )
        SyncreticRelationship.objects.create(
            name="Second",
            documented_in_source=str(src.pk),
        )
        res = self.client.get(
            "/cidoc/related/",
            {"domain": "source", "id": str(src.pk), "page_size": "1", "page": "1"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["total_related"], 2)
        g0 = body["groups"][0]
        self.assertTrue(g0["has_more"])
        self.assertEqual(len(g0["results"]), 1)

        res2 = self.client.get(
            "/cidoc/related/",
            {
                "domain": "source",
                "id": str(src.pk),
                "page_size": "1",
                "page": "2",
                "group": "syncretism",
            },
        )
        self.assertEqual(res2.status_code, 200)
        body2 = res2.json()
        self.assertEqual(len(body2["groups"]), 1)
        self.assertEqual(len(body2["groups"][0]["results"]), 1)

    def test_related_empty_for_unreferenced_domain(self):
        res = self.client.get(
            "/cidoc/related/",
            {"domain": "festival", "id": "999"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["total_related"], 0)
        self.assertEqual(res.json()["groups"], [])


class OntologySchemaRegistryAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="schema_test_user",
            email="schema_test@example.com",
            password="x",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_registry_shape_and_etag(self):
        url = "/api/v1/cidoc/schema/registry/"
        r1 = self.client.get(url)
        self.assertEqual(r1.status_code, 200, r1.content)
        body = json.loads(r1.content.decode())
        self.assertIn("schema_version", body)
        self.assertIn("classes", body)
        self.assertIn("enums", body)
        self.assertIn("contribute_hub", body)
        self.assertIn("hubCategories", body["contribute_hub"])
        self.assertIn("intents", body["contribute_hub"])
        self.assertIn("semantic_patterns", body)
        self.assertIsInstance(body["semantic_patterns"], list)
        self.assertIn("tenant_id", body)
        self.assertIn("degraded", body)
        etag = r1.headers.get("ETag")
        self.assertTrue(etag)
        r2 = self.client.get(url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(r2.status_code, 304)


class RDFEntityProjectionTest(SimpleTestCase):
    def test_expand_curie_full_uri_passthrough(self):
        uri = "https://example.test/vocab/a"
        self.assertEqual(expand_curie(uri), uri)

    def test_expand_curie_known_prefix(self):
        self.assertEqual(
            expand_curie("crm:P3_has_note"),
            "http://www.cidoc-crm.org/cidoc-crm/P3_has_note",
        )

    def test_iris_from_external_identifiers_keeps_https_only(self):
        self.assertEqual(
            iris_from_external_identifiers(
                {
                    "wikidata": "https://www.wikidata.org/entity/Q123",
                    "opaque": "Q123",
                }
            ),
            ["https://www.wikidata.org/entity/Q123"],
        )


class OwlSameAsTriplesetTest(TestCase):
    """EntityCluster.external_identifiers project as owl:sameAs on CIDOC URIs."""

    def _uri(self, person: Person) -> str:
        base = getattr(settings, "RDF_RESOURCE_BASE_URI", "").rstrip("/") or "#"
        return f"{base}/person/{person.pk}"

    @override_settings(RDF_RESOURCE_BASE_URI="http://example.org/resource")
    def test_sameas_when_single_identity_cluster_with_external_iris(self):
        person = Person.objects.create(name="SameAs Person One")
        cluster = EntityCluster.objects.create(
            canonical_label="SameAs Person One",
            type_scope="person",
            external_identifiers={"wikidata": "https://www.wikidata.org/entity/Q987"},
        )
        ct = ContentType.objects.get_for_model(Person)
        assertion = HeritageAssertion(
            content_type=ct,
            object_id=person.pk,
            entity_cluster=cluster,
            asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
            asserted_value="",
            reconciliation_status="accepted",
        )
        assertion.full_clean()
        assertion.save()

        triples, _managed = tripleset_for_metadata_instance(
            person,
            resource_uri_fn=self._uri,
            label_fn=lambda o: getattr(o, "name", "") or str(o.pk),
        )
        objs = sorted(
            t.obj_uri for t in triples if t.pred == EXTERNAL_MATCH_URI and t.obj_uri
        )
        self.assertEqual(
            objs,
            ["https://www.wikidata.org/entity/Q987"],
        )

    @override_settings(RDF_RESOURCE_BASE_URI="http://example.org/resource")
    def test_no_sameas_when_competing_active_clusters(self):
        """FR-016 style competing membership: withhold owl:sameAs until resolved."""
        person = Person.objects.create(name="Conflicting Person")
        c1 = EntityCluster.objects.create(
            canonical_label="A",
            type_scope="person",
            external_identifiers={"x": "https://example.invalid/a"},
        )
        c2 = EntityCluster.objects.create(
            canonical_label="B",
            type_scope="person",
            external_identifiers={"x": "https://example.invalid/b"},
        )
        ct = ContentType.objects.get_for_model(Person)
        for cluster in (c1, c2):
            row = HeritageAssertion(
                content_type=ct,
                object_id=person.pk,
                entity_cluster=cluster,
                asserted_property=IDENTITY_SAME_REFERENT_PROPERTY,
                asserted_value="",
                reconciliation_status="accepted",
            )
            row.full_clean()
            row.save()

        triples, _managed = tripleset_for_metadata_instance(
            person,
            resource_uri_fn=self._uri,
            label_fn=lambda o: getattr(o, "name", "") or str(o.pk),
        )
        self.assertFalse(any(t.pred == EXTERNAL_MATCH_URI for t in triples))


def _registry_person_class() -> dict:
    payload = get_effective_registry_payload()
    cls = (payload.get("classes") or {}).get("person")
    if not cls:
        raise AssertionError("Registry missing person class")
    return cls


def _field_by_key(cls: dict, key: str) -> dict:
    for field in cls.get("fields") or []:
        if field.get("key") == key:
            return field
    raise AssertionError(f"Registry person class missing field {key!r}")


class FrontendContributionPipelineTest(TestCase):
    """Mimics authenticated POST /api/v1/cidoc/persons/ from the contribute UI."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="pipeline_contributor",
            email="pipeline@example.com",
            password="test-pass-123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_person_create_via_api_matches_registry_and_rdf_projection(self):
        person_cls = _registry_person_class()
        name_field = _field_by_key(person_cls, "name")
        name_slot = expand_curie(str(name_field["slot_uri"]))
        class_type = expand_curie(str(person_cls["classUri"]))

        payload = {
            "name": "Pipeline Test Person",
            "title": "Pipeline Test",
            "description": "Created by ontology pipeline integration test",
            "status": "pending_review",
        }
        response = self.client.post("/api/v1/cidoc/persons/", payload, format="json")
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.content,
        )
        person = Person.objects.get(pk=response.json()["id"])
        self.assertEqual(person.contributor, self.user.username)
        self.assertEqual(person.status, "pending_review")

        entity = CulturalEntity.objects.filter(
            contributor=self.user,
            name="Pipeline Test Person",
        ).first()
        self.assertIsNotNone(entity)
        self.assertEqual(entity.status, "pending_review")

        self.assertEqual(registry_class_key_for_model(Person), "person")

        triples, _managed = tripleset_for_metadata_instance(
            person,
            resource_uri_fn=_resource_uri,
            label_fn=lambda o: getattr(o, "name", "") or str(o.pk),
        )

        type_triples = [t for t in triples if t.pred == RDF_TYPE_URI and t.obj_uri]
        self.assertTrue(
            any(t.obj_uri == class_type for t in type_triples),
            f"Expected rdf:type {class_type} in {[t.obj_uri for t in type_triples]}",
        )

        name_literals = [
            t.literal[0] for t in triples if t.pred == name_slot and t.literal
        ]
        self.assertIn("Pipeline Test Person", name_literals)

    @override_settings(
        RDF_SYNC_ENABLED=True,
        RDF_ENDPOINT_URL="",
        RDF_RESOURCE_BASE_URI="http://test.heritagegraph/resource",
    )
    def test_rdf_signals_write_registry_triples_to_local_oxigraph(self):
        import tempfile
        from pathlib import Path

        try:
            import pyoxigraph  # noqa: F401
        except ImportError:
            self.skipTest("pyoxigraph not installed")

        with tempfile.TemporaryDirectory() as tmp:
            store_path = str(Path(tmp) / "oxigraph_test")
            with self.settings(OXIGRAPH_STORE_PATH=store_path):
                self.assertTrue(rdf_sync_enabled())

                response = self.client.post(
                    "/api/v1/cidoc/persons/",
                    {
                        "name": "Oxigraph Sync Person",
                        "title": "Oxigraph",
                        "description": "RDF signal integration test",
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                person = Person.objects.get(pk=response.json()["id"])
                subject_uri = _resource_uri(person)

                from apps.graph.kg_engine.store import _open_local_store
                from pyoxigraph import NamedNode

                # Use the engine's cached store handle (a separate Store() open
                # would deadlock on the RocksDB exclusive lock).
                store = _open_local_store(store_path)
                subj = NamedNode(subject_uri)

                # Curation gate: an unpublished (freshly contributed) entity must
                # NOT be projected to the public graph — only reviewed/published
                # rows reach RDF (apps.cidoc_data.publication_policy).
                pending = list(store.quads_for_pattern(subj, None, None, None))
                self.assertEqual(
                    len(pending),
                    0,
                    "Unpublished entity must not be projected before review",
                )

                # Once published, rdf_signals projects it into the local store.
                person.status = "accepted"
                person.save()
                quads = list(store.quads_for_pattern(subj, None, None, None))
                self.assertGreater(
                    len(quads),
                    0,
                    "Expected rdf_signals to write triples once the entity is published",
                )

                person_cls = _registry_person_class()
                class_type = expand_curie(str(person_cls["classUri"]))
                name_slot = expand_curie(
                    str(_field_by_key(person_cls, "name")["slot_uri"])
                )

                def _iri(term) -> str:
                    if term is None:
                        return ""
                    return getattr(term, "value", str(term))

                predicates = {_iri(q.predicate) for q in quads}
                type_objects = {
                    _iri(q.object)
                    for q in quads
                    if _iri(q.predicate) == RDF_TYPE_URI
                }
                self.assertIn(RDF_TYPE_URI, predicates, predicates)
                self.assertIn(class_type, type_objects, type_objects)
                self.assertIn(name_slot, predicates, predicates)


class RegistryJsonSchemaCoercionTest(TestCase):
    def test_model_instance_coerces_to_pk(self):
        from apps.cidoc_data.registry_validation import coerce_for_jsonschema

        loc = Location.objects.create(
            name="Coerce Test",
            type="temple",
            current_status="preserved",
        )
        self.assertEqual(coerce_for_jsonschema(loc), loc.pk)


class RegistrySnapshotAlignmentTest(TestCase):
    """Generated registry snapshot must match live YAML build."""

    def test_generated_snapshot_schema_version_matches_live_loader(self):
        from pathlib import Path

        root = Path(settings.BASE_DIR).parent
        snap_path = (
            root
            / "heritage_graph_ui"
            / "src"
            / "lib"
            / "ontology"
            / "registry.generated.json"
        )
        self.assertTrue(snap_path.is_file(), "Run: make generate")
        snap = json.loads(snap_path.read_text(encoding="utf-8"))
        live = get_effective_registry_payload()
        self.assertEqual(snap["schema_version"], live["schema_version"])
