"""List/retrieve visibility and published-edit re-review for ContributionFlowMixin."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.cidoc_data.models import Location
from apps.heritage_data.models import CulturalEntity, Revision

User = get_user_model()


class CidocListVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="contrib_a", email="contrib_a@example.com", password="x"
        )
        self.other = User.objects.create_user(
            username="contrib_b", email="contrib_b@example.com", password="x"
        )
        self.staff = User.objects.create_user(
            username="staff_user",
            email="staff@example.com",
            password="x",
            is_staff=True,
        )

        self.published = Location.objects.create(
            name="Published Temple",
            type="temple",
            current_status="preserved",
            contributor="contrib_a",
            status="accepted",
        )
        self.pending_own = Location.objects.create(
            name="Pending Own",
            type="temple",
            current_status="preserved",
            contributor="contrib_a",
            status="pending_review",
        )
        self.pending_other = Location.objects.create(
            name="Pending Other",
            type="temple",
            current_status="preserved",
            contributor="contrib_b",
            status="pending_review",
        )
        self.legacy = Location.objects.create(
            name="Legacy Null Status",
            type="temple",
            current_status="preserved",
            contributor="contrib_b",
            status=None,
        )

    def _list_ids(self, **params) -> list[int]:
        resp = self.client.get("/cidoc/locations/", params)
        self.assertEqual(resp.status_code, 200, resp.content[:300])
        return [row["id"] for row in resp.json()["results"]]

    def test_anonymous_list_excludes_withheld_rows(self):
        ids = self._list_ids()
        self.assertIn(self.published.id, ids)
        self.assertIn(self.legacy.id, ids)
        self.assertNotIn(self.pending_own.id, ids)
        self.assertNotIn(self.pending_other.id, ids)

    def test_authenticated_default_list_same_as_anonymous(self):
        self.client.force_authenticate(self.owner)
        ids = self._list_ids()
        self.assertIn(self.published.id, ids)
        self.assertNotIn(self.pending_own.id, ids)

    def test_owner_sees_own_pending_via_status_filter(self):
        self.client.force_authenticate(self.owner)
        ids = self._list_ids(status="pending_review")
        self.assertIn(self.pending_own.id, ids)
        self.assertNotIn(self.pending_other.id, ids)

    def test_mine_returns_all_owner_rows(self):
        self.client.force_authenticate(self.owner)
        ids = self._list_ids(mine="1")
        self.assertIn(self.published.id, ids)
        self.assertIn(self.pending_own.id, ids)
        self.assertNotIn(self.pending_other.id, ids)

    def test_staff_all_includes_withheld(self):
        self.client.force_authenticate(self.staff)
        ids = self._list_ids(all="1")
        self.assertIn(self.published.id, ids)
        self.assertIn(self.pending_own.id, ids)
        self.assertIn(self.pending_other.id, ids)

    def test_retrieve_withheld_requires_owner_or_staff(self):
        url = f"/cidoc/locations/{self.pending_other.id}/"
        anon = self.client.get(url)
        self.assertEqual(anon.status_code, 404)

        self.client.force_authenticate(self.owner)
        own = self.client.get(f"/cidoc/locations/{self.pending_own.id}/")
        self.assertEqual(own.status_code, 200)

        self.client.force_authenticate(self.staff)
        staff = self.client.get(url)
        self.assertEqual(staff.status_code, 200)


class PublishedEditResubmitTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="editor1", email="editor1@example.com", password="x"
        )
        self.client.force_authenticate(self.user)

        self.location = Location.objects.create(
            name="Editable Shrine",
            type="temple",
            current_status="preserved",
            contributor="editor1",
            status="accepted",
        )
        self.entity = CulturalEntity.objects.create(
            name="Editable Shrine",
            category="other",
            status="accepted",
            contributor=self.user,
        )
        Revision.objects.create(
            entity=self.entity,
            data={"name": "Editable Shrine", "_cidoc_model": "Location", "_cidoc_id": self.location.pk},
            revision_number=1,
            created_by=self.user,
        )

    def test_patch_published_row_requeues_review(self):
        resp = self.client.patch(
            f"/cidoc/locations/{self.location.id}/",
            {"description": "Updated after acceptance"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content[:300])

        # Phase 0 semantics: the published row is never edited in place — the
        # accepted content stays live while the proposal goes through review.
        self.location.refresh_from_db()
        self.assertEqual(self.location.status, "accepted")
        self.assertNotEqual(self.location.description, "Updated after acceptance")

        # The proposal itself is staged on the wrapper as a new revision.
        self.entity.refresh_from_db()
        self.assertEqual(self.entity.status, "pending_review")
        self.assertGreaterEqual(self.entity.revisions.count(), 2)
        self.assertEqual(
            self.entity.current_revision.data.get("description"),
            "Updated after acceptance",
        )
