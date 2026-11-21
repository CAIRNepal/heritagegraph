# HeritageGraph — test runners

This folder holds **E2E runner scripts and configuration** outside the Django app tree.
Django test modules remain under `heritage_graph/apps/` (required for `manage.py test` discovery).

## Quick start

```bash
# Full suite (40 tests)
make test-e2e

# Or directly
./tests/run_e2e.sh

# Core smoke only (11 tests)
./tests/run_e2e.sh --skip-unit

# With live HTTP probes (backend must be running)
PLATFORM_E2E_LIVE_URL=http://127.0.0.1:8000 ./tests/run_e2e.sh
```

## Layout

| File | Purpose |
|------|---------|
| [`config.py`](config.py) | Test module labels, coverage summary, live probe paths |
| [`run_platform_e2e.py`](run_platform_e2e.py) | **Canonical** Python runner |
| [`run_e2e.sh`](run_e2e.sh) | Shell wrapper (used by `make test-e2e`) |

## Where test code lives

| Area | Location |
|------|----------|
| Platform E2E (API + identity + KG) | `heritage_graph/apps/graph/test_platform_e2e.py` |
| Form → graph pipeline | `heritage_graph/apps/cidoc_data/test_e2e_pipeline.py` |
| Entity resolution | `heritage_graph/apps/cidoc_data/test_contribution_entity_resolution.py` |
| Museum enrichment | `heritage_graph/apps/graph/test_museum_graph_enrichment.py` |
| Contribution queue | `heritage_graph/apps/heritage_data/tests/` |

## Documentation

Full testing guide: [`documentation/testing/TESTING.md`](../documentation/testing/TESTING.md)

## Legacy entry point

`python manage.py run_platform_e2e` still works (thin wrapper around this runner).
