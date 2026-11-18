"""Writes that change curated data need the right role.

Each case was open before: any signed-in user (or, for person revisions,
anyone at all) could approve merges, retarget authority links, resolve curator
alerts, edit other people's comments, or rewrite partner institutions.
"""

from apps.cidoc_data.models import Person, PersonRevision
from apps.graph.models import PartnerInstitution
from apps.heritage_data.models import (
    Comments,
    CuratorAlert,
    MergeRequest,
    Project,
    ReconciledLink,
    ReviewerRole,
)
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()
DATA = "/api/v1/data/api"


@override_settings(RDF_SYNC_ENABLED=False)
class WritePermissionTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", email="o@example.com", password="pw")
        self.someone = User.objects.create_user(username="someone", email="s@example.com", password="pw")
        self.reviewer = User.objects.create_user(username="reviewer", email="r@example.com", password="pw")
        ReviewerRole.objects.create(user=self.reviewer, role="community_reviewer")
        self.moderator = User.objects.create_user(username="moderator", email="m@example.com", password="pw")
        self.moderator.groups.add(Group.objects.get_or_create(name="Moderators")[0])
        self.project = Project.objects.create(slug="p1", title="P1", owner=self.owner)
        self.mr = MergeRequest.objects.create(project=self.project, summary="merge", opened_by=self.owner)

    def _as(self, user):
        self.client.force_authenticate(user=user)

    def test_only_a_moderator_can_decide_a_merge_request(self):
        self._as(self.someone)
        for action in ("approve", "reject", "request-changes"):
            resp = self.client.post(f"{DATA}/merge-requests/{self.mr.pk}/{action}/", {}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, (action, resp.content))
        self.mr.refresh_from_db()
        self.assertEqual(self.mr.status, MergeRequest.STATUS_PENDING)

        self._as(self.moderator)
        resp = self.client.post(f"{DATA}/merge-requests/{self.mr.pk}/reject/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

    def test_only_the_opener_or_a_moderator_can_edit_or_delete_a_merge_request(self):
        self._as(self.someone)
        self.assertEqual(
            self.client.patch(f"{DATA}/merge-requests/{self.mr.pk}/", {"summary": "x"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(f"{DATA}/merge-requests/{self.mr.pk}/").status_code, status.HTTP_403_FORBIDDEN
        )
        self.assertTrue(MergeRequest.objects.filter(pk=self.mr.pk).exists())

    def test_reconciled_links_are_changed_by_reviewers_only(self):
        link = ReconciledLink.objects.create(entity_uri="urn:a", target_uri="http://www.wikidata.org/entity/Q1")
        self._as(self.someone)
        resp = self.client.post(
            f"{DATA}/reconciled-links/{link.pk}/update-target/",
            {"target_uri": "http://example.org/wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(self.client.delete(f"{DATA}/reconciled-links/{link.pk}/").status_code, status.HTTP_403_FORBIDDEN)
        link.refresh_from_db()
        self.assertEqual(link.target_uri, "http://www.wikidata.org/entity/Q1")

        self._as(self.reviewer)
        resp = self.client.post(
            f"{DATA}/reconciled-links/{link.pk}/update-target/",
            {"target_uri": "http://www.wikidata.org/entity/Q2"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

    def test_curator_alerts_are_resolved_by_reviewers_only(self):
        alert = CuratorAlert.objects.create(issue_type=CuratorAlert._meta.get_field("issue_type").choices[0][0])
        self._as(self.someone)
        self.assertEqual(
            self.client.post(f"{DATA}/curator-alerts/{alert.pk}/resolve/", {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self._as(self.reviewer)
        self.assertEqual(
            self.client.post(f"{DATA}/curator-alerts/{alert.pk}/resolve/", {}, format="json").status_code,
            status.HTTP_200_OK,
        )

    def test_a_comment_is_changed_only_by_its_author(self):
        comment = Comments.objects.create(user=self.owner, comment="mine")
        self._as(self.someone)
        self.assertEqual(
            self.client.patch(f"{DATA}/comments/{comment.pk}/", {"comment": "hijacked"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.delete(f"{DATA}/comments/{comment.pk}/").status_code, status.HTTP_403_FORBIDDEN)
        comment.refresh_from_db()
        self.assertEqual(comment.comment, "mine")

    def test_partner_institutions_are_staff_data(self):
        inst = PartnerInstitution.objects.create(name="A Museum")
        self._as(self.someone)
        resp = self.client.patch(f"/api/v1/graph/partner-institutions/{inst.pk}/", {"name": "Other"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/v1/graph/partner-institutions/").status_code, status.HTTP_200_OK)

    def test_person_revisions_are_not_open_to_anyone(self):
        person = Person.objects.create(name="Bhimsen Thapa", status="accepted")
        rev = PersonRevision.objects.create(person=person, snapshot={}, action="create")
        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.delete(f"/api/v1/cidoc/person_revisions/{rev.pk}/").status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self._as(self.someone)
        self.assertEqual(
            self.client.delete(f"/api/v1/cidoc/person_revisions/{rev.pk}/").status_code, status.HTTP_403_FORBIDDEN
        )
        self.assertTrue(PersonRevision.objects.filter(pk=rev.pk).exists())
