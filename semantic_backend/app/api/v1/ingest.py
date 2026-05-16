from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.ontology.validator import validate_graph
from app.rdf.mapper import MAPPER_REGISTRY
from app.rdf.provenance import (
    build_provenance_graph,
    create_ingestion_id,
    data_graph_uri,
    prov_graph_uri,
)
from app.storage.oxigraph import oxigraph

router = APIRouter()


class IngestRequest(BaseModel):
    entity_type: str
    payload: dict[str, Any]
    agent_id: str = "ui"
    source: str = "form"


class IngestResponse(BaseModel):
    ingestion_id: str
    data_graph: str
    prov_graph: str
    entity_uri: str
    triple_count: int


class BatchIngestRequest(BaseModel):
    entities: list[IngestRequest]


async def _ingest_one(req: IngestRequest) -> IngestResponse:
    mapper = MAPPER_REGISTRY.get(req.entity_type)
    if not mapper:
        raise HTTPException(400, f"Unknown entity type: {req.entity_type!r}")

    graph, entity_uri = mapper(req.payload)

    if settings.validate_on_ingest:
        valid, report = validate_graph(graph)
        if not valid:
            raise HTTPException(
                422,
                detail={"message": "SHACL validation failed", "report": report},
            )

    iid       = create_ingestion_id()
    data_g    = data_graph_uri(iid)
    prov_g    = prov_graph_uri(iid)
    prov_graph = build_provenance_graph(
        iid, req.agent_id, req.source, req.entity_type, 1
    )

    await oxigraph.insert_quads({data_g: graph, prov_g: prov_graph})

    return IngestResponse(
        ingestion_id=iid,
        data_graph=data_g,
        prov_graph=prov_g,
        entity_uri=str(entity_uri),
        triple_count=len(graph),
    )


@router.post("/entity", response_model=IngestResponse)
async def ingest_entity(req: IngestRequest) -> IngestResponse:
    return await _ingest_one(req)


@router.post("/batch")
async def ingest_batch(req: BatchIngestRequest) -> dict:
    results, errors = [], []
    for item in req.entities:
        try:
            results.append(await _ingest_one(item))
        except HTTPException as exc:
            errors.append({"entity": item.payload.get("name", "?"), "error": exc.detail})
    return {"ingested": len(results), "failed": len(errors), "results": results, "errors": errors}


@router.post("/jsonld")
async def ingest_jsonld(
    payload: dict[str, Any],
    agent_id: str = "ui",
    source: str = "jsonld",
) -> dict:
    from app.rdf.jsonld import parse_jsonld

    graph = parse_jsonld(payload)

    if settings.validate_on_ingest:
        valid, report = validate_graph(graph)
        if not valid:
            raise HTTPException(
                422,
                detail={"message": "SHACL validation failed", "report": report},
            )

    iid        = create_ingestion_id()
    data_g     = data_graph_uri(iid)
    prov_g     = prov_graph_uri(iid)
    prov_graph = build_provenance_graph(iid, agent_id, source, "jsonld", len(graph))

    await oxigraph.insert_quads({data_g: graph, prov_g: prov_graph})
    return {"ingestion_id": iid, "data_graph": data_g, "triple_count": len(graph)}
