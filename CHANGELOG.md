# Changelog

All notable changes to HeritageGraph are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Gold-standard evaluation runner** (`manage.py kg_evaluate`) — precision / recall / F1
  for type assignment, relationship triples, and external alignment against
  `evaluation/gold/`.
- **Linked Yale LUX layer** in the museum projection — a connected sample of imported
  LUX stubs is surfaced as a clearly-tagged external layer (`sourceLayer: lux`,
  configurable via `RDF_LUX_SAMPLE_LIMIT`), kept separate from the curated graph.
- Release metadata: `.zenodo.json`, versioned `CITATION.cff`, this changelog.

### Changed
- **Curation gate at projection time** — RDF projection now publishes only entities
  in a published review status (`apps.cidoc_data.publication_policy`), and the public
  `kg/graph` defaults to `scope=reviewed` (unauthenticated callers cannot request the
  unreviewed graph).
- CIDOC-CRM/LinkedArt interop scaffolding added to the ontology for LUX alignment
  (non-contributable classes, kept out of the contribution forms).

### Fixed
- Embedded-store read coherence: reads reuse the process's read-write handle so
  freshly written edges/deletes are visible (dev/embedded only).
- Cultural Entity contribution pipeline (serializer, projection, museum-renderable type).
- Green test suite (58 tests): publication-gated projection test and the LUX
  museum-projection mock updated for the sample path.

## [0.1.0] - 2026-06-10

Initial public baseline: CIDOC-CRM knowledge-graph engine on Oxigraph with a
contribution → review → projection pipeline, provenance partitions, SHACL,
RDFS/OWL inference, FAIR publishing (nanopublications, RDF-star, linksets,
VoID/DCAT, SKOS), and graph / atlas / museum frontends.
