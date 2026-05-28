"""Tests for project-based contribution workspace APIs."""

from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.heritage_data.models import (
    CulturalEntity,
    Project,
    ProjectAsset,
    ProjectEntity,
    ProjectMembership,
)

User = get_user_model()


def _pdf_file(name="sample.pdf"):
    return SimpleUploadedFile(
        name,
        b"%PDF-1.4 minimal",
        content_type="application/pdf",
    )


TEST_STORAGE = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


@override_settings(STORAGES=TEST_STORAGE, MEDIA_ROOT="/tmp/hg_test_media")
class ProjectWorkspaceAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="pass",
        )
        self.other = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="pass",
        )
        self.reviewer = User.objects.create_user(
            username="reviewer",
            email="reviewer@example.com",
            password="pass",
        )
        Group.objects.get_or_create(name="Reviewers")
        self.reviewer.groups.add(Group.objects.get(name="Reviewers"))

        self.project = Project.objects.create(
            slug="test-project",
            title="Test Project",
            owner=self.owner,
        )
        ProjectMembership.objects.create(
            project=self.project,
            user=self.owner,
            role=ProjectMembership.ROLE_OWNER,
            invited_by=self.owner,
        )

    def _url(self, path: str) -> str:
        return f"/api/v1/data/projects/{self.project.slug}/{path}"

    @patch("apps.document_processing.tasks.classify_and_route_document.delay")
    def test_upload_without_ocr_does_not_queue_task(self, mock_delay):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            self._url("assets/upload/"),
            {"file": _pdf_file(), "role": "evidence"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json().get("ocr_status"), "not_started")
        mock_delay.assert_not_called()
        asset = ProjectAsset.objects.get(project=self.project)
        self.assertTrue(asset.media.ocr_deferred)

    @patch("apps.document_processing.tasks.classify_and_route_document.delay")
    def test_start_ocr_queues_task_once(self, mock_delay):
        self.client.force_authenticate(user=self.owner)
        upload = self.client.post(
            self._url("assets/upload/"),
            {"file": _pdf_file("doc.pdf"), "role": "evidence"},
            format="multipart",
        )
        self.assertEqual(upload.status_code, 201)
        asset_id = upload.json()["id"]
        mock_delay.reset_mock()

        start = self.client.post(self._url(f"assets/{asset_id}/start-ocr/"), {})
        self.assertEqual(start.status_code, 200)
        mock_delay.assert_called_once()

        start2 = self.client.post(self._url(f"assets/{asset_id}/start-ocr/"), {})
        self.assertEqual(start2.status_code, 200)
        mock_delay.assert_called_once()

    def test_contributor_cannot_approve_project(self):
        self.client.force_authenticate(user=self.owner)
        self.project.state = Project.STATE_IN_REVIEW
        self.project.save(update_fields=["state", "updated_at"])

        res = self.client.post(
            f"/api/v1/data/projects/{self.project.slug}/transition/",
            {"target_state": Project.STATE_APPROVED},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_reviewer_can_approve_project(self):
        self.project.state = Project.STATE_IN_REVIEW
        self.project.visibility = Project.VISIBILITY_PUBLIC
        self.project.save(update_fields=["state", "visibility", "updated_at"])
        self.client.force_authenticate(user=self.reviewer)

        res = self.client.post(
            f"/api/v1/data/projects/{self.project.slug}/transition/",
            {"target_state": Project.STATE_APPROVED},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.project.refresh_from_db()
        self.assertEqual(self.project.state, Project.STATE_APPROVED)

    def test_idor_upload_to_private_project_denied(self):
        private = Project.objects.create(
            slug="private-proj",
            title="Private",
            owner=self.owner,
            visibility=Project.VISIBILITY_PRIVATE,
        )
        self.client.force_authenticate(user=self.other)
        res = self.client.post(
            f"/api/v1/data/projects/{private.slug}/assets/upload/",
            {"file": _pdf_file("x.pdf"), "role": "evidence"},
            format="multipart",
        )
        self.assertIn(res.status_code, (403, 404))

    def test_allowed_transitions_on_detail(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"/api/v1/data/projects/{self.project.slug}/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIn("allowed_transitions", body)
        self.assertIn(Project.STATE_IN_REVIEW, body["allowed_transitions"])
        self.assertNotIn(Project.STATE_APPROVED, body["allowed_transitions"])

    def test_submit_for_review_blocked_without_requirements(self):
        self.project.abstract = ""
        self.project.save(update_fields=["abstract", "updated_at"])
        self.client.force_authenticate(user=self.owner)

        res = self.client.post(
            f"/api/v1/data/projects/{self.project.slug}/transition/",
            {"target_state": Project.STATE_IN_REVIEW},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertIsInstance(body.get("blockers"), list)
        self.assertTrue(len(body["blockers"]) > 0)

    def test_project_graph_returns_linked_entities(self):
        entity = CulturalEntity.objects.create(
            name="Taumadhi Square",
            description="Bhaktapur site",
            category="monument",
            contributor=self.owner,
        )
        ProjectEntity.objects.create(
            project=self.project,
            entity=entity,
            added_by=self.owner,
        )
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(self._url("graph/"))
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(len(body["nodes"]), 1)
        self.assertEqual(body["nodes"][0]["id"], str(entity.entity_id))

    def test_in_review_workspace_blocks_asset_upload(self):
        self.project.state = Project.STATE_IN_REVIEW
        self.project.save(update_fields=["state", "updated_at"])
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            self._url("assets/upload/"),
            {"file": _pdf_file("blocked.pdf"), "role": "evidence"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 403)
