from typing import Any

from fastapi import APIRouter, HTTPException
from rdflib import Graph

from app.ontology.validator import validate_graph
from app.rdf.jsonld import parse_jsonld

router = APIRouter()


@router.post("/jsonld")
async def validate_jsonld_payload(payload: dict[str, Any]) -> dict:
    try:
        graph = parse_jsonld(payload)
    except Exception as exc:
        raise HTTPException(400, f"JSON-LD parse error: {exc}") from exc

    valid, report = validate_graph(graph)
    return {
        "valid":        valid,
        "triple_count": len(graph),
        "report":       report if not valid else None,
    }


@router.post("/turtle")
async def validate_turtle(body: dict) -> dict:
    g = Graph()
    try:
        g.parse(data=body.get("turtle", ""), format="turtle")
    except Exception as exc:
        raise HTTPException(400, f"Turtle parse error: {exc}") from exc

    valid, report = validate_graph(g)
    return {
        "valid":        valid,
        "triple_count": len(g),
        "report":       report if not valid else None,
    }


@router.post("/reload-shapes")
async def reload_shapes() -> dict:
    from app.ontology.validator import reload_shapes as _reload
    _reload()
    return {"message": "SHACL shapes reloaded"}
