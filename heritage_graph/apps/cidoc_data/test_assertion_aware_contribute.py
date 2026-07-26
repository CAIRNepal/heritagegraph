"""The `/cidoc/contribute/<type>/` endpoints capture provenance inline.

These four routes look like duplicate registrations of the canonical
`/cidoc/structures/` family, but they are not: they bind assertion-aware
serializers that accept an inline `assertion` block and materialise a
`HeritageAssertion` (plus a `DataSource` for the citation) alongside the
record. The canonical endpoints have no such field, so a contribution posted
there carries no source, confidence or evidence.

Nothing in the UI calls them — `registry.generated.json` points every form at
the canonical endpoint — so this is a working capability that is simply not
wired up. Pinned here so it is not mistaken for dead code and deleted, which
would silently remove the only inline provenance path the API has.
"""

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    DataSource,
    HeritageAssertion,
)
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AssertionAwareContributeTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("prov", password="x", is_staff=True)

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def test_inline_assertion_creates_provenance_alongside_the_record(self):
        resp = self.client.post(
            "/api/v1/cidoc/contribute/structures/",
            {
                "name": "Provenance Test Temple",
                "structure_type": "Temple",
                "assertion": {
                    "source_type": "published",
                    "source_citation": "Slusser, Nepal Mandala (1982), p. 141.",
                    "source_url": "https://example.org/nepal-mandala",
                    "confidence": "likely",
                },
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)

        structure = ArchitecturalStructure.objects.get(pk=resp.json()["id"])
        assertion = HeritageAssertion.objects.filter(
            object_id=str(structure.pk)
        ).first()
        self.assertIsNotNone(
            assertion, "inline assertion block did not produce a HeritageAssertion"
        )
        self.assertEqual(assertion.confidence, "likely")
        self.assertTrue(
            DataSource.objects.filter(
                citation="Slusser, Nepal Mandala (1982), p. 141."
            ).exists(),
            "citation did not materialise a DataSource",
        )

    def test_canonical_endpoint_has_no_inline_provenance_field(self):
        """The gap this endpoint exists to close, stated as an assertion."""
        resp = self.client.post(
            "/api/v1/cidoc/structures/",
            {
                "name": "No Provenance Temple",
                "structure_type": "Temple",
                "assertion": {"confidence": "likely"},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        structure = ArchitecturalStructure.objects.get(pk=resp.json()["id"])
        self.assertFalse(
            HeritageAssertion.objects.filter(object_id=str(structure.pk)).exists(),
            "canonical endpoint unexpectedly grew inline assertion support — "
            "if it did, the contribute/ routes can be retired",
        )
