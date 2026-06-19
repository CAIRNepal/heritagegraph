"""
Management command: python manage.py shacl_validate --project <uuid>

Exits 0 on clean graph, 1 if violations are found.
"""

from __future__ import annotations

import json
import sys

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run SHACL validation on a project named graph."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            required=True,
            metavar="UUID",
            help="UUID of the project to validate.",
        )
        parser.add_argument(
            "--shapes",
            default=None,
            metavar="PATH",
            help="Path to SHACL shapes .ttl file (optional; uses default if omitted).",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            default=False,
            help="Output report as JSON instead of human-readable text.",
        )

    def handle(self, *args, **options):
        from apps.graph.shacl_validate import check_pid_uniqueness, validate_project_graph

        project_id = options["project"]
        shapes_path = options.get("shapes")
        as_json = options.get("json", False)

        self.stdout.write(f"Validating project {project_id}…")
        report = validate_project_graph(project_id, shapes_path=shapes_path)
        pid_collisions = check_pid_uniqueness(project_id)

        if as_json:
            payload = report.as_dict()
            payload["pid_collisions"] = pid_collisions
            self.stdout.write(json.dumps(payload, indent=2))
        else:
            if report.conforms and not pid_collisions:
                self.stdout.write(self.style.SUCCESS("✓ Validation passed — no violations."))
            else:
                if not report.conforms:
                    self.stdout.write(
                        self.style.ERROR(f"✗ {len(report.violations)} SHACL violation(s):")
                    )
                    for v in report.violations:
                        self.stdout.write(
                            f"  [{v.severity}] {v.shape}\n"
                            f"    focus: {v.focus_node}\n"
                            f"    msg:   {v.message}"
                        )
                if pid_collisions:
                    self.stdout.write(
                        self.style.WARNING(
                            f"\n⚠ {len(pid_collisions)} PID collision(s) with main graph:"
                        )
                    )
                    for pid in pid_collisions:
                        self.stdout.write(f"  {pid}")

        if not report.conforms or pid_collisions:
            sys.exit(1)
