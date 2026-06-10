"""Platform E2E test configuration (repo-root tests/)."""

from __future__ import annotations

# Django test labels — dependency order (fast unit tests last).
FULL_E2E_LABELS: tuple[str, ...] = (
    "apps.graph.test_platform_e2e",
    "apps.cidoc_data.test_e2e_pipeline",
    "apps.cidoc_data.test_contribution_entity_resolution",
    "apps.cidoc_data.test_canonical_record_selection",
    "apps.cidoc_data.test_publication_policy",
    "apps.graph.test_museum_graph_enrichment",
    "apps.graph.test_museum_media",
    "apps.heritage_data.test_cultural_entity_kg",
    "apps.heritage_data.tests.test_contribution_queue_api",
    "apps.graph.test_kg_evaluate",
)

CORE_E2E_LABELS: tuple[str, ...] = (
    "apps.graph.test_platform_e2e",
    "apps.cidoc_data.test_e2e_pipeline",
)

COVERAGE_AREAS: tuple[str, ...] = (
    "Health / readiness probes",
    "Public discovery + search + schema registry",
    "KG stats + graph API (museum/graphview)",
    "Contribution POST → CulturalEntity + identity resolution",
    "Duplicate contribution → cluster link + identity candidate",
    "suggest-duplicates API (canonical member ranking)",
    "Contribution queue + epistemic review queue (reviewer)",
    "RDF projection on accepted records",
    "Full form→graph pipeline (test_e2e_pipeline)",
    "Entity resolution + canonical selection unit tests",
    "Museum enrichment + cultural entity KG sync",
)

LIVE_HTTP_PROBES: tuple[str, ...] = (
    "/health/",
    "/health/ready/",
    "/api/v1/cidoc/discovery/",
    "/api/v1/cidoc/kg/stats/",
    "/api/v1/cidoc/schema/registry/",
)

MANUAL_GAPS: str = (
    "Next.js UI, Google OAuth login, OCR pipeline (suspended), "
    "OpenRouter assistant (needs API key), Traefik TLS, production deploy."
)

# Django test modules live under heritage_graph/apps/ (discovery requirement).
TEST_MODULE_ROOT = "heritage_graph/apps"
