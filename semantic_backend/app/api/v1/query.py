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
    q      = body.get("query", "")
    accept = body.get("accept", "application/sparql-results+json")
    return await oxigraph.sparql_query(q, accept)


# ── Convenience endpoints ────────────────────────────────────────────────────

@router.get("/temples")
async def list_temples() -> object:
    return await oxigraph.sparql_query(Q.TEMPLES_WITH_LOCATION())


@router.get("/activities")
async def activities_at_place(place_id: str) -> object:
    place_uri = f"https://heritagegraph.org/place/{place_id}"
    return await oxigraph.sparql_query(Q.ACTIVITIES_AT_PLACE(place_uri))


@router.get("/custody/{object_id}")
async def custody_chain(object_id: str) -> object:
    object_uri = f"https://heritagegraph.org/object/{object_id}"
    return await oxigraph.sparql_query(Q.CUSTODY_CHAIN(object_uri))


@router.get("/events")
async def events_in_range(start: str, end: str) -> object:
    return await oxigraph.sparql_query(Q.EVENTS_IN_TIMERANGE(start, end))


@router.get("/provenance/{entity_type}/{entity_id}")
async def entity_provenance(entity_type: str, entity_id: str) -> object:
    entity_uri = f"https://heritagegraph.org/{entity_type}/{entity_id}"
    return await oxigraph.sparql_query(Q.PROVENANCE_FOR_ENTITY(entity_uri))


@router.get("/conditions/{object_id}")
async def condition_history(object_id: str) -> object:
    object_uri = f"https://heritagegraph.org/object/{object_id}"
    return await oxigraph.sparql_query(Q.CONDITION_HISTORY(object_uri))


@router.get("/guthi/{guthi_id}/members")
async def guthi_members(guthi_id: str) -> object:
    guthi_uri = f"https://heritagegraph.org/guthi/{guthi_id}"
    return await oxigraph.sparql_query(Q.GUTHI_MEMBERS(guthi_uri))


@router.get("/actor/{actor_id}/activities")
async def actor_activities(actor_id: str) -> object:
    actor_uri = f"https://heritagegraph.org/actor/{actor_id}"
    return await oxigraph.sparql_query(Q.ACTOR_ACTIVITIES(actor_uri))


@router.get("/festival/{festival_id}/rituals")
async def festival_rituals(festival_id: str) -> object:
    festival_uri = f"https://heritagegraph.org/festival/{festival_id}"
    return await oxigraph.sparql_query(Q.FESTIVAL_RITUALS(festival_uri))


@router.get("/festival/{festival_id}/deities")
async def festival_deities(festival_id: str) -> object:
    festival_uri = f"https://heritagegraph.org/festival/{festival_id}"
    return await oxigraph.sparql_query(Q.FESTIVAL_DEITIES(festival_uri))
