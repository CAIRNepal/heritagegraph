from fastapi import FastAPI

from app.api.v1 import ingest, query, validate
from app.storage.oxigraph import lifespan

app = FastAPI(
    title="HeritageGraph Semantic Backend",
    description="CIDOC-CRM / PROV-O knowledge graph API for Nepalese cultural heritage",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(ingest.router,   prefix="/api/v1/ingest",   tags=["ingest"])
app.include_router(query.router,    prefix="/api/v1/query",    tags=["query"])
app.include_router(validate.router, prefix="/api/v1/validate", tags=["validate"])


@app.get("/health", tags=["ops"])
async def health() -> dict:
    from app.storage.oxigraph import oxigraph
    ok = await oxigraph.health_check()
    return {"status": "ok" if ok else "degraded", "oxigraph": ok}
