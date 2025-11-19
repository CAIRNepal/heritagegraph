from rdflib import Graph

# Load TTL file
g = Graph()
g.parse("new_schema.ttl", format="turtle")

# Save as JSON-LD
g.serialize("new_schema.json", format="json-ld")
print("Conversion complete: new_schema.json created.")
