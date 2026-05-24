import yaml
import requests
import os

SCHEMA_FILE = "final_schema.yaml"
OXIGRAPH_SERVER_URL = "http://localhost:7878/"  # Change to your actual Oxigraph server URL
UPDATE_ENDPOINT = OXIGRAPH_SERVER_URL + "update"
QUERY_ENDPOINT = OXIGRAPH_SERVER_URL + "query"

NCHLOD = "https://cair-nepal.org/nchlod/"
RDF_TYPE = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>"
RDFS_CLASS = "<http://www.w3.org/2000/01/rdf-schema#Class>"

def load_schema():
    
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def send_update_query(sparql_update):
    
    headers = {"Content-Type": "application/sparql-update"}
    response = requests.post(UPDATE_ENDPOINT, data=sparql_update, headers=headers)
    if response.status_code == 200:
        print("Update successful.")
    else:
        print(f"Error in update: {response.text}")

def insert_class_data(class_name):
    
    class_uri = f"<{NCHLOD}{class_name}>"
    sparql_update = f"""
    INSERT DATA {{
        {class_uri} {RDF_TYPE} {RDFS_CLASS} .
    }}
    """
    send_update_query(sparql_update)
    print(f"Inserted class: {class_name}")

def insert_relation(class_name, slot, slot_type):
    
    subject_uri = f"<{NCHLOD}{class_name}>"
    predicate_uri = f"<{NCHLOD}{slot}>"
    object_uri = f"<{NCHLOD}{slot_type}>"

    sparql_update = f"""
    INSERT DATA {{
        {subject_uri} {predicate_uri} {object_uri} .
    }}
    """
    send_update_query(sparql_update)
    print(f"Inserted relation: {class_name} -- {slot} --> {slot_type}")

def store_schema_data():
    
    schema = load_schema()

    for class_name, class_data in schema.get("classes", {}).items():
        insert_class_data(class_name)

        for slot in class_data.get("slots", []):
            if slot in schema.get("slots", {}):
                slot_type = schema["slots"][slot]["range"]
                insert_relation(class_name, slot, slot_type)

    print("\nSchema successfully stored in Oxigraph server!")

def query_classes():
    
    sparql_query = """
    SELECT ?class WHERE {
        ?class <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2000/01/rdf-schema#Class> .
    }
    """
    response = requests.get(QUERY_ENDPOINT, params={"query": sparql_query}, headers={"Accept": "application/sparql-results+json"})
    if response.status_code == 200:
        results = response.json()
        print("\nStored Classes in Oxigraph Server:")
        for result in results["results"]["bindings"]:
            print(result["class"]["value"])
    else:
        print(f"Query error: {response.text}")

def query_relations():
    
    sparql_query = """
    SELECT ?s ?p ?o WHERE {
        ?s ?p ?o .
    } LIMIT 100
    """
    response = requests.get(QUERY_ENDPOINT, params={"query": sparql_query}, headers={"Accept": "application/sparql-results+json"})
    if response.status_code == 200:
        results = response.json()
        print("\nStored Relations in Oxigraph Server:")
        for result in results["results"]["bindings"]:
            print(f"{result['s']['value']} -- {result['p']['value']} --> {result['o']['value']}")
    else:
        print(f"Query error: {response.text}")

if __name__ == "__main__":
    try:
        store_schema_data()
        query_classes()
        query_relations()
    except Exception as e:
        print(f"An error occurred: {e}")
