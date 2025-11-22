import os
from pyoxigraph import Store
from rdflib import Namespace

DB_FILE = "oxigraphh_db"

NCHLOD = Namespace("https://cair-nepal.org/nchlod/")
RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")

def setup_store():
    if not os.path.exists(DB_FILE):
        raise FileNotFoundError("Database file not found. Run store_schema.py first.")
    return Store(DB_FILE)

def query_classes():
    store = setup_store()
    results = store.query("""
        SELECT ?class WHERE {
            ?class <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2000/01/rdf-schema#Class> .
        }
    """)
    
    print("\nStored Classes in Database:")
    for result in results:
        print(result["class"].value)

def query_relations():
    store = setup_store()
    results = store.query("""
        SELECT ?s ?p ?o WHERE {
            ?s ?p ?o .
        } LIMIT 20
    """)

    print("\nStored Relations in Database:")
    for result in results:
        print(f"{result['s'].value} -- {result['p'].value} --> {result['o'].value}")

if __name__ == "__main__":
    try:
        query_classes()
        query_relations()
    except Exception as e:
        print(f"An error occurred: {e}")
