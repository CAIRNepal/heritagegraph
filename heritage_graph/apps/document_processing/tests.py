from django.test import SimpleTestCase

from apps.document_processing.services.review_state import merge_ingestion_review_state


class MergeIngestionReviewStateTests(SimpleTestCase):
    def test_merge_field_decisions_nested(self):
        base = {"field_decisions": {"u1": {"edited_value": "hello", "uncertain": False}}}
        patch = {"field_decisions": {"u1": {"uncertain": True}}}
        merged = merge_ingestion_review_state(base, patch)
        self.assertTrue(merged["field_decisions"]["u1"]["uncertain"])
        self.assertEqual(merged["field_decisions"]["u1"]["edited_value"], "hello")

    def test_remove_field_decision_with_null(self):
        base = {"field_decisions": {"u1": {"edited_value": "x"}}}
        patch = {"field_decisions": {"u1": None}}
        merged = merge_ingestion_review_state(base, patch)
        self.assertNotIn("u1", merged.get("field_decisions", {}))
