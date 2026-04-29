from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urljoin

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OxigraphClient:
    """
    Minimal SPARQL 1.1 client for Oxigraph.

    Oxigraph server (ghcr.io/oxigraph/oxigraph) exposes the SPARQL protocol at `/sparql`.
    """

    base_url: str

    @property
    def sparql_url(self) -> str:
        return urljoin(self.base_url.rstrip("/") + "/", "sparql")

    def select(self, sparql: str, *, timeout_s: int = 30) -> list[dict[str, str]]:
        resp = requests.get(
            self.sparql_url,
            params={"query": sparql},
            headers={"Accept": "application/sparql-results+json"},
            timeout=timeout_s,
        )
        resp.raise_for_status()
        bindings = resp.json().get("results", {}).get("bindings", [])
        return [{k: v.get("value", "") for k, v in row.items()} for row in bindings]

    def ask(self, sparql: str, *, timeout_s: int = 10) -> bool:
        resp = requests.get(
            self.sparql_url,
            params={"query": sparql},
            headers={"Accept": "application/sparql-results+json"},
            timeout=timeout_s,
        )
        resp.raise_for_status()
        return bool(resp.json().get("boolean", False))

    def update(self, sparql: str, *, timeout_s: int = 30) -> None:
        resp = requests.post(
            self.sparql_url,
            data={"update": sparql},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=timeout_s,
        )
        resp.raise_for_status()

    def insert_data(self, triples_nt: str) -> None:
        triples_nt = (triples_nt or "").strip()
        if not triples_nt:
            return
        self.update(f"INSERT DATA {{\n{triples_nt}\n}}")

    def health(self) -> bool:
        try:
            resp = requests.get(self.base_url.rstrip("/") + "/", timeout=5)
            return resp.status_code == 200
        except requests.RequestException:
            return False


def get_graph_client() -> OxigraphClient:
    return OxigraphClient(getattr(settings, "OXIGRAPH_URL", "http://localhost:7878"))


graph_client = get_graph_client()

