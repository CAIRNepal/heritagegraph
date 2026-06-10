"""Smoke test: every navigable ontology list API returns 200 for knowledge tables."""

from __future__ import annotations

from pathlib import Path

import yaml
from django.test import TestCase
from rest_framework.test import APIClient


def _navigable_list_endpoints() -> list[tuple[str, str]]:
    classmap_path = Path(__file__).resolve().parents[3] / "tools" / "ui-classmap.yaml"
    payload = yaml.safe_load(classmap_path.read_text(encoding="utf-8"))
    out: list[tuple[str, str]] = []
    for row in payload.get("classes") or []:
        if not row.get("navigable"):
            continue
        key = row["key"]
        ep = (row.get("apiEndpoint") or "").strip().strip("/")
        if ep:
            out.append((key, f"/{ep}/"))
    return out


class KnowledgeListApiSmokeTest(TestCase):
    """Guards `/knowledge/<domain>` GenericDataTable fetches."""

    def setUp(self):
        self.client = APIClient()

    def test_all_navigable_list_endpoints_respond(self):
        for key, path in _navigable_list_endpoints():
            with self.subTest(registry_key=key, path=path):
                resp = self.client.get(path, {"limit": 5})
                self.assertEqual(
                    resp.status_code,
                    200,
                    f"{key} list failed: {resp.content[:200]!r}",
                )
                body = resp.json()
                self.assertTrue(
                    isinstance(body, dict) and "results" in body
                    or isinstance(body, list),
                    f"{key}: unexpected list payload shape",
                )
