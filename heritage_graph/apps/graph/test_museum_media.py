"""Tests for museum narrative + imagery enrichment."""

from apps.cidoc_data.models import Monument
from apps.graph.kg_engine.museum_media import (
    _normalize_label,
    media_bundle_for_resource,
    wikimedia_bundle_for_label,
)
from django.test import TestCase


class MuseumMediaTests(TestCase):
    def test_normalize_label_aliases(self):
        self.assertEqual(_normalize_label("Swayambhunath Stupa"), "swayambhunath")

    def test_wikimedia_bundle_for_known_monument_label(self):
        bundle = wikimedia_bundle_for_label("Boudhanath Stupa")
        self.assertIsNotNone(bundle)
        assert bundle is not None
        self.assertTrue(bundle.images)
        self.assertTrue(bundle.image_url)
        self.assertEqual(bundle.image_source, "demo_wikimedia_label_match")

    def test_annapurna_does_not_steal_pokhara_foothills_image(self):
        """Short deity name must not substring-match Pokhara & Annapurna Foothills."""
        from apps.graph.kg_engine.museum_media import _demo_corpus_index, _demo_entry_for_label

        _demo_corpus_index.cache_clear()
        entry = _demo_entry_for_label("Annapurna")
        self.assertIsNotNone(entry)
        assert entry is not None
        self.assertTrue(entry.images)
        self.assertTrue(
            any("Annapurna" in url or "annapurna" in url.lower() for url in entry.images),
            msg=f"expected Annapurna imagery, got {entry.images}",
        )
        self.assertFalse(
            any("Phewa" in url for url in entry.images),
            msg="Annapurna must not inherit the Phewa Lake / Pokhara photo",
        )

    def test_orm_note_becomes_comment(self):
        monument = Monument.objects.create(
            name="Test Monument With Note",
            note="A UNESCO-listed stupa with documented ritual use.",
        )
        bundle = media_bundle_for_resource(
            "monument",
            monument.pk,
            label=monument.name,
            instance=monument,
        )
        self.assertIn("UNESCO", bundle.comment or "")
        self.assertEqual(bundle.narrative_source, "orm_note")
