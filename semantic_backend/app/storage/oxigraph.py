from contextlib import asynccontextmanager
from typing import Any

import httpx
from rdflib import Graph

from app.core.config import settings


class OxigraphClient:
    """Async HTTP client for an Oxigraph server instance."""

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def connect(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()

    @property
    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("OxigraphClient.connect() not called")
        return self._client

    # ── SPARQL ──────────────────────────────────────────────────────────────

    async def sparql_query(
        self,
        query: str,
        accept: str = "application/sparql-results+json",
    ) -> Any:
        resp = await self._http.post(
            "/",
            content=query.encode(),
            headers={"Content-Type": "application/sparql-query", "Accept": accept},
        )
        resp.raise_for_status()
        if "json" in accept:
            return resp.json()
        return resp.text

    async def sparql_update(self, update: str) -> None:
        resp = await self._http.post(
            "/",
            content=update.encode(),
            headers={"Content-Type": "application/sparql-update"},
        )
        resp.raise_for_status()

    # ── Graph REST API ───────────────────────────────────────────────────────

    async def put_graph(self, graph_uri: str, graph: Graph) -> None:
        """Replace a named graph entirely."""
        resp = await self._http.put(
            "/store",
            params={"graph": graph_uri},
            content=graph.serialize(format="turtle").encode(),
            headers={"Content-Type": "text/turtle"},
        )
        resp.raise_for_status()

    async def delete_graph(self, graph_uri: str) -> None:
        resp = await self._http.delete("/store", params={"graph": graph_uri})
        resp.raise_for_status()

    async def insert_quads(self, graphs: dict[str, Graph]) -> None:
        """Batch-insert multiple named graphs in one SPARQL UPDATE."""
        parts: list[str] = []
        for graph_uri, g in graphs.items():
            nt = g.serialize(format="nt").strip()
            if nt:
                parts.append(f"GRAPH <{graph_uri}> {{\n{nt}\n}}")
        if not parts:
            return
        update = "INSERT DATA {\n" + "\n".join(parts) + "\n}"
        await self.sparql_update(update)

    # ── Health ───────────────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        try:
            resp = await self._http.get("/")
            return resp.status_code < 500
        except httpx.RequestError:
            return False


oxigraph = OxigraphClient(settings.oxigraph_url, settings.oxigraph_timeout)


@asynccontextmanager
async def lifespan(_app):
    await oxigraph.connect()
    yield
    await oxigraph.close()
