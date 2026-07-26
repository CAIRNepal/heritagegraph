"""The anonymous surfaces must not expose unreviewed or rejected records.

`/cidoc/search/` and `/cidoc/discovery/` were written as standalone function
views and never adopted the publication gate the ViewSets apply in
`get_queryset`. Both are reachable anonymously (no DEFAULT_PERMISSION_CLASSES
is configured, so DRF defaults to AllowAny), and the discovery queryset is also
the AI assistant's retrieval corpus — so a rejected claim was publicly
searchable and citable by the chatbot.
"""

from apps.assistant.services.retrieval import build_graph_context
from apps.cidoc_data.models import Monument, Person
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()

WITHHELD = "Zsecretwithheld"
PUBLISHED = "Zsecretpublished"


class PublicSurfaceVisibilityTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user("owner", password="x")
        cls.staff = User.objects.create_user("staffer", password="x", is_staff=True)

        cls.pending = Person.objects.create(
            name=f"{WITHHELD} Pending Person",
            status="pending_review",
            contributor="owner",
        )
        cls.rejected = Monument.objects.create(
            name=f"{WITHHELD} Rejected Monument",
            status="rejected",
            contributor="owner",
        )
        cls.published = Person.objects.create(
            name=f"{PUBLISHED} Accepted Person",
            status="accepted",
            contributor="owner",
        )

    def _search_names(self, term):
        resp = self.client.get(f"/api/v1/cidoc/search/?q={term}")
        self.assertEqual(resp.status_code, 200, resp.content)
        return {r["name"] for rows in resp.json().values() for r in rows}

    def _discovery_names(self, type_key, term):
        resp = self.client.get(f"/api/v1/cidoc/discovery/?type={type_key}&q={term}")
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        return {r["name"] for r in body["results"]}, body["counts"]

    def test_anonymous_search_hides_withheld_records(self):
        self.assertEqual(self._search_names(WITHHELD), set())

    def test_anonymous_search_still_returns_published_records(self):
        self.assertIn(self.published.name, self._search_names(PUBLISHED))

    def test_anonymous_discovery_hides_withheld_records(self):
        names, counts = self._discovery_names("persons", WITHHELD)
        self.assertEqual(names, set())
        # Facet counts leak existence even when rows are withheld from results.
        self.assertEqual(counts["persons"], 0)
        self.assertEqual(counts["monuments"], 0)

    def test_anonymous_discovery_still_returns_published_records(self):
        names, counts = self._discovery_names("persons", PUBLISHED)
        self.assertIn(self.published.name, names)
        self.assertEqual(counts["persons"], 1)

    def test_assistant_retrieval_never_grounds_on_withheld_records(self):
        text, sources = build_graph_context(WITHHELD)
        self.assertNotIn(WITHHELD, text)
        self.assertEqual(sources, [])

    def test_assistant_retrieval_still_sees_published_records(self):
        text, _ = build_graph_context(PUBLISHED)
        self.assertIn(self.published.name, text)

    def test_owner_can_search_their_own_pending_record(self):
        """Search matches detail-endpoint visibility: own rows stay reachable."""
        self.client.force_authenticate(user=self.owner)
        self.assertIn(self.pending.name, self._search_names(WITHHELD))

    def test_staff_can_search_withheld_records(self):
        self.client.force_authenticate(user=self.staff)
        names = self._search_names(WITHHELD)
        self.assertIn(self.pending.name, names)
        self.assertIn(self.rejected.name, names)
