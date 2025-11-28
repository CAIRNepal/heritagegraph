from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.cidoc_data.models import Person, Location, Event, HistoricalPeriod, Tradition, Source


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


