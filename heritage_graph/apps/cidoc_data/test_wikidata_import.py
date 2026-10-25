"""The Wikidata importer: sourced rows, typed edges, no guessed merges.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test \
        apps.cidoc_data.test_wikidata_import -v2
"""

import json
import tempfile
from pathlib import Path

from apps.cidoc_data.models import (
    ArchitecturalStructure,
    Deity,
    Festival,
    HeritageAssertion,
    Location,
)
from apps.cidoc_data.rdf_entity_projection import _language_labels
from apps.cidoc_data.wikidata_import import CONTRIBUTOR, run_import
from django.test import TestCase, override_settings


def _ent(key, en, ne=None, role="seed", claims=None, **extra):
    labels = {"en": en, **({"ne": ne} if ne else {})}
    return {
        "key": key,
        "role": role,
        "labels": labels,
        "descriptions": {"en": f"{en} description"},
        "instanceOf": extra.pop("instanceOf", []),
        "country": ["Q837"],
        "claims": claims or {},
        "lastrevid": 42,
        **extra,
    }


SNAPSHOT = {
    "_provenance": {"retrieved": "2026-10-25"},
    "entities": {
        "Q1": _ent(
            "structure",
            "Nyatapola Temple",
            "न्यातपोल मन्दिर",
            instanceOf=["Q842402"],
            claims={"P131": ["Q2"], "P825": ["Q3"], "P527": ["Q2"]},
            coord={"lat": 27.67, "lon": 85.43},
            image="Nyatapola.jpg",
            inception={"time": "+1702-00-00T00:00:00Z", "precision": 9},
        ),
        "Q2": _ent(
            "location", "Bhaktapur", "भक्तपुर", role="neighbour", claims={"P131": ["Q9"]}
        ),
        "Q3": _ent("deity", "Siddhi Lakshmi", role="neighbour"),
        "Q4": _ent("festival", "Biska Jatra", "बिस्का जात्रा", claims={"P276": ["Q2"]}),
        # Two different temples that share a name must stay two records.
        "Q5": _ent("structure", "Manakamana Temple", role="sweep"),
        "Q6": _ent("structure", "Manakamana Temple", role="sweep"),
        "Q7": _ent(None, "Newar people", role="neighbour"),
    },
    "media": {
        "Nyatapola.jpg": {
            "url": "https://upload.wikimedia.org/x/Nyatapola.jpg",
            "license": "CC BY-SA 3.0",
            "artist": "A photographer",
            "source": "Wikimedia Commons",
        }
    },
}


@override_settings(RDF_SYNC_ENABLED=False)
class WikidataImportTests(TestCase):
    def _run(self, snapshot=SNAPSHOT):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(snapshot, fh)
        return run_import(Path(fh.name), seeds={})

    def test_rows_carry_source_labels_media_and_fields(self):
        self._run()
        temple = ArchitecturalStructure.objects.get(name="Nyatapola Temple")
        self.assertEqual(temple.status, "accepted")
        self.assertEqual(temple.contributor, CONTRIBUTOR)
        self.assertEqual(temple.source.name, "Wikidata")
        self.assertIn(
            "Wikidata Q1 (revision 42), retrieved 2026-10-25", temple.source_citation
        )
        self.assertEqual(temple.labels["ne"], "न्यातपोल मन्दिर")
        self.assertEqual(temple.media[0]["license"], "CC BY-SA 3.0")
        self.assertEqual(temple.structure_type, "Temple")
        self.assertEqual(temple.construction_date, "1702")
        self.assertEqual(str(temple.point).replace(" ", "")[:5], "27.67")

    def test_mapped_statements_become_sourced_typed_edges(self):
        self._run()
        props = set(
            HeritageAssertion.objects.filter(
                contributed_by=CONTRIBUTOR,
                asserted_property__startswith="relationship.",
            ).values_list("asserted_property", flat=True)
        )
        self.assertEqual(
            props,
            {
                "relationship.has_current_location",
                "relationship.dedicated_to",
                "relationship.took_place_at",
            },
        )
        edge = HeritageAssertion.objects.get(
            asserted_property="relationship.took_place_at"
        )
        self.assertEqual(edge.source.name, "Wikidata")
        self.assertEqual(edge.reconciliation_status, "accepted")
        self.assertIn("Q4 P276 Q2", edge.source_citation)

    def test_unmapped_statement_is_skipped_not_guessed(self):
        report = self._run()
        # "has part" from a temple to a town has no HeritageGraph reading.
        self.assertEqual(report.skipped.get("edge:no_rule:structure-P527-location"), 1)
        self.assertEqual(report.skipped.get("entity:unclassified"), 1)

    def test_same_name_items_are_not_merged(self):
        self._run()
        self.assertEqual(
            ArchitecturalStructure.objects.filter(name="Manakamana Temple").count(), 2
        )

    def test_existing_curated_record_is_enriched_not_overwritten(self):
        curated = Festival.objects.create(
            name="Biska Jatra",
            note="Curated note.",
            status="accepted",
            contributor="curator",
        )
        report = self._run()
        curated.refresh_from_db()
        self.assertEqual(Festival.objects.filter(name="Biska Jatra").count(), 1)
        self.assertEqual(curated.note, "Curated note.")
        self.assertEqual(curated.contributor, "curator")
        self.assertEqual(curated.labels["ne"], "बिस्का जात्रा")
        self.assertIn("festival:Biska Jatra <- Q4", report.matched_existing)

    def test_reimport_is_idempotent(self):
        self._run()
        counts = (
            ArchitecturalStructure.objects.count(),
            Location.objects.count(),
            Deity.objects.count(),
            HeritageAssertion.objects.count(),
        )
        report = self._run()
        self.assertEqual(report.created, {})
        self.assertEqual(
            counts,
            (
                ArchitecturalStructure.objects.count(),
                Location.objects.count(),
                Deity.objects.count(),
                HeritageAssertion.objects.count(),
            ),
        )


class LanguageLabelTests(TestCase):
    def test_english_name_is_tagged_en_and_other_languages_follow(self):
        row = ArchitecturalStructure(
            name="Nyatapola Temple",
            labels={"en": "Nyatapola Temple", "ne": "न्यातपोल मन्दिर"},
        )
        main, others = _language_labels(row, row.name)
        self.assertEqual(main, ("Nyatapola Temple", "@en"))
        self.assertEqual(others, [("न्यातपोल मन्दिर", "@ne")])

    @override_settings(RDF_DEFAULT_LANGUAGE="ne-Latn")
    def test_record_without_labels_keeps_the_corpus_default(self):
        row = ArchitecturalStructure(name="Kumari Ghar")
        self.assertEqual(
            _language_labels(row, row.name), (("Kumari Ghar", "@ne-Latn"), [])
        )
