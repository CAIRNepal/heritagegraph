import networkx as nx
import matplotlib.pyplot as plt
from pyoxigraph import Store

# Load the Oxigraph database (NO NEED to open files manually)
db_path = "oxigraphhh_db"  # Your actual folder name
store = Store()  # Create a new Oxigraph store

# Load triples from the database
try:
    store = Store(db_path)  # Directly load the database
    print("Database loaded successfully.")
except Exception as e:
    print(f"Error loading database: {e}")

# SPARQL Query to get all triples
query = """
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
"""

# Execute the query
results = store.query(query)

# Initialize a Directed Graph
G = nx.DiGraph()

# Debugging: Print retrieved triples
for row in results:
    print(row)  # Print each triple to verify
    s, p, o = row.get("s"), row.get("p"), row.get("o")

    if s and o:
        G.add_node(str(s))  # Add subject node
        G.add_node(str(o))  # Add object node
        G.add_edge(str(s), str(o), label=str(p))  # Add edge with predicate label

# Check if the graph contains any nodes
if len(G.nodes) == 0:
    print("Graph is empty. No triples found.")

# Draw the Graph
plt.figure(figsize=(12, 8))
pos = nx.spring_layout(G, seed=42)  # Use force-directed layout
edges = G.edges(data=True)

# Draw nodes and edges
nx.draw(G, pos, with_labels=True, node_color="lightblue", edge_color="gray", node_size=2500, font_size=10)
nx.draw_networkx_edge_labels(G, pos, edge_labels={(s, o): data['label'] for s, o, data in edges}, font_size=8)

# Show Graph
plt.title("RDF Knowledge Graph Visualization")
plt.show()
