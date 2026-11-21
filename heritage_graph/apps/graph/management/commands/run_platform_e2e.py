"""Thin wrapper — canonical runner lives in repo-root tests/run_platform_e2e.py."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from django.core.management.base import BaseCommand


def _repo_root() -> Path:
    # heritage_graph/apps/graph/management/commands/run_platform_e2e.py → repo root
    return Path(__file__).resolve().parents[5]


class Command(BaseCommand):
    help = "Run platform E2E tests (delegates to tests/run_platform_e2e.py)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--live-url",
            default="",
            help="Optional backend base URL for live probes.",
        )
        parser.add_argument(
            "--skip-unit",
            action="store_true",
            help="Only run core platform E2E smoke tests.",
        )

    def handle(self, *args, **options) -> None:
        runner = _repo_root() / "tests" / "run_platform_e2e.py"
        cmd = [sys.executable, str(runner)]
        if options.get("skip_unit"):
            cmd.append("--skip-unit")
        live_url = (options.get("live_url") or "").strip()
        if live_url:
            cmd.extend(["--live-url", live_url])
        verbosity = int(options.get("verbosity") or 1)
        cmd.extend(["-v", str(verbosity)])
        result = subprocess.run(cmd, check=False)
        if result.returncode != 0:
            sys.exit(result.returncode)
