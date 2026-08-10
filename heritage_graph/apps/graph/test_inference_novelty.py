"""Unit tests for the OWL-RL novelty metric.

`novelty_rate` used to be `derived / derived`, which is 1.0 by construction and
measures nothing. It now reports the share of derived triples that carry actual
domain knowledge, so these tests pin down what counts as a tautology.

Run:
    cd heritage_graph
    DJANGO_ENV=development python manage.py test apps.graph.test_inference_novelty -v2
"""

from __future__ import annotations

from apps.graph.kg_engine.inference import (
    _derived_triples,
    _is_tautological,
    _partition_derived,
)
from django.test import SimpleTestCase

CRM = "http://www.cidoc-crm.org/cidoc-crm/"
HG = "https://w3id.org/heritagegraph/resource/"
RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
OWL_THING = "http://www.w3.org/2002/07/owl#Thing"
OWL_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs"
RDFS_SUBCLASS = "http://www.w3.org/2000/01/rdf-schema#subClassOf"


class TautologyTest(SimpleTestCase):
    def test_universal_class_membership_is_tautological(self):
        self.assertTrue(_is_tautological((f"{HG}structure/1", RDF_TYPE, OWL_THING)))

    def test_reflexive_identity_is_tautological(self):
        subject = f"{HG}structure/1"
        self.assertTrue(_is_tautological((subject, OWL_SAME_AS, subject)))

    def test_reflexive_subsumption_is_tautological(self):
        cls = f"{CRM}E22_Human-Made_Object"
        self.assertTrue(_is_tautological((cls, RDFS_SUBCLASS, cls)))

    def test_vocabulary_closure_is_tautological(self):
        self.assertTrue(
            _is_tautological(
                (
                    "http://www.w3.org/2000/01/rdf-schema#Resource",
                    RDF_TYPE,
                    OWL_THING,
                )
            )
        )

    def test_domain_typing_is_informative(self):
        self.assertFalse(
            _is_tautological(
                (f"{HG}structure/1", RDF_TYPE, f"{CRM}E22_Human-Made_Object")
            )
        )

    def test_non_reflexive_identity_is_informative(self):
        self.assertFalse(
            _is_tautological(
                (
                    f"{HG}structure/1",
                    OWL_SAME_AS,
                    "http://www.wikidata.org/entity/Q42",
                )
            )
        )

    def test_non_reflexive_subsumption_is_informative(self):
        self.assertFalse(
            _is_tautological(
                (
                    f"{HG}ontology/ReligiousStructure",
                    RDFS_SUBCLASS,
                    f"{CRM}E22_Human-Made_Object",
                )
            )
        )


class PartitionTest(SimpleTestCase):
    def test_derived_excludes_already_asserted(self):
        asserted = (f"{HG}structure/1", RDF_TYPE, f"{CRM}E22_Human-Made_Object")
        entailed = (f"{HG}structure/1", RDF_TYPE, OWL_THING)

        derived = _derived_triples({asserted}, {asserted, entailed})

        self.assertEqual(derived, {entailed})

    def test_novelty_rate_is_not_one_by_construction(self):
        """The old metric could only ever return 1.0. This one discriminates."""
        informative = (
            f"{HG}structure/1",
            RDF_TYPE,
            f"{CRM}E22_Human-Made_Object",
        )
        tautologies = {(f"{HG}structure/{i}", RDF_TYPE, OWL_THING) for i in range(3)}

        novel, taut = _partition_derived({informative} | tautologies)

        self.assertEqual(novel, {informative})
        self.assertEqual(len(taut), 3)
        self.assertEqual(len(novel) / (len(novel) + len(taut)), 0.25)

    def test_all_tautological_yields_zero_novelty(self):
        novel, taut = _partition_derived({(f"{HG}structure/1", RDF_TYPE, OWL_THING)})

        self.assertEqual(novel, set())
        self.assertEqual(len(taut), 1)
