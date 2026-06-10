"""API contract tests for contribution queue tab filters and reviewer applications."""

from __future__ import annotations

from apps.heritage_data.models import CulturalEntity, ReviewerApplication
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class ContributionQueueApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.contributor = User.objects.create_user(
            username="contrib",
            email="contrib@example.com",
            password="test-pass-123",
        )
        self.entity = CulturalEntity.objects.create(
            name="Test Stupa",
            description="Queue test",
            category="monument",
            status="pending_review",
            contributor=self.contributor,
        )

    def test_queue_counts_returns_tab_keys(self):
        response = self.client.get("/api/v1/data/contribution-queue/queue-counts/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        for key in ("all", "new_claims", "conflicts", "flagged", "expiring", "forks"):
            self.assertIn(key, body)

    def test_queue_tab_new_claims_filters_list(self):
        response = self.client.get(
            "/api/v1/data/contribution-queue/",
            {"queue_tab": "new_claims", "limit": 50},
        )
        self.assertEqual(response.status_code, 200)
        ids = {row["entity_id"] for row in response.json()["results"]}
        self.assertIn(str(self.entity.entity_id), ids)


class ReviewerApplicationApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="applicant",
            email="applicant@example.com",
            password="test-pass-123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_withdraw_mine_deletes_pending_application(self):
        app = ReviewerApplication.objects.create(
            user=self.user,
            message="Please grant reviewer access",
            status="pending",
        )
        response = self.client.post(
            "/api/v1/data/reviewer-applications/mine/withdraw/"
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ReviewerApplication.objects.filter(pk=app.pk).exists())
