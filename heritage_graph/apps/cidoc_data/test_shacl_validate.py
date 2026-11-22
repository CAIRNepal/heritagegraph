"""Write-time SHACL validation is importable and actually rejects bad data.

The module once failed to import (two unclosed calls), which went unnoticed
because validation was off by default; enabling it would have broken every
publish. These tests keep it importable and keep the shapes biting.
"""

import importlib.util
import sys
from pathlib import Path

from apps.cidoc_data.rdf_entity_projection import _Triple
from apps.cidoc_data.shacl_validate import validate_projection_triples
from django.test import SimpleTestCase

HG = "https://cair-nepal.org/heritagegraph/"
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
LABEL = "http://www.w3.org/2000/01/rdf-schema#label"


class ShaclValidateTest(SimpleTestCase):
    def test_a_labelled_deity_conforms(self):
        s = f"{HG}resource/deity/1"
        conforms, _ = validate_projection_triples(
            [
                _Triple(s, RDF_TYPE, f"{HG}Deity", None),
                _Triple(s, LABEL, None, ("Vishnu", "")),
            ]
        )
        self.assertTrue(conforms)

    def test_a_deity_without_a_label_does_not(self):
        s = f"{HG}resource/deity/2"
        conforms, report = validate_projection_triples(
            [_Triple(s, RDF_TYPE, f"{HG}Deity", None)]
        )
        self.assertFalse(conforms, report)


class ShapeGeneratorTest(SimpleTestCase):
    def _generator(self):
        path = Path(__file__).resolve().parents[3] / "tools" / "emit_minimal_shacl.py"
        spec = importlib.util.spec_from_file_location("emit_minimal_shacl", path)
        module = importlib.util.module_from_spec(spec)
        sys.modules["emit_minimal_shacl"] = module
        spec.loader.exec_module(module)
        return module

    def test_crminf_expands_to_the_ontology_namespace(self):
        self.assertEqual(
            self._generator().expand_curie("crminf:I2_Belief"),
            "http://www.cidoc-crm.org/extensions/crminf/I2_Belief",
        )

    def test_an_unknown_prefix_is_an_error_not_a_guess(self):
        with self.assertRaises(ValueError):
            self._generator().expand_curie("nope:Thing")
