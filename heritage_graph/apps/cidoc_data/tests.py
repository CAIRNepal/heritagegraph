import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient

from apps.cidoc_data.models import (
    Deity,
    Event,
    HistoricalPeriod,
    IconographicObject,
    Location,
    Person,
    Source,
    SyncreticRelationship,
    Tradition,
)


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
            biography="Lives in Kailash Mountain"
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
            coordinates="27.7104, 85.3482"
        )
        self.assertEqual(str(loc), "Pashupatinath Temple")
        self.assertEqual(loc.type, "temple")

    def test_invalid_location_type(self):
        loc = Location(
            name="FakePlace",
            type="invalid_type",
            current_status="preserved"
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
            recurrence="one_time"
        )
        self.assertEqual(str(e), "Royal Massacre")
        self.assertEqual(e.type, "historical")

    def test_invalid_event_type(self):
        e = Event(
            name="Weird Event",
            type="nonsense",
            description="No idea",
            recurrence="annual"
        )
        with self.assertRaises(ValidationError):
            e.full_clean()


class HistoricalPeriodTest(TestCase):
    def test_create_period(self):
        hp = HistoricalPeriod.objects.create(
            name="Lichhavi Era",
            start_year="c. 400 CE",
            end_year="c. 750 CE",
            description="Influential Nepali kingdom"
        )
        self.assertEqual(str(hp), "Lichhavi Era (c. 400 CE - c. 750 CE)")
        self.assertTrue(hp.created_at is not None)


class TraditionTest(TestCase):
    def test_create_tradition(self):
        t = Tradition.objects.create(
            name="Sati Pratha",
            type="ritual",
            description="Old banned practice",
            associated_materials=""
        )
        self.assertEqual(str(t), "Sati Pratha")
        self.assertEqual(t.type, "ritual")

    def test_invalid_tradition_type(self):
        t = Tradition(
            name="Strange",
            type="invalid",
            description="Nope"
        )
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
            archive_location="National Archive"
        )
        self.assertEqual(str(s), "History of Nepal")
        self.assertEqual(s.type, "book")

    def test_invalid_source_type(self):
        s = Source(
            title="Bad Source",
            authors="Someone",
            type="invalid"
        )
        with self.assertRaises(ValidationError):
            s.full_clean()



###################################################################################################
##                                       RELATIONSHIPS TESTING                                   ##
###################################################################################################


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
        self.user = User.objects.create_user(username="schema_test_user", password="x")
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
        self.assertIn("tenant_id", body)
        self.assertIn("degraded", body)
        etag = r1.headers.get("ETag")
        self.assertTrue(etag)
        r2 = self.client.get(url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(r2.status_code, 304)
