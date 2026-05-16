import uuid
from datetime import datetime, timezone

from rdflib import Graph, Literal, URIRef
from rdflib.namespace import RDF, RDFS, XSD

from app.core.namespaces import DCTERMS, HG, PROV, bind_prefixes


def create_ingestion_id() -> str:
    return str(uuid.uuid4())


def data_graph_uri(ingestion_id: str) -> str:
    return f"https://heritagegraph.org/graph/data/{ingestion_id}"


def prov_graph_uri(ingestion_id: str) -> str:
    return f"https://heritagegraph.org/graph/prov/{ingestion_id}"


def build_provenance_graph(
    ingestion_id: str,
    agent_id: str,
    source: str,
    entity_type: str,
    entity_count: int,
) -> Graph:
    """Return a Graph of PROV-O triples describing one ingestion event."""
    g = bind_prefixes(Graph())

    now = Literal(datetime.now(timezone.utc).isoformat(), datatype=XSD.dateTime)

    data_g   = URIRef(data_graph_uri(ingestion_id))
    activity = URIRef(f"https://heritagegraph.org/activity/{ingestion_id}")
    agent    = URIRef(f"https://heritagegraph.org/agent/{agent_id}")

    # Named graph is a prov:Entity
    g.add((data_g, RDF.type,                PROV.Entity))
    g.add((data_g, PROV.wasGeneratedBy,     activity))
    g.add((data_g, PROV.wasAttributedTo,    agent))
    g.add((data_g, PROV.generatedAtTime,    now))
    g.add((data_g, DCTERMS.description,
           Literal(f"{entity_type} ingestion — {entity_count} entities")))

    # Ingestion activity
    g.add((activity, RDF.type,                PROV.Activity))
    g.add((activity, PROV.startedAtTime,      now))
    g.add((activity, PROV.wasAssociatedWith,  agent))
    g.add((activity, RDFS.label,
           Literal(f"Ingest {entity_type}")))

    # Agent
    g.add((agent, RDF.type,   PROV.Agent))
    g.add((agent, RDFS.label, Literal(agent_id)))

    # Source (URL → URIRef, plain string → minted URI)
    src_uri = (
        URIRef(source)
        if source.startswith("http")
        else URIRef(f"https://heritagegraph.org/source/{source}")
    )
    g.add((src_uri,   RDF.type,        PROV.Entity))
    g.add((activity,  PROV.used,       src_uri))
    g.add((data_g,    PROV.wasDerivedFrom, src_uri))

    return g
