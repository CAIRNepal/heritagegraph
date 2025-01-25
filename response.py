from SPARQLWrapper import SPARQLWrapper, JSON

# Define the SPARQL endpoint
sparql_endpoint = "http://localhost:7878/query"

# Initialize SPARQLWrapper
sparql = SPARQLWrapper(sparql_endpoint)

# Define the SELECT query to retrieve data
query = """
PREFIX ex: <http://example.org/>
SELECT ?s ?p ?o
WHERE {
    ?s ?p ?o .
}
"""

# Set the query and return format
sparql.setQuery(query)
sparql.setReturnFormat(JSON)

# Execute the query and print the response
try:
    # Execute the query
    results = sparql.query().convert()

    # Print the raw JSON response (optional, for debugging)
    print("Raw JSON Response:")
    print(results)

    # Process and print the retrieved triples
    print("\nRetrieved Triples:")
    for result in results["results"]["bindings"]:
        subject = result["s"]["value"]
        predicate = result["p"]["value"]
        obj = result["o"]["value"]
        print(f"{subject} {predicate} {obj}")
except Exception as e:
    print("Error occurred:", e)
