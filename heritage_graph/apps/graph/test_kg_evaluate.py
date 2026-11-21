"""Unit tests for the gold-standard evaluation runner's scoring."""

from __future__ import annotations

from apps.graph.management.commands.kg_evaluate import _prf
from django.test import SimpleTestCase


class PrfTest(SimpleTestCase):
    def test_perfect(self):
        r = _prf(tp=10, fp=0, fn=0)
        self.assertEqual(r["precision"], 1.0)
        self.assertEqual(r["recall"], 1.0)
        self.assertEqual(r["f1"], 1.0)

    def test_balanced(self):
        r = _prf(tp=6, fp=2, fn=2)
        self.assertEqual(r["precision"], 0.75)
        self.assertEqual(r["recall"], 0.75)
        self.assertEqual(r["f1"], 0.75)

    def test_f1_harmonic(self):
        # P=0.5, R=1.0 -> F1 = 2*.5*1/(1.5) = 0.6667
        r = _prf(tp=2, fp=2, fn=0)
        self.assertEqual(r["precision"], 0.5)
        self.assertEqual(r["recall"], 1.0)
        self.assertEqual(r["f1"], 0.6667)

    def test_empty_is_none(self):
        r = _prf(tp=0, fp=0, fn=0)
        self.assertIsNone(r["precision"])
        self.assertIsNone(r["recall"])
        self.assertIsNone(r["f1"])

    def test_recall_zero_when_only_fn(self):
        r = _prf(tp=0, fp=0, fn=5)
        self.assertEqual(r["recall"], 0.0)
        self.assertIsNone(r["precision"])
