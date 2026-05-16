from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.query import sparql as Q
from app.storage.oxigraph import oxigraph

router = APIRouter()


# ── Raw SPARQL proxy ─────────────────────────────────────────────────────────

@router.get("/sparql")
async def sparql_get(
    query: Annotated[str, Query(description="SPARQL 1.1 SELECT / ASK / CONSTRUCT query")],
    accept: str = "application/sparql-results+json",
) -> Response:
    result = await oxigraph.sparql_query(query, accept)
    body   = result if isinstance(result, str) else str(result)
    return Response(content=body, media_type=accept)


@router.post("/sparql")
async def sparql_post(body: dict) -> object:
    query  = body.get("query", "")
    accept = body.get("accept", "application/sparql-results+json")
    return await oxigraph.sparql_query(query, accept)


# ── Convenience endpoints ────────────────────────────────────────────────────

@router.get("/temples")
async def list_temples() -> object:
    return await oxigraph.sparql_query(Q.TEMPLES_WITH_LOCATION)


@router.get("/rituals")
async def rituals_at_place(place_id: str) -> object:
    place_uri = f"https://heritagegraph.org/place/{place_id}"
    return await oxigraph.sparql_query(Q.format_query(Q.RITUALS_AT_PLACE, place_uri=place_uri))


@router.get("/custody/{object_id}")
async def custody_chain(object_id: str) -> object:
    object_uri = f"https://heritagegraph.org/object/{object_id}"
    return await oxigraph.sparql_query(Q.format_query(Q.CUSTODY_CHAIN, object_uri=object_uri))


@router.get("/events")
async def events_in_range(start: str, end: str) -> object:
    return await oxigraph.sparql_query(
        Q.format_query(Q.EVENTS_IN_TIMERANGE, start=start, end=end)
    )


@router.get("/provenance/{entity_type}/{entity_id}")
async def entity_provenance(entity_type: str, entity_id: str) -> object:
    entity_uri = f"https://heritagegraph.org/{entity_type}/{entity_id}"
    return await oxigraph.sparql_query(
        Q.format_query(Q.PROVENANCE_FOR_ENTITY, entity_uri=entity_uri)
    )


@router.get("/conditions/{object_id}")
async def condition_history(object_id: str) -> object:
    object_uri = f"https://heritagegraph.org/temple/{object_id}"
    return await oxigraph.sparql_query(
        Q.format_query(Q.CONDITION_HISTORY, object_uri=object_uri)
    )


@router.get("/structures/{temple_id}")
async def temple_structures(temple_id: str) -> object:
    temple_uri = f"https://heritagegraph.org/temple/{temple_id}"
    return await oxigraph.sparql_query(
        Q.format_query(Q.STRUCTURES_OF_TEMPLE, temple_uri=temple_uri)
    )


@router.get("/festival/{festival_id}/deities")
async def festival_deities(festival_id: str) -> object:
    festival_uri = f"https://heritagegraph.org/festival/{festival_id}"
    return await oxigraph.sparql_query(
        Q.format_query(Q.DEITIES_FOR_FESTIVAL, festival_uri=festival_uri)
    )
