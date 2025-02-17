import requests

# Oxigraph SPARQL endpoint
endpoint = "http://localhost:7878/update"

# SPARQL INSERT query
query = """
INSERT DATA {
    <http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .
}
"""

# Send the SPARQL query
response = requests.post(endpoint, data={"update": query}, headers={"Content-Type": "application/x-www-form-urlencoded"})

# Check response
print("Status Code:", response.status_code)
print("Response:", response.text)
import requests

# SPARQL Query endpoint
endpoint = "http://localhost:7878/query"

# SPARQL SELECT query
query = """
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
} LIMIT 10
"""

# Send the query
response = requests.get(endpoint, params={"query": query}, headers={"Accept": "application/sparql-results+json"})

# Print results
print("Response:", response.json())
