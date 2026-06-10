#!/usr/bin/env python3
"""Standalone platform E2E runner — canonical entry point (repo-root tests/)."""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND = REPO_ROOT / "heritage_graph"

sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DJANGO_ENV", "development")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")


def _probe_live(base: str) -> int:
    from tests.config import LIVE_HTTP_PROBES

    print(f"Live HTTP smoke ({base})")
    ok = 0
    for path in LIVE_HTTP_PROBES:
        url = f"{base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=8) as resp:
                status = resp.status
            if 200 <= status < 300:
                print(f"  OK   {path}")
                ok += 1
            else:
                print(f"  ??   {path} → {status}")
        except urllib.error.HTTPError as exc:
            print(f"  HTTP {exc.code} {path}")
        except Exception as exc:
            print(f"  FAIL {path}: {exc}")
    print(f"  Live probes: {ok}/{len(LIVE_HTTP_PROBES)} OK\n")
    return ok


def _print_summary() -> None:
    from tests.config import COVERAGE_AREAS, MANUAL_GAPS

    print("")
    print("Coverage areas verified:")
    for area in COVERAGE_AREAS:
        print(f"  • {area}")
    print("")
    print(f"Not covered by automated E2E (manual / optional): {MANUAL_GAPS}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run HeritageGraph platform E2E tests.")
    parser.add_argument(
        "--live-url",
        default=os.environ.get("PLATFORM_E2E_LIVE_URL", "").strip(),
        help="Optional backend base URL for live HTTP probes.",
    )
    parser.add_argument(
        "--skip-unit",
        action="store_true",
        help="Only run core platform E2E (11 tests).",
    )
    parser.add_argument("-v", "--verbosity", type=int, default=1, help="Django test verbosity.")
    args = parser.parse_args(argv)

    import django

    django.setup()

    from django.conf import settings
    from django.test.utils import get_runner
    from tests.config import CORE_E2E_LABELS, FULL_E2E_LABELS

    labels = CORE_E2E_LABELS if args.skip_unit else FULL_E2E_LABELS
    live_url = (args.live_url or "").rstrip("/")

    print("HeritageGraph platform E2E")
    print(f"  RDF_SYNC_ENABLED = {getattr(settings, 'RDF_SYNC_ENABLED', False)}")
    print(f"  Test modules     = {len(labels)}")

    if live_url:
        _probe_live(live_url)

    print("Running Django E2E test suite…")
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=args.verbosity)
    failures = test_runner.run_tests(list(labels))

    if failures:
        print(f"Platform E2E: FAILED ({failures} module(s))")
        return 1

    print("Platform E2E: all tests passed")
    _print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
