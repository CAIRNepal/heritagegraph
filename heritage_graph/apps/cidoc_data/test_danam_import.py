"""Unit tests for DANAM N-Quads parser (no DB)."""

from __future__ import annotations

from pathlib import Path

from django.test import SimpleTestCase

from apps.cidoc_data.danam_import.nq import parse_quad_line, build_full_index
from apps.cidoc_data.danam_import.materialize import _parse_wkt_point, _pick_label
from apps.cidoc_data.danam_import.nq import NqIndex, Term
from apps.cidoc_data.danam_import.constants import RDFS_LABEL


class NqParserTests(SimpleTestCase):
    def test_parse_iri_quad(self):
        q = parse_quad_line(
            "<http://ex/s> <http://ex/p> <http://ex/o> <http://ex/g> .\n"
        )
        assert q is not None
        self.assertEqual(q.s.value, "http://ex/s")
        self.assertEqual(q.o.value, "http://ex/o")
        self.assertEqual(q.g.value, "http://ex/g")

    def test_parse_lang_literal(self):
        q = parse_quad_line(
            '<http://ex/s> <http://www.w3.org/2000/01/rdf-schema#label> "मन्दिर"@ne .\n'
        )
        assert q is not None
        self.assertEqual(q.o.kind, "literal")
        self.assertEqual(q.o.value, "मन्दिर")
        self.assertEqual(q.o.lang, "ne")

    def test_parse_typed_literal(self):
        q = parse_quad_line(
            '<http://ex/s> <http://ex/p> "0.6"^^<http://www.w3.org/2001/XMLSchema#float> .\n'
        )
        assert q is not None
        self.assertEqual(q.o.value, "0.6")
        self.assertIn("float", q.o.datatype or "")

    def test_wkt_point(self):
        # CharField convention is lat,lon (WKT is lon lat).
        self.assertEqual(
            _parse_wkt_point("POINT(85.36222222 27.77805556)"),
            "27.77805556,85.36222222",
        )

    def test_pick_label_prefers_ne(self):
        idx = NqIndex()
        idx.by_subject["http://ex/s"] = [
            (RDFS_LABEL, Term("literal", "Temple", lang="en"), None),
            (RDFS_LABEL, Term("literal", "मन्दिर", lang="ne"), None),
        ]
        self.assertEqual(_pick_label(idx, "http://ex/s"), "मन्दिर")

    def test_build_index_from_fixture(self):
        sample = Path(__file__).with_name("_danam_sample.nq")
        sample.write_text(
            "\n".join(
                [
                    '<http://ex/a> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/heritagegraph/ArchitecturalStructure> <http://ex/g> .',
                    '<http://ex/a> <http://www.w3.org/2000/01/rdf-schema#label> "Test Temple"@en <http://ex/g> .',
                    "",
                ]
            ),
            encoding="utf-8",
        )
        self.addCleanup(sample.unlink)
        index = build_full_index(sample)
        self.assertEqual(index.quad_count, 2)
        self.assertEqual(len(index.sha256), 64)
        self.assertIn(
            "http://ex/a",
            index.type_subjects[
                "https://w3id.org/heritagegraph/ArchitecturalStructure"
            ],
        )
