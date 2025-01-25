from SPARQLWrapper import SPARQLWrapper, POST, JSON

# Define the Oxigraph endpoint
sparql_endpoint = "http://localhost:7878/update"

# Initialize the SPARQLWrapper
sparql = SPARQLWrapper(sparql_endpoint)

# Set the query
query = """
PREFIX ex: <http://example.org/>
INSERT DATA {
    ex:Subject1 ex:Predicate1 ex:Object1 .
    ex:Subject2 ex:Predicate2 ex:Object2 .
}
"""

# Set the request method and headers
sparql.setMethod(POST)
sparql.setQuery(query)
sparql.setReturnFormat(JSON)

# Execute the query and handle the response
try:
    response = sparql.query()
    print("Query executed successfully!")
    print("Response:", response.response.read().decode())
except Exception as e:
    print("Error occurred:", e)
