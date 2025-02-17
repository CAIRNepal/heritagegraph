import yaml
import os
from pyoxigraph import Store, NamedNode, Literal, Quad
from rdflib import Namespace


SCHEMA_FILE = "final_schema.yaml"
DB_FILE = "oxigraph_db"


NCHLOD = Namespace("https://cair-nepal.org/nchlod/")
RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")

def load_schema():
    
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        schema = yaml.safe_load(f)
    return schema

def setup_store():
    
    if not os.path.exists(DB_FILE):
        os.makedirs(DB_FILE)
    return Store(DB_FILE)

def insert_class_data(store, class_name):
   
    class_uri = NCHLOD[class_name]

    quad = Quad(
        NamedNode(str(class_uri)),  # Subject
        NamedNode(str(RDF.type)),   # Predicate 
        NamedNode(str(RDFS.Class)),  # Object 
        None                        
    )
    store.add(quad)
    print(f"Inserted class: {class_name}")

def insert_relation(store, class_name, slot, slot_type):
    
    subject_uri = NCHLOD[class_name]
    predicate_uri = NCHLOD[slot]
    object_uri = NCHLOD[slot_type]

    quad = Quad(
        NamedNode(str(subject_uri)),  
        NamedNode(str(predicate_uri)),  
        NamedNode(str(object_uri)),    
        None                          
    )
    store.add(quad)
    print(f"Inserted relation: {class_name} -- {slot} --> {slot_type}")

def store_schema_data():
    
    schema = load_schema()
    store = setup_store()

    # Insert classes
    for class_name, class_data in schema.get("classes", {}).items():
        insert_class_data(store, class_name)
        
        # Insert relationships (slots)
        for slot in class_data.get("slots", []):
            if slot in schema.get("slots", {}):
                slot_type = schema["slots"][slot]["range"]
                insert_relation(store, class_name, slot, slot_type)
    
    print("\nSchema successfully stored in PyOxigraph!")
    print(f"Total quads in store: {len(list(store))}") 

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
        } LIMIT 10
    """)

    print("\nStored Relations in Database:")
    for result in results:
        print(f"{result['s'].value} -- {result['p'].value} --> {result['o'].value}")

if __name__ == "__main__":
    try:
        store_schema_data()
        query_classes()
        query_relations()
    except Exception as e:
        print(f"An error occurred: {e}")